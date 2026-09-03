import React, { useState } from 'react';
import { Layers, FileText, BarChart3, ListOrdered, Database, TrendingUp, Calculator, Search, Settings } from 'lucide-react';
import { SpedData, AuditConfig, XmlRecord, StateTaxRule, AppNotification, NotificationType, SpedDocument, RoboExecutionLog } from './types';
import { mapXmlCfopToEntryCfop, findMatchingXmlItem } from './lib/cfopUtils';
import { initPeriodicBackup } from './lib/syncBackupService';
import { Navbar } from './components/Navbar';
import { NotificationCenter } from './components/NotificationCenter';
import { UploadSection } from './components/UploadSection';
import { AuditConfigPanel } from './components/AuditConfigPanel';
import { StateTaxMatrixView } from './components/StateTaxMatrixView';
import { AdvancedAuditView } from './components/AdvancedAuditView';
import { XmlView } from './components/XmlView';
import { SpedRawView } from './components/SpedRawView';
import { AllItemsView } from './components/AllItemsView';
import { NotasOmissasView } from './components/NotasOmissasView';
import { ReportView } from './components/ReportView';
import { AdminPanelView } from './components/AdminPanelView';
import { UserManagementView } from './components/UserManagementView';
import { SettingsView } from './components/SettingsView';
import { SequenceGapView } from './components/SequenceGapView';
import { StockEngineeringView } from './components/StockEngineeringView';
import { DifalCalculatorView } from './components/DifalCalculatorView';
import { RegimeSimulatorView } from './components/RegimeSimulatorView';
import { NcmLookupView } from './components/NcmLookupView';
import { ClientesView } from './components/ClientesView';
import { RoboFiscalView } from './components/RoboFiscalView';
import { AprendizadoView } from './components/AprendizadoView';
import { RoboDashboardView } from './components/RoboDashboardView';
import { AiOrchestratorView } from './components/AiOrchestratorView';
import { HomeDashboardView } from './components/HomeDashboardView';
import { MinhasRotinasView } from './components/MinhasRotinasView';
import { verificarEProcessarArquivosSalvos, getRoboLogs } from './lib/roboFiscalService';
import { fetchClientes } from './lib/clientService';
import { Cliente } from './types';
import { convertXmlToSpedDocument } from './lib/missingNotesHelper';
import { LoginView } from './components/LoginView';
import { useAuth } from './lib/auth';
import { db, safeWrite } from './lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { exportSped } from './lib/spedExporter';
import { executarAuditoriaUnificada } from './lib/auditEngine';
import { fetchSpedXmlCloud, saveSpedXmlCloud } from './lib/spedXmlSyncService';

export default function App() {
  const { user, userData, loading } = useAuth();
  
  const trackEvent = async (tipo: string) => {
    if (userData && userData.papel !== 'super_admin' && userData.escritorioId) {
      await safeWrite(async () => {
        await addDoc(collection(db, 'eventosUso'), {
          tipo,
          escritorioId: userData.escritorioId,
          timestamp: serverTimestamp()
        });
      });
    }
  };

  React.useEffect(() => {
    if (userData) {
      if (userData.papel !== 'super_admin') {
        const hasLogged = sessionStorage.getItem('atlas_logged_in');
        if (!hasLogged) {
          trackEvent('login');
          sessionStorage.setItem('atlas_logged_in', 'true');
        }
      }
      if (userData.escritorioId) {
        initPeriodicBackup(userData.escritorioId, 5);

        // Fetch SPED and XMLs from cloud if local is empty
        fetchSpedXmlCloud(userData.escritorioId).then(cloudData => {
          if (cloudData) {
            if (cloudData.spedData && !spedData) {
              setSpedData(cloudData.spedData);
              localStorage.setItem('atlas_sped_data', JSON.stringify(cloudData.spedData));
            }
            if (cloudData.xmlTerceiros && cloudData.xmlTerceiros.length > 0 && xmlTerceiros.length === 0) {
              setXmlTerceiros(cloudData.xmlTerceiros);
              localStorage.setItem('atlas_xml_terceiros', JSON.stringify(cloudData.xmlTerceiros));
            }
            if (cloudData.xmlProprio && cloudData.xmlProprio.length > 0 && xmlProprio.length === 0) {
              setXmlProprio(cloudData.xmlProprio);
              localStorage.setItem('atlas_xml_proprio', JSON.stringify(cloudData.xmlProprio));
            }
            if (cloudData.xmlNfce && cloudData.xmlNfce.length > 0 && xmlNfce.length === 0) {
              setXmlNfce(cloudData.xmlNfce);
              localStorage.setItem('atlas_xml_nfce', JSON.stringify(cloudData.xmlNfce));
            }
          }
        }).catch(err => console.warn('Cloud sync fetch warning:', err));
      }
    }
  }, [userData]);

  const [activeTab, setActiveTab] = useState<string>('home');
  const [spedData, setSpedData] = useState<SpedData | null>(() => {
    const saved = localStorage.getItem('atlas_sped_data');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error loading saved sped data', e);
      }
    }
    return null;
  });
  
  const [xmlTerceiros, setXmlTerceiros] = useState<XmlRecord[]>(() => {
    const saved = localStorage.getItem('atlas_xml_terceiros');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error loading saved xml terceiros', e);
      }
    }
    return [];
  });
  const [xmlProprio, setXmlProprio] = useState<XmlRecord[]>(() => {
    const saved = localStorage.getItem('atlas_xml_proprio');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error loading saved xml proprio', e);
      }
    }
    return [];
  });
  const [xmlNfce, setXmlNfce] = useState<XmlRecord[]>(() => {
    const saved = localStorage.getItem('atlas_xml_nfce');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error loading saved xml nfce', e);
      }
    }
    return [];
  });

  const [c190AuditLogs, setC190AuditLogs] = useState<any[]>([]);

  // Auto-sync SPED & XML to Cloud Firestore on change (debounced)
  React.useEffect(() => {
    if (!userData?.escritorioId) return;
    if (!spedData && xmlTerceiros.length === 0 && xmlProprio.length === 0 && xmlNfce.length === 0) return;

    const timer = setTimeout(() => {
      saveSpedXmlCloud({
        spedData,
        xmlTerceiros,
        xmlProprio,
        xmlNfce
      }, userData.escritorioId).catch(err => console.warn('Cloud auto-sync save warning:', err));
    }, 2000);

    return () => clearTimeout(timer);
  }, [spedData, xmlTerceiros, xmlProprio, xmlNfce, userData?.escritorioId]);

  const [activeClienteId, setActiveClienteId] = useState<string | null>(() => {
    return localStorage.getItem('atlas_active_cliente_id');
  });

  React.useEffect(() => {
    if (activeClienteId) {
      localStorage.setItem('atlas_active_cliente_id', activeClienteId);
    } else {
      localStorage.removeItem('atlas_active_cliente_id');
    }
  }, [activeClienteId]);

  const handleLoadSavedAudit = (data: { sped: SpedData | null; xmlTerceiros: XmlRecord[]; xmlProprio: XmlRecord[]; xmlNfce: XmlRecord[] }) => {
    if (data.sped) {
      handleSetSpedData(data.sped);
    }
    if (data.xmlTerceiros) {
      handleSetXmlTerceiros(data.xmlTerceiros);
    }
    if (data.xmlProprio) {
      handleSetXmlProprio(data.xmlProprio);
    }
    if (data.xmlNfce) {
      handleSetXmlNfce(data.xmlNfce);
    }
    setActiveTab('advanced_audit');
  };

  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    try {
      const saved = localStorage.getItem('atlas_notifications');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Error loading notifications:', e);
    }
    return [
      {
        id: 'welcome-1',
        title: 'Bem-vindo ao Atlas Auditor Fiscal',
        message: 'A plataforma está pronta para receber arquivos SPED e fazer o confronto automático com os XMLs de notas fiscais.',
        timestamp: 'Hoje',
        read: false,
        type: 'system'
      }
    ];
  });

  React.useEffect(() => {
    try {
      localStorage.setItem('atlas_notifications', JSON.stringify(notifications));
    } catch (e) {
      console.error('Error saving notifications:', e);
    }
  }, [notifications]);

  const addNotification = (
    title: string, 
    message: string, 
    type: NotificationType, 
    actionUrl?: string
  ) => {
    const newNotif: AppNotification = {
      id: crypto.randomUUID(),
      title,
      message,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      read: false,
      type,
      actionUrl,
      author: userData?.nome || 'Sistema'
    };
    setNotifications(prev => [newNotif, ...prev]);
  };

  const handleMarkAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const handleMarkAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const handleClearAllNotifications = () => {
    setNotifications([]);
  };
  
  type EditHistoryEntry = {
    id: string;
    docId: string;
    itemNum: string;
    oldItem: any;
    newItem: any;
    timestamp: number;
  };
  const [editHistory, setEditHistory] = useState<EditHistoryEntry[]>([]);

  const handleSetSpedData = async (data: SpedData | null, skipNotification = false) => {
    setSpedData(data);
    if (data) {
      try {
        localStorage.setItem('atlas_sped_data', JSON.stringify(data));
        await trackEvent('sped_importado');
        if (!skipNotification) {
          addNotification(
            'Arquivo SPED Fiscal Importado',
            `O arquivo EFD ICMS/IPI da empresa ${data.header.nome} (${data.header.uf}) foi carregado com sucesso (${data.documents.length} notas fiscais).`,
            'import',
            'all_items'
          );
        }
        
        // Also persist to IndexedDB for the Notas Omissas module
        const dtIni = data.header.dtIni; // DDMMYYYY
        if (dtIni && dtIni.length === 8) {
          const id = `${dtIni.substring(4, 8)}-${dtIni.substring(2, 4)}`;
          const ano = parseInt(dtIni.substring(4, 8));
          const mes = parseInt(dtIni.substring(2, 4));
          const { db } = await import('./lib/db');
          const existente = await db.periodos.get(id);
          await db.periodos.put({
            id,
            ano,
            mes,
            temSped: true,
            spedData: data,
            xmlTerceiros: existente ? existente.xmlTerceiros : []
          });
        }
      } catch (e) {
        console.error('Error saving sped data', e);
      }
    } else {
      localStorage.removeItem('atlas_sped_data');
    }
  };

  const recalculateSpedHierarchy = (data: SpedData, modifiedDocIds: string[]): SpedData => {
    const newReconciliation = data.reconciliation ? [...data.reconciliation] : [];
    const newDocuments = [...data.documents];
    const modDocIdsSet = new Set(modifiedDocIds);

    // Single-pass global C190 Map keyed by `${docId}_${cstIcms}_${cfop}_${aliqIcms.toFixed(2)}`
    const c190Map = new Map<string, any>();

    // Single loop over all documents in newDocuments for maximum temporal efficiency
    newDocuments.forEach((doc, docIndex) => {
      const actualDocId = doc.id;
      const isModified = modDocIdsSet.has(actualDocId) || modDocIdsSet.has(doc.numDoc) || modifiedDocIds.length === 0;

      let totMerc = 0;
      let totBcIcms = 0;
      let totIcms = 0;

      const itemCstCfopSums = new Map<string, number>();
      const docItemC190Groups = new Map<string, any>();

      if (doc.items && doc.items.length > 0) {
        doc.items.forEach(item => {
          const cstIcms = (item.cstIcms || '000').toString().trim().padStart(3, '0');
          let cfop = (item.cfop || '1102').toString().trim().padStart(4, '0');

          // Sanitização de CFOP conforme o tipo de operação (indOper)
          if (doc.indOper === '1' && (cfop.startsWith('1') || cfop.startsWith('2') || cfop.startsWith('3'))) {
            const firstDigit = cfop.charAt(0);
            const rest = cfop.slice(1);
            cfop = (firstDigit === '1' ? '5' : firstDigit === '2' ? '6' : '7') + rest;
            item.cfop = cfop;
          } else if (doc.indOper === '0' && (cfop.startsWith('5') || cfop.startsWith('6') || cfop.startsWith('7'))) {
            const firstDigit = cfop.charAt(0);
            const rest = cfop.slice(1);
            cfop = (firstDigit === '5' ? '1' : firstDigit === '6' ? '2' : '3') + rest;
            item.cfop = cfop;
          }

          const aliqIcms = typeof item.aliqIcms === 'number' ? item.aliqIcms : (parseFloat(String(item.aliqIcms || 0).replace(',', '.')) || 0);
          const vlItem = typeof item.vlItem === 'number' ? item.vlItem : (parseFloat(String(item.vlItem || 0).replace(',', '.')) || 0);
          const vlBcIcms = typeof item.vlBcIcms === 'number' ? item.vlBcIcms : (parseFloat(String(item.vlBcIcms || 0).replace(',', '.')) || 0);
          const vlIcms = typeof item.vlIcms === 'number' ? item.vlIcms : (parseFloat(String(item.vlIcms || 0).replace(',', '.')) || 0);

          totMerc += vlItem;
          totBcIcms += vlBcIcms;
          totIcms += vlIcms;

          const sumKey = `${cstIcms}_${cfop}`;
          itemCstCfopSums.set(sumKey, (itemCstCfopSums.get(sumKey) || 0) + vlItem);

          const c190Key = `${actualDocId}_${cstIcms}_${cfop}_${aliqIcms.toFixed(2)}`;
          if (!docItemC190Groups.has(c190Key)) {
            docItemC190Groups.set(c190Key, {
              docId: actualDocId,
              cstIcms,
              cfop,
              aliqIcms,
              vlOpr: 0,
              vlBcIcms: 0,
              vlIcms: 0
            });
          }
          const c190 = docItemC190Groups.get(c190Key)!;
          c190.vlOpr = Math.round((c190.vlOpr + vlItem) * 100) / 100;
          c190.vlBcIcms = Math.round((c190.vlBcIcms + vlBcIcms) * 100) / 100;
          c190.vlIcms = Math.round((c190.vlIcms + vlIcms) * 100) / 100;
        });

        doc.vlDoc = totMerc > 0 ? Math.round(totMerc * 100) / 100 : doc.vlDoc;
        doc.vlBcIcms = Math.round(totBcIcms * 100) / 100;
        doc.vlIcms = Math.round(totIcms * 100) / 100;

        docItemC190Groups.forEach((val, k) => {
          c190Map.set(k, val);
        });
      } else {
        // Documento sem itens (C170): Se houver c190Raw existente para o doc, mantemos/deduplicamos no mapa
        const docRawC190s = data.c190Raw?.filter(c => c.docId === actualDocId || c.docId === doc.numDoc) || [];
        docRawC190s.forEach(c190 => {
          let cfop = (c190.cfop || '').toString().trim().padStart(4, '0');
          const cstIcms = (c190.cstIcms || '000').toString().trim().padStart(3, '0');
          const aliqIcms = typeof c190.aliqIcms === 'number' ? c190.aliqIcms : (parseFloat(String(c190.aliqIcms || 0)) || 0);
          const c190Key = `${actualDocId}_${cstIcms}_${cfop}_${aliqIcms.toFixed(2)}`;
          const vlOpr = typeof c190.vlOpr === 'number' ? c190.vlOpr : (parseFloat(String(c190.vlOpr || 0)) || 0);
          const vlBcIcms = typeof c190.vlBcIcms === 'number' ? c190.vlBcIcms : (parseFloat(String(c190.vlBcIcms || 0)) || 0);
          const vlIcms = typeof c190.vlIcms === 'number' ? c190.vlIcms : (parseFloat(String(c190.vlIcms || 0)) || 0);

          if (!c190Map.has(c190Key)) {
            c190Map.set(c190Key, { docId: actualDocId, cstIcms, cfop, aliqIcms, vlOpr: 0, vlBcIcms: 0, vlIcms: 0 });
          }
          const ex = c190Map.get(c190Key)!;
          ex.vlOpr = Math.round((ex.vlOpr + vlOpr) * 100) / 100;
          ex.vlBcIcms = Math.round((ex.vlBcIcms + vlBcIcms) * 100) / 100;
          ex.vlIcms = Math.round((ex.vlIcms + vlIcms) * 100) / 100;

          const sumKey = `${cstIcms}_${cfop}`;
          itemCstCfopSums.set(sumKey, (itemCstCfopSums.get(sumKey) || 0) + vlOpr);
        });
      }

      newDocuments[docIndex] = doc;

      // Reconciliation calculation for this document
      if (isModified) {
        const docC190s = Array.from(c190Map.values()).filter(c => c.docId === actualDocId);
        const c190CstCfopSums = new Map<string, number>();
        docC190s.forEach((c190: any) => {
          const cst = (c190.cstIcms || '000').toString().trim().padStart(3, '0');
          const cfop = (c190.cfop || '').toString().trim().padStart(4, '0');
          const k = `${cst}_${cfop}`;
          const vl = typeof c190.vlOpr === 'number' ? c190.vlOpr : (parseFloat(String(c190.vlOpr || 0)) || 0);
          c190CstCfopSums.set(k, (c190CstCfopSums.get(k) || 0) + vl);
        });

        const reconMap = new Map<string, any>();
        const allReconKeys = new Set([...itemCstCfopSums.keys(), ...c190CstCfopSums.keys()]);
        allReconKeys.forEach(k => {
          const somaItens = Math.round((itemCstCfopSums.get(k) || 0) * 100) / 100;
          const vlOprC190 = Math.round((c190CstCfopSums.get(k) || 0) * 100) / 100;
          const [cstIcms, cfop] = k.split('_');
          const diff = Math.round((somaItens - vlOprC190) * 100) / 100;
          const status = Math.abs(diff) <= 0.05 ? 'CONCILIADO' : (vlOprC190 === 0 ? 'C190_AUSENTE' : 'DIVERGENTE');

          reconMap.set(k, {
            docId: actualDocId,
            cstIcms: cstIcms || '000',
            cfop: cfop || '5102',
            somaItens,
            vlOprC190,
            status,
            diff
          });
        });

        const filteredRecon = newReconciliation.filter(r => r.docId !== actualDocId);
        newReconciliation.length = 0;
        newReconciliation.push(...filteredRecon, ...Array.from(reconMap.values()));
      }
    });

    const finalC190Raw = Array.from(c190Map.values());

    // Calculate Before Totals for C190
    const oldC190s = data.c190Raw || [];
    const beforeVlOpr = Math.round(oldC190s.reduce((acc, c) => acc + (c.vlOpr || 0), 0) * 100) / 100;
    const beforeVlBcIcms = Math.round(oldC190s.reduce((acc, c) => acc + (c.vlBcIcms || 0), 0) * 100) / 100;
    const beforeVlIcms = Math.round(oldC190s.reduce((acc, c) => acc + (c.vlIcms || 0), 0) * 100) / 100;

    const afterVlOpr = Math.round(finalC190Raw.reduce((acc, c) => acc + (c.vlOpr || 0), 0) * 100) / 100;
    const afterVlBcIcms = Math.round(finalC190Raw.reduce((acc, c) => acc + (c.vlBcIcms || 0), 0) * 100) / 100;
    const afterVlIcms = Math.round(finalC190Raw.reduce((acc, c) => acc + (c.vlIcms || 0), 0) * 100) / 100;

    const documentDeltas = modifiedDocIds.length > 0 ? modifiedDocIds.map(mId => {
      const doc = newDocuments.find(d => d.id === mId || d.numDoc === mId);
      const dId = doc ? doc.id : mId;
      const numDoc = doc ? doc.numDoc : mId;

      const oldDocC190s = oldC190s.filter(c => c.docId === dId || c.docId === numDoc);
      const bOpr = oldDocC190s.reduce((acc, c) => acc + (c.vlOpr || 0), 0);
      const bBc = oldDocC190s.reduce((acc, c) => acc + (c.vlBcIcms || 0), 0);
      const bIcms = oldDocC190s.reduce((acc, c) => acc + (c.vlIcms || 0), 0);

      const newDocC190s = finalC190Raw.filter(c => c.docId === dId || c.docId === numDoc);
      const aOpr = newDocC190s.reduce((acc, c) => acc + (c.vlOpr || 0), 0);
      const aBc = newDocC190s.reduce((acc, c) => acc + (c.vlBcIcms || 0), 0);
      const aIcms = newDocC190s.reduce((acc, c) => acc + (c.vlIcms || 0), 0);

      return {
        docId: dId,
        numDoc,
        before: { vlOpr: Math.round(bOpr * 100) / 100, vlBcIcms: Math.round(bBc * 100) / 100, vlIcms: Math.round(bIcms * 100) / 100 },
        after: { vlOpr: Math.round(aOpr * 100) / 100, vlBcIcms: Math.round(aBc * 100) / 100, vlIcms: Math.round(aIcms * 100) / 100 },
        delta: {
          vlOpr: Math.round((aOpr - bOpr) * 100) / 100,
          vlBcIcms: Math.round((aBc - bBc) * 100) / 100,
          vlIcms: Math.round((aIcms - bIcms) * 100) / 100
        }
      };
    }) : [{
      docId: 'GLOBAL_RECALC',
      numDoc: 'TODOS',
      before: { vlOpr: beforeVlOpr, vlBcIcms: beforeVlBcIcms, vlIcms: beforeVlIcms },
      after: { vlOpr: afterVlOpr, vlBcIcms: afterVlBcIcms, vlIcms: afterVlIcms },
      delta: {
        vlOpr: Math.round((afterVlOpr - beforeVlOpr) * 100) / 100,
        vlBcIcms: Math.round((afterVlBcIcms - beforeVlBcIcms) * 100) / 100,
        vlIcms: Math.round((afterVlIcms - beforeVlIcms) * 100) / 100
      }
    }];

    const auditReport = {
      timestamp: new Date().toISOString(),
      recalculatedDocIds: modifiedDocIds.length > 0 ? modifiedDocIds : ['GLOBAL'],
      before: { vlOpr: beforeVlOpr, vlBcIcms: beforeVlBcIcms, vlIcms: beforeVlIcms },
      after: { vlOpr: afterVlOpr, vlBcIcms: afterVlBcIcms, vlIcms: afterVlIcms },
      delta: {
        vlOpr: Math.round((afterVlOpr - beforeVlOpr) * 100) / 100,
        vlBcIcms: Math.round((afterVlBcIcms - beforeVlBcIcms) * 100) / 100,
        vlIcms: Math.round((afterVlIcms - beforeVlIcms) * 100) / 100
      },
      documentDeltas
    };

    console.group(`📋 [ATLAS AUDIT] Recálculo do Bloco C190 — ${new Date().toLocaleString()}`);
    console.log(`Documentos Recalculados IDs:`, modifiedDocIds.length > 0 ? modifiedDocIds : ['[Global / Sincronização Geral]']);
    console.table(documentDeltas);
    console.log(`Totais Bloco C190 ANTES:  Vl.Opr: R$ ${beforeVlOpr.toFixed(2)} | BC ICMS: R$ ${beforeVlBcIcms.toFixed(2)} | ICMS: R$ ${beforeVlIcms.toFixed(2)}`);
    console.log(`Totais Bloco C190 DEPOIS: Vl.Opr: R$ ${afterVlOpr.toFixed(2)} | BC ICMS: R$ ${afterVlBcIcms.toFixed(2)} | ICMS: R$ ${afterVlIcms.toFixed(2)}`);
    console.log(`DELTA / VARIAÇÃO TOTAL:   Vl.Opr: R$ ${(afterVlOpr - beforeVlOpr).toFixed(2)} | BC ICMS: R$ ${(afterVlBcIcms - beforeVlBcIcms).toFixed(2)} | ICMS: R$ ${(afterVlIcms - beforeVlIcms).toFixed(2)}`);
    console.groupEnd();

    setC190AuditLogs(prev => [auditReport, ...prev].slice(0, 20));

    // Recalculate Apuração ICMS (Bloco E / E110) based on all updated C190 records
    let newApuracao = data.apuracao ? { ...data.apuracao } : null;

    let totDeb = 0;
    let totCred = 0;

    finalC190Raw.forEach(c190 => {
      const cfop = (c190.cfop || '').toString().trim();
      const vlIcms = typeof c190.vlIcms === 'number' ? c190.vlIcms : (parseFloat(String(c190.vlIcms || 0).replace(',', '.')) || 0);
      if (cfop.startsWith('5') || cfop.startsWith('6') || cfop.startsWith('7')) {
        totDeb += vlIcms;
      } else if (cfop.startsWith('1') || cfop.startsWith('2') || cfop.startsWith('3')) {
        totCred += vlIcms;
      }
    });

    if (newApuracao || newDocuments.length > 0) {
      const vlTotDebitos = Math.round(totDeb * 100) / 100;
      const vlTotCreditos = Math.round(totCred * 100) / 100;
      const vlAjDebitos = newApuracao?.vlAjDebitos || 0;
      const vlTotAjDebitos = newApuracao?.vlTotAjDebitos || 0;
      const vlEstornosCred = newApuracao?.vlEstornosCred || 0;
      const vlAjCreditos = newApuracao?.vlAjCreditos || 0;
      const vlTotAjCreditos = newApuracao?.vlTotAjCreditos || 0;
      const vlEstornosDeb = newApuracao?.vlEstornosDeb || 0;
      const vlSldCredorAnt = newApuracao?.vlSldCredorAnt || 0;
      const vlTotDed = newApuracao?.vlTotDed || 0;
      const debEsp = newApuracao?.debEsp || 0;

      const totalDeb = vlTotDebitos + vlAjDebitos + vlTotAjDebitos + vlEstornosCred;
      const totalCred = vlTotCreditos + vlAjCreditos + vlTotAjCreditos + vlEstornosDeb + vlSldCredorAnt;

      let vlSldApurado = 0;
      let vlIcmsRecolher = 0;
      let vlSldCredorTransportar = 0;

      if (totalDeb >= totalCred) {
        vlSldApurado = Math.round((totalDeb - totalCred) * 100) / 100;
        vlIcmsRecolher = Math.max(0, Math.round((vlSldApurado - vlTotDed) * 100) / 100);
        vlSldCredorTransportar = 0;
      } else {
        vlSldApurado = 0;
        vlIcmsRecolher = 0;
        vlSldCredorTransportar = Math.round((totalCred - totalDeb) * 100) / 100;
      }

      newApuracao = {
        vlTotDebitos,
        vlAjDebitos,
        vlTotAjDebitos,
        vlEstornosCred,
        vlTotCreditos,
        vlAjCreditos,
        vlTotAjCreditos,
        vlEstornosDeb,
        vlSldCredorAnt,
        vlSldApurado,
        vlTotDed,
        vlIcmsRecolher,
        vlSldCredorTransportar,
        debEsp
      };
    }

    return {
      ...data,
      documents: newDocuments,
      c190Raw: finalC190Raw,
      reconciliation: newReconciliation,
      apuracao: newApuracao
    };
  };

  const undoChanges = () => {
    if (!spedData || editHistory.length === 0) return;
    
    let currentData = { ...spedData, documents: [...spedData.documents] };
    const modifiedDocIds = new Set<string>();

    [...editHistory].reverse().forEach(entry => {
      const docIndex = currentData.documents.findIndex(d => d.id === entry.docId);
      if (docIndex >= 0) {
        const doc = { ...currentData.documents[docIndex] };
        const items = [...doc.items];
        const itemIndex = items.findIndex(i => i.numItem === entry.itemNum);
        if (itemIndex >= 0) {
          items[itemIndex] = { ...items[itemIndex], ...entry.oldItem };
          doc.items = items;
          currentData.documents[docIndex] = doc;
          modifiedDocIds.add(doc.id);
        }
      }
    });

    currentData = recalculateSpedHierarchy(currentData, Array.from(modifiedDocIds));
    handleSetSpedData(currentData, true);
    setEditHistory([]);
    addNotification(
      'Alterações Revertidas',
      'A última sequência de modificações nos itens foi cancelada e os dados originais foram restaurados.',
      'edit',
      'all_items'
    );
  };

  const handleUpdateItem = (
    docId: string,
    itemNum: string,
    newCst: string,
    newCfop: string,
    newVlBcIcms: number,
    newAliqIcms: number,
    newVlIcms: number,
    newNcm?: string,
    newVlItem?: number,
    correctedByRobot?: boolean,
    robotCorrectionReason?: string,
    analystConfirmed?: boolean
  ) => {
    if (!spedData) return;
    let oldItem: any = null;
    const updatedDocuments = spedData.documents.map(doc => {
      if (doc.id !== docId) return doc;
      const updatedItems = doc.items.map(item => {
        if (item.numItem !== itemNum) return item;
        oldItem = { ...item };
        return {
          ...item,
          cstIcms: newCst,
          cfop: newCfop,
          vlBcIcms: newVlBcIcms,
          aliqIcms: newAliqIcms,
          vlIcms: newVlIcms,
          ncm: newNcm !== undefined ? newNcm : item.ncm,
          vlItem: newVlItem !== undefined ? newVlItem : item.vlItem,
          correctedByRobot: correctedByRobot !== undefined ? correctedByRobot : item.correctedByRobot,
          robotCorrectionReason: robotCorrectionReason !== undefined ? robotCorrectionReason : item.robotCorrectionReason,
          analystConfirmed: analystConfirmed !== undefined ? analystConfirmed : item.analystConfirmed,
          isModified: true
        };
      });
      return {
        ...doc,
        items: updatedItems
      };
    });
    if (oldItem) {
      addNotification(
        'Item de Nota Fiscal Atualizado',
        `O item #${itemNum} teve seus dados fiscais alterados (Valor: R$ ${newVlItem !== undefined ? newVlItem.toFixed(2) : oldItem.vlItem}).`,
        'edit',
        'all_items'
      );
      setEditHistory(prev => [...prev, {
        id: crypto.randomUUID(),
        docId,
        itemNum,
        oldItem,
        newItem: {
          ...oldItem,
          cstIcms: newCst,
          cfop: newCfop,
          vlBcIcms: newVlBcIcms,
          aliqIcms: newAliqIcms,
          vlIcms: newVlIcms,
          ncm: newNcm !== undefined ? newNcm : oldItem.ncm,
          vlItem: newVlItem !== undefined ? newVlItem : oldItem.vlItem
        },
        timestamp: Date.now()
      }]);
    }
    const newSpedData = recalculateSpedHierarchy({
      ...spedData,
      documents: updatedDocuments
    }, [docId]);
    handleSetSpedData(newSpedData);
  };

  const handleBulkUpdateItems = (
    targets: Array<{ docId: string; itemNum: string }>,
    updates: { cst?: string; cfop?: string; ncm?: string; vlBcIcms?: number; aliqIcms?: number; vlIcms?: number; applyXml?: boolean; applyMatriz?: boolean; analystConfirmed?: boolean; correctedByRobot?: boolean; robotCorrectionReason?: string }
  ) => {
    if (!spedData) return;
    const targetSet = new Set(targets.map(t => `${t.docId}_${t.itemNum}`));
    const allXmls = [...xmlTerceiros, ...xmlProprio, ...xmlNfce];
    const companyUf = (spedData.header.uf || 'SP').trim().toUpperCase();

    const xmlByChv = new Map<string, any>();
    allXmls.forEach(x => {
      if (x.chvNfe) xmlByChv.set(x.chvNfe.replace(/\D/g, ''), x);
    });

    const xmlMap = new Map<string, any>();
    spedData.documents.forEach(doc => {
      if (!doc.chvNfe) return;
      const cleanChv = doc.chvNfe.replace(/\D/g, '');
      const foundXml = xmlByChv.get(cleanChv);
      if (foundXml && foundXml.items) {
        foundXml.items.forEach((xi: any) => {
          xmlMap.set(`${doc.id}_${xi.nItem}`, xi);
          xmlMap.set(`${doc.id}_cprod_${xi.cProd}`, xi);
        });
      }
    });

    const newHistory: any[] = [];

    const updatedDocuments = spedData.documents.map(doc => {
      let docModified = false;
      const cleanChv = doc.chvNfe ? doc.chvNfe.replace(/\D/g, '') : '';
      const cleanNum = doc.numDoc ? doc.numDoc.replace(/^0+/, '') : '';
      const foundXml = xmlByChv.get(cleanChv) || allXmls.find(x => x.nNF && x.nNF.replace(/^0+/, '') === cleanNum);

      const updatedItems = doc.items.map((item, itemIndex) => {
        const key = `${doc.id}_${item.numItem}`;
        if (!targetSet.has(key)) return item;

        const xmlItem = foundXml && foundXml.items ? findMatchingXmlItem(foundXml.items, item, itemIndex) : null;
        
        let nextNcm = item.ncm;
        let nextCst = item.cstIcms;
        let nextCfop = item.cfop;
        let nextVlBc = item.vlBcIcms;
        let nextAliq = item.aliqIcms;
        let nextVlIcms = item.vlIcms;

        if (updates.applyXml && xmlItem) {
          if (xmlItem.ncm) nextNcm = xmlItem.ncm;
          if (xmlItem.cst) nextCst = xmlItem.cst;
          if (xmlItem.cfop) {
            const isEntryDoc = doc.indOper === '0' || item.cfop.startsWith('1') || item.cfop.startsWith('2');
            nextCfop = mapXmlCfopToEntryCfop(xmlItem.cfop, isEntryDoc);
          }
          if (xmlItem.vBc !== undefined) nextVlBc = xmlItem.vBc;
          if (xmlItem.pIcms !== undefined) nextAliq = xmlItem.pIcms;
          if (xmlItem.vIcms !== undefined) nextVlIcms = xmlItem.vIcms;
        } else if (updates.applyMatriz && stateTaxRules.length > 0) {
          const itemNcm = (item.ncm || '').trim();
          const rule = stateTaxRules.find(r => {
            const ruleNcm = (r.ncmPrefix || '').trim();
            const ncmMatches = ruleNcm ? itemNcm.startsWith(ruleNcm) : false;
            const smUf = (r.uf || 'ALL').trim().toUpperCase();
            return ncmMatches && (smUf === 'ALL' || smUf === companyUf);
          });
          if (rule) {
            if (rule.expectedCst) nextCst = rule.expectedCst;
            if (rule.expectedAliqIcms !== undefined && rule.expectedAliqIcms !== null) {
              nextAliq = rule.expectedAliqIcms;
              nextVlIcms = (nextVlBc * nextAliq) / 100;
            }
            if (Array.isArray(rule.expectedCfop) && rule.expectedCfop.length > 0) {
              nextCfop = rule.expectedCfop[0];
            }
          }
        } else {
          if (updates.ncm) nextNcm = updates.ncm;
          if (updates.cst) nextCst = updates.cst;
          if (updates.cfop) nextCfop = updates.cfop;
          if (updates.vlBcIcms !== undefined) {
            nextVlBc = updates.vlBcIcms;
            nextVlIcms = (nextVlBc * nextAliq) / 100;
          }
          if (updates.aliqIcms !== undefined) {
            nextAliq = updates.aliqIcms;
            nextVlIcms = (nextVlBc * nextAliq) / 100;
          }
          if (updates.vlIcms !== undefined) {
            nextVlIcms = updates.vlIcms;
          }
        }

        let nextAnalystConfirmed = updates.analystConfirmed !== undefined ? updates.analystConfirmed : item.analystConfirmed;
        let nextCorrectedByRobot = updates.correctedByRobot !== undefined ? updates.correctedByRobot : (updates.applyMatriz ? true : item.correctedByRobot);
        let nextRobotReason = updates.robotCorrectionReason !== undefined ? updates.robotCorrectionReason : item.robotCorrectionReason;

        const newItem = { 
          ...item, 
          ncm: nextNcm,
          cstIcms: nextCst, 
          cfop: nextCfop, 
          vlBcIcms: nextVlBc, 
          aliqIcms: nextAliq, 
          vlIcms: nextVlIcms,
          analystConfirmed: nextAnalystConfirmed,
          correctedByRobot: nextCorrectedByRobot,
          robotCorrectionReason: nextRobotReason,
          isModified: true
        };
        
        newHistory.push({
          id: crypto.randomUUID(),
          docId: doc.id,
          itemNum: item.numItem,
          oldItem: { ...item },
          newItem,
          timestamp: Date.now()
        });

        docModified = true;
        return newItem;
      });

      if (!docModified) return doc;
      return {
        ...doc,
        items: updatedItems
      };
    });

    if (newHistory.length > 0) {
      setEditHistory(prev => [...prev, ...newHistory]);
      let desc = `${targets.length} item(ns) selecionado(s) tiveram seus dados tributários atualizados.`;
      if (updates.applyXml) {
        desc = `Dados de tributação extraídos dos arquivos XML foram copiados para ${targets.length} item(ns).`;
      } else if (updates.applyMatriz) {
        desc = `Regras de alíquota e CST da Matriz Fiscal Estadual foram aplicadas em ${targets.length} item(ns).`;
      }
      addNotification('Edição em Massa Concluída', desc, 'edit', 'all_items');
    }

    const modifiedDocIds = targets.map(t => t.docId);
    const newSpedData = recalculateSpedHierarchy({
      ...spedData,
      documents: updatedDocuments
    }, modifiedDocIds);

    handleSetSpedData(newSpedData, true);
  };

  const handleImportMissingNotesToSped = (xmlsToImport: XmlRecord[]) => {
    if (!spedData || xmlsToImport.length === 0) return;

    const existingChaves = new Set((spedData.documents || []).map(d => (d.chvNfe || '').replace(/\D/g, '')));
    const newDocs: SpedDocument[] = [];

    for (const xml of xmlsToImport) {
      const chv = (xml.chvNfe || '').replace(/\D/g, '');
      if (chv && existingChaves.has(chv)) continue;

      const convertedDoc = convertXmlToSpedDocument(xml, spedData.header.cnpj);
      newDocs.push(convertedDoc);
      existingChaves.add(chv);
    }

    if (newDocs.length === 0) {
      alert('Todas as notas selecionadas já foram previamente importadas ou escrituradas no SPED.');
      return;
    }

    const updatedDocuments = [...spedData.documents, ...newDocs];
    const newDocIds = newDocs.map(d => d.id);
    const updatedSped = recalculateSpedHierarchy({
      ...spedData,
      documents: updatedDocuments
    }, newDocIds);

    handleSetSpedData(updatedSped, true);

    addNotification(
      'Notas Omitidas Importadas para o SPED',
      `Sucesso! ${newDocs.length} nota(s) fiscal(is) XML faltante(s) foram inseridas no SPED e registradas nos blocos C100, C170 e C190 para a exportação.`,
      'import',
      'all_items'
    );
  };

  const handleAppendXmlRecords = (newRecords: XmlRecord[]) => {
    const terceirosToAppend: XmlRecord[] = [];
    const proprioToAppend: XmlRecord[] = [];
    const nfceToAppend: XmlRecord[] = [];

    newRecords.forEach(rec => {
      if (rec.mod === '65') {
        nfceToAppend.push(rec);
      } else if (rec.mod === '55' && rec.tpNF === '1') {
        proprioToAppend.push(rec);
      } else {
        terceirosToAppend.push(rec);
      }
    });

    if (terceirosToAppend.length > 0) {
      setXmlTerceiros(prev => {
        const keys = new Set(prev.map(x => (x.chvNfe || x.nNF || '').replace(/\D/g, '')));
        const fresh = terceirosToAppend.filter(x => !keys.has((x.chvNfe || x.nNF || '').replace(/\D/g, '')));
        const updated = [...prev, ...fresh];
        localStorage.setItem('atlas_xml_terceiros', JSON.stringify(updated));
        return updated;
      });
    }

    if (proprioToAppend.length > 0) {
      setXmlProprio(prev => {
        const keys = new Set(prev.map(x => (x.chvNfe || x.nNF || '').replace(/\D/g, '')));
        const fresh = proprioToAppend.filter(x => !keys.has((x.chvNfe || x.nNF || '').replace(/\D/g, '')));
        const updated = [...prev, ...fresh];
        localStorage.setItem('atlas_xml_proprio', JSON.stringify(updated));
        return updated;
      });
    }

    if (nfceToAppend.length > 0) {
      setXmlNfce(prev => {
        const keys = new Set(prev.map(x => (x.chvNfe || x.nNF || '').replace(/\D/g, '')));
        const fresh = nfceToAppend.filter(x => !keys.has((x.chvNfe || x.nNF || '').replace(/\D/g, '')));
        const updated = [...prev, ...fresh];
        localStorage.setItem('atlas_xml_nfce', JSON.stringify(updated));
        return updated;
      });
    }

    addNotification(
      'Captura de Notas Faltantes Concluída',
      `${newRecords.length} XML(s) foram capturados e integrados à auditoria com sucesso. Os dados no confronto do SPED foram atualizados.`,
      'import',
      'all_items'
    );
  };

  const handleSetXmlTerceiros = async (records: XmlRecord[]) => {
    setXmlTerceiros(records);
    if (records.length > 0) {
      addNotification(
        'Notas Fiscais de Terceiros Adicionadas',
        `${records.length} arquivos XML de fornecedores foram importados para confronto com o SPED.`,
        'import',
        'xml_terceiros'
      );
    }
    try {
      localStorage.setItem('atlas_xml_terceiros', JSON.stringify(records));
      if (records.length > 0) await trackEvent('xml_importado');
      
      // Also persist to IndexedDB for the Notas Omissas module
      const { db } = await import('./lib/db');
      const xmlsByPeriod = new Map<string, XmlRecord[]>();
      
      const extrairMesAno = (dateString: string) => {
        if (dateString.includes('T')) return dateString.substring(0, 7);
        const parts = dateString.split(/[-/]/);
        if (parts.length >= 3) {
          if (parts[0].length === 4) return `${parts[0]}-${parts[1]}`;
          if (parts[2].length === 4) return `${parts[2]}-${parts[1]}`;
        }
        return '';
      };
      
      for (const xml of records) {
        if (xml.mod !== '55') continue;
        const mesAno = extrairMesAno(xml.dhEmi);
        if (!mesAno) continue;
        
        if (!xmlsByPeriod.has(mesAno)) xmlsByPeriod.set(mesAno, []);
        xmlsByPeriod.get(mesAno)!.push(xml);
      }

      for (const [periodoId, xmls] of xmlsByPeriod.entries()) {
        const existente = await db.periodos.get(periodoId);
        if (existente) {
          const mergedXmls = [...existente.xmlTerceiros];
          const chavesExistentes = new Set(mergedXmls.map(x => x.chvNfe.replace(/\D/g, '')));
          for (const xml of xmls) {
            const chv = xml.chvNfe.replace(/\D/g, '');
            if (!chavesExistentes.has(chv)) {
              mergedXmls.push(xml);
            }
          }
          await db.periodos.put({ ...existente, xmlTerceiros: mergedXmls });
        } else {
          const parts = periodoId.split('-');
          await db.periodos.put({
            id: periodoId,
            ano: parseInt(parts[0]),
            mes: parseInt(parts[1]),
            temSped: false,
            spedData: null,
            xmlTerceiros: xmls
          });
        }
      }
    } catch (e) {
      console.error('Error saving xml terceiros', e);
    }
  };

  const handleSetXmlProprio = async (records: XmlRecord[]) => {
    setXmlProprio(records);
    if (records.length > 0) {
      addNotification(
        'Notas Fiscais Próprias (XML) Adicionadas',
        `${records.length} arquivos de notas de saída da própria empresa foram importados.`,
        'import',
        'xml_proprio'
      );
    }
    try {
      localStorage.setItem('atlas_xml_proprio', JSON.stringify(records));
      if (records.length > 0) await trackEvent('xml_importado');
    } catch (e) {
      console.error('Error saving xml proprio', e);
    }
  };

  const handleSetXmlNfce = async (records: XmlRecord[]) => {
    setXmlNfce(records);
    if (records.length > 0) {
      addNotification(
        'Notas de Consumidor (NFC-e) Adicionadas',
        `${records.length} arquivos de cupons fiscais eletrônicos foram adicionados.`,
        'import',
        'xml_nfce'
      );
    }
    try {
      localStorage.setItem('atlas_xml_nfce', JSON.stringify(records));
      if (records.length > 0) await trackEvent('xml_importado');
    } catch (e) {
      console.error('Error saving xml nfce', e);
    }
  };

  const [auditConfig, setAuditConfig] = useState<AuditConfig>(() => {
    const saved = localStorage.getItem('atlas_audit_config');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error loading saved config', e);
      }
    }
    return {
      rules: [
        {
          id: 'fuel_ncm',
          name: 'Combustível por NCM (2710)',
          uf: 'ALL',
          ncm: '2710',
          expectedCfops: ['1653', '2653', '1662', '2662'],
          expectedCsts: [],
          errorMessage: 'Combustível classificado com CFOP incorreto para consumo/uso.'
        }
      ]
    };
  });

  const handleSaveConfig = (newConfig: AuditConfig) => {
    setAuditConfig(newConfig);
    localStorage.setItem('atlas_audit_config', JSON.stringify(newConfig));
    addNotification(
      'Regras de Auditoria Atualizadas',
      'Os parâmetros e exceções para a conferência automática foram atualizados.',
      'rule',
      'config'
    );
  };

  const [stateTaxRules, setStateTaxRules] = useState<StateTaxRule[]>([]);
  const [clientesList, setClientesList] = useState<Cliente[]>([]);
  const [roboLogsState, setRoboLogsState] = useState<RoboExecutionLog[]>([]);

  React.useEffect(() => {
    async function loadData() {
      if (!userData?.escritorioId) {
        setClientesList([]);
        setRoboLogsState([]);
        return;
      }
      try {
        const list = await fetchClientes(userData.escritorioId);
        setClientesList(list);
        const logs = await getRoboLogs(50, userData.escritorioId);
        setRoboLogsState(logs);
      } catch (e) {
        console.error('Error loading data in App:', e);
      }
    }
    loadData();
  }, [userData?.escritorioId]);

  React.useEffect(() => {
    if (!user) return;
    const effectiveEscritorioId = userData?.escritorioId || 'escritorio-default';
    async function loadGlobalMatrix() {
      try {
        const { fetchGlobalStateTaxMatrix } = await import('./lib/matrizService');
        const rules = await fetchGlobalStateTaxMatrix(effectiveEscritorioId);
        if (rules && rules.length > 0) {
          setStateTaxRules(rules);
          try {
            localStorage.setItem(`atlas_state_tax_matrix_${effectiveEscritorioId}`, JSON.stringify(rules));
            localStorage.setItem('atlas_state_tax_matrix', JSON.stringify(rules));
          } catch (err) {
            console.warn('Could not save to localStorage, it might be full:', err);
          }
        } else {
          const saved = localStorage.getItem(`atlas_state_tax_matrix_${effectiveEscritorioId}`) || localStorage.getItem('atlas_state_tax_matrix');
          if (saved) setStateTaxRules(JSON.parse(saved));
        }
      } catch (e) {
        console.error('Error loading global matrix', e);
        const saved = localStorage.getItem(`atlas_state_tax_matrix_${effectiveEscritorioId}`) || localStorage.getItem('atlas_state_tax_matrix');
        if (saved) setStateTaxRules(JSON.parse(saved));
      }
    }
    loadGlobalMatrix();
  }, [user, userData?.escritorioId]);

  // Detector e Auto-Importador de Arquivos Salvos para o Robô Fiscal
  React.useEffect(() => {
    if (!user) return;

    const runAutoImportScanner = async () => {
      const eid = userData?.escritorioId || 'escritorio-default';
      try {
        await verificarEProcessarArquivosSalvos({
          matrizRules: stateTaxRules,
          clientes: clientesList,
          onNotification: addNotification,
          escritorioId: eid
        });
      } catch (err) {
        console.error('Erro na varredura do Robô Fiscal:', err);
      }
    };

    // Immediate scan on mount/update
    runAutoImportScanner();

    // Event listener for real-time detection when a file is saved
    const handleFileSavedEvent = () => {
      runAutoImportScanner();
    };

    window.addEventListener('atlas_file_saved', handleFileSavedEvent);

    // Periodic check every 15 seconds
    const interval = setInterval(runAutoImportScanner, 15000);

    return () => {
      window.removeEventListener('atlas_file_saved', handleFileSavedEvent);
      clearInterval(interval);
    };
  }, [user, stateTaxRules, clientesList]);

  const handleSaveStateTaxRules = async (rules: StateTaxRule[]) => {
    setStateTaxRules(rules);
    const effectiveEscritorioId = userData?.escritorioId || 'escritorio-default';
    try {
      localStorage.setItem('atlas_state_tax_matrix', JSON.stringify(rules));
      localStorage.setItem(`atlas_state_tax_matrix_${effectiveEscritorioId}`, JSON.stringify(rules));
    } catch (err) {
      console.warn('Could not save rules to localStorage:', err);
    }
    addNotification(
      'Matriz Tributária Salva',
      `Foram salvas ${rules.length} regras de tributação por NCM e UF para uso nas auditorias.`,
      'rule',
      'state_tax_matrix'
    );
    try {
      const { saveGlobalStateTaxMatrix } = await import('./lib/matrizService');
      await saveGlobalStateTaxMatrix(rules, effectiveEscritorioId);
    } catch (e) {
      console.error('Error saving to global matrix', e);
      alert('Aviso: Permissão insuficiente para salvar no banco em nuvem. Regras salvas localmente e estão em uso.');
    }
  };


  const handleSyncTotals = (docId: string) => {
    if (!spedData) return;
    const newSpedData = recalculateSpedHierarchy(spedData, [docId]);
    handleSetSpedData(newSpedData, true);
    alert('Sincronização e recálculo dos registros C100 e C190 deste documento concluídos com sucesso!');
  };

  const handleRecalculateStructure = () => {
    if (!spedData) return;
    const allDocIds = spedData.documents.map(d => d.id);
    const updated = recalculateSpedHierarchy(spedData, allDocIds);
    handleSetSpedData(updated, true);
    addNotification(
      'Estrutura C100/C190 Sincronizada',
      'Os totais e registros do Bloco C190 foram recalculados com sucesso a partir dos itens atuais, eliminando eventuais duplicidades ou registros órfãos.',
      'system'
    );
    alert('Recálculo dos blocos C100 e C190 Concluído!\n\n✓ Totais das notas fiscais (C100) atualizados com a soma dos itens (C170).\n✓ Registros analíticos C190 recalculados com precisão.\n✓ Duplicidades no C190 (mesmo CST, CFOP e Alíquota) foram identificadas e consolidadas em um único registro.');
  };

  const handleExportSped = () => {
    if (!spedData) return;
    console.log('[SPED Export Verification] Executando camada de verificação extra e recálculo de hierarquia antes da exportação...');
    const allDocIds = spedData.documents.map(d => d.id);
    const verifiedSpedData = recalculateSpedHierarchy(spedData, allDocIds);
    
    const achados = executarAuditoriaUnificada(verifiedSpedData, auditConfig, xmlTerceiros, xmlProprio, xmlNfce);
    const resultado = exportSped(verifiedSpedData, achados);
    
    if (resultado.erros.length > 0) {
      alert('Não foi possível exportar: ' + resultado.erros.join('; '));
    } else {
      addNotification(
        'SPED Fiscal TXT Exportado',
        'O arquivo oficial do SPED ajustado foi gerado e baixado. Para visualizar ou emitir o Parecer Técnico do Analista Fiscal Senior, acesse a aba "Relatório Executivo".',
        'export',
        'all_items'
      );
      const content = resultado.textoCorrigido;
      const blob = new Blob([content], { type: 'text/plain;charset=windows-1252;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', 'sped_exportado.txt');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex font-sans">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        hasSped={!!spedData}
        hasXmlTerceiros={xmlTerceiros.length > 0}
        hasXmlProprio={xmlProprio.length > 0}
        hasXmlNfce={xmlNfce.length > 0}
      />

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top Header Bar */}
        <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shrink-0 z-10 shadow-2xs">
          <div className="flex items-center space-x-3">
            <div>
              <h1 className="text-sm font-bold text-[#1e3a5f] leading-none">
                {spedData ? spedData.header.nome : 'Atlas Auditor Fiscal'}
              </h1>
              <p className="text-[11px] text-slate-500 mt-1">
                {spedData 
                  ? `CNPJ: ${spedData.header.cnpj} | UF: ${spedData.header.uf} | Período: ${spedData.header.dtIni} a ${spedData.header.dtFin}`
                  : 'Sistema de Auditoria Fiscal & Conformidade SPED x XML'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Version Badge */}
            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/60 shadow-2xs">
              v1.0.0
            </span>

            {/* Notification Center */}
            <NotificationCenter
              notifications={notifications}
              onMarkAsRead={handleMarkAsRead}
              onMarkAllAsRead={handleMarkAllAsRead}
              onClearAll={handleClearAllNotifications}
              onNavigateTab={(tab) => setActiveTab(tab)}
            />

            {/* User Profile Badge */}
            {userData && (
              <div className="hidden sm:flex items-center space-x-2.5 pl-3 border-l border-slate-200">
                <div className="w-8 h-8 rounded-full bg-[#1e3a5f] text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                  {userData.nome ? userData.nome.substring(0, 2).toUpperCase() : 'US'}
                </div>
                <div className="text-left">
                  <p className="text-xs font-semibold text-slate-800 leading-none">{userData.nome || user.email}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5 capitalize">{userData.papel || 'Usuário'}</p>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Barra de Rolagem Horizontal de Painéis */}
        <div className="bg-slate-50/90 border-b border-slate-200 px-6 py-2.5 overflow-x-auto custom-horizontal-scrollbar flex items-center space-x-2 shrink-0 select-none">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-2 shrink-0 flex items-center">
            <Layers className="w-3.5 h-3.5 mr-1 text-indigo-500" />
            Painéis Rápidos:
          </span>
          
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center space-x-1.5 ${
              activeTab === 'upload' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Importação</span>
          </button>

          {spedData && (
            <>
              <button
                onClick={() => setActiveTab('advanced_audit')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center space-x-1.5 ${
                  activeTab === 'advanced_audit' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Central de Auditoria</span>
              </button>

              <button
                onClick={() => setActiveTab('all_items')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center space-x-1.5 ${
                  activeTab === 'all_items' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Todos os Itens</span>
              </button>

              <button
                onClick={() => setActiveTab('sequence_gaps')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center space-x-1.5 ${
                  activeTab === 'sequence_gaps' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <ListOrdered className="w-3.5 h-3.5" />
                <span>Quebra de Sequência</span>
              </button>

              <button
                onClick={() => setActiveTab('sped_raw')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center space-x-1.5 ${
                  activeTab === 'sped_raw' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <Database className="w-3.5 h-3.5" />
                <span>SPED Bruto</span>
              </button>
            </>
          )}

          <button
            onClick={() => setActiveTab('regime_simulator')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center space-x-1.5 ${
              activeTab === 'regime_simulator' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-indigo-700 hover:bg-indigo-50 border border-indigo-200'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
            <span>Simulador de Regime</span>
          </button>

          <button
            onClick={() => setActiveTab('difal_calculator')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center space-x-1.5 ${
              activeTab === 'difal_calculator' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>Calculadora DIFAL</span>
          </button>

          <button
            onClick={() => setActiveTab('ncm_lookup')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center space-x-1.5 ${
              activeTab === 'ncm_lookup' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Consulta NCM</span>
          </button>

          <button
            onClick={() => setActiveTab('state_tax_matrix')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center space-x-1.5 ${
              activeTab === 'state_tax_matrix' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Matriz UF/NCM</span>
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center space-x-1.5 ${
              activeTab === 'reports' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Relatórios</span>
          </button>

          <button
            onClick={() => setActiveTab('config')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center space-x-1.5 ${
              activeTab === 'config' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Regras</span>
          </button>
        </div>

        <main className="flex-1 overflow-auto">
        {activeTab === 'home' && (
          <HomeDashboardView
            clientes={clientesList}
            logs={roboLogsState}
            spedData={spedData}
            setActiveTab={setActiveTab}
            userEmail={userData?.email}
          />
        )}

        {activeTab === 'minhas_rotinas' && (
          <div className="p-6">
            <MinhasRotinasView
              escritorioId={userData?.escritorioId}
              userId={user?.uid}
              userNome={userData?.nome || userData?.email || 'Usuário'}
              papel={userData?.papel}
              clientes={clientesList}
              addNotification={addNotification}
            />
          </div>
        )}

        {activeTab === 'clientes' && (
          <ClientesView
            activeClienteId={activeClienteId}
            setActiveClienteId={setActiveClienteId}
            currentSpedData={spedData}
            currentXmlTerceiros={xmlTerceiros}
            currentXmlProprio={xmlProprio}
            currentXmlNfce={xmlNfce}
            onLoadSavedAudit={handleLoadSavedAudit}
            addNotification={addNotification}
            escritorioId={userData?.escritorioId}
          />
        )}

        {(activeTab === 'robo_fiscal' || activeTab === 'robo_dashboard') && (
          <RoboFiscalView
            clientes={clientesList}
            matrizRules={stateTaxRules}
            onSaveMatrix={handleSaveStateTaxRules}
            activeClienteId={activeClienteId}
            addNotification={addNotification}
            escritorioId={userData?.escritorioId}
            initialTab={activeTab === 'robo_dashboard' ? 'overview' : undefined}
          />
        )}

        {activeTab === 'aprendizado' && (
          <AprendizadoView
            escritorioId={userData?.escritorioId}
            matrizRules={stateTaxRules}
            onSaveMatrix={handleSaveStateTaxRules}
            addNotification={addNotification}
            spedData={spedData}
            onUpdateSpedData={(newSped) => handleSetSpedData(newSped, true)}
          />
        )}

        {activeTab === 'ai_orchestrator' && (
          <AiOrchestratorView
            spedData={spedData}
            xmlRecords={[...xmlTerceiros, ...xmlProprio, ...xmlNfce]}
          />
        )}

        {activeTab === 'upload' && (
          <UploadSection
            spedData={spedData}
            allXmlRecords={[...xmlTerceiros, ...xmlProprio, ...xmlNfce]}
            onAppendXmlRecords={handleAppendXmlRecords}
            onSpedLoaded={(data) => {
              handleSetSpedData(data);
            }}
            onXmlTerceirosLoaded={(records) => {
              handleSetXmlTerceiros(records);
              setActiveTab('xml_terceiros');
            }}
            onXmlProprioLoaded={(records) => {
              handleSetXmlProprio(records);
              setActiveTab('xml_proprio');
            }}
            onXmlNfceLoaded={(records) => {
              handleSetXmlNfce(records);
              setActiveTab('xml_nfce');
            }}
            onClearSped={() => handleSetSpedData(null)}
            onClearXmlTerceiros={() => {
              setXmlTerceiros([]);
              localStorage.removeItem('atlas_xml_terceiros');
            }}
            onClearXmlProprio={() => {
              setXmlProprio([]);
              localStorage.removeItem('atlas_xml_proprio');
            }}
            onClearXmlNfce={() => {
              setXmlNfce([]);
              localStorage.removeItem('atlas_xml_nfce');
            }}
            onGoToAudit={() => setActiveTab('advanced_audit')}
            spedLoaded={!!spedData}
            xmlTerceirosCount={xmlTerceiros.length}
            xmlProprioCount={xmlProprio.length}
            xmlNfceCount={xmlNfce.length}
          />
        )}

        {activeTab === 'config' && (
          <AuditConfigPanel
            config={auditConfig}
            onSave={handleSaveConfig}
          />
        )}

        {activeTab === 'admin_panel' && (
          <AdminPanelView />
        )}

        {activeTab === 'user_management' && (
          <UserManagementView />
        )}

        {activeTab === 'settings' && (
          <SettingsView />
        )}

        {activeTab === 'state_tax_matrix' && (
          <StateTaxMatrixView
            rules={stateTaxRules}
            onSaveRules={handleSaveStateTaxRules}
            defaultUf={spedData?.header.uf}
          />
        )}

        {activeTab === 'ncm_lookup' && (
          <NcmLookupView
            spedData={spedData}
            stateTaxRules={stateTaxRules}
          />
        )}

        {activeTab === 'all_items' && spedData && (
          <AllItemsView
            spedData={spedData}
            auditConfig={auditConfig}
            stateTaxRules={stateTaxRules}
            xmlRecords={[...xmlTerceiros, ...xmlProprio, ...xmlNfce]}
            onUpdateItem={handleUpdateItem}
            onBulkUpdateItems={handleBulkUpdateItems}
            hasHistory={editHistory.length > 0}
            onUndoChanges={undoChanges}
            onExportSped={handleExportSped}
            onRecalculateStructure={handleRecalculateStructure}
          />
        )}

        {activeTab === 'stock_engineering' && (
          <StockEngineeringView
            spedData={spedData}
            onUpdateSpedData={(newData) => handleSetSpedData(newData, true)}
            onSpedLoaded={(data) => handleSetSpedData(data)}
            addNotification={addNotification}
            escritorioId={userData?.escritorioId}
          />
        )}

        {activeTab === 'advanced_audit' && spedData && (
          <AdvancedAuditView
            spedData={spedData}
            auditConfig={auditConfig}
            xmlTerceiros={xmlTerceiros}
            xmlProprio={xmlProprio}
            xmlNfce={xmlNfce}
            escritorioId={userData?.escritorioId}
            addNotification={addNotification}
            c190AuditLogs={c190AuditLogs}
          />
        )}

        {activeTab === 'sequence_gaps' && (
          <SequenceGapView
            spedData={spedData}
            xmlRecords={[...xmlProprio, ...xmlNfce]}
            onImportMissingToSped={handleImportMissingNotesToSped}
            onNavigateTab={(t) => setActiveTab(t as any)}
          />
        )}

        {activeTab === 'omissas' && (
          <NotasOmissasView />
        )}

        {activeTab === 'difal_calculator' && (
          <DifalCalculatorView />
        )}

        {activeTab === 'regime_simulator' && (
          <RegimeSimulatorView spedData={spedData} />
        )}

        {activeTab === 'reports' && (
          <ReportView
            spedData={spedData}
            auditConfig={auditConfig}
            xmlTerceiros={xmlTerceiros}
            xmlProprio={xmlProprio}
            xmlNfce={xmlNfce}
            onRecalculateStructure={handleRecalculateStructure}
          />
        )}

        {activeTab === 'sped_raw' && spedData && (
          <SpedRawView
            spedData={spedData}
            onSyncTotals={handleSyncTotals}
          />
        )}

        {activeTab === 'xml_terceiros' && (
          <XmlView
            title="XMLs de Terceiros"
            description="NF-e recebidas de fornecedores (compras/entradas)"
            xmlRecords={xmlTerceiros}
          />
        )}

        {activeTab === 'xml_proprio' && (
          <XmlView
            title="NF-e Próprio"
            description="NF-e emitidas pela própria empresa (vendas/saídas)"
            xmlRecords={xmlProprio}
          />
        )}

        {activeTab === 'xml_nfce' && (
          <XmlView
            title="NFC-e"
            description="Nota fiscal de consumidor eletrônica"
            xmlRecords={xmlNfce}
          />
        )}
        </main>
      </div>
    </div>
  );
}
