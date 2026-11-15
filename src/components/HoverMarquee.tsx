import React, { useRef, useState, useEffect } from 'react';

export interface HoverMarqueeProps {
  text: string;
  className?: string;
  title?: string;
  style?: React.CSSProperties;
}

export const HoverMarquee: React.FC<HoverMarqueeProps> = ({
  text,
  className = '',
  title,
  style,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    if (containerRef.current && textRef.current) {
      setOverflows(textRef.current.scrollWidth > containerRef.current.clientWidth);
    }
  }, [text]);

  const handleMouseEnter = () => {
    if (containerRef.current && textRef.current) {
      setOverflows(textRef.current.scrollWidth > containerRef.current.clientWidth);
    }
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  const scrollDistance = (textRef.current?.scrollWidth || 0) - (containerRef.current?.clientWidth || 0);

  return (
    <div
      ref={containerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      title={title || text}
      className={`relative overflow-hidden whitespace-nowrap ${className}`}
      style={style}
    >
      <span
        ref={textRef}
        className="inline-block transition-transform ease-linear"
        style={{
          transform: isHovered && overflows && scrollDistance > 0 ? `translateX(-${scrollDistance}px)` : 'translateX(0px)',
          transitionDuration: overflows && scrollDistance > 0 ? `${Math.max(1.5, scrollDistance / 35)}s` : '0.3s',
        }}
      >
        {text}
      </span>
    </div>
  );
};
