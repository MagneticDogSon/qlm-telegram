import React, { useState, useRef, useEffect } from 'react';
import { Palette, Check } from 'lucide-react';
import { AppTheme, THEME_OPTIONS } from '../utils/themeHelper';

interface ThemeSelectorProps {
  currentTheme: AppTheme;
  onSelectTheme: (theme: AppTheme) => void;
  variant?: 'popover' | 'inline-grid' | 'compact-chips';
}

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({
  currentTheme,
  onSelectTheme,
  variant = 'popover',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const activeThemeOption = THEME_OPTIONS.find((t) => t.id === currentTheme) || THEME_OPTIONS[0];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  if (variant === 'inline-grid') {
    return (
      <div className="space-y-2 font-mono">
        <div className="flex items-center justify-between">
          <label className="text-[11px] text-[#888] uppercase tracking-wider font-bold flex items-center gap-1.5">
            <Palette size={13} style={{ color: activeThemeOption.color }} />
            <span>Цветовая схема интерфейса:</span>
          </label>
          <span
            className="text-[10px] px-2 py-0.5 rounded font-bold border"
            style={{
              backgroundColor: activeThemeOption.darkBg,
              color: activeThemeOption.color,
              borderColor: activeThemeOption.borderRgba,
            }}
          >
            {activeThemeOption.name}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {THEME_OPTIONS.map((theme) => {
            const isSelected = theme.id === currentTheme;
            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => onSelectTheme(theme.id)}
                className={`p-2.5 rounded-sm border text-left transition-all cursor-pointer flex flex-col gap-1.5 relative group ${
                  isSelected
                    ? 'shadow-md scale-[1.01]'
                    : 'bg-[#141414] border-[#222] hover:border-[#444] hover:bg-[#181818]'
                }`}
                style={{
                  backgroundColor: isSelected ? theme.darkBg : undefined,
                  borderColor: isSelected ? theme.color : undefined,
                  boxShadow: isSelected ? `0 0 12px ${theme.borderRgba}` : undefined,
                }}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3.5 h-3.5 rounded-full shadow-sm shrink-0 flex items-center justify-center"
                      style={{ backgroundColor: theme.color }}
                    >
                      {isSelected && <Check size={9} className="text-black stroke-[3]" />}
                    </span>
                    <span className="font-bold text-xs text-white line-clamp-1">{theme.name}</span>
                  </div>
                </div>

                <span className="text-[10px] text-[#777] font-sans line-clamp-1">
                  {theme.subtitle}
                </span>

                {/* Color sample bar */}
                <div className="w-full h-1 rounded-full bg-[#1A1A1A] overflow-hidden mt-0.5">
                  <div className="h-full w-full" style={{ backgroundColor: theme.color }} />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (variant === 'compact-chips') {
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        {THEME_OPTIONS.map((theme) => {
          const isSelected = theme.id === currentTheme;
          return (
            <button
              key={theme.id}
              type="button"
              onClick={() => onSelectTheme(theme.id)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-mono border transition-all cursor-pointer ${
                isSelected
                  ? 'border-white/50 text-white font-bold'
                  : 'border-transparent text-[#888] hover:text-[#CCC] hover:bg-[#1A1A1A]'
              }`}
              style={{
                backgroundColor: isSelected ? theme.darkBg : undefined,
                borderColor: isSelected ? theme.color : undefined,
              }}
              title={theme.name}
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: theme.color }}
              />
              <span>{theme.name.split(' ')[0]}</span>
            </button>
          );
        })}
      </div>
    );
  }

  // Default: Popover menu for Header
  return (
    <div ref={popoverRef} className="relative font-mono">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title={`Цветовая схема: ${activeThemeOption.name} (нажмите для смены)`}
        className="flex items-center gap-1.5 px-2 py-1 text-[12px] rounded-sm border transition-all cursor-pointer bg-[#141414] hover:bg-[#1C1C1C]"
        style={{
          borderColor: activeThemeOption.borderRgba,
          color: activeThemeOption.color,
        }}
      >
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
          style={{ backgroundColor: activeThemeOption.color }}
        />
        <Palette size={13} style={{ color: activeThemeOption.color }} />
        <span className="hidden xl:inline font-bold text-[11px]">
          {activeThemeOption.name.split(' ')[0]}
        </span>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1.5 z-50 w-64 p-2 bg-[#121212] border border-[#262626] rounded-sm shadow-2xl space-y-1.5 animate-in fade-in zoom-in-95 duration-100 backdrop-blur-md">
          <div className="flex items-center justify-between px-1.5 py-1 border-b border-[#1E1E1E] text-[10px] text-[#777] uppercase tracking-wider font-bold">
            <span className="flex items-center gap-1.5">
              <Palette size={11} />
              Цветовая схема
            </span>
            <span style={{ color: activeThemeOption.color }}>{activeThemeOption.name}</span>
          </div>

          <div className="space-y-1">
            {THEME_OPTIONS.map((theme) => {
              const isSelected = theme.id === currentTheme;
              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => {
                    onSelectTheme(theme.id);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-sm text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'border'
                      : 'hover:bg-[#1A1A1A] text-[#AAA] hover:text-white'
                  }`}
                  style={{
                    backgroundColor: isSelected ? theme.darkBg : undefined,
                    borderColor: isSelected ? theme.color : 'transparent',
                    color: isSelected ? '#FFF' : undefined,
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-3 h-3 rounded-full shrink-0 shadow-xs"
                      style={{ backgroundColor: theme.color }}
                    />
                    <div>
                      <div className="text-xs font-bold font-sans">{theme.name}</div>
                      <div className="text-[9.5px] text-[#777] font-mono">{theme.subtitle}</div>
                    </div>
                  </div>

                  {isSelected && (
                    <Check size={13} style={{ color: theme.color }} className="shrink-0 stroke-[2.5]" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
