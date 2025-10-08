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
  getContactReactions: (contactHandle, year) => ipcRenderer.invoke('get-contact-reactions', contactHandle, year),
  getAllWords: (limit) => ipcRenderer.invoke('get-all-words', limit),
  getContactWordsFiltered: (contactHandle, filter, limit) => ipcRenderer.invoke('get-contact-words-filtered', contactHandle, filter, limit),
  getTopGroupChats: (limit) => ipcRenderer.invoke('get-top-group-chats', limit),
  getTopGroupChatsByYear: (year, limit) => ipcRenderer.invoke('get-top-group-chats-by-year', year, limit),
  getGroupChatStats: (chatId, year) => ipcRenderer.invoke('get-group-chat-stats', chatId, year),
  getGroupChatParticipants: (chatId, year) => ipcRenderer.invoke('get-group-chat-participants', chatId, year),
  getGroupChatWords: (chatId, limit, personId, year) => ipcRenderer.invoke('get-group-chat-words', chatId, limit, personId, year),
  getGroupChatEmojis: (chatId, limit, personId, year) => ipcRenderer.invoke('get-group-chat-emojis', chatId, limit, personId, year),
  searchGroupChatMessages: (chatId, searchTerm, limit, offset, personId) => ipcRenderer.invoke('search-group-chat-messages', chatId, searchTerm, limit, offset, personId),
  getGroupChatReactions: (chatId, personId, year) => ipcRenderer.invoke('get-group-chat-reactions', chatId, personId, year)
});

contextBridge.exposeInMainWorld('electron', {
  saveStatsImage: (buffer) => ipcRenderer.invoke('save-stats-image', buffer),
  openMessages: (imagePath) => ipcRenderer.invoke('open-messages', imagePath),
  openURL: (url) => ipcRenderer.invoke('open-url', url),
  revealInFinder: (path) => ipcRenderer.invoke('reveal-in-finder', path)
});
