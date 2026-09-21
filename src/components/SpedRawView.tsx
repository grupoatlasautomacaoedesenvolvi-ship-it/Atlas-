import React, { useState, useMemo } from 'react';
import { SpedData } from '../types';
import { FileCode, AlertTriangle, CheckCircle, Search, RefreshCw } from 'lucide-react';

interface SpedRawViewProps {
  spedData: SpedData;
  onSyncTotals?: (docId: string) => void;
}

export function SpedRawView({ spedData, onSyncTotals }: SpedRawViewProps) {
  const [selectedReg, setSelectedReg] = useState<string>('C170');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const rawLines = spedData.rawLines || [];
  
  const enrichedLines = useMemo(() => {
    let currentDocId = '';
    return rawLines.map((l, index) => {
      const fields = l.content.split('|');
      if (l.reg === 'C100') {
        currentDocId = `${fields[7] || ''}-${fields[8] || ''}-${fields[10] || ''}`;
      }
      return { ...l, index, docId: currentDocId, fields };
    });
  }, [rawLines]);

  const filteredLines = enrichedLines.filter(l => {
    if (selectedReg !== 'ALL' && l.reg !== selectedReg) return false;
    if (searchTerm && !l.content.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto py-10 px-4 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-[var(--atlas-navy)] tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
            Registros Brutos
          </h1>
          <p className="text-sm text-[var(--atlas-text-secondary)] mt-2">Visualização técnica fiel aos registros originais (0000, 0200, C100, C170, C190)</p>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
          {['ALL', '0000', '0200', 'C100', 'C170', 'C190'].map(reg => (
            <button
              key={reg}
              onClick={() => setSelectedReg(reg)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer shadow-xs border-2 ${
                selectedReg === reg 
                  ? 'bg-[var(--atlas-navy)] text-white border-[var(--atlas-navy)]' 
                  : 'bg-[var(--atlas-surface)] text-[var(--atlas-text-secondary)] border-[var(--atlas-border)] hover:bg-[var(--atlas-surface-hover)]'
              }`}
            >
              {reg === 'ALL' ? 'Todos' : `Reg. ${reg}`}
            </button>
          ))}
        </div>
      </div>

      <div className="atlas-card overflow-hidden">
        <div className="p-5 border-b border-[var(--atlas-border)] flex flex-wrap gap-6 items-center justify-between bg-[var(--atlas-surface-hover)]/30">
          <div className="relative w-full md:w-96">
            <Search className="w-5 h-5 text-[var(--atlas-navy)] absolute left-3.5 top-1/2 -translate-y-1/2 opacity-60" />
            <input
              type="text"
              placeholder="Pesquisar nas linhas do SPED..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="atlas-input w-full pl-11 pr-4 py-2.5 text-sm"
            />
          </div>
          <span className="text-[10px] font-bold text-[var(--atlas-text-muted)] uppercase tracking-widest">
            {filteredLines.length} registros encontrados
          </span>
        </div>

        <div className="overflow-x-auto max-h-[600px] font-mono text-xs">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[var(--atlas-surface-hover)] border-b border-[var(--atlas-border)]">
              <tr className="text-[10px] font-bold text-[var(--atlas-text-muted)] uppercase tracking-widest">
                <th className="px-6 py-4 w-24">Reg.</th>
                <th className="px-6 py-4">Conteúdo Original</th>
                <th className="px-6 py-4 w-44 text-right">Conciliação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--atlas-border)]">
              {filteredLines.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center py-20 text-[var(--atlas-text-secondary)] font-sans italic">
                    Nenhum registro encontrado para os filtros aplicados.
                  </td>
                </tr>
              ) : (
                filteredLines.map((item) => {
                  const isMalformed = item.content.includes('IMPLAUSIVEL');
                  let isDivergent = false;
                  if ((item.reg === 'C100' || item.reg === 'C190') && item.docId) {
                    const docRecon = spedData.reconciliation.filter(r => r.docId === item.docId);
                    if (docRecon.some(r => r.status === 'DIVERGENTE' || r.status === 'C190_AUSENTE')) {
                      isDivergent = true;
                    }
                  }

                  return (
                    <tr key={item.index} className={`hover:bg-[var(--atlas-surface-hover)]/50 transition-colors group ${isMalformed ? 'bg-red-50 text-red-900' : 'text-[var(--atlas-text)]'}`}>
                      <td className="px-6 py-3.5 font-black text-[var(--atlas-navy)]">{item.reg}</td>
                      <td className="px-6 py-3.5 truncate max-w-4xl text-[var(--atlas-text-secondary)] group-hover:text-[var(--atlas-text)]" title={item.content}>{item.content}</td>
                      <td className="px-6 py-3.5 text-right">
                        {(item.reg === 'C100' || item.reg === 'C190') && item.docId && (
                          <div className="flex items-center justify-end gap-2">
                            {isDivergent ? (
                              <>
                                <div className="atlas-pill atlas-pill-danger py-1 px-2 border shadow-xs">
                                  <AlertTriangle className="w-3 h-3" />
                                  <span>Divergente</span>
                                </div>
                                {onSyncTotals && (
                                  <button
                                    onClick={() => onSyncTotals(item.docId!)}
                                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                    title="Sincronizar Totais"
                                  >
                                    <RefreshCw className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </>
                            ) : (
                              <div className="atlas-pill atlas-pill-accent py-1 px-2 border shadow-xs">
                                <CheckCircle className="w-3 h-3" />
                                <span>Ok</span>
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
