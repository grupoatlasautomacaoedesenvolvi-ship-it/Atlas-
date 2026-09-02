import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from 'recharts';
import {
  Bot,
  CheckCircle2,
  AlertTriangle,
  Zap,
  TrendingUp,
  Target,
  Clock,
  ShieldCheck,
  Brain,
  Sliders
} from 'lucide-react';
import { AgentPerformanceMetrics } from '../types';

interface AgentPerformanceDashboardProps {
  metrics: AgentPerformanceMetrics;
}

const COLORS = ['#6366f1', '#f59e0b', '#ef4444', '#10b981', '#8b5cf6'];

export function AgentPerformanceDashboard({ metrics }: AgentPerformanceDashboardProps) {
  // Volume Chart Data (Historical Batch Volume, Errors & Corrections)
  const volumeData = [
    { lote: 'Lote 1 (001-050)', conferidos: 50, erros: 14, correcoes: 12 },
    { lote: 'Lote 2 (051-100)', conferidos: 50, erros: 11, correcoes: 10 },
    { lote: 'Lote 3 (101-150)', conferidos: 42, erros: 8, correcoes: 8 },
    { lote: 'Atual (C170)', conferidos: metrics.totalItemsAudited, erros: metrics.totalErrorsFound, correcoes: metrics.totalAutoCorrections },
  ];

  // Error Types Donut Data
  const errorDistributionData = [
    { name: 'CST Incorreto', value: metrics.errorDistribution.cstIcms || 18 },
    { name: 'ST / Monofásico Ignorado', value: metrics.errorDistribution.stMonofasicoMissed || 15 },
    { name: 'CFOP Incompatível', value: metrics.errorDistribution.cfopIncompatible || 12 },
    { name: 'PIS/COFINS Divergente', value: metrics.errorDistribution.pisCofinsDivergent || 8 },
    { name: 'NCM Inexistente/Inválida', value: metrics.errorDistribution.ncmInvalid || 5 },
  ];

  // Agent Comparison Data
  const agentComparisonData = [
    {
      agente: 'Agente 1 (NCM/CST)',
      analisados: metrics.agentStats.agent1.analyzed,
      alertas: metrics.agentStats.agent1.alerts,
      correcoes: metrics.agentStats.agent1.corrections,
    },
    {
      agente: 'Agente 2 (CFOP/Op)',
      analisados: metrics.agentStats.agent2.analyzed,
      alertas: metrics.agentStats.agent2.alerts,
      correcoes: metrics.agentStats.agent2.corrections,
    },
    {
      agente: 'Agente 3 (Consenso)',
      analisados: metrics.agentStats.agent3.analyzed,
      alertas: metrics.agentStats.agent3.alerts,
      correcoes: metrics.agentStats.agent3.corrections,
    },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Conferidos */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 hover:border-indigo-200 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Itens C170 Conferidos
            </span>
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
              <Bot className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-black text-slate-900">{metrics.totalItemsAudited}</span>
            <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center">
              <TrendingUp className="w-3 h-3 mr-1" /> 100% Amostragem
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">Varredura integral do Bloco C170</p>
        </div>

        {/* Inconformidades / Erros Encontrados */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 hover:border-amber-200 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Erros Encontrados
            </span>
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-black text-slate-900">{metrics.totalErrorsFound}</span>
            <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
              {metrics.totalItemsAudited > 0 ? Math.round((metrics.totalErrorsFound / metrics.totalItemsAudited) * 100) : 0}% divergências
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">Identificados pelos 3 Agentes AI</p>
        </div>

        {/* Correções Automáticas Realizadas */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 hover:border-emerald-200 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Correções Automáticas
            </span>
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
              <Zap className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-black text-emerald-600">{metrics.totalAutoCorrections}</span>
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
              {metrics.totalErrorsFound > 0 ? Math.round((metrics.totalAutoCorrections / metrics.totalErrorsFound) * 100) : 100}% taxa de saneamento
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">Saneadas autonomamente no SPED</p>
        </div>

        {/* Acurácia dos Agentes */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 hover:border-purple-200 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Acurácia da Auditoria
            </span>
            <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-black text-purple-600">{metrics.accuracyRate}%</span>
            <span className="text-xs font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full">
              {metrics.avgProcessingTimeMs}ms / item
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">Baseado no feedback dos contadores</p>
        </div>
      </div>

      {/* Main Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart: Volume, Erros e Correções Automáticas */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Evolução do Volume & Saneamento do C170</h3>
              <p className="text-xs text-slate-500">Comparativo de itens conferidos, erros identificados e auto-correções efetuadas</p>
            </div>
            <span className="text-xs font-semibold bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full">
              Visão por Lotes
            </span>
          </div>

          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={volumeData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="lote" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Bar dataKey="conferidos" name="Itens Conferidos" fill="#6366f1" radius={[6, 6, 0, 0]} />
                <Bar dataKey="erros" name="Erros Encontrados" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                <Bar dataKey="correcoes" name="Correções Automáticas" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart: Distribuição dos Tipos de Erro */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Distribuição dos Erros no C170</h3>
            <p className="text-xs text-slate-500">Inconformidades fiscais mais recorrentes</p>
          </div>

          <div className="h-56 w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={errorDistributionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {errorDistributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '10px', color: '#fff', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-black text-slate-800">{metrics.totalErrorsFound}</span>
              <span className="text-[10px] text-slate-400 font-bold uppercase">Erros Totais</span>
            </div>
          </div>

          {/* Legend */}
          <div className="space-y-1.5 text-xs">
            {errorDistributionData.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-slate-600">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                  <span className="truncate max-w-[170px]">{item.name}</span>
                </div>
                <span className="font-bold text-slate-800">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Agent Performance Comparison Chart */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Desempenho Individual dos Agentes AI</h3>
            <p className="text-xs text-slate-500">Análise de assertividade e correções efetuadas por cada especialidade</p>
          </div>
          <div className="flex items-center space-x-4 text-xs font-semibold text-slate-600">
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-3 bg-indigo-600 rounded"></span>
              <span>Analisados</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-3 bg-amber-500 rounded"></span>
              <span>Alertas Emitidos</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-3 bg-emerald-500 rounded"></span>
              <span>Correções Propostas</span>
            </div>
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={agentComparisonData} layout="vertical" margin={{ top: 10, right: 20, left: 20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
              <XAxis type="number" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis dataKey="agente" type="category" tick={{ fontSize: 12, fill: '#334155', fontWeight: 600 }} axisLine={false} tickLine={false} width={150} />
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', color: '#fff', fontSize: '12px' }} />
              <Bar dataKey="analisados" name="Analisados" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={12} />
              <Bar dataKey="alertas" name="Alertas Emitidos" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={12} />
              <Bar dataKey="correcoes" name="Correções Propostas" fill="#10b981" radius={[0, 4, 4, 0]} barSize={12} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
