import { memo, type KeyboardEvent } from 'react';
import type { Floor, FloorPlan, Rack } from '../../domain/types';

interface ShelfMapProps {
  plan: FloorPlan;
  floorId: Floor['id'];
  targetRackId?: string;
  selectedRackId?: string;
  onSelectRack?: (rackId: string) => void;
  /** Accessible name for the SVG; detailed directions live in the text panel. */
  label: string;
}

const STAIRS = { x: 860, y: 560, width: 110, height: 110 };
const AISLE_X: Record<Floor['id'], number> = { ground: 500, first: 605 };

/** Simple guide line from the kiosk (or stairs) along the main aisle to a rack. */
function routeTo(plan: FloorPlan, floorId: Floor['id'], rack: Rack): string {
  const aisle = AISLE_X[floorId];
  const start = floorId === plan.kiosk.floorId ? { x: plan.kiosk.x, y: plan.kiosk.y - 22 } : { x: STAIRS.x, y: STAIRS.y + 40 };
  const r = rack.rect;
  const points: [number, number][] = [[start.x, start.y], [start.x, 530], [aisle, 530]];
  if (r.height > r.width) {
    const below = r.y + r.height + 18;
    points.push([aisle, below], [r.x + r.width / 2, below], [r.x + r.width / 2, r.y + r.height + 4]);
  } else {
    const cy = r.y + r.height / 2;
    const edge = r.x > aisle ? r.x - 4 : r.x + r.width + 4;
    points.push([aisle, cy], [edge, cy]);
  }
  return points.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');
}

export const ShelfMap = memo(function ShelfMap({ plan, floorId, targetRackId, selectedRackId, onSelectRack, label }: ShelfMapProps) {
  const sections = plan.sections.filter((s) => s.floorId === floorId);
  const sectionIds = new Set(sections.map((s) => s.id));
  const racks = plan.racks.filter((r) => sectionIds.has(r.sectionId));
  const target = racks.find((r) => r.id === targetRackId);
  const onKiosk = plan.kiosk.floorId === floorId;
  const targetElsewhere = targetRackId && !target;

  const onKey = (event: KeyboardEvent, rackId: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelectRack?.(rackId);
    }
  };

  return (
    <svg className="shelf-map" viewBox="0 0 1000 700" role="group" aria-label={label}>
      <rect x="10" y="10" width="980" height="680" rx="14" className="shelf-map__building" />
      {onKiosk && (
        <g className="shelf-map__entrance" aria-hidden="true">
          <rect x="450" y="684" width="100" height="12" />
          <text x="500" y="676" textAnchor="middle">
            Entrance
          </text>
        </g>
      )}

      {sections.map((s) => (
        <g key={s.id} aria-hidden="true">
          <rect {...s.area} rx="10" className="shelf-map__section" />
          <text x={s.area.x + 14} y={s.area.y + 24} className="shelf-map__section-label">
            {s.name}
          </text>
        </g>
      ))}

      {plan.desk.floorId === floorId && (
        <g aria-hidden="true">
          <rect {...plan.desk.rect} rx="8" className="shelf-map__desk" />
          <text x={plan.desk.rect.x + plan.desk.rect.width / 2} y={plan.desk.rect.y + 31} textAnchor="middle" className="shelf-map__desk-label">
            Help desk
          </text>
        </g>
      )}

      <g aria-hidden="true">
        <rect {...STAIRS} rx="8" className={`shelf-map__stairs${targetElsewhere ? ' is-target' : ''}`} />
        <text x={STAIRS.x + STAIRS.width / 2} y={STAIRS.y + 50} textAnchor="middle" className="shelf-map__desk-label">
          Stairs
        </text>
        <text x={STAIRS.x + STAIRS.width / 2} y={STAIRS.y + 70} textAnchor="middle" className="shelf-map__desk-label">
          & lift
        </text>
      </g>

      {target && <path d={routeTo(plan, floorId, target)} className="shelf-map__route" aria-hidden="true" />}

      {racks.map((rack) => {
        const section = sections.find((s) => s.id === rack.sectionId)!;
        const isTarget = rack.id === targetRackId;
        const isSelected = rack.id === selectedRackId;
        const vertical = rack.rect.height > rack.rect.width;
        return (
          <g
            key={rack.id}
            className={`shelf-map__rack${isTarget ? ' is-target' : ''}${isSelected ? ' is-selected' : ''}`}
            role={onSelectRack ? 'button' : 'img'}
            tabIndex={onSelectRack ? 0 : undefined}
            aria-pressed={onSelectRack ? isSelected : undefined}
            aria-label={`Rack ${rack.label}, ${section.name}${isTarget ? ' — your book is here' : ''}`}
            onClick={() => onSelectRack?.(rack.id)}
            onKeyDown={(e) => onKey(e, rack.id)}
          >
            {isTarget && <rect {...rack.rect} rx="6" className="shelf-map__pulse" transform-origin={`${rack.rect.x + rack.rect.width / 2} ${rack.rect.y + rack.rect.height / 2}`} />}
            <rect {...rack.rect} rx="6" />
            <text
              x={rack.rect.x + rack.rect.width / 2}
              y={vertical ? rack.rect.y + rack.rect.height / 2 : rack.rect.y + rack.rect.height / 2 + 6}
              textAnchor="middle"
              dominantBaseline={vertical ? 'middle' : undefined}
              className="shelf-map__rack-label"
            >
              {rack.label}
            </text>
          </g>
        );
      })}

      {onKiosk && (
        <g className="shelf-map__you" aria-hidden="true">
          <circle cx={plan.kiosk.x} cy={plan.kiosk.y} r="16" />
          <circle cx={plan.kiosk.x} cy={plan.kiosk.y} r="6" className="shelf-map__you-dot" />
          <text x={plan.kiosk.x + 26} y={plan.kiosk.y + 6} className="shelf-map__you-label">
            You are here
          </text>
        </g>
      )}
      {!onKiosk && (
        <text x={STAIRS.x - 12} y={STAIRS.y + 40} textAnchor="end" className="shelf-map__you-label" aria-hidden="true">
          Arrive here
        </text>
      )}
    </svg>
  );
});

/** Front view of one rack, highlighting the shelf to look on. */
export function ShelfElevation({ shelves, target, rackLabel }: { shelves: number; target: number; rackLabel: string }) {
  const h = 34;
  return (
    <svg className="shelf-elevation" viewBox={`0 0 160 ${shelves * h + 16}`} role="img" aria-label={`Rack ${rackLabel}: shelf ${target} of ${shelves}, counting from the top`}>
      {Array.from({ length: shelves }, (_, i) => {
        const n = i + 1;
        const y = 8 + i * h;
        return (
          <g key={n} className={n === target ? 'is-target' : undefined}>
            <rect x="8" y={y} width="144" height={h - 4} rx="3" />
            {/* Book spines */}
            {Array.from({ length: 9 }, (_, j) => (
              <rect key={j} x={16 + j * 14} y={y + 6 + (j % 3) * 2} width="9" height={h - 16 - (j % 3) * 2} rx="1" className="shelf-elevation__spine" />
            ))}
            <text x="156" y={y + h / 2 + 2} textAnchor="end" className="shelf-elevation__n" aria-hidden="true">
              {n}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
