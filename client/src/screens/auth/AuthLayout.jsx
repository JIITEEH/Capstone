import { useEffect, useRef } from 'react';
import { GraduationCap } from 'lucide-react';

// Eases --mx/--my on the page toward the cursor, which drives the liquid background and glass shine
function useLiquidPointer(ref) {
  useEffect(() => {
    const page = ref.current;
    if (!page || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const target = { x: 0.5, y: 0.4 };
    const current = { ...target };
    let frame = 0;

    function step() {
      current.x += (target.x - current.x) * 0.08;
      current.y += (target.y - current.y) * 0.08;
      page.style.setProperty('--mx', current.x.toFixed(4));
      page.style.setProperty('--my', current.y.toFixed(4));
      // Stop the loop once settled; the next pointer move restarts it
      frame = Math.abs(target.x - current.x) + Math.abs(target.y - current.y) > 0.0005 ? requestAnimationFrame(step) : 0;
    }

    function onPointerMove(event) {
      target.x = event.clientX / window.innerWidth;
      target.y = event.clientY / window.innerHeight;
      if (!frame) frame = requestAnimationFrame(step);
    }

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      cancelAnimationFrame(frame);
    };
  }, [ref]);
}

export default function AuthLayout({ children }) {
  const pageRef = useRef(null);
  useLiquidPointer(pageRef);

  return (
    <div className="auth-page" ref={pageRef}>
      <div className="liquid" aria-hidden="true">
        <div className="liquid-blob liquid-blob-1" />
        <div className="liquid-blob liquid-blob-2" />
        <div className="liquid-blob liquid-blob-3" />
        <div className="liquid-blob liquid-blob-4" />
        <div className="liquid-glow" />
      </div>
      <div className="auth-shell">
        <main className="auth-panel">
          <div className="auth-logo">
            <GraduationCap size={20} />
            ThesisTrack
          </div>
          <div className="auth-card">{children}</div>
          <footer className="auth-foot">
            <span>Thesis Management System</span>
            <span>© {new Date().getFullYear()} ThesisTrack</span>
          </footer>
        </main>

        {/* Plain blue panel: no floating cards, no avatars, nothing to go stale */}
        <aside className="auth-visual" aria-hidden="true" />
      </div>
    </div>
  );
}
