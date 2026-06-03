import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Scan Voca - 스마트 영단어 학습',
  description: '사진 찍으면 AI가 영단어를 자동 인식. 나만의 단어장을 만들어보세요.',
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
      <body className="h-full bg-white text-gray-900 antialiased">{children}</body>
    </html>
  );
}
