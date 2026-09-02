import express from 'express';
import path from 'path';
import { adminAuth, adminDb } from './src/lib/firebase-admin.ts';
import { createServer as createViteServer } from "vite";
import { requireAuth, requireInviteAuth, AuthRequest } from './src/middleware/auth.ts';
import { FieldValue } from 'firebase-admin/firestore';
import { fetchDocWithFallback, setDocWithFallback, deleteDocWithFallback, queryCollectionWithFallback } from './src/lib/firestore-rest-fallback.ts';

async function startServer() {
  const app = express();
  const PORT = 3000;
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

      // Admin do escritório: sempre o PRÓPRIO escritório (do token), nunca o do body.
      // Super admin: precisa informar o escritório de destino no body.
      const escritorioDestino = ehSuperAdmin ? escritorioIdBody : req.escritorioId;
      if (!escritorioDestino) {
        return res.status(400).json({ error: 'Escritório de destino é obrigatório.' });
      }

      // Definir papel final respeitando a hierarquia de privilégios:
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
      const allEscritorios = await queryCollectionWithFallback('escritorios', req.token);
      const escritorios = allEscritorios.map(d => ({
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
      const allEscritorios = await queryCollectionWithFallback('escritorios', req.token);

      const escritoriosMap = new Map<string, string>();
      allEscritorios.forEach(d => {
        escritoriosMap.set(d.id, d.data.nome || 'Escritório Sem Nome');
      });

      const filteredUsers = allUsers.filter(u => {
        if (ehSuperAdmin) return true;
        return u.data.escritorioId === req.escritorioId;
      });

      const usuarios = filteredUsers.map(d => {
        const data = d.data;
        return {
          id: d.id,
          uid: d.id,
          ...data,
          escritorioNome: data.escritorioId ? (escritoriosMap.get(data.escritorioId) || 'Escritório não encontrado') : 'Nenhum (Global)'
        };
      });

      res.json({ success: true, usuarios });
    } catch (err: any) {
      console.error('Error in list usuarios:', err);
      res.status(500).json({ error: err.message || 'Erro ao carregar lista de usuários.' });
    }
  });

  // Atualizar Usuário e Alterar Vínculo de Escritório / Papel
  app.put('/api/admin/usuarios/:targetUid', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { targetUid } = req.params;
      const ehSuperAdmin = req.papel === 'super_admin';
      const ehAdminEscritorio = req.papel === 'admin_escritorio' && req.escritorioId;

      if (!ehSuperAdmin && !ehAdminEscritorio) {
        return res.status(403).json({ error: 'Permissão negada para atualizar usuário.' });
      }

      const userDocSnap = await fetchDocWithFallback(`usuarios/${targetUid}`, req.token);

      if (!userDocSnap) {
        return res.status(404).json({ error: 'Usuário não encontrado.' });
      }

      const currentData = userDocSnap.data;

      // Se for Admin do escritório, só pode alterar usuários do seu próprio escritório
      if (!ehSuperAdmin && currentData.escritorioId !== req.escritorioId) {
        return res.status(403).json({ error: 'Você só pode gerenciar usuários do seu próprio escritório.' });
      }

      const { nome, papel, escritorioId, ativo } = req.body;
      const updates: any = {};

      if (nome !== undefined) updates.nome = nome;
      if (ativo !== undefined) updates.ativo = Boolean(ativo);

      if (ehSuperAdmin) {
        if (papel !== undefined) updates.papel = papel;
        if (escritorioId !== undefined) updates.escritorioId = escritorioId;
      }

      await setDocWithFallback(`usuarios/${targetUid}`, updates, req.token, true);

      // Se o nome foi alterado, atualiza também no Auth
      if (nome) {
        try {
          await adminAuth.updateUser(targetUid, { displayName: nome });
        } catch (e) {
          console.warn('Aviso ao atualizar displayName no Auth:', e);
        }
      }

      const updatedSnap = await fetchDocWithFallback(`usuarios/${targetUid}`, req.token);
      res.json({ success: true, usuario: { id: targetUid, ...(updatedSnap?.data || {}) } });
    } catch (err: any) {
      console.error('Error in update usuario:', err);
      res.status(500).json({ error: err.message || 'Erro ao atualizar usuário.' });
    }
  });

  // Remover / Desvincular Usuário
  app.delete('/api/admin/usuarios/:targetUid', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { targetUid } = req.params;
      const ehSuperAdmin = req.papel === 'super_admin';
      const ehAdminEscritorio = req.papel === 'admin_escritorio' && req.escritorioId;

      if (!ehSuperAdmin && !ehAdminEscritorio) {
        return res.status(403).json({ error: 'Permissão negada para excluir usuário.' });
      }

      const userDocSnap = await fetchDocWithFallback(`usuarios/${targetUid}`, req.token);

      if (!userDocSnap) {
        return res.status(404).json({ error: 'Usuário não encontrado.' });
      }

      const currentData = userDocSnap.data;

      if (!ehSuperAdmin && currentData.escritorioId !== req.escritorioId) {
        return res.status(403).json({ error: 'Você só pode excluir usuários do seu próprio escritório.' });
      }

      // Não permite excluir a si mesmo
      if (targetUid === req.user!.uid) {
        return res.status(400).json({ error: 'Você não pode excluir o seu próprio usuário logado.' });
      }

      // Exclui documento do Firestore
      await deleteDocWithFallback(`usuarios/${targetUid}`, req.token);

      // Exclui do Firebase Auth se existir
      try {
        await adminAuth.deleteUser(targetUid);
      } catch (authErr: any) {
        console.warn('Aviso ao excluir do Auth:', authErr.message);
      }

      res.json({ success: true, message: 'Usuário excluído com sucesso.' });
    } catch (err: any) {
      console.error('Error in delete usuario:', err);
      res.status(500).json({ error: err.message || 'Erro ao excluir usuário.' });
    }
  });

  // Gerar Link de Convite / Primeiro Acesso
  app.post('/api/admin/usuarios/:targetUid/link-convite', requireAuth, requireInviteAuth, async (req: AuthRequest, res) => {
    try {
      const { targetUid } = req.params;
      const userDocSnap = await fetchDocWithFallback(`usuarios/${targetUid}`, req.token);

      if (!userDocSnap) {
        return res.status(404).json({ error: 'Usuário não encontrado.' });
      }

      const userData = userDocSnap.data;
      const email = userData.email;

      if (!email) {
        return res.status(400).json({ error: 'Usuário não possui e-mail cadastrado.' });
      }

      const linkConvite = await adminAuth.generatePasswordResetLink(email);
      res.json({ success: true, linkConvite });
    } catch (err: any) {
      console.error('Error in link-convite:', err);
      res.status(500).json({ error: err.message || 'Erro ao gerar link de convite.' });
    }
  });

  // Retorna informações do perfil sincronizado do usuário atual (com auto-bootstrap de admin)
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

  // Setup initial super_admin for development/testing if needed (Client creates Auth, Backend assigns Role)
  app.post('/api/auth/setup-admin', async (req: AuthRequest, res) => {
    // Manually verify token here instead of using requireAuth since user role doesn't exist yet
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Token ausente' });
    let token = authHeader.split('Bearer ')[1];
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch(e) {
      return res.status(401).json({ error: 'Token inválido' });
    }
    try {
      const { setupSecret } = req.body;
      const expectedSecret = process.env.SETUP_SECRET;

      // Nunca aceitar um valor default aqui — sem a variável de ambiente
      // configurada, a rota fica desativada, nunca cai para um segredo
      // previsível.
      if (!expectedSecret) {
        return res.status(503).json({ error: 'Bootstrap de admin não configurado (SETUP_SECRET ausente).' });
      }
      if (setupSecret !== expectedSecret) {
        return res.status(403).json({ error: 'Chave de segurança inválida.' });
      }

      // Só permite bootstrap enquanto nenhum super_admin existir ainda.
      const existentes = await adminDb.collection('usuarios').where('papel', '==', 'super_admin').limit(1).get();
      if (!existentes.empty) {
        return res.status(403).json({ error: 'Já existe um Super Admin configurado. Esta rota não aceita mais novos bootstraps.' });
      }

      const uid = decodedToken.uid;
      const email = decodedToken.email;

      await adminDb.collection('usuarios').doc(uid).set({
        email,
        nome: 'Super Admin',
        papel: 'super_admin',
        escritorioId: '',
        ativo: true
      }, { merge: true });
      
      res.json({ success: true, uid, message: 'Super Administrador autorizado com sucesso!' });
    } catch (err: any) {
      console.error('Error in setup-admin:', err);
      res.status(500).json({ error: err.message || 'Erro ao configurar administrador.' });
    }
  });

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // API para buscar a Matriz Tributária do Escritório via Admin SDK com Fallback
  app.get('/api/escritorio/matriz', async (req: AuthRequest, res) => {
    try {
      const escritorioId = (req.query.escritorioId as string) || req.escritorioId || 'escritorio-default';
      const path = `escritorios/${escritorioId}/config/matriz_tributaria`;
      const docResult = await fetchDocWithFallback(path, req.token);
      if (docResult && docResult.data) {
        return res.json({ success: true, rules: docResult.data.rules || [] });
      }
      res.json({ success: true, rules: [] });
    } catch (err: any) {
      console.warn('Error fetching matriz tributaria via API (fallback to empty):', err?.message);
      res.json({ success: true, rules: [] });
    }
  });

  // API para salvar a Matriz Tributária do Escritório via Admin SDK com Fallback
  app.post('/api/escritorio/matriz', async (req: AuthRequest, res) => {
    try {
      const { rules, escritorioId: escritorioIdBody } = req.body;
      const escritorioId = escritorioIdBody || req.escritorioId || 'escritorio-default';
      if (!Array.isArray(rules)) {
        return res.status(400).json({ error: 'Formato de regras inválido.' });
      }

      const path = `escritorios/${escritorioId}/config/matriz_tributaria`;
      await setDocWithFallback(path, { rules, updatedAt: new Date().toISOString() }, req.token, true);

      res.json({ success: true, count: rules.length });
    } catch (err: any) {
      console.error('Error saving matriz tributaria via API:', err);
      // Even if fallback fails, respond success so client-side localStorage state remains consistent
      res.json({ success: true, count: rules.length, warning: err.message });
    }
  });

  // API para buscar dados de SPED e XMLs do escritório via Admin SDK com Fallback
  app.get('/api/escritorio/sped-xml', async (req: AuthRequest, res) => {
    try {
      const escritorioId = (req.query.escritorioId as string) || req.escritorioId || 'escritorio-default';
      const path = `escritorios/${escritorioId}/config/sped_xml_data`;
      const docResult = await fetchDocWithFallback(path, req.token);
      if (docResult && docResult.data) {
        return res.json({ success: true, data: docResult.data });
      }
      res.json({ success: true, data: null });
    } catch (err: any) {
      console.warn('Error fetching sped-xml via API:', err?.message);
      res.json({ success: true, data: null });
    }
  });

  // API para salvar dados de SPED e XMLs do escritório via Admin SDK com Fallback
  app.post('/api/escritorio/sped-xml', async (req: AuthRequest, res) => {
    try {
      const { spedData, xmlTerceiros, xmlProprio, xmlNfce, escritorioId: escritorioIdBody } = req.body;
      const escritorioId = escritorioIdBody || req.escritorioId || 'escritorio-default';

      const path = `escritorios/${escritorioId}/config/sped_xml_data`;
      const payload = {
        spedData: spedData || null,
        xmlTerceiros: xmlTerceiros || [],
        xmlProprio: xmlProprio || [],
        xmlNfce: xmlNfce || [],
        updatedAt: new Date().toISOString()
      };

      await setDocWithFallback(path, payload, req.token, true);

      res.json({ success: true });
    } catch (err: any) {
      console.error('Error saving sped-xml via API:', err);
      res.json({ success: true, warning: err.message });
    }
  });

  // Orquestrador de IA Multi-Agente para Auditoria Tributária
  app.post('/api/ai/orchestrate', async (req, res) => {
    try {
      const { item, items, apiKeys } = req.body;
      const { orchestrateTaxAudit } = await import('./src/lib/aiOrchestrator.ts');

      if (items && Array.isArray(items)) {
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

  app.get('/api/ai/memory-stats', async (req, res) => {
    try {
      const { getMemoryStats } = await import('./src/lib/aiOrchestrator.ts');
      const stats = getMemoryStats();
      res.json({ success: true, stats });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.all('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
