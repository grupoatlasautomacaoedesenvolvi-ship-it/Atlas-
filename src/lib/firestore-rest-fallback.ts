import { adminDb } from './firebase-admin.ts';

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID as string;
const FIREBASE_DATABASE_ID = process.env.FIREBASE_DATABASE_ID as string;

export function convertRestFields(fields: Record<string, any>): Record<string, any> {
  if (!fields) return {};
  const result: Record<string, any> = {};
  for (const [key, valObj] of Object.entries(fields)) {
    if (!valObj) continue;
    if ('stringValue' in valObj) result[key] = valObj.stringValue;
    else if ('integerValue' in valObj) result[key] = Number(valObj.integerValue);
    else if ('doubleValue' in valObj) result[key] = Number(valObj.doubleValue);
    else if ('booleanValue' in valObj) result[key] = Boolean(valObj.booleanValue);
    else if ('nullValue' in valObj) result[key] = null;
    else if ('mapValue' in valObj) result[key] = convertRestFields(valObj.mapValue?.fields || {});
    else if ('arrayValue' in valObj) {
      result[key] = (valObj.arrayValue?.values || []).map((v: any) => {
        if (!v) return null;
        if ('stringValue' in v) return v.stringValue;
        if ('integerValue' in v) return Number(v.integerValue);
        if ('doubleValue' in v) return Number(v.doubleValue);
        if ('booleanValue' in v) return Boolean(v.booleanValue);
        if ('mapValue' in v) return convertRestFields(v.mapValue?.fields || {});
        return null;
      });
    }
  }
  return result;
}

export function convertToRestFields(obj: Record<string, any>): Record<string, any> {
  const fields: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val === undefined) continue;
    if (val === null) {
      fields[key] = { nullValue: null };
    } else if (typeof val === 'string') {
      fields[key] = { stringValue: val };
    } else if (typeof val === 'number') {
      if (Number.isInteger(val)) fields[key] = { integerValue: String(val) };
      else fields[key] = { doubleValue: val };
    } else if (typeof val === 'boolean') {
      fields[key] = { booleanValue: val };
    } else if (Array.isArray(val)) {
      fields[key] = {
        arrayValue: {
          values: val.map(v => {
            if (typeof v === 'string') return { stringValue: v };
            if (typeof v === 'number') return { integerValue: String(v) };
            if (typeof v === 'boolean') return { booleanValue: v };
            if (typeof v === 'object' && v !== null) return { mapValue: { fields: convertToRestFields(v) } };
            return { nullValue: null };
          })
        }
      };
    } else if (typeof val === 'object') {
      fields[key] = { mapValue: { fields: convertToRestFields(val) } };
    }
  }
  return fields;
}

export async function fetchDocWithFallback(path: string, token?: string): Promise<{ id: string; data: Record<string, any> } | null> {
  try {
    const docRef = adminDb.doc(path);
    const snap = await docRef.get();
    if (snap.exists) {
      return { id: snap.id, data: snap.data() || {} };
    }
    return null;
  } catch (err: any) {
    const errStr = String(err?.message || err);
    if ((errStr.includes('PERMISSION_DENIED') || errStr.includes('7') || errStr.includes('RESOURCE_EXHAUSTED') || errStr.includes('Quota exceeded'))) {
      if (token) {
        try {
          const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/${FIREBASE_DATABASE_ID}/documents/${path}`;
          const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
          if (res.ok) {
            const json = await res.json();
            if (json.fields) {
              const id = json.name ? json.name.split('/').pop() : path.split('/').pop();
              return { id: id || '', data: convertRestFields(json.fields) };
            }
          }
        } catch (restErr) {
          // ignore rest error
        }
      }
      // Nunca fabricar um documento (e muito menos com papel super_admin)
      // quando a leitura falha. Falha de leitura deve significar "não
      // encontrado/indisponível", nunca "acesso total liberado".
      return null;
    }
    throw err;
  }
}

export async function setDocWithFallback(path: string, data: Record<string, any>, token?: string, merge = true): Promise<void> {
  try {
    await adminDb.doc(path).set(data, { merge });
  } catch (err: any) {
    const errStr = String(err?.message || err);
    if (token) {
      try {
        const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/${FIREBASE_DATABASE_ID}/documents/${path}`;
        const fields = convertToRestFields(data);
        const res = await fetch(url, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ fields })
        });
        if (res.ok) return;
      } catch (restErr) {
        // ignore rest error
      }
    }
    if (errStr.includes('PERMISSION_DENIED') || errStr.includes('7') || errStr.includes('RESOURCE_EXHAUSTED') || errStr.includes('Quota exceeded') || errStr.includes('Missing or insufficient permissions')) {
      return; // swallow error gracefully in fallback mode
    }
    throw err;
  }
}

export async function deleteDocWithFallback(path: string, token?: string): Promise<void> {
  try {
    await adminDb.doc(path).delete();
  } catch (err: any) {
    const errStr = String(err?.message || err);
    if ((errStr.includes('PERMISSION_DENIED') || errStr.includes('7') || errStr.includes('RESOURCE_EXHAUSTED') || errStr.includes('Quota exceeded'))) {
      return;
    }
    throw err;
  }
}

export async function queryCollectionWithFallback(path: string, token?: string): Promise<Array<{ id: string; data: Record<string, any> }>> {
  try {
    const snap = await adminDb.collection(path).get();
    return snap.docs.map(doc => ({ id: doc.id, data: doc.data() }));
  } catch (err: any) {
    const errStr = String(err?.message || err);
    if ((errStr.includes('PERMISSION_DENIED') || errStr.includes('7') || errStr.includes('RESOURCE_EXHAUSTED') || errStr.includes('Quota exceeded'))) {
      if (token) {
        try {
          const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/${FIREBASE_DATABASE_ID}/documents/${path}`;
          const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
          if (res.ok) {
            const json = await res.json();
            if (json.documents) {
              return json.documents.map((docItem: any) => {
                const id = docItem.name ? docItem.name.split('/').pop() : '';
                return { id: id || '', data: convertRestFields(docItem.fields || {}) };
              });
            }
          }
        } catch (restErr) {
          // ignore rest error
        }
      }
      // Idem: nunca inventar um escritório ou usuário (muito menos um
      // super_admin) quando a consulta falha. Lista vazia é o resultado
      // seguro — o chamador deve tratar isso como "indisponível", não como
      // "sistema vazio, pode virar admin".
      return [];
    }
    throw err;
  }
}

