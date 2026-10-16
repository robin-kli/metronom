// Checks the output of `npm run package`: one AppImage, the expected app.asar layout,
// and a desktop entry that does not disable the Chromium sandbox. Exits 1 on any problem.
import { listPackage } from '@electron/asar';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const RELEASE = path.resolve('release');
const ASAR = path.join(RELEASE, 'linux-unpacked', 'resources', 'app.asar');
const REQUIRED = ['/dist/electron/main.js', '/dist/metronom/browser/index.html', '/package.json'];
const FORBIDDEN = [/^\/node_modules(\/|$)/, /^\/src(\/|$)/, /^\/_bmad/];

const problems = [];

const appImages = readdirSync(RELEASE).filter((name) => name.endsWith('.AppImage'));
if (appImages.length !== 1) {
  problems.push(`expected exactly one *.AppImage in release/, found ${appImages.length}`);
}

const entries = listPackage(ASAR, { isPack: false }).map((e) => e.replaceAll('\\', '/'));
for (const file of REQUIRED) {
  if (!entries.includes(file)) problems.push(`app.asar is missing ${file}`);
}
for (const pattern of FORBIDDEN) {
  const hit = entries.find((e) => pattern.test(e));
  if (hit) problems.push(`app.asar must not contain ${hit}`);
}

if (appImages.length === 1) {
  // The desktop entry is only inside the AppImage; extract just that file into a temp dir.
  const work = mkdtempSync(path.join(tmpdir(), 'metronom-verify-'));
  try {
    execFileSync(path.join(RELEASE, appImages[0]), ['--appimage-extract', '*.desktop'], {
      cwd: work,
      stdio: 'ignore',
    });
    const root = path.join(work, 'squashfs-root');
    const desktopFiles = readdirSync(root).filter((name) => name.endsWith('.desktop'));
    if (desktopFiles.length === 0) problems.push('AppImage has no .desktop entry');
    for (const name of desktopFiles) {
      const execLines = readFileSync(path.join(root, name), 'utf8')
        .split('\n')
        .filter((line) => line.startsWith('Exec='));
      if (execLines.length === 0) problems.push(`${name} has no Exec= line`);
      for (const line of execLines) {
        if (line.includes('--no-sandbox')) problems.push(`${name} disables the sandbox: ${line}`);
      }
    }
  } catch (error) {
    problems.push(`could not read the desktop entry from ${appImages[0]}: ${error.message}`);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

if (problems.length > 0) {
  for (const problem of problems) console.error(`package:verify: ${problem}`);
  process.exit(1);
}
console.log(`package:verify: ok (${appImages[0]}, ${entries.length} asar entries)`);
