import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, 
  FolderPlus, 
  Folder, 
  FolderOpen, 
  Plus, 
  Search, 
  FileText, 
  Archive, 
  Trash2, 
  Edit, 
  CheckCircle2, 
  ArrowLeft, 
  Mail, 
  Phone, 
  Calendar, 
  Play, 
  Cloud, 
  UploadCloud, 
  X, 
  ChevronRight,
  ChevronDown,
  Filter,
  HardDrive,
  RefreshCw,
  FolderTree,
  FileCheck2,
  Tag,
  AlertCircle,
  AlertTriangle,
  ListTree,
  LayoutGrid,
  FileSpreadsheet,
  Lock,
  Download,
  ArrowRight
} from 'lucide-react';
import { Cliente, PastaCliente, ArquivoCliente, RegimeTributario, SpedData, XmlRecord } from '../types';
import { useAuth } from '../lib/auth';
import { CompanyImportModal } from './CompanyImportModal';
import { 
  fetchClientes, 
  saveCliente, 
  deleteCliente, 
  fetchPastasCliente, 
  savePastaCliente, 
  deletePastaCliente, 
  fetchArquivosCliente, 
  saveArquivoCliente, 
  deleteArquivoCliente,
  ensureStandardFiscalFolders,
  fetchEscritorioInfo,
  fetchAllEscritorios,
  EscritorioInfo
} from '../lib/clientService';

interface ClientesViewProps {
  activeClienteId: string | null;
  setActiveClienteId: (id: string | null) => void;
  currentSpedData: SpedData | null;
  currentXmlTerceiros: XmlRecord[];
  currentXmlProprio: XmlRecord[];
  currentXmlNfce: XmlRecord[];
  onLoadSavedAudit: (data: { sped: SpedData | null; xmlTerceiros: XmlRecord[]; xmlProprio: XmlRecord[]; xmlNfce: XmlRecord[] }) => void;
  addNotification: (title: string, message: string, type: 'system' | 'import' | 'audit' | 'export') => void;
  escritorioId?: string;
}

interface ConfirmModalState {
  isOpen: boolean;
  title: string;
  message: string;
  detail?: string;
  confirmLabel: string;
  cancelLabel: string;
  variant: 'danger' | 'warning' | 'primary';
  onConfirm: () => Promise<void> | void;
}

const REGIMES: RegimeTributario[] = ['Lucro Real', 'Lucro Presumido', 'Simples Nacional', 'MEI'];
const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

export function ClientesView({
  activeClienteId,
  setActiveClienteId,
  currentSpedData,
  currentXmlTerceiros,
  currentXmlProprio,
  currentXmlNfce,
  onLoadSavedAudit,
  addNotification,
  escritorioId
}: ClientesViewProps) {
  const { userData } = useAuth();
  const isSuperAdmin = userData?.papel === 'super_admin';
  const canManageEmpresas = isSuperAdmin || userData?.papel === 'admin_escritorio' || (Boolean(userData) && userData?.papel !== 'colaborador');

  // Escritórios list and active selection state
  const [escritoriosList, setEscritoriosList] = useState<EscritorioInfo[]>([]);
  const [selectedEscritorioFilter, setSelectedEscritorioFilter] = useState<string>(() => {
    return escritorioId || (typeof localStorage !== 'undefined' ? localStorage.getItem('atlas_active_escritorio_id') || '' : '');
  });

  const effectiveEscritorioId = useMemo(() => {
    if (selectedEscritorioFilter && selectedEscritorioFilter !== 'todos') {
      return selectedEscritorioFilter;
    }
    if (escritorioId && escritorioId.trim().length > 0) return escritorioId.trim();
    if (userData?.escritorioId && userData.escritorioId.trim().length > 0) return userData.escritorioId.trim();
    if (escritoriosList.length > 0) return escritoriosList[0].id;
    return 'padrao';
  }, [selectedEscritorioFilter, escritorioId, userData?.escritorioId, escritoriosList]);

  // State lists
  const [escritorioInfo, setEscritorioInfo] = useState<EscritorioInfo | null>(null);
  const [clientes, setClientes] = useState<(Cliente & { escritorioNome?: string })[]>([]);
  const [pastas, setPastas] = useState<PastaCliente[]>([]);
  const [arquivos, setArquivos] = useState<ArquivoCliente[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [regimeFilter, setRegimeFilter] = useState<string>('todos');
  const [ufFilter, setUfFilter] = useState<string>('todos');

  // View Mode for Folder Explorer: 'tree' (Árvore) vs 'grid' (Módulos)
  const [viewMode, setViewMode] = useState<'tree' | 'grid'>('tree');

  // Tree View Expand/Collapse state
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  // Directory Hierarchy Navigation State
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [selectedExercicio, setSelectedExercicio] = useState<PastaCliente | null>(null);
  const [selectedMes, setSelectedMes] = useState<PastaCliente | null>(null);

  // Modals state
  const [showClienteModal, setShowClienteModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Partial<Cliente> | null>(null);
  const [selectedAnosParaCriar, setSelectedAnosParaCriar] = useState<string[]>(['2025', '2024']);

  const [showSaveAuditModal, setShowSaveAuditModal] = useState(false);
  const [saveAuditNome, setSaveAuditNome] = useState('');
  const [saveAuditObs, setSaveAuditObs] = useState('');
  const [targetExercicioId, setTargetExercicioId] = useState<string>('');
  const [targetMesId, setTargetMesId] = useState<string>('');

  // Professional Confirmation Modal
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>({
    isOpen: false,
    title: '',
    message: '',
    confirmLabel: 'Confirmar',
    cancelLabel: 'Cancelar',
    variant: 'danger',
    onConfirm: () => {}
  });

  // Initial Data Load
  useEffect(() => {
    loadClientesAndEscritorios();
  }, [escritorioId, selectedEscritorioFilter]);

  const loadClientesAndEscritorios = async () => {
    setLoading(true);
    try {
      const listEsc = await fetchAllEscritorios();
      setEscritoriosList(listEsc);

      if (selectedEscritorioFilter === 'todos' || (isSuperAdmin && (!selectedEscritorioFilter || selectedEscritorioFilter === 'todos'))) {
        const allClis: (Cliente & { escritorioNome?: string })[] = [];
        for (const esc of listEsc) {
          const clis = await fetchClientes(esc.id);
          const mapped = clis.map(c => ({
            ...c,
            escritorioNome: esc.nome
          }));
          allClis.push(...mapped);
        }
        setClientes(allClis);
      } else {
        const targetEid = effectiveEscritorioId;
        const [escData, data] = await Promise.all([
          fetchEscritorioInfo(targetEid),
          fetchClientes(targetEid)
        ]);
        setEscritorioInfo(escData);
        setClientes(data.map(c => ({ ...c, escritorioNome: escData.nome })));
      }

      if (activeClienteId) {
        const found = clientes.find(c => c.id === activeClienteId);
        if (found) setSelectedCliente(found);
      }
    } catch (e) {
      console.error('Erro ao carregar escritórios e clientes:', e);
    } finally {
      setLoading(false);
    }
  };

  // Load Pastas and Arquivos whenever selected client changes
  useEffect(() => {
    if (selectedCliente) {
      const targetEid = selectedCliente.escritorioId || effectiveEscritorioId;
      loadPastasEArquivos(selectedCliente.id, targetEid);
    } else {
      setPastas([]);
      setArquivos([]);
      setSelectedExercicio(null);
      setSelectedMes(null);
    }
  }, [selectedCliente]);

  const loadPastasEArquivos = async (clienteId: string, eidTarget?: string) => {
    const eid = eidTarget || effectiveEscritorioId || 'padrao';
    try {
      const pData = await ensureStandardFiscalFolders(clienteId, ['2025', '2024'], eid);
      const aData = await fetchArquivosCliente(clienteId, eid);
      setPastas(pData);
      setArquivos(aData);

      // Auto-expand exercicios in tree view by default
      const initialExpanded: Record<string, boolean> = {};
      pData.forEach(p => {
        if (!p.parentId) {
          initialExpanded[p.id] = true;
        }
      });
      setExpandedNodes(initialExpanded);
    } catch (e) {
      console.error('Erro ao carregar pastas/arquivos:', e);
    }
  };

  // Toggle node expand/collapse
  const toggleTreeNode = (nodeId: string) => {
    setExpandedNodes(prev => ({
      ...prev,
      [nodeId]: !prev[nodeId]
    }));
  };

  // Filtered Clientes List (real-time filtering by Name or CNPJ)
  const filteredClientes = useMemo(() => {
    const cleanSearch = searchTerm.trim().toLowerCase();
    const rawSearchDigits = searchTerm.replace(/\D/g, '');

    return clientes.filter(c => {
      const matchesName = c.nome.toLowerCase().includes(cleanSearch);
      const matchesCnpj = c.cnpj.toLowerCase().includes(cleanSearch) || 
        (rawSearchDigits.length > 0 && c.cnpj.replace(/\D/g, '').includes(rawSearchDigits));
      const matchesEmail = c.email ? c.email.toLowerCase().includes(cleanSearch) : false;

      const matchesSearch = cleanSearch === '' || matchesName || matchesCnpj || matchesEmail;
      const matchesRegime = regimeFilter === 'todos' || c.regimeTributario === regimeFilter;
      const matchesUf = ufFilter === 'todos' || c.uf === ufFilter;

      return matchesSearch && matchesRegime && matchesUf;
    });
  }, [clientes, searchTerm, regimeFilter, ufFilter]);

  // Current Active Cliente Object
  const activeClienteObj = useMemo(() => {
    return clientes.find(c => c.id === activeClienteId) || null;
  }, [clientes, activeClienteId]);

  // Top level folders (Exercícios) for selected client
  const exerciciosPastas = useMemo(() => {
    if (!selectedCliente) return [];
    return pastas.filter(p => p.clienteId === selectedCliente.id && !p.parentId);
  }, [pastas, selectedCliente]);

  // Subfolders (Meses) for selected Exercício
  const mesesPastas = useMemo(() => {
    if (!selectedExercicio) return [];
    return pastas.filter(p => p.parentId === selectedExercicio.id);
  }, [pastas, selectedExercicio]);

  // Files in current view (all client files, or filtered by Exercício/Mês)
  const filteredArquivos = useMemo(() => {
    if (!selectedCliente) return [];
    if (selectedMes) {
      return arquivos.filter(a => a.pastaId === selectedMes.id);
    }
    if (selectedExercicio) {
      const mesIds = pastas.filter(p => p.parentId === selectedExercicio.id).map(p => p.id);
      return arquivos.filter(a => a.pastaId === selectedExercicio.id || (a.pastaId && mesIds.includes(a.pastaId)));
    }
    return arquivos;
  }, [arquivos, selectedCliente, selectedExercicio, selectedMes, pastas]);

  // Handle Create / Edit Cliente Form Submit
  const handleSaveClienteForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCliente?.nome || !editingCliente?.cnpj) {
      alert('Por favor, informe a Razão Social/Nome e o CNPJ do cliente.');
      return;
    }

    const isEdit = Boolean(editingCliente.id);
    const targetEscritorioId = editingCliente.escritorioId || (selectedEscritorioFilter !== 'todos' ? selectedEscritorioFilter : null) || effectiveEscritorioId || 'padrao';

    try {
      const saved = await saveCliente({ ...editingCliente, escritorioId: targetEscritorioId }, targetEscritorioId);

      if (!isEdit) {
        await ensureStandardFiscalFolders(saved.id, selectedAnosParaCriar, targetEscritorioId);
      }

      addNotification(
        isEdit ? 'Empresa Atualizada' : 'Empresa Cadastrada', 
        `Os dados da empresa "${saved.nome} - ${saved.cnpj}" foram gravados com sucesso.`, 
        'system'
      );

      setShowClienteModal(false);
      setEditingCliente(null);
      await loadClientesAndEscritorios();
      setSelectedCliente(saved);
    } catch (err: any) {
      console.error('Erro ao salvar cliente:', err);
      alert(err?.message || 'Erro ao salvar cliente no banco de dados.');
    }
  };

  // Professional Declarative Delete Cliente Modal Trigger
  const handleDeleteClienteClick = (cliente: Cliente) => {
    setConfirmModal({
      isOpen: true,
      title: 'Excluir Empresa Cliente',
      message: `Tem certeza que deseja excluir permanentemente o cadastro da empresa "${cliente.nome}"?`,
      detail: `CNPJ: ${cliente.cnpj} | Esta ação removerá o cliente e seus registros do banco de dados Firebase.`,
      confirmLabel: 'Excluir Cliente',
      cancelLabel: 'Manter Cadastro',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await deleteCliente(cliente.id, effectiveEscritorioId);
          if (activeClienteId === cliente.id) setActiveClienteId(null);
          if (selectedCliente?.id === cliente.id) setSelectedCliente(null);
          addNotification('Cliente Removido', `O cliente "${cliente.nome}" foi excluído do sistema.`, 'system');
          await loadClientesAndEscritorios();
        } catch (err) {
          console.error('Erro ao excluir cliente:', err);
          alert('Erro ao excluir cliente.');
        } finally {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  // Save Current Audit Session to Month Folder
  const handleOpenSaveCurrentAudit = () => {
    if (!selectedCliente) {
      alert('Selecione uma empresa cliente primeiro.');
      return;
    }
    if (!currentSpedData && currentXmlTerceiros.length === 0 && currentXmlProprio.length === 0) {
      alert('Não há dados de SPED ou XML importados na sessão atual para arquivar.');
      return;
    }

    const defaultName = currentSpedData?.header?.nome 
      ? `SPED EFD ${currentSpedData.header.dtIni} a ${currentSpedData.header.dtFin}` 
      : `Arquivos XML (${new Date().toLocaleDateString('pt-BR')})`;

    setSaveAuditNome(defaultName);
    setSaveAuditObs('');

    if (selectedExercicio) setTargetExercicioId(selectedExercicio.id);
    else if (exerciciosPastas.length > 0) setTargetExercicioId(exerciciosPastas[0].id);

    if (selectedMes) setTargetMesId(selectedMes.id);

    setShowSaveAuditModal(true);
  };

  const handleConfirmSaveAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCliente) return;

    const folderId = targetMesId || targetExercicioId;

    try {
      const savedArq = await saveArquivoCliente({
        clienteId: selectedCliente.id,
        pastaId: folderId,
        nome: saveAuditNome || 'Auditoria Fiscal Arquivada',
        tipo: 'AUDITORIA_SALVA',
        periodo: currentSpedData?.header?.dtIni ? currentSpedData.header.dtIni.substring(2) : new Date().toLocaleDateString('pt-BR'),
        tamanhoBytes: 1024 * 20,
        qtdDocumentos: currentSpedData?.documents?.length || (currentXmlTerceiros.length + currentXmlProprio.length),
        dataUpload: new Date().toISOString(),
        dadosSped: currentSpedData || undefined,
        xmlsTerceiros: currentXmlTerceiros,
        xmlsProprios: currentXmlProprio,
        xmlsNfce: currentXmlNfce,
        observacoes: saveAuditObs
      }, effectiveEscritorioId);

      addNotification(
        'Arquivo Armazenado no Firebase',
        `Sessão de auditoria "${savedArq.nome}" arquivada na pasta fiscal do cliente.`,
        'import'
      );

      setShowSaveAuditModal(false);
      loadPastasEArquivos(selectedCliente.id);
    } catch (e) {
      console.error('Erro ao arquivar auditoria:', e);
      alert('Erro ao salvar arquivo na pasta.');
    }
  };

  // Professional Confirmation Modal for Loading Audit
  const handleLoadAuditToWorkspace = (arq: ArquivoCliente) => {
    if (!arq.dadosSped && (!arq.xmlsTerceiros || arq.xmlsTerceiros.length === 0)) {
      alert('Este registro não possui dados de SPED ou XML gravados.');
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Carregar Auditoria na Sessão Ativa',
      message: `Deseja carregar a sessão de auditoria "${arq.nome}" no painel de auditoria principal?`,
      detail: 'Os dados atualmente abertos na sessão serão substituídos pelos arquivos gravados nesta pasta.',
      confirmLabel: 'Carregar Auditoria',
      cancelLabel: 'Cancelar',
      variant: 'primary',
      onConfirm: () => {
        onLoadSavedAudit({
          sped: arq.dadosSped || null,
          xmlTerceiros: arq.xmlsTerceiros || [],
          xmlProprio: arq.xmlsProprios || [],
          xmlNfce: arq.xmlsNfce || []
        });

        if (arq.clienteId) {
          setActiveClienteId(arq.clienteId);
        }

        addNotification(
          'Sessão Carregada',
          `"${arq.nome}" foi carregado na auditoria ativa.`,
          'audit'
        );
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // Professional Confirmation Modal for Deleting File
  const handleDeleteArquivoClick = (arq: ArquivoCliente) => {
    setConfirmModal({
      isOpen: true,
      title: 'Excluir Arquivo Fiscal',
      message: `Deseja remover o arquivo "${arq.nome}" do armazenamento da empresa?`,
      detail: 'Esta ação excluirá o registro permanente no banco de dados Firebase.',
      confirmLabel: 'Excluir Arquivo',
      cancelLabel: 'Manter Arquivo',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await deleteArquivoCliente(arq.id, effectiveEscritorioId);
          addNotification('Arquivo Excluído', `"${arq.nome}" foi removido do armazenamento.`, 'system');
          if (selectedCliente) await loadPastasEArquivos(selectedCliente.id);
        } catch (err) {
          console.error('Erro ao excluir arquivo:', err);
          alert('Erro ao excluir arquivo.');
        } finally {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  // Helper format CNPJ
  const formatCNPJ = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 14);
    return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  };

  return (
    <div className="space-y-5 pb-12">
      {/* Header Bar */}
      <div className="atlas-card p-6 md:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-[var(--atlas-navy-tint)] text-[var(--atlas-navy)] rounded-xl shadow-xs">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-[var(--atlas-navy)] tracking-tight leading-none" style={{ fontFamily: 'var(--font-display)' }}>
                  {escritorioInfo?.nome || 'Escritório Contábil'}
                </h1>
                <div className="mt-2 flex items-center gap-2">
                  <span className="atlas-pill atlas-pill-navy">
                    Escritório Ativo
                  </span>
                </div>
              </div>
            </div>
            <p className="text-sm text-[var(--atlas-text-secondary)] max-w-2xl leading-relaxed">
              Gestão de clientes vinculados a este escritório, organizados por exercícios fiscais e competências mensais. Acesse a árvore de diretórios para gerenciar arquivos SPED e XML.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={() => setShowImportModal(true)}
              className="atlas-btn atlas-btn-secondary py-2.5 px-5 text-sm cursor-pointer shadow-xs"
            >
              <FileSpreadsheet className="w-4 h-4 text-[var(--atlas-navy)]" />
              <span>Importar Lote</span>
            </button>

            <button
              onClick={() => {
                if (!canManageEmpresas) {
                  alert('Ação restrita a Administradores do Escritório e Super Administradores.');
                  return;
                }
                setEditingCliente({ regimeTributario: 'Lucro Real', uf: 'SP', tags: [] });
                setShowClienteModal(true);
              }}
              className="atlas-btn atlas-btn-primary py-2.5 px-5 text-sm cursor-pointer shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Cliente</span>
            </button>
          </div>
        </div>

        {/* Permission Warning Banner for Colaborador */}
        {!canManageEmpresas && (
          <div className="mt-3.5 p-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between text-xs text-amber-800">
            <div className="flex items-center space-x-2">
              <Lock className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>Modo Operacional:</strong> O cadastro e a importação de empresas são permitidos apenas para Administradores de Escritório e Super Admins.
              </span>
            </div>
            <span className="px-2 py-0.5 bg-amber-200 text-amber-900 rounded font-bold text-xs uppercase">
              Colaborador
            </span>
          </div>
        )}

        {/* Summary Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-[var(--atlas-border)] text-xs">
          <div className="bg-[var(--atlas-surface-hover)] border border-[var(--atlas-border)]/80 rounded-lg p-3 flex items-center justify-between">
            <div>
              <span className="text-[var(--atlas-text-secondary)] font-medium block text-xs">Empresas Cadastradas</span>
              <span className="text-base font-bold text-[var(--atlas-text)] mt-0.5 block">{clientes.length}</span>
            </div>
            <Building2 className="w-5 h-5 text-[var(--atlas-text-muted)]" />
          </div>

          <div className="bg-[var(--atlas-surface-hover)] border border-[var(--atlas-border)]/80 rounded-lg p-3 flex items-center justify-between">
            <div>
              <span className="text-[var(--atlas-text-secondary)] font-medium block text-xs">Empresa Ativa na Sessão</span>
              <span className={`text-xs font-bold mt-0.5 block truncate max-w-[200px] ${activeClienteObj ? 'text-[var(--atlas-accent)]' : 'text-[var(--atlas-text-muted)]'}`}>
                {activeClienteObj ? activeClienteObj.nome : 'Nenhuma empresa ativa'}
              </span>
            </div>
            <CheckCircle2 className={`w-5 h-5 ${activeClienteObj ? 'text-[var(--atlas-accent)]' : 'text-[var(--atlas-text-muted)]'}`} />
          </div>

          <div className="bg-[var(--atlas-surface-hover)] border border-[var(--atlas-border)]/80 rounded-lg p-3 flex items-center justify-between">
            <div>
              <span className="text-[var(--atlas-text-secondary)] font-medium block text-xs">Arquivos Fiscais Armazenados</span>
              <span className="text-base font-bold text-[var(--atlas-text)] mt-0.5 block">{arquivos.length}</span>
            </div>
            <HardDrive className="w-5 h-5 text-[var(--atlas-text-muted)]" />
          </div>
        </div>
      </div>

      {/* Main Directory Interface */}
      {!selectedCliente ? (
        /* --- VISÃO 1: CATÁLOGO DE CLIENTES COM CAMPO DE PESQUISA EM TEMPO REAL --- */
        <div className="space-y-4">
          {/* Controls & Real-Time Search Bar */}
          <div className="bg-[var(--atlas-surface)] p-3.5 rounded-xl border border-[var(--atlas-border)] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="relative flex-1 max-w-lg">
              <Search className="w-4 h-4 text-[var(--atlas-text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Pesquisar por Razão Social, Nome Fantasia ou CNPJ em tempo real..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-8 py-2 border border-[var(--atlas-border)] rounded-lg text-xs text-[var(--atlas-text)] placeholder-[var(--atlas-text-muted)] focus:outline-hidden focus:border-[var(--atlas-navy)] focus:ring-1 focus:ring-[var(--atlas-navy)] transition-all"
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')} 
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--atlas-text-muted)] hover:text-[var(--atlas-text-secondary)] p-0.5 rounded"
                  title="Limpar pesquisa"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <Building2 className="w-3.5 h-3.5 text-[var(--atlas-navy)]" />
              <select
                value={selectedEscritorioFilter}
                onChange={e => {
                  const val = e.target.value;
                  setSelectedEscritorioFilter(val);
                  if (typeof localStorage !== 'undefined') {
                    localStorage.setItem('atlas_active_escritorio_id', val);
                  }
                }}
                className="border border-[var(--atlas-border)] rounded-lg px-2.5 py-2 bg-[var(--atlas-surface)] text-[var(--atlas-text)] font-bold focus:outline-hidden focus:border-[var(--atlas-navy)]"
              >
                {(isSuperAdmin || canManageEmpresas) && <option value="todos">Todos os Escritórios</option>}
                {escritoriosList.map(esc => (
                  <option key={esc.id} value={esc.id}>{esc.nome} ({esc.cnpj || 'Sem CNPJ'})</option>
                ))}
              </select>

              <Filter className="w-3.5 h-3.5 text-[var(--atlas-text-muted)]" />
              <select
                value={regimeFilter}
                onChange={e => setRegimeFilter(e.target.value)}
                className="border border-[var(--atlas-border)] rounded-lg px-2.5 py-2 bg-[var(--atlas-surface)] text-[var(--atlas-text-secondary)] font-medium focus:outline-hidden focus:border-[var(--atlas-navy)]"
              >
                <option value="todos">Todos os Regimes</option>
                {REGIMES.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>

              <select
                value={ufFilter}
                onChange={e => setUfFilter(e.target.value)}
                className="border border-[var(--atlas-border)] rounded-lg px-2.5 py-2 bg-[var(--atlas-surface)] text-[var(--atlas-text-secondary)] font-medium focus:outline-hidden focus:border-[var(--atlas-navy)]"
              >
                <option value="todos">Todas as UFs</option>
                {UFS.map(uf => (
                  <option key={uf} value={uf}>{uf}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Table View of Clients */}
          <div className="bg-[var(--atlas-surface)] rounded-xl border border-[var(--atlas-border)] shadow-sm overflow-hidden">
            <div className="bg-[var(--atlas-surface-hover)]/60 px-5 py-3.5 border-b border-[var(--atlas-border)] text-xs font-bold text-[var(--atlas-text-secondary)] flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <FolderTree className="w-4 h-4 text-[var(--atlas-navy)]" />
                <span className="uppercase tracking-wider">Diretório Raiz de Clientes</span>
              </div>
              <span className="text-[var(--atlas-text-secondary)] font-normal text-[11px] bg-[var(--atlas-border)]/30 px-2 py-0.5 rounded-full">{filteredClientes.length} empresa(s)</span>
            </div>

            {filteredClientes.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <Building2 className="w-10 h-10 text-[var(--atlas-text-muted)] mx-auto" />
                <h3 className="text-sm font-bold text-[var(--atlas-text-secondary)]">Nenhuma empresa encontrada</h3>
                <p className="text-xs text-[var(--atlas-text-secondary)] max-w-md mx-auto">
                  {searchTerm 
                    ? `Nenhum resultado corresponde aos termos da busca "${searchTerm}".`
                    : 'Cadastre uma empresa cliente para criar a pasta raiz "Nome CNPJ", com seus exercícios e competências.'}
                </p>
                {searchTerm ? (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-[var(--atlas-text-secondary)] text-xs font-semibold rounded-lg transition-colors"
                  >
                    Limpar Filtros de Pesquisa
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setEditingCliente({ regimeTributario: 'Lucro Real', uf: 'SP' });
                      setShowClienteModal(true);
                    }}
                    className="px-3.5 py-2 bg-[var(--atlas-navy)] text-white text-xs font-semibold rounded-lg hover:bg-[var(--atlas-navy-dark)] transition-all inline-flex items-center space-x-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Cadastrar Cliente</span>
                  </button>
                )}
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-[var(--atlas-surface-hover)] border-b border-[var(--atlas-border)] text-[var(--atlas-text-secondary)] font-bold uppercase text-[10px] tracking-widest">
                  <tr>
                    <th className="py-4 px-5">Pasta do Cliente</th>
                    <th className="py-4 px-5">Escritório</th>
                    <th className="py-4 px-5">UF</th>
                    <th className="py-4 px-5">Regime</th>
                    <th className="py-4 px-5">IE</th>
                    <th className="py-4 px-5">Sessão</th>
                    <th className="py-4 px-5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--atlas-border)]">
                  {filteredClientes.map(cliente => {
                    const isActive = activeClienteId === cliente.id;
                    const folderName = `${cliente.nome} - ${cliente.cnpj}`;
                    const escNome = cliente.escritorioNome || (escritoriosList.find(e => e.id === cliente.escritorioId)?.nome) || escritorioInfo?.nome || 'Escritório Padrão';

                    return (
                      <tr key={cliente.id} className="hover:bg-[var(--atlas-surface-hover)]/50 transition-colors group/row">
                        <td className="py-4 px-5">
                          <button
                            onClick={() => setSelectedCliente(cliente)}
                            className="flex items-center space-x-3 text-left group"
                          >
                            <div className="p-2 bg-amber-50 rounded-lg group-hover:bg-amber-100 transition-colors">
                              <Folder className="w-5 h-5 text-amber-500 shrink-0" />
                            </div>
                            <div>
                              <div className="font-bold text-[var(--atlas-text)] text-[13px] group-hover:text-[var(--atlas-navy)] group-hover:underline">
                                {folderName}
                              </div>
                              {cliente.email && (
                                <div className="text-[10px] text-[var(--atlas-text-muted)] font-mono mt-0.5">{cliente.email}</div>
                              )}
                            </div>
                          </button>
                        </td>
                        <td className="py-4 px-5">
                          <span className="atlas-pill atlas-pill-navy">
                            {escNome}
                          </span>
                        </td>
                        <td className="py-4 px-5 font-bold text-[var(--atlas-text-secondary)]">{cliente.uf}</td>
                        <td className="py-4 px-5">
                          <span className="atlas-pill">
                            {cliente.regimeTributario}
                          </span>
                        </td>
                        <td className="py-4 px-5 text-[var(--atlas-text-secondary)] font-mono text-[11px]">{cliente.ie || '—'}</td>
                        <td className="py-4 px-5">
                          {isActive ? (
                            <span className="atlas-pill atlas-pill-accent flex items-center space-x-1 ring-1 ring-[var(--atlas-accent)]/20 shadow-xs">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Ativa</span>
                            </span>
                          ) : (
                            <button
                              onClick={() => {
                                setActiveClienteId(cliente.id);
                                addNotification('Empresa Ativa', `Cliente "${cliente.nome}" definido como ativo.`, 'system');
                              }}
                              className="text-[11px] font-bold text-[var(--atlas-text-muted)] hover:text-[var(--atlas-navy)] transition-colors uppercase tracking-wider"
                            >
                              Ativar
                            </button>
                          )}
                        </td>
                        <td className="py-4 px-5 text-right">
                          <div className="flex items-center justify-end space-x-2 opacity-0 group-hover/row:opacity-100 transition-opacity">
                            <button
                              onClick={() => setSelectedCliente(cliente)}
                              className="atlas-btn atlas-btn-primary py-1.5 px-3 text-[11px] cursor-pointer"
                            >
                              <span>Abrir</span>
                              <ArrowRight className="w-3.5 h-3.5 ml-1" />
                            </button>
                            <button
                              onClick={() => {
                                if (!canManageEmpresas) {
                                  alert('Ação restrita a Administradores do Escritório e Super Admins.');
                                  return;
                                }
                                setEditingCliente(cliente);
                                setShowClienteModal(true);
                              }}
                              className="p-1.5 text-[var(--atlas-text-muted)] hover:text-[var(--atlas-navy)] rounded-lg hover:bg-[var(--atlas-surface)] border border-transparent hover:border-[var(--atlas-border)] transition-all"
                              title="Editar Dados da Empresa"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                if (!canManageEmpresas) {
                                  alert('Ação restrita a Administradores do Escritório e Super Admins.');
                                  return;
                                }
                                handleDeleteClienteClick(cliente);
                              }}
                              className="p-1.5 text-[var(--atlas-text-muted)] hover:text-[var(--atlas-danger)] rounded-lg hover:bg-[var(--atlas-danger-bg)] border border-transparent hover:border-[var(--atlas-danger)]/20 transition-all"
                              title="Excluir Empresa"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : (
        /* --- VISÃO 2: EXPLORADOR HIERÁRQUICO COM VISUALIZAÇÃO EM ÁRVORE (ANO > MÊS > ARQUIVOS) --- */
        <div className="space-y-4">
          {/* Breadcrumb & Navigation Controls */}
          <div className="bg-[var(--atlas-surface)] p-3.5 rounded-xl border border-[var(--atlas-border)] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            {/* Breadcrumb Path */}
            <div className="flex items-center space-x-2 font-medium overflow-x-auto">
              <button
                onClick={() => {
                  setSelectedCliente(null);
                  setSelectedExercicio(null);
                  setSelectedMes(null);
                }}
                className="text-[var(--atlas-navy)] hover:underline flex items-center space-x-1 font-semibold"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Clientes</span>
              </button>
              <span className="text-[var(--atlas-text-muted)]">/</span>
              <button
                onClick={() => {
                  setSelectedExercicio(null);
                  setSelectedMes(null);
                }}
                className={`flex items-center space-x-1 font-bold ${
                  !selectedExercicio ? 'text-[var(--atlas-text)]' : 'text-[var(--atlas-navy)] hover:underline'
                }`}
              >
                <Folder className="w-3.5 h-3.5 text-amber-500" />
                <span>{selectedCliente.nome} - {selectedCliente.cnpj}</span>
              </button>

              {selectedExercicio && (
                <>
                  <span className="text-[var(--atlas-text-muted)]">/</span>
                  <button
                    onClick={() => setSelectedMes(null)}
                    className={`flex items-center space-x-1 font-bold ${
                      !selectedMes ? 'text-[var(--atlas-text)]' : 'text-[var(--atlas-navy)] hover:underline'
                    }`}
                  >
                    <Folder className="w-3.5 h-3.5 text-sky-600" />
                    <span>{selectedExercicio.nome}</span>
                  </button>
                </>
              )}

              {selectedMes && (
                <>
                  <span className="text-[var(--atlas-text-muted)]">/</span>
                  <span className="text-[var(--atlas-accent)] font-bold flex items-center space-x-1">
                    <FolderOpen className="w-3.5 h-3.5 text-[var(--atlas-accent)]" />
                    <span>{selectedMes.nome}</span>
                  </span>
                </>
              )}
            </div>

            {/* View Mode Toggle & Primary Actions */}
            <div className="flex items-center space-x-2 shrink-0">
              <div className="flex items-center bg-[var(--atlas-surface-hover)] p-0.5 rounded-lg border border-[var(--atlas-border)]">
                <button
                  onClick={() => setViewMode('tree')}
                  className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center space-x-1 transition-all ${
                    viewMode === 'tree' ? 'bg-[var(--atlas-surface)] text-[var(--atlas-navy)] shadow-xs' : 'text-[var(--atlas-text-secondary)] hover:text-[var(--atlas-text)]'
                  }`}
                  title="Visão de Árvore de Diretórios (Ano > Mês)"
                >
                  <ListTree className="w-3.5 h-3.5" />
                  <span>Árvore (Ano &gt; Mês)</span>
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center space-x-1 transition-all ${
                    viewMode === 'grid' ? 'bg-[var(--atlas-surface)] text-[var(--atlas-navy)] shadow-xs' : 'text-[var(--atlas-text-secondary)] hover:text-[var(--atlas-text)]'
                  }`}
                  title="Visão por Módulos e Cards"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Módulos</span>
                </button>
              </div>

              <button
                onClick={handleOpenSaveCurrentAudit}
                className="px-3 py-1.5 bg-[var(--atlas-accent)] hover:bg-[var(--atlas-accent-dark)] text-white rounded-lg text-xs font-semibold shadow-xs transition-colors flex items-center space-x-1.5"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>Arquivar Auditoria Atual</span>
              </button>

              <button
                onClick={() => loadPastasEArquivos(selectedCliente.id)}
                className="p-1.5 bg-[var(--atlas-surface)] text-[var(--atlas-text-secondary)] border border-[var(--atlas-border)] rounded-lg hover:bg-[var(--atlas-surface-hover)] transition-colors"
                title="Sincronizar com Firebase"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Client Identity Header Box */}
          <div className="bg-[var(--atlas-surface-hover)] p-3.5 rounded-xl border border-[var(--atlas-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div>
              <div className="text-xs font-semibold uppercase text-[var(--atlas-text-muted)]">Pasta Raiz do Cliente</div>
              <h2 className="text-sm font-bold text-[var(--atlas-text)] mt-0.5">
                {selectedCliente.nome} - {selectedCliente.cnpj}
              </h2>
              <div className="text-[var(--atlas-text-secondary)] space-x-3 mt-0.5 text-xs">
                <span>UF: <strong className="text-[var(--atlas-text-secondary)]">{selectedCliente.uf}</strong></span>
                <span>Regime: <strong className="text-[var(--atlas-text-secondary)]">{selectedCliente.regimeTributario}</strong></span>
                {selectedCliente.ie && <span>IE: <strong className="text-[var(--atlas-text-secondary)]">{selectedCliente.ie}</strong></span>}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {canManageEmpresas && (
                <>
                  <button
                    onClick={() => {
                      setEditingCliente(selectedCliente);
                      setShowClienteModal(true);
                    }}
                    className="p-1.5 bg-[var(--atlas-surface)] text-[var(--atlas-text-secondary)] border border-[var(--atlas-border)] rounded-lg hover:bg-[var(--atlas-surface-hover)] transition-colors flex items-center space-x-1 font-semibold"
                    title="Editar Cadastro da Empresa"
                  >
                    <Edit className="w-3.5 h-3.5 text-[var(--atlas-text-secondary)]" />
                    <span>Editar</span>
                  </button>
                  <button
                    onClick={() => handleDeleteClienteClick(selectedCliente)}
                    className="p-1.5 bg-[var(--atlas-surface)] text-rose-600 border border-[var(--atlas-border)] rounded-lg hover:bg-rose-50 hover:border-rose-300 transition-colors flex items-center space-x-1 font-semibold"
                    title="Excluir Cadastro da Empresa"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    <span>Excluir</span>
                  </button>
                </>
              )}

              {activeClienteId === selectedCliente.id ? (
                <span className="px-2.5 py-1 rounded bg-emerald-100 text-[var(--atlas-accent)] font-bold border border-emerald-200 flex items-center space-x-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Empresa Ativa na Sessão</span>
                </span>
              ) : (
                <button
                  onClick={() => {
                    setActiveClienteId(selectedCliente.id);
                    addNotification('Empresa Ativa', `Cliente "${selectedCliente.nome}" definido como ativo.`, 'system');
                  }}
                  className="px-3 py-1 bg-[var(--atlas-navy)] text-white rounded text-xs font-semibold hover:bg-[var(--atlas-navy-dark)]"
                >
                  Definir como Ativo
                </button>
              )}
            </div>
          </div>

          {/* ================= MODE 1: VISUALIZAÇÃO EM ÁRVORE HIERÁRQUICA (ANO > MÊS > ARQUIVOS) ================= */}
          {viewMode === 'tree' && (
            <div className="bg-[var(--atlas-surface)] rounded-xl border border-[var(--atlas-border)] overflow-hidden shadow-xs text-xs">
              <div className="bg-[var(--atlas-surface-hover)]/80 px-4 py-2.5 border-b border-[var(--atlas-border)] font-bold text-[var(--atlas-text-secondary)] flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <ListTree className="w-4 h-4 text-[var(--atlas-navy)]" />
                  <span>Estrutura de Diretórios Fiscais (Ano &gt; Mês &gt; Arquivos)</span>
                </div>
                <div className="flex items-center space-x-2 font-normal text-xs">
                  <button
                    onClick={() => {
                      const all: Record<string, boolean> = {};
                      pastas.forEach(p => { all[p.id] = true; });
                      setExpandedNodes(all);
                    }}
                    className="text-[var(--atlas-navy)] hover:underline"
                  >
                    Expandir Todos
                  </button>
                  <span className="text-[var(--atlas-text-muted)]">•</span>
                  <button
                    onClick={() => setExpandedNodes({})}
                    className="text-[var(--atlas-text-secondary)] hover:underline"
                  >
                    Recolher Todos
                  </button>
                </div>
              </div>

              <div className="p-4 space-y-2">
                {/* Root Node: Client Folder */}
                <div className="border border-[var(--atlas-border)] rounded-lg overflow-hidden">
                  <div className="bg-[var(--atlas-surface-hover)] px-3.5 py-2.5 flex items-center justify-between border-b border-[var(--atlas-border)]">
                    <div className="flex items-center space-x-2 font-bold text-[var(--atlas-text)]">
                      <FolderOpen className="w-4 h-4 text-amber-500 shrink-0" />
                      <span>{selectedCliente.nome} - {selectedCliente.cnpj}</span>
                    </div>
                    <span className="text-xs text-[var(--atlas-text-secondary)] font-semibold">{exerciciosPastas.length} Exercício(s)</span>
                  </div>

                  {/* Level 1 Nodes: Exercícios (Ano) */}
                  <div className="p-2 space-y-1 bg-[var(--atlas-surface)]">
                    {exerciciosPastas.map(exercicio => {
                      const isExercicioExpanded = !!expandedNodes[exercicio.id];
                      const subMeses = pastas.filter(p => p.parentId === exercicio.id);
                      
                      return (
                        <div key={exercicio.id} className="border border-[var(--atlas-border)] rounded-md">
                          {/* Exercício (Ano) Bar */}
                          <div
                            onClick={() => toggleTreeNode(exercicio.id)}
                            className="px-3 py-2 bg-[var(--atlas-surface-hover)]/60 hover:bg-[var(--atlas-surface-hover)]/70 transition-colors cursor-pointer flex items-center justify-between font-semibold text-[var(--atlas-text)]"
                          >
                            <div className="flex items-center space-x-2">
                              {isExercicioExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5 text-[var(--atlas-text-secondary)] shrink-0" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5 text-[var(--atlas-text-secondary)] shrink-0" />
                              )}
                              <Folder className="w-4 h-4 text-sky-600 shrink-0" />
                              <span>{exercicio.nome}</span>
                              <span className="text-xs font-normal text-[var(--atlas-text-muted)]">({subMeses.length} Meses)</span>
                            </div>

                            <span className="text-xs font-mono text-[var(--atlas-text-secondary)]">
                              {arquivos.filter(a => {
                                const mesIds = subMeses.map(m => m.id);
                                return a.pastaId === exercicio.id || (a.pastaId && mesIds.includes(a.pastaId));
                              }).length} arquivo(s)
                            </span>
                          </div>

                          {/* Level 2 Nodes: Meses */}
                          {isExercicioExpanded && (
                            <div className="pl-6 pr-2 py-1.5 space-y-1 bg-[var(--atlas-surface)] border-t border-[var(--atlas-border)]">
                              {subMeses.map(mes => {
                                const isMesExpanded = !!expandedNodes[mes.id];
                                const mesArquivos = arquivos.filter(a => a.pastaId === mes.id);

                                return (
                                  <div key={mes.id} className="border border-[var(--atlas-border)]/80 rounded">
                                    <div
                                      onClick={() => toggleTreeNode(mes.id)}
                                      className="px-2.5 py-1.5 hover:bg-[var(--atlas-surface-hover)] transition-colors cursor-pointer flex items-center justify-between text-xs font-medium text-[var(--atlas-text-secondary)]"
                                    >
                                      <div className="flex items-center space-x-2">
                                        {isMesExpanded ? (
                                          <ChevronDown className="w-3 h-3 text-[var(--atlas-text-muted)] shrink-0" />
                                        ) : (
                                          <ChevronRight className="w-3 h-3 text-[var(--atlas-text-muted)] shrink-0" />
                                        )}
                                        {isMesExpanded ? (
                                          <FolderOpen className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                        ) : (
                                          <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                        )}
                                        <span className="font-semibold">{mes.nome}</span>
                                      </div>

                                      <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                                        mesArquivos.length > 0 ? 'bg-emerald-50 text-[var(--atlas-accent)]' : 'text-[var(--atlas-text-muted)]'
                                      }`}>
                                        {mesArquivos.length} arquivo(s)
                                      </span>
                                    </div>

                                    {/* Level 3 Nodes: Arquivos Fiscais / Auditorias */}
                                    {isMesExpanded && (
                                      <div className="pl-6 pr-2 py-1 space-y-1 bg-[var(--atlas-surface-hover)]/50 border-t border-[var(--atlas-border)]">
                                        {mesArquivos.length === 0 ? (
                                          <div className="py-2 px-2 text-xs text-[var(--atlas-text-muted)] italic">
                                            Nenhum SPED ou XML gravado neste mês.
                                          </div>
                                        ) : (
                                          mesArquivos.map(arq => {
                                            const hasData = arq.dadosSped || (arq.xmlsTerceiros && arq.xmlsTerceiros.length > 0);

                                            return (
                                              <div
                                                key={arq.id}
                                                className="p-2 bg-[var(--atlas-surface)] border border-[var(--atlas-border)] rounded flex items-center justify-between text-xs hover:border-[var(--atlas-border)]"
                                              >
                                                <div className="flex items-center space-x-2 min-w-0 pr-2">
                                                  <FileText className="w-3.5 h-3.5 text-[var(--atlas-navy)] shrink-0" />
                                                  <div className="truncate">
                                                    <div className="font-semibold text-[var(--atlas-text)] truncate">{arq.nome}</div>
                                                    <div className="text-xs text-[var(--atlas-text-muted)] flex items-center space-x-2">
                                                      <span>{arq.tipo}</span>
                                                      <span>•</span>
                                                      <span>{arq.qtdDocumentos || 0} doc(s)</span>
                                                      <span>•</span>
                                                      <span>{new Date(arq.dataUpload).toLocaleDateString('pt-BR')}</span>
                                                    </div>
                                                  </div>
                                                </div>

                                                <div className="flex items-center space-x-1.5 shrink-0">
                                                  {hasData && (
                                                    <button
                                                      onClick={() => handleLoadAuditToWorkspace(arq)}
                                                      className="px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-[var(--atlas-accent)] border border-emerald-200 rounded text-xs font-bold flex items-center space-x-1"
                                                      title="Carregar no Auditor"
                                                    >
                                                      <Play className="w-3 h-3" />
                                                      <span>Carregar</span>
                                                    </button>
                                                  )}
                                                  <button
                                                    onClick={() => handleDeleteArquivoClick(arq)}
                                                    className="p-1 text-[var(--atlas-text-muted)] hover:text-rose-600 rounded hover:bg-rose-50"
                                                    title="Excluir do Firebase"
                                                  >
                                                    <Trash2 className="w-3 h-3" />
                                                  </button>
                                                </div>
                                              </div>
                                            );
                                          })
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= MODE 2: VISUALIZAÇÃO EM MÓDULOS (EXERCÍCIO & MESES) ================= */}
          {viewMode === 'grid' && (
            <div className="space-y-4">
              {/* Exercícios Level */}
              {!selectedExercicio && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-[var(--atlas-text-secondary)]">
                    <span className="flex items-center space-x-1.5">
                      <FolderTree className="w-4 h-4 text-[var(--atlas-navy)]" />
                      <span>Exercícios Fiscais ({exerciciosPastas.length})</span>
                    </span>
                    <span className="text-[var(--atlas-text-muted)] font-normal">Clique para ver a divisão por Mês</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {exerciciosPastas.map(exercicio => {
                      const subMesesCount = pastas.filter(p => p.parentId === exercicio.id).length;
                      const arqsCount = arquivos.filter(a => {
                        const mesIds = pastas.filter(p => p.parentId === exercicio.id).map(p => p.id);
                        return a.pastaId === exercicio.id || (a.pastaId && mesIds.includes(a.pastaId));
                      }).length;

                      return (
                        <div
                          key={exercicio.id}
                          onClick={() => setSelectedExercicio(exercicio)}
                          className="bg-[var(--atlas-surface)] p-4 rounded-xl border border-[var(--atlas-border)] hover:border-[var(--atlas-navy)] transition-all cursor-pointer group flex flex-col justify-between"
                        >
                          <div className="space-y-2">
                            <div className="flex items-center space-x-2.5">
                              <Folder className="w-5 h-5 text-sky-600 group-hover:text-[var(--atlas-navy)] shrink-0" />
                              <div>
                                <div className="font-bold text-sm text-[var(--atlas-text)] group-hover:text-[var(--atlas-navy)]">
                                  {exercicio.nome}
                                </div>
                                <div className="text-xs text-[var(--atlas-text-secondary)]">
                                  {exercicio.descricao || 'Exercício Fiscal'}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 pt-2.5 border-t border-[var(--atlas-border)] flex items-center justify-between text-xs text-[var(--atlas-text-secondary)] font-medium">
                            <span>{subMesesCount} Meses (01 a 12)</span>
                            <span className="text-[var(--atlas-accent)] font-semibold">{arqsCount} Arquivo(s)</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Meses Level */}
              {selectedExercicio && !selectedMes && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-[var(--atlas-text-secondary)]">
                    <span className="flex items-center space-x-2">
                      <button onClick={() => setSelectedExercicio(null)} className="text-[var(--atlas-navy)] hover:underline">
                        &larr; Voltar para Exercícios
                      </button>
                      <span>•</span>
                      <span>Competências Mensais de {selectedExercicio.nome}</span>
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
                    {mesesPastas.map(mes => {
                      const countArqs = arquivos.filter(a => a.pastaId === mes.id).length;

                      return (
                        <div
                          key={mes.id}
                          onClick={() => setSelectedMes(mes)}
                          className="bg-[var(--atlas-surface)] p-3 rounded-lg border border-[var(--atlas-border)] hover:border-emerald-600 hover:bg-emerald-50/20 transition-all cursor-pointer group flex flex-col justify-between"
                        >
                          <div className="flex items-center space-x-2">
                            <Folder className="w-4 h-4 text-amber-500 group-hover:text-emerald-600 shrink-0" />
                            <span className="font-bold text-xs text-[var(--atlas-text)] group-hover:text-emerald-800 truncate">
                              {mes.nome}
                            </span>
                          </div>

                          <div className="mt-2 text-xs text-[var(--atlas-text-secondary)] font-semibold flex items-center justify-between">
                            <span>{countArqs} arq(s)</span>
                            <ChevronRight className="w-3 h-3 text-[var(--atlas-text-muted)] group-hover:text-emerald-600" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* File Table for Grid Mode */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between text-xs font-bold text-[var(--atlas-text)]">
                  <span className="flex items-center space-x-1.5">
                    <HardDrive className="w-4 h-4 text-emerald-600" />
                    <span>
                      Arquivos Armazenados
                      {selectedMes ? ` (${selectedMes.nome})` : selectedExercicio ? ` (${selectedExercicio.nome})` : ' (Todos)'}
                    </span>
                  </span>

                  {selectedMes && (
                    <button
                      onClick={() => setSelectedMes(null)}
                      className="text-xs text-[var(--atlas-navy)] hover:underline font-normal"
                    >
                      Ver todos os meses de {selectedExercicio?.nome}
                    </button>
                  )}
                </div>

                {filteredArquivos.length === 0 ? (
                  <div className="bg-[var(--atlas-surface)] p-8 rounded-xl border border-dashed border-[var(--atlas-border)] text-center space-y-2">
                    <Cloud className="w-8 h-8 text-[var(--atlas-text-muted)] mx-auto" />
                    <p className="text-xs font-semibold text-[var(--atlas-text-secondary)]">
                      Nenhum arquivo gravado nesta pasta.
                    </p>
                    <button
                      onClick={handleOpenSaveCurrentAudit}
                      className="px-3 py-1.5 bg-[var(--atlas-accent)] text-white text-xs font-semibold rounded-lg hover:bg-[var(--atlas-accent-dark)] transition-colors inline-flex items-center space-x-1 mt-1"
                    >
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>Arquivar Sessão Atual do Auditor</span>
                    </button>
                  </div>
                ) : (
                  <div className="bg-[var(--atlas-surface)] rounded-xl border border-[var(--atlas-border)] shadow-xs overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[var(--atlas-surface-hover)] border-b border-[var(--atlas-border)] text-[var(--atlas-text-secondary)] font-semibold uppercase text-xs tracking-wider">
                        <tr>
                          <th className="py-2.5 px-4">Nome do Arquivo / Sessão</th>
                          <th className="py-2.5 px-4">Pasta de Destino</th>
                          <th className="py-2.5 px-4">Tipo</th>
                          <th className="py-2.5 px-4">Documentos</th>
                          <th className="py-2.5 px-4">Data de Gravação</th>
                          <th className="py-2.5 px-4 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--atlas-border)]">
                        {filteredArquivos.map(arq => {
                          const pastaObj = pastas.find(p => p.id === arq.pastaId);
                          const hasData = arq.dadosSped || (arq.xmlsTerceiros && arq.xmlsTerceiros.length > 0);

                          return (
                            <tr key={arq.id} className="hover:bg-[var(--atlas-surface-hover)]/80 transition-colors">
                              <td className="py-3 px-4 font-semibold text-[var(--atlas-text)]">
                                <div className="flex items-center space-x-2">
                                  <FileText className="w-4 h-4 text-[var(--atlas-navy)] shrink-0" />
                                  <div>
                                    <div>{arq.nome}</div>
                                    {arq.observacoes && (
                                      <div className="text-xs text-[var(--atlas-text-muted)] font-normal truncate max-w-xs">{arq.observacoes}</div>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-[var(--atlas-text-secondary)] font-mono text-xs">
                                {pastaObj ? pastaObj.nome : 'Pasta Geral'}
                              </td>
                              <td className="py-3 px-4">
                                <span className="px-2 py-0.5 rounded text-xs font-bold bg-[var(--atlas-surface-hover)] text-[var(--atlas-text-secondary)] border border-[var(--atlas-border)]">
                                  {arq.tipo}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-[var(--atlas-text-secondary)]">{arq.qtdDocumentos || '—'} doc(s)</td>
                              <td className="py-3 px-4 text-[var(--atlas-text-secondary)]">{new Date(arq.dataUpload).toLocaleDateString('pt-BR')}</td>
                              <td className="py-3 px-4 text-right">
                                <div className="flex items-center justify-end space-x-2">
                                  {hasData && (
                                    <button
                                      onClick={() => handleLoadAuditToWorkspace(arq)}
                                      className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-[var(--atlas-accent)] border border-emerald-200 rounded text-xs font-bold flex items-center space-x-1"
                                      title="Carregar no Auditor"
                                    >
                                      <Play className="w-3 h-3" />
                                      <span>Carregar na Tela</span>
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleDeleteArquivoClick(arq)}
                                    className="p-1 text-[var(--atlas-text-muted)] hover:text-rose-600 rounded hover:bg-rose-50"
                                    title="Excluir"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= MODAL NOVO CLIENTE ================= */}
      {showClienteModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--atlas-surface)] rounded-xl max-w-lg w-full shadow-sm border border-[var(--atlas-border)] overflow-hidden">
            <div className="bg-[var(--atlas-navy)] p-4 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm flex items-center space-x-2">
                <Building2 className="w-4 h-4 text-sky-400" />
                <span>{editingCliente?.id ? 'Editar Cliente' : 'Cadastrar Novo Cliente (Nome CNPJ)'}</span>
              </h3>
              <button onClick={() => setShowClienteModal(false)} className="text-[var(--atlas-text-muted)] hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveClienteForm} className="p-5 space-y-4 text-xs">
              {escritoriosList.length > 0 && (
                <div>
                  <label className="block font-semibold text-[var(--atlas-text-secondary)] mb-1">Escritório Vinculado *</label>
                  <select
                    value={editingCliente?.escritorioId || (selectedEscritorioFilter !== 'todos' ? selectedEscritorioFilter : (escritoriosList[0]?.id || 'padrao'))}
                    onChange={e => setEditingCliente(prev => ({ ...prev, escritorioId: e.target.value }))}
                    className="w-full px-3 py-2 border border-[var(--atlas-border)] rounded-lg bg-[var(--atlas-surface)] font-semibold text-[var(--atlas-text)] focus:outline-hidden focus:ring-1 focus:ring-[var(--atlas-navy)]"
                  >
                    {escritoriosList.map(esc => (
                      <option key={esc.id} value={esc.id}>{esc.nome} ({esc.cnpj || 'Sem CNPJ'})</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-semibold text-[var(--atlas-text-secondary)] mb-1">Razão Social / Nome da Empresa *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Comércio de Bebidas Matriz LTDA"
                  value={editingCliente?.nome || ''}
                  onChange={e => setEditingCliente(prev => ({ ...prev, nome: e.target.value }))}
                  className="w-full px-3 py-2 border border-[var(--atlas-border)] rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[var(--atlas-navy)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[var(--atlas-text-secondary)] mb-1">CNPJ *</label>
                  <input
                    type="text"
                    required
                    placeholder="00.000.000/0001-00"
                    value={editingCliente?.cnpj || ''}
                    onChange={e => setEditingCliente(prev => ({ ...prev, cnpj: formatCNPJ(e.target.value) }))}
                    className="w-full px-3 py-2 border border-[var(--atlas-border)] rounded-lg font-mono focus:outline-hidden focus:ring-1 focus:ring-[var(--atlas-navy)]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[var(--atlas-text-secondary)] mb-1">UF (Estado) *</label>
                  <select
                    value={editingCliente?.uf || 'SP'}
                    onChange={e => setEditingCliente(prev => ({ ...prev, uf: e.target.value }))}
                    className="w-full px-3 py-2 border border-[var(--atlas-border)] rounded-lg bg-[var(--atlas-surface)] focus:outline-hidden focus:ring-1 focus:ring-[var(--atlas-navy)]"
                  >
                    {UFS.map(uf => (
                      <option key={uf} value={uf}>{uf}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[var(--atlas-text-secondary)] mb-1">Regime Tributário *</label>
                  <select
                    value={editingCliente?.regimeTributario || 'Lucro Real'}
                    onChange={e => setEditingCliente(prev => ({ ...prev, regimeTributario: e.target.value as RegimeTributario }))}
                    className="w-full px-3 py-2 border border-[var(--atlas-border)] rounded-lg bg-[var(--atlas-surface)] font-semibold text-[var(--atlas-accent)] focus:outline-hidden focus:ring-1 focus:ring-[var(--atlas-navy)]"
                  >
                    {REGIMES.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[var(--atlas-text-secondary)] mb-1">Inscrição Estadual (IE)</label>
                  <input
                    type="text"
                    placeholder="Inscrição Estadual"
                    value={editingCliente?.ie || ''}
                    onChange={e => setEditingCliente(prev => ({ ...prev, ie: e.target.value }))}
                    className="w-full px-3 py-2 border border-[var(--atlas-border)] rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[var(--atlas-navy)]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[var(--atlas-text-secondary)] mb-1">E-mail de Contato</label>
                  <input
                    type="email"
                    placeholder="fiscal@empresa.com.br"
                    value={editingCliente?.email || ''}
                    onChange={e => setEditingCliente(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-3 py-2 border border-[var(--atlas-border)] rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[var(--atlas-navy)]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[var(--atlas-text-secondary)] mb-1">Telefone</label>
                  <input
                    type="text"
                    placeholder="(11) 3456-7890"
                    value={editingCliente?.telefone || ''}
                    onChange={e => setEditingCliente(prev => ({ ...prev, telefone: e.target.value }))}
                    className="w-full px-3 py-2 border border-[var(--atlas-border)] rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[var(--atlas-navy)]"
                  />
                </div>
              </div>

              {!editingCliente?.id && (
                <div className="p-3 bg-[var(--atlas-surface-hover)] border border-[var(--atlas-border)] rounded-lg space-y-2">
                  <div className="font-bold text-[var(--atlas-text)] flex items-center space-x-1.5">
                    <FolderTree className="w-4 h-4 text-[var(--atlas-navy)]" />
                    <span>Gerar Estrutura Padrão de Pastas Fiscais</span>
                  </div>
                  <p className="text-xs text-[var(--atlas-text-secondary)]">
                    Criação automática de <strong>{editingCliente?.nome || 'Nome'} - {editingCliente?.cnpj || 'CNPJ'}</strong> com Exercícios e 12 competências mensais.
                  </p>
                  <div className="flex items-center space-x-4 pt-1">
                    {['2026', '2025', '2024'].map(ano => (
                      <label key={ano} className="flex items-center space-x-1.5 cursor-pointer font-semibold text-[var(--atlas-navy)]">
                        <input
                          type="checkbox"
                          checked={selectedAnosParaCriar.includes(ano)}
                          onChange={e => {
                            if (e.target.checked) setSelectedAnosParaCriar(prev => [...prev, ano]);
                            else setSelectedAnosParaCriar(prev => prev.filter(a => a !== ano));
                          }}
                          className="rounded border-[var(--atlas-border)] text-[var(--atlas-navy)]"
                        />
                        <span>Exercício {ano}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-[var(--atlas-border)] flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowClienteModal(false)}
                  className="px-3.5 py-1.5 bg-[var(--atlas-surface-hover)] hover:bg-[var(--atlas-border)] text-[var(--atlas-text-secondary)] rounded-lg font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[var(--atlas-navy)] hover:bg-[var(--atlas-navy-dark)] text-white rounded-lg font-semibold shadow-xs"
                >
                  Salvar Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL SALVAR AUDITORIA NA PASTA ================= */}
      {showSaveAuditModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--atlas-surface)] rounded-xl max-w-md w-full shadow-sm border border-[var(--atlas-border)] overflow-hidden">
            <div className="bg-[var(--atlas-accent)] p-4 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm flex items-center space-x-2">
                <UploadCloud className="w-4 h-4 text-emerald-200" />
                <span>Arquivar Auditoria no Firebase</span>
              </h3>
              <button onClick={() => setShowSaveAuditModal(false)} className="text-slate-200 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmSaveAudit} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-[var(--atlas-text-secondary)] mb-1">Cliente Selecionado</label>
                <div className="p-2.5 bg-[var(--atlas-surface-hover)] rounded-lg font-bold text-[var(--atlas-text)]">
                  {selectedCliente?.nome} - {selectedCliente?.cnpj}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[var(--atlas-text-secondary)] mb-1">Selecione o Exercício Fiscal *</label>
                <select
                  required
                  value={targetExercicioId}
                  onChange={e => {
                    setTargetExercicioId(e.target.value);
                    setTargetMesId('');
                  }}
                  className="w-full px-3 py-2 border border-[var(--atlas-border)] rounded-lg bg-[var(--atlas-surface)] font-semibold text-[var(--atlas-navy)]"
                >
                  <option value="">Selecione o Exercício...</option>
                  {exerciciosPastas.map(ex => (
                    <option key={ex.id} value={ex.id}>{ex.nome}</option>
                  ))}
                </select>
              </div>

              {targetExercicioId && (
                <div>
                  <label className="block font-semibold text-[var(--atlas-text-secondary)] mb-1">Selecione a Competência / Mês *</label>
                  <select
                    required
                    value={targetMesId}
                    onChange={e => setTargetMesId(e.target.value)}
                    className="w-full px-3 py-2 border border-[var(--atlas-border)] rounded-lg bg-[var(--atlas-surface)] font-semibold text-[var(--atlas-accent)]"
                  >
                    <option value="">Selecione o Mês...</option>
                    {pastas.filter(p => p.parentId === targetExercicioId).map(mes => (
                      <option key={mes.id} value={mes.id}>{mes.nome}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-semibold text-[var(--atlas-text-secondary)] mb-1">Identificação / Nome do Arquivo *</label>
                <input
                  type="text"
                  required
                  value={saveAuditNome}
                  onChange={e => setSaveAuditNome(e.target.value)}
                  className="w-full px-3 py-2 border border-[var(--atlas-border)] rounded-lg font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-[var(--atlas-text-secondary)] mb-1">Observações de Registro</label>
                <textarea
                  rows={2}
                  placeholder="Ex: Ref. Reentrega de SPED com Bloco H ajustado..."
                  value={saveAuditObs}
                  onChange={e => setSaveAuditObs(e.target.value)}
                  className="w-full px-3 py-2 border border-[var(--atlas-border)] rounded-lg"
                />
              </div>

              <div className="pt-3 border-t border-[var(--atlas-border)] flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowSaveAuditModal(false)}
                  className="px-3.5 py-1.5 bg-[var(--atlas-surface-hover)] hover:bg-[var(--atlas-border)] text-[var(--atlas-text-secondary)] rounded-lg font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[var(--atlas-accent)] hover:bg-[var(--atlas-accent-dark)] text-white rounded-lg font-semibold shadow-xs"
                >
                  Gravar no Firebase
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL DE CONFIRMAÇÃO DECLARATIVO E PROFISSIONAL ================= */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--atlas-surface)] rounded-xl max-w-md w-full border border-[var(--atlas-border)] overflow-hidden shadow-sm animate-scaleIn">
            <div className={`p-4 text-white flex items-center justify-between ${
              confirmModal.variant === 'danger' ? 'bg-rose-700' :
              confirmModal.variant === 'warning' ? 'bg-amber-700' : 'bg-[var(--atlas-navy)]'
            }`}>
              <h3 className="font-bold text-sm flex items-center space-x-2">
                {confirmModal.variant === 'danger' ? (
                  <AlertCircle className="w-4 h-4 text-rose-200" />
                ) : confirmModal.variant === 'warning' ? (
                  <AlertTriangle className="w-4 h-4 text-amber-200" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-sky-200" />
                )}
                <span>{confirmModal.title}</span>
              </h3>
              <button 
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="text-white/80 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs">
              <p className="font-semibold text-[var(--atlas-text)] leading-relaxed">
                {confirmModal.message}
              </p>

              {confirmModal.detail && (
                <div className="p-3 bg-[var(--atlas-surface-hover)] border border-[var(--atlas-border)] rounded-lg text-[var(--atlas-text-secondary)] font-mono text-xs">
                  {confirmModal.detail}
                </div>
              )}

              <div className="pt-3 border-t border-[var(--atlas-border)] flex items-center justify-end space-x-2.5">
                <button
                  type="button"
                  onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                  className="px-3.5 py-1.5 bg-[var(--atlas-surface-hover)] hover:bg-[var(--atlas-border)] text-[var(--atlas-text-secondary)] font-semibold rounded-lg transition-colors"
                >
                  {confirmModal.cancelLabel}
                </button>

                <button
                  type="button"
                  onClick={() => confirmModal.onConfirm()}
                  className={`px-4 py-1.5 text-white font-semibold rounded-lg shadow-xs transition-colors ${
                    confirmModal.variant === 'danger' ? 'bg-rose-600 hover:bg-rose-700' :
                    confirmModal.variant === 'warning' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-[var(--atlas-navy)] hover:bg-[var(--atlas-navy-dark)]'
                  }`}
                >
                  {confirmModal.confirmLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL IMPORTAÇÃO DE EMPRESAS EM LOTE ================= */}
      <CompanyImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportComplete={loadClientesAndEscritorios}
        addNotification={addNotification}
        escritorioId={effectiveEscritorioId}
        existingClientes={clientes}
        userPapel={userData?.papel}
      />
    </div>
  );
}
