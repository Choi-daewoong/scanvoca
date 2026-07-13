import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';

/**
 * 관리자가 소개(intro) 게시글을 쓰거나/고치거나/지운 직후 호출한다.
 * /intro 목록·상세 페이지는 1시간 ISR 캐시라, 이걸 안 부르면 최대 1시간 동안
 * 방금 올린 글이 안 보일 수 있다.
 */
export async function POST() {
  revalidatePath('/intro');
  revalidatePath('/intro/[id]', 'page');
  revalidatePath('/sitemap.xml');
  return NextResponse.json({ revalidated: true });
}
