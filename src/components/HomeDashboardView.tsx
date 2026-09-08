import React, { useState } from 'react';
import { 
  Building2, 
  Bot, 
  FileText, 
  Calendar, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowRight, 
  ShieldCheck, 
  Info, 
  TrendingUp, 
  Activity,
  Layers,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  BrainCircuit
} from 'lucide-react';
import { Cliente, RoboExecutionLog, SpedData } from '../types';

interface HomeDashboardViewProps {
  clientes: Cliente[];
  logs: RoboExecutionLog[];
  spedData: SpedData | null;
  setActiveTab: (tab: string) => void;
  userEmail?: string;
}

export function HomeDashboardView({ clientes, logs, spedData, setActiveTab, userEmail }: HomeDashboardViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const ano = currentDate.getFullYear();
  const mes = currentDate.getMonth(); // 0-11
  const nomeMes = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(currentDate);

  // Mês anterior cujos dados são entregues neste mês
  const mesReferenciaDate = new Date(ano, mes - 1, 1);
  const nomeMesReferencia = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(mesReferenciaDate);

  const prevMonth = () => {
    setCurrentDate(new Date(ano, mes - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(ano, mes + 1, 1));
  };

  // Função para calcular o dia útil antecipado se cair em fim de semana (Dia 15 e Dia 20)
  function calcularPrazoUtil(year: number, month: number, targetDay: number) {
    const date = new Date(year, month, targetDay);
    const dayOfWeek = date.getDay(); // 0 = Domingo, 6 = Sábado
    let ajustado = new Date(date);
    let foiAntecipado = false;
    let motivoAntecipacao = '';

    if (dayOfWeek === 0) {
      // Domingo -> Antecipa 2 dias para Sexta-feira
      ajustado.setDate(targetDay - 2);
      foiAntecipado = true;
      motivoAntecipacao = 'Dia 15/20 caiu em Domingo. Antecipado para Sexta-feira anterior.';
    } else if (dayOfWeek === 6) {
      // Sábado -> Antecipa 1 dia para Sexta-feira
      ajustado.setDate(targetDay - 1);
      foiAntecipado = true;
      motivoAntecipacao = 'Dia 15/20 caiu em Sábado. Antecipado para Sexta-feira anterior.';
    }

    return {
      diaOriginal: targetDay,
      dataOriginal: date,
      diaAjustado: ajustado.getDate(),
      dataAjustada: ajustado,
      diaSemanaStr: new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(date),
      diaSemanaAjustadoStr: new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'numeric' }).format(ajustado),
      foiAntecipado,
      motivoAntecipacao
    };
  }

  const prazoNormal = calcularPrazoUtil(ano, mes, 15);
  const prazoSimples = calcularPrazoUtil(ano, mes, 20);

  const hoje = new Date();
  const isMesAtual = hoje.getFullYear() === ano && hoje.getMonth() === mes;
  const diaHoje = hoje.getDate();

  function getStatusPrazo(diaVencimento: number) {
    if (!isMesAtual) return { status: 'FUTURO', label: 'Agendado', color: 'bg-[var(--atlas-bg)] text-[var(--atlas-text-secondary)] border-[var(--atlas-border)]' };
    if (diaHoje > diaVencimento) return { status: 'VENCIDO', label: 'Prazo Vencido', color: 'atlas-alert-danger' };
    if (diaVencimento - diaHoje <= 3) return { status: 'URGENTE', label: 'Vence em Breve', color: 'atlas-alert-warning' };
    return { status: 'EM_DIA', label: 'No Prazo', color: 'atlas-alert-success' };
  }

  const statusNormal = getStatusPrazo(prazoNormal.diaAjustado);
  const statusSimples = getStatusPrazo(prazoSimples.diaAjustado);

  const totalNormais = clientes.filter(c => !(c.regimeTributario || '').toUpperCase().includes('SIMPLES')).length;
  const totalSimples = clientes.filter(c => (c.regimeTributario || '').toUpperCase().includes('SIMPLES')).length;

  const totalInconsistencias = logs.reduce((acc, l) => acc + (l.inconsistenciasCount || 0), 0);

  return (
    <div className="space-y-6 pb-16 text-xs font-sans">
      {/* Breadcrumb Bar */}
      <div className="atlas-breadcrumb-bar">
        <div className="flex items-center space-x-2 text-[13px]">
          <span className="text-[var(--atlas-text-muted)] font-medium">Atlas</span>
          <span className="text-[var(--atlas-text-muted)]">/</span>
          <span className="text-[var(--atlas-text)] font-semibold">Painel Inicial</span>
        </div>
        <div className="text-[12px] text-[var(--atlas-text-secondary)] font-medium">
          {clientes.length > 0 ? `Escritório Ativo (${clientes.length} Clientes)` : 'Escritório Modelo Contabilidade'}
        </div>
      </div>

      <div className="px-6 space-y-6">
        {/* Banner Superior com Textura Sutil */}
        <div className="bg-[var(--atlas-navy)] rounded-2xl p-7 text-white shadow-md relative overflow-hidden">
          {/* Textura de Pontos em Baixa Opacidade */}
          <div 
            className="absolute inset-0 opacity-15 pointer-events-none" 
            style={{
              backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.4) 1px, transparent 1px)',
              backgroundSize: '16px 16px'
            }}
          />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Atlas Auditor Fiscal — Painel Geral & Prazos</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white font-serif">
                Central de Operações Fiscais
              </h1>
              <p className="text-slate-200 text-[13px] max-w-xl leading-relaxed">
                Bem-vindo ao sistema de auditoria SPED e gestão de prazos fiscais com antecipação automática para dias úteis.
              </p>
            </div>

            <div className="flex items-center space-x-3 bg-white/10 backdrop-blur-md border border-white/20 px-5 py-3.5 rounded-xl">
              <div className="p-2.5 bg-white/10 rounded-lg text-emerald-300">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] text-slate-300 uppercase tracking-wider font-medium">Competência Referência</p>
                <p className="text-sm font-bold text-white capitalize">{nomeMesReferencia}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Faixa Única de Indicadores (Stat Strip) */}
        <div className="atlas-stat-strip">
          <div className="atlas-stat-item space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[var(--atlas-text-secondary)] font-medium text-[12px]">Clientes Cadastrados</span>
              <Building2 className="w-4 h-4 text-[var(--atlas-accent)]" />
            </div>
            <div className="text-2xl font-extrabold text-[var(--atlas-text)]">{clientes.length}</div>
            <div className="text-[11px] text-[var(--atlas-text-muted)] flex items-center space-x-1">
              <span>{totalNormais} Normal</span>
              <span>•</span>
              <span>{totalSimples} Simples</span>
            </div>
          </div>

          <div className="atlas-stat-item space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[var(--atlas-text-secondary)] font-medium text-[12px]">Status SPED Atual</span>
              <FileText className="w-4 h-4 text-[var(--atlas-navy)]" />
            </div>
            <div className="text-base font-bold text-[var(--atlas-text)] truncate">
              {spedData ? 'Importado & Ativo' : 'Aguardando Arquivo'}
            </div>
            <div className="text-[11px] text-[var(--atlas-text-muted)] truncate">
              {spedData?.header?.nome || 'Nenhum SPED na sessão'}
            </div>
          </div>

          <div className="atlas-stat-item space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[var(--atlas-text-secondary)] font-medium text-[12px]">Auditorias Realizadas</span>
              <Activity className="w-4 h-4 text-[var(--atlas-accent)]" />
            </div>
            <div className="text-2xl font-extrabold text-[var(--atlas-text)]">{logs.length}</div>
            <div className="text-[11px] text-[var(--atlas-accent-dark)] font-medium">
              {totalInconsistencias} inconsistências mapeadas
            </div>
          </div>

          <div className="atlas-stat-item space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[var(--atlas-text-secondary)] font-medium text-[12px]">Robô Fiscal IA</span>
              <Bot className="w-4 h-4 text-[var(--atlas-info)]" />
            </div>
            <div className="text-base font-bold text-[var(--atlas-text)]">Ativo 24/7</div>
            <div className="text-[11px] text-[var(--atlas-info)] font-medium">Monitoramento contínuo</div>
          </div>
        </div>

        {/* Atalhos Rápidos no Topo do Painel */}
        <div className="atlas-card p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-[var(--atlas-navy)]" />
            <span className="font-bold text-[var(--atlas-text)] text-xs font-serif">Módulos de Gestão Rápida:</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveTab('admin_panel')}
              className="atlas-btn atlas-btn-secondary px-3 py-1.5 text-xs"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[var(--atlas-navy)]" />
              <span>Gestão de Escritórios (ADM)</span>
            </button>
            <button
              onClick={() => setActiveTab('clientes')}
              className="atlas-btn atlas-btn-secondary px-3 py-1.5 text-xs"
            >
              <Building2 className="w-3.5 h-3.5 text-[var(--atlas-text-secondary)]" />
              <span>Gerenciar Clientes</span>
            </button>
            <button
              onClick={() => setActiveTab('robo_fiscal')}
              className="atlas-btn atlas-btn-secondary px-3 py-1.5 text-xs"
            >
              <Bot className="w-3.5 h-3.5 text-[var(--atlas-accent)]" />
              <span>Robô Fiscal AI</span>
            </button>
            <button
              onClick={() => setActiveTab('ai_orchestrator')}
              className="atlas-btn atlas-btn-primary px-3 py-1.5 text-xs"
            >
              <BrainCircuit className="w-3.5 h-3.5" />
              <span>Orquestrador Multi-IA</span>
            </button>
          </div>
        </div>

        {/* Calendário e Prazos Fiscais - Card Único com Divisor Vertical */}
        <div className="atlas-card p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--atlas-border)] pb-4">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-xl bg-[var(--atlas-warning-bg)] text-[var(--atlas-warning)]">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[var(--atlas-text)] capitalize font-serif">
                  Prazos Fiscais & Vencimentos SPED — {nomeMes}
                </h2>
                <p className="text-[var(--atlas-text-secondary)] text-[12px]">
                  Regra oficial aplicada: Se o dia 15 ou 20 cair em fim de semana ou feriado, o prazo é <strong>antecipado automaticamente</strong> para a Sexta-feira útil anterior.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 bg-[var(--atlas-bg)] p-1.5 rounded-xl border border-[var(--atlas-border)] self-start sm:self-auto">
              <button
                onClick={prevMonth}
                className="p-1.5 hover:bg-white rounded-lg text-slate-700 transition-colors"
                title="Mês Anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-bold text-[var(--atlas-text)] px-3 capitalize text-xs">{nomeMes}</span>
              <button
                onClick={nextMonth}
                className="p-1.5 hover:bg-white rounded-lg text-slate-700 transition-colors"
                title="Próximo Mês"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Divisor Vertical entre Dia 15 e Dia 20 num Único Card */}
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[var(--atlas-border)] gap-6 md:gap-0">
            {/* Bloco Prazo SPED Normais (Dia 15) */}
            <div className="md:pr-6 space-y-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1.5">
                  <div className="flex items-center space-x-2">
                    <span className="atlas-pill atlas-pill-navy">
                      Regime Normal (Real / Presumido)
                    </span>
                    <span className={`atlas-pill ${statusNormal.status === 'VENCIDO' ? 'atlas-pill-danger' : statusNormal.status === 'URGENTE' ? 'atlas-pill-warning' : 'atlas-pill-accent'}`}>
                      {statusNormal.label}
                    </span>
                  </div>
                  <h3 className="font-bold text-[var(--atlas-text)] text-sm font-serif">EFD ICMS/IPI (SPED Fiscal)</h3>
                  <p className="text-[var(--atlas-text-muted)] text-[11px]">
                    Competência Referência: <span className="font-semibold text-[var(--atlas-text-secondary)] capitalize">{nomeMesReferencia}</span>
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-3xl font-extrabold text-[var(--atlas-navy)] block tracking-tight">
                    Dia {prazoNormal.diaAjustado}
                  </span>
                  <span className="text-[10px] font-bold text-[var(--atlas-text-muted)] uppercase tracking-wider block">
                    {prazoNormal.diaSemanaAjustadoStr}
                  </span>
                </div>
              </div>

              <div className="bg-[var(--atlas-bg)] rounded-xl p-3.5 border border-[var(--atlas-border)] space-y-1.5 text-[12px] text-[var(--atlas-text-secondary)]">
                <div className="flex items-center space-x-1.5 font-semibold text-[var(--atlas-text)]">
                  <Info className="w-3.5 h-3.5 text-[var(--atlas-navy)] shrink-0" />
                  <span>Análise de Vencimento (Dia 15):</span>
                </div>
                <p className="leading-relaxed">
                  {prazoNormal.foiAntecipado ? (
                    <span className="text-[var(--atlas-warning)] font-medium block">
                      ⚠️ {prazoNormal.motivoAntecipacao} (O dia 15 original era {prazoNormal.diaSemanaStr}).
                    </span>
                  ) : (
                    <span className="text-[var(--atlas-accent)] font-medium block">
                      ✓ Dia 15 é dia útil ({prazoNormal.diaSemanaStr}). Sem antecipação necessária.
                    </span>
                  )}
                </p>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[var(--atlas-text-muted)] text-[11.5px]">
                  Empresas afetadas: <strong className="text-[var(--atlas-text)]">{totalNormais}</strong>
                </span>
                <button
                  onClick={() => setActiveTab('clientes')}
                  className="atlas-btn atlas-btn-primary px-3 py-1.5 text-xs"
                >
                  <span>Ver Clientes Normais</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Bloco Prazo SPED Simples Nacional (Dia 20) */}
            <div className="md:pl-6 pt-6 md:pt-0 space-y-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1.5">
                  <div className="flex items-center space-x-2">
                    <span className="atlas-pill atlas-pill-accent">
                      Simples Nacional
                    </span>
                    <span className={`atlas-pill ${statusSimples.status === 'VENCIDO' ? 'atlas-pill-danger' : statusSimples.status === 'URGENTE' ? 'atlas-pill-warning' : 'atlas-pill-accent'}`}>
                      {statusSimples.label}
                    </span>
                  </div>
                  <h3 className="font-bold text-[var(--atlas-text)] text-sm font-serif">PGDAS-D & Obrigações Acessórias</h3>
                  <p className="text-[var(--atlas-text-muted)] text-[11px]">
                    Competência Referência: <span className="font-semibold text-[var(--atlas-text-secondary)] capitalize">{nomeMesReferencia}</span>
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-3xl font-extrabold text-[var(--atlas-accent)] block tracking-tight">
                    Dia {prazoSimples.diaAjustado}
                  </span>
                  <span className="text-[10px] font-bold text-[var(--atlas-text-muted)] uppercase tracking-wider block">
                    {prazoSimples.diaSemanaAjustadoStr}
                  </span>
                </div>
              </div>

              <div className="bg-[var(--atlas-bg)] rounded-xl p-3.5 border border-[var(--atlas-border)] space-y-1.5 text-[12px] text-[var(--atlas-text-secondary)]">
                <div className="flex items-center space-x-1.5 font-semibold text-[var(--atlas-text)]">
                  <Info className="w-3.5 h-3.5 text-[var(--atlas-accent)] shrink-0" />
                  <span>Análise de Vencimento (Dia 20):</span>
                </div>
                <p className="leading-relaxed">
                  {prazoSimples.foiAntecipado ? (
                    <span className="text-[var(--atlas-warning)] font-medium block">
                      ⚠️ {prazoSimples.motivoAntecipacao} (O dia 20 original era {prazoSimples.diaSemanaStr}).
                    </span>
                  ) : (
                    <span className="text-[var(--atlas-accent)] font-medium block">
                      ✓ Dia 20 é dia útil ({prazoSimples.diaSemanaStr}). Sem antecipação necessária.
                    </span>
                  )}
                </p>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[var(--atlas-text-muted)] text-[11.5px]">
                  Empresas afetadas: <strong className="text-[var(--atlas-text)]">{totalSimples}</strong>
                </span>
                <button
                  onClick={() => setActiveTab('clientes')}
                  className="atlas-btn atlas-btn-accent px-3 py-1.5 text-xs"
                >
                  <span>Ver Clientes Simples</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Acesso Rápido aos Módulos Principais — Lista com atlas-list-row em vez de 3 cards */}
        <div className="space-y-3">
          <h2 className="text-base font-bold text-[var(--atlas-text)] tracking-tight flex items-center space-x-2 font-serif">
            <Sparkles className="w-4 h-4 text-[var(--atlas-navy)]" />
            <span>Ferramentas de Auditoria & Acesso Rápido</span>
          </h2>

          <div className="atlas-card p-0 overflow-hidden">
            <div 
              onClick={() => setActiveTab('upload')}
              className="atlas-list-row flex items-center justify-between cursor-pointer group hover:bg-[var(--atlas-bg)]"
            >
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 rounded-xl bg-[var(--atlas-navy-tint)] text-[var(--atlas-navy)] flex items-center justify-center font-bold shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-[var(--atlas-text)] text-sm font-serif group-hover:text-[var(--atlas-navy)] transition-colors">Importar & Auditar SPED</h3>
                  <p className="text-[var(--atlas-text-secondary)] text-[12px] mt-0.5">Carregue arquivos EFD ICMS/IPI para validação completa de blocos, C170, C190 e omissas.</p>
                </div>
              </div>
              <div className="flex items-center space-x-1.5 text-[13px] font-semibold text-[var(--atlas-navy)] shrink-0 ml-4">
                <span>Iniciar Importação</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            <div 
              onClick={() => setActiveTab('clientes')}
              className="atlas-list-row flex items-center justify-between cursor-pointer group hover:bg-[var(--atlas-bg)]"
            >
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 rounded-xl bg-[var(--atlas-accent-tint)] text-[var(--atlas-accent)] flex items-center justify-center font-bold shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-[var(--atlas-text)] text-sm font-serif group-hover:text-[var(--atlas-accent)] transition-colors">Clientes & Pastas Nuvem</h3>
                  <p className="text-[var(--atlas-text-secondary)] text-[12px] mt-0.5">Gerencie o cadastro de clientes, regimes tributários e pastas monitoradas pelo robô.</p>
                </div>
              </div>
              <div className="flex items-center space-x-1.5 text-[13px] font-semibold text-[var(--atlas-accent)] shrink-0 ml-4">
                <span>Gerenciar Clientes</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            <div 
              onClick={() => setActiveTab('robo_fiscal')}
              className="atlas-list-row flex items-center justify-between cursor-pointer group hover:bg-[var(--atlas-bg)]"
            >
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 rounded-xl bg-[var(--atlas-info-tint)] text-[var(--atlas-info)] flex items-center justify-center font-bold shrink-0">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-[var(--atlas-text)] text-sm font-serif group-hover:text-[var(--atlas-info)] transition-colors">Robô Fiscal IA</h3>
                  <p className="text-[var(--atlas-text-secondary)] text-[12px] mt-0.5">Automação inteligente de varredura de arquivos fiscais e detecção de divergências.</p>
                </div>
              </div>
              <div className="flex items-center space-x-1.5 text-[13px] font-semibold text-[var(--atlas-info)] shrink-0 ml-4">
                <span>Acessar Robô IA</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
