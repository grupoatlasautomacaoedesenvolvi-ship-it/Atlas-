import React, { useState } from 'react';
import { LifeBuoy, X, Send, Image as ImageIcon, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../lib/auth';

export function SupportFloatingButton() {
  const { userData } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [loading, setLoading] = useState(false);
  const [protocolo, setProtocolo] = useState('');

  const [tipo, setTipo] = useState<'SUGESTAO' | 'RECLAMACAO' | 'ERRO' | 'DUVIDA'>('DUVIDA');
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [anexoBase64, setAnexoBase64] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo || !descricao) return;

    setLoading(true);
    try {
      const { auth } = await import('../lib/firebase');
      const token = await auth.currentUser?.getIdToken();
      
      const res = await fetch('/api/suporte/chamados', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          tipo,
          titulo,
          descricao,
          anexoBase64,
          telaOrigem: window.location.hash || 'Geral',
          versaoApp: '1.0.0'
        })
      });

      const data = await res.json();
      if (res.ok) {
        setProtocolo(data.chamado.protocolo);
        setStep('success');
      } else {
        alert(`Erro ${res.status}: ${data.error || 'Erro ao enviar chamado.'}`);
      }
    } catch (err: any) {
      alert(`Erro de conexão: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 307200) {
        alert('O arquivo deve ter no máximo 300 KB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setAnexoBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (const item of Array.from(items)) {
      if (item.type.indexOf('image') !== -1) {
        const file = item.getAsFile();
        if (file) {
          if (file.size > 307200) {
            alert('O arquivo deve ter no máximo 300 KB.');
            return;
          }
          const reader = new FileReader();
          reader.onloadend = () => {
            setAnexoBase64(reader.result as string);
          };
          reader.readAsDataURL(file);
        }
      }
    }
  };

  if (!userData) return null;

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-all z-50 group"
        title="Fale com o Suporte"
      >
        <LifeBuoy className="w-7 h-7" />
        <span className="absolute right-full mr-3 bg-white text-indigo-600 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-indigo-100">
          Fale com o Suporte
        </span>
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-indigo-600 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center space-x-2 text-white">
                <LifeBuoy className="w-5 h-5" />
                <h3 className="font-bold">Novo Chamado de Suporte</h3>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              {step === 'form' ? (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tipo</label>
                      <select
                        value={tipo}
                        onChange={(e) => setTipo(e.target.value as any)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-600"
                      >
                        <option value="DUVIDA">Dúvida</option>
                        <option value="ERRO">Erro / Bug</option>
                        <option value="SUGESTAO">Sugestão</option>
                        <option value="RECLAMACAO">Reclamação</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Título</label>
                      <input
                        type="text"
                        value={titulo}
                        onChange={(e) => setTitulo(e.target.value)}
                        placeholder="Ex: Erro ao importar ZIP"
                        maxLength={120}
                        required
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-600"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Descrição Detalhada</label>
                    <textarea
                      value={descricao}
                      onChange={(e) => setDescricao(e.target.value)}
                      onPaste={handlePaste}
                      placeholder="Descreva o que aconteceu ou sua dúvida..."
                      rows={5}
                      maxLength={5000}
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-600 resize-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Anexar Print (Máx 300KB)</label>
                    <div className="flex items-center space-x-4">
                      <label className="cursor-pointer flex items-center space-x-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-semibold text-slate-600 transition-colors">
                        <ImageIcon className="w-4 h-4" />
                        <span>{anexoBase64 ? 'Alterar Print' : 'Escolher Arquivo'}</span>
                        <input type="file" accept="image/jpeg,image/png" onChange={handleFileChange} className="hidden" />
                      </label>
                      <span className="text-[10px] text-slate-400 italic">Dica: você também pode colar (Ctrl+V) um print aqui.</span>
                    </div>
                    {anexoBase64 && (
                      <div className="mt-2 relative inline-block">
                        <img src={anexoBase64} alt="Preview" className="h-20 w-auto rounded-lg border border-slate-200 shadow-sm" />
                        <button 
                          type="button" 
                          onClick={() => setAnexoBase64(null)}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 shadow-sm"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold flex items-center justify-center space-x-2 hover:bg-indigo-700 transition-colors shadow-lg disabled:opacity-50"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Abrir Chamado</span>
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <div className="py-8 text-center space-y-4">
                  <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xl font-bold text-slate-800">Chamado Aberto!</h4>
                    <p className="text-sm text-slate-500">Protocolo: <span className="font-mono font-bold text-indigo-600">{protocolo}</span></p>
                  </div>
                  <p className="text-sm text-slate-600 max-w-xs mx-auto">
                    Recebemos seu chamado. Você será avisado no app e por e-mail quando houver resposta.
                  </p>
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      setStep('form');
                      setTitulo('');
                      setDescricao('');
                      setAnexoBase64(null);
                    }}
                    className="atlas-btn atlas-btn-primary px-8"
                  >
                    Entendido
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
