import React, { useState, useEffect } from 'react';
import {
  Brain,
  Sparkles,
  Trash2,
  FileCheck,
  Bot,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Layers,
  Search,
  BookOpen
} from 'lucide-react';
import { AgentFeedbackReport } from '../types';
import {
  getAgentFeedbackReports,
  deleteAgentFeedbackReport,
  generatePromptRefinementContext
} from '../lib/agentFeedbackService';

export function AgentFeedbackCenter() {
  const [reports, setReports] = useState<AgentFeedbackReport[]>([]);
  const [promptContext, setPromptContext] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    refreshReports();
  }, []);

  const refreshReports = () => {
    const list = getAgentFeedbackReports();
    setReports(list);
    setPromptContext(generatePromptRefinementContext());
  };

  const handleDelete = (id: string) => {
    if (confirm('Deseja remover esta ocorrência da memória de refinamento de prompts?')) {
      deleteAgentFeedbackReport(id);
      refreshReports();
    }
  };

  const filteredReports = reports.filter(r => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.descrItem.toLowerCase().includes(q) ||
      r.mistakeType.toLowerCase().includes(q) ||
      r.userJustification.toLowerCase().includes(q) ||
      (r.uf || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-purple-950 text-white p-6 sm:p-8 rounded-2xl shadow-xl border border-indigo-500/20 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-purple-500/20 border border-purple-500/30 rounded-xl text-purple-300">
              <Brain className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white tracking-tight flex items-center space-x-2">
                <span>Central de Feedback & Refinamento de Prompts</span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-500/30 text-purple-200 border border-purple-400/30">
                  Few-Shot Learning
                </span>
              </h2>
              <p className="text-xs text-indigo-200 mt-1">
                Todas as ocorrências e equívocos reportados pelos contadores são convertidos em instruções de refinamento injetadas nos prompts dos Agentes Gemini.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={refreshReports}
              className="px-3.5 py-2 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 rounded-xl border border-indigo-400/30 text-xs font-bold transition flex items-center space-x-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Atualizar Memória</span>
            </button>
          </div>
        </div>

        {/* Live Prompt Refinement Injection Preview Box */}
        <div className="bg-slate-950/80 p-4 rounded-xl border border-indigo-500/30 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-indigo-300">
            <span className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span>Contexto Injetado Automaticamente no System Prompt Gemini:</span>
            </span>
            <span className="text-[11px] text-slate-400 font-mono">
              {reports.length} ocorrência(s) ativa(s)
            </span>
          </div>
          <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto bg-slate-900 p-3 rounded-lg border border-slate-800">
            {promptContext || '// Nenhum reporte de erro registrado até o momento. Os prompts utilizarão as diretrizes padrão.'}
          </pre>
        </div>
      </div>

      {/* Reports List Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Ocorrências de Equívocos Registradas</h3>
            <p className="text-xs text-slate-500">Histórico de erros apontados para refinamento contínuo</p>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Filtrar por item, UF, motivo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64"
            />
          </div>
        </div>

        {filteredReports.length === 0 ? (
          <div className="text-center py-12 text-slate-400 space-y-2">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
            <p className="font-bold text-slate-700 text-sm">Nenhum equívoco de agente registrado.</p>
            <p className="text-xs text-slate-500">Os agentes estão operando dentro do padrão esperado.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredReports.map((report) => (
              <div
                key={report.id}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                      {report.mistakeType}
                    </span>
                    <span className="text-xs font-bold text-slate-800">{report.descrItem}</span>
                    <span className="text-xs text-slate-400 font-mono">(UF: {report.uf || 'Geral'})</span>
                  </div>

                  <div className="flex items-center space-x-3">
                    <span className="text-[11px] text-slate-400">{new Date(report.timestamp).toLocaleString('pt-BR')}</span>
                    <button
                      onClick={() => handleDelete(report.id)}
                      className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition"
                      title="Excluir ocorrência"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Values Comparison */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono bg-white p-3 rounded-lg border border-slate-200">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-rose-600 uppercase">Sugestão do Agente (Incorreta)</span>
                    <div className="text-slate-700">
                      CST: <span className="font-bold">{report.suggestedByAgent.cst || 'N/A'}</span> | 
                      CFOP: <span className="font-bold">{report.suggestedByAgent.cfop || 'N/A'}</span>
                    </div>
                  </div>

                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-emerald-600 uppercase">Valor Correto do Contador</span>
                    <div className="text-emerald-800 font-bold">
                      CST: {report.userCorrectValue.cst || 'N/A'} | 
                      CFOP: {report.userCorrectValue.cfop || 'N/A'}
                    </div>
                  </div>
                </div>

                {/* Justification */}
                <div className="text-xs text-slate-700 bg-indigo-50/50 p-3 rounded-lg border border-indigo-100/80 leading-relaxed">
                  <span className="font-bold text-indigo-900 block mb-0.5">Fundamentação Legal / Justificativa do Contador:</span>
                  "{report.userJustification}"
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
