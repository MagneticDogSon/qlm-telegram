import React, { useEffect, useState } from 'react';
import { FileContext, Message } from '../types';
import { AppTheme, applyTheme, getSavedTheme } from '../utils/themeHelper';
import { ThemeSelector } from '../components/ThemeSelector';
import { MessageList } from '../components/MessageList';
import { ChatInput } from '../components/ChatInput';
import { answerFromFaq } from '../engine/matchFaq';
import { hydrateFileContext } from '../engine/faqIndex';

export const MiniAppChat: React.FC = () => {
  const [theme, setTheme] = useState<AppTheme>(() => getSavedTheme());
  const [fileContext, setFileContext] = useState<FileContext | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isSuggestedOpen, setIsSuggestedOpen] = useState(true);
  const [isSuggestedPinned, setIsSuggestedPinned] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    let cancelled = false;
    const pkgUrl = `${import.meta.env.BASE_URL}qlm-package.json`;
    fetch(pkgUrl)
      .then(async (r) => {
        if (r.ok) return r.json();
        const api = await fetch('/api/package');
        if (!api.ok) throw new Error('Пакет канала не загружен');
        return api.json();
      })
      .then((ctx: FileContext) => {
        if (!cancelled) setFileContext(hydrateFileContext(ctx));
      })
      .catch((err: Error) => {
        if (!cancelled) setLoadError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const send = (promptToSend?: string) => {
    const text = (promptToSend !== undefined ? promptToSend : input).trim();
    if (!text) return;
    if (!isSuggestedPinned) setIsSuggestedOpen(false);

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };
    const result = answerFromFaq(text, fileContext);
    const assistantMessage: Message = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: result.content,
      timestamp: Date.now(),
      matchedFaqQuestion: result.matchedQuestion,
      isUnknownQuery: result.isUnknown,
      suggestedFollowUps: result.followUps,
    };
    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setInput('');
  };

  return (
    <div
      className="h-full min-h-screen flex flex-col bg-[#0D0D0D]"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <header className="flex items-center justify-between gap-2 px-3 py-2 border-b border-[#1A1A1A] bg-[#111]">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-accent)] font-bold">QLM · Mini App</div>
          <div className="text-xs text-white truncate font-bold">
            {fileContext?.faq?.title || fileContext?.name || 'Канал'}
          </div>
        </div>
        <ThemeSelector currentTheme={theme} onSelectTheme={setTheme} />
      </header>
      {loadError && (
        <div className="mx-3 mt-3 border border-[var(--color-accent-border)] rounded-sm p-3 bg-[#111111] text-xs text-[#AAA]">
          {loadError}
        </div>
      )}
      <MessageList
        messages={messages}
        fileContext={fileContext}
        theme={theme}
        onSelectPromptSuggestion={send}
        onEditPrompt={setInput}
      />
      <ChatInput
        input={input}
        setInput={setInput}
        onSend={send}
        fileContext={fileContext}
        onSelectPromptSuggestion={send}
        isSuggestedQuestionsOpen={isSuggestedOpen}
        onToggleSuggestedQuestions={() => setIsSuggestedOpen((v) => !v)}
        isSuggestedPinned={isSuggestedPinned}
        onToggleSuggestedPin={() => setIsSuggestedPinned((v) => !v)}
      />
    </div>
  );
};
