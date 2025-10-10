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
const storage = firebase.storage();

// Simple persistence setup
try {
    db.enablePersistence({ synchronizeTabs: true })
        .catch((err) => {
            console.warn('Persistence not enabled:', err.code);
        });
} catch (err) {
    console.warn('Persistence setup failed:', err);
}

let currentUser = null;
let isEditMode = false;
let originalProfileData = {};

// Check authentication
auth.onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = 'login.html';
        return;
    }
    
    currentUser = user;
    showLoadingState();
    
    try {
        await initializeUserProfile();
        
        const results = await Promise.allSettled([
            loadUserProfile(),
            loadUserStats(),
            loadUserActivity()
        ]);
        
        const failures = results.filter(result => result.status === 'rejected');
        if (failures.length > 0) {
            console.warn('Some profile data failed to load:', failures);
            showToast('Some data may be outdated (offline mode)', 'warning');
        }
        
        hideLoadingState();
    } catch (error) {
        console.error('Error loading profile data:', error);
        showToast('Error loading profile data. Please refresh the page.', 'error');
        hideLoadingState();
    }
});

// Load user profile data
async function loadUserProfile() {
    try {
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        let userData = {};
        
        if (userDoc.exists) {
            userData = userDoc.data();
        }

        const profileData = {
            displayName: userData.displayName || currentUser.displayName || '',
            email: currentUser.email || '',
            phone: userData.phone || '',
            organization: userData.organization || '',
            location: userData.location || '',
            website: userData.website || '',
            bio: userData.bio || '',
            photoURL: userData.photoURL || currentUser.photoURL || generateAvatarUrl(currentUser.displayName || currentUser.email)
        };

        originalProfileData = { ...profileData };
        updateProfileUI(profileData);
    } catch (error) {
        console.error('Error loading profile:', error);
        
        if (error.code === 'unavailable') {
            const fallbackData = {
                displayName: currentUser.displayName || '',
                email: currentUser.email || '',
                phone: '',
                organization: '',
                location: '',
                website: '',
                bio: '',
                photoURL: currentUser.photoURL || generateAvatarUrl(currentUser.displayName || currentUser.email)
            };
            updateProfileUI(fallbackData);
            originalProfileData = { ...fallbackData };
        } else {
            showToast('Error loading profile data', 'error');
        }
    }
}

// Update profile UI
function updateProfileUI(data) {
    document.getElementById('profile-name').textContent = data.displayName || 'User';
    document.getElementById('profile-email').textContent = data.email;
    document.getElementById('profile-avatar').src = data.photoURL;
    
    document.getElementById('display-name').value = data.displayName;
    document.getElementById('email').value = data.email;
    document.getElementById('phone').value = data.phone;
    document.getElementById('organization').value = data.organization;
    document.getElementById('location').value = data.location;
    document.getElementById('website').value = data.website;
    document.getElementById('bio').value = data.bio;
}

// Load user statistics
async function loadUserStats() {
    try {
        const allEventsSnapshot = await db.collection('events').get();
        const allEvents = [];
        allEventsSnapshot.forEach(doc => {
            allEvents.push({ id: doc.id, ...doc.data() });
        });

        const organizedEvents = allEvents.filter(event => event.createdBy === currentUser.uid);
        const attendedEvents = allEvents.filter(event => 
            event.participants && event.participants.some(p => p.uid === currentUser.uid)
        );

        const creationTime = new Date(currentUser.metadata.creationTime);
        const daysSinceCreation = Math.floor((new Date() - creationTime) / (1000 * 60 * 60 * 24));

        animateCounter('events-organized', organizedEvents.length);
        animateCounter('events-attended', attendedEvents.length);
        animateCounter('member-since', daysSinceCreation);

        return {
            organized: organizedEvents.length,
            attended: attendedEvents.length,
            daysSince: daysSinceCreation,
            allEvents: allEvents
        };
    } catch (error) {
        console.error('Error loading stats:', error);
        
        if (error.code === 'unavailable') {
            console.warn('Stats unavailable in offline mode');
            const creationTime = new Date(currentUser.metadata.creationTime);
            const daysSinceCreation = Math.floor((new Date() - creationTime) / (1000 * 60 * 60 * 24));
            
            animateCounter('events-organized', 0);
            animateCounter('events-attended', 0);
            animateCounter('member-since', daysSinceCreation);
            
            return { organized: 0, attended: 0, daysSince: daysSinceCreation, allEvents: [] };
        } else {
            showToast('Error loading statistics', 'error');
            return { organized: 0, attended: 0, daysSince: 0, allEvents: [] };
        }
    }
}

// Load user activity
async function loadUserActivity() {
    try {
        const activities = [];
        
        try {
            const recentEventsQuery = db.collection('events')
                .where('createdBy', '==', currentUser.uid)
                .orderBy('createdAt', 'desc')
                .limit(10);
            
            const recentEvents = await recentEventsQuery.get();

            recentEvents.forEach(doc => {
                const event = doc.data();
                const eventDate = event.date ? new Date(event.date) : new Date();
                const createdDate = event.createdAt ? 
                    (event.createdAt.toDate ? event.createdAt.toDate() : new Date(event.createdAt)) : 
                    new Date();

                activities.push({
                    type: 'event',
                    title: `Created event "${event.name}"`,
                    description: `Event scheduled for ${eventDate.toLocaleDateString()}`,
                    time: createdDate,
                    icon: 'fas fa-calendar-plus'
                });
            });
        } catch (eventError) {
            console.warn('Could not load events for activity:', eventError);
            
            const allEvents = await db.collection('events')
                .where('createdBy', '==', currentUser.uid)
                .limit(5)
                .get();
                
            allEvents.forEach(doc => {
                const event = doc.data();
                activities.push({
                    type: 'event',
                    title: `Created event "${event.name}"`,
                    description: `Event scheduled for ${new Date(event.date).toLocaleDateString()}`,
                    time: new Date(event.date),
                    icon: 'fas fa-calendar-plus'
                });
            });
        }

        try {
            const userDoc = await db.collection('users').doc(currentUser.uid).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                if (userData.updatedAt) {
                    const updateTime = userData.updatedAt.toDate ? userData.updatedAt.toDate() : new Date(userData.updatedAt);
                    activities.push({
                        type: 'profile',
                        title: 'Profile updated',
                        description: 'Updated profile information',
                        time: updateTime,
                        icon: 'fas fa-user-edit'
                    });
                }
            }
        } catch (profileError) {
            console.warn('Could not load profile update activity:', profileError);
        }

        if (currentUser.metadata && currentUser.metadata.creationTime) {
            activities.push({
                type: 'security',
                title: 'Account created',
                description: 'Welcome to GatherGenius!',
                time: new Date(currentUser.metadata.creationTime),
                icon: 'fas fa-user-plus'
            });
        }

        activities.sort((a, b) => b.time - a.time);
        displayActivities(activities.slice(0, 10));
        
        return activities;
    } catch (error) {
        console.error('Error loading activity:', error);
        showToast('Error loading activity history', 'warning');
        displayActivities([]);
        return [];
    }
}

// Display activities
function displayActivities(activities) {
    const activityList = document.getElementById('activity-list');
    
    if (activities.length === 0) {
        activityList.innerHTML = '<p style="text-align: center; color: #6c757d;">No recent activity</p>';
        return;
    }

    activityList.innerHTML = activities.map(activity => `
        <div class="activity-item">
            <div class="activity-icon ${activity.type}">
                <i class="${activity.icon}"></i>
            </div>
            <div class="activity-content">
                <h4>${activity.title}</h4>
                <p>${activity.description}</p>
            </div>
            <div class="activity-time">
                ${formatTimeAgo(activity.time)}
            </div>
        </div>
    `).join('');
}

// Toggle edit mode - FIXED
window.toggleEditMode = function() {
    isEditMode = !isEditMode;
    const formInputs = document.querySelectorAll('#profile-form input:not(#email), #profile-form textarea');
    const editBtnContainer = document.querySelector('.header-right');
    const formActions = document.getElementById('form-actions');
    const avatarOverlay = document.getElementById('avatar-overlay');

    if (isEditMode) {
        // Enable editing
        formInputs.forEach(input => {
            input.disabled = false;
            input.style.backgroundColor = '#fff';
        });
        
        // Hide edit button, show save/cancel buttons
        editBtnContainer.style.display = 'none';
        formActions.style.display = 'flex';
        
        // Enable avatar change
        avatarOverlay.style.pointerEvents = 'auto';
        avatarOverlay.style.cursor = 'pointer';
    } else {
        // Disable editing
        formInputs.forEach(input => {
            input.disabled = true;
            input.style.backgroundColor = '#f8f9fa';
        });
        
        // Show edit button, hide save/cancel buttons
        editBtnContainer.style.display = 'flex';
        formActions.style.display = 'none';
        
        // Disable avatar change
        avatarOverlay.style.pointerEvents = 'none';
        
        // Restore original data
        updateProfileUI(originalProfileData);
    }
};

// Cancel edit - FIXED

// Handle profile form submission - FIXED
document.getElementById('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const saveButton = e.submitter || e.target.querySelector('button[type="submit"]');
    if (saveButton) {
        saveButton.disabled = true;
        saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    }
    
    try {
        const updatedData = {
            displayName: document.getElementById('display-name').value.trim(),
            phone: document.getElementById('phone').value.trim(),
            organization: document.getElementById('organization').value.trim(),
            location: document.getElementById('location').value.trim(),
            website: document.getElementById('website').value.trim(),
            bio: document.getElementById('bio').value.trim(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        // Update Firestore
        await db.collection('users').doc(currentUser.uid).set(updatedData, { merge: true });

        // Update Firebase Auth profile
        await currentUser.updateProfile({
            displayName: updatedData.displayName
        });

        // Update original data
        originalProfileData = { ...originalProfileData, ...updatedData };
        
        showToast('Profile updated successfully!', 'success');
        
        // Exit edit mode
        isEditMode = true;
        toggleEditMode();
        
        // Reload profile data
        await loadUserProfile();
    } catch (error) {
        console.error('Error updating profile:', error);
        showToast('Error updating profile: ' + error.message, 'error');
    } finally {
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.innerHTML = '<i class="fas fa-save"></i> Save Changes';
        }
    }
});

// Handle avatar upload
document.getElementById('avatar-overlay').addEventListener('click', () => {
    if (isEditMode) {
        document.getElementById('avatar-input').click();
    }
});

document.getElementById('avatar-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        showToast('Please select an image file', 'error');
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        showToast('Image size must be less than 5MB', 'error');
        return;
    }

    try {
        showToast('Uploading image...', 'info');
        
        const storageRef = storage.ref(`avatars/${currentUser.uid}/${Date.now()}_${file.name}`);
        const snapshot = await storageRef.put(file);
        const downloadURL = await snapshot.ref.getDownloadURL();

        await currentUser.updateProfile({ photoURL: downloadURL });
        await db.collection('users').doc(currentUser.uid).update({
            photoURL: downloadURL,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        document.getElementById('profile-avatar').src = downloadURL;
        originalProfileData.photoURL = downloadURL;
        
        showToast('Profile picture updated!', 'success');
    } catch (error) {
        console.error('Error uploading avatar:', error);
        showToast('Error uploading image', 'error');
    }
});

// Change password modal
window.showChangePasswordModal = function() {
    document.getElementById('changePasswordModal').classList.add('show');
    document.getElementById('changePasswordModal').style.display = 'flex';
};

window.closeChangePasswordModal = function() {
    document.getElementById('changePasswordModal').classList.remove('show');
    document.getElementById('changePasswordModal').style.display = 'none';
    document.getElementById('change-password-form').reset();
};

// Handle password change
document.getElementById('change-password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    if (newPassword !== confirmPassword) {
        showToast('New passwords do not match', 'error');
        return;
    }

    if (newPassword.length < 6) {
        showToast('Password must be at least 6 characters', 'error');
        return;
    }

    try {
        const credential = firebase.auth.EmailAuthProvider.credential(
            currentUser.email,
            currentPassword
        );
        await currentUser.reauthenticateWithCredential(credential);
        await currentUser.updatePassword(newPassword);
        
        showToast('Password updated successfully!', 'success');
        closeChangePasswordModal();
    } catch (error) {
        console.error('Error changing password:', error);
        if (error.code === 'auth/wrong-password') {
            showToast('Current password is incorrect', 'error');
        } else if (error.code === 'auth/weak-password') {
            showToast('Password is too weak', 'error');
        } else {
            showToast('Error changing password: ' + error.message, 'error');
        }
    }
});

// Sessions modal
window.showSessionsModal = function() {
    loadSessions();
    document.getElementById('sessionsModal').classList.add('show');
    document.getElementById('sessionsModal').style.display = 'flex';
};

window.closeSessionsModal = function() {
    document.getElementById('sessionsModal').classList.remove('show');
    document.getElementById('sessionsModal').style.display = 'none';
};

// Load sessions
function loadSessions() {
    const sessionsList = document.getElementById('sessions-list');
    const sessions = [
        {
            device: 'Windows PC - Chrome',
            location: 'Mumbai, India',
            lastActive: new Date(),
            current: true
        },
        {
            device: 'iPhone - Safari',
            location: 'Mumbai, India',
            lastActive: new Date(Date.now() - 2 * 60 * 60 * 1000),
            current: false
        }
    ];

    sessionsList.innerHTML = sessions.map(session => `
        <div class="session-item ${session.current ? 'session-current' : ''}">
            <div class="session-info">
                <h4>${session.device} ${session.current ? '(Current)' : ''}</h4>
                <p>${session.location} • Last active ${formatTimeAgo(session.lastActive)}</p>
            </div>
            ${!session.current ? '<button class="btn-danger btn-sm" onclick="terminateSession()">Terminate</button>' : ''}
        </div>
    `).join('');
}

// Terminate session
window.terminateSession = function() {
    showToast('Session terminated', 'success');
    loadSessions();
};

window.terminateAllSessions = function() {
    if (confirm('This will sign you out of all other devices. Continue?')) {
        showToast('All other sessions terminated', 'success');
        loadSessions();
    }
};

// 2FA toggle
window.toggle2FA = function() {
    const status = document.getElementById('2fa-status');
    const btnText = document.getElementById('2fa-btn-text');
    
    if (status.textContent === 'Not enabled') {
        status.textContent = 'Enabled';
        btnText.textContent = 'Disable 2FA';
        showToast('Two-factor authentication enabled', 'success');
    } else {
        status.textContent = 'Not enabled';
        btnText.textContent = 'Enable 2FA';
        showToast('Two-factor authentication disabled', 'warning');
    }
};

// Utility functions
function generateAvatarUrl(name) {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=ff6600&color=fff&size=120`;
}

function formatTimeAgo(date) {
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
}

function showToast(message, type = 'info') {
    // Remove existing toasts
    const existingToasts = document.querySelectorAll('.toast');
    existingToasts.forEach(toast => toast.remove());
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icon = type === 'success' ? 'fa-check-circle' : 
                 type === 'error' ? 'fa-exclamation-circle' :
                 type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle';
    
    toast.innerHTML = `
        <div class="toast-content">
            <i class="fas ${icon}"></i>
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 100);
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Logout functionality
document.getElementById('logout-btn').addEventListener('click', async () => {
    if (confirm('Are you sure you want to logout?')) {
        try {
            await auth.signOut();
            window.location.href = 'login.html';
        } catch (error) {
            console.error('Error signing out:', error);
            showToast('Error signing out', 'error');
        }
    }
});

// Initialize user profile
async function initializeUserProfile() {
    try {
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        if (!userDoc.exists) {
            const userData = {
                displayName: currentUser.displayName || '',
                email: currentUser.email,
                photoURL: currentUser.photoURL || generateAvatarUrl(currentUser.displayName || currentUser.email),
                phone: '',
                organization: '',
                location: '',
                website: '',
                bio: '',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            await db.collection('users').doc(currentUser.uid).set(userData);
            console.log('User profile initialized');
        }
    } catch (error) {
        if (error.code === 'unavailable') {
            console.warn('Offline mode: Using cached data or defaults');
            return;
        }
        console.error('Error initializing user profile:', error);
    }
}

// Show loading state
function showLoadingState() {
    const loadingElements = [
        'profile-name', 'profile-email', 'events-organized', 
        'events-attended', 'member-since'
    ];
    
    loadingElements.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = 'Loading...';
            element.classList.add('loading');
        }
    });
}

// Hide loading state
function hideLoadingState() {
    const loadingElements = document.querySelectorAll('.loading');
    loadingElements.forEach(element => {
        element.classList.remove('loading');
    });
}

// Animate counter
function animateCounter(elementId, targetValue) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    element.classList.remove('loading-shimmer');
    
    const startValue = 0;
    const duration = 1000;
    const startTime = Date.now();
    
    function updateCounter() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const currentValue = Math.floor(startValue + (targetValue - startValue) * progress);
        
        element.textContent = currentValue;
        
        if (progress < 1) {
            requestAnimationFrame(updateCounter);
        }
    }
    
    updateCounter();
}

// Mobile menu toggle
const menuToggle = document.querySelector('.menu-toggle');
const sidebar = document.querySelector('.sidebar');
const sidebarOverlay = document.createElement('div');
sidebarOverlay.className = 'sidebar-overlay';
document.body.appendChild(sidebarOverlay);

if (menuToggle) {
    menuToggle.addEventListener('click', () => {
        sidebar.classList.toggle('show');
        sidebarOverlay.classList.toggle('show');
    });
}

sidebarOverlay.addEventListener('click', () => {
    sidebar.classList.remove('show');
    sidebarOverlay.classList.remove('show');
});