import { Icon } from '../../ui/Icon';

/**
 * Renders a preview with an unmissable label saying what it is: verbatim
 * public-domain text (with source), or text written for this demo.
 */
export function PreviewText({ preview, compact = false }) {
  const isExcerpt = preview.kind === 'public-domain-excerpt';
  return (
    <figure className={`preview${compact ? ' preview--compact' : ''}`}>
      <figcaption className={`preview__label preview__label--${isExcerpt ? 'excerpt' : 'original'}`}>
        <Icon name={isExcerpt ? 'book' : 'sparkle'} size={16} />
        {isExcerpt ? 'Excerpt · public domain' : 'Original demo text · not from a published book'}
      </figcaption>
      <blockquote className="preview__text">
        {preview.text.split('\n\n').map((para, i) => (
          <p key={i}>
            {para.split('\n').map((line, j, lines) => (
              <span key={j}>
                {line}
                {j < lines.length - 1 && <br />}
              </span>
            ))}
          </p>
        ))}
      </blockquote>
      {isExcerpt && <p className="preview__source">Source: {preview.source}</p>}
    </figure>
  );
}
