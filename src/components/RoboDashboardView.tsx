import React, { useState, useMemo } from 'react';
import { 
  Bot, 
  Activity, 
  FileText, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  RefreshCw, 
  Search, 
  Filter, 
  Play, 
  Pause,
  Sliders,
  X
} from 'lucide-react';
import { Cliente } from '../types';
import { useRoboData } from '../lib/useRoboData';
import { FolderWatcherPanel } from './FolderWatcherPanel';

interface RoboDashboardViewProps {
  clientes?: Cliente[];
  activeClienteId?: string | null;
  addNotification?: (title: string, message: string, type: 'system' | 'import' | 'audit' | 'export') => void;
  escritorioId?: string;
}

export function RoboDashboardView({ clientes = [], activeClienteId = null, addNotification, escritorioId }: RoboDashboardViewProps) {
  const { config, logs, loading, alternarAtivo, recarregar } = useRoboData(escritorioId);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('todos');

  const effectiveEscritorioId = escritorioId;

  const handleToggleRobot = async () => {
    const updated = await alternarAtivo();
    if (updated && addNotification) {
      addNotification(
        'Robô Fiscal',
        updated.ativo ? 'Monitoramento automático ativado.' : 'Monitoramento automático pausado.',
        'system'
      );
    }
  };

  // Metrics calculations
  const totalExecucoes = logs.length;
  const totalInconsistencias = useMemo(() => {
    return logs.reduce((acc, log) => acc + (log.inconsistenciasCount || 0), 0);
  }, [logs]);

  const totalRegrasAprendidas = useMemo(() => {
    return logs.reduce((acc, log) => acc + (log.regrasAprendidasCount || 0), 0);
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return logs.filter(log => {
      const matchesSearch = !q || 
        (log.mensagem && log.mensagem.toLowerCase().includes(q)) ||
        (log.clienteNome && log.clienteNome.toLowerCase().includes(q)) ||
        (log.detalhes && log.detalhes.toLowerCase().includes(q)) ||
        (log.arquivoNome && log.arquivoNome.toLowerCase().includes(q));

      const matchesFilter = filterType === 'todos' || log.tipoAcao === filterType;

      return matchesSearch && matchesFilter;
    });
  }, [logs, searchTerm, filterType]);

  // Separate inconsistency logs
  const inconsistencyLogs = useMemo(() => {
    return logs.filter(l => l.tipoAcao === 'INCONSISTENCIA' || (l.inconsistenciasCount && l.inconsistenciasCount > 0));
  }, [logs]);

  return (
    <div className="space-y-4 pb-12 text-xs font-sans">
      {/* Top Header Bar */}
      <div className="bg-[var(--atlas-surface)] border border-[var(--atlas-border)] rounded-xl p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2 text-[var(--atlas-text)]">
              <Bot className="w-5 h-5 text-[var(--atlas-navy)]" />
              <h1 className="text-base font-bold text-[var(--atlas-text)] tracking-tight">
                Painel do Robô Fiscal (RoboDashboardView)
              </h1>
              <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${
                config.ativo ? 'bg-emerald-100 text-[var(--atlas-accent)] border border-emerald-200' : 'bg-[var(--atlas-surface-hover)] text-[var(--atlas-text-secondary)] border border-[var(--atlas-border)]'
              }`}>
                {config.ativo ? 'Operacional' : 'Pausado'}
              </span>
            </div>
            <p className="text-xs text-[var(--atlas-text-secondary)] mt-0.5">
              Monitoramento em tempo real de importações, status do processador e alertas de divergência com a Matriz Tributária.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleToggleRobot}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition-colors flex items-center space-x-1.5 ${
                config.ativo 
                  ? 'bg-amber-600 hover:bg-amber-700 text-white' 
                  : 'bg-[var(--atlas-accent)] hover:bg-[var(--atlas-accent-dark)] text-white'
              }`}
            >
              {config.ativo ? (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  <span>Pausar Monitoramento</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>Iniciar Monitoramento</span>
                </>
              )}
            </button>

            <button
              onClick={recarregar}
              className="p-1.5 bg-[var(--atlas-surface)] border border-[var(--atlas-border)] hover:bg-[var(--atlas-surface-hover)] text-[var(--atlas-text-secondary)] rounded-lg shadow-xs transition-colors"
              title="Atualizar Logs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Summary Indicators */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-4 pt-3 border-t border-[var(--atlas-border)]">
          <div className="bg-[var(--atlas-surface-hover)] border border-[var(--atlas-border)] rounded-lg p-3 flex items-center justify-between">
            <div>
              <span className="text-[var(--atlas-text-secondary)] text-xs font-medium block">Status em Tempo Real</span>
              <span className={`text-xs font-bold mt-0.5 block ${config.ativo ? 'text-[var(--atlas-accent)]' : 'text-[var(--atlas-text-secondary)]'}`}>
                {config.ativo ? 'Ativo (Varredura On)' : 'Em Pausa'}
              </span>
            </div>
            <Activity className={`w-4 h-4 ${config.ativo ? 'text-[var(--atlas-accent)]' : 'text-[var(--atlas-text-muted)]'}`} />
          </div>

          <div className="bg-[var(--atlas-surface-hover)] border border-[var(--atlas-border)] rounded-lg p-3 flex items-center justify-between">
            <div>
              <span className="text-[var(--atlas-text-secondary)] text-xs font-medium block">Total Execuções</span>
              <span className="text-sm font-bold text-[var(--atlas-text)] mt-0.5 block">{totalExecucoes}</span>
            </div>
            <FileText className="w-4 h-4 text-[var(--atlas-text-muted)]" />
          </div>

          <div className="bg-[var(--atlas-surface-hover)] border border-[var(--atlas-border)] rounded-lg p-3 flex items-center justify-between">
            <div>
              <span className="text-[var(--atlas-text-secondary)] text-xs font-medium block">Alertas de Inconsistência</span>
              <span className="text-sm font-bold text-rose-700 mt-0.5 block">{totalInconsistencias}</span>
            </div>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>

          <div className="bg-[var(--atlas-surface-hover)] border border-[var(--atlas-border)] rounded-lg p-3 flex items-center justify-between">
            <div>
              <span className="text-[var(--atlas-text-secondary)] text-xs font-medium block">Padrões Aprendidos</span>
              <span className="text-sm font-bold text-[var(--atlas-navy)] mt-0.5 block">{totalRegrasAprendidas}</span>
            </div>
            <CheckCircle2 className="w-4 h-4 text-[var(--atlas-navy)]" />
          </div>
        </div>
      </div>

      {/* Componente de Monitoramento da Pasta Local (File System Access API) */}
      <FolderWatcherPanel
        clientes={clientes}
        activeClienteId={activeClienteId}
        addNotification={addNotification}
        escritorioId={escritorioId}
      />

      {/* Alertas de Inconsistência da Matriz Tributária */}
      {inconsistencyLogs.length > 0 && (
        <div className="bg-[var(--atlas-surface)] rounded-xl border border-rose-200 shadow-xs overflow-hidden">
          <div className="bg-rose-50 px-4 py-2.5 border-b border-rose-200 font-bold text-rose-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>Alertas Fiscais e Inconsistências Detectadas na Importação</span>
            </div>
            <span className="text-xs font-mono text-rose-700">{inconsistencyLogs.length} alerta(s)</span>
          </div>

          <div className="divide-y divide-rose-100 text-xs">
            {inconsistencyLogs.slice(0, 5).map(inc => (
              <div key={inc.id} className="p-3 bg-[var(--atlas-surface)] hover:bg-rose-50/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="font-bold text-[var(--atlas-text)] flex items-center space-x-2">
                    <span className="text-rose-700">{inc.clienteNome || 'Empresa em Análise'}</span>
                    <span className="text-[var(--atlas-text-muted)]">•</span>
                    <span className="text-[var(--atlas-text-secondary)] text-xs font-mono">{new Date(inc.timestamp).toLocaleTimeString('pt-BR')}</span>
                  </div>
                  <p className="text-[var(--atlas-text-secondary)] mt-0.5">{inc.mensagem}</p>
                  {inc.detalhes && (
                    <p className="text-xs font-mono text-[var(--atlas-text-secondary)] mt-0.5">{inc.detalhes}</p>
                  )}
                </div>

                <span className="px-2 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200 shrink-0 self-start sm:self-center">
                  {inc.inconsistenciasCount || 1} Inconsistência(s)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabela de Execuções Recentes e Arquivos Processados */}
      <div className="bg-[var(--atlas-surface)] rounded-xl border border-[var(--atlas-border)] shadow-xs overflow-hidden">
        {/* Search & Filter Controls */}
        <div className="p-3 bg-[var(--atlas-surface-hover)] border-b border-[var(--atlas-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-[var(--atlas-text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Pesquisar por empresa, arquivo ou mensagem..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 border border-[var(--atlas-border)] rounded-md text-xs text-[var(--atlas-text)] placeholder-[var(--atlas-text-muted)] focus:outline-hidden focus:border-[var(--atlas-navy)]"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--atlas-text-muted)] p-0.5">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <Filter className="w-3.5 h-3.5 text-[var(--atlas-text-muted)]" />
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="border border-[var(--atlas-border)] rounded-md px-2 py-1.5 bg-[var(--atlas-surface)] text-[var(--atlas-text-secondary)] font-medium focus:outline-hidden focus:border-[var(--atlas-navy)]"
            >
              <option value="todos">Todos os Eventos</option>
              <option value="PROCESSAMENTO">Processamentos</option>
              <option value="INCONSISTENCIA">Inconsistências</option>
              <option value="APRENDIZADO">Aprendizados</option>
              <option value="ERRO">Erros</option>
            </select>
          </div>
        </div>

        {/* Sober Table Structure */}
        {filteredLogs.length === 0 ? (
          <div className="p-10 text-center text-[var(--atlas-text-secondary)] space-y-1">
            <Clock className="w-6 h-6 text-[var(--atlas-text-muted)] mx-auto" />
            <p className="font-semibold text-[var(--atlas-text-secondary)] text-xs">Nenhum registro retornado</p>
            <p className="text-xs">As execuções de importação do Robô Fiscal aparecerão nesta tabela.</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-[var(--atlas-surface-hover)] border-b border-[var(--atlas-border)] text-[var(--atlas-text-secondary)] font-semibold uppercase text-xs tracking-wider">
              <tr>
                <th className="py-2.5 px-3">Data / Hora</th>
                <th className="py-2.5 px-3">Empresa / Cliente</th>
                <th className="py-2.5 px-3">Ação</th>
                <th className="py-2.5 px-3">Mensagem do Robô</th>
                <th className="py-2.5 px-3">Detalhes Técnicos</th>
                <th className="py-2.5 px-3 text-right">Inconsistências</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--atlas-border)]">
              {filteredLogs.map(log => {
                let badgeClass = 'bg-[var(--atlas-surface-hover)] text-[var(--atlas-text-secondary)] border-[var(--atlas-border)]';
                if (log.tipoAcao === 'INCONSISTENCIA') badgeClass = 'bg-rose-100 text-rose-800 border-rose-200 font-bold';
                if (log.tipoAcao === 'APRENDIZADO') badgeClass = 'bg-emerald-100 text-[var(--atlas-accent)] border-emerald-200 font-bold';
                if (log.tipoAcao === 'PROCESSAMENTO') badgeClass = 'bg-sky-100 text-sky-800 border-sky-200';
                if (log.tipoAcao === 'ERRO') badgeClass = 'bg-amber-100 text-amber-800 border-amber-200';

                return (
                  <tr key={log.id} className="hover:bg-[var(--atlas-surface-hover)] transition-colors">
                    <td className="py-2.5 px-3 text-[var(--atlas-text-secondary)] font-mono text-xs whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString('pt-BR')}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-[var(--atlas-text)]">
                      {log.clienteNome || 'Sistema / Global'}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-xs border ${badgeClass}`}>
                        {log.tipoAcao}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-[var(--atlas-text)]">
                      {log.mensagem}
                    </td>
                    <td className="py-2.5 px-3 text-[var(--atlas-text-secondary)] text-xs font-mono">
                      {log.detalhes || '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold">
                      {log.inconsistenciasCount ? (
                        <span className="text-rose-700 font-bold">{log.inconsistenciasCount}</span>
                      ) : (
                        <span className="text-[var(--atlas-text-muted)] font-normal">0</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
