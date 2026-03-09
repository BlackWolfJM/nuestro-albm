const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Check config for deviceId, or create one
const configPath = path.join(app.getPath('userData'), 'album-config.json');
let deviceId = '';
if (fs.existsSync(configPath)) {
    deviceId = JSON.parse(fs.readFileSync(configPath)).deviceId;
} else {
    deviceId = crypto.randomUUID();
    fs.writeFileSync(configPath, JSON.stringify({ deviceId }));
}

const dbRoot = "https://nuestro-album-secreto-default-rtdb.firebaseio.com/mailbox";

async function uploadToCloud(actionType, payload) {
    const data = {
        sender: deviceId,
        type: actionType, // 'ADD_PHOTO', 'DELETE_PHOTO', 'CREATE_ALBUM', 'DELETE_ALBUM'
        payload: payload,
        timestamp: Date.now()
    };
    try {
        await fetch(`${dbRoot}.json`, {
            method: 'POST',
            body: JSON.stringify(data),
            headers: { 'Content-Type': 'application/json' }
        });
        console.log(`Subido a la nube: ${actionType}`);
    } catch (err) {
        console.error("Cloud sync error:", err);
    }
}

function startListening(albumsPath, mainWindow) {
    let isFetching = false;

    // Check mailbox every 5 seconds
    setInterval(async () => {
        if (isFetching) return;
        isFetching = true;
        try {
            // Shallow fetch just to get keys without downloading huge payloads
            const res = await fetch(`${dbRoot}.json?shallow=true`);
            const keys = await res.json();

            if (keys) {
                let updated = false;
                for (const key in keys) {
                    const itemRes = await fetch(`${dbRoot}/${key}.json`);
                    const msg = await itemRes.json();

                    if (msg && msg.sender !== deviceId) {
                        await processMessage(msg, albumsPath);
                        // Delete from mailbox after downloading
                        await fetch(`${dbRoot}/${key}.json`, { method: 'DELETE' });
                        updated = true;
                        console.log(`Procesado y eliminado del buzón: ${msg.type}`);
                    }
                }

                // If anything was updated, tell the renderer to refresh the UI
                if (updated && mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('cloud-sync-update');
                }
            }
        } catch (err) {
            console.error("Cloud listen error:", err);
        } finally {
            isFetching = false;
        }
    }, 5000);
}

async function processMessage(msg, albumsPath) {
    const p = msg.payload;
    if (msg.type === 'ADD_PHOTO') {
        const albumPath = path.join(albumsPath, p.album);
        if (!fs.existsSync(albumPath)) {
            fs.mkdirSync(albumPath, { recursive: true });
        }
        const filePath = path.join(albumPath, p.filename);
        const buf = Buffer.from(p.base64, 'base64');
        fs.writeFileSync(filePath, buf);

    } else if (msg.type === 'DELETE_PHOTO') {
        const filePath = path.join(albumsPath, p.album, p.filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

    } else if (msg.type === 'CREATE_ALBUM') {
        const albumPath = path.join(albumsPath, p.album);
        if (!fs.existsSync(albumPath)) {
            fs.mkdirSync(albumPath, { recursive: true });
        }

    } else if (msg.type === 'DELETE_ALBUM') {
        const albumPath = path.join(albumsPath, p.album);
        if (fs.existsSync(albumPath)) {
            fs.rmSync(albumPath, { recursive: true, force: true });
        }
    }
}

module.exports = { uploadToCloud, startListening };
