import { useState, useEffect, useRef } from "react";

export function useScrollDirectionNav() {
  const [isHidden, setIsHidden] = useState(false);
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

          // Hide nav when scrolling down past threshold
          if (delta > 0 && currentScrollY > 80) {
            setIsHidden(true);
            setIsCompact(true);
          }

          // Show nav when scrolling up
          if (delta < 0) {
            setIsHidden(false);
            setIsCompact(false);
          }

          // Always show at top
          if (currentScrollY <= 20) {
            setIsHidden(false);
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
  }, []);

  return { isHidden, isCompact, expanded: !isCompact };
}
