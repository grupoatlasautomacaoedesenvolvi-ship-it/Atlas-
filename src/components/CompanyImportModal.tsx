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

        const targetEscritorioId = escritorioId || (typeof localStorage !== 'undefined' ? localStorage.getItem('atlas_active_escritorio_id') || 'padrao' : 'padrao');

        console.log('[CompanyImportModal] Importando empresa:', { item, targetEscritorioId });

        const saved = await saveCliente(clienteObj, targetEscritorioId);

        if (createFolders && selectedYears.length > 0) {
          await ensureStandardFiscalFolders(saved.id, selectedYears, targetEscritorioId);
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
      <div className="bg-[var(--atlas-surface)] rounded-xl max-w-4xl w-full shadow-xl border border-[var(--atlas-border)] overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="p-8 border-b border-[var(--atlas-border)] bg-[var(--atlas-surface-hover)]/40 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-[var(--atlas-navy)] text-white flex items-center justify-center shadow-xl">
              <UploadCloud className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-[var(--atlas-navy)] tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
                Importação em Lote
              </h2>
              <p className="text-xs text-[var(--atlas-text-secondary)] font-bold uppercase tracking-widest mt-0.5">Cadastramento Automático via CSV/Texto</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            disabled={isProcessing}
            className="p-2 text-[var(--atlas-text-muted)] hover:text-[var(--atlas-text)] hover:bg-[var(--atlas-surface-hover)] rounded-xl transition-all"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-8 overflow-y-auto space-y-8 flex-1">

          {/* Authorization Guard Notice */}
          {!canManageEmpresas && (
            <div className="atlas-alert-danger flex items-start gap-4">
              <Lock className="w-6 h-6 shrink-0" />
              <div className="space-y-1">
                <h4 className="font-bold text-sm">Permissão de Cadastro Restrita</h4>
                <p className="text-xs opacity-90 leading-relaxed">
                  Seu perfil atual é <strong>Colaborador</strong>. O cadastro em massa é restrito a <strong>Administradores</strong>.
                </p>
              </div>
            </div>
          )}

          {/* Download Model & Export Current Data Section */}
          <div className="atlas-card p-5 bg-[var(--atlas-surface-hover)]/40 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-1">
              <div className="font-bold text-[var(--atlas-navy)] flex items-center gap-2">
                <FileDown className="w-5 h-5 opacity-70" />
                <span style={{ fontFamily: 'var(--font-display)' }} className="text-lg">Modelo de Estrutura</span>
              </div>
              <p className="text-xs text-[var(--atlas-text-secondary)] leading-relaxed">
                Baixe o gabarito padrão para preencher no Excel e importar sem erros de mapeamento.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0 w-full md:w-auto">
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="atlas-btn atlas-btn-secondary flex-1 md:flex-none py-2 px-4 shadow-xs"
              >
                <Download className="w-4 h-4" />
                <span>Baixar CSV</span>
              </button>

              <button
                type="button"
                onClick={handleExportExistingToCSV}
                className="atlas-btn atlas-btn-secondary flex-1 md:flex-none py-2 px-4 shadow-xs"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Exportar ({existingClientes.length})</span>
              </button>
            </div>
          </div>

          {/* Input Method Tabs */}
          {!hasParsed && (
            <div className="space-y-6">
              <div className="flex bg-[var(--atlas-surface-hover)] p-1 rounded-xl border border-[var(--atlas-border)]">
                <button
                  type="button"
                  onClick={() => setActiveTab('upload')}
                  className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                    activeTab === 'upload' 
                      ? 'bg-[var(--atlas-navy)] text-white shadow-md' 
                      : 'text-[var(--atlas-text-secondary)] hover:text-[var(--atlas-navy)]'
                  }`}
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>Upload CSV</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('paste')}
                  className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                    activeTab === 'paste' 
                      ? 'border-[var(--atlas-navy)] text-white shadow-md' 
                      : 'text-[var(--atlas-text-secondary)] hover:text-[var(--atlas-navy)]'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>Colar Texto</span>
                </button>
              </div>

              {activeTab === 'upload' ? (
                <div 
                  onClick={() => canManageEmpresas && fileInputRef.current?.click()}
                  className={`atlas-card border-2 border-dashed p-12 text-center transition-all ${
                    canManageEmpresas 
                      ? 'border-[var(--atlas-border)] hover:border-[var(--atlas-navy)] bg-[var(--atlas-surface-hover)]/30 hover:bg-[var(--atlas-surface-hover)]/60 cursor-pointer' 
                      : 'border-[var(--atlas-border)] bg-[var(--atlas-surface-hover)]/20 cursor-not-allowed opacity-60'
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
                  <div className="w-16 h-16 rounded-full bg-[var(--atlas-surface)] border border-[var(--atlas-border)] flex items-center justify-center mx-auto mb-4 text-[var(--atlas-navy)] shadow-xs">
                    <UploadCloud className="w-8 h-8" />
                  </div>
                  <p className="font-bold text-[var(--atlas-navy)] text-base">Selecione seu arquivo CSV ou TXT</p>
                  <p className="text-[var(--atlas-text-secondary)] text-xs mt-1 max-w-xs mx-auto leading-relaxed">
                    O sistema detecta automaticamente delimitadores de ponto e vírgula, vírgula ou TAB.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <textarea
                    rows={6}
                    disabled={!canManageEmpresas}
                    value={pastedText}
                    onChange={e => setPastedText(e.target.value)}
                    placeholder="Cole aqui as linhas da sua planilha...&#10;Nome;CNPJ;Regime;UF;IE"
                    className="atlas-input w-full p-4 font-mono text-xs min-h-[200px]"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={!canManageEmpresas || !pastedText.trim()}
                      onClick={() => parseCSVText(pastedText)}
                      className="atlas-btn atlas-btn-primary py-3 px-8 shadow-md"
                    >
                      <Building2 className="w-4 h-4" />
                      <span>Processar Conteúdo</span>
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
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-[var(--atlas-surface-hover)] border border-[var(--atlas-border)] rounded-xl">
                <div className="flex items-center space-x-3">
                  <span className="font-bold text-[var(--atlas-text-secondary)]">Resumo da Leitura:</span>
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
                  className="px-2.5 py-1 text-[var(--atlas-text-secondary)] hover:text-[var(--atlas-text)] border border-[var(--atlas-border)] rounded-lg hover:bg-[var(--atlas-surface)] font-semibold flex items-center space-x-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Nova Leitura</span>
                </button>
              </div>

              {/* Options bar */}
              <div className="p-3 bg-[var(--atlas-surface-hover)] border border-[var(--atlas-border)] rounded-xl space-y-2">
                <div className="font-bold text-[var(--atlas-text)] flex items-center space-x-1.5">
                  <FolderTree className="w-4 h-4 text-[var(--atlas-navy)]" />
                  <span>Configurações do Cadastro Automático</span>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <label className="flex items-center space-x-1.5 cursor-pointer font-semibold text-[var(--atlas-text-secondary)]">
                    <input
                      type="checkbox"
                      checked={createFolders}
                      onChange={e => setCreateFolders(e.target.checked)}
                      className="rounded border-[var(--atlas-border)] text-[var(--atlas-navy)]"
                    />
                    <span>Gerar Estrutura de Pastas Fiscais</span>
                  </label>

                  <label className="flex items-center space-x-1.5 cursor-pointer font-semibold text-[var(--atlas-text-secondary)]">
                    <input
                      type="checkbox"
                      checked={updateExisting}
                      onChange={e => setUpdateExisting(e.target.checked)}
                      className="rounded border-[var(--atlas-border)] text-[var(--atlas-navy)]"
                    />
                    <span>Sobrescrever/Atualizar Empresas com mesmo CNPJ</span>
                  </label>

                  {createFolders && (
                    <div className="flex items-center space-x-2 pl-2 border-l border-[var(--atlas-border)]">
                      <span className="text-[var(--atlas-text-secondary)] font-medium">Exercícios:</span>
                      {['2026', '2025', '2024'].map(ano => (
                        <label key={ano} className="flex items-center space-x-1 cursor-pointer font-bold text-[var(--atlas-navy)]">
                          <input
                            type="checkbox"
                            checked={selectedYears.includes(ano)}
                            onChange={e => {
                              if (e.target.checked) setSelectedYears(prev => [...prev, ano]);
                              else setSelectedYears(prev => prev.filter(a => a !== ano));
                            }}
                            className="rounded border-[var(--atlas-border)] text-[var(--atlas-navy)]"
                          />
                          <span>{ano}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Preview Table */}
              <div className="border border-[var(--atlas-border)] rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-[var(--atlas-surface-hover)] text-[var(--atlas-text-secondary)] font-bold sticky top-0 border-b border-[var(--atlas-border)]">
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
                  <tbody className="divide-y divide-[var(--atlas-border)]">
                    {displayedItems.map((item, idx) => (
                      <tr key={item.idTemp || idx} className="hover:bg-[var(--atlas-surface-hover)]">
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
                        <td className="p-2 font-bold text-[var(--atlas-text)] max-w-[180px] truncate">{item.nome || '—'}</td>
                        <td className="p-2 font-mono font-medium text-[var(--atlas-text-secondary)] whitespace-nowrap">{item.cnpj || '—'}</td>
                        <td className="p-2 text-[var(--atlas-text-secondary)] whitespace-nowrap">{item.regimeTributario}</td>
                        <td className="p-2 font-bold text-[var(--atlas-text-secondary)]">{item.uf}</td>
                        <td className="p-2 text-[var(--atlas-text-secondary)]">{item.ie}</td>
                        <td className="p-2 text-[var(--atlas-text-secondary)] max-w-[200px] truncate">{item.validationMessage}</td>
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
                  className="h-full bg-[var(--atlas-navy)] transition-all duration-300 rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-[var(--atlas-surface-hover)] border-t border-[var(--atlas-border)] flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 bg-[var(--atlas-surface-hover)] hover:bg-[var(--atlas-border)] text-[var(--atlas-text-secondary)] font-bold rounded-lg transition-colors"
          >
            Cancelar
          </button>

          {hasParsed && (
            <button
              type="button"
              disabled={!canManageEmpresas || countImportable === 0 || isProcessing}
              onClick={handleConfirmImport}
              className="px-5 py-2 bg-[var(--atlas-navy)] hover:bg-[var(--atlas-navy-dark)] disabled:opacity-50 text-white font-bold rounded-lg shadow-xs transition-colors flex items-center space-x-1.5"
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
