import React, { useState, useEffect, useRef } from 'react';
import { 
  LifeBuoy, 
  Search, 
  Clock, 
  MessageSquare, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight, 
  Send, 
  Image as ImageIcon,
  ArrowLeft,
  X
} from 'lucide-react';
import { ChamadoSuporte, MensagemChamado } from '../types';
import { useAuth } from '../lib/auth';

export function SuporteView() {
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
  
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchChamados = async () => {
    try {
      const token = localStorage.getItem('atlas_auth_token');
      const res = await fetch('/api/suporte/chamados', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setChamados(data.chamados);
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
      const token = localStorage.getItem('atlas_auth_token');
      const res = await fetch(`/api/suporte/chamados/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedChamado(data.chamado);
        setMensagens(data.mensagens);
        
        // Marcar como lido se houver resposta não lida
        if (data.chamado.naoLidoPeloAutor) {
          fetch(`/api/suporte/chamados/${id}/lido`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
          });
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDetails(false);
    }
  };

  useEffect(() => {
    fetchChamados();
  }, []);

  useEffect(() => {
    if (selectedId) {
      fetchDetails(selectedId);
    } else {
      setSelectedChamado(null);
      setMensagens([]);
    }
  }, [selectedId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mensagens]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMsg || !selectedId) return;

    setLoadingMsg(true);
    try {
      const token = localStorage.getItem('atlas_auth_token');
      const res = await fetch(`/api/suporte/chamados/${selectedId}/mensagens`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ texto: newMsg, anexoBase64: msgAnexo })
      });

      if (res.ok) {
        const data = await res.json();
        setMensagens([...mensagens, data.mensagem]);
        setNewMsg('');
        setMsgAnexo(null);
      }
    } catch (err) {
      alert('Erro ao enviar mensagem.');
    } finally {
      setLoadingMsg(false);
    }
  };

  const handleResolver = async () => {
    if (!selectedId) return;
    if (!confirm('Deseja marcar este chamado como resolvido?')) return;

    try {
      const token = localStorage.getItem('atlas_auth_token');
      const res = await fetch(`/api/suporte/chamados/${selectedId}/resolver`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchDetails(selectedId);
        fetchChamados();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ABERTO': return <span className="atlas-pill atlas-pill-info">Aberto</span>;
      case 'EM_ANALISE': return <span className="atlas-pill atlas-pill-warning">Em Análise</span>;
      case 'RESPONDIDO': return <span className="atlas-pill atlas-pill-accent animate-pulse">Respondido</span>;
      case 'RESOLVIDO': return <span className="atlas-pill atlas-pill-navy">Resolvido</span>;
      case 'FECHADO': return <span className="atlas-pill atlas-pill-muted">Fechado</span>;
      default: return <span className="atlas-pill atlas-pill-muted">{status}</span>;
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 h-[calc(100vh-120px)] flex flex-col">
      <div className="flex items-center justify-between mb-8 shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight flex items-center gap-3">
            <LifeBuoy className="w-8 h-8 text-indigo-600" />
            Meus Chamados de Suporte
          </h1>
          <p className="text-slate-500 mt-1">Acompanhe suas solicitações e tire suas dúvidas com nossa equipe.</p>
        </div>
      </div>

      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* Sidebar: Lista de Chamados */}
        <div className={`w-full md:w-80 flex flex-col gap-4 ${selectedId ? 'hidden md:flex' : 'flex'}`}>
          <div className="atlas-card p-4 space-y-4 flex-1 flex flex-col overflow-hidden">
            <div className="relative shrink-0">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Buscar chamado..." 
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-indigo-600"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {loading ? (
                <div className="py-12 flex justify-center">
                  <div className="w-6 h-6 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" />
                </div>
              ) : chamados.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                  <p className="text-xs text-slate-400 font-medium">Nenhum chamado aberto.</p>
                </div>
              ) : (
                chamados.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${
                      selectedId === c.id 
                        ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-200' 
                        : 'bg-white border-slate-100 hover:border-slate-300'
                    } relative`}
                  >
                    {c.naoLidoPeloAutor && (
                      <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full shadow-sm" />
                    )}
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{c.protocolo}</span>
                      <span className="text-[10px] font-medium text-slate-400">{formatTime(c.criadoEm).split(',')[0]}</span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-700 truncate mb-2">{c.titulo}</h4>
                    <div className="flex items-center justify-between">
                      {getStatusBadge(c.status)}
                      <ChevronRight className={`w-4 h-4 text-slate-300 transition-transform ${selectedId === c.id ? 'translate-x-1' : ''}`} />
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Detalhe / Chat Area */}
        <div className={`flex-1 flex flex-col overflow-hidden ${!selectedId ? 'hidden md:flex' : 'flex'}`}>
          {!selectedId ? (
            <div className="atlas-card flex-1 flex flex-col items-center justify-center text-center p-12 space-y-4">
              <div className="w-20 h-20 bg-indigo-50 text-indigo-200 rounded-full flex items-center justify-center">
                <LifeBuoy className="w-10 h-10" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-700">Selecione um chamado</h3>
                <p className="text-sm text-slate-400 max-w-xs">Escolha uma solicitação na lista ao lado para ver o histórico e responder.</p>
              </div>
            </div>
          ) : (
            <div className="atlas-card flex-1 flex flex-col overflow-hidden relative">
              {/* Chat Header */}
              <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white/80 backdrop-blur-md z-10">
                <div className="flex items-center space-x-3">
                  <button onClick={() => setSelectedId(null)} className="md:hidden p-2 text-slate-400 hover:bg-slate-50 rounded-lg">
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-800">{selectedChamado?.titulo || 'Carregando...'}</h3>
                      {selectedChamado && getStatusBadge(selectedChamado.status)}
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">{selectedChamado?.protocolo}</p>
                  </div>
                </div>
                
                {selectedChamado?.status !== 'RESOLVIDO' && selectedChamado?.status !== 'FECHADO' && (
                  <button
                    onClick={handleResolver}
                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-bold hover:bg-emerald-100 transition-colors border border-emerald-100"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Resolvido</span>
                  </button>
                )}
              </div>

              {/* Chat Messages */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-50/50 custom-scrollbar">
                {loadingDetails ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="w-8 h-8 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" />
                  </div>
                ) : (
                  <>
                    {/* Descrição Inicial */}
                    <div className="flex justify-start">
                      <div className="max-w-[85%] bg-white border border-slate-100 rounded-2xl rounded-tl-none p-4 shadow-xs">
                        <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mb-1">Descrição Inicial</p>
                        <p className="text-sm text-slate-700 whitespace-pre-wrap">{selectedChamado?.descricao}</p>
                        {selectedChamado?.anexoBase64 && (
                          <div className="mt-3">
                            <img 
                              src={selectedChamado.anexoBase64} 
                              alt="Anexo" 
                              className="max-w-full h-auto rounded-lg border border-slate-100 cursor-zoom-in hover:opacity-90 transition-opacity" 
                              onClick={() => window.open(selectedChamado.anexoBase64)}
                            />
                          </div>
                        )}
                        <p className="text-[9px] text-slate-400 mt-2 text-right">{selectedChamado ? formatTime(selectedChamado.criadoEm) : ''}</p>
                      </div>
                    </div>

                    {/* Histórico */}
                    {mensagens.map(m => {
                      const isMe = m.autorUid === userData?.uid;
                      return (
                        <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[85%] p-4 rounded-2xl shadow-xs ${
                            isMe 
                              ? 'bg-indigo-600 text-white rounded-br-none' 
                              : 'bg-white border border-slate-100 text-slate-700 rounded-tl-none'
                          }`}>
                            {!isMe && (
                              <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mb-1">Suporte Atlas</p>
                            )}
                            <p className="text-sm whitespace-pre-wrap">{m.texto}</p>
                            {m.anexoBase64 && (
                              <div className="mt-2">
                                <img src={m.anexoBase64} alt="Anexo" className="max-w-full h-auto rounded-lg cursor-zoom-in" onClick={() => window.open(m.anexoBase64)} />
                              </div>
                            )}
                            <p className={`text-[9px] mt-2 text-right ${isMe ? 'text-indigo-100' : 'text-slate-400'}`}>
                              {formatTime(m.criadoEm)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>

              {/* Chat Input */}
              {selectedChamado && selectedChamado.status !== 'RESOLVIDO' && selectedChamado.status !== 'FECHADO' && (
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
                        <textarea
                          value={newMsg}
                          onChange={(e) => setNewMsg(e.target.value)}
                          placeholder="Digite sua resposta..."
                          rows={1}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-4 pr-12 py-3 text-sm focus:outline-none focus:border-indigo-600 resize-none max-h-32"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleSendMessage(e as any);
                            }
                          }}
                        />
                        <label className="absolute right-3 bottom-3 cursor-pointer text-slate-400 hover:text-indigo-600 transition-colors">
                          <ImageIcon className="w-5 h-5" />
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f && f.size < 307200) {
                                const r = new FileReader();
                                r.onloadend = () => setMsgAnexo(r.result as string);
                                r.readAsDataURL(f);
                              } else if (f) {
                                alert('Arquivo deve ter no máximo 300KB');
                              }
                            }}
                          />
                        </label>
                      </div>
                      <button
                        type="submit"
                        disabled={sendingMsg || !newMsg.trim()}
                        className="bg-indigo-600 text-white p-3 rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:shadow-none shrink-0"
                      >
                        <Send className="w-5 h-5" />
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
