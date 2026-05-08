'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LandingPage() {
  const router = useRouter();

  useEffect(() => {
    router.push('/landing-v2');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#080B14]">
      <p className="text-white">Redirecionando para landing...</p>
    </div>
  );
}
