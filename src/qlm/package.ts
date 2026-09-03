import JSZip from 'jszip';
import { FaqData, FileContext } from '../types';
import {
  FAQ_VERSION,
  QLM_SCHEMA,
  buildQlmManifest,
  ensureHeadingAnchors,
  hydrateFileContext,
  normalizeFaqData,
} from '../engine/faqIndex';
import { BuiltQlm } from './fromChannel';

export async function builtQlmToZipBuffer(built: BuiltQlm, packageName?: string): Promise<Buffer> {
  const zip = new JSZip();
  const article = ensureHeadingAnchors(built.article);
  const faq = normalizeFaqData(built.faq, 'article.md');
  zip.file('article.md', article);
  zip.file('faq.json', JSON.stringify(faq, null, 2));
  zip.file(
    'manifest.json',
    JSON.stringify(
      buildQlmManifest({
        title: faq.title || built.title,
        description: faq.description,
        language: 'ru',
        packageName: packageName || slugName(built.title),
        articleFile: 'article.md',
        items: faq.items,
      }),
      null,
      2
    )
  );
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

export async function zipBufferToFileContext(buf: Buffer, name = 'channel.qlm'): Promise<FileContext> {
  const zip = await JSZip.loadAsync(buf);
  const article = (await zip.file('article.md')?.async('string')) || '';
  let faq: FaqData = { version: FAQ_VERSION, schema: QLM_SCHEMA, items: [] };
  const faqText = await zip.file('faq.json')?.async('string');
  if (faqText) {
    try {
      faq = JSON.parse(faqText);
    } catch {
      /* keep empty */
    }
  }
  let manifest;
  const manifestText = await zip.file('manifest.json')?.async('string');
  if (manifestText) {
    try {
      manifest = JSON.parse(manifestText);
    } catch {
      manifest = undefined;
    }
  }
  const normalized = normalizeFaqData(faq, 'article.md');
  return hydrateFileContext({
    name,
    content: article,
    size: buf.length,
    extension: 'qlm',
    loadedAt: Date.now(),
    markdownFileName: 'article.md',
    faq: normalized,
    faqItems: normalized.items,
    isZipPackage: true,
    manifest,
  }) as FileContext;
}

function slugName(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'channel';
}

export function builtToFileContext(built: BuiltQlm): FileContext {
  const faq = normalizeFaqData(built.faq, 'article.md');
  const article = ensureHeadingAnchors(built.article);
  return hydrateFileContext({
    name: `${slugName(built.title)}.qlm`,
    content: article,
    size: article.length,
    extension: 'qlm',
    loadedAt: Date.now(),
    markdownFileName: 'article.md',
    faq,
    faqItems: faq.items,
    isZipPackage: true,
  }) as FileContext;
}
