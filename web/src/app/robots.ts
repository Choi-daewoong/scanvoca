import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/login', '/register', '/forgot-password'],
      // 로그인/게스트 세션이 필요한 앱 화면은 크롤러가 들어와도 볼 게 없고,
      // 크롤러 방문마다 불필요한 게스트 계정이 생성되는 걸 막기 위해 제외한다.
      disallow: ['/home', '/scan', '/wordbooks', '/stats', '/settings', '/board', '/admin', '/api'],
    },
    sitemap: 'https://scanvoca.com/sitemap.xml',
  };
}
