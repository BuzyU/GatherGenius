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
let app;
try {
    if (!firebase.apps.length) {
        app = firebase.initializeApp(firebaseConfig);
    } else {
        app = firebase.app();
    }
} catch (error) {
    console.error('Error initializing Firebase:', error);
}

const auth = firebase.auth();
const db = firebase.firestore();

// Function to get user data from Firestore
async function getUserData(uid) {
    try {
        const userDoc = await db.collection('users').doc(uid).get();
        return userDoc.exists ? userDoc.data() : null;
    } catch (error) {
        console.error('Error fetching user data:', error);
        return null;
    }
}

// Function to update user interface
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
            // If no photo URL, use a default avatar with user's initial
            const initial = (user.displayName || user.email[0]).charAt(0).toUpperCase();
            userAvatarElement.src = `https://ui-avatars.com/api/?name=${initial}&background=0D8ABC&color=fff&size=128`;
        }
    }
}

// Setup authentication state change listener
auth.onAuthStateChanged(async (user) => {
    if (!user) {
        // User is not logged in, redirect to login page
        window.location.href = 'login.html';
        return;
    }

    // Get additional user data from Firestore
    const userData = await getUserData(user.uid);
    
    // Update the UI with user information
    const userNameElement = document.getElementById('user-name');
    const userAvatarElement = document.getElementById('user-avatar');
    
    if (userNameElement) {
        // Use Firestore data if available, otherwise fallback to auth data
        userNameElement.textContent = userData?.displayName || user.displayName || user.email.split('@')[0];
    }
    
    if (userAvatarElement) {
        // Use Firestore data if available, otherwise fallback to auth data
        const photoURL = userData?.photoURL || user.photoURL;
        if (photoURL) {
            userAvatarElement.src = photoURL;
        } else {
            // If no photo URL, use a default avatar with user's initial
            const initial = (userData?.displayName || user.displayName || user.email[0]).charAt(0).toUpperCase();
            userAvatarElement.src = `https://ui-avatars.com/api/?name=${initial}&background=0D8ABC&color=fff&size=128`;
        }
    }
});

// DOM Content Loaded Event Handler
document.addEventListener('DOMContentLoaded', () => {
    // Setup logout functionality for both buttons
    const logoutBtn = document.getElementById('logout-btn');
    const logoutLink = document.getElementById('logout-link');
    
    const handleLogout = async () => {
        try {
            await auth.signOut();
            window.location.href = 'login.html';
        } catch (error) {
            console.error('Error signing out:', error);
            alert('Error signing out. Please try again.');
        }
    };

    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    if (logoutLink) {
        logoutLink.addEventListener('click', (e) => {
            e.preventDefault();
            handleLogout();
        });
    }

    // Initialize Firestore settings
    db.enablePersistence()
        .catch((err) => {
            if (err.code === 'failed-precondition') {
                console.log('Multiple tabs open, persistence can only be enabled in one tab at a time.');
            } else if (err.code === 'unimplemented') {
                console.log('The current browser does not support offline persistence');
            }
        });
});
    
    // Mark auth as initialized after first check
    authInitialized = true;




// ================== UI ELEMENTS ==================
const menuToggle = document.querySelector('.menu-toggle');
const sidebar = document.querySelector('.sidebar');
const userMenuBtn = document.querySelector('.user-menu-btn');
const userDropdown = document.querySelector('.user-dropdown');
const searchInput = document.querySelector('.search-box input');
const eventsGrid = document.querySelector('.events-grid');

// Sidebar toggle
menuToggle?.addEventListener('click', () => {
    sidebar.classList.toggle('show');
});

// User dropdown toggle
userMenuBtn?.addEventListener('click', () => {
    userDropdown.classList.toggle('show');
});

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    if (!userMenuBtn.contains(e.target)) {
        userDropdown.classList.remove('show');
    }
});

// Logout
document.getElementById('logout-link')?.addEventListener('click', async (e) => {
    e.preventDefault(); // prevent default link behavior
    try {
        await signOut(auth);
        localStorage.removeItem('redirected'); // optional
        window.location.href = 'login.html';
    } catch (error) {
        console.error('Error signing out:', error);
        alert('Error signing out. Please try again.');
    }
});

// ================== DASHBOARD DATA ==================
async function loadDashboardData() {
    try {
        const eventsSnapshot = await getDocs(collection(db, 'events'));
        const events = [];
        eventsSnapshot.forEach(doc => events.push({ id: doc.id, ...doc.data() }));

        updateStats(events);
        displayEvents(events);
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        alert('Error loading dashboard data. Please refresh the page.');
    }
}

function updateStats(events) {
    const totalEvents = events.length;
    const upcomingEvents = events.filter(e => new Date(e.date) > new Date()).length;
    const totalParticipants = events.reduce((sum, e) => sum + (e.participants?.length || 0), 0);
    const avgTeamSize = events.reduce((sum, e) => sum + (e.teamSize || 0), 0) / events.length || 0;

    document.getElementById('total-events').textContent = totalEvents;
    document.getElementById('upcoming-events').textContent = upcomingEvents;
    document.getElementById('total-participants').textContent = totalParticipants;
    document.getElementById('avg-team-size').textContent = avgTeamSize.toFixed(1);
}

function displayEvents(events) {
    if (!eventsGrid) return;

    const sortedEvents = events.sort((a, b) => new Date(a.date) - new Date(b.date));

    eventsGrid.innerHTML = sortedEvents.map(event => {
        const eventDate = new Date(event.date);
        const now = new Date();
        const isUpcoming = eventDate > now;
        const status = isUpcoming ? 'upcoming' : 
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
    `}).join('');
}

// Utility function to truncate text
function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substr(0, maxLength) + '...';
}


// Event CRUD functions
window.showCreateEventModal = () => {
    const modal = document.getElementById('createEventModal');
    modal.classList.add('show');
};

window.closeCreateEventModal = () => {
    const modal = document.getElementById('createEventModal');
    modal.classList.remove('show');
    document.getElementById('createEventForm').reset();
};

// Create Event
document.getElementById('createEventForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const eventData = {
        name: document.getElementById('eventName').value,
        date: new Date(document.getElementById('eventDate').value).toISOString(),
        location: document.getElementById('eventLocation').value,
        teamSize: parseInt(document.getElementById('teamSize').value),
        cost: parseInt(document.getElementById('eventCost').value),
        description: document.getElementById('eventDescription').value,
        createdBy: auth.currentUser.uid,
        createdAt: new Date().toISOString(),
        participants: [],
        maxTeams: 10 // Default value, can be made adjustable
    };

    try {
        await addDoc(collection(db, 'events'), eventData);
        closeCreateEventModal();
        loadDashboardData();
        showSuccess('Event created successfully');
    } catch (err) {
        console.error('Error creating event:', err);
        showError('Error creating event. Please try again.');
    }
});

// View Event Details
window.viewEventDetails = (id) => {
    window.location.href = `event-details.html?id=${id}`;
};

// Edit Event
window.editEvent = (id) => {
    window.location.href = `event-details.html?id=${id}&edit=true`;
};

// Delete Event
window.deleteEvent = async (id) => {
    if (!confirm('Are you sure you want to delete this event? This action cannot be undone.')) return;
    
    try {
        await deleteDoc(doc(db, 'events', id));
        loadDashboardData();
        showSuccess('Event deleted successfully');
    } catch (err) {
        console.error('Error deleting event:', err);
        showError('Error deleting event. Please try again.');
    }
};

// Utilities
function formatDate(dateStr) {
    const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateStr).toLocaleDateString('en-IN', options);
}

// Search events
searchInput?.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    document.querySelectorAll('.event-card').forEach(card => {
        const name = card.querySelector('h3').textContent.toLowerCase();
        const location = card.querySelector('.event-details p')?.textContent.toLowerCase() || '';
        card.style.display = (name.includes(term) || location.includes(term)) ? 'block' : 'none';
    });
});
