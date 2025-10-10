// analytics.js - Enhanced Analytics System with Real-time Data

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

let currentUser = null;
let allEvents = [];
let filteredEvents = [];
let charts = {};
let timeFilter = 30; // Default: last 30 days

// Utility Functions
function escapeHtml(str = '') {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${escapeHtml(message)}</span>
    `;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function getDateFromFirestore(timestamp) {
    if (!timestamp) return null;
    if (timestamp.toDate) return timestamp.toDate();
    if (timestamp instanceof Date) return timestamp;
    return new Date(timestamp);
}

// Auth State
auth.onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = 'login.html';
        return;
    }
    currentUser = user;
    updateUserInterface(user);
    await loadAnalyticsData();
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

// Load Analytics Data
async function loadAnalyticsData() {
    try {
        // Show loading state
        showLoadingState();
        
        // Load events
        const eventsSnapshot = await db.collection('events')
            .where('organizerId', '==', currentUser.uid)
            .get();
        
        allEvents = [];
        eventsSnapshot.forEach(doc => {
            allEvents.push({ id: doc.id, ...doc.data() });
        });
        
        // Apply time filter
        applyTimeFilter();
        
    } catch (error) {
        console.error('Error loading analytics:', error);
        showToast('Error loading analytics data', 'error');
        hideLoadingState();
    }
}

function showLoadingState() {
    document.querySelectorAll('.stat-card p').forEach(el => {
        el.innerHTML = '<span class="loading-shimmer">Loading...</span>';
    });
}

function hideLoadingState() {
    // Loading state will be hidden when data is populated
}

// Time Filter
window.applyTimeFilter = function() {
    const filterSelect = document.getElementById('timeFilter');
    timeFilter = parseInt(filterSelect.value);
    
    const now = new Date();
    const filterDate = new Date(now.getTime() - (timeFilter * 24 * 60 * 60 * 1000));
    
    if (timeFilter === 0) {
        filteredEvents = [...allEvents];
    } else {
        filteredEvents = allEvents.filter(event => {
            const eventDate = getDateFromFirestore(event.createdAt);
            return eventDate && eventDate >= filterDate;
        });
    }
    
    updateAllAnalytics();
};

function updateAllAnalytics() {
    updateOverviewStats();
    updateCharts();
    updateTopEventsTable();
    updateCategoryPerformance();
    generateInsights();
}

// Overview Stats
function updateOverviewStats() {
    const totalEvents = filteredEvents.length;
    const totalParticipants = filteredEvents.reduce((sum, e) => sum + (e.currentParticipants || 0), 0);
    const avgParticipation = totalEvents > 0 ? Math.round(totalParticipants / totalEvents) : 0;
    const totalRevenue = filteredEvents.reduce((sum, e) => sum + ((e.cost || 0) * (e.currentParticipants || 0)), 0);
    
    // Calculate change percentages (simplified - comparing to total vs filtered)
    const changePercentage = allEvents.length > 0 ? 
        Math.round(((filteredEvents.length - allEvents.length) / allEvents.length) * 100) : 0;
    
    document.getElementById('total-events-stat').textContent = totalEvents;
    document.getElementById('total-participants-stat').textContent = totalParticipants;
    document.getElementById('avg-participation-stat').textContent = avgParticipation;
    document.getElementById('total-revenue-stat').textContent = `₹${totalRevenue.toLocaleString()}`;
    
    // Update change indicators
    updateChangeIndicator('events-change', changePercentage);
    updateChangeIndicator('participants-change', changePercentage);
    document.getElementById('participation-change').textContent = 'per event';
    updateChangeIndicator('revenue-change', changePercentage);
}

function updateChangeIndicator(elementId, percentage) {
    const element = document.getElementById(elementId);
    if (element && percentage !== 0) {
        element.textContent = `${percentage > 0 ? '+' : ''}${percentage}% from last period`;
        element.className = `stat-change ${percentage > 0 ? 'positive' : 'negative'}`;
    }
}

// Charts
function updateCharts() {
    updateEventsTimelineChart();
    updateCategoryChart();
    updateParticipationChart();
    updateStatusChart();
    updateRevenueChart();
}

function updateEventsTimelineChart() {
    const ctx = document.getElementById('eventsTimelineChart');
    if (!ctx) return;
    
    // Group events by date
    const eventsByDate = {};
    filteredEvents.forEach(event => {
        const date = getDateFromFirestore(event.createdAt);
        if (date) {
            const dateKey = date.toISOString().split('T')[0];
            eventsByDate[dateKey] = (eventsByDate[dateKey] || 0) + 1;
        }
    });
    
    const sortedDates = Object.keys(eventsByDate).sort();
    const labels = sortedDates.map(d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    const data = sortedDates.map(d => eventsByDate[d]);
    
    if (charts.timeline) charts.timeline.destroy();
    
    charts.timeline = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Events Created',
                data: data,
                borderColor: '#ff6600',
                backgroundColor: 'rgba(255, 102, 0, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true, ticks: { precision: 0 } }
            }
        }
    });
}

function updateCategoryChart() {
    const ctx = document.getElementById('categoryChart');
    if (!ctx) return;
    
    const categoryCount = {};
    filteredEvents.forEach(event => {
        const cat = event.category || 'Other';
        categoryCount[cat] = (categoryCount[cat] || 0) + 1;
    });
    
    const labels = Object.keys(categoryCount);
    const data = Object.values(categoryCount);
    const colors = [
        '#ff6600', '#17a2b8', '#28a745', '#ffc107', 
        '#dc3545', '#6f42c1', '#fd7e14', '#20c997'
    ];
    
    if (charts.category) charts.category.destroy();
    
    charts.category = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors.slice(0, labels.length)
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
}

function updateParticipationChart() {
    const ctx = document.getElementById('participationChart');
    if (!ctx) return;
    
    const participationByDate = {};
    filteredEvents.forEach(event => {
        const date = getDateFromFirestore(event.eventDate);
        if (date) {
            const dateKey = date.toISOString().split('T')[0];
            participationByDate[dateKey] = (participationByDate[dateKey] || 0) + (event.currentParticipants || 0);
        }
    });
    
    const sortedDates = Object.keys(participationByDate).sort();
    const labels = sortedDates.map(d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    const data = sortedDates.map(d => participationByDate[d]);
    
    if (charts.participation) charts.participation.destroy();
    
    charts.participation = new Chart(ctx, {
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
                y: { beginAtZero: true, ticks: { precision: 0 } }
            }
        }
    });
}

function updateStatusChart() {
    const ctx = document.getElementById('statusChart');
    if (!ctx) return;
    
    const statusCount = { upcoming: 0, 'in-progress': 0, completed: 0 };
    const now = new Date();
    
    filteredEvents.forEach(event => {
        const eventDate = getDateFromFirestore(event.eventDate);
        if (eventDate) {
            if (eventDate > now) {
                statusCount.upcoming++;
            } else if (event.status === 'completed') {
                statusCount.completed++;
            } else {
                statusCount['in-progress']++;
            }
        }
    });
    
    if (charts.status) charts.status.destroy();
    
    charts.status = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['Upcoming', 'In Progress', 'Completed'],
            datasets: [{
                data: [statusCount.upcoming, statusCount['in-progress'], statusCount.completed],
                backgroundColor: ['#17a2b8', '#ffc107', '#28a745']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
}

function updateRevenueChart() {
    const ctx = document.getElementById('revenueChart');
    if (!ctx) return;
    
    const revenueByMonth = {};
    filteredEvents.forEach(event => {
        const date = getDateFromFirestore(event.eventDate);
        if (date) {
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            const revenue = (event.cost || 0) * (event.currentParticipants || 0);
            revenueByMonth[monthKey] = (revenueByMonth[monthKey] || 0) + revenue;
        }
    });
    
    const sortedMonths = Object.keys(revenueByMonth).sort();
    const labels = sortedMonths.map(m => {
        const [year, month] = m.split('-');
        return new Date(year, month - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    });
    const data = sortedMonths.map(m => revenueByMonth[m]);
    
    if (charts.revenue) charts.revenue.destroy();
    
    charts.revenue = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Revenue (₹)',
                data: data,
                borderColor: '#dc3545',
                backgroundColor: 'rgba(220, 53, 69, 0.1)',
                tension: 0.4,
                fill: true
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
                    ticks: {
                        callback: function(value) {
                            return '₹' + value.toLocaleString();
                        }
                    }
                }
            }
        }
    });
}

// Top Events Table
function updateTopEventsTable() {
    const tbody = document.getElementById('topEventsTable');
    if (!tbody) return;
    
    const sortedEvents = [...filteredEvents]
        .sort((a, b) => (b.currentParticipants || 0) - (a.currentParticipants || 0))
        .slice(0, 10);
    
    if (sortedEvents.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="loading-placeholder">No events to display</td></tr>';
        return;
    }
    
    tbody.innerHTML = sortedEvents.map(event => {
        const eventDate = getDateFromFirestore(event.eventDate);
        const revenue = (event.cost || 0) * (event.currentParticipants || 0);
        const status = getEventStatus(event);
        
        return `
            <tr>
                <td><strong>${escapeHtml(event.name)}</strong></td>
                <td><span class="category-badge" data-category="${escapeHtml(event.category || '')}">${escapeHtml(event.category || 'Other')}</span></td>
                <td>${event.currentParticipants || 0}</td>
                <td>₹${revenue.toLocaleString()}</td>
                <td>${eventDate ? eventDate.toLocaleDateString() : '—'}</td>
                <td><span class="event-status ${status}">${status.replace('-', ' ')}</span></td>
            </tr>
        `;
    }).join('');
}

function getEventStatus(event) {
    const now = new Date();
    const eventDate = getDateFromFirestore(event.eventDate);
    
    if (!eventDate) return 'upcoming';
    if (eventDate > now) return 'upcoming';
    if (event.status === 'completed') return 'completed';
    return 'in-progress';
}

// Category Performance
function updateCategoryPerformance() {
    const container = document.getElementById('categoryPerformance');
    if (!container) return;
    
    const categoryStats = {};
    
    filteredEvents.forEach(event => {
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
                <span class="category-badge" data-category="${escapeHtml(category)}">${escapeHtml(category)}</span>
                <div class="performance-stats">
                    <div class="performance-stat">
                        <i class="fas fa-calendar"></i>
                        <span>${stats.count} events</span>
                    </div>
                    <div class="performance-stat">
                        <i class="fas fa-users"></i>
                        <span>${stats.participants} participants</span>
                    </div>
                    <div class="performance-stat">
                        <i class="fas fa-rupee-sign"></i>
                        <span>₹${stats.revenue.toLocaleString()}</span>
                    </div>
                </div>
            </div>
        `).join('');
}

// Insights
function generateInsights() {
    const container = document.getElementById('insightsContainer');
    if (!container) return;
    
    const insights = [];
    
    // Most popular category
    const categoryCount = {};
    filteredEvents.forEach(event => {
        const cat = event.category || 'Other';
        categoryCount[cat] = (categoryCount[cat] || 0) + 1;
    });
    const topCategory = Object.entries(categoryCount).sort(([, a], [, b]) => b - a)[0];
    if (topCategory) {
        insights.push({
            icon: 'trophy',
            color: '#ffc107',
            title: 'Top Category',
            text: `${topCategory[0]} is your most popular category with ${topCategory[1]} events.`
        });
    }
    
    // Average participation rate
    const avgParticipation = filteredEvents.length > 0 ?
        Math.round(filteredEvents.reduce((sum, e) => sum + (e.currentParticipants || 0), 0) / filteredEvents.length) : 0;
    insights.push({
        icon: 'chart-line',
        color: '#17a2b8',
        title: 'Average Participation',
        text: `Your events average ${avgParticipation} participants each.`
    });
    
    // Revenue insight
    const totalRevenue = filteredEvents.reduce((sum, e) => sum + ((e.cost || 0) * (e.currentParticipants || 0)), 0);
    if (totalRevenue > 0) {
        insights.push({
            icon: 'money-bill-wave',
            color: '#28a745',
            title: 'Total Revenue',
            text: `You've generated ₹${totalRevenue.toLocaleString()} from your events.`
        });
    }
    
    // Event frequency
    if (filteredEvents.length > 0) {
        const daysWithEvents = new Set(filteredEvents.map(e => {
            const date = getDateFromFirestore(e.createdAt);
            return date ? date.toISOString().split('T')[0] : null;
        }).filter(Boolean)).size;
        
        insights.push({
            icon: 'calendar-check',
            color: '#dc3545',
            title: 'Event Frequency',
            text: `You created events on ${daysWithEvents} different days in this period.`
        });
    }
    
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

// Export Report
window.exportReport = function() {
    const reportData = {
        generatedAt: new Date().toISOString(),
        timeFilter: timeFilter,
        summary: {
            totalEvents: filteredEvents.length,
            totalParticipants: filteredEvents.reduce((sum, e) => sum + (e.currentParticipants || 0), 0),
            totalRevenue: filteredEvents.reduce((sum, e) => sum + ((e.cost || 0) * (e.currentParticipants || 0)), 0)
        },
        events: filteredEvents.map(e => ({
            name: e.name,
            category: e.category,
            participants: e.currentParticipants,
            cost: e.cost,
            eventDate: e.eventDate
        }))
    };
    
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-report-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast('Report exported successfully!', 'success');
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Initialize dropdowns and sidebar
    initializeDropdowns();
    initializeSidebar();
    initializeLogoutButtons();
});

function initializeDropdowns() {
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
}

function initializeSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    const menuToggle = document.querySelector('.menu-toggle');
    
    if (!sidebar) return;
    
    let overlay = document.querySelector('.sidebar-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay';
        document.body.appendChild(overlay);
    }
    
    function toggleSidebar() {
        sidebar.classList.toggle('active');
        if (sidebar.classList.contains('active')) {
            overlay.style.display = 'block';
            setTimeout(() => overlay.style.opacity = '1', 10);
        } else {
            overlay.style.opacity = '0';
            setTimeout(() => overlay.style.display = 'none', 300);
        }
    }
    
    mobileMenuToggle?.addEventListener('click', toggleSidebar);
    menuToggle?.addEventListener('click', toggleSidebar);
    overlay.addEventListener('click', toggleSidebar);
}

function initializeLogoutButtons() {
    const logoutBtn = document.getElementById('logout-btn');
    const logoutLink = document.getElementById('logout-link');
    
    const handleLogout = async () => {
        try {
            await auth.signOut();
            window.location.href = 'login.html';
        } catch (error) {
            console.error('Error signing out:', error);
            showToast('Error signing out', 'error');
        }
    };
    
    logoutBtn?.addEventListener('click', handleLogout);
    logoutLink?.addEventListener('click', (e) => {
        e.preventDefault();
        handleLogout();
    });
}

// Inject additional CSS for analytics-specific components
function injectAnalyticsStyles() {
    const styleId = 'analytics-custom-styles';
    if (document.getElementById(styleId)) return;
    
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
        .analytics-content { padding: 24px; }
        .charts-row { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); 
            gap: 24px; 
            margin-bottom: 24px; 
        }
        .chart-container { 
            background: white; 
            border-radius: 16px; 
            padding: 24px; 
            box-shadow: 0 4px 6px rgba(0,0,0,0.1); 
            min-height: 350px; 
        }
        .chart-container.full-width { grid-column: 1 / -1; }
        .chart-header { 
            display: flex; 
            align-items: center; 
            gap: 8px; 
            margin-bottom: 20px; 
            padding-bottom: 12px; 
            border-bottom: 2px solid #f0f0f0; 
        }
        .chart-header h3 { font-size: 1.1rem; color: #333; margin: 0; }
        .chart-header i { color: #ff6600; }
        canvas { max-height: 280px !important; }
        .analytics-section { 
            background: white; 
            border-radius: 16px; 
            padding: 24px; 
            margin-bottom: 24px; 
            box-shadow: 0 4px 6px rgba(0,0,0,0.1); 
        }
        .table-container { overflow-x: auto; }
        .analytics-table { width: 100%; border-collapse: collapse; }
        .analytics-table thead { background: #f8f9fa; }
        .analytics-table th, .analytics-table td { 
            padding: 12px; 
            text-align: left; 
            border-bottom: 1px solid #e9ecef; 
        }
        .analytics-table th { font-weight: 600; color: #333; font-size: 0.9rem; }
        .analytics-table tbody tr:hover { background: #f8f9fa; }
        .category-performance-grid { 
            display: grid; 
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); 
            gap: 20px; 
        }
        .category-performance-card { 
            background: white; 
            border: 1px solid #e9ecef;
            border-radius: 12px; 
            padding: 20px; 
            transition: all 0.3s ease; 
        }
        .category-performance-card:hover { 
            transform: translateY(-4px); 
            box-shadow: 0 4px 12px rgba(0,0,0,0.15); 
        }
        .performance-stats { 
            display: flex; 
            flex-direction: column; 
            gap: 12px; 
            margin-top: 16px; 
        }
        .performance-stat { 
            display: flex; 
            align-items: center; 
            gap: 8px; 
            color: #666; 
            font-size: 0.9rem; 
        }
        .performance-stat i { color: #ff6600; width: 20px; }
        .insights-container { 
            display: grid; 
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); 
            gap: 20px; 
        }
        .insight-card { 
            background: white; 
            border: 1px solid #e9ecef;
            border-radius: 12px; 
            padding: 20px; 
            display: flex; 
            gap: 16px; 
            transition: transform 0.3s ease; 
        }
        .insight-card:hover { transform: translateY(-2px); }
        .insight-icon { 
            width: 50px; 
            height: 50px; 
            border-radius: 12px; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            font-size: 1.5rem; 
            flex-shrink: 0; 
        }
        .insight-content h4 { margin: 0 0 8px 0; color: #333; font-size: 1rem; }
        .insight-content p { margin: 0; color: #666; font-size: 0.9rem; line-height: 1.5; }
        @media (max-width: 768px) {
            .charts-row { grid-template-columns: 1fr; }
            .chart-container { min-height: 300px; }
            .analytics-content { padding: 16px; }
        }
    `;
    document.head.appendChild(style);
}

// Call on load
injectAnalyticsStyles();

// Add CSS styles for analytics components
const analyticsStyles = `
    .analytics-stats .stat-change {
        display: inline-block;
        font-size: 0.8rem;
        margin-top: 4px;
    }
    
    .analytics-stats .stat-change.positive {
        color: #28a745;
    }
    
    .analytics-stats .stat-change.negative {
        color: #dc3545;
    }
    
    .charts-row {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
        gap: 24px;
        margin-bottom: 24px;
    }
    
    .chart-container {
        background: white;
        border-radius: 16px;
        padding: 24px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        min-height: 350px;
    }
    
    .chart-container.full-width {
        grid-column: 1 / -1;
    }
    
    .chart-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 20px;
        padding-bottom: 12px;
        border-bottom: 2px solid #f0f0f0;
    }
    
    .chart-header h3 {
        font-size: 1.1rem;
        color: #333;
        margin: 0;
    }
    
    .chart-header i {
        color: #ff6600;
    }
    
    canvas {
        max-height: 280px;
    }
    
    .analytics-table {
        width: 100%;
        border-collapse: collapse;
    }
    
    .analytics-table thead {
        background: #f8f9fa;
    }
    
    .analytics-table th,
    .analytics-table td {
        padding: 12px;
        text-align: left;
        border-bottom: 1px solid #e9ecef;
    }
    
    .analytics-table th {
        font-weight: 600;
        color: #333;
        font-size: 0.9rem;
    }
    
    .analytics-table tbody tr:hover {
        background: #f8f9fa;
    }
    
    .category-performance-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 20px;
    }
    
    .category-performance-card {
        background: white;
        border-radius: 12px;
        padding: 20px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        transition: transform 0.3s ease, box-shadow 0.3s ease;
    }
    
    .category-performance-card:hover {
        transform: translateY(-4px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }
    
    .performance-stats {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-top: 16px;
    }
    
    .performance-stat {
        display: flex;
        align-items: center;
        gap: 8px;
        color: #666;
        font-size: 0.9rem;
    }
    
    .performance-stat i {
        color: #ff6600;
        width: 20px;
    }
    
    .insights-container {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 20px;
    }
    
    .insight-card {
        background: white;
        border-radius: 12px;
        padding: 20px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        display: flex;
        gap: 16px;
        transition: transform 0.3s ease;
    }
    
    // --- (Place this after your existing code where analyticsStyles was being built) ---

    .insight-card:hover {
        transform: translateY(-4px);
        box-shadow: 0 6px 18px rgba(0,0,0,0.12);
    }
`;

// Append analyticsStyles to head if not already present
if (!document.getElementById('analytics-styles')) {
    const s = document.createElement('style');
    s.id = 'analytics-styles';
    s.textContent = analyticsStyles;
    document.head.appendChild(s);
}

// --- Real-time updates (listen to events collection) ---
let eventsUnsubscribe = null;

async function setupRealtimeUpdates() {
    if (!currentUser) return;
    // unsubscribe previous listener if any
    if (eventsUnsubscribe) eventsUnsubscribe();

    eventsUnsubscribe = db.collection('events')
        .where('organizerId', '==', currentUser.uid)
        .onSnapshot(snapshot => {
            // Keep allEvents in sync with Firestore
            try {
                const newEvents = [];
                snapshot.forEach(doc => newEvents.push({ id: doc.id, ...doc.data() }));
                allEvents = newEvents;
                applyTimeFilter(); // this will call updateAllAnalytics()
                showToast('Analytics data updated (live)', 'success');
            } catch (err) {
                console.error('Realtime snapshot error:', err);
                showToast('Realtime update error', 'error');
            }
        }, err => {
            console.error('Realtime listener failed:', err);
            showToast('Realtime listener failed', 'error');
        });
}

// --- Search & Category filter ---
const searchState = {
    query: '',
    category: 'all'
};

function initializeFilters() {
    const searchInput = document.getElementById('analytics-search');
    const categorySelect = document.getElementById('analytics-category-filter');
    const timeSelect = document.getElementById('timeFilter');

    if (searchInput) {
        searchInput.addEventListener('input', debounce((e) => {
            searchState.query = e.target.value.trim().toLowerCase();
            applyTimeFilter(); // reapply filters and update UI
        }, 300));
    }

    if (categorySelect) {
        categorySelect.addEventListener('change', (e) => {
            searchState.category = e.target.value;
            applyTimeFilter();
        });
    }

    // keep time filter binding if not already bound
    if (timeSelect && !timeSelect._boundToAnalytics) {
        timeSelect.addEventListener('change', () => window.applyTimeFilter());
        timeSelect._boundToAnalytics = true;
    }
}

// modify applyTimeFilter to also consider search & category
window.applyTimeFilter = function() {
    const filterSelect = document.getElementById('timeFilter');
    timeFilter = parseInt(filterSelect.value);

    const now = new Date();
    const filterDate = new Date(now.getTime() - (timeFilter * 24 * 60 * 60 * 1000));

    let baseFiltered;
    if (timeFilter === 0) {
        baseFiltered = [...allEvents];
    } else {
        baseFiltered = allEvents.filter(event => {
            const eventDate = getDateFromFirestore(event.createdAt);
            return eventDate && eventDate >= filterDate;
        });
    }

    // apply search & category filters
    filteredEvents = baseFiltered.filter(event => {
        const name = (event.name || '').toString().toLowerCase();
        const category = (event.category || 'other').toString().toLowerCase();

        const matchesQuery = !searchState.query || name.includes(searchState.query) || category.includes(searchState.query);
        const matchesCategory = !searchState.category || searchState.category === 'all' || category === searchState.category.toLowerCase();
        return matchesQuery && matchesCategory;
    });

    updateAllAnalytics();
};

// --- Export CSV ---
window.exportCSV = function() {
    if (!filteredEvents || filteredEvents.length === 0) {
        showToast('No data to export', 'error');
        return;
    }

    const headers = ['Name', 'Category', 'Participants', 'Cost', 'Revenue', 'Event Date', 'Created At', 'Status'];
    const rows = filteredEvents.map(e => {
        const eventDate = getDateFromFirestore(e.eventDate);
        const createdAt = getDateFromFirestore(e.createdAt);
        const revenue = (e.cost || 0) * (e.currentParticipants || 0);
        return [
            `"${(e.name || '').replace(/"/g, '""')}"`,
            `"${(e.category || '').replace(/"/g, '""')}"`,
            e.currentParticipants || 0,
            e.cost || 0,
            revenue,
            eventDate ? formatDate(eventDate) : '',
            createdAt ? formatDate(createdAt) : '',
            getEventStatus(e)
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
    showToast('CSV exported', 'success');
};

// --- Utility helpers ---
function debounce(fn, wait = 200) {
    let t;
    return function(...args) {
        clearTimeout(t);
        t = setTimeout(() => fn.apply(this, args), wait);
    };
}

function formatDate(d) {
    if (!d) return '';
    // e.g., 10 Oct 2025 14:32
    return d.toLocaleString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
}

function formatCurrency(amount) {
    return '₹' + Number(amount || 0).toLocaleString();
}

// Replace inline rupee formatting in overview stats if needed
function updateOverviewStats() {
    const totalEvents = filteredEvents.length;
    const totalParticipants = filteredEvents.reduce((sum, e) => sum + (e.currentParticipants || 0), 0);
    const avgParticipation = totalEvents > 0 ? Math.round(totalParticipants / totalEvents) : 0;
    const totalRevenue = filteredEvents.reduce((sum, e) => sum + ((e.cost || 0) * (e.currentParticipants || 0)), 0);

    const changePercentage = allEvents.length > 0 ?
        Math.round(((filteredEvents.length - allEvents.length) / allEvents.length) * 100) : 0;

    const te = document.getElementById('total-events-stat');
    const tp = document.getElementById('total-participants-stat');
    const ap = document.getElementById('avg-participation-stat');
    const tr = document.getElementById('total-revenue-stat');

    if (te) te.textContent = totalEvents;
    if (tp) tp.textContent = totalParticipants;
    if (ap) ap.textContent = avgParticipation;
    if (tr) tr.textContent = formatCurrency(totalRevenue);

    updateChangeIndicator('events-change', changePercentage);
    updateChangeIndicator('participants-change', changePercentage);
    const participationLabel = document.getElementById('participation-change');
    if (participationLabel) participationLabel.textContent = 'per event';
    updateChangeIndicator('revenue-change', changePercentage);
}

// Resize handling for charts
const handleResize = debounce(() => {
    try {
        Object.values(charts).forEach(c => {
            if (c && typeof c.resize === 'function') c.resize();
        });
    } catch (err) {
        console.warn('Chart resize error:', err);
    }
}, 250);

window.addEventListener('resize', handleResize);

// --- Accessibility helpers: ensure buttons have ARIA roles where needed ---
function enhanceA11y() {
    document.querySelectorAll('button, [role="button"]').forEach(btn => {
        if (!btn.hasAttribute('tabindex')) btn.setAttribute('tabindex', '0');
    });
}

// --- Initialize on DOMContentLoaded (extend previous handler) ---
document.addEventListener('DOMContentLoaded', () => {
    // existing initializers (from earlier in file)
    initializeDropdowns();
    initializeSidebar();
    initializeLogoutButtons();
    injectAnalyticsStyles();

    // new initializers
    initializeFilters();
    enhanceA11y();

    // wire export buttons if present
    const exportJsonBtn = document.getElementById('export-json-btn');
    const exportCsvBtn = document.getElementById('export-csv-btn');
    exportJsonBtn?.addEventListener('click', window.exportReport);
    exportCsvBtn?.addEventListener('click', window.exportCSV);

    // time filter default binding
    const tf = document.getElementById('timeFilter');
    if (tf) {
        tf.addEventListener('change', () => window.applyTimeFilter());
    }

    // if user is already signed in (auth state may have fired earlier), initialize realtime
    if (currentUser) {
        setupRealtimeUpdates();
    } else {
        // Auth state change handler (in earlier code) will call loadAnalyticsData() and we then set realtime there
    }
});

// Make sure realtime is started when auth state resolves
auth.onAuthStateChanged(async (user) => {
    if (!user) {
        // handled earlier
        return;
    }
    // start listening realtime after initial load
    setupRealtimeUpdates();
});

// Clean up before unload
window.addEventListener('beforeunload', () => {
    if (eventsUnsubscribe) eventsUnsubscribe();
});

// Done.
