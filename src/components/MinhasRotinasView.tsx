import React, { useState, useEffect, useRef } from 'react';
import {
  CheckCircle2, Plus, Edit2, Trash2, X, Lock, ListTodo, Calendar,
  Download, Upload, Building2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Rotina, RotinaChecklistItem, RotinaRecorrencia, RotinaTipo, RotinaVisibilidade, Cliente } from '../types';
import { fetchRotinas, saveRotina, deleteRotina } from '../lib/rotinaService';

interface MinhasRotinasViewProps {
  escritorioId?: string;
  userId?: string;
  userNome?: string;
  papel?: 'super_admin' | 'admin_escritorio' | 'colaborador';
  clientes: Cliente[];
  addNotification?: (title: string, message: string, type: 'system' | 'import' | 'audit' | 'export') => void;
}

function getBadgeStyle(tipo: RotinaTipo): string {
  switch (tipo) {
    case 'Aviso': return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'Compromisso': return 'bg-sky-50 text-sky-700 border-sky-100';
    case 'Processo Interno': return 'bg-emerald-50 text-[#0f6e56] border-emerald-100';
    default: return 'bg-[#f1efe8] text-[#1e3a5f] border-[#e5e2d9]';
  }
}

function novaRotinaVazia(): Omit<Rotina, 'id' | 'escritorioId' | 'userId' | 'userNome' | 'creatorRole' | 'criadoEm' | 'atualizadoEm'> {
  return {
    titulo: '', descricao: '', recorrencia: 'Mensal', prazoInfo: '',
    checklist: [], concluida: false, tipo: 'Rotina', visibilidade: 'Privado',
    empresaId: undefined, empresaNome: undefined
  };
}

export function MinhasRotinasView({ escritorioId, userId, userNome, papel, clientes, addNotification }: MinhasRotinasViewProps) {
  const [rotinas, setRotinas] = useState<Rotina[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(novaRotinaVazia());
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const recarregar = async () => {
    if (!escritorioId || !userId || !papel) { setLoading(false); return; }
    setLoading(true);
    try {
      const lista = await fetchRotinas(escritorioId, userId, papel);
      setRotinas(lista);
    } catch (e) {
      console.error('Erro ao carregar rotinas:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { recarregar(); }, [escritorioId, userId, papel]);

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        Tipo: 'Rotina', Visibilidade: 'Privado', Empresa: '(opcional — nome exatamente como cadastrado)',
        Titulo: 'Exemplo de Rotina Diária', Descricao: 'Descrição detalhada do processo ou rotina.',
        Frequencia: 'Diária', Checklist: 'Conferir e-mails; Atualizar sistema; Enviar resumo'
      },
      {
        Tipo: 'Compromisso', Visibilidade: 'Todos', Empresa: '',
        Titulo: 'Reunião de Alinhamento Semanal', Descricao: 'Reunião com toda a equipe do escritório.',
        Frequencia: 'Semanal', Checklist: 'Preparar pauta; Enviar link da sala'
      }
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Modelo_Rotinas');
    XLSX.writeFile(wb, 'Modelo_Importacao_Rotinas.xlsx');
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile || !escritorioId || !userId || !userNome || !papel) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const parsedData = XLSX.utils.sheet_to_json<any>(sheet);

        const agora = new Date().toISOString();
        const novasRotinas: Rotina[] = parsedData.map((row, index) => {
          const checklistRaw = row['Checklist'] || row['checklist'] || '';
          const checklistItems: RotinaChecklistItem[] = checklistRaw
            ? String(checklistRaw).split(';').map((texto, i) => ({
                id: `chk_${Date.now()}_${index}_${i}`, texto: texto.trim(), concluido: false
              })).filter(item => item.texto !== '')
            : [];

          const nomeEmpresaPlanilha = String(row['Empresa'] || '').trim();
          const clienteEncontrado = nomeEmpresaPlanilha
            ? clientes.find(c => c.nome.toLowerCase() === nomeEmpresaPlanilha.toLowerCase())
            : undefined;

          return {
            id: `imported_${Date.now()}_${index}`,
            escritorioId,
            userId,
            userNome,
            creatorRole: papel,
            empresaId: clienteEncontrado?.id,
            empresaNome: clienteEncontrado?.nome,
            titulo: row['Titulo'] || row['Título'] || 'Nova Rotina Importada',
            descricao: row['Descricao'] || row['Descrição'] || '',
            recorrencia: (row['Frequencia'] || row['Frequência'] || 'Mensal') as RotinaRecorrencia,
            prazoInfo: 'Conforme rotina',
            checklist: checklistItems,
            concluida: false,
            tipo: (row['Tipo'] || 'Rotina') as RotinaTipo,
            visibilidade: (row['Visibilidade'] || 'Privado') as RotinaVisibilidade,
            criadoEm: agora,
            atualizadoEm: agora
          };
        });

        for (const rotina of novasRotinas) {
          await saveRotina(escritorioId, rotina);
        }
        await recarregar();
        addNotification?.('Rotinas Importadas', `${novasRotinas.length} rotina(s) importada(s) da planilha.`, 'import');
        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (error) {
        console.error('Erro ao importar rotinas:', error);
        alert('Erro ao processar a planilha. Confira se o formato bate com o modelo baixado.');
      }
    };
    reader.readAsBinaryString(uploadedFile);
  };

  const handleOpenModal = (rotina?: Rotina) => {
    if (rotina) {
      setEditingId(rotina.id);
      setFormData({ ...rotina });
    } else {
      setEditingId(null);
      setFormData(novaRotinaVazia());
    }
    setNewChecklistItem('');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.titulo || !escritorioId || !userId || !userNome || !papel) return;

    const existente = editingId ? rotinas.find(r => r.id === editingId) : null;
    const agora = new Date().toISOString();

    const rotina: Rotina = {
      id: editingId || `rot_${Date.now()}`,
      escritorioId,
      userId: existente?.userId || userId,
      userNome: existente?.userNome || userNome,
      creatorRole: existente?.creatorRole || papel,
      empresaId: formData.empresaId,
      empresaNome: formData.empresaNome,
      titulo: formData.titulo,
      descricao: formData.descricao,
      recorrencia: formData.recorrencia,
      prazoInfo: formData.prazoInfo,
      checklist: formData.checklist,
      concluida: existente ? existente.concluida : formData.concluida,
      tipo: formData.tipo,
      visibilidade: formData.visibilidade,
      criadoEm: existente?.criadoEm || agora,
      atualizadoEm: agora
    };

    await saveRotina(escritorioId, rotina);
    await recarregar();
    setIsModalOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (!escritorioId) return;
    if (!confirm('Tem certeza que deseja excluir esta rotina?')) return;
    await deleteRotina(escritorioId, id);
    await recarregar();
  };

  const toggleConcluida = async (rotina: Rotina) => {
    if (!escritorioId) return;
    await saveRotina(escritorioId, { ...rotina, concluida: !rotina.concluida });
    await recarregar();
  };

  const handleAddChecklistItem = (e: React.KeyboardEvent | React.MouseEvent) => {
    if (e.type === 'keydown' && (e as React.KeyboardEvent).key !== 'Enter') return;
    e.preventDefault();
    if (!newChecklistItem.trim()) return;
    const novoItem: RotinaChecklistItem = { id: `chk_${Date.now()}`, texto: newChecklistItem.trim(), concluido: false };
    setFormData({ ...formData, checklist: [...formData.checklist, novoItem] });
    setNewChecklistItem('');
  };

  const handleRemoveChecklistItem = (id: string) => {
    setFormData({ ...formData, checklist: formData.checklist.filter(c => c.id !== id) });
  };

  const podeVerVisibilidadeAdministradores = papel === 'admin_escritorio' || papel === 'super_admin';

  if (!escritorioId) {
    return (
      <div className="p-8 text-center text-slate-500">
        Nenhum escritório associado à sua conta — Minhas Rotinas não pode ser usado sem um escritório definido.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Minhas Rotinas</h1>
          <p className="text-sm text-slate-500 mt-1">
            Controle pessoal ou compartilhado da sua cartela de empresas — checklists, processos internos e avisos.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handleDownloadTemplate}
            className="inline-flex items-center gap-2 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition-colors"
          >
            <Download className="w-4 h-4" />
            Baixar Planilha Modelo
          </button>
          <label className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-[#0f6e56] border border-emerald-200 rounded-lg text-xs font-bold transition-colors cursor-pointer">
            <Upload className="w-4 h-4" />
            Importar Planilha
            <input type="file" ref={fileInputRef} onChange={handleImportExcel} accept=".xlsx,.xls,.csv" className="hidden" />
          </label>
          <button
            onClick={() => handleOpenModal()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1e3a5f] text-white hover:bg-[#142c47] transition-colors text-xs font-bold"
          >
            <Plus className="w-4 h-4" />
            Nova Rotina
          </button>
        </div>
      </div>

      <div className="bg-white border border-[#e5e2d9] rounded-lg flex flex-col flex-1 min-h-[400px] shadow-sm">
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 sticky top-0 border-y border-[#e5e2d9] z-10">
              <tr>
                <th className="px-3 py-2.5 text-[10px] font-bold uppercase text-slate-500 tracking-wider w-12"></th>
                <th className="px-4 py-2.5 text-[10px] font-bold uppercase text-slate-500 tracking-wider">Rotina</th>
                <th className="px-4 py-2.5 text-[10px] font-bold uppercase text-slate-500 tracking-wider">Empresa</th>
                <th className="px-4 py-2.5 text-[10px] font-bold uppercase text-slate-500 tracking-wider">Frequência / Visibilidade</th>
                <th className="px-4 py-2.5 text-[10px] font-bold uppercase text-slate-500 tracking-wider">Checklist</th>
                <th className="px-4 py-2.5 text-[10px] font-bold uppercase text-slate-500 tracking-wider text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {loading ? (
                <tr><td colSpan={6} className="p-8 text-center text-slate-400 text-sm">Carregando rotinas...</td></tr>
              ) : rotinas.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center">
                    <ListTodo className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                    <p className="text-sm font-medium text-slate-500">Nenhuma rotina configurada ainda.</p>
                    <p className="text-xs text-slate-400 mt-1">Crie sua primeira rotina, ou importe várias de uma vez pela planilha modelo.</p>
                  </td>
                </tr>
              ) : (
                rotinas.map(rotina => {
                  const totalItens = rotina.checklist.length;
                  const concluidos = rotina.checklist.filter(c => c.concluido).length;
                  const progresso = totalItens === 0 ? 0 : Math.round((concluidos / totalItens) * 100);

                  return (
                    <tr key={rotina.id} className={`hover:bg-slate-50/80 transition-colors group ${rotina.concluida ? 'opacity-60' : ''}`}>
                      <td className="px-3 py-3 align-middle text-center">
                        <button
                          onClick={() => toggleConcluida(rotina)}
                          className={`w-5 h-5 rounded flex items-center justify-center border transition-colors mx-auto ${rotina.concluida ? 'bg-[#1e3a5f] border-[#1e3a5f] text-white' : 'bg-white border-slate-300 hover:border-[#1e3a5f]'}`}
                        >
                          {rotina.concluida && <CheckCircle2 className="w-3.5 h-3.5" />}
                        </button>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-sm font-bold ${rotina.concluida ? 'text-slate-500 line-through' : 'text-slate-800'}`}>{rotina.titulo}</span>
                            <span className={`px-2 py-0.5 border text-[9px] font-bold rounded uppercase tracking-wider w-fit ${getBadgeStyle(rotina.tipo)}`}>{rotina.tipo}</span>
                          </div>
                          <span className="text-[11px] text-slate-500 line-clamp-1">{rotina.descricao}</span>
                          {rotina.userId !== userId && (
                            <span className="text-[10px] text-slate-400 mt-0.5">Criado por {rotina.userNome}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        {rotina.empresaNome ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-700">
                            <Building2 className="w-3.5 h-3.5 text-slate-400" />
                            {rotina.empresaNome}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <div className="flex flex-col gap-1">
                          <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 text-[9px] font-bold rounded uppercase tracking-wider w-fit">{rotina.recorrencia}</span>
                          {rotina.prazoInfo && (
                            <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1"><Calendar className="w-3 h-3" />{rotina.prazoInfo}</span>
                          )}
                          <span className="text-[10px] text-slate-500 flex items-center gap-1 mt-1">
                            {rotina.visibilidade === 'Privado' ? <Lock className="w-3 h-3 text-slate-400" /> : <ListTodo className="w-3 h-3 text-[#0f6e56]" />}
                            <span className={rotina.visibilidade !== 'Privado' ? 'text-[#0f6e56] font-medium' : ''}>{rotina.visibilidade}</span>
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        {totalItens > 0 ? (
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div className="h-1.5 rounded-full bg-[#0f6e56]" style={{ width: `${progresso}%` }} />
                            </div>
                            <span className="text-[10px] text-slate-500">{concluidos}/{totalItens}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-300">Sem checklist</span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-middle text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {rotina.userId === userId && (
                            <>
                              <button onClick={() => handleOpenModal(rotina)} className="p-1.5 text-slate-400 hover:text-[#1e3a5f] hover:bg-slate-100 rounded"><Edit2 className="w-3.5 h-3.5" /></button>
                              <button onClick={() => handleDelete(rotina.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 text-sm">{editingId ? 'Editar Rotina' : 'Nova Rotina'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleSave} className="p-6 flex flex-col gap-5 overflow-y-auto">
              <div className="bg-slate-50 border border-slate-200 rounded-md p-3 flex items-start gap-3">
                {formData.visibilidade === 'Privado' ? (
                  <>
                    <Lock className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-slate-600 leading-relaxed">Esta rotina será <span className="font-bold">privada</span>. Fica visível só para você.</p>
                  </>
                ) : (
                  <>
                    <ListTodo className="w-4 h-4 text-[#0f6e56] mt-0.5 shrink-0" />
                    <p className="text-xs text-[#0f6e56] leading-relaxed">Esta rotina fica visível para: <span className="font-bold">{formData.visibilidade === 'Todos' ? 'todo o escritório' : 'administradores do escritório'}</span>.</p>
                  </>
                )}
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5">Tipo</label>
                  <select value={formData.tipo} onChange={e => setFormData({ ...formData, tipo: e.target.value as RotinaTipo })} className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]">
                    <option value="Rotina">Rotina</option>
                    <option value="Compromisso">Compromisso</option>
                    <option value="Processo Interno">Processo Interno</option>
                    <option value="Aviso">Aviso</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5">Visibilidade</label>
                  <select value={formData.visibilidade} onChange={e => setFormData({ ...formData, visibilidade: e.target.value as RotinaVisibilidade })} className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]">
                    <option value="Privado">Privado</option>
                    <option value="Todos">Todos do escritório</option>
                    {podeVerVisibilidadeAdministradores && <option value="Administradores">Só administradores</option>}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5">Empresa (opcional)</label>
                <select
                  value={formData.empresaId || ''}
                  onChange={e => {
                    const cliente = clientes.find(c => c.id === e.target.value);
                    setFormData({ ...formData, empresaId: cliente?.id, empresaNome: cliente?.nome });
                  }}
                  className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
                >
                  <option value="">Nenhuma — rotina geral do escritório</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5">Título</label>
                <input required value={formData.titulo} onChange={e => setFormData({ ...formData, titulo: e.target.value })} className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]" placeholder="Ex: Conferência mensal de SPED" />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5">Descrição</label>
                <textarea value={formData.descricao} onChange={e => setFormData({ ...formData, descricao: e.target.value })} rows={2} className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]" />
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5">Frequência</label>
                  <select value={formData.recorrencia} onChange={e => setFormData({ ...formData, recorrencia: e.target.value as RotinaRecorrencia })} className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]">
                    <option value="Diária">Diária</option>
                    <option value="Semanal">Semanal</option>
                    <option value="Mensal">Mensal</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5">Prazo / Horário</label>
                  <input value={formData.prazoInfo} onChange={e => setFormData({ ...formData, prazoInfo: e.target.value })} className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]" placeholder="Ex: Todo dia 10" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5">Checklist</label>
                <div className="flex gap-2 mb-2">
                  <input
                    value={newChecklistItem}
                    onChange={e => setNewChecklistItem(e.target.value)}
                    onKeyDown={handleAddChecklistItem}
                    placeholder="Adicionar item e pressionar Enter"
                    className="flex-1 bg-white border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
                  />
                  <button type="button" onClick={handleAddChecklistItem} className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-md text-slate-600"><Plus className="w-4 h-4" /></button>
                </div>
                <div className="flex flex-col gap-1">
                  {formData.checklist.map(item => (
                    <div key={item.id} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded px-3 py-1.5 text-sm">
                      <span>{item.texto}</span>
                      <button type="button" onClick={() => handleRemoveChecklistItem(item.id)} className="text-slate-400 hover:text-red-600"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
                <button type="submit" className="px-4 py-2 text-sm font-bold text-white bg-[#1e3a5f] hover:bg-[#142c47] rounded-lg">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
