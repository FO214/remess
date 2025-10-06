const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

// Configure logging
log.transports.file.level = 'info';
autoUpdater.logger = log;

// For unsigned builds, users will need to manually download updates
// or use the "Remove quarantine" workaround for each update

const { authenticateWithAuth0 } = require('./auth-auth0');
const dbHandler = require('./db-handler');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      enableRemoteModule: false,
      webSecurity: true
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#ffffff',
    show: false
  });

  mainWindow.loadFile('index.html');
  
  // Enable drag and drop
  mainWindow.webContents.on('will-navigate', (event, url) => {
    // Allow navigation for drag and drop but prevent loading files
    if (!url.startsWith('file://')) {
      event.preventDefault();
    }
  });

  // Show window when ready to avoid visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open DevTools in development
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

// Auto-updater events
autoUpdater.on('checking-for-update', () => {
  log.info('Checking for update...');
});

autoUpdater.on('update-available', (info) => {
  log.info('Update available:', info);
  if (mainWindow) {
    mainWindow.webContents.send('update-available', info.version);
  }
});

autoUpdater.on('update-not-available', (info) => {
  log.info('Update not available:', info);
});

autoUpdater.on('error', (err) => {
  log.error('Error in auto-updater:', err);
});

autoUpdater.on('download-progress', (progressObj) => {
  let log_message = 'Download speed: ' + progressObj.bytesPerSecond;
  log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
  log_message = log_message + ' (' + progressObj.transferred + '/' + progressObj.total + ')';
  log.info(log_message);
  
  if (mainWindow) {
    mainWindow.webContents.send('update-progress', Math.round(progressObj.percent));
  }
});

autoUpdater.on('update-downloaded', (info) => {
  log.info('Update downloaded:', info);
  if (mainWindow) {
    mainWindow.webContents.send('update-downloaded');
  }
});

app.whenReady().then(() => {
  createWindow();
  
  // Check for updates after window is created (wait 3 seconds)
  // Only check for updates in production builds
  if (!app.isPackaged) {
    log.info('Running in development mode - skipping update check');
  } else {
    log.info('Running in production mode - checking for updates');
    setTimeout(() => {
      log.info('Checking for updates...');
      autoUpdater.checkForUpdatesAndNotify();
    }, 3000);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle Google Sign-In from renderer process
// Get app version
ipcMain.handle('get-version', () => {
  return app.getVersion();
});

ipcMain.handle('google-signin', async () => {
  try {
    log.info('Starting authentication...');
    const authResult = await authenticateWithAuth0();
    log.info('Authentication successful');
    return { success: true, data: authResult };
  } catch (error) {
    log.error('Authentication error:', error);
    console.error('Authentication error:', error);
    return { success: false, error: error.message };
  }
});

// Check Full Disk Access
ipcMain.handle('check-disk-access', async () => {
  return dbHandler.checkFullDiskAccess();
});

// Clone chat database
ipcMain.handle('clone-database', async () => {
  try {
    const success = dbHandler.cloneChatDatabase();
    return { success };
  } catch (error) {
    console.error('Database clone error:', error);
    return { success: false, error: error.message };
  }
});

// Get all stats
ipcMain.handle('get-stats', async () => {
  try {
    // Check if clone exists, if not create it
    if (!dbHandler.cloneExists()) {
      const cloned = dbHandler.cloneChatDatabase();
      if (!cloned) {
        throw new Error('Failed to clone database');
      }
    }
    
    const stats = dbHandler.getAllStats();
    return { success: true, stats };
  } catch (error) {
    console.error('Stats error:', error);
    return { success: false, error: error.message };
  }
});

// Open System Preferences for Full Disk Access
ipcMain.handle('open-privacy-settings', async () => {
  shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles');
});

// Test contacts database
ipcMain.handle('test-contacts-db', async () => {
  try {
    return dbHandler.testContactsDatabase();
  } catch (error) {
    console.error('Error testing contacts DB:', error);
    return { success: false, error: error.message };
  }
});

// Save contacts CSV
ipcMain.handle('save-contacts', async (event, contacts) => {
  try {
    return dbHandler.saveContactsCSV(contacts);
  } catch (error) {
    console.error('Error saving contacts:', error);
    return { success: false, error: error.message };
  }
});

// Load contacts CSV
ipcMain.handle('load-contacts', async () => {
  try {
    const contacts = dbHandler.loadContactsCSV();
    return { success: true, contacts };
  } catch (error) {
    console.error('Error loading contacts:', error);
    return { success: false, error: error.message, contacts: [] };
  }
});

// Get contact detail stats
ipcMain.handle('get-contact-stats', async (event, contactHandle, year = null) => {
  try {
    let stats, words, emojis;
    
    // Check if contactHandle is an array (multiple handles for one person)
    if (Array.isArray(contactHandle)) {
      if (year) {
        stats = dbHandler.getCombinedContactStatsByYear(contactHandle, year);
        words = dbHandler.getCombinedContactWordsByYear(contactHandle, year, 15);
        emojis = dbHandler.getCombinedContactEmojisByYear(contactHandle, year, 5);
      } else {
        stats = dbHandler.getCombinedContactStats(contactHandle);
        words = dbHandler.getCombinedContactWords(contactHandle, 15);
        emojis = dbHandler.getCombinedContactEmojis(contactHandle, 5);
      }
    } else {
      // Single handle - use existing functions
      if (year) {
        stats = dbHandler.getContactStatsByYear(contactHandle, year);
        words = dbHandler.getContactWordsByYear(contactHandle, year, 15);
        emojis = dbHandler.getContactEmojisByYear(contactHandle, year, 5);
      } else {
        stats = dbHandler.getContactStats(contactHandle);
        words = dbHandler.getContactWords(contactHandle, 15);
        emojis = dbHandler.getContactEmojis(contactHandle, 5);
      }
    }
    
    return { success: true, stats, words, emojis };
  } catch (error) {
    console.error('Error getting contact stats:', error);
    return { success: false, error: error.message };
  }
});

// Get available years
ipcMain.handle('get-available-years', async () => {
  try {
    const years = dbHandler.getAvailableYears();
    return { success: true, years };
  } catch (error) {
    console.error('Error getting available years:', error);
    return { success: false, error: error.message, years: [] };
  }
});

// Get top contacts by year
ipcMain.handle('get-top-contacts-by-year', async (event, year) => {
  try {
    const contacts = dbHandler.getTopContactsByYear(year);
    return { success: true, contacts };
  } catch (error) {
    console.error('Error getting top contacts by year:', error);
    return { success: false, error: error.message, contacts: [] };
  }
});

// Search contact messages
ipcMain.handle('search-contact-messages', async (event, contactHandle, searchTerm) => {
  try {
    const result = dbHandler.searchContactMessages(contactHandle, searchTerm, 10);
    return { success: true, ...result };
  } catch (error) {
    console.error('Error searching contact messages:', error);
    return { success: false, error: error.message, count: 0, examples: [] };
  }
});

// Get contact reactions
ipcMain.handle('get-contact-reactions', async (event, contactHandle) => {
  try {
    const reactions = dbHandler.getContactReactions(contactHandle);
    return { success: true, ...reactions };
  } catch (error) {
    console.error('Error getting contact reactions:', error);
    return { success: false, error: error.message, yourReactions: [], theirReactions: [] };
  }
});

// Install update now
ipcMain.handle('install-update', () => {
  autoUpdater.quitAndInstall(false, true);
});