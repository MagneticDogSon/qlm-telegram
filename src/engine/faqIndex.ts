import { FaqData, FaqItem, FileContext, MessageCitation, QlmManifest } from '../types';

export const QLM_SCHEMA = 'qlm/2';
export const FAQ_VERSION = 'qlm_faq_v2';
export const FAQ_CACHE_MIN_SCORE = 0.78;

const CYR: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'j',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
  х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

export function slugifyId(text: string, fallback = 'item'): string {
  const raw = (text || '').trim().toLowerCase();
  if (!raw) return fallback;
  let out = '';
  for (const ch of raw) {
    if (CYR[ch] !== undefined) out += CYR[ch];
    else if (/[a-z0-9]/.test(ch)) out += ch;
    else out += '-';
  }
  const slug = out.replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
  return slug || fallback;
}

function uniqueId(base: string, used: Set<string>): string {
  let id = base || 'item';
  let n = 2;
  while (used.has(id)) {
    id = `${base}-${n++}`;
  }
  used.add(id);
  return id;
}

export function normalizeQuery(text: string): string {
  return (text || '')
    .toLowerCase()
    .replace(/[?.,!;:]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenizeQuery(text: string): string[] {
  return normalizeQuery(text)
    .split(/[\s,?.!;:()"«»„“”—–"'-]+/)
    .filter((t) => t.length > 1);
}

export function faqPhrases(item: FaqItem): string[] {
  const list = [item.question, ...(item.aliases || [])].filter(
    (s): s is string => typeof s === 'string' && s.trim().length > 0
  );
  return [...new Set(list.map((s) => s.trim()))];
}

export function scoreFaqItem(query: string, item: FaqItem): number {
  const nq = normalizeQuery(query);
  if (!nq || !item.question) return 0;

  const qTokens = tokenizeQuery(query);
  let best = 0;

  for (const phrase of faqPhrases(item)) {
    const np = normalizeQuery(phrase);
    if (np === nq) return 1;
    if (np.startsWith(nq) && nq.length >= 8) {
      best = Math.max(best, 0.86 + 0.12 * Math.min(1, nq.length / Math.max(np.length, 1)));
    }
    if (nq.startsWith(np) && np.length >= 14) {
      best = Math.max(best, 0.9);
    }

    const pTokens = tokenizeQuery(phrase);
    if (qTokens.length >= 2 && pTokens.length > 0) {
      const hit = qTokens.filter((t) =>
        pTokens.some((pt) => pt === t || pt.includes(t) || t.includes(pt))
      ).length;
      const coverage = hit / qTokens.length;
      if (coverage === 1 && qTokens.length >= 3) best = Math.max(best, 0.84);
      else if (coverage >= 0.85 && qTokens.length >= 3) best = Math.max(best, 0.74);
    }
  }

  const keywords = item.keywords || [];
  if (keywords.length > 0) {
    const hits = keywords.filter((k) => k && nq.includes(k.toLowerCase())).length;
    if (hits >= 2) best = Math.max(best, 0.81);
  }

  return best;
}

export function matchFaqItem(
  query: string,
  items: FaqItem[] | undefined,
  minScore = FAQ_CACHE_MIN_SCORE
): { item: FaqItem; score: number } | null {
  if (!items || items.length === 0) return null;
  let best: FaqItem | null = null;
  let bestScore = 0;
  for (const item of items) {
    if (!item.answer) continue;
    const score = scoreFaqItem(query, item);
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }
  if (!best || bestScore < minScore) return null;
  return { item: best, score: bestScore };
}

export function bestGhostQuestion(query: string, items: FaqItem[] | undefined): string | null {
  return rankFaqQuestions(query, items, 1)[0]?.completion || null;
}

export interface RankedFaq {
  item: FaqItem;
  score: number;
  ghostSuffix: string;
  completion: string;
}

export function faqGhostSuffix(input: string, phrase: string): string {
  if (!input || !phrase) return '';
  if (phrase.toLowerCase().startsWith(input.toLowerCase())) {
    return phrase.slice(input.length);
  }
  return '';
}

export function rankFaqQuestions(
  query: string,
  items: FaqItem[] | undefined,
  limit = 5
): RankedFaq[] {
  if (!items?.length || !query.trim()) return [];

  const ranked: RankedFaq[] = [];
  for (const item of items) {
    const canonical = item.question?.trim();
    if (!canonical) continue;

    let ghostSuffix = '';
    let completion = canonical;
    let prefixScore = 0;

    if (query.trim().length >= 2) {
      for (const phrase of faqPhrases(item)) {
        const suffix = faqGhostSuffix(query, phrase);
        if (!suffix && phrase.toLowerCase() !== query.toLowerCase()) continue;
        if (phrase.toLowerCase().startsWith(query.toLowerCase())) {
          const remain = Math.max(0, phrase.length - query.length);
          const score = 1000 + (120 - Math.min(120, remain));
          const preferCanonical = phrase === canonical && score >= prefixScore;
          if (score > prefixScore || preferCanonical) {
            prefixScore = score;
            ghostSuffix = suffix;
            completion = phrase;
          }
        }
      }
    }

    const semantic = scoreFaqItem(query, item) * 1000;
    const score = Math.max(prefixScore, semantic);
    if (!ghostSuffix && score < 200) continue;
    ranked.push({ item, score, ghostSuffix, completion });
  }

  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const aPrefix = a.ghostSuffix ? 1 : 0;
    const bPrefix = b.ghostSuffix ? 1 : 0;
    if (bPrefix !== aPrefix) return bPrefix - aPrefix;
    return a.completion.length - b.completion.length;
  });

  return ranked.slice(0, limit);
}

function lookupItem(ref: string, items: FaqItem[], byId: Map<string, FaqItem>, byQ: Map<string, FaqItem>): FaqItem | undefined {
  const trimmed = ref.trim();
  if (!trimmed) return undefined;
  const direct = byId.get(trimmed);
  if (direct) return direct;
  const byQuestion = byQ.get(normalizeQuery(trimmed));
  if (byQuestion) return byQuestion;
  let best: FaqItem | undefined;
  let bestScore = 0;
  for (const item of items) {
    const score = scoreFaqItem(trimmed, item);
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }
  if (best && bestScore >= 0.86) return best;
  return undefined;
}

export function followUpQuestionTexts(item: FaqItem, items: FaqItem[]): string[] {
  const byId = new Map<string, FaqItem>();
  const byQ = new Map<string, FaqItem>();
  for (const f of items) {
    if (f.id) byId.set(f.id, f);
    byQ.set(normalizeQuery(f.question), f);
  }

  const texts: string[] = [];
  const seen = new Set<string>();
  const add = (q: string) => {
    const t = q.trim();
    const key = normalizeQuery(t);
    if (!t || seen.has(key) || key === normalizeQuery(item.question)) return;
    seen.add(key);
    texts.push(t);
  };

  const refs = [
    ...(item.next || []),
    ...(item.relatedQuestionIds || []),
    ...(item.nextQuestions || []),
  ];

  for (const ref of refs) {
    if (typeof ref !== 'string') continue;
    const found = lookupItem(ref, items, byId, byQ);
    if (found) add(found.question);
    else if (!byId.has(ref.trim())) add(ref);
  }

  return texts;
}

export function normalizeFaqItems(items: FaqItem[], markdownFileName = 'article.md'): FaqItem[] {
  if (!Array.isArray(items) || items.length === 0) return [];

  const used = new Set<string>();
  const drafted: FaqItem[] = items.map((item, idx) => {
    const question = (item.question || '').trim();
    const aliases = (item.aliases || [])
      .filter((a) => typeof a === 'string' && a.trim())
      .map((a) => a.trim())
      .filter((a) => normalizeQuery(a) !== normalizeQuery(question));
    const keywords = (item.keywords || [])
      .filter((k) => typeof k === 'string' && k.trim())
      .map((k) => k.trim());
    const section = (item.section || '').trim();
    const section_id = item.section_id || (section ? slugifyId(section, 'section') : undefined);
    const rawId = (item.id || '').trim();
    const base = slugifyId(rawId && !rawId.includes(':') ? rawId : question, `q-${idx}`);
    const id = uniqueId(base, used);
    const source = item.source || (section_id
      ? { file: item.doc_id || markdownFileName, heading: section || undefined, anchor: section_id }
      : undefined);

    return {
      ...item,
      id,
      doc_id: item.doc_id || markdownFileName,
      question: question || `Вопрос #${idx + 1}`,
      answer: (item.answer || '').trim(),
      aliases,
      keywords,
      section: section || undefined,
      section_id,
      source,
    };
  });

  const byId = new Map(drafted.map((i) => [i.id as string, i]));
  const byQ = new Map(drafted.map((i) => [normalizeQuery(i.question), i]));

  return drafted.map((item) => {
    const refs = [
      ...(item.next || []),
      ...(item.relatedQuestionIds || []),
      ...(item.nextQuestions || []),
    ];
    const nextIds: string[] = [];
    const seen = new Set<string>();
    for (const ref of refs) {
      if (typeof ref !== 'string') continue;
      const found = lookupItem(ref, drafted, byId, byQ);
      const nid = found?.id;
      if (!nid || nid === item.id || seen.has(nid)) continue;
      seen.add(nid);
      nextIds.push(nid);
    }
    const nextQuestions = nextIds
      .map((id) => byId.get(id)?.question)
      .filter((q): q is string => !!q);

    return {
      ...item,
      next: nextIds,
      relatedQuestionIds: nextIds,
      nextQuestions,
    };
  });
}

export function normalizeFaqData(
  faq: FaqData | undefined,
  markdownFileName = 'article.md'
): FaqData {
  const items = normalizeFaqItems(faq?.items || [], markdownFileName);
  return {
    version: FAQ_VERSION,
    schema: QLM_SCHEMA,
    title: faq?.title,
    description: faq?.description,
    source_document: faq?.source_document || markdownFileName,
    created_at: faq?.created_at || new Date().toISOString(),
    items,
  };
}

export function hydrateFileContext(ctx: FileContext | null | undefined): FileContext | null {
  if (!ctx) return null;
  const mdName = ctx.markdownFileName || 'article.md';
  const faq = normalizeFaqData(ctx.faq || { version: FAQ_VERSION, items: ctx.faqItems || [] }, mdName);
  return {
    ...ctx,
    markdownFileName: mdName,
    faq,
    faqItems: faq.items,
  };
}

export function headingAnchorFromTitle(title: string): string {
  return slugifyId(title.replace(/\s*\{#[a-zA-Z0-9_-]+\}\s*$/, ''), 'section');
}

export function stripHeadingAnchor(title: string): { title: string; anchor?: string } {
  const match = title.trim().match(/^(.*?)\s*\{#([a-zA-Z0-9_-]+)\}\s*$/);
  if (match) return { title: match[1].trim(), anchor: match[2] };
  return { title: title.trim() };
}

export function ensureHeadingAnchors(markdown: string): string {
  if (!markdown) return markdown;
  return markdown
    .split('\n')
    .map((line) => {
      const m = line.match(/^(#{1,6})\s+(.+)$/);
      if (!m) return line;
      const { title, anchor } = stripHeadingAnchor(m[2]);
      const id = anchor || headingAnchorFromTitle(title);
      return `${m[1]} ${title} {#${id}}`;
    })
    .join('\n');
}

export function buildQlmManifest(opts: {
  title?: string;
  description?: string;
  language?: string;
  packageName?: string;
  articleFile?: string;
  items: FaqItem[];
  hasLearned?: boolean;
}): QlmManifest {
  const sections = [...new Set(opts.items.map((i) => i.section).filter((s): s is string => !!s))];
  return {
    schema: QLM_SCHEMA,
    title: opts.title,
    description: opts.description,
    language: opts.language,
    created_at: new Date().toISOString(),
    package_name: opts.packageName,
    files: {
      article: opts.articleFile || 'article.md',
      faq: 'faq.json',
      ...(opts.hasLearned ? { learned: 'learned.json' } : {}),
    },
    faq_count: opts.items.filter((i) => !i.isLearned).length,
    sections,
  };
}

export function citationFromFaqItem(
  item: FaqItem,
  fileContext: FileContext | null,
  fallback?: MessageCitation
): MessageCitation | undefined {
  if (!fileContext?.content) return fallback;
  const anchor = item.source?.anchor || item.section_id;
  const heading = item.source?.heading || item.section;
  if (!anchor && !heading) return fallback;

  const blocks = fileContext.content.split(/\n\s*\n+/);
  let pIndex = 0;
  let currentTitle = 'Введение';
  let currentAnchor: string | undefined;
  let matchedText = '';
  let matchedTitle = heading || currentTitle;
  let matchedAnchor = anchor;
  let matchedIndex = 0;
  let found = false;

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('#')) {
      const hm = trimmed.match(/^(#{1,6})\s+(.+)$/m);
      if (hm) {
        const parsed = stripHeadingAnchor(hm[2].trim());
        currentTitle = parsed.title;
        currentAnchor = parsed.anchor || headingAnchorFromTitle(parsed.title);
        const rest = trimmed.split('\n').slice(1).join('\n').trim();
        const hit =
          (anchor && currentAnchor === anchor) ||
          (heading && currentTitle.toLowerCase() === heading.toLowerCase());
        if (hit) {
          found = true;
          matchedTitle = currentTitle;
          matchedAnchor = currentAnchor;
          matchedText = rest || trimmed;
          matchedIndex = pIndex;
        }
        if (rest) pIndex++;
        continue;
      }
    }
    const hit =
      (anchor && currentAnchor === anchor) ||
      (heading && currentTitle.toLowerCase() === heading.toLowerCase());
    if (hit && !found) {
      found = true;
      matchedTitle = currentTitle;
      matchedAnchor = currentAnchor;
      matchedText = trimmed;
      matchedIndex = pIndex;
    }
    pIndex++;
  }

  if (!found || !matchedText) return fallback;

  const quote = matchedText.slice(0, 220).trim();
  return {
    quote: quote + (matchedText.length > 220 ? '...' : ''),
    sourceDocName: item.source?.file || fileContext.markdownFileName || 'article.md',
    sectionTitle: matchedTitle,
    sectionAnchor: matchedAnchor,
    paragraphIndex: matchedIndex,
    highlightText: matchedText.slice(0, 80),
  };
}

/** Vanilla runtime for packaged chat.js — keep in sync with score/match above. */
export const FAQ_RUNTIME_JS = `
function qlmNorm(t){return String(t||'').toLowerCase().replace(/[?.,!;:]+$/g,'').replace(/\\s+/g,' ').trim()}
function qlmTokens(t){return qlmNorm(t).split(/[\\s,?.!;:()"«»—–'"'-]+/).filter(function(x){return x.length>1})}
function qlmPhrases(item){var p=[item.question].concat(item.aliases||[]);var o=[];var s={};for(var i=0;i<p.length;i++){var x=String(p[i]||'').trim();var k=qlmNorm(x);if(x&&!s[k]){s[k]=1;o.push(x)}}return o}
function qlmScore(query,item){var nq=qlmNorm(query);if(!nq||!item||!item.question)return 0;var qt=qlmTokens(query);var best=0;var ph=qlmPhrases(item);for(var i=0;i<ph.length;i++){var np=qlmNorm(ph[i]);if(np===nq)return 1;if(np.indexOf(nq)===0&&nq.length>=8)best=Math.max(best,0.86+0.12*Math.min(1,nq.length/Math.max(np.length,1)));if(nq.indexOf(np)===0&&np.length>=14)best=Math.max(best,0.9);var pt=qlmTokens(ph[i]);if(qt.length>=2&&pt.length){var hit=0;for(var a=0;a<qt.length;a++){for(var b=0;b<pt.length;b++){if(pt[b]===qt[a]||pt[b].indexOf(qt[a])>=0||qt[a].indexOf(pt[b])>=0){hit++;break}}}var cov=hit/qt.length;if(cov===1&&qt.length>=3)best=Math.max(best,0.84)}}
var kw=item.keywords||[];if(kw.length){var kh=0;for(var k=0;k<kw.length;k++){if(kw[k]&&nq.indexOf(String(kw[k]).toLowerCase())>=0)kh++}if(kh>=2)best=Math.max(best,0.81)}
return best}
function qlmMatchFaq(query,items){if(!items||!items.length)return null;var best=null,bs=0;for(var i=0;i<items.length;i++){if(!items[i].answer)continue;var s=qlmScore(query,items[i]);if(s>bs){bs=s;best=items[i]}}return best&&bs>=0.78?best:null}
function qlmGhostSuffix(input,phrase){if(!input||!phrase)return '';return phrase.toLowerCase().indexOf(String(input).toLowerCase())===0?phrase.slice(input.length):''}
function qlmRankGhost(query,items,limit){limit=limit||5;if(!items||!items.length||!String(query||'').trim())return [];var out=[];for(var i=0;i<items.length;i++){var item=items[i];var can=(item.question||'').trim();if(!can)continue;var ph=qlmPhrases(item);var ghost='';var completion=can;var prefixScore=0;if(String(query).trim().length>=2){for(var j=0;j<ph.length;j++){if(ph[j].toLowerCase().indexOf(String(query).toLowerCase())!==0)continue;var remain=Math.max(0,ph[j].length-query.length);var sc=1000+(120-Math.min(120,remain));if(sc>prefixScore||(sc===prefixScore&&ph[j]===can)){prefixScore=sc;ghost=qlmGhostSuffix(query,ph[j]);completion=ph[j]}}}var score=Math.max(prefixScore,qlmScore(query,item)*1000);if(ghost||score>=200)out.push({item:item,score:score,ghostSuffix:ghost,completion:completion})}out.sort(function(a,b){return b.score-a.score});return out.slice(0,limit)}
function qlmGhost(query,items){var r=qlmRankGhost(query,items,1);return r[0]?r[0].completion:null}
`;
