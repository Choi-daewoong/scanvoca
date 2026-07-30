import { defaultSchema } from 'rehype-sanitize';
import type { Schema } from 'hast-util-sanitize';

/**
 * 발행 마크다운은 GitHub 저장소 원문이 아니라 AI 생성 파이프라인(자동발행 포함)을 거친
 * 콘텐츠라 "신뢰된 입력"으로 취급할 수 없다 — 프롬프트 인젝션이나 자격증명 유출 시
 * <script>가 그대로 실행되는 stored XSS 경로가 된다. rehype-raw가 만든 노드를 이 스키마가
 * 걸러낸다. 공개 블로그 페이지와 관리자 편집기 미리보기가 모두 이 스키마를 공유해야
 * 렌더링 결과가 어긋나지 않는다(과거 밑줄<u> 태그가 공개 페이지에서만 허용 목록에
 * 빠져있던 것처럼 각자 따로 관리하면 드리프트가 생긴다).
 *
 * video/source/track: 일상회화 클립 임베드용.
 * u: 수능 기출 지문의 밑줄 친 선택지 인용용 (속성 없는 순수 스타일 태그라 XSS 표면 없음).
 */
export const blogHtmlSchema: Schema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), 'video', 'source', 'track', 'u'],
  attributes: {
    ...defaultSchema.attributes,
    video: ['src', 'controls', 'poster', 'width', 'height', 'preload', 'muted', 'playsInline'],
    source: ['src', 'type'],
    track: ['src', 'kind', 'srclang', 'label', 'default'],
  },
  protocols: {
    ...defaultSchema.protocols,
    src: ['http', 'https'],
  },
};
