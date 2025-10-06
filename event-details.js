// Firebase configuration - MUST MATCH dashboard.js
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

// Enable offline persistence with better error handling and cleanup
async function initializePersistence() {
    try {
        await db.enablePersistence({ synchronizeTabs: true });
        console.log('Offline persistence enabled');
    } catch (err) {
        if (err.code === 'failed-precondition') {
            console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
        } else if (err.code === 'unimplemented') {
            console.warn('The current browser does not support offline persistence');
        } else if (err.message && err.message.includes('newer version')) {
            console.warn('Clearing incompatible Firestore cache...');
            // Clear IndexedDB to resolve version conflicts
            try {
                await clearFirestoreCache();
                // Try persistence again after clearing cache
                await db.enablePersistence({ synchronizeTabs: true });
                console.log('Offline persistence enabled after cache clear');
            } catch (retryErr) {
                console.warn('Persistence disabled after cache clear:', retryErr.message);
            }
        } else {
            console.warn('Offline persistence error:', err.message);
        }
    }
}

// Clear Firestore IndexedDB cache
async function clearFirestoreCache() {
    if ('indexedDB' in window) {
        try {
            // List of possible Firestore database names
            const dbNames = [
                'firestore/notifyme-events/(default)',
                'firestore_v1_notifyme-events_(default)',
                'firebase-heartbeat-database',
                'firebase-installations-database'
            ];
            
            for (const dbName of dbNames) {
                try {
                    await new Promise((resolve, reject) => {
                        const deleteReq = indexedDB.deleteDatabase(dbName);
                        deleteReq.onsuccess = () => resolve();
                        deleteReq.onerror = () => reject(deleteReq.error);
                        deleteReq.onblocked = () => {
                            console.warn(`Deletion of ${dbName} blocked`);
                            resolve(); // Continue anyway
                        };
                    });
                    console.log(`Cleared database: ${dbName}`);
                } catch (dbErr) {
                    console.warn(`Could not clear ${dbName}:`, dbErr);
                }
            }
        } catch (error) {
            console.warn('Error clearing Firestore cache:', error);
        }
    }
}

// Initialize persistence
initializePersistence();

let currentEvent = null;
let currentUser = null;
const eventId = new URLSearchParams(window.location.search).get('id');

// Check if event ID exists in URL
if (!eventId) {
    window.location.href = 'dashboard.html';
}

// Check authentication and load event data
auth.onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = 'login.html';
        return;
    }
    
    currentUser = user;
    
    // Show loading state
    showLoadingState();
    
    try {
        await loadEventDetails();
        hideLoadingState();
    } catch (error) {
        console.error('Error loading event details:', error);
        
        // Handle offline mode gracefully
        if (error.code === 'unavailable') {
            showError('Working offline - some data may be outdated');
        } else {
            showError('Error loading event details. Please refresh the page.');
        }
        hideLoadingState();
    }
});

// Load event details
async function loadEventDetails() {
    try {
        const eventDoc = await db.collection('events').doc(eventId).get();
        if (eventDoc.exists) {
            currentEvent = { id: eventDoc.id, ...eventDoc.data() };
            displayEventDetails(currentEvent);
            updateUIForUserRole();
        } else {
            showError('Event not found');
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 2000);
        }
    } catch (error) {
        console.error('Error loading event:', error);
        
        // Handle offline mode gracefully
        if (error.code === 'unavailable') {
            showError('Working offline - event details unavailable. Please check your connection.');
            // Show a retry button instead of redirecting
            showOfflineRetryOption();
        } else {
            showError('Error loading event details');
        }
        throw error; // Re-throw to be caught by the caller
    }
}

// Update UI based on user role (organizer vs participant)
function updateUIForUserRole() {
    const isOrganizer = currentUser && currentEvent.createdBy === currentUser.uid;
    const eventActions = document.querySelector('.event-actions');
    
    if (eventActions) {
        eventActions.style.display = isOrganizer ? 'flex' : 'none';
    }
}

// Display event details
function displayEventDetails(event) {
    document.getElementById('event-title').textContent = event.name;
    const eventDate = new Date(event.date);
    const now = new Date();
    const status = eventDate > now ? 'upcoming' : (eventDate.toDateString() === now.toDateString() ? 'in-progress' : 'completed');
    
    const statusElement = document.getElementById('event-status');
    statusElement.textContent = status.charAt(0).toUpperCase() + status.slice(1);
    statusElement.className = `event-status ${status}`;

    document.getElementById('event-datetime').textContent = new Date(event.date).toLocaleString();
    document.getElementById('event-location').textContent = event.location;
    document.getElementById('event-team-size').textContent = `${event.teamSize} members`;
    document.getElementById('event-cost').textContent = `₹${event.cost}`;
    document.getElementById('event-description').textContent = event.description;

    loadParticipants(event.participants || []);
    updateRegistrationStatus(event);
}

// Load participants
function loadParticipants(participants) {
    const participantsList = document.getElementById('participants-list');
    participantsList.innerHTML = '';

    if (participants.length === 0) {
        participantsList.innerHTML = '<p class="no-participants">No participants registered yet.</p>';
        return;
    }

    participants.forEach(participant => {
        const participantCard = document.createElement('div');
        participantCard.className = 'participant-card';
        participantCard.innerHTML = `
            <img class="participant-avatar" src="${participant.photoURL || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(participant.name)}" alt="${participant.name}">
            <div class="participant-info">
                <h4>${participant.name}</h4>
                <p>${participant.email}</p>
                ${participant.registeredAt ? `<small>Registered: ${new Date(participant.registeredAt).toLocaleDateString()}</small>` : ''}
            </div>
        `;
        participantsList.appendChild(participantCard);
    });
}

// Update registration status
function updateRegistrationStatus(event) {
    const registrationStatus = document.getElementById('registration-status');
    const eventDate = new Date(event.date);
    const now = new Date();
    const isOrganizer = currentUser && event.createdBy === currentUser.uid;
    
    // Generate registration URL
    const baseUrl = window.location.origin + window.location.pathname.replace('event-details.html', '');
    const registrationUrl = `${baseUrl}registration.html?eventId=${eventId}`;

    if (isOrganizer) {
        const participants = event.participants || [];
        const maxParticipants = event.teamSize * (event.maxTeams || 10);
        registrationStatus.innerHTML = `
            <div class="organizer-info">
                <p class="registration-info">Total registered: ${participants.length} / ${maxParticipants}</p>
                <div class="registration-url-section">
                    <h4>Registration Link</h4>
                    <div class="url-copy-container">
                        <input type="text" id="registration-url" value="${registrationUrl}" readonly>
                        <button class="btn-primary" onclick="copyRegistrationUrl()">
                            <i class="fas fa-copy"></i> Copy Link
                        </button>
                    </div>
                    <p class="url-hint">Share this link with participants to register</p>
                </div>
            </div>
        `;
        return;
    }

    if (eventDate < now) {
        registrationStatus.innerHTML = '<p class="registration-closed">Registration closed</p>';
    } else {
        const maxParticipants = event.teamSize * (event.maxTeams || 10);
        const currentParticipants = (event.participants || []).length;
        const spotsLeft = maxParticipants - currentParticipants;
        const isRegistered = event.participants?.some(p => p.uid === currentUser.uid);

        if (isRegistered) {
            registrationStatus.innerHTML = '<p class="registration-success">✓ You are registered for this event</p>';
        } else if (spotsLeft > 0) {
            registrationStatus.innerHTML = `
                <p class="registration-open">Registration open - ${spotsLeft} spots left</p>
                <button class="btn-primary" onclick="registerForEvent()">Register Now</button>
            `;
        } else {
            registrationStatus.innerHTML = '<p class="registration-closed">Event is full</p>';
        }
    }
}

// Copy registration URL
window.copyRegistrationUrl = function() {
    const urlInput = document.getElementById('registration-url');
    urlInput.select();
    urlInput.setSelectionRange(0, 99999);
    document.execCommand('copy');
    showSuccess('Registration link copied to clipboard!');
};

// Show edit event modal
window.showEditEventModal = function() {
    if (!currentUser || currentEvent.createdBy !== currentUser.uid) {
        showError('Only the event organizer can edit this event');
        return;
    }

    const modal = document.getElementById('editEventModal');
    const form = document.getElementById('editEventForm');

    document.getElementById('editEventName').value = currentEvent.name;
    document.getElementById('editEventDate').value = new Date(currentEvent.date).toISOString().slice(0, 16);
    document.getElementById('editEventLocation').value = currentEvent.location;
    document.getElementById('editTeamSize').value = currentEvent.teamSize;
    document.getElementById('editEventCost').value = currentEvent.cost;
    document.getElementById('editEventDescription').value = currentEvent.description;

    modal.classList.add('show');

    form.onsubmit = null;
    form.onsubmit = async (e) => {
        e.preventDefault();
        await updateEvent();
    };
};

// Update event
async function updateEvent() {
    if (!currentUser || currentEvent.createdBy !== currentUser.uid) {
        showError('Only the event organizer can update this event');
        return;
    }

    try {
        const updatedEvent = {
            name: document.getElementById('editEventName').value,
            date: document.getElementById('editEventDate').value,
            location: document.getElementById('editEventLocation').value,
            teamSize: parseInt(document.getElementById('editTeamSize').value),
            cost: parseFloat(document.getElementById('editEventCost').value),
            description: document.getElementById('editEventDescription').value,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('events').doc(eventId).update(updatedEvent);
        
        closeEditEventModal();
        await loadEventDetails();
        showSuccess('Event updated successfully!');
    } catch (error) {
        console.error('Error updating event:', error);
        showError('Error updating event');
    }
}

// Delete event
window.deleteEvent = async function() {
    if (!currentUser || currentEvent.createdBy !== currentUser.uid) {
        showError('Only the event organizer can delete this event');
        closeDeleteConfirmModal();
        return;
    }

    try {
        await db.collection('events').doc(eventId).delete();
        closeDeleteConfirmModal();
        showSuccess('Event deleted successfully!');
        
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1500);
    } catch (error) {
        console.error('Error deleting event:', error);
        showError('Error deleting event');
    }
};

// Show/hide messages
function showError(message) {
    const toast = document.createElement('div');
    toast.className = 'toast error';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function showSuccess(message) {
    const toast = document.createElement('div');
    toast.className = 'toast success';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// Modal controls
window.closeEditEventModal = function() {
    document.getElementById('editEventModal').classList.remove('show');
};

window.confirmDeleteEvent = function() {
    if (!currentUser || currentEvent.createdBy !== currentUser.uid) {
        showError('Only the event organizer can delete this event');
        return;
    }
    document.getElementById('deleteConfirmModal').classList.add('show');
};

window.closeDeleteConfirmModal = function() {
    document.getElementById('deleteConfirmModal').classList.remove('show');
};

// Register for event
window.registerForEvent = async function() {
    try {
        const user = auth.currentUser;
        if (!user) {
            showError('Please sign in to register');
            return;
        }

        if (currentEvent.createdBy === user.uid) {
            showError('Event organizers cannot register for their own events');
            return;
        }

        const eventRef = db.collection('events').doc(eventId);
        const eventDoc = await eventRef.get();
        
        if (!eventDoc.exists) {
            showError('Event not found');
            return;
        }

        const event = eventDoc.data();
        const participants = event.participants || [];

        if (participants.some(p => p.uid === user.uid)) {
            showError('You are already registered for this event');
            return;
        }

        const maxParticipants = event.teamSize * (event.maxTeams || 10);
        if (participants.length >= maxParticipants) {
            showError('Event is full');
            return;
        }

        const eventDate = new Date(event.date);
        if (eventDate < new Date()) {
            showError('Cannot register for past events');
            return;
        }

        participants.push({
            uid: user.uid,
            name: user.displayName || user.email.split('@')[0],
            email: user.email,
            photoURL: user.photoURL,
            registeredAt: new Date().toISOString()
        });

        await eventRef.update({ participants });
        
        await loadEventDetails();
        showSuccess('Successfully registered for event!');
    } catch (error) {
        console.error('Error registering for event:', error);
        showError('Error registering for event');
    }
};

// Show loading state
function showLoadingState() {
    const loadingElements = [
        'event-title', 'event-datetime', 'event-location', 
        'event-team-size', 'event-cost', 'event-description'
    ];
    
    loadingElements.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = 'Loading...';
            element.classList.add('loading');
        }
    });
    
    // Show loading for participants list
    const participantsList = document.getElementById('participants-list');
    if (participantsList) {
        participantsList.innerHTML = '<div class="loading-placeholder">Loading participants...</div>';
    }
    
    // Show loading for registration status
    const registrationStatus = document.getElementById('registration-status');
    if (registrationStatus) {
        registrationStatus.innerHTML = '<div class="loading-placeholder">Loading registration info...</div>';
    }
}

// Hide loading state
function hideLoadingState() {
    const loadingElements = document.querySelectorAll('.loading');
    loadingElements.forEach(element => {
        element.classList.remove('loading');
    });
    
    // Remove loading placeholders
    const loadingPlaceholders = document.querySelectorAll('.loading-placeholder');
    loadingPlaceholders.forEach(placeholder => {
        placeholder.remove();
    });
}

// Show offline retry option
function showOfflineRetryOption() {
    const eventContent = document.querySelector('.event-details-content');
    if (eventContent) {
        eventContent.innerHTML = `
            <div class="error-state">
                <i class="fas fa-wifi"></i>
                <h2>Working Offline</h2>
                <p>Event details cannot be loaded while offline.</p>
                <p>Please check your internet connection and try again.</p>
                <button class="retry-btn" onclick="retryLoadEvent()">
                    <i class="fas fa-redo"></i> Retry
                </button>
                <button class="btn-secondary" onclick="window.location.href='dashboard.html'" style="margin-left: 10px;">
                    <i class="fas fa-arrow-left"></i> Back to Dashboard
                </button>
            </div>
        `;
    }
}

// Retry loading event
window.retryLoadEvent = async function() {
    showLoadingState();
    try {
        await loadEventDetails();
        hideLoadingState();
    } catch (error) {
        console.error('Retry failed:', error);
        if (error.code === 'unavailable') {
            showError('Still offline - please check your connection');
        } else {
            showError('Error loading event details');
        }
        hideLoadingState();
    }
};

// Logout
document.addEventListener('DOMContentLoaded', () => {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                await auth.signOut();
                window.location.href = 'login.html';
            } catch (error) {
                console.error('Error signing out:', error);
                showError('Error signing out');
            }
        });
    }
});