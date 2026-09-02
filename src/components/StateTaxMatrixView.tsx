import React, { useState } from 'react';
import { StateTaxRule } from '../types';
import { Database, Plus, Trash2, Save, CheckCircle2, Search, Filter, Upload, FileSpreadsheet, X, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

interface StateTaxMatrixViewProps {
  rules: StateTaxRule[];
  onSaveRules: (rules: StateTaxRule[]) => void;
  defaultUf?: string;
}

export function StateTaxMatrixView({ rules, onSaveRules, defaultUf = 'SP' }: StateTaxMatrixViewProps) {
  const [taxRules, setTaxRules] = useState<StateTaxRule[]>(rules.length > 0 ? rules : [
    { id: '1', uf: 'ALL', ncmPrefix: '', expectedCst: '060', expectedCfop: ['1403', '5403', '2403', '6403'], descricao: 'Produtos CST 060 (ST) -> CFOPs 1403 (entradas) ou 5403 (saídas)' },
    { id: '2', uf: 'ALL', ncmPrefix: '', expectedCst: '000', expectedCfop: ['1102', '5102', '2102', '6102'], descricao: 'Demais CSTs (diferentes de 060) -> CFOPs 1102 (entradas) ou 5102 (saídas)' },
    { id: '3', uf: 'SP', ncmPrefix: '2710', expectedCst: '060', expectedCfop: ['1403', '5403'], descricao: 'Combustíveis e Lubrificantes (ST)' },
    { id: '4', uf: 'MG', ncmPrefix: '3304', expectedCst: '060', expectedCfop: ['1403', '5403'], descricao: 'Cosméticos e Perfumaria (ST)' }
  ]);
  const [savedSuccess, setSavedSuccess] = useState(false);

  React.useEffect(() => {
    if (rules.length > 0) {
      setTaxRules(rules);
    }
  }, [rules]);
  const [searchTerm, setSearchTerm] = useState('');
  const [ufFilter, setUfFilter] = useState('ALL');
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');
  const [selectedRuleIds, setSelectedRuleIds] = useState<string[]>([]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedRuleIds(filteredRules.map(r => r.id));
    } else {
      setSelectedRuleIds([]);
    }
  };

  const toggleSelectRule = (id: string) => {
    if (selectedRuleIds.includes(id)) {
      setSelectedRuleIds(selectedRuleIds.filter(i => i !== id));
    } else {
      setSelectedRuleIds([...selectedRuleIds, id]);
    }
  };

  const deleteSelectedRules = () => {
    if (selectedRuleIds.length === 0) return;
    if (window.confirm(`Deseja realmente excluir ${selectedRuleIds.length} regras selecionadas da matriz?`)) {
      const remaining = taxRules.filter(r => !selectedRuleIds.includes(r.id));
      setTaxRules(remaining);
      setSelectedRuleIds([]);
      onSaveRules(remaining);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    }
  };


  const handleExportTemplate = () => {
    const wsData = [
      ['UF', 'NCM', 'CST', 'CFOP', 'Descrição'],
      ['SP', '2710', '060', '1403, 5403', 'Combustíveis e Lubrificantes (ST)'],
      ['ALL', '1102', '000', '1102, 5102', 'Mercadorias para Comercialização'],
      ['MG', '3304', '060', '1403', 'Cosméticos (ST)'],
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    ws['!cols'] = [
      { wch: 10 },
      { wch: 15 },
      { wch: 10 },
      { wch: 20 },
      { wch: 50 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Modelo');
    XLSX.writeFile(wb, 'modelo_matriz_tributaria.xlsx');
  };

  const handleSave = () => {
    onSaveRules(taxRules);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const addRule = () => {
    const newRule: StateTaxRule = {
      id: Date.now().toString(),
      uf: defaultUf,
      ncmPrefix: '',
      expectedCst: '000',
      expectedCfop: ['1102', '5102'],
      descricao: 'Nova Regra de Tributação Estadual'
    };
    setTaxRules([newRule, ...taxRules]);
  };

  const updateRule = (id: string, field: keyof StateTaxRule, value: any) => {
    setTaxRules(taxRules.map(r => {
      if (r.id === id) {
        if (field === 'expectedCfop') {
          return { ...r, expectedCfop: typeof value === 'string' ? value.split(',').map((s: string) => s.trim()).filter(Boolean) : value };
        }
        return { ...r, [field]: value };
      }
      return r;
    }));
  };

  const deleteRule = (id: string) => {
    setTaxRules(taxRules.filter(r => r.id !== id));
  };

  const processParsedRows = (rows: any[][]) => {
    try {
      setImportError('');
      if (!rows || rows.length === 0) {
        setImportError('Conteúdo da planilha está vazio.');
        return;
      }

      const newRules: StateTaxRule[] = [];
      let startIdx = 0;

      // Check header row
      if (rows.length > 0 && Array.isArray(rows[0])) {
        const headerStr = rows[0].map(c => String(c).toLowerCase()).join(' ');
        if (headerStr.includes('uf') || headerStr.includes('ncm') || headerStr.includes('cst')) {
          startIdx = 1;
        }
      }

      for (let i = startIdx; i < rows.length; i++) {
        const row = rows[i];
        if (!row || !Array.isArray(row) || row.length === 0) continue;

        const ufRaw = String(row[0] || 'ALL').trim().toUpperCase();
        const ncmRaw = String(row[1] || '').trim();
        const cstRaw = String(row[2] || '000').trim();
        const cfopsRaw = String(row[3] || '1102, 5102').trim();
        const descRaw = String(row[4] || '').trim();

        if (!ncmRaw) continue; // ignore empty NCM rows

        let expectedCst = cstRaw || '000';
        if (/^\d{1,2}$/.test(expectedCst)) {
          expectedCst = expectedCst.padStart(3, '0');
        }

        const expectedCfop = cfopsRaw
          .split(/[,;|]/)
          .map(s => s.trim().replace(/\D/g, ''))
          .filter(Boolean);

        const descricao = descRaw || `Regra NCM ${ncmRaw} (${ufRaw || 'ALL'})`;

        newRules.push({
          id: `${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
          uf: ufRaw || 'ALL',
          ncmPrefix: ncmRaw,
          expectedCst: expectedCst,
          expectedCfop: expectedCfop.length > 0 ? expectedCfop : ['1102', '5102'],
          descricao
        });
      }

      if (newRules.length === 0) {
        setImportError('Nenhuma regra válida encontrada. Verifique o formato (UF; NCM; CST; CFOP; Descrição).');
        return;
      }

      const mergedRules = [...newRules, ...taxRules];
      setTaxRules(mergedRules);
      onSaveRules(mergedRules);
      
      // Save directly to localStorage for instant local availability
      try {
        localStorage.setItem('atlas_state_tax_matrix', JSON.stringify(mergedRules));
      } catch (err) {
        console.warn('Could not save to localStorage:', err);
      }

      setShowImportModal(false);
      setImportText('');
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      setImportError('Erro ao processar: ' + err.message);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        setImportError('');
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: '' });
        if (rows && rows.length > 0) {
          processParsedRows(rows);
        } else {
          setImportError('Planilha está vazia.');
        }
      } catch (err: any) {
        setImportError('Erro ao ler arquivo: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const processImportText = (text: string) => {
    if (!text.trim()) {
      setImportError('Conteúdo vazio.');
      return;
    }

    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const rows: string[][] = lines.map(line => {
      const delimiter = line.includes(';') ? ';' : line.includes('\t') ? '\t' : ',';
      return line.split(delimiter).map(p => p.trim().replace(/^["']|["']$/g, ''));
    });

    processParsedRows(rows);
  };

  const processImport = () => {
    processImportText(importText);
  };

  const filteredRules = taxRules.filter(r => {
    const matchesUf = ufFilter === 'ALL' || r.uf.toUpperCase() === ufFilter.toUpperCase();
    const matchesSearch = !searchTerm || 
      r.ncmPrefix.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.expectedCst.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesUf && matchesSearch;
  });

  const ufs = ['ALL', 'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

  return (
    <div className="max-w-7xl w-full mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="bg-white rounded-lg border border-slate-200/60 shadow-xs hover:shadow-sm transition-shadow overflow-hidden">
        <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
          <div className="flex items-center space-x-3">
            <div className="bg-[#0f6e56] p-3 rounded-lg text-white shadow-xs">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">Matriz Tributária (NCM por Estado / UF)</h2>
              <p className="text-sm text-slate-500">Banco de dados parametrizado de CSTs e CFOPs esperados por Estado e NCM</p>
            </div>
          </div>
          <div className="flex items-center flex-wrap gap-2">
            {savedSuccess && (
              <span className="inline-flex items-center space-x-1 text-emerald-700 text-sm font-medium animate-fade-in mr-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                <span>Matriz tributária salva</span>
              </span>
            )}
            
            {selectedRuleIds.length > 0 && (
              <button
                onClick={deleteSelectedRules}
                className="flex items-center space-x-2 bg-red-600 text-white px-4 py-2.5 rounded-lg hover:bg-red-700 transition-colors text-sm font-medium shadow-xs animate-fade-in"
                title="Excluir regras selecionadas em lote"
              >
                <Trash2 className="w-4 h-4" />
                <span>Excluir Selecionadas ({selectedRuleIds.length})</span>
              </button>
            )}

            <button
              onClick={handleExportTemplate}
              className="flex items-center space-x-2 bg-slate-100 text-slate-700 px-4 py-2.5 rounded-lg hover:bg-slate-200 transition-colors text-sm font-medium shadow-xs border border-slate-200"
              title="Baixar Modelo de Planilha Excel"
            >
              <Download className="w-4 h-4" />
              <span>Baixar Modelo</span>
            </button>
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center space-x-2 bg-[#1e3a5f] text-white px-4 py-2.5 rounded-lg hover:bg-[#142c47] transition-colors text-sm font-medium shadow-xs"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Importar Planilha</span>
            </button>
            <button
              onClick={addRule}
              className="flex items-center space-x-2 bg-[#0f6e56] text-white px-4 py-2.5 rounded-lg hover:bg-[#0b5240] transition-colors text-sm font-medium shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Regra</span>
            </button>
            <button
              onClick={handleSave}
              className="flex items-center space-x-2 bg-[#1e3a5f] text-white px-5 py-2.5 rounded-lg hover:bg-[#142c47] transition-colors text-sm font-medium shadow-xs"
            >
              <Save className="w-4 h-4" />
              <span>Salvar Matriz</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="p-4 bg-slate-100/70 border-b border-slate-200 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por NCM ou descrição..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-slate-500" />
            <span className="text-xs font-medium text-slate-600">Estado (UF):</span>
            <select
              value={ufFilter}
              onChange={(e) => setUfFilter(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {ufs.map(uf => (
                <option key={uf} value={uf}>{uf === 'ALL' ? 'Todos os Estados (ALL)' : uf}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Selection Bar */}
        {filteredRules.length > 0 && (
          <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between px-6 text-xs text-slate-600">
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={filteredRules.length > 0 && filteredRules.every(r => selectedRuleIds.includes(r.id))}
                onChange={handleSelectAll}
                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              />
              <span className="font-medium">
                Selecionar todas visíveis ({filteredRules.length})
              </span>
            </div>
            {selectedRuleIds.length > 0 && (
              <span className="font-semibold text-[#1e3a5f] bg-[#f1efe8] px-2.5 py-1 rounded-md border border-[#e5e2d9]">
                {selectedRuleIds.length} regra(s) selecionada(s)
              </span>
            )}
          </div>
        )}

        {/* Rules Table / Cards */}
        <div className="p-6">
          <div className="space-y-4">
            {filteredRules.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Database className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p className="text-sm">Nenhuma regra encontrada para os filtros selecionados.</p>
              </div>
            ) : (
              filteredRules.map((rule) => (
                <div key={rule.id} className={`border rounded-lg p-4 bg-white transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                  selectedRuleIds.includes(rule.id) ? 'border-[#1e3a5f] bg-[#f1efe8]/50 shadow-2xs' : 'border-slate-200 shadow-2xs hover:border-slate-300'
                }`}>
                  <div className="flex items-start md:items-center space-x-3 w-full">
                    <input
                      type="checkbox"
                      checked={selectedRuleIds.includes(rule.id)}
                      onChange={() => toggleSelectRule(rule.id)}
                      className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer mt-1 md:mt-0"
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 flex-1 w-full">
                      <div>
                        <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 block mb-1">UF / Estado</label>
                        <select
                          value={rule.uf}
                          onChange={(e) => updateRule(rule.id, 'uf', e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                          {ufs.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 block mb-1">Prefixo NCM</label>
                        <input
                          type="text"
                          value={rule.ncmPrefix}
                          onChange={(e) => updateRule(rule.id, 'ncmPrefix', e.target.value)}
                          placeholder="Ex: 2710"
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 block mb-1">CST Esperado</label>
                        <input
                          type="text"
                          value={rule.expectedCst}
                          onChange={(e) => updateRule(rule.id, 'expectedCst', e.target.value)}
                          placeholder="Ex: 000, 020, 060"
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 block mb-1">CFOPs (sep. vírgula)</label>
                        <input
                          type="text"
                          value={rule.expectedCfop.join(', ')}
                          onChange={(e) => updateRule(rule.id, 'expectedCfop', e.target.value)}
                          placeholder="Ex: 1102, 5102"
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>

                      <div className="sm:col-span-1">
                        <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 block mb-1">Descrição / Operação</label>
                        <input
                          type="text"
                          value={rule.descricao}
                          onChange={(e) => updateRule(rule.id, 'descricao', e.target.value)}
                          placeholder="Descrição da regra"
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center self-end md:self-center">
                    <button
                      onClick={() => deleteRule(rule.id)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-200"
                      title="Excluir regra da matriz"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 shadow-sm border border-slate-200 animate-fade-in">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div className="flex items-center space-x-3">
                <div className="bg-slate-100 text-[#1e3a5f] p-2 rounded-lg">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Importar Regras via Planilha (Excel / CSV)</h3>
                  <p className="text-xs text-slate-500">Envie um arquivo Excel (.xlsx), CSV ou cole os dados diretamente</p>
                </div>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  1. Carregar arquivo (Excel / CSV)
                </label>
                <input
                  type="file"
                  accept=".csv,.txt,.xlsx,.xls"
                  onChange={handleFileUpload}
                  className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#f1efe8] file:text-[#1e3a5f] hover:file:bg-[#e5e2d9] cursor-pointer border border-slate-200 rounded-lg p-1"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                    2. Ou cole o conteúdo (Formato: UF; NCM; CST; CFOP; Descrição)
                  </label>
                  <span className="text-[11px] text-slate-400">Ex: SP; 2710; 060; 1403, 5403; Combustíveis</span>
                </div>
                <textarea
                  rows={8}
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder={`SP; 2710; 060; 1403, 5403; Combustíveis e Lubrificantes\nALL; 1102; 000; 1102, 5102; Mercadorias em Geral\nMG; 3304; 060; 1403; Cosméticos`}
                  className="w-full p-3 font-mono text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#1e3a5f] text-slate-800"
                ></textarea>
              </div>

              {importError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
                  {importError}
                </div>
              )}

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
                <button
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={processImport}
                  className="px-5 py-2.5 bg-[#1e3a5f] text-white hover:bg-[#142c47] rounded-lg text-sm font-medium transition-colors shadow-sm"
                >
                  Importar e Adicionar Regras
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
