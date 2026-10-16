/**
 * `--smoke` run: loads the real window (hidden), waits for the Idle screen's settings form,
 * probes the app scheme for path escapes, prints one JSON line and exits non-zero on any problem.
 */
import { app, BrowserWindow, net } from 'electron';

interface SmokeOptions {
  appOrigin: string;
  /** Filled by the main process with every non-app request it cancelled. */
  blockedRequests: readonly string[];
  /** False when started with --no-sandbox. Reported only; not part of `ok`. */
  sandboxed: boolean;
}

const FORM_TIMEOUT_MS = 15_000;
const SMOKE_DEADLINE_MS = 45_000;
const NAVIGATION_SETTLE_MS = 1_000;
const POLL_MS = 100;

/** Must stay synchronous until listeners are attached: the caller loads the page right after. */
export async function runSmoke(
  win: BrowserWindow,
  { appOrigin, blockedRequests, sandboxed }: SmokeOptions,
) {
  const deadline = setTimeout(() => {
    process.stdout.write(`${JSON.stringify({ ok: false, error: 'smoke deadline exceeded' })}\n`);
    app.exit(1);
  }, SMOKE_DEADLINE_MS);
  deadline.unref();

  const contents = win.webContents;
  const consoleErrors: string[] = [];
  const cspViolations: string[] = [];
  const failedRequests: string[] = [];
  const loadErrors: string[] = [];

  contents.on('console-message', (event) => {
    const line = `${event.message} (${event.sourceId}:${event.lineNumber})`;
    if (/content security policy/i.test(event.message)) cspViolations.push(line);
    if (event.level === 'error') consoleErrors.push(line);
  });
  contents.on('did-fail-load', (_e, code, description, url) =>
    loadErrors.push(`${code} ${description} ${url}`),
  );
  contents.on('render-process-gone', (_e, details) =>
    loadErrors.push(`renderer gone: ${details.reason}`),
  );
  const requests = contents.session.webRequest;
  requests.onCompleted((details) => {
    if (details.statusCode >= 400) failedRequests.push(`${details.statusCode} ${details.url}`);
  });
  requests.onErrorOccurred((details) => failedRequests.push(`${details.error} ${details.url}`));

  const formRendered = await waitForForm(win);
  // Snapshot now: the probes below provoke failures on purpose and must not count as renderer ones.
  const rendererFailures = [...failedRequests];
  const rendererConsoleErrors = [...consoleErrors];
  const rendererCspViolations = [...cspViolations];
  const networkRequests = [...blockedRequests];

  const rendererIsolated =
    (await contents.executeJavaScript(
      `typeof require === 'undefined' && typeof process === 'undefined'`,
    )) === true;

  // The renderer tries to leave: both must be blocked.
  await contents.executeJavaScript(
    `window.open('https://example.com'); location.href = 'https://example.com'; true`,
  );
  await new Promise((resolve) => setTimeout(resolve, NAVIGATION_SETTLE_MS));
  const windowCount = BrowserWindow.getAllWindows().length;
  const urlAfterNavigation = contents.getURL();
  const navigationBlocked = windowCount === 1 && urlAfterNavigation.startsWith(`${appOrigin}/`);

  // Path-escape probes: these reach real files (repo package.json, /etc/passwd) if unguarded.
  const escapeProbes: Record<string, number | string> = {};
  for (const probe of [
    '/..%2f..%2f..%2fpackage.json',
    `/${'..%2f'.repeat(10)}etc%2fpasswd`,
    '/%2e%2e/%2e%2e/%2e%2e/package.json',
    '/..%5c..%5c..%5cpackage.json',
    '//etc/passwd',
    '/%2Fetc%2Fpasswd',
  ]) {
    try {
      escapeProbes[probe] = (await net.fetch(`${appOrigin}${probe}`)).status;
    } catch (error) {
      escapeProbes[probe] = `refused: ${String(error)}`;
    }
  }
  const escapeOk = Object.values(escapeProbes).every(
    (r) => r === 404 || (typeof r === 'string' && r.startsWith('refused:')),
  );
  const title = win.getTitle();

  const result = {
    sandboxed,
    formRendered,
    title,
    rendererIsolated,
    navigationBlocked,
    windowCount,
    urlAfterNavigation,
    consoleErrors: rendererConsoleErrors,
    cspViolations: rendererCspViolations,
    failedRequests: rendererFailures,
    networkRequests,
    loadErrors,
    escapeProbes,
  };
  const ok =
    formRendered &&
    title === 'metronom' &&
    rendererIsolated &&
    navigationBlocked &&
    escapeOk &&
    rendererConsoleErrors.length === 0 &&
    rendererCspViolations.length === 0 &&
    rendererFailures.length === 0 &&
    networkRequests.length === 0 &&
    loadErrors.length === 0;

  process.stdout.write(`${JSON.stringify({ ok, ...result }, null, 2)}\n`);
  app.exit(ok ? 0 : 1);
}

async function waitForForm(win: BrowserWindow): Promise<boolean> {
  const deadline = Date.now() + FORM_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (win.isDestroyed()) return false;
    try {
      const rendered: unknown = await win.webContents.executeJavaScript(
        `document.querySelectorAll('app-root app-settings-form input').length > 0 &&
         !!document.querySelector('app-root app-settings-form button.start')`,
      );
      if (rendered === true) return true;
    } catch {
      // page not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  return false;
}
