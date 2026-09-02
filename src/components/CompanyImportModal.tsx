import React, { useState, useRef } from 'react';
import { 
  UploadCloud, 
  FileSpreadsheet, 
  Download, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  FolderTree, 
  FileText, 
  Building2, 
  Lock, 
  Info,
  RefreshCw,
  FileDown
} from 'lucide-react';
import { Cliente, RegimeTributario } from '../types';
import { saveCliente, ensureStandardFiscalFolders } from '../lib/clientService';

interface CompanyImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => Promise<void> | void;
  addNotification: (title: string, message: string, type: 'system' | 'import' | 'audit' | 'export') => void;
  escritorioId: string;
  existingClientes: Cliente[];
  userPapel?: 'super_admin' | 'admin_escritorio' | 'colaborador' | string;
}

export interface ParsedCompanyItem {
  idTemp: string;
  nome: string;
  cnpj: string;
  cnpjRaw: string;
  regimeTributario: RegimeTributario;
  uf: string;
  ie: string;
  email: string;
  telefone: string;
  observacoes: string;
  status: 'VALID' | 'DUPLICATE' | 'INVALID';
  validationMessage: string;
  existingClienteId?: string;
}

const REGIMES_VALIDOS: RegimeTributario[] = ['Lucro Real', 'Lucro Presumido', 'Simples Nacional', 'MEI'];

const UFS_VALIDAS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

export function CompanyImportModal({
  isOpen,
  onClose,
  onImportComplete,
  addNotification,
  escritorioId,
  existingClientes,
  userPapel = 'colaborador'
}: CompanyImportModalProps) {
  // Authorization check: Enabled only for hierarchy levels superior to colaborador
  const canManageEmpresas = userPapel === 'super_admin' || userPapel === 'admin_escritorio' || userPapel !== 'colaborador';

  // State
  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('upload');
  const [pastedText, setPastedText] = useState('');
  const [parsedItems, setParsedItems] = useState<ParsedCompanyItem[]>([]);
  const [hasParsed, setHasParsed] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [processingStatus, setProcessingStatus] = useState('');

  // Options
  const [createFolders, setCreateFolders] = useState(true);
  const [updateExisting, setUpdateExisting] = useState(true);
  const [selectedYears, setSelectedYears] = useState<string[]>(['2025', '2024']);
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'VALID' | 'INVALID'>('ALL');

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Format CNPJ Helper
  const formatCNPJ = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 14);
    if (digits.length === 14) {
      return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    }
    return value.trim();
  };

  // Standardize Regime Tributario
  const normalizeRegime = (value: string): RegimeTributario => {
    const v = (value || '').toLowerCase().trim();
    if (v.includes('presumido')) return 'Lucro Presumido';
    if (v.includes('simples')) return 'Simples Nacional';
    if (v.includes('mei') || v.includes('microempreendedor')) return 'MEI';
    return 'Lucro Real'; // Default fallback
  };

  // Standardize UF
  const normalizeUF = (value: string): string => {
    const uf = (value || '').toUpperCase().trim();
    if (UFS_VALIDAS.includes(uf)) return uf;
    return 'SP';
  };

  // Generate and Download Template CSV File (Modelo de Exportação para Importação)
  const handleDownloadTemplate = () => {
    const header = 'Nome/Razao Social;CNPJ;Regime Tributario;UF;Inscricao Estadual;Email;Telefone;Observacoes';
    const sampleRows = [
      'Empresa Exemplo LTDA;12.345.678/0001-90;Lucro Presumido;SP;123456789;contato@exemplo.com.br;(11) 99999-8888;Importada via planilha modelo',
      'Comercio de Alimentos SA;98.765.432/0001-10;Lucro Real;RJ;987654321;financeiro@alimentos.com.br;(21) 3333-4444;Cliente matriz',
      'Prestadora de Servicos ME;11.222.333/0001-44;Simples Nacional;MG;ISENTO;contato@servicos.com.br;(31) 98888-7777;Optante pelo Simples'
    ];

    const csvContent = '\uFEFF' + [header, ...sampleRows].join('\n'); // UTF-8 BOM
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'modelo_importacao_empresas.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    addNotification('Modelo Baixado', 'O arquivo "modelo_importacao_empresas.csv" foi baixado.', 'export');
  };

  // Export Existing Companies to CSV
  const handleExportExistingToCSV = () => {
    if (existingClientes.length === 0) {
      alert('Não há empresas cadastradas para exportar.');
      return;
    }

    const header = 'Razao Social / Nome;CNPJ;Regime Tributario;UF;Inscricao Estadual;Email;Telefone;Observacoes;Data Cadastro';
    const rows = existingClientes.map(c => {
      const nome = `"${(c.nome || '').replace(/"/g, '""')}"`;
      const cnpj = `"${c.cnpj || ''}"`;
      const regime = `"${c.regimeTributario || ''}"`;
      const uf = `"${c.uf || ''}"`;
      const ie = `"${c.ie || 'ISENTO'}"`;
      const email = `"${c.email || ''}"`;
      const tel = `"${c.telefone || ''}"`;
      const obs = `"${(c.observacoes || '').replace(/"/g, '""')}"`;
      const dt = `"${c.createdAt ? new Date(c.createdAt).toLocaleDateString('pt-BR') : ''}"`;
      return `${nome};${cnpj};${regime};${uf};${ie};${email};${tel};${obs};${dt}`;
    });

    const csvContent = '\uFEFF' + [header, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `empresas_cadastradas_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    addNotification('Exportação Concluída', `${existingClientes.length} empresas foram exportadas para CSV.`, 'export');
  };

  // Parse Raw Text Lines into Companies
  const parseCSVText = (text: string) => {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) {
      alert('O conteúdo inserido está vazio.');
      return;
    }

    // Detect delimiter
    const firstLine = lines[0];
    let delimiter = ';';
    if (firstLine.includes(';') && !firstLine.includes(',')) delimiter = ';';
    else if (firstLine.includes('\t')) delimiter = '\t';
    else if (firstLine.includes(',') && !firstLine.includes(';')) delimiter = ',';

    // Helper to parse line respecting quotes
    const parseLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === delimiter && !inQuotes) {
          result.push(current.trim().replace(/^"|"$/g, ''));
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim().replace(/^"|"$/g, ''));
      return result;
    };

    let startIdx = 0;
    const headerRow = parseLine(lines[0]).map(h => h.toLowerCase().trim());
    
    // Header Mapping
    let nameIdx = -1;
    let cnpjIdx = -1;
    let regimeIdx = -1;
    let ufIdx = -1;
    let ieIdx = -1;
    let emailIdx = -1;
    let telIdx = -1;
    let obsIdx = -1;

    headerRow.forEach((col, idx) => {
      if (col.includes('nome') || col.includes('razao') || col.includes('empresa') || col.includes('cliente')) nameIdx = idx;
      else if (col.includes('cnpj') || col.includes('cpf')) cnpjIdx = idx;
      else if (col.includes('regime')) regimeIdx = idx;
      else if (col === 'uf' || col.includes('estado')) ufIdx = idx;
      else if (col.includes('ie') || col.includes('inscrica') || col.includes('inscrição')) ieIdx = idx;
      else if (col.includes('email') || col.includes('e-mail')) emailIdx = idx;
      else if (col.includes('tel') || col.includes('fone')) telIdx = idx;
      else if (col.includes('obs') || col.includes('observa')) obsIdx = idx;
    });

    // Check if first row is header
    const isHeaderRow = nameIdx !== -1 || cnpjIdx !== -1 || regimeIdx !== -1;
    if (isHeaderRow) {
      startIdx = 1;
    } else {
      // Fallback index mapping if no header matches
      nameIdx = 0;
      cnpjIdx = 1;
      regimeIdx = 2;
      ufIdx = 3;
      ieIdx = 4;
      emailIdx = 5;
      telIdx = 6;
      obsIdx = 7;
    }

    const items: ParsedCompanyItem[] = [];

    for (let i = startIdx; i < lines.length; i++) {
      const row = parseLine(lines[i]);
      if (row.length === 0 || row.every(cell => cell === '')) continue;

      const rawNome = row[nameIdx] || '';
      const rawCnpj = row[cnpjIdx] || '';
      const rawRegime = row[regimeIdx] || '';
      const rawUf = row[ufIdx] || '';
      const rawIe = row[ieIdx] || '';
      const rawEmail = row[emailIdx] || '';
      const rawTel = row[telIdx] || '';
      const rawObs = row[obsIdx] || '';

      const cnpjDigits = rawCnpj.replace(/\D/g, '');
      const formattedCnpj = cnpjDigits.length === 14 
        ? cnpjDigits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
        : rawCnpj.trim();

      // Validation
      let status: 'VALID' | 'DUPLICATE' | 'INVALID' = 'VALID';
      let msg = 'Pronto para importar';

      if (!rawNome.trim()) {
        status = 'INVALID';
        msg = 'Nome / Razão Social é obrigatório';
      } else if (!cnpjDigits || cnpjDigits.length < 11) {
        status = 'INVALID';
        msg = 'CNPJ inválido ou ausente';
      } else {
        // Check duplicate
        const existing = existingClientes.find(c => 
          c.cnpj.replace(/\D/g, '') === cnpjDigits
        );
        if (existing) {
          status = 'DUPLICATE';
          msg = `CNPJ já cadastrado (${existing.nome}). Irá atualizar.`;
        }
      }

      items.push({
        idTemp: `imp-${i}-${Date.now()}`,
        nome: rawNome.trim(),
        cnpj: formattedCnpj,
        cnpjRaw: cnpjDigits,
        regimeTributario: normalizeRegime(rawRegime),
        uf: normalizeUF(rawUf),
        ie: rawIe.trim() || 'ISENTO',
        email: rawEmail.trim(),
        telefone: rawTel.trim(),
        observacoes: rawObs.trim(),
        status,
        validationMessage: msg,
        existingClienteId: existingClientes.find(c => c.cnpj.replace(/\D/g, '') === cnpjDigits)?.id
      });
    }

    setParsedItems(items);
    setHasParsed(true);
  };

  // File Upload Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        parseCSVText(text);
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  // Filtered Preview Items
  const displayedItems = parsedItems.filter(item => {
    if (filterStatus === 'VALID') return item.status === 'VALID' || item.status === 'DUPLICATE';
    if (filterStatus === 'INVALID') return item.status === 'INVALID';
    return true;
  });

  const countValid = parsedItems.filter(i => i.status === 'VALID').length;
  const countDuplicate = parsedItems.filter(i => i.status === 'DUPLICATE').length;
  const countInvalid = parsedItems.filter(i => i.status === 'INVALID').length;
  const countImportable = countValid + (updateExisting ? countDuplicate : 0);

  // Execute Batch Import
  const handleConfirmImport = async () => {
    if (!canManageEmpresas) {
      alert('Ação restrita a Administradores do Escritório e Super Administradores.');
      return;
    }

    const itemsToProcess = parsedItems.filter(i => 
      i.status === 'VALID' || (i.status === 'DUPLICATE' && updateExisting)
    );

    if (itemsToProcess.length === 0) {
      alert('Nenhuma empresa válida disponível para importação.');
      return;
    }

    setIsProcessing(true);
    setProgressPercent(0);
    setProcessingStatus('Iniciando cadastro em lote...');

    try {
      let completed = 0;

      for (const item of itemsToProcess) {
        setProcessingStatus(`Cadastrando: ${item.nome} (${item.cnpj})...`);

        const clienteObj: Partial<Cliente> = {
          id: item.existingClienteId,
          nome: item.nome,
          cnpj: item.cnpj,
          uf: item.uf,
          ie: item.ie,
          regimeTributario: item.regimeTributario,
          email: item.email,
          telefone: item.telefone,
          observacoes: item.observacoes
        };

        const saved = await saveCliente(clienteObj, escritorioId);

        if (createFolders && selectedYears.length > 0) {
          await ensureStandardFiscalFolders(saved.id, selectedYears, escritorioId);
        }

        completed++;
        setProgressPercent(Math.round((completed / itemsToProcess.length) * 100));
      }

      addNotification(
        'Importação Concluída', 
        `${completed} empresas foram registradas com sucesso e as pastas fiscais foram criadas.`, 
        'import'
      );

      await onImportComplete();
      setIsProcessing(false);
      onClose();
    } catch (err: any) {
      console.error('Erro na importação em lote:', err);
      alert(`Erro durante a importação: ${err.message || 'Falha ao salvar clientes no banco de dados.'}`);
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-xl max-w-4xl w-full shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="bg-[#1e3a5f] p-4 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-white/10 rounded-lg">
              <FileSpreadsheet className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h2 className="font-bold text-base leading-tight">Importação de Empresas em Lote</h2>
              <p className="text-xs text-slate-300">
                Cadastre empresas parceiras/clientes e gere a estrutura de pastas fiscais via CSV.
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            disabled={isProcessing}
            className="text-slate-300 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs flex-1">

          {/* Authorization Guard Notice */}
          {!canManageEmpresas && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start space-x-3 text-amber-900">
              <Lock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-xs">Permissão de Cadastro Restrita ao Administrador</h4>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  Seu perfil atual de acesso é <strong>Colaborador</strong>. O cadastro e a importação de novas empresas são restritos estritamente a <strong>Administradores do Escritório</strong> e <strong>Super Administradores</strong>.
                </p>
              </div>
            </div>
          )}

          {/* Download Model & Export Current Data Section */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="font-bold text-slate-800 flex items-center space-x-1.5">
                <FileDown className="w-4 h-4 text-[#1e3a5f]" />
                <span>Modelo de Exportação & Importação</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Baixe o modelo com o cabeçalho padrão (Nome, CNPJ, Regime, UF, Inscrição Estadual) para preencher no Excel.
              </p>
            </div>

            <div className="flex items-center space-x-2 shrink-0 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="flex-1 sm:flex-none px-3 py-1.5 bg-white hover:bg-slate-100 text-[#1e3a5f] border border-slate-300 rounded-lg font-semibold flex items-center justify-center space-x-1.5 shadow-2xs transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-[#1e3a5f]" />
                <span>Baixar Modelo CSV</span>
              </button>

              <button
                type="button"
                onClick={handleExportExistingToCSV}
                className="flex-1 sm:flex-none px-3 py-1.5 bg-white hover:bg-slate-100 text-[#0f6e56] border border-slate-300 rounded-lg font-semibold flex items-center justify-center space-x-1.5 shadow-2xs transition-colors"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#0f6e56]" />
                <span>Exportar Atuais ({existingClientes.length})</span>
              </button>
            </div>
          </div>

          {/* Input Method Tabs */}
          {!hasParsed && (
            <div className="space-y-3">
              <div className="flex border-b border-slate-200 space-x-4">
                <button
                  type="button"
                  onClick={() => setActiveTab('upload')}
                  className={`pb-2 font-bold text-xs border-b-2 transition-colors flex items-center space-x-1.5 ${
                    activeTab === 'upload' 
                      ? 'border-[#1e3a5f] text-[#1e3a5f]' 
                      : 'border-transparent text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>Upload de Arquivo CSV / TXT</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('paste')}
                  className={`pb-2 font-bold text-xs border-b-2 transition-colors flex items-center space-x-1.5 ${
                    activeTab === 'paste' 
                      ? 'border-[#1e3a5f] text-[#1e3a5f]' 
                      : 'border-transparent text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>Colar Texto de Tabela / CSV</span>
                </button>
              </div>

              {activeTab === 'upload' ? (
                <div 
                  onClick={() => canManageEmpresas && fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                    canManageEmpresas 
                      ? 'border-slate-300 hover:border-[#1e3a5f] bg-slate-50/50 hover:bg-slate-50' 
                      : 'border-slate-200 bg-slate-100/50 cursor-not-allowed opacity-60'
                  }`}
                >
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileUpload} 
                    accept=".csv,.txt,.tsv" 
                    disabled={!canManageEmpresas}
                    className="hidden" 
                  />
                  <UploadCloud className="w-8 h-8 text-[#1e3a5f] mx-auto mb-2" />
                  <p className="font-bold text-slate-800 text-sm">Clique para selecionar seu arquivo CSV</p>
                  <p className="text-slate-500 text-[11px] mt-1">
                    Suporta arquivos delimitados por ponto e vírgula (;), vírgula (,) ou tabulação.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <textarea
                    rows={6}
                    disabled={!canManageEmpresas}
                    value={pastedText}
                    onChange={e => setPastedText(e.target.value)}
                    placeholder="Cole as linhas da sua planilha CSV aqui...&#10;Exemplo:&#10;Nome/Razão Social;CNPJ;Regime Tributário;UF;Inscrição Estadual&#10;Empresa Exemplo;12.345.678/0001-90;Lucro Presumido;SP;123456789"
                    className="w-full p-3 border border-slate-300 rounded-xl font-mono text-[11px] focus:outline-hidden focus:ring-1 focus:ring-[#1e3a5f] disabled:bg-slate-100 disabled:cursor-not-allowed"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={!canManageEmpresas || !pastedText.trim()}
                      onClick={() => parseCSVText(pastedText)}
                      className="px-4 py-2 bg-[#1e3a5f] hover:bg-[#142c47] disabled:opacity-50 text-white font-bold rounded-lg transition-colors flex items-center space-x-1.5"
                    >
                      <Building2 className="w-4 h-4" />
                      <span>Processar Texto Copiado</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Parsed Results Preview */}
          {hasParsed && (
            <div className="space-y-3">
              {/* Summary Stats */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="flex items-center space-x-3">
                  <span className="font-bold text-slate-700">Resumo da Leitura:</span>
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-800 font-bold rounded-md">
                    Total: {parsedItems.length}
                  </span>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded-md">
                    Prontos: {countValid}
                  </span>
                  {countDuplicate > 0 && (
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-bold rounded-md">
                      Duplicados (Atualizar): {countDuplicate}
                    </span>
                  )}
                  {countInvalid > 0 && (
                    <span className="px-2 py-0.5 bg-rose-100 text-rose-800 font-bold rounded-md">
                      Inválidos: {countInvalid}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setHasParsed(false);
                    setParsedItems([]);
                    setPastedText('');
                  }}
                  className="px-2.5 py-1 text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg hover:bg-white font-semibold flex items-center space-x-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Nova Leitura</span>
                </button>
              </div>

              {/* Options bar */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="font-bold text-slate-800 flex items-center space-x-1.5">
                  <FolderTree className="w-4 h-4 text-[#1e3a5f]" />
                  <span>Configurações do Cadastro Automático</span>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-[11px]">
                  <label className="flex items-center space-x-1.5 cursor-pointer font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={createFolders}
                      onChange={e => setCreateFolders(e.target.checked)}
                      className="rounded border-slate-300 text-[#1e3a5f]"
                    />
                    <span>Gerar Estrutura de Pastas Fiscais</span>
                  </label>

                  <label className="flex items-center space-x-1.5 cursor-pointer font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={updateExisting}
                      onChange={e => setUpdateExisting(e.target.checked)}
                      className="rounded border-slate-300 text-[#1e3a5f]"
                    />
                    <span>Sobrescrever/Atualizar Empresas com mesmo CNPJ</span>
                  </label>

                  {createFolders && (
                    <div className="flex items-center space-x-2 pl-2 border-l border-slate-300">
                      <span className="text-slate-500 font-medium">Exercícios:</span>
                      {['2026', '2025', '2024'].map(ano => (
                        <label key={ano} className="flex items-center space-x-1 cursor-pointer font-bold text-[#1e3a5f]">
                          <input
                            type="checkbox"
                            checked={selectedYears.includes(ano)}
                            onChange={e => {
                              if (e.target.checked) setSelectedYears(prev => [...prev, ano]);
                              else setSelectedYears(prev => prev.filter(a => a !== ano));
                            }}
                            className="rounded border-slate-300 text-[#1e3a5f]"
                          />
                          <span>{ano}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Preview Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="p-2">Status</th>
                      <th className="p-2">Razão Social / Nome</th>
                      <th className="p-2">CNPJ</th>
                      <th className="p-2">Regime</th>
                      <th className="p-2">UF</th>
                      <th className="p-2">IE</th>
                      <th className="p-2">Validação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {displayedItems.map((item, idx) => (
                      <tr key={item.idTemp || idx} className="hover:bg-slate-50">
                        <td className="p-2 whitespace-nowrap">
                          {item.status === 'VALID' && (
                            <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded flex items-center space-x-1 w-max">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Pronto</span>
                            </span>
                          )}
                          {item.status === 'DUPLICATE' && (
                            <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 font-bold rounded flex items-center space-x-1 w-max">
                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                              <span>Duplicado</span>
                            </span>
                          )}
                          {item.status === 'INVALID' && (
                            <span className="px-1.5 py-0.5 bg-rose-100 text-rose-800 font-bold rounded flex items-center space-x-1 w-max">
                              <XCircle className="w-3 h-3 text-rose-600" />
                              <span>Inválido</span>
                            </span>
                          )}
                        </td>
                        <td className="p-2 font-bold text-slate-800 max-w-[180px] truncate">{item.nome || '—'}</td>
                        <td className="p-2 font-mono font-medium text-slate-700 whitespace-nowrap">{item.cnpj || '—'}</td>
                        <td className="p-2 text-slate-700 whitespace-nowrap">{item.regimeTributario}</td>
                        <td className="p-2 font-bold text-slate-700">{item.uf}</td>
                        <td className="p-2 text-slate-600">{item.ie}</td>
                        <td className="p-2 text-slate-500 max-w-[200px] truncate">{item.validationMessage}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Progress Indicator */}
          {isProcessing && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-blue-900">
                <span>{processingStatus}</span>
                <span>{progressPercent}%</span>
              </div>
              <div className="w-full h-2.5 bg-blue-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#1e3a5f] transition-all duration-300 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors"
          >
            Cancelar
          </button>

          {hasParsed && (
            <button
              type="button"
              disabled={!canManageEmpresas || countImportable === 0 || isProcessing}
              onClick={handleConfirmImport}
              className="px-5 py-2 bg-[#1e3a5f] hover:bg-[#142c47] disabled:opacity-50 text-white font-bold rounded-lg shadow-2xs transition-colors flex items-center space-x-1.5"
            >
              <UploadCloud className="w-4 h-4" />
              <span>
                {isProcessing 
                  ? 'Processando Importação...' 
                  : `Confirmar Importação (${countImportable} Empresas)`}
              </span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
