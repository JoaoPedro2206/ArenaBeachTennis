import { useEffect, useRef, useState } from 'react';

/**
 * Contagem regressiva até `deadline` (timestamp em ms, no relógio do
 * navegador). Chama `onExpire` uma única vez quando chega a zero.
 * Atualiza 4x por segundo para o "15:00 -> 14:59" não atrasar visualmente.
 */
export function useCountdown(deadline: number | null, onExpire?: () => void): number {
  const [remaining, setRemaining] = useState(() => (deadline ? Math.max(deadline - Date.now(), 0) : 0));
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    if (!deadline) return;
    let fired = false;

    const tick = () => {
      const left = Math.max(deadline - Date.now(), 0);
      setRemaining(left);
      if (left === 0 && !fired) {
        fired = true;
        onExpireRef.current?.();
      }
    };

    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [deadline]);

  return remaining;
}

/** 754000 -> "12:34" */
export function formatMmSs(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
