import { useEffect, useRef, useState } from "react";

export interface RemCursorState {
  x: number;
  y: number;
  enabled: boolean;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function useRemCursor(): RemCursorState {
  const [cursor, setCursor] = useState<RemCursorState>({ x: 0.5, y: 0.5, enabled: false });
  const targetRef = useRef({ x: 0.5, y: 0.5 });
  const currentRef = useRef({ x: 0.5, y: 0.5 });

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const isTouch = window.matchMedia("(pointer: coarse)").matches;
    const enabled = !media.matches && !isTouch;

    if (!enabled) {
      setCursor({ x: 0.5, y: 0.5, enabled: false });
      return;
    }

    let frameId = 0;

    const onMove = (event: MouseEvent) => {
      targetRef.current.x = clamp(event.clientX / window.innerWidth, 0, 1);
      targetRef.current.y = clamp(event.clientY / window.innerHeight, 0, 1);
    };

    const animate = () => {
      const damping = 0.14;
      currentRef.current.x += (targetRef.current.x - currentRef.current.x) * damping;
      currentRef.current.y += (targetRef.current.y - currentRef.current.y) * damping;

      setCursor({
        x: currentRef.current.x,
        y: currentRef.current.y,
        enabled: true,
      });
      frameId = window.requestAnimationFrame(animate);
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    frameId = window.requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.cancelAnimationFrame(frameId);
    };
  }, []);

  return cursor;
}
