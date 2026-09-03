import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { ChannelDump, ChannelPost } from '../types';
import { POST_LIMIT } from '../qlm/fromChannel';
import { gramjsProxyOptions } from '../telegramProxy';
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const SESSION_FILE = path.join(DATA_DIR, 'telegram.session');

function clientParams() {
  const proxy = gramjsProxyOptions();
  if (proxy?.socksType === 4 || proxy?.socksType === 5) {
    return {
      connectionRetries: 5,
      proxy: {
        ip: proxy.ip,
        port: proxy.port,
        socksType: proxy.socksType,
        username: proxy.username,
        password: proxy.password,
      },
    };
  }
  return { connectionRetries: 5 };
}

function apiCredentials(): { apiId: number; apiHash: string } {
  const apiId = Number(process.env.TELEGRAM_API_ID || '2040');
  const apiHash = process.env.TELEGRAM_API_HASH || 'b18441a1ff607e10a989891a5462e627';
  return { apiId, apiHash };
}

export type GramAuthStatus = 'idle' | 'code' | 'password' | 'ready' | 'error';

interface AuthWaiters {
  client?: TelegramClient;
  status: GramAuthStatus;
  error?: string;
  resolveCode?: (code: string) => void;
  resolvePassword?: (pw: string) => void;
  loginPromise?: Promise<void>;
}

const waiters: AuthWaiters = { status: 'idle' };

function loadSession(): string {
  try {
    if (fs.existsSync(SESSION_FILE)) return fs.readFileSync(SESSION_FILE, 'utf8').trim();
  } catch {
    /* ignore */
  }
  return '';
}

function saveSession(session: string) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(SESSION_FILE, session, 'utf8');
}

export function getGramStatus(): { status: GramAuthStatus; error?: string } {
  return { status: waiters.status, error: waiters.error };
}

export async function startGramLogin(phone: string): Promise<{ status: GramAuthStatus }> {
  if (waiters.loginPromise && (waiters.status === 'code' || waiters.status === 'password')) {
    return { status: waiters.status };
  }

  const { apiId, apiHash } = apiCredentials();
  const client = new TelegramClient(new StringSession(loadSession()), apiId, apiHash, clientParams());
  waiters.client = client;
  waiters.status = 'code';
  waiters.error = undefined;

  waiters.loginPromise = client
    .start({
      phoneNumber: async () => phone,
      phoneCode: async () =>
        new Promise<string>((resolve) => {
          waiters.status = 'code';
          waiters.resolveCode = resolve;
        }),
      password: async () =>
        new Promise<string>((resolve) => {
          waiters.status = 'password';
          waiters.resolvePassword = resolve;
        }),
      onError: (err) => {
        waiters.status = 'error';
        waiters.error = err instanceof Error ? err.message : String(err);
      },
    })
    .then(() => {
      saveSession(client.session.save() as unknown as string);
      waiters.status = 'ready';
    })
    .catch((err) => {
      waiters.status = 'error';
      waiters.error = err instanceof Error ? err.message : String(err);
    });

  await new Promise((r) => setTimeout(r, 400));
  return { status: waiters.status };
}

export function submitGramCode(code: string) {
  waiters.resolveCode?.(code.trim());
}

export function submitGramPassword(password: string) {
  waiters.resolvePassword?.(password);
}

export async function downloadPublicChannel(input: string, limit = POST_LIMIT): Promise<ChannelDump> {
  const username = input
    .trim()
    .replace(/^https?:\/\/(t\.me|telegram\.me)\//i, '')
    .replace(/^@/, '')
    .split(/[/?#]/)[0];

  if (!username) throw new Error('Укажите @username или ссылку на канал');

  let client = waiters.client;
  if (!client || waiters.status !== 'ready') {
    const { apiId, apiHash } = apiCredentials();
    client = new TelegramClient(new StringSession(loadSession()), apiId, apiHash, clientParams());
    await client.connect();
    if (!(await client.checkAuthorization())) {
      throw new Error('Сначала войдите в Telegram (телефон и код)');
    }
    waiters.client = client;
    waiters.status = 'ready';
  }

  const entity = await client.getEntity(username);
  const posts: ChannelPost[] = [];

  for await (const message of client.iterMessages(entity, { limit })) {
    const text = (message.message || '').trim();
    if (!text) continue;
    const rawDate = message.date as unknown;
    const date =
      typeof rawDate === 'number'
        ? new Date(rawDate * 1000).toISOString()
        : rawDate && typeof rawDate === 'object' && 'toISOString' in rawDate
          ? (rawDate as Date).toISOString()
          : '';
    posts.push({
      id: message.id,
      date,
      text,
    });
  }

  posts.reverse();
  const title =
    ('title' in entity && typeof entity.title === 'string' && entity.title) ||
    username;

  return {
    title,
    username,
    posts: posts.slice(0, limit),
    truncated: posts.length >= limit,
    source: 'gramjs',
  };
}
