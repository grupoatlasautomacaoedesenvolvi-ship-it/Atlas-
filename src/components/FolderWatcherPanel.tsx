import React, { useState, useEffect, useRef } from 'react';
import { FolderSearch, FolderCheck, Play, Pause, RefreshCw, AlertCircle, CheckCircle2, FileText, HardDrive } from 'lucide-react';
import { Cliente, XmlRecord } from '../types';
import { saveArquivoCliente, saveCliente, ensureStandardFiscalFolders } from '../lib/clientService';
import { parseSpedContent, parseXmlFiles } from '../lib/clientParser';

interface FolderWatcherPanelProps {
  clientes: Cliente[];
  activeClienteId: string | null;
  addNotification?: (title: string, message: string, type: 'system' | 'import' | 'audit' | 'export') => void;
  escritorioId?: string;
}

export function FolderWatcherPanel({ clientes, activeClienteId, addNotification, escritorioId }: FolderWatcherPanelProps) {
  const [isSupported, setIsSupported] = useState(true);
  const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [folderName, setFolderName] = useState<string>('');
  const [isWatching, setIsWatching] = useState<boolean>(false);
  const [processedFileNames, setProcessedFileNames] = useState<Set<string>>(new Set());
  const [lastCheckTime, setLastCheckTime] = useState<Date | null>(null);
  const [selectedClienteId, setSelectedClienteId] = useState<string>(activeClienteId || '');
  const [filesFoundCount, setFilesFoundCount] = useState<number>(0);

  const watchIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Check if File System Access API is available in browser
    if (typeof window !== 'undefined' && !('showDirectoryPicker' in window)) {
      setIsSupported(false);
    }
  }, []);

  useEffect(() => {
    if (activeClienteId && !selectedClienteId) {
      setSelectedClienteId(activeClienteId);
    }
  }, [activeClienteId]);

  // Clean interval on unmount
  useEffect(() => {
    return () => {
      if (watchIntervalRef.current) {
        clearInterval(watchIntervalRef.current);
      }
    };
  }, []);

  const handleSelectDirectory = async () => {
    try {
      if (!('showDirectoryPicker' in window)) {
        alert('A File System Access API não é suportada por este navegador. Recomendamos o uso do Google Chrome ou Microsoft Edge.');
        return;
      }

      const handle = await (window as any).showDirectoryPicker({
        mode: 'read'
      });

      setDirHandle(handle);
      setFolderName(handle.name);
      setIsWatching(true);
      
      if (addNotification) {
        addNotification(
          'Monitor de Pasta Conectado',
          `Diretório "${handle.name}" selecionado para monitoramento em tempo real pelo Robô Fiscal.`,
          'system'
        );
      }

      // Initial scan
      scanDirectory(handle, true);

      // Start watcher interval every 5 seconds
      if (watchIntervalRef.current) clearInterval(watchIntervalRef.current);
      watchIntervalRef.current = setInterval(() => {
        scanDirectory(handle, false);
      }, 5000);

    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Erro ao selecionar pasta:', err);
        alert('Não foi possível acessar a pasta selecionada.');
      }
    }
  };

  const toggleWatching = () => {
    if (isWatching) {
      setIsWatching(false);
      if (watchIntervalRef.current) clearInterval(watchIntervalRef.current);
    } else if (dirHandle) {
      setIsWatching(true);
      scanDirectory(dirHandle, false);
      watchIntervalRef.current = setInterval(() => {
        scanDirectory(dirHandle, false);
      }, 5000);
    }
  };

  const scanDirectory = async (handle: FileSystemDirectoryHandle, isInitial: boolean) => {
    if (!handle) return;
    setLastCheckTime(new Date());

    try {
      let count = 0;
      const currentProcessed = new Set(processedFileNames);

      for await (const entry of (handle as any).values()) {
        if (entry.kind === 'file') {
          count++;
          const fileName = entry.name;
          const ext = fileName.split('.').pop()?.toLowerCase();

          if (['txt', 'xml', 'zip'].includes(ext || '')) {
            const fileKey = `${fileName}_${entry.name}`;

            if (!currentProcessed.has(fileKey)) {
              currentProcessed.add(fileKey);
              setProcessedFileNames(new Set(currentProcessed));

              // Read file content and process
              const fileData = await entry.getFile();
              await processNewFileFromFolder(fileData, fileName);
            }
          }
        }
      }

      setFilesFoundCount(count);
    } catch (err) {
      console.error('Erro durante a varredura do diretório:', err);
    }
  };

  const effectiveEscritorioId = (escritorioId && escritorioId.trim().length > 0)
    ? escritorioId.trim()
    : (typeof localStorage !== 'undefined' ? localStorage.getItem('atlas_active_escritorio_id') || 'padrao' : 'padrao');

  const processNewFileFromFolder = async (file: File, fileName: string) => {
    try {
      let parsedSped = null;
      let parsedXmls: XmlRecord[] = [];

      if (fileName.toLowerCase().endsWith('.txt')) {
        const text = await file.text();
        parsedSped = await parseSpedContent(text);
      } else if (fileName.toLowerCase().endsWith('.xml') || fileName.toLowerCase().endsWith('.zip')) {
        parsedXmls = await parseXmlFiles([file]);
      }

      // Identifica o cliente pelo CNPJ do próprio arquivo (cabeçalho do SPED ou emitente/destinatário do XML)
      const cnpjArquivo = (parsedSped?.header?.cnpj || parsedXmls[0]?.emitCnpj || parsedXmls[0]?.destCnpj || '').replace(/\D/g, '');
      let clienteObj = cnpjArquivo
        ? clientes.find(c => (c.cnpj || '').replace(/\D/g, '') === cnpjArquivo) || null
        : null;

      let clienteEhNovo = false;
      if (!clienteObj && cnpjArquivo) {
        // Cliente novo: cadastra automaticamente a partir do SPED ou do XML importado
        const firstXml = parsedXmls[0];
        const nomeEmpresa = parsedSped?.header?.nome || (firstXml ? (firstXml.emitNome || firstXml.destNome) : '') || `Empresa ${cnpjArquivo}`;
        const ufEmpresa = parsedSped?.header?.uf || 'SP';

        console.log('[Robô Fiscal] Empresa não encontrada para o CNPJ:', cnpjArquivo, '— Cadastrando automaticamente:', {
          nome: nomeEmpresa,
          cnpj: cnpjArquivo,
          uf: ufEmpresa,
          escritorioId: effectiveEscritorioId
        });

        try {
          clienteObj = await saveCliente({
            nome: nomeEmpresa,
            cnpj: cnpjArquivo,
            uf: ufEmpresa,
            regimeTributario: 'Lucro Real'
          }, effectiveEscritorioId);
          clienteEhNovo = true;
          console.log('[Robô Fiscal] Nova empresa cadastrada com sucesso pelo Robô Fiscal:', clienteObj);
        } catch (saveErr) {
          console.error('[Robô Fiscal] Erro crítico ao cadastrar empresa automaticamente via saveCliente:', saveErr);
        }
      }

      if (!clienteObj) {
        clienteObj = clientes.find(c => c.id === selectedClienteId) || clientes[0] || null;
      }

      if (!clienteObj) {
        console.warn('[Robô Fiscal] Nenhum cliente cadastrado ou selecionado para associar o arquivo importado — pulando.');
        return;
      }
      const clienteIdToUse = clienteObj.id;

      // Garante a estrutura de pastas do exercício vigente. Não faz nada se já existir.
      const anoArquivo = parsedSped?.header?.dtIni
        ? parsedSped.header.dtIni.substring(4)
        : String(new Date().getFullYear());
      await ensureStandardFiscalFolders(clienteIdToUse, [anoArquivo], effectiveEscritorioId);

      if (clienteEhNovo && addNotification) {
        addNotification(
          'Novo Cliente Cadastrado pelo Robô',
          `Cliente "${clienteObj.nome}" (CNPJ ${cnpjArquivo}) foi identificado automaticamente pelo arquivo importado, cadastrado, e a estrutura de pastas do exercício ${anoArquivo} foi criada.`,
          'system'
        );
      }

      // Save to client folder
      const isTxt = fileName.toLowerCase().endsWith('.txt');
      const mesAnoFormat = parsedSped?.header?.dtIni
        ? `${parsedSped.header.dtIni.substring(2, 4)}/${parsedSped.header.dtIni.substring(4)}`
        : '01/2025';

      const saved = await saveArquivoCliente({
        clienteId: clienteIdToUse,
        nome: fileName,
        tipo: isTxt ? 'SPED' : 'XML_ZIP',
        periodo: mesAnoFormat,
        tamanhoBytes: file.size,
        dadosSped: parsedSped || undefined,
        xmlsTerceiros: parsedXmls
      }, effectiveEscritorioId);

      // Explicitly dispatch the real-time event for the Robô Fiscal engine
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('atlas_file_saved', { detail: saved }));
      }

      if (addNotification) {
        addNotification(
          'Robô Fiscal - Novo Arquivo Detectado',
          `Arquivo "${fileName}" capturado na pasta monitorada (${clienteObj.nome}) e enviado para auditoria automática. O resultado fica pendente de revisão do auditor.`,
          'import'
        );
      }
    } catch (err) {
      console.error('Erro ao processar arquivo da pasta:', err);
    }
  };

  return (
    <div className="atlas-card p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-b border-[var(--atlas-border)] pb-6">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-[#f1efe8] text-[var(--atlas-navy)] flex items-center justify-center border border-[#e5e2d9] shadow-inner">
            <FolderSearch className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-[var(--atlas-navy)] tracking-tight flex items-center gap-3" style={{ fontFamily: 'var(--font-display)' }}>
              <span>Monitoramento Local</span>
              <div className={`atlas-pill text-[10px] py-0.5 px-2 border-2 ${
                isWatching ? 'atlas-pill-accent border-emerald-200' : 'bg-[var(--atlas-surface-hover)] text-[var(--atlas-text-secondary)] border-[var(--atlas-border)]'
              }`}>
                {isWatching ? 'Varredura Ativa' : 'Pausado'}
              </div>
            </h3>
            <p className="text-[var(--atlas-text-secondary)] text-xs mt-1">
              Observa automaticamente um diretório e dispara o evento <code className="font-mono bg-[var(--atlas-surface-hover)] px-1 py-0.5 rounded text-[var(--atlas-text)]">atlas_file_saved</code>.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={handleSelectDirectory}
            className="atlas-btn atlas-btn-primary py-2.5 px-5 shadow-xs flex items-center space-x-2"
          >
            <FolderSearch className="w-4 h-4" />
            <span>{folderName ? 'Alterar Pasta' : 'Selecionar Pasta'}</span>
          </button>

          {dirHandle && (
            <button
              onClick={toggleWatching}
              className={`atlas-btn p-2.5 shadow-xs transition-all border-2 ${
                isWatching 
                  ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' 
                  : 'bg-emerald-50 text-[var(--atlas-accent)] border-emerald-200 hover:bg-emerald-100'
              }`}
              title={isWatching ? 'Pausar observador' : 'Iniciar observador'}
            >
              {isWatching ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {!isSupported && (
        <div className="atlas-alert-danger">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>Este navegador não possui suporte para a File System Access API. Recomendamos o Google Chrome.</span>
        </div>
      )}

      {/* Directory Status Card */}
      {dirHandle ? (
        <div className="bg-[var(--atlas-surface-hover)] border border-[var(--atlas-border)] rounded-2xl p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div>
              <span className="text-[10px] font-bold text-[var(--atlas-text-muted)] uppercase tracking-widest block mb-1.5">Pasta Conectada</span>
              <span className="font-bold text-[var(--atlas-navy)] flex items-center space-x-2">
                <HardDrive className="w-4 h-4 opacity-70" />
                <span className="font-mono text-sm">{folderName}</span>
              </span>
            </div>

            <div>
              <span className="text-[10px] font-bold text-[var(--atlas-text-muted)] uppercase tracking-widest block mb-1.5">Cliente Destino</span>
              <select
                value={selectedClienteId}
                onChange={e => setSelectedClienteId(e.target.value)}
                className="atlas-input w-full py-1.5 text-xs font-bold"
              >
                {clientes.map(c => (
                  <option key={c.id} value={c.id}>{c.nome} ({c.uf})</option>
                ))}
              </select>
            </div>

            <div>
              <span className="text-[10px] font-bold text-[var(--atlas-text-muted)] uppercase tracking-widest block mb-1.5">Última Varredura</span>
              <span className="font-bold text-[var(--atlas-text-secondary)] font-mono text-sm">
                {lastCheckTime ? lastCheckTime.toLocaleTimeString('pt-BR') : 'Aguardando...'}
              </span>
            </div>
          </div>

          <div className="pt-4 border-t border-[var(--atlas-border)] flex items-center justify-between text-xs text-[var(--atlas-text-secondary)]">
            <span className="flex items-center space-x-2 font-medium">
              <CheckCircle2 className="w-4 h-4 text-[var(--atlas-accent)]" />
              <span>{filesFoundCount} arquivos detectados • {processedFileNames.size} importados</span>
            </span>

            <span className="font-mono text-[var(--atlas-text-muted)] text-[10px] uppercase font-bold tracking-widest">
              Refresh a cada 5 seg
            </span>
          </div>
        </div>
      ) : (
        <div className="p-8 bg-[var(--atlas-surface-hover)]/40 border-2 border-dashed border-[var(--atlas-border)] rounded-2xl text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-[var(--atlas-surface)] border border-[var(--atlas-border)] flex items-center justify-center mx-auto text-[var(--atlas-text-muted)]">
            <HardDrive className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <p className="font-bold text-[var(--atlas-navy)]">Nenhum diretório conectado</p>
            <p className="text-xs text-[var(--atlas-text-secondary)] max-w-sm mx-auto">
              Conecte uma pasta local para que o sistema monitore novos arquivos e dispare a auditoria em tempo real.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
