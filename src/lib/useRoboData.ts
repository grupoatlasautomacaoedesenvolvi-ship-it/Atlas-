import { useState, useEffect, useCallback } from 'react';
import { RoboExecutionLog, RoboConfig, LearnedTaxRule } from '../types';
import { getRoboConfig, saveRoboConfig, getRoboLogs, getLearnedRules } from './roboFiscalService';

const CONFIG_PADRAO: RoboConfig = {
  ativo: true,
  intervaloMinutos: 5,
  notificarInconsistencias: true,
  validarSpedXmlCruzado: true
};

/**
 * Hook único para carregar e alternar o estado do Robô Fiscal — usado tanto
 * pelo RoboFiscalView quanto pelo RoboDashboardView. Antes, cada tela
 * reimplementava essa lógica de forma independente, e uma correção de
 * segurança aplicada numa tela não chegava na outra (foi exatamente o que
 * aconteceu com o fallback inseguro de escritorioId). Com um hook só, uma
 * correção futura vale para as duas telas automaticamente.
 */
export function useRoboData(escritorioId: string | undefined, comRegrasAprendidas: boolean = false) {
  const [config, setConfig] = useState<RoboConfig>(CONFIG_PADRAO);
  const [logs, setLogs] = useState<RoboExecutionLog[]>([]);
  const [learnedRules, setLearnedRules] = useState<LearnedTaxRule[]>([]);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    if (!escritorioId) { setLoading(false); return; }
    setLoading(true);
    try {
      const [cfg, lgs, rls] = await Promise.all([
        getRoboConfig(escritorioId),
        getRoboLogs(50, escritorioId),
        comRegrasAprendidas ? getLearnedRules(escritorioId) : Promise.resolve([])
      ]);
      setConfig(cfg);
      setLogs(lgs);
      if (comRegrasAprendidas) setLearnedRules(rls);
    } catch (e) {
      console.error('Erro ao carregar dados do Robô Fiscal:', e);
    } finally {
      setLoading(false);
    }
  }, [escritorioId, comRegrasAprendidas]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const alternarAtivo = useCallback(async () => {
    if (!escritorioId) return;
    const atualizado = { ...config, ativo: !config.ativo };
    setConfig(atualizado);
    await saveRoboConfig(atualizado, escritorioId);
    return atualizado;
  }, [escritorioId, config]);

  return { config, setConfig, logs, setLogs, learnedRules, setLearnedRules, loading, recarregar: carregar, alternarAtivo };
}
