import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const problems = [];

const configPath = path.join(root, 'eslint.config.mjs');
const configContent = fs.readFileSync(configPath, 'utf8');

const literals = [...configContent.matchAll(/'([^']+)'/g)].map((m) => m[1]);
const referencedRootDirs = new Set();

for (const literal of literals) {
  if (!literal.includes('/')) continue;
  const looksLikeGlob = literal.includes('**');
  const looksLikeFile = /\.[mc]?[jt]sx?$/.test(literal);
  if (!looksLikeGlob && !looksLikeFile) continue;

  const firstSegment = literal.split('/')[0];
  if (
    !firstSegment ||
    firstSegment === '**' ||
    firstSegment.startsWith('.') ||
    !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(firstSegment)
  ) {
    continue;
  }
  referencedRootDirs.add(firstSegment);
}

for (const dir of [...referencedRootDirs].sort()) {
  if (!fs.existsSync(path.join(root, dir))) {
    problems.push(`eslint.config.mjs references missing directory "${dir}/"`);
  }
}

const pkg = JSON.parse(
  fs.readFileSync(path.join(root, 'package.json'), 'utf8'),
);
for (const workspace of pkg.workspaces ?? []) {
  if (workspace.includes('*')) continue;
  if (!fs.existsSync(path.join(root, workspace))) {
    problems.push(`package.json references missing workspace "${workspace}/"`);
  }
}

if (problems.length > 0) {
  console.error(
    '\n[STALE-SCOPE] Config references paths that no longer exist:\n',
  );
  for (const problem of problems) {
    console.error(`  - ${problem}`);
  }
  console.error(
    '\nRename targets back or update eslint.config.mjs / package.json.\n',
  );
  process.exit(1);
}
