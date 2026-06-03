'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';

const schema = z.object({
  email: z.string().email('올바른 이메일을 입력하세요'),
  password: z.string().min(1, '비밀번호를 입력하세요'),
});
type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuthStore();
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setServerError('');
    try {
      await login(data.email, data.password);
      router.replace('/home');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '로그인에 실패했습니다.';
      setServerError(msg === 'Incorrect email or password' ? '이메일 또는 비밀번호가 올바르지 않습니다.' : msg);
    }
  };

  return (
    <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-200">
      <h2 className="mb-6 text-xl font-bold text-gray-900">로그인</h2>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">이메일</label>
          <input
            {...register('email')}
            type="email"
            autoComplete="email"
            placeholder="example@email.com"
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
          {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">비밀번호</label>
          <input
            {...register('password')}
            type="password"
            autoComplete="current-password"
            placeholder="비밀번호"
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
          {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>}
        </div>

        {serverError && (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{serverError}</p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
        >
          {isSubmitting ? '로그인 중...' : '로그인'}
        </button>
      </form>

      <div className="mt-4 text-center">
        <Link href="/forgot-password" className="text-sm text-indigo-600 hover:underline">
          비밀번호를 잊으셨나요?
        </Link>
      </div>

      <div className="mt-6 border-t border-gray-100 pt-6 text-center">
        <span className="text-sm text-gray-500">계정이 없으신가요? </span>
        <Link href="/register" className="text-sm font-semibold text-indigo-600 hover:underline">
          회원가입
        </Link>
      </div>
    </div>
  );
}
