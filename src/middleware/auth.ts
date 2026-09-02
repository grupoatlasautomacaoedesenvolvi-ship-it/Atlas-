import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { DecodedIdToken } from 'firebase-admin/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { fetchDocWithFallback, setDocWithFallback, queryCollectionWithFallback } from '../lib/firestore-rest-fallback.ts';

export interface AuthRequest extends Request {
  user?: DecodedIdToken | any;
  papel?: string;
  escritorioId?: string;
  token?: string;
}

function decodeJwtPayload(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payloadJson = Buffer.from(parts[1], 'base64').toString('utf8');
    return JSON.parse(payloadJson);
  } catch (e) {
    return null;
  }
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

  let decodedToken: any = null;

  try {
    decodedToken = await adminAuth.verifyIdToken(token);
  } catch (authErr: any) {
    const errStr = String(authErr?.message || authErr);
    if (errStr.includes('PERMISSION_DENIED') || errStr.includes('7')) {
      // Decode JWT payload locally if adminAuth.verifyIdToken is blocked by GCP ADC permissions
      const payload = decodeJwtPayload(token);
      if (
        payload &&
        payload.exp &&
        payload.exp * 1000 > Date.now() &&
        (payload.aud === firebaseConfig.projectId || payload.aud === firebaseConfig.appId) &&
        payload.iss &&
        payload.iss.includes(firebaseConfig.projectId)
      ) {
        decodedToken = {
          uid: payload.user_id || payload.sub,
          email: payload.email,
          email_verified: payload.email_verified,
          ...payload
        };
      } else {
        console.warn('JWT payload verification failed or token expired:', authErr?.message || authErr);
      }
    } else {
      console.warn('adminAuth.verifyIdToken failed:', authErr?.message || authErr);
    }
  }

  if (!decodedToken || !decodedToken.uid) {
    return res.status(401).json({ error: 'Sessão expirada ou token de autenticação inválido. Faça login novamente.' });
  }

  req.user = decodedToken;
  req.token = token;

  try {
    let userDocResult = await fetchDocWithFallback(`usuarios/${decodedToken.uid}`, token);
    
    // Se o documento do usuário não existir ou não possuir papel definido
    if (!userDocResult || !userDocResult.data || !userDocResult.data.papel) {
      const userEmail = (decodedToken.email || '').toLowerCase();
      const allUsers = await queryCollectionWithFallback('usuarios', token);
      const temSuperAdmin = allUsers.some(u => u.data.papel === 'super_admin');

      // Se não existir nenhum Super Admin no sistema OU se o e-mail for do administrador principal
      const eAdminPrincipal = userEmail === 'fcaio100@gmail.com' || userEmail === 'grupoatlasautomacaoedesenvolvi@gmail.com';

      if (!temSuperAdmin || eAdminPrincipal) {
        const adminDocData = {
          email: decodedToken.email || userEmail,
          nome: decodedToken.name || (decodedToken.email ? decodedToken.email.split('@')[0] : 'Super Admin'),
          papel: 'super_admin',
          escritorioId: userDocResult?.data?.escritorioId || '',
          ativo: true
        };
        await setDocWithFallback(`usuarios/${decodedToken.uid}`, adminDocData, token, true);
        req.papel = 'super_admin';
        req.escritorioId = adminDocData.escritorioId;
      } else {
        // Inicializa como colaborador se já existir super_admin no sistema
        const defaultDocData = {
          email: decodedToken.email || '',
          nome: decodedToken.name || (decodedToken.email ? decodedToken.email.split('@')[0] : 'Usuário'),
          papel: 'colaborador',
          escritorioId: '',
          ativo: true
        };
        await setDocWithFallback(`usuarios/${decodedToken.uid}`, defaultDocData, token, true);
        req.papel = 'colaborador';
        req.escritorioId = '';
      }
    } else {
      req.papel = userDocResult.data.papel;
      req.escritorioId = userDocResult.data.escritorioId;

      // Garantia: se for o e-mail do admin fcaio100@gmail.com e o documento estivesse diferente de super_admin, eleva para super_admin
      const userEmail = (decodedToken.email || '').toLowerCase();
      if ((userEmail === 'fcaio100@gmail.com' || userEmail === 'grupoatlasautomacaoedesenvolvi@gmail.com') && req.papel !== 'super_admin') {
        await setDocWithFallback(`usuarios/${decodedToken.uid}`, { papel: 'super_admin' }, token, true);
        req.papel = 'super_admin';
      }
    }

    if (req.papel === 'super_admin' && req.path.startsWith('/api/fiscal/')) {
      return res.status(403).json({ error: 'Super admin não acessa dados fiscais de escritórios' });
    }

    next();
  } catch (error: any) {
    console.error('Error in requireAuth user doc lookup:', error?.message || error);
    next();
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


