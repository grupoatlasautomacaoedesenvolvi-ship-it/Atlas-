import React, { useState, useMemo } from 'react';
import { FiscalTooltip } from './FiscalTooltip';
import {
  Calculator,
  HelpCircle,
  Copy,
  Check,
  Printer,
  RotateCcw,
  BookOpen,
  ArrowRightLeft,
  Info,
  DollarSign,
  Percent,
  Plus,
  Trash2,
  FileSpreadsheet,
  Building2,
  ShieldAlert,
  Lightbulb,
  Scale,
  GraduationCap,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  FileCode
} from 'lucide-react';

interface UFConfig {
  uf: string;
  nome: string;
  aliqInterna: number;
  aliqFcp: number;
  regiao: 'SUL_SUDESTE' | 'OUTRAS';
}

export const UFS_BRASIL: UFConfig[] = [
  { uf: 'AC', nome: 'Acre', aliqInterna: 19, aliqFcp: 2, regiao: 'OUTRAS' },
  { uf: 'AL', nome: 'Alagoas', aliqInterna: 19, aliqFcp: 2, regiao: 'OUTRAS' },
  { uf: 'AM', nome: 'Amazonas', aliqInterna: 20, aliqFcp: 2, regiao: 'OUTRAS' },
  { uf: 'AP', nome: 'Amapá', aliqInterna: 18, aliqFcp: 0, regiao: 'OUTRAS' },
  { uf: 'BA', nome: 'Bahia', aliqInterna: 20.5, aliqFcp: 2, regiao: 'OUTRAS' },
  { uf: 'CE', nome: 'Ceará', aliqInterna: 20, aliqFcp: 2, regiao: 'OUTRAS' },
  { uf: 'DF', nome: 'Distrito Federal', aliqInterna: 20, aliqFcp: 2, regiao: 'OUTRAS' },
  { uf: 'ES', nome: 'Espírito Santo', aliqInterna: 17, aliqFcp: 0, regiao: 'OUTRAS' },
  { uf: 'GO', nome: 'Goiás', aliqInterna: 19, aliqFcp: 2, regiao: 'OUTRAS' },
  { uf: 'MA', nome: 'Maranhão', aliqInterna: 22, aliqFcp: 2, regiao: 'OUTRAS' },
  { uf: 'MG', nome: 'Minas Gerais', aliqInterna: 18, aliqFcp: 2, regiao: 'SUL_SUDESTE' },
  { uf: 'MS', nome: 'Mato Grosso do Sul', aliqInterna: 17, aliqFcp: 2, regiao: 'OUTRAS' },
  { uf: 'MT', nome: 'Mato Grosso', aliqInterna: 17, aliqFcp: 2, regiao: 'OUTRAS' },
  { uf: 'PA', nome: 'Pará', aliqInterna: 19, aliqFcp: 0, regiao: 'OUTRAS' },
  { uf: 'PB', nome: 'Paraíba', aliqInterna: 20, aliqFcp: 2, regiao: 'OUTRAS' },
  { uf: 'PE', nome: 'Pernambuco', aliqInterna: 20.5, aliqFcp: 2, regiao: 'OUTRAS' },
  { uf: 'PI', nome: 'Piauí', aliqInterna: 21, aliqFcp: 2, regiao: 'OUTRAS' },
  { uf: 'PR', nome: 'Paraná', aliqInterna: 19.5, aliqFcp: 2, regiao: 'SUL_SUDESTE' },
  { uf: 'RJ', nome: 'Rio de Janeiro', aliqInterna: 20, aliqFcp: 2, regiao: 'SUL_SUDESTE' },
  { uf: 'RN', nome: 'Rio Grande do Norte', aliqInterna: 20, aliqFcp: 2, regiao: 'OUTRAS' },
  { uf: 'RO', nome: 'Rondônia', aliqInterna: 19.5, aliqFcp: 2, regiao: 'OUTRAS' },
  { uf: 'RR', nome: 'Roraima', aliqInterna: 20, aliqFcp: 2, regiao: 'OUTRAS' },
  { uf: 'RS', nome: 'Rio Grande do Sul', aliqInterna: 17, aliqFcp: 2, regiao: 'SUL_SUDESTE' },
  { uf: 'SC', nome: 'Santa Catarina', aliqInterna: 17, aliqFcp: 0, regiao: 'SUL_SUDESTE' },
  { uf: 'SE', nome: 'Sergipe', aliqInterna: 19, aliqFcp: 2, regiao: 'OUTRAS' },
  { uf: 'SP', nome: 'São Paulo', aliqInterna: 18, aliqFcp: 0, regiao: 'SUL_SUDESTE' },
  { uf: 'TO', nome: 'Tocantins', aliqInterna: 20, aliqFcp: 2, regiao: 'OUTRAS' }
];

export interface DifalSimulation {
  id: string;
  data: string;
  descricao: string;
  ufOrigem: string;
  ufDestino: string;
  valorOperacao: number;
  valorDifal: number;
  valorFcp: number;
  totalRecolher: number;
  modalidade: 'BASE_DUPLA' | 'BASE_UNICA';
}

export function DifalCalculatorView() {
  const [ufOrigem, setUfOrigem] = useState<string>('SP');
  const [ufDestino, setUfDestino] = useState<string>('RJ');
  
  // Tipo de Destinatário & Modalidade
  const [tipoDestinatario, setTipoDestinatario] = useState<'NAO_CONTRIBUINTE' | 'CONTRIBUINTE'>('NAO_CONTRIBUINTE');
  const [modalidade, setModalidade] = useState<'BASE_DUPLA' | 'BASE_UNICA'>('BASE_DUPLA');
  const [isImportado, setIsImportado] = useState<boolean>(false);
  const [incluirIpiNaBase, setIncluirIpiNaBase] = useState<boolean>(true);

  // Valores da Operação
  const [valorProdutos, setValorProdutos] = useState<number>(1000);
  const [valorFrete, setValorFrete] = useState<number>(0);
  const [valorSeguro, setValorSeguro] = useState<number>(0);
  const [outrasDespesas, setOutrasDespesas] = useState<number>(0);
  const [desconto, setDesconto] = useState<number>(0);
  const [valorIpi, setValorIpi] = useState<number>(0);

  // Alíquotas Personalizadas
  const [aliqInterManual, setAliqInterManual] = useState<number | null>(null);
  const [aliqInternaDestinoManual, setAliqInternaDestinoManual] = useState<number | null>(null);
  const [aliqFcpManual, setAliqFcpManual] = useState<number | null>(null);

  // UI States
  const [activeSubTab, setActiveSubTab] = useState<'CALCULADORA' | 'GUIA_DIDATICO' | 'HISTORICO' | 'TABELA_UFS'>('CALCULADORA');
  const [copied, setCopied] = useState<boolean>(false);
  const [simulacaoDesc, setSimulacaoDesc] = useState<string>('');
  const [openFaq, setOpenFaq] = useState<string | null>('faq-1');
  const [historico, setHistorico] = useState<DifalSimulation[]>(() => {
    try {
      const saved = localStorage.getItem('atlas_difal_historico');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Determinar Alíquota Interestadual Padrão (4%, 7% ou 12%)
  const aliqInterSugerida = useMemo(() => {
    if (isImportado) return 4;
    
    const orig = UFS_BRASIL.find(u => u.uf === ufOrigem);
    const dest = UFS_BRASIL.find(u => u.uf === ufDestino);

    if (ufOrigem === ufDestino) return 0; // Operação Interna

    if (orig?.regiao === 'SUL_SUDESTE' && (dest?.regiao === 'OUTRAS' || dest?.uf === 'ES')) {
      return 7;
    }
    return 12;
  }, [ufOrigem, ufDestino, isImportado]);

  const aliqInterestadual = aliqInterManual !== null ? aliqInterManual : aliqInterSugerida;

  // Obter Alíquotas Internas Padrão do Estado de Destino
  const destUfConfig = useMemo(() => {
    return UFS_BRASIL.find(u => u.uf === ufDestino) || { aliqInterna: 18, aliqFcp: 0 };
  }, [ufDestino]);

  const aliqInternaDestino = aliqInternaDestinoManual !== null ? aliqInternaDestinoManual : destUfConfig.aliqInterna;
  const aliqFcpDestino = aliqFcpManual !== null ? aliqFcpManual : destUfConfig.aliqFcp;

  // resetar manuais quando muda de estado
  const handleUfDestinoChange = (uf: string) => {
    setUfDestino(uf);
    setAliqInternaDestinoManual(null);
    setAliqFcpManual(null);
  };

  const handleUfOrigemChange = (uf: string) => {
    setUfOrigem(uf);
    setAliqInterManual(null);
  };

  // Cálculo detalhado
  const calculo = useMemo(() => {
    // Base da Operação Bruta
    const baseOperacaoBruta = Math.max(0, valorProdutos + valorFrete + valorSeguro + outrasDespesas - desconto + (incluirIpiNaBase ? valorIpi : 0));
    
    // ICMS Interestadual (Origem)
    const icmsOrigemValor = baseOperacaoBruta * (aliqInterestadual / 100);

    let baseDestino = 0;
    let icmsDestinoValor = 0;
    let fcpValor = 0;
    let difalValor = 0;
    let fatorDivisor = 1;
    let baseSemIcmsOrigem = 0;

    if (modalidade === 'BASE_DUPLA') {
      // Regra de Cálculo "Por Dentro" (Base Dupla - LC 190/2021)
      // 1. Retira o ICMS de Origem
      baseSemIcmsOrigem = baseOperacaoBruta - icmsOrigemValor;

      // 2. Calcula o Fator de Divisão (1 - (AliqInterna + AliqFCP))
      const aliqTotalDestinoDecimal = (aliqInternaDestino + aliqFcpDestino) / 100;
      fatorDivisor = 1 - aliqTotalDestinoDecimal;

      // 3. Recompõe a Base no Destino
      baseDestino = fatorDivisor > 0 ? baseSemIcmsOrigem / fatorDivisor : 0;

      // 4. ICMS Total do Destino
      icmsDestinoValor = baseDestino * (aliqInternaDestino / 100);

      // 5. FCP Destino
      fcpValor = baseDestino * (aliqFcpDestino / 100);

      // 6. DIFAL = ICMS Destino - ICMS Origem
      difalValor = icmsDestinoValor - icmsOrigemValor;
    } else {
      // Regra de Cálculo "Por Fora" (Base Única)
      baseDestino = baseOperacaoBruta;
      icmsDestinoValor = baseDestino * (aliqInternaDestino / 100);
      fcpValor = baseDestino * (aliqFcpDestino / 100);
      difalValor = baseDestino * ((aliqInternaDestino - aliqInterestadual) / 100);
    }

    const totalRecolher = Math.max(0, difalValor) + Math.max(0, fcpValor);

    return {
      baseOperacaoBruta,
      icmsOrigemValor,
      baseSemIcmsOrigem,
      fatorDivisor,
      baseDestino,
      icmsDestinoValor,
      fcpValor,
      difalValor,
      totalRecolher
    };
  }, [
    valorProdutos,
    valorFrete,
    valorSeguro,
    outrasDespesas,
    desconto,
    valorIpi,
    incluirIpiNaBase,
    aliqInterestadual,
    aliqInternaDestino,
    aliqFcpDestino,
    modalidade
  ]);

  const handleSalvarSimulacao = () => {
    const novaSimulacao: DifalSimulation = {
      id: Date.now().toString(),
      data: new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      descricao: simulacaoDesc.trim() || `Simulação ${ufOrigem} -> ${ufDestino} (R$ ${calculo.baseOperacaoBruta.toLocaleString('pt-BR')})`,
      ufOrigem,
      ufDestino,
      valorOperacao: calculo.baseOperacaoBruta,
      valorDifal: calculo.difalValor,
      valorFcp: calculo.fcpValor,
      totalRecolher: calculo.totalRecolher,
      modalidade
    };

    const novoHistorico = [novaSimulacao, ...historico];
    setHistorico(novoHistorico);
    localStorage.setItem('atlas_difal_historico', JSON.stringify(novoHistorico));
    setSimulacaoDesc('');
  };

  const handleRemoverSimulacao = (id: string) => {
    const novoHistorico = historico.filter(h => h.id !== id);
    setHistorico(novoHistorico);
    localStorage.setItem('atlas_difal_historico', JSON.stringify(novoHistorico));
  };

  const formatCurrency = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const generateTextReport = () => {
    return `=====================================================
MEMÓRIA DE CÁLCULO DE DIFAL & FCP (ATLAS AUDITOR FISCAL)
=====================================================
Origem: ${ufOrigem} | Destino: ${ufDestino}
Destinatário: ${tipoDestinatario === 'NAO_CONTRIBUINTE' ? 'Consumidor Final Não Contribuinte' : 'Contribuinte do ICMS'}
Modalidade: ${modalidade === 'BASE_DUPLA' ? 'Base Dupla ("Por Dentro" - LC 190/2021)' : 'Base Única ("Por Fora")'}

--- COMPOSIÇÃO DA OPERAÇÃO ---
Produtos: ${formatCurrency(valorProdutos)}
Frete: ${formatCurrency(valorFrete)} | Seguro: ${formatCurrency(valorSeguro)}
Outras Despesas: ${formatCurrency(outrasDespesas)} | Desconto: -${formatCurrency(desconto)}
IPI: ${formatCurrency(valorIpi)} (Integrado na base: ${incluirIpiNaBase ? 'Sim' : 'Não'})
=> Valor Total da Operação: ${formatCurrency(calculo.baseOperacaoBruta)}

--- ALÍQUOTAS APLICADAS ---
Alíquota Interestadual (Origem): ${aliqInterestadual}% ${isImportado ? '(Produto Importado - Res. 13/2012)' : ''}
Alíquota Interna (${ufDestino}): ${aliqInternaDestino}%
Alíquota FCP (${ufDestino}): ${aliqFcpDestino}%

--- PASSO A PASSO DA APURAÇÃO ---
1. ICMS Origem (${aliqInterestadual}%): ${formatCurrency(calculo.icmsOrigemValor)}
${modalidade === 'BASE_DUPLA' ? `2. Valor sem ICMS Origem: ${formatCurrency(calculo.baseSemIcmsOrigem)}
3. Divisor Recompositor (1 - ${(aliqInternaDestino + aliqFcpDestino)/100}): ${calculo.fatorDivisor.toFixed(4)}
4. Base Recomposta de Destino: ${formatCurrency(calculo.baseDestino)}` : `2. Base de Cálculo Destino: ${formatCurrency(calculo.baseDestino)}`}
5. ICMS Total Destino (${aliqInternaDestino}%): ${formatCurrency(calculo.icmsDestinoValor)}
6. Valor do DIFAL (Destino - Origem): ${formatCurrency(calculo.difalValor)}
7. Valor do FCP (${aliqFcpDestino}%): ${formatCurrency(calculo.fcpValor)}

=====================================================
RESUMO DOS RECOLHAMENTOS:
-> VALOR DO DIFAL: ${formatCurrency(calculo.difalValor)}
-> VALOR DO FCP:   ${formatCurrency(calculo.fcpValor)}
-> TOTAL A RECOLHER: ${formatCurrency(calculo.totalRecolher)}
=====================================================`;
  };

  const handleCopyReport = () => {
    navigator.clipboard.writeText(generateTextReport());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleResetForm = () => {
    setValorProdutos(1000);
    setValorFrete(0);
    setValorSeguro(0);
    setOutrasDespesas(0);
    setDesconto(0);
    setValorIpi(0);
    setIsImportado(false);
    setAliqInterManual(null);
    setAliqInternaDestinoManual(null);
    setAliqFcpManual(null);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-blue-600 text-white rounded-lg shadow-sm">
              <Calculator className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Calculadora Independente de DIFAL & FCP</h1>
              <p className="text-sm text-slate-500">
                Simulador fiscal completo e isolado de ICMS Diferencial de Alíquota (LC 190/2021, EC 87/2015 e Convenio 142/2018).
              </p>
            </div>
          </div>
        </div>

        {/* Sub Navigation */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveSubTab('CALCULADORA')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold transition ${
              activeSubTab === 'CALCULADORA' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calculator className="w-4 h-4" />
            <span>Simulador</span>
          </button>
          <button
            onClick={() => setActiveSubTab('GUIA_DIDATICO')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold transition ${
              activeSubTab === 'GUIA_DIDATICO' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            <span>Guia Didático & Regras</span>
          </button>
          <button
            onClick={() => setActiveSubTab('HISTORICO')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold transition ${
              activeSubTab === 'HISTORICO' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Histórico ({historico.length})</span>
          </button>
          <button
            onClick={() => setActiveSubTab('TABELA_UFS')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold transition ${
              activeSubTab === 'TABELA_UFS' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Tabela de UFs</span>
          </button>
        </div>
      </div>

      {/* GUIA DIDÁTICO TAB */}
      {activeSubTab === 'GUIA_DIDATICO' && (
        <div className="space-y-8">
          {/* Banner Didático Topo */}
          <div className="bg-slate-900 text-white p-8 rounded-lg border border-slate-800 shadow-sm relative overflow-hidden">
            <div className="max-w-3xl space-y-3 relative z-10">
              <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-400/30">
                <GraduationCap className="w-4 h-4" />
                <span>Base Legal & Didática Tributária</span>
              </span>
              <h2 className="text-2xl font-bold">Entendendo o Cálculo do DIFAL e do FCP</h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                O Diferencial de Alíquota do ICMS (DIFAL) foi criado para garantir a partilha justa do imposto nas operações interestaduais. Aprenda a diferença prática entre o cálculo por <strong>Base Dupla ("Por Dentro")</strong> exigido pela Lei Complementar nº 190/2021 e a <strong>Base Única ("Por Fora")</strong>.
              </p>
            </div>
          </div>

          {/* Grid de Conceitos Fundamentais */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Card 1: O que é DIFAL? */}
            <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center space-x-3 text-blue-600">
                <div className="p-2.5 bg-blue-50 rounded-xl">
                  <Scale className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">1. O que é o DIFAL?</h3>
                  <span className="text-xs text-slate-500">Equilíbrio da arrecadação estadual</span>
                </div>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Nas vendas destinadas a outro Estado, o ICMS é dividido entre a <strong>UF de Origem</strong> (que cobra a alíquota interestadual de 4%, 7% ou 12%) e a <strong>UF de Destino</strong> (que recebe a diferença para integralizar a sua alíquota interna).
              </p>
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-2">
                <div className="font-semibold text-slate-800">Principais Legislações:</div>
                <ul className="list-disc list-inside space-y-1 text-slate-600 font-mono text-[11px]">
                  <li>Emenda Constitucional nº 87/2015 (Regra Geral)</li>
                  <li>Lei Complementar nº 190/2021 (Normas Gerais & Base Dupla)</li>
                  <li>Convenio ICMS 142/2018 e Convênio ICMS 235/2021</li>
                </ul>
              </div>
            </div>

            {/* Card 2: Fundo de Combate à Pobreza */}
            <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center space-x-3 text-amber-600">
                <div className="p-2.5 bg-amber-50 rounded-xl">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">2. O que é o FCP (Fundo de Combate à Pobreza)?</h3>
                  <span className="text-xs text-slate-500">Adicional de 1% a 2% na UF de Destino</span>
                </div>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                O FCP é um adicional de ICMS (previsto na EC nº 31/2000) destinado a financiar programas de assistência social estaduais. Ele incide sobre a <strong>mesma base de cálculo recomposta do ICMS de Destino</strong> e é somado ao valor final a recolher.
              </p>
              <div className="bg-amber-50/60 p-3.5 rounded-xl border border-amber-200 text-xs space-y-1 text-amber-900">
                <span className="font-semibold block">Atenção ao Recolhimento:</span>
                <p className="text-[11px]">
                  Apesar de calculado junto com o DIFAL, a maioria dos Estados exige a emissão de uma guia GNRE específica separada para o FCP (Código 10012-9 ou similar).
                </p>
              </div>
            </div>

            {/* Card 3: Base Dupla ("Por Dentro") */}
            <div className="bg-white p-6 rounded-lg border border-blue-200 shadow-xs space-y-4">
              <div className="flex items-center space-x-3 text-blue-700">
                <div className="p-2.5 bg-blue-50 rounded-xl">
                  <FileCode className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">3. Regra de Base Dupla ("Por Dentro")</h3>
                  <span className="text-xs text-blue-600 font-semibold">Regra da LC 190/2021 & Convênio 142/2018</span>
                </div>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Na metodologia de Base Dupla, o valor do ICMS retido pela origem não pode permanecer na base do imposto do destino. Assim, faz-se o "Gross-Up" (por dentro):
              </p>

              <div className="space-y-2 font-mono text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="text-slate-700">
                  <span className="font-bold text-blue-700">Passo A:</span> Retira o ICMS Origem
                  <br />
                  <code className="text-[11px] text-slate-500">Base Líquida = Valor Total - (Valor Total × Alíquota Interestadual)</code>
                </div>
                <div className="text-slate-700 border-t border-slate-200 pt-2">
                  <span className="font-bold text-blue-700">Passo B:</span> Recompõe a Base do Destino
                  <br />
                  <code className="text-[11px] text-slate-500">Base Destino = Base Líquida ÷ (1 - (Aliq. Interna + FCP))</code>
                </div>
                <div className="text-slate-700 border-t border-slate-200 pt-2">
                  <span className="font-bold text-blue-700">Passo C:</span> Calcula o DIFAL Final
                  <br />
                  <code className="text-[11px] text-slate-500">DIFAL = (Base Destino × Aliq. Interna) - ICMS Origem</code>
                </div>
              </div>
            </div>

            {/* Card 4: Base Única ("Por Fora") */}
            <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center space-x-3 text-slate-700">
                <div className="p-2.5 bg-slate-100 rounded-xl">
                  <Calculator className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">4. Regra de Base Única ("Por Fora")</h3>
                  <span className="text-xs text-slate-500">Metodologia Simplificada / Simples Nacional</span>
                </div>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Na Base Única, o valor total da operação permanece como base de cálculo tanto na origem quanto no destino. A diferença percentual é aplicada diretamente sobre a base única:
              </p>

              <div className="space-y-2 font-mono text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="text-slate-700">
                  <span className="font-bold text-slate-800">Fórmula Direta:</span>
                  <br />
                  <code className="text-[11px] text-slate-600">DIFAL = Valor Operação × (Aliq. Interna Destino - Aliq. Interestadual)</code>
                </div>
                <div className="text-slate-700 border-t border-slate-200 pt-2">
                  <span className="font-bold text-slate-800">FCP Simplificado:</span>
                  <br />
                  <code className="text-[11px] text-slate-600">FCP = Valor Operação × Alíquota FCP</code>
                </div>
              </div>
            </div>
          </div>

          {/* Accordion FAQ Didático */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-6 space-y-6">
            <div className="flex items-center space-x-3 border-b border-slate-100 pb-4">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Perguntas Frequentes & Dúvidas Práticas (FAQ)</h3>
                <p className="text-xs text-slate-500">Explicações para os cenários mais comuns em auditoria fiscal de ICMS.</p>
              </div>
            </div>

            <div className="space-y-3">
              {/* Question 1 */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === 'faq-1' ? null : 'faq-1')}
                  className="w-full p-4 text-left font-semibold text-slate-800 text-xs sm:text-sm flex items-center justify-between bg-slate-50 hover:bg-slate-100/80 transition"
                >
                  <span>Qual é a alíquota interestadual correta (4%, 7% ou 12%)?</span>
                  {openFaq === 'faq-1' ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                </button>
                {openFaq === 'faq-1' && (
                  <div className="p-4 text-xs text-slate-600 space-y-2 border-t border-slate-200 bg-white leading-relaxed">
                    <p>A alíquota interestadual é definida pelo estado remetente e pelo destino:</p>
                    <ul className="list-disc list-inside space-y-1 font-mono text-[11px]">
                      <li><strong>4%:</strong> Produtos importados do exterior ou com Conteúdo de Importação superior a 40% (Resolução do SF nº 13/2012).</li>
                      <li><strong>7%:</strong> Saídas de estados do Sul e Sudeste (exceto Espírito Santo) destinadas aos estados do Norte, Nordeste, Centro-Oeste e Espírito Santo.</li>
                      <li><strong>12%:</strong> Demais operações interestaduais entre estados da mesma região ou do Norte/Nordeste para o Sul/Sudeste.</li>
                    </ul>
                  </div>
                )}
              </div>

              {/* Question 2 */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === 'faq-2' ? null : 'faq-2')}
                  className="w-full p-4 text-left font-semibold text-slate-800 text-xs sm:text-sm flex items-center justify-between bg-slate-50 hover:bg-slate-100/80 transition"
                >
                  <span>O IPI deve entrar na base de cálculo do DIFAL?</span>
                  {openFaq === 'faq-2' ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                </button>
                {openFaq === 'faq-2' && (
                  <div className="p-4 text-xs text-slate-600 space-y-2 border-t border-slate-200 bg-white leading-relaxed">
                    <p>Depende do perfil da operação segundo o Art. 13, §1º da LC 87/96:</p>
                    <p>
                      1. <strong>Operação com Consumidor Final:</strong> O IPI integra a base de cálculo do ICMS de origem e de destino.
                      <br />
                      2. <strong>Operação entre Contribuintes para Revenda ou Industrialização:</strong> O IPI <u>NÃO</u> integra a base de cálculo do ICMS se configurar fato gerador de ambos os impostos simultaneamente.
                    </p>
                  </div>
                )}
              </div>

              {/* Question 3 */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === 'faq-3' ? null : 'faq-3')}
                  className="w-full p-4 text-left font-semibold text-slate-800 text-xs sm:text-sm flex items-center justify-between bg-slate-50 hover:bg-slate-100/80 transition"
                >
                  <span>Por que a soma do DIFAL e FCP fica maior na Base Dupla do que na Base Única?</span>
                  {openFaq === 'faq-3' ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                </button>
                {openFaq === 'faq-3' && (
                  <div className="p-4 text-xs text-slate-600 space-y-2 border-t border-slate-200 bg-white leading-relaxed">
                    <p>
                      Na Base Dupla, o imposto do estado de destino é calculado "por dentro" do seu próprio preço recomposto. Como o divisor é menor que 1 (ex: <code>1 - 0.20 = 0.80</code>), a base de cálculo final do destino fica maior que a base original da nota de origem, resultando em um valor nominal de imposto ligeiramente superior. Isso garante a perfeita simetria tributária com as mercadorias vendidas dentro do próprio estado de destino.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'TABELA_UFS' && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-6 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-lg">Alíquotas Internas de ICMS e FCP por Estado (2025/2026)</h3>
              <p className="text-xs text-slate-500 mt-1">Valores padrão configurados na plataforma para cálculo de operações de consumo final e geral.</p>
            </div>
            <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
              27 Unidades Federativas
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-100 text-xs font-bold text-slate-600 uppercase border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3">UF</th>
                  <th className="px-6 py-3">Estado</th>
                  <th className="px-6 py-3">Alíquota Interna ICMS (%)</th>
                  <th className="px-6 py-3">FCP Adicional (%)</th>
                  <th className="px-6 py-3">Carga Tributária Efetiva Total (%)</th>
                  <th className="px-6 py-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {UFS_BRASIL.map(uf => (
                  <tr key={uf.uf} className="hover:bg-slate-50/80 transition">
                    <td className="px-6 py-3.5 font-bold text-slate-900">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 text-slate-800 font-mono text-xs border border-slate-200">
                        {uf.uf}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 font-medium">{uf.nome}</td>
                    <td className="px-6 py-3.5 font-mono text-blue-700 font-bold">{uf.aliqInterna}%</td>
                    <td className="px-6 py-3.5 font-mono text-amber-700">{uf.aliqFcp > 0 ? `${uf.aliqFcp}%` : 'Isento / 0%'}</td>
                    <td className="px-6 py-3.5 font-mono font-bold text-slate-900">
                      {(uf.aliqInterna + uf.aliqFcp).toFixed(1)}%
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <button
                        onClick={() => {
                          setUfDestino(uf.uf);
                          setActiveSubTab('CALCULADORA');
                        }}
                        className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold px-3 py-1.5 rounded-lg transition"
                      >
                        Usar como Destino
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSubTab === 'HISTORICO' && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-6 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-lg">Histórico Local de Simulações de DIFAL</h3>
              <p className="text-xs text-slate-500 mt-1">Simulações salvas durante a sua sessão de trabalho.</p>
            </div>
            {historico.length > 0 && (
              <button
                onClick={() => {
                  setHistorico([]);
                  localStorage.removeItem('atlas_difal_historico');
                }}
                className="text-xs text-red-600 hover:text-red-800 font-medium flex items-center space-x-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Limpar Histórico</span>
              </button>
            )}
          </div>

          {historico.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <FileSpreadsheet className="w-12 h-12 mx-auto mb-3 stroke-1 text-slate-300" />
              <p className="text-sm font-medium text-slate-600">Nenhuma simulação salva ainda.</p>
              <p className="text-xs text-slate-400 mt-1">Preencha os dados na calculadora e clique em "Salvar no Histórico".</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-700">
                <thead className="bg-slate-100 text-xs font-bold text-slate-600 uppercase border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3">Data / Hora</th>
                    <th className="px-6 py-3">Descrição / Referência</th>
                    <th className="px-6 py-3">Origem -&gt; Destino</th>
                    <th className="px-6 py-3">Valor Operação</th>
                    <th className="px-6 py-3">Modalidade</th>
                    <th className="px-6 py-3 text-right">DIFAL Apurado</th>
                    <th className="px-6 py-3 text-right">FCP</th>
                    <th className="px-6 py-3 text-right">Total Recolher</th>
                    <th className="px-6 py-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {historico.map(h => (
                    <tr key={h.id} className="hover:bg-slate-50 transition">
                      <td className="px-6 py-3.5 text-xs text-slate-500 font-mono">{h.data}</td>
                      <td className="px-6 py-3.5 font-medium text-slate-900">{h.descricao}</td>
                      <td className="px-6 py-3.5">
                        <span className="font-bold text-slate-800 bg-slate-100 px-2 py-1 rounded-md text-xs font-mono">
                          {h.ufOrigem} &rarr; {h.ufDestino}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 font-mono">{formatCurrency(h.valorOperacao)}</td>
                      <td className="px-6 py-3.5 text-xs">
                        {h.modalidade === 'BASE_DUPLA' ? (
                          <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded font-semibold border border-blue-200">
                            Base Dupla
                          </span>
                        ) : (
                          <span className="text-slate-700 bg-slate-100 px-2 py-0.5 rounded font-semibold">
                            Base Única
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3.5 font-mono text-right font-bold text-blue-700">{formatCurrency(h.valorDifal)}</td>
                      <td className="px-6 py-3.5 font-mono text-right text-amber-700">{formatCurrency(h.valorFcp)}</td>
                      <td className="px-6 py-3.5 font-mono text-right font-bold text-emerald-700">{formatCurrency(h.totalRecolher)}</td>
                      <td className="px-6 py-3.5 text-center">
                        <button
                          onClick={() => handleRemoverSimulacao(h.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg transition"
                          title="Excluir simulação"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeSubTab === 'CALCULADORA' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Form Left Side */}
          <div className="lg:col-span-5 space-y-6">
            {/* Parâmetros da Operação */}
            <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-xs space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-900 flex items-center space-x-2">
                  <ArrowRightLeft className="w-4 h-4 text-blue-600" />
                  <span>1. Origem, Destino e Regra</span>
                </h3>
                <button
                  onClick={handleResetForm}
                  className="text-xs text-slate-500 hover:text-blue-600 flex items-center space-x-1"
                  title="Resetar formulário"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Limpar</span>
                </button>
              </div>

              {/* UFs Selector */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center space-x-1.5 mb-1">
                    <label className="block text-xs font-semibold text-slate-700">UF de Origem</label>
                    <FiscalTooltip
                      title="UF de Origem (Estado Remetente)"
                      description="Estado onde a mercadoria é faturada ou de onde sai a remessa. Determina a alíquota interestadual aplicável (4%, 7% ou 12%)."
                      lawRef="Art. 155, §2º, VII da CF/88"
                      badge="EC 87/2015"
                    />
                  </div>
                  <select
                    value={ufOrigem}
                    onChange={(e) => handleUfOrigemChange(e.target.value)}
                    className="w-full rounded-xl border-slate-200 text-sm font-bold bg-slate-50 p-2.5 focus:bg-white focus:ring-2 focus:ring-blue-500 transition"
                  >
                    {UFS_BRASIL.map(u => (
                      <option key={u.uf} value={u.uf}>{u.uf} - {u.nome}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="flex items-center space-x-1.5 mb-1">
                    <label className="block text-xs font-semibold text-slate-700">UF de Destino</label>
                    <FiscalTooltip
                      title="UF de Destino (Estado Consumidor)"
                      description="Estado do adquirente final ou estabelecimento destinatário. Recebe o DIFAL e o Fundo de Combate à Pobreza (FCP)."
                      lawRef="Lei Complementar nº 190/2021"
                      badge="LC 190/2021"
                    />
                  </div>
                  <select
                    value={ufDestino}
                    onChange={(e) => handleUfDestinoChange(e.target.value)}
                    className="w-full rounded-xl border-slate-200 text-sm font-bold bg-slate-50 p-2.5 focus:bg-white focus:ring-2 focus:ring-blue-500 transition"
                  >
                    {UFS_BRASIL.map(u => (
                      <option key={u.uf} value={u.uf}>{u.uf} - {u.nome}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Modalidade de Cálculo */}
              <div>
                <div className="flex items-center space-x-1.5 mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700">Modalidade do Cálculo</label>
                  <FiscalTooltip
                    title="Base Dupla ('Por Dentro') vs Base Única"
                    description="Na Base Dupla (exigida pela LC 190/2021 e Convênio 142/2018), o ICMS de Origem é excluído da base bruta e recomposto com a alíquota de destino dividindo por (1 - alíquota total destino). Na Base Única, aplica-se a diferença direta de alíquotas."
                    lawRef="LC 190/2021 e Convênio ICMS 142/2018"
                    examples={[
                      'Base Dupla garante perfeita simetria tributária com compras internas.',
                      'Base Única é usada em situações específicas ou acordos entre UFs.'
                    ]}
                    badge="Metodologia Fiscal"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setModalidade('BASE_DUPLA')}
                    className={`p-3 rounded-xl border text-left transition ${
                      modalidade === 'BASE_DUPLA'
                        ? 'border-blue-600 bg-blue-50/80 text-blue-900 shadow-2xs font-semibold'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-xs font-bold">Base Dupla ("Por Dentro")</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">LC 190/2021 & Convenio 142/2018 (Padrão)</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalidade('BASE_UNICA')}
                    className={`p-3 rounded-xl border text-left transition ${
                      modalidade === 'BASE_UNICA'
                        ? 'border-blue-600 bg-blue-50/80 text-blue-900 shadow-2xs font-semibold'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-xs font-bold">Base Única ("Por Fora")</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Simples / Regra Tradicional</div>
                  </button>
                </div>
              </div>

              {/* Checkboxes de Perfil */}
              <div className="space-y-2 pt-1 border-t border-slate-100">
                <div className="flex items-center space-x-2">
                  <label className="flex items-center space-x-2 text-xs text-slate-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isImportado}
                      onChange={(e) => setIsImportado(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Mercadoria Importada / Resolução SF 13/2012 (Aplica 4% interestadual)</span>
                  </label>
                  <FiscalTooltip
                    title="Alíquota Interestadual de 4% (Bens Importados)"
                    description="Aplica-se alíquota uniforme de 4% nas operações interestaduais com bens e mercadorias importadas do exterior ou com Conteúdo de Importação superior a 40% (FCI)."
                    lawRef="Resolução do Senado Federal nº 13/2012"
                    badge="Res. 13/2012"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <label className="flex items-center space-x-2 text-xs text-slate-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={incluirIpiNaBase}
                      onChange={(e) => setIncluirIpiNaBase(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Incluir IPI na base de cálculo do ICMS Destino</span>
                  </label>
                  <FiscalTooltip
                    title="Inclusão do IPI na Base do ICMS"
                    description="Quando a operação é destinada a consumidor final (não contribuinte ou contribuinte para uso/consumo), o valor do IPI compõe a base de cálculo do ICMS."
                    lawRef="Lei Complementar 87/1996, Art. 13, § 1º, II"
                    badge="LC 87/96"
                  />
                </div>
              </div>
            </div>

            {/* Composição de Valores */}
            <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-900 flex items-center space-x-2">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  <span>2. Valores da Operação (R$)</span>
                </h3>
                <FiscalTooltip
                  title="Composição da Base Bruta da Operação"
                  description="A base de cálculo do imposto é composta pelo valor dos produtos somado a todas as despesas acessórias (frete, seguro, outras despesas, IPI se aplicável), subtraído o desconto incondicional."
                  lawRef="Art. 13, §1º da LC 87/1996"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-slate-600">Valor dos Produtos (R$)</label>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={valorProdutos || ''}
                    onChange={(e) => setValorProdutos(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-xl border-slate-200 text-sm font-semibold p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-slate-600">Frete (R$)</label>
                    <FiscalTooltip
                      title="Frete Acessório (FOB / CIF)"
                      description="Frete cobrado ou debitado ao adquirente integra o valor total da operação para fins de ICMS e DIFAL."
                      lawRef="Art. 13, §1º, II da LC 87/96"
                    />
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={valorFrete || ''}
                    onChange={(e) => setValorFrete(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-xl border-slate-200 text-sm font-semibold p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-slate-600">Seguro (R$)</label>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={valorSeguro || ''}
                    onChange={(e) => setValorSeguro(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-xl border-slate-200 text-sm font-semibold p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-slate-600">Outras Despesas (R$)</label>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={outrasDespesas || ''}
                    onChange={(e) => setOutrasDespesas(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-xl border-slate-200 text-sm font-semibold p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-slate-600">Desconto Incondicional (R$)</label>
                    <FiscalTooltip
                      title="Desconto Incondicional (Constante em Nota)"
                      description="Descontos concedidos no momento da emissão da nota fiscal reduzem a base de cálculo do ICMS. Descontos condicionais (financeiros) não deduzem a base."
                      lawRef="Solução de Consulta COSIT nº 34/2018"
                    />
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={desconto || ''}
                    onChange={(e) => setDesconto(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-xl border-slate-200 text-sm font-semibold p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 text-red-600"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-slate-600">Valor do IPI (R$)</label>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={valorIpi || ''}
                    onChange={(e) => setValorIpi(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-xl border-slate-200 text-sm font-semibold p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl flex items-center justify-between text-xs text-slate-700 font-semibold border border-slate-200">
                <span>Valor Total de Entrada da Operação:</span>
                <span className="font-mono text-sm text-slate-900">{formatCurrency(calculo.baseOperacaoBruta)}</span>
              </div>
            </div>

            {/* Ajuste Fino de Alíquotas */}
            <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-900 flex items-center space-x-2">
                  <Percent className="w-4 h-4 text-[#1e3a5f]" />
                  <span>3. Alíquotas (%)</span>
                </h3>
                <FiscalTooltip
                  title="Alíquotas Aplicáveis no DIFAL"
                  description="O DIFAL resulta da diferença entre a alíquota interna praticada na UF adquirente (somada ao FCP) e a alíquota interestadual devida à UF de origem."
                  lawRef="Art. 155, §2º da Constituição Federal"
                  badge="EC 87/2015"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-semibold text-slate-700">Aliq. Interestadual</label>
                    <FiscalTooltip
                      title="Alíquota Interestadual (Origem)"
                      description="Alíquota tributada pela UF remetente: 7% para remessas do Sul/Sudeste (exceto ES) ao Norte/Nordeste/Centro-Oeste/ES; 12% nos demais casos; e 4% para importados."
                      lawRef="Resolução do Senado Federal nº 22/1989 e 13/2012"
                    />
                  </div>
                  <input
                    type="number"
                    step="0.1"
                    value={aliqInterestadual}
                    onChange={(e) => setAliqInterManual(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-xl border-slate-200 text-xs font-bold p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    {aliqInterManual !== null ? 'Modificado' : `Sugerida (${aliqInterSugerida}%)`}
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-semibold text-slate-700">Aliq. Interna UF Dest.</label>
                    <FiscalTooltip
                      title="Alíquota Interna no Destino"
                      description="Alíquota modal vigente na UF de destino para a mercadoria (geralmente entre 17% e 22%, podendo ser menor se houver benefício fiscal)."
                      lawRef="Legislação Estadual Interna da UF Destinatária"
                    />
                  </div>
                  <input
                    type="number"
                    step="0.1"
                    value={aliqInternaDestino}
                    onChange={(e) => setAliqInternaDestinoManual(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-xl border-slate-200 text-xs font-bold p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 font-mono text-blue-700"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Padrão {ufDestino}: {destUfConfig.aliqInterna}%
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-semibold text-slate-700">Aliq. FCP Destino</label>
                    <FiscalTooltip
                      title="Fundo de Combate à Pobreza (FCP)"
                      description="Adicional de 1% a 2% sobre a alíquota interna incidente em produtos específicos conforme legislação de cada UF."
                      lawRef="Art. 82 do ADCT da Constituição Federal"
                      badge="FCP / FECOEP"
                    />
                  </div>
                  <input
                    type="number"
                    step="0.1"
                    value={aliqFcpDestino}
                    onChange={(e) => setAliqFcpManual(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-xl border-slate-200 text-xs font-bold p-2.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 font-mono text-amber-700"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Padrão {ufDestino}: {destUfConfig.aliqFcp}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Results Right Side */}
          <div className="lg:col-span-7 space-y-6">
            {/* Top Cards Resultado */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-blue-900 border border-blue-800 text-white p-5 rounded-lg shadow-sm space-y-1">
                <span className="text-xs font-medium text-blue-100 uppercase tracking-wider block">Valor do DIFAL</span>
                <div className="text-2xl font-black font-mono">
                  {formatCurrency(calculo.difalValor)}
                </div>
                <div className="text-[11px] text-blue-200">
                  Diferença ICMS Destino - Origem
                </div>
              </div>

              <div className="bg-amber-900 border border-amber-800 text-white p-5 rounded-lg shadow-sm space-y-1">
                <span className="text-xs font-medium text-amber-100 uppercase tracking-wider block">Valor do FCP</span>
                <div className="text-2xl font-black font-mono">
                  {formatCurrency(calculo.fcpValor)}
                </div>
                <div className="text-[11px] text-amber-100">
                  Fundo de Combate à Pobreza ({aliqFcpDestino}%)
                </div>
              </div>

              <div className="bg-emerald-900 border border-emerald-800 text-white p-5 rounded-lg shadow-sm space-y-1">
                <span className="text-xs font-medium text-emerald-100 uppercase tracking-wider block">Total a Recolher</span>
                <div className="text-2xl font-black font-mono">
                  {formatCurrency(calculo.totalRecolher)}
                </div>
                <div className="text-[11px] text-emerald-100">
                  DIFAL + FCP Unificados
                </div>
              </div>
            </div>

            {/* Card Memória de Cálculo Passo a Passo */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-5 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-slate-900 flex items-center space-x-2">
                    <Info className="w-4 h-4 text-blue-600" />
                    <span>Memória de Cálculo Detalhada</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Metodologia: {modalidade === 'BASE_DUPLA' ? 'Base Dupla "Por Dentro" (LC 190/2021)' : 'Base Única "Por Fora"'}
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleCopyReport}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition shadow-2xs"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                    <span>{copied ? 'Copiado' : 'Copiar Texto'}</span>
                  </button>
                  <button
                    onClick={handlePrint}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition shadow-2xs"
                  >
                    <Printer className="w-3.5 h-3.5 text-slate-500" />
                    <span>Imprimir</span>
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-4 text-xs font-mono">
                {/* Step 1 */}
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <div className="text-slate-500 text-[11px] font-sans font-semibold">Passo 1: Apuração do ICMS de Origem (Interestadual)</div>
                  <div className="text-slate-900 font-bold">
                    ICMS Origem = {formatCurrency(calculo.baseOperacaoBruta)} &times; {aliqInterestadual}% = <span className="text-blue-700">{formatCurrency(calculo.icmsOrigemValor)}</span>
                  </div>
                </div>

                {modalidade === 'BASE_DUPLA' ? (
                  <>
                    {/* Step 2 */}
                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                      <div className="text-slate-500 text-[11px] font-sans font-semibold">Passo 2: Exclusão do ICMS de Origem da Base</div>
                      <div className="text-slate-900 font-bold">
                        Base Líquida = {formatCurrency(calculo.baseOperacaoBruta)} - {formatCurrency(calculo.icmsOrigemValor)} = <span className="text-slate-800">{formatCurrency(calculo.baseSemIcmsOrigem)}</span>
                      </div>
                    </div>

                    {/* Step 3 */}
                    <div className="p-3.5 bg-blue-50/50 rounded-xl border border-blue-200 space-y-1">
                      <div className="text-blue-800 text-[11px] font-sans font-semibold">Passo 3: Recomposição da Base Dupla de Destino (Gross-Up)</div>
                      <div className="text-slate-700 text-[11px] font-sans">
                        Divisor = 1 - ({aliqInternaDestino}% + {aliqFcpDestino}%) = <span className="font-bold font-mono">{calculo.fatorDivisor.toFixed(4)}</span>
                      </div>
                      <div className="text-slate-900 font-bold">
                        Base Destino = {formatCurrency(calculo.baseSemIcmsOrigem)} &divide; {calculo.fatorDivisor.toFixed(4)} = <span className="text-blue-800 text-sm">{formatCurrency(calculo.baseDestino)}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                    <div className="text-slate-500 text-[11px] font-sans font-semibold">Passo 2: Base Única da Operação</div>
                    <div className="text-slate-900 font-bold">
                      Base Destino = <span className="text-blue-800">{formatCurrency(calculo.baseDestino)}</span>
                    </div>
                  </div>
                )}

                {/* Step 4 */}
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <div className="text-slate-500 text-[11px] font-sans font-semibold">Passo 4: ICMS Total Devido na UF de Destino ({ufDestino})</div>
                  <div className="text-slate-900 font-bold">
                    ICMS Destino Total = {formatCurrency(calculo.baseDestino)} &times; {aliqInternaDestino}% = <span className="text-slate-900">{formatCurrency(calculo.icmsDestinoValor)}</span>
                  </div>
                </div>

                {/* Step 5 */}
                <div className="p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-200 space-y-1">
                  <div className="text-emerald-800 text-[11px] font-sans font-semibold">Passo 5: Apuração Final do DIFAL & FCP</div>
                  <div className="text-slate-900 font-bold">
                    DIFAL = ICMS Destino ({formatCurrency(calculo.icmsDestinoValor)}) - ICMS Origem ({formatCurrency(calculo.icmsOrigemValor)}) = <span className="text-blue-700">{formatCurrency(calculo.difalValor)}</span>
                  </div>
                  <div className="text-slate-900 font-bold">
                    FCP = Base Destino ({formatCurrency(calculo.baseDestino)}) &times; {aliqFcpDestino}% = <span className="text-amber-700">{formatCurrency(calculo.fcpValor)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Explicação Didática Dinâmica Personalizada */}
            <div className="bg-blue-50/60 p-6 rounded-lg border border-blue-200 space-y-4">
              <div className="flex items-center space-x-3 text-blue-900">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Lightbulb className="w-5 h-5 text-blue-700" />
                </div>
                <div>
                  <h4 className="font-bold text-sm">Explicação Didática desta Simulação</h4>
                  <span className="text-xs text-blue-700">Entenda passo a passo os valores gerados acima</span>
                </div>
              </div>

              <div className="text-xs text-slate-700 leading-relaxed space-y-3 font-sans">
                <p>
                  • <strong>Origem e Destino:</strong> Na operação de <strong>{ufOrigem}</strong> para <strong>{ufDestino}</strong>, a alíquota interestadual aplicável é de <strong>{aliqInterestadual}%</strong>. Sobre o valor bruto de <strong>{formatCurrency(calculo.baseOperacaoBruta)}</strong>, o estado de origem retém <strong>{formatCurrency(calculo.icmsOrigemValor)}</strong> de ICMS.
                </p>

                {modalidade === 'BASE_DUPLA' ? (
                  <p>
                    • <strong>Recomposição por Base Dupla:</strong> Para calcular o tributo do destino ({ufDestino}), o valor de <strong>{formatCurrency(calculo.icmsOrigemValor)}</strong> é subtraído da operação, deixando uma base líquida de <strong>{formatCurrency(calculo.baseSemIcmsOrigem)}</strong>. Em seguida, essa base é dividida por <strong>{calculo.fatorDivisor.toFixed(4)}</strong> (fator referente a <code>1 - {(aliqInternaDestino + aliqFcpDestino)}%</code>), "inflando" a base final do destino para <strong>{formatCurrency(calculo.baseDestino)}</strong>.
                  </p>
                ) : (
                  <p>
                    • <strong>Cálculo por Base Única:</strong> Mantém-se o valor bruto de <strong>{formatCurrency(calculo.baseDestino)}</strong> como base para a alíquota do estado de destino ({aliqInternaDestino}%).
                  </p>
                )}

                <p>
                  • <strong>Recolhimento Final:</strong> O imposto final devido a {ufDestino} é de <strong>{formatCurrency(calculo.icmsDestinoValor)}</strong>. Deduzindo os <strong>{formatCurrency(calculo.icmsOrigemValor)}</strong> pagos na origem, o valor do DIFAL resulta em <strong>{formatCurrency(calculo.difalValor)}</strong>, somado a <strong>{formatCurrency(calculo.fcpValor)}</strong> referentes ao FCP ({aliqFcpDestino}%), totalizando <strong>{formatCurrency(calculo.totalRecolher)}</strong>.
                </p>
              </div>
            </div>

            {/* Salvar Simulação Box */}
            <div className="bg-slate-50 p-5 rounded-lg border border-slate-200 space-y-3">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Salvar Simulação no Histórico</h4>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  placeholder="Nome/Referência (ex: Cliente A - NFe Cotação 102)"
                  value={simulacaoDesc}
                  onChange={(e) => setSimulacaoDesc(e.target.value)}
                  className="flex-1 rounded-xl border-slate-200 text-xs p-2.5 bg-white focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleSalvarSimulacao}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2.5 rounded-xl text-xs transition shadow-xs flex items-center justify-center space-x-1"
                >
                  <Plus className="w-4 h-4" />
                  <span>Salvar</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

