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
let app;
if (!firebase.apps.length) {
    app = firebase.initializeApp(firebaseConfig);
} else {
    app = firebase.app();
}

const auth = firebase.auth();
const db = firebase.firestore();

// Global variables
let currentEditEventId = null;
let currentUser = null;

// Enable offline persistence
db.enablePersistence({ synchronizeTabs: true })
    .catch((err) => {
        if (err.code === 'failed-precondition') {
            console.log('Multiple tabs open, persistence can only be enabled in one tab at a time.');
        } else if (err.code === 'unimplemented') {
            console.log('The current browser does not support offline persistence');
        }
    });

// Check authentication
auth.onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    currentUser = user;
    updateUserInterface(user);
    await loadDashboardData();
});

// Update user interface with user info
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

// Load dashboard data
async function loadDashboardData() {
    try {
        const eventsSnapshot = await db.collection('events').get();
        const events = [];
        eventsSnapshot.forEach(doc => {
            events.push({ id: doc.id, ...doc.data() });
        });

        const sortedEvents = sortEventsByOwnership(events);
        updateStats(events);
        displayRecentEvents(sortedEvents.slice(0, 6));
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showError('Error loading dashboard data. Please refresh the page.');
    }
}

// Sort events by ownership (user's events first)
function sortEventsByOwnership(events) {
    if (!currentUser) return events;

    const userEvents = events.filter(e => e.createdBy === currentUser.uid);
    const otherEvents = events.filter(e => e.createdBy !== currentUser.uid);

    userEvents.sort((a, b) => new Date(b.createdAt?.toDate?.() || b.createdAt) - new Date(a.createdAt?.toDate?.() || a.createdAt));
    otherEvents.sort((a, b) => new Date(b.createdAt?.toDate?.() || b.createdAt) - new Date(a.createdAt?.toDate?.() || a.createdAt));

    return [...userEvents, ...otherEvents];
}

// Update statistics - FIXED for participated events
function updateStats(events) {
    const now = new Date();

    // Total events created by user
    const totalEvents = events.filter(e => e.createdBy === currentUser.uid).length;

    // Upcoming events created by user
    const upcomingEvents = events.filter(e =>
        e.createdBy === currentUser.uid && new Date(e.date) > now
    ).length;

    // Events user has participated in (registered for)
    const participatedEvents = events.filter(e =>
        e.participants && e.participants.some(p => p.uid === currentUser.uid)
    );

    // Calculate average team size of participated events
    const avgTeamSize = participatedEvents.length > 0
        ? (participatedEvents.reduce((sum, e) => sum + (e.teamSize || 0), 0) / participatedEvents.length).toFixed(1)
        : 0;

    document.getElementById('total-events').textContent = totalEvents;
    document.getElementById('upcoming-events').textContent = upcomingEvents;
    document.getElementById('total-participants').textContent = participatedEvents.length;
    document.getElementById('avg-team-size').textContent = avgTeamSize;
}

// Display recent events
function displayRecentEvents(events) {
    const eventsGrid = document.querySelector('.events-grid');
    if (!eventsGrid) return;

    if (events.length === 0) {
        eventsGrid.innerHTML = '<div class="no-events"><p>No events created yet. Create your first event!</p></div>';
        return;
    }

    eventsGrid.innerHTML = events.map(event => {
        const eventDate = new Date(event.date);
        const now = new Date();
        const status = eventDate > now ? 'upcoming' :
            (eventDate.toDateString() === now.toDateString() ? 'in-progress' : 'completed');

        const isOwner = currentUser && event.createdBy === currentUser.uid;
        const categoryBadge = event.category ? `<span class="category-badge">${event.category}</span>` : '';

        return `
        <div class="event-card ${status}" data-id="${event.id}">
            <div class="event-header">
                <div class="event-title">
                    <h3>${event.name} ${isOwner ? '<span class="owner-badge">Your Event</span>' : ''}</h3>
                    <div class="event-badges">
                        ${categoryBadge}
                        <span class="event-status ${status}">${status}</span>
                    </div>
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
                ${isOwner ? `
                <button class="btn-secondary" onclick="editEvent('${event.id}')">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn-danger" onclick="deleteEvent('${event.id}')">
                    <i class="fas fa-trash"></i> Delete
                </button>
                ` : ''}
            </div>
        </div>
        `}).join('');
}

// Import Events functionality
window.showImportEventsModal = function () {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const data = JSON.parse(text);

            let eventsToImport = [];

            if (Array.isArray(data.events)) {
                // Bulk import format
                eventsToImport = data.events;
            } else if (data.event) {
                // Single export format
                eventsToImport = [data.event];
            } else {
                showError('Invalid file format');
                return;
            }

            let imported = 0;
            for (const event of eventsToImport) {
                await db.collection('events').add({
                    ...event,
                    createdBy: currentUser.uid,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    participants: []
                });
                imported++;
            }

            showSuccess(`Successfully imported ${imported} event(s)!`);
            await loadDashboardData();
        } catch (error) {
            console.error('Error importing events:', error);
            showError('Error importing events: ' + error.message);
        }
    };
    input.click();
};


// View Reports functionality
window.showReportEventsModal = function () {
    window.location.href = 'reports.html';
};

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
window.viewEventDetails = function (id) {
    window.location.href = `event-details.html?id=${id}`;
};

// Show create event modal
window.showCreateEventModal = function () {
    currentEditEventId = null;
    const modal = document.getElementById('createEventModal');
    const modalTitle = modal.querySelector('.modal-header h2');
    const submitButton = modal.querySelector('button[type="submit"]');

    modalTitle.textContent = 'Create New Event';
    submitButton.innerHTML = '<i class="fas fa-plus"></i> Create Event';

    document.getElementById('createEventForm').reset();
    modal.style.display = 'flex';
};

// Close create event modal
window.closeCreateEventModal = function () {
    const modal = document.getElementById('createEventModal');
    const modalTitle = modal.querySelector('.modal-header h2');
    const submitButton = modal.querySelector('button[type="submit"]');

    modalTitle.textContent = 'Create New Event';
    submitButton.innerHTML = '<i class="fas fa-plus"></i> Create Event';
    currentEditEventId = null;

    modal.style.display = 'none';
    document.getElementById('createEventForm').reset();
};

// Update the existing editEvent function
window.editEvent = async function (id) {
    currentEditEventId = id;
    const event = await db.collection('events').doc(id).get();
    if (!event.exists) return showError('Event not found');

    const data = event.data();

    if (currentUser && data.createdBy !== currentUser.uid) {
        showError('You can only edit your own events');
        return;
    }

    const modal = document.getElementById('createEventModal');

    document.getElementById('eventName').value = data.name;
    document.getElementById('eventDate').value = new Date(data.date).toISOString().slice(0, 16);
    document.getElementById('eventLocation').value = data.location;
    document.getElementById('teamSize').value = data.teamSize;
    document.getElementById('maxTeams').value = data.maxTeams || 10;
    document.getElementById('eventCost').value = data.cost;
    document.getElementById('eventDescription').value = data.description;
    document.getElementById('eventCategory').value = data.category || 'Sports';

    const modalTitle = modal.querySelector('.modal-header h2');
    const submitButton = modal.querySelector('button[type="submit"]');
    modalTitle.textContent = 'Edit Event';
    submitButton.innerHTML = '<i class="fas fa-save"></i> Update Event';

    modal.style.display = 'flex';
};

// Delete event
window.deleteEvent = async function (id) {
    const event = await db.collection('events').doc(id).get();
    if (!event.exists) {
        showError('Event not found');
        return;
    }

    const data = event.data();

    if (currentUser && data.createdBy !== currentUser.uid) {
        showError('You can only delete your own events');
        return;
    }

    const confirmDelete = confirm(
        'Are you sure you want to delete this event? This action cannot be undone.'
    );
    if (!confirmDelete) return;

    try {
        await db.collection('events').doc(id).delete();
        showSuccess('Event deleted successfully');
        location.reload();
    } catch (error) {
        console.error('Error deleting event:', error);
        showError('Error deleting event. Please try again.');
    }
};

// Unified logout function
async function handleLogout() {
    try {
        console.log('Logging out...');
        await auth.signOut();
        sessionStorage.clear();
        console.log('Logout successful');
        window.location.href = 'login.html';
    } catch (error) {
        console.error('Error signing out:', error);
        showError('Error signing out. Please try again.');
    }
}

// Global close sidebar function
window.closeSidebar = function () {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');

    if (sidebar) {
        sidebar.classList.remove('active');
        sidebar.classList.remove('show');
    }

    if (overlay) {
        overlay.style.opacity = '0';
        setTimeout(() => overlay.style.display = 'none', 300);
    }

    document.body.style.overflow = '';
};

// Sidebar toggle functionality
function initializeSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const menuToggle = document.querySelector('.menu-toggle');
    const mobileMenuToggle = document.querySelector('#mobile-menu-toggle');
    const dashboardContainer = document.querySelector('.dashboard-container');

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

    if (menuToggle) {
        menuToggle.addEventListener('click', toggleSidebar);
    }

    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', toggleSidebar);
    }

    overlay.addEventListener('click', window.closeSidebar);

    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                window.closeSidebar();
            }
        });
    });

    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
            window.closeSidebar();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && sidebar.classList.contains('active')) {
            window.closeSidebar();
        }
    });
}

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

// Main DOMContentLoaded event listener
document.addEventListener('DOMContentLoaded', () => {
    initializeSidebar();
    initializeDropdowns();
    initializeLogoutButtons();
    initializeMobileEnhancements();

    const closeBtn = document.querySelector('.close-modal');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeCreateEventModal);
    }

    const modal = document.getElementById('createEventModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeCreateEventModal();
            }
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const modal = document.getElementById('createEventModal');
            if (modal && modal.style.display === 'flex') {
                closeCreateEventModal();
            }
        }
    });

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

            const loadingText = currentEditEventId ?
                '<i class="fas fa-spinner fa-spin"></i> Updating...' :
                '<i class="fas fa-spinner fa-spin"></i> Creating...';

            submitButton.innerHTML = loadingText;
            submitButton.disabled = true;

            try {
                const eventData = {
                    name: document.getElementById('eventName').value,
                    date: document.getElementById('eventDate').value,
                    location: document.getElementById('eventLocation').value,
                    teamSize: parseInt(document.getElementById('teamSize').value),
                    maxTeams: parseInt(document.getElementById('maxTeams')?.value || 10),
                    cost: parseFloat(document.getElementById('eventCost').value),
                    description: document.getElementById('eventDescription').value,
                    category: document.getElementById('eventCategory').value
                };

                if (currentEditEventId) {
                    eventData.lastUpdated = firebase.firestore.FieldValue.serverTimestamp();
                    await db.collection('events').doc(currentEditEventId).update(eventData);
                    showSuccess('Event updated successfully!');
                } else {
                    eventData.createdBy = user.uid;
                    eventData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                    eventData.status = 'upcoming';
                    eventData.participants = [];
                    await db.collection('events').add(eventData);
                    showSuccess('Event created successfully!');
                }

                closeCreateEventModal();
                await loadDashboardData();

            } catch (error) {
                console.error('Error saving event:', error);
                showError('Failed to save event. Please try again.');
            } finally {
                submitButton.innerHTML = originalText;
                submitButton.disabled = false;
                currentEditEventId = null;
            }
        });
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

// MOBILE MENU FUNCTIONALITY
function initializeMobileEnhancements() {
    const menuToggle = document.querySelector('.menu-toggle');
    const sidebar = document.querySelector('.sidebar');

    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            sidebar.classList.toggle('show');

            if (sidebar.classList.contains('show')) {
                createOverlay();
            } else {
                removeOverlay();
            }
        });
    }

    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768) {
            if (sidebar && sidebar.classList.contains('show')) {
                if (!sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
                    sidebar.classList.remove('show');
                    removeOverlay();
                }
            }
        }
    });

    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                sidebar.classList.remove('show');
                removeOverlay();
            }
        });
    });

    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            if (window.innerWidth > 768) {
                sidebar.classList.remove('show');
                removeOverlay();
            }
        }, 250);
    });

    function createOverlay() {
        if (!document.querySelector('.sidebar-overlay')) {
            const overlay = document.createElement('div');
            overlay.className = 'sidebar-overlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                z-index: 1999;
                animation: fadeIn 0.3s ease;
            `;

            overlay.addEventListener('click', () => {
                sidebar.classList.remove('show');
                removeOverlay();
            });

            document.body.appendChild(overlay);
        }
    }

    function removeOverlay() {
        const overlay = document.querySelector('.sidebar-overlay');
        if (overlay) {
            overlay.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => overlay.remove(), 300);
        }
    }

    if (!document.querySelector('#mobile-animations')) {
        const style = document.createElement('style');
        style.id = 'mobile-animations';
        style.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes fadeOut {
                from { opacity: 1; }
                to { opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
}

// Mobile-friendly modal positioning
const modals = document.querySelectorAll('.modal');
modals.forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
});

// Prevent body scroll when modal is open
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.target.style.display === 'flex') {
            document.body.style.overflow = 'hidden';
        } else if (mutation.target.style.display === 'none') {
            document.body.style.overflow = '';
        }
    });
});

modals.forEach(modal => {
    observer.observe(modal, {
        attributes: true,
        attributeFilter: ['style']
    });
});

// Touch swipe to close sidebar on mobile
let touchStartX = 0;
let touchEndX = 0;

// Initialize sidebar element
const sidebar = document.querySelector('.sidebar');

// Add touch events if sidebar exists
if (sidebar) {
    sidebar.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    sidebar.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    }, { passive: true });
}

function handleSwipe() {
    if (window.innerWidth <= 768) {
        const swipeDistance = touchEndX - touchStartX;
        // Swipe left to close (at least 50px)
        if (swipeDistance < -50 && sidebar.classList.contains('show')) {
            sidebar.classList.remove('show');
            removeOverlay();
        }
    }
}

// Keyboard navigation improvements
document.addEventListener('keydown', (e) => {
    // ESC key closes modal
    if (e.key === 'Escape') {
        const openModal = document.querySelector('.modal[style*="display: flex"]');
        if (openModal) {
            openModal.style.display = 'none';
        }

        // Close sidebar on mobile
        if (window.innerWidth <= 768 && sidebar.classList.contains('show')) {
            sidebar.classList.remove('show');
            removeOverlay();
        }
    }
});

console.log('Mobile enhancements loaded successfully');

// Utility function to detect mobile device
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// Utility function to get device type
function getDeviceType() {
    const width = window.innerWidth;
    if (width <= 480) return 'mobile-small';
    if (width <= 768) return 'mobile';
    if (width <= 1024) return 'tablet';
    return 'desktop';
}

// Log device info (useful for debugging)
console.log('Device type:', getDeviceType());
console.log('Is mobile:', isMobileDevice());
console.log('Screen width:', window.innerWidth);
console.log('Viewport height:', window.innerHeight);