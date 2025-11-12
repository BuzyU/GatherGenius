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
        if (typeof timestamp === 'string') return new Date(timestamp);
        if (typeof timestamp === 'number') return new Date(timestamp);
        return null;
    },

    formatDate: (date, format = 'short') => {
        if (!date) return '—';
        const d = utils.getDateFromFirestore(date);
        if (!d || isNaN(d.getTime())) return '—';
        
        const options = format === 'short'
            ? { month: 'short', day: 'numeric', year: 'numeric' }
            : { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' };
        return d.toLocaleString('en-US', options);
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
        if (!event) return 'upcoming';
        
        // Check if explicitly marked as completed
        if (event.status === 'completed') return 'completed';
        
        const now = new Date();
        const eventDate = utils.getDateFromFirestore(event.eventDate);

        if (!eventDate || isNaN(eventDate.getTime())) return 'upcoming';
        
        // Event is in the past
        if (eventDate < now) {
            // If more than 1 day in the past, consider completed
            const daysDiff = (now - eventDate) / (1000 * 60 * 60 * 24);
            if (daysDiff > 1) return 'completed';
            return 'in-progress';
        }
        
        return 'upcoming';
    },

    calculateTrend: (current, previous) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return Math.round(((current - previous) / previous) * 100);
    },

    sortEventsByDate: (events, descending = true) => {
        return events.sort((a, b) => {
            const dateA = utils.getDateFromFirestore(a.createdAt);
            const dateB = utils.getDateFromFirestore(b.createdAt);
            if (!dateA || isNaN(dateA.getTime())) return 1;
            if (!dateB || isNaN(dateB.getTime())) return -1;
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

// Data Loading
async function loadAnalyticsData() {
    if (state.isLoading) return;

    try {
        state.isLoading = true;
        showLoadingState();

        const eventsSnapshot = await db.collection('events')
            .where('createdBy', '==', state.currentUser.uid)
            .get();

        console.log('Loaded events:', eventsSnapshot.size);

        state.allEvents = [];
        eventsSnapshot.forEach(doc => {
            const data = doc.data();
            console.log('Event data:', data);
            state.allEvents.push({ id: doc.id, ...data });
        });

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

function showLoadingState() {
    document.querySelectorAll('.stat-card p:not(.stat-change)').forEach(el => {
        el.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    });

    const chartContainers = document.querySelectorAll('.chart-container');
    chartContainers.forEach(container => {
        const canvas = container.querySelector('canvas');
        if (canvas) canvas.style.display = 'none';

        let loadingDiv = container.querySelector('.chart-loading');
        if (!loadingDiv) {
            loadingDiv = document.createElement('div');
            loadingDiv.className = 'chart-loading';
            loadingDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading chart...';
            loadingDiv.style.cssText = 'display: flex; align-items: center; justify-content: center; min-height: 300px; color: #6c757d; gap: 10px;';
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

        let errorDiv = container.querySelector('.chart-error');
        if (!errorDiv) {
            errorDiv = document.createElement('div');
            errorDiv.className = 'chart-error';
            errorDiv.innerHTML = `
                <i class="fas fa-exclamation-triangle"></i>
                <p>Error loading data</p>
            `;
            errorDiv.style.cssText = 'display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 300px; color: #dc3545; text-align: center; gap: 10px;';
            container.appendChild(errorDiv);
        }
    });
}

// Real-time Updates
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
                state.allEvents = utils.sortEventsByDate(newEvents, true);
                applyFilters();
            },
            (error) => {
                console.error('Realtime listener error:', error);
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

    let filtered = state.timeFilter === 0
        ? [...state.allEvents]
        : state.allEvents.filter(event => {
            const eventDate = utils.getDateFromFirestore(event.createdAt);
            return eventDate && !isNaN(eventDate.getTime()) && eventDate >= filterDate;
        });

    if (state.searchQuery) {
        filtered = filtered.filter(event => {
            const searchLower = state.searchQuery.toLowerCase();
            return (event.name || '').toLowerCase().includes(searchLower) ||
                (event.category || '').toLowerCase().includes(searchLower) ||
                (event.location || '').toLowerCase().includes(searchLower);
        });
    }

    if (state.categoryFilter && state.categoryFilter !== 'all') {
        filtered = filtered.filter(event =>
            (event.category || 'other').toLowerCase() === state.categoryFilter.toLowerCase()
        );
    }

    state.filteredEvents = filtered;
    console.log('Filtered events:', state.filteredEvents.length);
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
    
    // Get participant count - handle both currentParticipants and participants array
    const totalParticipants = state.filteredEvents.reduce((sum, e) => {
        const count = e.currentParticipants 
            ? parseInt(e.currentParticipants) 
            : (e.participants ? e.participants.length : 0);
        return sum + count;
    }, 0);
    
    const avgParticipation = totalEvents > 0
        ? Math.round(totalParticipants / totalEvents)
        : 0;
    
    const totalRevenue = state.filteredEvents.reduce((sum, e) => {
        const cost = parseFloat(e.cost) || 0;
        const participants = e.currentParticipants 
            ? parseInt(e.currentParticipants) 
            : (e.participants ? e.participants.length : 0);
        return sum + (cost * participants);
    }, 0);

    const previousPeriodEvents = getPreviousPeriodData();
    const prevTotalEvents = previousPeriodEvents.length;
    
    const prevTotalParticipants = previousPeriodEvents.reduce((sum, e) => {
        const count = e.currentParticipants 
            ? parseInt(e.currentParticipants) 
            : (e.participants ? e.participants.length : 0);
        return sum + count;
    }, 0);
    
    const prevTotalRevenue = previousPeriodEvents.reduce((sum, e) => {
        const cost = parseFloat(e.cost) || 0;
        const participants = e.currentParticipants 
            ? parseInt(e.currentParticipants) 
            : (e.participants ? e.participants.length : 0);
        return sum + (cost * participants);
    }, 0);

    updateStat('total-events-stat', totalEvents);
    updateStat('total-participants-stat', totalParticipants);
    updateStat('avg-participation-stat', avgParticipation);
    updateStat('total-revenue-stat', utils.formatCurrency(totalRevenue));

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
        return eventDate && !isNaN(eventDate.getTime()) && 
               eventDate >= previousPeriodStart && eventDate < currentPeriodStart;
    });
}

function updateStat(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = value;
    }
}

function updateChangeIndicator(elementId, percentage) {
    const element = document.getElementById(elementId);
    if (!element) return;

    let className = 'stat-change neutral';
    let icon = '';

    if (percentage > 0) {
        className = 'stat-change positive';
        icon = '<i class="fas fa-arrow-up"></i> ';
    } else if (percentage < 0) {
        className = 'stat-change negative';
        icon = '<i class="fas fa-arrow-down"></i> ';
    }

    element.className = className;
    element.innerHTML = `${icon}${Math.abs(percentage)}% from previous period`;
}

// Chart Updates
function updateCharts() {
    updateEventsTimelineChart();
    updateCategoryChart();
    updateParticipationChart();
    updateStatusChart();
    updateRevenueChart();
}

function prepareChartCanvas(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;

    const container = canvas.closest('.chart-container') || canvas.parentElement;

    const loadingDiv = container.querySelector('.chart-loading');
    const emptyDiv = container.querySelector('.chart-empty');
    const errorDiv = container.querySelector('.chart-error');
    
    if (loadingDiv) loadingDiv.remove();
    if (emptyDiv) emptyDiv.remove();
    if (errorDiv) errorDiv.remove();

    canvas.style.display = 'block';

    return { canvas, container };
}

function showEmptyChart(container, message) {
    if (!container) return;

    const canvas = container.querySelector('canvas');
    if (canvas) canvas.style.display = 'none';

    let emptyDiv = container.querySelector('.chart-empty');
    if (!emptyDiv) {
        emptyDiv = document.createElement('div');
        emptyDiv.className = 'chart-empty';
        emptyDiv.style.cssText = 'display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 300px; color: #6c757d; text-align: center; gap: 10px;';
        container.appendChild(emptyDiv);
    }
    emptyDiv.innerHTML = `
        <i class="fas fa-chart-line" style="font-size: 3rem; opacity: 0.3;"></i>
        <p style="margin: 0;">${message}</p>
    `;
}

function updateEventsTimelineChart() {
    const prep = prepareChartCanvas('eventsTimelineChart');
    if (!prep) return;

    const { canvas, container } = prep;

    if (state.filteredEvents.length === 0) {
        showEmptyChart(container, 'No events to display');
        return;
    }

    const eventsByDate = {};
    state.filteredEvents.forEach(event => {
        const date = utils.getDateFromFirestore(event.createdAt);
        if (date && !isNaN(date.getTime())) {
            const dateKey = date.toISOString().split('T')[0];
            eventsByDate[dateKey] = (eventsByDate[dateKey] || 0) + 1;
        }
    });

    const sortedDates = Object.keys(eventsByDate).sort();
    
    if (sortedDates.length === 0) {
        showEmptyChart(container, 'No date data available');
        return;
    }

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
        const date = utils.getDateFromFirestore(event.eventDate || event.date);
        if (date && !isNaN(date.getTime())) {
            const dateKey = date.toISOString().split('T')[0];
            const participants = event.currentParticipants 
                ? parseInt(event.currentParticipants) 
                : (event.participants ? event.participants.length : 0);
            participationByDate[dateKey] = (participationByDate[dateKey] || 0) + participants;
        }
    });

    const sortedDates = Object.keys(participationByDate).sort();
    
    if (sortedDates.length === 0) {
        showEmptyChart(container, 'No participation data available');
        return;
    }

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
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
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
                    labels: { padding: 15 }
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
        const date = utils.getDateFromFirestore(event.eventDate || event.date);
        if (date && !isNaN(date.getTime())) {
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            const cost = parseFloat(event.cost) || 0;
            const participants = event.currentParticipants 
                ? parseInt(event.currentParticipants) 
                : (event.participants ? event.participants.length : 0);
            const revenue = cost * participants;
            revenueByMonth[monthKey] = (revenueByMonth[monthKey] || 0) + revenue;
        }
    });

    const sortedMonths = Object.keys(revenueByMonth).sort();
    
    if (sortedMonths.length === 0) {
        showEmptyChart(container, 'No revenue data available');
        return;
    }

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
                    callbacks: {
                        label: (context) => 'Revenue: ' + utils.formatCurrency(context.parsed.y)
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

// Top Events Table
function updateTopEventsTable() {
    const tbody = document.getElementById('topEventsTable');
    if (!tbody) return;

    if (state.filteredEvents.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 60px 20px; color: #6c757d;">
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 10px;">
                        <i class="fas fa-calendar-times" style="font-size: 3rem; opacity: 0.3;"></i>
                        <p style="margin: 0;">No events to display</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    const sortedEvents = [...state.filteredEvents]
        .sort((a, b) => {
            const aCount = a.currentParticipants 
                ? parseInt(a.currentParticipants) 
                : (a.participants ? a.participants.length : 0);
            const bCount = b.currentParticipants 
                ? parseInt(b.currentParticipants) 
                : (b.participants ? b.participants.length : 0);
            return bCount - aCount;
        })
        .slice(0, 10);

    tbody.innerHTML = sortedEvents.map(event => {
        const eventDate = utils.getDateFromFirestore(event.eventDate || event.date);
        const cost = parseFloat(event.cost) || 0;
        const participants = event.currentParticipants 
            ? parseInt(event.currentParticipants) 
            : (event.participants ? event.participants.length : 0);
        const revenue = cost * participants;
        const status = utils.getEventStatus(event);

        return `
            <tr>
                <td><strong>${utils.escapeHtml(event.name)}</strong></td>
                <td>
                    <span class="category-badge" data-category="${utils.escapeHtml(event.category || 'Other')}">
                        ${utils.escapeHtml(event.category || 'Other')}
                    </span>
                </td>
                <td>${participants}</td>
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
                <i class="fas fa-layer-group" style="font-size: 3rem; opacity: 0.3; margin-bottom: 10px;"></i>
                <p style="margin: 0;">No category data available</p>
            </div>
        `;
        return;
    }

    const categoryStats = {};

    state.filteredEvents.forEach(event => {
        const cat = event.category || 'Other';
        if (!categoryStats[cat]) {
            categoryStats[cat] = { count: 0, participants: 0, revenue: 0 };
        }
        categoryStats[cat].count++;
        
        const participants = event.currentParticipants 
            ? parseInt(event.currentParticipants) 
            : (event.participants ? event.participants.length : 0);
        categoryStats[cat].participants += participants;
        
        const cost = parseFloat(event.cost) || 0;
        categoryStats[cat].revenue += cost * participants;
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
                        <span>Events</span>
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
                <i class="fas fa-lightbulb" style="font-size: 3rem; opacity: 0.3; margin-bottom: 10px;"></i>
                <p style="margin: 0;">No insights available</p>
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
        const percentage = Math.round((topCategory[1] / state.filteredEvents.length) * 100);
        insights.push({
            icon: 'trophy',
            color: '#ffc107',
            title: 'Top Category',
            text: `${topCategory[0]} is your most popular category with ${topCategory[1]} event${topCategory[1] !== 1 ? 's' : ''} (${percentage}% of total).`
        });
    }

    // Average participation
    const totalParticipants = state.filteredEvents.reduce((sum, e) => {
        const participants = e.currentParticipants 
            ? parseInt(e.currentParticipants) 
            : (e.participants ? e.participants.length : 0);
        return sum + participants;
    }, 0);
    const avgParticipation = Math.round(totalParticipants / state.filteredEvents.length);
    const benchmark = 50;
    const performanceText = avgParticipation >= benchmark
        ? `above the benchmark of ${benchmark}`
        : `below the benchmark of ${benchmark}`;
    insights.push({
        icon: 'chart-line',
        color: avgParticipation >= benchmark ? '#28a745' : '#17a2b8',
        title: 'Participation Rate',
        text: `Your events average ${avgParticipation} participant${avgParticipation !== 1 ? 's' : ''} each, ${performanceText}.`
    });

    // Revenue insight
    const totalRevenue = state.filteredEvents.reduce((sum, e) => {
        const cost = parseFloat(e.cost) || 0;
        const participants = e.currentParticipants 
            ? parseInt(e.currentParticipants) 
            : (e.participants ? e.participants.length : 0);
        return sum + (cost * participants);
    }, 0);
    
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
        .sort((a, b) => {
            const aCount = a.currentParticipants 
                ? parseInt(a.currentParticipants) 
                : (a.participants ? a.participants.length : 0);
            const bCount = b.currentParticipants 
                ? parseInt(b.currentParticipants) 
                : (b.participants ? b.participants.length : 0);
            return bCount - aCount;
        })[0];
    
    if (bestEvent) {
        const participants = bestEvent.currentParticipants 
            ? parseInt(bestEvent.currentParticipants) 
            : (bestEvent.participants ? bestEvent.participants.length : 0);
        
        if (participants > 0) {
            insights.push({
                icon: 'star',
                color: '#ff6600',
                title: 'Top Performer',
                text: `"${bestEvent.name}" is your best event with ${participants} participant${participants !== 1 ? 's' : ''}.`
            });
        }
    }

    // Event frequency
    if (state.filteredEvents.length > 0) {
        const daysWithEvents = new Set(state.filteredEvents.map(e => {
            const date = utils.getDateFromFirestore(e.createdAt);
            return date && !isNaN(date.getTime()) ? date.toISOString().split('T')[0] : null;
        }).filter(Boolean)).size;

        const avgEventsPerDay = (state.filteredEvents.length / Math.max(daysWithEvents, 1)).toFixed(1);
        insights.push({
            icon: 'calendar-check',
            color: '#dc3545',
            title: 'Event Frequency',
            text: `Created events on ${daysWithEvents} different day${daysWithEvents !== 1 ? 's' : ''}, averaging ${avgEventsPerDay} event${avgEventsPerDay !== '1.0' ? 's' : ''} per active day.`
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
        summary: {
            totalEvents: state.filteredEvents.length,
            totalParticipants: state.filteredEvents.reduce((sum, e) =>
                sum + (parseInt(e.currentParticipants) || 0), 0
            ),
            totalRevenue: state.filteredEvents.reduce((sum, e) => {
                const cost = parseFloat(e.cost) || 0;
                const participants = parseInt(e.currentParticipants) || 0;
                return sum + (cost * participants);
            }, 0),
            avgParticipation: state.filteredEvents.length > 0
                ? Math.round(state.filteredEvents.reduce((sum, e) =>
                    sum + (parseInt(e.currentParticipants) || 0), 0) / state.filteredEvents.length)
                : 0
        },
        events: state.filteredEvents.map(e => ({
            name: e.name,
            category: e.category,
            location: e.location,
            participants: parseInt(e.currentParticipants) || 0,
            maxParticipants: parseInt(e.maxParticipants) || 0,
            cost: parseFloat(e.cost) || 0,
            revenue: (parseFloat(e.cost) || 0) * (parseInt(e.currentParticipants) || 0),
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

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initializeUI();
    initializeFilters();
});

function initializeUI() {
    // User dropdown
    const userMenuBtn = document.querySelector('.user-menu-btn');
    const userDropdown = document.querySelector('.user-dropdown');

    if (userMenuBtn && userDropdown) {
        userMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            userDropdown.classList.toggle('show');
        });

        document.addEventListener('click', () => {
            userDropdown.classList.remove('show');
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
    const timeFilter = document.getElementById('timeFilter');
    if (timeFilter) {
        timeFilter.addEventListener('change', window.applyTimeFilter);
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
// ========================================
// IMPROVED ANALYTICS SYSTEM - COMPLETE VERSION
// Add this to the END of your analytics.js file (after all existing code)
// ========================================

// ========================================
// LOADING OVERLAY FUNCTIONS
// ========================================
function showLoadingOverlay() {
    let overlay = document.querySelector('.loading-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'loading-overlay';
        overlay.innerHTML = `
            <div class="loading-spinner-container">
                <div class="loading-spinner"></div>
                <p>Loading analytics...</p>
            </div>
        `;
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;
        document.body.appendChild(overlay);
    }
    
    // Force reflow
    overlay.offsetHeight;
    overlay.style.opacity = '1';
}

function hideLoadingOverlay() {
    const overlay = document.querySelector('.loading-overlay');
    if (overlay) {
        overlay.style.opacity = '0';
        setTimeout(() => {
            if (overlay.parentNode) {
                overlay.remove();
            }
        }, 300);
    }
}

// ========================================
// ENHANCED STATE MANAGEMENT
// ========================================
const analyticsState = {
    currentUser: null,
    allEvents: [],
    filteredEvents: [],
    charts: {},
    timeFilter: 30,
    searchQuery: '',
    categoryFilter: 'all',
    eventsUnsubscribe: null,
    isLoading: false,
    lastFetchTime: null,
    cacheTimeout: 5 * 60 * 1000, // 5 minutes
    useRealtime: true
};

// ========================================
// REPLACE EXISTING loadAnalyticsData FUNCTION
// ========================================
async function loadAnalyticsDataImproved() {
    if (analyticsState.isLoading) {
        console.log('⏳ Already loading, skipping...');
        return;
    }

    try {
        analyticsState.isLoading = true;
        analyticsState.currentUser = state.currentUser || auth.currentUser;
        
        if (!analyticsState.currentUser) {
            console.warn('⚠️ No user found');
            return;
        }

        showLoadingOverlay();
        showLoadingState();

        // Check cache
        const cacheKey = `analytics_${analyticsState.currentUser.uid}_${state.timeFilter}`;
        const cacheTimeKey = `${cacheKey}_time`;
        const cachedData = sessionStorage.getItem(cacheKey);
        const cacheTime = sessionStorage.getItem(cacheTimeKey);
        const now = Date.now();

        // Use cache if valid
        if (cachedData && cacheTime && (now - parseInt(cacheTime)) < analyticsState.cacheTimeout) {
            console.log('📦 Using cached analytics data');
            state.allEvents = JSON.parse(cachedData);
            applyFilters();
            hideLoadingOverlay();
            analyticsState.isLoading = false;
            return;
        }

        console.log('🔄 Fetching fresh analytics data...');

        // Build query with proper error handling
        let eventsQuery;
        const uid = analyticsState.currentUser.uid;
        
        try {
            // Try createdBy first
            eventsQuery = db.collection('events')
                .where('createdBy', '==', uid);
            
            console.log('Using createdBy index');
        } catch (error) {
            console.warn('createdBy query failed, trying organizerId:', error);
            
            try {
                // Fallback to organizerId
                eventsQuery = db.collection('events')
                    .where('organizerId', '==', uid);
                
                console.log('Using organizerId index');
            } catch (fallbackError) {
                console.error('Both queries failed:', fallbackError);
                throw new Error('Unable to query events. Please check Firebase indexes.');
            }
        }

        // Apply time filter if not "all time"
        if (state.timeFilter > 0) {
            const filterDate = new Date();
            filterDate.setDate(filterDate.getDate() - state.timeFilter);
            eventsQuery = eventsQuery.where('createdAt', '>=', filterDate);
        }

        // Add ordering and limit
        eventsQuery = eventsQuery.orderBy('createdAt', 'desc');
        
        // Mobile optimization
        const isMobile = window.innerWidth <= 768;
        const fetchLimit = isMobile ? 50 : 100;
        eventsQuery = eventsQuery.limit(fetchLimit);

        // Execute query
        const eventsSnapshot = await eventsQuery.get();
        console.log(`✅ Loaded ${eventsSnapshot.size} events`);

        // Process events
        state.allEvents = [];
        eventsSnapshot.forEach(doc => {
            const data = doc.data();
            state.allEvents.push({ 
                id: doc.id, 
                ...data,
                // Normalize dates
                createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
                eventDate: data.eventDate?.toDate?.() || data.date?.toDate?.() || new Date(data.eventDate || data.date)
            });
        });

        // Sort by date
        state.allEvents = utils.sortEventsByDate(state.allEvents, true);

        // Cache the data
        try {
            sessionStorage.setItem(cacheKey, JSON.stringify(state.allEvents));
            sessionStorage.setItem(cacheTimeKey, now.toString());
            console.log('💾 Data cached successfully');
        } catch (cacheError) {
            console.warn('Cache storage failed:', cacheError);
            clearOldCache();
        }

        applyFilters();
        analyticsState.lastFetchTime = now;

    } catch (error) {
        console.error('❌ Error loading analytics:', error);
        
        // Specific error messages
        if (error.code === 'failed-precondition') {
            utils.showToast('Firebase indexes are missing. Please create required indexes.', 'error');
        } else if (error.code === 'permission-denied') {
            utils.showToast('Permission denied. Please check your Firebase security rules.', 'error');
        } else {
            utils.showToast('Error loading analytics: ' + error.message, 'error');
        }
        
        showErrorState();
    } finally {
        hideLoadingOverlay();
        analyticsState.isLoading = false;
    }
}

// ========================================
// REPLACE EXISTING setupRealtimeUpdates FUNCTION
// ========================================
function setupRealtimeUpdatesImproved() {
    if (!state.currentUser) return;

    // Unsubscribe from previous listener
    if (state.eventsUnsubscribe) {
        state.eventsUnsubscribe();
    }

    console.log('🔔 Setting up real-time updates...');

    try {
        let eventsQuery = db.collection('events')
            .where('createdBy', '==', state.currentUser.uid);
        
        // Apply time filter
        if (state.timeFilter > 0) {
            const filterDate = new Date();
            filterDate.setDate(filterDate.getDate() - state.timeFilter);
            eventsQuery = eventsQuery.where('createdAt', '>=', filterDate);
        }
        
        eventsQuery = eventsQuery.orderBy('createdAt', 'desc').limit(100);
        
        state.eventsUnsubscribe = eventsQuery.onSnapshot(
            (snapshot) => {
                console.log(`🔄 Real-time update: ${snapshot.size} events`);
                
                const newEvents = [];
                snapshot.forEach(doc => {
                    const data = doc.data();
                    newEvents.push({ 
                        id: doc.id, 
                        ...data,
                        createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
                        eventDate: data.eventDate?.toDate?.() || data.date?.toDate?.() || new Date(data.eventDate || data.date)
                    });
                });
                
                state.allEvents = utils.sortEventsByDate(newEvents, true);
                
                // Update cache
                const cacheKey = `analytics_${state.currentUser.uid}_${state.timeFilter}`;
                try {
                    sessionStorage.setItem(cacheKey, JSON.stringify(state.allEvents));
                    sessionStorage.setItem(`${cacheKey}_time`, Date.now().toString());
                } catch (e) {
                    console.warn('Cache update failed:', e);
                }
                
                applyFilters();
                showUpdateNotification();
            },
            (error) => {
                console.error('Real-time listener error:', error);
                if (error.code === 'permission-denied') {
                    console.warn('Real-time updates disabled due to permissions');
                    analyticsState.useRealtime = false;
                }
            }
        );
    } catch (error) {
        console.error('Failed to setup real-time updates:', error);
    }
}

// ========================================
// UTILITY FUNCTIONS
// ========================================
function clearOldCache() {
    try {
        const keys = Object.keys(sessionStorage);
        const analyticsKeys = keys.filter(k => k.startsWith('analytics_'));
        
        if (analyticsKeys.length > 6) {
            const sortedKeys = analyticsKeys
                .filter(k => k.includes('_time'))
                .map(k => ({
                    key: k,
                    time: parseInt(sessionStorage.getItem(k) || '0')
                }))
                .sort((a, b) => b.time - a.time);
            
            sortedKeys.slice(3).forEach(item => {
                const dataKey = item.key.replace('_time', '');
                sessionStorage.removeItem(dataKey);
                sessionStorage.removeItem(item.key);
            });
        }
    } catch (error) {
        console.warn('Error clearing cache:', error);
    }
}

function showUpdateNotification() {
    const notification = document.createElement('div');
    notification.className = 'update-notification';
    notification.innerHTML = '<i class="fas fa-sync-alt"></i> Data updated';
    notification.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background: #28a745;
        color: white;
        padding: 10px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        font-size: 14px;
        display: flex;
        align-items: center;
        gap: 8px;
        opacity: 0;
        transform: translateY(-20px);
        transition: all 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateY(0)';
    }, 10);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(-20px)';
        setTimeout(() => notification.remove(), 300);
    }, 2000);
}

// ========================================
// REPLACE EXISTING FUNCTIONS
// ========================================

// Store original function
const originalLoadAnalyticsData = typeof loadAnalyticsData !== 'undefined' ? loadAnalyticsData : null;
const originalSetupRealtimeUpdates = typeof setupRealtimeUpdates !== 'undefined' ? setupRealtimeUpdates : null;

// Replace with improved versions
loadAnalyticsData = loadAnalyticsDataImproved;
setupRealtimeUpdates = setupRealtimeUpdatesImproved;

// ========================================
// MANUAL REFRESH FUNCTION
// ========================================
window.refreshAnalytics = async function() {
    const btn = document.querySelector('.refresh-btn');
    if (btn) {
        btn.classList.add('refreshing');
        btn.disabled = true;
    }

    console.log('🔄 Manual refresh triggered');

    // Clear cache
    const cacheKey = `analytics_${state.currentUser.uid}_${state.timeFilter}`;
    sessionStorage.removeItem(cacheKey);
    sessionStorage.removeItem(`${cacheKey}_time`);

    await loadAnalyticsData();

    if (btn) {
        setTimeout(() => {
            btn.classList.remove('refreshing');
            btn.disabled = false;
        }, 1000);
    }

    utils.showToast('Analytics data refreshed', 'success');
};

// ========================================
// UPDATE TIME FILTER FUNCTION
// ========================================
const originalApplyTimeFilter = window.applyTimeFilter;
window.applyTimeFilter = async function() {
    const filterSelect = document.getElementById('timeFilter');
    const newFilter = parseInt(filterSelect.value) || 0;
    
    if (newFilter !== state.timeFilter) {
        state.timeFilter = newFilter;
        console.log(`⏱️ Time filter changed to: ${newFilter === 0 ? 'All time' : `Last ${newFilter} days`}`);
        
        // Clear cache for new filter
        const cacheKey = `analytics_${state.currentUser.uid}_${newFilter}`;
        sessionStorage.removeItem(cacheKey);
        sessionStorage.removeItem(`${cacheKey}_time`);
        
        await loadAnalyticsData();
        
        // Update real-time listener
        if (analyticsState.useRealtime) {
            setupRealtimeUpdates();
        }
    }
};

// ========================================
// ONLINE/OFFLINE HANDLERS
// ========================================
window.addEventListener('online', () => {
    console.log('✅ Connection restored');
    utils.showToast('Connection restored. Refreshing data...', 'info');
    loadAnalyticsData();
});

window.addEventListener('offline', () => {
    console.log('⚠️ Connection lost');
    utils.showToast('You are offline. Showing cached data.', 'warning');
});

// ========================================
// ENHANCED CLEANUP
// ========================================
window.addEventListener('beforeunload', () => {
    if (state.eventsUnsubscribe) {
        state.eventsUnsubscribe();
    }
    
    Object.values(state.charts).forEach(chart => {
        if (chart && typeof chart.destroy === 'function') {
            try {
                chart.destroy();
            } catch (e) {
                console.warn('Error destroying chart:', e);
            }
        }
    });
    
    clearOldCache();
});

// ========================================
// ADD MISSING CSS STYLES
// ========================================
function injectAnalyticsStyles() {
    if (document.getElementById('analytics-enhanced-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'analytics-enhanced-styles';
    style.textContent = `
        .loading-spinner-container {
            text-align: center;
            color: white;
        }
        
        .loading-spinner {
            width: 50px;
            height: 50px;
            border: 4px solid rgba(255, 255, 255, 0.3);
            border-top-color: #ff6600;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
            margin: 0 auto 20px;
        }
        
        .loading-spinner-container p {
            font-size: 16px;
            margin: 0;
        }
        
        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        
        .refresh-btn {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 10px 16px;
            background: #6c757d;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.3s ease;
        }
        
        .refresh-btn:hover:not(.refreshing) {
            background: #5a6268;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        
        .refresh-btn:active {
            transform: translateY(0);
        }
        
        .refresh-btn.refreshing {
            pointer-events: none;
            opacity: 0.7;
        }
        
        .refresh-btn.refreshing i {
            animation: spin 1s linear infinite;
        }
        
        .update-notification {
            animation: slideInRight 0.3s ease;
        }
        
        @keyframes slideInRight {
            from {
                opacity: 0;
                transform: translateX(100px);
            }
            to {
                opacity: 1;
                transform: translateX(0);
            }
        }
        
        @media (max-width: 768px) {
            .refresh-btn .btn-text {
                display: none;
            }
            
            .refresh-btn {
                padding: 10px 12px;
            }
            
            .update-notification {
                top: 60px;
                right: 10px;
                font-size: 13px;
                padding: 8px 16px;
            }
        }
    `;
    
    document.head.appendChild(style);
}

// Inject styles on load
injectAnalyticsStyles();

console.log('✅ Improved Analytics System Loaded (Complete)');
console.log('📊 Features: Optimized queries, caching, real-time updates, mobile optimization');
console.log('💡 Use: refreshAnalytics() to manually refresh data');