#!/usr/bin/env node

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_USERNAME = 'alfatih-piagam';

// Tech stack badge configuration
const techBadges = {
  TypeScript: { color: '3178C6', logo: 'typescript' },
  JavaScript: { color: 'F7DF1E', logo: 'javascript' },
  Python: { color: '3776AB', logo: 'python' },
  Java: { color: '007396', logo: 'java' },
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
  Go: 'Go',
  Rust: 'Rust',
  HTML: 'HTML',
  CSS: 'CSS',
  PHP: 'PHP',
  C: 'C',
  Cpp: 'C++',
  Csharp: 'C#',
  Ruby: 'Ruby',
  Swift: 'Swift',
  Kotlin: 'Kotlin',
};

async function fetchRepos() {
  console.log(`🔍 Fetching repos for ${GITHUB_USERNAME}...`);

  const query = `
    query($userName:String!) {
      user(login: $userName) {
        repositories(first: 100, orderBy: {field: UPDATED_AT, direction: DESC}, privacy: PUBLIC) {
          nodes {
            name
            description
            url
            languages(first: 5) {
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
    const response = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GITHUB_TOKEN}`,
      },
      body: JSON.stringify({
        query,
        variables: { userName: GITHUB_USERNAME },
      }),
    });

    const data = await response.json();

    if (data.errors) {
      throw new Error(`GraphQL error: ${data.errors[0].message}`);
    }

    return data.data.user.repositories.nodes;
  } catch (error) {
    console.error('❌ Failed to fetch repos:', error.message);
    process.exit(1);
  }
}

function generateBadgesForRepo(languages) {
  return languages
    .map((lang) => {
      const tech = languageToTech[lang.name];
      if (!tech || !techBadges[tech]) return null;

      const badge = techBadges[tech];
      return `![${tech}](https://img.shields.io/badge/${tech}-${badge.color}?style=flat&logo=${badge.logo}&logoColor=white)`;
    })
    .filter(Boolean)
    .join(' ');
}

function generateReposMarkdown(repos) {
  let markdown = '## 📚 My Repositories\n\n';

  repos.forEach((repo) => {
    const badges = generateBadgesForRepo(repo.languages.nodes);
    const stars = repo.stars > 0 ? ` ⭐ ${repo.stars}` : '';
    const forks = repo.forks > 0 ? ` 🍴 ${repo.forks}` : '';

    markdown += `### [${repo.name}](${repo.url})\n`;
    if (repo.description) {
      markdown += `${repo.description}\n`;
    }
    if (badges) {
      markdown += `\n${badges}\n`;
    }
    markdown += `${stars}${forks}\n\n`;
  });

  return markdown;
}

async function updateReadme(reposMarkdown) {
  const readmePath = path.join(__dirname, '../README.md');
  let content = fs.readFileSync(readmePath, 'utf-8');

  const startMarker = '<!-- REPOS START -->';
  const endMarker = '<!-- REPOS END -->';

  if (content.includes(startMarker) && content.includes(endMarker)) {
    const before = content.substring(0, content.indexOf(startMarker) + startMarker.length);
    const after = content.substring(content.indexOf(endMarker));
    content = before + '\n' + reposMarkdown + '\n' + after;
  } else {
    // Append at the end if markers don't exist
    content += '\n' + startMarker + '\n' + reposMarkdown + '\n' + endMarker + '\n';
  }

  fs.writeFileSync(readmePath, content);
  console.log('✅ README updated successfully!');
}

async function main() {
  try {
    const repos = await fetchRepos();
    console.log(`📊 Found ${repos.length} public repositories`);

    const reposMarkdown = generateReposMarkdown(repos);
    await updateReadme(reposMarkdown);

    console.log('✨ Done!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
