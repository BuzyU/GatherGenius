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

// Check authentication
auth.onAuthStateChanged((user) => {
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    // Update user interface
    updateUserInterface(user);
    
    // Load events
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
        // Search filter
        const matchesSearch = !searchTerm || 
            event.name.toLowerCase().includes(searchTerm) ||
            event.location.toLowerCase().includes(searchTerm) ||
            (event.description && event.description.toLowerCase().includes(searchTerm));

        if (!matchesSearch) return false;

        // Status filter
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
                    <button class="btn-secondary" onclick="editEvent('${event.id}')">
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

window.deleteEvent = async function(id) {
    if (!confirm('Are you sure you want to delete this event? This action cannot be undone.')) {
        return;
    }
    
    try {
        await db.collection('events').doc(id).delete();
        showSuccess('Event deleted successfully');
        await loadDashboardData();
    } catch (error) {
        console.error('Error deleting event:', error);
        showError('Error deleting event. Please try again.');
    }
};

// Add event listeners for filters and search
document.addEventListener('DOMContentLoaded', () => {
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
});

function viewEventDetails(id) {
    window.location.href = `event-details.html?id=${id}`;
}
