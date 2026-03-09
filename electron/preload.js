const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('fsAPI', {
    getAlbums: () => ipcRenderer.invoke('get-albums'),
    getPhotos: (albumName) => ipcRenderer.invoke('get-photos', albumName),
    createAlbum: (albumName) => ipcRenderer.invoke('create-album', albumName),
    deleteAlbum: (albumName) => ipcRenderer.invoke('delete-album', albumName),
    addPhoto: (data) => ipcRenderer.invoke('add-photo', data),
    deletePhoto: (relativePath) => ipcRenderer.invoke('delete-photo', relativePath),
    onCloudUpdate: (callback) => ipcRenderer.on('cloud-sync-update', () => callback())
});

contextBridge.exposeInMainWorld('dialogAPI', {
    showOpenDialog: () => ipcRenderer.invoke('show-open-dialog')
});
