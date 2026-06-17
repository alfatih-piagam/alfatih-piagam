#!/usr/bin/env node

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_USERNAME = 'alfatih-piagam';

if (!GITHUB_TOKEN) {
  console.error('❌ GITHUB_TOKEN is required to generate the README stack and repository list.');
  console.error('   Run: GITHUB_TOKEN=your_token npm run generate:repos');
  process.exit(1);
}

// Tech stack badge configuration
const techBadges = {
  TypeScript: { color: '3178C6', logo: 'typescript' },
  JavaScript: { color: 'F7DF1E', logo: 'javascript' },
  Python: { color: '3776AB', logo: 'python' },
  Java: { color: '007396', logo: 'java' },
  Kotlin: { color: '0095D5', logo: 'kotlin' },
  Go: { color: '00ADD8', logo: 'go' },
  Rust: { color: 'CE422B', logo: 'rust' },
  React: { color: '61DAFB', logo: 'react' },
  Node: { color: '339933', logo: 'node.js' },
  HTML: { color: 'E34C26', logo: 'html5' },
  CSS: { color: '1572B6', logo: 'css3' },
  Vue: { color: '4FC08D', logo: 'vue.js' },
  Angular: { color: 'DD0031', logo: 'angular' },
  Nextjs: { color: '000000', logo: 'next.js' },
  Express: { color: '000000', logo: 'express' },
  MongoDB: { color: '13AA52', logo: 'mongodb' },
  PostgreSQL: { color: '336791', logo: 'postgresql' },
};

// Language to tech mapping
const languageToTech = {
  TypeScript: 'TypeScript',
  JavaScript: 'JavaScript',
  Python: 'Python',
  Java: 'Java',
  Kotlin: 'Kotlin',
  Go: 'Go',
  Rust: 'Rust',
  HTML: 'HTML',
  CSS: 'CSS',
  PHP: 'PHP',
  C: 'C',
  'C++': 'C++',
  'C#': 'C#',
  Ruby: 'Ruby',
  Swift: 'Swift',
};

async function fetchRepos() {
  console.log(`🔍 Fetching repos for ${GITHUB_USERNAME}...`);

  const query = `
    query($userName:String!, $after:String) {
      user(login: $userName) {
        repositories(first: 100, after: $after, orderBy: {field: UPDATED_AT, direction: DESC}, privacy: PUBLIC) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            name
            description
            url
            languages(first: 100, orderBy: {field: SIZE, direction: DESC}) {
              nodes {
                name
              }
            }
            stars: stargazerCount
            forks: forkCount
          }
        }
      }
    }
  `;

  try {
    const repos = [];
    let after = null;

    while (true) {
      const response = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${GITHUB_TOKEN}`,
        },
        body: JSON.stringify({
          query,
          variables: { userName: GITHUB_USERNAME, after },
        }),
      });

      const data = await response.json();

      if (data.errors) {
        throw new Error(`GraphQL error: ${data.errors[0].message}`);
      }

      const page = data.data.user.repositories;
      repos.push(...page.nodes);

      if (!page.pageInfo.hasNextPage) break;
      after = page.pageInfo.endCursor;
    }

    return repos;
  } catch (error) {
    console.error('❌ Failed to fetch repos:', error.message);
    process.exit(1);
  }
}

function generateTechStackMarkdown(repos) {
  const counts = {};

  repos.forEach((repo) => {
    const repoTechs = new Set(
      repo.languages.nodes
        .map((lang) => languageToTech[lang.name])
        .filter((tech) => tech && techBadges[tech])
    );

    repoTechs.forEach((tech) => {
      counts[tech] = (counts[tech] || 0) + 1;
    });
  });

  const sortedTechs = Object.entries(counts).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0]);
  });

  return sortedTechs
    .map(([tech, count]) => {
      const badge = techBadges[tech];
      const label = encodeURIComponent(`${tech} x${count}`);
      return `[![${tech} x${count}](https://img.shields.io/badge/${label}-${badge.color}?style=flat&logo=${badge.logo}&logoColor=white)]`;
    })
    .join(' ');
}

function escapeMarkdownCell(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/\|/g, '\\|')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, ' ');
}

function formatRepoCell(repo) {
  const description = repo.description ? `<br>${escapeMarkdownCell(repo.description)}` : '';
  const stats = [repo.stars > 0 ? `⭐ ${repo.stars}` : null, repo.forks > 0 ? `🍴 ${repo.forks}` : null]
    .filter(Boolean)
    .join(' · ');

  return `**[${repo.name}](${repo.url})**${description}${stats ? `<br>${stats}` : ''}`;
}

function generateReposMarkdown(repos) {
  const columns = 5;
  const rows = [];

  for (let i = 0; i < repos.length; i += columns) {
    rows.push(repos.slice(i, i + columns));
  }

  let markdown = '## 📚 My Repositories\n\n<div align="center">\n\n';
  markdown += '| ' + Array(columns).fill('Repository').join(' | ') + ' |\n';
  markdown += '| ' + Array(columns).fill('---').join(' | ') + ' |\n';

  rows.forEach((chunk) => {
    markdown += '| ' +
      chunk.map(formatRepoCell).concat(Array(columns - chunk.length).fill(' ')).join(' | ') +
      ' |\n';
  });

  markdown += '\n</div>\n';
  return markdown;
}

async function updateReadme(reposMarkdown, stackMarkdown) {
  const readmePath = path.join(__dirname, '../README.md');
  let content = fs.readFileSync(readmePath, 'utf-8');

  const stackStartMarker = '<!-- STACK START -->';
  const stackEndMarker = '<!-- STACK END -->';
  const reposStartMarker = '<!-- REPOS START -->';
  const reposEndMarker = '<!-- REPOS END -->';

  if (content.includes(stackStartMarker) && content.includes(stackEndMarker)) {
    const before = content.substring(0, content.indexOf(stackStartMarker) + stackStartMarker.length);
    const after = content.substring(content.indexOf(stackEndMarker));
    content = before + '\n' + stackMarkdown + '\n' + after;
  } else if (content.includes('## 🛠️ Tech Stack') && content.includes(reposStartMarker)) {
    const before = content.substring(0, content.indexOf('## 🛠️ Tech Stack'));
    const after = content.substring(content.indexOf(reposStartMarker));
    content = before + `## 🛠️ Tech Stack\n\n${stackStartMarker}\n${stackMarkdown}\n${stackEndMarker}\n\n` + after;
  }

  if (content.includes(reposStartMarker) && content.includes(reposEndMarker)) {
    const before = content.substring(0, content.indexOf(reposStartMarker) + reposStartMarker.length);
    const after = content.substring(content.indexOf(reposEndMarker));
    content = before + '\n' + reposMarkdown + '\n' + after;
  } else {
    content += '\n' + reposStartMarker + '\n' + reposMarkdown + '\n' + reposEndMarker + '\n';
  }

  fs.writeFileSync(readmePath, content);
  console.log('✅ README updated successfully!');
}

async function main() {
  try {
    const repos = await fetchRepos();
    console.log(`📊 Found ${repos.length} public repositories`);

    const stackMarkdown = generateTechStackMarkdown(repos);
    const reposMarkdown = generateReposMarkdown(repos);
    await updateReadme(reposMarkdown, stackMarkdown);

    console.log('✨ Done!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
