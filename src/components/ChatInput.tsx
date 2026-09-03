import React, { useRef, useEffect, useState, useMemo } from 'react';
import { ArrowRight } from 'lucide-react';
import { FileContext } from '../types';
import { SuggestedQuestionsBar } from './SuggestedQuestionsBar';
import { rankFaqQuestions } from '../engine/faqIndex';

interface ChatInputProps {
  input: string;
  setInput: (val: string) => void;
  onSend: (promptToSend?: string) => void;
  fileContext?: FileContext | null;
  onSelectPromptSuggestion?: (prompt: string) => void;
  isSuggestedQuestionsOpen?: boolean;
  onToggleSuggestedQuestions?: () => void;
  isSuggestedPinned?: boolean;
  onToggleSuggestedPin?: () => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  input,
  setInput,
  onSend,
  fileContext,
  onSelectPromptSuggestion,
  isSuggestedQuestionsOpen,
  onToggleSuggestedQuestions,
  isSuggestedPinned = false,
  onToggleSuggestedPin,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const [localSuggestedOpen, setLocalSuggestedOpen] = useState(true);
  const isQuestionsBarOpen =
    isSuggestedQuestionsOpen !== undefined ? isSuggestedQuestionsOpen : localSuggestedOpen;
  const toggleQuestionsBar =
    onToggleSuggestedQuestions || (() => setLocalSuggestedOpen((prev) => !prev));

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [ghostDismissed, setGhostDismissed] = useState(false);
  const [cursorAtEnd, setCursorAtEnd] = useState(true);

  const ranked = useMemo(
    () => rankFaqQuestions(input, fileContext?.faqItems, 5),
    [fileContext?.faqItems, input]
  );
  const prefixRanked = useMemo(() => ranked.filter((item) => item.ghostSuffix), [ranked]);

  useEffect(() => {
    setSelectedIndex(0);
    setGhostDismissed(false);
  }, [input]);

  const selectedPrefix = prefixRanked[Math.min(selectedIndex, Math.max(prefixRanked.length - 1, 0))];
  const ghostSuffix = !ghostDismissed && cursorAtEnd && selectedPrefix ? selectedPrefix.ghostSuffix : '';
  const acceptText = selectedPrefix?.completion || '';

  const syncCursorAtEnd = () => {
    const el = textareaRef.current;
    if (!el) return;
    setCursorAtEnd(el.selectionStart === input.length && el.selectionEnd === input.length);
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [input, ghostSuffix]);

  const acceptCompletion = () => {
    if (!acceptText) return;
    setInput(acceptText);
    setGhostDismissed(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape' && (ghostSuffix || ranked.length > 0)) {
      e.preventDefault();
      setGhostDismissed(true);
      return;
    }
    if (e.key === 'Tab' && ghostSuffix && acceptText) {
      e.preventDefault();
      acceptCompletion();
      return;
    }
    if (e.key === 'ArrowRight' && ghostSuffix && textareaRef.current) {
      const atEnd =
        textareaRef.current.selectionStart === input.length &&
        textareaRef.current.selectionEnd === input.length;
      if (atEnd) {
        e.preventDefault();
        acceptCompletion();
        return;
      }
    }
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && prefixRanked.length > 1 && !ghostDismissed) {
      e.preventDefault();
      setSelectedIndex((prev) =>
        e.key === 'ArrowDown' ? (prev + 1) % prefixRanked.length : (prev - 1 + prefixRanked.length) % prefixRanked.length
      );
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const fieldClass = 'font-mono text-[13.5px] leading-relaxed whitespace-pre-wrap';

  return (
    <div className="relative w-full border-t border-[#1A1A1A] bg-[#0D0D0D] p-3 md:px-6 max-w-4xl mx-auto space-y-2">
      <SuggestedQuestionsBar
        fileContext={fileContext || null}
        filterQuery={input}
        highlightQuestion={selectedPrefix?.item.question}
        isOpen={isSuggestedPinned || isQuestionsBarOpen}
        onToggle={toggleQuestionsBar}
        isPinned={isSuggestedPinned}
        onTogglePin={onToggleSuggestedPin}
        onSelectPrompt={(p) => {
          if (onSelectPromptSuggestion) onSelectPromptSuggestion(p);
          else {
            setInput(p);
            onSend(p);
          }
        }}
      />
      <div className="flex items-end gap-2 py-2.5 px-3.5 bg-[#111111] border border-[#1A1A1A] focus-within:border-[#333333] rounded-b-sm transition-all shadow-inner relative">
        <div className="flex-1 relative min-h-[26px]">
          {ghostSuffix && (
            <div
              ref={ghostRef}
              aria-hidden="true"
              className={`absolute inset-0 pointer-events-none ${fieldClass} select-none overflow-hidden`}
              style={{ wordBreak: 'break-word' }}
            >
              <span className="invisible">{input}</span>
              <span className="text-white/25">{ghostSuffix}</span>
            </div>
          )}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onKeyUp={syncCursorAtEnd}
            onClick={syncCursorAtEnd}
            onSelect={syncCursorAtEnd}
            rows={1}
            placeholder={
              fileContext?.faqItems?.length
                ? `Вопрос по «${fileContext.faq?.title || fileContext.name}» — серый текст: Tab или →`
                : 'База канала ещё не загружена'
            }
            className={`w-full bg-transparent text-white placeholder-[#444] resize-none outline-none min-h-[26px] max-h-[160px] relative z-10 caret-white ${fieldClass}`}
            style={{ wordBreak: 'break-word' }}
          />
        </div>
        <button
          onClick={() => onSend()}
          disabled={!input.trim()}
          title="Отправить (Enter)"
          className={`w-8 h-8 rounded-sm flex items-center justify-center transition-colors shrink-0 mb-0.5 z-10 ${
            input.trim()
              ? 'bg-[#1e1e1e] hover:bg-[var(--color-accent-dark)] hover:border-[var(--color-accent-border)] text-white border border-[#333] cursor-pointer'
              : 'text-[#333] cursor-not-allowed'
          }`}
        >
          <ArrowRight size={16} strokeWidth={2} className={input.trim() ? 'text-[var(--color-accent)]' : ''} />
        </button>
      </div>
      <div className="flex items-center justify-between text-[10px] text-[#444] font-mono tracking-wider uppercase">
        <span>Enter: отправить · Tab: принять · FAQ без LLM</span>
      </div>
    </div>
  );
};
