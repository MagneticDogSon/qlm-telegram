import { ChannelDump, ChannelPost } from '../types';

const POST_LIMIT = 500;

type ExportTextPart = string | { type?: string; text?: string };

export interface TelegramExportMessage {
  id?: number;
  type?: string;
  date?: string;
  text?: ExportTextPart | ExportTextPart[];
  text_entities?: Array<{ type?: string; text?: string }>;
}

export interface TelegramExportJson {
  name?: string;
  type?: string;
  id?: number;
  messages?: TelegramExportMessage[];
}

export function extractExportText(text: ExportTextPart | ExportTextPart[] | undefined): string {
  if (!text) return '';
  if (typeof text === 'string') return text.trim();
  if (Array.isArray(text)) {
    return text
      .map((part) => (typeof part === 'string' ? part : part?.text || ''))
      .join('')
      .trim();
  }
  return (text.text || '').trim();
}

export function parseTelegramExportJson(raw: unknown, limit = POST_LIMIT): ChannelDump {
  const data = raw as TelegramExportJson;
  const title = (data.name || 'Telegram channel').trim();
  const messages = Array.isArray(data.messages) ? data.messages : [];
  const posts: ChannelPost[] = [];

  for (const msg of messages) {
    if (msg.type && msg.type !== 'message') continue;
    const text = extractExportText(msg.text);
    if (!text) continue;
    posts.push({
      id: typeof msg.id === 'number' ? msg.id : posts.length + 1,
      date: msg.date || '',
      text,
    });
    if (posts.length >= limit) break;
  }

  return {
    title,
    posts,
    truncated: messages.filter((m) => !m.type || m.type === 'message').length > posts.length,
    source: 'export',
  };
}

export function findResultJson(files: Record<string, string>): string | null {
  const names = Object.keys(files);
  const hit =
    names.find((n) => n.replace(/\\/g, '/').toLowerCase().endsWith('result.json')) ||
    names.find((n) => n.toLowerCase().endsWith('.json') && !n.toLowerCase().includes('__macosx'));
  return hit ? files[hit] : null;
}
