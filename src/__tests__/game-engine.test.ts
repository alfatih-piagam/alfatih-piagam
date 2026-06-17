import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createDungeonGrid, generateHeroPath } from '../game-engine.js';
import { generateMockContributions } from '../github-api.js';
import { ContributionWeek } from '../types.js';

describe('createDungeonGrid', () => {
  it('should create a 7-row grid from contribution weeks', () => {
    const weeks: ContributionWeek[] = [
      {
        contributionDays: [
          { date: '2024-01-01', contributionCount: 0, contributionLevel: 'NONE' },
          { date: '2024-01-02', contributionCount: 1, contributionLevel: 'FIRST_QUARTILE' },
          { date: '2024-01-03', contributionCount: 0, contributionLevel: 'NONE' },
          { date: '2024-01-04', contributionCount: 5, contributionLevel: 'SECOND_QUARTILE' },
          { date: '2024-01-05', contributionCount: 0, contributionLevel: 'NONE' },
          { date: '2024-01-06', contributionCount: 10, contributionLevel: 'THIRD_QUARTILE' },
          { date: '2024-01-07', contributionCount: 0, contributionLevel: 'NONE' },
        ],
      },
    ];

    const grid = createDungeonGrid(weeks);

    assert.strictEqual(grid.length, 7, 'Grid should have 7 rows (days)');
    assert.strictEqual(grid[0].length, 1, 'Grid should have 1 column (week)');
  });

  it('should mark cells with contributions as walls', () => {
    const weeks: ContributionWeek[] = [
      {
        contributionDays: [
          { date: '2024-01-01', contributionCount: 0, contributionLevel: 'NONE' },
          { date: '2024-01-02', contributionCount: 5, contributionLevel: 'FIRST_QUARTILE' },
          { date: '2024-01-03', contributionCount: 0, contributionLevel: 'NONE' },
          { date: '2024-01-04', contributionCount: 0, contributionLevel: 'NONE' },
          { date: '2024-01-05', contributionCount: 0, contributionLevel: 'NONE' },
          { date: '2024-01-06', contributionCount: 0, contributionLevel: 'NONE' },
          { date: '2024-01-07', contributionCount: 0, contributionLevel: 'NONE' },
        ],
      },
    ];

    const grid = createDungeonGrid(weeks);

    assert.strictEqual(grid[0][0].isWall, false, 'NONE should not be a wall');
    assert.strictEqual(grid[1][0].isWall, true, 'FIRST_QUARTILE should be a wall');
  });

  it('should preserve contribution levels', () => {
    const weeks: ContributionWeek[] = [
      {
        contributionDays: [
          { date: '2024-01-01', contributionCount: 0, contributionLevel: 'NONE' },
          { date: '2024-01-02', contributionCount: 1, contributionLevel: 'FIRST_QUARTILE' },
          { date: '2024-01-03', contributionCount: 5, contributionLevel: 'SECOND_QUARTILE' },
          { date: '2024-01-04', contributionCount: 10, contributionLevel: 'THIRD_QUARTILE' },
          { date: '2024-01-05', contributionCount: 20, contributionLevel: 'FOURTH_QUARTILE' },
          { date: '2024-01-06', contributionCount: 0, contributionLevel: 'NONE' },
          { date: '2024-01-07', contributionCount: 0, contributionLevel: 'NONE' },
        ],
      },
    ];

    const grid = createDungeonGrid(weeks);

    assert.strictEqual(grid[0][0].contributionLevel, 'NONE');
    assert.strictEqual(grid[1][0].contributionLevel, 'FIRST_QUARTILE');
    assert.strictEqual(grid[2][0].contributionLevel, 'SECOND_QUARTILE');
    assert.strictEqual(grid[3][0].contributionLevel, 'THIRD_QUARTILE');
    assert.strictEqual(grid[4][0].contributionLevel, 'FOURTH_QUARTILE');
  });
});

describe('generateHeroPath', () => {
  it('should generate a path when there are empty cells', () => {
    const weeks: ContributionWeek[] = [];
    // Create 10 weeks of empty data
    for (let w = 0; w < 10; w++) {
      weeks.push({
        contributionDays: Array(7)
          .fill(null)
          .map((_, d) => ({
            date: `2024-01-${w * 7 + d + 1}`,
            contributionCount: 0,
            contributionLevel: 'NONE' as const,
          })),
      });
    }

    const grid = createDungeonGrid(weeks);
    const result = generateHeroPath(grid);

    assert.ok(result.path.length > 0, 'Should generate a path');
    assert.ok(result.monsterSpawns.length > 0, 'Should spawn monsters');
  });

  it('should return empty results for fully walled grid', () => {
    const weeks: ContributionWeek[] = [];
    // Create 5 weeks of fully contributed data
    for (let w = 0; w < 5; w++) {
      weeks.push({
        contributionDays: Array(7)
          .fill(null)
          .map((_, d) => ({
            date: `2024-01-${w * 7 + d + 1}`,
            contributionCount: 10,
            contributionLevel: 'FOURTH_QUARTILE' as const,
          })),
      });
    }

    const grid = createDungeonGrid(weeks);
    const result = generateHeroPath(grid);

    // With all walls and no empty cells, path should be empty
    assert.strictEqual(result.path.length, 0, 'Path should be empty for fully walled grid');
  });
});

describe('generateMockContributions', () => {
  it('should generate 53 weeks of data', () => {
    const weeks = generateMockContributions();

    assert.strictEqual(weeks.length, 53, 'Should generate 53 weeks');
  });

  it('should have 7 days per week', () => {
    const weeks = generateMockContributions();

    for (const week of weeks) {
      assert.strictEqual(week.contributionDays.length, 7, 'Each week should have 7 days');
    }
  });

  it('should generate valid contribution levels', () => {
    const validLevels = ['NONE', 'FIRST_QUARTILE', 'SECOND_QUARTILE', 'THIRD_QUARTILE', 'FOURTH_QUARTILE'];
    const weeks = generateMockContributions();

    for (const week of weeks) {
      for (const day of week.contributionDays) {
        assert.ok(validLevels.includes(day.contributionLevel), `Invalid level: ${day.contributionLevel}`);
      }
    }
  });

  it('should generate valid ISO date strings', () => {
    const weeks = generateMockContributions();
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    for (const week of weeks) {
      for (const day of week.contributionDays) {
        assert.ok(dateRegex.test(day.date), `Invalid date format: ${day.date}`);
      }
    }
  });
});
