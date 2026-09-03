import { useEffect } from 'react';
import { MiniAppChat } from './miniapp/MiniAppChat';
import { WizardApp } from './wizard/WizardApp';

export default function App() {
  const host = window.location.hostname;
  const path = window.location.pathname;
  const isMiniApp =
    host.endsWith('github.io') ||
    path === '/app' ||
    path.startsWith('/app/') ||
    path.endsWith('/app');

  useEffect(() => {
    const tw = window.Telegram?.WebApp;
    if (!tw) return;
    tw.ready();
    tw.expand();
  }, []);

  if (isMiniApp) return <MiniAppChat />;
  return <WizardApp />;
}
