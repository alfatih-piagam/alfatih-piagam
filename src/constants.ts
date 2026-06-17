/**
 * Shared constants used across the application
 */

// Grid dimensions
export const CELL_SIZE = 22;
export const CELL_GAP = 4;
export const CELL_TOTAL = CELL_SIZE + CELL_GAP;

// Animation timing (in seconds)
export const MOVE_TIME = 0.25;
export const BATTLE_TIME = 0.6;
export const WALL_BREAK_TIME = 0.4;
export const SLASH_DURATION = 0.35;

// Game settings
export const TOTAL_MONSTERS = 25;
export const WEEKS_IN_YEAR = 53;
export const DAYS_IN_WEEK = 7;

// Ghost colors (Pac-Man style)
export const GHOST_COLORS = {
  red: '#ff0000', // Blinky
  pink: '#ffb8ff', // Pinky
  cyan: '#00ffff', // Inky
  orange: '#ffb852', // Clyde
} as const;
