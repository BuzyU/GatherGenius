import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { getFirestore, doc, getDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBPCMzzlGJ8c_yrzXUpiwEPSCFTdiJoI3g",
    authDomain: "gathergenius-c8b58.firebaseapp.com",
    projectId: "gathergenius-c8b58",
    storageBucket: "gathergenius-c8b58.appspot.com",
    messagingSenderId: "635007345318",
    appId: "1:635007345318:web:fe911da7303ad413c54e13",
    measurementId: "G-PZ8C22WXF0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth();
const db = getFirestore();

let currentEvent = null;
const eventId = new URLSearchParams(window.location.search).get('id');

// Check authentication and load event data
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = 'login.html';
    } else {
        loadEventDetails();
    }
});

// Load event details
async function loadEventDetails() {
    try {
        const eventDoc = await getDoc(doc(db, 'events', eventId));
        if (eventDoc.exists()) {
            currentEvent = { id: eventDoc.id, ...eventDoc.data() };
            displayEventDetails(currentEvent);
        } else {
            showError('Event not found');
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 2000);
        }
    } catch (error) {
        console.error('Error loading event:', error);
        showError('Error loading event details');
    }
}

// Display event details
function displayEventDetails(event) {
    // Set event title and status
    document.getElementById('event-title').textContent = event.name;
    const eventDate = new Date(event.date);
    const now = new Date();
    const status = eventDate > now ? 'upcoming' : (eventDate.toDateString() === now.toDateString() ? 'in-progress' : 'completed');
    
    const statusElement = document.getElementById('event-status');
    statusElement.textContent = status.charAt(0).toUpperCase() + status.slice(1);
    statusElement.className = `event-status ${status}`;

    // Set event information
    document.getElementById('event-datetime').textContent = new Date(event.date).toLocaleString();
    document.getElementById('event-location').textContent = event.location;
    document.getElementById('event-team-size').textContent = `${event.teamSize} members`;
    document.getElementById('event-cost').textContent = `₹${event.cost}`;
    document.getElementById('event-description').textContent = event.description;

    // Load participants
    loadParticipants(event.participants || []);

    // Update registration status
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

    if (eventDate < now) {
        registrationStatus.innerHTML = '<p class="registration-closed">Registration closed</p>';
    } else {
        const maxParticipants = event.teamSize * event.maxTeams;
        const currentParticipants = (event.participants || []).length;
        const spotsLeft = maxParticipants - currentParticipants;

        if (spotsLeft > 0) {
            registrationStatus.innerHTML = `
                <p class="registration-open">Registration open - ${spotsLeft} spots left</p>
                <button class="btn-primary" onclick="registerForEvent()">Register Now</button>
            `;
        } else {
            registrationStatus.innerHTML = '<p class="registration-closed">Event is full</p>';
        }
    }
}

// Show edit event modal
window.showEditEventModal = function() {
    const modal = document.getElementById('editEventModal');
    const form = document.getElementById('editEventForm');

    // Populate form with current event data
    document.getElementById('editEventName').value = currentEvent.name;
    document.getElementById('editEventDate').value = new Date(currentEvent.date).toISOString().slice(0, 16);
    document.getElementById('editEventLocation').value = currentEvent.location;
    document.getElementById('editTeamSize').value = currentEvent.teamSize;
    document.getElementById('editEventCost').value = currentEvent.cost;
    document.getElementById('editEventDescription').value = currentEvent.description;

    modal.classList.add('show');

    // Handle form submission
    form.onsubmit = async (e) => {
        e.preventDefault();
        await updateEvent();
    };
};

// Update event
async function updateEvent() {
    try {
        const updatedEvent = {
            name: document.getElementById('editEventName').value,
            date: new Date(document.getElementById('editEventDate').value).toISOString(),
            location: document.getElementById('editEventLocation').value,
            teamSize: parseInt(document.getElementById('editTeamSize').value),
            cost: parseInt(document.getElementById('editEventCost').value),
            description: document.getElementById('editEventDescription').value,
            lastUpdated: new Date().toISOString()
        };

        await updateDoc(doc(db, 'events', eventId), updatedEvent);
        window.location.reload();
    } catch (error) {
        console.error('Error updating event:', error);
        showError('Error updating event');
    }
}

// Delete event
window.deleteEvent = async function() {
    try {
        await deleteDoc(doc(db, 'events', eventId));
        window.location.href = 'dashboard.html';
    } catch (error) {
        console.error('Error deleting event:', error);
        showError('Error deleting event');
    }
};

// Show error message
function showError(message) {
    const toast = document.createElement('div');
    toast.className = 'toast error';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Modal control functions
window.closeEditEventModal = function() {
    document.getElementById('editEventModal').classList.remove('show');
};

window.confirmDeleteEvent = function() {
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

        const eventRef = doc(db, 'events', eventId);
        const eventDoc = await getDoc(eventRef);
        const event = eventDoc.data();
        const participants = event.participants || [];

        // Check if user is already registered
        if (participants.some(p => p.uid === user.uid)) {
            showError('You are already registered for this event');
            return;
        }

        // Check if event is full
        const maxParticipants = event.teamSize * event.maxTeams;
        if (participants.length >= maxParticipants) {
            showError('Event is full');
            return;
        }

        // Add participant
        participants.push({
            uid: user.uid,
            name: user.displayName || user.email.split('@')[0],
            email: user.email,
            photoURL: user.photoURL,
            registeredAt: new Date().toISOString()
        });

        await updateDoc(eventRef, { participants });
        window.location.reload();
    } catch (error) {
        console.error('Error registering for event:', error);
        showError('Error registering for event');
    }
};