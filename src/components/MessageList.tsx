import React, { useEffect, useRef, useState } from 'react';
import { Message, FileContext, AppTheme } from '../types';
import { MarkdownRenderer } from './MarkdownRenderer';
import { PlexusRingAnimation } from './PlexusRingAnimation';
import { Copy, Check, Volume2, VolumeX, Edit2 } from 'lucide-react';

interface MessageListProps {
  messages: Message[];
  fileContext?: FileContext | null;
  theme?: AppTheme;
  onSelectPromptSuggestion: (prompt: string) => void;
  onEditPrompt?: (content: string) => void;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  fileContext,
  theme = 'crimson',
  onSelectPromptSuggestion,
  onEditPrompt,
}) => {
  const scrollEndRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    };
  }, []);

  const handleCopyMessage = (content: string, id: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleToggleSpeech = (text: string, id: string) => {
    if (!('speechSynthesis' in window)) return;
    if (speakingId === id) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }
    window.speechSynthesis.cancel();
    const cleanText = text.replace(/```[\s\S]*?```/g, 'Блок кода.').replace(/`([^`]+)`/g, '$1').replace(/[#*_~>]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.05;
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);
    setSpeakingId(id);
    window.speechSynthesis.speak(utterance);
  };

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-3 text-center max-w-4xl mx-auto w-full overflow-y-auto">
        <PlexusRingAnimation
          modelName={
            fileContext?.faq?.title?.trim() ||
            fileContext?.content?.match(/^#\s+(.+)$/m)?.[1]?.trim() ||
            fileContext?.name.replace(/\.(qlm|qwen|zip)$/i, '') ||
            'Нет документа'
          }
          theme={theme}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-3 md:px-8 py-6 max-w-4xl mx-auto w-full space-y-8">
      {messages.map((msg) => {
        const isSpeaking = speakingId === msg.id;
        const showAnswerActions = !msg.isStreaming && !!msg.content.trim();
        const timeLabel = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const iconBtn =
          'p-1.5 rounded-xs text-[#666] hover:text-white hover:bg-[#1A1A1A] border border-transparent hover:border-[#262626] transition-colors cursor-pointer';

        if (msg.role === 'user') {
          return (
            <div key={msg.id} className="flex flex-col items-end w-full">
              <div className="flex items-start justify-end gap-1.5 max-w-[88%] sm:max-w-[75%]">
                <div className="flex items-center gap-0.5 shrink-0 mt-0.5">
                  {onEditPrompt && (
                    <button type="button" onClick={() => onEditPrompt(msg.content)} title="Редактировать вопрос" className={iconBtn}>
                      <Edit2 size={13} />
                    </button>
                  )}
                  <button type="button" onClick={() => handleCopyMessage(msg.content, msg.id)} title="Скопировать" className={iconBtn}>
                    {copiedId === msg.id ? <Check size={13} className="text-[var(--color-accent)]" /> : <Copy size={13} />}
                  </button>
                </div>
                <div className="bg-[#181818] border border-[#262626] text-white rounded-sm px-3.5 py-2.5 text-[14px] leading-relaxed font-mono whitespace-pre-wrap break-words">
                  {msg.content}
                </div>
              </div>
              <span className="text-[10px] text-[#555] mt-1.5 mr-0.5 font-mono tracking-wider uppercase tabular-nums">
                {timeLabel}
              </span>
            </div>
          );
        }

        return (
          <div key={msg.id} className="flex flex-col items-start w-full">
            <div className={`w-full max-w-[92%] sm:max-w-[88%] ${msg.error ? 'rounded-sm p-4 border border-[rgba(255,92,92,0.4)] bg-[#1c1111] text-[#ff9999]' : ''}`}>
              <div className="text-[14px] leading-relaxed text-white font-sans">
                <MarkdownRenderer content={msg.content} isStreaming={msg.isStreaming} />
              </div>
              {showAnswerActions && (
                <div className="mt-3 flex items-center gap-0.5">
                  <button type="button" onClick={() => handleCopyMessage(msg.content, msg.id)} title="Скопировать ответ" className={iconBtn}>
                    {copiedId === msg.id ? (
                      <Check size={16} strokeWidth={1.75} className="text-[var(--color-accent)]" />
                    ) : (
                      <Copy size={16} strokeWidth={1.75} />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleSpeech(msg.content, msg.id)}
                    title={isSpeaking ? 'Остановить' : 'Озвучить'}
                    className={`${iconBtn} ${isSpeaking ? 'text-[var(--color-accent)] bg-[var(--color-accent-dark)] animate-pulse' : ''}`}
                  >
                    {isSpeaking ? <VolumeX size={16} strokeWidth={1.75} /> : <Volume2 size={16} strokeWidth={1.75} />}
                  </button>
                </div>
              )}
              {msg.suggestedFollowUps && msg.suggestedFollowUps.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {msg.suggestedFollowUps.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => onSelectPromptSuggestion(q)}
                      className="text-left text-[11px] px-2 py-1 rounded-xs border border-[#262626] bg-[#141414] text-[#CCC] hover:border-[var(--color-accent-border)] hover:text-white cursor-pointer"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
      <div ref={scrollEndRef} />
    </div>
  );
};
