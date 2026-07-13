'use client';

import { useEffect } from 'react';
import { visitService } from '@/services/visitService';

const VISITOR_ID_KEY = 'scan_voca_visitor_id';
const LAST_VISIT_KEY = 'scan_voca_last_visit_date';

function getOrCreateVisitorId(): string {
  let id = localStorage.getItem(VISITOR_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(VISITOR_ID_KEY, id);
  }
  return id;
}

// document.referrer는 이 페이지로 넘어오기 직전 페이지의 URL이며,
// SPA 내부 이동으로는 바뀌지 않으므로 "어디서 유입됐는지" 판단에 그대로 쓸 수 있다.
function getReferrerHost(): string {
  if (!document.referrer) return 'direct';
  try {
    const host = new URL(document.referrer).hostname.replace(/^www\./, '');
    return host === window.location.hostname ? 'direct' : host;
  } catch {
    return 'direct';
  }
}

// 하루에 한 번만 방문 기록을 서버로 전송 (방문자 수 집계용)
export default function VisitTracker() {
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    if (localStorage.getItem(LAST_VISIT_KEY) === today) return;

    visitService
      .track(getOrCreateVisitorId(), getReferrerHost())
      .then(() => localStorage.setItem(LAST_VISIT_KEY, today))
      .catch(() => {});
  }, []);

  return null;
}
