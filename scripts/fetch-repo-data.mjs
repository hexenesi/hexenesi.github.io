#!/usr/bin/env node
/* Regenerates _data/github.json from the GitHub API.
 *
 * Private repositories are counted but never described: no name, language, or
 * timestamp from a private repo is written to the output file, because that
 * file is published with the site.
 *
 * With GITHUB_API_TOKEN set to a personal access token that can read the
 * account's repositories, private repos are counted. Without it the script
 * falls back to the public listing and keeps whatever private count the
 * existing data file already had.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const USER = 'hexenesi';
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '_data', 'github.json');
const token = process.env.GITHUB_API_TOKEN || '';

async function api(url) {
  const res = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'repo-data-refresh',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });
  if (!res.ok) {
    const err = new Error(`${res.status} ${res.statusText} for ${url}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

async function paginate(base) {
  const all = [];
  for (let page = 1; page <= 10; page++) {
    const batch = await api(`${base}${base.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
    all.push(...batch);
    if (batch.length < 100) break;
  }
  return all;
}

/* Returns { repos, sawPrivate } — sawPrivate is false when we could only read
   the public listing, which makes the private count unknowable. */
async function loadRepos() {
  if (token) {
    try {
      const repos = await paginate('https://api.github.com/user/repos?visibility=all&affiliation=owner');
      return { repos, sawPrivate: true };
    } catch (e) {
      if (e.status !== 401 && e.status !== 403) throw e;
      console.warn(`Token cannot list account repos (${e.status}); falling back to public listing.`);
    }
  }
  const repos = await paginate(`https://api.github.com/users/${USER}/repos?type=owner`);
  return { repos, sawPrivate: false };
}

async function previous() {
  try {
    return JSON.parse(await readFile(OUT, 'utf8'));
  } catch {
    return null;
  }
}

function monthLabel(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC'
  });
}

function topLanguage(repos) {
  const tally = new Map();
  for (const r of repos) {
    if (!r.language) continue;
    tally.set(r.language, (tally.get(r.language) || 0) + 1);
  }
  if (!tally.size) return null;
  return [...tally.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
}

const { repos, sawPrivate } = await loadRepos();
const owned = repos.filter((r) => !r.fork);
const publicRepos = owned.filter((r) => !r.private);
const prev = await previous();

const byName = {};
for (const r of publicRepos.sort((a, b) => a.name.localeCompare(b.name))) {
  byName[r.name] = {
    stars: r.stargazers_count,
    language: r.language,
    pushed_at: r.pushed_at,
    pushed_label: monthLabel(r.pushed_at),
    url: r.html_url
  };
}

const data = {
  generated_at: new Date().toISOString().slice(0, 10),
  scope: sawPrivate ? 'public+private' : 'public',
  public_count: publicRepos.length,
  private_count: sawPrivate
    ? owned.filter((r) => r.private).length
    : (prev?.private_count ?? null),
  top_language: topLanguage(sawPrivate ? owned : publicRepos),
  repos: byName
};

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(data, null, 2) + '\n');

console.log(
  `Wrote ${OUT}: ${data.public_count} public, ${data.private_count ?? 'unknown'} private, ` +
    `top language ${data.top_language ?? 'unknown'} (scope: ${data.scope})`
);
