import express from 'express';
import { adminAuth, adminDb } from '../lib/firebase-admin.ts';
import { requireAuth, requireInviteAuth, AuthRequest } from '../middleware/auth.ts';
import { FieldValue } from 'firebase-admin/firestore';
import { fetchDocWithFallback, setDocWithFallback, deleteDocWithFallback, queryCollectionWithFallback } from '../lib/firestore-rest-fallback.ts';

export async function createApp() {
  const app = express();
  app.use(express.json({ limit: '50mb' }));

  // Super Admin: Criar Escritório
  app.post('/api/admin/escritorios', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (req.papel !== 'super_admin') {
        return res.status(403).json({ error: 'Só o Super Admin cria escritórios.' });
      }

      const { emailAdmin, nomeAdmin, nomeEscritorio, cnpj, senhaAdmin } = req.body;
      if (!emailAdmin || !nomeEscritorio) {
         return res.status(400).json({ error: 'Dados insuficientes. Informe o nome do escritório e e-mail do admin.' });
      }

      const escritorioRef = adminDb.collection('escritorios').doc();
      await setDocWithFallback(`escritorios/${escritorioRef.id}`, {
        nome: nomeEscritorio, 
        cnpj: cnpj || '', 
        ativo: true,
        emailAdmin,
        nomeAdmin,
        dataCriacao: new Date().toISOString()
      }, req.token);

      let uid = '';
      let linkConvite = '';

      try {
        let novoUsuario;
        try {
          const createOpts: any = { email: emailAdmin, displayName: nomeAdmin || nomeEscritorio };
          if (senhaAdmin && senhaAdmin.trim().length >= 6) {
            createOpts.password = senhaAdmin.trim();
          }
          novoUsuario = await adminAuth.createUser(createOpts);
          uid = novoUsuario.uid;
        } catch (createErr: any) {
          if (createErr.code === 'auth/email-already-exists') {
            const existingUser = await adminAuth.getUserByEmail(emailAdmin);
            uid = existingUser.uid;
            if (senhaAdmin && senhaAdmin.trim().length >= 6) {
              await adminAuth.updateUser(uid, { password: senhaAdmin.trim() });
            }
          } else {
            console.warn('Aviso auth.createUser:', createErr.message);
          }
        }

        if (uid) {
          await setDocWithFallback(`usuarios/${uid}`, {
            email: emailAdmin, 
            nome: nomeAdmin || nomeEscritorio,
            papel: 'admin_escritorio', 
            escritorioId: escritorioRef.id,
            ativo: true
          }, req.token, true);

          if (!senhaAdmin || senhaAdmin.trim().length < 6) {
            try {
              linkConvite = await adminAuth.generatePasswordResetLink(emailAdmin);
            } catch (e) {
              console.error('Erro gerar link reset:', e);
            }
          }
        }
      } catch (authError: any) {
        console.warn('Não foi possível associar o usuário no Auth Admin, mantendo documento no Firestore:', authError.message);
      }

      res.json({ success: true, escritorioId: escritorioRef.id, uid, linkConvite });
    } catch (err: any) {
      console.error('Error in criar-escritorio:', err);
      res.status(500).json({ error: err.message || 'Erro ao criar escritório.' });
    }
  });

  // Convidar Colaborador ou Admin de Escritório (Admin de Escritório ou Super Admin)
  app.post('/api/escritorio/convidar', requireAuth, requireInviteAuth, async (req: AuthRequest, res) => {
    try {
      const ehAdminEscritorio = req.papel === 'admin_escritorio' && req.escritorioId;
      const ehSuperAdmin = req.papel === 'super_admin';
      if (!ehAdminEscritorio && !ehSuperAdmin) {
        return res.status(403).json({ error: 'Apenas o Admin do Escritório ou o Super Admin podem convidar colaboradores.' });
      }

      const { email, nome, escritorioId: escritorioIdBody, papel: papelBody, senha } = req.body;

      let papelFinal = 'colaborador';
      if (ehSuperAdmin) {
        if (papelBody === 'super_admin' || papelBody === 'admin_escritorio' || papelBody === 'colaborador') {
          papelFinal = papelBody;
        }
      } else if (ehAdminEscritorio) {
        if (papelBody === 'admin_escritorio' || papelBody === 'colaborador') {
          papelFinal = papelBody;
        }
      }

      const escritorioDestino = ehSuperAdmin ? (escritorioIdBody || '') : req.escritorioId;
      if (!escritorioDestino && papelFinal !== 'super_admin') {
        return res.status(400).json({ error: 'Escritório de destino é obrigatório.' });
      }

      let uid = '';
      try {
        const createOpts: any = { email, displayName: nome };
        if (senha && senha.trim().length >= 6) {
          createOpts.password = senha.trim();
        }
        const novoUsuario = await adminAuth.createUser(createOpts);
        uid = novoUsuario.uid;
      } catch (authErr: any) {
        if (authErr.code === 'auth/email-already-exists') {
          const existingUser = await adminAuth.getUserByEmail(email);
          uid = existingUser.uid;
          if (senha && senha.trim().length >= 6) {
            await adminAuth.updateUser(uid, { password: senha.trim() });
          }
          if (nome && nome.trim()) {
            await adminAuth.updateUser(uid, { displayName: nome.trim() });
          }
        } else {
          throw authErr;
        }
      }

      await setDocWithFallback(`usuarios/${uid}`, {
        email, 
        nome: nome || email, 
        papel: papelFinal, 
        escritorioId: escritorioDestino,
        convidadoPor: req.user!.uid, 
        ativo: true
      }, req.token, true);

      let linkConvite = '';
      if (!senha || senha.trim().length < 6) {
        try {
          linkConvite = await adminAuth.generatePasswordResetLink(email);
        } catch (e) {
          console.warn('Aviso ao gerar link de convite:', e);
        }
      }

      res.json({ success: true, uid, linkConvite });
    } catch (err: any) {
      console.error('Error in convidar:', err);
      res.status(500).json({ error: err.message || 'Erro ao convidar.' });
    }
  });

  // Listar Escritórios
  app.get('/api/admin/escritorios', requireAuth, async (req: AuthRequest, res) => {
    try {
      const ehSuperAdmin = req.papel === 'super_admin';
      const ehAdminEscritorio = req.papel === 'admin_escritorio' && req.escritorioId;

      if (!ehSuperAdmin && !ehAdminEscritorio) {
        return res.status(403).json({ error: 'Acesso negado para listar escritórios.' });
      }

      const allEscritorios = await queryCollectionWithFallback('escritorios', req.token);
      const filteredEscritorios = allEscritorios.filter(d => {
        if (ehSuperAdmin) return true;
        return d.id === req.escritorioId;
      });

      const escritorios = filteredEscritorios.map(d => ({
        id: d.id,
        ...d.data
      }));
      res.json({ success: true, escritorios });
    } catch (err: any) {
      console.error('Error in list escritorios:', err);
      res.status(500).json({ error: err.message || 'Erro ao carregar escritórios.' });
    }
  });

  // Listar Todos os Usuários e seus Vínculos com Escritórios
  app.get('/api/admin/usuarios', requireAuth, async (req: AuthRequest, res) => {
    try {
      const ehSuperAdmin = req.papel === 'super_admin';
      const ehAdminEscritorio = req.papel === 'admin_escritorio' && req.escritorioId;

      if (!ehSuperAdmin && !ehAdminEscritorio) {
        return res.status(403).json({ error: 'Acesso negado para listar usuários.' });
      }

      const allUsers = await queryCollectionWithFallback('usuarios', req.token);
      const filteredUsers = allUsers.filter(d => {
        if (ehSuperAdmin) return true;
        return d.data.escritorioId === req.escritorioId;
      });

      const usuarios = filteredUsers.map(d => ({
        uid: d.id,
        ...d.data
      }));
      res.json({ success: true, usuarios });
    } catch (err: any) {
      console.error('Error listing users:', err);
      res.status(500).json({ error: err.message || 'Erro ao listar usuários.' });
    }
  });

  // Listar Auditorias / Eventos do Sistema (para Relatórios ADM)
  app.get('/api/admin/eventos', requireAuth, async (req: AuthRequest, res) => {
    try {
      const ehSuperAdmin = req.papel === 'super_admin';
      const ehAdminEscritorio = req.papel === 'admin_escritorio' && req.escritorioId;

      if (!ehSuperAdmin && !ehAdminEscritorio) {
        return res.status(403).json({ error: 'Acesso negado para listar eventos.' });
      }

      const allEventos = await queryCollectionWithFallback('eventos_sistema', req.token);
      const filteredEventos = allEventos.filter(d => {
        if (ehSuperAdmin) return true;
        return d.data.escritorioId === req.escritorioId;
      });

      const eventos = filteredEventos.map(d => ({
        id: d.id,
        ...d.data
      }));
      eventos.sort((a: any, b: any) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());

      res.json({ success: true, eventos });
    } catch (err: any) {
      console.error('Error listing eventos:', err);
      res.status(500).json({ error: err.message || 'Erro ao listar eventos do sistema.' });
    }
  });

  // Sistema de Log de Erros e Monitoramento
  app.post('/api/admin/erros', async (req: AuthRequest, res) => {
    try {
      const errorLog = req.body;
      if (!errorLog || !errorLog.message) {
        return res.status(400).json({ error: 'Dados de erro inválidos.' });
      }
      await setDocWithFallback(`system_erros/${errorLog.id || Date.now()}`, {
        ...errorLog,
        receivedAt: new Date().toISOString()
      }, req.token, true);
      res.json({ success: true });
    } catch (err: any) {
      console.error('Error posting error log:', err);
      res.status(500).json({ error: err.message || 'Erro ao registrar log de erro.' });
    }
  });

  app.get('/api/admin/erros', requireAuth, async (req: AuthRequest, res) => {
    try {
      const ehSuperAdmin = req.papel === 'super_admin';
      const ehAdminEscritorio = req.papel === 'admin_escritorio' && req.escritorioId;

      if (!ehSuperAdmin && !ehAdminEscritorio) {
        return res.status(403).json({ error: 'Acesso negado para visualizar logs de erro.' });
      }

      const allErros = await queryCollectionWithFallback('system_erros', req.token);
      const erros = allErros.map(d => ({ id: d.id, ...d.data }));
      erros.sort((a: any, b: any) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());

      res.json({ success: true, erros });
    } catch (err: any) {
      console.error('Error listing system errors:', err);
      res.status(500).json({ error: err.message || 'Erro ao listar logs de erro.' });
    }
  });

  // Atualizar Usuário e Alterar Vínculo de Escritório / Papel / Nome
  app.put('/api/admin/usuarios/:targetUid', requireAuth, async (req: AuthRequest, res) => {
    try {
      const ehSuperAdmin = req.papel === 'super_admin';
      const ehAdminEscritorio = req.papel === 'admin_escritorio' && req.escritorioId;

      if (!ehSuperAdmin && !ehAdminEscritorio) {
        return res.status(403).json({ error: 'Acesso negado.' });
      }

      const { targetUid } = req.params;
      const { papel, escritorioId, ativo, nome } = req.body;

      const targetDoc = await fetchDocWithFallback(`usuarios/${targetUid}`, req.token);

      if (ehAdminEscritorio && !ehSuperAdmin) {
        if (targetDoc?.data && targetDoc.data.escritorioId !== req.escritorioId) {
          return res.status(403).json({ error: 'Você só pode gerenciar usuários do seu próprio escritório.' });
        }
        if (papel === 'super_admin' || papel === 'admin_escritorio') {
          return res.status(403).json({ error: 'Admin de escritório não pode promover usuários a super_admin ou admin_escritorio.' });
        }
      }

      const updateData: any = {};
      if (nome !== undefined) updateData.nome = nome;
      if (papel !== undefined) updateData.papel = papel;
      if (escritorioId !== undefined) updateData.escritorioId = escritorioId;
      if (ativo !== undefined) updateData.ativo = ativo;

      await setDocWithFallback(`usuarios/${targetUid}`, updateData, req.token, true);

      if (nome && typeof nome === 'string' && nome.trim()) {
        try {
          await adminAuth.updateUser(targetUid, { displayName: nome.trim() });
        } catch (authErr: any) {
          console.warn('Aviso ao atualizar displayName no Auth Admin:', authErr?.message);
        }
      }

      res.json({ success: true, message: 'Usuário atualizado com sucesso.' });
    } catch (err: any) {
      console.error('Error updating user:', err);
      res.status(500).json({ error: err.message || 'Erro ao atualizar usuário.' });
    }
  });

  // Gerar Link de Convite / Reset de Senha para um Usuário
  app.post('/api/admin/usuarios/:targetUid/link-convite', requireAuth, async (req: AuthRequest, res) => {
    try {
      const ehSuperAdmin = req.papel === 'super_admin';
      const ehAdminEscritorio = req.papel === 'admin_escritorio' && req.escritorioId;

      if (!ehSuperAdmin && !ehAdminEscritorio) {
        return res.status(403).json({ error: 'Acesso negado para gerar link de convite.' });
      }

      const { targetUid } = req.params;
      const targetUser = await adminAuth.getUser(targetUid);
      if (!targetUser || !targetUser.email) {
        return res.status(404).json({ error: 'Usuário ou e-mail não encontrado.' });
      }

      if (ehAdminEscritorio && !ehSuperAdmin) {
        const targetDoc = await fetchDocWithFallback(`usuarios/${targetUid}`, req.token);
        if (!targetDoc || targetDoc?.data?.escritorioId !== req.escritorioId) {
          return res.status(403).json({ error: 'Você só pode gerar links para usuários do seu próprio escritório.' });
        }
      }

      const linkConvite = await adminAuth.generatePasswordResetLink(targetUser.email);
      res.json({ success: true, linkConvite });
    } catch (err: any) {
      console.error('Error generating invite link:', err);
      res.status(500).json({ error: err.message || 'Erro ao gerar link de convite.' });
    }
  });

  // Deletar Usuário
  app.delete('/api/admin/usuarios/:targetUid', requireAuth, async (req: AuthRequest, res) => {
    try {
      const ehSuperAdmin = req.papel === 'super_admin';
      if (!ehSuperAdmin) {
        return res.status(403).json({ error: 'Apenas o Super Admin pode excluir usuários.' });
      }

      const { targetUid } = req.params;
      await adminAuth.deleteUser(targetUid);
      await deleteDocWithFallback(`usuarios/${targetUid}`, req.token);

      res.json({ success: true });
    } catch (err: any) {
      console.error('Error deleting user:', err);
      res.status(500).json({ error: err.message || 'Erro ao excluir usuário.' });
    }
  });

  // Setup initial super_admin for development/testing if needed
  app.post('/api/auth/setup-admin', async (req: AuthRequest, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Token ausente' });
    let token = authHeader.split('Bearer ')[1];
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch(e) {
      return res.status(401).json({ error: 'Token inválido' });
    }

    const secret = req.body.secret || req.headers['x-setup-secret'];
    const expectedSecret = process.env.SETUP_SECRET;

    if (!expectedSecret || secret !== expectedSecret) {
      return res.status(403).json({ error: 'Segredo de setup inválido ou SETUP_SECRET não configurado.' });
    }

    try {
      const superAdmins = await adminDb.collection('usuarios').where('papel', '==', 'super_admin').get();
      if (!superAdmins.empty) {
        const jaTem = superAdmins.docs.some(d => d.id !== decodedToken.uid);
        if (jaTem) {
          return res.status(400).json({ error: 'Já existe outro Super Admin configurado no sistema. Setup bloqueado.' });
        }
      }

      await setDocWithFallback(`usuarios/${decodedToken.uid}`, {
        email: decodedToken.email || '',
        nome: decodedToken.name || decodedToken.email || 'Super Admin',
        papel: 'super_admin',
        escritorioId: '',
        ativo: true
      }, token, true);

      res.json({ success: true, message: 'Super admin configurado com sucesso!' });
    } catch (err: any) {
      console.error('Error setup admin:', err);
      res.status(500).json({ error: err.message || 'Erro ao configurar admin' });
    }
  });

  // Retorna informações do perfil sincronizado do usuário atual
  app.get('/api/auth/me', requireAuth, async (req: AuthRequest, res) => {
    try {
      res.json({
        success: true,
        user: {
          uid: req.user!.uid,
          email: req.user!.email,
          displayName: req.user!.name || req.user!.displayName
        },
        userData: {
          uid: req.user!.uid,
          email: req.user!.email,
          papel: req.papel,
          escritorioId: req.escritorioId
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Erro ao buscar perfil' });
    }
  });

  // Rota de IA / Orquestração Fiscal
  app.post('/api/ai/orchestrate', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.escritorioId) {
        return res.status(403).json({ error: 'Usuário sem escritório vinculado.' });
      }

      const { item, items, apiKeys } = req.body;
      const { orchestrateTaxAudit } = await import('../lib/aiOrchestrator.ts');

      if (items && Array.isArray(items)) {
        const MAX_BATCH = 50;
        if (items.length > MAX_BATCH) {
          return res.status(400).json({ error: `Lote muito grande. Máximo de ${MAX_BATCH} itens por requisição.` });
        }
        const results = [];
        for (const singleItem of items) {
          const resAudit = await orchestrateTaxAudit(singleItem, apiKeys);
          results.push(resAudit);
        }
        return res.json({ success: true, count: results.length, batch: results });
      }

      if (!item || !item.descrItem || !item.ncm) {
        return res.status(400).json({ error: 'Item de produto com NCM e descrição é obrigatório.' });
      }

      const auditResult = await orchestrateTaxAudit(item, apiKeys);
      res.json({ success: true, result: auditResult });
    } catch (err: any) {
      console.error('Error in /api/ai/orchestrate:', err);
      res.status(500).json({ error: err.message || 'Erro ao processar orquestração de IA.' });
    }
  });

  app.get('/api/ai/memory-stats', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { getMemoryStats } = await import('../lib/aiOrchestrator.ts');
      const stats = getMemoryStats();
      res.json({ success: true, stats });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Global Express error handler to catch any unhandled errors cleanly in JSON format
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled server route error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err?.message || 'Erro no processamento da requisição.' });
    }
  });

  return app;
}
