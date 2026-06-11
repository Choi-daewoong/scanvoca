'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authService } from '@/services/authService';
import { useAuthStore } from '@/stores/authStore';

const schema = z.object({
  display_name: z.string().min(1, '이름을 입력하세요').max(30),
  email: z.string().email('올바른 이메일을 입력하세요'),
  password: z.string().min(8, '비밀번호는 최소 8자 이상이어야 합니다'),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, {
  message: '비밀번호가 일치하지 않습니다',
  path: ['confirm'],
});
type FormData = z.infer<typeof schema>;

export default function RegisterPage() {
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
      await authService.register(data.email, data.password, data.display_name);
      await login(data.email, data.password);
      router.replace('/home');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '회원가입에 실패했습니다.';
      setServerError(msg === 'Email already registered' ? '이미 사용 중인 이메일입니다.' : msg);
    }
  };

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <h2 className="mb-6 text-xl font-bold text-gray-900 dark:text-gray-100">회원가입</h2>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">이름</label>
          <input
            {...register('display_name')}
            type="text"
            placeholder="홍길동"
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:ring-indigo-950"
          />
          {errors.display_name && <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.display_name.message}</p>}
        </div>

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
            autoComplete="new-password"
            placeholder="8자 이상"
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:ring-indigo-950"
          />
          {errors.password && <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.password.message}</p>}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">비밀번호 확인</label>
          <input
            {...register('confirm')}
            type="password"
            autoComplete="new-password"
            placeholder="비밀번호 재입력"
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:ring-indigo-950"
          />
          {errors.confirm && <p className="mt-1 text-xs text-red-500 dark:text-red-400">{errors.confirm.message}</p>}
        </div>

        {serverError && (
          <p className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">{serverError}</p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-xl border border-indigo-100 bg-indigo-50 py-3 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-100 disabled:opacity-60 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-400 dark:hover:bg-indigo-950/70"
        >
          {isSubmitting ? '가입 중...' : '회원가입'}
        </button>
      </form>

      <div className="mt-6 border-t border-gray-100 pt-6 text-center dark:border-gray-800">
        <span className="text-sm text-gray-500 dark:text-gray-400">이미 계정이 있으신가요? </span>
        <Link href="/login" className="text-sm font-semibold text-indigo-500 hover:underline dark:text-indigo-400">
          로그인
        </Link>
      </div>
    </div>
  );
}
