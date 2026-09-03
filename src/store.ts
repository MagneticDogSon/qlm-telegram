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
  tunnelUrl: string;
  truncated: boolean;
  faqCount: number;
  title: string;
  menuWarning: string;
}

export const runtime: RuntimeState = {
  context: null,
  botToken: '',
  publicUrl: '',
  botRunning: false,
  tunnelUrl: '',
  truncated: false,
  faqCount: 0,
  title: '',
  menuWarning: '',
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
    tunnelUrl: runtime.tunnelUrl,
    publicUrl: runtime.publicUrl,
    hasPackage: Boolean(runtime.context),
    hasToken: Boolean(runtime.botToken),
    menuWarning: runtime.menuWarning,
    proxy: telegramProxyHost() || null,
    pagesUrl: process.env.GITHUB_PAGES_URL || '',
  };
}
