import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/login', '/register', '/forgot-password'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 공개 경로는 통과
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // 정적 파일, Next.js 내부 경로 통과
  if (pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname.includes('.')) {
    return NextResponse.next();
  }

  // 쿠키에서 토큰 확인 (서버사이드)
  const token = request.cookies.get('access_token')?.value;

  // 클라이언트 localStorage는 서버에서 읽을 수 없으므로
  // 실제 인증 체크는 클라이언트 AuthGuard 컴포넌트가 담당
  // 미들웨어는 쿠키 기반 토큰만 체크
  if (!token && pathname === '/') {
    // 루트는 항상 허용 (클라이언트에서 리다이렉트 처리)
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
