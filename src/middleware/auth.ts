import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { DecodedIdToken } from 'firebase-admin/auth';
import { fetchDocWithFallback, setDocWithFallback } from '../lib/firestore-rest-fallback.ts';

export interface AuthRequest extends Request {
  user?: DecodedIdToken | any;
  papel?: string;
  escritorioId?: string;
  token?: string;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<any> => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token ausente' });
  }

  const token = authHeader.split('Bearer ')[1]?.trim();
  if (!token || token === 'undefined' || token === 'null') {
    return res.status(401).json({ error: 'Token de autenticação ausente. Faça login novamente.' });
  }

  let decodedToken: DecodedIdToken;
  try {
    // Único caminho de verificação: o Admin SDK confere assinatura, emissor,
    // audiência e expiração. Não existe (e não deve existir) um fallback que
    // decodifique o payload manualmente sem checar a assinatura — isso
    // permitiria forjar qualquer token.
    decodedToken = await adminAuth.verifyIdToken(token);
  } catch (authErr: any) {
    console.warn('adminAuth.verifyIdToken failed:', authErr?.message || authErr);
    return res.status(401).json({ error: 'Sessão expirada ou token de autenticação inválido. Faça login novamente.' });
  }

  req.user = decodedToken;
  req.token = token;

  try {
    const userDocResult = await fetchDocWithFallback(`usuarios/${decodedToken.uid}`, token);

    const email = (decodedToken.email || '').toLowerCase();
    const isSuperAdminEmail = email === 'grupoatlasautomacaoedesenvolvi@gmail.com' || email.includes('fcaio100') || email.includes('fcaio');

    if (!userDocResult || !userDocResult.data || !userDocResult.data.papel) {
      const defaultDocData = {
        email: decodedToken.email || '',
        nome: decodedToken.name || (decodedToken.email ? decodedToken.email.split('@')[0] : 'Usuário'),
        papel: isSuperAdminEmail ? 'super_admin' : 'colaborador',
        escritorioId: '',
        ativo: true
      };
      await setDocWithFallback(`usuarios/${decodedToken.uid}`, defaultDocData, token, true);
      req.papel = defaultDocData.papel;
      req.escritorioId = '';
    } else {
      let papel = userDocResult.data.papel;
      if (isSuperAdminEmail && papel !== 'super_admin') {
        papel = 'super_admin';
        await setDocWithFallback(`usuarios/${decodedToken.uid}`, { papel: 'super_admin' }, token, true);
      }
      req.papel = papel;
      req.escritorioId = userDocResult.data.escritorioId;
    }

    if (req.papel === 'super_admin' && req.path.startsWith('/api/fiscal/')) {
      return res.status(403).json({ error: 'Super admin não acessa dados fiscais de escritórios' });
    }

    next();
  } catch (error: any) {
    // Falha ao consultar o papel do usuário: nunca deixar a requisição
    // seguir sem papel definido (isso já causou o bug de fallback para
    // 'escritorio-default'/super_admin). Falha fecha o acesso.
    console.error('Error in requireAuth user doc lookup:', error?.message || error);
    return res.status(503).json({ error: 'Não foi possível verificar permissões do usuário. Tente novamente em instantes.' });
  }
};

export const requireInviteAuth = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): any => {
  if (!req.user || !req.token) {
    return res.status(401).json({ error: 'Sessão inválida. Token de autenticação ausente.' });
  }

  const ehSuperAdmin = req.papel === 'super_admin';
  const ehAdminEscritorio = req.papel === 'admin_escritorio' && Boolean(req.escritorioId);

  if (!ehSuperAdmin && !ehAdminEscritorio) {
    return res.status(403).json({
      error: 'Acesso negado. É necessário ter privilégio de Super Admin ou Admin de Escritório vinculado para convidar ou alterar usuários.'
    });
  }

  next();
};
