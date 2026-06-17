import { graphql } from '@octokit/graphql';
import { ContributionWeek, ContributionDay } from './types.js';
import { WEEKS_IN_YEAR, DAYS_IN_WEEK } from './constants.js';

/** Response type for GitHub GraphQL contributions query */
interface ContributionsResponse {
  user: {
    contributionsCollection: {
      contributionCalendar: {
        weeks: ContributionWeek[];
      };
    };
  } | null;
}

export async function fetchContributions(username: string, token?: string): Promise<ContributionWeek[]> {
  const graphqlWithAuth = graphql.defaults({
    headers: {
      authorization: token ? `Bearer ${token}` : '',
    },
  });

  const query = `
    query($username: String!) {
      user(login: $username) {
        contributionsCollection {
          contributionCalendar {
            weeks {
              contributionDays {
                date
                contributionCount
                contributionLevel
              }
            }
          }
        }
      }
    }
  `;

  const response = await graphqlWithAuth<ContributionsResponse>(query, { username });

  if (!response.user) {
    throw new Error(`User "${username}" not found on GitHub`);
  }

  return response.user.contributionsCollection.contributionCalendar.weeks;
}

export function generateMockContributions(): ContributionWeek[] {
  const weeks: ContributionWeek[] = [];
  const levels: ContributionDay['contributionLevel'][] = [
    'NONE',
    'FIRST_QUARTILE',
    'SECOND_QUARTILE',
    'THIRD_QUARTILE',
    'FOURTH_QUARTILE',
  ];

  // Start from a year ago
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - 1);
  // Align to Sunday (start of week)
  startDate.setDate(startDate.getDate() - startDate.getDay());

  for (let week = 0; week < WEEKS_IN_YEAR; week++) {
    const days: ContributionDay[] = [];
    for (let day = 0; day < DAYS_IN_WEEK; day++) {
      const rand = Math.random();
      let level: ContributionDay['contributionLevel'] = 'NONE';
      let count = 0;

      // 65% chance of contribution
      const threshold = 0.35;

      if (rand > threshold) {
        const levelIdx = Math.floor(Math.random() * 4) + 1;
        level = levels[levelIdx];
        count = levelIdx * 3;
      }

      // Generate valid ISO date
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + week * 7 + day);
      const dateStr = currentDate.toISOString().split('T')[0];

      days.push({
        date: dateStr,
        contributionCount: count,
        contributionLevel: level,
      });
    }
    weeks.push({ contributionDays: days });
  }

  return weeks;
}

// Generate a very dense contribution graph that forces wall-breaking
export function generateDenseContributions(): ContributionWeek[] {
  const weeks: ContributionWeek[] = [];
  const levels: ContributionDay['contributionLevel'][] = [
    'NONE',
    'FIRST_QUARTILE',
    'SECOND_QUARTILE',
    'THIRD_QUARTILE',
    'FOURTH_QUARTILE',
  ];

  // Start from a year ago
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - 1);
  // Align to Sunday (start of week)
  startDate.setDate(startDate.getDate() - startDate.getDay());

  for (let week = 0; week < WEEKS_IN_YEAR; week++) {
    const days: ContributionDay[] = [];
    for (let day = 0; day < DAYS_IN_WEEK; day++) {
      const rand = Math.random();
      let level: ContributionDay['contributionLevel'] = 'NONE';
      let count = 0;

      // 85% chance of contribution - very dense, will require wall-breaking!
      // But create some guaranteed paths every few columns
      const isPathColumn = week % 8 === 0;
      const isPathRow = day === 3; // Middle row has more gaps

      let threshold = 0.15; // 85% walls
      if (isPathColumn) threshold = 0.6; // 40% walls in path columns
      if (isPathRow) threshold = 0.4; // 60% walls in middle row

      if (rand > threshold) {
        const levelIdx = Math.floor(Math.random() * 4) + 1;
        level = levels[levelIdx];
        count = levelIdx * 3;
      }

      // Generate valid ISO date
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + week * 7 + day);
      const dateStr = currentDate.toISOString().split('T')[0];

      days.push({
        date: dateStr,
        contributionCount: count,
        contributionLevel: level,
      });
    }
    weeks.push({ contributionDays: days });
  }

  return weeks;
}
