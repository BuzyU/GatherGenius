// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCKd_iH-McAMrKI_0YDoYG0xjn2KrQpTOQ",
    authDomain: "notifyme-events.firebaseapp.com",
    projectId: "notifyme-events",
    storageBucket: "notifyme-events.firebasestorage.app",
    messagingSenderId: "761571632545",
    appId: "1:761571632545:web:547a7210fdebf366df97e0",
    measurementId: "G-309BJ6P79V"
};

// Initialize Firebase only once
let app;
if (!firebase.apps.length) {
    app = firebase.initializeApp(firebaseConfig);
} else {
    app = firebase.app();
}

const auth = firebase.auth();
const db = firebase.firestore();

// Simple persistence setup - no aggressive offline detection
try {
    db.enablePersistence({ synchronizeTabs: true })
        .catch((err) => {
            // Just log warnings, don't block functionality
            console.warn('Persistence not enabled:', err.code);
        });
} catch (err) {
    console.warn('Persistence setup failed:', err);
}

let currentUser = null;
let userSettings = {};

// Default settings
const defaultSettings = {
    language: 'en',
    theme: 'light',
    timezone: 'Asia/Kolkata',
    dateFormat: 'DD/MM/YYYY',
    emailNotifications: true,
    pushNotifications: false,
    eventReminders: true,
    marketingEmails: false,
    reminderTiming: '24',
    profileVisibility: 'public',
    showEmail: false,
    showPhone: false,
    analyticsConsent: true,
    defaultDuration: '2',
    defaultTeamSize: 4,
    autoApprove: true,
    defaultVisibility: 'public'
};

// Check authentication
auth.onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = 'login.html';
        return;
    }
    
    currentUser = user;
    
    // Show loading state
    showLoadingState();
    
    try {
        await loadUserSettings();
        hideLoadingState();
    } catch (error) {
        console.error('Error loading settings:', error);
        
        // Handle offline mode gracefully
        if (error.code === 'unavailable') {
            showToast('Working offline - using cached settings', 'info');
        } else {
            showToast('Error loading settings. Using defaults.', 'warning');
        }
        
        // Apply default settings and hide loading
        userSettings = { ...defaultSettings };
        applySettingsToUI();
        applyTheme();
        hideLoadingState();
    }
});

// Load user settings
async function loadUserSettings() {
    try {
        const settingsDoc = await db.collection('userSettings').doc(currentUser.uid).get();
        
        if (settingsDoc.exists) {
            userSettings = { ...defaultSettings, ...settingsDoc.data() };
        } else {
            userSettings = { ...defaultSettings };
            // Save default settings
            await saveSettingsToFirestore();
        }
        
        applySettingsToUI();
        applyTheme();
    } catch (error) {
        console.error('Error loading settings:', error);
        
        // Handle offline mode gracefully
        if (error.code === 'unavailable') {
            console.warn('Settings unavailable in offline mode, using defaults');
            // Try to load from localStorage as fallback
            const cachedSettings = localStorage.getItem('userSettings');
            if (cachedSettings) {
                try {
                    userSettings = { ...defaultSettings, ...JSON.parse(cachedSettings) };
                } catch (parseError) {
                    userSettings = { ...defaultSettings };
                }
            } else {
                userSettings = { ...defaultSettings };
            }
        } else {
            userSettings = { ...defaultSettings };
            showToast('Error loading settings, using defaults', 'warning');
        }
        
        applySettingsToUI();
        applyTheme();
    }
}

// Apply settings to UI
function applySettingsToUI() {
    // General settings
    document.getElementById('language-select').value = userSettings.language;
    document.getElementById('theme-select').value = userSettings.theme;
    document.getElementById('timezone-select').value = userSettings.timezone;
    document.getElementById('date-format-select').value = userSettings.dateFormat;
    
    // Notification settings
    document.getElementById('email-notifications').checked = userSettings.emailNotifications;
    document.getElementById('push-notifications').checked = userSettings.pushNotifications;
    document.getElementById('event-reminders').checked = userSettings.eventReminders;
    document.getElementById('marketing-emails').checked = userSettings.marketingEmails;
    document.getElementById('reminder-timing').value = userSettings.reminderTiming;
    
    // Privacy settings
    document.getElementById('profile-visibility').value = userSettings.profileVisibility;
    document.getElementById('show-email').checked = userSettings.showEmail;
    document.getElementById('show-phone').checked = userSettings.showPhone;
    document.getElementById('analytics-consent').checked = userSettings.analyticsConsent;
    
    // Event settings
    document.getElementById('default-duration').value = userSettings.defaultDuration;
    document.getElementById('default-team-size').value = userSettings.defaultTeamSize;
    document.getElementById('auto-approve').checked = userSettings.autoApprove;
    document.getElementById('default-visibility').value = userSettings.defaultVisibility;
}

// Apply theme
function applyTheme() {
    const theme = userSettings.theme;
    
    if (theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    } else if (theme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
    } else if (theme === 'auto') {
        // Use system preference
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    }
}

function showInfo(message) {
    showToast(message, 'info');
}

// Save settings
window.saveSettings = async function() {
    try {
        // Collect settings from UI
        const newSettings = {
            language: document.getElementById('language-select').value,
            theme: document.getElementById('theme-select').value,
            timezone: document.getElementById('timezone-select').value,
            dateFormat: document.getElementById('date-format-select').value,
            emailNotifications: document.getElementById('email-notifications').checked,
            pushNotifications: document.getElementById('push-notifications').checked,
            eventReminders: document.getElementById('event-reminders').checked,
            marketingEmails: document.getElementById('marketing-emails').checked,
            reminderTiming: document.getElementById('reminder-timing').value,
            profileVisibility: document.getElementById('profile-visibility').value,
            showEmail: document.getElementById('show-email').checked,
            showPhone: document.getElementById('show-phone').checked,
            analyticsConsent: document.getElementById('analytics-consent').checked,
            defaultDuration: document.getElementById('default-duration').value,
            defaultTeamSize: parseInt(document.getElementById('default-team-size').value),
            autoApprove: document.getElementById('auto-approve').checked,
            defaultVisibility: document.getElementById('default-visibility').value,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        userSettings = newSettings;
        
        // Save to localStorage as backup
        localStorage.setItem('userSettings', JSON.stringify(userSettings));
        
        await saveSettingsToFirestore();
        applyTheme();
        
        showToast('Settings saved successfully!', 'success');
        
        // Handle push notifications
        if (newSettings.pushNotifications && !userSettings.pushNotifications) {
            await requestNotificationPermission();
        }
        
    } catch (error) {
        console.error('Error saving settings:', error);
        showToast('Error saving settings', 'error');
    }
};

// Save settings to Firestore
async function saveSettingsToFirestore() {
    try {
        await db.collection('userSettings').doc(currentUser.uid).set(userSettings, { merge: true });
    } catch (error) {
        if (error.code === 'unavailable') {
            console.warn('Settings saved locally, will sync when online');
            // Settings are already saved to localStorage, so this is fine
        } else {
            console.error('Error saving settings to Firestore:', error);
            throw error;
        }
    }
}

// Reset settings to defaults
window.resetSettings = function() {
    if (confirm('Are you sure you want to reset all settings to defaults?')) {
        userSettings = { ...defaultSettings };
        applySettingsToUI();
        applyTheme();
        showToast('Settings reset to defaults', 'info');
    }
};

// Request notification permission
async function requestNotificationPermission() {
    if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            showToast('Push notifications enabled!', 'success');
        } else {
            showToast('Push notifications permission denied', 'warning');
            document.getElementById('push-notifications').checked = false;
        }
    } else {
        showToast('Push notifications not supported', 'warning');
        document.getElementById('push-notifications').checked = false;
    }
}

// Export user data
window.exportUserData = async function() {
    try {
        showToast('Preparing data export...', 'info');
        
        const userData = {
            profile: {},
            events: [],
            settings: userSettings,
            exportDate: new Date().toISOString()
        };

        // Get user profile
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        if (userDoc.exists) {
            userData.profile = userDoc.data();
        }

        // Get user's events
        const eventsSnapshot = await db.collection('events')
            .where('createdBy', '==', currentUser.uid)
            .get();
        
        eventsSnapshot.forEach(doc => {
            userData.events.push({ id: doc.id, ...doc.data() });
        });

        // Create and download file
        const dataStr = JSON.stringify(userData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `gathergenius-data-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        showToast('Data exported successfully!', 'success');
    } catch (error) {
        console.error('Error exporting data:', error);
        showToast('Error exporting data', 'error');
    }
};

// Clear cache
window.clearCache = function() {
    if (confirm('This will clear all cached data. Continue?')) {
        try {
            // Clear localStorage
            localStorage.clear();
            
            // Clear sessionStorage
            sessionStorage.clear();
            
            // Clear IndexedDB (if used)
            if ('indexedDB' in window) {
                indexedDB.deleteDatabase('gathergenius-cache');
            }
            
            showInfo('Cache Cleared');
        } catch (error) {
            console.error('Error clearing cache:', error);
            showInfo('Error clearing cache', 'error');
        }
    }
};

// Delete account modal
window.showDeleteAccountModal = function() {
    document.getElementById('deleteAccountModal').classList.add('show');
};

window.closeDeleteAccountModal = function() {
    document.getElementById('deleteAccountModal').classList.remove('show');
    document.getElementById('delete-account-form').reset();
};

// Confirm delete account
window.confirmDeleteAccount = async function() {
    const confirmation = document.getElementById('delete-confirmation').value;
    const password = document.getElementById('delete-password').value;

    if (confirmation !== 'DELETE') {
        showToast('Please type "DELETE" to confirm', 'error');
        return;
    }

    if (!password) {
        showToast('Please enter your password', 'error');
        return;
    }

    try {
        // Re-authenticate user
        const credential = firebase.auth.EmailAuthProvider.credential(
            currentUser.email,
            password
        );
        await currentUser.reauthenticateWithCredential(credential);

        // Delete user data from Firestore
        const batch = db.batch();
        
        // Delete user profile
        batch.delete(db.collection('users').doc(currentUser.uid));
        
        // Delete user settings
        batch.delete(db.collection('userSettings').doc(currentUser.uid));
        
        // Delete user's events
        const eventsSnapshot = await db.collection('events')
            .where('createdBy', '==', currentUser.uid)
            .get();
        
        eventsSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });

        await batch.commit();

        // Delete Firebase Auth account
        await currentUser.delete();

        showToast('Account deleted successfully', 'success');
        
        // Redirect to home page
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);

    } catch (error) {
        console.error('Error deleting account:', error);
        if (error.code === 'auth/wrong-password') {
            showToast('Incorrect password', 'error');
        } else {
            showToast('Error deleting account', 'error');
        }
    }
};

// Theme change handler
document.getElementById('theme-select').addEventListener('change', (e) => {
    userSettings.theme = e.target.value;
    applyTheme();
});

// Language change handler
document.getElementById('language-select').addEventListener('change', (e) => {
    userSettings.language = e.target.value;
    // In a real app, you would load the appropriate language pack here
    showToast(`Language changed to ${e.target.options[e.target.selectedIndex].text}`, 'info');
});

// Push notification toggle handler
document.getElementById('push-notifications').addEventListener('change', async (e) => {
    if (e.target.checked) {
        await requestNotificationPermission();
    }
});

// Auto-save settings on change
const settingInputs = document.querySelectorAll('select, input[type="checkbox"], input[type="number"]');
settingInputs.forEach(input => {
    input.addEventListener('change', () => {
        // Auto-save after a short delay
        clearTimeout(window.autoSaveTimeout);
        window.autoSaveTimeout = setTimeout(() => {
            saveSettings();
        }, 1000);
    });
});

// Utility functions
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Logout functionality
document.getElementById('logout-btn').addEventListener('click', async () => {
    try {
        await auth.signOut();
        window.location.href = 'login.html';
    } catch (error) {
        console.error('Error signing out:', error);
        showToast('Error signing out', 'error');
    }
});

// Listen for system theme changes
if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (userSettings.theme === 'auto') {
            applyTheme();
        }
    });
}

// Show loading state
function showLoadingState() {
    const settingsSections = document.querySelectorAll('.settings-section');
    settingsSections.forEach(section => {
        section.classList.add('loading');
    });
}

// Hide loading state
function hideLoadingState() {
    const settingsSections = document.querySelectorAll('.settings-section');
    settingsSections.forEach(section => {
        section.classList.remove('loading');
    });
}

// Initialize settings when page loads
document.addEventListener('DOMContentLoaded', () => {
    // Set initial theme to prevent flash
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
});
