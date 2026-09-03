import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const STATE_FILE = path.resolve(process.cwd(), 'data', 'tunnel.json');

interface TunnelState {
  pid: number;
  url: string;
  localPort: number;
}

let child: ChildProcess | null = null;
let lastUrl = '';

function readState(): TunnelState | null {
  try {
    if (!fs.existsSync(STATE_FILE)) return null;
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) as TunnelState;
  } catch {
    return null;
  }
}

function writeState(state: TunnelState) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

function clearState() {
  try {
    if (fs.existsSync(STATE_FILE)) fs.unlinkSync(STATE_FILE);
  } catch {
    /* ignore */
  }
}

function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function killPid(pid: number) {
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    } else {
      process.kill(pid, 'SIGTERM');
    }
  } catch {
    /* ignore */
  }
}

export function getTunnelUrl() {
  return lastUrl || readState()?.url || '';
}

export async function stopTunnel() {
  const state = readState();
  if (child?.pid) killPid(child.pid);
  else if (state?.pid) killPid(state.pid);
  child = null;
  lastUrl = '';
  clearState();
}

async function tunnelReachable(url: string): Promise<boolean> {
  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/`, { redirect: 'follow' });
    const text = await res.text();
    if (text.includes('Error 1033') || text.includes('Cloudflare Tunnel error')) return false;
    return res.ok || res.status === 404 || res.status === 200;
  } catch {
    return false;
  }
}

export async function restoreTunnel(): Promise<string> {
  const state = readState();
  if (!state?.pid || !state.url) return '';
  if (!pidAlive(state.pid)) {
    clearState();
    return '';
  }
  if (!(await tunnelReachable(state.url))) {
    killPid(state.pid);
    clearState();
    return '';
  }
  lastUrl = state.url;
  return state.url;
}

export async function startCloudflareTunnel(localPort: number): Promise<string> {
  const existing = await restoreTunnel();
  if (existing) {
    lastUrl = existing;
    return existing;
  }

  await stopTunnel();
  lastUrl = '';

  const bin = process.env.CLOUDFLARED_BIN || 'cloudflared';
  const args = ['tunnel', '--url', `http://127.0.0.1:${localPort}`, '--no-autoupdate'];

  child = spawn(bin, args, {
    detached: true,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      if (child?.pid) killPid(child.pid);
      reject(new Error('cloudflared не вернул URL за 25 секунд. Установите cloudflared и добавьте в PATH.'));
    }, 25000);

    const onData = (buf: Buffer) => {
      const text = buf.toString();
      const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (match && child?.pid) {
        lastUrl = match[0];
        writeState({ pid: child.pid, url: lastUrl, localPort });
        child.unref();
        clearTimeout(timeout);
        resolve(lastUrl);
      }
    };

    child?.stdout?.on('data', onData);
    child?.stderr?.on('data', onData);
    child?.on('error', (err) => {
      clearTimeout(timeout);
      reject(
        new Error(
          `Не удалось запустить cloudflared (${err.message}). Скачайте https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/`
        )
      );
    });
    child?.on('exit', (code) => {
      if (!lastUrl) {
        clearTimeout(timeout);
        clearState();
        reject(new Error(`cloudflared завершился с кодом ${code}`));
      } else {
        clearState();
        lastUrl = '';
      }
    });
  });
}
