'use client';

import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import Script from 'next/script';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

const schema = z.object({
  email: z.string().email('올바른 이메일을 입력하세요'),
  password: z.string().min(1, '비밀번호를 입력하세요'),
});
type FormData = z.infer<typeof schema>;

const SAVED_EMAIL_KEY = 'saved_email';

export default function LoginPage() {
  const router = useRouter();
  const { login, googleLogin } = useAuthStore();
  const [serverError, setServerError] = useState('');
  const [saveEmail, setSaveEmail] = useState(false);
  const [stayLoggedIn, setStayLoggedIn] = useState(false);
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const stayLoggedInRef = useRef(stayLoggedIn);
  stayLoggedInRef.current = stayLoggedIn;

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  // 저장된 이메일 불러오기
  useEffect(() => {
    const saved = localStorage.getItem(SAVED_EMAIL_KEY);
    if (saved) {
      setValue('email', saved);
      setSaveEmail(true);
    }
  }, [setValue]);

  const onSubmit = async (data: FormData) => {
    setServerError('');

    if (saveEmail) {
      localStorage.setItem(SAVED_EMAIL_KEY, data.email);
    } else {
      localStorage.removeItem(SAVED_EMAIL_KEY);
    }

    try {
      await login(data.email, data.password, stayLoggedIn);
      router.replace('/home');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '로그인에 실패했습니다.';
      setServerError(msg === 'Incorrect email or password' ? '이메일 또는 비밀번호가 올바르지 않습니다.' : msg);
    }
  };

  const handleGoogleCredential = async (response: { credential: string }) => {
    setServerError('');
    try {
      await googleLogin(response.credential, stayLoggedInRef.current);
      router.replace('/home');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '구글 로그인에 실패했습니다.';
      setServerError(msg);
    }
  };

  const initGoogleButton = () => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId || !window.google || !googleButtonRef.current) return;
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: handleGoogleCredential,
    });
    window.google.accounts.id.renderButton(googleButtonRef.current, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      width: 320,
      text: 'continue_with',
      locale: 'ko',
    });
  };

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <h2 className="mb-6 text-xl font-bold text-gray-900 dark:text-gray-100">로그인</h2>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">이메일</label>
          <input
            {...register('email')}
            type="email"
            autoComplete="email"
            placeholder="example@email.com"
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:ring-indigo-950"
          />
          {errors.email && <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.email.message}</p>}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">비밀번호</label>
          <input
            {...register('password')}
            type="password"
            autoComplete="current-password"
            placeholder="비밀번호"
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:ring-indigo-950"
          />
          {errors.password && <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.password.message}</p>}
        </div>

        {/* 체크박스 옵션 */}
        <div className="flex items-center justify-between">
          <label className="flex cursor-pointer items-center gap-2 select-none">
            <input
              type="checkbox"
              checked={saveEmail}
              onChange={(e) => setSaveEmail(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 accent-indigo-600 dark:border-gray-600"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">이메일 저장</span>
          </label>

          <label className="flex cursor-pointer items-center gap-2 select-none">
            <input
              type="checkbox"
              checked={stayLoggedIn}
              onChange={(e) => setStayLoggedIn(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 accent-indigo-600 dark:border-gray-600"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">로그인 유지</span>
          </label>
        </div>

        {serverError && (
          <p className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">{serverError}</p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-xl border border-indigo-100 bg-indigo-50 py-3 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-100 disabled:opacity-60 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-400 dark:hover:bg-indigo-950/70"
        >
          {isSubmitting ? '로그인 중...' : '로그인'}
        </button>
      </form>

      <div className="mt-4 text-center">
        <Link href="/forgot-password" className="text-sm text-indigo-500 hover:underline dark:text-indigo-400">
          비밀번호를 잊으셨나요?
        </Link>
      </div>

      {process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && (
        <>
          <div className="mt-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-100 dark:bg-gray-800" />
            <span className="text-xs text-gray-400 dark:text-gray-500">또는</span>
            <div className="h-px flex-1 bg-gray-100 dark:bg-gray-800" />
          </div>

          <div className="mt-4 flex justify-center">
            <div ref={googleButtonRef} />
          </div>

          <Script
            src="https://accounts.google.com/gsi/client"
            strategy="afterInteractive"
            onLoad={initGoogleButton}
          />
        </>
      )}

      <div className="mt-6 border-t border-gray-100 pt-6 text-center dark:border-gray-800">
        <span className="text-sm text-gray-500 dark:text-gray-400">계정이 없으신가요? </span>
        <Link href="/register" className="text-sm font-semibold text-indigo-500 hover:underline dark:text-indigo-400">
          회원가입
        </Link>
      </div>
    </div>
  );
}
