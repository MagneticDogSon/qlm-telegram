export {
  QLM_SCHEMA,
  FAQ_VERSION,
  FAQ_CACHE_MIN_SCORE,
  slugifyId,
  normalizeQuery,
  tokenizeQuery,
  faqPhrases,
  scoreFaqItem,
  matchFaqItem,
  rankFaqQuestions,
  followUpQuestionTexts,
  normalizeFaqItems,
  normalizeFaqData,
  hydrateFileContext,
  ensureHeadingAnchors,
  buildQlmManifest,
  citationFromFaqItem,
} from './faqIndex';

import { FileContext, FaqItem } from '../types';
import { followUpQuestionTexts, matchFaqItem, rankFaqQuestions } from './faqIndex';

export function getSuggestedFollowUpQuestions(
  currentQuestion: string,
  fileContext: FileContext | null,
  matchedFaqQuestion?: string,
  limit = 3
): string[] {
  const faqItems: FaqItem[] = fileContext?.faqItems || fileContext?.faq?.items || [];
  if (!faqItems.length) return [];

  const asked = new Set([currentQuestion.toLowerCase().trim()]);
  const out: string[] = [];
  const add = (q: string) => {
    const t = q.trim();
    const key = t.toLowerCase();
    if (!t || asked.has(key) || out.some((x) => x.toLowerCase() === key)) return;
    out.push(t);
  };

  const matched = matchedFaqQuestion
    ? faqItems.find((f) => f.question.toLowerCase() === matchedFaqQuestion.toLowerCase())
    : matchFaqItem(currentQuestion, faqItems, 0.6)?.item;

  if (matched) {
    for (const nextQ of followUpQuestionTexts(matched, faqItems)) {
      add(nextQ);
      if (out.length >= limit) return out;
    }
    const idx = faqItems.indexOf(matched);
    if (idx >= 0) {
      for (let offset = 1; offset <= faqItems.length && out.length < limit; offset++) {
        add(faqItems[(idx + offset) % faqItems.length].question);
      }
    }
  } else {
    for (const ranked of rankFaqQuestions(currentQuestion, faqItems, limit + 2)) {
      add(ranked.item.question);
      if (out.length >= limit) break;
    }
    for (const item of faqItems) {
      if (out.length >= limit) break;
      add(item.question);
    }
  }

  return out.slice(0, limit);
}

export function answerFromFaq(
  query: string,
  fileContext: FileContext | null
): { content: string; matchedQuestion?: string; isUnknown: boolean; followUps: string[] } {
  const items = fileContext?.faqItems || fileContext?.faq?.items || [];
  const matched = matchFaqItem(query, items)?.item;

  if (matched?.answer) {
    const followUps = getSuggestedFollowUpQuestions(query, fileContext, matched.question, 3);
    return {
      content: matched.answer,
      matchedQuestion: matched.question,
      isUnknown: false,
      followUps,
    };
  }

  const followUps = getSuggestedFollowUpQuestions(query, fileContext, undefined, 3);
  const hints = followUps.length
    ? `\n\nПопробуйте один из вопросов:\n${followUps.map((q) => `— ${q}`).join('\n')}`
    : '';

  return {
    content: `По этому запросу в истории канала нет точного совпадения.${hints}`,
    isUnknown: true,
    followUps,
  };
}
