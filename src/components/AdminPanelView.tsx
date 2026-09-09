import React, { useState, useEffect, useMemo } from 'react';
import { db, auth, safeWrite } from '../lib/firebase';
import { collection, getDocs, doc, setDoc, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { 
  Building2, Users, Activity, PlusCircle, Search, Edit3, Trash2, 
  CheckCircle2, XCircle, UserPlus, Filter, X, RefreshCw, ChevronRight,
  FolderOpen, Mail, Phone, MapPin, FileText, AlertCircle, ShieldCheck,
  Building, UserCheck, Eye, Sparkles, Clock, Download, FileSpreadsheet,
  LogIn, BarChart2, ShieldAlert, FileCode
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { formatTempoConferencia } from '../lib/tracking';
import { useAuth } from '../lib/auth';
import { fetchClientes, saveCliente, deleteCliente } from '../lib/clientService';
import { Cliente, RegimeTributario } from '../types';
import { UserHierarchyCard } from './UserHierarchyCard';

export interface EscritorioItem {
  id: string;
  nome: string;
  cnpj?: string;
  emailAdmin?: string;
  nomeAdmin?: string;
  ativo: boolean;
  dataCriacao?: string;
  clientes?: Cliente[];
}

export function AdminPanelView() {
  const { userData, getIdToken } = useAuth();
  const [escritorios, setEscritorios] = useState<EscritorioItem[]>([]);
  const [allClientes, setAllClientes] = useState<{ cliente: Cliente; escritorioNome: string; escritorioId: string }[]>([]);
  const [eventos, setEventos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'escritorios' | 'clientes' | 'usuarios' | 'logs'>('escritorios');

  // Search & Filter states
  const [searchEscritorio, setSearchEscritorio] = useState('');
  const [searchCliente, setSearchCliente] = useState('');
  const [searchUsuario, setSearchUsuario] = useState('');
  const [filterRegime, setFilterRegime] = useState<string>('todos');
  const [filterEscritorio, setFilterEscritorio] = useState<string>('todos');
  const [filterUsuarioEscritorio, setFilterUsuarioEscritorio] = useState<string>('todos');
  const [filterUsuarioPapel, setFilterUsuarioPapel] = useState<string>('todos');

  // Admin Report states
  const [reportSubTab, setReportSubTab] = useState<'logins' | 'conferencias'>('logins');
  const [reportSearch, setReportSearch] = useState('');
  const [reportDateFilter, setReportDateFilter] = useState<'todos' | 'hoje' | '7dias' | '30dias'>('todos');
  const [reportOfficeFilter, setReportOfficeFilter] = useState<string>('todos');

  // User management state
  const [usuariosList, setUsuariosList] = useState<any[]>([]);
  const [showNewUsuarioModal, setShowNewUsuarioModal] = useState(false);
  const [editingUsuario, setEditingUsuario] = useState<any | null>(null);
  const [userFormNome, setUserFormNome] = useState('');
  const [userFormEmail, setUserFormEmail] = useState('');
  const [userFormEscritorioId, setUserFormEscritorioId] = useState('');
  const [userFormPapel, setUserFormPapel] = useState<'colaborador' | 'admin_escritorio' | 'super_admin'>('colaborador');
  const [submittingUser, setSubmittingUser] = useState(false);
  const [userMsg, setUserMsg] = useState('');
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);

  // Modals & Selection
  const [selectedEscritorioForClients, setSelectedEscritorioForClients] = useState<EscritorioItem | null>(null);
  const [showNewEscritorioModal, setShowNewEscritorioModal] = useState(false);
  const [editingEscritorio, setEditingEscritorio] = useState<EscritorioItem | null>(null);
  
  // Client Form modal
  const [showClienteModal, setShowClienteModal] = useState(false);
  const [targetEscritorioForNewClient, setTargetEscritorioForNewClient] = useState<EscritorioItem | null>(null);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);

  // Form inputs - Escritório
  const [escNome, setEscNome] = useState('');
  const [escCnpj, setEscCnpj] = useState('');
  const [escEmailAdmin, setEscEmailAdmin] = useState('');
  const [escNomeAdmin, setEscNomeAdmin] = useState('');
  const [submittingEsc, setSubmittingEsc] = useState(false);
  const [escMsg, setEscMsg] = useState('');

  // Form inputs - Cliente
  const [cliNome, setCliNome] = useState('');
  const [cliCnpj, setCliCnpj] = useState('');
  const [cliUf, setCliUf] = useState('SP');
  const [cliIe, setCliIe] = useState('');
  const [cliRegime, setCliRegime] = useState<RegimeTributario>('Lucro Real');
  const [cliEmail, setCliEmail] = useState('');
  const [cliTelefone, setCliTelefone] = useState('');
  const [cliObs, setCliObs] = useState('');
  const [submittingCli, setSubmittingCli] = useState(false);
  const [cliMsg, setCliMsg] = useState('');

  useEffect(() => {
    loadData();
  }, [userData]);

  const loadData = async () => {
    setLoading(true);
    try {
      let rawEscritorios: EscritorioItem[] = [];

      if (localStorage.getItem('atlas_demo_admin') === 'true') {
        const savedEsc = JSON.parse(localStorage.getItem('atlas_demo_escritorios') || JSON.stringify([
          { id: "demo-1", nome: "Escritório Modelo Contabilidade", cnpj: "12.345.678/0001-99", ativo: true, emailAdmin: "admin@modelo.com", nomeAdmin: "Admin Modelo" },
          { id: "demo-2", nome: "Contabilidade Silva & Associados", cnpj: "98.765.432/0001-11", ativo: true, emailAdmin: "silva@contab.com", nomeAdmin: "Carlos Silva" }
        ]));
        const savedEv = JSON.parse(localStorage.getItem('atlas_demo_eventos') || JSON.stringify([
          { id: "ev-1", tipo: "login", escritorioId: "demo-1", data: new Date().toISOString() },
          { id: "ev-2", tipo: "sped_importado", escritorioId: "demo-1", data: new Date().toISOString() }
        ]));
        rawEscritorios = savedEsc;
        setEventos(savedEv);
      } else {
        try {
          const escSnap = await getDocs(collection(db, 'escritorios'));
          const evSnap = await getDocs(collection(db, 'eventosUso'));
          
          rawEscritorios = escSnap.docs.map(d => ({ id: d.id, ...d.data() } as EscritorioItem));
          setEventos(evSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (err) {
          console.warn('Carregando do cache/demo local:', err);
          const savedEsc = JSON.parse(localStorage.getItem('atlas_demo_escritorios') || JSON.stringify([
            { id: "demo-1", nome: "Escritório Modelo Contabilidade", cnpj: "12.345.678/0001-99", ativo: true, emailAdmin: "admin@modelo.com", nomeAdmin: "Admin Modelo" }
          ]));
          rawEscritorios = savedEsc;
        }
      }

      if (rawEscritorios.length === 0) {
        rawEscritorios = [
          { id: "demo-1", nome: "Escritório Modelo Contabilidade", cnpj: "12.345.678/0001-99", ativo: true, emailAdmin: "admin@modelo.com", nomeAdmin: "Admin Modelo" }
        ];
      }

      // Fetch clients for each office
      const fullEscritorios: EscritorioItem[] = [];
      const flatClientes: { cliente: Cliente; escritorioNome: string; escritorioId: string }[] = [];

      for (const esc of rawEscritorios) {
        const clis = await fetchClientes(esc.id);
        fullEscritorios.push({ ...esc, clientes: clis });
        clis.forEach(c => {
          flatClientes.push({ cliente: c, escritorioNome: esc.nome, escritorioId: esc.id });
        });
      }

      setEscritorios(fullEscritorios);
      setAllClientes(flatClientes);

      // Load Users
      await loadUsuarios();

      // Keep selected office in sync if open
      if (selectedEscritorioForClients) {
        const updated = fullEscritorios.find(e => e.id === selectedEscritorioForClients.id);
        if (updated) setSelectedEscritorioForClients(updated);
      }
    } catch (e) {
      console.error('Erro ao carregar dados do ADM:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadUsuarios = async () => {
    try {
      const token = await getIdToken(true);
      if (token) {
        const res = await fetch('/api/admin/usuarios', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.usuarios) {
            setUsuariosList(data.usuarios);
            return;
          }
        }
      }
      // Fallback: direct Firestore query
      const snapUsr = await getDocs(collection(db, 'usuarios'));
      const snapEsc = await getDocs(collection(db, 'escritorios'));
      const escMap = new Map<string, string>();
      snapEsc.docs.forEach(d => escMap.set(d.id, d.data().nome));

      const list = snapUsr.docs.map(d => ({
        id: d.id,
        uid: d.id,
        ...d.data(),
        escritorioNome: d.data().escritorioId ? (escMap.get(d.data().escritorioId) || 'Escritório não encontrado') : 'Nenhum (Global)'
      }));
      setUsuariosList(list);
    } catch (e) {
      console.warn('Erro ao carregar lista de usuários:', e);
    }
  };

  // User Actions Handlers
  const handleOpenNewUsuarioModal = () => {
    setEditingUsuario(null);
    setUserFormNome('');
    setUserFormEmail('');
    setUserFormEscritorioId(escritorios.length > 0 ? escritorios[0].id : '');
    setUserFormPapel('colaborador');
    setUserMsg('');
    setShowNewUsuarioModal(true);
  };

  const handleOpenEditUsuarioModal = (usr: any) => {
    setEditingUsuario(usr);
    setUserFormNome(usr.nome || '');
    setUserFormEmail(usr.email || '');
    setUserFormEscritorioId(usr.escritorioId || '');
    setUserFormPapel(usr.papel || 'colaborador');
    setUserMsg('');
    setShowNewUsuarioModal(true);
  };

  const handleSaveUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingUser(true);
    setUserMsg('');

    try {
      const token = await getIdToken(true);
      if (!token) throw new Error('Sessão expirada. Faça login novamente.');

      if (editingUsuario) {
        // Edit existing user binding / papel / nome
        const res = await fetch(`/api/admin/usuarios/${editingUsuario.uid}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            nome: userFormNome,
            papel: userFormPapel,
            escritorioId: userFormEscritorioId
          })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erro ao atualizar usuário.');

        setUserMsg('Usuário e vínculo atualizados com sucesso!');
      } else {
        // Create / invite new user
        const res = await fetch('/api/escritorio/convidar', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            email: userFormEmail,
            nome: userFormNome,
            escritorioId: userFormEscritorioId,
            papel: userFormPapel
          })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erro ao cadastrar usuário.');

        setUserMsg(`Usuário convidado! ${data.linkConvite ? 'Link de primeiro acesso gerado.' : ''}`);
      }

      await loadUsuarios();
      await loadData();
      setTimeout(() => setShowNewUsuarioModal(false), 1200);
    } catch (err: any) {
      setUserMsg(`Erro: ${err.message}`);
    } finally {
      setSubmittingUser(false);
    }
  };

  const handleUpdateUsuarioBinding = async (targetUid: string, targetEscritorioId: string) => {
    try {
      const token = await getIdToken(true);
      if (!token) return;
      const res = await fetch(`/api/admin/usuarios/${targetUid}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ escritorioId: targetEscritorioId })
      });
      if (res.ok) {
        await loadUsuarios();
        await loadData();
      } else {
        const data = await res.json();
        alert(data.error || 'Erro ao alterar vínculo do escritório.');
      }
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    }
  };

  const handleDeleteUsuario = async (targetUid: string, targetNome: string) => {
    if (!confirm(`Tem certeza que deseja remover o usuário "${targetNome}" do sistema e desvincular do escritório?`)) return;
    try {
      const token = await getIdToken(true);
      if (!token) return;
      const res = await fetch(`/api/admin/usuarios/${targetUid}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        await loadUsuarios();
        await loadData();
      } else {
        const data = await res.json();
        alert(data.error || 'Erro ao remover usuário.');
      }
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    }
  };

  const handleGerarLinkConvite = async (targetUid: string) => {
    try {
      const token = await getIdToken(true);
      if (!token) return;
      const res = await fetch(`/api/admin/usuarios/${targetUid}/link-convite`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.linkConvite) {
        await navigator.clipboard.writeText(data.linkConvite);
        setCopiedLinkId(targetUid);
        setTimeout(() => setCopiedLinkId(null), 3500);
      } else {
        alert(data.error || 'Não foi possível gerar o link de convite.');
      }
    } catch (err: any) {
      alert(`Erro ao gerar link de convite: ${err.message}`);
    }
  };

  // Toggle Status Ativo/Inativo
  const handleToggleEscritorioStatus = async (esc: EscritorioItem) => {
    const newStatus = !esc.ativo;
    await safeWrite(async () => {
      const escRef = doc(db, 'escritorios', esc.id);
      await updateDoc(escRef, { ativo: newStatus });
    });

    const currentEscs = JSON.parse(localStorage.getItem('atlas_demo_escritorios') || '[]');
    const idx = currentEscs.findIndex((e: any) => e.id === esc.id);
    if (idx >= 0) {
      currentEscs[idx].ativo = newStatus;
      localStorage.setItem('atlas_demo_escritorios', JSON.stringify(currentEscs));
    }

    await loadData();
  };

  // Delete Escritório
  const handleDeleteEscritorio = async (escId: string) => {
    if (!window.confirm('Tem certeza que deseja remover este escritório contábil? Todos os vínculos serão desativados.')) return;
    await safeWrite(async () => {
      await deleteDoc(doc(db, 'escritorios', escId));
    });

    const currentEscs = JSON.parse(localStorage.getItem('atlas_demo_escritorios') || '[]');
    const filtered = currentEscs.filter((e: any) => e.id !== escId);
    localStorage.setItem('atlas_demo_escritorios', JSON.stringify(filtered));

    if (selectedEscritorioForClients?.id === escId) {
      setSelectedEscritorioForClients(null);
    }

    await loadData();
  };

  // Open Edit Escritório Modal
  const handleStartEditEscritorio = (esc: EscritorioItem) => {
    setEditingEscritorio(esc);
    setEscNome(esc.nome || '');
    setEscCnpj(esc.cnpj || '');
    setEscEmailAdmin(esc.emailAdmin || '');
    setEscNomeAdmin(esc.nomeAdmin || '');
    setEscMsg('');
    setShowNewEscritorioModal(true);
  };

  // Open Create Escritório Modal
  const handleOpenCreateEscritorio = () => {
    setEditingEscritorio(null);
    setEscNome('');
    setEscCnpj('');
    setEscEmailAdmin('');
    setEscNomeAdmin('');
    setEscMsg('');
    setShowNewEscritorioModal(true);
  };

  // Submit Escritório (New or Edit)
  const handleSaveEscritorio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!escNome.trim()) {
      setEscMsg('O nome do escritório é obrigatório.');
      return;
    }

    setSubmittingEsc(true);
    setEscMsg('');

    try {
      if (editingEscritorio) {
        // Edit existing
        const updatedDoc = {
          nome: escNome,
          cnpj: escCnpj,
          emailAdmin: escEmailAdmin,
          nomeAdmin: escNomeAdmin
        };

        await safeWrite(async () => {
          await updateDoc(doc(db, 'escritorios', editingEscritorio.id), updatedDoc);
        });

        const currentEscs = JSON.parse(localStorage.getItem('atlas_demo_escritorios') || '[]');
        const idx = currentEscs.findIndex((x: any) => x.id === editingEscritorio.id);
        if (idx >= 0) {
          currentEscs[idx] = { ...currentEscs[idx], ...updatedDoc };
          localStorage.setItem('atlas_demo_escritorios', JSON.stringify(currentEscs));
        }

        setEscMsg('Escritório atualizado.');
      } else {
        // Create new office
        if (localStorage.getItem('atlas_demo_admin') === 'true') {
          const newEsc = {
            id: 'esc-' + Date.now(),
            nome: escNome,
            cnpj: escCnpj,
            emailAdmin: escEmailAdmin,
            nomeAdmin: escNomeAdmin,
            ativo: true,
            dataCriacao: new Date().toISOString()
          };
          const currentEscs = JSON.parse(localStorage.getItem('atlas_demo_escritorios') || '[]');
          localStorage.setItem('atlas_demo_escritorios', JSON.stringify([...currentEscs, newEsc]));
          setEscMsg('Escritório registrado.');
        } else {
          let success = false;
          try {
            const token = await getIdToken(true);
            if (token) {
              const res = await fetch('/api/admin/escritorios', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                  emailAdmin: escEmailAdmin,
                  nomeAdmin: escNomeAdmin,
                  nomeEscritorio: escNome,
                  cnpj: escCnpj
                })
              });
              if (res.ok) {
                const data = await res.json();
                setEscMsg(`Escritório criado. ${data.linkConvite ? 'Convite enviado.' : ''}`);
                success = true;
              }
            }
          } catch (apiErr) {
            console.warn('API error, saving to Firestore directly:', apiErr);
          }

          if (!success) {
            const escRef = doc(collection(db, 'escritorios'));
            await safeWrite(async () => {
              await setDoc(escRef, {
                nome: escNome,
                cnpj: escCnpj || '',
                ativo: true,
                emailAdmin: escEmailAdmin,
                nomeAdmin: escNomeAdmin,
                dataCriacao: serverTimestamp()
              });
            });

            if (escEmailAdmin) {
              const userDocRef = doc(collection(db, 'usuarios'));
              await safeWrite(async () => {
                await setDoc(userDocRef, {
                  email: escEmailAdmin,
                  nome: escNomeAdmin || escNome,
                  papel: 'admin_escritorio',
                  escritorioId: escRef.id,
                  ativo: true,
                  dataCriacao: serverTimestamp()
                });
              });
            }

            setEscMsg(`Escritório "${escNome}" registrado.`);
          }
        }
      }

      await loadData();
      setTimeout(() => {
        setShowNewEscritorioModal(false);
      }, 1000);
    } catch (err: any) {
      setEscMsg(`Erro: ${err.message || 'Falha ao salvar'}`);
    } finally {
      setSubmittingEsc(false);
    }
  };

  // Open Client Modal
  const handleOpenNewClienteModal = (esc: EscritorioItem) => {
    setTargetEscritorioForNewClient(esc);
    setEditingCliente(null);
    setCliNome('');
    setCliCnpj('');
    setCliUf('SP');
    setCliIe('');
    setCliRegime('Lucro Real');
    setCliEmail('');
    setCliTelefone('');
    setCliObs('');
    setCliMsg('');
    setShowClienteModal(true);
  };

  const handleOpenEditClienteModal = (cliente: Cliente, escId: string) => {
    const esc = escritorios.find(e => e.id === escId) || { id: escId, nome: 'Escritório', ativo: true };
    setTargetEscritorioForNewClient(esc);
    setEditingCliente(cliente);
    setCliNome(cliente.nome);
    setCliCnpj(cliente.cnpj || '');
    setCliUf(cliente.uf || 'SP');
    setCliIe(cliente.ie || '');
    setCliRegime(cliente.regimeTributario || 'Lucro Real');
    setCliEmail(cliente.email || '');
    setCliTelefone(cliente.telefone || '');
    setCliObs(cliente.observacoes || '');
    setCliMsg('');
    setShowClienteModal(true);
  };

  // Submit Client
  const handleSaveCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetEscritorioForNewClient) return;
    if (!cliNome.trim()) {
      setCliMsg('Por favor, informe a Razão Social/Nome do cliente.');
      return;
    }

    setSubmittingCli(true);
    setCliMsg('');

    try {
      await saveCliente({
        id: editingCliente?.id,
        nome: cliNome,
        cnpj: cliCnpj,
        uf: cliUf,
        ie: cliIe,
        regimeTributario: cliRegime,
        email: cliEmail,
        telefone: cliTelefone,
        observacoes: cliObs,
        escritorioId: targetEscritorioForNewClient.id
      }, targetEscritorioForNewClient.id);

      setCliMsg(editingCliente ? 'Cliente atualizado.' : 'Cliente cadastrado.');
      await loadData();
      setTimeout(() => {
        setShowClienteModal(false);
      }, 800);
    } catch (err: any) {
      setCliMsg(`Erro ao salvar cliente: ${err.message || 'Falha de gravação'}`);
    } finally {
      setSubmittingCli(false);
    }
  };

  // Delete Client
  const handleDeleteCliente = async (clienteId: string, escritorioId: string) => {
    if (!window.confirm('Tem certeza que deseja remover este cliente?')) return;
    try {
      await deleteCliente(clienteId, escritorioId);
      await loadData();
    } catch (err) {
      console.error('Erro ao excluir cliente:', err);
    }
  };

  // Filtered Escritórios list
  const filteredEscritorios = escritorios.filter(esc => {
    const term = searchEscritorio.toLowerCase();
    const matchesName = esc.nome.toLowerCase().includes(term);
    const matchesCnpj = (esc.cnpj || '').includes(term);
    const matchesEmail = (esc.emailAdmin || '').toLowerCase().includes(term);
    const matchesAdmin = (esc.nomeAdmin || '').toLowerCase().includes(term);
    return matchesName || matchesCnpj || matchesEmail || matchesAdmin;
  });

  // Filtered All Clientes list
  const filteredAllClientes = allClientes.filter(item => {
    const term = searchCliente.toLowerCase();
    const matchesName = item.cliente.nome.toLowerCase().includes(term);
    const matchesCnpj = (item.cliente.cnpj || '').includes(term);
    const matchesUf = (item.cliente.uf || '').toLowerCase().includes(term);
    const matchesEscritorioName = item.escritorioNome.toLowerCase().includes(term);

    const matchesRegime = filterRegime === 'todos' || item.cliente.regimeTributario === filterRegime;
    const matchesEscritorioId = filterEscritorio === 'todos' || item.escritorioId === filterEscritorio;

    return (matchesName || matchesCnpj || matchesUf || matchesEscritorioName) && matchesRegime && matchesEscritorioId;
  });

  // Filtered Usuarios List
  const filteredUsuarios = usuariosList.filter(u => {
    const term = searchUsuario.toLowerCase();
    const matchesName = (u.nome || '').toLowerCase().includes(term);
    const matchesEmail = (u.email || '').toLowerCase().includes(term);
    const matchesEscritorioName = (u.escritorioNome || '').toLowerCase().includes(term);

    const matchesEscritorio = filterUsuarioEscritorio === 'todos' || u.escritorioId === filterUsuarioEscritorio;
    const matchesPapel = filterUsuarioPapel === 'todos' || u.papel === filterUsuarioPapel;

    return (matchesName || matchesEmail || matchesEscritorioName) && matchesEscritorio && matchesPapel;
  });

  // Sample events fallback
  const sampleDefaultEvents = useMemo(() => [
    {
      id: "ev-conf-1",
      tipo: "conferencia_arquivo",
      userId: "usr-101",
      userEmail: "carlos.silva@modelo.com",
      userNome: "Carlos Silva",
      escritorioId: "demo-1",
      escritorioNome: "Escritório Modelo Contabilidade",
      empresaNome: "Supermercado Progresso LTDA",
      arquivoNome: "SPED_EFD_082026_PROGRESSO.txt",
      resumo: "Conferência SPED vs XMLs Terceiros (2.450 notas auditadas)",
      primeiroAcesso: new Date(Date.now() - 1000 * 60 * 39 - 245000).toISOString(),
      conclusao: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
      tempoSegundos: 245,
      tempoFormatado: "04m 05s",
      data: new Date(Date.now() - 1000 * 60 * 35).toISOString()
    },
    {
      id: "ev-conf-2",
      tipo: "conferencia_arquivo",
      userId: "usr-102",
      userEmail: "ana.paula@modelo.com",
      userNome: "Ana Paula Souza",
      escritorioId: "demo-1",
      escritorioNome: "Escritório Modelo Contabilidade",
      empresaNome: "Distribuidora de Bebidas Alfa S/A",
      arquivoNome: "SPED_EFD_072026_ALFA.txt",
      resumo: "Auditoria Bloco H (Estoque) e Reconciliação de Inventário",
      primeiroAcesso: new Date(Date.now() - 1000 * 60 * 186 - 410000).toISOString(),
      conclusao: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
      tempoSegundos: 410,
      tempoFormatado: "06m 50s",
      data: new Date(Date.now() - 1000 * 60 * 180).toISOString()
    },
    {
      id: "ev-conf-3",
      tipo: "conferencia_arquivo",
      userId: "usr-101",
      userEmail: "carlos.silva@modelo.com",
      userNome: "Carlos Silva",
      escritorioId: "demo-1",
      escritorioNome: "Escritório Modelo Contabilidade",
      empresaNome: "Indústria Metalúrgica Delta LTDA",
      arquivoNome: "XML_ENTRADAS_DELTA_082026.zip",
      resumo: "Conferência de Notas Omissas e Quebra de Sequência",
      primeiroAcesso: new Date(Date.now() - 1000 * 60 * 423 - 190000).toISOString(),
      conclusao: new Date(Date.now() - 1000 * 60 * 420).toISOString(),
      tempoSegundos: 190,
      tempoFormatado: "03m 10s",
      data: new Date(Date.now() - 1000 * 60 * 420).toISOString()
    },
    {
      id: "ev-conf-4",
      tipo: "conferencia_arquivo",
      userId: "usr-103",
      userEmail: "roberto.lima@contab.com",
      userNome: "Roberto Lima",
      escritorioId: "demo-2",
      escritorioNome: "Contabilidade Silva & Associados",
      empresaNome: "Farmácia Central de Campinas EIRELI",
      arquivoNome: "SPED_EFD_082026_FARMACIA.txt",
      resumo: "Apuração de PIS/COFINS e Alíquotas por NCM",
      primeiroAcesso: new Date(Date.now() - 1000 * 60 * 805 - 315000).toISOString(),
      conclusao: new Date(Date.now() - 1000 * 60 * 800).toISOString(),
      tempoSegundos: 315,
      tempoFormatado: "05m 15s",
      data: new Date(Date.now() - 1000 * 60 * 800).toISOString()
    },
    {
      id: "ev-log-1",
      tipo: "login",
      userId: "usr-101",
      userEmail: "carlos.silva@modelo.com",
      userNome: "Carlos Silva",
      escritorioId: "demo-1",
      escritorioNome: "Escritório Modelo Contabilidade",
      papel: "admin_escritorio",
      data: new Date(Date.now() - 1000 * 60 * 40).toISOString()
    },
    {
      id: "ev-log-2",
      tipo: "login",
      userId: "usr-102",
      userEmail: "ana.paula@modelo.com",
      userNome: "Ana Paula Souza",
      escritorioId: "demo-1",
      escritorioNome: "Escritório Modelo Contabilidade",
      papel: "colaborador",
      data: new Date(Date.now() - 1000 * 60 * 190).toISOString()
    },
    {
      id: "ev-log-3",
      tipo: "login",
      userId: "usr-103",
      userEmail: "roberto.lima@contab.com",
      userNome: "Roberto Lima",
      escritorioId: "demo-2",
      escritorioNome: "Contabilidade Silva & Associados",
      papel: "admin_escritorio",
      data: new Date(Date.now() - 1000 * 60 * 810).toISOString()
    }
  ], []);

  // Filtered Events with RBAC
  const userEscritorioId = userData?.escritorioId;
  const isSuperAdminUser = userData?.papel === 'super_admin';

  const baseEvents = useMemo(() => {
    let list = [...eventos];
    if (!isSuperAdminUser && userEscritorioId) {
      list = list.filter(e => !e.escritorioId || e.escritorioId === userEscritorioId);
    }
    return list;
  }, [eventos, isSuperAdminUser, userEscritorioId]);

  // Filtered Logins
  const filteredLogins = useMemo(() => {
    return baseEvents.filter(ev => {
      if (ev.tipo !== 'login') return false;

      const term = reportSearch.toLowerCase().trim();
      if (term) {
        const matchesName = (ev.userNome || '').toLowerCase().includes(term);
        const matchesEmail = (ev.userEmail || '').toLowerCase().includes(term);
        const matchesEsc = (ev.escritorioNome || ev.escritorioId || '').toLowerCase().includes(term);
        if (!matchesName && !matchesEmail && !matchesEsc) return false;
      }

      if (reportOfficeFilter !== 'todos' && ev.escritorioId !== reportOfficeFilter) {
        return false;
      }

      if (reportDateFilter !== 'todos' && ev.data) {
        const evTime = new Date(ev.data).getTime();
        const now = Date.now();
        if (reportDateFilter === 'hoje' && evTime < now - 86400000) return false;
        if (reportDateFilter === '7dias' && evTime < now - 7 * 86400000) return false;
        if (reportDateFilter === '30dias' && evTime < now - 30 * 86400000) return false;
      }

      return true;
    });
  }, [baseEvents, reportSearch, reportOfficeFilter, reportDateFilter]);

  // Filtered Conferences
  const filteredConferencias = useMemo(() => {
    return baseEvents.filter(ev => {
      if (ev.tipo !== 'conferencia_arquivo' && ev.tipo !== 'sped_importado' && ev.tipo !== 'xml_importado') {
        return false;
      }

      const term = reportSearch.toLowerCase().trim();
      if (term) {
        const matchesEmpresa = (ev.empresaNome || '').toLowerCase().includes(term);
        const matchesArq = (ev.arquivoNome || '').toLowerCase().includes(term);
        const matchesResumo = (ev.resumo || '').toLowerCase().includes(term);
        const matchesUser = (ev.userNome || ev.userEmail || '').toLowerCase().includes(term);
        if (!matchesEmpresa && !matchesArq && !matchesResumo && !matchesUser) return false;
      }

      if (reportOfficeFilter !== 'todos' && ev.escritorioId !== reportOfficeFilter) {
        return false;
      }

      if (reportDateFilter !== 'todos' && ev.data) {
        const evTime = new Date(ev.data).getTime();
        const now = Date.now();
        if (reportDateFilter === 'hoje' && evTime < now - 86400000) return false;
        if (reportDateFilter === '7dias' && evTime < now - 7 * 86400000) return false;
        if (reportDateFilter === '30dias' && evTime < now - 30 * 86400000) return false;
      }

      return true;
    });
  }, [baseEvents, reportSearch, reportOfficeFilter, reportDateFilter]);

  // Conference Metrics
  const totalConferenciasCount = filteredConferencias.length;
  const totalConferenciaSegundos = filteredConferencias.reduce((acc, c) => acc + (c.tempoSegundos || 210), 0);
  const avgConferenciaSegundos = Math.round(totalConferenciaSegundos / (totalConferenciasCount || 1));

  // Empresa mais auditada
  const empresaMaisAuditada = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredConferencias.forEach(c => {
      const emp = c.empresaNome || 'Não informada';
      counts[emp] = (counts[emp] || 0) + 1;
    });
    let topEmp = 'Nenhuma';
    let max = 0;
    Object.entries(counts).forEach(([emp, count]) => {
      if (count > max) {
        max = count;
        topEmp = emp;
      }
    });
    return topEmp;
  }, [filteredConferencias]);

  // Export Logins PDF
  const handleExportLoginsPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    let cursorY = 15;

    doc.setFillColor(30, 58, 95);
    doc.rect(0, 0, pageWidth, 28, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(255, 255, 255);
    doc.text('ATLAS AUDITOR FISCAL — RELATÓRIO DE LOGINS E ACESSOS', 14, 16);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')} | Painel Administrativo`, 14, 23);

    cursorY = 38;

    doc.setFillColor(241, 239, 232);
    doc.rect(14, cursorY, pageWidth - 28, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 58, 95);
    doc.text('Usuário / E-mail', 16, cursorY + 5.5);
    doc.text('Papel / Nível', 85, cursorY + 5.5);
    doc.text('Escritório', 125, cursorY + 5.5);
    doc.text('Data e Hora', 165, cursorY + 5.5);

    cursorY += 12;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);

    filteredLogins.forEach((ev) => {
      if (cursorY > 270) {
        doc.addPage();
        cursorY = 20;
      }
      const nome = (ev.userNome || ev.userEmail || 'Usuário').substring(0, 32);
      const papel = ev.papel === 'super_admin' ? 'Super Admin' : ev.papel === 'admin_escritorio' ? 'Admin Escritório' : 'Colaborador';
      const esc = (ev.escritorioNome || ev.escritorioId || 'Modelo').substring(0, 20);
      const dataStr = ev.data ? new Date(ev.data).toLocaleString('pt-BR') : 'Recente';

      doc.text(nome, 16, cursorY);
      doc.text(papel, 85, cursorY);
      doc.text(esc, 125, cursorY);
      doc.text(dataStr, 165, cursorY);

      cursorY += 7;
    });

    doc.save(`Relatorio_Logins_Atlas_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  // Export Logins CSV
  const handleExportLoginsCSV = () => {
    const headers = ['Usuario', 'Email', 'Papel', 'Escritorio', 'Data_Hora'];
    const rows = filteredLogins.map(l => [
      `"${l.userNome || ''}"`,
      `"${l.userEmail || ''}"`,
      `"${l.papel || ''}"`,
      `"${l.escritorioNome || l.escritorioId || ''}"`,
      `"${l.data ? new Date(l.data).toLocaleString('pt-BR') : ''}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Logins_Usuarios_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  // Export Conferencias PDF
  const handleExportConferenciasPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    let cursorY = 15;

    doc.setFillColor(15, 110, 86);
    doc.rect(0, 0, pageWidth, 28, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.text('RELATÓRIO DE TEMPO DE CONFERÊNCIA E AUDITORIA POR EMPRESA', 14, 16);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')} | Relatório Administrativo`, 14, 23);

    cursorY = 38;

    doc.setFillColor(241, 239, 232);
    doc.rect(14, cursorY, pageWidth - 28, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(30, 58, 95);
    doc.text('Empresa / Cliente', 16, cursorY + 5.5);
    doc.text('Arquivo', 60, cursorY + 5.5);
    doc.text('Início', 100, cursorY + 5.5);
    doc.text('Conclusão', 128, cursorY + 5.5);
    doc.text('Tempo', 156, cursorY + 5.5);
    doc.text('Auditor', 178, cursorY + 5.5);

    cursorY += 12;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 41, 59);

    filteredConferencias.forEach((ev) => {
      if (cursorY > 270) {
        doc.addPage();
        cursorY = 20;
      }
      const empresa = (ev.empresaNome || 'Empresa').substring(0, 22);
      const arq = (ev.arquivoNome || 'Arquivo.txt').substring(0, 18);
      
      const inicioStr = ev.primeiroAcesso 
        ? new Date(ev.primeiroAcesso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : (ev.data ? new Date(new Date(ev.data).getTime() - (ev.tempoSegundos || 180) * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-');

      const conclusaoStr = ev.conclusao 
        ? new Date(ev.conclusao).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : (ev.data ? new Date(ev.data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-');

      const tempo = ev.tempoFormatado || formatTempoConferencia(ev.tempoSegundos || 180);
      const auditor = (ev.userNome || ev.userEmail || 'Auditor').substring(0, 14);

      doc.text(empresa, 16, cursorY);
      doc.text(arq, 60, cursorY);
      doc.text(inicioStr, 100, cursorY);
      doc.text(conclusaoStr, 128, cursorY);
      doc.setFont('helvetica', 'bold');
      doc.text(tempo, 156, cursorY);
      doc.setFont('helvetica', 'normal');
      doc.text(auditor, 178, cursorY);

      cursorY += 7;
    });

    doc.save(`Relatorio_Tempo_Conferencia_Empresas_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  // Export Conferencias CSV
  const handleExportConferenciasCSV = () => {
    const headers = [
      'Empresa',
      'Arquivo',
      'Primeiro_Acesso_Inicio',
      'Conclusao_Auditoria',
      'Tempo_Decorido_Segundos',
      'Tempo_Formatado',
      'Resumo_Atividade',
      'Auditor_Responsavel',
      'Email_Auditor',
      'Data_Registro'
    ];

    const rows = filteredConferencias.map(c => {
      const inicioStr = c.primeiroAcesso 
        ? new Date(c.primeiroAcesso).toLocaleString('pt-BR')
        : (c.data ? new Date(new Date(c.data).getTime() - (c.tempoSegundos || 180) * 1000).toLocaleString('pt-BR') : '');

      const conclusaoStr = c.conclusao 
        ? new Date(c.conclusao).toLocaleString('pt-BR')
        : (c.data ? new Date(c.data).toLocaleString('pt-BR') : '');

      return [
        `"${c.empresaNome || ''}"`,
        `"${c.arquivoNome || ''}"`,
        `"${inicioStr}"`,
        `"${conclusaoStr}"`,
        c.tempoSegundos || 0,
        `"${c.tempoFormatado || formatTempoConferencia(c.tempoSegundos || 0)}"`,
        `"${c.resumo || ''}"`,
        `"${c.userNome || ''}"`,
        `"${c.userEmail || ''}"`,
        `"${c.data ? new Date(c.data).toLocaleString('pt-BR') : ''}"`
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Tempo_Conferencia_Empresas_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const totalEscritoriosAtivos = escritorios.filter(e => e.ativo).length;
  const totalClientes = allClientes.length;
  const spedsMes = eventos.filter(e => e.tipo === 'sped_importado').length;

  const isAuthorizedAdmin = userData?.papel === 'super_admin' || userData?.papel === 'admin_escritorio';

  if (!isAuthorizedAdmin) {
    return (
      <div className="max-w-3xl mx-auto my-12 p-8 bg-white rounded-2xl border border-slate-200 shadow-md text-center space-y-4">
        <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Acesso Restrito ao Painel Administrativo</h2>
        <p className="text-sm text-slate-600 max-w-lg mx-auto">
          Este painel e seus relatórios de logins e conferências por empresa são visíveis apenas para usuários com hierarquia de <strong>Admin Escritório</strong> ou superior (<strong>Super Admin</strong>).
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#1e3a5f] p-6 rounded-xl text-white shadow-sm">
        <div>
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
            <h1 className="text-2xl font-bold tracking-tight">Painel de Administração Global (ADM)</h1>
          </div>
          <p className="text-slate-300 text-sm mt-1">
            Gestão centralizada de Escritórios Contábeis e carteira unificada de clientes vinculados.
          </p>
        </div>

        <div className="flex items-center space-x-3 shrink-0">
          <button
            onClick={loadData}
            className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold backdrop-blur-xs transition-all flex items-center space-x-1.5"
            title="Atualizar Dados"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Atualizar</span>
          </button>
          
          <button
            onClick={handleOpenCreateEscritorio}
            className="px-4 py-2.5 bg-[#0f6e56] hover:bg-[#0c5945] text-white rounded-lg text-xs font-bold shadow-xs transition-all flex items-center space-x-2"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Novo Escritório</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Escritórios Ativos</p>
            <div className="flex items-baseline space-x-2 mt-1">
              <span className="text-2xl font-black text-slate-900">{totalEscritoriosAtivos}</span>
              <span className="text-xs text-slate-400">/ {escritorios.length} total</span>
            </div>
          </div>
          <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center shrink-0">
            <Building2 className="w-6 h-6 text-[#1e3a5f]" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total de Clientes</p>
            <div className="flex items-baseline space-x-2 mt-1">
              <span className="text-2xl font-black text-slate-900">{totalClientes}</span>
              <span className="text-xs text-emerald-600 font-semibold">Empresas</span>
            </div>
          </div>
          <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center shrink-0">
            <Users className="w-6 h-6 text-[#1e3a5f]" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">SPEDs Processados</p>
            <div className="flex items-baseline space-x-2 mt-1">
              <span className="text-2xl font-black text-slate-900">{spedsMes}</span>
              <span className="text-xs text-slate-400">arquivos</span>
            </div>
          </div>
          <div className="w-12 h-12 bg-emerald-50 rounded-lg flex items-center justify-center shrink-0">
            <Activity className="w-6 h-6 text-[#0f6e56]" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Status do Sistema</p>
            <div className="flex items-center space-x-1.5 mt-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-xs font-bold text-emerald-700">Multi-tenant Ativo</span>
            </div>
          </div>
          <div className="w-12 h-12 bg-[#f1efe8] rounded-lg flex items-center justify-center shrink-0">
            <Sparkles className="w-6 h-6 text-[#1e3a5f]" />
          </div>
        </div>
      </div>

      {/* Main Tabs Header */}
      <div className="flex border-b border-slate-200 space-x-6">
        <button
          onClick={() => setActiveTab('escritorios')}
          className={`pb-3 text-sm font-bold flex items-center space-x-2 transition-colors border-b-2 ${
            activeTab === 'escritorios'
              ? 'border-[#1e3a5f] text-[#1e3a5f]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Escritórios Contábeis ({escritorios.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('clientes')}
          className={`pb-3 text-sm font-bold flex items-center space-x-2 transition-colors border-b-2 ${
            activeTab === 'clientes'
              ? 'border-[#1e3a5f] text-[#1e3a5f]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Visão Geral dos Clientes ({totalClientes})</span>
        </button>

        <button
          onClick={() => setActiveTab('usuarios')}
          className={`pb-3 text-sm font-bold flex items-center space-x-2 transition-colors border-b-2 ${
            activeTab === 'usuarios'
              ? 'border-[#1e3a5f] text-[#1e3a5f]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <UserPlus className="w-4 h-4" />
          <span>Gestão de Usuários & Vínculos ({usuariosList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`pb-3 text-sm font-bold flex items-center space-x-2 transition-colors border-b-2 ${
            activeTab === 'logs'
              ? 'border-[#1e3a5f] text-[#1e3a5f]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BarChart2 className="w-4 h-4 text-[#0f6e56]" />
          <span>Relatórios ADM (Logins & Tempo)</span>
        </button>
      </div>

      {/* TAB 1: ESCRITÓRIOS CONTÁBEIS */}
      {activeTab === 'escritorios' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar escritório por nome, CNPJ ou e-mail do admin..."
                value={searchEscritorio}
                onChange={e => setSearchEscritorio(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
              />
              {searchEscritorio && (
                <button onClick={() => setSearchEscritorio('')} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <button
              onClick={handleOpenCreateEscritorio}
              className="px-4 py-2 bg-[#1e3a5f] hover:bg-[#142c47] text-white rounded-lg text-xs font-semibold shadow-2xs transition-all flex items-center justify-center space-x-1.5 shrink-0"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Cadastrar Novo Escritório</span>
            </button>
          </div>

          {/* Escritórios Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredEscritorios.map(esc => {
              const numClientes = esc.clientes?.length || 0;
              return (
                <div 
                  key={esc.id}
                  className={`bg-white rounded-xl border transition-all shadow-2xs hover:shadow-md flex flex-col justify-between overflow-hidden ${
                    esc.ativo ? 'border-slate-200' : 'border-red-200 bg-red-50/20'
                  }`}
                >
                  <div className="p-5 space-y-4">
                    {/* Card Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center space-x-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                          esc.ativo ? 'bg-[#1e3a5f] text-white' : 'bg-slate-200 text-slate-600'
                        }`}>
                          <Building className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 text-base leading-snug line-clamp-1">{esc.nome}</h3>
                          <p className="text-xs text-slate-500 font-mono">CNPJ: {esc.cnpj || 'Não informado'}</p>
                        </div>
                      </div>

                      <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full shrink-0 flex items-center space-x-1 ${
                        esc.ativo ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {esc.ativo ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                        <span>{esc.ativo ? 'Ativo' : 'Inativo'}</span>
                      </span>
                    </div>

                    {/* Admin Info */}
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-1 text-xs">
                      <div className="flex items-center text-slate-700">
                        <UserCheck className="w-3.5 h-3.5 text-[#1e3a5f] mr-1.5 shrink-0" />
                        <span className="font-medium text-slate-900 truncate">{esc.nomeAdmin || 'Admin não definido'}</span>
                      </div>
                      <div className="flex items-center text-slate-500">
                        <Mail className="w-3.5 h-3.5 text-slate-400 mr-1.5 shrink-0" />
                        <span className="truncate">{esc.emailAdmin || 'E-mail não informado'}</span>
                      </div>
                    </div>

                    {/* Stats bar */}
                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="text-slate-500 font-medium">Clientes Vinculados:</span>
                      <span className="px-2.5 py-0.5 bg-[#f1efe8] text-[#1e3a5f] font-bold rounded-full border border-[#e5e2d9]">
                        {numClientes} cliente{numClientes !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  {/* Card Actions Footer */}
                  <div className="bg-slate-50 px-5 py-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      onClick={() => setSelectedEscritorioForClients(esc)}
                      className="px-3 py-1.5 bg-[#f1efe8] hover:bg-[#e5e2d9] text-[#1e3a5f] rounded-lg text-xs font-bold transition-colors flex items-center space-x-1"
                      title="Ver Clientes do Escritório"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Clientes ({numClientes})</span>
                    </button>

                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => handleOpenNewClienteModal(esc)}
                        className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        title="Adicionar Cliente a este Escritório"
                      >
                        <UserPlus className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleStartEditEscritorio(esc)}
                        className="p-1.5 text-slate-600 hover:text-[#1e3a5f] hover:bg-[#f1efe8] rounded-lg transition-colors"
                        title="Editar Escritório"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleToggleEscritorioStatus(esc)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          esc.ativo ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50'
                        }`}
                        title={esc.ativo ? 'Desativar Escritório' : 'Ativar Escritório'}
                      >
                        {esc.ativo ? <XCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                      </button>

                      <button
                        onClick={() => handleDeleteEscritorio(esc.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Remover Escritório"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredEscritorios.length === 0 && (
              <div className="col-span-full p-12 text-center bg-white rounded-xl border border-slate-200">
                <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-800">Nenhum escritório encontrado</h3>
                <p className="text-slate-500 text-xs mt-1">Tente ajustar o termo de busca ou cadastre um novo escritório contábil.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: VISÃO GERAL DE TODOS OS CLIENTES */}
      {activeTab === 'clientes' && (
        <div className="space-y-4 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          {/* Filter Toolbar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por cliente, CNPJ ou UF..."
                value={searchCliente}
                onChange={e => setSearchCliente(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
              />
            </div>

            <div>
              <select
                value={filterEscritorio}
                onChange={e => setFilterEscritorio(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
              >
                <option value="todos">Todos os Escritórios Contábeis</option>
                {escritorios.map(e => (
                  <option key={e.id} value={e.id}>{e.nome}</option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={filterRegime}
                onChange={e => setFilterRegime(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
              >
                <option value="todos">Todos os Regimes Tributários</option>
                <option value="Lucro Real">Lucro Real</option>
                <option value="Lucro Presumido">Lucro Presumido</option>
                <option value="Simples Nacional">Simples Nacional</option>
                <option value="MEI">MEI</option>
              </select>
            </div>
          </div>

          {/* Clientes Table */}
          <div className="overflow-x-auto border border-slate-100 rounded-lg">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="p-3">Razão Social / Cliente</th>
                  <th className="p-3">CNPJ / UF</th>
                  <th className="p-3">Escritório Responsável</th>
                  <th className="p-3">Regime Tributário</th>
                  <th className="p-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAllClientes.map(({ cliente, escritorioNome, escritorioId }, idx) => (
                  <tr key={`${escritorioId}_${cliente.id}_${idx}`} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3">
                      <div className="font-bold text-slate-900 text-sm">{cliente.nome}</div>
                      <div className="text-[11px] text-slate-500">{cliente.email || 'Sem e-mail cadastrado'}</div>
                    </td>
                    <td className="p-3 font-mono">
                      <div>{cliente.cnpj || 'N/I'}</div>
                      <span className="px-1.5 py-0.5 text-[10px] bg-slate-100 text-slate-600 rounded font-semibold uppercase">{cliente.uf || 'SP'}</span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center space-x-1.5 text-slate-800 font-semibold">
                        <Building2 className="w-3.5 h-3.5 text-[#1e3a5f]" />
                        <span>{escritorioNome}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 font-bold rounded-md text-[11px] ${
                        cliente.regimeTributario === 'Lucro Real' ? 'bg-[#f1efe8] text-[#1e3a5f] border border-[#e5e2d9]' :
                        cliente.regimeTributario === 'Lucro Presumido' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                        'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}>
                        {cliente.regimeTributario}
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-2">
                      <button
                        onClick={() => handleOpenEditClienteModal(cliente, escritorioId)}
                        className="p-1.5 text-slate-500 hover:text-[#1e3a5f] hover:bg-[#f1efe8] rounded-lg"
                        title="Editar Cliente"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteCliente(cliente.id, escritorioId)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                        title="Remover Cliente"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}

                {filteredAllClientes.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500">
                      Nenhum cliente cadastrado com os filtros selecionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: GESTÃO DE USUÁRIOS & VÍNCULOS DE ESCRITÓRIO */}
      {activeTab === 'usuarios' && (
        <div className="space-y-4 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por nome, e-mail ou escritório..."
                  value={searchUsuario}
                  onChange={e => setSearchUsuario(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
                />
              </div>

              <div>
                <select
                  value={filterUsuarioEscritorio}
                  onChange={e => setFilterUsuarioEscritorio(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
                >
                  <option value="todos">Todos os Escritórios Contábeis</option>
                  {escritorios.map(e => (
                    <option key={e.id} value={e.id}>{e.nome}</option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={filterUsuarioPapel}
                  onChange={e => setFilterUsuarioPapel(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
                >
                  <option value="todos">Todos os Papéis</option>
                  <option value="super_admin">Super Admin</option>
                  <option value="admin_escritorio">Admin do Escritório</option>
                  <option value="colaborador">Colaborador</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleOpenNewUsuarioModal}
              className="px-4 py-2 bg-[#0f6e56] hover:bg-[#0c5945] text-white rounded-lg text-xs font-bold shadow-2xs transition-all flex items-center justify-center space-x-1.5 shrink-0"
            >
              <UserPlus className="w-4 h-4" />
              <span>Convidar / Cadastrar Usuário</span>
            </button>
          </div>

          {/* Users Table */}
          <div className="overflow-x-auto border border-slate-100 rounded-lg mt-3">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="p-3">Usuário / E-mail</th>
                  <th className="p-3">Escritório Vinculado</th>
                  <th className="p-3">Papel / Função</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Ações de Vínculo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsuarios.map(usr => (
                  <tr key={usr.id || usr.uid} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3">
                      <div className="font-bold text-slate-900">{usr.nome || 'Sem Nome'}</div>
                      <div className="text-[11px] text-slate-500">{usr.email}</div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center space-x-2">
                        <select
                          value={usr.escritorioId || ''}
                          onChange={(e) => handleUpdateUsuarioBinding(usr.uid || usr.id, e.target.value)}
                          className="p-1.5 border border-slate-200 rounded-md text-xs font-medium bg-white hover:border-slate-300 focus:ring-1 focus:ring-[#1e3a5f]"
                        >
                          <option value="">Sem Escritório (Global)</option>
                          {escritorios.map(esc => (
                            <option key={esc.id} value={esc.id}>{esc.nome}</option>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
                        usr.papel === 'super_admin' ? 'bg-purple-100 text-purple-800' :
                        usr.papel === 'admin_escritorio' ? 'bg-blue-100 text-blue-800' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {usr.papel === 'super_admin' ? 'Super Admin' :
                         usr.papel === 'admin_escritorio' ? 'Admin Escritório' : 'Colaborador'}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        usr.ativo !== false ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {usr.ativo !== false ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleGerarLinkConvite(usr.uid || usr.id)}
                          className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-[11px] font-semibold transition-colors flex items-center space-x-1"
                          title="Gerar e Copiar Link de Primeiro Acesso"
                        >
                          {copiedLinkId === (usr.uid || usr.id) ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-emerald-700">Link Copiado!</span>
                            </>
                          ) : (
                            <>
                              <Mail className="w-3.5 h-3.5" />
                              <span>Link Convite</span>
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => handleOpenEditUsuarioModal(usr)}
                          className="p-1.5 text-slate-600 hover:text-[#1e3a5f] hover:bg-slate-100 rounded transition-colors"
                          title="Editar Dados do Usuário"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleDeleteUsuario(usr.uid || usr.id, usr.nome || usr.email)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Remover e Desvincular Usuário"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredUsuarios.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400 font-medium">
                      Nenhum usuário encontrado com os filtros selecionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100">
            <UserHierarchyCard />
          </div>
        </div>
      )}

      {/* TAB 4: RELATÓRIOS ADM (LOGINS E TEMPO DE CONFERÊNCIA) */}
      {activeTab === 'logs' && (
        <div className="space-y-6">
          {/* Sub-Header / Controls Bar */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                  <BarChart2 className="w-5 h-5 text-[#1e3a5f]" />
                  <span>Relatórios de Acesso, Produtividade & Conferência</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Relatório auditável restrito a Administradores do Sistema.
                </p>
              </div>

              {/* Sub-Tab Switcher */}
              <div className="flex items-center bg-slate-100 p-1 rounded-lg">
                <button
                  onClick={() => setReportSubTab('logins')}
                  className={`px-4 py-2 rounded-md text-xs font-bold transition-all flex items-center space-x-2 ${
                    reportSubTab === 'logins'
                      ? 'bg-white text-[#1e3a5f] shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Logins de Usuários ({filteredLogins.length})</span>
                </button>

                <button
                  onClick={() => setReportSubTab('conferencias')}
                  className={`px-4 py-2 rounded-md text-xs font-bold transition-all flex items-center space-x-2 ${
                    reportSubTab === 'conferencias'
                      ? 'bg-white text-[#0f6e56] shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Tempo de Conferência ({filteredConferencias.length})</span>
                </button>
              </div>
            </div>

            {/* Filters and Export Actions */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
              <div className="flex flex-1 flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder={
                      reportSubTab === 'logins'
                        ? "Buscar por nome do usuário, e-mail ou escritório..."
                        : "Buscar por empresa, nome do arquivo, resumo ou auditor..."
                    }
                    value={reportSearch}
                    onChange={e => setReportSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
                  />
                  {reportSearch && (
                    <button onClick={() => setReportSearch('')} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Date Filter */}
                <select
                  value={reportDateFilter}
                  onChange={e => setReportDateFilter(e.target.value as any)}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
                >
                  <option value="todos">Período: Todos</option>
                  <option value="hoje">Período: Hoje</option>
                  <option value="7dias">Período: Últimos 7 dias</option>
                  <option value="30dias">Período: Últimos 30 dias</option>
                </select>

                {/* Office Filter (for super_admin) */}
                {isSuperAdminUser && (
                  <select
                    value={reportOfficeFilter}
                    onChange={e => setReportOfficeFilter(e.target.value)}
                    className="px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
                  >
                    <option value="todos">Todos os Escritórios</option>
                    {escritorios.map(e => (
                      <option key={e.id} value={e.id}>{e.nome}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Export Buttons */}
              <div className="flex items-center space-x-2 shrink-0">
                <button
                  onClick={reportSubTab === 'logins' ? handleExportLoginsCSV : handleExportConferenciasCSV}
                  className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1.5"
                  title="Exportar em formato Planilha CSV/Excel"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                  <span>Exportar Excel (CSV)</span>
                </button>

                <button
                  onClick={reportSubTab === 'logins' ? handleExportLoginsPDF : handleExportConferenciasPDF}
                  className="px-3 py-2 bg-[#1e3a5f] hover:bg-[#142c47] text-white rounded-lg text-xs font-semibold transition-all flex items-center space-x-1.5 shadow-2xs"
                  title="Exportar Relatório PDF formatado"
                >
                  <Download className="w-4 h-4" />
                  <span>Exportar PDF</span>
                </button>
              </div>
            </div>
          </div>

          {/* SUB-TAB 1: LOGINS DE USUÁRIOS */}
          {reportSubTab === 'logins' && (
            <div className="space-y-4">
              {/* KPI Cards for Logins */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total de Logins</p>
                    <span className="text-2xl font-black text-slate-900 mt-1 block">{filteredLogins.length}</span>
                  </div>
                  <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                    <LogIn className="w-5 h-5 text-[#1e3a5f]" />
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Usuários Distintos</p>
                    <span className="text-2xl font-black text-slate-900 mt-1 block">
                      {new Set(filteredLogins.map(l => l.userEmail || l.userId)).size}
                    </span>
                  </div>
                  <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
                    <Users className="w-5 h-5 text-[#0f6e56]" />
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Status do Filtro</p>
                    <span className="text-xs font-bold text-slate-700 mt-1 block">
                      {reportDateFilter === 'todos' ? 'Todo o histórico' : reportDateFilter}
                    </span>
                  </div>
                  <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5 text-blue-700" />
                  </div>
                </div>
              </div>

              {/* Logins Table */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider">
                      <tr>
                        <th className="p-3.5">Usuário / Identificação</th>
                        <th className="p-3.5">Papel / Nível</th>
                        <th className="p-3.5">Escritório / Vínculo</th>
                        <th className="p-3.5">Data e Hora do Acesso</th>
                        <th className="p-3.5 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredLogins.map((item, idx) => (
                        <tr key={item.id || idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3.5">
                            <div className="flex items-center space-x-2.5">
                              <div className="w-7 h-7 bg-slate-100 text-[#1e3a5f] font-bold rounded-full flex items-center justify-center text-xs border border-slate-200">
                                {(item.userNome || item.userEmail || 'U').charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-bold text-slate-900">{item.userNome || 'Usuário do Sistema'}</p>
                                <p className="text-[11px] text-slate-500">{item.userEmail || 'email@dominio.com'}</p>
                              </div>
                            </div>
                          </td>

                          <td className="p-3.5">
                            <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] uppercase inline-block ${
                              item.papel === 'super_admin'
                                ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                : item.papel === 'admin_escritorio'
                                ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}>
                              {item.papel === 'super_admin' ? 'Super Admin' : item.papel === 'admin_escritorio' ? 'Admin Escritório' : 'Colaborador'}
                            </span>
                          </td>

                          <td className="p-3.5 text-slate-700 font-medium">
                            {item.escritorioNome || item.escritorioId || 'Escritório Modelo'}
                          </td>

                          <td className="p-3.5 font-mono text-slate-600">
                            {item.data ? new Date(item.data).toLocaleString('pt-BR') : 'Data recente'}
                          </td>

                          <td className="p-3.5 text-center">
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full font-bold text-[10px] border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Autenticado</span>
                            </span>
                          </td>
                        </tr>
                      ))}

                      {filteredLogins.length === 0 && (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-slate-400 font-medium">
                            Nenhum registro de login encontrado com os parâmetros selecionados.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* SUB-TAB 2: TEMPO DE CONFERÊNCIA DE ARQUIVOS FISCAIS */}
          {reportSubTab === 'conferencias' && (
            <div className="space-y-4">
              {/* KPI Cards for Conferences */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Conferências Realizadas</p>
                    <span className="text-2xl font-black text-slate-900 mt-1 block">{totalConferenciasCount}</span>
                  </div>
                  <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
                    <FileCode className="w-5 h-5 text-[#0f6e56]" />
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tempo Total Consumido</p>
                    <span className="text-xl font-black text-slate-900 mt-1 block">
                      {formatTempoConferencia(totalConferenciaSegundos)}
                    </span>
                  </div>
                  <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                    <Clock className="w-5 h-5 text-[#1e3a5f]" />
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tempo Médio / Arquivo</p>
                    <span className="text-xl font-black text-slate-900 mt-1 block">
                      {formatTempoConferencia(avgConferenciaSegundos)}
                    </span>
                  </div>
                  <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
                    <Activity className="w-5 h-5 text-amber-600" />
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Empresa Mais Auditada</p>
                    <span className="text-xs font-bold text-slate-900 mt-1 block truncate max-w-[140px]" title={empresaMaisAuditada}>
                      {empresaMaisAuditada}
                    </span>
                  </div>
                  <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                    <Building className="w-5 h-5 text-slate-700" />
                  </div>
                </div>
              </div>

              {/* Conferences Table */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider">
                      <tr>
                        <th className="p-3.5">Nome da Empresa</th>
                        <th className="p-3.5">Arquivo Conferido</th>
                        <th className="p-3.5">Início (1º Acesso)</th>
                        <th className="p-3.5">Conclusão</th>
                        <th className="p-3.5">Tempo de Conferência</th>
                        <th className="p-3.5">Resumo do que foi feito</th>
                        <th className="p-3.5">Auditor Responsável</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredConferencias.map((item, idx) => {
                        const inicioTimeStr = item.primeiroAcesso 
                          ? new Date(item.primeiroAcesso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                          : (item.data ? new Date(new Date(item.data).getTime() - (item.tempoSegundos || 180) * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '14:00:00');

                        const conclusaoTimeStr = item.conclusao 
                          ? new Date(item.conclusao).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                          : (item.data ? new Date(item.data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '14:05:00');

                        return (
                          <tr key={item.id || idx} className="hover:bg-slate-50/80 transition-colors">
                            <td className="p-3.5">
                              <div className="flex items-center space-x-2">
                                <Building2 className="w-4 h-4 text-[#1e3a5f] shrink-0" />
                                <span className="font-bold text-slate-900">{item.empresaNome || 'Empresa Cliente'}</span>
                              </div>
                            </td>

                            <td className="p-3.5">
                              <span className="font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px] border border-slate-200 block truncate max-w-[170px]" title={item.arquivoNome}>
                                {item.arquivoNome || 'SPED_EFD.txt'}
                              </span>
                            </td>

                            <td className="p-3.5 font-mono text-slate-600 text-[11px]">
                              {inicioTimeStr}
                            </td>

                            <td className="p-3.5 font-mono text-slate-600 text-[11px]">
                              {conclusaoTimeStr}
                            </td>

                            <td className="p-3.5">
                              <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-800 rounded-md font-mono font-bold text-xs border border-emerald-200" title="Calculado a partir da diferença entre o primeiro acesso e a conclusão da auditoria">
                                <Clock className="w-3.5 h-3.5 text-emerald-600" />
                                <span>{item.tempoFormatado || formatTempoConferencia(item.tempoSegundos || 180)}</span>
                              </span>
                            </td>

                            <td className="p-3.5 max-w-xs">
                              <p className="text-slate-700 font-medium text-xs leading-relaxed">
                                {item.resumo || 'Conferência e auditoria de escrituração fiscal'}
                              </p>
                            </td>

                            <td className="p-3.5">
                              <div>
                                <p className="font-bold text-slate-800">{item.userNome || 'Auditor'}</p>
                                <p className="text-[11px] text-slate-500">{item.userEmail || ''}</p>
                              </div>
                            </td>
                          </tr>
                        );
                      })}

                      {filteredConferencias.length === 0 && (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-slate-400 font-medium">
                            Nenhuma conferência encontrada com os filtros selecionados.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* DRAWER / MODAL: GERENCIAR CLIENTES DO ESCRITÓRIO SELECIONADO */}
      {selectedEscritorioForClients && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex justify-end">
          <div className="w-full max-w-2xl bg-white h-full shadow-md flex flex-col justify-between overflow-hidden animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-6 bg-[#1e3a5f] text-white flex items-center justify-between">
              <div>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-white/20 text-white">
                  Clientes do Escritório
                </span>
                <h2 className="text-xl font-bold tracking-tight mt-1">{selectedEscritorioForClients.nome}</h2>
                <p className="text-xs text-slate-300 font-mono">CNPJ: {selectedEscritorioForClients.cnpj || 'Não cadastrado'}</p>
              </div>

              <button 
                onClick={() => setSelectedEscritorioForClients(null)}
                className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="p-6 flex-1 overflow-y-auto space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-sm">
                  Lista de Clientes ({selectedEscritorioForClients.clientes?.length || 0})
                </h3>

                <button
                  onClick={() => handleOpenNewClienteModal(selectedEscritorioForClients)}
                  className="px-3 py-1.5 bg-[#0f6e56] hover:bg-[#0c5945] text-white rounded-lg text-xs font-bold transition-colors flex items-center space-x-1"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Adicionar Cliente</span>
                </button>
              </div>

              <div className="space-y-3">
                {selectedEscritorioForClients.clientes?.map((cli, idx) => (
                  <div key={`${selectedEscritorioForClients.id}_${cli.id}_${idx}`} className="p-4 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{cli.nome}</h4>
                      <div className="flex items-center space-x-2 text-xs text-slate-500 mt-0.5 font-mono">
                        <span>CNPJ: {cli.cnpj || 'N/I'}</span>
                        <span>•</span>
                        <span className="uppercase">{cli.uf}</span>
                        <span>•</span>
                        <span className="font-sans font-semibold text-[#1e3a5f]">{cli.regimeTributario}</span>
                      </div>
                      {(cli.email || cli.telefone) && (
                        <p className="text-[11px] text-slate-400 mt-1">
                          {cli.email} {cli.telefone ? `| ${cli.telefone}` : ''}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => handleOpenEditClienteModal(cli, selectedEscritorioForClients.id)}
                        className="p-1.5 text-slate-600 hover:text-[#1e3a5f] hover:bg-[#f1efe8] rounded-lg"
                        title="Editar Cliente"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteCliente(cli.id, selectedEscritorioForClients.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                        title="Excluir Cliente"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}

                {(!selectedEscritorioForClients.clientes || selectedEscritorioForClients.clientes.length === 0) && (
                  <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                    <Users className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="text-xs font-semibold">Nenhum cliente cadastrado neste escritório contábil.</p>
                    <p className="text-[11px] text-slate-400 mt-1">Clique acima em "Adicionar Cliente" para registrar a primeira empresa.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSelectedEscritorioForClients(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CRIAR / EDITAR ESCRITÓRIO */}
      {showNewEscritorioModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full shadow-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 bg-[#1e3a5f] text-white flex items-center justify-between">
              <h3 className="font-bold text-lg flex items-center space-x-2">
                <Building2 className="w-5 h-5 text-emerald-300" />
                <span>{editingEscritorio ? 'Editar Escritório Contábil' : 'Novo Escritório Contábil'}</span>
              </h3>
              <button onClick={() => setShowNewEscritorioModal(false)} className="text-slate-300 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEscritorio} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Nome do Escritório *</label>
                <input
                  required
                  type="text"
                  value={escNome}
                  onChange={e => setEscNome(e.target.value)}
                  placeholder="Ex: Alfa Contabilidade & Consultoria"
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1e3a5f]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">CNPJ do Escritório</label>
                <input
                  type="text"
                  value={escCnpj}
                  onChange={e => setEscCnpj(e.target.value)}
                  placeholder="00.000.000/0001-00"
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1e3a5f]"
                />
              </div>

              <hr className="border-slate-200 my-2" />

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Nome do Administrador do Escritório</label>
                <input
                  type="text"
                  value={escNomeAdmin}
                  onChange={e => setEscNomeAdmin(e.target.value)}
                  placeholder="Ex: Roberto Alves"
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1e3a5f]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">E-mail do Administrador Inicial</label>
                <input
                  type="email"
                  value={escEmailAdmin}
                  onChange={e => setEscEmailAdmin(e.target.value)}
                  placeholder="admin@alfacontab.com.br"
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1e3a5f]"
                />
              </div>

              {escMsg && (
                <div className={`p-3 rounded-lg text-xs font-bold ${
                  !escMsg.startsWith('Erro') ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'
                }`}>
                  {escMsg}
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewEscritorioModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingEsc}
                  className="px-5 py-2 bg-[#1e3a5f] hover:bg-[#142c47] text-white rounded-lg text-xs font-bold disabled:opacity-50"
                >
                  {submittingEsc ? 'Gravando...' : editingEscritorio ? 'Salvar Alterações' : 'Cadastrar Escritório'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CADASTRO / EDIÇÃO DE CLIENTE */}
      {showClienteModal && targetEscritorioForNewClient && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full shadow-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 bg-[#1e3a5f] text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-300">Vinculado a: {targetEscritorioForNewClient.nome}</span>
                <h3 className="font-bold text-lg flex items-center space-x-2">
                  <UserPlus className="w-5 h-5 text-emerald-400" />
                  <span>{editingCliente ? 'Editar Cliente' : 'Novo Cliente do Escritório'}</span>
                </h3>
              </div>
              <button onClick={() => setShowClienteModal(false)} className="text-slate-300 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCliente} className="p-6 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Razão Social / Nome Empresa *</label>
                <input
                  required
                  type="text"
                  value={cliNome}
                  onChange={e => setCliNome(e.target.value)}
                  placeholder="Ex: Comercial Silva LTDA"
                  className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1e3a5f]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">CNPJ</label>
                  <input
                    type="text"
                    value={cliCnpj}
                    onChange={e => setCliCnpj(e.target.value)}
                    placeholder="00.000.000/0001-00"
                    className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1e3a5f]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">UF / Estado</label>
                  <input
                    type="text"
                    value={cliUf}
                    onChange={e => setCliUf(e.target.value.toUpperCase())}
                    maxLength={2}
                    placeholder="SP"
                    className="w-full p-2 border border-slate-300 rounded-lg text-sm uppercase focus:ring-2 focus:ring-[#1e3a5f]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Regime Tributário</label>
                <select
                  value={cliRegime}
                  onChange={e => setCliRegime(e.target.value as RegimeTributario)}
                  className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-[#1e3a5f]"
                >
                  <option value="Lucro Real">Lucro Real</option>
                  <option value="Lucro Presumido">Lucro Presumido</option>
                  <option value="Simples Nacional">Simples Nacional</option>
                  <option value="MEI">MEI</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">E-mail</label>
                  <input
                    type="email"
                    value={cliEmail}
                    onChange={e => setCliEmail(e.target.value)}
                    placeholder="fiscal@empresa.com"
                    className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1e3a5f]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Telefone</label>
                  <input
                    type="text"
                    value={cliTelefone}
                    onChange={e => setCliTelefone(e.target.value)}
                    placeholder="(11) 99999-0000"
                    className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1e3a5f]"
                  />
                </div>
              </div>

              {cliMsg && (
                <div className={`p-2.5 rounded-lg text-xs font-bold ${
                  !cliMsg.startsWith('Erro') ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'
                }`}>
                  {cliMsg}
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowClienteModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingCli}
                  className="px-5 py-2 bg-[#0f6e56] hover:bg-[#0c5945] text-white rounded-lg text-xs font-bold disabled:opacity-50"
                >
                  {submittingCli ? 'Gravando...' : editingCliente ? 'Salvar Alterações' : 'Cadastrar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CADASTRO / VÍNCULO DE USUÁRIO */}
      {showNewUsuarioModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full shadow-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 bg-[#1e3a5f] text-white flex items-center justify-between">
              <h3 className="font-bold text-base flex items-center space-x-2">
                <UserPlus className="w-5 h-5 text-emerald-400" />
                <span>{editingUsuario ? 'Editar Usuário e Vínculo' : 'Convidar / Cadastrar Novo Usuário'}</span>
              </h3>
              <button onClick={() => setShowNewUsuarioModal(false)} className="text-slate-300 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUsuario} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Nome Completo *</label>
                <input
                  required
                  type="text"
                  value={userFormNome}
                  onChange={e => setUserFormNome(e.target.value)}
                  placeholder="Ex: Maria Oliveira"
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1e3a5f]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">E-mail de Acesso *</label>
                <input
                  required
                  disabled={!!editingUsuario}
                  type="email"
                  value={userFormEmail}
                  onChange={e => setUserFormEmail(e.target.value)}
                  placeholder="maria@escritorio.com.br"
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1e3a5f] disabled:bg-slate-100 disabled:text-slate-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Escritório Contábil de Destino *</label>
                <select
                  required
                  value={userFormEscritorioId}
                  onChange={e => setUserFormEscritorioId(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-[#1e3a5f]"
                >
                  <option value="">Selecione o Escritório...</option>
                  {escritorios.map(esc => (
                    <option key={esc.id} value={esc.id}>{esc.nome}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Papel / Perfil de Acesso *</label>
                <select
                  value={userFormPapel}
                  onChange={e => setUserFormPapel(e.target.value as any)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-[#1e3a5f]"
                >
                  <option value="colaborador">Colaborador (Acesso do Escritório)</option>
                  <option value="admin_escritorio">Admin do Escritório (Gestão Interna)</option>
                  {userData?.papel === 'super_admin' && (
                    <option value="super_admin">Super Admin (Acesso Global)</option>
                  )}
                </select>
              </div>

              {userMsg && (
                <div className={`p-3 rounded-lg text-xs font-bold ${
                  !userMsg.startsWith('Erro') ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'
                }`}>
                  {userMsg}
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewUsuarioModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingUser}
                  className="px-5 py-2 bg-[#1e3a5f] hover:bg-[#142c47] text-white rounded-lg text-xs font-bold disabled:opacity-50"
                >
                  {submittingUser ? 'Enviando...' : editingUsuario ? 'Salvar Vínculo' : 'Cadastrar e Convidar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
