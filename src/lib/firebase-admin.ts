import { initializeApp, getApps, applicationDefault, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID as string;
const FIREBASE_DATABASE_ID = process.env.FIREBASE_DATABASE_ID as string;

function getAdminCredential() {
  const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64;
  if (encoded) {
    try {
      const decoded = Buffer.from(encoded, 'base64').toString('utf8');
      const serviceAccount = JSON.parse(decoded);
      return cert(serviceAccount);
    } catch (err) {
      console.warn('Falha ao analisar FIREBASE_SERVICE_ACCOUNT_KEY_BASE64, utilizando applicationDefault():', err);
    }
  }
  return applicationDefault();
}

const app = getApps().length ? getApps()[0] : initializeApp({
  projectId: FIREBASE_PROJECT_ID,
  credential: getAdminCredential()
});

export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app, FIREBASE_DATABASE_ID);
