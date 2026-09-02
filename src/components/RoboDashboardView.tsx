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
      <div className="bg-white border border-[var(--atlas-border)] rounded-xl p-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2 text-slate-800">
              <Bot className="w-5 h-5 text-[#1e3a5f]" />
              <h1 className="text-base font-bold text-slate-900 tracking-tight">
                Painel do Robô Fiscal (RoboDashboardView)
              </h1>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                config.ativo ? 'bg-emerald-100 text-[#0f6e56] border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'
              }`}>
                {config.ativo ? 'Operacional' : 'Pausado'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Monitoramento em tempo real de importações, status do processador e alertas de divergência com a Matriz Tributária.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleToggleRobot}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold shadow-2xs transition-colors flex items-center space-x-1.5 ${
                config.ativo 
                  ? 'bg-amber-600 hover:bg-amber-700 text-white' 
                  : 'bg-[#0f6e56] hover:bg-[#0b5240] text-white'
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
              className="p-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg shadow-2xs transition-colors"
              title="Atualizar Logs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Summary Indicators */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-4 pt-3 border-t border-slate-100">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center justify-between">
            <div>
              <span className="text-slate-500 text-[11px] font-medium block">Status em Tempo Real</span>
              <span className={`text-xs font-bold mt-0.5 block ${config.ativo ? 'text-[#0f6e56]' : 'text-slate-500'}`}>
                {config.ativo ? 'Ativo (Varredura On)' : 'Em Pausa'}
              </span>
            </div>
            <Activity className={`w-4 h-4 ${config.ativo ? 'text-[#0f6e56]' : 'text-slate-300'}`} />
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center justify-between">
            <div>
              <span className="text-slate-500 text-[11px] font-medium block">Total Execuções</span>
              <span className="text-sm font-bold text-slate-900 mt-0.5 block">{totalExecucoes}</span>
            </div>
            <FileText className="w-4 h-4 text-slate-400" />
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center justify-between">
            <div>
              <span className="text-slate-500 text-[11px] font-medium block">Alertas de Inconsistência</span>
              <span className="text-sm font-bold text-rose-700 mt-0.5 block">{totalInconsistencias}</span>
            </div>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center justify-between">
            <div>
              <span className="text-slate-500 text-[11px] font-medium block">Padrões Aprendidos</span>
              <span className="text-sm font-bold text-[#1e3a5f] mt-0.5 block">{totalRegrasAprendidas}</span>
            </div>
            <CheckCircle2 className="w-4 h-4 text-[#1e3a5f]" />
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
        <div className="bg-white rounded-xl border border-rose-200 shadow-2xs overflow-hidden">
          <div className="bg-rose-50 px-4 py-2.5 border-b border-rose-200 font-bold text-rose-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>Alertas Fiscais e Inconsistências Detectadas na Importação</span>
            </div>
            <span className="text-[11px] font-mono text-rose-700">{inconsistencyLogs.length} alerta(s)</span>
          </div>

          <div className="divide-y divide-rose-100 text-xs">
            {inconsistencyLogs.slice(0, 5).map(inc => (
              <div key={inc.id} className="p-3 bg-white hover:bg-rose-50/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="font-bold text-slate-800 flex items-center space-x-2">
                    <span className="text-rose-700">{inc.clienteNome || 'Empresa em Análise'}</span>
                    <span className="text-slate-300">•</span>
                    <span className="text-slate-500 text-[11px] font-mono">{new Date(inc.timestamp).toLocaleTimeString('pt-BR')}</span>
                  </div>
                  <p className="text-slate-700 mt-0.5">{inc.mensagem}</p>
                  {inc.detalhes && (
                    <p className="text-[11px] font-mono text-slate-500 mt-0.5">{inc.detalhes}</p>
                  )}
                </div>

                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200 shrink-0 self-start sm:self-center">
                  {inc.inconsistenciasCount || 1} Inconsistência(s)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabela de Execuções Recentes e Arquivos Processados */}
      <div className="bg-white rounded-xl border border-[var(--atlas-border)] shadow-2xs overflow-hidden">
        {/* Search & Filter Controls */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Pesquisar por empresa, arquivo ou mensagem..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 border border-slate-300 rounded-md text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-[#1e3a5f]"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 p-0.5">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="border border-slate-300 rounded-md px-2 py-1.5 bg-white text-slate-700 font-medium focus:outline-hidden focus:border-[#1e3a5f]"
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
          <div className="p-10 text-center text-slate-500 space-y-1">
            <Clock className="w-6 h-6 text-slate-300 mx-auto" />
            <p className="font-semibold text-slate-700 text-xs">Nenhum registro retornado</p>
            <p className="text-[11px]">As execuções de importação do Robô Fiscal aparecerão nesta tabela.</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-100 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-2.5 px-3">Data / Hora</th>
                <th className="py-2.5 px-3">Empresa / Cliente</th>
                <th className="py-2.5 px-3">Ação</th>
                <th className="py-2.5 px-3">Mensagem do Robô</th>
                <th className="py-2.5 px-3">Detalhes Técnicos</th>
                <th className="py-2.5 px-3 text-right">Inconsistências</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.map(log => {
                let badgeClass = 'bg-slate-100 text-slate-700 border-slate-200';
                if (log.tipoAcao === 'INCONSISTENCIA') badgeClass = 'bg-rose-100 text-rose-800 border-rose-200 font-bold';
                if (log.tipoAcao === 'APRENDIZADO') badgeClass = 'bg-emerald-100 text-[#0f6e56] border-emerald-200 font-bold';
                if (log.tipoAcao === 'PROCESSAMENTO') badgeClass = 'bg-sky-100 text-sky-800 border-sky-200';
                if (log.tipoAcao === 'ERRO') badgeClass = 'bg-amber-100 text-amber-800 border-amber-200';

                return (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString('pt-BR')}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-800">
                      {log.clienteNome || 'Sistema / Global'}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-[10px] border ${badgeClass}`}>
                        {log.tipoAcao}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800">
                      {log.mensagem}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 text-[11px] font-mono">
                      {log.detalhes || '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold">
                      {log.inconsistenciasCount ? (
                        <span className="text-rose-700 font-bold">{log.inconsistenciasCount}</span>
                      ) : (
                        <span className="text-slate-400 font-normal">0</span>
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
