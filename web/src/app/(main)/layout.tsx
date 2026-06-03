import AuthGuard from '@/components/common/AuthGuard';
import BottomNav from '@/components/common/BottomNav';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="mx-auto min-h-screen max-w-lg bg-white">
        <main className="pb-20">{children}</main>
        <BottomNav />
      </div>
    </AuthGuard>
  );
}
