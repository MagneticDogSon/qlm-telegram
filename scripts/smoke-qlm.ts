import { parseTelegramExportJson } from '../src/ingest/exportParser.ts';
import { channelDumpToQlm } from '../src/qlm/fromChannel.ts';
import { answerFromFaq } from '../src/engine/matchFaq.ts';
import { builtToFileContext } from '../src/qlm/package.ts';

const dump = parseTelegramExportJson({
  name: 'Тест канал',
  messages: [
    { id: 1, type: 'message', date: '2026-01-15T10:00:00', text: 'Релиз вышел 15 января. Скачайте сборку.' },
    { id: 2, type: 'service', date: '2026-01-15T10:01:00', text: 'joined' },
    {
      id: 3,
      type: 'message',
      date: '2026-02-01T12:00:00',
      text: [{ type: 'plain', text: 'Цена подписки ' }, { type: 'bold', text: '490 рублей.' }],
    },
  ],
});

if (dump.posts.length !== 2) throw new Error(`expected 2 posts, got ${dump.posts.length}`);
const built = channelDumpToQlm(dump);
if (!built.article.includes('# Тест канал')) throw new Error('missing title');
if (built.faq.items.length < 2) throw new Error('faq too small');
const ctx = builtToFileContext(built);
const hit = answerFromFaq('Цена подписки 490 рублей.', ctx);
if (hit.isUnknown) throw new Error('should match price post');
const miss = answerFromFaq('какая погода на марсе', ctx);
if (!miss.isUnknown) throw new Error('should be unknown');
console.log('ok', built.faq.items.length, 'faq items');
