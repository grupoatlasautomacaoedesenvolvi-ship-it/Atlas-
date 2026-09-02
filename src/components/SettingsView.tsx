import { auth } from "../lib/firebase";
import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/auth';
import { Key, Users, UserPlus, Building2, Plus, Check, Shield } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { UserHierarchyCard } from './UserHierarchyCard';

export function SettingsView() {
  const { changePassword, user, userData, getIdToken } = useAuth();
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Office registration state for Super Admin
  const [escritorios, setEscritorios] = useState<any[]>([]);
  const [todosUsuarios, setTodosUsuarios] = useState<any[]>([]);
  const [nomeEscritorio, setNomeEscritorio] = useState('');
  const [cnpjEscritorio, setCnpjEscritorio] = useState('');
  const [emailAdminEscritorio, setEmailAdminEscritorio] = useState('');
  const [nomeAdminEscritorio, setNomeAdminEscritorio] = useState('');
  const [senhaAdminEscritorio, setSenhaAdminEscritorio] = useState('');
  const [msgEscritorio, setMsgEscritorio] = useState('');
  const [criandoEscritorio, setCriandoEscritorio] = useState(false);

  // Team Management state
  const [colaboradores, setColaboradores] = useState<any[]>([]);
  const [emailColab, setEmailColab] = useState('');
  const [nomeColab, setNomeColab] = useState('');
  const [escritorioDestinoColab, setEscritorioDestinoColab] = useState('');
  const [papelColab, setPapelColab] = useState<'colaborador' | 'admin_escritorio'>('colaborador');
  const [enviandoConvite, setEnviandoConvite] = useState(false);
  const [msgEquipe, setMsgEquipe] = useState('');

  const carregarDadosEscritorio = async () => {
    try {
      const snapEsc = await getDocs(collection(db, 'escritorios'));
      setEscritorios(snapEsc.docs.map(d => ({ id: d.id, ...d.data() })));

      const snapUsr = await getDocs(collection(db, 'usuarios'));
      setTodosUsuarios(snapUsr.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error('Erro ao carregar dados', e);
    }
  };

  const carregarEquipe = async () => {
    if (!userData?.escritorioId) return;
    try {
      const q = query(
        collection(db, 'usuarios'),
        where('escritorioId', '==', userData.escritorioId)
      );
      const snap = await getDocs(q);
      setColaboradores(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error('Erro ao carregar equipe', e);
    }
  };

  useEffect(() => {
    carregarDadosEscritorio();
    carregarEquipe();
  }, [userData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');
    setError('');
    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }
    if (newPassword.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    setLoading(true);
    try {
      await changePassword(newPassword);
      setMsg('Senha alterada');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      if (err.code === 'auth/requires-recent-login') {
        setError('Para alterar a senha, faça login novamente e tente mais uma vez.');
      } else {
        setError(err.message || 'Erro ao alterar a senha.');
      }
    }
    setLoading(false);
  };

  const handleCriarEscritorio = async (e: React.FormEvent) => {
    e.preventDefault();
    setCriandoEscritorio(true);
    setMsgEscritorio('');
    try {
      const token = await getIdToken(true);
      if (!token) {
        throw new Error('Sessão expirada ou não autenticada. Faça login novamente.');
      }
      const res = await fetch('/api/admin/escritorios', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          nomeEscritorio,
          cnpj: cnpjEscritorio,
          emailAdmin: emailAdminEscritorio,
          nomeAdmin: nomeAdminEscritorio,
          senhaAdmin: senhaAdminEscritorio.trim() || undefined
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao cadastrar escritório.');

      setMsgEscritorio(`Escritório e Admin cadastrados com sucesso! ${data.linkConvite ? 'Link de convite gerado.' : ''}`);
      setNomeEscritorio('');
      setCnpjEscritorio('');
      setEmailAdminEscritorio('');
      setNomeAdminEscritorio('');
      setSenhaAdminEscritorio('');
      carregarDadosEscritorio();
    } catch (err: any) {
      setMsgEscritorio(`Erro: ${err.message}`);
    } finally {
      setCriandoEscritorio(false);
    }
  };

  const handleConvidar = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviandoConvite(true);
    setMsgEquipe('');
    try {
      const token = await getIdToken(true);
      if (!token) {
        throw new Error('Sessão expirada ou não autenticada. Faça login novamente.');
      }
      const payload: any = { email: emailColab, nome: nomeColab };
      if (userData?.papel === 'super_admin') {
        payload.escritorioId = escritorioDestinoColab;
        payload.papel = papelColab;
      }
      const res = await fetch('/api/escritorio/convidar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao convidar.');
      
      setMsgEquipe(`Convite enviado com sucesso.${data.linkConvite ? ' O usuário receberá o e-mail de acesso.' : ''}`);
      setEmailColab('');
      setNomeColab('');
      carregarEquipe();
      carregarDadosEscritorio();
    } catch (err: any) {
      setMsgEquipe(`Erro: ${err.message}`);
    } finally {
      setEnviandoConvite(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <div className="mb-2">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Configurações & Gestão</h2>
        <p className="text-slate-500 mt-1">Gerencie sua conta, cadastros de escritórios e equipe de usuários</p>
      </div>

      {/* Cadastro de Escritório (Restrito a Super Admin) */}
      {userData?.papel === 'super_admin' ? (
        <div className="bg-white p-6 rounded-xl shadow-xs border border-slate-200">
          <h3 className="text-lg font-bold text-slate-900 mb-2 flex items-center">
            <Building2 className="w-5 h-5 mr-2 text-[#1e3a5f]" />
            Cadastrar Novo Escritório & Criar Admin
          </h3>
          <p className="text-xs text-slate-500 mb-6">
            Cadastre novos escritórios contábeis e defina o administrador responsável de cada um.
          </p>

          <form onSubmit={handleCriarEscritorio} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nome do Escritório *</label>
                <input
                  type="text"
                  required
                  value={nomeEscritorio}
                  onChange={(e) => setNomeEscritorio(e.target.value)}
                  placeholder="Ex: Escritório Contábil Alpha"
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-[#1e3a5f] outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">CNPJ (Opcional)</label>
                <input
                  type="text"
                  value={cnpjEscritorio}
                  onChange={(e) => setCnpjEscritorio(e.target.value)}
                  placeholder="00.000.000/0001-00"
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-[#1e3a5f] outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nome do Admin do Escritório *</label>
                <input
                  type="text"
                  required
                  value={nomeAdminEscritorio}
                  onChange={(e) => setNomeAdminEscritorio(e.target.value)}
                  placeholder="Nome do Administrador"
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-[#1e3a5f] outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">E-mail do Admin do Escritório *</label>
                <input
                  type="email"
                  required
                  value={emailAdminEscritorio}
                  onChange={(e) => setEmailAdminEscritorio(e.target.value)}
                  placeholder="admin@escritorio.com"
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-[#1e3a5f] outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Senha Inicial do Admin (Opcional)</label>
                <input
                  type="password"
                  value={senhaAdminEscritorio}
                  onChange={(e) => setSenhaAdminEscritorio(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-[#1e3a5f] outline-none"
                />
              </div>
            </div>

            {msgEscritorio && (
              <div className={`text-sm font-medium p-3 rounded-lg ${msgEscritorio.includes('Erro') ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                {msgEscritorio}
              </div>
            )}

            <button
              disabled={criandoEscritorio}
              type="submit"
              className="bg-[#1e3a5f] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#142c47] transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              {criandoEscritorio ? 'Cadastrando...' : 'Cadastrar Escritório e Admin'}
            </button>
          </form>

          {/* Lista de Escritórios Cadastrados */}
          <div className="mt-8 pt-6 border-t border-slate-100">
            <h4 className="text-sm font-bold text-slate-800 mb-3">Escritórios Cadastrados no Sistema ({escritorios.length})</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {escritorios.map(esc => {
                const vinculados = todosUsuarios.filter(u => u.escritorioId === esc.id);
                return (
                  <div key={esc.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                    <div className="flex items-center justify-between">
                      <h5 className="font-bold text-slate-900 text-sm">{esc.nome}</h5>
                      <span className="text-[11px] text-slate-500 font-mono">{esc.cnpj || 'Sem CNPJ'}</span>
                    </div>
                    <div className="text-xs text-slate-600">
                      <span className="font-semibold text-slate-700">Usuários Vinculados ({vinculados.length}):</span>
                      {vinculados.length === 0 ? (
                        <span className="text-slate-400 ml-1">Nenhum</span>
                      ) : (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {vinculados.map(v => (
                            <span key={v.id} className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[11px] text-slate-700 medium">
                              {v.nome || v.email}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Alterar Senha */}
        <div className="bg-white p-6 rounded-xl shadow-xs border border-slate-200">
          <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center">
            <Key className="w-5 h-5 mr-2 text-[#1e3a5f]" />
            Alterar Senha
          </h3>
          <p className="text-xs text-slate-600 mb-6">Logado como: <span className="font-semibold">{user?.email}</span></p>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nova Senha</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-[#1e3a5f] outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Confirmar Nova Senha</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-[#1e3a5f] outline-none"
              />
            </div>
            {error && <div className="text-xs font-medium p-3 bg-red-50 text-red-700 rounded-lg">{error}</div>}
            {msg && <div className="text-xs font-medium p-3 bg-emerald-50 text-emerald-700 rounded-lg">{msg}</div>}
            <button
              disabled={loading}
              type="submit"
              className="w-full bg-[#1e3a5f] text-white p-2.5 rounded-lg text-sm font-medium hover:bg-[#142c47] transition-colors disabled:opacity-50"
            >
              {loading ? 'Salvando...' : 'Atualizar Senha'}
            </button>
          </form>
        </div>

        {/* Gestão de Equipe */}
        <div className="bg-white p-6 rounded-xl shadow-xs border border-slate-200">
          <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center">
            <Users className="w-5 h-5 mr-2 text-[#1e3a5f]" />
            Gestão de Convites
          </h3>
          
          <div className="mb-6">
            <h4 className="text-xs font-bold text-slate-700 mb-2">Membros vinculados ao seu escritório:</h4>
            {colaboradores.length === 0 ? (
              <p className="text-xs text-slate-500">Nenhum membro vinculado ao seu escritório atual.</p>
            ) : (
              <ul className="space-y-2 max-h-40 overflow-y-auto">
                {colaboradores.map(c => (
                  <li key={c.id} className="text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-800">{c.nome}</span> <span className="text-slate-500">({c.email})</span>
                    </div>
                    <span className="px-1.5 py-0.5 bg-slate-200 text-[10px] rounded uppercase font-mono">{c.papel}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {userData?.papel === 'colaborador' ? (
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-xs text-amber-900 space-y-2">
              <div className="flex items-center gap-2 font-bold text-amber-950">
                <Shield className="w-4 h-4 text-amber-700" />
                Cadastro Restrito a Administradores
              </div>
              <p>
                Seu perfil atual é <strong>Colaborador</strong>. O cadastro e o envio de convites para novos usuários são de acesso exclusivo aos <strong>Administradores do Escritório</strong> ou <strong>Super Admins</strong>.
              </p>
            </div>
          ) : (
            <form onSubmit={handleConvidar} className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1"><UserPlus className="w-4 h-4"/> Convidar Membro para a Equipe</h4>
              {userData?.papel === 'super_admin' && (
                <>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Escritório de Destino *</label>
                    <select
                      required
                      value={escritorioDestinoColab}
                      onChange={(e) => setEscritorioDestinoColab(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white"
                    >
                      <option value="">Selecione o escritório...</option>
                      {escritorios.map(esc => (
                        <option key={esc.id} value={esc.id}>{esc.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Papel *</label>
                    <select
                      value={papelColab}
                      onChange={(e) => setPapelColab(e.target.value as any)}
                      className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white"
                    >
                      <option value="colaborador">Colaborador</option>
                      <option value="admin_escritorio">Admin do Escritório</option>
                      <option value="super_admin">Super Admin</option>
                    </select>
                  </div>
                </>
              )}
              {userData?.papel === 'admin_escritorio' && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Papel *</label>
                  <select
                    value={papelColab}
                    onChange={(e) => setPapelColab(e.target.value as any)}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white"
                  >
                    <option value="colaborador">Colaborador</option>
                    <option value="admin_escritorio">Admin do Escritório</option>
                  </select>
                </div>
              )}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Nome Completo *</label>
                <input
                  type="text"
                  required
                  value={nomeColab}
                  onChange={(e) => setNomeColab(e.target.value)}
                  placeholder="Nome do colaborador"
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">E-mail de Acesso *</label>
                <input
                  type="email"
                  required
                  value={emailColab}
                  onChange={(e) => setEmailColab(e.target.value)}
                  placeholder="email@empresa.com"
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <button
                disabled={enviandoConvite}
                type="submit"
                className="w-full bg-emerald-600 text-white p-2 rounded-lg text-xs font-medium hover:bg-emerald-700 disabled:opacity-50"
              >
                {enviandoConvite ? 'Enviando Convite...' : 'Enviar Convite e Gerar Acesso'}
              </button>
              {msgEquipe && <div className="text-xs font-medium p-2.5 bg-blue-50 text-blue-700 rounded-lg">{msgEquipe}</div>}
            </form>
          )}
        </div>
      </div>

      {/* Cartão Informativo da Hierarquia e Permissões */}
      <UserHierarchyCard />
    </div>
  );
}

