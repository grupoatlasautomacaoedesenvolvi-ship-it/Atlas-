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
    if (!isMesAtual) return { status: 'FUTURO', label: 'Agendado', color: 'bg-slate-100 text-slate-700 border-slate-200' };
    if (diaHoje > diaVencimento) return { status: 'VENCIDO', label: 'Prazo Vencido', color: 'bg-rose-100 text-rose-800 border-rose-300' };
    if (diaVencimento - diaHoje <= 3) return { status: 'URGENTE', label: 'Vence em Breve', color: 'bg-amber-100 text-amber-800 border-amber-300' };
    return { status: 'EM_DIA', label: 'No Prazo', color: 'bg-emerald-100 text-[#0f6e56] border-emerald-300' };
  }

  const statusNormal = getStatusPrazo(prazoNormal.diaAjustado);
  const statusSimples = getStatusPrazo(prazoSimples.diaAjustado);

  const totalNormais = clientes.filter(c => !(c.regimeTributario || '').toUpperCase().includes('SIMPLES')).length;
  const totalSimples = clientes.filter(c => (c.regimeTributario || '').toUpperCase().includes('SIMPLES')).length;

  const totalInconsistencias = logs.reduce((acc, l) => acc + (l.inconsistenciasCount || 0), 0);

  return (
    <div className="space-y-6 pb-16 text-xs font-sans p-6">
      {/* Banner Superior do Painel Inicial */}
      <div className="bg-[#1e3a5f] rounded-lg p-6 text-white shadow-sm relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-white/5 rounded-full pointer-events-none blur-2xl"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Atlas Auditor Fiscal — Painel Geral & Prazos</span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">
              Central de Operações Fiscais
            </h1>
            <p className="text-slate-300 text-xs max-w-xl">
              Bem-vindo ao sistema de auditoria SPED e gestão de prazos fiscais com antecipação automática para dias úteis.
            </p>
          </div>

          <div className="flex items-center space-x-3 bg-white/10 backdrop-blur-xs border border-white/20 px-4 py-3 rounded-xl">
            <div className="p-2 bg-white/10 rounded-lg text-emerald-300">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] text-slate-300 uppercase tracking-wider font-medium">Competência Referência</p>
              <p className="text-sm font-bold text-white capitalize">{nomeMesReferencia}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Estatísticas Rápidas do Escritório */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-[var(--atlas-border)] shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-medium">Clientes Cadastrados</span>
            <Building2 className="w-4 h-4 text-[#0f6e56]" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">{clientes.length}</div>
          <div className="text-[10px] text-slate-500 flex items-center space-x-1">
            <span>{totalNormais} Regime Normal</span>
            <span>•</span>
            <span>{totalSimples} Simples Nacional</span>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-[var(--atlas-border)] shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-medium">Status do SPED Atual</span>
            <FileText className="w-4 h-4 text-[#1e3a5f]" />
          </div>
          <div className="text-lg font-bold text-slate-900 truncate">
            {spedData ? 'Importado & Ativo' : 'Aguardando Arquivo'}
          </div>
          <div className="text-[10px] text-slate-500">
            {spedData?.header?.nome || 'Nenhum SPED carregado na sessão'}
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-[var(--atlas-border)] shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-medium">Auditorias Realizadas</span>
            <Activity className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">{logs.length}</div>
          <div className="text-[10px] text-emerald-700 font-medium">
            {totalInconsistencias} inconsistências mapeadas no total
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-[var(--atlas-border)] shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-medium">Robô Fiscal IA</span>
            <Bot className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-lg font-bold text-slate-900">Ativo 24/7</div>
          <div className="text-[10px] text-sky-700 font-medium">Monitoramento de pastas ativado</div>
        </div>
      </div>

      {/* Atalhos de Acesso Rápido Módulos */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-[#1e3a5f]" />
          <span className="font-bold text-slate-800 text-xs">Módulos de Gestão Rápida:</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab('admin_panel')}
            className="px-3 py-1.5 bg-[#f1efe8] hover:bg-[#e5e2d9] text-[#1e3a5f] border border-[#e5e2d9] rounded-lg font-bold text-xs transition-colors flex items-center space-x-1.5 shadow-2xs"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[#1e3a5f]" />
            <span>Cadastro & Gestão de Escritórios (ADM)</span>
          </button>
          <button
            onClick={() => setActiveTab('clientes')}
            className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg font-bold text-xs transition-colors flex items-center space-x-1.5"
          >
            <Building2 className="w-3.5 h-3.5 text-slate-600" />
            <span>Gerenciar Clientes</span>
          </button>
          <button
            onClick={() => setActiveTab('robo_fiscal')}
            className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg font-bold text-xs transition-colors flex items-center space-x-1.5"
          >
            <Bot className="w-3.5 h-3.5 text-emerald-600" />
            <span>Robô Fiscal AI</span>
          </button>
          <button
            onClick={() => setActiveTab('ai_orchestrator')}
            className="px-3 py-1.5 bg-[#f1efe8] hover:bg-[#e5e2d9] text-[#1e3a5f] border border-[#e5e2d9] rounded-lg font-bold text-xs transition-colors flex items-center space-x-1.5 shadow-2xs"
          >
            <BrainCircuit className="w-3.5 h-3.5 text-[#1e3a5f]" />
            <span>Orquestrador Multi-IA</span>
          </button>
        </div>
      </div>

      {/* Calendário e Prazos Fiscais Oficiais (Dia 15 e Dia 20 com Regra de Antecipação) */}
      <div className="bg-white rounded-xl border border-[var(--atlas-border)] p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-amber-50 text-amber-700 rounded-lg">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 capitalize">
                Prazos Fiscais & Vencimentos SPED — {nomeMes}
              </h2>
              <p className="text-slate-500 text-[11px]">
                Regra oficial aplicada: Se o dia 15 ou 20 cair em fim de semana ou dia não útil, o prazo é <strong>antecipado automaticamente</strong> para o dia útil anterior (Sexta-feira).
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 bg-slate-100 p-1 rounded-xl self-start sm:self-auto">
            <button
              onClick={prevMonth}
              className="p-1.5 hover:bg-white rounded-lg text-slate-700 transition-colors"
              title="Mês Anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-bold text-slate-800 px-2 capitalize text-xs">{nomeMes}</span>
            <button
              onClick={nextMonth}
              className="p-1.5 hover:bg-white rounded-lg text-slate-700 transition-colors"
              title="Próximo Mês"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Card Prazo SPED Normais (Dia 15) */}
          <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 space-y-4 relative overflow-hidden shadow-2xs">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded-full bg-sky-100 text-[#1e3a5f] font-bold text-[10px] border border-sky-200">
                    Regime Normal (Lucro Real / Presumido)
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${statusNormal.color}`}>
                    {statusNormal.label}
                  </span>
                </div>
                <h3 className="font-bold text-slate-900 text-sm">EFD ICMS/IPI (SPED Fiscal)</h3>
                <p className="text-slate-500 text-[11px]">
                  Competência Referência: <span className="font-semibold text-slate-700 capitalize">{nomeMesReferencia}</span>
                </p>
              </div>

              <div className="text-right">
                <span className="text-3xl font-extrabold text-[#1e3a5f] block">
                  Dia {prazoNormal.diaAjustado}
                </span>
                <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider block">
                  {prazoNormal.diaSemanaAjustadoStr}
                </span>
              </div>
            </div>

            <div className="bg-white rounded-lg p-3 border border-slate-200 space-y-1.5 text-[11px] text-slate-700">
              <div className="flex items-center space-x-1.5 font-semibold text-slate-800">
                <Info className="w-3.5 h-3.5 text-[#1e3a5f] shrink-0" />
                <span>Análise de Vencimento (Dia 15):</span>
              </div>
              <p className="leading-relaxed">
                {prazoNormal.foiAntecipado ? (
                  <span className="text-amber-800 font-medium block">
                    ⚠️ {prazoNormal.motivoAntecipacao} (O dia 15 original era {prazoNormal.diaSemanaStr}).
                  </span>
                ) : (
                  <span className="text-emerald-800 font-medium block">
                    ✓ Dia 15 é dia útil ({prazoNormal.diaSemanaStr}). Sem antecipação necessária.
                  </span>
                )}
              </p>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-slate-500 text-[11px]">
                Empresas afetadas: <strong className="text-slate-800">{totalNormais}</strong>
              </span>
              <button
                onClick={() => setActiveTab('clientes')}
                className="px-3 py-1.5 bg-[#1e3a5f] hover:bg-[#142c47] text-white rounded-lg font-semibold text-xs transition-colors flex items-center space-x-1"
              >
                <span>Ver Clientes Normais</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Card Prazo SPED Simples Nacional (Dia 20) */}
          <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 space-y-4 relative overflow-hidden shadow-2xs">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-[#0f6e56] font-bold text-[10px] border border-emerald-200">
                    Simples Nacional
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${statusSimples.color}`}>
                    {statusSimples.label}
                  </span>
                </div>
                <h3 className="font-bold text-slate-900 text-sm">PGDAS-D & Obrigações Acessórias</h3>
                <p className="text-slate-500 text-[11px]">
                  Competência Referência: <span className="font-semibold text-slate-700 capitalize">{nomeMesReferencia}</span>
                </p>
              </div>

              <div className="text-right">
                <span className="text-3xl font-extrabold text-[#0f6e56] block">
                  Dia {prazoSimples.diaAjustado}
                </span>
                <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider block">
                  {prazoSimples.diaSemanaAjustadoStr}
                </span>
              </div>
            </div>

            <div className="bg-white rounded-lg p-3 border border-slate-200 space-y-1.5 text-[11px] text-slate-700">
              <div className="flex items-center space-x-1.5 font-semibold text-slate-800">
                <Info className="w-3.5 h-3.5 text-[#0f6e56] shrink-0" />
                <span>Análise de Vencimento (Dia 20):</span>
              </div>
              <p className="leading-relaxed">
                {prazoSimples.foiAntecipado ? (
                  <span className="text-amber-800 font-medium block">
                    ⚠️ {prazoSimples.motivoAntecipacao} (O dia 20 original era {prazoSimples.diaSemanaStr}).
                  </span>
                ) : (
                  <span className="text-emerald-800 font-medium block">
                    ✓ Dia 20 é dia útil ({prazoSimples.diaSemanaStr}). Sem antecipação necessária.
                  </span>
                )}
              </p>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-slate-500 text-[11px]">
                Empresas afetadas: <strong className="text-slate-800">{totalSimples}</strong>
              </span>
              <button
                onClick={() => setActiveTab('clientes')}
                className="px-3 py-1.5 bg-[#0f6e56] hover:bg-[#0b5440] text-white rounded-lg font-semibold text-xs transition-colors flex items-center space-x-1"
              >
                <span>Ver Clientes Simples</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Acesso Rápido aos Módulos Principais */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-slate-800 tracking-tight flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-[#1e3a5f]" />
          <span>Acesso Rápido às Ferramentas de Auditoria</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div 
            onClick={() => setActiveTab('upload')}
            className="bg-white p-5 rounded-xl border border-[var(--atlas-border)] hover:border-[#1e3a5f] hover:shadow-md transition-all cursor-pointer group space-y-3"
          >
            <div className="w-10 h-10 rounded-lg bg-sky-50 text-[#1e3a5f] flex items-center justify-center font-bold group-hover:bg-[#1e3a5f] group-hover:text-white transition-colors">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 group-hover:text-[#1e3a5f] transition-colors text-xs">Importar & Auditar SPED</h3>
              <p className="text-slate-500 text-[11px] mt-1">Carregue arquivos EFD ICMS/IPI para validação completa de blocos, C170, C190 e omissas.</p>
            </div>
            <div className="flex items-center space-x-1 text-xs font-semibold text-[#1e3a5f]">
              <span>Iniciar Importação</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          <div 
            onClick={() => setActiveTab('clientes')}
            className="bg-white p-5 rounded-xl border border-[var(--atlas-border)] hover:border-[#0f6e56] hover:shadow-md transition-all cursor-pointer group space-y-3"
          >
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-[#0f6e56] flex items-center justify-center font-bold group-hover:bg-[#0f6e56] group-hover:text-white transition-colors">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 group-hover:text-[#0f6e56] transition-colors text-xs">Clientes & Pastas Nuvem</h3>
              <p className="text-slate-500 text-[11px] mt-1">Gerencie o cadastro de clientes, regimes tributários e pastas monitoradas pelo robô.</p>
            </div>
            <div className="flex items-center space-x-1 text-xs font-semibold text-[#0f6e56]">
              <span>Gerenciar Clientes</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          <div 
            onClick={() => setActiveTab('robo_fiscal')}
            className="bg-white p-5 rounded-xl border border-[var(--atlas-border)] hover:border-sky-600 hover:shadow-md transition-all cursor-pointer group space-y-3"
          >
            <div className="w-10 h-10 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center font-bold group-hover:bg-sky-600 group-hover:text-white transition-colors">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 group-hover:text-sky-600 transition-colors text-xs">Robô Fiscal IA</h3>
              <p className="text-slate-500 text-[11px] mt-1">Automação inteligente de varredura de arquivos fiscais e detecção de divergências.</p>
            </div>
            <div className="flex items-center space-x-1 text-xs font-semibold text-sky-600">
              <span>Acessar Robô IA</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
