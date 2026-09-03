import React, { useMemo } from 'react';
import { Sparkles, ChevronDown, ChevronUp, ArrowRight, Pin, PinOff } from 'lucide-react';
import { FileContext, FaqItem } from '../types';
import { rankFaqQuestions } from '../engine/faqIndex';

interface SuggestedQuestionsBarProps {
  fileContext: FileContext | null;
  onSelectPrompt: (prompt: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  isPinned?: boolean;
  onTogglePin?: () => void;
  disabled?: boolean;
  filterQuery?: string;
  highlightQuestion?: string;
}

const SUGGESTION_COUNT = 9;

export const SuggestedQuestionsBar: React.FC<SuggestedQuestionsBarProps> = ({
  fileContext,
  onSelectPrompt,
  isOpen,
  onToggle,
  isPinned = false,
  onTogglePin,
  disabled = false,
  filterQuery = '',
  highlightQuestion,
}) => {
  const faqItems: FaqItem[] = useMemo(() => fileContext?.faqItems || [], [fileContext?.faqItems]);
  const hasFaq = faqItems.length > 0;

  const questions = useMemo(() => {
    if (!hasFaq) return [];
    if (!filterQuery.trim()) return faqItems.slice(0, SUGGESTION_COUNT).map((item) => item.question);
    return rankFaqQuestions(filterQuery, faqItems, SUGGESTION_COUNT).map((entry) => entry.item.question);
  }, [faqItems, filterQuery, hasFaq]);

  return (
    <div className="w-full select-none font-mono transition-all duration-200">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#121212] border-t border-x border-[#222222] rounded-t-sm text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-1.5 text-[var(--color-accent)]">
            <Sparkles size={13} className="shrink-0" />
            <span className="font-bold uppercase tracking-wider text-[11px] text-[#EEE] truncate">
              Рекомендуемые вопросы
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {onTogglePin && (
            <button
              type="button"
              onClick={onTogglePin}
              title={isPinned ? 'Открепить панель' : 'Закрепить панель'}
              className={`p-1 rounded-xs border transition-colors cursor-pointer ${
                isPinned
                  ? 'bg-[var(--color-accent-dark)] border-[var(--color-accent-border)] text-[var(--color-accent)]'
                  : 'bg-[#1C1C1C] border-[#333] text-[#888] hover:text-white hover:bg-[#262626]'
              }`}
            >
              {isPinned ? <Pin size={13} /> : <PinOff size={13} />}
            </button>
          )}
          <button
            type="button"
            onClick={onToggle}
            disabled={isPinned}
            className="flex items-center gap-1 px-2 py-0.5 bg-[#1C1C1C] hover:bg-[#262626] text-[#BBB] hover:text-white border border-[#333] rounded-xs text-[11px] transition-colors cursor-pointer disabled:opacity-40"
          >
            {isOpen ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
          </button>
        </div>
      </div>
      {isOpen && (
        <div className="bg-[#0E0E0E] border-x border-[#222222] p-2 sm:p-2.5">
          {questions.length === 0 ? (
            <div className="py-2 text-center text-xs text-[#666]">Нет рекомендуемых вопросов</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {questions.map((question, idx) => (
                <button
                  key={`${question}-${idx}`}
                  type="button"
                  onClick={() => !disabled && onSelectPrompt(question)}
                  disabled={disabled}
                  className={`text-left p-2 rounded-xs border transition-all flex items-center justify-between gap-2 group cursor-pointer text-xs disabled:opacity-50 ${
                    highlightQuestion === question
                      ? 'border-[var(--color-accent-border)] bg-[var(--color-accent-dark)]'
                      : 'border-[#1D1D1D] bg-[#141414] hover:bg-[#1C1C1C] hover:border-[var(--color-accent-border)]'
                  }`}
                >
                  <span className="text-[#CCC] group-hover:text-white line-clamp-2 leading-snug">{question}</span>
                  <ArrowRight size={11} className="text-[#555] group-hover:text-[var(--color-accent)] shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
