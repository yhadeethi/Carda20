import { useState, useEffect, useRef } from "react";

export function useScrollDirectionNav() {
  const [isCompact, setIsCompact] = useState(false);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    const handleScroll = () => {
      if (!ticking.current) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          const delta = currentScrollY - lastScrollY.current;

          if (Math.abs(delta) < 8) {
            ticking.current = false;
            return;
          }

          if (delta > 0 && !isCompact && currentScrollY > 50) {
            setIsCompact(true);
          }

          if (delta < 0 && isCompact) {
            setIsCompact(false);
          }

          if (currentScrollY <= 20 && isCompact) {
            setIsCompact(false);
          }

          lastScrollY.current = currentScrollY;
          ticking.current = false;
        });

        ticking.current = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [isCompact]);

  return { isCompact, expanded: !isCompact };
}
