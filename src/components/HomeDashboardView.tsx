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
  BrainCircuit,
  Home,
  UserCheck
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
    if (!isMesAtual) return { status: 'FUTURO', label: 'Agendado', color: 'atlas-pill-navy' };
    if (diaHoje > diaVencimento) return { status: 'VENCIDO', label: 'Prazo Vencido', color: 'atlas-pill-danger' };
    if (diaVencimento - diaHoje <= 3) return { status: 'URGENTE', label: 'Vence em Breve', color: 'atlas-pill-warning' };
    return { status: 'EM_DIA', label: 'No Prazo', color: 'atlas-pill-accent' };
  }

  const statusNormal = getStatusPrazo(prazoNormal.diaAjustado);
  const statusSimples = getStatusPrazo(prazoSimples.diaAjustado);

  const totalNormais = clientes.filter(c => !(c.regimeTributario || '').toUpperCase().includes('SIMPLES')).length;
  const totalSimples = clientes.filter(c => (c.regimeTributario || '').toUpperCase().includes('SIMPLES')).length;

  const totalInconsistencias = logs.reduce((acc, l) => acc + (l.inconsistenciasCount || 0), 0);

  const clienteAtivoNome = spedData?.header?.nome || 'Nenhum cliente ativo selecionado';
  const clienteAtivoCnpj = spedData?.header?.cnpj || 'Sem CNPJ/SPED ativo';

  return (
    <div className="space-y-6 pb-16 text-xs font-sans p-6 text-[var(--atlas-text)]">

      {/* Header Banner com Fundo Azul Elegante e Tipografia de Alto Contraste */}
      <div 
        className="atlas-card p-6 md:p-8 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6 border-0 shadow-lg text-white"
        style={{
          background: 'linear-gradient(135deg, var(--atlas-navy) 0%, var(--atlas-navy-dark) 100%)',
        }}
      >
        {/* Efeito sutil de luz/brilho decorativo no fundo */}
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-white/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-[var(--atlas-accent)]/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="space-y-2.5 relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold text-blue-100 border border-white/20 bg-white/10 backdrop-blur-sm">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
            <span>Painel de Controle & Gestão Fiscal</span>
          </div>
          <h1 className="text-[28px] font-extrabold text-white tracking-tight leading-tight !text-white" style={{ fontFamily: 'var(--font-display)' }}>
            Atlas Auditor Fiscal
          </h1>
          <p className="text-sm text-blue-100/90 leading-relaxed font-normal">
            Plataforma de inteligência tributária, conciliação SPED x XML e automação de conformidade fiscal para o seu escritório.
          </p>
        </div>

        {/* Módulos de Gestão Rápida */}
        <div className="flex flex-wrap items-center gap-2.5 relative z-10 shrink-0">
          <button
            onClick={() => setActiveTab('admin_panel')}
            className="atlas-btn py-2 px-4 text-xs font-bold bg-white text-[var(--atlas-navy)] hover:bg-slate-100 shadow-sm border-0 transition-all rounded-lg flex items-center gap-2"
          >
            <ShieldCheck className="w-4 h-4 text-[var(--atlas-navy)]" />
            <span>Gestão ADM</span>
          </button>
          <button
            onClick={() => setActiveTab('clientes')}
            className="atlas-btn py-2 px-4 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-sm transition-all rounded-lg flex items-center gap-2"
          >
            <Building2 className="w-4 h-4 text-blue-200" />
            <span>Clientes</span>
          </button>
          <button
            onClick={() => setActiveTab('robo_fiscal')}
            className="atlas-btn py-2 px-4 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-sm transition-all rounded-lg flex items-center gap-2"
          >
            <Bot className="w-4 h-4 text-cyan-300" />
            <span>Robô Fiscal</span>
          </button>
        </div>
      </div>

      {/* Faixa de Indicadores Única (.atlas-stat-strip) */}
      <div className="atlas-stat-strip">
        <div className="atlas-stat-item">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-semibold text-[var(--atlas-text-secondary)] uppercase tracking-wider">Clientes Cadastrados</span>
            <Building2 className="w-4 h-4 text-[var(--atlas-accent)]" />
          </div>
          <div className="atlas-stat-value">{clientes.length}</div>
          <div className="text-[10px] text-[var(--atlas-text-muted)] mt-1 flex items-center gap-1">
            <span>{totalNormais} Regime Normal</span>
            <span>•</span>
            <span>{totalSimples} Simples Nacional</span>
          </div>
        </div>

        <div className="atlas-stat-item">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-semibold text-[var(--atlas-text-secondary)] uppercase tracking-wider">Status SPED Atual</span>
            <FileText className="w-4 h-4 text-[var(--atlas-navy)]" />
          </div>
          <div className="text-xl font-bold text-[var(--atlas-navy)] truncate mt-1">
            {spedData ? 'Importado & Ativo' : 'Aguardando Arquivo'}
          </div>
          <div className="text-[10px] text-[var(--atlas-text-muted)] truncate mt-1">
            {spedData?.header?.nome || 'Nenhum SPED carregado na sessão'}
          </div>
        </div>

        <div className="atlas-stat-item">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-semibold text-[var(--atlas-text-secondary)] uppercase tracking-wider">Auditorias Realizadas</span>
            <Activity className="w-4 h-4 text-[var(--atlas-accent)]" />
          </div>
          <div className="atlas-stat-value">{logs.length}</div>
          <div className="text-[10px] text-[var(--atlas-accent)] font-medium mt-1">
            {totalInconsistencias} inconsistências mapeadas
          </div>
        </div>

        <div className="atlas-stat-item">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-semibold text-[var(--atlas-text-secondary)] uppercase tracking-wider">Robô Fiscal IA</span>
            <Bot className="w-4 h-4 text-[var(--atlas-info)]" />
          </div>
          <div className="text-xl font-bold text-[var(--atlas-text)] mt-1">Ativo 24/7</div>
          <div className="text-[10px] text-[var(--atlas-info)] font-medium mt-1">
            Monitoramento continuo de pastas
          </div>
        </div>
      </div>

      {/* Barra Contextual / Breadcrumb Bar de Cliente Ativo */}
      <div className="atlas-breadcrumb-bar rounded-xl">
        <div className="flex items-center space-x-2">
          <Building2 className="w-4 h-4 text-[var(--atlas-navy)] shrink-0" />
          <span className="font-semibold text-[var(--atlas-text-secondary)]">Cliente Ativo:</span>
          <span className="font-bold text-[var(--atlas-navy)]">{clienteAtivoNome}</span>
          <span className="text-[var(--atlas-text-muted)] font-mono">({clienteAtivoCnpj})</span>
        </div>
        <div className="flex items-center space-x-3">
          <span className="text-[var(--atlas-text-muted)]">Competência: <strong className="text-[var(--atlas-text)] capitalize">{nomeMesReferencia}</strong></span>
          {spedData && (
            <span className="atlas-pill atlas-pill-accent">
              SPED Carregado
            </span>
          )}
        </div>
      </div>

      {/* Calendário e Prazos Fiscais Oficiais (Dividido com Linha Divisória Vertical) */}
      <div className="atlas-card p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--atlas-border)] pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-[var(--atlas-navy-tint)] text-[var(--atlas-navy)] rounded-lg">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--atlas-navy)] capitalize">
                Prazos Fiscais & Vencimentos SPED — {nomeMes}
              </h2>
              <p className="text-[var(--atlas-text-secondary)] text-[11px] mt-0.5">
                Regra oficial aplicada: Se o dia 15 ou 20 cair em fim de semana ou dia não útil, o prazo é <strong>antecipado automaticamente</strong> para o dia útil anterior (Sexta-feira).
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 bg-[var(--atlas-surface-hover)] p-1 rounded-xl self-start sm:self-auto border border-[var(--atlas-border)]">
            <button
              onClick={prevMonth}
              className="p-1.5 hover:bg-[var(--atlas-surface)] rounded-lg text-[var(--atlas-text)] transition-colors cursor-pointer"
              title="Mês Anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-bold text-[var(--atlas-text)] px-2 capitalize text-xs">{nomeMes}</span>
            <button
              onClick={nextMonth}
              className="p-1.5 hover:bg-[var(--atlas-surface)] rounded-lg text-[var(--atlas-text)] transition-colors cursor-pointer"
              title="Próximo Mês"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Grid com Linha Divisória Vertical em Telas Maiores */}
        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[var(--atlas-border)] -mx-6 -mb-6">
          {/* Prazo SPED Normais (Dia 15) */}
          <div className="p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="atlas-pill atlas-pill-navy">
                    Regime Normal (Real / Presumido)
                  </span>
                  <span className={`atlas-pill ${statusNormal.color}`}>
                    {statusNormal.label}
                  </span>
                </div>
                <h3 className="font-bold text-[var(--atlas-text)] text-sm">EFD ICMS/IPI (SPED Fiscal)</h3>
                <p className="text-[var(--atlas-text-secondary)] text-[11px]">
                  Competência Referência: <span className="font-semibold text-[var(--atlas-text)] capitalize">{nomeMesReferencia}</span>
                </p>
              </div>

              <div className="text-right">
                <span className="text-3xl font-extrabold text-[var(--atlas-navy)] block">
                  Dia {prazoNormal.diaAjustado}
                </span>
                <span className="text-[10px] font-medium text-[var(--atlas-text-muted)] uppercase tracking-wider block">
                  {prazoNormal.diaSemanaAjustadoStr}
                </span>
              </div>
            </div>

            <div className="atlas-alert atlas-alert-info space-y-1 text-[11px]">
              <div className="flex items-center space-x-1.5 font-semibold text-[var(--atlas-text)]">
                <Info className="w-3.5 h-3.5 text-[var(--atlas-info)] shrink-0" />
                <span>Análise de Vencimento (Dia 15):</span>
              </div>
              <p className="leading-relaxed">
                {prazoNormal.foiAntecipado ? (
                  <span className="text-[var(--atlas-warning)] font-medium block">
                    {prazoNormal.motivoAntecipacao} (O dia 15 original era {prazoNormal.diaSemanaStr}).
                  </span>
                ) : (
                  <span className="text-[var(--atlas-accent)] font-medium block">
                    ✓ Dia 15 é dia útil ({prazoNormal.diaSemanaStr}). Sem antecipação necessária.
                  </span>
                )}
              </p>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[var(--atlas-text-secondary)] text-[11px]">
                Empresas afetadas: <strong className="text-[var(--atlas-text)]">{totalNormais}</strong>
              </span>
              <button
                onClick={() => setActiveTab('clientes')}
                className="atlas-btn atlas-btn-primary px-3 py-1.5 text-xs cursor-pointer"
              >
                <span>Ver Clientes Normais</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Prazo SPED Simples Nacional (Dia 20) */}
          <div className="p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="atlas-pill atlas-pill-accent">
                    Simples Nacional
                  </span>
                  <span className={`atlas-pill ${statusSimples.color}`}>
                    {statusSimples.label}
                  </span>
                </div>
                <h3 className="font-bold text-[var(--atlas-text)] text-sm">PGDAS-D & Obrigações Acessórias</h3>
                <p className="text-[var(--atlas-text-secondary)] text-[11px]">
                  Competência Referência: <span className="font-semibold text-[var(--atlas-text)] capitalize">{nomeMesReferencia}</span>
                </p>
              </div>

              <div className="text-right">
                <span className="text-3xl font-extrabold text-[var(--atlas-accent)] block">
                  Dia {prazoSimples.diaAjustado}
                </span>
                <span className="text-[10px] font-medium text-[var(--atlas-text-muted)] uppercase tracking-wider block">
                  {prazoSimples.diaSemanaAjustadoStr}
                </span>
              </div>
            </div>

            <div className="atlas-alert atlas-alert-info space-y-1 text-[11px]">
              <div className="flex items-center space-x-1.5 font-semibold text-[var(--atlas-text)]">
                <Info className="w-3.5 h-3.5 text-[var(--atlas-accent)] shrink-0" />
                <span>Análise de Vencimento (Dia 20):</span>
              </div>
              <p className="leading-relaxed">
                {prazoSimples.foiAntecipado ? (
                  <span className="text-[var(--atlas-warning)] font-medium block">
                    {prazoSimples.motivoAntecipacao} (O dia 20 original era {prazoSimples.diaSemanaStr}).
                  </span>
                ) : (
                  <span className="text-[var(--atlas-accent)] font-medium block">
                    ✓ Dia 20 é dia útil ({prazoSimples.diaSemanaStr}). Sem antecipação necessária.
                  </span>
                )}
              </p>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[var(--atlas-text-secondary)] text-[11px]">
                Empresas afetadas: <strong className="text-[var(--atlas-text)]">{totalSimples}</strong>
              </span>
              <button
                onClick={() => setActiveTab('clientes')}
                className="atlas-btn atlas-btn-accent px-3 py-1.5 text-xs cursor-pointer"
              >
                <span>Ver Clientes Simples</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Ferramentas de Acesso Rápido — Formatado com .atlas-list-row */}
      <div className="atlas-card p-0 overflow-hidden">
        <div className="p-5 border-b border-[var(--atlas-border)] flex items-center justify-between bg-[var(--atlas-surface)]">
          <h2 className="text-sm font-bold text-[var(--atlas-navy)] flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-[var(--atlas-navy)]" />
            <span>Ferramentas & Módulos Principais</span>
          </h2>
          <span className="text-[11px] text-[var(--atlas-text-muted)]">Acesso rápido aos fluxos de trabalho</span>
        </div>

        <div className="divide-y divide-[var(--atlas-border)]">
          <div 
            onClick={() => setActiveTab('upload')}
            className="atlas-list-row justify-between cursor-pointer group"
          >
            <div className="flex items-center space-x-4">
              <div className="w-9 h-9 rounded-lg bg-[var(--atlas-navy-tint)] text-[var(--atlas-navy)] flex items-center justify-center font-bold shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-[var(--atlas-text)] group-hover:text-[var(--atlas-navy)] transition-colors text-xs">Importar & Auditar SPED</h3>
                  <span className="atlas-pill atlas-pill-navy">Módulo 1</span>
                </div>
                <p className="text-[var(--atlas-text-secondary)] text-[11px] mt-0.5">Carregue arquivos EFD ICMS/IPI para validação completa de blocos, C170, C190 e omissas.</p>
              </div>
            </div>
            <div className="flex items-center space-x-1 text-xs font-semibold text-[var(--atlas-navy)] shrink-0 ml-4">
              <span>Acessar</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          <div 
            onClick={() => setActiveTab('clientes')}
            className="atlas-list-row justify-between cursor-pointer group"
          >
            <div className="flex items-center space-x-4">
              <div className="w-9 h-9 rounded-lg bg-[var(--atlas-accent-tint)] text-[var(--atlas-accent)] flex items-center justify-center font-bold shrink-0">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-[var(--atlas-text)] group-hover:text-[var(--atlas-accent)] transition-colors text-xs">Clientes & Pastas Nuvem</h3>
                  <span className="atlas-pill atlas-pill-accent">Nouvem</span>
                </div>
                <p className="text-[var(--atlas-text-secondary)] text-[11px] mt-0.5">Gerencie o cadastro de clientes, regimes tributários e pastas monitoradas pelo robô.</p>
              </div>
            </div>
            <div className="flex items-center space-x-1 text-xs font-semibold text-[var(--atlas-accent)] shrink-0 ml-4">
              <span>Acessar</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          <div 
            onClick={() => setActiveTab('robo_fiscal')}
            className="atlas-list-row justify-between cursor-pointer group"
          >
            <div className="flex items-center space-x-4">
              <div className="w-9 h-9 rounded-lg bg-[var(--atlas-info-bg)] text-[var(--atlas-info)] flex items-center justify-center font-bold shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-[var(--atlas-text)] group-hover:text-[var(--atlas-info)] transition-colors text-xs">Robô Fiscal IA & Automação</h3>
                  <span className="atlas-pill atlas-pill-info">Automação</span>
                </div>
                <p className="text-[var(--atlas-text-secondary)] text-[11px] mt-0.5">Automação inteligente de varredura de arquivos fiscais e detecção de divergências.</p>
              </div>
            </div>
            <div className="flex items-center space-x-1 text-xs font-semibold text-[var(--atlas-info)] shrink-0 ml-4">
              <span>Acessar</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
