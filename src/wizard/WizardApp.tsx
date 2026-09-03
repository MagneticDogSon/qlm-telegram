import React, { useCallback, useEffect, useState } from 'react';
import { applyTheme, getSavedTheme } from '../utils/themeHelper';
import { AppTheme } from '../types';

interface StatusPayload {
  title: string;
  faqCount: number;
  truncated: boolean;
  botRunning: boolean;
  botUsername: string;
  publicUrl: string;
  hasPackage: boolean;
  hasToken: boolean;
  menuWarning?: string;
  botError?: string;
  proxy?: string | null;
  pagesUrl?: string;
  gram: { status: string; error?: string };
}

async function parseError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    return data.error || res.statusText;
  } catch {
    return res.statusText;
  }
}

function isValidPagesUrl(url: string): boolean {
  return /^https:\/\/[a-z0-9-]+\.github\.io\/[a-z0-9_.-]+$/i.test(url.trim().replace(/\/$/, ''));
}

export const WizardApp: React.FC = () => {
  const [theme] = useState<AppTheme>(() => getSavedTheme());
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [token, setToken] = useState('');
  const [pagesUrl, setPagesUrl] = useState('https://magneticdogson.github.io/qlm-telegram');
  const [channel, setChannel] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/status');
      if (!res.ok) return;
      setStatus(await res.json());
    } catch {
      /* API restart */
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 3000);
    return () => clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    if (status?.pagesUrl) setPagesUrl(status.pagesUrl.replace(/\/$/, ''));
  }, [status?.pagesUrl]);

  const uploadExport = async (file: File) => {
    setError('');
    setBusy('Импорт экспорта…');
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch('/api/import-export', { method: 'POST', body });
      if (!res.ok) throw new Error(await parseError(res));
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy('');
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) void uploadExport(file);
  };

  const login = async () => {
    setError('');
    setBusy('Вход в Telegram…');
    try {
      const res = await fetch('/api/telegram/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      if (!res.ok) throw new Error(await parseError(res));
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy('');
    }
  };

  const sendCode = async () => {
    await fetch('/api/telegram/code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    await refresh();
  };

  const sendPassword = async () => {
    await fetch('/api/telegram/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    await refresh();
  };

  const downloadChannel = async () => {
    setError('');
    setBusy('Скачивание канала…');
    try {
      const res = await fetch('/api/telegram/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel }),
      });
      if (!res.ok) throw new Error(await parseError(res));
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy('');
    }
  };

  const launch = async () => {
    setError('');
    if (!isValidPagesUrl(pagesUrl)) {
      setError('URL должен быть вида https://user.github.io/repo');
      return;
    }
    setBusy('Бот и GitHub Pages…');
    try {
      const res = await fetch('/api/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, pagesUrl: pagesUrl.replace(/\/$/, '') }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || res.statusText);
      setWarning(typeof data.warning === 'string' ? data.warning : '');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy('');
    }
  };

  const stop = async () => {
    setBusy('Остановка…');
    try {
      await fetch('/api/stop', { method: 'POST' });
      await refresh();
    } finally {
      setBusy('');
    }
  };

  const gram = status?.gram.status;

  return (
    <div className="min-h-screen bg-[#0D0D0D] text-[#D1D1D1] px-4 py-8">
      <div className="max-w-xl mx-auto space-y-6 font-mono">
        <header>
          <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-accent)] font-bold">QLM Telegram</div>
          <h1 className="text-2xl text-white font-bold mt-1">Канал → .qlm → Mini App</h1>
          <p className="text-xs text-[#888] mt-2 leading-relaxed">
            Три шага: история канала, токен @BotFather, запуск. Чат как в основном QLM, ответы только из FAQ, без LLM.
            Mini App хостится на GitHub Pages — Cloudflare не нужен.
          </p>
        </header>

        <section
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`border border-dashed rounded-sm p-5 bg-[#111] ${
            dragOver ? 'border-[var(--color-accent)]' : 'border-[#333]'
          }`}
        >
          <div className="text-[11px] uppercase tracking-wider text-[#888] mb-2">1. Экспорт Telegram Desktop</div>
          <p className="text-xs text-[#AAA] mb-3">Перетащите zip или result.json (Экспорт истории чата → JSON).</p>
          <label className="inline-flex items-center gap-2 text-xs text-white border border-[#333] px-3 py-1.5 rounded-sm cursor-pointer hover:border-[var(--color-accent-border)]">
            Выбрать файл
            <input
              type="file"
              className="hidden"
              accept=".zip,.json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void uploadExport(file);
              }}
            />
          </label>
        </section>

        <section className="border border-[#222] rounded-sm p-5 bg-[#111] space-y-3">
          <div className="text-[11px] uppercase tracking-wider text-[#888]">или ссылка на публичный канал</div>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Телефон +7999…"
            className="w-full bg-[#0D0D0D] border border-[#333] rounded-sm px-3 py-2 text-sm text-white outline-none focus:border-[var(--color-accent-border)]"
          />
          <button
            type="button"
            onClick={() => void login()}
            className="text-xs px-3 py-1.5 border border-[#333] rounded-sm hover:border-[var(--color-accent-border)] cursor-pointer"
          >
            Войти в Telegram
          </button>
          {gram === 'code' && (
            <div className="flex gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Код из Telegram"
                className="flex-1 bg-[#0D0D0D] border border-[#333] rounded-sm px-3 py-2 text-sm text-white"
              />
              <button type="button" onClick={() => void sendCode()} className="text-xs px-3 py-1.5 border border-[#333] rounded-sm cursor-pointer">
                Код
              </button>
            </div>
          )}
          {gram === 'password' && (
            <div className="flex gap-2">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Облачный пароль"
                className="flex-1 bg-[#0D0D0D] border border-[#333] rounded-sm px-3 py-2 text-sm text-white"
              />
              <button type="button" onClick={() => void sendPassword()} className="text-xs px-3 py-1.5 border border-[#333] rounded-sm cursor-pointer">
                2FA
              </button>
            </div>
          )}
          <div className="text-[10px] text-[#666]">Статус входа: {gram || 'idle'}</div>
          <div className="flex gap-2">
            <input
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              placeholder="@channel или t.me/…"
              className="flex-1 bg-[#0D0D0D] border border-[#333] rounded-sm px-3 py-2 text-sm text-white"
            />
            <button
              type="button"
              onClick={() => void downloadChannel()}
              className="text-xs px-3 py-1.5 bg-[var(--color-accent)] text-white rounded-sm cursor-pointer"
            >
              Скачать
            </button>
          </div>
        </section>

        {status?.hasPackage && (
          <div className="text-xs border border-[#222] bg-[#111] rounded-sm p-3">
            Пакет: <span className="text-white">{status.title}</span> · {status.faqCount} FAQ
            {status.truncated ? ' · обрезано до 500 постов' : ''}
            <a href="/api/package.qlm" className="ml-2 text-[var(--color-accent-text)] underline">
              скачать .qlm
            </a>
          </div>
        )}

        <section className="border border-[#222] rounded-sm p-5 bg-[#111] space-y-3">
          <div className="text-[11px] uppercase tracking-wider text-[#888]">2–3. Токен BotFather и запуск</div>
          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="123456:ABC…"
            className="w-full bg-[#0D0D0D] border border-[#333] rounded-sm px-3 py-2 text-sm text-white outline-none focus:border-[var(--color-accent-border)]"
          />
          <p className="text-[10px] text-[#666] leading-relaxed">
            Mini App хостится на GitHub Pages (HTTPS). Бот только открывает эту ссылку. Прокси Bot API:{' '}
            {status?.proxy || 'выкл'}.
          </p>
          <input
            value={pagesUrl}
            onChange={(e) => setPagesUrl(e.target.value)}
            placeholder="https://user.github.io/qlm-telegram"
            className="w-full bg-[#0D0D0D] border border-[#333] rounded-sm px-3 py-2 text-sm text-white outline-none focus:border-[var(--color-accent-border)]"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={Boolean(busy) || !status?.hasPackage}
              onClick={() => void launch()}
              className="flex-1 py-2.5 rounded-sm bg-[var(--color-accent)] text-white text-sm font-bold disabled:opacity-40 cursor-pointer"
            >
              {busy || 'Запустить Mini App'}
            </button>
            <button
              type="button"
              disabled={Boolean(busy) || !status?.botRunning}
              onClick={() => void stop()}
              className="px-4 py-2.5 rounded-sm border border-[#333] text-sm text-[#AAA] hover:border-[#EF4444]/40 hover:text-[#F87171] disabled:opacity-30 cursor-pointer"
            >
              Стоп
            </button>
          </div>
          {status?.publicUrl && (
            <div className="text-xs text-[#AAA] space-y-1">
              <div>
                Mini App:{' '}
                <a
                  className="text-[var(--color-accent-text)] underline break-all"
                  href={/github\.io/i.test(status.publicUrl) ? status.publicUrl : `${status.publicUrl}/app`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {/github\.io/i.test(status.publicUrl) ? status.publicUrl : `${status.publicUrl}/app`}
                </a>
              </div>
              <div>
                Бот: {status.botRunning ? 'polling' : 'остановлен'}
                {status.botUsername ? ` @${status.botUsername}` : ''}
              </div>
            </div>
          )}
        </section>

        {warning && (
          <div className="text-xs text-[#FCD34D] border border-[#F59E0B]/40 bg-[#291b07] p-3 rounded-sm">{warning}</div>
        )}
        {status?.menuWarning && !warning && (
          <div className="text-xs text-[#FCD34D] border border-[#F59E0B]/40 bg-[#291b07] p-3 rounded-sm">{status.menuWarning}</div>
        )}
        {status?.botError && !status.botRunning && (
          <div className="text-xs text-[#F87171] border border-[#EF4444]/40 bg-[#220c10] p-3 rounded-sm">{status.botError}</div>
        )}

        {error && <div className="text-xs text-[#F87171] border border-[#EF4444]/40 bg-[#220c10] p-3 rounded-sm">{error}</div>}
        {status?.gram.error && <div className="text-xs text-[#F87171]">{status.gram.error}</div>}
      </div>
    </div>
  );
};
