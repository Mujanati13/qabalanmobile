const { device, element, by, expect } = require('detox');

/**
 * Reload the React Native app
 */
async function reloadApp() {
  try {
    await device.reloadReactNative();
    // Wait for app to be ready
    await waitFor(element(by.id('main-screen')))
      .toBeVisible()
      .withTimeout(10000);
  } catch (error) {
    console.log('App reload failed, attempting fresh launch:', error.message);
    await device.launchApp({ delete: false });
  }
}

/**
 * Login as a customer with email and password
 */
async function loginAsCustomer(email, password) {
  try {
    // Check if already logged in
    const profileButton = element(by.id('user-profile-button'));
    const isLoggedIn = await profileButton.exists();
    
    if (isLoggedIn) {
      console.log('User already logged in');
      return;
    }

    // Navigate to login screen
    await element(by.id('login-button')).tap();
    
    // Fill login form
    await element(by.id('email-input')).typeText(email);
    await element(by.id('password-input')).typeText(password);
    await element(by.id('login-submit-button')).tap();
    
    // Wait for successful login
    await waitFor(element(by.id('user-profile-button')))
      .toBeVisible()
      .withTimeout(10000);
      
    console.log(`✅ Successfully logged in as: ${email}`);
  } catch (error) {
    console.log(`❌ Login failed for ${email}:`, error.message);
    throw error;
  }
}

/**
 * Logout current user
 */
async function logout() {
  try {
    // Check if logged in
    const profileButton = element(by.id('user-profile-button'));
    const isLoggedIn = await profileButton.exists();
    
    if (!isLoggedIn) {
      console.log('User not logged in');
      return;
    }

    // Navigate to profile and logout
    await element(by.id('profile-tab')).tap();
    await element(by.id('logout-button')).tap();
    
    // Confirm logout if needed
    const confirmButton = element(by.text('Confirm'));
    const confirmExists = await confirmButton.exists();
    if (confirmExists) {
      await confirmButton.tap();
    }
    
    // Wait for logout to complete
    await waitFor(element(by.id('login-button')))
      .toBeVisible()
      .withTimeout(5000);
      
    console.log('✅ Successfully logged out');
  } catch (error) {
    console.log('❌ Logout failed:', error.message);
    throw error;
  }
}

/**
 * Clear app data and reset to initial state
 */
async function clearAppData() {
  try {
    console.log('🧹 Clearing app data...');
    
    // Method 1: Try device-specific clear data
    if (device.getPlatform() === 'android') {
      await device.clearKeychain();
    } else {
      await device.clearKeychain();
    }
    
    // Method 2: Clear AsyncStorage if accessible
    try {
      await device.sendToHome();
      await device.launchApp({ delete: false });
      
      // Clear any cached data through app
      const settingsButton = element(by.id('settings-button'));
      const settingsExists = await settingsButton.exists();
      
      if (settingsExists) {
        await settingsButton.tap();
        const clearDataButton = element(by.id('clear-data-button'));
        const clearDataExists = await clearDataButton.exists();
        
        if (clearDataExists) {
          await clearDataButton.tap();
          await element(by.text('Confirm')).tap();
        }
      }
    } catch (clearError) {
      console.log('Could not clear data through app UI');
    }
    
    console.log('✅ App data cleared');
  } catch (error) {
    console.log('⚠️ Could not fully clear app data:', error.message);
  }
}

/**
 * Wait for element with custom timeout and retry logic
 */
async function waitForElement(elementSelector, timeout = 10000) {
  try {
    await waitFor(element(elementSelector))
      .toBeVisible()
      .withTimeout(timeout);
    return true;
  } catch (error) {
    console.log(`Element not found: ${elementSelector.toString()}`);
    return false;
  }
}

/**
 * Safe tap with retry logic
 */
async function safeTap(elementSelector, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      await element(elementSelector).tap();
      return true;
    } catch (error) {
      if (i === retries - 1) {
        throw error;
      }
      console.log(`Tap attempt ${i + 1} failed, retrying...`);
      await device.reloadReactNative();
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

/**
 * Type text with clearing existing content
 */
async function safeTypeText(elementSelector, text) {
  try {
    await element(elementSelector).clearText();
    await element(elementSelector).typeText(text);
  } catch (error) {
    // Fallback: tap and use replaceText
    await element(elementSelector).tap();
    await element(elementSelector).replaceText(text);
  }
}

/**
 * Check if element exists without throwing
 */
async function elementExists(elementSelector) {
  try {
    await expect(element(elementSelector)).toExist();
    return true;
  } catch {
    return false;
  }
}

/**
 * Navigate to specific tab safely
 */
async function navigateToTab(tabId) {
  const maxRetries = 3;
  for (let i = 0; i < maxRetries; i++) {
    try {
      await element(by.id(tabId)).tap();
      await waitFor(element(by.id(tabId)))
        .toBeVisible()
        .withTimeout(3000);
      return;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

/**
 * Setup test environment with sample data
 */
async function setupTestEnvironment() {
  console.log('🔧 Setting up test environment...');
  
  try {
    // Clear any existing data
    await clearAppData();
    
    // Launch app fresh
    await device.launchApp({ delete: false });
    
    // Wait for app to be ready
    await waitForElement(by.id('main-screen'));
    
    console.log('✅ Test environment ready');
  } catch (error) {
    console.log('❌ Test environment setup failed:', error.message);
    throw error;
  }
}

/**
 * Cleanup after tests
 */
async function cleanupTestEnvironment() {
  console.log('🧹 Cleaning up test environment...');
  
  try {
    // Logout if logged in
    await logout();
    
    // Clear data
    await clearAppData();
    
    console.log('✅ Test environment cleaned up');
  } catch (error) {
    console.log('⚠️ Cleanup warnings:', error.message);
  }
}

module.exports = {
  reloadApp,
  loginAsCustomer,
  logout,
  clearAppData,
  waitForElement,
  safeTap,
  safeTypeText,
  elementExists,
  navigateToTab,
  setupTestEnvironment,
  cleanupTestEnvironment
};
