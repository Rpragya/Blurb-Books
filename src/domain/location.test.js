import { describe, expect, it } from 'vitest';
import { FLOOR_PLAN } from '../api/mock/floorPlan';
import { describeLocation } from './location';

describe('describeLocation', () => {
  it('produces a breadcrumb and walking steps without the map', () => {
    const d = describeLocation(FLOOR_PLAN, { rackId: 'F3', shelf: 2 });
    expect(d.breadcrumb).toBe('Ground floor → Fiction → Rack F3 → Shelf 2');
    expect(d.steps.join(' ')).toMatch(/2nd shelf from the top/);
  });

  it('adds stairs for the first floor', () => {
    const d = describeLocation(FLOOR_PLAN, { rackId: 'L2', shelf: 5 });
    expect(d.steps[0]).toMatch(/stairs/);
    expect(d.steps.at(-1)).toMatch(/bottom shelf/);
  });

  it('returns undefined for unknown racks', () => {
    expect(describeLocation(FLOOR_PLAN, { rackId: 'ZZ', shelf: 1 })).toBeUndefined();
  });
});
