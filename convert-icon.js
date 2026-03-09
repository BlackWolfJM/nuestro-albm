const { app, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

app.whenReady().then(() => {
    try {
        const imagePath = path.join(__dirname, 'logo.jpg');
        const image = nativeImage.createFromPath(imagePath);
        if (!image.isEmpty()) {
            const pngBuf = image.toPNG();
            fs.writeFileSync(path.join(__dirname, 'logo.png'), pngBuf);
            console.log('Logo converted successfully to logo.png');
        } else {
            console.error('Failed to load image');
        }
    } catch (err) {
        console.error(err);
    }
    app.quit();
});
