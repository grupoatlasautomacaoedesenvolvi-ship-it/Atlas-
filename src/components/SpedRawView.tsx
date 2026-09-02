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
    <div className="w-full mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Registros Brutos do SPED Fiscal</h1>
          <p className="text-sm text-slate-500">Visualização fiel aos registros originais (0000, 0200, C100, C170, C190)</p>
        </div>

        <div className="flex items-center space-x-2 overflow-x-auto pb-2 md:pb-0">
          {['ALL', '0000', '0200', 'C100', 'C170', 'C190'].map(reg => (
            <button
              key={reg}
              onClick={() => setSelectedReg(reg)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                selectedReg === reg ? 'bg-[#1e3a5f] text-white' : 'bg-white text-slate-700 border border-slate-200'
              }`}
            >
              {reg === 'ALL' ? 'Todos' : `Registro ${reg}`}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden mb-6">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Pesquisar nas linhas do SPED..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1e3a5f] bg-white"
            />
          </div>
          <span className="text-xs text-slate-500 font-medium">{filteredLines.length} registros exibidos</span>
        </div>

        <div className="overflow-x-auto max-h-[600px] font-mono text-xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/70 text-slate-600 uppercase">
                <th className="p-3 w-20">Registro</th>
                <th className="p-3">Conteúdo Bruto</th>
                <th className="p-3 w-40 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLines.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center py-12 text-slate-500 font-sans">
                    Nenhum registro encontrado.
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
                    <tr key={item.index} className={`hover:bg-slate-50 transition-colors ${isMalformed ? 'bg-red-50 text-red-900' : 'text-slate-800'}`}>
                      <td className="p-3 font-bold text-blue-600">{item.reg}</td>
                      <td className="p-3 truncate max-w-4xl" title={item.content}>{item.content}</td>
                      <td className="p-3 text-right">
                        {(item.reg === 'C100' || item.reg === 'C190') && item.docId && (
                          <div className="flex items-center justify-end space-x-2">
                            {isDivergent ? (
                              <>
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800">
                                  <AlertTriangle className="w-3 h-3 mr-1" />
                                  Divergente
                                </span>
                                {onSyncTotals && (
                                  <button
                                    onClick={() => onSyncTotals(item.docId!)}
                                    className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                    title="Sincronizar Totais"
                                  >
                                    <RefreshCw className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-800">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Sincronizado
                              </span>
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
