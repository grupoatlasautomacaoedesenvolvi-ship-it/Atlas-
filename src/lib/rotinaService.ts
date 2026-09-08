import { Rotina } from '../types';

function getToken(): string | null {
  return localStorage.getItem('atlas_auth_token');
}

/**
 * Busca as rotinas que o usuário atual tem permissão de ver. O filtro de
 * visibilidade ('Privado'/'Todos'/'Administradores') é aplicado no servidor
 * — nunca só no cliente — porque o servidor já resolve o escritório, o uid e
 * o papel a partir do token autenticado. O cliente não manda mais esses
 * dados na requisição nem recebe rotinas que não devia ver.
 */
export async function fetchRotinas(escritorioId: string): Promise<Rotina[]> {
  const token = getToken();
  try {
    const res = await fetch('/api/escritorio/rotinas', {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.rotinas)) {
        localStorage.setItem(`atlas_rotinas_${escritorioId}`, JSON.stringify(data.rotinas));
        return data.rotinas;
      }
    }
  } catch (e) {
    console.warn('Erro fetchRotinas via API (modo offline/fallback local):', e);
  }

  const localSaved = localStorage.getItem(`atlas_rotinas_${escritorioId}`);
  if (localSaved) {
    try {
      return JSON.parse(localSaved);
    } catch (err) {
      console.error('Erro ao ler rotinas locais:', err);
    }
  }
  return [];
}

export async function saveRotina(escritorioId: string, rotina: Rotina): Promise<void> {
  const token = getToken();

  // LocalStorage update (cache local otimista)
  try {
    const localSaved = localStorage.getItem(`atlas_rotinas_${escritorioId}`);
    const rotinas: Rotina[] = localSaved ? JSON.parse(localSaved) : [];
    const idx = rotinas.findIndex(r => r.id === rotina.id);
    const updatedLocal = { ...rotina, escritorioId };
    if (idx >= 0) rotinas[idx] = updatedLocal; else rotinas.unshift(updatedLocal);
    localStorage.setItem(`atlas_rotinas_${escritorioId}`, JSON.stringify(rotinas));
  } catch (err) {
    console.warn('Could not update local rotinas cache:', err);
  }

  // O servidor decide o userId/creatorRole reais (nunca confia nos que o
  // cliente mandar) e bloqueia a edição de rotina que não seja do autor
  // (a menos que quem está editando seja admin do escritório/super admin).
  const res = await fetch('/api/escritorio/rotinas', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ rotina })
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Não foi possível salvar a rotina.');
  }
}

export async function deleteRotina(escritorioId: string, rotinaId: string): Promise<void> {
  const token = getToken();

  try {
    const localSaved = localStorage.getItem(`atlas_rotinas_${escritorioId}`);
    if (localSaved) {
      const rotinas: Rotina[] = JSON.parse(localSaved).filter((r: Rotina) => r.id !== rotinaId);
      localStorage.setItem(`atlas_rotinas_${escritorioId}`, JSON.stringify(rotinas));
    }
  } catch (err) {
    console.warn('Could not update local rotinas cache:', err);
  }

  const res = await fetch(`/api/escritorio/rotinas/${rotinaId}`, {
    method: 'DELETE',
    headers: token ? { 'Authorization': `Bearer ${token}` } : {}
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Não foi possível excluir a rotina.');
  }
}

export async function saveRotinasEmLote(escritorioId: string, rotinas: Rotina[]): Promise<void> {
  for (const rotina of rotinas) {
    await saveRotina(escritorioId, rotina);
  }
}
