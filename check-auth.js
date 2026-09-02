import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp({ projectId: config.projectId, credential: applicationDefault() });
const auth = getAuth(app);
const db = getFirestore(app);

async function check() {
  try {
    const list = await auth.listUsers();
    console.log('Users in Auth:');
    list.users.forEach(u => console.log(u.email, u.uid));
    
    const snapshot = await db.collection('usuarios').get();
    console.log('\nUsers in Firestore:');
    snapshot.forEach(doc => console.log(doc.id, doc.data()));
  } catch (e) {
    console.error('Error:', e.message);
  }
}
check();
