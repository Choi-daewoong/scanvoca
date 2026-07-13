import type { Metadata, Viewport } from 'next';
import './globals.css';
import VisitTracker from '@/components/common/VisitTracker';

export const metadata: Metadata = {
  metadataBase: new URL('https://scanvoca.com'),
  title: {
    default: 'Scan Voca - 스마트 영단어 학습',
    template: '%s | Scan Voca',
  },
  description: '사진 찍으면 AI가 영단어를 자동 인식하는 영단어 앱. 수능·토익·토플 단어장을 무료로 만들어보세요.',
  keywords: ['영단어 앱', '단어장 앱', 'AI 영단어', '영어 단어 암기', '수능 영단어'],
  icons: {
    icon: '/icons/favicon.ico',
    shortcut: '/icons/favicon-16x16.png',
    apple: '/icons/apple-touch-icon.png',
    other: [
      {
        rel: 'icon',
        sizes: '32x32',
        url: '/icons/favicon-32x32.png',
      },
      {
        rel: 'icon',
        sizes: '96x96',
        url: '/icons/favicon-96x96.png',
      },
    ],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#4F46E5',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* paint 전에 다크모드·스킨·폰트를 적용하는 anti-FOUC 부트스트랩.
            appearanceStore와 같은 localStorage 키를 읽는다. URL 화이트리스트로 오염된 값 방어 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('scan_voca_theme')==='dark')document.documentElement.classList.add('dark');var s=localStorage.getItem('scan_voca_skin');if(s&&/^[a-z]+$/.test(s)&&s!=='default')document.documentElement.setAttribute('data-skin',s);var f=localStorage.getItem('scan_voca_font');if(f){f=JSON.parse(f);if(f&&f.family)document.documentElement.style.setProperty('--app-font',"'"+f.family+"', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif");if(f&&f.cssUrl&&(f.cssUrl.indexOf('https://fonts.googleapis.com/')===0||f.cssUrl.indexOf('https://cdn.jsdelivr.net/')===0)){var l=document.createElement('link');l.id='app-font-css';l.rel='stylesheet';l.href=f.cssUrl;document.head.appendChild(l);}}}catch(e){}`,
          }}
        />
      </head>
      <body className="h-full bg-white text-gray-900 antialiased dark:bg-gray-950 dark:text-gray-100">
        <VisitTracker />
        {children}
      </body>
    </html>
  );
}
