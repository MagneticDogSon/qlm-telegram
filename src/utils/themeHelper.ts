export type AppTheme = 'crimson' | 'emerald' | 'cyan' | 'amber' | 'purple' | 'monochrome';

export interface ThemeOption {
  id: AppTheme;
  name: string;
  subtitle: string;
  color: string;
  hoverColor: string;
  rgb: string;
  darkBg: string;
  borderRgba: string;
  textColor: string;
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'crimson',
    name: 'Красный рубин',
    subtitle: 'Qwen 3 Signature',
    color: '#DC143C',
    hoverColor: '#F0224D',
    rgb: '220, 20, 60',
    darkBg: '#220a10',
    borderRgba: 'rgba(220, 20, 60, 0.4)',
    textColor: '#FF708C',
  },
  {
    id: 'emerald',
    name: 'Изумрудный кибер',
    subtitle: 'Kimi / Matrix Green',
    color: '#22C55E',
    hoverColor: '#16A34A',
    rgb: '34, 197, 94',
    darkBg: '#092112',
    borderRgba: 'rgba(34, 197, 94, 0.4)',
    textColor: '#86EFAC',
  },
  {
    id: 'cyan',
    name: 'Неоновый киберпанк',
    subtitle: 'Azure Cyber Cyan',
    color: '#06B6D4',
    hoverColor: '#0891B2',
    rgb: '6, 182, 212',
    darkBg: '#082026',
    borderRgba: 'rgba(6, 182, 212, 0.4)',
    textColor: '#67E8F9',
  },
  {
    id: 'amber',
    name: 'Золотой янтарь',
    subtitle: 'Retro Terminal Amber',
    color: '#F59E0B',
    hoverColor: '#D97706',
    rgb: '245, 158, 11',
    darkBg: '#291b07',
    borderRgba: 'rgba(245, 158, 11, 0.4)',
    textColor: '#FCD34D',
  },
  {
    id: 'purple',
    name: 'Неоновый аметист',
    subtitle: 'Deep Synthwave Violet',
    color: '#A855F7',
    hoverColor: '#9333EA',
    rgb: '168, 85, 247',
    darkBg: '#210d33',
    borderRgba: 'rgba(168, 85, 247, 0.4)',
    textColor: '#D8B4FE',
  },
  {
    id: 'monochrome',
    name: 'Чистый монохром',
    subtitle: 'Minimal OLED Slate',
    color: '#E2E8F0',
    hoverColor: '#FFFFFF',
    rgb: '226, 232, 240',
    darkBg: '#1E2024',
    borderRgba: 'rgba(255, 255, 255, 0.3)',
    textColor: '#F8FAFC',
  },
];

const STORAGE_KEY_THEME = 'opencode_app_theme';

export function getSavedTheme(): AppTheme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_THEME) as AppTheme;
    if (saved && THEME_OPTIONS.some((t) => t.id === saved)) {
      return saved;
    }
  } catch {
    // ignore
  }
  return 'crimson';
}

export function applyTheme(theme: AppTheme) {
  try {
    localStorage.setItem(STORAGE_KEY_THEME, theme);
    document.documentElement.setAttribute('data-theme', theme);
  } catch {
    // ignore
  }
}

export function getThemeConfig(theme: AppTheme): ThemeOption {
  return THEME_OPTIONS.find((t) => t.id === theme) || THEME_OPTIONS[0];
}
