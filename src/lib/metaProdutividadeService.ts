import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, safeWrite } from './firebase';

function exigirEscritorio(escritorioId: string | undefined): string {
  if (!escritorioId) {
    throw new Error('escritorioId é obrigatório — operação bloqueada para evitar vazamento entre escritórios.');
  }
  return escritorioId;
}

/**
 * Meta mensal de notas conferidas por colaborador, configurada pelo admin
 * do escritório. Nunca um valor fixo no código — se não houver meta
 * configurada, a tela deve deixar isso claro, nunca inventar um número.
 */
export async function fetchMetaProdutividade(escritorioId: string): Promise<number | null> {
  const eid = exigirEscritorio(escritorioId);
  try {
    const docRef = doc(db, 'escritorios', eid, 'config', 'meta_produtividade');
    const snap = await getDoc(docRef);
    if (snap.exists() && typeof snap.data().metaMensal === 'number') {
      return snap.data().metaMensal;
    }
  } catch (e) {
    console.warn('Erro ao carregar meta de produtividade:', e);
  }
  return null; // sem meta configurada — nunca um valor inventado
}

export async function saveMetaProdutividade(escritorioId: string, metaMensal: number): Promise<void> {
  const eid = exigirEscritorio(escritorioId);
  await safeWrite(async () => {
    const docRef = doc(db, 'escritorios', eid, 'config', 'meta_produtividade');
    await setDoc(docRef, { metaMensal }, { merge: true });
  });
}

