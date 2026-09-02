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
    <div className="max-w-7xl mx-auto py-8 px-4">
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          <p className="text-sm text-slate-500">{description}</p>
        </div>
        <button
          onClick={handleExportCsv}
          className="bg-[#1e3a5f] hover:bg-[#142c47] text-white px-4 py-2 rounded-lg text-xs font-semibold flex items-center space-x-2 shadow-xs transition-all"
        >
          <Download className="w-4 h-4" />
          <span>Exportar CSV</span>
        </button>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden mb-6">
        <div className="p-4 border-b border-slate-100 flex flex-wrap gap-4 items-center justify-between bg-slate-50">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Buscar por chave, número ou emitente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1e3a5f] bg-white"
            />
          </div>
          
          <div className="flex flex-wrap items-center gap-6 text-xs text-slate-600 font-medium">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wider text-slate-400">Total Notas</span>
              <span className="text-sm font-semibold text-slate-700">{filtered.length}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wider text-slate-400">Total NF (R$)</span>
              <span className="text-sm font-semibold text-blue-600">
                {totalVNF.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wider text-slate-400">Total ICMS (R$)</span>
              <span className="text-sm font-semibold text-green-600">
                {totalVICMS.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <th className="p-4">Nota / Série</th>
                <th className="p-4">Emitente</th>
                <th className="p-4">Destinatário</th>
                <th className="p-4">Valor Total</th>
                <th className="p-4">Valor ICMS</th>
                <th className="p-4">Chave de Acesso</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-500">
                    Nenhum XML encontrado nesta categoria.
                  </td>
                </tr>
              ) : (
                filtered.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-semibold text-slate-800">
                      <div>NF: {item.nNF || 'N/D'}</div>
                      <div className="text-xs text-slate-400">Série: {item.serie || '1'} | Itens: {item.itensCount}</div>
                    </td>
                    <td className="p-4 text-slate-700">
                      <div className="font-medium truncate max-w-xs">{item.emitNome || 'Emitente Desconhecido'}</div>
                      <div className="text-xs text-slate-400 font-mono">{item.emitCnpj}</div>
                    </td>
                    <td className="p-4 text-slate-700">
                      <div className="font-medium truncate max-w-xs">{item.destNome || 'Destinatário'}</div>
                      <div className="text-xs text-slate-400 font-mono">{item.destCnpj}</div>
                    </td>
                    <td className="p-4 font-medium text-slate-900">
                      R$ {item.vNF.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-4 text-slate-700">
                      R$ {item.vICMS.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-4 font-mono text-xs text-slate-500 truncate max-w-xs" title={item.chvNfe}>
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
