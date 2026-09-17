import { initializeApp, getApps, applicationDefault, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

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

const app = getApps().length ? getApps()[0] : initializeApp({
  projectId: firebaseConfig.projectId,
  credential
});

export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app, firebaseConfig.firestoreDatabaseId);

