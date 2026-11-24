import React, { useState, useRef, useEffect, useCallback } from 'react';

interface MarqueeTextProps {
  text?: string | null;
  className?: string;
  style?: React.CSSProperties;
  speed?: number; // pixels per second
  wrapperClassName?: string;
}

export const MarqueeText: React.FC<MarqueeTextProps> = ({
  text = '',
  className = '',
  style,
  speed = 36,
  wrapperClassName = '',
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
      setOffset(diff > 2 ? Math.ceil(diff + 16) : 0);
    }
  }, []);

  useEffect(() => {
    checkOverflow();
    const handleResize = () => checkOverflow();
    window.addEventListener('resize', handleResize);

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      ro = new ResizeObserver(() => checkOverflow());
      ro.observe(containerRef.current);
      if (textRef.current) ro.observe(textRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      ro?.disconnect();
    };
  }, [text, checkOverflow]);

  const animationDuration = Math.max(3.2, (offset / speed) * 2.2);

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => {
        checkOverflow();
        setIsHovered(true);
      }}
      onMouseLeave={() => setIsHovered(false)}
      className={`overflow-hidden whitespace-nowrap min-w-0 select-none cursor-default leading-normal ${wrapperClassName}`}
      title={text || ''}
    >
      <style>{`
        @keyframes spytifyMarqueePingPong {
          0%, 8% {
            transform: translateX(0px);
          }
          48%, 56% {
            transform: translateX(var(--marquee-offset, -30px));
          }
          96%, 100% {
            transform: translateX(0px);
          }
        }
      `}</style>
      <span
        ref={textRef}
        style={{
          display: 'inline-block',
          width: 'max-content',
          maxWidth: 'none',
          ...(isHovered && offset > 0
            ? {
                animation: `spytifyMarqueePingPong ${animationDuration.toFixed(2)}s cubic-bezier(0.4, 0, 0.2, 1) infinite`,
                '--marquee-offset': `-${offset}px`,
              }
            : {
                transform: 'translateX(0px)',
                transition: 'transform 0.3s ease-out',
              }),
          ...style,
        } as React.CSSProperties}
        className={className}
      >
        {text}
      </span>
    </div>
  );
};
