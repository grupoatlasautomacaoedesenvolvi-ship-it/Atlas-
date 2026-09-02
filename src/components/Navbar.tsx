import React, { useState, useEffect, useMemo } from 'react';
import { 
  Shield, 
  FileText, 
  Settings, 
  Database, 
  BarChart3, 
  Archive, 
  Layers, 
  ListOrdered, 
  LogOut, 
  Calculator, 
  Search, 
  TrendingUp, 
  Boxes,
  ChevronDown,
  ChevronRight,
  Sliders,
  User,
  Users,
  FileSpreadsheet,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Globe,
  Building2,
  Bot, 
  Activity,
  LayoutDashboard,
  BrainCircuit,
  Cloud,
  Upload,
  Download
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { backupLocalStorageToCloud, restoreLocalStorageFromCloud } from '../lib/syncBackupService';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  hasSped: boolean;
  hasXmlTerceiros: boolean;
  hasXmlProprio: boolean;
  hasXmlNfce: boolean;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  iconColor: string;
  category: 'inicio' | 'sped' | 'estoque' | 'consultas' | 'admin';
  badge?: { text: string; color: string };
  requiresSped?: boolean;
}

export function Navbar({ activeTab, setActiveTab, hasSped, hasXmlTerceiros, hasXmlProprio, hasXmlNfce }: NavbarProps) {
  const { signOut, userData } = useAuth();

  // Navigation States
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  // Accordion state for modules
  const [openSped, setOpenSped] = useState(true);
  const [openEstoque, setOpenEstoque] = useState(true);
  const [openConsultas, setOpenConsultas] = useState(true);
  const [openConfig, setOpenConfig] = useState(false);

  const handleManualBackup = async () => {
    setSyncing(true);
    setSyncMsg('Enviando backup...');
    try {
      const res = await backupLocalStorageToCloud(userData?.escritorioId);
      if (res.success) {
        setSyncMsg(`Sincronizado às ${res.timestamp}`);
      } else {
        setSyncMsg('Erro no backup');
      }
    } catch {
      setSyncMsg('Erro de conexão');
    }
    setSyncing(false);
    setTimeout(() => setSyncMsg(null), 4000);
  };

  const handleManualRestore = async () => {
    if (!confirm('Deseja restaurar os dados salvos no Firestore para este navegador?')) return;
    setSyncing(true);
    try {
      const res = await restoreLocalStorageFromCloud(userData?.escritorioId);
      if (res.success) {
        alert(`Restaurado com sucesso! ${res.restoredKeysCount} chaves carregadas. Recarregando...`);
        window.location.reload();
      } else {
        alert('Nenhum backup encontrado na nuvem.');
      }
    } catch {
      alert('Erro ao restaurar da nuvem.');
    }
    setSyncing(false);
  };

  // Auto-expand module containing active tab
   useEffect(() => {
    if (['clientes', 'robo_fiscal', 'robo_dashboard', 'aprendizado', 'upload', 'sped_raw', 'xml_terceiros', 'xml_proprio', 'xml_nfce', 'advanced_audit', 'all_items', 'sequence_gaps', 'omissas', 'reports'].includes(activeTab)) {
      setOpenSped(true);
    } else if (['stock_engineering'].includes(activeTab)) {
      setOpenEstoque(true);
    } else if (['state_tax_matrix', 'ncm_lookup', 'difal_calculator', 'regime_simulator'].includes(activeTab)) {
      setOpenConsultas(true);
    } else if (['config', 'settings', 'admin_panel', 'user_management'].includes(activeTab)) {
      setOpenConfig(true);
    }
  }, [activeTab]);

  // All navigation items definition with RBAC role filtering
  const navItems: NavItem[] = useMemo(() => {
    const papel = userData?.papel;
    const isSuperAdmin = papel === 'super_admin';
    const isAdminEscritorio = papel === 'admin_escritorio';

    const items: NavItem[] = [
      // INÍCIO / PAINEL GERAL
      { id: 'home', label: 'Painel Inicial', icon: LayoutDashboard, iconColor: 'text-[#1e3a5f]', category: 'inicio', badge: { text: 'Início', color: 'bg-[#f1efe8] text-[#1e3a5f] border border-[#e5e2d9]' } },
      { id: 'minhas_rotinas', label: 'Minhas Rotinas', icon: CheckCircle2, iconColor: 'text-[#0f6e56]', category: 'inicio' },

      // CLIENTES & PASTA & ROBÔ
      { id: 'clientes', label: 'Clientes & Pastas', icon: Building2, iconColor: 'text-[#0f6e56]', category: 'sped', badge: { text: 'Nuvem', color: 'bg-emerald-100 text-[#0f6e56] border border-emerald-200' } },
      { id: 'robo_fiscal', label: 'Robô Fiscal IA', icon: Bot, iconColor: 'text-[#1e3a5f]', category: 'sped', badge: { text: 'Automação', color: 'bg-sky-100 text-[#1e3a5f] border border-sky-200' } },
      { id: 'aprendizado', label: 'Aprendizado & Aprovações', icon: BrainCircuit, iconColor: 'text-[#0f6e56]', category: 'sped', badge: { text: 'Auditor', color: 'bg-emerald-100 text-[#0f6e56] border border-emerald-200' } },
      { id: 'ai_orchestrator', label: 'Projeto A.R.C.A. (Orquestrador)', icon: BrainCircuit, iconColor: 'text-[#1e3a5f]', category: 'sped', badge: { text: 'Multi-IA', color: 'bg-[#f1efe8] text-[#1e3a5f] border border-[#e5e2d9]' } },
      
      // SPED
      { id: 'upload', label: 'Importação Fiscal', icon: FileText, iconColor: 'text-slate-500', category: 'sped', badge: hasSped ? { text: 'Ativo', color: 'bg-emerald-100 text-[#0f6e56] border border-emerald-200' } : undefined },
      { id: 'advanced_audit', label: 'Central de Auditoria', icon: BarChart3, iconColor: 'text-slate-500', category: 'sped', requiresSped: true },
      { id: 'all_items', label: 'Itens C170', icon: Layers, iconColor: 'text-slate-500', category: 'sped', requiresSped: true },
      { id: 'sequence_gaps', label: 'Quebra de Sequência', icon: ListOrdered, iconColor: 'text-amber-600', category: 'sped', requiresSped: true },
      { id: 'omissas', label: 'Notas Omissas', icon: FileText, iconColor: 'text-rose-600', category: 'sped' },
      { id: 'sped_raw', label: 'Arquivo SPED Bruto', icon: Database, iconColor: 'text-slate-500', category: 'sped', requiresSped: true },
      { id: 'reports', label: 'Relatório Final', icon: FileSpreadsheet, iconColor: 'text-slate-500', category: 'sped', requiresSped: true },
      ...(hasXmlTerceiros ? [{ id: 'xml_terceiros', label: 'XML Terceiros', icon: Archive, iconColor: 'text-amber-600', category: 'sped' as const, badge: { text: 'XML', color: 'bg-amber-100 text-amber-800' } }] : []),
      ...(hasXmlProprio ? [{ id: 'xml_proprio', label: 'XML Próprio', icon: Archive, iconColor: 'text-slate-500', category: 'sped' as const, badge: { text: 'XML', color: 'bg-slate-100 text-slate-700' } }] : []),
      ...(hasXmlNfce ? [{ id: 'xml_nfce', label: 'XML NFC-e', icon: Archive, iconColor: 'text-emerald-600', category: 'sped' as const, badge: { text: 'NFCe', color: 'bg-emerald-100 text-[#0f6e56]' } }] : []),

      // ESTOQUE
      { id: 'stock_engineering', label: 'Estoque & Bloco H', icon: Boxes, iconColor: 'text-emerald-600', category: 'estoque', badge: { text: 'Bloco H', color: 'bg-emerald-100 text-[#0f6e56] border border-emerald-200' } },

      // CONSULTAS
      { id: 'state_tax_matrix', label: 'Matriz Tributária UF/NCM', icon: Database, iconColor: 'text-slate-500', category: 'consultas' },
      { id: 'ncm_lookup', label: 'Consulta NCM', icon: Search, iconColor: 'text-slate-500', category: 'consultas' },
      { id: 'difal_calculator', label: 'Calculadora DIFAL', icon: Calculator, iconColor: 'text-slate-500', category: 'consultas' },
      { id: 'regime_simulator', label: 'Simulador de Regime', icon: TrendingUp, iconColor: 'text-emerald-600', category: 'consultas' },
    ];

    // CONFIG & ADMIN (Restricted by role - adm e super_admin)
    if (isSuperAdmin || isAdminEscritorio) {
      items.push({ id: 'config', label: 'Regras de Auditoria', icon: Sliders, iconColor: 'text-slate-500', category: 'admin' });
      items.push({ id: 'user_management', label: 'Gestão de Usuários (RBAC)', icon: Users, iconColor: 'text-emerald-600', category: 'admin', badge: { text: 'RBAC', color: 'bg-emerald-100 text-emerald-800 border border-emerald-200' } });
      items.push({ id: 'admin_panel', label: 'Painel & Relatórios (ADM)', icon: Shield, iconColor: 'text-[#1e3a5f]', category: 'admin', badge: { text: 'ADM', color: 'bg-[#f1efe8] text-[#1e3a5f] border border-[#e5e2d9]' } });
    }

    return items;
  }, [hasSped, hasXmlTerceiros, hasXmlProprio, hasXmlNfce, userData?.papel]);

  // Search filtering
  const filteredNavItems = useMemo(() => {
    if (!searchQuery.trim()) return navItems;
    const q = searchQuery.toLowerCase();
    return navItems.filter(item => 
      item.label.toLowerCase().includes(q) || 
      item.id.toLowerCase().includes(q)
    );
  }, [navItems, searchQuery]);

  const renderNavButton = (item: NavItem) => {
    if (item.requiresSped && !hasSped) return null;
    
    const isActive = activeTab === item.id;
    const Icon = item.icon;

    if (isCollapsed) {
      return (
        <div key={item.id} className="relative group flex justify-center">
          <button
            onClick={() => setActiveTab(item.id)}
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200 ${
              isActive
                ? 'bg-[#1e3a5f] text-white shadow-2xs'
                : 'text-slate-600 hover:bg-white hover:text-slate-900 border border-transparent hover:border-[#e5e2d9]'
            }`}
          >
            <Icon className={`w-4 h-4 ${isActive ? 'text-white' : item.iconColor}`} />
          </button>

          {/* Floating Tooltip */}
          <div className="absolute left-full ml-3 px-3 py-1.5 bg-[#142c47] border border-slate-700 rounded-lg text-xs font-semibold text-white whitespace-nowrap shadow-sm z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center space-x-2">
            <span>{item.label}</span>
            {item.badge && (
              <span className={`px-1.5 py-0.2 text-[9px] font-mono rounded ${item.badge.color}`}>
                {item.badge.text}
              </span>
            )}
          </div>
        </div>
      );
    }

    return (
      <button
        key={item.id}
        onClick={() => setActiveTab(item.id)}
        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 group relative ${
          isActive
            ? 'bg-[#1e3a5f] text-white font-semibold shadow-2xs'
            : 'text-slate-600 hover:bg-white hover:text-slate-900 border border-transparent hover:border-[#e5e2d9]/80'
        }`}
      >
        {/* Active Pill Indicator */}
        {isActive && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 bg-[#0f6e56] rounded-r" />
        )}

        <div className="flex items-center space-x-2.5 truncate">
          <Icon className={`w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-110 ${isActive ? 'text-white' : item.iconColor}`} />
          <span className="truncate">{item.label}</span>
        </div>

        {item.badge && (
          <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded-md font-mono shrink-0 ml-1.5 ${item.badge.color}`}>
            {item.badge.text}
          </span>
        )}
      </button>
    );
  };

  return (
    <aside className={`${isCollapsed ? 'w-16' : 'w-64'} bg-[var(--atlas-bg)] border-r border-[var(--atlas-border)] text-slate-800 flex flex-col h-screen overflow-hidden shrink-0 select-none transition-all duration-300 ease-in-out relative z-30`}>
      {/* Brand Header */}
      <div className={`py-3 px-3 border-b border-[var(--atlas-border)] flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} bg-white/80 backdrop-blur-xs`}>
        {!isCollapsed ? (
          <div className="flex items-center min-w-0 pr-1">
            <img src="/logo.svg" alt="Atlas Auditor Fiscal" className="h-[66px] w-auto max-w-[212px] object-contain" />
          </div>
        ) : (
          <img src="/favicon.svg" alt="Atlas Auditor Fiscal" className="w-10 h-10 rounded-lg shadow-2xs object-contain shrink-0" title="Atlas Auditor Fiscal" />
        )}

        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/50 transition-colors shrink-0"
          title={isCollapsed ? 'Expandir Menu' : 'Recolher Menu'}
        >
          {isCollapsed ? <PanelLeftOpen className="w-4 h-4 text-slate-600" /> : <PanelLeftClose className="w-4 h-4 text-slate-500" />}
        </button>
      </div>

      {/* SPED Status Pill Header (When expanded) */}
      {!isCollapsed && (
        <div className="px-3 pt-3">
          <div className={`p-2.5 rounded-lg border flex items-center justify-between text-xs ${
            hasSped 
              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900' 
              : 'bg-white border-[#e5e2d9] text-slate-600 shadow-2xs'
          }`}>
            <div className="flex items-center space-x-2 truncate">
              {hasSped ? (
                <CheckCircle2 className="w-4 h-4 text-[#0f6e56] shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-slate-400 shrink-0" />
              )}
              <div className="truncate">
                <p className="font-semibold text-[11px] leading-tight">
                  {hasSped ? 'SPED Fiscal Importado' : 'Aguardando Arquivo'}
                </p>
                <p className="text-[10px] text-slate-500 truncate">
                  {hasSped ? 'Pronto para auditoria' : 'Importe no Módulo 1'}
                </p>
              </div>
            </div>
            {hasSped && (
              <span className="flex h-2 w-2 relative shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Quick Search Bar (When expanded) */}
      {!isCollapsed && (
        <div className="px-3 pt-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar funcionalidade..."
              className="w-full bg-white border border-[#e5e2d9] rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#1e3a5f] focus:ring-1 focus:ring-[#1e3a5f] transition-all shadow-2xs"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Navigation Scrollable Area */}
      <div className="flex-1 px-2 py-3 space-y-3 overflow-y-auto custom-scrollbar">

        {/* SEARCH FILTER MODE */}
        {searchQuery.trim() ? (
          <div className="space-y-1">
            <p className="px-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              Resultados ({filteredNavItems.length})
            </p>
            {filteredNavItems.length > 0 ? (
              filteredNavItems.map(renderNavButton)
            ) : (
              <p className="px-2 py-3 text-xs text-slate-400 text-center">Nenhum resultado encontrado</p>
            )}
          </div>
        ) : (
          /* STANDARD ACCORDION GROUPS */
          <>
            {/* PAINEL INICIAL */}
            <div className="space-y-1 pb-1">
              {navItems.filter(i => i.category === 'inicio').map(renderNavButton)}
            </div>

            {/* SEÇÃO 1: AUDITORIA & SPED FISCAL */}
            <div className="space-y-1">
              {!isCollapsed ? (
                <button
                  onClick={() => setOpenSped(!openSped)}
                  className="w-full flex items-center justify-between px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-700 transition-colors"
                >
                  <div className="flex items-center space-x-1.5">
                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                    <span>Conferência SPED</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    {openSped ? (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </div>
                </button>
              ) : (
                <div className="w-full h-px bg-[#e5e2d9] my-2" />
              )}

              {(openSped || isCollapsed) && (
                <div className={!isCollapsed ? "pl-1 space-y-1 pt-0.5 border-l border-[#e5e2d9] ml-3" : "space-y-2"}>
                  {navItems.filter(i => i.category === 'sped').map(renderNavButton)}
                </div>
              )}
            </div>

            {/* SEÇÃO 2: GESTÃO & ENGENHARIA DE ESTOQUE */}
            <div className="space-y-1 pt-1">
              {!isCollapsed ? (
                <button
                  onClick={() => setOpenEstoque(!openEstoque)}
                  className="w-full flex items-center justify-between px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-700 transition-colors"
                >
                  <div className="flex items-center space-x-1.5">
                    <Boxes className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Gestão de Estoque</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    {openEstoque ? (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </div>
                </button>
              ) : (
                <div className="w-full h-px bg-[#e5e2d9] my-2" />
              )}

              {(openEstoque || isCollapsed) && (
                <div className={!isCollapsed ? "pl-1 space-y-1 pt-0.5 border-l border-[#e5e2d9] ml-3" : "space-y-2"}>
                  {navItems.filter(i => i.category === 'estoque').map(renderNavButton)}
                </div>
              )}
            </div>

            {/* SEÇÃO 3: CONSULTAS & INTELIGÊNCIA FISCAL */}
            <div className="space-y-1 pt-1">
              {!isCollapsed ? (
                <button
                  onClick={() => setOpenConsultas(!openConsultas)}
                  className="w-full flex items-center justify-between px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-700 transition-colors"
                >
                  <div className="flex items-center space-x-1.5">
                    <Search className="w-3.5 h-3.5 text-slate-400" />
                    <span>Consultas & Simulação</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    {openConsultas ? (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </div>
                </button>
              ) : (
                <div className="w-full h-px bg-[#e5e2d9] my-2" />
              )}

              {(openConsultas || isCollapsed) && (
                <div className={!isCollapsed ? "pl-1 space-y-1 pt-0.5 border-l border-[#e5e2d9] ml-3" : "space-y-2"}>
                  {navItems.filter(i => i.category === 'consultas').map(renderNavButton)}
                </div>
              )}
            </div>

            {/* SEÇÃO 4: CONFIGURAÇÕES & ADMIN */}
            <div className="space-y-1 pt-1">
              {!isCollapsed ? (
                <button
                  onClick={() => setOpenConfig(!openConfig)}
                  className="w-full flex items-center justify-between px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-700 transition-colors"
                >
                  <div className="flex items-center space-x-1.5">
                    <Settings className="w-3.5 h-3.5 text-slate-400" />
                    <span>Regras & Sistema</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    {openConfig ? (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </div>
                </button>
              ) : (
                <div className="w-full h-px bg-[#e5e2d9] my-2" />
              )}

              {(openConfig || isCollapsed) && (
                <div className={!isCollapsed ? "pl-1 space-y-1 pt-0.5 border-l border-[#e5e2d9] ml-3" : "space-y-2"}>
                  {navItems.filter(i => i.category === 'admin').map(renderNavButton)}
                </div>
              )}
            </div>
          </>
        )}

      </div>

      {/* Footer User Info & Actions */}
      <div className="p-2.5 border-t border-[#e5e2d9] bg-white/60 space-y-2 shrink-0">
        {!isCollapsed ? (
          <>
            {/* User Card */}
            <div className="p-2 rounded-lg bg-white border border-[#e5e2d9] shadow-2xs space-y-1.5">
              <div className="flex items-center space-x-2.5 min-w-0">
                <div className="w-7 h-7 rounded-md bg-[#1e3a5f] text-white flex items-center justify-center shrink-0 font-bold text-xs">
                  <User className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-800 truncate">
                    {userData?.nome || 'Usuário Auditor'}
                  </p>
                  <p className="text-[10px] text-slate-500 truncate">
                    {userData?.papel === 'super_admin' ? 'Super Administrador' : 'Auditor Fiscal'}
                  </p>
                </div>
              </div>

              {/* Escritório Badge */}
              <div className="pt-1 border-t border-slate-100 flex items-center space-x-1.5 text-[10px] text-slate-600 font-medium">
                <Building2 className="w-3 h-3 text-[#1e3a5f] shrink-0" />
                <span className="truncate">
                  {userData?.escritorioId ? `Escritório: ${userData.escritorioId}` : 'Escritório Modelo Contabilidade'}
                </span>
              </div>
            </div>

            {/* Cloud Backup & Sync Badge/Buttons */}
            <div className="p-2 rounded-lg bg-indigo-50/60 border border-indigo-100 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-semibold text-indigo-900">
                <span className="flex items-center gap-1">
                  <Cloud className="w-3.5 h-3.5 text-indigo-600 animate-pulse" />
                  <span>Backup Firestore</span>
                </span>
                {syncMsg && <span className="text-[10px] text-indigo-700 font-bold">{syncMsg}</span>}
              </div>
              <div className="grid grid-cols-2 gap-1">
                <button
                  onClick={handleManualBackup}
                  disabled={syncing}
                  className="flex items-center justify-center space-x-1 px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[10px] font-bold shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                  title="Salvar backup imediato na nuvem"
                >
                  <Upload className="w-3 h-3" />
                  <span>Salvar</span>
                </button>
                <button
                  onClick={handleManualRestore}
                  disabled={syncing}
                  className="flex items-center justify-center space-x-1 px-2 py-1 bg-white hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded text-[10px] font-bold transition-colors cursor-pointer disabled:opacity-50"
                  title="Restaurar dados do Firestore"
                >
                  <Download className="w-3 h-3" />
                  <span>Restaurar</span>
                </button>
              </div>
            </div>

            {/* Bottom Action Buttons */}
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => setActiveTab('settings')}
                className={`flex items-center justify-center space-x-1.5 px-2 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'settings' 
                    ? 'bg-[#1e3a5f] text-white font-bold shadow-2xs' 
                    : 'bg-white hover:bg-slate-100 text-slate-700 border border-[#e5e2d9]'
                }`}
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Ajustes</span>
              </button>

              <button
                onClick={signOut}
                className="flex items-center justify-center space-x-1.5 px-2 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-[#e5e2d9] hover:border-rose-200 transition-all"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-600" />
                <span>Sair</span>
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center space-y-2">
            <button
              onClick={() => setActiveTab('settings')}
              className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                activeTab === 'settings' ? 'bg-[#1e3a5f] text-white' : 'text-slate-600 hover:bg-white hover:text-slate-900 border border-transparent hover:border-[#e5e2d9]'
              }`}
              title="Configurações"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={signOut}
              className="w-10 h-10 rounded-lg flex items-center justify-center text-slate-600 hover:bg-rose-50 hover:text-rose-700 transition-all"
              title="Sair da Conta"
            >
              <LogOut className="w-4 h-4 text-rose-600" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}


