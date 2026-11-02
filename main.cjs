// Petter: a little creature that lives along the bottom of your screen. It watches which app
// you're in (and whether Listener is playing) and reacts, and grows with XP over time.
// The window is transparent and clicks pass through it except over the pet itself.
const { app, BrowserWindow, Menu, Tray, ipcMain, screen, nativeImage, powerMonitor } = require('electron');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const HEIGHT = 240; // room above the pet for jumps and speech bubbles
const ICON = path.join(__dirname, 'icon.png');
let win = null, tray = null, watcher = null;

if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => win?.webContents.send('event', { type: 'hello' }));
app.setAppUserModelId('com.petter.app');

const saveFile = () => path.join(app.getPath('userData'), 'pet.json');
function load() { try { return JSON.parse(fs.readFileSync(saveFile(), 'utf8')); } catch { return null; } }

function place() {
  if (!win) return;
  const area = screen.getPrimaryDisplay().workArea;
  win.setBounds({ x: area.x, y: area.y + area.height - HEIGHT, width: area.width, height: HEIGHT });
}

function createWindow() {
  win = new BrowserWindow({
    frame: false, transparent: true, resizable: false, movable: false, skipTaskbar: true, focusable: false, hasShadow: false,
    alwaysOnTop: true, backgroundColor: '#00000000', show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false, backgroundThrottling: false },
  });
  win.setAlwaysOnTop(true, 'pop-up-menu');
  win.setIgnoreMouseEvents(true, { forward: true });
  place();
  win.loadFile(path.join(__dirname, 'app', 'index.html'));
  win.once('ready-to-show', () => win.showInactive());
  screen.on('display-metrics-changed', place);
  screen.on('display-added', place);
  screen.on('display-removed', place);
}

// which app has focus: one small PowerShell loop prints the foreground program every 2 seconds
function watchForeground() {
  const script = `
Add-Type @'
using System; using System.Runtime.InteropServices;
public static class FG { [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow(); [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint p); }
'@
while ($true) { $p = 0; [void][FG]::GetWindowThreadProcessId([FG]::GetForegroundWindow(), [ref]$p); $n = (Get-Process -Id $p -ErrorAction SilentlyContinue).ProcessName; [Console]::Out.WriteLine("$n"); [Console]::Out.Flush(); Start-Sleep -Milliseconds 2000 }`;
  watcher = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], { windowsHide: true });
  let last = '';
  watcher.stdout.on('data', (d) => {
    const name = String(d).trim().split(/\r?\n/).pop();
    if (name && name !== last) { last = name; win?.webContents.send('event', { type: 'app', name }); }
  });
  watcher.on('exit', () => { if (!app.isQuitting) setTimeout(watchForeground, 5000); });
}

// is Listener playing? ask its control channel (the same one Jarvis uses)
function listenerNow() {
  return new Promise((resolve) => {
    let cfg;
    try { cfg = JSON.parse(fs.readFileSync(path.join(process.env.APPDATA || '', 'aurora-music', 'control.json'), 'utf8')); } catch { return resolve(null); }
    const body = JSON.stringify({ token: cfg.token, action: 'now' });
    const req = http.request({ host: '127.0.0.1', port: cfg.port, path: '/command', method: 'POST', headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) }, timeout: 3000 }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(null); } });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.end(body);
  });
}
let lastSong = '';
async function pollMusic() {
  const now = await listenerNow();
  const playing = !!now?.playing;
  const song = playing ? `${now.title || ''}${now.artist ? ' · ' + now.artist : ''}` : '';
  if (song !== lastSong) { lastSong = song; win?.webContents.send('event', { type: 'music', playing, song }); }
}

function menu() {
  const pet = load();
  return Menu.buildFromTemplate([
    { label: pet?.name ? `${pet.name} · level ${pet.level || 1}` : 'Petter', enabled: false },
    { type: 'separator' },
    { label: 'Feed a snack', click: () => win?.webContents.send('event', { type: 'feed' }) },
    { label: 'Throw the ball', click: () => win?.webContents.send('event', { type: 'ball' }) },
    { label: 'Do a trick', click: () => win?.webContents.send('event', { type: 'trick' }) },
    { label: 'Rename…', click: () => win?.webContents.send('event', { type: 'rename' }) },
    { label: 'New colour', click: () => win?.webContents.send('event', { type: 'color' }) },
    { type: 'separator' },
    { label: win?.isVisible() ? 'Hide' : 'Show', click: () => (win?.isVisible() ? win.hide() : win?.showInactive()) },
    { label: 'Quit Petter', click: () => { app.isQuitting = true; app.quit(); } },
  ]);
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  // clicks reach the pet only while the mouse is over it; everywhere else they go to the apps below
  ipcMain.on('hit', (e, over) => { if (e.sender === win?.webContents) win.setIgnoreMouseEvents(!over, { forward: true }); });
  ipcMain.on('save', (e, data) => { if (e.sender === win?.webContents) fs.writeFile(saveFile(), JSON.stringify(data), () => {}); });
  ipcMain.handle('load', (e) => (e.sender === win?.webContents ? load() : null));
  // typing a name needs keyboard focus for a moment
  ipcMain.on('typing', (e, on) => { if (e.sender !== win?.webContents) return; win.setFocusable(!!on); if (on) win.focus(); });
  ipcMain.on('menu', (e) => { if (e.sender === win?.webContents) menu().popup(); });
  ipcMain.handle('idle', (e) => (e.sender === win?.webContents ? powerMonitor.getSystemIdleTime() : 0));
  tray = new Tray(nativeImage.createFromPath(ICON).resize({ width: 16, height: 16 }));
  tray.setToolTip('Petter');
  tray.on('click', () => { if (!win.isVisible()) win.showInactive(); win.webContents.send('event', { type: 'hello' }); });
  tray.on('right-click', () => tray.popUpContextMenu(menu()));
  createWindow();
  watchForeground();
  setInterval(pollMusic, 5000);
  powerMonitor.on('lock-screen', () => win?.webContents.send('event', { type: 'away' }));
  powerMonitor.on('unlock-screen', () => win?.webContents.send('event', { type: 'hello' }));
});
app.on('before-quit', () => { app.isQuitting = true; watcher?.kill(); });
app.on('window-all-closed', () => app.quit());
