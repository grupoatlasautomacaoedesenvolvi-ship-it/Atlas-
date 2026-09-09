import { auth } from "../lib/firebase";
import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/auth';
import { Key, Users, UserPlus, Building2, Plus, Check, Shield, Palette } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { UserHierarchyCard } from './UserHierarchyCard';
import { ThemeSelector } from './ThemeSelector';

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
      setMsg('Senha alterada com sucesso');
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
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8 text-[var(--atlas-text)]">
      <div className="mb-2">
        <h2 className="text-2xl font-bold tracking-tight text-[var(--atlas-navy)]">Configurações & Aparência</h2>
        <p className="text-[var(--atlas-text-secondary)] mt-1">Gerencie sua conta, cadastros de escritórios e preferências visuais do sistema</p>
      </div>

      {/* Seletor de Tema Visual */}
      <div className="atlas-card p-6">
        <h3 className="text-lg font-bold text-[var(--atlas-navy)] mb-2 flex items-center">
          <Palette className="w-5 h-5 mr-2 text-[var(--atlas-accent)]" />
          Aparência e Tema do Sistema
        </h3>
        <p className="text-xs text-[var(--atlas-text-secondary)] mb-4">
          Escolha a paleta de cores institucional e alterne entre os modos claro e escuro. As preferências são salvas no seu navegador.
        </p>
        <div className="max-w-md">
          <ThemeSelector compact={false} />
        </div>
      </div>

      {/* Cadastro de Escritório (Restrito a Super Admin) */}
      {userData?.papel === 'super_admin' ? (
        <div className="atlas-card p-6">
          <h3 className="text-lg font-bold text-[var(--atlas-navy)] mb-2 flex items-center">
            <Building2 className="w-5 h-5 mr-2 text-[var(--atlas-navy)]" />
            Cadastrar Novo Escritório & Criar Admin
          </h3>
          <p className="text-xs text-[var(--atlas-text-secondary)] mb-6">
            Cadastre novos escritórios contábeis e defina o administrador responsável de cada um.
          </p>

          <form onSubmit={handleCriarEscritorio} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--atlas-text)] mb-1">Nome do Escritório *</label>
                <input
                  type="text"
                  required
                  value={nomeEscritorio}
                  onChange={(e) => setNomeEscritorio(e.target.value)}
                  placeholder="Ex: Escritório Contábil Alpha"
                  className="atlas-input w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--atlas-text)] mb-1">CNPJ (Opcional)</label>
                <input
                  type="text"
                  value={cnpjEscritorio}
                  onChange={(e) => setCnpjEscritorio(e.target.value)}
                  placeholder="00.000.000/0001-00"
                  className="atlas-input w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--atlas-text)] mb-1">Nome do Admin do Escritório *</label>
                <input
                  type="text"
                  required
                  value={nomeAdminEscritorio}
                  onChange={(e) => setNomeAdminEscritorio(e.target.value)}
                  placeholder="Nome do Administrador"
                  className="atlas-input w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--atlas-text)] mb-1">E-mail do Admin do Escritório *</label>
                <input
                  type="email"
                  required
                  value={emailAdminEscritorio}
                  onChange={(e) => setEmailAdminEscritorio(e.target.value)}
                  placeholder="admin@escritorio.com"
                  className="atlas-input w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--atlas-text)] mb-1">Senha Inicial do Admin (Opcional)</label>
                <input
                  type="password"
                  value={senhaAdminEscritorio}
                  onChange={(e) => setSenhaAdminEscritorio(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="atlas-input w-full"
                />
              </div>
            </div>

            {msgEscritorio && (
              <div className={`atlas-alert ${msgEscritorio.includes('Erro') ? 'atlas-alert-danger' : 'atlas-alert-success'}`}>
                {msgEscritorio}
              </div>
            )}

            <button
              disabled={criandoEscritorio}
              type="submit"
              className="atlas-btn atlas-btn-primary flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              {criandoEscritorio ? 'Cadastrando...' : 'Cadastrar Escritório e Admin'}
            </button>
          </form>

          {/* Lista de Escritórios Cadastrados */}
          <div className="mt-8 pt-6 border-t border-[var(--atlas-border)]">
            <h4 className="text-sm font-bold text-[var(--atlas-navy)] mb-3">Escritórios Cadastrados no Sistema ({escritorios.length})</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {escritorios.map(esc => {
                const vinculados = todosUsuarios.filter(u => u.escritorioId === esc.id);
                return (
                  <div key={esc.id} className="atlas-list-row justify-between flex-col items-start gap-2">
                    <div className="flex items-center justify-between w-full">
                      <h5 className="font-bold text-[var(--atlas-text)] text-sm">{esc.nome}</h5>
                      <span className="text-[11px] text-[var(--atlas-text-muted)] font-mono">{esc.cnpj || 'Sem CNPJ'}</span>
                    </div>
                    <div className="text-xs text-[var(--atlas-text-secondary)]">
                      <span className="font-semibold text-[var(--atlas-text)]">Usuários Vinculados ({vinculados.length}):</span>
                      {vinculados.length === 0 ? (
                        <span className="text-[var(--atlas-text-muted)] ml-1">Nenhum</span>
                      ) : (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {vinculados.map(v => (
                            <span key={v.id} className="atlas-pill atlas-pill-navy">
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
        <div className="atlas-card p-6">
          <h3 className="text-lg font-bold text-[var(--atlas-navy)] mb-4 flex items-center">
            <Key className="w-5 h-5 mr-2 text-[var(--atlas-navy)]" />
            Alterar Senha
          </h3>
          <p className="text-xs text-[var(--atlas-text-secondary)] mb-6">Logado como: <span className="font-semibold text-[var(--atlas-text)]">{user?.email}</span></p>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--atlas-text)] mb-1">Nova Senha</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="atlas-input w-full"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--atlas-text)] mb-1">Confirmar Nova Senha</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="atlas-input w-full"
              />
            </div>
            {error && <div className="atlas-alert atlas-alert-danger">{error}</div>}
            {msg && <div className="atlas-alert atlas-alert-success">{msg}</div>}
            <button
              disabled={loading}
              type="submit"
              className="atlas-btn atlas-btn-primary w-full justify-center disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Salvando...' : 'Atualizar Senha'}
            </button>
          </form>
        </div>

        {/* Gestão de Equipe */}
        <div className="atlas-card p-6">
          <h3 className="text-lg font-bold text-[var(--atlas-navy)] mb-4 flex items-center">
            <Users className="w-5 h-5 mr-2 text-[var(--atlas-navy)]" />
            Gestão de Convites
          </h3>
          
          <div className="mb-6">
            <h4 className="text-xs font-bold text-[var(--atlas-text)] mb-2">Membros vinculados ao seu escritório:</h4>
            {colaboradores.length === 0 ? (
              <p className="text-xs text-[var(--atlas-text-muted)]">Nenhum membro vinculado ao seu escritório atual.</p>
            ) : (
              <ul className="space-y-2 max-h-40 overflow-y-auto">
                {colaboradores.map(c => (
                  <li key={c.id} className="atlas-list-row text-xs justify-between">
                    <div>
                      <span className="font-bold text-[var(--atlas-text)]">{c.nome}</span> <span className="text-[var(--atlas-text-muted)]">({c.email})</span>
                    </div>
                    <span className="atlas-pill atlas-pill-navy">{c.papel}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {userData?.papel === 'colaborador' ? (
            <div className="atlas-alert atlas-alert-warning space-y-2">
              <div className="flex items-center gap-2 font-bold text-[var(--atlas-warning)]">
                <Shield className="w-4 h-4 text-[var(--atlas-warning)]" />
                Cadastro Restrito a Administradores
              </div>
              <p className="text-xs">
                Seu perfil atual é <strong>Colaborador</strong>. O cadastro e o envio de convites para novos usuários são de acesso exclusivo aos <strong>Administradores do Escritório</strong> ou <strong>Super Admins</strong>.
              </p>
            </div>
          ) : (
            <form onSubmit={handleConvidar} className="space-y-3 p-4 rounded-xl border border-[var(--atlas-border)] bg-[var(--atlas-surface)]">
              <h4 className="text-xs font-bold text-[var(--atlas-navy)] flex items-center gap-1"><UserPlus className="w-4 h-4"/> Convidar Membro para a Equipe</h4>
              {userData?.papel === 'super_admin' && (
                <>
                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--atlas-text)] mb-1">Escritório de Destino *</label>
                    <select
                      required
                      value={escritorioDestinoColab}
                      onChange={(e) => setEscritorioDestinoColab(e.target.value)}
                      className="atlas-input w-full text-xs"
                    >
                      <option value="">Selecione o escritório...</option>
                      {escritorios.map(esc => (
                        <option key={esc.id} value={esc.id}>{esc.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--atlas-text)] mb-1">Papel *</label>
                    <select
                      value={papelColab}
                      onChange={(e) => setPapelColab(e.target.value as any)}
                      className="atlas-input w-full text-xs"
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
                  <label className="block text-[11px] font-semibold text-[var(--atlas-text)] mb-1">Papel *</label>
                  <select
                    value={papelColab}
                    onChange={(e) => setPapelColab(e.target.value as any)}
                    className="atlas-input w-full text-xs"
                  >
                    <option value="colaborador">Colaborador</option>
                    <option value="admin_escritorio">Admin do Escritório</option>
                  </select>
                </div>
              )}
              <div>
                <label className="block text-[11px] font-semibold text-[var(--atlas-text)] mb-1">Nome Completo *</label>
                <input
                  type="text"
                  required
                  value={nomeColab}
                  onChange={(e) => setNomeColab(e.target.value)}
                  placeholder="Nome do colaborador"
                  className="atlas-input w-full text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[var(--atlas-text)] mb-1">E-mail de Acesso *</label>
                <input
                  type="email"
                  required
                  value={emailColab}
                  onChange={(e) => setEmailColab(e.target.value)}
                  placeholder="email@empresa.com"
                  className="atlas-input w-full text-xs"
                />
              </div>
              <button
                disabled={enviandoConvite}
                type="submit"
                className="atlas-btn atlas-btn-accent w-full justify-center text-xs disabled:opacity-50 cursor-pointer"
              >
                {enviandoConvite ? 'Enviando Convite...' : 'Enviar Convite e Gerar Acesso'}
              </button>
              {msgEquipe && <div className="atlas-alert atlas-alert-info text-xs">{msgEquipe}</div>}
            </form>
          )}
        </div>
      </div>

      {/* Cartão Informativo da Hierarquia e Permissões */}
      <UserHierarchyCard />
    </div>
  );
}

