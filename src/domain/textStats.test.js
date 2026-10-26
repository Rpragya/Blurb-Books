import { describe, expect, it } from 'vitest';
import { getTextStats, splitMatches } from './textStats';

describe('getTextStats (ported from the original SearchString.js)', () => {
  it('counts words and ranks them, ignoring stop words', () => {
    const stats = getTextStats('The cat sat. The cat ran. A dog sat with the cat.');
    expect(stats.words).toBe(12);
    expect(stats.mostUsed[0]).toEqual(['cat', 3]);
    expect(stats.mostUsed.map(([w]) => w)).not.toContain('the');
  });
});

describe('splitMatches', () => {
  it('splits case-insensitively and treats the query literally', () => {
    expect(splitMatches('Holmes and holmes (again)', 'holmes')).toEqual([
      { text: 'Holmes', match: true },
      { text: ' and ', match: false },
      { text: 'holmes', match: true },
      { text: ' (again)', match: false },
    ]);
    expect(splitMatches('a (b) c', '(b)').filter((s) => s.match)).toHaveLength(1);
  });
});
