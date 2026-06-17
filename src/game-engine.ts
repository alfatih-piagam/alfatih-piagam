import { ContributionWeek, Cell, Position, Battle, MonsterSpawn, WallBreak } from './types.js';
import { MOVE_TIME, BATTLE_TIME, WALL_BREAK_TIME, TOTAL_MONSTERS } from './constants.js';

// Monster spawn probability thresholds (cumulative)
const MONSTER_THRESHOLDS = {
  slime: 0.45, // 45% chance
  skeleton: 0.75, // 30% chance (0.75 - 0.45)
  demon: 0.92, // 17% chance (0.92 - 0.75)
  // dragon: remaining 8% (1.0 - 0.92)
} as const;

export function createDungeonGrid(weeks: ContributionWeek[]): Cell[][] {
  const grid: Cell[][] = [];

  // Grid is 7 rows (days) x 53 columns (weeks)
  for (let day = 0; day < 7; day++) {
    grid[day] = [];
    for (let week = 0; week < weeks.length; week++) {
      const contribution = weeks[week]?.contributionDays[day];
      const hasContribution = contribution && contribution.contributionLevel !== 'NONE';

      grid[day][week] = {
        x: week,
        y: day,
        isWall: hasContribution,
        contributionLevel: contribution?.contributionLevel || 'NONE',
        hasMonster: false,
        monsterType: null,
      };
    }
  }

  return grid;
}

function getRandomMonsterType(): NonNullable<Cell['monsterType']> {
  const rand = Math.random();
  if (rand < MONSTER_THRESHOLDS.slime) return 'slime';
  if (rand < MONSTER_THRESHOLDS.skeleton) return 'skeleton';
  if (rand < MONSTER_THRESHOLDS.demon) return 'demon';
  return 'dragon';
}

function getNeighbors(grid: Cell[][], pos: Position, allowWalls: boolean = false): Position[] {
  const dirs = [
    { x: 1, y: 0 }, // Prioritize right movement
    { x: 0, y: -1 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
  ];

  const neighbors: Position[] = [];
  for (const dir of dirs) {
    const nx = pos.x + dir.x;
    const ny = pos.y + dir.y;
    if (ny >= 0 && ny < grid.length && nx >= 0 && nx < grid[0].length) {
      if (allowWalls || !grid[ny][nx].isWall) {
        neighbors.push({ x: nx, y: ny });
      }
    }
  }
  return neighbors;
}

/** Reconstruct path from parent pointers */
function reconstructPath(parent: Map<string, Position | null>, end: Position): Position[] {
  const path: Position[] = [];
  let current: Position | null = end;

  while (current !== null) {
    path.unshift(current);
    const key: string = `${current.x},${current.y}`;
    current = parent.get(key) ?? null;
  }

  return path;
}

function findPath(grid: Cell[][], start: Position, end: Position): Position[] | null {
  const queue: Position[] = [start];
  const parent = new Map<string, Position | null>();
  parent.set(`${start.x},${start.y}`, null);

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (current.x === end.x && current.y === end.y) {
      return reconstructPath(parent, end);
    }

    for (const neighbor of getNeighbors(grid, current)) {
      const key = `${neighbor.x},${neighbor.y}`;
      if (!parent.has(key)) {
        parent.set(key, current);
        queue.push(neighbor);
      }
    }
  }

  return null;
}

/** Reconstruct path and collect walls from parent pointers */
function reconstructPathWithWalls(
  parent: Map<string, Position | null>,
  grid: Cell[][],
  end: Position
): { path: Position[]; wallsToBreak: Position[] } {
  const path: Position[] = [];
  const wallsToBreak: Position[] = [];
  let current: Position | null = end;

  while (current !== null) {
    path.unshift(current);
    if (grid[current.y][current.x].isWall) {
      wallsToBreak.unshift(current);
    }
    const key: string = `${current.x},${current.y}`;
    current = parent.get(key) ?? null;
  }

  return { path, wallsToBreak };
}

// Find path that can break through walls (Dijkstra's algorithm with parent pointers)
function findPathWithWallBreaking(
  grid: Cell[][],
  start: Position,
  end: Position
): { path: Position[]; wallsToBreak: Position[] } | null {
  const costs = new Map<string, number>();
  const parent = new Map<string, Position | null>();
  const queue: { pos: Position; cost: number }[] = [{ pos: start, cost: 0 }];

  costs.set(`${start.x},${start.y}`, 0);
  parent.set(`${start.x},${start.y}`, null);

  while (queue.length > 0) {
    queue.sort((a, b) => a.cost - b.cost);
    const current = queue.shift()!;
    const currentKey = `${current.pos.x},${current.pos.y}`;

    // Skip if we've found a better path to this node
    if (current.cost > (costs.get(currentKey) ?? Infinity)) continue;

    // Found the destination
    if (current.pos.x === end.x && current.pos.y === end.y) {
      return reconstructPathWithWalls(parent, grid, end);
    }

    for (const neighbor of getNeighbors(grid, current.pos, true)) {
      const isWall = grid[neighbor.y][neighbor.x].isWall;
      const moveCost = isWall ? 10 : 1;
      const newCost = current.cost + moveCost;
      const key = `${neighbor.x},${neighbor.y}`;

      if (!costs.has(key) || costs.get(key)! > newCost) {
        costs.set(key, newCost);
        parent.set(key, current.pos);
        queue.push({ pos: neighbor, cost: newCost });
      }
    }
  }

  return null;
}

// Get empty cells (non-wall, non-contribution) in a specific column range
function getEmptyCellsInRange(grid: Cell[][], minX: number, maxX: number, excludePositions: Set<string>): Position[] {
  const cells: Position[] = [];
  for (let x = minX; x <= maxX && x < grid[0].length; x++) {
    for (let y = 0; y < grid.length; y++) {
      const key = `${x},${y}`;
      const cell = grid[y][x];
      // Only spawn on empty floor cells (not walls/contributions)
      if (!cell.isWall && cell.contributionLevel === 'NONE' && !excludePositions.has(key)) {
        cells.push({ x, y });
      }
    }
  }
  return cells;
}

export interface GamePath {
  path: Position[];
  battles: Battle[];
  monsterSpawns: MonsterSpawn[];
  wallBreaks: WallBreak[];
}

export function generateHeroPath(grid: Cell[][]): GamePath {
  const gridWidth = grid[0].length;

  // Collect all empty cells (non-wall, non-contribution)
  const emptyCells: Position[] = [];
  for (let x = 0; x < gridWidth; x++) {
    for (let y = 0; y < grid.length; y++) {
      if (!grid[y][x].isWall && grid[y][x].contributionLevel === 'NONE') {
        emptyCells.push({ x, y });
      }
    }
  }

  // Pick a random starting position
  let start: Position | null = null;
  if (emptyCells.length > 0) {
    start = emptyCells[Math.floor(Math.random() * emptyCells.length)];
  }

  // Fallback: find any non-wall cell
  if (!start) {
    for (let x = 0; x < gridWidth && !start; x++) {
      for (let y = 0; y < grid.length && !start; y++) {
        if (!grid[y][x].isWall) {
          start = { x, y };
        }
      }
    }
  }

  if (!start) {
    return { path: [], battles: [], monsterSpawns: [], wallBreaks: [] };
  }

  // PRE-PLACE all monsters spread across the entire year
  const monsterPositions: { pos: Position; type: NonNullable<Cell['monsterType']> }[] = [];
  const occupiedPositions = new Set<string>();
  occupiedPositions.add(`${start.x},${start.y}`);

  // Place monsters evenly across the grid width
  for (let i = 0; i < TOTAL_MONSTERS; i++) {
    const zoneStart = Math.floor((i / TOTAL_MONSTERS) * gridWidth);
    const zoneEnd = Math.floor(((i + 1) / TOTAL_MONSTERS) * gridWidth);

    // Find empty cells in this zone (must be non-contribution floor cells)
    const candidates = getEmptyCellsInRange(grid, zoneStart, zoneEnd, occupiedPositions);

    if (candidates.length > 0) {
      // Pick a random cell from this zone
      const pos = candidates[Math.floor(Math.random() * candidates.length)];
      const type = getRandomMonsterType();
      monsterPositions.push({ pos, type });
      occupiedPositions.add(`${pos.x},${pos.y}`);
      grid[pos.y][pos.x].hasMonster = true;
      grid[pos.y][pos.x].monsterType = type;
    }
  }

  // Sort monsters by X position (left to right) so hero traverses the full year
  monsterPositions.sort((a, b) => a.pos.x - b.pos.x);

  // Create a map of monster positions for quick lookup
  const monsterMap = new Map<string, { pos: Position; type: NonNullable<Cell['monsterType']> }>();
  for (const m of monsterPositions) {
    monsterMap.set(`${m.pos.x},${m.pos.y}`, m);
  }

  const fullPath: Position[] = [start];
  const battles: Battle[] = [];
  const monsterSpawns: MonsterSpawn[] = [];
  const wallBreaks: WallBreak[] = [];
  const brokenWalls = new Set<string>();
  const killedMonsters = new Set<string>();
  let currentPos = start;
  let currentTime = 0;

  const moveTime = MOVE_TIME;
  const battleTime = BATTLE_TIME;
  const wallBreakTime = WALL_BREAK_TIME;

  // All monsters spawn at the beginning (they're already placed)
  for (const monster of monsterPositions) {
    monsterSpawns.push({
      position: monster.pos,
      monsterType: monster.type,
      spawnTime: 0, // All visible from start
    });
  }

  // Hero hunts monsters in order (left to right across the year)
  for (const targetMonster of monsterPositions) {
    const targetKey = `${targetMonster.pos.x},${targetMonster.pos.y}`;
    if (killedMonsters.has(targetKey)) continue;

    // Find path to this monster
    let pathToMonster = findPath(grid, currentPos, targetMonster.pos);

    // If no direct path, try wall-breaking
    if (!pathToMonster) {
      const result = findPathWithWallBreaking(grid, currentPos, targetMonster.pos);
      if (result) {
        pathToMonster = result.path;
      }
    }

    if (!pathToMonster || pathToMonster.length <= 1) {
      // Can't reach this monster, mark as killed (skip it)
      killedMonsters.add(targetKey);
      continue;
    }

    // Walk the path step by step
    for (let i = 1; i < pathToMonster.length; i++) {
      const pos = pathToMonster[i];
      const posKey = `${pos.x},${pos.y}`;

      // Check if we need to break this wall FIRST (before moving)
      if (grid[pos.y][pos.x].isWall && !brokenWalls.has(posKey)) {
        brokenWalls.add(posKey);
        wallBreaks.push({
          position: pos,
          breakTime: currentTime,
        });
        grid[pos.y][pos.x].isWall = false;
        currentTime += wallBreakTime;
      }

      // Check if there's a monster at this position (ONLY if not already killed)
      const monsterAtPos = monsterMap.get(posKey);
      if (monsterAtPos && !killedMonsters.has(posKey)) {
        // Record battle BEFORE adding this position to path
        // The slash happens while hero is at previous position
        killedMonsters.add(posKey);
        battles.push({
          position: pos,
          monsterType: monsterAtPos.type,
          frameStart: Math.floor(currentTime * 10),
        });
        currentTime += battleTime;
      }

      // Now add the position to the path (hero moves here)
      fullPath.push(pos);
      currentTime += moveTime;
    }

    currentPos = targetMonster.pos;
  }

  return { path: fullPath, battles, monsterSpawns, wallBreaks };
}
