import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  UserPlus, 
  Shield, 
  Building2, 
  Search, 
  Filter, 
  RefreshCw, 
  Key, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  Copy, 
  Check, 
  Crown, 
  AlertTriangle,
  Send,
  UserCheck,
  Lock,
  Clock,
  Activity,
  Calendar,
  Timer,
  BarChart3,
  Target
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { useAuth } from '../lib/auth';
import { UserHierarchyCard } from './UserHierarchyCard';
import { fetchMetaProdutividade, saveMetaProdutividade } from '../lib/metaProdutividadeService';

export interface UsuarioItem {
  id: string;
  uid: string;
  email: string;
  nome: string;
  papel: 'super_admin' | 'admin_escritorio' | 'colaborador';
  escritorioId: string;
  escritorioNome?: string;
  ativo: boolean;
  convidadoPor?: string;
}

export interface EscritorioItem {
  id: string;
  nome: string;
  cnpj?: string;
}

export function UserManagementView() {
  const { userData, token, getIdToken } = useAuth();
  
  const isSuperAdmin = userData?.papel === 'super_admin';
  const isAdminEscritorio = userData?.papel === 'admin_escritorio';
  const isAllowed = isSuperAdmin || isAdminEscritorio;

  // States
  const [usuariosList, setUsuariosList] = useState<UsuarioItem[]>([]);
  const [escritoriosList, setEscritoriosList] = useState<EscritorioItem[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPapel, setFilterPapel] = useState<string>('todos');
  const [filterEscritorio, setFilterEscritorio] = useState<string>('todos');

  // Invite Form State
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteNome, setInviteNome] = useState('');
  const [inviteSenha, setInviteSenha] = useState('');
  const [invitePapel, setInvitePapel] = useState<'colaborador' | 'admin_escritorio' | 'super_admin'>('colaborador');
  const [inviteEscritorioId, setInviteEscritorioId] = useState('');
  const [submittingInvite, setSubmittingInvite] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Editing User Modal/State
  const [editingUser, setEditingUser] = useState<UsuarioItem | null>(null);
  const [editNome, setEditNome] = useState('');
  const [editPapel, setEditPapel] = useState<'colaborador' | 'admin_escritorio' | 'super_admin'>('colaborador');
  const [editEscritorioId, setEditEscritorioId] = useState('');
  const [editAtivo, setEditAtivo] = useState(true);
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // Usage Events & Period State for Time Tracking Dashboard
  const [eventosUso, setEventosUso] = useState<any[]>([]);
  const [reportPeriod, setReportPeriod] = useState<'hoje' | '7dias' | '30dias' | 'todos'>('7dias');

  useEffect(() => {
    try {
      const local = JSON.parse(localStorage.getItem('atlas_demo_eventos') || '[]');
      setEventosUso(local);
    } catch (e) {
      console.warn('Erro ao carregar eventos:', e);
    }
  }, []);

  const allEvents = useMemo(() => {
    return eventosUso;
  }, [eventosUso]);

  const filteredEvents = useMemo(() => {
    const now = Date.now();
    return allEvents.filter(ev => {
      if (!isSuperAdmin && userData?.escritorioId && ev.escritorioId && ev.escritorioId !== userData.escritorioId) {
        return false;
      }
      if (!ev.data) return true;
      const t = new Date(ev.data).getTime();
      if (reportPeriod === 'hoje' && t < now - 86400000) return false;
      if (reportPeriod === '7dias' && t < now - 7 * 86400000) return false;
      if (reportPeriod === '30dias' && t < now - 30 * 86400000) return false;
      return true;
    });
  }, [allEvents, reportPeriod, isSuperAdmin, userData?.escritorioId]);

  const userActivityStats = useMemo(() => {
    const map: Record<string, {
      userId: string;
      nome: string;
      email: string;
      escritorioId: string;
      loginsCount: number;
      conferenciasCount: number;
      totalSegundos: number;
      ultimaAtividade: string;
    }> = {};

    const sourceUsers = usuariosList;

    const targetUsers = isSuperAdmin 
      ? sourceUsers 
      : sourceUsers.filter(u => u.escritorioId === (userData?.escritorioId || u.escritorioId));

    targetUsers.forEach(u => {
      map[u.uid || u.email] = {
        userId: u.uid,
        nome: u.nome || u.email.split('@')[0],
        email: u.email,
        escritorioId: u.escritorioId,
        loginsCount: 0,
        conferenciasCount: 0,
        totalSegundos: 0,
        ultimaAtividade: ''
      };
    });

    filteredEvents.forEach(ev => {
      if (!isSuperAdmin && userData?.escritorioId && ev.escritorioId && ev.escritorioId !== userData.escritorioId) {
        return;
      }
      const key = ev.userId || ev.userEmail || 'unknown';
      if (!map[key]) {
        if (!isSuperAdmin && userData?.escritorioId && ev.escritorioId && ev.escritorioId !== userData.escritorioId) {
          return;
        }
        map[key] = {
          userId: ev.userId || key,
          nome: ev.userNome || ev.userEmail?.split('@')[0] || 'Usuário Sistema',
          email: ev.userEmail || 'usuario@sistema.com',
          escritorioId: ev.escritorioId || '',
          loginsCount: 0,
          conferenciasCount: 0,
          totalSegundos: 0,
          ultimaAtividade: ''
        };
      }

      if (ev.tipo === 'login') {
        map[key].loginsCount += 1;
        map[key].totalSegundos += 900;
      } else if (ev.tipo === 'conferencia_arquivo' || ev.tipo === 'sped_importado' || ev.tipo === 'xml_importado') {
        map[key].conferenciasCount += 1;
        map[key].totalSegundos += (ev.tempoSegundos || 300);
      } else {
        map[key].totalSegundos += 120;
      }

      if (!map[key].ultimaAtividade || new Date(ev.data).getTime() > new Date(map[key].ultimaAtividade).getTime()) {
        map[key].ultimaAtividade = ev.data;
      }
    });

    return Object.values(map);
  }, [usuariosList, filteredEvents, isSuperAdmin, userData?.escritorioId]);

  const formatDuration = (segundos: number) => {
    if (!segundos || segundos <= 0) return '0 min';
    const h = Math.floor(segundos / 3600);
    const m = Math.floor((segundos % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const totalTeamSegundos = userActivityStats.reduce((acc, u) => acc + u.totalSegundos, 0);
  const totalTeamLogins = userActivityStats.reduce((acc, u) => acc + u.loginsCount, 0);
  const totalTeamConferencias = userActivityStats.reduce((acc, u) => acc + u.conferenciasCount, 0);

  const [metaMensal, setMetaMensal] = useState<number | null>(null);
  const [editandoMeta, setEditandoMeta] = useState(false);
  const [metaInput, setMetaInput] = useState('');

  useEffect(() => {
    if (!userData?.escritorioId) return;
    fetchMetaProdutividade(userData.escritorioId)
      .then(setMetaMensal)
      .catch(e => console.warn('Erro ao carregar meta:', e));
  }, [userData?.escritorioId]);

  const handleSalvarMeta = async () => {
    if (!userData?.escritorioId) return;
    const valor = parseInt(metaInput, 10);
    if (!valor || valor <= 0) return;
    await saveMetaProdutividade(userData.escritorioId, valor);
    setMetaMensal(valor);
    setEditandoMeta(false);
  };

  // "Conferidas" é o número real de conferências registradas — sem fórmula,
  // sem inflar. "Aprovadas por colaborador" foi removido do gráfico: o
  // sistema hoje não rastreia quem aprovou cada achado, então não existe
  // dado real para essa métrica — mostrar um número ali seria inventado.
  const monthlyGoalComparisonData = useMemo(() => {
    return userActivityStats.map(u => ({
      nome: u.nome.split(' ')[0],
      nomeCompleto: u.nome,
      conferidas: u.conferenciasCount,
      meta: metaMensal ?? 0
    }));
  }, [userActivityStats, metaMensal]);

  // Load Data
  const loadData = async () => {
    if (!isAllowed) return;
    setLoadingUsers(true);
    setActionError(null);

    try {
      const freshToken = (await getIdToken(true)) || token;
      if (!freshToken) {
        throw new Error('Não foi possível obter token de autenticação atualizado.');
      }

      // Fetch Escritórios
      try {
        const resEsc = await fetch('/api/admin/escritorios', {
          headers: { 'Authorization': `Bearer ${freshToken}` }
        });
        if (resEsc.ok) {
          const dataEsc = await resEsc.json();
          if (dataEsc.escritorios) {
            setEscritoriosList(dataEsc.escritorios);
          }
        }
      } catch (e) {
        console.warn('Erro ao carregar lista de escritórios:', e);
      }

      // Fetch Usuários
      const resUsr = await fetch('/api/admin/usuarios', {
        headers: { 'Authorization': `Bearer ${freshToken}` }
      });

      if (!resUsr.ok) {
        const errJson = await resUsr.json().catch(() => ({}));
        throw new Error(errJson.error || `Erro HTTP ${resUsr.status} ao carregar usuários.`);
      }

      const dataUsr = await resUsr.json();
      if (dataUsr.usuarios) {
        setUsuariosList(dataUsr.usuarios);
      }
    } catch (err: any) {
      console.error('Erro em loadData:', err);
      setActionError(err.message || 'Erro de conexão ou autorização ao buscar usuários.');
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [userData]);

  // Handle Invite / Convidar
  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail || !inviteNome) {
      setActionError('Preencha o e-mail e nome do usuário.');
      return;
    }

    const targetEscritorio = isSuperAdmin ? inviteEscritorioId : userData?.escritorioId;
    if (!targetEscritorio && invitePapel !== 'super_admin') {
      setActionError('Selecione um escritório de destino para o usuário.');
      return;
    }

    setSubmittingInvite(true);
    setActionError(null);
    setActionSuccess(null);
    setGeneratedLink(null);

    try {
      const freshToken = (await getIdToken(true)) || token;
      const res = await fetch('/api/escritorio/convidar', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${freshToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          nome: inviteNome.trim(),
          papel: invitePapel,
          escritorioId: targetEscritorio,
          senha: inviteSenha.trim() || undefined
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao convidar usuário.');
      }

      setActionSuccess(`Usuário ${inviteNome} cadastrado com sucesso!`);
      if (data.linkConvite) {
        setGeneratedLink(data.linkConvite);
      }

      // Reset form fields
      setInviteEmail('');
      setInviteNome('');
      setInviteSenha('');
      
      // Reload user list
      await loadData();
    } catch (err: any) {
      setActionError(err.message || 'Falha na requisição de convite.');
    } finally {
      setSubmittingInvite(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (u: UsuarioItem) => {
    setEditingUser(u);
    setEditNome(u.nome || '');
    setEditPapel(u.papel || 'colaborador');
    setEditEscritorioId(u.escritorioId || '');
    setEditAtivo(u.ativo !== false);
  };

  // Save Edit User
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setSubmittingEdit(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const freshToken = (await getIdToken(true)) || token;
      const res = await fetch(`/api/admin/usuarios/${editingUser.uid}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${freshToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          nome: editNome,
          papel: editPapel,
          escritorioId: editEscritorioId,
          ativo: editAtivo
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao atualizar dados do usuário.');
      }

      setActionSuccess(`Dados do usuário ${editNome} atualizados com sucesso!`);
      setEditingUser(null);
      await loadData();
    } catch (err: any) {
      setActionError(err.message || 'Erro ao editar usuário.');
    } finally {
      setSubmittingEdit(false);
    }
  };

  // Delete User
  const handleDeleteUser = async (u: UsuarioItem) => {
    if (!window.confirm(`Tem certeza que deseja excluir permanentemente o acesso de ${u.nome} (${u.email})?`)) {
      return;
    }

    setActionError(null);
    setActionSuccess(null);

    try {
      const freshToken = (await getIdToken(true)) || token;
      const res = await fetch(`/api/admin/usuarios/${u.uid}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${freshToken}` }
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao excluir usuário.');
      }

      setActionSuccess(`Usuário ${u.nome} excluído com sucesso.`);
      await loadData();
    } catch (err: any) {
      setActionError(err.message || 'Falha ao excluir usuário.');
    }
  };

  // Generate Invite / Reset Password Link
  const handleGenerateLink = async (u: UsuarioItem) => {
    setActionError(null);
    setActionSuccess(null);
    setGeneratedLink(null);

    try {
      const freshToken = (await getIdToken(true)) || token;
      const res = await fetch(`/api/admin/usuarios/${u.uid}/link-convite`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${freshToken}` }
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao gerar link de convite.');
      }

      if (data.linkConvite) {
        setGeneratedLink(data.linkConvite);
        setActionSuccess(`Link de ativação/redefinição para ${u.nome} gerado com sucesso!`);
      }
    } catch (err: any) {
      setActionError(err.message || 'Falha ao gerar link.');
    }
  };

  // Copy Link to Clipboard
  const handleCopyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  // Filtered Users List
  const filteredUsers = usuariosList.filter(u => {
    if (!isSuperAdmin && userData?.escritorioId && u.escritorioId !== userData.escritorioId) {
      return false;
    }
    const matchesSearch = (u.nome || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (u.email || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPapel = filterPapel === 'todos' || u.papel === filterPapel;
    const matchesEscritorio = filterEscritorio === 'todos' || u.escritorioId === filterEscritorio;

    return matchesSearch && matchesPapel && matchesEscritorio;
  });

  // Access Denied View for Colaborador
  if (!isAllowed) {
    return (
      <div className="p-8 max-w-5xl mx-auto space-y-6">
        <div className="bg-amber-50 border border-amber-200 p-6 rounded-2xl text-amber-950 space-y-3 shadow-2xs">
          <div className="flex items-center gap-3 text-lg font-bold">
            <Lock className="w-6 h-6 text-amber-700" />
            Acesso Restrito à Gestão de Usuários (RBAC)
          </div>
          <p className="text-sm text-slate-700 leading-relaxed">
            Seu perfil atual é <strong>Colaborador</strong>. A visualização, cadastro e alteração de privilégios de usuários no sistema é restrita a <strong>Administradores de Escritório</strong> e <strong>Super Admins</strong>.
          </p>
          <div className="pt-2">
            <UserHierarchyCard />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-blue-50 text-[#1e3a5f] rounded-xl border border-blue-100">
              <Shield className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                Gestão Unificada de Usuários
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Controle de acessos, privilégios RBAC e convites da equipe contábil.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 border ${
            isSuperAdmin 
              ? 'bg-purple-50 text-purple-800 border-purple-200' 
              : 'bg-blue-50 text-[#1e3a5f] border-blue-200'
          }`}>
            {isSuperAdmin ? <Crown className="w-4 h-4 text-purple-600" /> : <Building2 className="w-4 h-4 text-[#1e3a5f]" />}
            {isSuperAdmin ? 'Super Administrador (Acesso Global)' : 'Admin do Escritório'}
          </span>

          <button
            onClick={() => setShowInviteForm(!showInviteForm)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            {showInviteForm ? 'Fechar Formulário' : 'Novo Usuário / Convidar'}
          </button>

          <button
            onClick={loadData}
            disabled={loadingUsers}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all border border-slate-200 cursor-pointer"
            title="Atualizar Lista"
          >
            <RefreshCw className={`w-4 h-4 ${loadingUsers ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Global Alerts */}
      {actionError && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center justify-between gap-2 shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-rose-500 hover:text-rose-700 text-xs font-bold">×</button>
        </div>
      )}

      {actionSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center justify-between gap-2 shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-500 hover:text-emerald-700 text-xs font-bold">×</button>
        </div>
      )}

      {/* Generated Link Alert Banner */}
      {generatedLink && (
        <div className="p-4 bg-sky-50 border border-sky-200 rounded-xl space-y-2 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-sky-950 flex items-center gap-1.5">
              <Key className="w-4 h-4 text-sky-600" />
              Link de Convite e Definição de Senha Gerado
            </span>
            <button 
              onClick={() => handleCopyLink(generatedLink)}
              className="px-3 py-1 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-lg flex items-center gap-1 transition-all cursor-pointer"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedLink ? 'Copiado!' : 'Copiar Link'}
            </button>
          </div>
          <p className="text-xs text-sky-800 break-all bg-white/80 p-2.5 rounded-lg border border-sky-100 font-mono">
            {generatedLink}
          </p>
        </div>
      )}

      {/* Quick Form: Novo Usuário / Convite */}
      {showInviteForm && (
        <div className="bg-white rounded-2xl shadow-xs border border-emerald-200 p-6 space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-emerald-600" />
              Cadastrar Novo Usuário / Enviar Convite de Acesso
            </h3>
            <span className="text-xs text-slate-500">
              O convidado receberá um e-mail com instrução e link de definição de senha.
            </span>
          </div>

          <form onSubmit={handleInviteUser} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nome Completo *</label>
              <input
                type="text"
                required
                value={inviteNome}
                onChange={(e) => setInviteNome(e.target.value)}
                placeholder="Ex: Ana Maria Silva"
                className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">E-mail Corporativo *</label>
              <input
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="ana@empresa.com.br"
                className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>

            {isSuperAdmin ? (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Escritório de Destino *</label>
                <select
                  required={invitePapel !== 'super_admin'}
                  value={inviteEscritorioId}
                  onChange={(e) => setInviteEscritorioId(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="">Selecione o escritório...</option>
                  {escritoriosList.map(esc => (
                    <option key={esc.id} value={esc.id}>{esc.nome} {esc.cnpj ? `(${esc.cnpj})` : ''}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Escritório do Usuário</label>
                <input
                  type="text"
                  disabled
                  value={userData?.escritorioId || 'Meu Escritório Vinculado'}
                  className="w-full p-2.5 border border-slate-200 bg-slate-100 rounded-xl text-xs text-slate-500"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Papel / Nível de Acesso *</label>
              <select
                value={invitePapel}
                onChange={(e) => setInvitePapel(e.target.value as any)}
                className="w-full p-2.5 border border-slate-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                <option value="colaborador">Colaborador (Auditor / Operacional)</option>
                <option value="admin_escritorio">Admin do Escritório (Gestor)</option>
                {isSuperAdmin && <option value="super_admin">Super Admin (Acesso Global)</option>}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Senha Inicial (Opcional)</label>
              <input
                type="password"
                value={inviteSenha}
                onChange={(e) => setInviteSenha(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>

            <div className="md:col-span-2 lg:col-span-4 flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowInviteForm(false)}
                className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-medium cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submittingInvite}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                {submittingInvite ? 'Cadastrando e Gerando Acesso...' : 'Confirmar Cadastro e Enviar Convite'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Hierarchy Explanation Card */}
      <UserHierarchyCard />

      {/* Dashboard de Monitoramento de Tempo de Uso por Usuário */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-6 space-y-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-[#f1efe8] text-[#1e3a5f] rounded-xl border border-[#e5e2d9]">
              <Clock className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                Dashboard de Tempo de Uso & Sessões por Colaborador
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Monitoramento de atividade, duração de sessões e tempo total de uso por período.
              </p>
            </div>
          </div>

          {/* Controls & Period Selector */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
              <button
                onClick={() => setReportPeriod('hoje')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${reportPeriod === 'hoje' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Hoje
              </button>
              <button
                onClick={() => setReportPeriod('7dias')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${reportPeriod === '7dias' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'}`}
              >
                7 Dias
              </button>
              <button
                onClick={() => setReportPeriod('30dias')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${reportPeriod === '30dias' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'}`}
              >
                30 Dias
              </button>
              <button
                onClick={() => setReportPeriod('todos')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${reportPeriod === 'todos' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Geral
              </button>
            </div>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-blue-600" /> Colaboradores Ativos
            </span>
            <div className="text-2xl font-black text-slate-900">
              {userActivityStats.filter(u => u.totalSegundos > 0).length} <span className="text-xs font-medium text-slate-500">de {userActivityStats.length}</span>
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Timer className="w-3.5 h-3.5 text-[#1e3a5f]" /> Tempo Total de Atividade (estimado)
            </span>
            <div className="text-2xl font-black text-slate-900">
              {formatDuration(totalTeamSegundos)}
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-emerald-600" /> Total de Sessões / Logins
            </span>
            <div className="text-2xl font-black text-slate-900">
              {totalTeamLogins} <span className="text-xs font-medium text-slate-500">acessos</span>
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-amber-600" /> Auditorias Realizadas
            </span>
            <div className="text-2xl font-black text-slate-900">
              {totalTeamConferencias} <span className="text-xs font-medium text-slate-500">arquivos</span>
            </div>
          </div>
        </div>

        {/* User Activity & Session Duration Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="p-3">Colaborador / E-mail</th>
                <th className="p-3 text-center">Logins (Sessões)</th>
                <th className="p-3 text-center">Auditorias / Ações</th>
                <th className="p-3">Duração Média por Sessão (estimada)</th>
                <th className="p-3 font-bold text-slate-900">Tempo Total de Atividade (estimado)</th>
                <th className="p-3 text-right">Última Interação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {userActivityStats.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-500">
                    Nenhum registro de atividade encontrado para o período selecionado.
                  </td>
                </tr>
              ) : (
                userActivityStats.map((item, idx) => {
                  const mediaSegundos = item.loginsCount > 0 ? Math.round(item.totalSegundos / item.loginsCount) : item.totalSegundos;
                  return (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{item.nome}</div>
                        <div className="text-slate-500 font-mono text-[11px]">{item.email}</div>
                      </td>
                      <td className="p-3 text-center font-semibold text-blue-700 bg-blue-50/30">
                        {item.loginsCount}
                      </td>
                      <td className="p-3 text-center font-semibold text-emerald-700 bg-emerald-50/30">
                        {item.conferenciasCount}
                      </td>
                      <td className="p-3 text-slate-700 font-medium">
                        {formatDuration(mediaSegundos)}
                      </td>
                      <td className="p-3">
                        <div className="font-black text-slate-900 flex items-center gap-2">
                          {formatDuration(item.totalSegundos)}
                          <div className="w-24 bg-slate-100 rounded-full h-2 overflow-hidden hidden sm:block border border-slate-200">
                            <div 
                              className="bg-[#1e3a5f] h-2 rounded-full" 
                              style={{ width: `${Math.min(100, Math.round((item.totalSegundos / (totalTeamSegundos || 1)) * 100))}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-right text-slate-500 font-mono text-[11px]">
                        {item.ultimaAtividade ? new Date(item.ultimaAtividade).toLocaleString('pt-BR') : '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Gráfico Recharts: Notas Fiscais Conferidas por Colaborador (dado real) */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-6 space-y-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100">
              <BarChart3 className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                Produtividade: Conferências por Colaborador (Mês Atual)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Contagem real de conferências registradas por colaborador. Não inclui taxa de aprovação — o sistema ainda não rastreia quem aprovou cada achado.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
            <Target className="w-4 h-4 text-amber-600" />
            {editandoMeta ? (
              <>
                <input
                  type="number"
                  min={1}
                  value={metaInput}
                  onChange={e => setMetaInput(e.target.value)}
                  placeholder="ex: 180"
                  className="w-20 px-2 py-1 border border-slate-300 rounded-lg text-xs"
                />
                <button onClick={handleSalvarMeta} className="text-emerald-700 font-bold">Salvar</button>
                <button onClick={() => setEditandoMeta(false)} className="text-slate-400">Cancelar</button>
              </>
            ) : metaMensal !== null ? (
              <>
                <span>Meta Mensal: <strong className="text-slate-900">{metaMensal} NFs</strong></span>
                <button onClick={() => { setMetaInput(String(metaMensal)); setEditandoMeta(true); }} className="text-slate-400 underline text-[11px]">editar</button>
              </>
            ) : (
              <button onClick={() => { setMetaInput(''); setEditandoMeta(true); }} className="text-amber-700 underline">
                Nenhuma meta definida — configurar
              </button>
            )}
          </div>
        </div>

        {/* Recharts Bar Chart */}
        <div className="h-72 w-full pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyGoalComparisonData} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="nome" stroke="#64748b" fontSize={12} tickLine={false} />
              <YAxis stroke="#64748b" fontSize={12} tickLine={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                formatter={(value: any, name: any) => [
                  value, 
                  name === 'conferidas' ? 'Notas Conferidas' : 'Meta Mensal'
                ]}
                labelStyle={{ fontWeight: 'bold', color: '#1e293b' }}
              />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
              <Bar dataKey="conferidas" name="Notas Conferidas" fill="#1e3a5f" radius={[6, 6, 0, 0]} barSize={28} />
              {metaMensal !== null && (
                <Bar dataKey="meta" name="Meta do Escritório" fill="#cbd5e1" radius={[6, 6, 0, 0]} barSize={28} />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Summary Cards — só dado real */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-4 border-t border-slate-100">
          {monthlyGoalComparisonData.map((item, idx) => {
            const progresso = metaMensal ? Math.min(100, Math.round((item.conferidas / metaMensal) * 100)) : null;
            return (
              <div key={idx} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-xs">{item.nomeCompleto}</span>
                  {progresso !== null && (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${progresso >= 100 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                      {progresso}% da Meta
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>Conferidas: <strong className="text-[#1e3a5f] font-bold">{item.conferidas}</strong></span>
                </div>
                {progresso !== null && (
                  <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className={`h-1.5 rounded-full ${progresso >= 100 ? 'bg-emerald-600' : 'bg-[#1e3a5f]'}`}
                      style={{ width: `${progresso}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-6 space-y-4">
        {/* Filter Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pb-2 border-b border-slate-100">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome ou e-mail..."
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-xs font-semibold text-slate-600">Papel:</span>
              <select
                value={filterPapel}
                onChange={(e) => setFilterPapel(e.target.value)}
                className="bg-transparent text-xs font-medium text-slate-800 outline-none cursor-pointer"
              >
                <option value="todos">Todos os Papéis</option>
                <option value="super_admin">Super Admin</option>
                <option value="admin_escritorio">Admin Escritório</option>
                <option value="colaborador">Colaborador</option>
              </select>
            </div>

            {isSuperAdmin && escritoriosList.length > 0 && (
              <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                <Building2 className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-xs font-semibold text-slate-600">Escritório:</span>
                <select
                  value={filterEscritorio}
                  onChange={(e) => setFilterEscritorio(e.target.value)}
                  className="bg-transparent text-xs font-medium text-slate-800 outline-none cursor-pointer max-w-[180px] truncate"
                >
                  <option value="todos">Todos os Escritórios</option>
                  {escritoriosList.map(esc => (
                    <option key={esc.id} value={esc.id}>{esc.nome}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Users Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="p-3">Usuário / E-mail</th>
                <th className="p-3">Papel / Nível</th>
                <th className="p-3">Escritório Vinculado</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loadingUsers ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-blue-600 mb-2" />
                    Carregando usuários cadastrados...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">
                    Nenhum usuário encontrado para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredUsers.map(u => (
                  <tr key={u.uid} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3">
                      <div className="font-bold text-slate-900">{u.nome || 'Usuário Sem Nome'}</div>
                      <div className="text-slate-500 font-mono text-[11px]">{u.email}</div>
                    </td>
                    <td className="p-3">
                      {u.papel === 'super_admin' ? (
                        <span className="px-2.5 py-1 bg-purple-100 text-purple-800 font-semibold text-[11px] rounded-full inline-flex items-center gap-1 border border-purple-200">
                          <Crown className="w-3 h-3 text-purple-600" /> Super Admin
                        </span>
                      ) : u.papel === 'admin_escritorio' ? (
                        <span className="px-2.5 py-1 bg-blue-100 text-[#1e3a5f] font-semibold text-[11px] rounded-full inline-flex items-center gap-1 border border-blue-200">
                          <Building2 className="w-3 h-3 text-[#1e3a5f]" /> Admin Escritório
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-700 font-semibold text-[11px] rounded-full inline-flex items-center gap-1 border border-slate-200">
                          <UserCheck className="w-3 h-3 text-slate-500" /> Colaborador
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      <span className="text-slate-800 font-medium">
                        {u.escritorioNome || (u.papel === 'super_admin' ? 'Acesso Global' : '— Sem Vínculo —')}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      {u.ativo !== false ? (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold text-[10px] rounded-full inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Ativo
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-rose-100 text-rose-800 font-bold text-[10px] rounded-full inline-flex items-center gap-1">
                          <XCircle className="w-3 h-3 text-rose-600" /> Inativo
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleGenerateLink(u)}
                          className="p-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-lg text-xs font-semibold transition-all border border-sky-200 flex items-center gap-1 cursor-pointer"
                          title="Gerar Link de Ativação / Convite"
                        >
                          <Key className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Link</span>
                        </button>

                        <button
                          onClick={() => openEditModal(u)}
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all border border-slate-200 cursor-pointer"
                          title="Editar Usuário"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleDeleteUser(u)}
                          className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-all border border-rose-200 cursor-pointer"
                          title="Excluir Usuário"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Edição de Usuário */}
      {editingUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full p-6 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-blue-600" />
                Editar Dados do Usuário
              </h3>
              <button 
                onClick={() => setEditingUser(null)} 
                className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">E-mail de Acesso (Não alterável)</label>
                <input
                  type="text"
                  disabled
                  value={editingUser.email}
                  className="w-full p-2.5 border border-slate-200 bg-slate-100 rounded-xl font-mono text-slate-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nome Completo *</label>
                <input
                  type="text"
                  required
                  value={editNome}
                  onChange={(e) => setEditNome(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Papel / Nível de Permissão *</label>
                <select
                  value={editPapel}
                  onChange={(e) => setEditPapel(e.target.value as any)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="colaborador">Colaborador (Operacional)</option>
                  <option value="admin_escritorio">Admin do Escritório</option>
                  {isSuperAdmin && <option value="super_admin">Super Admin (Acesso Global)</option>}
                </select>
              </div>

              {isSuperAdmin && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Escritório Vinculado</label>
                  <select
                    value={editEscritorioId}
                    onChange={(e) => setEditEscritorioId(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">— Sem Vínculo (Acesso Global) —</option>
                    {escritoriosList.map(esc => (
                      <option key={esc.id} value={esc.id}>{esc.nome}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="chkAtivo"
                  checked={editAtivo}
                  onChange={(e) => setEditAtivo(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                <label htmlFor="chkAtivo" className="font-semibold text-slate-800 cursor-pointer">
                  Usuário Ativo no Sistema
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingEdit}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {submittingEdit ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
