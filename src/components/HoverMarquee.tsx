import React from 'react';
import { MarqueeText } from './MarqueeText';

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
  return (
    <MarqueeText
      text={text}
      className={className}
      title={title}
      style={style}
    />
  );
};
