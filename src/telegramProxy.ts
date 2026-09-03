import { HttpsProxyAgent } from 'https-proxy-agent';
import { ProxyAgent, fetch as undiciFetch } from 'undici';
import './loadEnv';

export function telegramProxyUrl(): string | undefined {
  const raw =
    process.env.TELEGRAM_PROXY ||
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy;
  const trimmed = raw?.trim();
  return trimmed || undefined;
}

export function telegramProxyHost(): string | undefined {
  const url = telegramProxyUrl();
  if (!url) return undefined;
  try {
    return new URL(url).host;
  } catch {
    return 'configured';
  }
}

let agent: ProxyAgent | undefined;

function proxyAgent(): ProxyAgent | undefined {
  const url = telegramProxyUrl();
  if (!url) return undefined;
  if (!agent) {
    const parsed = new URL(url);
    const uri = `${parsed.protocol}//${parsed.host}`;
    const user = decodeURIComponent(parsed.username);
    const pass = decodeURIComponent(parsed.password);
    agent = new ProxyAgent({
      uri,
      ...(user || pass
        ? { auth: Buffer.from(`${user}:${pass}`).toString('base64') }
        : {}),
      proxyTunnel: true,
    });
  }
  return agent;
}

export function telegramFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const dispatcher = proxyAgent();
  if (!dispatcher) return fetch(input, init);
  return undiciFetch(input as string | URL, { ...(init as object), dispatcher }) as Promise<Response>;
}

export function grammyClientOptions():
  | {
      baseFetchConfig: {
        agent: InstanceType<typeof HttpsProxyAgent>;
        compress: boolean;
        duplex: 'half';
      };
      timeoutSeconds: number;
    }
  | undefined {
  const url = telegramProxyUrl();
  if (!url) return undefined;
  return {
    baseFetchConfig: {
      compress: true,
      duplex: 'half' as const,
      agent: new HttpsProxyAgent(url),
    },
    timeoutSeconds: 20,
  };
}

/** GramJS MTProto: SOCKS5 via TELEGRAM_SOCKS_PROXY, иначе HTTP CONNECT из TELEGRAM_PROXY. */
export function gramjsProxyOptions():
  | {
      ip: string;
      port: number;
      socksType?: 4 | 5;
      username?: string;
      password?: string;
    }
  | undefined {
  const socks = process.env.TELEGRAM_SOCKS_PROXY?.trim();
  const raw = socks || telegramProxyUrl();
  if (!raw) return undefined;
  try {
    const u = new URL(raw);
    const port = Number(u.port || (u.protocol === 'https:' ? 443 : 80));
    if (!u.hostname || !port) return undefined;
    const socksType: 4 | 5 | undefined = socks || u.protocol.startsWith('socks') ? 5 : undefined;
    return {
      ip: u.hostname,
      port,
      ...(socksType ? { socksType } : {}),
      username: u.username ? decodeURIComponent(u.username) : undefined,
      password: u.password ? decodeURIComponent(u.password) : undefined,
    };
  } catch {
    return undefined;
  }
}
