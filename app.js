let currentAlbum = null;
let currentPhotos = [];
let selectedPhotoPath = null;
let isSelectMode = false;
let selectedPhotoPaths = new Set();

// DOM Elements
const folderGrid = document.getElementById('folder-grid');
const photoGrid = document.getElementById('photo-grid');
const albumsView = document.getElementById('albums-view');
const photosView = document.getElementById('photos-view');
const mainTitle = document.getElementById('main-title');

const btnCreateAlbum = document.getElementById('btn-create-album');
const btnDeleteAlbum = document.getElementById('btn-delete-album');
const btnAddPhoto = document.getElementById('btn-add-photo');
const btnBack = document.getElementById('btn-back');
const btnSelectMode = document.getElementById('btn-select-mode');

// Selection Actions Elements
const selectionActions = document.getElementById('selection-actions');
const selectionCount = document.getElementById('selection-count');
const btnCancelSelect = document.getElementById('btn-cancel-select');
const btnActionDelete = document.getElementById('btn-action-delete');
const btnActionMove = document.getElementById('btn-action-move');
const btnActionCopy = document.getElementById('btn-action-copy');
const btnActionDownload = document.getElementById('btn-action-download');

// Context Menu Elements
const contextMenu = document.getElementById('photo-context-menu');
const menuView = document.getElementById('menu-view');
const menuShare = document.getElementById('menu-share');
const menuDownload = document.getElementById('menu-download');
const menuDelete = document.getElementById('menu-delete');

// Viewer Elements
const viewerModal = document.getElementById('photo-viewer');
const viewerImg = document.getElementById('viewer-img');
const viewerClose = document.querySelector('.close-btn');
const viewerPrev = document.getElementById('prev-btn');
const viewerNext = document.getElementById('next-btn');

let viewerIndex = 0;

// Initialize
async function init() {
    try {
        await loadFolders();
    } catch (error) {
        alert("Error de app.js (init): " + error.message + "\n\nStack:\n" + error.stack);
    }
}

async function loadFolders() {
    folderGrid.innerHTML = '';
    const albums = await window.fsAPI.getAlbums();

    for (const album of albums) {
        // Obtenemos las fotos para ver si hay una de vista previa
        const photos = await window.fsAPI.getPhotos(album);
        const previewPhoto = photos.length > 0 ? photos[0] : null;

        const folderItem = document.createElement('div');
        folderItem.className = 'folder-item';

        // Elementos visuales de la carpeta
        const photoHtml = previewPhoto
            ? `<div class="folder-photo-preview"><img src="${previewPhoto}" alt="preview"></div>`
            : '';

        folderItem.innerHTML = `
            <div class="folder-icon">
                <div class="folder-tab"></div>
                ${photoHtml}
                <div class="folder-back"></div>
                <div class="folder-front"></div>
            </div>
            <div class="folder-name">${album}</div>
        `;

        folderItem.addEventListener('click', () => openAlbum(album));
        folderGrid.appendChild(folderItem);
    }

    // Toggle delete button based on folder count
    if (albums.length > 0 && currentAlbum === null) {
        btnDeleteAlbum?.classList.remove('hidden');
    } else {
        btnDeleteAlbum?.classList.add('hidden');
    }
}

async function openAlbum(albumName) {
    currentAlbum = albumName;
    mainTitle.textContent = albumName.toUpperCase(); // Titulo en mayuscula como se pidio
    mainTitle.style.fontFamily = "'Comic Sans MS', 'Comic Sans', cursive";
    mainTitle.style.fontSize = '3rem';
    mainTitle.style.letterSpacing = '0px';
    mainTitle.style.color = '#fff';
    mainTitle.style.textShadow = '1px 1px 3px rgba(0,0,0,0.3)';

    // Toggle views
    albumsView.classList.add('hidden');
    photosView.classList.remove('hidden');

    // Toggle buttons
    btnCreateAlbum.classList.add('hidden');
    btnDeleteAlbum.classList.add('hidden');
    btnBack.classList.remove('hidden');
    btnAddPhoto.classList.remove('hidden');
    btnSelectMode.classList.remove('hidden');

    // Reset selection state
    isSelectMode = false;
    selectedPhotoPaths.clear();
    updateSelectionUI();

    btnAddPhoto.disabled = false;
    selectedPhotoPath = null;

    await loadPhotos();
}

btnBack.addEventListener('click', async () => {
    // Restore main title
    mainTitle.textContent = "Nuestra historia de amor";
    mainTitle.style.fontFamily = ''; // revert to css
    mainTitle.style.fontSize = '';
    mainTitle.style.letterSpacing = '';
    mainTitle.style.color = '';
    mainTitle.style.textShadow = '';

    currentAlbum = null;

    // Toggle views
    photosView.classList.add('hidden');
    albumsView.classList.remove('hidden');

    // Toggle buttons
    btnAddPhoto.classList.add('hidden');
    btnSelectMode.classList.add('hidden');
    btnCreateAlbum.classList.remove('hidden');

    // Only show delete album button if there are albums
    const hasAlbums = document.querySelectorAll('.folder-item').length > 0;
    if (hasAlbums) {
        btnDeleteAlbum.classList.remove('hidden');
    } else {
        btnDeleteAlbum.classList.add('hidden');
    }

    btnBack.classList.add('hidden');

    isSelectMode = false;
    updateSelectionUI();

    await loadFolders(); // Reload to update previews
});

async function loadPhotos() {
    photoGrid.innerHTML = '';
    currentPhotos = await window.fsAPI.getPhotos(currentAlbum);

    if (currentPhotos.length === 0) {
        return;
    }

    // Use a DocumentFragment to batch DOM insertions (massive performance boost)
    const fragment = document.createDocumentFragment();

    currentPhotos.forEach((photoPath, index) => {
        const div = document.createElement('div');
        div.className = 'polaroid';
        // Native lazy loading defers image fetching until scrolled into view
        div.innerHTML = `<img src="${photoPath}" loading="lazy" alt="Foto ${index + 1}">`;

        div.addEventListener('click', () => {
            if (isSelectMode) {
                if (selectedPhotoPaths.has(photoPath)) {
                    selectedPhotoPaths.delete(photoPath);
                    div.classList.remove('multi-selected');
                } else {
                    selectedPhotoPaths.add(photoPath);
                    div.classList.add('multi-selected');
                }
                updateSelectionUI();
            } else {
                openViewer(index);
            }
        });

        div.addEventListener('contextmenu', (e) => {
            if (isSelectMode) return; // Disable context menu during select mode
            e.preventDefault();
            selectedPhotoPath = photoPath;
            viewerIndex = index; // in case they click view

            // Show context menu at mouse position
            contextMenu.style.left = `${e.pageX}px`;
            contextMenu.style.top = `${e.pageY}px`;
            contextMenu.classList.remove('hidden');
        });

        fragment.appendChild(div);
    });

    // Append all items at once to avoid multiple reflows/repaints
    photoGrid.appendChild(fragment);
}

// Actions
// Drop the native prompt and use the custom modal
const promptModal = document.getElementById('prompt-modal');
const albumNameInput = document.getElementById('album-name-input');
const btnConfirmPrompt = document.getElementById('btn-confirm-prompt');
const btnCancelPrompt = document.getElementById('btn-cancel-prompt');

btnCreateAlbum.addEventListener('click', () => {
    albumNameInput.value = '';
    promptModal.classList.remove('hidden');
    albumNameInput.focus();
});

btnCancelPrompt.addEventListener('click', () => {
    promptModal.classList.add('hidden');
});

btnConfirmPrompt.addEventListener('click', async () => {
    let albumName = albumNameInput.value;
    if (albumName && albumName.trim() !== '') {
        albumName = albumName.trim().toUpperCase();
        promptModal.classList.add('hidden');
        const success = await window.fsAPI.createAlbum(albumName);
        if (success) {
            await loadFolders();
        } else {
            alert('El álbum ya existe o hubo un error.');
        }
    } else {
        alert('Por favor, escribe un nombre válido.');
    }
});

// Permite usar "Enter" en el input
albumNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        btnConfirmPrompt.click();
    }
});

// Delete Modal Elements
const deleteModal = document.getElementById('delete-modal');
const deleteAlbumInput = document.getElementById('delete-album-input');
const btnConfirmDelete = document.getElementById('btn-confirm-delete');
const btnCancelDelete = document.getElementById('btn-cancel-delete');

btnDeleteAlbum.addEventListener('click', () => {
    deleteAlbumInput.value = '';
    deleteModal.classList.remove('hidden');
    deleteAlbumInput.focus();
});

btnCancelDelete.addEventListener('click', () => {
    deleteModal.classList.add('hidden');
});

btnConfirmDelete.addEventListener('click', async () => {
    let albumName = deleteAlbumInput.value;

    if (albumName && albumName.trim() !== '') {
        deleteModal.classList.add('hidden');
        const success = await window.fsAPI.deleteAlbum(albumName.trim().toUpperCase());
        if (success) {
            await loadFolders();
        } else {
            alert(`No se pudo borrar el álbum "${albumName.trim()}". Quizás no existe o está mal escrito.`);
        }
    } else {
        alert('Debes escribir un nombre para eliminar.');
    }
});

deleteAlbumInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        btnConfirmDelete.click();
    }
});

btnAddPhoto.addEventListener('click', async () => {
    if (!currentAlbum) return;
    const sourcePath = await window.dialogAPI.showOpenDialog();
    if (sourcePath) {
        await window.fsAPI.addPhoto({ albumName: currentAlbum, sourcePath });
        await loadPhotos();
    }
});

// Selection Mode Actions
btnSelectMode.addEventListener('click', () => {
    isSelectMode = !isSelectMode;
    if (!isSelectMode) {
        selectedPhotoPaths.clear();
        document.querySelectorAll('.polaroid').forEach(p => p.classList.remove('multi-selected'));
    }
    updateSelectionUI();
});

btnCancelSelect.addEventListener('click', () => {
    isSelectMode = false;
    selectedPhotoPaths.clear();
    document.querySelectorAll('.polaroid').forEach(p => p.classList.remove('multi-selected'));
    updateSelectionUI();
});

function updateSelectionUI() {
    // The main header buttons (Back, Select, Add Photo, Create Album)
    const defaultHeaderActions = document.querySelector('.header-actions');

    if (!defaultHeaderActions) return;

    if (isSelectMode) {
        selectionActions.classList.remove('hidden');
        defaultHeaderActions.classList.add('hidden'); // Hide the standard buttons
        selectionCount.textContent = `${selectedPhotoPaths.size} seleccionada${selectedPhotoPaths.size !== 1 ? 's' : ''}`;
        document.querySelectorAll('.polaroid').forEach(p => p.classList.add('selectable'));
    } else {
        selectionActions.classList.add('hidden');
        defaultHeaderActions.classList.remove('hidden'); // Show back/select/add buttons again
        document.querySelectorAll('.polaroid').forEach(p => p.classList.remove('selectable'));
    }
}

// Batch Actions
btnActionDelete.addEventListener('click', async () => {
    if (selectedPhotoPaths.size === 0) return;
    if (confirm(`¿Estás seguro de que deseas eliminar ${selectedPhotoPaths.size} foto(s)?`)) {
        for (const path of selectedPhotoPaths) {
            await window.fsAPI.deletePhoto(path);
        }
        isSelectMode = false;
        selectedPhotoPaths.clear();
        updateSelectionUI();
        await loadPhotos();
        await loadFolders();
    }
});

const stubBatchAction = (actionName) => {
    if (selectedPhotoPaths.size === 0) return;
    alert(`Función de ${actionName} para ${selectedPhotoPaths.size} foto(s) estará disponible pronto.`);
    isSelectMode = false;
    selectedPhotoPaths.clear();
    document.querySelectorAll('.polaroid').forEach(p => p.classList.remove('multi-selected'));
    updateSelectionUI();
};

btnActionMove.addEventListener('click', () => stubBatchAction('mover'));
btnActionCopy.addEventListener('click', () => stubBatchAction('copiar'));
btnActionDownload.addEventListener('click', () => stubBatchAction('descargar'));

// Context Menu Actions
document.addEventListener('click', (e) => {
    // Hide context menu when clicking anywhere else
    if (!contextMenu.contains(e.target)) {
        contextMenu.classList.add('hidden');
    }
});

menuView.addEventListener('click', () => {
    contextMenu.classList.add('hidden');
    openViewer(viewerIndex);
});

menuDelete.addEventListener('click', async () => {
    contextMenu.classList.add('hidden');
    if (!selectedPhotoPath) return;

    if (confirm("¿Estás seguro de que deseas eliminar esta foto de este álbum?")) {
        const success = await window.fsAPI.deletePhoto(selectedPhotoPath);
        if (success) {
            selectedPhotoPath = null;
            await loadPhotos();
            await loadFolders(); // update preview if needed
        }
    }
});

menuShare.addEventListener('click', () => {
    contextMenu.classList.add('hidden');
    alert("Función de compartir estará disponible pronto.");
});

menuDownload.addEventListener('click', () => {
    contextMenu.classList.add('hidden');
    alert("Función de descargar estará disponible pronto.");
});

// Viewer functionality
function openViewer(index) {
    viewerIndex = index;
    updateViewerImage();
    viewerModal.classList.remove('hidden');
}

function updateViewerImage() {
    viewerImg.src = currentPhotos[viewerIndex] + '?t=' + new Date().getTime();

    // Update navigation button states
    viewerPrev.style.opacity = viewerIndex > 0 ? '1' : '0.5';
    viewerPrev.style.pointerEvents = viewerIndex > 0 ? 'auto' : 'none';

    viewerNext.style.opacity = viewerIndex < currentPhotos.length - 1 ? '1' : '0.5';
    viewerNext.style.pointerEvents = viewerIndex < currentPhotos.length - 1 ? 'auto' : 'none';
}

viewerClose.addEventListener('click', () => {
    viewerModal.classList.add('hidden');
});

viewerPrev.addEventListener('click', () => {
    if (viewerIndex > 0) {
        viewerIndex--;
        updateViewerImage();
    }
});

viewerNext.addEventListener('click', () => {
    if (viewerIndex < currentPhotos.length - 1) {
        viewerIndex++;
        updateViewerImage();
    }
});

// Initialize app
init();

// Hearts Animation Logic
function createHeart() {
    const heartsContainer = document.getElementById('hearts-container');
    if (!heartsContainer) return;

    // Performance optimization: Cap the number of floating elements 
    if (heartsContainer.childElementCount > 15) return;

    const heart = document.createElement('div');
    heart.classList.add('heart');

    // Mix solid and outline hearts
    heart.innerHTML = Math.random() > 0.5 ? '❤️' : '🤍';

    heart.style.left = Math.random() * 100 + 'vw';
    heart.style.animationDuration = (Math.random() * 5 + 5) + 's'; // 5s to 10s
    heart.style.fontSize = (Math.random() * 15 + 10) + 'px'; // 10px to 25px

    heartsContainer.appendChild(heart);

    setTimeout(() => {
        heart.remove();
    }, 10000);
}

// Slightly reduced frequency for better performance
setInterval(createHeart, 1200);

// Cloud Sync Listener
if (window.fsAPI.onCloudUpdate) {
    window.fsAPI.onCloudUpdate(async () => {
        if (currentAlbum) {
            await loadPhotos();
            // Optional: loadFolders in bg to update counts/previews
            loadFolders();
        } else {
            await loadFolders();
        }
    });
}
