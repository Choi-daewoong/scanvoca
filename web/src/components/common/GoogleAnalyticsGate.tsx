'use client';

import { useEffect, useState } from 'react';
import { GoogleAnalytics } from '@next/third-parties/google';

// PRIVACY_POLICY.md 10항에 GA4 관련 사항은 사전 공지 후 2026-09-10부터 적용된다고 명시했다
// (15항의 최소 7일 사전 고지 요건). 코드/환경변수는 그 전에 배포될 수 있으므로, 실제 스크립트
// 로드는 이 날짜 이후로만 일어나도록 여기서 게이팅한다. useEffect 안에서만 판단해 서버 렌더와
// 첫 클라이언트 렌더가 항상 "비활성" 상태로 일치하게 하고(하이드레이션 불일치 방지), 이후에만
// 활성화한다.
const GA_EFFECTIVE_DATE = new Date('2026-09-10T00:00:00+09:00').getTime();

export default function GoogleAnalyticsGate({ gaId }: { gaId: string }) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (Date.now() >= GA_EFFECTIVE_DATE) setEnabled(true);
  }, []);

  if (!enabled) return null;
  return <GoogleAnalytics gaId={gaId} />;
}
