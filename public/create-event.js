// Function to show create event modal
function showCreateEventModal() {
    document.getElementById('createEventModal').style.display = 'block';
}

// Function to close create event modal
function closeCreateEventModal() {
    document.getElementById('createEventModal').style.display = 'none';
    document.getElementById('createEventForm').reset();
}

// Add event to both events page and dashboard
async function addEventToUI(eventData, eventId) {
    // Add to events grid
    const eventsGrid = document.querySelector('.events-grid');
    if (eventsGrid) {
        const eventCard = createEventCard(eventData, eventId);
        eventsGrid.insertAdjacentHTML('afterbegin', eventCard);
    }
    
    // Add to dashboard if on dashboard page
    const dashboardEvents = document.querySelector('.dashboard-events');
    if (dashboardEvents) {
        const eventCard = createEventCard(eventData, eventId);
        dashboardEvents.insertAdjacentHTML('afterbegin', eventCard);
    }
}

// Create event card HTML
function createEventCard(event, eventId) {
    const eventDate = new Date(event.date);
    const now = new Date();
    const status = eventDate > now ? 'upcoming' : 
                  (eventDate.toDateString() === now.toDateString() ? 'in-progress' : 'completed');

    return `
        <div class="event-card ${status}" data-id="${eventId}">
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
                <p><i class="fas fa-user-friends"></i> Participants: 0</p>
            </div>
            <div class="event-description">
                ${event.description ? `<p>${truncateText(event.description, 100)}</p>` : ''}
            </div>
            <div class="event-actions">
                <button class="btn-primary" onclick="viewEventDetails('${eventId}')">
                    <i class="fas fa-eye"></i> View Details
                </button>
                <button class="btn-secondary" onclick="editEvent('${eventId}')">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn-danger" onclick="deleteEvent('${eventId}')">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        </div>
    `;
}

// Format date helper function
function formatDate(date) {
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Truncate text helper function
function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substr(0, maxLength) + '...';
}

// Wait for Firebase initialization
let dbInitialized = false;
let authInstance = null;
let dbInstance = null;

// Initialize Firebase instances
async function initializeFirebaseInstances() {
    if (!dbInitialized) {
        try {
            // Wait for app initialization
            while (!firebase.apps.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            authInstance = firebase.auth();
            dbInstance = firebase.firestore();
            dbInitialized = true;
        } catch (error) {
            console.error('Error initializing Firebase instances:', error);
            throw error;
        }
    }
    return { auth: authInstance, db: dbInstance };
}

// Handle form submission
document.getElementById('createEventForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    try {
        // Get Firebase instances
        const { auth, db } = await initializeFirebaseInstances();
        
        // Get current user
        const user = auth.currentUser;
        if (!user) {
            showError('You must be logged in to create an event');
            return;
        }

        // Show loading state
        const submitButton = e.target.querySelector('button[type="submit"]');
        const originalText = submitButton.innerHTML;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
        submitButton.disabled = true;

        // Get form values
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
            status: 'upcoming',
            participants: []
        };

        // Save to Firestore
        const docRef = await db.collection('events').add(eventData);

        // Add event to UI immediately
        await addEventToUI(eventData, docRef.id);

        // Show success message
        showSuccess('Event created successfully!');
        
        // Close modal and reset form
        closeCreateEventModal();

    } catch (error) {
        console.error('Error creating event:', error);
        showError('Failed to create event. Please try again.');
    } finally {
        // Reset button state
        const submitButton = e.target.querySelector('button[type="submit"]');
        submitButton.innerHTML = originalText;
        submitButton.disabled = false;
    }
});