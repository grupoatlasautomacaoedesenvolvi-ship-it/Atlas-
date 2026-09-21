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
  Filter,
  Check
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
        return <Database className="w-4 h-4 text-[var(--atlas-navy)]" />;
      case 'export':
        return <FileText className="w-4 h-4 text-teal-600" />;
      default:
        return <Info className="w-4 h-4 text-[var(--atlas-text-secondary)]" />;
    }
  };

  const getNotificationBadgeColor = (type: NotificationType) => {
    switch (type) {
      case 'edit': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'import': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'audit': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'rule': return 'bg-[#f1efe8] text-[var(--atlas-navy)] border-[#e5e2d9]';
      case 'export': return 'bg-teal-50 text-teal-700 border-teal-200';
      default: return 'bg-[var(--atlas-surface-hover)] text-[var(--atlas-text-secondary)] border-[var(--atlas-border)]';
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
          className="relative p-2.5 rounded-xl bg-[var(--atlas-surface)] border border-[var(--atlas-border)] text-[var(--atlas-text-secondary)] hover:text-[var(--atlas-navy)] hover:bg-[var(--atlas-surface-hover)] transition-colors shadow-xs flex items-center justify-center focus:outline-hidden focus:ring-2 focus:ring-[var(--atlas-navy)]/20"
          title="Central de Notificações e Atualizações"
          aria-label="Abrir notificações"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white ring-2 ring-white animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Slide-over Notification Drawer Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 flex justify-end animate-fade-in">
          <div className="w-full max-w-md bg-[var(--atlas-surface)] h-full shadow-sm flex flex-col border-l border-[var(--atlas-border)]">
            
            {/* Header */}
            <div className="p-6 border-b border-[var(--atlas-border)] bg-[var(--atlas-surface-hover)]/80 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-[#f1efe8] text-[var(--atlas-navy)] flex items-center justify-center border border-[#e5e2d9] shadow-inner">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-[var(--atlas-navy)] tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
                    Avisos & Atualizações
                  </h2>
                  <p className="text-[10px] text-[var(--atlas-text-secondary)] font-bold uppercase tracking-widest mt-0.5">Histórico da Plataforma</p>
                </div>
              </div>

              <div className="flex items-center space-x-1">
                {unreadCount > 0 && (
                  <button
                    onClick={onMarkAllAsRead}
                    className="p-2 text-[var(--atlas-text-secondary)] hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-all"
                    title="Marcar todas como lidas"
                  >
                    <CheckCheck className="w-5 h-5" />
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    onClick={onClearAll}
                    className="p-2 text-[var(--atlas-text-muted)] hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                    title="Limpar histórico"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 text-[var(--atlas-text-muted)] hover:text-[var(--atlas-text-secondary)] hover:bg-[var(--atlas-border)] rounded-xl transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Sub-header Filter Tabs */}
            <div className="p-4 border-b border-[var(--atlas-border)] bg-[var(--atlas-surface)] flex flex-col gap-4">
              <div className="flex items-center gap-1.5 p-1 bg-[var(--atlas-surface-hover)] rounded-xl border border-[var(--atlas-border)] overflow-x-auto scrollbar-hide">
                <button
                  onClick={() => setFilterType('ALL')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                    filterType === 'ALL' ? 'bg-[var(--atlas-navy)] text-white shadow-xs' : 'text-[var(--atlas-text-secondary)] hover:bg-[var(--atlas-surface)] hover:text-[var(--atlas-text)]'
                  }`}
                >
                  Geral ({notifications.length})
                </button>
                <button
                  onClick={() => setFilterType('edit')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                    filterType === 'edit' ? 'bg-blue-600 text-white shadow-xs' : 'text-[var(--atlas-text-secondary)] hover:bg-[var(--atlas-surface)] hover:text-[var(--atlas-text)]'
                  }`}
                >
                  Edições
                </button>
                <button
                  onClick={() => setFilterType('import')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                    filterType === 'import' ? 'bg-emerald-600 text-white shadow-xs' : 'text-[var(--atlas-text-secondary)] hover:bg-[var(--atlas-surface)] hover:text-[var(--atlas-text)]'
                  }`}
                >
                  Importações
                </button>
              </div>

              <label className="flex items-center gap-2 text-xs font-bold text-[var(--atlas-text-secondary)] cursor-pointer select-none px-1">
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${showUnreadOnly ? 'bg-[var(--atlas-navy)] border-[var(--atlas-navy)]' : 'bg-white border-[var(--atlas-border)]'}`}>
                  {showUnreadOnly && <Check className="w-3 h-3 text-white" />}
                </div>
                <input
                  type="checkbox"
                  checked={showUnreadOnly}
                  onChange={(e) => setShowUnreadOnly(e.target.checked)}
                  className="hidden"
                />
                <span className="uppercase tracking-widest text-[10px]">Apenas não lidas ({unreadCount})</span>
              </label>
            </div>

            {/* Notification List */}
            <div className="flex-1 overflow-y-auto divide-y divide-[var(--atlas-border)] p-2">
              {filteredNotifications.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-8 text-center text-[var(--atlas-text-muted)] space-y-3">
                  <div className="w-12 h-12 rounded-full bg-[var(--atlas-surface-hover)] flex items-center justify-center text-[var(--atlas-text-muted)]">
                    <Bell className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[var(--atlas-text-secondary)]">Nenhum aviso no momento</p>
                    <p className="text-xs text-[var(--atlas-text-muted)] mt-1">
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
                        : 'bg-[var(--atlas-surface)] border-transparent hover:bg-[var(--atlas-surface-hover)]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center space-x-2">
                        <div className="p-1.5 rounded-lg bg-[var(--atlas-surface)] border border-[var(--atlas-border)] shadow-xs">
                          {getNotificationIcon(notif.type)}
                        </div>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-md border ${getNotificationBadgeColor(notif.type)}`}>
                          {getTypeName(notif.type)}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2 text-xs text-[var(--atlas-text-muted)] font-medium">
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
                      <h4 className="text-xs font-bold text-[var(--atlas-text)] leading-snug">{notif.title}</h4>
                      <p className="text-xs text-[var(--atlas-text-secondary)] mt-1 leading-relaxed">{notif.message}</p>
                      
                      {notif.author && (
                        <p className="text-xs text-[var(--atlas-text-muted)] mt-1 font-medium">
                          Por: <span className="text-[var(--atlas-text-secondary)]">{notif.author}</span>
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer Summary */}
            <div className="p-4 border-t border-[var(--atlas-border)] bg-[var(--atlas-surface-hover)]/80 text-center">
              <p className="text-xs text-[var(--atlas-text-secondary)]">
                Central de transparência e controle de alterações do <strong className="text-[var(--atlas-navy)]">Atlas Auditor Fiscal</strong>.
              </p>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
