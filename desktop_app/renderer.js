// Sample messaging data (simulated analytics)
const sampleData = {
  user: {
    name: 'John Doe',
    email: 'john.doe@gmail.com',
    avatar: 'https://ui-avatars.com/api/?name=John+Doe&background=1a1a1a&color=fff&size=128'
  },
  stats: {
    totalMessages: 45289,
    sentMessages: 22144,
    receivedMessages: 23145,
    totalConversations: 127,
    avgMessagesPerDay: 42,
    mostActiveYear: 2023,
    mostActiveYearCount: 12456
  },
  messagesByYear: {
    2018: 3421,
    2019: 5678,
    2020: 7890,
    2021: 9234,
    2022: 10234,
    2023: 12456,
    2024: 8376
  },
  topContacts: [
    { name: 'Sarah Johnson', messages: 5678 },
    { name: 'Mike Chen', messages: 4321 },
    { name: 'Emily Davis', messages: 3890 },
    { name: 'Alex Martinez', messages: 3456 },
    { name: 'Jessica Williams', messages: 2987 },
    { name: 'David Brown', messages: 2654 },
    { name: 'Lisa Anderson', messages: 2341 },
    { name: 'Tom Wilson', messages: 2123 }
  ],
  messageDistribution: {
    'Work Group': 8456,
    'Family': 6789,
    'College Friends': 5432,
    'Sports Team': 4321,
    'Other': 3245
  }
};

// State
let isAuthenticated = false;
let userData = null;
let charts = {};
let availableYears = [];
let currentContactHandle = null;

// DOM Elements
const landingContainer = document.getElementById('landingContainer');
const authContainer = document.getElementById('authContainer');
const permissionsContainer = document.getElementById('permissionsContainer');
const importContainer = document.getElementById('importContainer');
const loadingContainer = document.getElementById('loadingContainer');
const wrappedContainer = document.getElementById('wrappedContainer');
const dashboardContainer = document.getElementById('dashboardContainer');
const contactDetailContainer = document.getElementById('contactDetailContainer');
const getStartedBtn = document.getElementById('getStartedBtn');
const backToLandingBtn = document.getElementById('backToLandingBtn');
const googleSignInBtn = document.getElementById('googleSignInBtn');
const signOutBtn = document.getElementById('signOutBtn');
const userName = document.getElementById('userName');
const userAvatar = document.getElementById('userAvatar');
const userProfile = document.getElementById('userProfile');
const profileDropdown = document.getElementById('profileDropdown');
const backToDashboardBtn = document.getElementById('backToDashboardBtn');

// Permissions elements
const openSettingsBtn = document.getElementById('openSettingsBtn');
const checkAccessBtn = document.getElementById('checkAccessBtn');

// Import contacts elements
const dropZone = document.getElementById('dropZone');
const contactFileInput = document.getElementById('contactFileInput');
const browseBtn = document.getElementById('browseBtn');
const skipImportBtn = document.getElementById('skipImportBtn');

// Year selector elements
const topContactsYearSelector = document.getElementById('topContactsYearSelector');
const contactDetailYearSelector = document.getElementById('contactDetailYearSelector');

// Wrapped experience elements
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const skipBtn = document.getElementById('skipBtn');
const exploreDashboardBtn = document.getElementById('exploreDashboardBtn');
const progressBar = document.getElementById('progressBar');

// Update notification elements
const updateNotification = document.getElementById('updateNotification');
const updateVersion = document.getElementById('updateVersion');
const updateProgress = document.getElementById('updateProgress');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const updateDownloaded = document.getElementById('updateDownloaded');
const updateNowBtn = document.getElementById('updateNowBtn');
const updateLaterBtn = document.getElementById('updateLaterBtn');

// State for wrapped experience
let currentSlide = 0;
const totalSlides = 7;

// Initialize
async function init() {
  setupEventListeners();
  checkAuthStatus();
  
  // Set version tag
  if (window.electronAPI && window.electronAPI.getVersion) {
    try {
      const version = await window.electronAPI.getVersion();
      const versionTag = document.getElementById('versionTag');
      if (versionTag) {
        versionTag.textContent = `v${version}`;
      }
    } catch (error) {
      console.error('Failed to get version:', error);
    }
  }
  
  // Setup auto-update listeners
  setupUpdateListeners();
}

// Setup auto-update listeners
function setupUpdateListeners() {
  if (!window.electronAPI) return;
  
  // When update is available
  window.electronAPI.onUpdateAvailable((version) => {
    console.log('Update available:', version);
    updateVersion.textContent = `Remess v${version} is ready to install`;
    updateNotification.style.display = 'block';
    updateProgress.style.display = 'block';
  });
  
  // Update download progress
  window.electronAPI.onUpdateProgress((percent) => {
    console.log('Update progress:', percent);
    progressFill.style.width = `${percent}%`;
    progressText.textContent = `Downloading... ${percent}%`;
  });
  
  // When update is downloaded
  window.electronAPI.onUpdateDownloaded(() => {
    console.log('Update downloaded');
    updateProgress.style.display = 'none';
    updateDownloaded.style.display = 'block';
    updateNowBtn.style.display = 'block';
  });
  
  // Update now button
  updateNowBtn.addEventListener('click', async () => {
    console.log('Installing update now...');
    await window.electronAPI.installUpdate();
  });
  
  // Later button
  updateLaterBtn.addEventListener('click', () => {
    updateNotification.style.display = 'none';
  });
}

// Setup event listeners
function setupEventListeners() {
  getStartedBtn.addEventListener('click', handleGetStarted);
  backToLandingBtn.addEventListener('click', showLandingScreen);
  googleSignInBtn.addEventListener('click', handleGoogleSignIn);
  signOutBtn.addEventListener('click', handleSignOut);
  backToDashboardBtn.addEventListener('click', showDashboard);
  
  // Profile dropdown toggle
  userProfile.addEventListener('click', (e) => {
    e.stopPropagation();
    userProfile.classList.toggle('active');
    profileDropdown.classList.toggle('active');
  });
  
  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!userProfile.contains(e.target) && !profileDropdown.contains(e.target)) {
      userProfile.classList.remove('active');
      profileDropdown.classList.remove('active');
    }
  });
  
  // Refresh data button
  const refreshDataBtn = document.getElementById('refreshDataBtn');
  refreshDataBtn.addEventListener('click', handleRefreshData);
  
  // Load more contacts button
  const loadMoreContactsBtn = document.getElementById('loadMoreContactsBtn');
  loadMoreContactsBtn.addEventListener('click', loadMoreContacts);
  
  // Permissions buttons
  openSettingsBtn.addEventListener('click', handleOpenSettings);
  checkAccessBtn.addEventListener('click', handleCheckAccess);
  
  // Import contacts - skip button
  skipImportBtn.addEventListener('click', () => {
    loadingContainer.style.display = 'flex';
    importContainer.style.display = 'none';
    loadRealData();
  });
  
  // Browse button to select file
  browseBtn.addEventListener('click', () => {
    contactFileInput.click();
  });
  
  // Handle file selection
  contactFileInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    console.log('📁 File selected:', file.name, file.type, file.size);
    
    try {
      const text = await file.text();
      console.log('📄 File text length:', text.length);
      
      const contacts = parseVCard(text);
      console.log(`✅ Parsed ${contacts.length} contacts`);
      
      if (contacts.length === 0) {
        alert('No contacts found in file. Please make sure you exported contacts as vCard format.');
        return;
      }
      
      // Store contacts in localStorage
      localStorage.setItem('remess_contacts', JSON.stringify(contacts));
      
      // Save contacts to CSV file
      const saveResult = await window.electronAPI.saveContacts(contacts);
      if (saveResult.success) {
        console.log('✅ Contacts saved to CSV:', saveResult.path);
      } else {
        console.error('❌ Failed to save contacts:', saveResult.error);
      }
      
      // Show success message briefly
      dropZone.innerHTML = `
        <div style="text-align: center;">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" style="color: #22c55e; margin-bottom: 20px;">
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M22 4L12 14.01l-3-3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <h3 style="font-size: 24px; font-weight: 700; margin-bottom: 12px; color: var(--black);">Got it!</h3>
          <p style="font-size: 16px; color: var(--medium-gray);">Imported ${contacts.length} contacts</p>
        </div>
      `;
      
      // Proceed to loading
      setTimeout(() => {
        loadingContainer.style.display = 'flex';
        importContainer.style.display = 'none';
        loadRealData();
      }, 1500);
      
    } catch (error) {
      console.error('Error parsing contacts:', error);
      alert('Error reading contacts file. Please make sure it\'s a valid vCard (.vcf) file.');
    }
  });
  
  // Year selector event listeners
  topContactsYearSelector.addEventListener('change', async (e) => {
    const year = e.target.value;
    await handleTopContactsYearChange(year);
  });
  
  contactDetailYearSelector.addEventListener('change', async (e) => {
    const year = e.target.value;
    await handleContactDetailYearChange(year);
  });
  
  // Message search event listeners
  const messageSearchBtn = document.getElementById('messageSearchBtn');
  const messageSearchInput = document.getElementById('messageSearchInput');
  
  messageSearchBtn.addEventListener('click', handleMessageSearch);
  messageSearchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleMessageSearch();
    }
  });
  
  // Wrapped experience navigation
  prevBtn.addEventListener('click', () => navigateSlide(-1));
  nextBtn.addEventListener('click', () => navigateSlide(1));
  skipBtn.addEventListener('click', skipToDashboard);
  exploreDashboardBtn.addEventListener('click', skipToDashboard);
  
  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (wrappedContainer.style.display !== 'none') {
      if (e.key === 'ArrowLeft') navigateSlide(-1);
      if (e.key === 'ArrowRight') navigateSlide(1);
      if (e.key === 'Escape') skipToDashboard();
    }
  });
}

// Handle Get Started button - auto-proceed if already authenticated
async function handleGetStarted() {
  if (isAuthenticated && userData) {
    // User is already signed in, auto-load data
    console.log('🚀 User already authenticated, loading data...');
    landingContainer.style.display = 'none';
    loadingContainer.style.display = 'flex';
    
    const hasSeenWrapped = localStorage.getItem('remess_seen_wrapped');
    
    await checkAndLoadData();
    loadingContainer.style.display = 'none';
    
    // Show appropriate screen based on whether they've seen wrapped
    if (hasSeenWrapped) {
      showDashboard();
    } else {
      showWrappedExperience();
    }
  } else {
    // User needs to sign in
    showAuthScreen();
  }
}

// Show auth screen
function showAuthScreen() {
  landingContainer.style.display = 'none';
  authContainer.style.display = 'flex';
}

// Show landing screen
function showLandingScreen() {
  authContainer.style.display = 'none';
  landingContainer.style.display = 'flex';
}

// Check authentication status
function checkAuthStatus() {
  // Check if user was previously authenticated (using localStorage)
  const savedUser = localStorage.getItem('remess_user');
  const savedTokens = localStorage.getItem('remess_auth_tokens');
  
  if (savedUser && savedTokens) {
    try {
      userData = JSON.parse(savedUser);
      const tokens = JSON.parse(savedTokens);
      
      // Check if tokens are still valid (30 days = 2592000000 ms)
      const tokenAge = Date.now() - (tokens.timestamp || 0);
      const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
      
      if (tokenAge < maxAge) {
        // Tokens are still valid, user is authenticated
        console.log('✅ User session is valid');
        isAuthenticated = true;
      } else {
        // Tokens expired, clear them
        console.log('⚠️ Auth tokens expired, requiring sign-in');
        localStorage.removeItem('remess_user');
        localStorage.removeItem('remess_auth_tokens');
        localStorage.removeItem('remess_seen_wrapped');
        isAuthenticated = false;
        userData = null;
      }
    } catch (error) {
      console.error('Error restoring session:', error);
      localStorage.removeItem('remess_user');
      localStorage.removeItem('remess_auth_tokens');
      isAuthenticated = false;
      userData = null;
    }
  }
  
  // Always show landing page on app start
  landingContainer.style.display = 'flex';
}

// Handle Google Sign In
async function handleGoogleSignIn() {
  googleSignInBtn.innerHTML = '<span>Signing in...</span>';
  googleSignInBtn.disabled = true;
  
  try {
    // Check if we have real Google OAuth configured
    if (window.electronAPI && window.electronAPI.signInWithGoogle) {
      // Real Google OAuth
      const result = await window.electronAPI.signInWithGoogle();
      
      console.log('🔐 Auth result:', result);
      
      if (result.success) {
        // Get user data from Auth0 result
        const authUser = result.data.user; // The user object from auth-auth0.js
        const tokens = result.data.tokens; // The tokens from Auth0
        console.log('👤 Auth user data:', authUser);
        
        userData = {
          name: authUser?.name || authUser?.email || 'User',
          email: authUser?.email || 'user@example.com',
          avatar: authUser?.avatar || authUser?.picture || null
        };
        isAuthenticated = true;
        
        console.log('💾 Saving user data and tokens:', userData);
        
        // Save to localStorage with timestamp
        localStorage.setItem('remess_user', JSON.stringify(userData));
        localStorage.setItem('remess_auth_tokens', JSON.stringify({
          ...tokens,
          timestamp: Date.now()
        }));
        
        // Check Full Disk Access and load data
        authContainer.style.display = 'none';
        loadingContainer.style.display = 'flex';
        await checkAndLoadData();
      } else {
        throw new Error(result.error || 'Authentication failed');
      }
    } else {
      console.error('Sign-in not available - authentication required');
      showAuthScreen();
    }
  } catch (error) {
    console.error('Sign in error:', error);
    alert('Failed to sign in. Please try again.');
    
    // Reset button
    googleSignInBtn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" fill="currentColor"/>
      </svg>
      <span>Sign In</span>
    `;
    googleSignInBtn.disabled = false;
  }
}

// Check disk access and load data
async function checkAndLoadData() {
  try {
    const hasAccess = await window.electronAPI.checkDiskAccess();
    
    if (!hasAccess) {
      // Show permissions screen
      showPermissionsScreen();
    } else {
      // Check if contacts CSV already exists
      const contactsResult = await window.electronAPI.loadContacts();
      
      if (contactsResult.success && contactsResult.contacts.length > 0) {
        // Contacts already imported, store in localStorage and proceed
        console.log(`✅ Found existing contacts CSV with ${contactsResult.contacts.length} contacts`);
        localStorage.setItem('remess_contacts', JSON.stringify(contactsResult.contacts));
        
        // Skip import screen and go straight to loading
        loadingContainer.style.display = 'flex';
        authContainer.style.display = 'none';
        await loadRealData();
      } else {
        // No contacts yet, show import screen
        showImportScreen();
      }
    }
  } catch (error) {
    console.error('Error checking disk access:', error);
    showAuthScreen();
  }
}

// Show import contacts screen
function showImportScreen() {
  landingContainer.style.display = 'none';
  authContainer.style.display = 'none';
  loadingContainer.style.display = 'none';
  permissionsContainer.style.display = 'none';
  importContainer.style.display = 'flex';
  wrappedContainer.style.display = 'none';
  dashboardContainer.style.display = 'none';
}

// Parse vCard format
function parseVCard(vcardText) {
  const contacts = [];
  const vcards = vcardText.split('BEGIN:VCARD');
  
  for (const vcard of vcards) {
    if (!vcard.trim()) continue;
    
    const lines = vcard.split('\n');
    let name = '';
    const phones = [];
    let photo = null;
    let photoData = '';
    let isCollectingPhoto = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.startsWith('FN:')) {
        name = line.substring(3).trim();
      } 
      else if (line.includes('TEL')) {
        const phoneMatch = line.match(/:([\d\s\+\-\(\)]+)$/);
        if (phoneMatch) {
          const phone = phoneMatch[1].replace(/[\s\-\(\)]/g, '');
          phones.push(phone);
        }
      }
      else if (line.startsWith('PHOTO;') || line.startsWith('PHOTO:')) {
        // Start collecting photo data
        isCollectingPhoto = true;
        const colonIndex = line.indexOf(':');
        if (colonIndex > -1) {
          photoData = line.substring(colonIndex + 1).trim();
        }
      }
      else if (isCollectingPhoto) {
        // Continue collecting photo data (base64 can span multiple lines)
        if (line.startsWith('END:VCARD') || line.includes(':')) {
          // Stop collecting if we hit another field
          isCollectingPhoto = false;
          if (photoData) {
            photo = photoData;
          }
        } else {
          photoData += line.trim();
        }
      }
    }
    
    // Finalize photo if we were still collecting
    if (isCollectingPhoto && photoData) {
      photo = photoData;
    }
    
    if (name && phones.length > 0) {
      phones.forEach(phone => {
        contacts.push({ name, phone, photo });
      });
    }
  }
  
  console.log(`📸 Parsed ${contacts.filter(c => c.photo).length} contacts with photos out of ${contacts.length} total`);
  return contacts;
}

// Load real data from database
async function loadRealData() {
  try {
    console.log('🔄 Loading real data...');
    
    // Fetch stats from database
    const result = await window.electronAPI.getStats();
    
    if (result.success && result.stats) {
      console.log('✅ Stats loaded successfully');
      
      // Update userData with real stats
      userData.stats = {
        totalMessages: result.stats.totalMessages,
        avgMessagesPerDay: result.stats.avgPerDay,
        mostActiveYear: result.stats.mostActiveYear?.year || new Date().getFullYear(),
        mostActiveYearCount: result.stats.mostActiveYear?.count || 0,
        sentMessages: result.stats.sentVsReceived.sent,
        receivedMessages: result.stats.sentVsReceived.received
      };
      
      userData.messagesByYear = result.stats.messagesByYear;
      userData.topContacts = result.stats.topContacts;
      
      // Preload contacts data before showing any UI
      console.log('📇 Preloading contacts data...');
      let importedContacts = JSON.parse(localStorage.getItem('remess_contacts') || '[]');
      if (importedContacts.length === 0) {
        const loadResult = await window.electronAPI.loadContacts();
        if (loadResult.success && loadResult.contacts.length > 0) {
          importedContacts = loadResult.contacts;
          localStorage.setItem('remess_contacts', JSON.stringify(importedContacts));
          console.log(`✅ Preloaded ${importedContacts.length} contacts from CSV`);
        }
      } else {
        console.log(`✅ Using ${importedContacts.length} contacts from localStorage`);
      }
      
      // Store contacts globally so they're ready
      window.remessContacts = importedContacts;
      
      // Small delay to ensure everything is ready
      await new Promise(resolve => setTimeout(resolve, 300));
      
      console.log('✅ All data loaded, showing wrapped experience');
      // Show wrapped experience with real data
      showWrappedExperience();
    } else {
      throw new Error('Failed to load stats');
    }
  } catch (error) {
    console.error('❌ Error loading real data:', error);
    showAuthScreen();
  }
}

// Show permissions screen
function showPermissionsScreen() {
  landingContainer.style.display = 'none';
  authContainer.style.display = 'none';
  loadingContainer.style.display = 'none';
  permissionsContainer.style.display = 'flex';
  wrappedContainer.style.display = 'none';
  dashboardContainer.style.display = 'none';
}

// Handle open settings button
async function handleOpenSettings() {
  try {
    await window.electronAPI.openPrivacySettings();
  } catch (error) {
    console.error('Error opening settings:', error);
  }
}

// Handle check access button
async function handleCheckAccess() {
  try {
    checkAccessBtn.textContent = 'Checking...';
    checkAccessBtn.disabled = true;
    
    const hasAccess = await window.electronAPI.checkDiskAccess();
    
    if (hasAccess) {
      permissionsContainer.style.display = 'none';
      await loadRealData();
    } else {
      alert('Please grant Full Disk Access in System Settings and restart the app.');
      checkAccessBtn.textContent = "I've granted access";
      checkAccessBtn.disabled = false;
    }
  } catch (error) {
    console.error('Error checking access:', error);
    checkAccessBtn.textContent = "I've granted access";
    checkAccessBtn.disabled = false;
  }
}

// Handle Sign Out
function handleSignOut() {
  // Clear authentication and tokens
  isAuthenticated = false;
  userData = null;
  localStorage.removeItem('remess_user');
  localStorage.removeItem('remess_auth_tokens');
  localStorage.removeItem('remess_seen_wrapped');
  localStorage.removeItem('remess_contacts');
  
  // Clear global contacts cache
  window.remessContacts = null;
  
  console.log('👋 User signed out');
  
  // Close dropdown
  userProfile.classList.remove('active');
  profileDropdown.classList.remove('active');
  
  // Destroy charts
  Object.values(charts).forEach(chart => chart.destroy());
  charts = {};
  
  // Reset slide to first slide
  currentSlide = 0;
  
  // Show landing screen
  landingContainer.style.display = 'flex';
  authContainer.style.display = 'none';
  permissionsContainer.style.display = 'none';
  loadingContainer.style.display = 'none';
  dashboardContainer.style.display = 'none';
  wrappedContainer.style.display = 'none';
  
  // Reset sign in button
  googleSignInBtn.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" fill="currentColor"/>
    </svg>
    <span>Sign In</span>
  `;
  googleSignInBtn.disabled = false;
}

// Handle refresh data
async function handleRefreshData() {
  const refreshBtn = document.getElementById('refreshDataBtn');
  
  // Add refreshing state
  refreshBtn.classList.add('refreshing');
  refreshBtn.disabled = true;
  refreshBtn.querySelector('span').textContent = 'Refreshing...';
  
  try {
    console.log('🔄 Starting data refresh...');
    
    // Re-clone the database
    console.log('📦 Cloning database...');
    const cloneResult = await window.electronAPI.cloneDatabase();
    
    if (!cloneResult.success) {
      throw new Error(cloneResult.error || 'Failed to clone database');
    }
    
    console.log('✅ Database cloned successfully');
    
    // Reload all data
    console.log('📊 Reloading stats...');
    const result = await window.electronAPI.getStats();
    
    if (result.success && result.stats) {
      // Update userData
      userData.stats = {
        totalMessages: result.stats.totalMessages,
        avgMessagesPerDay: result.stats.avgPerDay,
        mostActiveYear: result.stats.mostActiveYear?.year || new Date().getFullYear(),
        mostActiveYearCount: result.stats.mostActiveYear?.count || 0,
        sentMessages: result.stats.sentVsReceived.sent,
        receivedMessages: result.stats.sentVsReceived.received
      };
      
      userData.messagesByYear = result.stats.messagesByYear;
      userData.topContacts = result.stats.topContacts;
      
      console.log('✅ Data refreshed successfully');
      
      // Reload available years
      await populateYearSelectors();
      
      // Refresh the dashboard display
      await loadDashboardData();
      
      // Show success feedback
      refreshBtn.querySelector('span').textContent = 'Refreshed!';
      setTimeout(() => {
        refreshBtn.querySelector('span').textContent = 'Refresh Data';
      }, 2000);
      
    } else {
      throw new Error('Failed to load stats');
    }
    
  } catch (error) {
    console.error('❌ Error refreshing data:', error);
    alert('Failed to refresh data. Please try again.');
    refreshBtn.querySelector('span').textContent = 'Refresh Data';
  } finally {
    refreshBtn.classList.remove('refreshing');
    refreshBtn.disabled = false;
  }
}

// Show wrapped experience
function showWrappedExperience() {
  authContainer.style.display = 'none';
  loadingContainer.style.display = 'none';
  permissionsContainer.style.display = 'none';
  wrappedContainer.style.display = 'block';
  dashboardContainer.style.display = 'none';
  landingContainer.style.display = 'none';
  contactDetailContainer.style.display = 'none';
  
  // Reset to first slide
  currentSlide = 0;
  updateSlides();
  updateProgress();
  updateNavigationButtons();
  
  // Load wrapped data with delay for animations
  setTimeout(() => {
    loadWrappedData();
  }, 500);
}

// Load wrapped experience data
async function loadWrappedData() {
  if (!userData?.stats || !userData?.topContacts) {
    console.error('No user data available');
    showAuthScreen();
    return;
  }
  
  const stats = userData.stats;
  const topContacts = userData.topContacts;
  
  // Use preloaded contacts
  const importedContacts = window.remessContacts || [];
  console.log(`📇 Using ${importedContacts.length} preloaded contacts for wrapped data`);
  
  // Helper function to get display name and photo for a contact
  function getContactInfo(contact) {
    let displayName = contact.displayName || contact.name || contact.contact || 'Unknown';
    let contactPhoto = null;
    
    // Try to match with imported contacts
    if (importedContacts.length > 0 && contact.contact) {
      let match = null;
      
      // Check if it's an email
      if (contact.contact.includes('@')) {
        // For emails, only match exact email addresses
        match = importedContacts.find(c => 
          c.phone && c.phone.toLowerCase() === contact.contact.toLowerCase()
        );
      } else {
        // For phone numbers, match by last 10 digits
        const cleaned = contact.contact.replace(/\D/g, '');
        match = importedContacts.find(c => {
          const contactCleaned = c.phone.replace(/\D/g, '');
          return contactCleaned.endsWith(cleaned.slice(-10)) || cleaned.endsWith(contactCleaned.slice(-10));
        });
      }
      
      if (match) {
        displayName = match.name;
        contactPhoto = match.photo || null;
        console.log(`✅ Wrapped: Matched ${contact.contact} -> ${match.name}`, contactPhoto ? '(with photo)' : '');
      }
    }
    
    return { displayName, contactPhoto };
  }
  
  // Update wrapped stats
  document.getElementById('wrappedTotalMessages').textContent = 
    stats.totalMessages.toLocaleString();
  document.getElementById('wrappedAvgMessages').textContent = 
    (stats.avgMessagesPerDay || stats.avgPerDay).toLocaleString();
  document.getElementById('wrappedTotalContacts').textContent = 
    topContacts.length.toLocaleString();
  document.getElementById('wrappedMostActiveYear').textContent = 
    stats.mostActiveYear;
  document.getElementById('wrappedYearCount').textContent = 
    stats.mostActiveYearCount.toLocaleString();
  
  // Top contact
  const topContact = topContacts[0];
  const { displayName, contactPhoto } = getContactInfo(topContact);
  const initials = displayName.split(' ').map(n => n[0]).join('').substring(0, 2);
  
  // Display avatar - use photo if available, otherwise initials
  const avatarContainer = document.getElementById('wrappedTopAvatar');
  if (contactPhoto) {
    avatarContainer.innerHTML = `<img src="${contactPhoto}" alt="${displayName}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover; border: 3px solid var(--black); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);">`;
  } else {
    document.getElementById('wrappedTopInitial').textContent = initials || '??';
  }
  
  document.getElementById('wrappedTopName').textContent = displayName;
  document.getElementById('wrappedTopCount').textContent = 
    (topContact.message_count || topContact.messages || 0).toLocaleString();
}

// Navigate slides
function navigateSlide(direction) {
  const newSlide = currentSlide + direction;
  
  if (newSlide >= 0 && newSlide < totalSlides) {
    currentSlide = newSlide;
    updateSlides();
    updateProgress();
    updateNavigationButtons();
  }
}

// Update slides visibility
function updateSlides() {
  const slides = document.querySelectorAll('.wrapped-slide');
  
  slides.forEach((slide, index) => {
    slide.classList.remove('active', 'prev');
    
    if (index === currentSlide) {
      slide.classList.add('active');
    } else if (index < currentSlide) {
      slide.classList.add('prev');
    }
  });
}

// Update progress bar
function updateProgress() {
  const progress = ((currentSlide + 1) / totalSlides) * 100;
  progressBar.style.width = `${progress}%`;
}

// Update navigation buttons
function updateNavigationButtons() {
  prevBtn.disabled = currentSlide === 0;
  nextBtn.disabled = currentSlide === totalSlides - 1;
}

// Skip to dashboard
function skipToDashboard() {
  localStorage.setItem('remess_seen_wrapped', 'true');
  showDashboard();
}

// Show dashboard with data
function showDashboard() {
  // Hide auth and wrapped, show dashboard
  authContainer.style.display = 'none';
  permissionsContainer.style.display = 'none';
  loadingContainer.style.display = 'none';
  wrappedContainer.style.display = 'none';
  contactDetailContainer.style.display = 'none';
  dashboardContainer.style.display = 'flex';
  
  // Update user info from Auth0 - always show name and avatar
  const displayName = userData?.name || userData?.email || 'User';
  userName.textContent = displayName;
  
  console.log('👤 Setting user profile:', {
    name: displayName,
    avatar: userData?.avatar,
    hasAvatar: !!userData?.avatar
  });
  
  // Set Auth0 profile picture
  if (userData?.avatar) {
    userAvatar.src = userData.avatar;
    userAvatar.style.display = 'block';
    userAvatar.style.objectFit = 'cover';
    userAvatar.onerror = function() {
      // Fallback: hide image and show initials in CSS
      console.log('⚠️ Avatar failed to load, using fallback');
      this.style.display = 'none';
    };
  } else {
    // No avatar provided
    console.log('ℹ️ No avatar provided');
    userAvatar.style.display = 'none';
  }
  
  // Load dashboard data
  loadDashboardData();
}

// Load dashboard data
async function loadDashboardData() {
  if (!userData?.stats || !userData?.topContacts || !userData?.messagesByYear) {
    console.error('No user data available');
    showAuthScreen();
    return;
  }
  
  const stats = userData.stats;
  const messagesByYear = userData.messagesByYear;
  const topContacts = userData.topContacts;
  
  // Load available years for the year selector
  await populateYearSelectors();
  
  // Update stats with real data
  const totalMsgs = stats.totalMessages;
  const sentMsgs = stats.sentMessages;
  const receivedMsgs = stats.receivedMessages;
  
  animateValue('totalMessages', 0, totalMsgs, 1500);
  animateValue('totalConversations', 0, topContacts.length, 1500);
  animateValue('avgMessages', 0, stats.avgMessagesPerDay || stats.avgPerDay, 1500);
  animateValue('sentMessages', 0, sentMsgs, 1500);
  animateValue('receivedMessages', 0, receivedMsgs, 1500);
  
  // Verify consistency
  console.log('📊 Message counts:', {
    total: totalMsgs,
    sent: sentMsgs,
    received: receivedMsgs,
    sum: sentMsgs + receivedMsgs,
    match: totalMsgs === (sentMsgs + receivedMsgs)
  });
  
  document.getElementById('mostActiveYear').textContent = stats.mostActiveYear;
  document.getElementById('mostActiveYearCount').textContent = 
    `${stats.mostActiveYearCount.toLocaleString()} texts`;
  
  // Create charts with real data
  setTimeout(() => {
    createMessagesOverTimeChart(messagesByYear);
    renderTopContacts(topContacts);
  }, 500);
}

// Animate number values
function animateValue(elementId, start, end, duration) {
  const element = document.getElementById(elementId);
  const range = end - start;
  const increment = range / (duration / 16);
  let current = start;
  
  const timer = setInterval(() => {
    current += increment;
    if (current >= end) {
      current = end;
      clearInterval(timer);
    }
    element.textContent = Math.floor(current).toLocaleString();
  }, 16);
}

// Create Messages Over Time Chart
function createMessagesOverTimeChart(messagesByYearData) {
  const ctx = document.getElementById('messagesChart').getContext('2d');
  
  // Convert data format if it's an array (from real data)
  let yearData = messagesByYearData;
  if (Array.isArray(messagesByYearData)) {
    yearData = {};
    messagesByYearData.forEach(item => {
      yearData[item.year] = item.count;
    });
  }
  
  const years = Object.keys(yearData);
  const values = Object.values(yearData);
  
  charts.messagesChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: years,
      datasets: [{
        label: 'Texts',
        data: values,
        borderColor: '#1a1a1a',
        backgroundColor: 'rgba(26, 26, 26, 0.1)',
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointRadius: 5,
        pointBackgroundColor: '#1a1a1a',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointHoverRadius: 7,
        pointHoverBorderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'index'
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          enabled: true,
          backgroundColor: 'rgba(26, 26, 26, 0.95)',
          titleColor: '#fff',
          bodyColor: '#fff',
          padding: 10,
          borderRadius: 6,
          displayColors: false,
          titleFont: {
            size: 12,
            weight: '600'
          },
          bodyFont: {
            size: 11
          },
          caretSize: 5,
          callbacks: {
            title: function(context) {
              return context[0].label;
            },
            label: function(context) {
              return context.parsed.y.toLocaleString() + ' texts';
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grace: '5%',
          grid: {
            color: 'rgba(0, 0, 0, 0.08)',
            drawBorder: false,
            lineWidth: 1
          },
          border: {
            display: false
          },
          ticks: {
            color: '#999999',
            font: {
              size: 10,
              family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
            },
            padding: 10,
            maxTicksLimit: 5,
            callback: function(value) {
              if (value >= 1000) {
                return (value / 1000) + 'k';
              }
              return value;
            }
          }
        },
        x: {
          grid: {
            display: false,
            drawBorder: false
          },
          border: {
            display: false
          },
          ticks: {
            color: '#999999',
            font: {
              size: 11,
              weight: '500',
              family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
            },
            padding: 10
          }
        }
      },
      layout: {
        padding: {
          top: 15,
          right: 15,
          bottom: 10,
          left: 0
        }
      },
      onClick: (event, activeElements) => {
        if (activeElements.length > 0) {
          const clickedIndex = activeElements[0].index;
          const clickedYear = years[clickedIndex];
          console.log(`📅 Clicked on year: ${clickedYear}`);
          
          // Update the year selector for top contacts
          const yearSelector = document.getElementById('topContactsYearSelector');
          if (yearSelector) {
            yearSelector.value = clickedYear;
            // Trigger the change event to update the contacts list
            handleTopContactsYearChange();
          }
        }
      }
    }
  });
}

// Render Top Contacts
async function renderTopContacts(topContactsData) {
  const container = document.getElementById('topContactsList');
  container.innerHTML = '';
  
  const contacts = topContactsData;
  
  console.log('📇 Rendering contacts:', contacts.length, 'total');
  
  // Load imported contacts from localStorage or CSV
  let importedContacts = JSON.parse(localStorage.getItem('remess_contacts') || '[]');
  
  // If not in localStorage, try loading from CSV
  if (importedContacts.length === 0) {
    console.log('📂 No contacts in localStorage, trying CSV...');
    const loadResult = await window.electronAPI.loadContacts();
    if (loadResult.success && loadResult.contacts.length > 0) {
      importedContacts = loadResult.contacts;
      // Store in localStorage for faster access
      localStorage.setItem('remess_contacts', JSON.stringify(importedContacts));
      console.log(`✅ Loaded ${importedContacts.length} contacts from CSV`);
    }
  }
  
  console.log(`📇 Imported contacts available: ${importedContacts.length}`);
  
  // First pass: match contacts to names
  const matchedContacts = contacts.map((contact, index) => {
    let displayName = contact.displayName || contact.name || `Contact #${index + 1}`;
    let contactPhoto = null;
    
    // Try to match with imported contacts
    if (importedContacts.length > 0 && contact.contact) {
      let match = null;
      
      // Check if it's an email
      if (contact.contact.includes('@')) {
        // For emails, only match exact email addresses
        match = importedContacts.find(c => 
          c.phone && c.phone.toLowerCase() === contact.contact.toLowerCase()
        );
      } else {
        // For phone numbers, match by last 10 digits
        const cleaned = contact.contact.replace(/\D/g, '');
        match = importedContacts.find(c => {
          const contactCleaned = c.phone.replace(/\D/g, '');
          return contactCleaned.endsWith(cleaned.slice(-10)) || cleaned.endsWith(contactCleaned.slice(-10));
        });
      }
      
      if (match) {
        displayName = match.name;
        contactPhoto = match.photo || null;
        console.log(`✅ Matched ${contact.contact} -> ${match.name}`, contactPhoto ? '(with photo)' : '');
      }
    }
    
    return {
      ...contact,
      displayName,
      contactPhoto,
      messageCount: contact.message_count || contact.messages || 0
    };
  });
  
  // Consolidate contacts with same display name
  const consolidatedMap = new Map();
  matchedContacts.forEach(contact => {
    const key = contact.displayName.toLowerCase();
    
    if (consolidatedMap.has(key)) {
      // Add to existing contact's message count and handles
      const existing = consolidatedMap.get(key);
      existing.messageCount += contact.messageCount;
      existing.handles.push(contact.contact);
    } else {
      // First occurrence of this contact
      consolidatedMap.set(key, { 
        ...contact, 
        handles: [contact.contact] // Keep track of all handles
      });
    }
  });
  
  // Convert back to array and sort by message count
  const allConsolidatedContacts = Array.from(consolidatedMap.values())
    .sort((a, b) => b.messageCount - a.messageCount);
  
  console.log(`📊 Consolidated ${matchedContacts.length} entries into ${allConsolidatedContacts.length} unique contacts`);
  
  // Store all contacts globally for "Load More" functionality
  window.allTopContacts = allConsolidatedContacts;
  window.currentContactsShown = Math.min(10, allConsolidatedContacts.length);
  
  // Show only the first 10 (or fewer if less available)
  const contactsToShow = allConsolidatedContacts.slice(0, window.currentContactsShown);
  
  // Now render the contacts
  contactsToShow.forEach((contact, index) => {
    const displayName = contact.displayName;
    const contactPhoto = contact.contactPhoto;
    const messageCount = contact.messageCount;
    
    const contactElement = document.createElement('div');
    contactElement.className = 'contact-item';
    
    // Generate profile picture HTML
    let avatarHTML = '';
    if (contactPhoto) {
      // Use imported contact photo with error handling - show initials if image fails
      const initials = getInitials(displayName);
      avatarHTML = `<img src="${contactPhoto}" alt="${displayName}" class="contact-avatar" onerror="this.parentElement.innerHTML='<div class=\\'contact-avatar-placeholder\\'>${initials}</div>';">`;
    } else if (contact.imageData) {
      // Convert Buffer to base64 data URL
      try {
        const base64 = btoa(
          new Uint8Array(contact.imageData).reduce((data, byte) => data + String.fromCharCode(byte), '')
        );
        avatarHTML = `<img src="data:image/jpeg;base64,${base64}" alt="${displayName}" class="contact-avatar">`;
      } catch (e) {
        // If conversion fails, use initials
        avatarHTML = `<div class="contact-avatar-placeholder">${getInitials(displayName)}</div>`;
      }
    } else {
      // Use initials as fallback
      avatarHTML = `<div class="contact-avatar-placeholder">${getInitials(displayName)}</div>`;
    }
    
    contactElement.innerHTML = `
      <div class="contact-left">
        <div class="contact-rank">${index + 1}</div>
        ${avatarHTML}
        <div class="contact-info-item">
          <h4>${displayName}</h4>
          <p>${messageCount.toLocaleString()} texts</p>
        </div>
      </div>
      <div class="contact-count">${messageCount.toLocaleString()}</div>
    `;
    
    // Add click handler to show contact detail
    contactElement.addEventListener('click', () => {
      showContactDetail({
        handles: contact.handles || [contact.contact], // Pass all handles for this person
        displayName: displayName,
        imageData: contactPhoto,
        messages: messageCount
      });
    });
    
    // Stagger animation
    contactElement.style.opacity = '0';
    contactElement.style.transform = 'translateX(-20px)';
    
    setTimeout(() => {
      contactElement.style.transition = 'all 0.4s ease';
      contactElement.style.opacity = '1';
      contactElement.style.transform = 'translateX(0)';
    }, index * 100);
    
    container.appendChild(contactElement);
  });
  
  // Show or hide "Load More" button
  const loadMoreBtn = document.getElementById('loadMoreContactsBtn');
  if (window.currentContactsShown < allConsolidatedContacts.length) {
    loadMoreBtn.style.display = 'flex';
    loadMoreBtn.querySelector('span').textContent = 'Load More';
  } else {
    loadMoreBtn.style.display = 'none';
  }
}

// Load more contacts
function loadMoreContacts() {
  if (!window.allTopContacts) return;
  
  const container = document.getElementById('topContactsList');
  const loadMoreBtn = document.getElementById('loadMoreContactsBtn');
  
  // Load 10 more contacts
  const currentCount = window.currentContactsShown;
  const newCount = Math.min(currentCount + 10, window.allTopContacts.length);
  const newContacts = window.allTopContacts.slice(currentCount, newCount);
  
  // Load imported contacts for matching
  const importedContacts = JSON.parse(localStorage.getItem('remess_contacts') || '[]');
  
  // Render new contacts
  newContacts.forEach((contact, i) => {
    const index = currentCount + i;
    const displayName = contact.displayName;
    const contactPhoto = contact.contactPhoto;
    const messageCount = contact.messageCount;
    
    const contactElement = document.createElement('div');
    contactElement.className = 'contact-item';
    
    // Generate profile picture HTML
    let avatarHTML = '';
    if (contactPhoto) {
      const initials = getInitials(displayName);
      avatarHTML = `<img src="${contactPhoto}" alt="${displayName}" class="contact-avatar" onerror="this.parentElement.innerHTML='<div class=\\'contact-avatar-placeholder\\'>${initials}</div>';">`;
    } else if (contact.imageData) {
      try {
        const base64 = btoa(
          new Uint8Array(contact.imageData).reduce((data, byte) => data + String.fromCharCode(byte), '')
        );
        avatarHTML = `<img src="data:image/jpeg;base64,${base64}" alt="${displayName}" class="contact-avatar">`;
      } catch (e) {
        avatarHTML = `<div class="contact-avatar-placeholder">${getInitials(displayName)}</div>`;
      }
    } else {
      avatarHTML = `<div class="contact-avatar-placeholder">${getInitials(displayName)}</div>`;
    }
    
    contactElement.innerHTML = `
      <div class="contact-left">
        <div class="contact-rank">${index + 1}</div>
        ${avatarHTML}
        <div class="contact-info-item">
          <h4>${displayName}</h4>
          <p>${messageCount.toLocaleString()} texts</p>
        </div>
      </div>
      <div class="contact-count">${messageCount.toLocaleString()}</div>
    `;
    
    // Add click handler
    contactElement.addEventListener('click', () => {
      showContactDetail({
        handles: contact.handles || [contact.contact],
        displayName: displayName,
        imageData: contactPhoto,
        messages: messageCount
      });
    });
    
    // Stagger animation
    contactElement.style.opacity = '0';
    contactElement.style.transform = 'translateX(-20px)';
    
    setTimeout(() => {
      contactElement.style.transition = 'all 0.4s ease';
      contactElement.style.opacity = '1';
      contactElement.style.transform = 'translateX(0)';
    }, i * 50);
    
    container.appendChild(contactElement);
  });
  
  // Update count
  window.currentContactsShown = newCount;
  
  // Update or hide button
  if (newCount < window.allTopContacts.length) {
    loadMoreBtn.querySelector('span').textContent = 'Load More';
  } else {
    loadMoreBtn.style.display = 'none';
  }
}

// Helper function to get initials from name
function getInitials(name) {
  if (!name) return '?';
  const parts = name.split(' ').filter(p => p.length > 0);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  } else if (parts.length === 1) {
    return parts[0][0].toUpperCase();
  }
  return name[0].toUpperCase();
}

// Helper function to format phone numbers
function formatPhoneNumber(phone) {
  if (!phone) return '';
  
  // If it's an email, return as-is
  if (phone.includes('@')) {
    return phone;
  }
  
  // Clean the phone number (remove all non-digits)
  const cleaned = phone.replace(/\D/g, '');
  
  // Format based on length
  if (cleaned.length === 11 && cleaned[0] === '1') {
    // US number with country code: 1 (234) 567-8901
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  } else if (cleaned.length === 10) {
    // US number without country code: (234) 567-8901
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  } else if (cleaned.length > 10) {
    // International number
    const countryCode = cleaned.slice(0, cleaned.length - 10);
    const number = cleaned.slice(-10);
    return `+${countryCode} (${number.slice(0, 3)}) ${number.slice(3, 6)}-${number.slice(6)}`;
  }
  
  // If it doesn't match any pattern, return original
  return phone;
}

// ============================================
// YEAR FILTERING
// ============================================

// Populate year selectors with available years
async function populateYearSelectors() {
  try {
    const result = await window.electronAPI.getAvailableYears();
    
    if (result.success && result.years) {
      availableYears = result.years;
      
      // Populate dashboard year selector
      topContactsYearSelector.innerHTML = '<option value="">All Time</option>';
      result.years.forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        topContactsYearSelector.appendChild(option);
      });
      
      console.log(`✅ Loaded ${result.years.length} years for filtering`);
    }
  } catch (error) {
    console.error('Error loading available years:', error);
  }
}

// Handle year change for top contacts
async function handleTopContactsYearChange(year) {
  try {
    let topContactsData;
    
    if (year) {
      // Get contacts for specific year
      console.log(`📅 Loading top contacts for ${year}`);
      const result = await window.electronAPI.getTopContactsByYear(year);
      if (result.success) {
        topContactsData = result.contacts;
      } else {
        console.error('Failed to load contacts for year:', result.error);
        return;
      }
    } else {
      // Get all-time contacts
      console.log('📅 Loading all-time top contacts');
      topContactsData = userData.topContacts;
    }
    
    // Re-render contacts
    await renderTopContacts(topContactsData);
  } catch (error) {
    console.error('Error changing year:', error);
  }
}

// Handle year change for contact detail view
async function handleContactDetailYearChange(year) {
  if (!currentContactHandle) return;
  
  try {
    console.log(`📅 Loading contact stats${year ? ` for ${year}` : ' for all time'}`);
    const result = await window.electronAPI.getContactStats(currentContactHandle, year || null);
    
    if (result.success && result.stats) {
      // Get contact info from current view
      const displayName = document.getElementById('detailContactName').textContent;
      loadContactDetailStats(result.stats, result.words, result.emojis, displayName);
      
      // Load reactions
      await loadContactReactions(currentContactHandle, displayName);
    } else {
      console.error('Failed to load contact stats:', result.error);
    }
  } catch (error) {
    console.error('Error changing contact detail year:', error);
  }
}

// ============================================
// CONTACT DETAIL VIEW
// ============================================

// Show contact detail view
async function showContactDetail(contact) {
  console.log('📱 Showing detail for contact:', contact);
  
  // Store current contact handles (can be multiple for consolidated contacts)
  currentContactHandle = contact.handles || [contact.handle];
  
  // Hide dashboard, show detail
  dashboardContainer.style.display = 'none';
  contactDetailContainer.style.display = 'block';
  
  // Populate year selector for this contact
  contactDetailYearSelector.innerHTML = '<option value="">All Time</option>';
  availableYears.forEach(year => {
    const option = document.createElement('option');
    option.value = year;
    option.textContent = year;
    contactDetailYearSelector.appendChild(option);
  });
  contactDetailYearSelector.value = ''; // Reset to all time
  
  // Clear search results
  const messageSearchInput = document.getElementById('messageSearchInput');
  const searchResults = document.getElementById('searchResults');
  if (messageSearchInput) messageSearchInput.value = '';
  if (searchResults) searchResults.style.display = 'none';
  
  // Set contact header info
  const detailContactAvatar = document.getElementById('detailContactAvatar');
  const detailContactName = document.getElementById('detailContactName');
  const detailContactHandle = document.getElementById('detailContactHandle');
  const avatarContainer = document.querySelector('.detail-avatar-container');
  
  // Use contact display name or handle
  const displayName = contact.displayName || (Array.isArray(contact.handles) ? contact.handles[0] : contact.handle);
  detailContactName.textContent = displayName;
  
  // Format phone number(s) nicely - show count if multiple
  const handles = currentContactHandle;
  let formattedHandle;
  if (Array.isArray(handles) && handles.length > 1) {
    formattedHandle = `${formatPhoneNumber(handles[0])} (+${handles.length - 1} more)`;
  } else {
    formattedHandle = formatPhoneNumber(Array.isArray(handles) ? handles[0] : handles);
  }
  detailContactHandle.textContent = formattedHandle;
  
  // Clear avatar container and reset
  avatarContainer.innerHTML = '';
  
  // Set avatar
  if (contact.imageData) {
    // Create new img element
    const img = document.createElement('img');
    img.id = 'detailContactAvatar';
    img.className = 'detail-contact-avatar';
    img.alt = displayName;
    img.src = contact.imageData;
    img.onerror = () => {
      // Replace with initials on error
      avatarContainer.innerHTML = `<div class="detail-contact-avatar" style="display: flex; align-items: center; justify-content: center; background: var(--black); color: white; font-size: 48px; font-weight: 700;">${getInitials(displayName)}</div>`;
    };
    avatarContainer.appendChild(img);
  } else {
    // Use initials as fallback
    avatarContainer.innerHTML = `<div class="detail-contact-avatar" style="display: flex; align-items: center; justify-content: center; background: var(--black); color: white; font-size: 48px; font-weight: 700;">${getInitials(displayName)}</div>`;
  }
  
  // Load contact stats - if multiple handles, query them all
  try {
    let result;
    if (Array.isArray(currentContactHandle) && currentContactHandle.length > 1) {
      // Multiple handles - get combined stats
      console.log(`📊 Loading combined stats for ${currentContactHandle.length} handles`);
      result = await window.electronAPI.getContactStats(currentContactHandle);
    } else {
      // Single handle
      const singleHandle = Array.isArray(currentContactHandle) ? currentContactHandle[0] : currentContactHandle;
      result = await window.electronAPI.getContactStats(singleHandle);
    }
    
    if (result.success && result.stats) {
      loadContactDetailStats(result.stats, result.words, result.emojis, displayName);
      
      // Load reactions
      await loadContactReactions(currentContactHandle, displayName);
    } else {
      console.error('Failed to load contact stats:', result.error);
    }
  } catch (error) {
    console.error('Error loading contact details:', error);
  }
}

// Load and display contact stats
function loadContactDetailStats(stats, words, emojis, contactName) {
  // Quick stats
  document.getElementById('detailTotalMessages').textContent = stats.totalMessages.toLocaleString();
  document.getElementById('detailSentMessages').textContent = stats.sentMessages.toLocaleString();
  document.getElementById('detailReceivedMessages').textContent = stats.receivedMessages.toLocaleString();
  
  // The Numbers section
  const firstDate = stats.firstMessageDate ? 
    new Date(stats.firstMessageDate / 1000000 + new Date('2001-01-01').getTime()).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) :
    'Unknown';
  document.getElementById('detailFirstMessage').textContent = firstDate;
  document.getElementById('detailMostActiveYear').textContent = stats.mostActiveYear || '-';
  document.getElementById('detailAvgPerDay').textContent = `${stats.avgPerDay} texts/day`;
  
  // Calculate streak (placeholder for now)
  document.getElementById('detailLongestStreak').textContent = '-';
  
  // Word cloud
  const wordCloud = document.getElementById('detailWordCloud');
  wordCloud.innerHTML = '';
  
  if (words && words.length > 0) {
    words.forEach((word, index) => {
      const sizeClass = index < 3 ? 'size-1' : index < 6 ? 'size-2' : index < 10 ? 'size-3' : 'size-4';
      wordCloud.innerHTML += `<span class="word-item ${sizeClass}">${word.word}</span>`;
    });
  } else {
    wordCloud.innerHTML = '<p style="color: var(--medium-gray); text-align: center;">Not enough messages to analyze</p>';
  }
  
  // Emoji stats
  const emojiStats = document.getElementById('detailEmojiStats');
  emojiStats.innerHTML = '';
  
  if (emojis && emojis.length > 0) {
    emojis.forEach(emoji => {
      emojiStats.innerHTML += `
        <div class="emoji-item">
          <span class="emoji-char">${emoji.emoji}</span>
          <span class="emoji-count">${emoji.count}</span>
        </div>
      `;
    });
  } else {
    emojiStats.innerHTML = '<p style="color: var(--medium-gray); text-align: center; grid-column: 1 / -1;">No emojis found</p>';
  }
  
  // Messages over time chart
  createContactMessagesChart(stats.messagesByYear);
  
  // Ratio visualization
  const youPercent = Math.round((stats.sentMessages / stats.totalMessages) * 100);
  const themPercent = 100 - youPercent;
  
  document.getElementById('detailRatioYou').style.width = `${youPercent}%`;
  document.getElementById('detailRatioThem').style.width = `${themPercent}%`;
  document.getElementById('detailRatioYouPercent').textContent = `${youPercent}%`;
  document.getElementById('detailRatioThemPercent').textContent = `${themPercent}%`;
  document.getElementById('detailContactNameShort').textContent = contactName.split(' ')[0] || 'Them';
}

// Load and display reaction stats for contact
async function loadContactReactions(contactHandle, contactName) {
  try {
    // Get first handle if it's an array
    const singleHandle = Array.isArray(contactHandle) ? contactHandle[0] : contactHandle;
    const result = await window.electronAPI.getContactReactions(singleHandle);
    
    if (result.success) {
      const yourReactionsContainer = document.getElementById('yourReactions');
      const theirReactionsContainer = document.getElementById('theirReactions');
      const theirReactionsTitle = document.getElementById('theirReactionsTitle');
      
      // Update title
      theirReactionsTitle.textContent = contactName.split(' ')[0] || 'Them';
      
      // Display your reactions (always show all 6)
      yourReactionsContainer.innerHTML = '';
      if (result.yourReactions && result.yourReactions.length > 0) {
        result.yourReactions.forEach(reaction => {
          const itemClass = reaction.count === 0 ? 'reaction-item reaction-item-zero' : 'reaction-item';
          yourReactionsContainer.innerHTML += `
            <div class="${itemClass}">
              <span class="reaction-emoji">${reaction.emoji}</span>
              <span class="reaction-count">${reaction.count.toLocaleString()}</span>
            </div>
          `;
        });
      } else {
        yourReactionsContainer.innerHTML = '<div class="reactions-empty">No reactions yet</div>';
      }
      
      // Display their reactions (always show all 6)
      theirReactionsContainer.innerHTML = '';
      if (result.theirReactions && result.theirReactions.length > 0) {
        result.theirReactions.forEach(reaction => {
          const itemClass = reaction.count === 0 ? 'reaction-item reaction-item-zero' : 'reaction-item';
          theirReactionsContainer.innerHTML += `
            <div class="${itemClass}">
              <span class="reaction-emoji">${reaction.emoji}</span>
              <span class="reaction-count">${reaction.count.toLocaleString()}</span>
            </div>
          `;
        });
      } else {
        theirReactionsContainer.innerHTML = '<div class="reactions-empty">No reactions yet</div>';
      }
    } else {
      console.error('Failed to load reactions:', result.error);
    }
  } catch (error) {
    console.error('Error loading contact reactions:', error);
  }
}

// Create messages over time chart for contact
function createContactMessagesChart(messagesByYear) {
  const canvas = document.getElementById('detailMessagesChart');
  const ctx = canvas.getContext('2d');
  
  // Destroy existing chart if any
  if (charts.contactDetail) {
    charts.contactDetail.destroy();
  }
  
  // Prepare data
  const years = messagesByYear.map(row => row.year);
  const counts = messagesByYear.map(row => row.count);
  
  charts.contactDetail = new Chart(ctx, {
    type: 'line',
    data: {
      labels: years,
      datasets: [{
        label: 'Messages',
        data: counts,
        borderColor: '#1a1a1a',
        backgroundColor: 'rgba(26, 26, 26, 0.1)',
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointRadius: 5,
        pointBackgroundColor: '#1a1a1a',
        pointBorderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(0, 0, 0, 0.05)'
          }
        },
        x: {
          grid: {
            display: false
          }
        }
      }
    }
  });
}

// ============================================
// MESSAGE SEARCH
// ============================================

// Handle message search
async function handleMessageSearch() {
  const searchInput = document.getElementById('messageSearchInput');
  const searchResults = document.getElementById('searchResults');
  const searchResultCount = document.getElementById('searchResultCount');
  const searchExamples = document.getElementById('searchExamples');
  
  const searchTerm = searchInput.value.trim();
  
  if (!searchTerm) {
    searchResults.style.display = 'none';
    return;
  }
  
  if (!currentContactHandle) {
    console.error('No contact handle available for search');
    return;
  }
  
  try {
    console.log(`🔍 Searching for "${searchTerm}"`);
    
    const result = await window.electronAPI.searchContactMessages(currentContactHandle, searchTerm);
    
    if (result.success) {
      // Show results
      searchResults.style.display = 'block';
      searchResultCount.textContent = result.count;
      
      // Clear previous examples
      searchExamples.innerHTML = '';
      
      if (result.count === 0) {
        searchExamples.innerHTML = '<div class="search-no-results">No messages found containing "' + searchTerm + '"</div>';
      } else {
        // Display example messages
        result.examples.forEach(msg => {
          const messageEl = document.createElement('div');
          messageEl.className = 'message-example';
          
          // Highlight the search term in the message text
          const highlightedText = msg.text.replace(
            new RegExp(`(${escapeRegExp(searchTerm)})`, 'gi'),
            '<span class="highlight">$1</span>'
          );
          
          messageEl.innerHTML = `
            <div class="message-header">
              <span class="message-sender ${msg.isFromMe ? 'from-me' : 'from-them'}">
                ${msg.isFromMe ? 'You' : 'Them'}
              </span>
              <span class="message-date">${msg.formattedDate}</span>
            </div>
            <div class="message-text">${highlightedText}</div>
          `;
          
          searchExamples.appendChild(messageEl);
        });
      }
    } else {
      console.error('Search failed:', result.error);
    }
  } catch (error) {
    console.error('Error searching messages:', error);
  }
}

// Helper function to escape special regex characters
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Start the app
init();