import React, { useState, useEffect } from 'react';
import { Sun, Moon, Palette } from 'lucide-react';

export type PaletteType = 'navy' | 'grafite' | 'vinho';
export type ModeType = 'light' | 'dark';

interface ThemeSelectorProps {
  compact?: boolean;
  className?: string;
}

export function ThemeSelector({ compact = true, className = '' }: ThemeSelectorProps) {
  const [palette, setPalette] = useState<PaletteType>(() => {
    return (localStorage.getItem('atlas_theme_palette') as PaletteType) || 'navy';
  });
  const [mode, setMode] = useState<ModeType>(() => {
    return (localStorage.getItem('atlas_theme_mode') as ModeType) || 'light';
  });

  const applyTheme = (p: PaletteType, m: ModeType) => {
    document.documentElement.setAttribute('data-palette', p);
    document.documentElement.setAttribute('data-mode', m);
    localStorage.setItem('atlas_theme_palette', p);
    localStorage.setItem('atlas_theme_mode', m);
  };

  const handlePaletteChange = (newPalette: PaletteType) => {
    setPalette(newPalette);
    applyTheme(newPalette, mode);
  };

  const handleModeChange = (newMode: ModeType) => {
    setMode(newMode);
    applyTheme(palette, newMode);
  };

  useEffect(() => {
    // Initial sync
    applyTheme(palette, mode);
  }, []);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Palette Dropdown */}
      <div className="relative flex-1 min-w-0">
        <select
          value={palette}
          onChange={(e) => handlePaletteChange(e.target.value as PaletteType)}
          className="w-full bg-[var(--atlas-surface)] text-[var(--atlas-text)] border border-[var(--atlas-border)] rounded-lg px-2.5 py-1.5 text-xs font-medium cursor-pointer focus:outline-none focus:border-[var(--atlas-navy)]"
          title="Selecionar Paleta de Cores"
        >
          <option value="navy">Tema: Atlas Navy</option>
          <option value="grafite">Tema: Atlas Grafite</option>
          <option value="vinho">Tema: Atlas Vinho</option>
        </select>
      </div>

      {/* Light / Dark Mode Toggle Buttons */}
      <div className="flex items-center bg-[var(--atlas-bg)] border border-[var(--atlas-border)] rounded-lg p-0.5 shrink-0">
        <button
          type="button"
          onClick={() => handleModeChange('light')}
          className={`p-1.2 rounded-md transition-all ${
            mode === 'light'
              ? 'bg-[var(--atlas-surface)] text-[var(--atlas-navy)] shadow-2xs font-bold'
              : 'text-[var(--atlas-text-muted)] hover:text-[var(--atlas-text)]'
          }`}
          title="Modo Claro"
        >
          <Sun className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => handleModeChange('dark')}
          className={`p-1.2 rounded-md transition-all ${
            mode === 'dark'
              ? 'bg-[var(--atlas-navy)] text-white shadow-2xs font-bold'
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
