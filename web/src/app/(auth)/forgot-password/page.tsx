'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { authService } from '@/services/authService';

const emailSchema = z.object({ email: z.string().email('올바른 이메일을 입력하세요') });
const resetSchema = z.object({
  otp: z.string().length(6, '6자리 인증 코드를 입력하세요'),
  new_password: z.string().min(8, '비밀번호는 최소 8자 이상이어야 합니다'),
  confirm: z.string(),
}).refine((d) => d.new_password === d.confirm, {
  message: '비밀번호가 일치하지 않습니다',
  path: ['confirm'],
});

type EmailForm = z.infer<typeof emailSchema>;
type ResetForm = z.infer<typeof resetSchema>;

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<'email' | 'reset' | 'done'>('email');
  const [email, setEmail] = useState('');
  const [serverError, setServerError] = useState('');

  const emailForm = useForm<EmailForm>({ resolver: zodResolver(emailSchema) });
  const resetForm = useForm<ResetForm>({ resolver: zodResolver(resetSchema) });

  const onSendOtp = async (data: EmailForm) => {
    setServerError('');
    try {
      await authService.forgotPassword(data.email);
      setEmail(data.email);
      setStep('reset');
    } catch {
      setServerError('요청에 실패했습니다. 잠시 후 다시 시도하세요.');
    }
  };

  const onResetPassword = async (data: ResetForm) => {
    setServerError('');
    try {
      await authService.resetPassword(email, data.otp, data.new_password);
      setStep('done');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '오류가 발생했습니다.';
      setServerError(msg.includes('유효하지') ? '인증 코드가 올바르지 않거나 만료됐습니다.' : msg);
    }
  };

  if (step === 'done') {
    return (
      <div className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-gray-200">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
          <svg className="h-7 w-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="mb-2 text-xl font-bold text-gray-900">비밀번호 변경 완료</h2>
        <p className="mb-6 text-sm text-gray-500">새 비밀번호로 로그인하세요.</p>
        <Link
          href="/login"
          className="inline-block w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white text-center hover:bg-indigo-700"
        >
          로그인하기
        </Link>
      </div>
    );
  }

  if (step === 'reset') {
    return (
      <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-200">
        <h2 className="mb-2 text-xl font-bold text-gray-900">새 비밀번호 설정</h2>
        <p className="mb-6 text-sm text-gray-500">
          <span className="font-medium text-indigo-600">{email}</span>으로 전송된 6자리 코드를 입력하세요.
        </p>

        <form onSubmit={resetForm.handleSubmit(onResetPassword)} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">인증 코드</label>
            <input
              {...resetForm.register('otp')}
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-center text-lg font-bold tracking-widest outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
            {resetForm.formState.errors.otp && (
              <p className="mt-1 text-xs text-red-500">{resetForm.formState.errors.otp.message}</p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">새 비밀번호</label>
            <input
              {...resetForm.register('new_password')}
              type="password"
              autoComplete="new-password"
              placeholder="8자 이상"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
            {resetForm.formState.errors.new_password && (
              <p className="mt-1 text-xs text-red-500">{resetForm.formState.errors.new_password.message}</p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">비밀번호 확인</label>
            <input
              {...resetForm.register('confirm')}
              type="password"
              autoComplete="new-password"
              placeholder="비밀번호 재입력"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
            {resetForm.formState.errors.confirm && (
              <p className="mt-1 text-xs text-red-500">{resetForm.formState.errors.confirm.message}</p>
            )}
          </div>

          {serverError && (
            <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{serverError}</p>
          )}

          <button
            type="submit"
            disabled={resetForm.formState.isSubmitting}
            className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
          >
            {resetForm.formState.isSubmitting ? '변경 중...' : '비밀번호 변경'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-200">
      <h2 className="mb-2 text-xl font-bold text-gray-900">비밀번호 찾기</h2>
      <p className="mb-6 text-sm text-gray-500">가입한 이메일로 인증 코드를 발송해드립니다.</p>

      <form onSubmit={emailForm.handleSubmit(onSendOtp)} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">이메일</label>
          <input
            {...emailForm.register('email')}
            type="email"
            autoComplete="email"
            placeholder="가입한 이메일"
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
          {emailForm.formState.errors.email && (
            <p className="mt-1 text-xs text-red-500">{emailForm.formState.errors.email.message}</p>
          )}
        </div>

        {serverError && (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{serverError}</p>
        )}

        <button
          type="submit"
          disabled={emailForm.formState.isSubmitting}
          className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
        >
          {emailForm.formState.isSubmitting ? '전송 중...' : '인증 코드 받기'}
        </button>
      </form>

      <div className="mt-6 text-center">
        <Link href="/login" className="text-sm text-indigo-600 hover:underline">
          ← 로그인으로 돌아가기
        </Link>
      </div>
    </div>
  );
}
