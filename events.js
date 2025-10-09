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

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

// Enable offline persistence
db.enablePersistence({ synchronizeTabs: true })
    .catch((err) => {
        if (err.code === 'failed-precondition') {
            console.log('Multiple tabs open, persistence can only be enabled in one tab at a time.');
        } else if (err.code === 'unimplemented') {
            console.log('The current browser does not support offline persistence');
        }
    });

let allEvents = [];
let currentEditEventId = null;

// Check authentication
auth.onAuthStateChanged((user) => {
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    updateUserInterface(user);
    loadEvents();
});

// Update user interface
function updateUserInterface(user) {
    const userNameElement = document.getElementById('user-name');
    const userAvatarElement = document.getElementById('user-avatar');
    
    if (userNameElement) {
        userNameElement.textContent = user.displayName || user.email.split('@')[0];
    }
    
    if (userAvatarElement) {
        if (user.photoURL) {
            userAvatarElement.src = user.photoURL;
        } else {
            const initial = (user.displayName || user.email[0]).charAt(0).toUpperCase();
            userAvatarElement.src = `https://ui-avatars.com/api/?name=${initial}&background=ff6600&color=fff&size=128`;
        }
    }
}

// Load all events
async function loadEvents() {
    try {
        const eventsSnapshot = await db.collection('events').orderBy('createdAt', 'desc').get();
        allEvents = [];
        eventsSnapshot.forEach(doc => {
            allEvents.push({ id: doc.id, ...doc.data() });
        });
        
        applyFiltersAndDisplay();
    } catch (error) {
        console.error('Error loading events:', error);
        showError('Error loading events. Please try again.');
    }
}

// Apply filters and display events
function applyFiltersAndDisplay() {
    const statusFilter = document.getElementById('status-filter')?.value || 'all';
    const sortFilter = document.getElementById('sort-filter')?.value || 'date-desc';
    const searchInput = document.querySelector('.search-box input');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';

    // Filter events
    let filteredEvents = allEvents.filter(event => {
        const matchesSearch = !searchTerm || 
            event.name.toLowerCase().includes(searchTerm) ||
            event.location.toLowerCase().includes(searchTerm) ||
            (event.description && event.description.toLowerCase().includes(searchTerm));

        if (!matchesSearch) return false;

        if (statusFilter === 'all') return true;

        const eventDate = new Date(event.date);
        const now = new Date();
        const status = eventDate > now ? 'upcoming' :
                      (eventDate.toDateString() === now.toDateString() ? 'in-progress' : 'completed');

        return status === statusFilter;
    });

    // Sort events
    filteredEvents.sort((a, b) => {
        switch (sortFilter) {
            case 'date-asc':
                return new Date(a.date) - new Date(b.date);
            case 'date-desc':
                return new Date(b.date) - new Date(a.date);
            case 'name-asc':
                return a.name.localeCompare(b.name);
            case 'name-desc':
                return b.name.localeCompare(a.name);
            default:
                return 0;
        }
    });

    displayEvents(filteredEvents);
}

// Display events in grid
function displayEvents(events) {
    const eventsGrid = document.querySelector('.events-grid');
    if (!eventsGrid) return;
    
    if (events.length === 0) {
        eventsGrid.innerHTML = `
            <div class="no-events">
                <i class="fas fa-calendar-times fa-3x" style="color: var(--text-secondary); margin-bottom: 20px;"></i>
                <p>No events found matching your criteria</p>
            </div>
        `;
        return;
    }

    eventsGrid.innerHTML = events.map(event => {
        const eventDate = new Date(event.date);
        const now = new Date();
        const status = eventDate > now ? 'upcoming' : 
                      (eventDate.toDateString() === now.toDateString() ? 'in-progress' : 'completed');

        return `
            <div class="event-card ${status}" data-id="${event.id}">
                <div class="event-header">
                    <div class="event-title">
                        <h3>${event.name}</h3>
                        <span class="event-status ${status}">${status}</span>
                    </div>
                    <span class="event-date">${formatDate(event.date)}</span>
                </div>
                <div class="event-details">
                    <p><i class="fas fa-map-marker-alt"></i> ${event.location}</p>
                    <p><i class="fas fa-users"></i> Team Size: ${event.teamSize}</p>
                    <p><i class="fas fa-rupee-sign"></i> Cost: ₹${event.cost}</p>
                    <p><i class="fas fa-user-friends"></i> Participants: ${event.participants?.length || 0}</p>
                </div>
                <div class="event-description">
                    ${event.description ? `<p>${truncateText(event.description, 100)}</p>` : ''}
                </div>
                <div class="event-actions">
                    <button class="btn-primary" onclick="viewEventDetails('${event.id}')">
                        <i class="fas fa-eye"></i> View Details
                    </button>
                    <button class="btn-secondary" onclick="editEventModal('${event.id}')">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn-danger" onclick="deleteEvent('${event.id}')">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Format date helper
function formatDate(dateStr) {
    const options = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    return new Date(dateStr).toLocaleDateString('en-IN', options);
}

// Truncate text helper
function truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substr(0, maxLength) + '...';
}

// View event details
window.viewEventDetails = function(id) {
    window.location.href = `event-details.html?id=${id}`;
};

// Show edit event modal
window.editEventModal = async function(id) {
    currentEditEventId = id;
    const event = allEvents.find(e => e.id === id);
    
    if (!event) {
        showError('Event not found');
        return;
    }

    const modal = document.getElementById('createEventModal');
    const modalTitle = modal.querySelector('.modal-header h2');
    const submitButton = modal.querySelector('button[type="submit"]');
    
    // Change modal title and button text
    modalTitle.textContent = 'Edit Event';
    submitButton.innerHTML = '<i class="fas fa-save"></i> Update Event';
    
    // Populate form fields
    document.getElementById('eventName').value = event.name || '';
    document.getElementById('eventDate').value = event.date ? 
        new Date(event.date).toISOString().slice(0, 16) : '';
    document.getElementById('eventLocation').value = event.location || '';
    document.getElementById('teamSize').value = event.teamSize || '';
    document.getElementById('maxTeams').value = event.maxTeams || 10;
    document.getElementById('eventCost').value = event.cost || '';
    document.getElementById('eventDescription').value = event.description || '';

    modal.style.display = 'flex';
};

// Close create/edit event modal
window.closeCreateEventModal = function() {
    const modal = document.getElementById('createEventModal');
    const modalTitle = modal.querySelector('.modal-header h2');
    const submitButton = modal.querySelector('button[type="submit"]');
    
    // Reset modal
    modalTitle.textContent = 'Create New Event';
    submitButton.innerHTML = '<i class="fas fa-plus"></i> Create Event';
    currentEditEventId = null;
    
    modal.style.display = 'none';
    document.getElementById('createEventForm').reset();
};

// Show create event modal
window.showCreateEventModal = function() {
    currentEditEventId = null;
    const modal = document.getElementById('createEventModal');
    const modalTitle = modal.querySelector('.modal-header h2');
    const submitButton = modal.querySelector('button[type="submit"]');
    
    modalTitle.textContent = 'Create New Event';
    submitButton.innerHTML = '<i class="fas fa-plus"></i> Create Event';
    
    document.getElementById('createEventForm').reset();
    modal.style.display = 'flex';
};

// Delete event
window.deleteEvent = async function(id) {
    const confirmDelete = confirm(
        'Are you sure you want to delete this event? This action cannot be undone.'
    );
    if (!confirmDelete) return;

    try {
        await db.collection('events').doc(id).delete();
        showSuccess('Event deleted successfully');
        await loadEvents();
    } catch (error) {
        console.error('Error deleting event:', error);
        showError('Error deleting event. Please try again.');
    }
};

// Initialize dropdown functionality
function initializeDropdowns() {
    const userMenuBtn = document.querySelector('.user-menu-btn');
    const userDropdown = document.querySelector('.user-dropdown');
    
    if (userMenuBtn && userDropdown) {
        userMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            userDropdown.classList.toggle('show');
            
            document.querySelectorAll('.dropdown:not(.user-dropdown)').forEach(dropdown => {
                dropdown.classList.remove('show');
            });
        });

        document.addEventListener('click', (e) => {
            if (!userMenuBtn.contains(e.target) && !userDropdown.contains(e.target)) {
                userDropdown.classList.remove('show');
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                userDropdown.classList.remove('show');
            }
        });

        const dropdownItems = userDropdown.querySelectorAll('.dropdown-item');
        dropdownItems.forEach(item => {
            item.addEventListener('click', () => {
                userDropdown.classList.remove('show');
            });
        });
    }
}

// Initialize logout buttons
function initializeLogoutButtons() {
    const sidebarLogoutBtn = document.getElementById('logout-btn');
    if (sidebarLogoutBtn) {
        sidebarLogoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            await handleLogout();
        });
    }

    const dropdownLogoutLink = document.getElementById('logout-link');
    if (dropdownLogoutLink) {
        dropdownLogoutLink.addEventListener('click', async (e) => {
            e.preventDefault();
            await handleLogout();
        });
    }
}

// Unified logout function
async function handleLogout() {
    try {
        await auth.signOut();
        sessionStorage.clear();
        window.location.href = 'login.html';
    } catch (error) {
        console.error('Error signing out:', error);
        showError('Error signing out. Please try again.');
    }
}

// Sidebar toggle functionality
function initializeSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const menuToggle = document.querySelector('.menu-toggle');
    const mobileMenuToggle = document.querySelector('#mobile-menu-toggle');
    const dashboardContainer = document.querySelector('.dashboard-container');
    
    if (!sidebar || !dashboardContainer) return;
    
    const overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    overlay.style.cssText = `
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 999;
        opacity: 0;
        transition: opacity 0.3s ease;
    `;
    dashboardContainer.appendChild(overlay);
    
    function toggleSidebar() {
        sidebar.classList.toggle('active');
        
        if (sidebar.classList.contains('active')) {
            overlay.style.display = 'block';
            setTimeout(() => overlay.style.opacity = '1', 10);
            document.body.style.overflow = 'hidden';
        } else {
            overlay.style.opacity = '0';
            setTimeout(() => overlay.style.display = 'none', 300);
            document.body.style.overflow = '';
        }
    }
    
    function closeSidebar() {
        sidebar.classList.remove('active');
        overlay.style.opacity = '0';
        setTimeout(() => overlay.style.display = 'none', 300);
        document.body.style.overflow = '';
    }
    
    if (menuToggle) {
        menuToggle.addEventListener('click', toggleSidebar);
    }
    
    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', toggleSidebar);
    }
    
    overlay.addEventListener('click', closeSidebar);
    
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                closeSidebar();
            }
        });
    });
    
    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
            closeSidebar();
        }
    });
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && sidebar.classList.contains('active')) {
            closeSidebar();
        }
    });
}

// Handle create/edit event form submission
document.addEventListener('DOMContentLoaded', () => {
    initializeSidebar();
    initializeDropdowns();
    initializeLogoutButtons();
    
    const statusFilter = document.getElementById('status-filter');
    const sortFilter = document.getElementById('sort-filter');
    const searchInput = document.querySelector('.search-box input');
    
    if (statusFilter) {
        statusFilter.addEventListener('change', applyFiltersAndDisplay);
    }
    
    if (sortFilter) {
        sortFilter.addEventListener('change', applyFiltersAndDisplay);
    }
    
    if (searchInput) {
        searchInput.addEventListener('input', applyFiltersAndDisplay);
    }
    
    // Handle form submission
    const createEventForm = document.getElementById('createEventForm');
    if (createEventForm) {
        createEventForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const user = auth.currentUser;
            if (!user) {
                showError('You must be logged in to create/edit an event');
                return;
            }

            const submitButton = createEventForm.querySelector('button[type="submit"]');
            const originalText = submitButton.innerHTML;
            submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ' + 
                (currentEditEventId ? 'Updating...' : 'Creating...');
            submitButton.disabled = true;

            try {
                const eventData = {
                    name: document.getElementById('eventName').value,
                    date: document.getElementById('eventDate').value,
                    location: document.getElementById('eventLocation').value,
                    teamSize: parseInt(document.getElementById('teamSize').value),
                    maxTeams: parseInt(document.getElementById('maxTeams')?.value || 10),
                    cost: parseFloat(document.getElementById('eventCost').value),
                    description: document.getElementById('eventDescription').value
                };

                if (currentEditEventId) {
                    // Update existing event
                    eventData.lastUpdated = firebase.firestore.FieldValue.serverTimestamp();
                    await db.collection('events').doc(currentEditEventId).update(eventData);
                    showSuccess('Event updated successfully!');
                } else {
                    // Create new event
                    eventData.createdBy = user.uid;
                    eventData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                    eventData.status = 'upcoming';
                    eventData.participants = [];
                    await db.collection('events').add(eventData);
                    showSuccess('Event created successfully!');
                }

                closeCreateEventModal();
                await loadEvents();

            } catch (error) {
                console.error('Error saving event:', error);
                showError('Failed to save event. Please try again.');
            } finally {
                submitButton.innerHTML = originalText;
                submitButton.disabled = false;
            }
        });
    }

    // Close modal when clicking outside
    const modal = document.getElementById('createEventModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeCreateEventModal();
            }
        });
    }

    // Close modal button
    const closeBtn = document.querySelector('.close-modal');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeCreateEventModal);
    }
});

// Toast notification functions
function showSuccess(message) {
    showToast(message, 'success');
}

function showError(message) {
    showToast(message, 'error');
}

function showInfo(message) {
    showToast(message, 'info');
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 10);
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}