import React, { useState } from 'react';
import {
  AlertTriangle,
  X,
  CheckCircle2,
  Sparkles,
  Bot,
  Send,
  HelpCircle,
  FileText,
  Building2
} from 'lucide-react';
import { AgentFeedbackReport } from '../types';
import { saveAgentFeedbackReport } from '../lib/agentFeedbackService';

interface AgentErrorReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemData: {
    itemKey?: string;
    docNum?: string;
    itemNum?: string;
    descrItem: string;
    ncm?: string;
    cstIcms?: string;
    cfop?: string;
    uf?: string;
    suggestedNcm?: string;
    suggestedCst?: string;
    suggestedCfop?: string;
  };
  onReportSaved?: (report: AgentFeedbackReport) => void;
}

export function AgentErrorReportModal({
  isOpen,
  onClose,
  itemData,
  onReportSaved
}: AgentErrorReportModalProps) {
  const [reportedAgentId, setReportedAgentId] = useState<'agent1' | 'agent2' | 'agent3' | 'all'>('agent1');
  const [mistakeType, setMistakeType] = useState<AgentFeedbackReport['mistakeType']>('CST Incorreto');
  
  const [userCorrectCst, setUserCorrectCst] = useState<string>(itemData.cstIcms || '');
  const [userCorrectCfop, setUserCorrectCfop] = useState<string>(itemData.cfop || '');
  const [userCorrectNcm, setUserCorrectNcm] = useState<string>(itemData.ncm || '');
  const [userJustification, setUserJustification] = useState<string>('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userJustification.trim()) {
      alert('Por favor, informe uma breve justificativa ou fundamentação legal.');
      return;
    }

    setIsSubmitting(true);

    const newReport = saveAgentFeedbackReport({
      itemKey: itemData.itemKey || `${itemData.ncm}_${itemData.cstIcms}_${itemData.cfop}_${itemData.descrItem}`,
      docNum: itemData.docNum,
      itemNum: itemData.itemNum,
      descrItem: itemData.descrItem,
      reportedAgentId,
      mistakeType,
      suggestedByAgent: {
        ncm: itemData.suggestedNcm || itemData.ncm,
        cst: itemData.suggestedCst || itemData.cstIcms,
        cfop: itemData.suggestedCfop || itemData.cfop
      },
      userCorrectValue: {
        ncm: userCorrectNcm,
        cst: userCorrectCst,
        cfop: userCorrectCfop
      },
      userJustification,
      uf: itemData.uf || 'SP'
    });

    setIsSubmitting(false);
    setSubmittedSuccess(true);

    if (onReportSaved) {
      onReportSaved(newReport);
    }

    setTimeout(() => {
      setSubmittedSuccess(false);
      onClose();
    }, 1800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-lg shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-[#1e3a5f] text-white p-5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-amber-500/20 border border-amber-500/30 text-amber-400 rounded-lg">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Reportar Equívoco do Agente AI</h3>
              <p className="text-xs text-slate-300">Refinamento de prompt e ajuste fino de decisão</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-[#142c47] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        {submittedSuccess ? (
          <div className="p-8 text-center space-y-4 my-auto">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto animate-bounce">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h4 className="text-xl font-bold text-slate-900">Ocorrência registrada</h4>
            <p className="text-sm text-slate-600 max-w-sm mx-auto">
              O feedback foi salvo na **Memória de Refinamento de Prompts**. As próximas análises deste agente considerarão essa fundamentação legal.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
            {/* Item Context */}
            <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-1">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Item C170 Selecionado</div>
              <div className="font-bold text-slate-800 text-sm">{itemData.descrItem}</div>
              <div className="text-xs text-slate-600 flex flex-wrap gap-2 font-mono pt-1">
                <span>Doc: #{itemData.docNum || 'N/A'}</span> | 
                <span>Item: #{itemData.itemNum || '1'}</span> | 
                <span>NCM atual: {itemData.ncm || 'N/A'}</span>
              </div>
            </div>

            {/* Select Agent */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                Qual agente cometeu o equívoco?
              </label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  { id: 'agent1', name: 'Agente 1 (NCM/CST)' },
                  { id: 'agent2', name: 'Agente 2 (CFOP/Op)' },
                  { id: 'agent3', name: 'Agente 3 (Consenso)' },
                  { id: 'all', name: 'Todos os Agentes' },
                ].map((ag) => (
                  <button
                    key={ag.id}
                    type="button"
                    onClick={() => setReportedAgentId(ag.id as any)}
                    className={`p-2.5 rounded-lg border font-semibold text-left transition flex items-center space-x-2 cursor-pointer ${
                      reportedAgentId === ag.id
                        ? 'bg-[#f1efe8] border-[#1e3a5f] text-[#1e3a5f] shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Bot className="w-4 h-4 text-[#1e3a5f] shrink-0" />
                    <span className="truncate">{ag.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Mistake Type */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                Tipo de Inconformidade / Erro do Agente
              </label>
              <select
                value={mistakeType}
                onChange={(e) => setMistakeType(e.target.value as any)}
                className="w-full p-2.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-[#1e3a5f] focus:outline-none"
              >
                <option value="CST Incorreto">Sugestão de CST Incorreto (Ex: Exige CST 60 ST ao invés de 00)</option>
                <option value="CFOP Incompatível">CFOP Incompatível para a operação na UF</option>
                <option value="Falso Positivo">Falso Positivo (Agente apontou erro onde estava correto)</option>
                <option value="NCM Invalida">Classificação NCM incorreta para o produto</option>
                <option value="Regra UF Específica">Exceção de Legislação Estadual (SEFAZ local)</option>
                <option value="Outro">Outro equívoco na análise</option>
              </select>
            </div>

            {/* Values Comparison inputs */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  CST Correto (Usuário)
                </label>
                <input
                  type="text"
                  placeholder="Ex: 60"
                  value={userCorrectCst}
                  onChange={(e) => setUserCorrectCst(e.target.value)}
                  className="w-full p-2 text-xs border border-slate-300 rounded-lg text-slate-800 font-mono font-bold focus:ring-2 focus:ring-[#1e3a5f] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  CFOP Correto (Usuário)
                </label>
                <input
                  type="text"
                  placeholder="Ex: 5405"
                  value={userCorrectCfop}
                  onChange={(e) => setUserCorrectCfop(e.target.value)}
                  className="w-full p-2 text-xs border border-slate-300 rounded-lg text-slate-800 font-mono font-bold focus:ring-2 focus:ring-[#1e3a5f] focus:outline-none"
                />
              </div>
            </div>

            {/* Justification & Legal Basis */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Justificativa / Fundamentação Legal <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                placeholder="Explicite o motivo da correção para que o agente aprenda essa regra específica (Ex: Na UF-SP, bebidas frias destinadas a revenda exigem CST 60)..."
                value={userJustification}
                onChange={(e) => setUserJustification(e.target.value)}
                className="w-full p-3 text-xs border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-[#1e3a5f] focus:outline-none leading-relaxed"
                required
              />
              <p className="text-[11px] text-slate-500 mt-1 flex items-center">
                <Sparkles className="w-3.5 h-3.5 mr-1 text-[#1e3a5f] shrink-0" />
                Esta justificativa será injetada no contexto dos prompts futuros para aprendizado em tempo real.
              </p>
            </div>

            {/* Actions */}
            <div className="pt-2 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-[#1e3a5f] hover:bg-[#142c47] text-white rounded-lg text-xs font-bold shadow-sm transition flex items-center space-x-2 disabled:opacity-50 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>Salvar Reporte & Refinar Prompt</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
