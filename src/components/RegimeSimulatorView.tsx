import React, { useState, useMemo } from 'react';
import { SpedData } from '../types';
import { FiscalTooltip } from './FiscalTooltip';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Legend,
  CartesianGrid,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import {
  Calculator,
  TrendingUp,
  Percent,
  DollarSign,
  Building2,
  FileText,
  Download,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  HelpCircle,
  Award,
  PieChart as PieIcon,
  RefreshCw,
  Scale,
  ShieldCheck,
  Zap,
  Info,
  Sliders,
  Database
} from 'lucide-react';

interface RegimeSimulatorViewProps {
  spedData: SpedData | null;
}

export function RegimeSimulatorView({ spedData }: RegimeSimulatorViewProps) {
  // Standalone Toggle for SPED import usage (False by default)
  const [usarDadosSped, setUsarDadosSped] = useState<boolean>(false);

  // Manual Company Data State
  const [nomeEmpresa, setNomeEmpresa] = useState<string>(spedData?.header?.nome || 'Minha Empresa Ltda');
  const [cnpj, setCnpj] = useState<string>(spedData?.header?.cnpj || '00.000.000/0001-00');
  const [regimeAtual, setRegimeAtual] = useState<'SIMPLES' | 'PRESUMIDO' | 'REAL' | 'OUTROS'>('SIMPLES');

  // SPED Derived values (only if toggle is active and spedData exists)
  const spedRevenue = useMemo(() => {
    if (!spedData) return 1200000;
    let totSaidas = 0;
    for (const doc of spedData.documents) {
      if (doc.indOper === '1') {
        totSaidas += doc.vlDoc || 0;
      }
    }
    return totSaidas > 0 ? totSaidas * 12 : 1200000;
  }, [spedData]);

  const spedInsumos = useMemo(() => {
    if (!spedData) return 600000;
    let totEntradas = 0;
    for (const doc of spedData.documents) {
      if (doc.indOper === '0') {
        totEntradas += doc.vlDoc || 0;
      }
    }
    return totEntradas > 0 ? totEntradas * 12 : 600000;
  }, [spedData]);

  // Simulation Form Input States (Mensal, Trimestral, Anual ou Personalizado com Datas)
  const [frequenciaEntrada, setFrequenciaEntrada] = useState<'ANUAL' | 'MENSAL' | 'TRIMESTRAL' | 'CUSTOM'>('MENSAL');
  const [trimestreIntervalo, setTrimestreIntervalo] = useState<'Q1' | 'Q2' | 'Q3' | 'Q4'>('Q1');
  const [dataInicio, setDataInicio] = useState<string>('2026-01-01');
  const [dataFim, setDataFim] = useState<string>('2026-12-31');

  const customMonths = (() => {
    try {
      const start = new Date(dataInicio);
      const end = new Date(dataFim);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) return 12;
      const diffTime = end.getTime() - start.getTime();
      const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1);
      return Math.max(0.5, diffDays / 30.44);
    } catch {
      return 12;
    }
  })();

  const multiplicadorBase = frequenciaEntrada === 'MENSAL' ? 12 : frequenciaEntrada === 'TRIMESTRAL' ? 4 : frequenciaEntrada === 'CUSTOM' ? (12 / customMonths) : 1;

  const [faturamentoInput, setFaturamentoInput] = useState<number>(100000);
  const [comprasInsumosInput, setComprasInsumosInput] = useState<number>(50000);
  const [folhaPagamentoInput, setFolhaPagamentoInput] = useState<number>(25000);
  const [despesasOperacionaisInput, setDespesasOperacionaisInput] = useState<number>(15000);

  const faturamentoAnual = faturamentoInput * multiplicadorBase;
  const comprasInsumosAnual = comprasInsumosInput * multiplicadorBase;
  const folhaPagamentoAnual = folhaPagamentoInput * multiplicadorBase;
  const despesasOperacionaisAnual = despesasOperacionaisInput * multiplicadorBase;

  const [margemLucroEstimada, setMargemLucroEstimada] = useState<number>(20);
  const [tipoAtividade, setTipoAtividade] = useState<'COMERCIO' | 'INDUSTRIA' | 'SERVICOS_ANEXO3' | 'SERVICOS_ANEXO5'>('COMERCIO');
  const [uf, setUf] = useState<string>(spedData?.header?.uf || 'SP');
  const [aliquotaIcmsInterna, setAliquotaIcmsInterna] = useState<number>(18);
  const [creditoIcmsEntradas, setCreditoIcmsEntradas] = useState<number>(12);
  const [aliquotaIss, setAliquotaIss] = useState<number>(5);

  // When user toggles "usarDadosSped", sync values if spedData exists
  const handleToggleSped = (checked: boolean) => {
    setUsarDadosSped(checked);
    if (checked && spedData) {
      setFrequenciaEntrada('ANUAL');
      setFaturamentoInput(Math.round(spedRevenue));
      setComprasInsumosInput(Math.round(spedInsumos));
      if (spedData.header?.nome) setNomeEmpresa(spedData.header.nome);
      if (spedData.header?.cnpj) setCnpj(spedData.header.cnpj);
      if (spedData.header?.uf) setUf(spedData.header.uf);
    }
  };

  // Reforma Tributaria Options (EC 132/2023)
  const [aliquotaIvaDualStandard, setAliquotaIvaDualStandard] = useState<number>(26.5);
  const [regimeEspecialReforma, setRegimeEspecialReforma] = useState<'PADRAO' | 'REDUC_60' | 'REDUC_30' | 'ISENTO'>('PADRAO');
  const [recalcKey, setRecalcKey] = useState<number>(0);
  const [showUpdatedNotification, setShowUpdatedNotification] = useState<boolean>(false);

  // Period Analysis State (Anual vs Trimestral)
  const [periodoAnalise, setPeriodoAnalise] = useState<'ANUAL' | 'TRIMESTRAL'>('ANUAL');
  const [trimestreSelecionado, setTrimestreSelecionado] = useState<'Q1' | 'Q2' | 'Q3' | 'Q4'>('Q1');
  const fatorPeriodo = periodoAnalise === 'TRIMESTRAL' ? 0.25 : 1;

  // Parameter Section Tab State
  const [activeParamTab, setActiveParamTab] = useState<'CADASTRO' | 'FINANCEIRO' | 'ALIQUOTAS'>('CADASTRO');

  const handleAtualizarCalculo = () => {
    setRecalcKey(prev => prev + 1);
    setShowUpdatedNotification(true);
    setTimeout(() => {
      setShowUpdatedNotification(false);
    }, 3500);
  };

  const handleCarregarPresetComercio = () => {
    setNomeEmpresa('Comércio Varejista Exemplo Ltda');
    setCnpj('12.345.678/0001-90');
    setRegimeAtual('SIMPLES');
    setTipoAtividade('COMERCIO');
    setFrequenciaEntrada('ANUAL');
    setFaturamentoInput(1800000);
    setComprasInsumosInput(1080000);
    setFolhaPagamentoInput(240000);
    setDespesasOperacionaisInput(150000);
    setAliquotaIcmsInterna(18);
    setCreditoIcmsEntradas(12);
    setAliquotaIss(5);
    setUf('SP');
    handleAtualizarCalculo();
  };

  const handleCarregarPresetIndustria = () => {
    setNomeEmpresa('Indústria Metalúrgica Modelo S.A.');
    setCnpj('98.765.432/0001-11');
    setRegimeAtual('REAL');
    setTipoAtividade('INDUSTRIA');
    setFrequenciaEntrada('ANUAL');
    setFaturamentoInput(6000000);
    setComprasInsumosInput(3200000);
    setFolhaPagamentoInput(1200000);
    setDespesasOperacionaisInput(800000);
    setAliquotaIcmsInterna(18);
    setCreditoIcmsEntradas(14);
    setAliquotaIss(5);
    setUf('MG');
    handleAtualizarCalculo();
  };

  const handleCarregarPresetServicos = () => {
    setNomeEmpresa('Tecnologia & Consultoria Avançada Ltda');
    setCnpj('45.123.789/0001-44');
    setRegimeAtual('SIMPLES');
    setTipoAtividade('SERVICOS_ANEXO5');
    setFrequenciaEntrada('ANUAL');
    setFaturamentoInput(960000);
    setComprasInsumosInput(80000);
    setFolhaPagamentoInput(320000);
    setDespesasOperacionaisInput(120000);
    setAliquotaIcmsInterna(18);
    setCreditoIcmsEntradas(4);
    setAliquotaIss(5);
    setUf('RJ');
    handleAtualizarCalculo();
  };

  // Calculations
  const faturamentoMensal = faturamentoAnual / 12;
  const fatorR = faturamentoAnual > 0 ? (folhaPagamentoAnual / faturamentoAnual) * 100 : 0;

  // 1. SIMPLES NACIONAL
  const calcSimplesNacional = useMemo(() => {
    let anexo = 'Anexo I (Comércio)';
    let aliqNominal = 0;
    let deducao = 0;

    if (tipoAtividade === 'COMERCIO') {
      anexo = 'Anexo I (Comércio)';
      if (faturamentoAnual <= 180000) { aliqNominal = 4; deducao = 0; }
      else if (faturamentoAnual <= 360000) { aliqNominal = 7.3; deducao = 5940; }
      else if (faturamentoAnual <= 720000) { aliqNominal = 9.5; deducao = 13860; }
      else if (faturamentoAnual <= 1800000) { aliqNominal = 10.7; deducao = 22500; }
      else if (faturamentoAnual <= 3600000) { aliqNominal = 14.3; deducao = 87300; }
      else { aliqNominal = 19; deducao = 378000; }
    } else if (tipoAtividade === 'INDUSTRIA') {
      anexo = 'Anexo II (Indústria)';
      if (faturamentoAnual <= 180000) { aliqNominal = 4.5; deducao = 0; }
      else if (faturamentoAnual <= 360000) { aliqNominal = 7.8; deducao = 5940; }
      else if (faturamentoAnual <= 720000) { aliqNominal = 10; deducao = 13860; }
      else if (faturamentoAnual <= 1800000) { aliqNominal = 11.2; deducao = 22500; }
      else if (faturamentoAnual <= 3600000) { aliqNominal = 14.7; deducao = 85500; }
      else { aliqNominal = 30; deducao = 720000; }
    } else {
      const usaAnexo3 = fatorR >= 28 || tipoAtividade === 'SERVICOS_ANEXO3';
      if (usaAnexo3) {
        anexo = `Anexo III (Serviços - Fator R: ${fatorR.toFixed(1)}% >= 28%)`;
        if (faturamentoAnual <= 180000) { aliqNominal = 6; deducao = 0; }
        else if (faturamentoAnual <= 360000) { aliqNominal = 11.2; deducao = 9360; }
        else if (faturamentoAnual <= 720000) { aliqNominal = 13.5; deducao = 17640; }
        else if (faturamentoAnual <= 1800000) { aliqNominal = 16; deducao = 35640; }
        else if (faturamentoAnual <= 3600000) { aliqNominal = 21; deducao = 125640; }
        else { aliqNominal = 33; deducao = 648000; }
      } else {
        anexo = `Anexo V (Serviços - Fator R: ${fatorR.toFixed(1)}% < 28%)`;
        if (faturamentoAnual <= 180000) { aliqNominal = 15.5; deducao = 0; }
        else if (faturamentoAnual <= 360000) { aliqNominal = 18; deducao = 4500; }
        else if (faturamentoAnual <= 720000) { aliqNominal = 19.5; deducao = 9900; }
        else if (faturamentoAnual <= 1800000) { aliqNominal = 20.5; deducao = 17100; }
        else if (faturamentoAnual <= 3600000) { aliqNominal = 23; deducao = 62100; }
        else { aliqNominal = 30.5; deducao = 540000; }
      }
    }

    const aliqEfetiva = faturamentoAnual > 0
      ? Math.max(0, ((faturamentoAnual * (aliqNominal / 100) - deducao) / faturamentoAnual) * 100)
      : 0;

    const impostoAnual = faturamentoAnual * (aliqEfetiva / 100);
    const elegivel = faturamentoAnual <= 4800000;

    return {
      anexo,
      aliqEfetiva,
      impostoAnual,
      impostoMensal: impostoAnual / 12,
      elegivel
    };
  }, [faturamentoAnual, tipoAtividade, fatorR, recalcKey]);

  // 2. LUCRO PRESUMIDO
  const calcLucroPresumido = useMemo(() => {
    const isServico = tipoAtividade === 'SERVICOS_ANEXO3' || tipoAtividade === 'SERVICOS_ANEXO5';
    const percentIrpj = isServico ? 0.32 : 0.08;
    const percentCsll = isServico ? 0.32 : 0.12;

    const pisAnual = faturamentoAnual * 0.0065;
    const cofinsAnual = faturamentoAnual * 0.03;

    const basePresumidaIrpj = faturamentoAnual * percentIrpj;
    let irpjAnual = basePresumidaIrpj * 0.15;
    if (basePresumidaIrpj > 240000) {
      irpjAnual += (basePresumidaIrpj - 240000) * 0.10;
    }

    const basePresumidaCsll = faturamentoAnual * percentCsll;
    const csllAnual = basePresumidaCsll * 0.09;

    let icmsAnual = 0;
    let issAnual = 0;

    if (isServico) {
      issAnual = faturamentoAnual * (aliquotaIss / 100);
    } else {
      const icmsSaidas = faturamentoAnual * (aliquotaIcmsInterna / 100);
      const icmsCreditos = comprasInsumosAnual * (creditoIcmsEntradas / 100);
      icmsAnual = Math.max(0, icmsSaidas - icmsCreditos);
    }

    const impostoAnualTotal = pisAnual + cofinsAnual + irpjAnual + csllAnual + icmsAnual + issAnual;
    const aliqEfetivaTotal = faturamentoAnual > 0 ? (impostoAnualTotal / faturamentoAnual) * 100 : 0;

    return {
      pisAnual,
      cofinsAnual,
      irpjAnual,
      csllAnual,
      icmsAnual,
      issAnual,
      impostoAnualTotal,
      impostoMensalTotal: impostoAnualTotal / 12,
      aliqEfetivaTotal
    };
  }, [faturamentoAnual, comprasInsumosAnual, tipoAtividade, aliquotaIcmsInterna, creditoIcmsEntradas, aliquotaIss, recalcKey]);

  // 3. LUCRO REAL
  const calcLucroReal = useMemo(() => {
    const totalDespesas = comprasInsumosAnual + folhaPagamentoAnual + despesasOperacionaisAnual;
    const lucroCalculadoDeducoes = faturamentoAnual - totalDespesas;
    const lucroRealEstimadoBase = totalDespesas > 0
      ? Math.max(0, lucroCalculadoDeducoes)
      : Math.max(0, faturamentoAnual * (margemLucroEstimada / 100));

    const pisDebito = faturamentoAnual * 0.0165;
    const pisCredito = comprasInsumosAnual * 0.0165;
    const pisAnual = Math.max(0, pisDebito - pisCredito);

    const cofinsDebito = faturamentoAnual * 0.076;
    const cofinsCredito = comprasInsumosAnual * 0.076;
    const cofinsAnual = Math.max(0, cofinsDebito - cofinsCredito);

    let irpjAnual = lucroRealEstimadoBase * 0.15;
    if (lucroRealEstimadoBase > 240000) {
      irpjAnual += (lucroRealEstimadoBase - 240000) * 0.10;
    }

    const csllAnual = lucroRealEstimadoBase * 0.09;

    const isServico = tipoAtividade === 'SERVICOS_ANEXO3' || tipoAtividade === 'SERVICOS_ANEXO5';
    let icmsAnual = 0;
    let issAnual = 0;

    if (isServico) {
      issAnual = faturamentoAnual * (aliquotaIss / 100);
    } else {
      const icmsSaidas = faturamentoAnual * (aliquotaIcmsInterna / 100);
      const icmsCreditos = comprasInsumosAnual * (creditoIcmsEntradas / 100);
      icmsAnual = Math.max(0, icmsSaidas - icmsCreditos);
    }

    const impostoAnualTotal = pisAnual + cofinsAnual + irpjAnual + csllAnual + icmsAnual + issAnual;
    const aliqEfetivaTotal = faturamentoAnual > 0 ? (impostoAnualTotal / faturamentoAnual) * 100 : 0;

    return {
      lucroRealEstimadoBase,
      pisAnual,
      cofinsAnual,
      irpjAnual,
      csllAnual,
      icmsAnual,
      issAnual,
      impostoAnualTotal,
      impostoMensalTotal: impostoAnualTotal / 12,
      aliqEfetivaTotal
    };
  }, [faturamentoAnual, comprasInsumosAnual, folhaPagamentoAnual, despesasOperacionaisAnual, margemLucroEstimada, tipoAtividade, aliquotaIcmsInterna, creditoIcmsEntradas, aliquotaIss, recalcKey]);

  // 4. REFORMA TRIBUTÁRIA (IVA DUAL: IBS + CBS)
  const calcReformaTributaria = useMemo(() => {
    let aliqEfetivaIva = aliquotaIvaDualStandard;

    if (regimeEspecialReforma === 'REDUC_60') aliqEfetivaIva = aliquotaIvaDualStandard * 0.40;
    else if (regimeEspecialReforma === 'REDUC_30') aliqEfetivaIva = aliquotaIvaDualStandard * 0.70;
    else if (regimeEspecialReforma === 'ISENTO') aliqEfetivaIva = 0;

    const ivaDebito = faturamentoAnual * (aliqEfetivaIva / 100);
    const ivaCreditoInsumos = comprasInsumosAnual * (aliqEfetivaIva / 100);
    const ivaLiquidoAnual = Math.max(0, ivaDebito - ivaCreditoInsumos);

    const irpjCsllEstimado = calcLucroPresumido.irpjAnual + calcLucroPresumido.csllAnual;

    const impostoAnualTotal = ivaLiquidoAnual + irpjCsllEstimado;
    const aliqEfetivaTotal = faturamentoAnual > 0 ? (impostoAnualTotal / faturamentoAnual) * 100 : 0;

    return {
      aliqEfetivaIva,
      ivaDebito,
      ivaCreditoInsumos,
      ivaLiquidoAnual,
      irpjCsllEstimado,
      impostoAnualTotal,
      aliqEfetivaTotal
    };
  }, [faturamentoAnual, comprasInsumosAnual, aliquotaIvaDualStandard, regimeEspecialReforma, calcLucroPresumido, recalcKey]);

  // DRE Simulation per Regime
  const dreSimples = useMemo(() => {
    const receitaBruta = faturamentoAnual;
    const impostos = calcSimplesNacional.impostoAnual;
    const receitaLiquida = receitaBruta - impostos;
    const cmv = comprasInsumosAnual;
    const lucroBruto = receitaLiquida - cmv;
    const despesasOp = folhaPagamentoAnual + despesasOperacionaisAnual;
    const lair = lucroBruto - despesasOp;
    const irpjCsll = 0; // Inclusos no DAS
    const lucroLiquido = Math.max(0, lair - irpjCsll);
    return { receitaBruta, impostos, receitaLiquida, cmv, lucroBruto, despesasOp, lair, irpjCsll, lucroLiquido };
  }, [faturamentoAnual, comprasInsumosAnual, folhaPagamentoAnual, despesasOperacionaisAnual, calcSimplesNacional]);

  const drePresumido = useMemo(() => {
    const receitaBruta = faturamentoAnual;
    const impostos = calcLucroPresumido.impostoAnualTotal;
    const receitaLiquida = receitaBruta - impostos;
    const cmv = comprasInsumosAnual;
    const lucroBruto = receitaLiquida - cmv;
    const despesasOp = folhaPagamentoAnual + despesasOperacionaisAnual;
    const lair = lucroBruto - despesasOp;
    const irpjCsll = calcLucroPresumido.irpjAnual + calcLucroPresumido.csllAnual;
    const lucroLiquido = Math.max(0, lair - irpjCsll);
    return { receitaBruta, impostos, receitaLiquida, cmv, lucroBruto, despesasOp, lair, irpjCsll, lucroLiquido };
  }, [faturamentoAnual, comprasInsumosAnual, folhaPagamentoAnual, despesasOperacionaisAnual, calcLucroPresumido]);

  const dreReal = useMemo(() => {
    const receitaBruta = faturamentoAnual;
    const impostos = calcLucroReal.impostoAnualTotal;
    const receitaLiquida = receitaBruta - impostos;
    const cmv = comprasInsumosAnual;
    const lucroBruto = receitaLiquida - cmv;
    const despesasOp = folhaPagamentoAnual + despesasOperacionaisAnual;
    const lair = calcLucroReal.lucroRealEstimadoBase;
    const irpjCsll = calcLucroReal.irpjAnual + calcLucroReal.csllAnual;
    const lucroLiquido = Math.max(0, lucroBruto - despesasOp - irpjCsll);
    return { receitaBruta, impostos, receitaLiquida, cmv, lucroBruto, despesasOp, lair, irpjCsll, lucroLiquido };
  }, [faturamentoAnual, comprasInsumosAnual, folhaPagamentoAnual, despesasOperacionaisAnual, calcLucroReal]);

  // Scaled DRE for display based on Anual vs Trimestral period selection
  const displayDreSimples = useMemo(() => ({
    receitaBruta: dreSimples.receitaBruta * fatorPeriodo,
    impostos: dreSimples.impostos * fatorPeriodo,
    receitaLiquida: dreSimples.receitaLiquida * fatorPeriodo,
    cmv: dreSimples.cmv * fatorPeriodo,
    lucroBruto: dreSimples.lucroBruto * fatorPeriodo,
    despesasOp: dreSimples.despesasOp * fatorPeriodo,
    lair: dreSimples.lair * fatorPeriodo,
    irpjCsll: dreSimples.irpjCsll * fatorPeriodo,
    lucroLiquido: dreSimples.lucroLiquido * fatorPeriodo,
  }), [dreSimples, fatorPeriodo]);

  const displayDrePresumido = useMemo(() => ({
    receitaBruta: drePresumido.receitaBruta * fatorPeriodo,
    impostos: drePresumido.impostos * fatorPeriodo,
    receitaLiquida: drePresumido.receitaLiquida * fatorPeriodo,
    cmv: drePresumido.cmv * fatorPeriodo,
    lucroBruto: drePresumido.lucroBruto * fatorPeriodo,
    despesasOp: drePresumido.despesasOp * fatorPeriodo,
    lair: drePresumido.lair * fatorPeriodo,
    irpjCsll: drePresumido.irpjCsll * fatorPeriodo,
    lucroLiquido: drePresumido.lucroLiquido * fatorPeriodo,
  }), [drePresumido, fatorPeriodo]);

  const displayDreReal = useMemo(() => ({
    receitaBruta: dreReal.receitaBruta * fatorPeriodo,
    impostos: dreReal.impostos * fatorPeriodo,
    receitaLiquida: dreReal.receitaLiquida * fatorPeriodo,
    cmv: dreReal.cmv * fatorPeriodo,
    lucroBruto: dreReal.lucroBruto * fatorPeriodo,
    despesasOp: dreReal.despesasOp * fatorPeriodo,
    lair: dreReal.lair * fatorPeriodo,
    irpjCsll: dreReal.irpjCsll * fatorPeriodo,
    lucroLiquido: dreReal.lucroLiquido * fatorPeriodo,
  }), [dreReal, fatorPeriodo]);

  // Comparative Recommendation Matrix
  const regimesComparison = useMemo(() => {
    const list = [];

    if (calcSimplesNacional.elegivel) {
      list.push({
        id: 'SIMPLES',
        nome: 'Simples Nacional',
        aliqEfetiva: calcSimplesNacional.aliqEfetiva,
        impostoAnual: calcSimplesNacional.impostoAnual,
        detalhe: calcSimplesNacional.anexo,
        cor: '#10b981'
      });
    }

    list.push({
      id: 'PRESUMIDO',
      nome: 'Lucro Presumido',
      aliqEfetiva: calcLucroPresumido.aliqEfetivaTotal,
      impostoAnual: calcLucroPresumido.impostoAnualTotal,
      detalhe: 'Presunção Regrada + PIS/COFINS Cumulativo',
      cor: '#3b82f6'
    });

    list.push({
      id: 'REAL',
      nome: 'Lucro Real',
      aliqEfetiva: calcLucroReal.aliqEfetivaTotal,
      impostoAnual: calcLucroReal.impostoAnualTotal,
      detalhe: 'Não Cumulativo com Crédito de Insumos',
      cor: '#8b5cf6'
    });

    list.push({
      id: 'REFORMA',
      nome: 'Reforma (IVA Dual + IRPJ)',
      aliqEfetiva: calcReformaTributaria.aliqEfetivaTotal,
      impostoAnual: calcReformaTributaria.impostoAnualTotal,
      detalhe: 'EC 132/2023 — IBS + CBS Crédito Pleno',
      cor: '#f59e0b'
    });

    const sorted = [...list].sort((a, b) => a.impostoAnual - b.impostoAnual);
    const winner = sorted[0];
    const second = sorted[1];
    const economiaAnual = second ? second.impostoAnual - winner.impostoAnual : 0;

    return {
      all: list,
      sorted,
      winner,
      economiaAnual
    };
  }, [calcSimplesNacional, calcLucroPresumido, calcLucroReal, calcReformaTributaria, recalcKey]);

  const chartData = useMemo(() => {
    return regimesComparison.all.map(r => ({
      name: r.nome,
      'Imposto Anual (R$)': Math.round(r.impostoAnual),
      'Alíquota Efetiva (%)': parseFloat(r.aliqEfetiva.toFixed(2))
    }));
  }, [regimesComparison]);

  const exportPDFStudy = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    let cursorY = 15;

    doc.setFillColor(30, 58, 138);
    doc.rect(0, 0, pageWidth, 28, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(255, 255, 255);
    doc.text('ESTUDO DE PLANEJAMENTO E RESTRUTURAÇÃO TRIBUTÁRIA', 14, 15);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.text(`Empresa: ${nomeEmpresa} | CNPJ: ${cnpj} | Regime Atual: ${regimeAtual}`, 14, 22);

    cursorY = 36;

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, cursorY, pageWidth - 28, 32, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text(`Faturamento Anual: R$ ${faturamentoAnual.toLocaleString('pt-BR')}`, 18, cursorY + 7);
    doc.text(`Compras/Insumos: R$ ${comprasInsumosAnual.toLocaleString('pt-BR')}`, 18, cursorY + 14);
    doc.text(`Folha de Pagamento: R$ ${folhaPagamentoAnual.toLocaleString('pt-BR')} (Fator R: ${fatorR.toFixed(1)}%)`, 18, cursorY + 21);
    doc.text(`Atividade: ${tipoAtividade} | UF: ${uf}`, 120, cursorY + 14);
    doc.text(`Data do Estudo: ${new Date().toLocaleDateString('pt-BR')}`, 120, cursorY + 21);

    cursorY += 40;

    doc.setFillColor(236, 253, 245);
    doc.setDrawColor(167, 243, 208);
    doc.roundedRect(14, cursorY, pageWidth - 28, 20, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(6, 95, 70);
    doc.text(`RECOMENDAÇÃO TÉCNICA: ${regimesComparison.winner.nome.toUpperCase()}`, 18, cursorY + 8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Economia anual estimada em R$ ${regimesComparison.economiaAnual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em relação ao segundo regime.`, 18, cursorY + 15);

    cursorY += 28;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text('COMPARATIVO DETALHADO DE REGIMES TRIBUTÁRIOS', 14, cursorY);
    cursorY += 6;

    const tableRows = [
      ['Simples Nacional', calcSimplesNacional.elegivel ? 'Elegível' : 'Excedido (>4.8M)', `${calcSimplesNacional.aliqEfetiva.toFixed(2)}%`, `R$ ${calcSimplesNacional.impostoMensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, `R$ ${calcSimplesNacional.impostoAnual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
      ['Lucro Presumido', 'Disponível', `${calcLucroPresumido.aliqEfetivaTotal.toFixed(2)}%`, `R$ ${calcLucroPresumido.impostoMensalTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, `R$ ${calcLucroPresumido.impostoAnualTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
      ['Lucro Real', 'Disponível', `${calcLucroReal.aliqEfetivaTotal.toFixed(2)}%`, `R$ ${calcLucroReal.impostoMensalTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, `R$ ${calcLucroReal.impostoAnualTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
      ['Reforma Tributária (IBS+CBS)', 'Transição EC 132', `${calcReformaTributaria.aliqEfetivaTotal.toFixed(2)}%`, `R$ ${(calcReformaTributaria.impostoAnualTotal / 12).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, `R$ ${calcReformaTributaria.impostoAnualTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`]
    ];

    autoTable(doc, {
      startY: cursorY,
      head: [['Regime Tributário', 'Elegibilidade', 'Alíq. Efetiva', 'Custo Mensal (Média)', 'Custo Anual Total']],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 3 }
    });

    cursorY = (doc as any).lastAutoTable.finalY + 15;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    doc.text('Declaração de Planejamento Fiscal & Reestruturação', 14, cursorY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Elaborado para ${nomeEmpresa} — Módulo Simulador de Regime`, 14, cursorY + 5);

    doc.save(`Planejamento_Tributario_${cnpj.replace(/[^0-9]/g, '')}.pdf`);
  };

  return (
    <div className="max-w-7xl w-full mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8">
      
      {/* Top Banner */}
      <div className="bg-white rounded-lg p-6 sm:p-8 shadow-sm border border-slate-200">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider block">
              Simulador Fiscal & Planejamento Tributário
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Análise Tríplice de Regimes & Impacto da Reforma (EC 132/2023)
            </h1>
            <p className="text-slate-600 text-sm max-w-2xl">
              Módulo profissional de simulação fiscal com opção de preenchimento manual ou integração com arquivos SPED.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={exportPDFStudy}
              className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Exportar Estudo (PDF)</span>
            </button>
          </div>
        </div>

        {/* SPED Optional Toggle Card */}
        <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div className="flex items-center space-x-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${usarDadosSped ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700'}`}>
              <Database className="w-5 h-5" />
            </div>
            <div>
              <span className="text-sm font-bold text-slate-900 block">Considerar dados importados do SPED</span>
              <span className="text-xs text-slate-500">
                {spedData 
                  ? `SPED detectado: ${spedData.header?.nome || 'Empresa'} (${spedData.header?.cnpj || 'CNPJ não informado'})`
                  : 'Nenhum arquivo SPED importado na sessão atual. Preencha os dados manualmente abaixo.'}
              </span>
            </div>
          </div>

          {spedData ? (
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={usarDadosSped}
                onChange={(e) => handleToggleSped(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              <span className="ml-3 text-xs font-bold text-slate-700">{usarDadosSped ? 'Ativo (SPED)' : 'Desativado (Manual)'}</span>
            </label>
          ) : (
            <span className="text-xs bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg font-medium">
              Modo 100% Manual Ativo
            </span>
          )}
        </div>
      </div>

      {/* Input Parameters Form Section - 100% Reformulated & Professional */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between border-b border-slate-100 pb-4 gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-[#1e3a5f] text-white flex items-center justify-center font-bold shadow-sm">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Parâmetros Fiscais & Dados da Empresa</h2>
              <p className="text-xs text-slate-500">Configure os dados cadastrais, faturamento anual, estrutura de custos e alíquotas setoriais</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center space-x-1.5 mr-2">
              <span className="text-xs text-slate-500 font-semibold hidden sm:inline">Perfis Prontos:</span>
              <button onClick={handleCarregarPresetComercio} className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer">
                Comércio
              </button>
              <button onClick={handleCarregarPresetIndustria} className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer">
                Indústria
              </button>
              <button onClick={handleCarregarPresetServicos} className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer">
                Serviços (TI)
              </button>
            </div>

            <button
              onClick={handleAtualizarCalculo}
              className="px-4 py-2 bg-[#1e3a5f] hover:bg-[#142c47] text-white text-xs font-bold rounded-lg shadow-sm transition-all flex items-center space-x-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${showUpdatedNotification ? 'animate-spin' : ''}`} />
              <span>Recalcular Simulação</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation for Parameters */}
        <div className="flex border-b border-slate-200 space-x-6 overflow-x-auto">
          <button
            onClick={() => setActiveParamTab('CADASTRO')}
            className={`pb-3 text-xs font-bold transition-all border-b-2 flex items-center space-x-2 whitespace-nowrap cursor-pointer ${activeParamTab === 'CADASTRO' ? 'border-[#1e3a5f] text-[#1e3a5f]' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            <Building2 className="w-4 h-4" />
            <span>1. Dados Cadastrais & Enquadramento</span>
          </button>
          <button
            onClick={() => setActiveParamTab('FINANCEIRO')}
            className={`pb-3 text-xs font-bold transition-all border-b-2 flex items-center space-x-2 whitespace-nowrap cursor-pointer ${activeParamTab === 'FINANCEIRO' ? 'border-[#1e3a5f] text-[#1e3a5f]' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            <DollarSign className="w-4 h-4" />
            <span>2. Faturamento & Custos (DRE Anual)</span>
          </button>
          <button
            onClick={() => setActiveParamTab('ALIQUOTAS')}
            className={`pb-3 text-xs font-bold transition-all border-b-2 flex items-center space-x-2 whitespace-nowrap cursor-pointer ${activeParamTab === 'ALIQUOTAS' ? 'border-[#1e3a5f] text-[#1e3a5f]' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            <Percent className="w-4 h-4" />
            <span>3. Alíquotas & Reforma Tributária</span>
          </button>
        </div>

        {/* TAB 1: CADASTRO */}
        {activeParamTab === 'CADASTRO' && (
          <div className="space-y-6 pt-2 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-slate-700 block">Razão Social da Empresa</label>
                <input
                  type="text"
                  value={nomeEmpresa}
                  onChange={(e) => setNomeEmpresa(e.target.value)}
                  placeholder="Ex: Minha Empresa Comércio Ltda"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-[#1e3a5f] shadow-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-slate-700 block">CNPJ</label>
                <input
                  type="text"
                  value={cnpj}
                  onChange={(e) => setCnpj(e.target.value)}
                  placeholder="00.000.000/0001-00"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2.5 text-xs font-bold text-slate-900 font-mono focus:ring-2 focus:ring-[#1e3a5f] shadow-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-slate-700 block">Estado (UF)</label>
                <input
                  type="text"
                  maxLength={2}
                  value={uf}
                  onChange={(e) => setUf(e.target.value.toUpperCase())}
                  placeholder="SP"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2.5 text-xs font-bold text-slate-900 uppercase focus:ring-2 focus:ring-[#1e3a5f] shadow-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-slate-700 block">Regime Tributário Atual</label>
                <select
                  value={regimeAtual}
                  onChange={(e: any) => setRegimeAtual(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-[#1e3a5f] shadow-sm"
                >
                  <option value="SIMPLES">Simples Nacional</option>
                  <option value="PRESUMIDO">Lucro Presumido</option>
                  <option value="REAL">Lucro Real</option>
                  <option value="OUTROS">Outros / Isento</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-slate-700 block">Ramo de Atividade (Anexo Simples)</label>
                <select
                  value={tipoAtividade}
                  onChange={(e: any) => setTipoAtividade(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-[#1e3a5f] shadow-sm"
                >
                  <option value="COMERCIO">Comércio (Anexo I)</option>
                  <option value="INDUSTRIA">Indústria (Anexo II)</option>
                  <option value="SERVICOS_ANEXO3">Serviços Diretos (Anexo III)</option>
                  <option value="SERVICOS_ANEXO5">Serviços Intelectuais / TI (Anexo V / Fator R)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-slate-700 block">Regime na Reforma (EC 132/23)</label>
                <select
                  value={regimeEspecialReforma}
                  onChange={(e: any) => setRegimeEspecialReforma(e.target.value)}
                  className="w-full bg-amber-50 border border-amber-300 text-amber-900 rounded-lg px-3.5 py-2.5 text-xs font-bold shadow-sm"
                >
                  <option value="PADRAO">Alíquota Padrão Dual (~26,5%)</option>
                  <option value="REDUC_60">Redução 60% (Saúde/Educação)</option>
                  <option value="REDUC_30">Redução 30% (Regulamentadas)</option>
                  <option value="ISENTO">Isenção Total (Cesta Básica)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-3">
              <button
                onClick={() => setActiveParamTab('FINANCEIRO')}
                className="px-4 py-2 bg-[#1e3a5f] hover:bg-[#142c47] text-white text-xs font-bold rounded-lg transition-all flex items-center space-x-2 cursor-pointer shadow-sm"
              >
                <span>Avançar para Faturamento & Custos</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: FINANCEIRO */}
        {activeParamTab === 'FINANCEIRO' && (
          <div className="space-y-6 pt-2 animate-fade-in">
            {/* Frequency / Time Interval Selector */}
            <div className="bg-[#f1efe8] border border-[#e5e2d9] p-4 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-[#1e3a5f] uppercase block">Frequência e Intervalo de Entrada dos Valores</span>
                <p className="text-xs text-slate-600">Informe os valores mensais, trimestrais (ex: Jan-Mar / Q1) ou anuais. O sistema converte automaticamente para a base anual.</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="bg-white p-1 rounded-lg shadow-sm border border-[#e5e2d9] flex items-center space-x-1">
                  <button
                    onClick={() => setFrequenciaEntrada('ANUAL')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${frequenciaEntrada === 'ANUAL' ? 'bg-[#1e3a5f] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    Anual (12 Meses)
                  </button>
                  <button
                    onClick={() => setFrequenciaEntrada('MENSAL')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${frequenciaEntrada === 'MENSAL' ? 'bg-[#1e3a5f] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    Mensal (1 Mês)
                  </button>
                  <button
                    onClick={() => setFrequenciaEntrada('TRIMESTRAL')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${frequenciaEntrada === 'TRIMESTRAL' ? 'bg-[#1e3a5f] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    Trimestral
                  </button>
                  <button
                    onClick={() => setFrequenciaEntrada('CUSTOM')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${frequenciaEntrada === 'CUSTOM' ? 'bg-[#1e3a5f] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    Personalizado (Datas)
                  </button>
                </div>

                {frequenciaEntrada === 'TRIMESTRAL' && (
                  <select
                    value={trimestreIntervalo}
                    onChange={(e: any) => setTrimestreIntervalo(e.target.value)}
                    className="bg-white border border-[#e5e2d9] text-[#1e3a5f] text-xs font-bold rounded-lg px-3 py-1.5 shadow-sm"
                  >
                    <option value="Q1">Janeiro - Março (Q1)</option>
                    <option value="Q2">Abril - Junho (Q2)</option>
                    <option value="Q3">Julho - Setembro (Q3)</option>
                    <option value="Q4">Outubro - Dezembro (Q4)</option>
                  </select>
                )}

                {frequenciaEntrada === 'CUSTOM' && (
                  <div className="flex items-center space-x-2 bg-white border border-[#e5e2d9] rounded-lg px-3 py-1.5 shadow-sm">
                    <span className="text-[11px] font-bold text-[#1e3a5f]">De:</span>
                    <input
                      type="date"
                      value={dataInicio}
                      onChange={(e) => setDataInicio(e.target.value)}
                      className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold text-slate-900"
                    />
                    <span className="text-[11px] font-bold text-[#1e3a5f]">Até:</span>
                    <input
                      type="date"
                      value={dataFim}
                      onChange={(e) => setDataFim(e.target.value)}
                      className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold text-slate-900"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase text-slate-700">
                    {frequenciaEntrada === 'MENSAL' ? 'Faturamento Bruto Mensal' : frequenciaEntrada === 'TRIMESTRAL' ? `Faturamento (${trimestreIntervalo})` : 'Faturamento Bruto Anual'}
                  </label>
                  <FiscalTooltip title="Receita Bruta" description="Soma das vendas e serviços prestados no período informado." />
                </div>
                <div className="relative">
                  <DollarSign className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="number"
                    value={faturamentoInput === 0 ? '' : faturamentoInput}
                    onChange={(e) => setFaturamentoInput(e.target.value === '' ? 0 : Number(e.target.value))}
                    className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-900 focus:ring-2 focus:ring-[#1e3a5f] shadow-sm"
                  />
                </div>
                <span className="text-[11px] text-slate-500 font-mono block">
                  {frequenciaEntrada === 'ANUAL' ? `Média mensal: R$ ${(faturamentoAnual / 12).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}` : `Total Anual Base (x${multiplicadorBase}): R$ ${faturamentoAnual.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}`}
                </span>
              </div>

              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase text-slate-700">
                    {frequenciaEntrada === 'MENSAL' ? 'Compras / Insumos Mensais' : frequenciaEntrada === 'TRIMESTRAL' ? `Compras (${trimestreIntervalo})` : 'Compras / Insumos Anuais'}
                  </label>
                  <FiscalTooltip title="Custos de Aquisição (CMV/CPV)" description="Total gasto com mercadorias ou matéria-prima no período." />
                </div>
                <div className="relative">
                  <DollarSign className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="number"
                    value={comprasInsumosInput === 0 ? '' : comprasInsumosInput}
                    onChange={(e) => setComprasInsumosInput(e.target.value === '' ? 0 : Number(e.target.value))}
                    className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-900 focus:ring-2 focus:ring-[#1e3a5f] shadow-sm"
                  />
                </div>
                <span className="text-[11px] text-slate-500 font-mono block">
                  {frequenciaEntrada !== 'ANUAL' ? `Total Anual: R$ ${comprasInsumosAnual.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}` : ''} {(faturamentoAnual > 0 ? (comprasInsumosAnual / faturamentoAnual) * 100 : 0).toFixed(1)}% do faturamento
                </span>
              </div>

              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase text-slate-700">
                    {frequenciaEntrada === 'MENSAL' ? 'Folha de Pagamento Mensal' : frequenciaEntrada === 'TRIMESTRAL' ? `Folha (${trimestreIntervalo})` : 'Folha de Pagamento Anual'}
                  </label>
                  <FiscalTooltip title="Folha Salarial & Pró-Labore" description="Utilizada para cálculo do Fator R no Simples Nacional." />
                </div>
                <div className="relative">
                  <DollarSign className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="number"
                    value={folhaPagamentoInput === 0 ? '' : folhaPagamentoInput}
                    onChange={(e) => setFolhaPagamentoInput(e.target.value === '' ? 0 : Number(e.target.value))}
                    className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-900 focus:ring-2 focus:ring-[#1e3a5f] shadow-sm"
                  />
                </div>
                <span className={`text-[11px] font-mono block ${fatorR >= 28 ? 'text-emerald-700 font-bold' : 'text-amber-700'}`}>
                  Fator R: {fatorR.toFixed(1)}% ({fatorR >= 28 ? 'Anexo III' : 'Anexo V'}) {frequenciaEntrada !== 'ANUAL' ? `• Anual: R$ ${folhaPagamentoAnual.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}` : ''}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase text-slate-700">
                    {frequenciaEntrada === 'MENSAL' ? 'Despesas Operacionais Mensais' : frequenciaEntrada === 'TRIMESTRAL' ? `Despesas (${trimestreIntervalo})` : 'Despesas Operacionais Anuais'}
                  </label>
                  <FiscalTooltip title="Despesas Administrativas" description="Aluguel, energia, internet, softwares e serviços contábeis." />
                </div>
                <div className="relative">
                  <DollarSign className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="number"
                    value={despesasOperacionaisInput === 0 ? '' : despesasOperacionaisInput}
                    onChange={(e) => setDespesasOperacionaisInput(e.target.value === '' ? 0 : Number(e.target.value))}
                    className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-900 focus:ring-2 focus:ring-[#1e3a5f] shadow-sm"
                  />
                </div>
                <span className="text-[11px] text-slate-500 font-mono block">
                  {frequenciaEntrada !== 'ANUAL' ? `Total Anual: R$ ${despesasOperacionaisAnual.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}` : ''} {(faturamentoAnual > 0 ? (despesasOperacionaisAnual / faturamentoAnual) * 100 : 0).toFixed(1)}% do faturamento
                </span>
              </div>

              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase text-slate-700">Margem de Lucro Estimada (%)</label>
                  <FiscalTooltip title="Margem de Lucro Presumido/Real" description="Utilizada para estimativa de base de cálculo em regimes apurados por lucro." />
                </div>
                <div className="relative">
                  <Percent className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="number"
                    value={margemLucroEstimada === 0 ? '' : margemLucroEstimada}
                    onChange={(e) => setMargemLucroEstimada(e.target.value === '' ? 0 : Number(e.target.value))}
                    className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-900 focus:ring-2 focus:ring-[#1e3a5f] shadow-sm"
                  />
                </div>
                <span className="text-[11px] text-slate-500 font-mono block">
                  Lucro Estimado Base Anual: R$ {calcLucroReal.lucroRealEstimadoBase.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="flex justify-between pt-3">
              <button
                onClick={() => setActiveParamTab('CADASTRO')}
                className="px-4 py-2 bg-slate-200 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-300 transition-all cursor-pointer"
              >
                Voltar
              </button>
              <button
                onClick={() => setActiveParamTab('ALIQUOTAS')}
                className="px-4 py-2 bg-[#1e3a5f] hover:bg-[#142c47] text-white text-xs font-bold rounded-lg transition-all flex items-center space-x-2 cursor-pointer shadow-sm"
              >
                <span>Avançar para Alíquotas & Tributos</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: ALIQUOTAS */}
        {activeParamTab === 'ALIQUOTAS' && (
          <div className="space-y-6 pt-2 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-slate-700 block">Alíquota ICMS ({uf})</label>
                <div className="relative">
                  <Percent className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="number"
                    value={aliquotaIcmsInterna === 0 ? '' : aliquotaIcmsInterna}
                    onChange={(e) => setAliquotaIcmsInterna(e.target.value === '' ? 0 : Number(e.target.value))}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 shadow-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-slate-700 block">Crédito ICMS s/ Entradas (%)</label>
                <div className="relative">
                  <Percent className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="number"
                    value={creditoIcmsEntradas === 0 ? '' : creditoIcmsEntradas}
                    onChange={(e) => setCreditoIcmsEntradas(e.target.value === '' ? 0 : Number(e.target.value))}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 shadow-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-slate-700 block">Alíquota de ISS (%)</label>
                <div className="relative">
                  <Percent className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="number"
                    value={aliquotaIss === 0 ? '' : aliquotaIss}
                    onChange={(e) => setAliquotaIss(e.target.value === '' ? 0 : Number(e.target.value))}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 shadow-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-slate-700 block">Alíquota IVA Padrão (IBS+CBS)</label>
                <div className="relative">
                  <Percent className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="number"
                    step="0.1"
                    value={aliquotaIvaDualStandard === 0 ? '' : aliquotaIvaDualStandard}
                    onChange={(e) => setAliquotaIvaDualStandard(e.target.value === '' ? 0 : Number(e.target.value))}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 shadow-sm"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-between pt-3">
              <button
                onClick={() => setActiveParamTab('FINANCEIRO')}
                className="px-4 py-2 bg-slate-200 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-300 transition-all cursor-pointer"
              >
                Voltar
              </button>
              <button
                onClick={handleAtualizarCalculo}
                className="px-6 py-2.5 bg-[#1e3a5f] hover:bg-[#142c47] text-white text-xs font-bold rounded-lg shadow-sm transition-all flex items-center space-x-2 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Aplicar Alíquotas & Atualizar Simulações</span>
              </button>
            </div>
          </div>
        )}

        {/* Success Notification Banner */}
        {showUpdatedNotification && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3.5 rounded-lg flex items-center space-x-3 transition-all animate-fade-in">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div className="text-xs">
              <strong className="font-bold block">Parâmetros aplicados — simulação recalculada</strong>
              <span>Todos os regimes (Simples, Presumido, Real e Reforma Tributária) foram atualizados.</span>
            </div>
          </div>
        )}
      </div>

      {/* Winner Recommendation Banner */}
      <div className="bg-white rounded-lg p-6 shadow-sm border border-emerald-200 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center font-bold shrink-0 shadow-sm">
              <Award className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 block">
                Regime Recomendado com Menor Custo Tributário ({nomeEmpresa})
              </span>
              <h2 className="text-xl font-extrabold text-slate-900">
                {regimesComparison.winner.nome.toUpperCase()}
              </h2>
            </div>
          </div>

          <div className="text-left sm:text-right bg-emerald-50/50 sm:bg-transparent p-3 sm:p-0 rounded-xl border sm:border-0 border-emerald-100">
            <span className="text-xs text-slate-500 font-semibold block">Economia Anual Estimada:</span>
            <span className="text-xl font-bold text-emerald-700 font-mono">
              R$ {regimesComparison.economiaAnual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <p className="text-xs text-slate-600 border-t border-slate-100 pt-3 leading-relaxed">
          Com base no faturamento de R$ {faturamentoAnual.toLocaleString('pt-BR')} e parâmetros informados, o regime <strong className="text-slate-900 font-bold">{regimesComparison.winner.nome}</strong> representa uma alíquota efetiva de <strong className="text-emerald-700 font-bold">{regimesComparison.winner.aliqEfetiva.toFixed(2)}%</strong> contra {regimesComparison.sorted[1]?.aliqEfetiva.toFixed(2)}% do segundo regime mais vantajoso.
        </p>
      </div>

      {/* Intelligent Automated Tax Analysis Card */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center space-x-3 border-b border-slate-100 pb-3">
          <div className="w-8 h-8 rounded-lg bg-[#f1efe8] flex items-center justify-center text-[#1e3a5f] font-bold">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Análise Automática Inteligente de Carga Tributária</h3>
            <span className="text-[11px] text-slate-500">Diagnóstico fiscal gerado com base nas regras da Receita Federal e EC 132/2023</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 space-y-1.5">
            <span className="font-bold text-slate-700 block flex items-center space-x-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Fator Decisivo (Vencedor)</span>
            </span>
            <p className="text-slate-600 leading-relaxed">
              {regimesComparison.winner.id === 'SIMPLES' && 'O faturamento anual enquadra a empresa nas faixas iniciais do Simples Nacional, dispensando a complexidade do Lucro Real e reduzindo a carga agregada via DAS único.'}
              {regimesComparison.winner.id === 'PRESUMIDO' && 'As margens de presunção legal aplicadas ao Lucro Presumido combinadas com PIS/COFINS cumulativo tornaram-se mais vantajosas que a progressividade do Simples ou as despesas do Real.'}
              {regimesComparison.winner.id === 'REAL' && 'O volume de despesas operacionais, folha de pagamentos e créditos de insumos informados reduziu expressivamente a base de cálculo do IRPJ/CSLL no Lucro Real.'}
              {regimesComparison.winner.id === 'REFORMA' && 'A transição para o IVA Dual (IBS + CBS) com aproveitamento pleno de créditos sobre insumos garante menor incidência cumulativa em comparação aos regimes vigentes.'}
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 space-y-1.5">
            <span className="font-bold text-slate-700 block flex items-center space-x-1.5">
              <Percent className="w-4 h-4 text-[#1e3a5f]" />
              <span>Amplitude de Economia</span>
            </span>
            <p className="text-slate-600 leading-relaxed">
              Optar pelo <strong className="text-slate-800">{regimesComparison.winner.nome}</strong> em vez de <strong className="text-slate-800">{regimesComparison.sorted[1]?.nome}</strong> gera uma retenção de caixa de <strong className="text-emerald-700 font-bold">R$ {regimesComparison.economiaAnual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} anuais</strong>, representando uma redução de {Math.abs(regimesComparison.winner.aliqEfetiva - (regimesComparison.sorted[1]?.aliqEfetiva || 0)).toFixed(2)} p.p. na alíquota efetiva.
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 space-y-1.5">
            <span className="font-bold text-slate-700 block flex items-center space-x-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Alerta de Conformidade & Prazo</span>
            </span>
            <p className="text-slate-600 leading-relaxed">
              {faturamentoAnual > 4500000 && faturamentoAnual <= 4800000 ? 'Atenção: O faturamento está próximo do sublimite do Simples Nacional (R$ 4.8M). Planeje a transição preventiva para evitar exclusão retroativa.' : 'Planejamento tributário apto para opção no início do próximo ano-calendário ou conforme regras de transição da Reforma Tributária.'}
            </p>
          </div>
        </div>
      </div>

      {/* DRE (Demonstração do Resultado do Exercício) Comparativa com Análise Vertical (%) */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between border-b border-slate-100 pb-4 gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-[#f1efe8] text-[#1e3a5f] flex items-center justify-center font-bold">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">DRE Simulada & Análise Vertical (% s/ Faturamento)</h2>
              <p className="text-xs text-slate-500">Demonstração de Resultado do Exercício comparativa detalhando impostos, IRPJ/CSLL e margens em R$ e %</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="bg-slate-100 p-1 rounded-lg flex items-center space-x-1">
              <button
                onClick={() => setPeriodoAnalise('ANUAL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${periodoAnalise === 'ANUAL' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Anual (12 Meses)
              </button>
              <button
                onClick={() => setPeriodoAnalise('TRIMESTRAL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${periodoAnalise === 'TRIMESTRAL' ? 'bg-[#1e3a5f] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Trimestral
              </button>
            </div>
            {periodoAnalise === 'TRIMESTRAL' && (
              <select
                value={trimestreSelecionado}
                onChange={(e: any) => setTrimestreSelecionado(e.target.value)}
                className="bg-[#f1efe8] border border-[#e5e2d9] text-[#1e3a5f] text-xs font-bold rounded-lg px-3 py-1.5 shadow-sm"
              >
                <option value="Q1">1º Trimestre (Q1)</option>
                <option value="Q2">2º Trimestre (Q2)</option>
                <option value="Q3">3º Trimestre (Q3)</option>
                <option value="Q4">4º Trimestre (Q4)</option>
              </select>
            )}
            <span className="text-xs bg-slate-100 text-slate-700 font-bold px-3 py-1.5 rounded-lg border border-slate-200">
              {periodoAnalise === 'ANUAL' ? 'Base Anual (R$ / %)' : `Base Trimestral - ${trimestreSelecionado} (R$ / %)`}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-[#1e3a5f] text-white">
                <th className="p-3.5 rounded-l-lg font-bold">Linha da DRE / Conta Fiscal</th>
                <th className="p-3.5 text-right font-bold">Simples Nacional (R$ / %)</th>
                <th className="p-3.5 text-right font-bold">Lucro Presumido (R$ / %)</th>
                <th className="p-3.5 rounded-r-lg text-right font-bold">Lucro Real (R$ / %)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              <tr className="bg-slate-50/50">
                <td className="p-3.5 font-bold text-slate-900">1. Receita Bruta (Faturamento)</td>
                <td className="p-3.5 text-right font-mono font-bold text-slate-900">
                  R$ {displayDreSimples.receitaBruta.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} <span className="text-[#1e3a5f] font-semibold">(100.0%)</span>
                </td>
                <td className="p-3.5 text-right font-mono font-bold text-slate-900">
                  R$ {displayDrePresumido.receitaBruta.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} <span className="text-[#1e3a5f] font-semibold">(100.0%)</span>
                </td>
                <td className="p-3.5 text-right font-mono font-bold text-slate-900">
                  R$ {displayDreReal.receitaBruta.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} <span className="text-[#1e3a5f] font-semibold">(100.0%)</span>
                </td>
              </tr>
              <tr>
                <td className="p-3.5 text-rose-600">(-) Deduções e Impostos sobre Vendas (DAS / ICMS / PIS / COFINS)</td>
                <td className="p-3.5 text-right font-mono text-rose-600">
                  - R$ {displayDreSimples.impostos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} <span className="font-semibold">({faturamentoAnual > 0 ? ((displayDreSimples.impostos / displayDreSimples.receitaBruta) * 100).toFixed(1) : 0}%)</span>
                </td>
                <td className="p-3.5 text-right font-mono text-rose-600">
                  - R$ {displayDrePresumido.impostos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} <span className="font-semibold">({faturamentoAnual > 0 ? ((displayDrePresumido.impostos / displayDrePresumido.receitaBruta) * 100).toFixed(1) : 0}%)</span>
                </td>
                <td className="p-3.5 text-right font-mono text-rose-600">
                  - R$ {displayDreReal.impostos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} <span className="font-semibold">({faturamentoAnual > 0 ? ((displayDreReal.impostos / displayDreReal.receitaBruta) * 100).toFixed(1) : 0}%)</span>
                </td>
              </tr>
              <tr className="bg-slate-50 font-bold">
                <td className="p-3.5 text-slate-900">(=) Receita Líquida</td>
                <td className="p-3.5 text-right font-mono text-slate-900">
                  R$ {displayDreSimples.receitaLiquida.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} <span className="text-slate-600">({faturamentoAnual > 0 ? ((displayDreSimples.receitaLiquida / displayDreSimples.receitaBruta) * 100).toFixed(1) : 0}%)</span>
                </td>
                <td className="p-3.5 text-right font-mono text-slate-900">
                  R$ {displayDrePresumido.receitaLiquida.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} <span className="text-slate-600">({faturamentoAnual > 0 ? ((displayDrePresumido.receitaLiquida / displayDrePresumido.receitaBruta) * 100).toFixed(1) : 0}%)</span>
                </td>
                <td className="p-3.5 text-right font-mono text-slate-900">
                  R$ {displayDreReal.receitaLiquida.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} <span className="text-slate-600">({faturamentoAnual > 0 ? ((displayDreReal.receitaLiquida / displayDreReal.receitaBruta) * 100).toFixed(1) : 0}%)</span>
                </td>
              </tr>
              <tr>
                <td className="p-3.5 text-slate-600">(-) Compras de Insumos / Custos (CMV / CPV)</td>
                <td className="p-3.5 text-right font-mono text-slate-600">
                  - R$ {displayDreSimples.cmv.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} <span className="font-semibold">({faturamentoAnual > 0 ? ((displayDreSimples.cmv / displayDreSimples.receitaBruta) * 100).toFixed(1) : 0}%)</span>
                </td>
                <td className="p-3.5 text-right font-mono text-slate-600">
                  - R$ {displayDrePresumido.cmv.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} <span className="font-semibold">({faturamentoAnual > 0 ? ((displayDrePresumido.cmv / displayDrePresumido.receitaBruta) * 100).toFixed(1) : 0}%)</span>
                </td>
                <td className="p-3.5 text-right font-mono text-slate-600">
                  - R$ {displayDreReal.cmv.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} <span className="font-semibold">({faturamentoAnual > 0 ? ((displayDreReal.cmv / displayDreReal.receitaBruta) * 100).toFixed(1) : 0}%)</span>
                </td>
              </tr>
              <tr className="bg-slate-50 font-bold">
                <td className="p-3.5 text-slate-900">(=) Lucro Bruto</td>
                <td className="p-3.5 text-right font-mono text-slate-900">
                  R$ {displayDreSimples.lucroBruto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} <span className="text-slate-600">({faturamentoAnual > 0 ? ((displayDreSimples.lucroBruto / displayDreSimples.receitaBruta) * 100).toFixed(1) : 0}%)</span>
                </td>
                <td className="p-3.5 text-right font-mono text-slate-900">
                  R$ {displayDrePresumido.lucroBruto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} <span className="text-slate-600">({faturamentoAnual > 0 ? ((displayDrePresumido.lucroBruto / displayDrePresumido.receitaBruta) * 100).toFixed(1) : 0}%)</span>
                </td>
                <td className="p-3.5 text-right font-mono text-slate-900">
                  R$ {displayDreReal.lucroBruto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} <span className="text-slate-600">({faturamentoAnual > 0 ? ((displayDreReal.lucroBruto / displayDreReal.receitaBruta) * 100).toFixed(1) : 0}%)</span>
                </td>
              </tr>
              <tr>
                <td className="p-3.5 text-slate-600">(-) Despesas Operacionais e Folha de Pagamento</td>
                <td className="p-3.5 text-right font-mono text-slate-600">
                  - R$ {displayDreSimples.despesasOp.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} <span className="font-semibold">({faturamentoAnual > 0 ? ((displayDreSimples.despesasOp / displayDreSimples.receitaBruta) * 100).toFixed(1) : 0}%)</span>
                </td>
                <td className="p-3.5 text-right font-mono text-slate-600">
                  - R$ {displayDrePresumido.despesasOp.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} <span className="font-semibold">({faturamentoAnual > 0 ? ((displayDrePresumido.despesasOp / displayDrePresumido.receitaBruta) * 100).toFixed(1) : 0}%)</span>
                </td>
                <td className="p-3.5 text-right font-mono text-slate-600">
                  - R$ {displayDreReal.despesasOp.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} <span className="font-semibold">({faturamentoAnual > 0 ? ((displayDreReal.despesasOp / displayDreReal.receitaBruta) * 100).toFixed(1) : 0}%)</span>
                </td>
              </tr>
              <tr className="bg-[#f1efe8] font-bold">
                <td className="p-3.5 text-[#1e3a5f]">(=) LAIR / Base de Cálculo (Lucro Antes IRPJ/CSLL)</td>
                <td className="p-3.5 text-right font-mono text-[#1e3a5f]">
                  R$ {displayDreSimples.lair.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} <span className="text-[#142c47]">({faturamentoAnual > 0 ? ((displayDreSimples.lair / displayDreSimples.receitaBruta) * 100).toFixed(1) : 0}%)</span>
                </td>
                <td className="p-3.5 text-right font-mono text-[#1e3a5f]">
                  R$ {displayDrePresumido.lair.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} <span className="text-[#142c47]">({faturamentoAnual > 0 ? ((displayDrePresumido.lair / displayDrePresumido.receitaBruta) * 100).toFixed(1) : 0}%)</span>
                </td>
                <td className="p-3.5 text-right font-mono text-[#1e3a5f]">
                  R$ {displayDreReal.lair.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} <span className="text-[#142c47]">({faturamentoAnual > 0 ? ((displayDreReal.lair / displayDreReal.receitaBruta) * 100).toFixed(1) : 0}%)</span>
                </td>
              </tr>
              <tr>
                <td className="p-3.5 text-rose-600">(-) Provisão para IRPJ e CSLL (Federais)</td>
                <td className="p-3.5 text-right font-mono text-emerald-600 font-bold">Incluso no DAS</td>
                <td className="p-3.5 text-right font-mono text-rose-600">
                  - R$ {displayDrePresumido.irpjCsll.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} <span className="font-semibold">({faturamentoAnual > 0 ? ((displayDrePresumido.irpjCsll / displayDrePresumido.receitaBruta) * 100).toFixed(1) : 0}%)</span>
                </td>
                <td className="p-3.5 text-right font-mono text-rose-600">
                  - R$ {displayDreReal.irpjCsll.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} <span className="font-semibold">({faturamentoAnual > 0 ? ((displayDreReal.irpjCsll / displayDreReal.receitaBruta) * 100).toFixed(1) : 0}%)</span>
                </td>
              </tr>
              <tr className="bg-emerald-50 font-black text-emerald-900 text-sm">
                <td className="p-3.5 rounded-l-lg">(=) Lucro Líquido Estimado do Exercício</td>
                <td className="p-3.5 text-right font-mono">
                  R$ {displayDreSimples.lucroLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} <span className="text-emerald-700">({faturamentoAnual > 0 ? ((displayDreSimples.lucroLiquido / displayDreSimples.receitaBruta) * 100).toFixed(1) : 0}%)</span>
                </td>
                <td className="p-3.5 text-right font-mono">
                  R$ {displayDrePresumido.lucroLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} <span className="text-emerald-700">({faturamentoAnual > 0 ? ((displayDrePresumido.lucroLiquido / displayDreSimples.receitaBruta) * 100).toFixed(1) : 0}%)</span>
                </td>
                <td className="p-3.5 rounded-r-lg text-right font-mono">
                  R$ {displayDreReal.lucroLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} <span className="text-emerald-700">({faturamentoAnual > 0 ? ((displayDreReal.lucroLiquido / displayDreSimples.receitaBruta) * 100).toFixed(1) : 0}%)</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Main Comparative Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* 1. SIMPLES NACIONAL */}
        <div className={`bg-white rounded-lg border p-5 space-y-4 relative overflow-hidden ${
          regimesComparison.winner.id === 'SIMPLES' ? 'ring-2 ring-emerald-500 border-emerald-300' : 'border-slate-200'
        }`}>
          {regimesComparison.winner.id === 'SIMPLES' && (
            <span className="absolute top-0 right-0 bg-emerald-600 text-white text-[10px] font-bold uppercase px-2.5 py-1 rounded-bl-lg">
              Mais Econômico
            </span>
          )}

          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <Building2 className="w-5 h-5 text-emerald-600" />
              <h3 className="font-bold text-slate-900 text-base">Simples Nacional</h3>
            </div>
            <span className="text-[11px] text-slate-500 block truncate">{calcSimplesNacional.anexo}</span>
          </div>

          <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-1">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Alíquota Efetiva</span>
            <span className="text-2xl font-black text-emerald-700 font-mono">
              {calcSimplesNacional.aliqEfetiva.toFixed(2)}%
            </span>
          </div>

          <div className="space-y-2 text-xs divide-y divide-slate-100">
            <div className="flex justify-between pt-1">
              <span className="text-slate-500">Imposto Mensal (DAS):</span>
              <span className="font-mono font-bold text-slate-800">
                R$ {calcSimplesNacional.impostoMensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between pt-2">
              <span className="text-slate-500">Imposto Anual Total:</span>
              <span className="font-mono font-bold text-slate-900">
                R$ {calcSimplesNacional.impostoAnual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between pt-2">
              <span className="text-slate-500">Elegibilidade:</span>
              <span className={`font-bold ${calcSimplesNacional.elegivel ? 'text-emerald-600' : 'text-rose-600'}`}>
                {calcSimplesNacional.elegivel ? 'Permitido (<=4.8M)' : 'Excedido'}
              </span>
            </div>
          </div>
        </div>

        {/* 2. LUCRO PRESUMIDO */}
        <div className={`bg-white rounded-lg border p-5 space-y-4 shadow-sm relative overflow-hidden ${
          regimesComparison.winner.id === 'PRESUMIDO' ? 'ring-2 ring-emerald-500 border-emerald-300' : 'border-slate-200'
        }`}>
          {regimesComparison.winner.id === 'PRESUMIDO' && (
            <span className="absolute top-0 right-0 bg-emerald-600 text-white text-[10px] font-extrabold uppercase px-3 py-1 rounded-bl-lg">
              Mais Econômico
            </span>
          )}

          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <Scale className="w-5 h-5 text-[#1e3a5f]" />
              <h3 className="font-bold text-slate-900 text-base">Lucro Presumido</h3>
            </div>
            <span className="text-[11px] text-slate-500 block">PIS/COFINS Cumulativo</span>
          </div>

          <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-1">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Alíquota Efetiva</span>
            <span className="text-2xl font-black text-[#1e3a5f] font-mono">
              {calcLucroPresumido.aliqEfetivaTotal.toFixed(2)}%
            </span>
          </div>

          <div className="space-y-2 text-xs divide-y divide-slate-100">
            <div className="flex justify-between pt-1">
              <span className="text-slate-500">IRPJ + CSLL Anual:</span>
              <span className="font-mono font-bold text-slate-800">
                R$ {(calcLucroPresumido.irpjAnual + calcLucroPresumido.csllAnual).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
              </span>
            </div>
            <div className="flex justify-between pt-2">
              <span className="text-slate-500">PIS/COFINS Anual:</span>
              <span className="font-mono font-bold text-slate-800">
                R$ {(calcLucroPresumido.pisAnual + calcLucroPresumido.cofinsAnual).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
              </span>
            </div>
            <div className="flex justify-between pt-2">
              <span className="text-slate-500">ICMS/ISS Líquido:</span>
              <span className="font-mono font-bold text-slate-800">
                R$ {(calcLucroPresumido.icmsAnual + calcLucroPresumido.issAnual).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
              </span>
            </div>
            <div className="flex justify-between pt-2">
              <span className="text-slate-500">Custo Anual Total:</span>
              <span className="font-mono font-bold text-slate-900">
                R$ {calcLucroPresumido.impostoAnualTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        {/* 3. LUCRO REAL */}
        <div className={`bg-white rounded-lg border p-5 space-y-4 shadow-sm relative overflow-hidden ${
          regimesComparison.winner.id === 'REAL' ? 'ring-2 ring-emerald-500 border-emerald-300' : 'border-slate-200'
        }`}>
          {regimesComparison.winner.id === 'REAL' && (
            <span className="absolute top-0 right-0 bg-emerald-600 text-white text-[10px] font-extrabold uppercase px-3 py-1 rounded-bl-lg">
              Mais Econômico
            </span>
          )}

          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-5 h-5 text-[#0f6e56]" />
              <h3 className="font-bold text-slate-900 text-base">Lucro Real</h3>
            </div>
            <span className="text-[11px] text-slate-500 block">Não Cumulativo com Crédito</span>
          </div>

          <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-1">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Alíquota Efetiva</span>
            <span className="text-2xl font-black text-[#0f6e56] font-mono">
              {calcLucroReal.aliqEfetivaTotal.toFixed(2)}%
            </span>
          </div>

          <div className="space-y-2 text-xs divide-y divide-slate-100">
            <div className="flex justify-between pt-1">
              <span className="text-slate-500">PIS/COFINS Líquido:</span>
              <span className="font-mono font-bold text-slate-800">
                R$ {(calcLucroReal.pisAnual + calcLucroReal.cofinsAnual).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
              </span>
            </div>
            <div className="flex justify-between pt-2">
              <span className="text-slate-500">IRPJ + CSLL Real:</span>
              <span className="font-mono font-bold text-slate-800">
                R$ {(calcLucroReal.irpjAnual + calcLucroReal.csllAnual).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
              </span>
            </div>
            <div className="flex justify-between pt-2">
              <span className="text-slate-500">ICMS Líquido:</span>
              <span className="font-mono font-bold text-slate-800">
                R$ {calcLucroReal.icmsAnual.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
              </span>
            </div>
            <div className="flex justify-between pt-2">
              <span className="text-slate-500">Custo Anual Total:</span>
              <span className="font-mono font-bold text-slate-900">
                R$ {calcLucroReal.impostoAnualTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        {/* 4. REFORMA TRIBUTÁRIA (EC 132/2023) */}
        <div className={`bg-white rounded-lg border p-5 space-y-4 shadow-sm relative overflow-hidden ${
          regimesComparison.winner.id === 'REFORMA' ? 'ring-2 ring-emerald-500 border-emerald-300' : 'border-amber-200 bg-amber-50/10'
        }`}>
          {regimesComparison.winner.id === 'REFORMA' && (
            <span className="absolute top-0 right-0 bg-emerald-600 text-white text-[10px] font-extrabold uppercase px-3 py-1 rounded-bl-lg">
              Mais Econômico
            </span>
          )}

          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <Zap className="w-5 h-5 text-amber-500" />
              <h3 className="font-bold text-slate-900 text-base">Reforma (EC 132/23)</h3>
            </div>
            <span className="text-[11px] text-amber-800 font-semibold block">IVA Dual (IBS + CBS)</span>
          </div>

          <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 space-y-1">
            <span className="text-[10px] font-bold uppercase text-amber-700 block">Alíquota Efetiva Projetada</span>
            <span className="text-2xl font-black text-amber-800 font-mono">
              {calcReformaTributaria.aliqEfetivaTotal.toFixed(2)}%
            </span>
          </div>

          <div className="space-y-2 text-xs divide-y divide-slate-100">
            <div className="flex justify-between pt-1">
              <span className="text-slate-500">IVA Dual Débito:</span>
              <span className="font-mono font-bold text-slate-800">
                R$ {calcReformaTributaria.ivaDebito.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
              </span>
            </div>
            <div className="flex justify-between pt-2">
              <span className="text-slate-500">Crédito Pleno Insumos:</span>
              <span className="font-mono font-bold text-emerald-600">
                - R$ {calcReformaTributaria.ivaCreditoInsumos.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
              </span>
            </div>
            <div className="flex justify-between pt-2">
              <span className="text-slate-500">IVA Líquido Anual:</span>
              <span className="font-mono font-bold text-slate-800">
                R$ {calcReformaTributaria.ivaLiquidoAnual.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
              </span>
            </div>
            <div className="flex justify-between pt-2">
              <span className="text-slate-500">Custo Anual Projetado:</span>
              <span className="font-mono font-bold text-slate-900">
                R$ {calcReformaTributaria.impostoAnualTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* Visual Chart Comparison Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Chart 1: Carga Fiscal Anual (R$) */}
        <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center space-x-3">
              <PieIcon className="w-5 h-5 text-[#1e3a5f]" />
              <h2 className="text-base font-bold text-slate-900">Comparativo de Carga Fiscal Anual (R$)</h2>
            </div>
            <span className="text-xs text-slate-500">Simples vs Presumido vs Real</span>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} interval={0} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} tickFormatter={(v) => `R${(v / 1000).toFixed(0)}k`} />
                <RechartsTooltip
                  formatter={(value: any) => [`R$ ${Number(value).toLocaleString('pt-BR')}`, 'Custo Anual']}
                  contentStyle={{ backgroundColor: '#1e3a5f', borderRadius: '8px', color: '#fff', border: 'none', fontSize: '12px' }}
                />
                <Bar dataKey="Imposto Anual (R$)" fill="#1e3a5f" radius={[6, 6, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Alíquota Efetiva (%) */}
        <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center space-x-3">
              <Percent className="w-5 h-5 text-[#0f6e56]" />
              <h2 className="text-base font-bold text-slate-900">Comparativo de Alíquota Efetiva (%)</h2>
            </div>
            <span className="text-xs text-slate-500">Carga % sobre Faturamento</span>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} interval={0} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} tickFormatter={(v) => `${v}%`} />
                <RechartsTooltip
                  formatter={(value: any) => [`${Number(value).toFixed(2)}%`, 'Alíquota Efetiva']}
                  contentStyle={{ backgroundColor: '#1e3a5f', borderRadius: '8px', color: '#fff', border: 'none', fontSize: '12px' }}
                />
                <Bar dataKey="Alíquota Efetiva (%)" fill="#0f6e56" radius={[6, 6, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

    </div>
  );
}
