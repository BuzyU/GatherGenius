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
    const modal = document.getElementById('createEventModal');
    if (modal) {
        modal.style.display = 'flex';
    }
};

// Close create event modal
window.closeCreateEventModal = function () {
    const modal = document.getElementById('createEventModal');
    if (modal) {
        modal.style.display = 'none';
        document.getElementById('createEventForm').reset();
    }
};

// Show import events modal (placeholder)
window.showImportEventsModal = function () {
    showInfo('Import events feature coming soon!');
};

// Show Report events modal (placeholder)
window.showReportEventsModal = function () {
    showInfo('Report events feature coming soon!');
};

// View event details
window.viewEventDetails = function (id) {
    window.location.href = `event-details.html?id=${id}`;
};

// Edit event
window.editEvent = function (id) {
    window.location.href = `event-details.html?id=${id}&edit=true`;
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
        location.reload(); // ✅ Reloads the page after deletion
    } catch (error) {
        console.error('Error deleting event:', error);
        showError('Error deleting event. Please try again.');
    }
};


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

    // Handle logout from dropdown
    const logoutLink = document.getElementById('logout-btn');
    if (logoutLink) {
        logoutLink.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                await auth.signOut();
                window.location.href = 'login.html';
            } catch (error) {
                console.error('Error signing out:', error);
                showError('Error signing out. Please try again.');
            }
        });
    }
}

// Handle create event form submission
document.addEventListener('DOMContentLoaded', () => {
    // Initialize sidebar toggle functionality
    initializeSidebar();

    // Initialize dropdown functionality
    initializeDropdowns();

    const createEventForm = document.getElementById('createEventForm');
    if (createEventForm) {
        createEventForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const user = auth.currentUser;
            if (!user) {
                showError('You must be logged in to create an event');
                return;
            }

            const submitButton = createEventForm.querySelector('button[type="submit"]');
            const originalText = submitButton.innerHTML;
            submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
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
                    createdBy: user.uid,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    status: 'upcoming',
                    participants: []
                };

                await db.collection('events').add(eventData);

                showSuccess('Event created successfully!');
                closeCreateEventModal();
                await loadDashboardData();

            } catch (error) {
                console.error('Error creating event:', error);
                showError('Failed to create event. Please try again.');
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

    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 10);

    // Remove after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
// ========================================
// MOBILE MENU FUNCTIONALITY
// Add this to your dashboard.js or events.js
// ========================================

document.addEventListener('DOMContentLoaded', () => {
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

    // Improve form input experience on mobile
    const inputs = document.querySelectorAll('input, textarea');
    inputs.forEach(input => {
        // Auto-focus first input when modal opens (desktop only)
        if (window.innerWidth > 768) {
            const modal = input.closest('.modal');
            if (modal) {
                const observer = new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        if (modal.style.display === 'flex') {
                            setTimeout(() => input.focus(), 100);
                        }
                    });
                });
                observer.observe(modal, {
                    attributes: true,
                    attributeFilter: ['style']
                });
            }
        }

        // Scroll input into view on mobile when focused
        if (window.innerWidth <= 768) {
            input.addEventListener('focus', () => {
                setTimeout(() => {
                    input.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center'
                    });
                }, 300);
            });
        }
    });

    // Optimize card interactions for mobile
    const eventCards = document.querySelectorAll('.event-card');
    eventCards.forEach(card => {
        let touchStartY = 0;
        let touchEndY = 0;

        card.addEventListener('touchstart', (e) => {
            touchStartY = e.changedTouches[0].screenY;
        }, { passive: true });

        card.addEventListener('touchend', (e) => {
            touchEndY = e.changedTouches[0].screenY;
            // If it's a tap (not a scroll), add visual feedback
            if (Math.abs(touchEndY - touchStartY) < 10) {
                card.style.transform = 'scale(0.98)';
                setTimeout(() => {
                    card.style.transform = '';
                }, 100);
            }
        }, { passive: true });
    });

    // Add pull-to-refresh hint on mobile (optional)
    if (window.innerWidth <= 768 && 'ontouchstart' in window) {
        let startY = 0;
        let currentY = 0;

        mainContent.addEventListener('touchstart', (e) => {
            if (mainContent.scrollTop === 0) {
                startY = e.touches[0].pageY;
            }
        }, { passive: true });

        mainContent.addEventListener('touchmove', (e) => {
            if (mainContent.scrollTop === 0) {
                currentY = e.touches[0].pageY;
                const pullDistance = currentY - startY;

                if (pullDistance > 100) {
                    // Optional: Add visual feedback for pull-to-refresh
                    console.log('Pull to refresh triggered');
                }
            }
        }, { passive: true });
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

        // Tab key navigation
        if (e.key === 'Tab') {
            const focusableElements = document.querySelectorAll(
                'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
            );

            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];

            // Trap focus in modal when open
            const openModal = document.querySelector('.modal[style*="display: flex"]');
            if (openModal) {
                const modalFocusable = openModal.querySelectorAll(
                    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])'
                );

                if (modalFocusable.length > 0) {
                    const modalFirst = modalFocusable[0];
                    const modalLast = modalFocusable[modalFocusable.length - 1];

                    if (e.shiftKey && document.activeElement === modalFirst) {
                        e.preventDefault();
                        modalLast.focus();
                    } else if (!e.shiftKey && document.activeElement === modalLast) {
                        e.preventDefault();
                        modalFirst.focus();
                    }
                }
            }
        }
    });

    // Performance optimization: Lazy load images
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    if (img.dataset.src) {
                        img.src = img.dataset.src;
                        img.removeAttribute('data-src');
                        imageObserver.unobserve(img);
                    }
                }
            });
        });

        document.querySelectorAll('img[data-src]').forEach(img => {
            imageObserver.observe(img);
        });
    }

    // Network status indicator for mobile
    if ('onLine' in navigator) {
        function updateOnlineStatus() {
            const statusIndicator = document.querySelector('.network-status') || createNetworkStatusIndicator();

            if (navigator.onLine) {
                statusIndicator.textContent = '';
                statusIndicator.style.display = 'none';
            } else {
                statusIndicator.textContent = '⚠️ No internet connection';
                statusIndicator.style.display = 'block';
            }
        }

        function createNetworkStatusIndicator() {
            const indicator = document.createElement('div');
            indicator.className = 'network-status';
            indicator.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                background: #ff9800;
                color: white;
                padding: 8px;
                text-align: center;
                font-size: 0.9rem;
                z-index: 9999;
                display: none;
            `;
            document.body.appendChild(indicator);
            return indicator;
        }

        window.addEventListener('online', updateOnlineStatus);
        window.addEventListener('offline', updateOnlineStatus);
    }

    // Optimize scroll performance on mobile
    let scrollTimeout;
    let isScrolling = false;

    window.addEventListener('scroll', () => {
        if (!isScrolling) {
            isScrolling = true;
            document.body.classList.add('is-scrolling');
        }

        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            isScrolling = false;
            document.body.classList.remove('is-scrolling');
        }, 150);
    }, { passive: true });

    // Add scroll optimization CSS
    const scrollStyle = document.createElement('style');
    scrollStyle.textContent = `
        .is-scrolling * {
            pointer-events: none !important;
        }
        
        .is-scrolling .event-card {
            transition: none !important;
        }
    `;
    document.head.appendChild(scrollStyle);

    console.log('Mobile enhancements loaded successfully');
});

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