import React, { useState } from 'react';
import { XmlRecord } from '../types';
import { Search, Download } from 'lucide-react';

interface XmlViewProps {
  title: string;
  description: string;
  xmlRecords: XmlRecord[];
}

export function XmlView({ title, description, xmlRecords }: XmlViewProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = xmlRecords.filter(r => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        r.chvNfe.toLowerCase().includes(term) ||
        r.nNF.toLowerCase().includes(term) ||
        r.emitNome.toLowerCase().includes(term) ||
        r.destNome.toLowerCase().includes(term)
      );
    }
    return true;
  });

  const totalVNF = filtered.reduce((acc, curr) => acc + (curr.vNF || 0), 0);
  const totalVICMS = filtered.reduce((acc, curr) => acc + (curr.vICMS || 0), 0);

  const handleExportCsv = () => {
    const headers = ['Nota', 'Série', 'Emitente', 'CNPJ Emitente', 'Destinatário', 'CNPJ Destinatário', 'Valor Total', 'Valor ICMS', 'Chave de Acesso'];
    const rows = filtered.map(item => [
      item.nNF,
      item.serie,
      item.emitNome,
      item.emitCnpj,
      item.destNome,
      item.destCnpj,
      typeof item.vNF === 'number' ? item.vNF.toFixed(2).replace('.', ',') : String(item.vNF || ''),
      typeof item.vICMS === 'number' ? item.vICMS.toFixed(2).replace('.', ',') : String(item.vICMS || ''),
      item.chvNfe
    ]);

    const csvContent = [
      headers.join(';'),
      ...rows.map(r => r.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(';'))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${title.toLowerCase().replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-7xl mx-auto py-10 px-4 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-[var(--atlas-navy)] tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
            {title}
          </h1>
          <p className="text-sm text-[var(--atlas-text-secondary)] mt-2 max-w-2xl">{description}</p>
        </div>
        <button
          onClick={handleExportCsv}
          className="atlas-btn atlas-btn-secondary py-2.5 px-5 shadow-xs"
        >
          <Download className="w-4 h-4" />
          <span>Exportar CSV</span>
        </button>
      </div>

      <div className="atlas-card overflow-hidden">
        <div className="p-5 border-b border-[var(--atlas-border)] flex flex-wrap gap-6 items-center justify-between bg-[var(--atlas-surface-hover)]/30">
          <div className="relative w-full md:w-96">
            <Search className="w-5 h-5 text-[var(--atlas-navy)] absolute left-3.5 top-1/2 -translate-y-1/2 opacity-60" />
            <input
              type="text"
              placeholder="Buscar por chave, número ou emitente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="atlas-input w-full pl-11 pr-4 py-2.5 text-sm"
            />
          </div>
          
          <div className="flex flex-wrap items-center gap-8 text-[var(--atlas-text-secondary)]">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-widest font-bold text-[var(--atlas-text-muted)] mb-1">Total Notas</span>
              <span className="text-lg font-black text-[var(--atlas-navy)]">{filtered.length}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-widest font-bold text-[var(--atlas-text-muted)] mb-1">Total NF</span>
              <span className="text-lg font-black text-[var(--atlas-navy)]">
                R$ {totalVNF.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-widest font-bold text-[var(--atlas-text-muted)] mb-1">Total ICMS</span>
              <span className="text-lg font-black text-[var(--atlas-accent)]">
                R$ {totalVICMS.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[var(--atlas-surface-hover)] border-b border-[var(--atlas-border)]">
              <tr className="text-[10px] font-bold text-[var(--atlas-text-muted)] uppercase tracking-widest">
                <th className="px-6 py-4">Nota / Série</th>
                <th className="px-6 py-4">Emitente</th>
                <th className="px-6 py-4">Destinatário</th>
                <th className="px-6 py-4">Valor Total</th>
                <th className="px-6 py-4">Valor ICMS</th>
                <th className="px-6 py-4">Chave de Acesso</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--atlas-border)] text-sm">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-20 text-[var(--atlas-text-secondary)] italic">
                    Nenhum XML encontrado nesta categoria.
                  </td>
                </tr>
              ) : (
                filtered.map(item => (
                  <tr key={item.id} className="hover:bg-[var(--atlas-surface-hover)]/50 transition-colors group">
                    <td className="px-6 py-4 font-bold text-[var(--atlas-navy)]">
                      <div>NF: {item.nNF || 'N/D'}</div>
                      <div className="text-[10px] text-[var(--atlas-text-muted)] mt-1 uppercase tracking-wider">Série: {item.serie || '1'} | Itens: {item.itensCount}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-[var(--atlas-text)] truncate max-w-xs">{item.emitNome || 'Emitente Desconhecido'}</div>
                      <div className="text-[10px] text-[var(--atlas-text-muted)] font-mono mt-0.5">{item.emitCnpj}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-[var(--atlas-text-secondary)] truncate max-w-xs">{item.destNome || 'Destinatário'}</div>
                      <div className="text-[10px] text-[var(--atlas-text-muted)] font-mono mt-0.5">{item.destCnpj}</div>
                    </td>
                    <td className="px-6 py-4 font-black text-[var(--atlas-navy)] whitespace-nowrap">
                      R$ {item.vNF.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 font-bold text-[var(--atlas-accent)] whitespace-nowrap">
                      R$ {item.vICMS.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 font-mono text-[10px] text-[var(--atlas-text-muted)] truncate max-w-xs group-hover:text-[var(--atlas-text-secondary)]" title={item.chvNfe}>
                      {item.chvNfe}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
