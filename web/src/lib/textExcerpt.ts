/**
 * content_format(markdown/html/plain)에 무관하게 SEO 메타 설명·소셜 미리보기용 순수 텍스트
 * 요약을 만든다. 원문을 그대로 슬라이스하면 '### 제목', '**강조**' 같은 마크다운/HTML 문법이
 * 그대로 노출돼 검색 스니펫과 AI 요약 둘 다 망가진다 — 둘 다 이 필드를 그대로 인용한다.
 */
export function toPlainExcerpt(
  content: string,
  format: 'plain' | 'markdown' | 'html',
  maxLength = 140,
): string {
  let text = content;

  if (format === 'html') {
    text = text.replace(/<[^>]+>/g, ' ');
  } else if (format === 'markdown') {
    text = text
      .replace(/```[\s\S]*?```/g, ' ') // 코드 블록
      .replace(/`([^`]+)`/g, '$1') // 인라인 코드
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // 이미지
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // 링크는 텍스트만 남김
      .replace(/<[^>]+>/g, ' ') // 마크다운 안에 섞인 raw HTML(<video> 등)
      .replace(/^#{1,6}\s+/gm, '') // 헤딩 마커
      .replace(/^>\s?/gm, '') // 인용 마커
      .replace(/^[-*+]\s+/gm, '') // 리스트 마커
      .replace(/^\d+\.\s+/gm, '') // 순서 리스트 마커
      .replace(/[*_~]{1,3}/g, ''); // 강조/취소선 마커
  }

  text = text.replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).replace(/\s+\S*$/, '') + '…';
}
