// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCKd_iH-McAMrKI_0YDoYG0xjn2KrQpTOQ",
    authDomain: "notifyme-events.firebaseapp.com",
    projectId: "notifyme-events",
    storageBucket: "notifyme-events.appspot.com",
    messagingSenderId: "761571632545",
    appId: "1:761571632545:web:547a7210fdebf366df97e0",
    measurementId: "G-309BJ6P79V"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

let currentEvent = null;
let currentUser = null;
const eventId = new URLSearchParams(window.location.search).get('id');

// Check if event ID exists
if (!eventId) {
    console.error('No event ID provided');
    showError('No event ID provided. Redirecting to dashboard...');
    setTimeout(() => window.location.href = 'dashboard.html', 2000);
}

// Check authentication and load event
auth.onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = 'login.html';
        return;
    }
    
    currentUser = user;
    showLoadingState();
    
    try {
        await loadEventDetails();
        hideLoadingState();
    } catch (error) {
        console.error('Error loading event:', error);
        showError('Error loading event details: ' + error.message);
        hideLoadingState();
    }
});

// Load event details from Firestore
async function loadEventDetails() {
    console.log('Loading event details for ID:', eventId);
    try {
        const doc = await db.collection('events').doc(eventId).get();
        
        if (doc.exists) {
            currentEvent = { id: doc.id, ...doc.data() };
            console.log('Event data loaded:', currentEvent);
            displayEventDetails(currentEvent);
            updateUIForUserRole();
        } else {
            console.error('Event not found');
            showError('Event not found');
            setTimeout(() => window.location.href = 'dashboard.html', 2000);
        }
    } catch (error) {
        console.error('Error loading event:', error);
        showError('Error loading event: ' + error.message);
        throw error;
    }
}

// Update UI based on user role
function updateUIForUserRole() {
    const isOrganizer = currentUser && currentEvent.createdBy === currentUser.uid;
    const eventActions = document.querySelector('.event-actions');
    
    if (eventActions) {
        eventActions.style.display = isOrganizer ? 'flex' : 'none';
    }
}

// Display event details
function displayEventDetails(event) {
    document.getElementById('event-title').textContent = event.name || 'Untitled Event';
    
    const eventDate = new Date(event.date);
    const now = new Date();
    const status = eventDate > now ? 'upcoming' : 
                   (eventDate.toDateString() === now.toDateString() ? 'in-progress' : 'completed');
    
    const statusElement = document.getElementById('event-status');
    statusElement.textContent = status.charAt(0).toUpperCase() + status.slice(1);
    statusElement.className = `event-status ${status}`;

    document.getElementById('event-datetime').textContent = new Date(event.date).toLocaleString('en-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    document.getElementById('event-location').textContent = event.location || 'Not specified';
    document.getElementById('event-team-size').textContent = `${event.teamSize || 0} members`;
    document.getElementById('event-cost').textContent = `₹${event.cost || 0}`;
    document.getElementById('event-description').textContent = event.description || 'No description provided';

    loadParticipants(event.participants || []);
    updateRegistrationStatus(event);
}

// Load participants
function loadParticipants(participants) {
    const participantsList = document.getElementById('participants-list');
    
    if (participants.length === 0) {
        participantsList.innerHTML = '<p class="no-participants">No participants registered yet.</p>';
        return;
    }

    participantsList.innerHTML = participants.map(participant => `
        <div class="participant-card">
            <img class="participant-avatar" src="${participant.photoURL || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(participant.name)}" alt="${participant.name}">
            <div class="participant-info">
                <h4>${participant.name}</h4>
                <p>${participant.email}</p>
                ${participant.registeredAt ? `<small>Registered: ${new Date(participant.registeredAt).toLocaleDateString()}</small>` : ''}
            </div>
        </div>
    `).join('');
}

// Update registration status
function updateRegistrationStatus(event) {
    const registrationStatus = document.getElementById('registration-status');
    const eventDate = new Date(event.date);
    const now = new Date();
    const isOrganizer = currentUser && event.createdBy === currentUser.uid;
    
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
window.editEventModal = function() {
    if (!currentUser || !currentEvent || currentEvent.createdBy !== currentUser.uid) {
        showError('Only the event organizer can edit this event');
        return;
    }

    const modal = document.getElementById('editEventModal');
    
    // Populate form fields
    document.getElementById('editEventName').value = currentEvent.name || '';
    document.getElementById('editEventDate').value = currentEvent.date ? 
        new Date(currentEvent.date).toISOString().slice(0, 16) : '';
    document.getElementById('editEventLocation').value = currentEvent.location || '';
    document.getElementById('editTeamSize').value = currentEvent.teamSize || '';
    document.getElementById('editEventCost').value = currentEvent.cost || '';
    document.getElementById('editEventDescription').value = currentEvent.description || '';

    modal.style.display = 'flex';
};

// Close edit modal
window.closeEditEventModal = function() {
    document.getElementById('editEventModal').style.display = 'none';
};

// Handle edit form submission
document.addEventListener('DOMContentLoaded', () => {
    const editForm = document.getElementById('editEventForm');
    if (editForm) {
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await updateEvent();
        });
    }

    // Initialize logout
    initializeLogout();
    initializeSidebar();
});

// Update event in Firestore
async function updateEvent() {
    if (!currentUser || !currentEvent || currentEvent.createdBy !== currentUser.uid) {
        showError('Only the event organizer can update this event');
        return;
    }

    const submitButton = document.querySelector('#editEventForm button[type="submit"]');
    const originalText = submitButton.innerHTML;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
    submitButton.disabled = true;

    try {
        const updatedData = {
            name: document.getElementById('editEventName').value,
            date: document.getElementById('editEventDate').value,
            location: document.getElementById('editEventLocation').value,
            teamSize: parseInt(document.getElementById('editTeamSize').value),
            cost: parseFloat(document.getElementById('editEventCost').value),
            description: document.getElementById('editEventDescription').value,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('events').doc(eventId).update(updatedData);
        
        closeEditEventModal();
        showSuccess('Event updated successfully!');
        await loadEventDetails();
    } catch (error) {
        console.error('Error updating event:', error);
        showError('Error updating event: ' + error.message);
    } finally {
        submitButton.innerHTML = originalText;
        submitButton.disabled = false;
    }
}

// Show delete confirmation modal
window.deleteConfirmModal = function() {
    if (!currentUser || !currentEvent || currentEvent.createdBy !== currentUser.uid) {
        showError('Only the event organizer can delete this event');
        return;
    }
    document.getElementById('deleteConfirmModal').style.display = 'flex';
};

// Close delete modal
window.closeDeleteConfirmModal = function() {
    document.getElementById('deleteConfirmModal').style.display = 'none';
};

// Delete event from Firestore
window.deleteEvent = async function() {
    if (!currentUser || !currentEvent || currentEvent.createdBy !== currentUser.uid) {
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
        showError('Error deleting event: ' + error.message);
    }
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

        const participants = currentEvent.participants || [];

        if (participants.some(p => p.uid === user.uid)) {
            showError('You are already registered for this event');
            return;
        }

        const maxParticipants = currentEvent.teamSize * (currentEvent.maxTeams || 10);
        if (participants.length >= maxParticipants) {
            showError('Event is full');
            return;
        }

        const eventDate = new Date(currentEvent.date);
        if (eventDate < new Date()) {
            showError('Cannot register for past events');
            return;
        }

        const newParticipant = {
            uid: user.uid,
            name: user.displayName || user.email.split('@')[0],
            email: user.email,
            photoURL: user.photoURL,
            registeredAt: new Date().toISOString()
        };

        await db.collection('events').doc(eventId).update({
            participants: firebase.firestore.FieldValue.arrayUnion(newParticipant)
        });
        
        await loadEventDetails();
        showSuccess('Successfully registered for event!');
    } catch (error) {
        console.error('Error registering for event:', error);
        showError('Error registering for event: ' + error.message);
    }
};

// Show/hide loading state
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
}

function hideLoadingState() {
    const loadingElements = document.querySelectorAll('.loading');
    loadingElements.forEach(element => {
        element.classList.remove('loading');
    });
}

// Toast notifications
function showError(message) {
    showToast(message, 'error');
}

function showSuccess(message) {
    showToast(message, 'success');
}

function showToast(message, type = 'info') {
    const existingToasts = document.querySelectorAll('.toast');
    existingToasts.forEach(toast => toast.remove());
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <div class="toast-content">
            <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
            <span>${message}</span>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        if (toast.parentElement) {
            toast.remove();
        }
    }, 5000);
}

// Initialize logout functionality
function initializeLogout() {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                await auth.signOut();
                sessionStorage.clear();
                window.location.href = 'login.html';
            } catch (error) {
                console.error('Error signing out:', error);
                showError('Error signing out');
            }
        });
    }
}

// Sidebar toggle
function initializeSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const menuToggle = document.querySelector('.menu-toggle');
    const dashboardContainer = document.querySelector('.dashboard-container');
    
    if (!sidebar || !dashboardContainer) return;
    
    const overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    dashboardContainer.appendChild(overlay);
    
    function toggleSidebar() {
        sidebar.classList.toggle('active');
        overlay.classList.toggle('active');
        document.body.style.overflow = sidebar.classList.contains('active') ? 'hidden' : '';
    }
    
    function closeSidebar() {
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
        document.body.style.overflow = '';
    }
    
    if (menuToggle) {
        menuToggle.addEventListener('click', toggleSidebar);
    }
    
    overlay.addEventListener('click', closeSidebar);
    
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            if (window.innerWidth <= 1024) {
                closeSidebar();
            }
        });
    });
    
    window.addEventListener('resize', () => {
        if (window.innerWidth > 1024) {
            closeSidebar();
        }
    });
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && sidebar.classList.contains('active')) {
            closeSidebar();
        }
    });
}