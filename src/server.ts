import './loadEnv';
import cors from 'cors';
import dns from 'node:dns';
import express from 'express';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import JSZip from 'jszip';
import { applyMenuButton, setMenuButtonOnly, startBot, stopBot } from './bot/index';
import { findResultJson, parseTelegramExportJson } from './ingest/exportParser';
import {
  downloadPublicChannel,
  getGramStatus,
  startGramLogin,
  submitGramCode,
  submitGramPassword,
} from './ingest/gramjsDownload';
import { channelDumpToQlm } from './qlm/fromChannel';
import { clearLaunch, loadLaunch, loadPersisted, persistBuilt, publicStatus, runtime, zipPath } from './store';

dns.setDefaultResultOrder('ipv4first');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8787);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 80 * 1024 * 1024 } });

const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));

app.get('/api/status', (_req, res) => {
  res.json({ ...publicStatus(), gram: getGramStatus() });
});

app.get('/api/package', (_req, res) => {
  if (!runtime.context) {
    res.status(404).json({ error: 'Пакет ещё не создан' });
    return;
  }
  res.json(runtime.context);
});

app.get('/api/package.qlm', (_req, res) => {
  const file = zipPath();
  if (!fs.existsSync(file)) {
    res.status(404).send('no package');
    return;
  }
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="channel.qlm"');
  res.sendFile(file);
});

app.post('/api/import-export', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'Перетащите zip или result.json экспорта Telegram Desktop' });
      return;
    }
    let jsonText = '';
    const name = req.file.originalname.toLowerCase();
    if (name.endsWith('.json')) {
      jsonText = req.file.buffer.toString('utf8');
    } else {
      const zip = await JSZip.loadAsync(req.file.buffer);
      const files: Record<string, string> = {};
      for (const entry of Object.keys(zip.files)) {
        if (zip.files[entry].dir) continue;
        if (!entry.toLowerCase().endsWith('.json')) continue;
        files[entry] = await zip.files[entry].async('string');
      }
      const found = findResultJson(files);
      if (!found) {
        res.status(400).json({ error: 'В архиве нет result.json экспорта Telegram' });
        return;
      }
      jsonText = found;
    }
    const dump = parseTelegramExportJson(JSON.parse(jsonText));
    if (!dump.posts.length) {
      res.status(400).json({ error: 'В экспорте нет текстовых постов' });
      return;
    }
    const built = channelDumpToQlm(dump);
    const ctx = await persistBuilt(built);
    res.json({
      ok: true,
      title: built.title,
      faqCount: ctx.faqItems?.length || 0,
      truncated: built.truncated,
    });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.post('/api/telegram/login', async (req, res) => {
  try {
    const phone = String(req.body?.phone || '').trim();
    if (!phone) {
      res.status(400).json({ error: 'Укажите номер телефона' });
      return;
    }
    const result = await startGramLogin(phone);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.post('/api/telegram/code', (req, res) => {
  submitGramCode(String(req.body?.code || ''));
  res.json({ ok: true });
});

app.post('/api/telegram/password', (req, res) => {
  submitGramPassword(String(req.body?.password || ''));
  res.json({ ok: true });
});

app.get('/api/telegram/status', (_req, res) => {
  res.json(getGramStatus());
});

app.post('/api/telegram/download', async (req, res) => {
  try {
    const channel = String(req.body?.channel || '').trim();
    const dump = await downloadPublicChannel(channel);
    if (!dump.posts.length) {
      res.status(400).json({ error: 'Не удалось получить текстовые посты канала' });
      return;
    }
    const built = channelDumpToQlm(dump);
    const ctx = await persistBuilt(built);
    res.json({
      ok: true,
      title: built.title,
      faqCount: ctx.faqItems?.length || 0,
      truncated: built.truncated,
    });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

function normalizePagesUrl(raw: string): string {
  const url = raw.trim().replace(/\/$/, '');
  if (!url) return '';
  return url;
}

function isValidPagesUrl(url: string): boolean {
  return /^https:\/\/[a-z0-9-]+\.github\.io\/[a-z0-9_.-]+$/i.test(url);
}

app.post('/api/launch', async (req, res) => {
  try {
    const token = String(req.body?.token || runtime.botToken || '').trim();
    if (!token) {
      res.status(400).json({ error: 'Вставьте токен от @BotFather' });
      return;
    }
    if (!runtime.context) {
      res.status(400).json({ error: 'Сначала импортируйте канал' });
      return;
    }
    const pagesUrl = normalizePagesUrl(
      String(req.body?.pagesUrl || process.env.GITHUB_PAGES_URL || '')
    );
    if (!pagesUrl) {
      res.status(400).json({ error: 'Укажите URL GitHub Pages (https://user.github.io/repo)' });
      return;
    }
    if (!isValidPagesUrl(pagesUrl)) {
      res.status(400).json({
        error: 'URL должен быть вида https://user.github.io/repo. Cloudflare-туннели больше не поддерживаются.',
      });
      return;
    }
    runtime.publicUrl = pagesUrl;
    let started: { username: string; menuWarning?: string } | null = null;
    try {
      started = await startBot(token);
    } catch (pollErr) {
      // Polling may fail through a flaky proxy, but the menu button is already set
      // (startBot sets it before polling). The Mini App still opens via the menu button.
      const message = pollErr instanceof Error ? pollErr.message : String(pollErr);
      runtime.botError = message;
      console.error('[bot] launch: polling failed but menu button was set:', message);
    }
    await applyMenuButton(pagesUrl);
    const miniAppUrl = /github\.io/i.test(pagesUrl) ? `${pagesUrl}/` : `${pagesUrl}/app`;
    res.json({
      ok: true,
      publicUrl: pagesUrl,
      miniAppUrl,
      botRunning: runtime.botRunning,
      botUsername: runtime.botUsername,
      warning: runtime.menuWarning || undefined,
      botError: runtime.botError || undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const hint = /getMe|Network request/i.test(message)
      ? `${message} Это api.telegram.org. В РФ Bot API часто режется — проверьте TELEGRAM_PROXY в .env.`
      : message;
    res.status(400).json({ error: hint });
  }
});

app.post('/api/set-menu', async (req, res) => {
  try {
    const token = String(req.body?.token || runtime.botToken || '').trim();
    if (!token) {
      res.status(400).json({ error: 'Вставьте токен от @BotFather' });
      return;
    }
    const pagesUrl = normalizePagesUrl(
      String(req.body?.pagesUrl || process.env.GITHUB_PAGES_URL || '')
    );
    if (!isValidPagesUrl(pagesUrl)) {
      res.status(400).json({ error: 'Укажите корректный URL GitHub Pages (https://user.github.io/repo)' });
      return;
    }
    const result = await setMenuButtonOnly(token, pagesUrl);
    res.json({
      ok: true,
      publicUrl: pagesUrl,
      miniAppUrl: /github\.io/i.test(pagesUrl) ? `${pagesUrl}/` : `${pagesUrl}/app`,
      botUsername: result.username,
      warning: result.warning || undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const hint = /getMe|Network request/i.test(message)
      ? `${message} Это api.telegram.org. В РФ Bot API часто режется — проверьте TELEGRAM_PROXY в .env.`
      : message;
    res.status(400).json({ error: hint });
  }
});

app.post('/api/stop', async (_req, res) => {
  await stopBot();
  clearLaunch();
  runtime.publicUrl = '';
  runtime.menuWarning = '';
  runtime.botError = '';
  res.json({ ok: true });
});

const distDir = path.resolve(__dirname, '../dist');
const devUi = process.argv.includes('--dev-ui');

if (devUi) {
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    const upstream = http.request(
      {
        hostname: '127.0.0.1',
        port: 3000,
        path: req.originalUrl,
        method: req.method,
        headers: { ...req.headers, host: '127.0.0.1:3000' },
      },
      (incoming) => {
        res.writeHead(incoming.statusCode || 502, incoming.headers);
        incoming.pipe(res);
      }
    );
    upstream.on('error', () => {
      res.status(502).type('html').send('Запустите Vite на порту 3000 (npm run dev).');
    });
    req.pipe(upstream);
  });
} else if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distDir, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => {
    res.type('html').send(
      `<p>Соберите фронт: <code>npm run build</code>, затем <code>npm start</code>. Либо <code>npm run dev</code>.</p>`
    );
  });
}

await loadPersisted();
if (process.env.GITHUB_PAGES_URL) {
  runtime.publicUrl = process.env.GITHUB_PAGES_URL.replace(/\/$/, '');
}

app.listen(PORT, () => {
  console.log(`QLM Telegram API http://127.0.0.1:${PORT}`);
});

const savedLaunch = loadLaunch();
if (savedLaunch?.token) {
  if (savedLaunch.publicUrl) runtime.publicUrl = savedLaunch.publicUrl;
  try {
    await startBot(savedLaunch.token);
    if (runtime.publicUrl) await applyMenuButton(runtime.publicUrl);
  } catch (err) {
    console.error('[bot] restore failed:', err instanceof Error ? err.message : err);
  }
}
