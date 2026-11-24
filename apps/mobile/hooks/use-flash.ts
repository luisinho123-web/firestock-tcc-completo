import { useEffect, useRef, useState } from 'react';

/** Boolean that turns itself off after `durationMs` — for transient confirmations like "Adicionado" or
 * "Copiado!". The pending timer is cleared on re-trigger and on unmount, so it never sets state on an
 * unmounted screen. */
export function useFlash(durationMs = 1500): [boolean, () => void] {
  const [active, setActive] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const trigger = () => {
    if (timer.current) clearTimeout(timer.current);
    setActive(true);
    timer.current = setTimeout(() => setActive(false), durationMs);
  };

  return [active, trigger];
}
