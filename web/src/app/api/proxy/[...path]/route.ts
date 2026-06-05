import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

async function handler(request: NextRequest) {
  // /api/proxy/api/v1/auth/login → /api/v1/auth/login (proxy prefix 제거)
  const path = request.nextUrl.pathname.replace('/api/proxy', '');
  const search = request.nextUrl.search;
  const targetUrl = `${API_BASE}${path}${search}`;

  // 전달할 헤더 (Authorization 포함, host 제외)
  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!['host', 'connection'].includes(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  let body: BodyInit | null = null;
  if (!['GET', 'HEAD'].includes(request.method)) {
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      // FormData는 fetch가 boundary를 자동 설정하도록 Content-Type 제거
      headers.delete('content-type');
      body = await request.formData();
    } else {
      body = await request.text();
    }
  }

  const res = await fetch(targetUrl, {
    method: request.method,
    headers,
    body,
  });

  const resHeaders = new Headers();
  res.headers.forEach((value, key) => {
    if (!['content-encoding', 'transfer-encoding'].includes(key.toLowerCase())) {
      resHeaders.set(key, value);
    }
  });

  const resBody = await res.arrayBuffer();
  return new NextResponse(resBody, {
    status: res.status,
    headers: resHeaders,
  });
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
