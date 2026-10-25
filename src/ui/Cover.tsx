import { memo } from 'react';
import type { BookEdition } from '../domain/types';

interface CoverProps {
  edition: Pick<BookEdition, 'id' | 'title' | 'authors' | 'cover'>;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

/**
 * Generated typographic cover. No network images means no broken covers,
 * no layout shift and nothing to license — and every book still looks distinct.
 */
export const Cover = memo(function Cover({ edition, size = 'md' }: CoverProps) {
  const { hue, motif } = edition.cover;
  const bg = `hsl(${hue} 42% 30%)`;
  const fg = `hsl(${hue} 60% 90%)`;
  const mark = `hsl(${hue} 55% 62% / 0.55)`;
  const title = edition.title.replace(/\s*\(.*\)$/, '');
  return (
    <div className={`cover cover--${size}`} style={{ background: bg, color: fg }} aria-hidden="true">
      <svg className="cover__motif" viewBox="0 0 100 150" preserveAspectRatio="none">
        <Motif motif={motif} color={mark} />
      </svg>
      <div className="cover__text">
        <span className="cover__title">{title}</span>
        {size !== 'xs' && <span className="cover__author">{edition.authors.join(', ')}</span>}
      </div>
      <span className="cover__spine" />
    </div>
  );
});

function Motif({ motif, color }: { motif: BookEdition['cover']['motif']; color: string }) {
  switch (motif) {
    case 'stripes':
      return (
        <g fill={color}>
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x="0" y={98 + i * 12} width="100" height="5" />
          ))}
        </g>
      );
    case 'circle':
      return <circle cx="70" cy="112" r="34" fill={color} />;
    case 'arch':
      return <path d="M18 150 V112 a32 32 0 0 1 64 0 V150 Z" fill={color} />;
    case 'grid':
      return (
        <g fill={color}>
          {Array.from({ length: 16 }, (_, i) => (
            <rect key={i} x={14 + (i % 4) * 19} y={92 + Math.floor(i / 4) * 14} width="10" height="7" rx="1" />
          ))}
        </g>
      );
    case 'wave':
      return <path d="M0 118 Q25 102 50 118 T100 118 V150 H0 Z M0 132 Q25 116 50 132 T100 132" fill={color} />;
    case 'diamond':
      return <path d="M50 88 L84 120 L50 150 L16 120 Z" fill={color} />;
  }
}
