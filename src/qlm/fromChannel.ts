import { ChannelDump, ChannelPost, FaqData, FaqItem } from '../types';
import { FAQ_VERSION, QLM_SCHEMA, normalizeFaqData, slugifyId } from '../engine/faqIndex';

export const POST_LIMIT = 500;

const MONTHS_RU = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
];

function monthSection(dateIso: string): string {
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return 'Посты';
  return `${MONTHS_RU[d.getMonth()]} ${d.getFullYear()}`;
}

function firstSentence(text: string, max = 80): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  const m = cleaned.match(/^(.+?[.!?…])(\s|$)/);
  const sentence = (m?.[1] || cleaned).trim();
  if (sentence.length <= max) return sentence;
  return `${sentence.slice(0, max).trim()}…`;
}

function splitLongPost(text: string): string[] {
  if (text.length <= 800) return [text.trim()].filter(Boolean);
  const parts = text.split(/\n\s*\n+/).map((p) => p.trim()).filter((p) => p.length > 40);
  if (parts.length <= 1) return [text.trim()];
  return parts;
}

export interface BuiltQlm {
  title: string;
  article: string;
  faq: FaqData;
  truncated: boolean;
}

export function channelDumpToQlm(dump: ChannelDump, limit = POST_LIMIT): BuiltQlm {
  const posts = dump.posts.slice(0, limit);
  const truncated = dump.truncated || dump.posts.length > limit;

  const byMonth = new Map<string, ChannelPost[]>();
  for (const post of posts) {
    const key = monthSection(post.date);
    const list = byMonth.get(key) || [];
    list.push(post);
    byMonth.set(key, list);
  }

  const lines: string[] = [`# ${dump.title}`, ''];
  if (dump.username) lines.push(`Канал: @${dump.username.replace(/^@/, '')}`, '');

  const items: FaqItem[] = [];
  let idx = 0;

  for (const [section, sectionPosts] of byMonth) {
    const sectionId = slugifyId(section, 'section');
    lines.push(`## ${section}`, '');
    for (const post of sectionPosts) {
      const chunks = splitLongPost(post.text);
      for (const chunk of chunks) {
        lines.push(chunk, '');
        const question = firstSentence(chunk);
        const shortAlias = firstSentence(chunk, 48);
        items.push({
          id: slugifyId(`${section}-${idx}`, `post-${idx}`),
          doc_id: 'article.md',
          question,
          answer: chunk,
          aliases: shortAlias !== question ? [shortAlias] : [],
          section,
          section_id: sectionId,
          isBase: true,
        });
        idx += 1;
      }
    }
  }

  for (let i = 0; i < items.length; i++) {
    const next: string[] = [];
    if (items[i + 1]?.id) next.push(items[i + 1].id as string);
    if (items[i + 2]?.id) next.push(items[i + 2].id as string);
    if (i > 0 && items[i - 1]?.id) next.push(items[i - 1].id as string);
    items[i].next = next.slice(0, 3);
  }

  const faq = normalizeFaqData(
    {
      version: FAQ_VERSION,
      schema: QLM_SCHEMA,
      title: dump.title,
      description: `База знаний по каналу «${dump.title}» (${items.length} фрагментов)`,
      source_document: 'article.md',
      items,
    },
    'article.md'
  );

  return {
    title: dump.title,
    article: lines.join('\n').trim() + '\n',
    faq,
    truncated,
  };
}
