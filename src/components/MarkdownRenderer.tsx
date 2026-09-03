import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
  isStreaming?: boolean;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, isStreaming }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopy = (code: string, index: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Parse markdown code blocks
  const renderFormattedText = () => {
    if (!content) {
      if (isStreaming) {
        return <span className="inline-block w-2 h-4 bg-[var(--color-accent)] animate-terminal-cursor align-middle ml-1" />;
      }
      return null;
    }

    const parts: React.ReactNode[] = [];
    const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let blockCount = 0;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      const textBefore = content.substring(lastIndex, match.index);
      if (textBefore) {
        parts.push(
          <span key={`text-${lastIndex}`} className="whitespace-pre-wrap leading-relaxed text-white">
            {formatInlineElements(textBefore)}
          </span>
        );
      }

      const lang = match[1] || 'text';
      const code = match[2];
      const currentBlock = blockCount++;

      parts.push(
        <div
          key={`code-${match.index}`}
          className="my-3 border border-[#1A1A1A] rounded-sm overflow-hidden bg-[#0A0A0A]"
        >
          <div className="flex items-center justify-between px-3 py-1.5 bg-[#111111] border-b border-[#1A1A1A] text-[11px] text-[#666]">
            <span className="font-mono font-bold text-[#aaa]">[{lang || 'code'}]</span>
            <button
              onClick={() => handleCopy(code, currentBlock)}
              className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-sm border border-[#222] bg-[#161616] hover:bg-[#202020] text-[#888] hover:text-[#eee] transition-colors"
            >
              {copiedIndex === currentBlock ? (
                <>
                  <Check size={11} className="text-[var(--color-accent)]" />
                  <span className="text-[var(--color-accent)]">copied</span>
                </>
              ) : (
                <>
                  <Copy size={11} />
                  <span>copy</span>
                </>
              )}
            </button>
          </div>
          <pre className="p-3 overflow-x-auto text-[13px] leading-snug font-mono text-[#D1D1D1] bg-[#0A0A0A] m-0">
            <code>{code}</code>
          </pre>
        </div>
      );

      lastIndex = match.index + match[0].length;
    }

    const remainingText = content.substring(lastIndex);
    if (remainingText) {
      parts.push(
        <span key={`text-${lastIndex}`} className="whitespace-pre-wrap leading-relaxed text-white">
          {formatInlineElements(remainingText)}
        </span>
      );
    }

    return (
      <>
        {parts}
        {isStreaming && (
          <span className="inline-block w-2 h-4 bg-[var(--color-accent)] animate-terminal-cursor align-middle ml-1" />
        )}
      </>
    );
  };

  // Helper for inline `code` and **bold**
  const formatInlineElements = (text: string): React.ReactNode[] => {
    const segments = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
    return segments.map((seg, idx) => {
      if (seg.startsWith('`') && seg.endsWith('`') && seg.length >= 2) {
        return (
          <code
            key={idx}
            className="px-1.5 py-0.5 bg-[#141414] text-[#eee] rounded-sm border border-[#222] text-[13px] mx-0.5 font-mono"
          >
            {seg.slice(1, -1)}
          </code>
        );
      }
      if (seg.startsWith('**') && seg.endsWith('**') && seg.length >= 4) {
        return (
          <strong key={idx} className="font-semibold text-white">
            {seg.slice(2, -2)}
          </strong>
        );
      }
      return seg;
    });
  };

  return <div className="text-[14px] leading-relaxed text-white">{renderFormattedText()}</div>;
};
