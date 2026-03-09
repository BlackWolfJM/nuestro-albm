const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { uploadToCloud, startListening } = require('./cloudSync');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "Nuestro Álbum ❤️",
    icon: path.join(__dirname, '../logo.jpg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    }
  });

  mainWindow.loadFile('index.html');

  // Start listening to the cloud mailbox
  const albumsPath = path.join(__dirname, '../albums');
  startListening(albumsPath, mainWindow);
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// IPC handlers for file system access
ipcMain.handle('get-albums', async () => {
  const albumsPath = path.join(__dirname, '../albums');
  if (!fs.existsSync(albumsPath)) {
    fs.mkdirSync(albumsPath);
  }
  const items = fs.readdirSync(albumsPath, { withFileTypes: true });
  return items.filter(dirent => dirent.isDirectory()).map(dirent => dirent.name);
});

ipcMain.handle('get-photos', async (event, albumName) => {
  const albumPath = path.join(__dirname, '../albums', albumName);
  if (!fs.existsSync(albumPath)) return [];
  const items = fs.readdirSync(albumPath);
  return items.filter(item => {
    const ext = path.extname(item).toLowerCase();
    return ext === '.jpg' || ext === '.jpeg' || ext === '.png' || ext === '.webp';
  }).map(item => path.join('albums', albumName, item).replace(/\\/g, '/'));
});

ipcMain.handle('create-album', async (event, albumName) => {
  const albumPath = path.join(__dirname, '../albums', albumName);
  if (!fs.existsSync(albumPath)) {
    fs.mkdirSync(albumPath);
    await uploadToCloud('CREATE_ALBUM', { album: albumName });
    return true;
  }
  return false;
});

ipcMain.handle('delete-album', async (event, albumName) => {
  const albumPath = path.join(__dirname, '../albums', albumName);
  if (fs.existsSync(albumPath)) {
    fs.rmSync(albumPath, { recursive: true, force: true });
    await uploadToCloud('DELETE_ALBUM', { album: albumName });
    return true;
  }
  return false;
});

ipcMain.handle('add-photo', async (event, { albumName, sourcePath }) => {
  const fileName = path.basename(sourcePath);
  const destPath = path.join(__dirname, '../albums', albumName, fileName);
  fs.copyFileSync(sourcePath, destPath);

  const base64 = fs.readFileSync(destPath, { encoding: 'base64' });
  await uploadToCloud('ADD_PHOTO', {
    album: albumName,
    filename: fileName,
    base64: base64
  });

  return path.join('albums', albumName, fileName).replace(/\\/g, '/');
});

ipcMain.handle('delete-photo', async (event, relativePath) => {
  const parts = relativePath.split('/');
  const fullPath = path.join(__dirname, '..', ...parts);
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);

    // Parts is like: ["albums", "AlbumName", "photo.jpg"]
    if (parts.length >= 3) {
      await uploadToCloud('DELETE_PHOTO', { album: parts[1], filename: parts[2] });
    }

    return true;
  }
  return false;
});

ipcMain.handle('show-open-dialog', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['jpg', 'png', 'webp', 'jpeg'] }]
  });
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});
