import DOMPurify from 'dompurify';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ContentFormat } from '@/types';

interface ContentRendererProps {
  content: string;
  format: ContentFormat;
  className?: string;
}

/** 게시글 본문을 형식(일반/마크다운/HTML)에 맞게 렌더링한다 */
export default function ContentRenderer({ content, format, className }: ContentRendererProps) {
  if (format === 'html') {
    const sanitized = typeof window !== 'undefined' ? DOMPurify.sanitize(content) : '';
    return (
      <div
        className={`prose prose-sm dark:prose-invert max-w-none break-words ${className ?? ''}`}
        dangerouslySetInnerHTML={{ __html: sanitized }}
      />
    );
  }

  if (format === 'markdown') {
    return (
      <div className={`prose prose-sm dark:prose-invert max-w-none break-words ${className ?? ''}`}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>
    );
  }

  return <div className={`whitespace-pre-wrap break-words text-sm text-gray-700 dark:text-gray-300 ${className ?? ''}`}>{content}</div>;
}
