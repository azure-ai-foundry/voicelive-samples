import { useEffect, useRef, useState } from "react";

export function useFlashOnChange<T>(value: T, ms = 3000) {
  const prev = useRef<T>(value);
  const [on, setOn] = useState(false);

  useEffect(() => {
    if (Object.is(prev.current, value)) return;
    prev.current = value;

    const t0 = window.setTimeout(() => setOn(false), 0);
    const t1 = window.setTimeout(() => setOn(true), 10);
    const t2 = window.setTimeout(() => setOn(false), ms);

    return () => {
      window.clearTimeout(t0);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [value, ms]);

  return on;
}
