import { useEffect, useState } from 'react';

export function useOrderExpiry(expiresAt: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!expiresAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);
  const remaining = expiresAt ? Math.max(0, new Date(expiresAt).getTime() - now) : 0;
  return { remaining, expired: Boolean(expiresAt && remaining <= 0) };
}

export default function OrderExpiryCountdown({ expiresAt }: { expiresAt: string }) {
  const { remaining, expired } = useOrderExpiry(expiresAt);
  if (expired) return <span className="order-expiry expired">Reservation expired</span>;
  const seconds = Math.floor(remaining / 1000);
  const minutesPart = Math.floor(seconds / 60);
  const secondsPart = seconds % 60;
  const hoursPart = Math.floor(minutesPart / 60);
  return (
    <span className="order-expiry" role="timer" aria-live="off">
      Time to pay:{' '}
      {hoursPart > 0
        ? `${String(hoursPart).padStart(2, '0')}:`
        : ''}
      {String(minutesPart % 60).padStart(2, '0')}:
      {String(secondsPart).padStart(2, '0')}
    </span>
  );
}
