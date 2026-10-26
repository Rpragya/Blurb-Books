import { memo } from 'react';

/**
 * Local illustrated jackets for featured titles, with typographic artwork
 * for the rest of the demo catalogue. Assets never require runtime network access.
 */
export const Cover = memo(function Cover({ edition, size = 'md' }) {
  const illustrated = ['mapleford', 'dracula'].includes(edition.id);
  if (illustrated) {
    return <div className={`cover cover--${size} cover--illustrated`} style={{ backgroundImage: `url(/images/generated/cover-${edition.id}.webp)`, backgroundSize: 'cover', backgroundPosition: 'center' }} aria-hidden="true"><span className="cover__spine" /></div>;
  }
  const { hue, motif } = edition.cover;
  const bg = `hsl(${hue} 42% 30%)`;
  const fg = `hsl(${hue} 60% 90%)`;
  const mark = `hsl(${hue} 55% 62% / 0.55)`;
  const title = edition.title.replace(/\s*\(.*\)$/, '');
  return (
    <div className={`cover cover--${size}`} style={{ background: bg, color: fg }} aria-hidden="true">
      <img className="cover__artwork" src={`/images/generated/genre-${motif === 'diamond' || motif === 'arch' ? 'mystery' : motif === 'wave' || motif === 'grid' ? 'science' : 'fiction'}.webp`} alt="" loading="lazy" />
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

function Motif({ motif, color }) {
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
