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
  speed = 32,
  wrapperClassName = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [offset, setOffset] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const checkOverflow = useCallback(() => {
    if (containerRef.current && textRef.current) {
      const diff = textRef.current.scrollWidth - containerRef.current.clientWidth;
      setOffset(diff > 0 ? diff + 12 : 0);
    }
  }, []);

  useEffect(() => {
    checkOverflow();
    const handleResize = () => checkOverflow();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [text, checkOverflow]);

  const animationDuration = Math.max(2.5, (offset / speed) * 2);

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => {
        checkOverflow();
        setIsHovered(true);
      }}
      onMouseLeave={() => setIsHovered(false)}
      className={`overflow-hidden whitespace-nowrap min-w-0 select-none cursor-default ${wrapperClassName}`}
      title={text || ''}
    >
      <span
        ref={textRef}
        style={{
          display: 'inline-block',
          ...(isHovered && offset > 0
            ? {
                animation: `marquee-ping-pong ${animationDuration}s ease-in-out infinite`,
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
