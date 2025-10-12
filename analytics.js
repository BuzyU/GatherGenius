// Enhanced Analytics System - FIXED VERSION

// Firebase config
const firebaseConfig = {
    apiKey: "AIzaSyCKd_iH-McAMrKI_0YDoYG0xjn2KrQpTOQ",
    authDomain: "notifyme-events.firebaseapp.com",
    projectId: "notifyme-events",
    storageBucket: "notifyme-events.appspot.com",
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

// State Management
const state = {
    currentUser: null,
    allEvents: [],
    filteredEvents: [],
    charts: {},
    timeFilter: 30,
    searchQuery: '',
    categoryFilter: 'all',
    eventsUnsubscribe: null,
    isLoading: false
};

// Utility Functions
const utils = {
    escapeHtml: (str = '') => {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    showToast: (message, type = 'info') => {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${utils.escapeHtml(message)}</span>
        `;
        document.body.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('show'));
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    getDateFromFirestore: (timestamp) => {
        if (!timestamp) return null;
        if (timestamp.toDate) return timestamp.toDate();
        if (timestamp instanceof Date) return timestamp;
        return new Date(timestamp);
    },

    formatDate: (date, format = 'short') => {
        if (!date) return '—';
        const options = format === 'short'
            ? { month: 'short', day: 'numeric', year: 'numeric' }
            : { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' };
        return date.toLocaleString('en-US', options);
    },

    formatCurrency: (amount) => {
        return '₹' + Number(amount || 0).toLocaleString('en-IN');
    },

    debounce: (fn, wait = 300) => {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => fn.apply(this, args), wait);
        };
    },

    getEventStatus: (event) => {
        const now = new Date();
        const eventDate = utils.getDateFromFirestore(event.eventDate);

        if (!eventDate) return 'upcoming';
        if (event.status === 'completed') return 'completed';
        if (eventDate > now) return 'upcoming';
        return 'in-progress';
    },

    calculateTrend: (current, previous) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return Math.round(((current - previous) / previous) * 100);
    },

    sortEventsByDate: (events, descending = true) => {
        return events.sort((a, b) => {
            const dateA = utils.getDateFromFirestore(a.createdAt);
            const dateB = utils.getDateFromFirestore(b.createdAt);
            if (!dateA) return 1;
            if (!dateB) return -1;
            return descending ? dateB - dateA : dateA - dateB;
        });
    }
};

// Auth Management
auth.onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = 'login.html';
        return;
    }
    state.currentUser = user;
    updateUserInterface(user);
    await loadAnalyticsData();
    setupRealtimeUpdates();
});

function updateUserInterface(user) {
    const userName = document.getElementById('user-name');
    const userAvatar = document.getElementById('user-avatar');

    if (userName) {
        userName.textContent = user.displayName || user.email.split('@')[0] || 'User';
    }

    if (userAvatar) {
        if (user.photoURL) {
            userAvatar.src = user.photoURL;
        } else {
            const initial = (user.displayName || user.email || 'U')[0].toUpperCase();
            userAvatar.src = `https://ui-avatars.com/api/?name=${initial}&background=ff6600&color=fff&size=128`;
        }
    }
}

// Data Loading - FIXED: Removed orderBy to avoid index requirement
async function loadAnalyticsData() {
    if (state.isLoading) return;

    try {
        state.isLoading = true;
        showLoadingState();

        // Simple query without orderBy to avoid index requirement
        const eventsSnapshot = await db.collection('events')
            .where('createdBy', '==', state.currentUser.uid)
            .get();



        state.allEvents = [];
        eventsSnapshot.forEach(doc => {
            state.allEvents.push({ id: doc.id, ...doc.data() });
        });

        // Sort in JavaScript instead
        state.allEvents = utils.sortEventsByDate(state.allEvents, true);

        applyFilters();

    } catch (error) {
        console.error('Error loading analytics:', error);
        utils.showToast('Error loading analytics data: ' + error.message, 'error');
        showErrorState();
    } finally {
        state.isLoading = false;
    }
}

// FIXED: Better loading state handling
function showLoadingState() {
    // Update stat cards
    document.querySelectorAll('.stat-card p').forEach(el => {
        if (!el.classList.contains('stat-change')) {
            el.innerHTML = '<span class="loading-shimmer">Loading</span>';
        }
    });

    // For charts - hide canvas and show loading
    const chartContainers = document.querySelectorAll('.chart-container');
    chartContainers.forEach(container => {
        const canvas = container.querySelector('canvas');
        if (canvas) {
            canvas.style.display = 'none';
        }

        let loadingDiv = container.querySelector('.chart-loading');
        if (!loadingDiv) {
            loadingDiv = document.createElement('div');
            loadingDiv.className = 'chart-loading';
            loadingDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading chart...';
            loadingDiv.style.cssText = 'display: flex; align-items: center; justify-content: center; min-height: 300px; color: #6c757d;';
            container.appendChild(loadingDiv);
        }
        loadingDiv.style.display = 'flex';
    });
}

function showErrorState() {
    const chartContainers = document.querySelectorAll('.chart-container');
    chartContainers.forEach(container => {
        const canvas = container.querySelector('canvas');
        if (canvas) canvas.style.display = 'none';

        const loadingDiv = container.querySelector('.chart-loading');
        if (loadingDiv) loadingDiv.remove();

        let errorDiv = container.querySelector('.chart-empty');
        if (!errorDiv) {
            errorDiv = document.createElement('div');
            errorDiv.className = 'chart-empty';
            errorDiv.innerHTML = `
                <i class="fas fa-exclamation-triangle"></i>
                <p>Error loading data</p>
            `;
            errorDiv.style.cssText = 'display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 300px; color: #6c757d; text-align: center;';
            container.appendChild(errorDiv);
        }
    });
}

// Real-time Updates - FIXED: Added sorting
function setupRealtimeUpdates() {
    if (!state.currentUser) return;

    if (state.eventsUnsubscribe) {
        state.eventsUnsubscribe();
    }

    state.eventsUnsubscribe = db.collection('events')
        .where('createdBy', '==', state.currentUser.uid)
        .onSnapshot(
            (snapshot) => {
                const newEvents = [];
                snapshot.forEach(doc => newEvents.push({ id: doc.id, ...doc.data() }));

                // Sort by createdAt descending
                state.allEvents = utils.sortEventsByDate(newEvents, true);
                applyFilters();
            },
            (error) => {
                console.error('Realtime listener error:', error);
                utils.showToast('Realtime update error: ' + error.message, 'error');
            }
        );
}

// Filter Management
window.applyTimeFilter = function () {
    const filterSelect = document.getElementById('timeFilter');
    state.timeFilter = parseInt(filterSelect.value) || 0;
    applyFilters();
};

function applyFilters() {
    const now = new Date();
    const filterDate = new Date(now.getTime() - (state.timeFilter * 24 * 60 * 60 * 1000));

    // Apply time filter
    let filtered = state.timeFilter === 0
        ? [...state.allEvents]
        : state.allEvents.filter(event => {
            const eventDate = utils.getDateFromFirestore(event.createdAt);
            return eventDate && eventDate >= filterDate;
        });

    // Apply search filter
    if (state.searchQuery) {
        filtered = filtered.filter(event => {
            const searchLower = state.searchQuery.toLowerCase();
            return (event.name || '').toLowerCase().includes(searchLower) ||
                (event.category || '').toLowerCase().includes(searchLower) ||
                (event.location || '').toLowerCase().includes(searchLower);
        });
    }

    // Apply category filter
    if (state.categoryFilter && state.categoryFilter !== 'all') {
        filtered = filtered.filter(event =>
            (event.category || 'other').toLowerCase() === state.categoryFilter.toLowerCase()
        );
    }

    state.filteredEvents = filtered;
    updateAllAnalytics();
}

// Analytics Updates
function updateAllAnalytics() {
    updateOverviewStats();
    updateCharts();
    updateTopEventsTable();
    updateCategoryPerformance();
    generateInsights();
}

// Overview Statistics
function updateOverviewStats() {
    const totalEvents = state.filteredEvents.length;
    const totalParticipants = state.filteredEvents.reduce((sum, e) =>
        sum + (e.currentParticipants || 0), 0
    );
    const avgParticipation = totalEvents > 0
        ? Math.round(totalParticipants / totalEvents)
        : 0;
    const totalRevenue = state.filteredEvents.reduce((sum, e) =>
        sum + ((e.cost || 0) * (e.currentParticipants || 0)), 0
    );

    // Calculate previous period data for comparison
    const previousPeriodEvents = getPreviousPeriodData();
    const prevTotalEvents = previousPeriodEvents.length;
    const prevTotalParticipants = previousPeriodEvents.reduce((sum, e) =>
        sum + (e.currentParticipants || 0), 0
    );
    const prevTotalRevenue = previousPeriodEvents.reduce((sum, e) =>
        sum + ((e.cost || 0) * (e.currentParticipants || 0)), 0
    );

    // Update stats
    updateStat('total-events-stat', totalEvents);
    updateStat('total-participants-stat', totalParticipants);
    updateStat('avg-participation-stat', avgParticipation);
    updateStat('total-revenue-stat', utils.formatCurrency(totalRevenue));

    // Update changes
    updateChangeIndicator('events-change',
        utils.calculateTrend(totalEvents, prevTotalEvents));
    updateChangeIndicator('participants-change',
        utils.calculateTrend(totalParticipants, prevTotalParticipants));
    updateChangeIndicator('revenue-change',
        utils.calculateTrend(totalRevenue, prevTotalRevenue));
}

function getPreviousPeriodData() {
    if (state.timeFilter === 0) return [];

    const now = new Date();
    const currentPeriodStart = new Date(now.getTime() - (state.timeFilter * 24 * 60 * 60 * 1000));
    const previousPeriodStart = new Date(currentPeriodStart.getTime() - (state.timeFilter * 24 * 60 * 60 * 1000));

    return state.allEvents.filter(event => {
        const eventDate = utils.getDateFromFirestore(event.createdAt);
        return eventDate && eventDate >= previousPeriodStart && eventDate < currentPeriodStart;
    });
}

function updateStat(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = value;
        element.classList.remove('loading-shimmer');
    }
}

function updateChangeIndicator(elementId, percentage) {
    const element = document.getElementById(elementId);
    if (!element) return;

    let className = 'stat-change neutral';
    let icon = '';

    if (percentage > 0) {
        className = 'stat-change positive';
        icon = '<i class="fas fa-arrow-up"></i>';
    } else if (percentage < 0) {
        className = 'stat-change negative';
        icon = '<i class="fas fa-arrow-down"></i>';
    }

    element.className = className;
    element.innerHTML = `${icon} ${Math.abs(percentage)}% from previous period`;
}

// Chart Updates
function updateCharts() {
    updateEventsTimelineChart();
    updateCategoryChart();
    updateParticipationChart();
    updateStatusChart();
    updateRevenueChart();
}

// FIXED: Better container handling
function getChartContainer(canvas) {
    if (!canvas) return null;
    let container = canvas.closest('.chart-container');
    if (!container) {
        container = canvas.parentElement;
    }
    return container;
}

function showEmptyChart(container, message) {
    if (!container) return;

    const canvas = container.querySelector('canvas');
    if (canvas) canvas.style.display = 'none';

    const loadingDiv = container.querySelector('.chart-loading');
    if (loadingDiv) loadingDiv.remove();

    let emptyDiv = container.querySelector('.chart-empty');
    if (!emptyDiv) {
        emptyDiv = document.createElement('div');
        emptyDiv.className = 'chart-empty';
        emptyDiv.style.cssText = 'display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 300px; color: #6c757d; text-align: center;';
        container.appendChild(emptyDiv);
    }
    emptyDiv.innerHTML = `
        <i class="fas fa-chart-line" style="font-size: 3rem; margin-bottom: 12px; opacity: 0.3;"></i>
        <p style="margin: 0;">${message}</p>
    `;
}

function prepareChartCanvas(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;

    const container = getChartContainer(canvas);

    // Remove loading/empty states
    const loadingDiv = container?.querySelector('.chart-loading');
    const emptyDiv = container?.querySelector('.chart-empty');
    if (loadingDiv) loadingDiv.remove();
    if (emptyDiv) emptyDiv.remove();

    // Show canvas
    canvas.style.display = 'block';

    return { canvas, container };
}

function updateEventsTimelineChart() {
    const prep = prepareChartCanvas('eventsTimelineChart');
    if (!prep) return;

    const { canvas, container } = prep;

    if (state.filteredEvents.length === 0) {
        showEmptyChart(container, 'No events to display');
        return;
    }

    // Group events by date
    const eventsByDate = {};
    state.filteredEvents.forEach(event => {
        const date = utils.getDateFromFirestore(event.createdAt);
        if (date) {
            const dateKey = date.toISOString().split('T')[0];
            eventsByDate[dateKey] = (eventsByDate[dateKey] || 0) + 1;
        }
    });

    const sortedDates = Object.keys(eventsByDate).sort();
    const labels = sortedDates.map(d => utils.formatDate(new Date(d)));
    const data = sortedDates.map(d => eventsByDate[d]);

    if (state.charts.timeline) {
        state.charts.timeline.destroy();
    }

    const ctx = canvas.getContext('2d');
    state.charts.timeline = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Events Created',
                data: data,
                borderColor: '#ff6600',
                backgroundColor: 'rgba(255, 102, 0, 0.1)',
                tension: 0.4,
                fill: true,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleFont: { size: 14 },
                    bodyFont: { size: 13 }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { precision: 0 },
                    grid: { color: 'rgba(0, 0, 0, 0.05)' }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}

function updateCategoryChart() {
    const prep = prepareChartCanvas('categoryChart');
    if (!prep) return;

    const { canvas, container } = prep;

    if (state.filteredEvents.length === 0) {
        showEmptyChart(container, 'No category data');
        return;
    }

    const categoryCount = {};
    state.filteredEvents.forEach(event => {
        const cat = event.category || 'Other';
        categoryCount[cat] = (categoryCount[cat] || 0) + 1;
    });

    const labels = Object.keys(categoryCount);
    const data = Object.values(categoryCount);
    const colors = [
        '#ff6600', '#17a2b8', '#28a745', '#ffc107',
        '#dc3545', '#6f42c1', '#fd7e14', '#20c997'
    ];

    if (state.charts.category) {
        state.charts.category.destroy();
    }

    const ctx = canvas.getContext('2d');
    state.charts.category = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors.slice(0, labels.length),
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { padding: 15, font: { size: 12 } }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12
                }
            }
        }
    });
}

function updateParticipationChart() {
    const prep = prepareChartCanvas('participationChart');
    if (!prep) return;

    const { canvas, container } = prep;

    if (state.filteredEvents.length === 0) {
        showEmptyChart(container, 'No participation data');
        return;
    }

    const participationByDate = {};
    state.filteredEvents.forEach(event => {
        const date = utils.getDateFromFirestore(event.eventDate);
        if (date) {
            const dateKey = date.toISOString().split('T')[0];
            participationByDate[dateKey] = (participationByDate[dateKey] || 0) +
                (event.currentParticipants || 0);
        }
    });

    const sortedDates = Object.keys(participationByDate).sort();
    const labels = sortedDates.map(d => utils.formatDate(new Date(d)));
    const data = sortedDates.map(d => participationByDate[d]);

    if (state.charts.participation) {
        state.charts.participation.destroy();
    }

    const ctx = canvas.getContext('2d');
    state.charts.participation = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Participants',
                data: data,
                backgroundColor: '#28a745',
                borderRadius: 8,
                barThickness: 30
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { precision: 0 },
                    grid: { color: 'rgba(0, 0, 0, 0.05)' }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}

function updateStatusChart() {
    const prep = prepareChartCanvas('statusChart');
    if (!prep) return;

    const { canvas, container } = prep;

    if (state.filteredEvents.length === 0) {
        showEmptyChart(container, 'No status data');
        return;
    }

    const statusCount = { upcoming: 0, 'in-progress': 0, completed: 0 };

    state.filteredEvents.forEach(event => {
        const status = utils.getEventStatus(event);
        statusCount[status]++;
    });

    if (state.charts.status) {
        state.charts.status.destroy();
    }

    const ctx = canvas.getContext('2d');
    state.charts.status = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['Upcoming', 'In Progress', 'Completed'],
            datasets: [{
                data: [statusCount.upcoming, statusCount['in-progress'], statusCount.completed],
                backgroundColor: ['#17a2b8', '#ffc107', '#28a745'],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { padding: 15, font: { size: 12 } }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12
                }
            }
        }
    });
}

function updateRevenueChart() {
    const prep = prepareChartCanvas('revenueChart');
    if (!prep) return;

    const { canvas, container } = prep;

    if (state.filteredEvents.length === 0) {
        showEmptyChart(container, 'No revenue data');
        return;
    }

    const revenueByMonth = {};
    state.filteredEvents.forEach(event => {
        const date = utils.getDateFromFirestore(event.eventDate);
        if (date) {
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            const revenue = (event.cost || 0) * (event.currentParticipants || 0);
            revenueByMonth[monthKey] = (revenueByMonth[monthKey] || 0) + revenue;
        }
    });

    const sortedMonths = Object.keys(revenueByMonth).sort();
    const labels = sortedMonths.map(m => {
        const [year, month] = m.split('-');
        return new Date(year, month - 1).toLocaleDateString('en-US', {
            month: 'short',
            year: 'numeric'
        });
    });
    const data = sortedMonths.map(m => revenueByMonth[m]);

    if (state.charts.revenue) {
        state.charts.revenue.destroy();
    }

    const ctx = canvas.getContext('2d');
    state.charts.revenue = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Revenue (₹)',
                data: data,
                borderColor: '#dc3545',
                backgroundColor: 'rgba(220, 53, 69, 0.1)',
                tension: 0.4,
                fill: true,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    callbacks: {
                        label: (context) => {
                            return 'Revenue: ' + utils.formatCurrency(context.parsed.y);
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: (value) => utils.formatCurrency(value)
                    },
                    grid: { color: 'rgba(0, 0, 0, 0.05)' }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}

// Top Events Table - FIXED: Better empty state
function updateTopEventsTable() {
    const tbody = document.getElementById('topEventsTable');
    if (!tbody) return;

    if (state.filteredEvents.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 60px 20px; color: #6c757d;">
                    <div style="display: flex; flex-direction: column; align-items: center;">
                        <i class="fas fa-calendar-times" style="font-size: 3rem; margin-bottom: 16px; opacity: 0.3;"></i>
                        <p style="margin: 0; font-size: 1.1rem;">No events to display</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    const sortedEvents = [...state.filteredEvents]
        .sort((a, b) => (b.currentParticipants || 0) - (a.currentParticipants || 0))
        .slice(0, 10);

    tbody.innerHTML = sortedEvents.map((event, index) => {
        const eventDate = utils.getDateFromFirestore(event.eventDate);
        const revenue = (event.cost || 0) * (event.currentParticipants || 0);
        const status = utils.getEventStatus(event);

        return `
            <tr>
                <td>
                    <strong>${utils.escapeHtml(event.name)}</strong>
                </td>
                <td>
                    <span class="category-badge" data-category="${utils.escapeHtml(event.category || 'Other')}">
                        ${utils.escapeHtml(event.category || 'Other')}
                    </span>
                </td>
                <td>${event.currentParticipants || 0}</td>
                <td>${utils.formatCurrency(revenue)}</td>
                <td>${utils.formatDate(eventDate)}</td>
                <td>
                    <span class="event-status ${status}">
                        ${status.replace('-', ' ')}
                    </span>
                </td>
            </tr>
        `;
    }).join('');
}

// Category Performance
function updateCategoryPerformance() {
    const container = document.getElementById('categoryPerformance');
    if (!container) return;

    if (state.filteredEvents.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: #6c757d;">
                <i class="fas fa-layer-group" style="font-size: 4rem; margin-bottom: 16px; opacity: 0.3;"></i>
                <h3 style="margin: 0 0 8px 0; color: #495057;">No Category Data</h3>
                <p style="margin: 0; font-size: 0.9rem;">Create events to see category performance</p>
            </div>
        `;
        return;
    }

    const categoryStats = {};

    state.filteredEvents.forEach(event => {
        const cat = event.category || 'Other';
        if (!categoryStats[cat]) {
            categoryStats[cat] = {
                count: 0,
                participants: 0,
                revenue: 0
            };
        }
        categoryStats[cat].count++;
        categoryStats[cat].participants += event.currentParticipants || 0;
        categoryStats[cat].revenue += (event.cost || 0) * (event.currentParticipants || 0);
    });

    container.innerHTML = Object.entries(categoryStats)
        .sort(([, a], [, b]) => b.revenue - a.revenue)
        .map(([category, stats]) => `
            <div class="category-performance-card">
                <span class="category-badge" data-category="${utils.escapeHtml(category)}">
                    ${utils.escapeHtml(category)}
                </span>
                <div class="performance-stats">
                    <div class="performance-stat">
                        <i class="fas fa-calendar"></i>
                        <span>${stats.count} events</span>
                        <strong>${stats.count}</strong>
                    </div>
                    <div class="performance-stat">
                        <i class="fas fa-users"></i>
                        <span>Participants</span>
                        <strong>${stats.participants}</strong>
                    </div>
                    <div class="performance-stat">
                        <i class="fas fa-rupee-sign"></i>
                        <span>Revenue</span>
                        <strong>${utils.formatCurrency(stats.revenue)}</strong>
                    </div>
                </div>
            </div>
        `).join('');
}

// Insights Generation
function generateInsights() {
    const container = document.getElementById('insightsContainer');
    if (!container) return;

    if (state.filteredEvents.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: #6c757d;">
                <i class="fas fa-lightbulb" style="font-size: 4rem; margin-bottom: 16px; opacity: 0.3;"></i>
                <h3 style="margin: 0 0 8px 0; color: #495057;">No Insights Available</h3>
                <p style="margin: 0; font-size: 0.9rem;">Create events to generate insights</p>
            </div>
        `;
        return;
    }

    const insights = [];

    // Most popular category
    const categoryCount = {};
    state.filteredEvents.forEach(event => {
        const cat = event.category || 'Other';
        categoryCount[cat] = (categoryCount[cat] || 0) + 1;
    });
    const topCategory = Object.entries(categoryCount).sort(([, a], [, b]) => b - a)[0];
    if (topCategory) {
        insights.push({
            icon: 'trophy',
            color: '#ffc107',
            title: 'Top Category',
            text: `${topCategory[0]} is your most popular category with ${topCategory[1]} events (${Math.round((topCategory[1] / state.filteredEvents.length) * 100)}% of total).`
        });
    }

    // Average participation
    const avgParticipation = Math.round(
        state.filteredEvents.reduce((sum, e) => sum + (e.currentParticipants || 0), 0) /
        state.filteredEvents.length
    );
    const benchmark = 50;
    const performanceText = avgParticipation >= benchmark
        ? `above the benchmark of ${benchmark}`
        : `below the benchmark of ${benchmark}`;
    insights.push({
        icon: 'chart-line',
        color: avgParticipation >= benchmark ? '#28a745' : '#17a2b8',
        title: 'Participation Rate',
        text: `Your events average ${avgParticipation} participants each, ${performanceText}.`
    });

    // Revenue insight
    const totalRevenue = state.filteredEvents.reduce((sum, e) =>
        sum + ((e.cost || 0) * (e.currentParticipants || 0)), 0
    );
    if (totalRevenue > 0) {
        const avgRevenuePerEvent = Math.round(totalRevenue / state.filteredEvents.length);
        insights.push({
            icon: 'money-bill-wave',
            color: '#28a745',
            title: 'Revenue Performance',
            text: `Generated ${utils.formatCurrency(totalRevenue)} total with an average of ${utils.formatCurrency(avgRevenuePerEvent)} per event.`
        });
    }

    // Best performing event
    const bestEvent = [...state.filteredEvents]
        .sort((a, b) => (b.currentParticipants || 0) - (a.currentParticipants || 0))[0];
    if (bestEvent) {
        insights.push({
            icon: 'star',
            color: '#ff6600',
            title: 'Top Performer',
            text: `"${bestEvent.name}" is your best event with ${bestEvent.currentParticipants || 0} participants.`
        });
    }

    // Event frequency
    if (state.filteredEvents.length > 0) {
        const daysWithEvents = new Set(state.filteredEvents.map(e => {
            const date = utils.getDateFromFirestore(e.createdAt);
            return date ? date.toISOString().split('T')[0] : null;
        }).filter(Boolean)).size;

        const avgEventsPerDay = (state.filteredEvents.length / daysWithEvents).toFixed(1);
        insights.push({
            icon: 'calendar-check',
            color: '#dc3545',
            title: 'Event Frequency',
            text: `Created events on ${daysWithEvents} different days, averaging ${avgEventsPerDay} events per active day.`
        });
    }

    // Completion rate
    const completedEvents = state.filteredEvents.filter(e =>
        utils.getEventStatus(e) === 'completed'
    ).length;
    const completionRate = Math.round((completedEvents / state.filteredEvents.length) * 100);
    insights.push({
        icon: 'check-circle',
        color: '#6f42c1',
        title: 'Completion Rate',
        text: `${completionRate}% of your events have been completed (${completedEvents} out of ${state.filteredEvents.length}).`
    });

    container.innerHTML = insights.map(insight => `
        <div class="insight-card">
            <div class="insight-icon" style="background: ${insight.color}20; color: ${insight.color}">
                <i class="fas fa-${insight.icon}"></i>
            </div>
            <div class="insight-content">
                <h4>${insight.title}</h4>
                <p>${insight.text}</p>
            </div>
        </div>
    `).join('');
}

// Export Functions
window.exportReport = function () {
    if (state.filteredEvents.length === 0) {
        utils.showToast('No data to export', 'error');
        return;
    }

    const reportData = {
        generatedAt: new Date().toISOString(),
        timeFilter: state.timeFilter === 0 ? 'All time' : `Last ${state.timeFilter} days`,
        searchQuery: state.searchQuery || 'None',
        categoryFilter: state.categoryFilter || 'All',
        summary: {
            totalEvents: state.filteredEvents.length,
            totalParticipants: state.filteredEvents.reduce((sum, e) =>
                sum + (e.currentParticipants || 0), 0
            ),
            totalRevenue: state.filteredEvents.reduce((sum, e) =>
                sum + ((e.cost || 0) * (e.currentParticipants || 0)), 0
            ),
            avgParticipation: state.filteredEvents.length > 0
                ? Math.round(state.filteredEvents.reduce((sum, e) =>
                    sum + (e.currentParticipants || 0), 0) / state.filteredEvents.length)
                : 0
        },
        events: state.filteredEvents.map(e => ({
            name: e.name,
            category: e.category,
            location: e.location,
            participants: e.currentParticipants,
            maxParticipants: e.maxParticipants,
            cost: e.cost,
            revenue: (e.cost || 0) * (e.currentParticipants || 0),
            eventDate: utils.getDateFromFirestore(e.eventDate)?.toISOString(),
            createdAt: utils.getDateFromFirestore(e.createdAt)?.toISOString(),
            status: utils.getEventStatus(e)
        }))
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], {
        type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-report-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    utils.showToast('Report exported successfully!', 'success');
};

window.exportCSV = function () {
    if (!state.filteredEvents || state.filteredEvents.length === 0) {
        utils.showToast('No data to export', 'error');
        return;
    }

    const headers = ['Name', 'Category', 'Location', 'Participants', 'Max Participants', 'Cost',
        'Revenue', 'Event Date', 'Created At', 'Status'];
    const rows = state.filteredEvents.map(e => {
        const eventDate = utils.getDateFromFirestore(e.eventDate);
        const createdAt = utils.getDateFromFirestore(e.createdAt);
        const revenue = (e.cost || 0) * (e.currentParticipants || 0);
        return [
            `"${(e.name || '').replace(/"/g, '""')}"`,
            `"${(e.category || '').replace(/"/g, '""')}"`,
            `"${(e.location || '').replace(/"/g, '""')}"`,
            e.currentParticipants || 0,
            e.maxParticipants || 0,
            e.cost || 0,
            revenue,
            eventDate ? utils.formatDate(eventDate, 'long') : '',
            createdAt ? utils.formatDate(createdAt, 'long') : '',
            utils.getEventStatus(e)
        ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    utils.showToast('CSV exported successfully!', 'success');
};

// Refresh Data
window.refreshData = function () {
    const btn = document.querySelector('.refresh-btn');
    if (btn) {
        btn.classList.add('refreshing');
        setTimeout(() => btn.classList.remove('refreshing'), 1000);
    }
    loadAnalyticsData();
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initializeUI();
    initializeFilters();
});

function initializeUI() {
    // Dropdown
    const userMenuBtn = document.querySelector('.user-menu-btn');
    const userDropdown = document.querySelector('.user-dropdown');

    if (userMenuBtn && userDropdown) {
        userMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            userDropdown.classList.toggle('show');
        });

        document.addEventListener('click', (e) => {
            if (!userMenuBtn.contains(e.target) && !userDropdown.contains(e.target)) {
                userDropdown.classList.remove('show');
            }
        });
    }

    // Sidebar
    const sidebar = document.querySelector('.sidebar');
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    const menuToggle = document.querySelector('.menu-toggle');

    if (sidebar) {
        let overlay = document.querySelector('.sidebar-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'sidebar-overlay';
            document.body.appendChild(overlay);
        }

        const toggleSidebar = () => {
            sidebar.classList.toggle('active');
            overlay.classList.toggle('show');
        };

        mobileMenuToggle?.addEventListener('click', toggleSidebar);
        menuToggle?.addEventListener('click', toggleSidebar);
        overlay.addEventListener('click', toggleSidebar);
    }

    // Logout
    const logoutBtn = document.getElementById('logout-btn');
    const logoutLink = document.getElementById('logout-link');

    const handleLogout = async () => {
        try {
            await auth.signOut();
            window.location.href = 'login.html';
        } catch (error) {
            console.error('Error signing out:', error);
            utils.showToast('Error signing out', 'error');
        }
    };

    logoutBtn?.addEventListener('click', handleLogout);
    logoutLink?.addEventListener('click', (e) => {
        e.preventDefault();
        handleLogout();
    });
}

function initializeFilters() {
    // Time filter
    const timeFilter = document.getElementById('timeFilter');
    if (timeFilter) {
        timeFilter.addEventListener('change', window.applyTimeFilter);
    }

    // Search filter (if exists)
    const searchInput = document.getElementById('analytics-search');
    if (searchInput) {
        searchInput.addEventListener('input', utils.debounce((e) => {
            state.searchQuery = e.target.value.trim();
            applyFilters();
        }, 300));
    }

    // Category filter (if exists)
    const categoryFilter = document.getElementById('analytics-category-filter');
    if (categoryFilter) {
        categoryFilter.addEventListener('change', (e) => {
            state.categoryFilter = e.target.value;
            applyFilters();
        });
    }
}

// Responsive chart resize
window.addEventListener('resize', utils.debounce(() => {
    Object.values(state.charts).forEach(chart => {
        if (chart && typeof chart.resize === 'function') {
            chart.resize();
        }
    });
}, 250));

// Cleanup on unload
window.addEventListener('beforeunload', () => {
    if (state.eventsUnsubscribe) {
        state.eventsUnsubscribe();
    }
    Object.values(state.charts).forEach(chart => {
        if (chart && typeof chart.destroy === 'function') {
            chart.destroy();
        }
    });
});