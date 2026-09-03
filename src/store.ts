import fs from 'node:fs';
import path from 'node:path';
import { FileContext } from './types';
import { builtToFileContext, builtQlmToZipBuffer, zipBufferToFileContext } from './qlm/package';
import { BuiltQlm } from './qlm/fromChannel';
import { telegramProxyHost } from './telegramProxy';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const CTX_FILE = path.join(DATA_DIR, 'context.json');
const ZIP_FILE = path.join(DATA_DIR, 'channel.qlm');

export interface RuntimeState {
  context: FileContext | null;
  botToken: string;
  publicUrl: string;
  botRunning: boolean;
  botUsername: string;
  truncated: boolean;
  faqCount: number;
  title: string;
  menuWarning: string;
  botError: string;
}

export const runtime: RuntimeState = {
  context: null,
  botToken: '',
  publicUrl: '',
  botRunning: false,
  botUsername: '',
  truncated: false,
  faqCount: 0,
  title: '',
  menuWarning: '',
  botError: '',
};

export function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export async function persistBuilt(built: BuiltQlm) {
  ensureDataDir();
  const ctx = builtToFileContext(built);
  runtime.context = ctx;
  runtime.title = built.title;
  runtime.truncated = built.truncated;
  runtime.faqCount = ctx.faqItems?.length || 0;
  fs.writeFileSync(CTX_FILE, JSON.stringify(ctx), 'utf8');
  const zip = await builtQlmToZipBuffer(built, ctx.name.replace(/\.qlm$/i, ''));
  fs.writeFileSync(ZIP_FILE, zip);
  const publicDir = path.resolve(process.cwd(), 'public');
  fs.mkdirSync(publicDir, { recursive: true });
  fs.writeFileSync(path.join(publicDir, 'qlm-package.json'), JSON.stringify(ctx), 'utf8');
  return ctx;
}

export async function loadPersisted(): Promise<FileContext | null> {
  try {
    if (fs.existsSync(ZIP_FILE)) {
      const buf = fs.readFileSync(ZIP_FILE);
      runtime.context = await zipBufferToFileContext(buf);
      runtime.faqCount = runtime.context.faqItems?.length || 0;
      runtime.title = runtime.context.faq?.title || runtime.context.name;
      return runtime.context;
    }
    if (fs.existsSync(CTX_FILE)) {
      runtime.context = JSON.parse(fs.readFileSync(CTX_FILE, 'utf8')) as FileContext;
      runtime.faqCount = runtime.context.faqItems?.length || 0;
      runtime.title = runtime.context.faq?.title || runtime.context.name;
      return runtime.context;
    }
  } catch {
    runtime.context = null;
  }
  return runtime.context;
}

export function zipPath() {
  return ZIP_FILE;
}

export function publicStatus() {
  return {
    title: runtime.title,
    faqCount: runtime.faqCount,
    truncated: runtime.truncated,
    botRunning: runtime.botRunning,
    botUsername: runtime.botUsername,
    publicUrl: runtime.publicUrl,
    hasPackage: Boolean(runtime.context),
    hasToken: Boolean(runtime.botToken),
    menuWarning: runtime.menuWarning,
    botError: runtime.botError,
    proxy: telegramProxyHost() || null,
    pagesUrl: process.env.GITHUB_PAGES_URL || '',
  };
}

const LAUNCH_FILE = path.join(DATA_DIR, 'launch.json');

export function saveLaunch(token: string, publicUrl: string) {
  ensureDataDir();
  fs.writeFileSync(LAUNCH_FILE, JSON.stringify({ token, publicUrl }), 'utf8');
}

export function loadLaunch(): { token: string; publicUrl: string } | null {
  try {
    if (!fs.existsSync(LAUNCH_FILE)) return null;
    const data = JSON.parse(fs.readFileSync(LAUNCH_FILE, 'utf8')) as { token?: string; publicUrl?: string };
    if (!data.token) return null;
    const url = (data.publicUrl || '').replace(/\/$/, '');
    if (url && !/^https:\/\/[a-z0-9-]+\.github\.io\//i.test(url)) return null;
    return { token: data.token, publicUrl: url };
  } catch {
    return null;
  }
}

export function clearLaunch() {
  try {
    if (fs.existsSync(LAUNCH_FILE)) fs.unlinkSync(LAUNCH_FILE);
  } catch {
    /* ignore */
  }
}
