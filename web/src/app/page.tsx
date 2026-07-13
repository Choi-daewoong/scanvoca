import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: { absolute: 'Scan Voca - 사진 한 장으로 시작하는 스마트 영단어 학습' },
  description:
    '영단어 앱, 단어장 앱을 찾고 계신가요? 교재나 노트를 사진으로 찍으면 AI가 영단어를 자동 인식해 단어장을 만들어줍니다. 수능·토익·토플 영단어 암기, 플래시카드·퀴즈·시험 모드까지 무료로 바로 체험해보세요.',
  keywords: [
    '영단어 앱', '단어장 앱', '영어 단어 암기', 'AI 영단어', '영단어 스캔',
    '수능 영단어', '토익 영단어', '토플 영단어', '영단어 퀴즈', '영어 단어장',
  ],
  alternates: { canonical: 'https://scanvoca.com' },
  openGraph: {
    title: 'Scan Voca - 사진 한 장으로 시작하는 스마트 영단어 학습',
    description: '교재·노트를 사진으로 찍으면 AI가 영단어를 자동 인식해 단어장을 만들어줍니다. 로그인 없이 바로 체험해보세요.',
    url: 'https://scanvoca.com',
    siteName: 'Scan Voca',
    locale: 'ko_KR',
    type: 'website',
    images: [{ url: '/icons/icon-512x512.png', width: 512, height: 512 }],
  },
  twitter: {
    card: 'summary',
    title: 'Scan Voca - 사진 한 장으로 시작하는 스마트 영단어 학습',
    description: '교재·노트를 사진으로 찍으면 AI가 영단어를 자동 인식해 단어장을 만들어줍니다.',
    images: ['/icons/icon-512x512.png'],
  },
};

const FEATURES = [
  {
    emoji: '📷',
    title: '스마트 스캔',
    description: '카메라나 갤러리 이미지에서 영단어를 자동으로 추출합니다. 단어뿐 아니라 숙어·구동사도 인식해요.',
  },
  {
    emoji: '🤖',
    title: 'AI 기반 학습',
    description: 'AI가 정확한 한국어 뜻과 예문을 자동으로 만들어주고, 단어별 난이도까지 분류해줍니다.',
  },
  {
    emoji: '📖',
    title: '스마트 단어장',
    description: '단어장을 폴더로 정리하고, 공유 코드로 친구와 나눌 수 있어요. 발음도 바로 들어볼 수 있습니다.',
  },
  {
    emoji: '🎯',
    title: '학습·퀴즈·시험 모드',
    description: '플래시카드, 객관식 퀴즈, 철자 시험까지 - 외운 단어를 다양한 방식으로 반복 학습합니다.',
  },
];

const AUDIENCE = ['수능 영단어를 준비하는 학생', '토익·토플 점수가 필요한 취준생·직장인', '효율적인 영단어 암기법을 찾는 모든 분'];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <div className="mx-auto max-w-3xl px-6 py-16">
        {/* 히어로 */}
        <div className="text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl border border-indigo-100 bg-indigo-50 dark:border-indigo-900 dark:bg-indigo-950/40">
            <Image src="/icons/icon-192x192.png" alt="Scan Voca" width={56} height={56} className="rounded-xl" />
          </div>
          <h1 className="text-3xl font-bold leading-snug text-gray-900 dark:text-gray-100 sm:text-4xl">
            사진 한 장으로 시작하는
            <br />
            스마트 영단어 학습
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-gray-500 dark:text-gray-400">
            교재·노트의 영어 단어를 사진으로 찍기만 하면, AI가 자동으로 뜻과 예문을 만들어
            단어장에 저장해줍니다. 타이핑 없이, 스캔하고 바로 외우세요.
          </p>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/home"
              className="rounded-2xl bg-indigo-600 px-8 py-3.5 text-sm font-semibold text-white transition hover:bg-indigo-700 active:scale-[0.99]"
            >
              지금 바로 체험하기 (회원가입 불필요)
            </Link>
            <Link
              href="/login"
              className="rounded-2xl border border-gray-200 bg-white px-8 py-3.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 active:scale-[0.99] dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              로그인
            </Link>
          </div>
        </div>

        {/* 기능 소개 */}
        <div className="mt-20 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-gray-100 bg-white p-6 dark:border-gray-800 dark:bg-gray-900"
            >
              <div className="text-2xl">{f.emoji}</div>
              <h2 className="mt-3 font-semibold text-gray-900 dark:text-gray-100">{f.title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-gray-500 dark:text-gray-400">{f.description}</p>
            </div>
          ))}
        </div>

        {/* 추천 대상 */}
        <div className="mt-16 rounded-2xl border border-indigo-100 bg-indigo-50 p-6 dark:border-indigo-900 dark:bg-indigo-950/30">
          <h2 className="font-semibold text-indigo-600 dark:text-indigo-400">🎓 이런 분들께 추천합니다</h2>
          <ul className="mt-3 space-y-1.5 text-sm text-gray-700 dark:text-gray-300">
            {AUDIENCE.map((a) => (
              <li key={a} className="flex items-start gap-2">
                <span className="text-indigo-400 dark:text-indigo-500">·</span>
                {a}
              </li>
            ))}
          </ul>
        </div>

        {/* 하단 CTA */}
        <div className="mt-16 text-center">
          <Link
            href="/home"
            className="inline-block rounded-2xl bg-indigo-600 px-8 py-3.5 text-sm font-semibold text-white transition hover:bg-indigo-700 active:scale-[0.99]"
          >
            무료로 시작하기
          </Link>
          <p className="mt-6 text-xs text-gray-400 dark:text-gray-500">
            <Link href="https://github.com/Choi-daewoong/scanvoca" className="hover:underline">GitHub</Link>
            {' · '}
            <Link
              href="https://github.com/Choi-daewoong/scanvoca/blob/master/PRIVACY_POLICY.md"
              className="hover:underline"
            >
              개인정보처리방침
            </Link>
          </p>
        </div>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebApplication',
            name: 'Scan Voca',
            alternateName: '스캔 보카',
            url: 'https://scanvoca.com',
            description: '교재·노트의 영어 단어를 사진으로 찍으면 AI가 자동으로 인식해 단어장을 만들어주는 스마트 영단어 학습 웹앱',
            applicationCategory: 'EducationalApplication',
            operatingSystem: 'Web',
            inLanguage: 'ko-KR',
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'KRW' },
          }),
        }}
      />
    </div>
  );
}
