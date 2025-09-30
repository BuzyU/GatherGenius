// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', async function() {
    // Firebase Configuration
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

    // Configure Firestore settings
    db.settings({
        cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED
    });

    try {
        await db.enablePersistence({
            synchronizeTabs: true
        });
    } catch (err) {
        if (err.code === 'failed-precondition') {
            console.log('Multiple tabs open, persistence can only be enabled in one tab at a time.');
        } else if (err.code === 'unimplemented') {
            console.log('The current browser does not support offline persistence');
        }
    }

    // DOM Elements
    const createEventBtn = document.querySelector('.create-event-btn');
    const createEventModal = document.getElementById('createEventModal');
    const createEventForm = document.getElementById('createEventForm');
    const eventsGrid = document.querySelector('.events-grid');
    const messageContainer = document.getElementById('messageContainer');

    // Check authentication
    auth.onAuthStateChanged((user) => {
        if (!user) {
            window.location.href = 'login.html';
            return;
        }

        // Set user info
        const userNameElement = document.getElementById('user-name');
        const userAvatarElement = document.getElementById('user-avatar');
        
        if (userNameElement) {
            userNameElement.textContent = user.displayName || user.email.split('@')[0];
        }
        if (userAvatarElement && user.photoURL) {
            userAvatarElement.src = user.photoURL;
        }

        // Load events
        loadEvents();
    });

    // Event Listeners
    if (createEventBtn) {
        createEventBtn.addEventListener('click', () => {
            if (createEventModal) {
                createEventModal.style.display = 'block';
            }
        });
    }

    // Close modal button
    const closeModalBtn = document.querySelector('.close-modal');
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            if (createEventModal) {
                createEventModal.style.display = 'none';
                createEventForm.reset();
            }
        });
    }

    // Form submission
    if (createEventForm) {
        createEventForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            console.log('Form submitted');

            try {
                const user = auth.currentUser;
                if (!user) {
                    showMessage('You must be logged in to create an event', 'error');
                    return;
                }

                const submitBtn = this.querySelector('button[type="submit"]');
                const originalBtnText = submitBtn.innerHTML;
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';

                const eventData = {
                    name: document.getElementById('eventName').value,
                    date: document.getElementById('eventDate').value,
                    location: document.getElementById('eventLocation').value,
                    teamSize: parseInt(document.getElementById('teamSize').value),
                    maxTeams: parseInt(document.getElementById('maxTeams').value),
                    cost: parseFloat(document.getElementById('eventCost').value),
                    description: document.getElementById('eventDescription').value,
                    createdBy: user.uid,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    status: 'upcoming'
                };

                // Save to Firestore
                const docRef = await db.collection('events').add(eventData);
                console.log('Event created with ID:', docRef.id);

                // Update UI
                eventData.id = docRef.id;
                const eventCard = createEventCard(eventData);
                if (eventsGrid) {
                    eventsGrid.insertAdjacentHTML('afterbegin', eventCard);
                }

                // Show success message and close modal
                showMessage('Event created successfully!', 'success');
                createEventModal.style.display = 'none';
                createEventForm.reset();

            } catch (error) {
                console.error('Error creating event:', error);
                showMessage('Failed to create event. Please try again.', 'error');
            } finally {
                const submitBtn = this.querySelector('button[type="submit"]');
                submitBtn.disabled = false;
                submitBtn.innerHTML = 'Create Event';
            }
        });
    }
});

// Function to load events from Firestore
async function loadEvents() {
    try {
        const eventsRef = db.collection('events');
        const snapshot = await eventsRef.orderBy('createdAt', 'desc').get();
        
        let eventsHTML = '';
        snapshot.forEach(doc => {
            const eventData = { id: doc.id, ...doc.data() };
            eventsHTML += createEventCard(eventData);
        });

        if (eventsGrid) {
            eventsGrid.innerHTML = eventsHTML;
        }
    } catch (error) {
        console.error('Error loading events:', error);
        showMessage('Failed to load events. Please refresh the page.', 'error');
    }
}

// Function to create event card HTML
function createEventCard(eventData) {
    return `
        <div class="event-card" data-id="${eventData.id}">
            <h3>${eventData.name}</h3>
            <p><i class="fas fa-calendar"></i> ${eventData.date}</p>
            <p><i class="fas fa-map-marker-alt"></i> ${eventData.location}</p>
            <p><i class="fas fa-users"></i> Team Size: ${eventData.teamSize}</p>
            <p><i class="fas fa-layer-group"></i> Max Teams: ${eventData.maxTeams}</p>
            <p><i class="fas fa-dollar-sign"></i> Cost: $${eventData.cost}</p>
            <p class="event-description">${eventData.description}</p>
            <button class="register-btn" onclick="registerForEvent('${eventData.id}')">Register</button>
        </div>
    `;
}

// Function to show messages to the user
function showMessage(message, type = 'info') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message message-${type}`;
    messageDiv.textContent = message;
    document.body.appendChild(messageDiv);

    setTimeout(() => {
        messageDiv.remove();
    }, 3000);
}

// Load all events
async function loadEvents() {
    try {
        const eventsRef = db.collection('events');
        const snapshot = await eventsRef.get();
        const events = [];
        snapshot.forEach(doc => {
            events.push({ id: doc.id, ...doc.data() });
        });
        applyFiltersAndDisplay(events);
    } catch (error) {
        console.error('Error loading events:', error);
        showError('Error loading events. Please try again.');
    }
}

// Show error message
function showError(message) {
    showMessage(message, 'error');
}

// Show success message
function showSuccess(message) {
    showMessage(message, 'success');
}

// Show message helper
function showMessage(message, type) {
    const container = document.getElementById('message-container');
    const messageElement = document.createElement('div');
    messageElement.className = `message ${type}`;
    messageElement.textContent = message;

    container.appendChild(messageElement);

    // Remove message after 3 seconds
    setTimeout(() => {
        messageElement.remove();
    }, 3000);
}

// Apply filters and display events
function applyFiltersAndDisplay(events) {
    const statusFilter = document.getElementById('status-filter').value;
    const sortFilter = document.getElementById('sort-filter').value;
    const searchTerm = document.querySelector('.search-box input').value.toLowerCase();

    // Filter events
    let filteredEvents = events.filter(event => {
        const matchesSearch = event.name.toLowerCase().includes(searchTerm) ||
                            event.location.toLowerCase().includes(searchTerm) ||
                            event.description.toLowerCase().includes(searchTerm);

        if (statusFilter === 'all') return matchesSearch;

        const eventDate = new Date(event.date);
        const now = new Date();
        const status = eventDate > now ? 'upcoming' :
                      (eventDate.toDateString() === now.toDateString() ? 'in-progress' : 'completed');

        return status === statusFilter && matchesSearch;
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
    
    if (events.length === 0) {
        eventsGrid.innerHTML = '<div class="no-events">No events found</div>';
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

// Event handlers for filters
document.getElementById('status-filter').addEventListener('change', () => {
    loadEvents();
});

document.getElementById('sort-filter').addEventListener('change', () => {
    loadEvents();
});

document.querySelector('.search-box input').addEventListener('input', () => {
    loadEvents();
});

// Create Event
window.showCreateEventModal = () => {
    if (!auth.currentUser) {
        showError('Please log in to create an event');
        return;
    }
    document.getElementById('createEventModal').classList.add('show');
};

window.closeCreateEventModal = () => {
    document.getElementById('createEventModal').classList.remove('show');
    document.getElementById('createEventForm').reset();
};

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
    const createEventForm = document.getElementById('createEventForm');
    if (createEventForm) {
        createEventForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (!auth.currentUser) {
                showError('Please log in to create an event');
                return;
            }

            try {
                const eventData = {
                    name: document.getElementById('eventName').value,
                    date: new Date(document.getElementById('eventDate').value).toISOString(),
                    location: document.getElementById('eventLocation').value,
                    teamSize: parseInt(document.getElementById('teamSize').value),
                    maxTeams: parseInt(document.getElementById('maxTeams').value),
                    cost: parseInt(document.getElementById('eventCost').value),
                    description: document.getElementById('eventDescription').value,
                    createdBy: auth.currentUser.uid,
                    createdAt: new Date().toISOString(),
                    participants: []
                };

                // Show loading state
                const submitButton = createEventForm.querySelector('button[type="submit"]');
                const originalText = submitButton.textContent;
                submitButton.disabled = true;
                submitButton.textContent = 'Creating...';

                try {
                    // Add event to Firestore
                    await db.collection('events').add(eventData);
                    
                    // Close modal and reset form
                    closeCreateEventModal();
                    
                    // Refresh events list
                    await loadEvents();
                    
                    showSuccess('Event created successfully!');
                } finally {
                    // Reset button state
                    submitButton.disabled = false;
                    submitButton.textContent = originalText;
                }
            } catch (error) {
                console.error('Error creating event:', error);
                showError(error.message || 'Error creating event. Please try again.');
            }
        });
    }
});

// Navigation functions
window.viewEventDetails = (id) => {
    window.location.href = `event-details.html?id=${id}`;
};

window.editEvent = (id) => {
    window.location.href = `event-details.html?id=${id}&edit=true`;
};

window.deleteEvent = async (id) => {
    if (!confirm('Are you sure you want to delete this event? This action cannot be undone.')) return;
    
    try {
        await db.collection('events').doc(id).delete();
        loadEvents();
        showSuccess('Event deleted successfully');
    } catch (error) {
        console.error('Error deleting event:', error);
        showError('Error deleting event. Please try again.');
    }
};

// Utility functions
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

function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substr(0, maxLength) + '...';
}

function showSuccess(message) {
    const toast = document.createElement('div');
    toast.className = 'toast success show';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

function showError(message) {
    const toast = document.createElement('div');
    toast.className = 'toast error show';
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
        showError('Error signing out. Please try again.');
    }
});

// User dropdown functionality
const userMenuBtn = document.querySelector('.user-menu-btn');
const userDropdown = document.querySelector('.user-dropdown');

userMenuBtn?.addEventListener('click', () => {
    userDropdown.classList.toggle('show');
});

document.addEventListener('click', (e) => {
    if (!userMenuBtn?.contains(e.target)) {
        userDropdown?.classList.remove('show');
    }
});