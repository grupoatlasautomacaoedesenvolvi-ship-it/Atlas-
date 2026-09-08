import { describe, it, expect, beforeEach, vi } from 'vitest';
import { safeWrite, isFirestoreQuotaExceeded, handleFirestoreWriteError, clearFirestoreQuotaExceeded } from './lib/firebase';

describe('Tratamento de cota e escrita Firestore (safeWrite)', () => {
  beforeEach(() => {
    localStorage.clear();
    clearFirestoreQuotaExceeded();
  });

  it('(1) Erro de cota ativa o modo offline e uma escrita bem-sucedida depois desativa', async () => {
    // 1. Tenta escrever e gera erro de cota
    const writeQuotaError = async () => {
      throw new Error('resource-exhausted: Quota exceeded.');
    };

    const res1 = await safeWrite(writeQuotaError);
    expect(res1).toBeNull();
    expect(isFirestoreQuotaExceeded()).toBe(true);

    // 2. Com a flag ativa, safeWrite não executa a função e retorna null imediatamente
    const spyFn = vi.fn(async () => 'ok');
    const res2 = await safeWrite(spyFn);
    expect(res2).toBeNull();
    expect(spyFn).not.toHaveBeenCalled();

    // 3. Ao redefinir / tentar uma escrita bem sucedida (limpando a flag ou expiração), o modo offline desativa
    clearFirestoreQuotaExceeded();
    const res3 = await safeWrite(spyFn);
    expect(res3).toBe('ok');
    expect(spyFn).toHaveBeenCalledTimes(1);
    expect(isFirestoreQuotaExceeded()).toBe(false);
  });

  it('(2) PERMISSION_DENIED não ativa o modo offline e propaga o erro', async () => {
    const writePermissionError = async () => {
      throw new Error('PERMISSION_DENIED: Missing or insufficient permissions.');
    };

    await expect(safeWrite(writePermissionError)).rejects.toThrow('PERMISSION_DENIED');
    expect(isFirestoreQuotaExceeded()).toBe(false);
  });
});
