import React, { useState } from 'react';
import { AppNotification, NotificationType } from '../types';
import { 
  Bell, 
  X, 
  CheckCheck, 
  Trash2, 
  Layers, 
  FileText, 
  Archive, 
  Database, 
  CheckCircle2, 
  Info, 
  AlertCircle,
  Clock,
  Filter
} from 'lucide-react';

interface NotificationCenterProps {
  notifications: AppNotification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClearAll: () => void;
  onNavigateTab?: (tab: string) => void;
}

export function NotificationCenter({
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onClearAll,
  onNavigateTab
}: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filterType, setFilterType] = useState<'ALL' | NotificationType>('ALL');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  const unreadCount = notifications.filter(n => !n.read).length;

  const filteredNotifications = notifications.filter(n => {
    if (showUnreadOnly && n.read) return false;
    if (filterType !== 'ALL' && n.type !== filterType) return false;
    return true;
  });

  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case 'edit':
        return <Layers className="w-4 h-4 text-blue-600" />;
      case 'import':
        return <Archive className="w-4 h-4 text-emerald-600" />;
      case 'audit':
        return <AlertCircle className="w-4 h-4 text-amber-600" />;
      case 'rule':
        return <Database className="w-4 h-4 text-[#1e3a5f]" />;
      case 'export':
        return <FileText className="w-4 h-4 text-teal-600" />;
      default:
        return <Info className="w-4 h-4 text-slate-600" />;
    }
  };

  const getNotificationBadgeColor = (type: NotificationType) => {
    switch (type) {
      case 'edit': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'import': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'audit': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'rule': return 'bg-[#f1efe8] text-[#1e3a5f] border-[#e5e2d9]';
      case 'export': return 'bg-teal-50 text-teal-700 border-teal-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const getTypeName = (type: NotificationType) => {
    switch (type) {
      case 'edit': return 'Edição Manual';
      case 'import': return 'Importação';
      case 'audit': return 'Auditoria Fiscal';
      case 'rule': return 'Matriz / Regras';
      case 'export': return 'Exportação';
      default: return 'Sistema';
    }
  };

  return (
    <>
      {/* Header Bell Button */}
      <div className="relative inline-block">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative p-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:text-[#1e3a5f] hover:bg-slate-50 transition-colors shadow-2xs flex items-center justify-center focus:outline-hidden focus:ring-2 focus:ring-[#1e3a5f]/20"
          title="Central de Notificações e Atualizações"
          aria-label="Abrir notificações"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white ring-2 ring-white animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Slide-over Notification Drawer Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 flex justify-end animate-fade-in">
          <div className="w-full max-w-md bg-white h-full shadow-sm flex flex-col border-l border-slate-200">
            
            {/* Header */}
            <div className="p-5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Bell className="w-5 h-5 text-[#1e3a5f]" />
                <div>
                  <h2 className="text-base font-bold text-[#1e3a5f]">Avisos & Atualizações</h2>
                  <p className="text-[11px] text-slate-500">Histórico de edições e eventos da plataforma</p>
                </div>
              </div>

              <div className="flex items-center space-x-1">
                {unreadCount > 0 && (
                  <button
                    onClick={onMarkAllAsRead}
                    className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors text-xs flex items-center gap-1"
                    title="Marcar todas como lidas"
                  >
                    <CheckCheck className="w-4 h-4" />
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    onClick={onClearAll}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors text-xs"
                    title="Limpar histórico"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Sub-header Filter Tabs */}
            <div className="p-3 border-b border-slate-100 bg-white flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center space-x-1 overflow-x-auto py-1 hide-scrollbar">
                <button
                  onClick={() => setFilterType('ALL')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                    filterType === 'ALL' ? 'bg-[#1e3a5f] text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Todas ({notifications.length})
                </button>
                <button
                  onClick={() => setFilterType('edit')}
                  className={`px-2 py-1 rounded-lg font-medium transition-colors ${
                    filterType === 'edit' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Edições
                </button>
                <button
                  onClick={() => setFilterType('import')}
                  className={`px-2 py-1 rounded-lg font-medium transition-colors ${
                    filterType === 'import' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Importações
                </button>
                <button
                  onClick={() => setFilterType('rule')}
                  className={`px-2 py-1 rounded-lg font-medium transition-colors ${
                    filterType === 'rule' ? 'bg-[#1e3a5f] text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Regras
                </button>
              </div>

              <label className="flex items-center space-x-1.5 text-[11px] font-medium text-slate-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showUnreadOnly}
                  onChange={(e) => setShowUnreadOnly(e.target.checked)}
                  className="rounded text-[#1e3a5f] focus:ring-[#1e3a5f]"
                />
                <span>Apenas não lidas ({unreadCount})</span>
              </label>
            </div>

            {/* Notification List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2">
              {filteredNotifications.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                    <Bell className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700">Nenhum aviso no momento</p>
                    <p className="text-xs text-slate-400 mt-1">
                      As alterações em massa, edições de itens e importações aparecerão aqui em linguagem simples.
                    </p>
                  </div>
                </div>
              ) : (
                filteredNotifications.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => {
                      if (!notif.read) onMarkAsRead(notif.id);
                      if (notif.actionUrl && onNavigateTab) {
                        onNavigateTab(notif.actionUrl);
                        setIsOpen(false);
                      }
                    }}
                    className={`p-3.5 rounded-xl transition-all cursor-pointer mb-1 border ${
                      !notif.read
                        ? 'bg-blue-50/40 border-blue-100 hover:bg-blue-50/70'
                        : 'bg-white border-transparent hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center space-x-2">
                        <div className="p-1.5 rounded-lg bg-white border border-slate-200 shadow-2xs">
                          {getNotificationIcon(notif.type)}
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${getNotificationBadgeColor(notif.type)}`}>
                          {getTypeName(notif.type)}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2 text-[10px] text-slate-400 font-medium">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {notif.timestamp}
                        </span>
                        {!notif.read && (
                          <span className="w-2 h-2 rounded-full bg-blue-600 ring-2 ring-blue-200" title="Não lida"></span>
                        )}
                      </div>
                    </div>

                    <div className="mt-2 pl-0.5">
                      <h4 className="text-xs font-bold text-slate-800 leading-snug">{notif.title}</h4>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">{notif.message}</p>
                      
                      {notif.author && (
                        <p className="text-[10px] text-slate-400 mt-1 font-medium">
                          Por: <span className="text-slate-600">{notif.author}</span>
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer Summary */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/80 text-center">
              <p className="text-[11px] text-slate-500">
                Central de transparência e controle de alterações do <strong className="text-[#1e3a5f]">Atlas Auditor Fiscal</strong>.
              </p>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
