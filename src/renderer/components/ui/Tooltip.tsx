import React, { useState, useRef, useCallback } from 'react';

interface TooltipProps {
  content: string;
  children: React.ReactElement;
  side?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
}

export function Tooltip({ content, children, side = 'top', delay = 400 }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const timer = useRef<number | null>(null);
  const ref = useRef<HTMLSpanElement>(null);

  const show = useCallback(() => {
    timer.current = window.setTimeout(() => {
      if (!ref.current) return;
      const r = ref.current.getBoundingClientRect();
      let x = r.left + r.width / 2;
      let y = r.top;
      if (side === 'bottom') y = r.bottom + 6;
      else if (side === 'top') y = r.top - 6;
      else if (side === 'left') {
        x = r.left - 6;
        y = r.top + r.height / 2;
      } else if (side === 'right') {
        x = r.right + 6;
        y = r.top + r.height / 2;
      }
      setPos({ x, y });
      setVisible(true);
    }, delay);
  }, [delay, side]);

  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setVisible(false);
  }, []);

  const style: React.CSSProperties = {
    left: pos.x,
    top: pos.y,
    transform:
      side === 'top'
        ? 'translate(-50%, -100%)'
        : side === 'bottom'
          ? 'translate(-50%, 0)'
          : side === 'left'
            ? 'translate(-100%, -50%)'
            : 'translate(0, -50%)',
  };

  return (
    <span
      ref={ref}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      style={{ display: 'inline-flex' }}
    >
      {children}
      {visible && content && (
        <span className="tooltip" style={style} role="tooltip">
          {content}
        </span>
      )}
    </span>
  );
}
