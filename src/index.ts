import * as fs from 'node:fs';
import * as path from 'node:path';
import { fetchContributions, generateMockContributions, generateDenseContributions } from './github-api.js';
import { createDungeonGrid, generateHeroPath } from './game-engine.js';
import { generateSVG } from './svg-renderer.js';
import { LIGHT_THEME, DARK_THEME } from './types.js';

async function main() {
  const username = process.argv[2] || process.env.GITHUB_USERNAME || 'octocat';
  const outputDir = process.argv[3] || 'dist';
  const token = process.env.GITHUB_TOKEN;
  const useMock = process.argv.includes('--mock');
  const useDense = process.argv.includes('--dense');

  console.log(`🎮 Contribution Crawl`);
  console.log(`   Username: ${username}`);
  console.log(`   Output: ${outputDir}/`);
  if (useDense) console.log(`   Mode: DENSE (wall-breaking test)`);
  console.log('');

  // Fetch contributions
  let weeks;
  try {
    if (useDense) {
      console.log('📊 Using DENSE contribution data (wall-breaking test)...');
      weeks = generateDenseContributions();
    } else if (useMock) {
      console.log('📊 Using mock contribution data...');
      weeks = generateMockContributions();
    } else {
      console.log('📊 Fetching GitHub contributions...');
      weeks = await fetchContributions(username, token);
    }
    console.log(`   Found ${weeks.length} weeks of data`);
  } catch (error) {
    console.error('❌ Failed to fetch contributions:', error);
    console.log('   Falling back to mock data...');
    weeks = generateMockContributions();
  }

  // Create dungeon
  console.log('🗺️  Creating dungeon from contributions...');
  const grid = createDungeonGrid(weeks);
  console.log(`   Grid size: ${grid[0].length} x ${grid.length}`);

  // Generate hero path
  console.log('🗡️  Generating hero adventure...');
  const { path: heroPath, battles, monsterSpawns, wallBreaks } = generateHeroPath(grid);
  console.log(`   Path length: ${heroPath.length} steps`);
  console.log(`   Battles: ${battles.length} encounters`);
  console.log(`   Monster spawns: ${monsterSpawns.length}`);
  console.log(`   Walls broken: ${wallBreaks.length}`);

  // Generate SVGs
  console.log('🎨 Rendering SVG animations...');

  const lightSVG = generateSVG(grid, heroPath, battles, username, LIGHT_THEME, monsterSpawns, wallBreaks);
  const darkSVG = generateSVG(grid, heroPath, battles, username, DARK_THEME, monsterSpawns, wallBreaks);

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write files
  const lightPath = path.join(outputDir, 'contribution-crawl-light.svg');
  const darkPath = path.join(outputDir, 'contribution-crawl-dark.svg');

  fs.writeFileSync(lightPath, lightSVG);
  fs.writeFileSync(darkPath, darkSVG);

  console.log('');
  console.log('✅ Generated:');
  console.log(`   ${lightPath}`);
  console.log(`   ${darkPath}`);
  console.log('');
  console.log('✨ Your Contribution Crawl is ready!');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
