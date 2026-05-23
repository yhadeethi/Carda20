import { useState, useEffect, useRef } from "react";

/**
 * Hook for iOS Photos-style nav morphing based on scroll direction
 * - Scrolling UP (reading more content) = compact nav (labels hidden)
 * - Scrolling DOWN (back to top) or idle = expanded nav (labels visible)
 */
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

          // Need meaningful scroll (>5px) to trigger change
          if (Math.abs(delta) < 5) {
            ticking.current = false;
            return;
          }

          // Scrolling DOWN into content = compact nav (labels fade out), hide after threshold
          if (delta > 0 && currentScrollY > 50) {
            setIsCompact(true);
            // Hide completely when scrolled far enough down
            if (currentScrollY > 200) {
              setIsHidden(true);
            }
          }

          // Scrolling UP = expand nav (labels fade in), show nav
          if (delta < 0) {
            setIsCompact(false);
            setIsHidden(false);
          }

          // At top of page = always expanded and visible
          if (currentScrollY <= 20) {
            setIsCompact(false);
            setIsHidden(false);
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
