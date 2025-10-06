const { BrowserWindow } = require('electron');
const crypto = require('crypto');
const url = require('url');

const AUTH0_CONFIG = {
  domain: 'dev-dzghfb34q8oaodzh.us.auth0.com',
  clientId: 'zdJS3GQdnzhwFb7zy2wP0gHIBKIN1Xev',
  redirectUri: 'http://localhost/callback',
  scope: 'openid profile email'
};

// PKCE helper functions
function base64URLEncode(str) {
  return str.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest();
}

function generateCodeVerifier() {
  return base64URLEncode(crypto.randomBytes(32));
}

function generateCodeChallenge(verifier) {
  return base64URLEncode(sha256(verifier));
}

// Main authentication function with PKCE
function authenticateWithAuth0() {
  return new Promise((resolve, reject) => {
    // Generate PKCE values
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    const state = crypto.randomBytes(32).toString('hex');
    
    // Build authorization URL with PKCE
    const authUrl = `https://${AUTH0_CONFIG.domain}/authorize?` + new URLSearchParams({
      client_id: AUTH0_CONFIG.clientId,
      redirect_uri: AUTH0_CONFIG.redirectUri,
      response_type: 'code',  // Authorization Code Flow
      scope: AUTH0_CONFIG.scope,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state: state,
      prompt: 'login',  // Force login screen (skips passkey in some cases)
      // Tell Google to skip passkeys
      screen_hint: 'signup'
    }).toString();
    
    // Create authentication window
    const authWindow = new BrowserWindow({
      width: 500,
      height: 700,
      show: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: true,
        allowRunningInsecureContent: false
      },
      title: 'Sign in to Remess'
    });
    
    // Inject CSS to hide passkey prompts and force password
    authWindow.webContents.on('did-finish-load', () => {
      authWindow.webContents.insertCSS(`
        /* Hide passkey buttons/prompts */
        [data-challengetype="12"],
        [data-challengetype="6"],
        .google-passkey-button,
        [jsname="DhK0U"] {
          display: none !important;
        }
      `).catch(() => {
        // Ignore CSS injection errors
      });
    });

    // Load the Auth0 login page
    authWindow.loadURL(authUrl);

    let isHandlingCallback = false;

    // Handle window close
    authWindow.on('closed', () => {
      if (!isHandlingCallback) {
        reject(new Error('Authentication window was closed'));
      }
    });

    // Listen for navigation - catch before it tries to load
    authWindow.webContents.on('will-navigate', async (event, navigationUrl) => {
      if (navigationUrl.startsWith(AUTH0_CONFIG.redirectUri)) {
        event.preventDefault();
        isHandlingCallback = true;
        await handleCallback(navigationUrl, authWindow, resolve, reject, codeVerifier, state);
      }
    });

    // Also listen for redirect
    authWindow.webContents.on('will-redirect', async (event, redirectUrl) => {
      if (redirectUrl.startsWith(AUTH0_CONFIG.redirectUri)) {
        event.preventDefault();
        isHandlingCallback = true;
        await handleCallback(redirectUrl, authWindow, resolve, reject, codeVerifier, state);
      }
    });

    // Handle navigation errors (but ignore localhost callback failures)
    authWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      // If it's our callback URL, ignore the error (we're handling it)
      if (validatedURL.startsWith(AUTH0_CONFIG.redirectUri)) {
        return;
      }
      // Otherwise, it's a real error
      if (!isHandlingCallback) {
        authWindow.close();
        reject(new Error('Failed to load authentication page'));
      }
    });
  });
}

// Handle Auth0 callback
async function handleCallback(callbackUrl, authWindow, resolve, reject, codeVerifier, state) {
  const parsedUrl = url.parse(callbackUrl, true);
  
  // Check if this is our callback URL
  if (callbackUrl.startsWith(AUTH0_CONFIG.redirectUri)) {
    try {
      const code = parsedUrl.query.code;
      const returnedState = parsedUrl.query.state;
      const error = parsedUrl.query.error;
      
      if (error) {
        authWindow.close();
        reject(new Error(parsedUrl.query.error_description || error));
        return;
      }
      
      // Verify state
      if (returnedState !== state) {
        authWindow.close();
        reject(new Error('Invalid state parameter'));
        return;
      }
      
      if (code) {
        // Exchange code for tokens
        const tokens = await exchangeCodeForTokens(code, codeVerifier);
        
        // Get user info
        const userInfo = await getUserInfo(tokens.access_token);
        
        authWindow.close();
        resolve({
          user: {
            name: userInfo.name,
            email: userInfo.email,
            avatar: userInfo.picture
          },
          tokens: tokens
        });
      }
    } catch (error) {
      authWindow.close();
      reject(error);
    }
  }
}

// Exchange authorization code for tokens
async function exchangeCodeForTokens(code, codeVerifier) {
  try {
    const response = await fetch(`https://${AUTH0_CONFIG.domain}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: AUTH0_CONFIG.clientId,
        code_verifier: codeVerifier,
        code: code,
        redirect_uri: AUTH0_CONFIG.redirectUri
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Token exchange failed:', error);
      throw new Error('Failed to exchange code for tokens');
    }

    return await response.json();
  } catch (error) {
    console.error('Token exchange error:', error);
    throw error;
  }
}

// Get user information from Auth0
async function getUserInfo(accessToken) {
  try {
    const response = await fetch(`https://${AUTH0_CONFIG.domain}/userinfo`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to get user info');
    }

    return await response.json();
  } catch (error) {
    console.error('User info fetch error:', error);
    throw error;
  }
}

module.exports = {
  authenticateWithAuth0,
  AUTH0_CONFIG
};
