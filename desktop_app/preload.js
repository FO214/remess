const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  getVersion: () => ipcRenderer.invoke('get-version'),
  // Auto-update
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (event, version) => callback(version)),
  onUpdateProgress: (callback) => ipcRenderer.on('update-progress', (event, percent) => callback(percent)),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', () => callback()),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  // Google Sign-In
  signInWithGoogle: () => ipcRenderer.invoke('google-signin'),
  // Database operations
  checkDiskAccess: () => ipcRenderer.invoke('check-disk-access'),
  cloneDatabase: () => ipcRenderer.invoke('clone-database'),
  getStats: () => ipcRenderer.invoke('get-stats'),
  openPrivacySettings: () => ipcRenderer.invoke('open-privacy-settings'),
  testContactsDb: () => ipcRenderer.invoke('test-contacts-db'),
  // Contacts operations
  saveContacts: (contacts) => ipcRenderer.invoke('save-contacts', contacts),
  loadContacts: () => ipcRenderer.invoke('load-contacts'),
  getContactStats: (contactHandle, year) => ipcRenderer.invoke('get-contact-stats', contactHandle, year),
  getAvailableYears: () => ipcRenderer.invoke('get-available-years'),
  getTopContactsByYear: (year) => ipcRenderer.invoke('get-top-contacts-by-year', year),
  searchContactMessages: (contactHandle, searchTerm, limit, offset, filter) => ipcRenderer.invoke('search-contact-messages', contactHandle, searchTerm, limit, offset, filter),
  getContactReactions: (contactHandle) => ipcRenderer.invoke('get-contact-reactions', contactHandle),
  getAllWords: (limit) => ipcRenderer.invoke('get-all-words', limit),
  getContactWordsFiltered: (contactHandle, filter, limit) => ipcRenderer.invoke('get-contact-words-filtered', contactHandle, filter, limit)
});
