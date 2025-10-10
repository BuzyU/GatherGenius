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
    showError('No event ID provided. Redirecting to events...');
    setTimeout(() => window.location.href = 'events.html', 2000);
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
            setTimeout(() => window.location.href = 'events.html', 2000);
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
    const organizerActions = document.getElementById('organizer-actions');
    
    if (organizerActions) {
        organizerActions.style.display = isOrganizer ? 'flex' : 'none';
    }
    
    // Update participants section visibility
    const participantsSection = document.getElementById('participants-section');
    if (participantsSection) {
        // Only organizer can see all participants
        participantsSection.style.display = isOrganizer ? 'block' : 'none';
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
    statusElement.textContent = status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ');
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

    // Update participant count
    const participantCount = (event.participants || []).length;
    document.getElementById('participant-count').textContent = participantCount;

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
                ${participant.registeredAt ? `<small>Registered: ${new Date(participant.registeredAt).toLocaleDateString('en-IN')}</small>` : ''}
            </div>
        </div>
    `).join('');
}

// Download participants as Excel (Organizer only)
window.downloadParticipants = function() {
    if (!currentUser || !currentEvent || currentEvent.createdBy !== currentUser.uid) {
        showError('Only the event organizer can download participant data');
        return;
    }

    const participants = currentEvent.participants || [];
    
    if (participants.length === 0) {
        showError('No participants to download');
        return;
    }

    try {
        // Prepare data for Excel
        const excelData = participants.map((participant, index) => ({
            'S.No': index + 1,
            'Name': participant.name || 'N/A',
            'Email': participant.email || 'N/A',
            'Phone': participant.phone || 'N/A',
            'Registered On': participant.registeredAt ? 
                new Date(participant.registeredAt).toLocaleDateString('en-IN') : 'N/A',
            'Time': participant.registeredAt ? 
                new Date(participant.registeredAt).toLocaleTimeString('en-IN') : 'N/A'
        }));

        // Create worksheet
        const worksheet = XLSX.utils.json_to_sheet(excelData);
        
        // Set column widths
        const columnWidths = [
            { wch: 8 },  // S.No
            { wch: 25 }, // Name
            { wch: 30 }, // Email
            { wch: 15 }, // Phone
            { wch: 15 }, // Registered On
            { wch: 15 }  // Time
        ];
        worksheet['!cols'] = columnWidths;

        // Create workbook
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Participants');

        // Add event info sheet
        const eventInfo = [
            { 'Field': 'Event Name', 'Value': currentEvent.name },
            { 'Field': 'Date', 'Value': new Date(currentEvent.date).toLocaleDateString('en-IN') },
            { 'Field': 'Time', 'Value': new Date(currentEvent.date).toLocaleTimeString('en-IN') },
            { 'Field': 'Location', 'Value': currentEvent.location },
            { 'Field': 'Team Size', 'Value': currentEvent.teamSize },
            { 'Field': 'Cost', 'Value': `₹${currentEvent.cost}` },
            { 'Field': 'Total Participants', 'Value': participants.length },
            { 'Field': 'Downloaded On', 'Value': new Date().toLocaleString('en-IN') }
        ];
        const infoSheet = XLSX.utils.json_to_sheet(eventInfo);
        infoSheet['!cols'] = [{ wch: 20 }, { wch: 40 }];
        XLSX.utils.book_append_sheet(workbook, infoSheet, 'Event Info');

        // Generate filename
        const sanitizedEventName = currentEvent.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const timestamp = new Date().toISOString().slice(0, 10);
        const filename = `${sanitizedEventName}_participants_${timestamp}.xlsx`;

        // Download file
        XLSX.writeFile(workbook, filename);
        
        showSuccess(`Downloaded ${participants.length} participants successfully!`);
    } catch (error) {
        console.error('Error downloading participants:', error);
        showError('Error creating Excel file: ' + error.message);
    }
};

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
                <p class="registration-info"><strong>Total registered:</strong> ${participants.length} / ${maxParticipants}</p>
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
    
    // Modern clipboard API
    if (navigator.clipboard) {
        navigator.clipboard.writeText(urlInput.value).then(() => {
            showSuccess('Registration link copied to clipboard!');
        }).catch(() => {
            // Fallback
            document.execCommand('copy');
            showSuccess('Registration link copied to clipboard!');
        });
    } else {
        document.execCommand('copy');
        showSuccess('Registration link copied to clipboard!');
    }
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
    
    // Convert date to datetime-local format
    if (currentEvent.date) {
        const eventDate = new Date(currentEvent.date);
        const localDateTime = new Date(eventDate.getTime() - (eventDate.getTimezoneOffset() * 60000))
            .toISOString()
            .slice(0, 16);
        document.getElementById('editEventDate').value = localDateTime;
    }
    
    document.getElementById('editEventLocation').value = currentEvent.location || '';
    document.getElementById('editTeamSize').value = currentEvent.teamSize || '';
    document.getElementById('editEventCost').value = currentEvent.cost || '';
    document.getElementById('editEventDescription').value = currentEvent.description || '';

    modal.classList.add('show');
    modal.style.display = 'flex';
};

// Close edit modal
window.closeEditEventModal = function() {
    const modal = document.getElementById('editEventModal');
    modal.classList.remove('show');
    modal.style.display = 'none';
    document.getElementById('editEventForm').reset();
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
        const name = document.getElementById('editEventName').value.trim();
        const date = document.getElementById('editEventDate').value;
        const location = document.getElementById('editEventLocation').value.trim();
        const teamSize = parseInt(document.getElementById('editTeamSize').value);
        const cost = parseFloat(document.getElementById('editEventCost').value);
        const description = document.getElementById('editEventDescription').value.trim();

        // Validation
        if (!name || !date || !location || !teamSize || teamSize < 1) {
            showError('Please fill all required fields correctly');
            return;
        }

        const updatedData = {
            name,
            date,
            location,
            teamSize,
            cost,
            description,
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
    const modal = document.getElementById('deleteConfirmModal');
    modal.classList.add('show');
    modal.style.display = 'flex';
};

// Close delete modal
window.closeDeleteConfirmModal = function() {
    const modal = document.getElementById('deleteConfirmModal');
    modal.classList.remove('show');
    modal.style.display = 'none';
};

// Delete event from Firestore
window.deleteEvent = async function() {
    if (!currentUser || !currentEvent || currentEvent.createdBy !== currentUser.uid) {
        showError('Only the event organizer can delete this event');
        closeDeleteConfirmModal();
        return;
    }

    const deleteButton = document.querySelector('#deleteConfirmModal .btn-danger');
    const originalText = deleteButton.innerHTML;
    deleteButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
    deleteButton.disabled = true;

    try {
        await db.collection('events').doc(eventId).delete();
        closeDeleteConfirmModal();
        showSuccess('Event deleted successfully!');
        
        setTimeout(() => {
            window.location.href = 'events.html';
        }, 1500);
    } catch (error) {
        console.error('Error deleting event:', error);
        showError('Error deleting event: ' + error.message);
        deleteButton.innerHTML = originalText;
        deleteButton.disabled = false;
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
            photoURL: user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || user.email)}`,
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

window.editRegistrationForm = function() {
    if (!currentUser || !currentEvent || currentEvent.createdBy !== currentUser.uid) {
        showError('Only the event organizer can edit the registration form');
        return;
    }
    window.location.href = `registration.html?id=${eventId}`;
};

window.exportEvent = function() {
    if (!currentEvent) return;
    
    const exportData = {
        event: currentEvent,
        exportedAt: new Date().toISOString(),
        exportedBy: currentUser.email
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `${currentEvent.name.replace(/[^a-z0-9]/gi, '_')}_export.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showSuccess('Event exported successfully!');
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
    }, 5000);
}

// Initialize logout functionality
function initializeLogout() {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            if (confirm('Are you sure you want to logout?')) {
                try {
                    await auth.signOut();
                    sessionStorage.clear();
                    localStorage.clear();
                    window.location.href = 'login.html';
                } catch (error) {
                    console.error('Error signing out:', error);
                    showError('Error signing out');
                }
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
    
    // Create overlay if it doesn't exist
    let overlay = document.querySelector('.sidebar-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay';
        document.body.appendChild(overlay);
    }
    
    function toggleSidebar() {
        sidebar.classList.toggle('show');
        sidebar.classList.toggle('active');
        overlay.classList.toggle('show');
        document.body.style.overflow = sidebar.classList.contains('show') ? 'hidden' : '';
    }
    
    function closeSidebar() {
        sidebar.classList.remove('show');
        sidebar.classList.remove('active');
        overlay.classList.remove('show');
        document.body.style.overflow = '';
    }
    
    if (menuToggle) {
        menuToggle.addEventListener('click', toggleSidebar);
    }
    
    overlay.addEventListener('click', closeSidebar);
    
    // Close sidebar when clicking nav items on mobile
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            if (window.innerWidth <= 1024) {
                closeSidebar();
            }
        });
    });
    
    // Close sidebar on window resize
    window.addEventListener('resize', () => {
        if (window.innerWidth > 1024) {
            closeSidebar();
        }
    });
    
    // Close sidebar on ESC key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && sidebar.classList.contains('show')) {
            closeSidebar();
        }
    });
}

// Close modals on ESC key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const openModals = document.querySelectorAll('.modal.show');
        openModals.forEach(modal => {
            if (modal.id === 'editEventModal') closeEditEventModal();
            if (modal.id === 'deleteConfirmModal') closeDeleteConfirmModal();
        });
    }
});

// Close modals when clicking outside
document.addEventListener('click', (e) => {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        if (e.target === modal) {
            if (modal.id === 'editEventModal') closeEditEventModal();
            if (modal.id === 'deleteConfirmModal') closeDeleteConfirmModal();
        }
    });
});