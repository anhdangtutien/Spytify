import React, { useState, useRef, useEffect, useCallback } from 'react';

interface MarqueeTextProps {
  text?: string | null;
  className?: string;
  style?: React.CSSProperties;
  speed?: number; // pixels per second
  wrapperClassName?: string;
  title?: string;
}

export const MarqueeText: React.FC<MarqueeTextProps> = ({
  text = '',
  className = '',
  style,
  speed = 36,
  wrapperClassName = '',
  title,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [offset, setOffset] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const checkOverflow = useCallback(() => {
    if (containerRef.current && textRef.current) {
      const containerW = containerRef.current.clientWidth;
      const textW = textRef.current.scrollWidth;
      const diff = textW - containerW;
      const newOffset = diff > 4 ? Math.ceil(diff + 16) : 0;
      setOffset(prev => (prev === newOffset ? prev : newOffset));
    }
  }, []);

  useEffect(() => {
    checkOverflow();
    const handleResize = () => checkOverflow();
    window.addEventListener('resize', handleResize);

    // Font load handler
    if (typeof document !== 'undefined' && (document as any).fonts) {
      (document as any).fonts.ready.then(() => checkOverflow());
    }

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      ro = new ResizeObserver(() => checkOverflow());
      ro.observe(containerRef.current);
    }

    const t = setTimeout(() => checkOverflow(), 150);

    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', handleResize);
      ro?.disconnect();
    };
  }, [text, checkOverflow]);

  const animationDuration = Math.max(3.5, (offset / speed) * 1.8);

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => {
        checkOverflow();
        setIsHovered(true);
      }}
      onMouseLeave={() => setIsHovered(false)}
      className={`spytify-marquee-container ${offset > 0 ? 'is-overflowing' : ''} ${wrapperClassName}`}
      title={title !== undefined ? title : text || ''}
      style={{
        '--marquee-offset': `-${offset}px`,
        '--marquee-duration': `${animationDuration.toFixed(2)}s`,
      } as React.CSSProperties}
    >
      <span
        ref={textRef}
        className={`spytify-marquee-content ${className}`}
        style={{
          ...style,
          ...(isHovered && offset > 0
            ? {
                animation: `marquee-ping-pong ${animationDuration.toFixed(2)}s cubic-bezier(0.4, 0, 0.2, 1) infinite`,
              }
            : undefined),
        }}
      >
        {text}
      </span>
    </div>
  );
};
