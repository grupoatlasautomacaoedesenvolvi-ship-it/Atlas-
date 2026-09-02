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
import { initializeApp, applicationDefault } from 'firebase-admin/app';
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

async function upsertAdminDoc(db, uid) {
  await db.collection('usuarios').doc(uid).set({ email, papel: 'adm', escritorioId: '' });
}

try {
  const app = initializeApp({ projectId: config.projectId, credential: applicationDefault() });
  const auth = getAuth(app);
  const db = getFirestore(app);

  const user = await auth.createUser({ email, password, emailVerified: true });
  console.log('Usuário admin criado:', user.uid);
  await upsertAdminDoc(db, user.uid);
  console.log('Documento de admin criado no Firestore.');
} catch (e) {
  if (e.code === 'auth/email-already-exists') {
    const app = initializeApp({ projectId: config.projectId, credential: applicationDefault() }, 'bootstrap-existing');
    const db = getFirestore(app);
    const auth = getAuth(app);
    const user = await auth.getUserByEmail(email);
    await upsertAdminDoc(db, user.uid);
    console.log('Usuário já existia — documento de admin atualizado no Firestore para:', user.uid);
  } else {
    console.error('Erro ao criar admin:', e);
    process.exit(1);
  }
}
