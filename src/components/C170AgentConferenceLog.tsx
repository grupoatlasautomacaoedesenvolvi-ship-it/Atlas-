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
    <div className="bg-[var(--atlas-surface)] rounded-2xl shadow-xl border border-[var(--atlas-border)] overflow-hidden flex flex-col h-[700px]">
      {/* Log Header */}
      <div className="bg-[var(--atlas-navy)] p-6 flex flex-wrap items-center justify-between gap-6 shadow-lg relative z-10">
        <div className="flex items-center space-x-5">
          <div className="w-14 h-14 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-emerald-400 shadow-inner">
            <Terminal className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center space-x-3">
              <h3 className="font-bold text-white text-xl tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
                Console de Auditoria C170
              </h3>
              {isProcessing && (
                <div className="atlas-pill atlas-pill-accent animate-pulse border-emerald-400/50 bg-emerald-500/20 text-emerald-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping mr-2"></span>
                  Monitorando
                </div>
              )}
            </div>
            <p className="text-xs text-white/60 font-medium uppercase tracking-widest mt-1">
              Fluxo em tempo real do processamento de Agentes AI
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`atlas-btn px-4 py-2 text-xs font-bold transition-all ${
              autoScroll
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                : 'bg-white/10 text-white/60 border-white/10 hover:text-white'
            }`}
          >
            {autoScroll ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>Auto-Scroll {autoScroll ? 'ON' : 'OFF'}</span>
          </button>

          <button
            onClick={handleExportLogs}
            disabled={logs.length === 0}
            className="atlas-btn atlas-btn-secondary bg-white/10 border-white/10 text-white/80 hover:bg-white/20 p-2"
            title="Exportar logs"
          >
            <Download className="w-4 h-4" />
          </button>

          <button
            onClick={handleClear}
            disabled={logs.length === 0}
            className="atlas-btn atlas-btn-danger p-2"
            title="Limpar Terminal"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Control Bar: Filters & Search */}
      <div className="bg-[var(--atlas-surface-hover)] border-b border-[var(--atlas-border)] p-4 px-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-[var(--atlas-text-muted)]" />
            <input
              type="text"
              placeholder="Pesquisar mensagens..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="atlas-input pl-10 pr-4 py-2 w-64 text-xs font-bold"
            />
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-[var(--atlas-text-secondary)] font-bold text-[10px] uppercase tracking-wider">Agente:</span>
            <select
              value={filterAgent}
              onChange={(e) => setFilterAgent(e.target.value)}
              className="atlas-input py-1.5 px-3 text-xs font-bold min-w-[140px]"
            >
              <option value="ALL">Todos os Agentes</option>
              <option value="system">Sistema / Núcleo</option>
              <option value="agent1">Agente 1 (NCM/CST)</option>
              <option value="agent2">Agente 2 (CFOP/Op)</option>
              <option value="agent3">Agente 3 (Consenso)</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-[var(--atlas-text-secondary)] font-bold text-[10px] uppercase tracking-wider">Status:</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="atlas-input py-1.5 px-3 text-xs font-bold min-w-[140px]"
            >
              <option value="ALL">Todos os Status</option>
              <option value="ANALYSING">Analisando</option>
              <option value="APPROVED">Aprovado</option>
              <option value="INCONSISTENT">Inconsistente</option>
              <option value="AUTO_CORRECTED">Auto-Corrigido</option>
            </select>
          </div>
        </div>

        <div className="text-[var(--atlas-text-secondary)] text-[10px] font-bold uppercase tracking-widest bg-[var(--atlas-surface)] px-3 py-1 rounded-full border border-[var(--atlas-border)]">
          Total de Eventos: <span className="text-[var(--atlas-navy)]">{filteredLogs.length}</span>
        </div>
      </div>

      {/* Terminal Output Area */}
      <div className="flex-1 p-6 font-mono text-[11px] overflow-y-auto space-y-4 bg-slate-950 text-slate-300 scrollbar-thin scrollbar-thumb-slate-800">
        {filteredLogs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-700 space-y-4">
            <Bot className="w-16 h-16 opacity-20 animate-pulse" />
            <div className="text-center space-y-1">
              <p className="text-xs font-bold uppercase tracking-widest">Console em standby</p>
              <p className="text-[10px] opacity-60">Aguardando processamento de auditoria C170...</p>
            </div>
          </div>
        ) : (
          filteredLogs.map((log) => {
            let statusBadge = null;
            switch (log.status) {
              case 'APPROVED':
                statusBadge = <span className="text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md font-bold shadow-xs">✓ APROVADO</span>;
                break;
              case 'INCONSISTENT':
                statusBadge = <span className="text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-md font-bold shadow-xs">INCONSISTENTE</span>;
                break;
              case 'AUTO_CORRECTED':
                statusBadge = <span className="text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md font-bold shadow-xs">AUTO-CORRIGIDO</span>;
                break;
              case 'ANALYSING':
                statusBadge = <span className="text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-md font-bold animate-pulse">ANALISANDO...</span>;
                break;
              default:
                statusBadge = <span className="text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md font-bold">{log.status}</span>;
            }

            let agentLabel = 'AGENTE';
            let agentColor = 'text-emerald-400 border-emerald-500/30 bg-emerald-500/5';
            if (log.agentId === 'agent1') agentColor = 'text-teal-400 border-teal-500/30 bg-teal-500/5';
            if (log.agentId === 'agent2') agentColor = 'text-cyan-400 border-cyan-500/30 bg-cyan-500/5';
            if (log.agentId === 'agent3') agentColor = 'text-amber-400 border-amber-500/30 bg-amber-500/5';
            if (log.agentId === 'system') agentColor = 'text-slate-500 border-slate-700 bg-slate-800/5';

            return (
              <div
                key={log.id}
                className="p-4 rounded-xl bg-slate-900/40 border border-white/5 hover:bg-slate-900/80 transition-all space-y-3 group hover:shadow-xl"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 text-[10px]">
                  <div className="flex items-center space-x-3">
                    <span className="text-slate-600 font-bold tracking-tighter">[{log.timestamp.split('T')[1]?.split('.')[0] || log.timestamp}]</span>
                    <span className="text-slate-500 font-bold uppercase">DOC: {log.docNum}</span>
                    <span className="text-slate-500 font-bold uppercase">ITEM: #{log.itemNum}</span>
                    <span className={`px-2 py-0.5 rounded border font-bold uppercase tracking-widest ${agentColor}`}>
                      {log.agentName}
                    </span>
                  </div>
                  <div>{statusBadge}</div>
                </div>

                <div className="text-slate-300 font-sans text-xs pl-4 border-l-2 border-slate-800 leading-relaxed group-hover:border-emerald-500/50 transition-colors">
                  <span className="font-bold text-white/40 block mb-1 uppercase text-[9px] tracking-wider">{log.descrItem}</span>
                  <div className="text-[12px] font-medium text-slate-300">{log.message}</div>
                </div>

                {log.details && (
                  <div className="pl-4 pt-1 flex flex-wrap gap-4 text-[10px] text-slate-500 font-bold uppercase tracking-tight">
                    {log.details.originalNcm && (
                      <div className="bg-white/5 px-2 py-1 rounded border border-white/5">
                        NCM: <span className="line-through text-rose-500 opacity-60">{log.details.originalNcm}</span> ➔ <span className="text-emerald-400">{log.details.suggestedNcm}</span>
                      </div>
                    )}
                    {log.details.originalCst && (
                      <div className="bg-white/5 px-2 py-1 rounded border border-white/5">
                        CST: <span className="line-through text-rose-500 opacity-60">{log.details.originalCst}</span> ➔ <span className="text-emerald-400">{log.details.suggestedCst}</span>
                      </div>
                    )}
                    {log.details.originalCfop && (
                      <div className="bg-white/5 px-2 py-1 rounded border border-white/5">
                        CFOP: <span className="line-through text-rose-500 opacity-60">{log.details.originalCfop}</span> ➔ <span className="text-emerald-400">{log.details.suggestedCfop}</span>
                      </div>
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
