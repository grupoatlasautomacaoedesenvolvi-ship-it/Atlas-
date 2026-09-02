import React, { useState, useEffect, useRef } from 'react';
import { FolderSearch, FolderCheck, Play, Pause, RefreshCw, AlertCircle, CheckCircle2, FileText, HardDrive } from 'lucide-react';
import { Cliente, XmlRecord } from '../types';
import { saveArquivoCliente } from '../lib/clientService';
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

  const effectiveEscritorioId = escritorioId || 'escritorio-default';

  const processNewFileFromFolder = async (file: File, fileName: string) => {
    try {
      const clienteObj = clientes.find(c => c.id === selectedClienteId) || clientes[0] || null;
      const clienteIdToUse = clienteObj?.id || 'cliente_default';

      let parsedSped = null;
      let parsedXmls: XmlRecord[] = [];

      if (fileName.toLowerCase().endsWith('.txt')) {
        const text = await file.text();
        parsedSped = await parseSpedContent(text);
      } else if (fileName.toLowerCase().endsWith('.xml') || fileName.toLowerCase().endsWith('.zip')) {
        parsedXmls = await parseXmlFiles([file]);
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
          `Arquivo "${fileName}" capturado na pasta monitorada e enviado para auditoria automática.`,
          'import'
        );
      }
    } catch (err) {
      console.error('Erro ao processar arquivo da pasta:', err);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-[var(--atlas-border)] p-4 shadow-2xs space-y-3 text-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center space-x-2.5">
          <div className="p-1.5 bg-[#1e3a5f]/10 text-[#1e3a5f] rounded-lg">
            <FolderSearch className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
              <span>Monitoramento de Pasta Local (File System API)</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                isWatching ? 'bg-emerald-100 text-[#0f6e56] border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'
              }`}>
                {isWatching ? 'Varredura Ativa' : 'Pausado'}
              </span>
            </h3>
            <p className="text-slate-500 text-xs mt-0.5">
              Observa automaticamente um diretório local do Windows/Linux e dispara o evento <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-[11px] text-slate-800">atlas_file_saved</code> para o Robô Fiscal.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={handleSelectDirectory}
            className="px-3 py-2 bg-[#1e3a5f] hover:bg-[#142c47] text-white rounded-lg font-semibold text-xs transition-colors flex items-center space-x-1.5"
          >
            <FolderSearch className="w-4 h-4" />
            <span>{folderName ? 'Alterar Pasta' : 'Selecionar Pasta de Importação'}</span>
          </button>

          {dirHandle && (
            <button
              onClick={toggleWatching}
              className={`p-2 rounded-lg border text-xs font-semibold shadow-2xs transition-colors ${
                isWatching 
                  ? 'bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100' 
                  : 'bg-emerald-50 text-[#0f6e56] border-emerald-300 hover:bg-emerald-100'
              }`}
              title={isWatching ? 'Pausar observador' : 'Iniciar observador'}
            >
              {isWatching ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {!isSupported && (
        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Este navegador não possui suporte para a File System Access API. Recomendamos o Google Chrome ou Microsoft Edge.</span>
        </div>
      )}

      {/* Directory Status Card */}
      {dirHandle ? (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-slate-500 text-[11px] block">Pasta Selecionada</span>
              <span className="font-bold text-slate-900 flex items-center space-x-1.5 mt-0.5">
                <HardDrive className="w-3.5 h-3.5 text-[#1e3a5f]" />
                <span className="font-mono text-xs">{folderName}</span>
              </span>
            </div>

            <div>
              <span className="text-slate-500 text-[11px] block">Empresa Destino</span>
              <select
                value={selectedClienteId}
                onChange={e => setSelectedClienteId(e.target.value)}
                className="mt-0.5 border border-slate-300 rounded px-2 py-1 text-xs bg-white text-slate-800 font-medium"
              >
                {clientes.map(c => (
                  <option key={c.id} value={c.id}>{c.nome} ({c.uf})</option>
                ))}
              </select>
            </div>

            <div>
              <span className="text-slate-500 text-[11px] block">Última Checagem</span>
              <span className="font-semibold text-slate-700 mt-0.5 block font-mono text-[11px]">
                {lastCheckTime ? lastCheckTime.toLocaleTimeString('pt-BR') : 'Aguardando...'}
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-[11px] text-slate-500">
            <span className="flex items-center space-x-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#0f6e56]" />
              <span>{filesFoundCount} arquivo(s) encontrado(s) no diretório • {processedFileNames.size} importado(s) pelo Robô</span>
            </span>

            <span className="font-mono text-slate-400">
              Varredura automática a cada 5 seg
            </span>
          </div>
        </div>
      ) : (
        <div className="p-4 bg-slate-50/60 border border-dashed border-slate-300 rounded-lg text-center text-slate-500 space-y-1">
          <p className="font-semibold text-slate-700 text-xs">Nenhum diretório local conectado</p>
          <p className="text-[11px]">Clique em "Selecionar Pasta de Importação" para que o sistema monitore novos arquivos salvos e dispare a auditoria em tempo real.</p>
        </div>
      )}
    </div>
  );
}
