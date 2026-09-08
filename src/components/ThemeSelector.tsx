import React, { useState, useEffect } from 'react';
import { Sun, Moon, Palette } from 'lucide-react';

interface ThemeSelectorProps {
  compact?: boolean;
}

export function ThemeSelector({ compact = false }: ThemeSelectorProps) {
  const [palette, setPaletteState] = useState<'navy' | 'grafite' | 'vinho'>(() => {
    return (localStorage.getItem('atlas_theme_palette') as any) || 'navy';
  });

  const [mode, setModeState] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('atlas_theme_mode') as any) || 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-palette', palette);
    document.documentElement.setAttribute('data-mode', mode);
  }, [palette, mode]);

  const handlePaletteChange = (newPalette: 'navy' | 'grafite' | 'vinho') => {
    setPaletteState(newPalette);
    localStorage.setItem('atlas_theme_palette', newPalette);
    document.documentElement.setAttribute('data-palette', newPalette);
  };

  const handleModeChange = (newMode: 'light' | 'dark') => {
    setModeState(newMode);
    localStorage.setItem('atlas_theme_mode', newMode);
    document.documentElement.setAttribute('data-mode', newMode);
  };

  if (compact) {
    return (
      <div className="flex items-center justify-between gap-1.5 p-1.5 rounded-lg border border-[var(--atlas-border)] bg-[var(--atlas-surface)] text-xs">
        <div className="flex items-center gap-1 min-w-0 flex-1">
          <Palette className="w-3.5 h-3.5 text-[var(--atlas-navy)] shrink-0" />
          <select
            value={palette}
            onChange={(e) => handlePaletteChange(e.target.value as any)}
            className="bg-transparent text-[11px] font-semibold text-[var(--atlas-text)] border-none focus:outline-none cursor-pointer truncate"
          >
            <option value="navy">Tema: Atlas Navy</option>
            <option value="grafite">Tema: Grafite</option>
            <option value="vinho">Tema: Vinho</option>
          </select>
        </div>

        <div className="flex items-center bg-[var(--atlas-bg)] p-0.5 rounded-md border border-[var(--atlas-border)] shrink-0">
          <button
            type="button"
            onClick={() => handleModeChange('light')}
            className={`p-1 rounded transition-colors ${
              mode === 'light'
                ? 'bg-[var(--atlas-surface)] text-[var(--atlas-navy)] shadow-xs'
                : 'text-[var(--atlas-text-muted)] hover:text-[var(--atlas-text)]'
            }`}
            title="Modo Claro"
          >
            <Sun className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('dark')}
            className={`p-1 rounded transition-colors ${
              mode === 'dark'
                ? 'bg-[var(--atlas-navy)] text-white shadow-xs'
                : 'text-[var(--atlas-text-muted)] hover:text-[var(--atlas-text)]'
            }`}
            title="Modo Escuro"
          >
            <Moon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="atlas-card space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Palette className="w-5 h-5 text-[var(--atlas-navy)]" />
          <div>
            <h3 className="text-base font-bold text-[var(--atlas-text)] font-serif">Aparência & Tema Visual</h3>
            <p className="text-xs text-[var(--atlas-text-secondary)]">Personalize a paleta de cores institucional e o modo claro/escuro.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
        <div>
          <label className="block text-xs font-semibold text-[var(--atlas-text)] mb-1.5">
            Paleta de Cores
          </label>
          <select
            value={palette}
            onChange={(e) => handlePaletteChange(e.target.value as any)}
            className="atlas-input text-xs font-medium cursor-pointer"
          >
            <option value="navy">Atlas Navy (Padrão Institucional)</option>
            <option value="grafite">Grafite Corporativo</option>
            <option value="vinho">Vinho Clássico</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[var(--atlas-text)] mb-1.5">
            Modo de Exibição
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleModeChange('light')}
              className={`flex-1 atlas-btn text-xs py-2.5 ${
                mode === 'light' ? 'atlas-btn-primary' : 'atlas-btn-secondary'
              }`}
            >
              <Sun className="w-4 h-4" />
              <span>Modo Claro</span>
            </button>

            <button
              type="button"
              onClick={() => handleModeChange('dark')}
              className={`flex-1 atlas-btn text-xs py-2.5 ${
                mode === 'dark' ? 'atlas-btn-primary' : 'atlas-btn-secondary'
              }`}
            >
              <Moon className="w-4 h-4" />
              <span>Modo Escuro</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
