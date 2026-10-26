import { useQuery } from '@tanstack/react-query';
import { useDeferredValue, useMemo, useState } from 'react';
import { getTextStats, splitMatches } from '../../domain/textStats';
import { ErrorState, Spinner } from '../../ui/Feedback';
import { Field } from '../../ui/Field';

async function fetchNotes(file, signal) {
  const res = await fetch(`/books/${encodeURIComponent(file)}`, { signal });
  if (!res.ok) throw new Error(`Couldn’t load the notes (${res.status}).`);
  return res.text();
}

/**
 * The original Blurb feature: a long-form note about the book with
 * find-in-text highlighting and word statistics. Text comes from the
 * project's original .txt files in /public/books.
 */
export function BlurbNotes({ file }) {
  const notes = useQuery({
    queryKey: ['catalogue', 'blurb-notes', file],
    queryFn: ({ signal }) => fetchNotes(file, signal),
    staleTime: Infinity,
  });
  const [find, setFind] = useState('');
  const deferredFind = useDeferredValue(find);
  const body = useMemo(() => {
    // The first lines of the original files repeat the title/author.
    const lines = (notes.data ?? '').split(/\r?\n/);
    const start = lines.findIndex((l, i) => i > 0 && l.trim().length > 80);
    return lines.slice(Math.max(start, 0)).join('\n').trim();
  }, [notes.data]);
  const stats = useMemo(() => getTextStats(body), [body]);
  const paragraphs = useMemo(() => body.split(/\n\s*\n|\n/).filter((p) => p.trim()), [body]);
  const matchCount = useMemo(
    () => paragraphs.reduce((n, p) => n + splitMatches(p, deferredFind).filter((s) => s.match).length, 0),
    [paragraphs, deferredFind],
  );

  if (notes.isPending) return <Spinner label="Loading Blurb notes" />;
  if (notes.isError) return <ErrorState error={notes.error} onRetry={() => notes.refetch()} />;

  return (
    <div className="blurb-notes">
      <div className="blurb-notes__text">
        <Field
          label="Find in these notes"
          hint={deferredFind.trim() ? `${matchCount} ${matchCount === 1 ? 'match' : 'matches'}` : 'Highlights every match'}
        >
          <input type="search" value={find} onChange={(e) => setFind(e.target.value)} autoComplete="off" />
        </Field>
        <p className="visually-hidden" aria-live="polite">
          {deferredFind.trim() ? `${matchCount} matches for ${deferredFind}` : ''}
        </p>
        <div className="blurb-notes__body" tabIndex={0} aria-label="Blurb notes text">
          {paragraphs.map((p, i) => (
            <p key={i}>
              {splitMatches(p, deferredFind).map((seg, j) => (seg.match ? <mark key={j}>{seg.text}</mark> : <span key={j}>{seg.text}</span>))}
            </p>
          ))}
        </div>
      </div>
      <aside className="word-insights" aria-label="Word insights">
        <h4>Word insights</h4>
        <dl className="word-insights__stats">
          <div>
            <dt>Words</dt>
            <dd>{stats.words.toLocaleString()}</dd>
          </div>
          <div>
            <dt>Characters</dt>
            <dd>{stats.characters.toLocaleString()}</dd>
          </div>
        </dl>
        <h5>Most used</h5>
        <ol className="word-list">
          {stats.mostUsed.map(([word, count]) => (
            <li key={word}>
              <button type="button" className="link-button" onClick={() => setFind(word)} aria-label={`Highlight “${word}”, used ${count} times`}>
                {word}
              </button>
              <span className="muted">×{count}</span>
            </li>
          ))}
        </ol>
        <h5>Used once</h5>
        <p className="muted word-insights__rare">{stats.leastUsed.map(([w]) => w).join(', ')}</p>
      </aside>
    </div>
  );
}
