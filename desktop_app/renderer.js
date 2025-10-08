// Suppress browser console warnings about corrupt image data
// These are handled gracefully with onerror fallbacks to initials
const originalConsoleError = console.error;
console.error = function(...args) {
  const errorMsg = args.join(' ');
  // Suppress corrupt JPEG/image warnings - we handle these with onerror
  if (errorMsg.includes('Corrupt JPEG') ||
      errorMsg.includes('Corrupt PNG') ||
      errorMsg.includes('premature end of data')) {
    return;
  }
  originalConsoleError.apply(console, args);
};

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

// Track current selected year for dashboard
let currentDashboardYear = '';

// Track message search state
let currentSearchTerm = '';
let currentSearchOffset = 0;
let totalSearchResults = 0;
const SEARCH_PAGE_SIZE = 10;

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
  try {
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
        // Set fallback version
        const versionTag = document.getElementById('versionTag');
        if (versionTag) {
          versionTag.textContent = 'v0.1.10';
        }
      }
    }
    
    // Setup auto-update listeners
    setupUpdateListeners();
    
    // Hide app loading screen after everything is initialized
    const appLoading = document.getElementById('appLoading');
    if (appLoading) {
      // Small delay to ensure smooth transition
      setTimeout(() => {
        appLoading.classList.add('hidden');
      }, 300);
    }
  } catch (error) {
    console.error('Error during initialization:', error);
    // Hide loading screen even on error
    const appLoading = document.getElementById('appLoading');
    if (appLoading) {
      appLoading.classList.add('hidden');
    }
  }
}

// Setup auto-update listeners
function setupUpdateListeners() {
  if (!window.electronAPI) return;
  
  // When update is available
  window.electronAPI.onUpdateAvailable((version) => {
    updateVersion.textContent = `🚀 v${version} available!`;
    updateNotification.style.display = 'block';
    updateNowBtn.style.display = 'block';
  });
  
  // Update download progress (hidden for unsigned builds)
  window.electronAPI.onUpdateProgress((percent) => {
    // Progress tracking not shown since manual download is required
  });
  
  // When update is downloaded
  window.electronAPI.onUpdateDownloaded(() => {
    // Already showing button from onUpdateAvailable
  });
  
  // Update now button
  updateNowBtn.addEventListener('click', async () => {
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
    
    
    try {
      const text = await file.text();
      
      const contacts = parseVCard(text);
      
      if (contacts.length === 0) {
        alert('No contacts found in file. Please make sure you exported contacts as vCard format.');
        return;
      }
      
      // Store contacts in localStorage
      localStorage.setItem('remess_contacts', JSON.stringify(contacts));
      
      // Save contacts to CSV file
      const saveResult = await window.electronAPI.saveContacts(contacts);
      if (saveResult.success) {
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
    currentDashboardYear = year; // Store the selected year
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
  
  const loadMoreMessagesBtn = document.getElementById('loadMoreMessagesBtn');
  loadMoreMessagesBtn.addEventListener('click', handleLoadMoreMessages);
  
  // Filter button event listeners
  const filterBtns = document.querySelectorAll('.filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', handleFilterButtonClick);
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
        isAuthenticated = true;
      } else {
        // Tokens expired, clear them
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
      
      
      if (result.success) {
        // Get user data from Auth0 result
        const authUser = result.data.user; // The user object from auth-auth0.js
        const tokens = result.data.tokens; // The tokens from Auth0
        
        userData = {
          name: authUser?.name || authUser?.email || 'User',
          email: authUser?.email || 'user@example.com',
          avatar: authUser?.avatar || authUser?.picture || null
        };
        isAuthenticated = true;
        
        
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
    const emails = [];
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
      else if (line.includes('EMAIL')) {
        const emailMatch = line.match(/:(.+)$/);
        if (emailMatch) {
          const email = emailMatch[1].trim();
          emails.push(email);
        }
      }
      else if (line.startsWith('PHOTO;') || line.startsWith('PHOTO:')) {
        // Start collecting photo data
        isCollectingPhoto = true;

        // Extract format from PHOTO field (e.g., PHOTO;ENCODING=BASE64;JPEG: or PHOTO;TYPE=JPEG:)
        let photoFormat = 'jpeg'; // default
        if (line.includes('PNG') || line.includes('png')) {
          photoFormat = 'png';
        } else if (line.includes('GIF') || line.includes('gif')) {
          photoFormat = 'gif';
        } else if (line.includes('WEBP') || line.includes('webp')) {
          photoFormat = 'webp';
        }

        const colonIndex = line.indexOf(':');
        if (colonIndex > -1) {
          photoData = line.substring(colonIndex + 1).trim();
          // Store format with the data
          if (!photo) photo = {};
          photo.format = photoFormat;
        }
      }
      else if (isCollectingPhoto) {
        // Continue collecting photo data (base64 can span multiple lines)
        if (line.startsWith('END:VCARD') || line.includes(':')) {
          // Stop collecting if we hit another field
          isCollectingPhoto = false;
          if (photoData && photo && photo.format) {
            photo.data = photoData;
          } else if (photoData) {
            // Fallback if no format was detected
            photo = { data: photoData, format: 'jpeg' };
          }
        } else {
          photoData += line.trim();
        }
      }
    }

    // Finalize photo if we were still collecting
    if (isCollectingPhoto && photoData) {
      if (photo && photo.format) {
        photo.data = photoData;
      } else {
        photo = { data: photoData, format: 'jpeg' };
      }
    }

    // Create separate contact entries for each phone/email
    if (name && (phones.length > 0 || emails.length > 0)) {
      // Combine all phones and emails as separate entries
      const allHandles = [...phones, ...emails];

      allHandles.forEach(handle => {
        // Convert photo to data URL with proper format
        let photoUrl = null;
        if (photo && photo.data) {
          try {
            // Clean the base64 data (remove any whitespace/newlines)
            let cleanedData = photo.data.replace(/\s/g, '');

            // Validate it's not empty and has valid base64 characters
            if (cleanedData.length > 0) {
              const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
              if (base64Regex.test(cleanedData)) {
                // Ensure proper padding
                const paddingNeeded = (4 - (cleanedData.length % 4)) % 4;
                cleanedData += '='.repeat(paddingNeeded);

                // Just verify it can be decoded, but allow partial/incomplete images
                try {
                  const binaryString = atob(cleanedData);

                  // Only check for valid start signature - don't reject incomplete images
                  const hasValidStart =
                    binaryString.startsWith('\xFF\xD8\xFF') || // JPEG start
                    binaryString.startsWith('\x89PNG') || // PNG start (relaxed check)
                    binaryString.startsWith('GIF87a') ||
                    binaryString.startsWith('GIF89a') ||
                    binaryString.startsWith('RIFF');

                  if (hasValidStart) {
                    // Let the browser try to render it, even if incomplete
                    // The onerror handler will catch truly unrenderable images
                    photoUrl = `data:image/${photo.format};base64,${cleanedData}`;
                  }
                } catch (decodeError) {
                  // Can't decode at all - skip this image
                  photoUrl = null;
                }
              }
            }
          } catch (e) {
            photoUrl = null;
          }
        }

        contacts.push({ name, phone: handle, photo: photoUrl });
      });
    }
  }

  return contacts;
}

// Load real data from database
async function loadRealData() {
  try {
    
    // Fetch stats from database
    const result = await window.electronAPI.getStats();
    
    if (result.success && result.stats) {
      
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
      
      // Check CSV version and clear old contacts if needed
      const CSV_VERSION = '0.1.10';
      const storedVersion = localStorage.getItem('remess_csv_version');

      // Preload contacts data before showing any UI
      let importedContacts = JSON.parse(localStorage.getItem('remess_contacts') || '[]');
      const hadContactsBefore = importedContacts.length > 0;

      // Clear contacts if version mismatch
      if (storedVersion !== CSV_VERSION) {
        console.log('CSV schema updated - clearing old contacts');
        importedContacts = [];
        localStorage.removeItem('remess_contacts');
        localStorage.setItem('remess_csv_version', CSV_VERSION);

        // Show minimalistic update notice ONLY if they had contacts before (old version users)
        if (storedVersion && hadContactsBefore) {
          setTimeout(() => {
            const notice = document.createElement('div');
            notice.style.cssText = `
              position: fixed;
              bottom: 20px;
              right: 20px;
              background: var(--black);
              color: white;
              padding: 16px 20px;
              border-radius: 12px;
              font-size: 14px;
              z-index: 10000;
              box-shadow: 0 4px 12px rgba(0,0,0,0.15);
              max-width: 300px;
              cursor: pointer;
            `;
            notice.innerHTML = `
              <strong>Update v0.1.10</strong><br>
              Please re-import contacts for email support<br>
              <span style="color: var(--blue); text-decoration: underline; margin-top: 8px; display: inline-block;">Install Now</span>
            `;
            notice.onclick = () => {
              window.electronAPI.openExternal('https://remess.me');
            };
            document.body.appendChild(notice);

            // Auto-dismiss after 5 seconds
            setTimeout(() => {
              notice.style.transition = 'opacity 0.3s';
              notice.style.opacity = '0';
              setTimeout(() => notice.remove(), 300);
            }, 5000);
          }, 1000);
        }
      }

      if (importedContacts.length === 0) {
        const loadResult = await window.electronAPI.loadContacts();
        if (loadResult.success && loadResult.contacts.length > 0) {
          importedContacts = loadResult.contacts;
          localStorage.setItem('remess_contacts', JSON.stringify(importedContacts));
        }
      }

      // Store contacts globally so they're ready
      window.remessContacts = importedContacts;
      
      // Small delay to ensure everything is ready
      await new Promise(resolve => setTimeout(resolve, 300));
      
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
  refreshBtn.title = 'Refreshing...';
  
  try {
    // Re-clone the database (now skips contacts, should be fast)
    const cloneResult = await window.electronAPI.cloneDatabase();
    
    if (!cloneResult.success) {
      throw new Error(cloneResult.error || 'Failed to clone database');
    }
    
    // Reload all data
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
      
      // Reload available years
      await populateYearSelectors();
      
      // Refresh the dashboard display
      await loadDashboardData();

      // Show success feedback
      refreshBtn.title = 'Refreshed!';
      setTimeout(() => {
        refreshBtn.title = 'Refresh data from iMessage';
      }, 2000);

    } else {
      throw new Error('Failed to load stats');
    }
    
  } catch (error) {
    console.error('Error refreshing data:', error);
    alert('Failed to refresh data. Please try again.');
    refreshBtn.title = 'Refresh data from iMessage';
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
  updateWrappedProgress();
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
  
  // Helper function to match contact handle with imported contacts
  function findContactMatch(handle, importedContacts) {
    if (!handle || importedContacts.length === 0) return null;

    // Check if it's an email
    if (handle.includes('@')) {
      // For emails, match exactly in phone field (since emails are stored there)
      return importedContacts.find(c =>
        c.phone && c.phone.toLowerCase() === handle.toLowerCase()
      );
    } else {
      // For phone numbers, match by last 10 digits
      const cleaned = handle.replace(/\D/g, '');
      if (cleaned.length < 10) return null; // Invalid phone number

      return importedContacts.find(c => {
        // Skip email entries when matching phone numbers
        if (c.phone.includes('@')) return false;

        const contactCleaned = c.phone.replace(/\D/g, '');
        if (contactCleaned.length < 10) return false;

        return contactCleaned.endsWith(cleaned.slice(-10)) || cleaned.endsWith(contactCleaned.slice(-10));
      });
    }
  }

  // Helper function to get display name and photo for a contact
  function getContactInfo(contact) {
    let displayName = contact.displayName || contact.name || contact.contact || 'Unknown';
    let contactPhoto = null;

    // Try to match with imported contacts
    const match = findContactMatch(contact.contact, importedContacts);

    if (match) {
      displayName = match.name;
      contactPhoto = match.photo || null;
    }

    return { displayName, contactPhoto };
  }

  // Consolidate contacts by display name to combine phone + email
  const matchedContacts = topContacts.map(contact => {
    const { displayName, contactPhoto } = getContactInfo(contact);
    return {
      ...contact,
      displayName,
      contactPhoto,
      messageCount: contact.message_count || contact.messages || 0
    };
  });

  const consolidatedMap = new Map();
  matchedContacts.forEach(contact => {
    const key = contact.displayName.toLowerCase();

    if (consolidatedMap.has(key)) {
      // Add to existing contact's message count
      const existing = consolidatedMap.get(key);
      existing.messageCount += contact.messageCount;
    } else {
      // First occurrence of this contact
      consolidatedMap.set(key, contact);
    }
  });

  // Convert back to array and sort by message count
  const consolidatedContacts = Array.from(consolidatedMap.values())
    .sort((a, b) => b.messageCount - a.messageCount);

  // Update wrapped stats
  document.getElementById('wrappedTotalMessages').textContent =
    stats.totalMessages.toLocaleString();
  document.getElementById('wrappedAvgMessages').textContent =
    (stats.avgMessagesPerDay || stats.avgPerDay).toLocaleString();
  document.getElementById('wrappedTotalContacts').textContent =
    consolidatedContacts.length.toLocaleString();
  document.getElementById('wrappedMostActiveYear').textContent =
    stats.mostActiveYear;
  document.getElementById('wrappedYearCount').textContent =
    stats.mostActiveYearCount.toLocaleString();

  // Top contact (after consolidation)
  const topContact = consolidatedContacts[0];
  const displayName = topContact.displayName;
  const contactPhoto = topContact.contactPhoto;
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
    topContact.messageCount.toLocaleString();
}

// Navigate slides
function navigateSlide(direction) {
  const newSlide = currentSlide + direction;
  
  if (newSlide >= 0 && newSlide < totalSlides) {
    currentSlide = newSlide;
    updateSlides();
    updateWrappedProgress();
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

// Update wrapped progress bar
function updateWrappedProgress() {
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
  
  // Restore the year selector value
  if (topContactsYearSelector) {
    topContactsYearSelector.value = currentDashboardYear;
  }
  
  // Update user info from Auth0 - always show name and avatar
  const displayName = userData?.name || userData?.email || 'User';
  userName.textContent = displayName;
  
  // Set Auth0 profile picture
  if (userData?.avatar) {
    userAvatar.src = userData.avatar;
    userAvatar.style.display = 'block';
    userAvatar.style.objectFit = 'cover';
    userAvatar.onerror = function() {
      // Fallback: hide image and show initials in CSS
      this.style.display = 'none';
    };
  } else {
    // No avatar provided
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
  
  document.getElementById('mostActiveYear').textContent = stats.mostActiveYear;
  document.getElementById('mostActiveYearCount').textContent = 
    `${stats.mostActiveYearCount.toLocaleString()} texts`;
  
  // Create charts with real data
  setTimeout(async () => {
    createMessagesOverTimeChart(messagesByYear);

    // Check if we need to apply a year filter
    if (currentDashboardYear) {
      // Apply the year filter that was previously selected
      await handleTopContactsYearChange(currentDashboardYear);
    } else {
      // Show all contacts
      await renderTopContacts(topContacts);
    }

    // Load dashboard word cloud
    loadDashboardWords();
  }, 500);
}

// Load dashboard word cloud
async function loadDashboardWords() {
  try {
    const result = await window.electronAPI.getAllWords(30);
    
    if (result.success && result.words) {
      const wordCloud = document.getElementById('dashboardWordCloud');
      wordCloud.innerHTML = '';
      
      if (result.words.length > 0) {
        result.words.forEach((word, index) => {
          const sizeClass = index < 3 ? 'size-1' : index < 6 ? 'size-2' : index < 10 ? 'size-3' : 'size-4';
          wordCloud.innerHTML += `<span class="word-item ${sizeClass}">${word.word}</span>`;
        });
      } else {
        wordCloud.innerHTML = '<p style="color: var(--medium-gray); text-align: center;">Not enough messages to analyze</p>';
      }
    }
  } catch (error) {
    console.error('Error loading dashboard words:', error);
  }
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
          
          // Update the year selector for top contacts
          const yearSelector = document.getElementById('topContactsYearSelector');
          if (yearSelector) {
            yearSelector.value = clickedYear;
            currentDashboardYear = clickedYear; // Store the selected year
            // Trigger the change event to update the contacts list
            handleTopContactsYearChange(clickedYear);
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
  
  
  // Load imported contacts from localStorage or CSV
  let importedContacts = JSON.parse(localStorage.getItem('remess_contacts') || '[]');
  
  // If not in localStorage, try loading from CSV
  if (importedContacts.length === 0) {
    const loadResult = await window.electronAPI.loadContacts();
    if (loadResult.success && loadResult.contacts.length > 0) {
      importedContacts = loadResult.contacts;
      // Store in localStorage for faster access
      localStorage.setItem('remess_contacts', JSON.stringify(importedContacts));
    }
  }
  
  
  // Helper function to match contact handle with imported contacts
  function findContactMatch(handle, importedContacts) {
    if (!handle || importedContacts.length === 0) return null;

    // Check if it's an email
    if (handle.includes('@')) {
      // For emails, match exactly in phone field (since emails are stored there)
      return importedContacts.find(c =>
        c.phone && c.phone.toLowerCase() === handle.toLowerCase()
      );
    } else {
      // For phone numbers, match by last 10 digits
      const cleaned = handle.replace(/\D/g, '');
      if (cleaned.length < 10) return null; // Invalid phone number

      return importedContacts.find(c => {
        // Skip email entries when matching phone numbers
        if (c.phone.includes('@')) return false;

        const contactCleaned = c.phone.replace(/\D/g, '');
        if (contactCleaned.length < 10) return false;

        return contactCleaned.endsWith(cleaned.slice(-10)) || cleaned.endsWith(contactCleaned.slice(-10));
      });
    }
  }

  // First pass: match contacts to names
  const matchedContacts = contacts.map((contact, index) => {
    let displayName = contact.displayName || contact.name || `Contact #${index + 1}`;
    let contactPhoto = null;

    // Try to match with imported contacts
    const match = findContactMatch(contact.contact, importedContacts);

    if (match) {
      displayName = match.name;
      contactPhoto = match.photo || null;
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
  
  
  // Store all contacts globally for "Load More" functionality
  window.allTopContacts = allConsolidatedContacts;
  
  // Use previous count if it exists, otherwise start with 10
  if (window.currentContactsShown === undefined || window.currentContactsShown > allConsolidatedContacts.length) {
    window.currentContactsShown = Math.min(10, allConsolidatedContacts.length);
  } else {
    window.currentContactsShown = Math.min(window.currentContactsShown, allConsolidatedContacts.length);
  }
  
  // Show contacts up to current count
  const contactsToShow = allConsolidatedContacts.slice(0, window.currentContactsShown);

  // Track image loading promises
  const imageLoadPromises = [];

  // Now render the contacts
  contactsToShow.forEach((contact, index) => {
    const displayName = contact.displayName;
    const contactPhoto = contact.contactPhoto;
    const messageCount = contact.messageCount;

    const contactElement = document.createElement('div');
    contactElement.className = 'contact-item';

    // Generate profile picture HTML
    const initials = getInitials(displayName);
    let avatarHTML = '';
    let imagePromise = null;

    if (contactPhoto) {
      // Preload image before rendering
      imagePromise = new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => resolve(); // Resolve even on error so we don't block
        img.src = contactPhoto;
      });
      imageLoadPromises.push(imagePromise);
      avatarHTML = `<img src="${contactPhoto}" alt="${displayName}" class="contact-avatar" onerror="this.parentElement.innerHTML='<div class=\\'contact-avatar-placeholder\\'>${initials}</div>';">`;
    } else if (contact.imageData) {
      // Convert Buffer to base64 data URL
      try {
        const base64 = btoa(
          new Uint8Array(contact.imageData).reduce((data, byte) => data + String.fromCharCode(byte), '')
        );
        const dataUrl = `data:image/jpeg;base64,${base64}`;
        // Preload image before rendering
        imagePromise = new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = dataUrl;
        });
        imageLoadPromises.push(imagePromise);
        avatarHTML = `<img src="${dataUrl}" alt="${displayName}" class="contact-avatar" onerror="this.parentElement.innerHTML='<div class=\\'contact-avatar-placeholder\\'>${initials}</div>';">`;
      } catch (e) {
        // If conversion fails, use initials
        avatarHTML = `<div class="contact-avatar-placeholder">${initials}</div>`;
      }
    } else {
      // Use initials as fallback
      avatarHTML = `<div class="contact-avatar-placeholder">${initials}</div>`;
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

  // Wait for all images to load before returning
  await Promise.all(imageLoadPromises);
  
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
  // Check if we're in groups view or DMs view
  const activeFilter = document.querySelector('.filter-button-group .filter-btn.active[data-filter-type="chat-type"]');
  const isGroupsView = activeFilter && activeFilter.dataset.filter === 'groups';
  
  if (isGroupsView) {
    // Load more group chats
    if (!window.allTopGroupChats) return;
    
    const container = document.getElementById('topContactsList');
    const loadMoreBtn = document.getElementById('loadMoreContactsBtn');
    
    // Load 10 more group chats
    const currentCount = window.currentGroupChatsShown;
    const newCount = Math.min(currentCount + 10, window.allTopGroupChats.length);
    const newGroupChats = window.allTopGroupChats.slice(currentCount, newCount);
    
    // Render new group chats
    newGroupChats.forEach((groupChat, i) => {
      const index = currentCount + i;
      const groupElement = document.createElement('div');
      groupElement.className = 'contact-item';
      
      // Use initials if available, otherwise generic group icon
      let avatarHTML;
      if (groupChat.avatarInitials) {
        avatarHTML = `<div class="contact-avatar-placeholder group-chat-avatar">${groupChat.avatarInitials}</div>`;
      } else {
        avatarHTML = `<div class="contact-avatar-placeholder group-chat-avatar">👥</div>`;
      }
      
      groupElement.innerHTML = `
        <div class="contact-left">
          <div class="contact-rank">${index + 1}</div>
          ${avatarHTML}
          <div class="contact-info-item">
            <h4>${groupChat.displayName}</h4>
            <p>${groupChat.messageCount.toLocaleString()} texts · ${groupChat.participantCount} people</p>
          </div>
        </div>
        <div class="contact-count">${groupChat.messageCount.toLocaleString()}</div>
      `;
      
      // Add click handler to show group chat detail
      groupElement.addEventListener('click', () => {
        showGroupChatDetail(groupChat);
      });
      
      // Stagger animation
      groupElement.style.opacity = '0';
      groupElement.style.transform = 'translateX(-20px)';
      
      setTimeout(() => {
        groupElement.style.transition = 'all 0.4s ease';
        groupElement.style.opacity = '1';
        groupElement.style.transform = 'translateX(0)';
      }, i * 100);
      
      container.appendChild(groupElement);
    });
    
    // Update count
    window.currentGroupChatsShown = newCount;
    
    // Update or hide button
    if (newCount < window.allTopGroupChats.length) {
      loadMoreBtn.querySelector('span').textContent = 'Load More';
    } else {
      loadMoreBtn.style.display = 'none';
    }
    
    return;
  }
  
  // Load more DM contacts
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
    const initials = getInitials(displayName);
    if (contactPhoto) {
      avatarHTML = `<img src="${contactPhoto}" alt="${displayName}" class="contact-avatar" onerror="this.parentElement.innerHTML='<div class=\\'contact-avatar-placeholder\\'>${initials}</div>';">`;
    } else if (contact.imageData) {
      try {
        const base64 = btoa(
          new Uint8Array(contact.imageData).reduce((data, byte) => data + String.fromCharCode(byte), '')
        );
        avatarHTML = `<img src="data:image/jpeg;base64,${base64}" alt="${displayName}" class="contact-avatar" onerror="this.parentElement.innerHTML='<div class=\\'contact-avatar-placeholder\\'>${initials}</div>';">`;
      } catch (e) {
        avatarHTML = `<div class="contact-avatar-placeholder">${initials}</div>`;
      }
    } else {
      avatarHTML = `<div class="contact-avatar-placeholder">${initials}</div>`;
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
// GROUP CHATS
// ============================================

// Handle chat type change (DMs vs Groups)
async function handleChatTypeChange(chatType) {
  // Show loading indicator
  const container = document.getElementById('topContactsList');
  const loadMoreBtn = document.getElementById('loadMoreContactsBtn');

  // Create loading overlay
  const loadingOverlay = document.createElement('div');
  loadingOverlay.style.cssText = `
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 10;
  `;
  loadingOverlay.innerHTML = `
    <img src="icon.png" alt="Loading" style="width: 60px; height: 60px; animation: bounce 2s ease-in-out infinite;">
  `;

  // Fade out current content
  container.style.opacity = '0.3';
  container.style.transition = 'opacity 0.2s ease';
  container.style.position = 'relative';
  container.appendChild(loadingOverlay);
  loadMoreBtn.style.display = 'none';

  // Update title and subtitle
  const title = document.getElementById('topPeopleTitle');
  const subtitle = document.getElementById('topPeopleSubtitle');
  const yearSelector = document.getElementById('topContactsYearSelector');

  try {
    if (chatType === 'groups') {
      title.textContent = 'Your Top Group Chats';
      subtitle.textContent = 'The groups you text in most';

      // Get current year filter
      const year = yearSelector.value;

      // Load group chats
      let result;
      if (year) {
        result = await window.electronAPI.getTopGroupChatsByYear(year);
      } else {
        result = await window.electronAPI.getTopGroupChats();
      }

      if (result.success) {
        await renderGroupChats(result.groupChats);
      }
    } else {
      // DMs
      title.textContent = 'Your Top People';
      subtitle.textContent = 'Who you text the most';

      // Reload contacts
      const year = yearSelector.value;
      if (year) {
        await handleTopContactsYearChange(year);
      } else {
        await renderTopContacts(userData.topContacts);
      }
    }
  } catch (error) {
    console.error('Error changing chat type:', error);
  } finally {
    // Remove loading overlay and restore opacity
    if (loadingOverlay.parentElement) {
      loadingOverlay.remove();
    }
    container.style.opacity = '1';
  }
}

// Render group chats
async function renderGroupChats(groupChatsData) {
  const container = document.getElementById('topContactsList');
  container.innerHTML = '';
  
  if (!groupChatsData || groupChatsData.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: var(--medium-gray); padding: 40px;">No group chats found</p>';
    document.getElementById('loadMoreContactsBtn').style.display = 'none';
    return;
  }
  
  // Load imported contacts for name/photo matching
  let importedContacts = JSON.parse(localStorage.getItem('remess_contacts') || '[]');
  if (importedContacts.length === 0) {
    const loadResult = await window.electronAPI.loadContacts();
    if (loadResult.success && loadResult.contacts.length > 0) {
      importedContacts = loadResult.contacts;
      localStorage.setItem('remess_contacts', JSON.stringify(importedContacts));
    }
  }
  
  // Enhance group chats with participant names and initials
  const enhancedGroupChats = groupChatsData.map(groupChat => {
    let displayName = groupChat.displayName;
    let avatarInitials = null;
    
    // If there's already a display name, use it for initials
    if (displayName) {
      const words = displayName.split(' ').filter(w => w.length > 0);
      if (words.length > 0) {
        const initialsCount = Math.min(2, words.length);
        avatarInitials = words.slice(0, initialsCount)
          .map(word => word.charAt(0).toUpperCase())
          .join('');
      }
    } else if (groupChat.participantHandles && groupChat.participantHandles.length > 0) {
      // If no display name, build one from participant handles
      const participantNames = [];
      
      // Helper function to match contact handle with imported contacts
      function findContactMatch(handle, importedContacts) {
        if (!handle || importedContacts.length === 0) return null;

        // Check if it's an email
        if (handle.includes('@')) {
          // For emails, match exactly in phone field (since emails are stored there)
          return importedContacts.find(c =>
            c.phone && c.phone.toLowerCase() === handle.toLowerCase()
          );
        } else {
          // For phone numbers, match by last 10 digits
          const cleaned = handle.replace(/\D/g, '');
          if (cleaned.length < 10) return null; // Invalid phone number

          return importedContacts.find(c => {
            // Skip email entries when matching phone numbers
            if (c.phone.includes('@')) return false;

            const contactCleaned = c.phone.replace(/\D/g, '');
            if (contactCleaned.length < 10) return false;

            return contactCleaned.endsWith(cleaned.slice(-10)) || cleaned.endsWith(contactCleaned.slice(-10));
          });
        }
      }

      // Try to match each handle to a contact
      for (const handle of groupChat.participantHandles.slice(0, 3)) {
        const match = findContactMatch(handle, importedContacts);

        if (match) {
          participantNames.push(match.name.split(' ')[0]); // First name only
        } else {
          // Fallback to formatted number/email
          if (handle.includes('@')) {
            participantNames.push(handle.split('@')[0]);
          } else {
            participantNames.push(formatPhoneNumber(handle));
          }
        }
      }
      
      // Build display name from participants
      if (participantNames.length > 0) {
        displayName = participantNames.join(', ');
        if (groupChat.participantCount > 3) {
          displayName += ` +${groupChat.participantCount - 3}`;
        }
        
        // Create initials from first 2 participants
        const initialsCount = Math.min(2, participantNames.length);
        avatarInitials = participantNames.slice(0, initialsCount)
          .map(name => name.charAt(0).toUpperCase())
          .join('');
      } else {
        displayName = 'Unnamed Group';
      }
    }
    
    return {
      ...groupChat,
      displayName,
      avatarInitials
    };
  });
  
  // Store enhanced group chats globally for "Load More" functionality
  window.allTopGroupChats = enhancedGroupChats;
  
  // Use previous count if it exists, otherwise start with 10
  if (window.currentGroupChatsShown === undefined || window.currentGroupChatsShown > enhancedGroupChats.length) {
    window.currentGroupChatsShown = Math.min(10, enhancedGroupChats.length);
  } else {
    window.currentGroupChatsShown = Math.min(window.currentGroupChatsShown, enhancedGroupChats.length);
  }
  
  // Show group chats up to current count
  const groupChatsToShow = enhancedGroupChats.slice(0, window.currentGroupChatsShown);
  
  groupChatsToShow.forEach((groupChat, index) => {
    const groupElement = document.createElement('div');
    groupElement.className = 'contact-item';
    
    // Use initials if available, otherwise generic group icon
    let avatarHTML;
    if (groupChat.avatarInitials) {
      avatarHTML = `<div class="contact-avatar-placeholder group-chat-avatar">${groupChat.avatarInitials}</div>`;
    } else {
      avatarHTML = `<div class="contact-avatar-placeholder group-chat-avatar">👥</div>`;
    }
    
    groupElement.innerHTML = `
      <div class="contact-left">
        <div class="contact-rank">${index + 1}</div>
        ${avatarHTML}
        <div class="contact-info-item">
          <h4>${groupChat.displayName}</h4>
          <p>${groupChat.messageCount.toLocaleString()} texts · ${groupChat.participantCount} people</p>
        </div>
      </div>
      <div class="contact-count">${groupChat.messageCount.toLocaleString()}</div>
    `;
    
    // Add click handler to show group chat detail
    groupElement.addEventListener('click', () => {
      showGroupChatDetail(groupChat);
    });
    
    // Stagger animation
    groupElement.style.opacity = '0';
    groupElement.style.transform = 'translateX(-20px)';
    
    setTimeout(() => {
      groupElement.style.transition = 'all 0.4s ease';
      groupElement.style.opacity = '1';
      groupElement.style.transform = 'translateX(0)';
    }, index * 100);
    
    container.appendChild(groupElement);
  });
  
  // Show or hide "Load More" button
  const loadMoreBtn = document.getElementById('loadMoreContactsBtn');
  if (window.currentGroupChatsShown < enhancedGroupChats.length) {
    loadMoreBtn.style.display = 'flex';
    loadMoreBtn.querySelector('span').textContent = 'Load More';
  } else {
    loadMoreBtn.style.display = 'none';
  }
}

// Show group chat detail page
async function showGroupChatDetail(groupChat) {
  // Store current group chat ID and clear contact handle
  window.currentGroupChatId = groupChat.chatId;
  window.currentContactHandle = null;
  
  // Hide dashboard, show detail
  dashboardContainer.style.display = 'none';
  contactDetailContainer.style.display = 'block';
  
  // Set header info
  const avatarContainer = document.querySelector('.detail-avatar-container');
  if (groupChat.avatarInitials) {
    avatarContainer.innerHTML = `<div class="detail-contact-avatar group-chat-avatar-large">${groupChat.avatarInitials}</div>`;
  } else {
    avatarContainer.innerHTML = '<div class="detail-contact-avatar group-chat-avatar-large">👥</div>';
  }
  
  document.getElementById('detailContactName').textContent = groupChat.displayName;
  document.getElementById('detailContactHandle').textContent = `${groupChat.participantCount} participants`;
  
  // Populate year selector for group chat
  const contactDetailYearSelector = document.getElementById('contactDetailYearSelector');
  contactDetailYearSelector.innerHTML = '<option value="">All Time</option>';
  availableYears.forEach(year => {
    const option = document.createElement('option');
    option.value = year;
    option.textContent = year;
    contactDetailYearSelector.appendChild(option);
  });
  contactDetailYearSelector.value = ''; // Reset to all time
  
  // Switch filters to dropdowns for group chats
  document.getElementById('wordFilterGroup').style.display = 'none';
  document.getElementById('wordFilterDropdown').style.display = 'block';
  document.getElementById('messageFilterGroup').style.display = 'none';
  document.getElementById('messageFilterDropdown').style.display = 'block';
  
  // Load and display participants (no year filter initially)
  await loadGroupChatParticipants(null);
  
  // Load stats
  try {
    const result = await window.electronAPI.getGroupChatStats(groupChat.chatId);
    
    if (result.success && result.stats) {
      // Update quick stats
      document.getElementById('detailTotalMessages').textContent = result.stats.totalMessages.toLocaleString();
      document.getElementById('detailSentMessages').textContent = result.stats.sentMessages.toLocaleString();
      document.getElementById('detailReceivedMessages').textContent = result.stats.receivedMessages.toLocaleString();
      
      // Update "The Numbers" section
      const firstDate = result.stats.firstMessageDate ?
        new Date(result.stats.firstMessageDate / 1000000 + new Date('2001-01-01').getTime()).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) :
        'Unknown';
      document.getElementById('detailFirstMessage').textContent = firstDate;
      document.getElementById('detailMostActiveYear').textContent = result.stats.mostActiveYear || '-';
      document.getElementById('detailAvgPerDay').textContent = `${result.stats.avgPerDay} texts/day`;
      document.getElementById('detailLongestStreak').textContent = result.stats.longestStreak ? `${result.stats.longestStreak} days` : '-';
      
      // Create chart
      createContactMessagesChart(result.stats.messagesByYear);
      
      // Update ratio visualization
      const youPercent = result.stats.totalMessages > 0 ? (result.stats.sentMessages / result.stats.totalMessages * 100).toFixed(0) : 50;
      const themPercent = 100 - youPercent;
      
      document.getElementById('detailRatioYou').style.width = `${youPercent}%`;
      document.getElementById('detailRatioYouPercent').textContent = `${youPercent}%`;
      document.getElementById('detailRatioThem').style.width = `${themPercent}%`;
      document.getElementById('detailRatioThemPercent').textContent = `${themPercent}%`;
      document.getElementById('detailContactNameShort').textContent = 'Everyone';
      
      // Load words, emojis, and reactions (default: all people)
      await loadGroupChatWords('all');
      await loadGroupChatEmojis('all');
      await loadGroupChatReactions(groupChat.chatId, 'all');
      
      // Clear search results
      document.getElementById('searchResults').style.display = 'none';
      document.getElementById('messageSearchInput').value = '';
    }
  } catch (error) {
    console.error('Error loading group chat stats:', error);
  }
  
  // Add event listeners for person selectors
  document.getElementById('wordPersonSelector').addEventListener('change', async (e) => {
    const selectedPerson = e.target.value;
    // Get current year filter
    const yearSelector = document.getElementById('contactDetailYearSelector');
    const currentYear = yearSelector ? yearSelector.value : null;
    await loadGroupChatWords(selectedPerson, currentYear);
    await loadGroupChatEmojis(selectedPerson, currentYear);
  });
  
  document.getElementById('messagePersonSelector').addEventListener('change', async () => {
    // If there's an active search, re-run it
    const searchInput = document.getElementById('messageSearchInput');
    if (searchInput.value.trim()) {
      await handleGroupChatMessageSearch();
    }
  });
  
  // Add event listener for emoji person selector
  const emojiPersonSelector = document.getElementById('emojiPersonSelector');
  emojiPersonSelector.style.display = 'block'; // Show it for group chats
  emojiPersonSelector.addEventListener('change', async (e) => {
    const selectedPerson = e.target.value;
    // Get current year filter
    const yearSelector = document.getElementById('contactDetailYearSelector');
    const currentYear = yearSelector ? yearSelector.value : null;
    await loadGroupChatEmojis(selectedPerson, currentYear);
  });
  
  // Add event listener for reaction person selector
  const reactionPersonSelector = document.getElementById('reactionPersonSelector');
  reactionPersonSelector.style.display = 'block'; // Show it for group chats
  reactionPersonSelector.addEventListener('change', async (e) => {
    const selectedPerson = e.target.value;
    // Get current year filter
    const yearSelector = document.getElementById('contactDetailYearSelector');
    const currentYear = yearSelector ? yearSelector.value : null;
    await loadGroupChatReactions(groupChat.chatId, selectedPerson, currentYear);
  });
  
  // Show both emoji and reaction sections for group chats
  document.getElementById('emojiStatsSection').style.display = 'block';
  document.getElementById('reactionBattleSection').style.display = 'block';
}

// Load group chat participants with optional year filter
async function loadGroupChatParticipants(year = null) {
  try {
    const participantsResult = await window.electronAPI.getGroupChatParticipants(window.currentGroupChatId, year);
    
    if (participantsResult.success && participantsResult.participants) {
      window.currentGroupChatParticipants = participantsResult.participants;
      
      // Load imported contacts for name matching
      let importedContacts = JSON.parse(localStorage.getItem('remess_contacts') || '[]');
      if (importedContacts.length === 0) {
        const loadResult = await window.electronAPI.loadContacts();
        if (loadResult.success && loadResult.contacts.length > 0) {
          importedContacts = loadResult.contacts;
          localStorage.setItem('remess_contacts', JSON.stringify(importedContacts));
        }
      }
      
      // Helper function to match contact handle with imported contacts
      function findContactMatch(handle, importedContacts) {
        if (!handle || importedContacts.length === 0) return null;

        // Check if it's an email
        if (handle.includes('@')) {
          // For emails, match exactly in phone field (since emails are stored there)
          return importedContacts.find(c =>
            c.phone && c.phone.toLowerCase() === handle.toLowerCase()
          );
        } else {
          // For phone numbers, match by last 10 digits
          const cleaned = handle.replace(/\D/g, '');
          if (cleaned.length < 10) return null; // Invalid phone number

          return importedContacts.find(c => {
            // Skip email entries when matching phone numbers
            if (c.phone.includes('@')) return false;

            const contactCleaned = c.phone.replace(/\D/g, '');
            if (contactCleaned.length < 10) return false;

            return contactCleaned.endsWith(cleaned.slice(-10)) || cleaned.endsWith(contactCleaned.slice(-10));
          });
        }
      }

      // Enhance participants with contact info
      const enhancedParticipants = participantsResult.participants.map(participant => {
        let displayName = participant.contact;
        let contactPhoto = null;

        // Try to match with imported contacts
        const match = findContactMatch(participant.contact, importedContacts);

        if (match) {
          displayName = match.name;
          contactPhoto = match.photo || null;
        }
        
        // Format phone number if no name match
        if (displayName === participant.contact && !participant.contact.includes('@')) {
          displayName = formatPhoneNumber(participant.contact);
        }
        
        return {
          ...participant,
          displayName,
          contactPhoto
        };
      });
      
      // Populate dropdowns with participants
      const wordSelector = document.getElementById('wordPersonSelector');
      const messageSelector = document.getElementById('messagePersonSelector');
      const emojiSelector = document.getElementById('emojiPersonSelector');
      const reactionSelector = document.getElementById('reactionPersonSelector');
      
      // Clear existing options (except All People and You)
      wordSelector.innerHTML = '<option value="all">All People</option><option value="you">You</option>';
      messageSelector.innerHTML = '<option value="all">All People</option><option value="you">You</option>';
      emojiSelector.innerHTML = '<option value="all">All People</option><option value="you">You</option>';
      reactionSelector.innerHTML = '<option value="all">All People</option>';
      
      enhancedParticipants.forEach(p => {
        const wordOption = document.createElement('option');
        wordOption.value = p.handleId;
        wordOption.textContent = p.displayName;
        wordSelector.appendChild(wordOption);
        
        const messageOption = document.createElement('option');
        messageOption.value = p.handleId;
        messageOption.textContent = p.displayName;
        messageSelector.appendChild(messageOption);
        
        const emojiOption = document.createElement('option');
        emojiOption.value = p.handleId;
        emojiOption.textContent = p.displayName;
        emojiSelector.appendChild(emojiOption);
        
        const reactionOption = document.createElement('option');
        reactionOption.value = p.handleId;
        reactionOption.textContent = p.displayName;
        reactionSelector.appendChild(reactionOption);
      });
      
      // Display participants list
      renderGroupChatParticipants(enhancedParticipants);

      // Store participants globally for message search
      window.groupChatParticipants = enhancedParticipants;

      // Show participants section
      document.getElementById('groupChatParticipantsSection').style.display = 'block';
    }
  } catch (error) {
    console.error('Error loading participants:', error);
  }
}

// Render group chat participants in a circle
function renderGroupChatParticipants(participants) {
  const container = document.getElementById('groupChatParticipantsList');
  container.innerHTML = '';
  
  const numParticipants = participants.length;
  const radius = 200; // Distance from center (wider spacing)
  
  participants.forEach((participant, index) => {
    const participantElement = document.createElement('div');
    participantElement.className = 'participant-circle-item';
    
    // Calculate position on circle
    const angle = (index / numParticipants) * 2 * Math.PI - Math.PI / 2; // Start from top
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);
    
    participantElement.style.transform = `translate(${x}px, ${y}px)`;
    
    // Format message count
    let countDisplay = participant.messageCount.toLocaleString();
    if (participant.messageCount >= 1000) {
      countDisplay = (participant.messageCount / 1000).toFixed(1) + 'k';
    }
    
    let avatarHTML = '';
    if (participant.contactPhoto) {
      const initials = getInitials(participant.displayName);
      avatarHTML = `<img src="${participant.contactPhoto}" alt="${participant.displayName}" class="participant-circle-avatar" onerror="this.parentElement.innerHTML='<div class=\\'participant-circle-avatar-placeholder\\'>${initials}</div><div class=\\'participant-circle-count\\'>${countDisplay}</div><div class=\\'participant-circle-name\\'>${participant.displayName}</div>';">`;
    } else {
      avatarHTML = `<div class="participant-circle-avatar-placeholder">${getInitials(participant.displayName)}</div>`;
    }
    
    participantElement.innerHTML = `
      ${avatarHTML}
      <div class="participant-circle-count">${countDisplay}</div>
      <div class="participant-circle-name">${participant.displayName}</div>
    `;
    
    // Add slight stagger to animation
    participantElement.style.animationDelay = `${index * 0.1}s`;
    
    container.appendChild(participantElement);
  });
}

// Render word cloud (helper function)
function renderWordCloud(words, container) {
  container.innerHTML = '';
  
  if (words && words.length > 0) {
    words.forEach((word, index) => {
      const sizeClass = index < 3 ? 'size-1' : index < 6 ? 'size-2' : index < 10 ? 'size-3' : 'size-4';
      container.innerHTML += `<span class="word-item ${sizeClass}">${word.word}</span>`;
    });
  } else {
    container.innerHTML = '<p style="color: var(--medium-gray); text-align: center;">Not enough messages to analyze</p>';
  }
}

// Render emoji stats (helper function)
function renderEmojiStats(emojis, container) {
  container.innerHTML = '';
  
  if (emojis && emojis.length > 0) {
    emojis.forEach(emoji => {
      container.innerHTML += `
        <div class="emoji-item">
          <span class="emoji-char">${emoji.emoji}</span>
          <span class="emoji-count">${emoji.count}</span>
        </div>
      `;
    });
  } else {
    container.innerHTML = '<p style="color: var(--medium-gray); text-align: center; grid-column: 1 / -1;">No emojis found</p>';
  }
}

// Load group chat words
async function loadGroupChatWords(personId, year = null) {
  try {
    const result = await window.electronAPI.getGroupChatWords(window.currentGroupChatId, 20, personId, year);
    
    if (result.success && result.words) {
      renderWordCloud(result.words, document.getElementById('detailWordCloud'));
    }
  } catch (error) {
    console.error('Error loading group chat words:', error);
  }
}

// Load group chat emojis
async function loadGroupChatEmojis(personId, year = null) {
  try {
    const result = await window.electronAPI.getGroupChatEmojis(window.currentGroupChatId, 10, personId, year);
    
    if (result.success && result.emojis) {
      renderEmojiStats(result.emojis, document.getElementById('detailEmojiStats'));
    }
  } catch (error) {
    console.error('Error loading group chat emojis:', error);
  }
}

// Handle group chat message search
async function handleGroupChatMessageSearch() {
  const searchInput = document.getElementById('messageSearchInput');
  const searchTerm = searchInput.value.trim();
  
  if (!searchTerm || !window.currentGroupChatId) {
    return;
  }
  
  const personSelector = document.getElementById('messagePersonSelector');
  const personId = personSelector.value;
  
  // Reset pagination
  window.currentSearchTerm = searchTerm;
  window.currentSearchOffset = 0;
  
  try {
    const result = await window.electronAPI.searchGroupChatMessages(
      window.currentGroupChatId,
      searchTerm,
      SEARCH_PAGE_SIZE,
      0,
      personId
    );
    
    if (result.success) {
      window.totalSearchResults = result.count;
      
      const resultsContainer = document.getElementById('searchResults');
      const searchCount = document.getElementById('searchResultCount');
      const examplesContainer = document.getElementById('searchExamples');
      const loadMoreBtn = document.getElementById('loadMoreMessagesBtn');
      
      searchCount.textContent = result.count.toLocaleString();
      resultsContainer.style.display = 'block';
      
      // Clear and populate examples
      examplesContainer.innerHTML = '';
      result.examples.forEach(example => {
        // Map sender ID to participant name for group chats
        if (example.senderId && window.groupChatParticipants) {
          const participant = window.groupChatParticipants.find(p => p.handleId === example.senderId);
          if (participant) {
            example.senderName = participant.displayName;
          }
        }
        const messageEl = createMessageElement(example, searchTerm);
        examplesContainer.appendChild(messageEl);
      });
      
      // Show/hide load more button
      if (result.count > SEARCH_PAGE_SIZE) {
        loadMoreBtn.style.display = 'block';
        window.currentSearchOffset = SEARCH_PAGE_SIZE;
      } else {
        loadMoreBtn.style.display = 'none';
      }
    }
  } catch (error) {
    console.error('Error searching group chat messages:', error);
  }
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
      
      // Save current selection before repopulating
      const currentSelection = topContactsYearSelector.value;
      
      // Populate dashboard year selector
      topContactsYearSelector.innerHTML = '<option value="">All Time</option>';
      result.years.forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        topContactsYearSelector.appendChild(option);
      });
      
      // Restore previous selection if it was set and still exists
      if (currentSelection && result.years.includes(currentSelection)) {
        topContactsYearSelector.value = currentSelection;
        currentDashboardYear = currentSelection;
      } else if (currentDashboardYear && result.years.includes(currentDashboardYear)) {
        // Restore from stored value if selector was reset
        topContactsYearSelector.value = currentDashboardYear;
      }
      
    }
  } catch (error) {
    console.error('Error loading available years:', error);
  }
}

// Handle year change for top contacts
async function handleTopContactsYearChange(year) {
  try {
    // Check if we're viewing groups or DMs
    const activeFilter = document.querySelector('.filter-btn[data-filter-type="chat-type"].active');
    const isGroupsView = activeFilter && activeFilter.dataset.filter === 'groups';
    
    if (isGroupsView) {
      // Handle group chats
      let groupChatsData;
      
      if (year) {
        const result = await window.electronAPI.getTopGroupChatsByYear(year);
        if (result.success) {
          groupChatsData = result.groupChats;
        } else {
          console.error('Failed to load group chats for year:', result.error);
          return;
        }
      } else {
        const result = await window.electronAPI.getTopGroupChats();
        if (result.success) {
          groupChatsData = result.groupChats;
        } else {
          console.error('Failed to load group chats:', result.error);
          return;
        }
      }
      
      renderGroupChats(groupChatsData);
    } else {
      // Handle DMs
      let topContactsData;
      
      if (year) {
        const result = await window.electronAPI.getTopContactsByYear(year);
        if (result.success) {
          topContactsData = result.contacts;
        } else {
          console.error('Failed to load contacts for year:', result.error);
          return;
        }
      } else {
        topContactsData = userData.topContacts;
      }
      
      await renderTopContacts(topContactsData);
    }
  } catch (error) {
    console.error('Error changing year:', error);
  }
}

// Handle year change for contact detail view
async function handleContactDetailYearChange(year) {
  // Add loading animation
  const detailContainer = document.getElementById('contactDetailContainer');
  detailContainer.style.opacity = '0.5';
  detailContainer.style.transition = 'opacity 0.2s ease';

  // Check if we're viewing a group chat or a contact
  if (window.currentGroupChatId) {
    // Handle group chat year change - reload ALL stats with year filter
    try {
      const result = await window.electronAPI.getGroupChatStats(window.currentGroupChatId, year);

      if (result.success && result.stats) {
        const stats = result.stats;

        // Update ALL stats with year-filtered data
        document.getElementById('detailTotalMessages').textContent = stats.totalMessages.toLocaleString();
        document.getElementById('detailSentMessages').textContent = stats.sentMessages.toLocaleString();
        document.getElementById('detailReceivedMessages').textContent = stats.receivedMessages.toLocaleString();
        
        // Update "The Numbers" section
        const firstDate = stats.firstMessageDate ?
          new Date(stats.firstMessageDate / 1000000 + new Date('2001-01-01').getTime()).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) :
          'Unknown';
        document.getElementById('detailFirstMessage').textContent = firstDate;
        document.getElementById('detailMostActiveYear').textContent = stats.mostActiveYear || '-';
        document.getElementById('detailAvgPerDay').textContent = `${stats.avgPerDay} texts/day`;
        document.getElementById('detailLongestStreak').textContent = stats.longestStreak ? `${stats.longestStreak} days` : '-';
        
        // Update chart - filter to show only selected year if year is specified
        let chartData = stats.messagesByYear;
        if (year) {
          chartData = stats.messagesByYear.filter(m => m.year === year);
        }
        createContactMessagesChart(chartData);
        
        // Update ratio visualization
        const youPercent = stats.totalMessages > 0 ? (stats.sentMessages / stats.totalMessages * 100).toFixed(0) : 50;
        const themPercent = 100 - youPercent;
        
        document.getElementById('detailRatioYou').style.width = `${youPercent}%`;
        document.getElementById('detailRatioYouPercent').textContent = `${youPercent}%`;
        document.getElementById('detailRatioThem').style.width = `${themPercent}%`;
        document.getElementById('detailRatioThemPercent').textContent = `${themPercent}%`;
        
        // Reload participants with year filter (updates message counts)
        await loadGroupChatParticipants(year);
        
        // Reload words with current person filter and year
        const wordSelector = document.getElementById('wordPersonSelector');
        const currentPersonFilter = wordSelector ? wordSelector.value : 'all';
        await loadGroupChatWords(currentPersonFilter, year);
        
        // Reload emojis with current person filter and year
        const emojiSelector = document.getElementById('emojiPersonSelector');
        const currentEmojiFilter = emojiSelector ? emojiSelector.value : 'all';
        await loadGroupChatEmojis(currentEmojiFilter, year);
        
        // Reload reactions with current person filter and year
        const reactionSelector = document.getElementById('reactionPersonSelector');
        const currentReactionFilter = reactionSelector ? reactionSelector.value : 'all';
        await loadGroupChatReactions(window.currentGroupChatId, currentReactionFilter, year);
      }
    } catch (error) {
      console.error('Error changing group chat year:', error);
    } finally {
      // Restore opacity with animation
      detailContainer.style.opacity = '1';
    }
  } else if (currentContactHandle) {
    // Handle contact year change
    try {
      const result = await window.electronAPI.getContactStats(currentContactHandle, year || null);

      if (result.success && result.stats) {
        // Get contact info from current view
        const displayName = document.getElementById('detailContactName').textContent;
        loadContactDetailStats(result.stats, result.words, result.emojis, displayName);

        // Load reactions with year filter
        await loadContactReactions(currentContactHandle, displayName, year);
      } else {
        console.error('Failed to load contact stats:', result.error);
      }
    } catch (error) {
      console.error('Error changing contact detail year:', error);
    } finally {
      // Restore opacity with animation
      detailContainer.style.opacity = '1';
    }
  }
}

// ============================================
// CONTACT DETAIL VIEW
// ============================================

// Show contact detail view
async function showContactDetail(contact) {

  // Store current contact handles (can be multiple for consolidated contacts) and clear group chat ID
  currentContactHandle = contact.handles || [contact.handle];
  window.currentGroupChatId = null;

  // Show loading overlay with icon while keeping dashboard visible
  let loadingOverlay = document.getElementById('contactLoadingOverlay');
  if (!loadingOverlay) {
    loadingOverlay = document.createElement('div');
    loadingOverlay.id = 'contactLoadingOverlay';
    loadingOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: white;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
    `;
    loadingOverlay.innerHTML = `
      <div style="text-align: center;">
        <img src="icon.png" alt="Loading" style="width: 80px; height: 80px; animation: bounce 2s ease-in-out infinite;">
      </div>
    `;
    document.body.appendChild(loadingOverlay);
  } else {
    loadingOverlay.style.display = 'flex';
  }

  // Load contact stats FIRST before rendering anything
  try {
    let result;
    if (Array.isArray(currentContactHandle) && currentContactHandle.length > 1) {
      // Multiple handles - get combined stats
      result = await window.electronAPI.getContactStats(currentContactHandle);
    } else {
      // Single handle
      const singleHandle = Array.isArray(currentContactHandle) ? currentContactHandle[0] : currentContactHandle;
      result = await window.electronAPI.getContactStats(singleHandle);
    }

    if (!result.success || !result.stats) {
      console.error('Failed to load contact stats:', result.error);
      loadingOverlay.style.display = 'none';
      return;
    }

    // NOW switch views and render the page
    dashboardContainer.style.display = 'none';
    contactDetailContainer.style.display = 'block';

  // Restore button filters for DM (hide dropdowns)
  document.getElementById('wordFilterGroup').style.display = 'inline-flex';
  document.getElementById('wordFilterDropdown').style.display = 'none';
  document.getElementById('messageFilterGroup').style.display = 'inline-flex';
  document.getElementById('messageFilterDropdown').style.display = 'none';

  // Update filter button labels to use contact's first name instead of "Them"
  const firstName = (contact.displayName || (Array.isArray(contact.handles) ? contact.handles[0] : contact.handle)).split(' ')[0];
  const wordFilterButtons = document.querySelectorAll('#wordFilterGroup .filter-btn[data-filter="them"]');
  const messageFilterButtons = document.querySelectorAll('#messageFilterGroup .filter-btn[data-filter="them"]');
  wordFilterButtons.forEach(btn => btn.textContent = firstName);
  messageFilterButtons.forEach(btn => btn.textContent = firstName);

  // Hide participants section (only for group chats)
  document.getElementById('groupChatParticipantsSection').style.display = 'none';
  
  // Hide person selectors (only for group chats)
  document.getElementById('emojiPersonSelector').style.display = 'none';
  document.getElementById('reactionPersonSelector').style.display = 'none';
  
  // Show both emoji and reaction sections for DMs
  document.getElementById('emojiStatsSection').style.display = 'block';
  document.getElementById('reactionBattleSection').style.display = 'block';
  
  // Show reactions section
  const reactionsSection = document.querySelector('.detail-section:has(#yourReactions)');
  if (reactionsSection) {
    reactionsSection.style.display = 'block';
  }
  
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
  
  // Format phone number(s) and email(s) nicely - show all handles
  const handles = currentContactHandle;
  let formattedHandles = [];

  if (Array.isArray(handles)) {
    handles.forEach(handle => {
      if (handle.includes('@')) {
        formattedHandles.push(handle); // Email - show as is
      } else {
        formattedHandles.push(formatPhoneNumber(handle)); // Phone - format nicely
      }
    });
  } else {
    if (handles.includes('@')) {
      formattedHandles.push(handles);
    } else {
      formattedHandles.push(formatPhoneNumber(handles));
    }
  }

  detailContactHandle.textContent = formattedHandles.join(' • ');
  
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

    // Load and display the stats
    loadContactDetailStats(result.stats, result.words, result.emojis, displayName);

    // Load reactions
    await loadContactReactions(currentContactHandle, displayName);

    // Hide loading overlay
    loadingOverlay.style.display = 'none';

  } catch (error) {
    console.error('Error loading contact details:', error);
    // Hide loading overlay on error
    loadingOverlay.style.display = 'none';
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
  
  // Display longest streak
  document.getElementById('detailLongestStreak').textContent = stats.longestStreak ? `${stats.longestStreak} days` : '-';
  
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
async function loadContactReactions(contactHandle, contactName, year = null) {
  try {
    // Get first handle if it's an array
    const singleHandle = Array.isArray(contactHandle) ? contactHandle[0] : contactHandle;
    const result = await window.electronAPI.getContactReactions(singleHandle, year);
    
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

// Load group chat reactions with optional person and year filters
async function loadGroupChatReactions(chatId, personId = 'all', year = null) {
  try {
    const result = await window.electronAPI.getGroupChatReactions(chatId, personId, year);
    
    if (result.success) {
      const yourReactionsContainer = document.getElementById('yourReactions');
      const theirReactionsContainer = document.getElementById('theirReactions');
      const theirReactionsTitle = document.getElementById('theirReactionsTitle');
      
      // Update title based on person filter
      let titleText = 'Everyone';
      if (personId && personId !== 'all' && personId !== 'you') {
        // Get the person's name from the dropdown
        const personSelector = document.getElementById('reactionPersonSelector');
        if (personSelector) {
          const selectedOption = personSelector.options[personSelector.selectedIndex];
          titleText = selectedOption ? selectedOption.text : 'Them';
        }
      }
      theirReactionsTitle.textContent = titleText;
      
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
    console.error('Error loading group chat reactions:', error);
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
  // Check if we're in a group chat or DM
  if (window.currentGroupChatId) {
    return handleGroupChatMessageSearch();
  }
  
  const searchInput = document.getElementById('messageSearchInput');
  const searchResults = document.getElementById('searchResults');
  const searchResultCount = document.getElementById('searchResultCount');
  const searchExamples = document.getElementById('searchExamples');
  const loadMoreBtn = document.getElementById('loadMoreMessagesBtn');
  
  const searchTerm = searchInput.value.trim();
  
  if (!searchTerm) {
    searchResults.style.display = 'none';
    loadMoreBtn.style.display = 'none';
    return;
  }
  
  if (!currentContactHandle) {
    console.error('No contact handle available for search');
    return;
  }
  
  // Get selected filter from active button
  const activeFilterBtn = document.querySelector('.filter-btn[data-filter-type="message"].active');
  const filter = activeFilterBtn ? activeFilterBtn.dataset.filter : 'both';
  
  try {
    // Reset offset for new search
    currentSearchTerm = searchTerm;
    currentSearchOffset = 0;
    
    const result = await window.electronAPI.searchContactMessages(currentContactHandle, searchTerm, SEARCH_PAGE_SIZE, currentSearchOffset, filter);
    
    if (result.success) {
      // Show results
      searchResults.style.display = 'block';
      totalSearchResults = result.count;
      searchResultCount.textContent = result.count;
      
      // Clear previous examples
      searchExamples.innerHTML = '';
      
      if (result.count === 0) {
        searchExamples.innerHTML = '<div class="search-no-results">No messages found containing "' + searchTerm + '"</div>';
        loadMoreBtn.style.display = 'none';
      } else {
        // Get contact name from page header
        const contactName = document.getElementById('detailContactName')?.textContent || null;

        // Display example messages
        result.examples.forEach(msg => {
          const messageEl = createMessageElement(msg, searchTerm, contactName);
          searchExamples.appendChild(messageEl);
        });

        // Update offset and show/hide load more button
        currentSearchOffset += result.examples.length;
        if (currentSearchOffset < totalSearchResults) {
          loadMoreBtn.style.display = 'block';
        } else {
          loadMoreBtn.style.display = 'none';
        }
      }
    } else {
      console.error('Search failed:', result.error);
    }
  } catch (error) {
    console.error('Error searching messages:', error);
  }
}

// Handle loading more messages
async function handleLoadMoreMessages() {
  const searchExamples = document.getElementById('searchExamples');
  const loadMoreBtn = document.getElementById('loadMoreMessagesBtn');

  // Check if we're in a group chat
  if (window.currentGroupChatId) {
    // Handle group chat load more
    const personSelector = document.getElementById('messagePersonSelector');
    const personId = personSelector.value;

    try {
      const result = await window.electronAPI.searchGroupChatMessages(
        window.currentGroupChatId,
        window.currentSearchTerm,
        SEARCH_PAGE_SIZE,
        window.currentSearchOffset,
        personId
      );

      if (result.success && result.examples.length > 0) {
        result.examples.forEach(example => {
          // Map sender ID to participant name for group chats
          if (example.senderId && window.groupChatParticipants) {
            const participant = window.groupChatParticipants.find(p => p.handleId === example.senderId);
            if (participant) {
              example.senderName = participant.displayName;
            }
          }
          const messageEl = createMessageElement(example, window.currentSearchTerm);
          searchExamples.appendChild(messageEl);
        });

        window.currentSearchOffset += result.examples.length;
        if (window.currentSearchOffset >= result.count) {
          loadMoreBtn.style.display = 'none';
        }
      }
    } catch (error) {
      console.error('Error loading more group chat messages:', error);
    }
    return;
  }

  // Handle DM load more
  if (!currentContactHandle || !currentSearchTerm) {
    return;
  }

  // Get selected filter from active button
  const activeFilterBtn = document.querySelector('.filter-btn[data-filter-type="message"].active');
  const filter = activeFilterBtn ? activeFilterBtn.dataset.filter : 'both';

  try {
    const result = await window.electronAPI.searchContactMessages(currentContactHandle, currentSearchTerm, SEARCH_PAGE_SIZE, currentSearchOffset, filter);

    if (result.success && result.examples.length > 0) {
      // Get contact name from page header
      const contactName = document.getElementById('detailContactName')?.textContent || null;

      // Append new messages
      result.examples.forEach(msg => {
        const messageEl = createMessageElement(msg, currentSearchTerm, contactName);
        searchExamples.appendChild(messageEl);
      });

      // Update offset and show/hide load more button
      currentSearchOffset += result.examples.length;
      if (currentSearchOffset >= totalSearchResults) {
        loadMoreBtn.style.display = 'none';
      }
    }
  } catch (error) {
    console.error('Error loading more messages:', error);
  }
}

// Helper to create a message element
function createMessageElement(msg, searchTerm, contactName = null) {
  const messageEl = document.createElement('div');
  messageEl.className = 'message-example';

  // Highlight the search term in the message text
  const highlightedText = msg.text.replace(
    new RegExp(`(${escapeRegExp(searchTerm)})`, 'gi'),
    '<span class="highlight">$1</span>'
  );

  // Determine sender name
  let senderName;
  if (msg.isFromMe) {
    senderName = 'You';
  } else if (msg.senderName) {
    // For group chats with specific sender
    senderName = msg.senderName;
  } else if (contactName) {
    // For DMs, use the contact name
    senderName = contactName;
  } else {
    // Fallback
    senderName = 'Them';
  }

  messageEl.innerHTML = `
    <div class="message-header">
      <span class="message-sender ${msg.isFromMe ? 'from-me' : 'from-them'}">
        ${senderName}
      </span>
      <span class="message-date">${msg.formattedDate}</span>
    </div>
    <div class="message-text">${highlightedText}</div>
  `;

  return messageEl;
}

// Handle filter button click
async function handleFilterButtonClick(e) {
  const btn = e.currentTarget;
  const filterType = btn.dataset.filterType;
  const filterValue = btn.dataset.filter;
  
  // Update active state for buttons of this type
  const btnsOfType = document.querySelectorAll(`.filter-btn[data-filter-type="${filterType}"]`);
  btnsOfType.forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  
  // Handle based on filter type
  if (filterType === 'word') {
    await handleWordFilterChange(filterValue);
  } else if (filterType === 'message') {
    // If there's an active search, re-run it with the new filter
    const searchInput = document.getElementById('messageSearchInput');
    if (searchInput.value.trim()) {
      await handleMessageSearch();
    }
  } else if (filterType === 'chat-type') {
    await handleChatTypeChange(filterValue);
  }
}

// Handle word filter change
async function handleWordFilterChange(filter) {
  if (!currentContactHandle) {
    return;
  }
  
  try {
    const result = await window.electronAPI.getContactWordsFiltered(currentContactHandle, filter, 15);
    
    if (result.success && result.words) {
      const wordCloud = document.getElementById('detailWordCloud');
      wordCloud.innerHTML = '';
      
      if (result.words.length > 0) {
        result.words.forEach((word, index) => {
          const sizeClass = index < 3 ? 'size-1' : index < 6 ? 'size-2' : index < 10 ? 'size-3' : 'size-4';
          wordCloud.innerHTML += `<span class="word-item ${sizeClass}">${word.word}</span>`;
        });
      } else {
        wordCloud.innerHTML = '<p style="color: var(--medium-gray); text-align: center;">Not enough messages to analyze</p>';
      }
    }
  } catch (error) {
    console.error('Error loading filtered words:', error);
  }
}

// Helper function to escape special regex characters
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Start the app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
