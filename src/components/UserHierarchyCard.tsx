import React from 'react';
import { Shield, Building2, Users, CheckCircle2, XCircle, Lock, Crown, UserCheck } from 'lucide-react';

export function UserHierarchyCard() {
  return (
    <div className="atlas-card p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-[var(--atlas-border)] pb-4">
        <div>
          <h3 className="text-lg font-bold text-[var(--atlas-navy)] flex items-center gap-2">
            <Shield className="w-5 h-5 text-[var(--atlas-navy)]" />
            Hierarquia de Acessos e Permissões do Sistema
          </h3>
          <p className="text-xs text-[var(--atlas-text-secondary)] mt-0.5">
            O cadastro e a gestão de usuários é restrito estritamente a administradores conforme os níveis abaixo:
          </p>
        </div>
        <span className="atlas-pill atlas-pill-navy flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5" /> Controle RBAC Ativo
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Nível 1: Super Admin */}
        <div className="p-4 rounded-xl border border-[var(--atlas-border)] bg-[var(--atlas-surface)] relative flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="atlas-pill atlas-pill-warning flex items-center gap-1">
                <Crown className="w-3 h-3 text-[var(--atlas-warning)]" /> Nível 1
              </span>
              <span className="text-[11px] font-semibold text-[var(--atlas-warning)]">Acesso Global</span>
            </div>
            <h4 className="font-bold text-[var(--atlas-text)] text-sm flex items-center gap-1.5">
              Super Admin
            </h4>
            <p className="text-xs text-[var(--atlas-text-secondary)] mt-1">
              Administrador master do sistema.
            </p>

            <div className="mt-3 space-y-1.5 text-xs text-[var(--atlas-text)]">
              <div className="flex items-start gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[var(--atlas-accent)] shrink-0 mt-0.5" />
                <span><strong>Cadastrar usuários</strong> em qualquer escritório</span>
              </div>
              <div className="flex items-start gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[var(--atlas-accent)] shrink-0 mt-0.5" />
                <span>Criar, editar e excluir escritórios contábeis</span>
              </div>
              <div className="flex items-start gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[var(--atlas-accent)] shrink-0 mt-0.5" />
                <span>Definir papéis e re-vincular equipe</span>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-[var(--atlas-border)] text-[11px] text-[var(--atlas-text-secondary)] bg-[var(--atlas-surface-hover)] p-2 rounded-lg font-medium">
            🔒 <em>Proteção de Privacidade:</em> Não acessa dados fiscais e SPEDs confidenciais de escritórios de terceiros.
          </div>
        </div>

        {/* Nível 2: Admin do Escritório */}
        <div className="p-4 rounded-xl border border-[var(--atlas-border)] bg-[var(--atlas-surface)] relative flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="atlas-pill atlas-pill-navy flex items-center gap-1">
                <Building2 className="w-3 h-3 text-[var(--atlas-navy)]" /> Nível 2
              </span>
              <span className="text-[11px] font-semibold text-[var(--atlas-navy)]">Escritório Local</span>
            </div>
            <h4 className="font-bold text-[var(--atlas-text)] text-sm flex items-center gap-1.5">
              Admin do Escritório
            </h4>
            <p className="text-xs text-[var(--atlas-text-secondary)] mt-1">
              Gestor da unidade contábil vinculada.
            </p>

            <div className="mt-3 space-y-1.5 text-xs text-[var(--atlas-text)]">
              <div className="flex items-start gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[var(--atlas-accent)] shrink-0 mt-0.5" />
                <span><strong>Convidar/cadastrar equipe</strong> do seu próprio escritório</span>
              </div>
              <div className="flex items-start gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[var(--atlas-accent)] shrink-0 mt-0.5" />
                <span>Gerenciar status dos membros locais</span>
              </div>
              <div className="flex items-start gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[var(--atlas-accent)] shrink-0 mt-0.5" />
                <span>Acesso total aos dados fiscais e clientes do escritório</span>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-[var(--atlas-border)] text-[11px] text-[var(--atlas-text-secondary)] bg-[var(--atlas-surface-hover)] p-2 rounded-lg font-medium">
            Gestão completa da equipe e auditorias da sua empresa contábil.
          </div>
        </div>

        {/* Nível 3: Colaborador */}
        <div className="p-4 rounded-xl border border-[var(--atlas-border)] bg-[var(--atlas-surface)] relative flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="atlas-pill atlas-pill-accent flex items-center gap-1">
                <UserCheck className="w-3 h-3 text-[var(--atlas-accent)]" /> Nível 3
              </span>
              <span className="text-[11px] font-semibold text-[var(--atlas-text-muted)]">Operacional</span>
            </div>
            <h4 className="font-bold text-[var(--atlas-text)] text-sm flex items-center gap-1.5">
              Colaborador
            </h4>
            <p className="text-xs text-[var(--atlas-text-secondary)] mt-1">
              Auditor fiscal / Analista operacional.
            </p>

            <div className="mt-3 space-y-1.5 text-xs text-[var(--atlas-text)]">
              <div className="flex items-start gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[var(--atlas-accent)] shrink-0 mt-0.5" />
                <span>Executar auditorias e cruzar SPED vs. XML</span>
              </div>
              <div className="flex items-start gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[var(--atlas-accent)] shrink-0 mt-0.5" />
                <span>Rodar Robô Fiscal e gerar relatórios</span>
              </div>
              <div className="flex items-start gap-1.5 text-[var(--atlas-text-muted)]">
                <XCircle className="w-3.5 h-3.5 text-[var(--atlas-danger)] shrink-0 mt-0.5" />
                <span className="line-through">Sem permissão para cadastrar/convidar usuários</span>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-[var(--atlas-border)] text-[11px] text-[var(--atlas-danger)] bg-[var(--atlas-danger-bg)] p-2 rounded-lg font-medium">
            <strong>Sem permissão administrativa:</strong> Não pode cadastrar novos usuários.
          </div>
        </div>
      </div>
    </div>
  );
}

