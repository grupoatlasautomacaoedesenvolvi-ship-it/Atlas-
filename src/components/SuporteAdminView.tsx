import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  LifeBuoy, 
  Search, 
  Clock, 
  Filter, 
  ArrowLeft, 
  Send, 
  Image as ImageIcon, 
  AlertCircle,
  Building2,
  User,
  Monitor,
  CheckCircle2,
  X
} from 'lucide-react';
import { ChamadoSuporte, MensagemChamado } from '../types';
import { useAuth } from '../lib/auth';

export function SuporteAdminView() {
  const { userData } = useAuth();
  const [chamados, setChamados] = useState<ChamadoSuporte[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedChamado, setSelectedChamado] = useState<ChamadoSuporte | null>(null);
  const [mensagens, setMensagens] = useState<MensagemChamado[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [newMsg, setNewMsg] = useState('');
  const [msgAnexo, setMsgAnexo] = useState<string | null>(null);
  const [sendingMsg, setLoadingMsg] = useState(false);
  const [now, setNow] = useState(new Date());

  // Filtros
  const [q, setQ] = useState('');
  const [filterTipo, setTipo] = useState('');
  const [filterStatus, setStatus] = useState('');
  const [filterPrioridade, setPrioridade] = useState('');
  const [filterAguardando24h, setFilter24h] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchChamados = async () => {
    try {
      const { auth } = await import('../lib/firebase');
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/suporte/chamados', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setChamados(data.chamados);
      } else {
        console.warn(`Erro ${res.status} ao listar chamados adm:`, data.error);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDetails = async (id: string) => {
    setLoadingDetails(true);
    try {
      const { auth } = await import('../lib/firebase');
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/suporte/chamados/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setSelectedChamado(data.chamado);
        setMensagens(data.mensagens);

        // Marcar como lido para o suporte
        if (data.chamado.naoLidoPeloSuporte) {
          fetch(`/api/suporte/chamados/${id}/lido`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
          });
        }
      } else {
        alert(`Erro ${res.status}: ${data.error || 'Erro ao buscar detalhes.'}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDetails(false);
    }
  };

  useEffect(() => {
    fetchChamados();
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedId) fetchDetails(selectedId);
    else { setSelectedChamado(null); setMensagens([]); }
  }, [selectedId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [mensagens]);

  const handleUpdateMeta = async (status?: string, prioridade?: string) => {
    if (!selectedId) return;
    try {
      const { auth } = await import('../lib/firebase');
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/suporte/chamados/${selectedId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status, prioridade })
      });
      const data = await res.json();
      if (res.ok) {
        fetchDetails(selectedId);
        fetchChamados();
      } else {
        alert(`Erro ${res.status}: ${data.error || 'Erro ao atualizar metadados.'}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMsg || !selectedId) return;
    setLoadingMsg(true);
    try {
      const { auth } = await import('../lib/firebase');
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`/api/suporte/chamados/${selectedId}/mensagens`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ texto: newMsg, anexoBase64: msgAnexo })
      });
      const data = await res.json();
      if (res.ok) {
        setMensagens([...mensagens, data.mensagem]);
        setNewMsg('');
        setMsgAnexo(null);
        fetchChamados(); // recarregar status na lista
      } else {
        alert(`Erro ${res.status}: ${data.error || 'Erro ao enviar mensagem.'}`);
      }
    } catch (err: any) {
      alert(`Erro de conexão: ${err.message}`);
    } finally {
      setLoadingMsg(false);
    }
  };

  // Cálculos de Tempo
  const getWaitInfo = (since?: string | null) => {
    if (!since) return null;
    const diffMs = now.getTime() - new Date(since).getTime();
    const mins = Math.floor(diffMs / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);

    let text = '';
    let colorClass = 'text-emerald-600';

    if (days > 0) {
      text = `${days} d ${hours % 24} h`;
      colorClass = 'text-red-600 font-bold';
    } else if (hours > 0) {
      text = `${hours} h ${mins % 60} min`;
      colorClass = hours >= 4 ? 'text-amber-600 font-bold' : 'text-emerald-600';
    } else {
      text = `${mins} min`;
      colorClass = 'text-emerald-600';
    }

    return { text, colorClass, diffMs };
  };

  // Filtragem e Ordenação
  const filtered = useMemo(() => {
    let result = chamados.filter(c => {
      const matchQ = !q || c.protocolo.toLowerCase().includes(q.toLowerCase()) || c.titulo.toLowerCase().includes(q.toLowerCase());
      const matchTipo = !filterTipo || c.tipo === filterTipo;
      const matchStatus = !filterStatus || c.status === filterStatus;
      const matchPrioridade = !filterPrioridade || c.prioridade === filterPrioridade;
      const match24h = !filterAguardando24h || (c.aguardandoRespostaDesde && (now.getTime() - new Date(c.aguardandoRespostaDesde).getTime()) > 86400000);
      return matchQ && matchTipo && matchStatus && matchPrioridade && match24h;
    });

    // Ordenação padrão: primeiro os que aguardam resposta (mais antigos primeiro)
    result.sort((a, b) => {
      if (a.aguardandoRespostaDesde && b.aguardandoRespostaDesde) {
        return new Date(a.aguardandoRespostaDesde).getTime() - new Date(b.aguardandoRespostaDesde).getTime();
      }
      if (a.aguardandoRespostaDesde) return -1;
      if (b.aguardandoRespostaDesde) return 1;
      return new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime();
    });

    return result;
  }, [chamados, q, filterTipo, filterStatus, filterPrioridade, filterAguardando24h, now]);

  // Estatísticas
  const stats = useMemo(() => {
    const counts = { ABERTO: 0, EM_ANALISE: 0, RESPONDIDO: 0, RESOLVIDO: 0, total: chamados.length, waiting: 0, maxWaitMs: 0 };
    chamados.forEach(c => {
      if (c.status in counts) (counts as any)[c.status]++;
      if (c.aguardandoRespostaDesde) {
        counts.waiting++;
        const waitMs = now.getTime() - new Date(c.aguardandoRespostaDesde).getTime();
        if (waitMs > counts.maxWaitMs) counts.maxWaitMs = waitMs;
      }
    });
    return counts;
  }, [chamados, now]);

  const maxWaitText = stats.maxWaitMs > 0 ? getWaitInfo(new Date(now.getTime() - stats.maxWaitMs).toISOString())?.text : '—';

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 space-y-8 h-screen overflow-hidden flex flex-col">
      <div className="shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight flex items-center gap-3">
            <LifeBuoy className="w-8 h-8 text-indigo-600" />
            Painel de Suporte (Super Admin)
          </h1>
          <p className="text-slate-500 mt-1">Gerencie chamados de todos os escritórios e usuários.</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="shrink-0 grid grid-cols-2 md:grid-cols-6 gap-4">
        <div className="atlas-card p-4 text-center">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Abertos</p>
          <p className="text-2xl font-black text-indigo-600">{stats.ABERTO}</p>
        </div>
        <div className="atlas-card p-4 text-center">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Em Análise</p>
          <p className="text-2xl font-black text-amber-500">{stats.EM_ANALISE}</p>
        </div>
        <div className="atlas-card p-4 text-center">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Respondidos</p>
          <p className="text-2xl font-black text-emerald-500">{stats.RESPONDIDO}</p>
        </div>
        <div className="atlas-card p-4 text-center">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Resolvidos</p>
          <p className="text-2xl font-black text-slate-400">{stats.RESOLVIDO}</p>
        </div>
        <div className="atlas-card p-4 text-center bg-indigo-50 border-indigo-100">
          <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Aguardando</p>
          <p className="text-2xl font-black text-indigo-700">{stats.waiting}</p>
        </div>
        <div className="atlas-card p-4 text-center bg-red-50 border-red-100">
          <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest">Maior Espera</p>
          <p className="text-lg font-black text-red-700 mt-1">{maxWaitText}</p>
        </div>
      </div>

      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* Tabela de Chamados */}
        <div className={`flex-1 flex flex-col gap-4 overflow-hidden ${selectedId ? 'hidden lg:flex' : 'flex'}`}>
          <div className="atlas-card flex-1 flex flex-col overflow-hidden">
            {/* Filtros */}
            <div className="p-4 border-b border-slate-100 grid grid-cols-1 md:grid-cols-5 gap-3 shrink-0">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" value={q} onChange={e => setQ(e.target.value)} placeholder="Protocolo ou título..." className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-xs focus:outline-none" />
              </div>
              <select value={filterTipo} onChange={e => setTipo(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-xs focus:outline-none">
                <option value="">Todos os Tipos</option>
                <option value="ERRO">Erro</option>
                <option value="DUVIDA">Dúvida</option>
                <option value="SUGESTAO">Sugestão</option>
                <option value="RECLAMACAO">Reclamação</option>
              </select>
              <select value={filterStatus} onChange={e => setStatus(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-xs focus:outline-none">
                <option value="">Todos os Status</option>
                <option value="ABERTO">Aberto</option>
                <option value="EM_ANALISE">Em Análise</option>
                <option value="RESPONDIDO">Respondido</option>
                <option value="RESOLVIDO">Resolvido</option>
              </select>
              <select value={filterPrioridade} onChange={e => setPrioridade(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-xs focus:outline-none">
                <option value="">Todas Prioridades</option>
                <option value="BAIXA">Baixa</option>
                <option value="MEDIA">Média</option>
                <option value="ALTA">Alta</option>
                <option value="CRITICA">Crítica</option>
              </select>
              <button 
                onClick={() => setFilter24h(!filterAguardando24h)}
                className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all ${filterAguardando24h ? 'bg-red-600 text-white border-red-700' : 'bg-slate-50 text-slate-600 border-slate-200'}`}
              >
                Espera {'>'} 24h
              </button>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
                  <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <th className="px-4 py-3">Protocolo / Título</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">Escritório</th>
                    <th className="px-4 py-3">Prioridade</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Aguardando há</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map(c => {
                    const wait = getWaitInfo(c.aguardandoRespostaDesde);
                    return (
                      <tr 
                        key={c.id} 
                        onClick={() => setSelectedId(c.id)}
                        className={`hover:bg-indigo-50/50 cursor-pointer transition-colors ${selectedId === c.id ? 'bg-indigo-50' : ''}`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {c.naoLidoPeloSuporte && <span className="w-2 h-2 bg-red-500 rounded-full shrink-0" />}
                            <div>
                              <p className="text-[10px] font-bold text-indigo-400 font-mono">{c.protocolo}</p>
                              <p className="text-sm font-bold text-slate-700 truncate max-w-xs">{c.titulo}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs font-medium text-slate-500">{c.tipo}</td>
                        <td className="px-4 py-3 text-xs text-slate-500 truncate max-w-[120px]">{c.escritorioNome}</td>
                        <td className="px-4 py-3 text-xs font-bold">
                          {c.prioridade ? (
                            <span className={`px-2 py-0.5 rounded text-[10px] ${
                              c.prioridade === 'CRITICA' ? 'bg-red-100 text-red-700' :
                              c.prioridade === 'ALTA' ? 'bg-orange-100 text-orange-700' :
                              c.prioridade === 'MEDIA' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                            }`}>{c.prioridade}</span>
                          ) : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`atlas-pill atlas-pill-${c.status === 'ABERTO' ? 'info' : c.status === 'RESPONDIDO' ? 'accent' : 'muted'}`}>{c.status}</span>
                        </td>
                        <td className="px-4 py-3 text-right text-xs font-medium">
                          {wait ? <span className={wait.colorClass}>{wait.text}</span> : <span className="text-slate-300">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Detail Panel */}
        {selectedId && (
          <div className="w-full lg:w-[500px] flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">
            <div className="atlas-card flex-1 flex flex-col overflow-hidden relative">
              {/* Header */}
              <div className="p-4 border-b border-slate-100 shrink-0 bg-white/80 backdrop-blur-md z-10">
                <div className="flex items-center justify-between mb-4">
                  <button onClick={() => setSelectedId(null)} className="flex items-center space-x-2 text-indigo-600 font-bold text-xs hover:underline">
                    <ArrowLeft className="w-4 h-4" />
                    <span>Voltar à Lista</span>
                  </button>
                  {selectedChamado?.aguardandoRespostaDesde && (
                    <div className="text-[10px] font-bold px-2 py-1 bg-amber-50 text-amber-600 border border-amber-100 rounded-lg">
                      Aguardando sua resposta há {getWaitInfo(selectedChamado.aguardandoRespostaDesde)?.text}
                    </div>
                  )}
                </div>
                
                <h3 className="text-lg font-bold text-slate-800 leading-tight mb-4">{selectedChamado?.titulo}</h3>
                
                {/* Meta Grid */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Prioridade</label>
                    <select 
                      value={selectedChamado?.prioridade || ''} 
                      onChange={e => handleUpdateMeta(undefined, e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                    >
                      <option value="">Definir Prioridade</option>
                      <option value="BAIXA">Baixa</option>
                      <option value="MEDIA">Média</option>
                      <option value="ALTA">Alta</option>
                      <option value="CRITICA">Crítica</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Status</label>
                    <select 
                      value={selectedChamado?.status || ''} 
                      onChange={e => handleUpdateMeta(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                    >
                      <option value="ABERTO">Aberto</option>
                      <option value="EM_ANALISE">Em Análise</option>
                      <option value="RESPONDIDO">Respondido</option>
                      <option value="RESOLVIDO">Resolvido</option>
                      <option value="FECHADO">Fechado</option>
                    </select>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-xl p-3 space-y-2 text-[11px]">
                  <div className="flex items-center gap-2 text-slate-600">
                    <User className="w-3.5 h-3.5" />
                    <span className="font-bold">{selectedChamado?.autorNome}</span>
                    <span className="text-slate-400 italic">({selectedChamado?.autorEmail})</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600">
                    <Building2 className="w-3.5 h-3.5" />
                    <span>{selectedChamado?.escritorioNome}</span>
                    <span className="text-slate-300 font-mono text-[9px]">{selectedChamado?.escritorioId}</span>
                  </div>
                  <div className="flex items-center gap-4 text-slate-500">
                    <div className="flex items-center gap-1.5"><Monitor className="w-3.5 h-3.5" /> {selectedChamado?.telaOrigem}</div>
                    <div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> v.{selectedChamado?.versaoApp}</div>
                  </div>
                </div>
              </div>

              {/* Chat Content */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-50/50 custom-scrollbar">
                {loadingDetails ? (
                  <div className="h-full flex items-center justify-center"><div className="w-8 h-8 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" /></div>
                ) : (
                  <>
                    <div className="flex justify-start">
                      <div className="max-w-[90%] bg-white border border-slate-100 rounded-2xl rounded-tl-none p-4 shadow-xs">
                        <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mb-1">Chamado Original</p>
                        <p className="text-sm text-slate-700 whitespace-pre-wrap">{selectedChamado?.descricao}</p>
                        {selectedChamado?.anexoBase64 && (
                          <div className="mt-3">
                            <img src={selectedChamado.anexoBase64} alt="Anexo" className="max-w-full h-auto rounded-lg border cursor-zoom-in" onClick={() => window.open(selectedChamado.anexoBase64)} />
                          </div>
                        )}
                        <p className="text-[9px] text-slate-400 mt-2 text-right">{selectedChamado ? new Date(selectedChamado.criadoEm).toLocaleString() : ''}</p>
                      </div>
                    </div>
                    {mensagens.map(m => {
                      const isSuporte = m.autorPapel === 'super_admin';
                      return (
                        <div key={m.id} className={`flex ${isSuporte ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[90%] p-4 rounded-2xl shadow-xs ${isSuporte ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white border border-slate-100 text-slate-700 rounded-tl-none'}`}>
                            <p className="text-[10px] font-bold uppercase tracking-widest mb-1 opacity-70">{isSuporte ? 'Suporte (Você)' : m.autorNome}</p>
                            <p className="text-sm whitespace-pre-wrap">{m.texto}</p>
                            {m.anexoBase64 && <div className="mt-2"><img src={m.anexoBase64} alt="Anexo" className="max-w-full h-auto rounded-lg" onClick={() => window.open(m.anexoBase64)} /></div>}
                            <p className="text-[9px] mt-2 text-right opacity-60">{new Date(m.criadoEm).toLocaleString()}</p>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>

              {/* Chat Input */}
              <div className="p-4 border-t border-slate-100 bg-white shrink-0">
                <form onSubmit={handleSendMessage} className="space-y-3">
                  {msgAnexo && (
                    <div className="relative inline-block">
                      <img src={msgAnexo} alt="Anexo" className="h-16 w-auto rounded-lg border border-slate-200" />
                      <button type="button" onClick={() => setMsgAnexo(null)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5"><X className="w-3 h-3" /></button>
                    </div>
                  )}
                  <div className="flex items-end gap-3">
                    <div className="flex-1 relative">
                      <textarea value={newMsg} onChange={e => setNewMsg(e.target.value)} placeholder="Digite sua resposta de suporte..." rows={1} className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-4 pr-12 py-3 text-sm focus:outline-none focus:border-indigo-600 resize-none" onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(e as any); } }} />
                      <label className="absolute right-3 bottom-3 cursor-pointer text-slate-400 hover:text-indigo-600 transition-colors">
                        <ImageIcon className="w-5 h-5" /><input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f && f.size < 307200) { const r = new FileReader(); r.onloadend = () => setMsgAnexo(r.result as string); r.readAsDataURL(f); } }} />
                      </label>
                    </div>
                    <button type="submit" disabled={sendingMsg || !newMsg.trim()} className="bg-indigo-600 text-white p-3 rounded-xl hover:bg-indigo-700 transition-all shadow-lg disabled:opacity-50 shrink-0"><Send className="w-5 h-5" /></button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
