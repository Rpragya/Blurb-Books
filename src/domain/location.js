const ordinal = (n) => {
  const suffix = n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th';
  return `${n}${suffix}`;
};

/**
 * Describe a shelf location in words. This is the primary way-finding output:
 * the SVG map is a visual companion to it, never the only source.
 */
export function describeLocation(plan, location) {
  const rack = plan.racks.find((r) => r.id === location.rackId);
  if (!rack) return undefined;
  const section = plan.sections.find((s) => s.id === rack.sectionId);
  if (!section) return undefined;
  const floor = plan.floors.find((f) => f.id === section.floorId);
  if (!floor) return undefined;
  const shelf = Math.min(Math.max(location.shelf, 1), rack.shelves);

  const steps = [];
  if (floor.id !== plan.kiosk.floorId) {
    steps.push('Take the stairs or lift beside the help desk up to the first floor.');
  }
  steps.push(section.directionsFromKiosk);
  steps.push(`Find the rack labelled ${rack.label}.`);
  steps.push(
    `Look on the ${ordinal(shelf)} shelf from the top${shelf === rack.shelves ? ' (the bottom shelf)' : ''}. Books are in order of author surname.`,
  );

  return {
    floor,
    section,
    rack,
    shelf,
    breadcrumb: `${floor.name} → ${section.name} → Rack ${rack.label} → Shelf ${shelf}`,
    steps,
  };
}
