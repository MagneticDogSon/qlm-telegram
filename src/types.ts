export interface MessageCitation {
  quote: string;
  sourceDocName?: string;
  sectionTitle?: string;
  sectionAnchor?: string;
  paragraphIndex?: number;
  highlightText?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  model?: string;
  isStreaming?: boolean;
  error?: boolean;
  contextFile?: string;
  matchedFaqQuestion?: string;
  isUnknownQuery?: boolean;
  userQuestionText?: string;
  suggestedFollowUps?: string[];
}

export interface FaqSourceRef {
  file?: string;
  heading?: string;
  anchor?: string;
}

export interface FaqItem {
  id?: string;
  doc_id?: string;
  question: string;
  answer: string;
  aliases?: string[];
  keywords?: string[];
  section?: string;
  section_id?: string;
  source?: FaqSourceRef;
  next?: string[];
  nextQuestions?: string[];
  relatedQuestionIds?: string[];
  isBase?: boolean;
  isLearned?: boolean;
  addedAt?: number;
}

export interface FaqData {
  version: number | string;
  schema?: string;
  title?: string;
  source_document?: string;
  created_at?: string;
  description?: string;
  items: FaqItem[];
}

export interface QlmManifest {
  schema: string;
  title?: string;
  description?: string;
  language?: string;
  created_at?: string;
  package_name?: string;
  files: {
    article: string;
    faq: string;
    learned?: string;
  };
  faq_count?: number;
  sections?: string[];
}

export interface FileContext {
  name: string;
  content: string;
  size: number;
  extension: string;
  loadedAt: number;
  markdownFileName?: string;
  faq?: FaqData;
  faqItems?: FaqItem[];
  isZipPackage?: boolean;
  manifest?: QlmManifest;
}

export type AppTheme = 'crimson' | 'emerald' | 'cyan' | 'amber' | 'purple' | 'monochrome';

export interface ChannelPost {
  id: number;
  date: string;
  text: string;
}

export interface ChannelDump {
  title: string;
  username?: string;
  posts: ChannelPost[];
  truncated?: boolean;
  source: 'export' | 'gramjs';
}
