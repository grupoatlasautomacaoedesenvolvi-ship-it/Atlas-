/**
 * BOOTSTRAP DO PRIMEIRO ADMIN — RODAR APENAS LOCALMENTE, NUNCA EM PRODUÇÃO/CLIENT-SIDE
 *
 * Este script usa o Firebase Admin SDK (credenciais de serviço), que ignora
 * completamente as regras do Firestore — por isso ele NUNCA pode fazer parte
 * do bundle enviado ao navegador. Ele existe só para criar o primeiro usuário
 * com papel 'adm', já que a regra do Firestore exige que um admin já exista
 * para criar outro (bootstrap clássico de "quem cria o primeiro superusuário").
 *
 * Uso:
 *   ADMIN_EMAIL="seu-email@dominio.com" ADMIN_PASSWORD="uma-senha-forte-aqui" \
 *     node bootstrap-admin-server-only.js
 *
 * Nunca commitar um valor real de ADMIN_PASSWORD em nenhum arquivo do repositório.
 * Depois de rodar, troque a senha pelo fluxo normal de "esqueci minha senha".
 */
import { initializeApp, applicationDefault, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;

if (!email || !password) {
  console.error('Defina ADMIN_EMAIL e ADMIN_PASSWORD como variáveis de ambiente antes de rodar este script.');
  process.exit(1);
}
if (password.length < 12) {
  console.error('ADMIN_PASSWORD precisa ter pelo menos 12 caracteres.');
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));

let credential = applicationDefault();
if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON.trim();
  if (raw.startsWith('{')) {
    try {
      const sa = JSON.parse(raw);
      credential = cert(sa);
    } catch (e) {
      console.warn('Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON, falling back to applicationDefault()', e);
    }
  }
}

async function upsertAdminDoc(db, uid) {
  await db.collection('usuarios').doc(uid).set({ email, papel: 'super_admin', escritorioId: '', ativo: true }, { merge: true });
}

try {
  const app = initializeApp({ projectId: config.projectId, credential });
  const auth = getAuth(app);
  const db = getFirestore(app, config.firestoreDatabaseId);

  const user = await auth.createUser({ email, password, emailVerified: true });
  console.log('Usuário admin criado:', user.uid);
  await upsertAdminDoc(db, user.uid);
  console.log('Documento de super_admin criado no Firestore.');
} catch (e) {
  if (e.code === 'auth/email-already-exists') {
    const app = initializeApp({ projectId: config.projectId, credential }, 'bootstrap-existing');
    const db = getFirestore(app, config.firestoreDatabaseId);
    const auth = getAuth(app);
    const user = await auth.getUserByEmail(email);
    await upsertAdminDoc(db, user.uid);
    console.log('Usuário já existia — documento de super_admin atualizado no Firestore para:', user.uid);
  } else {
    console.error('Erro ao criar admin:', e);
    process.exit(1);
  }
}

