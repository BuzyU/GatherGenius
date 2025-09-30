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

// DOM Elements
const createEventBtn = document.querySelector('.create-event-btn');
const createEventModal = document.getElementById('createEventModal');
const createEventForm = document.getElementById('createEventForm');
const eventsGrid = document.querySelector('.events-grid');

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    // Check Authentication
    auth.onAuthStateChanged((user) => {
        if (!user) {
            window.location.href = 'login.html';
            return;
        }
        
        // Update user info
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

    // Create Event Button
    const createEventBtn = document.querySelector('.create-event-btn');
    if (createEventBtn) {
        createEventBtn.addEventListener('click', showCreateEventModal);
    }

    // Close Modal Button
    const closeModalBtn = document.querySelector('.close-modal');
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', closeCreateEventModal);
    }

    // Form Submission
    const createEventForm = document.getElementById('createEventForm');
    if (createEventForm) {
        createEventForm.addEventListener('submit', handleCreateEvent);
    }

    // Close modal on outside click
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            closeCreateEventModal();
        }
    });
});

// Show/Hide Modal Functions
function showCreateEventModal() {
    const modal = document.getElementById('createEventModal');
    if (modal) {
        modal.style.display = 'block';
    }
}

function closeCreateEventModal() {
    const modal = document.getElementById('createEventModal');
    if (modal) {
        modal.style.display = 'none';
        document.getElementById('createEventForm').reset();
    }
}

// Handle Create Event
async function handleCreateEvent(e) {
    e.preventDefault();
    console.log('Form submitted'); // Debug log

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.innerHTML;

    try {
        // Check authentication
        const user = auth.currentUser;
        if (!user) {
            showMessage('You must be logged in to create an event', 'error');
            return;
        }

        // Update button state
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';

        // Get form data
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
        console.log('Event created with ID:', docRef.id); // Debug log

        // Add event to UI
        const newEventData = { id: docRef.id, ...eventData };
        addEventToUI(newEventData);

        // Show success message and close modal
        showMessage('Event created successfully!', 'success');
        closeCreateEventModal();

    } catch (error) {
        console.error('Error creating event:', error);
        showMessage('Failed to create event. Please try again.', 'error');
    } finally {
        // Reset button state
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
    }
}

// Load Events
async function loadEvents() {
    try {
        const snapshot = await db.collection('events')
            .orderBy('createdAt', 'desc')
            .get();

        if (eventsGrid) {
            eventsGrid.innerHTML = ''; // Clear existing events

            if (snapshot.empty) {
                eventsGrid.innerHTML = '<div class="no-events">No events found</div>';
                return;
            }

            snapshot.forEach(doc => {
                const event = { id: doc.id, ...doc.data() };
                addEventToUI(event);
            });
        }
    } catch (error) {
        console.error('Error loading events:', error);
        showMessage('Error loading events. Please try again.', 'error');
    }
}

// Add Event to UI
function addEventToUI(event) {
    if (!eventsGrid) return;

    const eventCard = createEventCard(event);
    eventsGrid.insertAdjacentHTML('beforeend', eventCard);
}

// Create Event Card HTML
function createEventCard(event) {
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
                <p><i class="fas fa-user-friends"></i> Maximum Teams: ${event.maxTeams}</p>
            </div>
            <div class="event-description">
                <p>${truncateText(event.description || '', 100)}</p>
            </div>
            <div class="event-actions">
                <button onclick="viewEvent('${event.id}')" class="btn-primary">
                    <i class="fas fa-eye"></i> View
                </button>
                <button onclick="editEvent('${event.id}')" class="btn-secondary">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button onclick="deleteEvent('${event.id}')" class="btn-danger">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        </div>
    `;
}

// Helper Functions
function formatDate(date) {
    return new Date(date).toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substr(0, maxLength) + '...';
}

function showMessage(message, type) {
    const messageContainer = document.createElement('div');
    messageContainer.className = `message ${type}`;
    messageContainer.textContent = message;
    document.body.appendChild(messageContainer);

    setTimeout(() => {
        messageContainer.remove();
    }, 3000);
}

// Event Actions
async function deleteEvent(eventId) {
    if (!confirm('Are you sure you want to delete this event?')) return;

    try {
        await db.collection('events').doc(eventId).delete();
        const eventElement = document.querySelector(`[data-id="${eventId}"]`);
        if (eventElement) {
            eventElement.remove();
        }
        showMessage('Event deleted successfully!', 'success');
    } catch (error) {
        console.error('Error deleting event:', error);
        showMessage('Failed to delete event. Please try again.', 'error');
    }
}

function viewEvent(eventId) {
    // Implement view event functionality
    console.log('View event:', eventId);
}

function editEvent(eventId) {
    // Implement edit event functionality
    console.log('Edit event:', eventId);
}

// Debug logs
console.log('Events.js loaded');
document.addEventListener('DOMContentLoaded', () => console.log('DOM loaded'));