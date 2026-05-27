import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';

const DesktopModeWarning: React.FC = () => {
  const { lang } = useApp();
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    const checkMode = () => {
      const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const isPortrait = window.innerHeight > window.innerWidth;
      const isDesktopViewport = window.innerWidth >= 980;

      if (isTouch && isPortrait && isDesktopViewport) {
        setShowWarning(true);
      } else {
        setShowWarning(false);
      }
    };

    // Run checks on mount
    checkMode();

    // Listen for resize/orientation changes
    window.addEventListener('resize', checkMode);
    return () => window.removeEventListener('resize', checkMode);
  }, []);

  if (!showWarning) return null;

  return (
    <div className="bg-amber-600 text-white px-4 py-3 text-center text-xs font-black uppercase tracking-wider fixed top-0 left-0 right-0 z-[99999] shadow-lg flex items-center justify-center gap-3 select-none">
      <span>
        {lang === 'EN'
          ? '🔔 Mobile Desktop Site is enabled. Please disable it in browser settings (3-dot menu) for the best mobile layout!'
          : '🔔 Điện thoại đang bật "Trang web cho máy tính". Hãy tắt trong menu trình duyệt (nút 3 chấm) để có giao diện đẹp nhất!'}
      </span>
      <button
        onClick={() => setShowWarning(false)}
        className="bg-white/20 hover:bg-white/30 text-white rounded-full w-5 h-5 flex items-center justify-center text-sm font-black transition-all cursor-pointer border-none outline-none shrink-0"
        aria-label="Close"
      >
        ×
      </button>
    </div>
  );
};

export default DesktopModeWarning;
