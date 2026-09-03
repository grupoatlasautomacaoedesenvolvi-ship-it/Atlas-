import React, { useState, useMemo } from 'react';
import { Calculator, Search, Calendar, Filter, X, ArrowUpRight, ArrowDownRight, Minus, FileText } from 'lucide-react';

interface AuditLogViewerProps {
  c190AuditLogs: any[];
  onClose?: () => void;
}

export function AuditLogViewer({ c190AuditLogs = [], onClose }: AuditLogViewerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  const filteredLogs = useMemo(() => {
    return c190AuditLogs.filter(log => {
      // Date filter (YYYY-MM-DD match on log.timestamp)
      if (dateFilter) {
        const logDate = new Date(log.timestamp).toISOString().split('T')[0];
        if (logDate !== dateFilter) return false;
      }

      // Search term filter (matches docId, numDoc in documentDeltas, or recalculatedDocIds)
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesGlobalIds = log.recalculatedDocIds?.some((id: string) => id.toLowerCase().includes(term));
        const matchesDocDeltas = log.documentDeltas?.some((d: any) => 
          (d.docId && d.docId.toLowerCase().includes(term)) || 
          (d.numDoc && d.numDoc.toLowerCase().includes(term))
        );
        if (!matchesGlobalIds && !matchesDocDeltas) return false;
      }

      return true;
    });
  }, [c190AuditLogs, searchTerm, dateFilter]);

  return (
    <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col border border-slate-200">
      {/* Header */}
      <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold shadow-inner">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">AuditLogViewer — Histórico C190</h2>
            <p className="text-xs text-slate-500">Visualização avançada e filtragem de execuções de recálculo do Bloco C190</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-600 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filters Bar */}
      <div className="p-4 bg-slate-100/70 border-b border-slate-200 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filtrar por ID de Documento ou Nº..."
            className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center space-x-2">
          <Calendar className="w-4 h-4 text-slate-400" />
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
          {dateFilter && (
            <button
              onClick={() => setDateFilter('')}
              className="text-xs text-indigo-600 hover:underline font-medium px-2 py-1"
            >
              Limpar Data
            </button>
          )}
        </div>

        <div className="text-xs text-slate-500 font-medium ml-auto">
          Exibindo <span className="font-bold text-slate-700">{filteredLogs.length}</span> de {c190AuditLogs.length} registros
        </div>
      </div>

      {/* Logs List Container */}
      <div className="p-6 overflow-y-auto flex-1 space-y-6">
        {filteredLogs.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">Nenhum log de auditoria encontrado com os filtros atuais.</p>
            <p className="text-xs text-slate-400 mt-1">Tente limpar os termos de busca ou a data selecionada.</p>
          </div>
        ) : (
          filteredLogs.map((log, idx) => (
            <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800">
                    Execução #{c190AuditLogs.length - c190AuditLogs.indexOf(log)}
                  </span>
                  <span className="text-xs font-semibold text-slate-700 flex items-center space-x-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 mr-1" />
                    {new Date(log.timestamp).toLocaleString()}
                  </span>
                </div>
                <div className="text-xs text-slate-500 font-mono bg-white px-2.5 py-1 rounded border border-slate-200">
                  IDs Recalculados: {Array.isArray(log.recalculatedDocIds) ? log.recalculatedDocIds.join(', ') : 'Global'}
                </div>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Valor Operações (Vl. Opr)</span>
                  <div className="text-xs font-medium text-slate-600">Antes: R$ {log.before.vlOpr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                  <div className="text-xs font-medium text-slate-800">Depois: R$ {log.after.vlOpr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                  <div className={`text-xs font-bold mt-1.5 flex items-center space-x-1 ${log.delta.vlOpr === 0 ? 'text-slate-500' : log.delta.vlOpr > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {log.delta.vlOpr > 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : log.delta.vlOpr < 0 ? <ArrowDownRight className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
                    <span>Delta: R$ {log.delta.vlOpr > 0 ? `+${log.delta.vlOpr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : log.delta.vlOpr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Base de Cálculo ICMS</span>
                  <div className="text-xs font-medium text-slate-600">Antes: R$ {log.before.vlBcIcms.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                  <div className="text-xs font-medium text-slate-800">Depois: R$ {log.after.vlBcIcms.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                  <div className={`text-xs font-bold mt-1.5 flex items-center space-x-1 ${log.delta.vlBcIcms === 0 ? 'text-slate-500' : log.delta.vlBcIcms > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {log.delta.vlBcIcms > 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : log.delta.vlBcIcms < 0 ? <ArrowDownRight className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
                    <span>Delta: R$ {log.delta.vlBcIcms > 0 ? `+${log.delta.vlBcIcms.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : log.delta.vlBcIcms.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">ICMS Total</span>
                  <div className="text-xs font-medium text-slate-600">Antes: R$ {log.before.vlIcms.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                  <div className="text-xs font-medium text-slate-800">Depois: R$ {log.after.vlIcms.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                  <div className={`text-xs font-bold mt-1.5 flex items-center space-x-1 ${log.delta.vlIcms === 0 ? 'text-slate-500' : log.delta.vlIcms > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {log.delta.vlIcms > 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : log.delta.vlIcms < 0 ? <ArrowDownRight className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
                    <span>Delta: R$ {log.delta.vlIcms > 0 ? `+${log.delta.vlIcms.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : log.delta.vlIcms.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              {/* Document Deltas Table */}
              {log.documentDeltas && log.documentDeltas.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-slate-700 mb-2 flex items-center space-x-1.5">
                    <span>Detalhamento por Documento Alterado</span>
                    <span className="bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded-full text-[10px] font-semibold">{log.documentDeltas.length}</span>
                  </h4>
                  <div className="overflow-x-auto max-h-52 border border-slate-200 rounded-lg bg-white shadow-xs">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-600 uppercase font-semibold sticky top-0">
                        <tr>
                          <th className="p-2.5">Doc ID / Nº</th>
                          <th className="p-2.5 text-right">Vl. Opr (Antes ➔ Depois)</th>
                          <th className="p-2.5 text-right">BC ICMS (Antes ➔ Depois)</th>
                          <th className="p-2.5 text-right">ICMS Delta</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {log.documentDeltas.map((d: any, dIdx: number) => (
                          <tr key={dIdx} className="hover:bg-slate-50 transition-colors">
                            <td className="p-2.5 font-mono text-[11px] font-medium text-indigo-700">{d.numDoc || d.docId}</td>
                            <td className="p-2.5 text-right font-mono">
                              {d.before.vlOpr.toFixed(2)} ➔ {d.after.vlOpr.toFixed(2)}
                            </td>
                            <td className="p-2.5 text-right font-mono">
                              {d.before.vlBcIcms.toFixed(2)} ➔ {d.after.vlBcIcms.toFixed(2)}
                            </td>
                            <td className={`p-2.5 text-right font-bold font-mono ${d.delta.vlIcms === 0 ? 'text-slate-600' : d.delta.vlIcms > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {d.delta.vlIcms > 0 ? `+${d.delta.vlIcms.toFixed(2)}` : d.delta.vlIcms.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      {onClose && (
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-900 text-white px-5 py-2 rounded-lg text-xs font-semibold shadow-sm transition-all cursor-pointer"
          >
            Fechar
          </button>
        </div>
      )}
    </div>
  );
}
