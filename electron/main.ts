/**
 * metronom desktop shell: one sealed window that shows the production Angular build.
 *
 * The build is served through the privileged `app://metronom/` scheme instead of `file://`,
 * so Angular's ES module scripts load and the CSP `default-src 'self'` has a real origin.
 * No preload, no IPC, no network.
 */
import { app, BrowserWindow, Menu, protocol, session } from 'electron';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import { runSmoke } from './smoke.js';

const SCHEME = 'app';
const HOST = 'metronom';
const APP_ORIGIN = `${SCHEME}://${HOST}`;
const APP_URL = `${APP_ORIGIN}/index.html`;
/** Compiled to dist/electron/main.js, so the Angular build sits next to it. */
const BUILD_DIR = path.resolve(__dirname, '..', 'metronom', 'browser');
const SMOKE = process.argv.includes('--smoke');
/** The AppImage launcher adds `--no-sandbox` by itself when user namespaces are blocked. */
const SANDBOXED = !process.argv.includes('--no-sandbox');

if (!SANDBOXED) {
  console.warn(
    'metronom: WARNING: running WITHOUT the Chromium sandbox (--no-sandbox). ' +
      'On Ubuntu 24.04 install the AppArmor profile described in the README.',
  );
}

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

// Must happen before `ready`.
protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

/** Maps an `app://metronom/...` URL to a file inside BUILD_DIR, or null if it is not one. */
export function resolveBuildFile(requestUrl: string): string | null {
  let url: URL;
  let pathname: string;
  try {
    url = new URL(requestUrl);
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return null;
  }
  if (url.protocol !== `${SCHEME}:` || url.host !== HOST || pathname.includes('\0')) return null;
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const file = path.resolve(BUILD_DIR, relative);
  const fromRoot = path.relative(BUILD_DIR, file);
  if (fromRoot === '' || fromRoot.startsWith('..') || path.isAbsolute(fromRoot)) return null;
  return file;
}

async function handleAppRequest(request: Request): Promise<Response> {
  const file = resolveBuildFile(request.url);
  if (file) {
    try {
      if ((await stat(file)).isFile()) {
        const type = MIME_TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
        return new Response(await readFile(file), { headers: { 'content-type': type } });
      }
    } catch {
      // fall through to 404
    }
  }
  return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain' } });
}

function isAppUrl(url: string): boolean {
  return url === APP_ORIGIN || url.startsWith(`${APP_ORIGIN}/`);
}

/** Every request the renderer tried that was not the app's own; the smoke run reports them. */
const blockedRequests: string[] = [];

function sealSession(): void {
  const ses = session.defaultSession;
  // Nothing leaves the machine: only the app's own scheme (and inline data) may load.
  ses.webRequest.onBeforeRequest((details, callback) => {
    const allowed = isAppUrl(details.url) || /^(data|blob|devtools):/.test(details.url);
    if (!allowed) blockedRequests.push(details.url);
    callback({ cancel: !allowed });
  });
  ses.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  ses.setPermissionCheckHandler(() => false);
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    title: 'metronom',
    width: 960,
    height: 640,
    minWidth: 480,
    minHeight: 360,
    backgroundColor: '#0E0F12',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });

  if (!SMOKE) win.once('ready-to-show', () => win.show());

  // Without an application menu there is no built-in F11 accelerator, so provide it here.
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F11' && !input.isAutoRepeat) {
      event.preventDefault();
      win.setFullScreen(!win.isFullScreen());
    }
  });

  return win;
}

// Applies to every web contents, including any the renderer might try to create.
app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
  contents.on('will-navigate', (event, url) => {
    if (!isAppUrl(url)) event.preventDefault();
  });
  contents.on('will-redirect', (event, url) => {
    if (!isAppUrl(url)) event.preventDefault();
  });
  contents.on('will-attach-webview', (event) => event.preventDefault());
});

// In a smoke run the window must never close on its own: that is a failure, not a pass.
app.on('window-all-closed', () => (SMOKE ? app.exit(1) : app.quit()));

function fail(error: unknown): void {
  console.error(error);
  app.exit(1);
}

app
  .whenReady()
  .then(() => {
    Menu.setApplicationMenu(null);
    protocol.handle(SCHEME, handleAppRequest);
    sealSession();
    const win = createWindow();
    // The smoke run attaches its listeners before the page starts loading.
    if (SMOKE)
      runSmoke(win, { appOrigin: APP_ORIGIN, blockedRequests, sandboxed: SANDBOXED }).catch(fail);
    return win.loadURL(APP_URL);
  })
  .catch(fail);
