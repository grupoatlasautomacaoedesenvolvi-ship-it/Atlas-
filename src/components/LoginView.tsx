import React, { useState } from 'react';
import { useAuth } from '../lib/auth';
import { 
  ShieldCheck, 
  Lock, 
  Mail, 
  LogIn, 
  KeyRound, 
  FileCheck2, 
  SlidersHorizontal, 
  BarChart3, 
  Building2,
  Eye,
  EyeOff,
  CheckCircle2,
  LockKeyhole,
  ArrowRight,
  Server,
  Zap,
  Check,
  Layers,
  User,
  UserPlus
} from 'lucide-react';

export function LoginView() {
  const { signIn, resetPassword } = useAuth();
  
  const [mode, setMode] = useState<'login' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleEmailChange = (val: string) => {
    setEmail(val);
  };

  const applyAtlasDomain = () => {
    if (!email) {
      setEmail('usuario@atlas.com');
      return;
    }
    if (!email.includes('@')) {
      setEmail(`${email}@atlas.com`);
    } else {
      const parts = email.split('@');
      setEmail(`${parts[0]}@atlas.com`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    let finalEmail = email.trim();
    if (finalEmail && !finalEmail.includes('@')) {
      finalEmail = `${finalEmail}@atlas.com`;
      setEmail(finalEmail);
    }

    try {
      if (mode === 'forgot') {
        await resetPassword(finalEmail);
        setMessage('E-mail de redefinição enviado com sucesso. Verifique sua caixa de entrada.');
      } else {
        await signIn(finalEmail, password);
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      let errMsg = err.message || 'Ocorreu um erro na autenticação. Tente novamente.';
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        errMsg = 'E-mail ou senha incorretos.';
      } else if (err.code === 'auth/email-already-in-use') {
        errMsg = 'Este e-mail já está cadastrado no sistema. Faça login.';
      } else if (err.code === 'auth/weak-password') {
        errMsg = 'A senha deve conter pelo menos 6 caracteres.';
      }
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#f8fafc] flex flex-col lg:flex-row font-sans text-slate-800 selection:bg-[#1e3a5f] selection:text-white">
      {/* Left Column: Official Brand & High Impact Product Showcase */}
      <div className="lg:w-7/12 p-8 lg:p-16 xl:p-20 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-200 bg-white relative">
        <div className="max-w-2xl">
          {/* Prominent Logo Header */}
          <div className="mb-10 flex items-center justify-between">
            <img 
              src="/logo.svg" 
              alt="Atlas Auditor Fiscal" 
              className="h-24 lg:h-28 w-auto object-contain max-w-full"
            />
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold bg-[#1e3a5f]/5 text-[#1e3a5f] border border-[#1e3a5f]/20 shadow-xs">
              <ShieldCheck className="w-4 h-4 text-[#1e3a5f]" />
              Plataforma Homologada
            </span>
          </div>

          {/* Product Headline & Positioning */}
          <div className="space-y-4 mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-slate-100 border border-slate-200/80 text-xs font-bold text-[#1e3a5f] uppercase tracking-wider">
              <Layers className="w-3.5 h-3.5 text-[#1e3a5f]" />
              Auditoria EFD ICMS/IPI & NF-e
            </div>
            <h1 className="text-3xl lg:text-4xl font-extrabold text-[#1e3a5f] tracking-tight leading-snug">
              Conformidade fiscal e auditoria SPED com máxima segurança e precisão.
            </h1>
            <p className="text-slate-600 text-sm lg:text-base leading-relaxed">
              O <strong className="text-[#1e3a5f] font-semibold">Atlas Auditor Fiscal</strong> realiza o cruzamento automatizado dos seus arquivos SPED com documentos fiscais eletrônicos e regras estaduais, identificando divergências com rapidez e garantindo total conformidade antes do envio à Receita Federal.
            </p>
          </div>

          {/* Product Operational Highlights Panel */}
          <div className="mb-10 p-5 rounded-lg bg-slate-50 border border-slate-200/80 shadow-xs">
            <p className="text-xs font-bold text-[#1e3a5f] uppercase tracking-wider mb-3">
              Módulos e Recursos em Destaque
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="flex items-center gap-2 text-slate-700">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Conciliação SPED x XML de NF-e/NFC-e</span>
              </div>
              <div className="flex items-center gap-2 text-slate-700">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Conferência de NCM, CEST e MVA por UF</span>
              </div>
              <div className="flex items-center gap-2 text-slate-700">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Mapeamento de Notas Omissas e Não Escrituradas</span>
              </div>
              <div className="flex items-center gap-2 text-slate-700">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Exportação Direta de SPED Retificado em TXT</span>
              </div>
            </div>
          </div>

          {/* Feature Details */}
          <div className="space-y-4 mb-10">
            <div className="flex items-start gap-3.5 pb-3.5 border-b border-slate-100">
              <div className="p-2 rounded-lg bg-[#1e3a5f]/10 text-[#1e3a5f] shrink-0 mt-0.5">
                <FileCheck2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-[#1e3a5f] uppercase tracking-wider">Cruzamento Automatizado</h3>
                <p className="text-xs text-slate-500 leading-relaxed mt-0.5">
                  Análise detalhada de consistência entre livros fiscais e chaves de acesso de documentos emitidos e recebidos.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 pb-3.5 border-b border-slate-100">
              <div className="p-2 rounded-lg bg-[#1e3a5f]/10 text-[#1e3a5f] shrink-0 mt-0.5">
                <SlidersHorizontal className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-[#1e3a5f] uppercase tracking-wider">Regras Tributárias Estaduais</h3>
                <p className="text-xs text-slate-500 leading-relaxed mt-0.5">
                  Validação automatizada de alíquotas internas de ICMS, substituição tributária e benefícios fiscais vigentes.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="p-2 rounded-lg bg-[#1e3a5f]/10 text-[#1e3a5f] shrink-0 mt-0.5">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-[#1e3a5f] uppercase tracking-wider">Relatórios e Edição em Lote</h3>
                <p className="text-xs text-slate-500 leading-relaxed mt-0.5">
                  Painel intuitivo com apontamento de erros por severidade e recursos de retificação ágil de registros.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="pt-6 border-t border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-500 gap-4">
          <p>© {new Date().getFullYear()} Grupo Atlas Automação e Desenvolvimento. Todos os direitos reservados.</p>
          <div className="flex items-center gap-5">
            <span className="flex items-center gap-1.5 text-slate-700 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Compatível com PVA RFB
            </span>
            <span className="flex items-center gap-1.5 text-slate-700 font-semibold">
              <Building2 className="w-3.5 h-3.5 text-[#1e3a5f]" /> Multi-Escritório
            </span>
          </div>
        </div>
      </div>

      {/* Right Column: Integrated Form */}
      <div className="lg:w-5/12 p-8 lg:p-16 xl:p-20 flex flex-col justify-between bg-[#f8fafc]">
        <div className="w-full max-w-sm mx-auto space-y-8 my-auto">
          {/* Header */}
          <div>
            <div className="flex items-center space-x-2 border-b border-slate-200 pb-3 mb-6">
              <button
                type="button"
                onClick={() => { setMode('login'); setError(''); setMessage(''); }}
                className={`text-xs font-bold pb-3 -mb-3 transition-colors text-[#1e3a5f] border-b-2 border-[#1e3a5f]`}
              >
                Acessar Conta
              </button>
            </div>

            <h2 className="text-xl font-bold text-[#1e3a5f] tracking-tight">
              {mode === 'forgot'
                ? 'Recuperação de Senha'
                : 'Autenticação de Usuário'}
            </h2>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              {mode === 'forgot'
                ? 'Informe seu e-mail corporativo para receber as instruções de redefinição.'
                : 'Insira suas credenciais corporativas para acessar o painel de auditoria.'}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-slate-700">
                  E-mail Corporativo
                </label>
                <button
                  type="button"
                  onClick={applyAtlasDomain}
                  className="text-[11px] text-[#3d5876] hover:text-[#1e3a5f] transition font-medium underline"
                >
                  Usar @atlas.com
                </button>
              </div>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  placeholder="usuario@atlas.com"
                  className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:border-[#1e3a5f] focus:ring-2 focus:ring-[#1e3a5f]/15 outline-none transition duration-150 shadow-sm"
                />
              </div>
            </div>

            {mode !== 'forgot' && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-slate-700">Senha</label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => { setMode('forgot'); setError(''); setMessage(''); }}
                      className="text-[11px] text-[#3d5876] hover:text-[#1e3a5f] transition font-semibold"
                    >
                      Esqueceu a senha?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-3 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:border-[#1e3a5f] focus:ring-2 focus:ring-[#1e3a5f]/15 outline-none transition duration-150 shadow-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 transition"
                    aria-label={showPassword ? "Ocultar senha" : "Exibir senha"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium">
                {error}
              </div>
            )}

            {message && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-medium">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#1e3a5f] hover:bg-[#162b47] active:bg-[#0f2137] text-white font-semibold py-3 rounded-xl text-xs transition duration-200 flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 mt-2"
            >
              {loading ? (
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
              ) : mode === 'forgot' ? (
                <>
                  <KeyRound className="w-4 h-4" />
                  Enviar Instruções
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  Entrar no Sistema
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </>
              )}
            </button>

            {mode === 'forgot' && (
              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => { setMode('login'); setError(''); setMessage(''); }}
                  className="text-xs text-slate-500 hover:text-[#1e3a5f] transition underline font-medium"
                >
                  Voltar para a tela de login
                </button>
              </div>
            )}
          </form>

          <div className="pt-6 border-t border-slate-200 text-center space-y-2">
            <p className="text-[11px] text-slate-500">
              Autenticação corporativa com criptografia TLS 1.3 e controle de acessos por perfil.
            </p>
            <div className="flex items-center justify-center gap-2 text-[10px] text-slate-400 font-mono">
              <Server className="w-3 h-3 text-slate-400" />
              <span>Servidores Ativos • EFD Schema RFB v2.4</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
