import React from 'react';
import { Shield, Building2, Users, CheckCircle2, XCircle, Lock, Crown, UserCheck } from 'lucide-react';

export function UserHierarchyCard() {
  return (
    <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#1e3a5f]" />
            Hierarquia de Acessos e Permissões do Sistema
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            O cadastro e a gestão de usuários é restrito estritamente a administradores conforme os níveis abaixo:
          </p>
        </div>
        <span className="px-2.5 py-1 bg-blue-50 text-[#1e3a5f] border border-blue-200 text-xs font-bold rounded-full flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5" /> Controle RBAC Ativo
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Nível 1: Super Admin */}
        <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 relative flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-mono text-[10px] font-bold rounded uppercase flex items-center gap-1">
                <Crown className="w-3 h-3 text-amber-600" /> Nível 1
              </span>
              <span className="text-[11px] font-semibold text-amber-800">Acesso Global</span>
            </div>
            <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
              Super Admin
            </h4>
            <p className="text-xs text-slate-600 mt-1">
              Administrador master do sistema.
            </p>

            <div className="mt-3 space-y-1.5 text-xs text-slate-700">
              <div className="flex items-start gap-1.5 text-slate-800">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>Cadastrar usuários</strong> em qualquer escritório</span>
              </div>
              <div className="flex items-start gap-1.5 text-slate-800">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span>Criar, editar e excluir escritórios contábeis</span>
              </div>
              <div className="flex items-start gap-1.5 text-slate-800">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span>Definir papéis e re-vincular equipe</span>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-amber-200/60 text-[11px] text-amber-900 bg-amber-100/50 p-2 rounded-lg font-medium">
            🔒 <em>Proteção de Privacidade:</em> Não acessa dados fiscais e SPEDs confidenciais de escritórios de terceiros.
          </div>
        </div>

        {/* Nível 2: Admin do Escritório */}
        <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/40 relative flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="px-2 py-0.5 bg-blue-100 text-[#1e3a5f] font-mono text-[10px] font-bold rounded uppercase flex items-center gap-1">
                <Building2 className="w-3 h-3 text-[#1e3a5f]" /> Nível 2
              </span>
              <span className="text-[11px] font-semibold text-[#1e3a5f]">Escritório Local</span>
            </div>
            <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
              Admin do Escritório
            </h4>
            <p className="text-xs text-slate-600 mt-1">
              Gestor da unidade contábil vinculada.
            </p>

            <div className="mt-3 space-y-1.5 text-xs text-slate-700">
              <div className="flex items-start gap-1.5 text-slate-800">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>Convidar/cadastrar equipe</strong> do seu próprio escritório</span>
              </div>
              <div className="flex items-start gap-1.5 text-slate-800">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span>Gerenciar status dos membros locais</span>
              </div>
              <div className="flex items-start gap-1.5 text-slate-800">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span>Acesso total aos dados fiscais e clientes do escritório</span>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-blue-200/60 text-[11px] text-slate-700 bg-white/80 p-2 rounded-lg font-medium">
            ✅ Gestão completa da equipe e auditorias da sua empresa contábil.
          </div>
        </div>

        {/* Nível 3: Colaborador */}
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/80 relative flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="px-2 py-0.5 bg-slate-200 text-slate-700 font-mono text-[10px] font-bold rounded uppercase flex items-center gap-1">
                <UserCheck className="w-3 h-3 text-slate-600" /> Nível 3
              </span>
              <span className="text-[11px] font-semibold text-slate-500">Operacional</span>
            </div>
            <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
              Colaborador
            </h4>
            <p className="text-xs text-slate-600 mt-1">
              Auditor fiscal / Analista operacional.
            </p>

            <div className="mt-3 space-y-1.5 text-xs text-slate-700">
              <div className="flex items-start gap-1.5 text-slate-800">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span>Executar auditorias e cruzar SPED vs. XML</span>
              </div>
              <div className="flex items-start gap-1.5 text-slate-800">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span>Rodar Robô Fiscal e gerar relatórios</span>
              </div>
              <div className="flex items-start gap-1.5 text-slate-400">
                <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                <span className="line-through">Sem permissão para cadastrar/convidar usuários</span>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200 text-[11px] text-slate-600 bg-rose-50/50 p-2 rounded-lg font-medium border-rose-100">
            🚫 <strong>Sem permissão administrativa:</strong> Não pode cadastrar novos usuários.
          </div>
        </div>
      </div>
    </div>
  );
}
