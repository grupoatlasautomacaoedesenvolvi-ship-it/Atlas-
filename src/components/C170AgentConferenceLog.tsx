import React, { useState, useEffect, useRef } from 'react';
import {
  Terminal,
  Play,
  Pause,
  Trash2,
  Filter,
  Search,
  Download,
  Bot,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  Layers,
  ArrowDown
} from 'lucide-react';
import { C170AgentLogEntry } from '../types';
import { getStoredC170Logs, clearC170Logs } from '../lib/agentFeedbackService';

interface C170AgentConferenceLogProps {
  liveLogs?: C170AgentLogEntry[];
  isProcessing?: boolean;
  onClearLogs?: () => void;
}

export function C170AgentConferenceLog({
  liveLogs,
  isProcessing = false,
  onClearLogs
}: C170AgentConferenceLogProps) {
  const [logs, setLogs] = useState<C170AgentLogEntry[]>([]);
  const [filterAgent, setFilterAgent] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [autoScroll, setAutoScroll] = useState<boolean>(true);

  const logEndRef = useRef<HTMLDivElement>(null);

  // Sync logs
  useEffect(() => {
    if (liveLogs && liveLogs.length > 0) {
      setLogs(liveLogs);
    } else {
      setLogs(getStoredC170Logs());
    }
  }, [liveLogs]);

  // Auto-scroll logic
  useEffect(() => {
    if (autoScroll && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const handleClear = () => {
    clearC170Logs();
    setLogs([]);
    if (onClearLogs) onClearLogs();
  };

  const handleExportLogs = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(logs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `c170_agent_logs_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const filteredLogs = logs.filter(log => {
    if (filterAgent !== 'ALL' && log.agentId !== filterAgent) return false;
    if (filterStatus !== 'ALL' && log.status !== filterStatus) return false;
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      return (
        log.message.toLowerCase().includes(q) ||
        log.descrItem.toLowerCase().includes(q) ||
        log.docNum.includes(q) ||
        log.agentName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="bg-slate-950 text-slate-100 rounded-xl shadow-md border border-slate-800 overflow-hidden flex flex-col h-[650px]">
      {/* Log Header */}
      <div className="bg-slate-900 border-b border-slate-800 p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-[#0f6e56]/20 border border-[#0f6e56]/30 rounded-lg text-emerald-400">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-bold text-white text-base">Terminal de Conferência C170 em Tempo Real</h3>
              {isProcessing && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-pulse">
                  <span className="w-2 h-2 mr-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  Processando
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Acompanhamento detalhado do fluxo de decisão do Esquadrão de Agentes AI
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition ${
              autoScroll
                ? 'bg-[#0f6e56]/30 text-emerald-300 border border-[#0f6e56]/40'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
            title="Rolar automaticamente para novos logs"
          >
            {autoScroll ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{autoScroll ? 'Auto-Scroll ON' : 'Auto-Scroll OFF'}</span>
          </button>

          <button
            onClick={handleExportLogs}
            disabled={logs.length === 0}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition disabled:opacity-40"
            title="Exportar logs em JSON"
          >
            <Download className="w-4 h-4" />
          </button>

          <button
            onClick={handleClear}
            disabled={logs.length === 0}
            className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg text-xs font-medium border border-rose-500/20 transition disabled:opacity-40"
            title="Limpar logs"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Control Bar: Filters & Search */}
      <div className="bg-slate-900/80 border-b border-slate-800/80 p-3 px-4 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar no log C170..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-950 text-slate-200 pl-8 pr-3 py-1.5 rounded-lg border border-slate-800 focus:outline-hidden focus:border-[#0f6e56] w-48 sm:w-64 text-xs"
            />
          </div>

          <div className="flex items-center space-x-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
            <span className="text-slate-400 font-medium px-1.5">Agente:</span>
            <select
              value={filterAgent}
              onChange={(e) => setFilterAgent(e.target.value)}
              className="bg-transparent text-slate-200 focus:outline-hidden cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900">Todos os Agentes</option>
              <option value="system" className="bg-slate-900">Sistema / Memória</option>
              <option value="agent1" className="bg-slate-900">Agente 1 (NCM/CST)</option>
              <option value="agent2" className="bg-slate-900">Agente 2 (CFOP/Op)</option>
              <option value="agent3" className="bg-slate-900">Agente 3 (Consenso)</option>
            </select>
          </div>

          <div className="flex items-center space-x-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
            <span className="text-slate-400 font-medium px-1.5">Status:</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-transparent text-slate-200 focus:outline-hidden cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900">Todos os Status</option>
              <option value="ANALYSING" className="bg-slate-900">Analisando</option>
              <option value="APPROVED" className="bg-slate-900">Aprovado</option>
              <option value="INCONSISTENT" className="bg-slate-900">Inconsistente</option>
              <option value="AUTO_CORRECTED" className="bg-slate-900">Auto-Corrigido</option>
            </select>
          </div>
        </div>

        <div className="text-slate-400 font-mono">
          Exibindo <span className="text-emerald-400 font-bold">{filteredLogs.length}</span> de {logs.length} eventos
        </div>
      </div>

      {/* Terminal Output Area */}
      <div className="flex-1 p-4 font-mono text-xs overflow-y-auto space-y-2.5 bg-slate-950 scrollbar-thin scrollbar-thumb-slate-800">
        {filteredLogs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-3">
            <Bot className="w-12 h-12 text-slate-700 animate-bounce" />
            <p className="text-sm">Nenhum evento registrado no Terminal C170.</p>
            <p className="text-xs text-slate-600 max-w-sm text-center">
              Execute uma auditoria em lote no SPED ou simule um item para visualizar o trabalho do Esquadrão AI em tempo real.
            </p>
          </div>
        ) : (
          filteredLogs.map((log) => {
            let statusBadge = null;
            switch (log.status) {
              case 'APPROVED':
                statusBadge = <span className="text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded font-bold">✓ APROVADO</span>;
                break;
              case 'INCONSISTENT':
                statusBadge = <span className="text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded font-bold">⚠️ INCONSISTENTE</span>;
                break;
              case 'AUTO_CORRECTED':
                statusBadge = <span className="text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 rounded font-bold">⚡ AUTO-CORRIGIDO</span>;
                break;
              case 'ANALYSING':
                statusBadge = <span className="text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded font-bold animate-pulse">⏳ ANALISANDO</span>;
                break;
              default:
                statusBadge = <span className="text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded font-bold">{log.status}</span>;
            }

            let agentColor = 'text-emerald-400';
            if (log.agentId === 'agent1') agentColor = 'text-teal-400';
            if (log.agentId === 'agent2') agentColor = 'text-cyan-400';
            if (log.agentId === 'agent3') agentColor = 'text-amber-400';

            return (
              <div
                key={log.id}
                className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80 hover:bg-slate-900 transition space-y-1.5 group"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <div className="flex items-center space-x-2">
                    <span className="text-slate-500 font-mono">[{log.timestamp}]</span>
                    <span className="text-slate-400 font-semibold">Doc {log.docNum} | Item #{log.itemNum}</span>
                    <span className={`font-bold ${agentColor}`}>{log.agentName}</span>
                  </div>
                  <div>{statusBadge}</div>
                </div>

                <div className="text-slate-200 font-sans text-xs pl-2 border-l-2 border-slate-700 leading-relaxed">
                  <span className="font-semibold text-slate-300">"{log.descrItem}":</span> {log.message}
                </div>

                {log.details && (
                  <div className="pl-2 pt-1 flex flex-wrap gap-3 text-[11px] text-slate-400 font-mono">
                    {log.details.originalNcm && (
                      <span>NCM: <span className="line-through text-rose-400">{log.details.originalNcm}</span> ➔ <span className="text-emerald-400 font-bold">{log.details.suggestedNcm}</span></span>
                    )}
                    {log.details.originalCst && (
                      <span>CST: <span className="line-through text-rose-400">{log.details.originalCst}</span> ➔ <span className="text-emerald-400 font-bold">{log.details.suggestedCst}</span></span>
                    )}
                    {log.details.originalCfop && (
                      <span>CFOP: <span className="line-through text-rose-400">{log.details.originalCfop}</span> ➔ <span className="text-emerald-400 font-bold">{log.details.suggestedCfop}</span></span>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={logEndRef} />
      </div>
    </div>
  );
}
