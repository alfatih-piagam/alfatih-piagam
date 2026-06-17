export interface ContributionDay {
  date: string;
  contributionCount: number;
  contributionLevel: 'NONE' | 'FIRST_QUARTILE' | 'SECOND_QUARTILE' | 'THIRD_QUARTILE' | 'FOURTH_QUARTILE';
}

export interface ContributionWeek {
  contributionDays: ContributionDay[];
}

export interface Cell {
  x: number;
  y: number;
  isWall: boolean;
  contributionLevel: ContributionDay['contributionLevel'];
  hasMonster: boolean;
  monsterType: 'slime' | 'skeleton' | 'demon' | 'dragon' | null;
}

export interface Position {
  x: number;
  y: number;
}

export interface Battle {
  position: Position;
  monsterType: string;
  frameStart: number;
}

export interface MonsterSpawn {
  position: Position;
  monsterType: string;
  spawnTime: number; // When the monster appears (in seconds)
}

export interface WallBreak {
  position: Position;
  breakTime: number; // When the wall is broken (in seconds)
}

export interface ColorTheme {
  name: string;
  background: string;
  floor: string;
  wallColors: string[];
  text: string;
}

export const LIGHT_THEME: ColorTheme = {
  name: 'light',
  background: '#ffffff',
  floor: '#ebedf0',
  wallColors: ['#9be9a8', '#40c463', '#30a14e', '#216e39'],
  text: '#24292f',
};

export const DARK_THEME: ColorTheme = {
  name: 'dark',
  background: '#0d1117',
  floor: '#161b22',
  wallColors: ['#0e4429', '#006d32', '#26a641', '#39d353'],
  text: '#c9d1d9',
};
