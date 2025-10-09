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

    // Update user interface
    updateUserInterface(user);

    // Load dashboard data
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

        updateStats(events);
        displayRecentEvents(events.slice(0, 6)); // Show only 6 recent events
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showError('Error loading dashboard data. Please refresh the page.');
    }
}

// Update statistics
function updateStats(events) {
    const now = new Date();
    const totalEvents = events.length;
    const upcomingEvents = events.filter(e => new Date(e.date) > now).length;
    const totalParticipants = events.reduce((sum, e) => sum + (e.participants?.length || 0), 0);
    const avgTeamSize = events.length > 0
        ? (events.reduce((sum, e) => sum + (e.teamSize || 0), 0) / events.length).toFixed(1)
        : 0;

    document.getElementById('total-events').textContent = totalEvents;
    document.getElementById('upcoming-events').textContent = upcomingEvents;
    document.getElementById('total-participants').textContent = totalParticipants;
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

    const sortedEvents = events.sort((a, b) => new Date(b.createdAt?.toDate?.() || b.createdAt) - new Date(a.createdAt?.toDate?.() || a.createdAt));

    eventsGrid.innerHTML = sortedEvents.map(event => {
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
        `}).join('');
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

// Show create event modal
window.showCreateEventModal = function () {
    currentEditEventId = null;
    const modal = document.getElementById('createEventModal');
    const modalTitle = modal.querySelector('.modal-header h2');
    const submitButton = modal.querySelector('button[type="submit"]');

    // Reset to create mode
    modalTitle.textContent = 'Create New Event';
    submitButton.innerHTML = '<i class="fas fa-plus"></i> Create Event';

    // Clear form
    document.getElementById('createEventForm').reset();
    modal.style.display = 'flex';
};

// Close create event modal
window.closeCreateEventModal = function () {
    const modal = document.getElementById('createEventModal');
    const modalTitle = modal.querySelector('.modal-header h2');
    const submitButton = modal.querySelector('button[type="submit"]');

    // Reset to create mode
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
    const modal = document.getElementById('createEventModal');

    // Populate form fields
    document.getElementById('eventName').value = data.name;
    document.getElementById('eventDate').value = new Date(data.date).toISOString().slice(0, 16);
    document.getElementById('eventLocation').value = data.location;
    document.getElementById('teamSize').value = data.teamSize;
    document.getElementById('maxTeams').value = data.maxTeams || 10;
    document.getElementById('eventCost').value = data.cost;
    document.getElementById('eventDescription').value = data.description;

    // Change to edit mode
    const modalTitle = modal.querySelector('.modal-header h2');
    const submitButton = modal.querySelector('button[type="submit"]');
    modalTitle.textContent = 'Edit Event';
    submitButton.innerHTML = '<i class="fas fa-save"></i> Update Event';

    modal.style.display = 'flex';
};

// Delete event
window.deleteEvent = async function (id) {
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

// ================= LOGOUT FUNCTIONALITY =================
// Unified logout function that works for both buttons
async function handleLogout() {
    try {
        console.log('Logging out...');
        await auth.signOut();
        // Clear session storage
        sessionStorage.clear();
        console.log('Logout successful');
        window.location.href = 'login.html';
    } catch (error) {
        console.error('Error signing out:', error);
        showError('Error signing out. Please try again.');
    }
}

// Global close sidebar function (accessible from HTML onclick)
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

    // Create overlay element
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

    // Toggle sidebar function
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
    // Event listeners for both menu toggles
    if (menuToggle) {
        menuToggle.addEventListener('click', toggleSidebar);
    }

    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', toggleSidebar);
    }

    // Close sidebar when clicking overlay
    overlay.addEventListener('click', window.closeSidebar);

    // Close sidebar when clicking nav links on mobile
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                window.closeSidebar();
            }
        });
    });

    // Handle window resize
    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
            window.closeSidebar();
        }
    });

    // Handle escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && sidebar.classList.contains('active')) {
            window.closeSidebar();
        }
    });
}

// Initialize dropdown functionality
function initializeDropdowns() {
    // User dropdown toggle
    const userMenuBtn = document.querySelector('.user-menu-btn');
    const userDropdown = document.querySelector('.user-dropdown');

    if (userMenuBtn && userDropdown) {
        userMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            userDropdown.classList.toggle('show');

            // Close other dropdowns if any
            document.querySelectorAll('.dropdown:not(.user-dropdown)').forEach(dropdown => {
                dropdown.classList.remove('show');
            });
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!userMenuBtn.contains(e.target) && !userDropdown.contains(e.target)) {
                userDropdown.classList.remove('show');
            }
        });

        // Close dropdown when pressing Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                userDropdown.classList.remove('show');
            }
        });

        // Handle dropdown item clicks
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
    // Sidebar logout button
    const sidebarLogoutBtn = document.getElementById('logout-btn');
    if (sidebarLogoutBtn) {
        sidebarLogoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            await handleLogout();
        });
        console.log('Sidebar logout button initialized');
    }

    // Dropdown logout link
    const dropdownLogoutLink = document.getElementById('logout-link');
    if (dropdownLogoutLink) {
        dropdownLogoutLink.addEventListener('click', async (e) => {
            e.preventDefault();
            await handleLogout();
        });
        console.log('Dropdown logout link initialized');
    }

    // Also handle any other logout buttons with class 'logout-btn'
    const allLogoutBtns = document.querySelectorAll('.logout-btn, .logout-link, [data-logout]');
    allLogoutBtns.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            await handleLogout();
        });
    });
}

// Main DOMContentLoaded event listener - consolidate all initialization here
// Main DOMContentLoaded event listener - consolidate all initialization here
// Main DOMContentLoaded event listener - REPLACE YOUR ENTIRE DOMContentLoaded (lines 417-557)
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded - Initializing...');

    // Initialize sidebar toggle functionality
    initializeSidebar();

    // Initialize dropdown functionality
    initializeDropdowns();

    // Initialize logout buttons
    initializeLogoutButtons();

    // Initialize mobile enhancements
    initializeMobileEnhancements();

    // ===== MODAL CLOSE HANDLERS =====
    // Modal close button (X button)
    const closeBtn = document.querySelector('.close-modal');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeCreateEventModal);
        console.log('Close button initialized');
    } else {
        console.warn('Close button (.close-modal) not found in HTML');
    }

    // Close modal when clicking outside (on the backdrop)
    const modal = document.getElementById('createEventModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeCreateEventModal();
            }
        });
        console.log('Modal backdrop click handler initialized');
    } else {
        console.warn('Modal (#createEventModal) not found in HTML');
    }

    // Close modal with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const modal = document.getElementById('createEventModal');
            if (modal && modal.style.display === 'flex') {
                closeCreateEventModal();
            }
        }
    });

    // ===== FORM SUBMISSION =====
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

            // Change text based on whether we're editing or creating
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
                    description: document.getElementById('eventDescription').value
                };

                if (currentEditEventId) {
                    // UPDATE existing event
                    eventData.lastUpdated = firebase.firestore.FieldValue.serverTimestamp();
                    await db.collection('events').doc(currentEditEventId).update(eventData);
                    showSuccess('Event updated successfully!');
                } else {
                    // CREATE new event
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
                currentEditEventId = null; // Reset after submission
            }
        });
    }

    console.log('All initializations complete');
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

    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 10);

    // Remove after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// MOBILE MENU FUNCTIONALITY
function initializeMobileEnhancements() {
    // Mobile Menu Toggle
    const menuToggle = document.querySelector('.menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');

    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            sidebar.classList.toggle('show');

            // Add overlay for mobile
            if (sidebar.classList.contains('show')) {
                createOverlay();
            } else {
                removeOverlay();
            }
        });
    }

    // Close sidebar when clicking outside on mobile
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

    // Close sidebar when clicking nav items on mobile
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                sidebar.classList.remove('show');
                removeOverlay();
            }
        });
    });

    // Handle window resize
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

    // Create overlay for mobile menu
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

    // Remove overlay
    function removeOverlay() {
        const overlay = document.querySelector('.sidebar-overlay');
        if (overlay) {
            overlay.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => overlay.remove(), 300);
        }
    }

    // Add fade animations
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
}

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