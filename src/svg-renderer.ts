import { Cell, Position, Battle, ColorTheme, MonsterSpawn, WallBreak } from './types.js';
import { CELL_SIZE, CELL_GAP, CELL_TOTAL, GHOST_COLORS, MOVE_TIME, BATTLE_TIME, WALL_BREAK_TIME } from './constants.js';
import { renderGhost, renderHero, renderSlashEffect } from './sprites.js';

function getWallColorIndex(level: string): number {
  switch (level) {
    case 'SECOND_QUARTILE':
      return 1;
    case 'THIRD_QUARTILE':
      return 2;
    case 'FOURTH_QUARTILE':
      return 3;
    default:
      return 0;
  }
}

function cellToPixel(pos: Position, offsetY: number = 0): { x: number; y: number } {
  return {
    x: pos.x * CELL_TOTAL + CELL_GAP + CELL_SIZE / 2,
    y: pos.y * CELL_TOTAL + CELL_GAP + CELL_SIZE / 2 + offsetY,
  };
}

export function generateSVG(
  grid: Cell[][],
  path: Position[],
  battles: Battle[],
  username: string,
  theme: ColorTheme,
  monsterSpawns: MonsterSpawn[] = [],
  wallBreaks: WallBreak[] = []
): string {
  const rows = grid.length;
  const cols = grid[0]?.length || 0;

  const width = cols * CELL_TOTAL + CELL_GAP;
  const height = rows * CELL_TOTAL + CELL_GAP + 35;
  const offsetY = 30;

  // Animation timing (from shared constants)
  const moveTime = MOVE_TIME;
  const battleTime = BATTLE_TIME;
  const wallBreakTime = WALL_BREAK_TIME;

  // Build segments with pauses for battles and wall breaks
  const segments: {
    start: Position;
    end: Position;
    duration: number;
    delay: number;
    hasBattleBefore: boolean;
    hasWallBreakBefore: boolean;
  }[] = [];
  const battleEvents: {
    position: Position;
    heroPosition: Position;
    delay: number;
    direction: { dx: number; dy: number };
  }[] = [];
  const wallBreakEvents: { position: Position; delay: number; direction: { dx: number; dy: number } }[] = [];

  let currentDelay = 0;

  // Use Sets to track which positions have been processed (prevents double slashes)
  const battlePositions = new Set(battles.map((b) => `${b.position.x},${b.position.y}`));
  const wallBreakPositions = new Set(wallBreaks.map((w) => `${w.position.x},${w.position.y}`));
  const processedBattles = new Set<string>();
  const processedWallBreaks = new Set<string>();

  for (let i = 0; i < path.length - 1; i++) {
    const start = path[i];
    const end = path[i + 1];
    const key = `${end.x},${end.y}`;

    // Calculate direction
    const dx = end.x - start.x;
    const dy = end.y - start.y;

    // Check if next cell needs wall break (only process once)
    const hasWallBreak = wallBreakPositions.has(key) && !processedWallBreaks.has(key);

    if (hasWallBreak) {
      wallBreakEvents.push({
        position: end,
        delay: currentDelay,
        direction: { dx, dy },
      });
      currentDelay += wallBreakTime;
      processedWallBreaks.add(key);
    }

    // Check if next cell has a monster - battle happens BEFORE moving (only process once)
    const hasBattle = battlePositions.has(key) && !processedBattles.has(key);

    if (hasBattle) {
      // Battle happens while hero is still on current cell
      battleEvents.push({
        position: end, // Ghost position (where slash appears)
        heroPosition: start, // Hero stays here during battle
        delay: currentDelay,
        direction: { dx, dy },
      });
      currentDelay += battleTime;
      processedBattles.add(key);
    }

    // Then move to the cell (ghost is now dead)
    segments.push({
      start,
      end,
      duration: moveTime,
      delay: currentDelay,
      hasBattleBefore: hasBattle,
      hasWallBreakBefore: hasWallBreak,
    });

    currentDelay += moveTime;
  }

  const totalDuration = currentDelay || 1; // Prevent division by zero

  // Build keyframes for hero position with direction tracking
  // We need to create keyframes that make the hero STOP (not slow down) during battles
  const keyframes: { time: number; x: number; y: number; scaleX: number }[] = [];
  let lastDirection = 1; // 1 = right, -1 = left

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const startPx = cellToPixel(seg.start, offsetY);
    const endPx = cellToPixel(seg.end, offsetY);

    // Determine direction based on movement (face the direction we're going)
    if (seg.end.x > seg.start.x) {
      lastDirection = 1; // Moving right
    } else if (seg.end.x < seg.start.x) {
      lastDirection = -1; // Moving left
    }

    // Calculate pause time before this move
    let pauseTime = 0;
    if (seg.hasWallBreakBefore) pauseTime += wallBreakTime;
    if (seg.hasBattleBefore) pauseTime += battleTime;

    // If there's any pause before this move, hero stays put
    if (pauseTime > 0) {
      // Add keyframe at START of pause (hero at start position)
      const pauseStartTime = seg.delay - pauseTime;
      keyframes.push({ time: pauseStartTime / totalDuration, x: startPx.x, y: startPx.y, scaleX: lastDirection });
      // Add keyframe at END of pause (hero still at start position)
      keyframes.push({ time: (seg.delay - 0.001) / totalDuration, x: startPx.x, y: startPx.y, scaleX: lastDirection });
    }

    // Add keyframe at start of this movement segment
    keyframes.push({ time: seg.delay / totalDuration, x: startPx.x, y: startPx.y, scaleX: lastDirection });

    // Add keyframe at end of movement (arrived at destination)
    const endTime = seg.delay + seg.duration;
    keyframes.push({ time: endTime / totalDuration, x: endPx.x, y: endPx.y, scaleX: lastDirection });
  }

  // Add final position
  if (path.length > 0) {
    const finalPx = cellToPixel(path[path.length - 1], offsetY);
    keyframes.push({ time: 1, x: finalPx.x, y: finalPx.y, scaleX: lastDirection });
  }

  // Sort keyframes by time and remove duplicates
  keyframes.sort((a, b) => a.time - b.time);
  const uniqueKeyframes = keyframes.filter((k, i) => i === 0 || k.time > keyframes[i - 1].time + 0.0001);

  // Generate keyTimes and values strings from unique keyframes
  const keyTimes = uniqueKeyframes.map((k) => k.time.toFixed(4)).join(';');
  const scaleXValues = uniqueKeyframes.map((k) => `${k.scaleX} 1`).join(';');

  // Ghost color assignment
  const ghostColors = Object.values(GHOST_COLORS);

  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <rect width="${width}" height="${height}" fill="${theme.background}"/>
  
  <!-- Title -->
  <text x="${width / 2}" y="20" text-anchor="middle" fill="${theme.text}" font-family="monospace" font-size="12" font-weight="bold">
    ${username}'s Contribution Crawl
  </text>
  
  <!-- Dungeon Grid -->
`;

  let monsterIdx = 0;

  // Render grid cells
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const cell = grid[y][x];
      const px = x * CELL_TOTAL + CELL_GAP;
      const py = y * CELL_TOTAL + CELL_GAP + offsetY;

      // Check if this wall gets broken
      const wallBreak = wallBreakEvents.find((w) => w.position.x === x && w.position.y === y);

      if (cell.isWall && !wallBreak) {
        // Wall (contribution) - not broken
        const colorIdx = getWallColorIndex(cell.contributionLevel);
        svg += `  <rect x="${px}" y="${py}" width="${CELL_SIZE}" height="${CELL_SIZE}" rx="2" fill="${theme.wallColors[colorIdx]}"/>\n`;
      } else if (wallBreak) {
        // Wall that will be broken - show wall, then break with slash
        const colorIdx = getWallColorIndex(cell.contributionLevel);

        // Wall breaks partway through the slash animation
        const slashMidpoint = wallBreak.delay + 0.2; // Break happens during slash
        const breakStart = (slashMidpoint / totalDuration).toFixed(4);
        const breakEnd = ((slashMidpoint + 0.15) / totalDuration).toFixed(4); // Quick break

        // Wall that fades out quickly when slashed
        svg += `  <rect x="${px}" y="${py}" width="${CELL_SIZE}" height="${CELL_SIZE}" rx="2" fill="${theme.wallColors[colorIdx]}">\n`;
        svg += `    <animate attributeName="opacity" values="1;1;0;0;1" keyTimes="0;${breakStart};${breakEnd};0.999;1" dur="${totalDuration.toFixed(2)}s" repeatCount="indefinite" calcMode="linear"/>\n`;
        svg += `  </rect>\n`;

        // Floor revealed underneath
        svg += `  <rect x="${px}" y="${py}" width="${CELL_SIZE}" height="${CELL_SIZE}" rx="2" fill="${theme.floor}">\n`;
        svg += `    <animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;${breakStart};${breakEnd};0.999;1" dur="${totalDuration.toFixed(2)}s" repeatCount="indefinite" calcMode="linear"/>\n`;
        svg += `  </rect>\n`;
      } else {
        // Floor
        svg += `  <rect x="${px}" y="${py}" width="${CELL_SIZE}" height="${CELL_SIZE}" rx="2" fill="${theme.floor}"/>\n`;

        // Ghost monster - ONLY render if it's in the monsterSpawns list (actually part of the game)
        const spawn = monsterSpawns.find((s) => s.position.x === x && s.position.y === y);

        if (spawn) {
          const { x: cx, y: cy } = cellToPixel({ x, y }, offsetY);
          const ghostColor = ghostColors[monsterIdx % ghostColors.length];
          const ghostId = `ghost-${x}-${y}`;

          // Check if this ghost gets defeated
          const battle = battleEvents.find((b) => b.position.x === x && b.position.y === y);

          if (battle) {
            // Ghost that will be defeated - appear at spawn time, disappear when killed
            const spawnTime = spawn.spawnTime;
            const killTime = battle.delay;

            // Convert to normalized time (0-1)
            // Ghost appears at spawnTime, disappears at killTime
            const tAppear = Math.max(0.001, spawnTime / totalDuration);
            const tDisappear = Math.min(0.999, killTime / totalDuration);

            // Ensure times are strictly ascending
            const actualTDisappear = Math.max(tAppear + 0.01, tDisappear);

            svg += `  <g opacity="0">\n`;
            svg += `    <animate attributeName="opacity" values="0;1;0" keyTimes="0;${tAppear.toFixed(4)};${actualTDisappear.toFixed(4)}" dur="${totalDuration.toFixed(2)}s" repeatCount="indefinite" calcMode="discrete"/>\n`;
            svg += `    ${renderGhost(cx, cy, CELL_SIZE, ghostColor, ghostId)}\n`;
            svg += `  </g>\n`;
          } else {
            // Ghost that won't be defeated - appears at spawn time and stays visible
            const spawnTime = spawn.spawnTime;
            const tAppear = Math.max(0.001, spawnTime / totalDuration);

            svg += `  <g opacity="0">\n`;
            svg += `    <animate attributeName="opacity" values="0;1;1" keyTimes="0;${tAppear.toFixed(4)};1" dur="${totalDuration.toFixed(2)}s" repeatCount="indefinite" calcMode="discrete"/>\n`;
            svg += `    ${renderGhost(cx, cy, CELL_SIZE, ghostColor, ghostId)}\n`;
            svg += `  </g>\n`;
          }

          monsterIdx++;
        }
      }
    }
  }

  // Render wall break effects (slash on wall)
  wallBreakEvents.forEach((wallBreak, idx) => {
    const { x: cx, y: cy } = cellToPixel(wallBreak.position, offsetY);

    svg += `
  <!-- Wall Break ${idx + 1} -->
  <g transform="translate(${cx}, ${cy})">
    ${renderSlashEffect(CELL_SIZE, wallBreak.delay, totalDuration, wallBreak.direction)}
  </g>`;
  });

  // Render battle slash effects
  battleEvents.forEach((battle, idx) => {
    const { x: cx, y: cy } = cellToPixel(battle.position, offsetY);

    svg += `
  <!-- Battle ${idx + 1} -->
  <g transform="translate(${cx}, ${cy})">
    ${renderSlashEffect(CELL_SIZE, battle.delay, totalDuration, battle.direction)}
  </g>`;
  });

  // Render animated hero with direction flipping
  if (path.length > 0 && uniqueKeyframes.length > 1) {
    const positionValues = uniqueKeyframes.map((k) => `${k.x.toFixed(1)} ${k.y.toFixed(1)}`).join(';');

    svg += `
  <!-- Animated Hero -->
  <g id="hero-container">
    <animateTransform 
      attributeName="transform" 
      type="translate"
      values="${positionValues}"
      keyTimes="${keyTimes}"
      dur="${totalDuration.toFixed(2)}s"
      repeatCount="indefinite"
      calcMode="linear"
    />
    <g id="hero-sprite">
      <animateTransform 
        attributeName="transform" 
        type="scale"
        values="${scaleXValues}"
        keyTimes="${keyTimes}"
        dur="${totalDuration.toFixed(2)}s"
        repeatCount="indefinite"
        calcMode="discrete"
      />
      ${renderHero(CELL_SIZE)}
    </g>
  </g>`;
  }

  svg += `
</svg>`;

  return svg;
}
