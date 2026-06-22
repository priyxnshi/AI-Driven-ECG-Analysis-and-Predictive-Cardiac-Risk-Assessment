'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Sidebar from './Sidebar';

export default function AuthWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  // Start as null = "not yet checked"
  const [authChecked, setAuthChecked] = useState(false);
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const isLoginPage = pathname === '/login';

    if (!token && !isLoginPage) {
      // No token and not on login — redirect
      router.replace('/login');
    } else if (token && isLoginPage) {
      // Already logged in but on login page — send to app
      router.replace('/');
    }

    setHasToken(!!token);
    setAuthChecked(true);
  }, [pathname, router]);

  const isLoginPage = pathname === '/login';

  // While we haven't checked localStorage yet, show nothing (avoids flash redirect)
  if (!authChecked) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <span className="text-sm font-medium text-text-secondary">Loading...</span>
        </div>
      </div>
    );
  }

  if (isLoginPage) {
    return <div className="min-h-screen w-full flex bg-background">{children}</div>;
  }

  // If no token and not login page, show nothing while redirect happens
  if (!hasToken) {
    return null;
  }

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
