/**
 * A simple schematic of a two-floor branch library. Coordinates are in a
 * 1000 × 700 viewBox per floor. This is a location guide, not live tracking.
 */
export const FLOOR_PLAN = {
  floors: [
    { id: 'ground', name: 'Ground floor', order: 0 },
    { id: 'first', name: 'First floor', order: 1 },
  ],
  sections: [
    {
      id: 'fiction',
      name: 'Fiction',
      floorId: 'ground',
      directionsFromKiosk: 'Walk forward past the help desk. Fiction fills the left-hand side of the ground floor.',
      area: { x: 30, y: 30, width: 400, height: 330 },
    },
    {
      id: 'crime',
      name: 'Crime & Gothic',
      floorId: 'ground',
      directionsFromKiosk: 'Walk straight up the central aisle. Crime & Gothic is the far right-hand corner.',
      area: { x: 570, y: 30, width: 400, height: 240 },
    },
    {
      id: 'speculative',
      name: 'Fantasy & Sci-Fi',
      floorId: 'ground',
      directionsFromKiosk: 'Turn right from the kiosk. Fantasy & Sci-Fi is the bay just in front of you.',
      area: { x: 570, y: 300, width: 400, height: 200 },
    },
    {
      id: 'children',
      name: 'Children’s Corner',
      floorId: 'ground',
      directionsFromKiosk: 'Turn left from the kiosk. The Children’s Corner has the low shelves by the window.',
      area: { x: 30, y: 400, width: 330, height: 170 },
    },
    {
      id: 'non-fiction',
      name: 'Non-fiction & Ideas',
      floorId: 'first',
      directionsFromKiosk: 'At the top of the stairs, turn left. Non-fiction runs along the back wall.',
      area: { x: 30, y: 30, width: 560, height: 300 },
    },
    {
      id: 'languages',
      name: 'World Languages',
      floorId: 'first',
      directionsFromKiosk: 'At the top of the stairs, walk straight ahead. World Languages is the right-hand bay.',
      area: { x: 620, y: 30, width: 350, height: 300 },
    },
    {
      id: 'poetry',
      name: 'Poetry & Reference',
      floorId: 'first',
      directionsFromKiosk: 'At the top of the stairs, turn left and keep to the windows. Poetry & Reference is beside the quiet reading room.',
      area: { x: 30, y: 380, width: 450, height: 200 },
    },
  ],
  racks: [
    { id: 'F1', label: 'F1', sectionId: 'fiction', shelves: 5, rect: { x: 60, y: 70, width: 44, height: 260 } },
    { id: 'F2', label: 'F2', sectionId: 'fiction', shelves: 5, rect: { x: 150, y: 70, width: 44, height: 260 } },
    { id: 'F3', label: 'F3', sectionId: 'fiction', shelves: 5, rect: { x: 240, y: 70, width: 44, height: 260 } },
    { id: 'F4', label: 'F4', sectionId: 'fiction', shelves: 5, rect: { x: 330, y: 70, width: 44, height: 260 } },
    { id: 'M1', label: 'M1', sectionId: 'crime', shelves: 4, rect: { x: 600, y: 70, width: 340, height: 38 } },
    { id: 'M2', label: 'M2', sectionId: 'crime', shelves: 4, rect: { x: 600, y: 140, width: 340, height: 38 } },
    { id: 'M3', label: 'M3', sectionId: 'crime', shelves: 4, rect: { x: 600, y: 210, width: 340, height: 38 } },
    { id: 'S1', label: 'S1', sectionId: 'speculative', shelves: 4, rect: { x: 600, y: 340, width: 340, height: 38 } },
    { id: 'S2', label: 'S2', sectionId: 'speculative', shelves: 4, rect: { x: 600, y: 420, width: 340, height: 38 } },
    { id: 'C1', label: 'C1', sectionId: 'children', shelves: 3, rect: { x: 60, y: 440, width: 270, height: 38 } },
    { id: 'C2', label: 'C2', sectionId: 'children', shelves: 3, rect: { x: 60, y: 505, width: 270, height: 38 } },
    { id: 'N1', label: 'N1', sectionId: 'non-fiction', shelves: 5, rect: { x: 60, y: 80, width: 500, height: 40 } },
    { id: 'N2', label: 'N2', sectionId: 'non-fiction', shelves: 5, rect: { x: 60, y: 165, width: 500, height: 40 } },
    { id: 'N3', label: 'N3', sectionId: 'non-fiction', shelves: 5, rect: { x: 60, y: 250, width: 500, height: 40 } },
    { id: 'L1', label: 'L1', sectionId: 'languages', shelves: 5, rect: { x: 680, y: 70, width: 50, height: 230 } },
    { id: 'L2', label: 'L2', sectionId: 'languages', shelves: 5, rect: { x: 820, y: 70, width: 50, height: 230 } },
    { id: 'P1', label: 'P1', sectionId: 'poetry', shelves: 4, rect: { x: 60, y: 420, width: 390, height: 40 } },
    { id: 'R1', label: 'R1', sectionId: 'poetry', shelves: 4, rect: { x: 60, y: 505, width: 390, height: 40 } },
  ],
  kiosk: { floorId: 'ground', x: 640, y: 610 },
  desk: { floorId: 'ground', rect: { x: 400, y: 560, width: 160, height: 50 } },
};
