import { marked } from 'marked';
import TurndownService from 'turndown';
import { ContentFormat } from '@/types';

const turndownService = new TurndownService();

/**
 * 일반/마크다운/HTML 형식 간 콘텐츠를 변환한다.
 * - plain <-> markdown: 일반 텍스트는 그대로 유효한 마크다운이므로 내용을 그대로 유지
 * - (plain|markdown) -> html: 마크다운 렌더러로 HTML 생성
 * - html -> (plain|markdown): HTML을 마크다운으로 역변환
 */
export function convertContent(content: string, from: ContentFormat, to: ContentFormat): string {
  if (from === to || !content.trim()) return content;

  if (to === 'html') {
    return marked.parse(content, { async: false }) as string;
  }

  if (from === 'html') {
    return turndownService.turndown(content);
  }

  // plain <-> markdown
  return content;
}
