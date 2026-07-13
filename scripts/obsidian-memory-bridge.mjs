#!/usr/bin/env node

import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const DEFAULT_VAULT = '/Users/apple/Samantha/wiki';
const DEFAULT_NOTE_ROOT = 'Samantha Memory';
const VALID_TYPES = new Set(['decision', 'concept', 'idea', 'conversation-summary']);
const HOMEBREW_NODE_22 = '/opt/homebrew/opt/node@22/bin';

function usage(exitCode = 0) {
  const text = `Usage:
  node scripts/obsidian-memory-bridge.mjs write --type decision --title "..." --body "..."
  node scripts/obsidian-memory-bridge.mjs write --type concept --title "..." --body-file ./note.md --tag memory --link "[[SOUL]]"

Options:
  --vault <path>       Obsidian vault path. Defaults to ${DEFAULT_VAULT}
  --root <folder>      Folder inside the vault. Defaults to "${DEFAULT_NOTE_ROOT}"
  --type <type>        decision | concept | idea | conversation-summary
  --title <title>      Note title
  --body <markdown>    Note body
  --body-file <path>   Read note body from a file
  --tag <tag>          Repeatable. Frontmatter tags
  --link <wikilink>    Repeatable. Frontmatter links
  --no-sync            Do not run "ob sync --path <vault>" after writing
  --dry-run            Print JSON plan without writing
`;
  console.log(text);
  process.exit(exitCode);
}

export function parseArgs(argv) {
  const [command, ...tokens] = argv;
  const options = {
    command,
    vault: DEFAULT_VAULT,
    root: DEFAULT_NOTE_ROOT,
    tags: [],
    links: [],
    sync: true,
    dryRun: false,
  };

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === '--help' || token === '-h') usage(0);
    if (token === '--no-sync') {
      options.sync = false;
      continue;
    }
    if (token === '--dry-run') {
      options.dryRun = true;
      options.sync = false;
      continue;
    }
    if (!token.startsWith('--')) {
      throw new Error(`Unexpected argument: ${token}`);
    }

    const key = token.slice(2);
    const value = tokens[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for ${token}`);
    }
    index += 1;

    if (key === 'tag') options.tags.push(value);
    else if (key === 'link') options.links.push(value);
    else options[key] = value;
  }

  return options;
}

export function slugify(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'untitled';
}

export function validateNote(input) {
  if (input.command !== 'write') throw new Error('Only the "write" command is supported.');
  if (!VALID_TYPES.has(input.type)) {
    throw new Error(`Invalid --type "${input.type}". Expected one of: ${Array.from(VALID_TYPES).join(', ')}`);
  }
  if (!input.title) throw new Error('Missing --title');
  if (!input.body && !input['body-file']) throw new Error('Missing --body or --body-file');
}

export async function loadBody(input) {
  if (input.body) return input.body;
  const { readFile } = await import('node:fs/promises');
  return readFile(resolve(input['body-file']), 'utf8');
}

export function renderFrontmatter({ title, type, tags = [], links = [], createdAt = new Date() }) {
  const date = createdAt.toISOString();
  const uniqueTags = Array.from(new Set(['samantha-memory', type, ...tags.map(slugify)]));
  const cleanLinks = links.map((link) => String(link).trim()).filter(Boolean);

  return [
    '---',
    `title: ${JSON.stringify(title)}`,
    `type: ${JSON.stringify(type)}`,
    `created: ${JSON.stringify(date)}`,
    `tags: [${uniqueTags.map((tag) => JSON.stringify(tag)).join(', ')}]`,
    `links: [${cleanLinks.map((link) => JSON.stringify(link)).join(', ')}]`,
    'source: "samantha-app/obsidian-memory-bridge"',
    '---',
    '',
  ].join('\n');
}

export function renderNote(input, body, createdAt = new Date()) {
  const frontmatter = renderFrontmatter({ ...input, createdAt });
  const linkBlock = input.links.length
    ? `\n## Links\n${input.links.map((link) => `- ${link}`).join('\n')}\n`
    : '';

  return `${frontmatter}# ${input.title}\n\n${body.trim()}\n${linkBlock}`;
}

export function notePath(input, createdAt = new Date()) {
  const day = createdAt.toISOString().slice(0, 10);
  const file = `${day}-${slugify(input.title)}.md`;
  return join(resolve(input.vault), input.root, input.type, file);
}

function obsidianEnv() {
  const env = { ...process.env };
  const extraNodePath = env.OBSIDIAN_HEADLESS_NODE_PATH || HOMEBREW_NODE_22;
  if (existsSync(extraNodePath)) {
    env.PATH = `${extraNodePath}:${env.PATH || ''}`;
  }
  return env;
}

export function runObsidianSync(vault) {
  const bin = process.env.OBSIDIAN_HEADLESS_BIN || 'ob';
  const result = spawnSync(bin, ['sync', '--path', vault], {
    env: obsidianEnv(),
    encoding: 'utf8',
  });

  return {
    ok: result.status === 0,
    status: result.status,
    stdout: String(result.stdout || '').trim(),
    stderr: String(result.stderr || '').trim(),
  };
}

export async function writeMemoryNote(input, now = new Date()) {
  validateNote(input);
  const body = await loadBody(input);
  const path = notePath(input, now);
  const markdown = renderNote(input, body, now);

  if (input.dryRun) {
    return { ok: true, dryRun: true, path, markdown, sync: { ok: false, skipped: true } };
  }

  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, markdown, { encoding: 'utf8', flag: 'wx' });

  const sync = input.sync
    ? runObsidianSync(resolve(input.vault))
    : { ok: true, skipped: true };

  return { ok: sync.ok, path, sync };
}

async function main() {
  const input = parseArgs(process.argv.slice(2));
  const result = await writeMemoryNote(input);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 2);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
