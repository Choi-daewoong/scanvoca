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

// 하루에 한 번만 방문 기록을 서버로 전송 (방문자 수 집계용)
export default function VisitTracker() {
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    if (localStorage.getItem(LAST_VISIT_KEY) === today) return;

    visitService
      .track(getOrCreateVisitorId())
      .then(() => localStorage.setItem(LAST_VISIT_KEY, today))
      .catch(() => {});
  }, []);

  return null;
}
