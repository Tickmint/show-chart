import ts from 'typescript';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const args = process.argv.slice(2);
const CHECK_ONLY = args.includes('--check');
const EXPLICIT = args.filter((a) => !a.startsWith('--'));

const DIRECTIVE = /^\s*\/\/\/\s*<(reference|amd-module|amd-dependency)\b.*$/gm;

function isDirective(segment) {
  DIRECTIVE.lastIndex = 0;
  return DIRECTIVE.test(segment);
}

const SUPPORTED = /\.(ts|tsx|js|jsx|mjs|cjs)$/;

const WORKSPACE_GLOBS = ['**/*.ts', '**/*.tsx'];

function trackedFiles() {
  const out = execSync(
    `git ls-files ${WORKSPACE_GLOBS.map((g) => `"${g}"`).join(' ')}`,
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
  );
  return out
    .split('\n')
    .map((f) => f.trim())
    .filter(Boolean);
}

function scriptKindOf(filePath) {
  if (filePath.endsWith('.tsx')) return ts.ScriptKind.TSX;
  if (
    filePath.endsWith('.js') ||
    filePath.endsWith('.mjs') ||
    filePath.endsWith('.cjs') ||
    filePath.endsWith('.jsx')
  ) {
    return ts.ScriptKind.JS;
  }
  return ts.ScriptKind.TS;
}

function parses(text, filePath) {
  const sf = ts.createSourceFile(
    filePath,
    text,
    ts.ScriptTarget.Latest,
    true,
    scriptKindOf(filePath),
  );
  return sf.parseDiagnostics.length === 0;
}

function needsSpaceBetween(before, after) {
  return /[\w$]/.test(before) && /[\w$]/.test(after);
}

function collectRanges(sf, original) {
  const comments = new Map();
  const jsxContainers = [];

  const addCommentsAt = (fullStart) => {
    const leading = ts.getLeadingCommentRanges(original, fullStart);
    if (leading) {
      for (const r of leading) comments.set(`${r.pos}:${r.end}`, r);
    }
    const trailing = ts.getTrailingCommentRanges(original, fullStart);
    if (trailing) {
      for (const r of trailing) comments.set(`${r.pos}:${r.end}`, r);
    }
  };

  const visit = (node) => {
    addCommentsAt(node.getFullStart());
    addCommentsAt(node.getEnd());

    if (ts.isJsxExpression(node) && !node.expression && !node.dotDotDotToken) {
      const whole = ts.isJsxAttribute(node.parent) ? node.parent : node;
      jsxContainers.push({ pos: whole.getStart(sf), end: whole.getEnd() });
    }

    for (const child of node.getChildren(sf)) {
      if (ts.isJsxText(child)) continue;
      if (ts.isToken(child)) {
        addCommentsAt(child.getFullStart());
        addCommentsAt(child.getEnd());
      } else {
        visit(child);
      }
    }
  };
  visit(sf);

  addCommentsAt(original.length);

  const isJsx =
    sf.scriptKind === ts.ScriptKind.TSX || sf.scriptKind === ts.ScriptKind.JSX;
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    false,
    isJsx ? ts.LanguageVariant.JSX : ts.LanguageVariant.Standard,
    original,
  );
  let token = scanner.scan();
  while (token !== ts.SyntaxKind.EndOfFileToken) {
    if (
      token === ts.SyntaxKind.SingleLineCommentTrivia ||
      token === ts.SyntaxKind.MultiLineCommentTrivia
    ) {
      const pos = scanner.getTokenPos();
      const end = scanner.getTextPos();
      comments.set(`${pos}:${end}`, { pos, end });
    }
    token = scanner.scan();
  }

  const jsxRanges = jsxContainers.filter(
    (c) =>
      !jsxContainers.some((o) => o !== c && o.pos <= c.pos && o.end >= c.end),
  );

  return [
    ...[...comments.values()].filter(
      (r) => !jsxRanges.some((j) => j.pos <= r.pos && r.end <= j.end),
    ),
    ...jsxRanges,
  ];
}

function stripCommentsWithTs(original, filePath) {
  const sf = ts.createSourceFile(
    filePath,
    original,
    ts.ScriptTarget.Latest,
    true,
    scriptKindOf(filePath),
  );

  const ranges = collectRanges(sf, original);

  let out = original;
  for (const r of [...ranges].sort((a, b) => b.pos - a.pos)) {
    const segment = original.slice(r.pos, r.end);
    if (isDirective(segment)) continue;
    const before = out[r.pos - 1] ?? '';
    const after = out[r.end] ?? '';
    const replacement = needsSpaceBetween(before, after) ? ' ' : '';
    out = out.slice(0, r.pos) + replacement + out.slice(r.end);
  }
  return out;
}

const files = (
  EXPLICIT.length > 0
    ? EXPLICIT.map((f) =>
        path.relative(ROOT, path.resolve(ROOT, f)).split(path.sep).join('/'),
      )
    : trackedFiles()
).filter((f) => SUPPORTED.test(f) && !f.endsWith('.d.ts'));

const offenders = [];
const skipped = [];

for (const rel of files) {
  const abs = path.join(ROOT, rel);
  let original;
  try {
    original = fs.readFileSync(abs, 'utf8');
  } catch {
    continue;
  }

  if (!parses(original, abs)) {
    skipped.push(`${rel} (source does not parse)`);
    continue;
  }

  let text;
  try {
    text = stripCommentsWithTs(original, abs);
  } catch {
    skipped.push(`${rel} (stripper threw)`);
    continue;
  }

  text = text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n');
  if (!text.endsWith('\n')) text += '\n';

  if (text === original) continue;

  if (!parses(text, abs)) {
    skipped.push(`${rel} (result would not parse)`);
    continue;
  }

  if (CHECK_ONLY) {
    offenders.push(rel);
  } else {
    fs.writeFileSync(abs, text);
  }
}

for (const s of skipped) console.error(`[SKIPPED] ${s}`);

if (CHECK_ONLY) {
  if (offenders.length > 0) {
    console.error('\n[ERROR] These files still contain comments:');
    for (const f of offenders.slice(0, 40)) console.error(`  ${f}`);
    if (offenders.length > 40)
      console.error(`  ... and ${offenders.length - 40} more`);
    console.error('\nRun: npm run strip:comments\n');
    process.exit(1);
  }
}

if (skipped.length > 0) process.exitCode = 1;
