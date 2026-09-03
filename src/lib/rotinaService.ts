import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { db, safeWrite } from './firebase';
import { Rotina } from '../types';

function exigirEscritorio(escritorioId: string | undefined): string {
  if (!escritorioId) {
    throw new Error('escritorioId é obrigatório — operação bloqueada para evitar vazamento entre escritórios.');
  }
  return escritorioId;
}

/**
 * Busca todas as rotinas do escritório que o usuário atual tem permissão de
 * ver, aplicando o filtro de visibilidade no servidor-side da função (nunca
 * confiar só no filtro da UI): 'Privado' só para quem criou; 'Todos' para
 * qualquer um do escritório; 'Administradores' só para admin_escritorio e
 * super_admin. Colaborador nunca vê rotina privada de outro colaborador.
 */
export async function fetchRotinas(
  escritorioId: string,
  usuarioAtualId: string,
  papelAtual: 'super_admin' | 'admin_escritorio' | 'colaborador'
): Promise<Rotina[]> {
  const eid = exigirEscritorio(escritorioId);
  let todas: Rotina[] = [];

  try {
    const ref = collection(db, 'escritorios', eid, 'rotinas');
    const snap = await getDocs(ref);
    if (!snap.empty) {
      todas = snap.docs.map(d => ({ id: d.id, ...d.data() } as Rotina));
      localStorage.setItem(`atlas_rotinas_${eid}`, JSON.stringify(todas));
    }
  } catch (e) {
    console.warn('Erro fetchRotinas no Firestore (modo offline/fallback local):', e);
  }

  if (todas.length === 0) {
    const localSaved = localStorage.getItem(`atlas_rotinas_${eid}`);
    if (localSaved) {
      try {
        todas = JSON.parse(localSaved);
      } catch (err) {
        console.error('Erro ao ler rotinas locais:', err);
      }
    }
  }

  return todas.filter(r => {
    if (r.userId === usuarioAtualId) return true; // sempre vê o que criou
    if (r.visibilidade === 'Privado') return false;
    if (r.visibilidade === 'Todos') return true;
    if (r.visibilidade === 'Administradores') {
      return papelAtual === 'admin_escritorio' || papelAtual === 'super_admin';
    }
    return false;
  });
}

export async function saveRotina(escritorioId: string, rotina: Rotina): Promise<void> {
  const eid = exigirEscritorio(escritorioId);
  const updatedRotina = { ...rotina, escritorioId: eid, atualizadoEm: new Date().toISOString() };

  // LocalStorage update
  const localSaved = localStorage.getItem(`atlas_rotinas_${eid}`);
  let rotinas: Rotina[] = localSaved ? JSON.parse(localSaved) : [];
  const idx = rotinas.findIndex(r => r.id === rotina.id);
  if (idx >= 0) {
    rotinas[idx] = updatedRotina;
  } else {
    rotinas.unshift(updatedRotina);
  }
  localStorage.setItem(`atlas_rotinas_${eid}`, JSON.stringify(rotinas));

  await safeWrite(async () => {
    const ref = doc(db, 'escritorios', eid, 'rotinas', rotina.id);
    await setDoc(ref, updatedRotina);
  });
}

export async function deleteRotina(escritorioId: string, rotinaId: string): Promise<void> {
  const eid = exigirEscritorio(escritorioId);

  // LocalStorage update
  const localSaved = localStorage.getItem(`atlas_rotinas_${eid}`);
  if (localSaved) {
    let rotinas: Rotina[] = JSON.parse(localSaved);
    rotinas = rotinas.filter(r => r.id !== rotinaId);
    localStorage.setItem(`atlas_rotinas_${eid}`, JSON.stringify(rotinas));
  }

  await safeWrite(async () => {
    const ref = doc(db, 'escritorios', eid, 'rotinas', rotinaId);
    await deleteDoc(ref);
  });
}

export async function saveRotinasEmLote(escritorioId: string, rotinas: Rotina[]): Promise<void> {
  const eid = exigirEscritorio(escritorioId);
  for (const rotina of rotinas) {
    await saveRotina(eid, rotina);
  }
}

