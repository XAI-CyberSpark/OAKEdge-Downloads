const { app, BrowserWindow, Menu, shell, session, systemPreferences, ipcMain, powerSaveBlocker, dialog } = require('electron');
const { join } = require('node:path');
const { STUDIO_URL, isStudioURL, externalURL, allowedPermission } = require('./policy.cjs');
const smoke = process.argv.includes('--smoke-test');
let window, quitting = false, blocker;
const executions = new Map();
if (smoke) {
  app.commandLine.appendSwitch('use-fake-device-for-media-stream');
  app.commandLine.appendSwitch('use-fake-ui-for-media-stream');
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (window) { window.show(); window.focus(); } });
  app.on('before-quit', () => { quitting = true; });
  app.whenReady().then(createWindow).catch(error => { console.error(error); app.exit(1); });
}
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (window) window.show(); });

function updatePower() {
  const active = [...executions.values()].some(Boolean);
  if (active && blocker === undefined) blocker = powerSaveBlocker.start('prevent-app-suspension');
  if (!active && blocker !== undefined) { powerSaveBlocker.stop(blocker); blocker = undefined; }
}
async function createWindow() {
  app.setName('OAKEdge');
  window = new BrowserWindow({ width: 1440, height: 940, minWidth: 860, minHeight: 620,
    title: 'OAKEdge', backgroundColor: '#181818', show: false,
    webPreferences: { preload: join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true,
      backgroundThrottling: false, webSecurity: true, partition: 'persist:oakedge' } });
  const contents = window.webContents;
  window.on('close', event => { if (process.platform === 'darwin' && !quitting && !smoke) { event.preventDefault(); window.hide(); } });
  contents.on('destroyed', () => { executions.clear(); updatePower(); });
  contents.on('render-process-gone', () => { executions.clear(); updatePower(); });
  ipcMain.on('oakedge:execution-active', (event, source, active) => {
    if (event.sender !== contents || !isStudioURL(contents.getURL()) || !['workflow','local-camera'].includes(source) || typeof active !== 'boolean') return;
    executions.set(source, active); updatePower();
  });
  const trusted = (source, url) => source === contents && isStudioURL(url || source.getURL());
  session.fromPartition('persist:oakedge').setPermissionCheckHandler((source, permission, requestingOrigin, details) =>
    trusted(source, details.requestingUrl || source?.getURL()) && new URL(STUDIO_URL).origin === requestingOrigin && allowedPermission(permission));
  session.fromPartition('persist:oakedge').setPermissionRequestHandler(async (source, permission, callback, details) => {
    if (!trusted(source, details.requestingUrl) || !allowedPermission(permission)) { callback(false); return; }
    if (permission !== 'media' || process.platform !== 'darwin' || smoke) { callback(true); return; }
    try {
      const types = details.mediaTypes ?? [];
      let allowed = true;
      for (const type of types) {
        const kind = type === 'video' ? 'camera' : type === 'audio' ? 'microphone' : null;
        if (!kind) { allowed = false; continue; }
        const status = systemPreferences.getMediaAccessStatus(kind);
        allowed = allowed && (status === 'granted' || (status === 'not-determined' && await systemPreferences.askForMediaAccess(kind)));
      }
      callback(allowed);
    } catch { callback(false); }
  });
  const openExternal = value => { const url = externalURL(value); if (url) void shell.openExternal(url); };
  contents.setWindowOpenHandler(({url}) => { openExternal(url); return { action: 'deny' }; });
  contents.on('will-navigate', (event, url) => { if (!isStudioURL(url)) { event.preventDefault(); openExternal(url); } });
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(process.platform === 'darwin' ? [{ label: 'OAKEdge', submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit' }] }] : []),
    { label: '编辑', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: '视图', submenu: [{ role: 'reload' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'togglefullscreen' }] },
    { label: '窗口', submenu: [{ role: 'minimize' }, { role: 'close' }] },
    { label: '帮助', submenu: [{ label: '下载 OAKEdge', click: () => openExternal(new URL('/download', STUDIO_URL).href) }] },
  ]));
  const load = async () => {
    try { await window.loadURL(STUDIO_URL); window.show(); }
    catch (error) {
      if (smoke) throw error;
      window.show();
      const result = await dialog.showMessageBox(window, { type: 'error', message: '暂时无法连接 OAKEdge', detail: '请检查网络后重试。服务器恢复后，你的账号和场景会继续保留。', buttons: ['重试', '退出'], defaultId: 0 });
      if (result.response === 0) return load();
      app.quit();
    }
  };
  await load();
  if (smoke) {
    try {
      for (let attempt = 0; attempt < 40; attempt++) {
        if (await contents.executeJavaScript('!!document.querySelector("#root .studio")')) break;
        if (attempt === 39) throw Error('Studio did not render');
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      const result = await contents.executeJavaScript(`(async()=>{const media=await navigator.mediaDevices.getUserMedia({video:true,audio:true});const tracks=media.getTracks().map(t=>t.kind);media.getTracks().forEach(t=>t.stop());return {title:document.title,rendered:!!document.querySelector('#root .studio'),nodeAccess:typeof window.require,desktop:window.OAKEdgeDesktop?.platform,tracks};})()`);
      if (!result.rendered || result.nodeAccess !== 'undefined' || result.desktop !== process.platform || !result.tracks.includes('video') || !result.tracks.includes('audio')) throw Error(JSON.stringify(result));
      console.log('OAKEdge desktop smoke: '+JSON.stringify({platform:process.platform,arch:process.arch,...result}));
      app.exit(0);
    } catch (error) { console.error(error); app.exit(1); }
  }
}
