import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  notePath,
  parseArgs,
  renderNote,
  slugify,
  validateNote,
  writeMemoryNote,
} from '../scripts/obsidian-memory-bridge.mjs';

const fixedDate = new Date('2026-07-01T20:30:00.000Z');

test('slugify produces stable note-safe filenames', () => {
  assert.equal(slugify('David / Samantha: Memory Bridge!'), 'david-samantha-memory-bridge');
  assert.equal(slugify(''), 'untitled');
});

test('renderNote includes required frontmatter and links', () => {
  const markdown = renderNote({
    title: 'Obsidian Bridge Decision',
    type: 'decision',
    tags: ['Architecture', 'Memory'],
    links: ['[[SOUL]]', '[[USER]]'],
  }, 'Use the wiki as the living memory surface.', fixedDate);

  assert.match(markdown, /type: "decision"/);
  assert.match(markdown, /created: "2026-07-01T20:30:00.000Z"/);
  assert.match(markdown, /tags: \["samantha-memory", "decision", "architecture", "memory"\]/);
  assert.match(markdown, /links: \["\[\[SOUL\]\]", "\[\[USER\]\]"\]/);
  assert.match(markdown, /# Obsidian Bridge Decision/);
  assert.match(markdown, /- \[\[SOUL\]\]/);
});

test('notePath keeps notes inside typed memory folders', () => {
  const path = notePath({
    vault: '/tmp/vault',
    root: 'Samantha Memory',
    type: 'conversation-summary',
    title: 'A useful conversation',
  }, fixedDate);

  assert.equal(path, '/tmp/vault/Samantha Memory/conversation-summary/2026-07-01-a-useful-conversation.md');
});

test('validateNote rejects unsupported note types', () => {
  assert.throws(() => validateNote({
    command: 'write',
    type: 'random',
    title: 'No',
    body: 'No',
  }), /Invalid --type/);
});

test('parseArgs handles repeatable tags and links', () => {
  const parsed = parseArgs([
    'write',
    '--type', 'idea',
    '--title', 'Bridge',
    '--body', 'Body',
    '--tag', 'memory',
    '--tag', 'obsidian',
    '--link', '[[SOUL]]',
    '--no-sync',
  ]);

  assert.equal(parsed.command, 'write');
  assert.deepEqual(parsed.tags, ['memory', 'obsidian']);
  assert.deepEqual(parsed.links, ['[[SOUL]]']);
  assert.equal(parsed.sync, false);
});

test('writeMemoryNote writes structured markdown into a temp vault without sync', async () => {
  const vault = await mkdtemp(join(tmpdir(), 'samantha-vault-'));
  try {
    const result = await writeMemoryNote({
      command: 'write',
      vault,
      root: 'Samantha Memory',
      type: 'concept',
      title: 'Living File Discipline',
      body: 'Notes are durable memory surfaces.',
      tags: ['practice'],
      links: [],
      sync: false,
      dryRun: false,
    }, fixedDate);

    assert.equal(result.ok, true);
    assert.equal(result.sync.skipped, true);
    const markdown = await readFile(result.path, 'utf8');
    assert.match(markdown, /# Living File Discipline/);
    assert.match(markdown, /Notes are durable memory surfaces\./);
  } finally {
    await rm(vault, { recursive: true, force: true });
  }
});
