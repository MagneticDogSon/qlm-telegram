/// <reference types="vite/client" />

interface TelegramWebApp {
  expand: () => void;
  ready: () => void;
  colorScheme?: string;
}

interface Window {
  Telegram?: { WebApp?: TelegramWebApp };
}
