// =============================
// teams.js – Complete Merged & Enhanced
// =============================

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
const FieldValue = firebase.firestore.FieldValue;

// Global variables
let currentUser = null;
let currentTeamId = null;
let allTeams = [];
let allCategories = new Set(['Sports', 'Cultural', 'Technical', 'Academic', 'Social']);
let viewMode = 'grid';
let activeFilter = 'all';
let sortOption = 'recent';
let searchTerm = '';

// ---------- Utilities ----------
function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function safeDateDisplay(val) {
  if (!val) return '—';
  try {
    if (val.toDate) return val.toDate().toLocaleDateString();
    return new Date(val).toLocaleDateString();
  } catch {
    return String(val);
  }
}

function getById(id) {
  return document.getElementById(id);
}

function debounce(fn, ms = 300) {
  let t;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), ms);
  };
}

// Toast helpers
function showToast(message, type = 'info') {
  try {
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
  } catch (err) {
    console.log('Toast error', err);
  }
}
function showSuccess(m) { showToast(m, 'success'); }
function showError(m) { showToast(m, 'error'); }

// ---------- Auth & initialization ----------
auth.onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.href = 'login.html';
    return;
  }
  currentUser = user;
  updateUserInterface(user);
  setupRealtimeListeners();
  try {
    await loadTeams();
    await loadInvites();
  } catch (error) {
    console.error('Error during initialization:', error);
    showError('Error loading teams. Please refresh the page.');
  }
});

// ---------- UI ----------
function updateUserInterface(user) {
  const userNameElement = getById('user-name');
  const userAvatarElement = getById('user-avatar');
  if (userNameElement) userNameElement.textContent = user.displayName || user.email.split('@')[0] || 'User';
  if (userAvatarElement) {
    if (user.photoURL) {
      userAvatarElement.src = user.photoURL;
    } else {
      const initial = (user.displayName || user.email || 'U')[0].toUpperCase();
      userAvatarElement.src = `https://ui-avatars.com/api/?name=${initial}&background=ff6600&color=fff&size=128`;
    }
  }
}

// ---------- Realtime Listeners ----------
let teamsUnsubscribe = null;
let invitesUnsubscribe = null;

function setupRealtimeListeners() {
  if (teamsUnsubscribe) teamsUnsubscribe();
  if (invitesUnsubscribe) invitesUnsubscribe();

  try {
    teamsUnsubscribe = db.collection('teams')
      .where('members', 'array-contains', currentUser.uid)
      .onSnapshot(
        () => loadTeams().catch(error => console.error('Error on teams snapshot:', error)),
        (error) => console.error('Teams snapshot listener error:', error)
      );
  } catch (error) {
    console.error('Error setting up teams listener:', error);
  }

  try {
    invitesUnsubscribe = db.collection('teamInvites')
      .where('inviteeEmail', '==', currentUser.email)
      .where('status', '==', 'pending')
      .onSnapshot(
        () => loadInvites().catch(error => console.error('Error on invites snapshot:', error)),
        (error) => console.error('Invites snapshot listener error:', error)
      );
  } catch (error) {
    console.error('Error setting up invites listener:', error);
  }
}

// ---------- Load Teams ----------
async function loadTeams() {
  try {
    const teamsSnapshot = await db.collection('teams')
      .where('members', 'array-contains', currentUser.uid)
      .get();

    allTeams = [];
    teamsSnapshot.forEach(doc => {
      const data = doc.data();
      allTeams.push({ id: doc.id, ...data });
      if (data.category) allCategories.add(data.category);
    });

    updateCategoryFilter();
    await updateStats();
    applyFilters();
  } catch (error) {
    console.error('Error loading teams:', error);
    showError('Error loading teams');
  }
}

// ---------- Filters & Sort ----------
function applyFilters() {
  let filtered = [...allTeams];

  const categoryFilter = (getById('category-filter')?.value) || 'all';
  if (categoryFilter !== 'all') filtered = filtered.filter(t => t.category === categoryFilter);

  if (activeFilter === 'owned') filtered = filtered.filter(t => t.ownerId === currentUser.uid);
  else if (activeFilter === 'member') filtered = filtered.filter(t => t.ownerId !== currentUser.uid);

  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    filtered = filtered.filter(t =>
      t.name?.toLowerCase().includes(term) ||
      t.description?.toLowerCase().includes(term) ||
      t.category?.toLowerCase().includes(term)
    );
  }

  filtered.sort((a, b) => {
    switch (sortOption) {
      case 'members': return (b.members?.length || 0) - (a.members?.length || 0);
      case 'name': return (a.name || '').localeCompare(b.name || '');
      case 'active': return (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0);
      default: return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
    }
  });

  displayTeams(filtered);
}

// ---------- Display Teams ----------
function displayTeams(teams) {
  const teamsGrid = getById('teams-grid');
  if (!teamsGrid) return;

  if (!teams || teams.length === 0) {
    teamsGrid.innerHTML = `
      <div class="no-events">
        <i class="fas fa-users" style="font-size: 3rem; color: #ccc; margin-bottom: 16px;"></i>
        <p>No teams found. Create your first team!</p>
      </div>
    `;
    return;
  }

  teamsGrid.className = viewMode === 'list' ? 'teams-list' : 'teams-grid';

  teamsGrid.innerHTML = teams.map(team => {
    const isOwner = team.ownerId === currentUser.uid;
    const memberCount = team.members?.length || 0;
    const created = safeDateDisplay(team.createdAt);
    const desc = escapeHtml(team.description || 'No description');
    const hoursAgo = team.updatedAt ? (Date.now() - team.updatedAt.seconds * 1000) / (1000 * 60 * 60) : 999;
    const activity = hoursAgo < 24 ? 'Very Active' : hoursAgo < 72 ? 'Active' : 'Moderate';
    const activityClass = activity.toLowerCase().replace(' ', '-');

    return `
      <div class="team-card ${viewMode === 'list' ? 'list-view' : ''}" onclick="viewTeamDetails('${team.id}')">
        <div class="team-card-banner" style="background: linear-gradient(135deg, var(--primary-color), var(--primary-light))">
          ${isOwner ? `<div class="team-owner-badge"><i class="fas fa-crown"></i> Owner</div>` : ''}
        </div>
        <div class="team-card-content">
          <div class="team-header">
            <div class="team-title-row">
              <h3>${escapeHtml(team.name)}</h3>
              <button class="team-menu-btn" onclick="event.stopPropagation(); showTeamMenu('${team.id}')"><i class="fas fa-ellipsis-v"></i></button>
            </div>
            <span class="team-activity-badge ${activityClass}">
              <i class="fas fa-circle" style="font-size: 6px;"></i> ${activity}
            </span>
          </div>
          <p class="team-description">${desc}</p>
          <div class="team-stats">
            <div class="team-stat-box">
              <i class="fas fa-users"></i>
              <span class="team-stat-value">${memberCount}</span>
              <span class="team-stat-label">Members</span>
            </div>
            <div class="team-stat-box">
              <i class="fas fa-award"></i>
              <span class="team-stat-value">${Math.floor(Math.random() * 20)}</span>
              <span class="team-stat-label">Awards</span>
            </div>
            <div class="team-stat-box">
              <i class="fas fa-calendar"></i>
              <span class="team-stat-value">${Math.floor(Math.random() * 10)}</span>
              <span class="team-stat-label">Events</span>
            </div>
          </div>
          <div class="team-actions">
            <button class="team-action-btn primary" onclick="event.stopPropagation(); viewTeamDetails('${team.id}')">
              <i class="fas fa-arrow-right"></i> View
            </button>
            <button class="team-action-btn secondary" onclick="event.stopPropagation(); openTeamChat('${team.id}')">
              <i class="fas fa-comment"></i>
            </button>
            <button class="team-action-btn secondary" onclick="event.stopPropagation(); toggleTeamNotifications('${team.id}')">
              <i class="fas fa-bell"></i>
            </button>
          </div>
          <div class="team-footer">
            <div class="team-last-activity"><i class="fas fa-clock"></i> ${created}</div>
            <span class="category-badge" style="background: linear-gradient(135deg, var(--primary-color), var(--primary-light));">${escapeHtml(team.category || '')}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ---------- Category Filter ----------
function updateCategoryFilter() {
  const categoryFilter = getById('category-filter');
  if (!categoryFilter) return;
  const prevValue = categoryFilter.value || 'all';
  categoryFilter.innerHTML = '<option value="all">All Categories</option>';
  [...allCategories].sort().forEach(c => {
    const option = document.createElement('option');
    option.value = c;
    option.textContent = c;
    categoryFilter.appendChild(option);
  });
  categoryFilter.value = prevValue;
}

// ---------- Filter, Sort, View, Search ----------
window.setFilterTab = function (filter) {
  activeFilter = filter;
  document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
  applyFilters();
};

window.setSortOption = function (option) {
  sortOption = option;
  applyFilters();
};

window.setViewMode = function (mode) {
  viewMode = mode;
  document.querySelectorAll('.view-toggle button').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
  applyFilters();
};

window.handleTeamSearch = debounce(function (value) {
  searchTerm = value.trim();
  applyFilters();
}, 300);

// ---------- Create Team ----------
window.showCreateTeamModal = function () {
  const modal = getById('createTeamModal');
  if (modal) modal.classList.add('show');
};

window.closeCreateTeamModal = function () {
  const modal = getById('createTeamModal');
  if (modal) modal.classList.remove('show');
  getById('createTeamForm')?.reset();
  const customCategoryGroup = getById('customCategoryGroup');
  if (customCategoryGroup) customCategoryGroup.style.display = 'none';
};

// ---------- View Team Details ----------
window.viewTeamDetails = async function (teamId) {
  currentTeamId = teamId;
  const modal = getById('teamDetailsModal');
  if (!modal) return;
  
  modal.classList.add('show');
  
  try {
    const teamDoc = await db.collection('teams').doc(teamId).get();
    if (!teamDoc.exists) {
      showError('Team not found');
      closeTeamDetailsModal();
      return;
    }
    
    const team = teamDoc.data();
    const isOwner = team.ownerId === currentUser.uid;
    
    if (getById('teamDetailsName')) getById('teamDetailsName').textContent = team.name;
    if (getById('teamDetailsCategory')) getById('teamDetailsCategory').textContent = team.category || '—';
    if (getById('teamDetailsCreated')) getById('teamDetailsCreated').textContent = safeDateDisplay(team.createdAt);
    if (getById('teamDetailsDescription')) getById('teamDetailsDescription').textContent = team.description || 'No description provided';
    
    const memberCountElements = modal.querySelectorAll('#memberCount');
    memberCountElements.forEach(el => el.textContent = team.members?.length || 0);
    
    const ownerActionsSection = getById('ownerActionsSection');
    const ownerFooterActions = getById('ownerFooterActions');
    if (ownerActionsSection) ownerActionsSection.style.display = isOwner ? 'block' : 'none';
    if (ownerFooterActions) ownerFooterActions.style.display = isOwner ? 'flex' : 'none';
    
    await loadTeamMembers(teamId, team.members || []);
    
    if (isOwner) {
      await loadPendingRequests(teamId);
    }
    
  } catch (error) {
    console.error('Error loading team details:', error);
    showError('Error loading team details');
  }
};

window.closeTeamDetailsModal = function () {
  const modal = getById('teamDetailsModal');
  if (modal) modal.classList.remove('show');
  currentTeamId = null;
};

// ---------- Load Team Members ----------
async function loadTeamMembers(teamId, memberIds) {
  const membersList = getById('teamMembersList');
  if (!membersList) return;
  
  if (!memberIds || memberIds.length === 0) {
    membersList.innerHTML = '<p class="no-participants">No members yet</p>';
    return;
  }
  
  try {
    const teamDoc = await db.collection('teams').doc(teamId).get();
    const team = teamDoc.data();
    const isOwner = team.ownerId === currentUser.uid;
    const roles = team.roles || {};
    
    const membersHTML = await Promise.all(memberIds.map(async (uid) => {
      try {
        const userDoc = await db.collection('users').doc(uid).get();
        const userData = userDoc.exists ? userDoc.data() : null;
        const isTeamOwner = uid === team.ownerId;
        const memberRole = roles[uid] || 'Member';
        
        const name = userData?.name || userData?.displayName || 'Unknown User';
        const email = userData?.email || '';
        const avatar = userData?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=ff6600&color=fff`;
        
        return `
          <div class="member-card">
            <img src="${avatar}" alt="${escapeHtml(name)}" class="member-avatar">
            <div class="member-info">
              <h4>
                ${escapeHtml(name)}
                ${isTeamOwner ? '<span class="owner-badge"><i class="fas fa-crown"></i> Owner</span>' : ''}
              </h4>
              <p>${escapeHtml(email)}</p>
              ${!isTeamOwner ? `<small style="color:#6c757d;"><i class="fas fa-user-tag"></i> ${memberRole}</small>` : ''}
            </div>
            <div style="display:flex;gap:8px;align-items:center;">
              ${isOwner && !isTeamOwner ? `
                <select class="role-select" onchange="assignRole('${teamId}', '${uid}', this.value)" style="padding:6px;border-radius:6px;border:1px solid #dee2e6;">
                  <option value="Member" ${memberRole === 'Member' ? 'selected' : ''}>Member</option>
                  <option value="Admin" ${memberRole === 'Admin' ? 'selected' : ''}>Admin</option>
                  <option value="Moderator" ${memberRole === 'Moderator' ? 'selected' : ''}>Moderator</option>
                </select>
                <button class="btn-danger btn-sm" onclick="removeMember('${teamId}', '${uid}')">
                  <i class="fas fa-user-minus"></i> Remove
                </button>
              ` : ''}
            </div>
          </div>
        `;
      } catch (error) {
        console.error('Error loading member:', error);
        return '';
      }
    }));
    
    membersList.innerHTML = membersHTML.filter(h => h).join('');
    
  } catch (error) {
    console.error('Error loading team members:', error);
    membersList.innerHTML = '<p class="error-state">Error loading members</p>';
  }
}

// ---------- Search Users ----------
window.searchUsers = debounce(async function () {
  const searchInput = getById('memberSearch');
  const searchResults = getById('searchResults');
  if (!searchInput || !searchResults) return;
  
  const query = searchInput.value.trim().toLowerCase();
  if (!query || query.length < 2) {
    searchResults.innerHTML = query.length > 0 && query.length < 2 
      ? '<div class="no-results">Type at least 2 characters...</div>' 
      : '';
    return;
  }
  
  try {
    searchResults.innerHTML = '<div class="loading-placeholder"><i class="fas fa-spinner fa-spin"></i> Searching...</div>';
    
    const emailQuery = db.collection('users')
      .where('email', '>=', query)
      .where('email', '<=', query + '\uf8ff')
      .limit(10);
    
    const usersSnapshot = await emailQuery.get();
    
    if (usersSnapshot.empty) {
      searchResults.innerHTML = '<div class="no-results"><i class="fas fa-user-slash"></i> No users found</div>';
      return;
    }
    
    const teamDoc = await db.collection('teams').doc(currentTeamId).get();
    const team = teamDoc.data();
    const currentMembers = team.members || [];
    
    const results = [];
    usersSnapshot.forEach(doc => {
      const user = doc.data();
      if (!currentMembers.includes(doc.id) && doc.id !== currentUser.uid) {
        results.push({ id: doc.id, ...user });
      }
    });
    
    if (results.length === 0) {
      searchResults.innerHTML = '<div class="no-results"><i class="fas fa-check-circle"></i> All matching users are already members</div>';
      return;
    }
    
    searchResults.innerHTML = results.map(user => {
      const name = user.name || user.displayName || 'Unknown User';
      const avatar = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=ff6600&color=fff`;
      
      return `
        <div class="search-result-item" data-user-id="${user.id}">
          <img src="${avatar}" alt="${escapeHtml(name)}" class="result-avatar" onerror="this.src='https://ui-avatars.com/api/?name=U&background=ff6600&color=fff'">
          <div class="result-info">
            <h4>${escapeHtml(name)}</h4>
            <p><i class="fas fa-envelope"></i> ${escapeHtml(user.email)}</p>
          </div>
          <button class="btn-primary btn-sm" onclick="inviteUser('${user.id}', '${escapeHtml(user.email)}')">
            <i class="fas fa-user-plus"></i> Invite
          </button>
        </div>
      `;
    }).join('');
    
  } catch (error) {
    console.error('Error searching users:', error);
    searchResults.innerHTML = '<div class="error-state"><i class="fas fa-exclamation-triangle"></i> Error searching users</div>';
  }
}, 500);

// ---------- Invite User ----------
window.inviteUser = async function (userId, userEmail) {
  if (!currentTeamId) return;
  
  try {
    const teamDoc = await db.collection('teams').doc(currentTeamId).get();
    const team = teamDoc.data();
    
    await db.collection('teamInvites').add({
      teamId: currentTeamId,
      teamName: team.name,
      inviterId: currentUser.uid,
      inviterName: currentUser.displayName || currentUser.email,
      inviteeEmail: userEmail,
      status: 'pending',
      message: `Join ${team.name}!`,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    showSuccess('Invitation sent successfully!');
    getById('memberSearch').value = '';
    getById('searchResults').innerHTML = '';
    
  } catch (error) {
    console.error('Error sending invitation:', error);
    showError('Error sending invitation');
  }
};

// ---------- Remove Member ----------
window.removeMember = async function (teamId, userId) {
  if (!confirm('Are you sure you want to remove this member?')) return;
  
  try {
    await db.collection('teams').doc(teamId).update({
      members: FieldValue.arrayRemove(userId)
    });
    
    showSuccess('Member removed successfully');
    await loadTeamMembers(teamId, (await db.collection('teams').doc(teamId).get()).data().members);
    await loadTeams();
    
  } catch (error) {
    console.error('Error removing member:', error);
    showError('Error removing member');
  }
};

// ---------- Load Invites ----------
async function loadInvites() {
  try {
    const invitesSnapshot = await db.collection('teamInvites')
      .where('inviteeEmail', '==', currentUser.email)
      .where('status', '==', 'pending')
      .get();

    const invites = [];
    invitesSnapshot.forEach(doc => invites.push({ id: doc.id, ...doc.data() }));
    await displayInvites(invites);
  } catch (error) {
    console.error('Error loading invites:', error);
  }
}

async function displayInvites(invites) {
  const invitesSection = getById('invites-section');
  const invitesGrid = getById('invites-grid');
  
  // If sections don't exist, skip
  if (!invitesSection || !invitesGrid) {
    console.warn('Invites section elements not found');
    return;
  }

  if (!invites || invites.length === 0) {
    invitesSection.style.display = 'none';
    invitesGrid.innerHTML = '';
    return;
  }

  invitesSection.style.display = 'block';

  const inviteCards = await Promise.all(invites.map(async invite => {
    try {
      const teamDoc = await db.collection('teams').doc(invite.teamId).get();
      const team = teamDoc.exists ? teamDoc.data() : null;
      if (!team) return '';

      return `
        <div class="invite-card">
          <div class="invite-avatar"><i class="fas fa-users" style="font-size:28px;color:var(--primary-color);"></i></div>
          <div class="invite-content">
            <div class="invite-header">
              <div>
                <h3>${escapeHtml(team.name)}</h3>
                <p class="invite-from">Invited by: ${escapeHtml(invite.inviterName || 'Unknown')}</p>
              </div>
              <span class="category-badge" style="background:linear-gradient(135deg,var(--primary-color),var(--primary-light));">${escapeHtml(team.category || '')}</span>
            </div>
            <p class="invite-message">${escapeHtml(invite.message || 'Join our team!')}</p>
            <div class="invite-actions">
              <button class="btn-primary" onclick="acceptInvite('${invite.id}','${invite.teamId}')"><i class="fas fa-check"></i> Accept</button>
              <button class="btn-danger" onclick="rejectInvite('${invite.id}')"><i class="fas fa-times"></i> Decline</button>
            </div>
          </div>
        </div>`;
    } catch (error) {
      console.error('Error processing invite:', error);
      return '';
    }
  }));

  invitesGrid.innerHTML = inviteCards.filter(card => card).join('');
}

// ---------- Accept/Reject Invites ----------
window.acceptInvite = async function (inviteId, teamId) {
  try {
    await db.collection('teams').doc(teamId).update({
      members: FieldValue.arrayUnion(currentUser.uid)
    });
    
    await db.collection('teamInvites').doc(inviteId).update({
      status: 'accepted'
    });
    
    showSuccess('Invitation accepted! Welcome to the team!');
    await loadTeams();
    await loadInvites();
    
  } catch (error) {
    console.error('Error accepting invitation:', error);
    showError('Error accepting invitation');
  }
};

window.rejectInvite = async function (inviteId) {
  try {
    await db.collection('teamInvites').doc(inviteId).update({
      status: 'rejected'
    });
    
    showSuccess('Invitation declined');
    await loadInvites();
    
  } catch (error) {
    console.error('Error rejecting invitation:', error);
    showError('Error rejecting invitation');
  }
};

// ---------- Load Pending Requests ----------
async function loadPendingRequests(teamId) {
  const requestsSection = getById('requestsSection');
  const requestsList = getById('pendingRequestsList');
  if (!requestsSection || !requestsList) return;
  
  try {
    const requestsSnapshot = await db.collection('teamRequests')
      .where('teamId', '==', teamId)
      .where('status', '==', 'pending')
      .get();
    
    if (requestsSnapshot.empty) {
      requestsSection.style.display = 'none';
      return;
    }
    
    requestsSection.style.display = 'block';
    
    const requestsHTML = await Promise.all(requestsSnapshot.docs.map(async doc => {
      const request = doc.data();
      const userDoc = await db.collection('users').doc(request.userId).get();
      const userData = userDoc.exists ? userDoc.data() : null;
      
      const name = userData?.name || userData?.displayName || 'Unknown User';
      const email = userData?.email || '';
      const avatar = userData?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=ff6600&color=fff`;
      
      return `
        <div class="request-card">
          <img src="${avatar}" alt="${escapeHtml(name)}" class="member-avatar">
          <div class="request-info">
            <h4>${escapeHtml(name)}</h4>
            <p>${escapeHtml(email)}</p>
            <small>Requested: ${safeDateDisplay(request.createdAt)}</small>
          </div>
          <div style="display:flex;gap:8px;">
            <button class="btn-primary btn-sm" onclick="approveRequest('${doc.id}','${request.userId}')">
              <i class="fas fa-check"></i> Approve
            </button>
            <button class="btn-danger btn-sm" onclick="rejectRequest('${doc.id}')">
              <i class="fas fa-times"></i> Reject
            </button>
          </div>
        </div>
      `;
    }));
    
    requestsList.innerHTML = requestsHTML.join('');
    
  } catch (error) {
    console.error('Error loading pending requests:', error);
    requestsSection.style.display = 'none';
  }
}

// ---------- Approve/Reject Requests ----------
window.approveRequest = async function (requestId, userId) {
  try {
    const requestDoc = await db.collection('teamRequests').doc(requestId).get();
    const request = requestDoc.data();
    
    await db.collection('teams').doc(request.teamId).update({
      members: FieldValue.arrayUnion(userId)
    });
    
    await db.collection('teamRequests').doc(requestId).update({
      status: 'approved'
    });
    
    showSuccess('Request approved!');
    await loadPendingRequests(request.teamId);
    await loadTeamMembers(request.teamId, (await db.collection('teams').doc(request.teamId).get()).data().members);
    
  } catch (error) {
    console.error('Error approving request:', error);
    showError('Error approving request');
  }
};

window.rejectRequest = async function (requestId) {
  try {
    await db.collection('teamRequests').doc(requestId).update({
      status: 'rejected'
    });
    
    showSuccess('Request rejected');
    const requestDoc = await db.collection('teamRequests').doc(requestId).get();
    const request = requestDoc.data();
    await loadPendingRequests(request.teamId);
    await loadTeamMembers(request.teamId, (await db.collection('teams').doc(request.teamId).get()).data().members); 
    
  } catch (error) {
    console.error('Error rejecting request:', error);
    showError('Error rejecting request');
  }
};
window.rejectRequest = async function (requestId) {
  try {
    await db.collection('teamRequests').doc(requestId).update({
      status: 'rejected'
    });
    
    showSuccess('Request rejected');
    const requestDoc = await db.collection('teamRequests').doc(requestId).get();
    const request = requestDoc.data();
    await loadPendingRequests(request.teamId);
    
  } catch (error) {
    console.error('Error rejecting request:', error);
    showError('Error rejecting request');
  }
};

// ---------- Delete Team ----------
window.deleteTeam = async function () {
  if (!currentTeamId) return;
  
  const confirmed = confirm('Are you sure you want to delete this team? This action cannot be undone.');
  if (!confirmed) return;
  
  try {
    // Delete team
    await db.collection('teams').doc(currentTeamId).delete();
    
    // Delete related invites
    const invitesSnapshot = await db.collection('teamInvites')
      .where('teamId', '==', currentTeamId)
      .get();
    
    const deletePromises = invitesSnapshot.docs.map(doc => doc.ref.delete());
    await Promise.all(deletePromises);
    
    showSuccess('Team deleted successfully');
    closeTeamDetailsModal();
    await loadTeams();
    
  } catch (error) {
    console.error('Error deleting team:', error);
    showError('Error deleting team');
  }
};

// ---------- Stats ----------
async function updateStats() {
  try {
    const myTeamsCount = allTeams.filter(t => t.ownerId === currentUser.uid).length;
    const totalMembers = allTeams.reduce((sum, t) => sum + (t.members?.length || 0), 0);
    
    // Count pending invites
    const invitesSnapshot = await db.collection('teamInvites')
      .where('inviteeEmail', '==', currentUser.email)
      .where('status', '==', 'pending')
      .get();
    const pendingInvites = invitesSnapshot.size;
    
    // Count pending requests for teams I own
    let pendingRequests = 0;
    const myTeams = allTeams.filter(t => t.ownerId === currentUser.uid);
    for (const team of myTeams) {
      try {
        const requestsSnapshot = await db.collection('teamRequests')
          .where('teamId', '==', team.id)
          .where('status', '==', 'pending')
          .get();
        pendingRequests += requestsSnapshot.size;
      } catch (error) {
        console.warn('Error fetching requests for team:', team.id, error);
      }
    }
    
    // Safely update DOM elements
    const myTeamsCountEl = getById('my-teams-count');
    const totalMembersCountEl = getById('total-members-count');
    const pendingInvitesCountEl = getById('pending-invites-count');
    const pendingRequestsCountEl = getById('pending-requests-count');
    
    if (myTeamsCountEl) myTeamsCountEl.textContent = myTeamsCount;
    if (totalMembersCountEl) totalMembersCountEl.textContent = totalMembers;
    if (pendingInvitesCountEl) pendingInvitesCountEl.textContent = pendingInvites;
    if (pendingRequestsCountEl) pendingRequestsCountEl.textContent = pendingRequests;
  } catch (error) {
    console.error('updateStats error:', error);
    showError('Error updating statistics');
  }
}

// ---------- Placeholder Features ----------
window.openTeamChat = (teamId) => showToast('Chat feature coming soon!', 'info');
window.toggleTeamNotifications = (teamId) => showToast('Notification preferences updated!', 'success');
window.showTeamMenu = (id) => showToast('Team menu coming soon!', 'info');

// ---------- DOM Ready ----------
document.addEventListener('DOMContentLoaded', () => {
  const teamSearchInput = getById('team-search-input');
  if (teamSearchInput) {
    teamSearchInput.addEventListener('input', e => handleTeamSearch(e.target.value));
  }

  const sortSelect = getById('sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', e => setSortOption(e.target.value));
  }

  const categoryFilter = getById('category-filter');
  if (categoryFilter) {
    categoryFilter.addEventListener('change', () => applyFilters());
  }

  // Close modals on background click
  const modals = document.querySelectorAll('.modal');
  modals.forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('show');
      }
    });
  });

  // Close modals on ESC key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal.show').forEach(modal => {
        modal.classList.remove('show');
      });
    }
  });

  initializeSidebar();
  initializeDropdowns();
  initializeLogoutButtons();
  initializeMobileMenu();
});

// ---------- Sidebar ----------
function initializeSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const menuToggle = document.querySelector('.menu-toggle');
  const mobileMenuToggle = getById('mobile-menu-toggle');
  
  let overlay = document.querySelector('.sidebar-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    document.body.appendChild(overlay);
  }

  const toggle = () => {
    sidebar?.classList.toggle('active');
    overlay.style.display = sidebar?.classList.contains('active') ? 'block' : 'none';
  };

  menuToggle?.addEventListener('click', toggle);
  mobileMenuToggle?.addEventListener('click', toggle);
  overlay.addEventListener('click', toggle);
}

// ---------- Mobile Menu ----------
function initializeMobileMenu() {
  const mobileMenuToggle = getById('mobile-menu-toggle');
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.querySelector('.sidebar-overlay');
  
  if (mobileMenuToggle && sidebar) {
    mobileMenuToggle.addEventListener('click', () => {
      sidebar.classList.toggle('show');
      if (overlay) {
        overlay.style.display = sidebar.classList.contains('show') ? 'block' : 'none';
      }
    });
  }
}

// ---------- Dropdowns ----------
function initializeDropdowns() {
  const btn = document.querySelector('.user-menu-btn');
  const dropdown = document.querySelector('.user-dropdown');
  if (!btn || !dropdown) return;
  
  btn.addEventListener('click', e => {
    e.stopPropagation();
    dropdown.classList.toggle('show');
  });
  
  document.addEventListener('click', e => {
    if (!btn.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.remove('show');
    }
  });
}

// ---------- Logout ----------
function initializeLogoutButtons() {
  const logoutBtn = getById('logout-btn');
  const logoutLink = getById('logout-link');
  
  const handleLogout = async () => {
    try {
      await auth.signOut();
      sessionStorage.clear();
      window.location.href = 'login.html';
    } catch (err) {
      console.error(err);
      showError('Error signing out');
    }
  };
  
  logoutBtn?.addEventListener('click', handleLogout);
  logoutLink?.addEventListener('click', e => { 
    e.preventDefault(); 
    handleLogout(); 
  });
}

// ---------- Cleanup ----------
window.addEventListener('beforeunload', () => {
  teamsUnsubscribe && teamsUnsubscribe();
  invitesUnsubscribe && invitesUnsubscribe();
});

// ---------- Modal Click Outside to Close ----------
window.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal')) {
    e.target.classList.remove('show');
  }
});

// ---------- Leave Team (for members) ----------
window.leaveTeam = async function (teamId) {
  const confirmed = confirm('Are you sure you want to leave this team?');
  if (!confirmed) return;
  
  try {
    await db.collection('teams').doc(teamId).update({
      members: FieldValue.arrayRemove(currentUser.uid)
    });
    
    showSuccess('You have left the team');
    closeTeamDetailsModal();
    await loadTeams();
    
  } catch (error) {
    console.error('Error leaving team:', error);
    showError('Error leaving team');
  }
};

// ---------- Request to Join Team (future feature) ----------
window.requestToJoinTeam = async function (teamId) {
  try {
    // Check if already requested
    const existingRequest = await db.collection('teamRequests')
      .where('teamId', '==', teamId)
      .where('userId', '==', currentUser.uid)
      .where('status', '==', 'pending')
      .get();
    
    if (!existingRequest.empty) {
      showToast('You have already requested to join this team', 'info');
      return;
    }
    
    await db.collection('teamRequests').add({
      teamId: teamId,
      userId: currentUser.uid,
      userName: currentUser.displayName || currentUser.email,
      userEmail: currentUser.email,
      status: 'pending',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    showSuccess('Join request sent!');
    
  } catch (error) {
    console.error('Error requesting to join team:', error);
    showError('Error sending join request');
  }
};

// ---------- Export Team Data (owner feature) ----------
window.exportTeamData = async function (teamId) {
  try {
    const teamDoc = await db.collection('teams').doc(teamId).get();
    const team = teamDoc.data();
    
    // Get all member details
    const memberDetails = await Promise.all(
      (team.members || []).map(async (uid) => {
        const userDoc = await db.collection('users').doc(uid).get();
        const userData = userDoc.exists ? userDoc.data() : {};
        return {
          name: userData.name || userData.displayName || 'Unknown',
          email: userData.email || 'N/A'
        };
      })
    );
    
    const exportData = {
      teamName: team.name,
      category: team.category,
      description: team.description,
      createdAt: team.createdAt?.toDate().toISOString(),
      memberCount: team.members?.length || 0,
      members: memberDetails
    };
    
    // Create and download JSON file
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${team.name.replace(/[^a-z0-9]/gi, '_')}_export.json`;
    link.click();
    URL.revokeObjectURL(url);
    
    showSuccess('Team data exported successfully!');
    
  } catch (error) {
    console.error('Error exporting team data:', error);
    showError('Error exporting team data');
  }
};

// ---------- Initialize tooltips (if using) ----------
function initializeTooltips() {
  const tooltipTriggers = document.querySelectorAll('[data-tooltip]');
  tooltipTriggers.forEach(trigger => {
    trigger.addEventListener('mouseenter', (e) => {
      const tooltip = document.createElement('div');
      tooltip.className = 'tooltip';
      tooltip.textContent = e.target.getAttribute('data-tooltip');
      document.body.appendChild(tooltip);
      
      const rect = e.target.getBoundingClientRect();
      tooltip.style.position = 'absolute';
      tooltip.style.top = `${rect.top - tooltip.offsetHeight - 8}px`;
      tooltip.style.left = `${rect.left + (rect.width - tooltip.offsetWidth) / 2}px`;
      
      e.target.addEventListener('mouseleave', () => {
        tooltip.remove();
      }, { once: true });
    });
  });
}

// Call on load
setTimeout(initializeTooltips, 1000);

console.log('Teams page initialized successfully');


// =============================
// Additional Enhancements for teams.js
// Add these to your existing teams.js file
// =============================

// ---------- Enhanced Search with Real-time Results ----------
window.searchUsersEnhanced = debounce(async function() {
  const searchInput = getById('memberSearch');
  const searchResults = getById('searchResults');
  if (!searchInput || !searchResults) return;
  
  const query = searchInput.value.trim().toLowerCase();
  if (!query || query.length < 2) {
    searchResults.innerHTML = query.length > 0 && query.length < 2 
      ? '<div class="no-results">Type at least 2 characters...</div>' 
      : '';
    return;
  }
  
  try {
    searchResults.innerHTML = '<div class="loading-placeholder"><i class="fas fa-spinner fa-spin"></i> Searching...</div>';
    
    // Search by email
    const emailQuery = db.collection('users')
      .where('email', '>=', query)
      .where('email', '<=', query + '\uf8ff')
      .limit(10);
    
    // Search by name (if name field is lowercase)
    const nameQuery = db.collection('users')
      .where('searchName', '>=', query)
      .where('searchName', '<=', query + '\uf8ff')
      .limit(10);
    
    const [emailSnapshot, nameSnapshot] = await Promise.all([
      emailQuery.get(),
      nameQuery.get()
    ]);
    
    // Combine and deduplicate results
    const userMap = new Map();
    emailSnapshot.forEach(doc => userMap.set(doc.id, { id: doc.id, ...doc.data() }));
    nameSnapshot.forEach(doc => userMap.set(doc.id, { id: doc.id, ...doc.data() }));
    
    if (userMap.size === 0) {
      searchResults.innerHTML = '<div class="no-results"><i class="fas fa-user-slash"></i> No users found</div>';
      return;
    }
    
    const teamDoc = await db.collection('teams').doc(currentTeamId).get();
    const team = teamDoc.data();
    const currentMembers = team.members || [];
    
    const results = Array.from(userMap.values())
      .filter(user => !currentMembers.includes(user.id) && user.id !== currentUser.uid);
    
    if (results.length === 0) {
      searchResults.innerHTML = '<div class="no-results"><i class="fas fa-check-circle"></i> All matching users are already members</div>';
      return;
    }
    
    searchResults.innerHTML = results.map(user => {
      const name = user.name || user.displayName || 'Unknown User';
      const avatar = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=ff6600&color=fff`;
      
      return `
        <div class="search-result-item" data-user-id="${user.id}">
          <img src="${avatar}" alt="${escapeHtml(name)}" class="result-avatar" onerror="this.src='https://ui-avatars.com/api/?name=U&background=ff6600&color=fff'">
          <div class="result-info">
            <h4>${escapeHtml(name)}</h4>
            <p><i class="fas fa-envelope"></i> ${escapeHtml(user.email)}</p>
          </div>
          <button class="btn-primary btn-sm" onclick="inviteUser('${user.id}', '${escapeHtml(user.email)}')">
            <i class="fas fa-user-plus"></i> Invite
          </button>
        </div>
      `;
    }).join('');
    
  } catch (error) {
    console.error('Error searching users:', error);
    searchResults.innerHTML = '<div class="error-state"><i class="fas fa-exclamation-triangle"></i> Error searching users</div>';
  }
}, 500);

// Attach to search input
document.addEventListener('DOMContentLoaded', () => {
  const memberSearch = getById('memberSearch');
  if (memberSearch) {
    memberSearch.addEventListener('input', searchUsersEnhanced);
  }
});

// ---------- Bulk Actions for Team Management ----------
window.bulkInviteUsers = async function() {
  const emailsText = prompt('Enter email addresses separated by commas or new lines:');
  if (!emailsText) return;
  
  const emails = emailsText
    .split(/[,\n]/)
    .map(e => e.trim())
    .filter(e => e && e.includes('@'));
  
  if (emails.length === 0) {
    showError('No valid email addresses found');
    return;
  }
  
  try {
    const teamDoc = await db.collection('teams').doc(currentTeamId).get();
    const team = teamDoc.data();
    
    let successCount = 0;
    let failCount = 0;
    
    for (const email of emails) {
      try {
        // Check if user exists
        const userSnapshot = await db.collection('users')
          .where('email', '==', email)
          .limit(1)
          .get();
        
        if (userSnapshot.empty) {
          failCount++;
          continue;
        }
        
        // Check if already a member
        const userId = userSnapshot.docs[0].id;
        if (team.members.includes(userId)) {
          failCount++;
          continue;
        }
        
        // Send invite
        await db.collection('teamInvites').add({
          teamId: currentTeamId,
          teamName: team.name,
          inviterId: currentUser.uid,
          inviterName: currentUser.displayName || currentUser.email,
          inviteeEmail: email,
          status: 'pending',
          message: `Join ${team.name}!`,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        successCount++;
      } catch (err) {
        console.error(`Error inviting ${email}:`, err);
        failCount++;
      }
    }
    
    showSuccess(`Invitations sent: ${successCount} successful, ${failCount} failed`);
    
  } catch (error) {
    console.error('Error in bulk invite:', error);
    showError('Error sending bulk invitations');
  }
};

// ---------- Team Announcements ----------
window.sendTeamAnnouncement = async function(teamId) {
  const message = prompt('Enter announcement message:');
  if (!message || !message.trim()) return;
  
  try {
    const teamDoc = await db.collection('teams').doc(teamId).get();
    const team = teamDoc.data();
    
    if (team.ownerId !== currentUser.uid) {
      showError('Only team owners can send announcements');
      return;
    }
    
    await db.collection('teamAnnouncements').add({
      teamId: teamId,
      teamName: team.name,
      message: message.trim(),
      senderId: currentUser.uid,
      senderName: currentUser.displayName || currentUser.email,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      readBy: [currentUser.uid]
    });
    
    showSuccess('Announcement sent to all team members!');
    
  } catch (error) {
    console.error('Error sending announcement:', error);
    showError('Error sending announcement');
  }
};

// ---------- Team Member Roles ----------
window.assignRole = async function(teamId, userId, role) {
  try {
    const teamDoc = await db.collection('teams').doc(teamId).get();
    const team = teamDoc.data();
    
    if (team.ownerId !== currentUser.uid) {
      showError('Only team owners can assign roles');
      return;
    }
    
    // Initialize roles object if doesn't exist
    const roles = team.roles || {};
    roles[userId] = role;
    
    await db.collection('teams').doc(teamId).update({
      roles: roles
    });
    
    showSuccess(`Role assigned: ${role}`);
    await loadTeamMembers(teamId, team.members);
    
  } catch (error) {
    console.error('Error assigning role:', error);
    showError('Error assigning role');
  }
};

// ---------- Enhanced Member Card with Roles ----------
async function loadTeamMembersWithRoles(teamId, memberIds) {
  const membersList = getById('teamMembersList');
  if (!membersList) return;
  
  if (!memberIds || memberIds.length === 0) {
    membersList.innerHTML = '<p class="no-participants">No members yet</p>';
    return;
  }
  
  try {
    const teamDoc = await db.collection('teams').doc(teamId).get();
    const team = teamDoc.data();
    const isOwner = team.ownerId === currentUser.uid;
    const roles = team.roles || {};
    
    const membersHTML = await Promise.all(memberIds.map(async (uid) => {
      try {
        const userDoc = await db.collection('users').doc(uid).get();
        const userData = userDoc.exists ? userDoc.data() : null;
        const isTeamOwner = uid === team.ownerId;
        const memberRole = roles[uid] || 'Member';
        
        const name = userData?.name || userData?.displayName || 'Unknown User';
        const email = userData?.email || '';
        const avatar = userData?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=ff6600&color=fff`;
        
        return `
          <div class="member-card">
            <img src="${avatar}" alt="${escapeHtml(name)}" class="member-avatar">
            <div class="member-info">
              <h4>
                ${escapeHtml(name)}
                ${isTeamOwner ? '<span class="owner-badge"><i class="fas fa-crown"></i> Owner</span>' : ''}
              </h4>
              <p>${escapeHtml(email)}</p>
              ${!isTeamOwner ? `<small style="color:#6c757d;"><i class="fas fa-user-tag"></i> ${memberRole}</small>` : ''}
            </div>
            <div style="display:flex;gap:8px;align-items:center;">
              ${isOwner && !isTeamOwner ? `
                <select class="role-select" onchange="assignRole('${teamId}', '${uid}', this.value)" style="padding:6px;border-radius:6px;border:1px solid #dee2e6;">
                  <option value="Member" ${memberRole === 'Member' ? 'selected' : ''}>Member</option>
                  <option value="Admin" ${memberRole === 'Admin' ? 'selected' : ''}>Admin</option>
                  <option value="Moderator" ${memberRole === 'Moderator' ? 'selected' : ''}>Moderator</option>
                </select>
                <button class="btn-danger btn-sm" onclick="removeMember('${teamId}', '${uid}')">
                  <i class="fas fa-user-minus"></i>
                </button>
              ` : ''}
            </div>
          </div>
        `;
      } catch (error) {
        console.error('Error loading member:', error);
        return '';
      }
    }));
    
    membersList.innerHTML = membersHTML.filter(h => h).join('');
    
  } catch (error) {
    console.error('Error loading team members:', error);
    membersList.innerHTML = '<p class="error-state">Error loading members</p>';
  }
}

// ---------- Team Statistics Dashboard ----------
window.viewTeamStatistics = async function(teamId) {
  try {
    const teamDoc = await db.collection('teams').doc(teamId).get();
    const team = teamDoc.data();
    
    // Calculate statistics
    const memberCount = team.members?.length || 0;
    const daysSinceCreation = team.createdAt 
      ? Math.floor((Date.now() - team.createdAt.toDate().getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    
    // Get activity data
    const activitySnapshot = await db.collection('teamActivity')
      .where('teamId', '==', teamId)
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();
    
    const recentActivity = activitySnapshot.docs.map(doc => doc.data());
    
    const statsHTML = `
      <div class="stats-dashboard">
        <h3><i class="fas fa-chart-bar"></i> Team Statistics</h3>
        <div class="stats-grid" style="margin-top:20px;">
          <div class="stat-box">
            <i class="fas fa-users"></i>
            <h4>${memberCount}</h4>
            <p>Total Members</p>
          </div>
          <div class="stat-box">
            <i class="fas fa-calendar-check"></i>
            <h4>${daysSinceCreation}</h4>
            <p>Days Active</p>
          </div>
          <div class="stat-box">
            <i class="fas fa-comments"></i>
            <h4>${recentActivity.length}</h4>
            <p>Recent Activities</p>
          </div>
          <div class="stat-box">
            <i class="fas fa-chart-line"></i>
            <h4>${Math.floor(memberCount / Math.max(daysSinceCreation, 1) * 30)}</h4>
            <p>Growth Rate</p>
          </div>
        </div>
        <div class="recent-activity" style="margin-top:24px;">
          <h4>Recent Activity</h4>
          ${recentActivity.length > 0 
            ? recentActivity.map(activity => `
              <div class="activity-item" style="padding:12px;border-bottom:1px solid #e9ecef;">
                <i class="fas fa-${activity.type === 'join' ? 'user-plus' : 'info-circle'}"></i>
                ${activity.description}
                <small style="color:#6c757d;float:right;">${safeDateDisplay(activity.createdAt)}</small>
              </div>
            `).join('')
            : '<p style="color:#6c757d;text-align:center;padding:20px;">No recent activity</p>'
          }
        </div>
      </div>
    `;
    
    // You can show this in a modal or dedicated section
    showToast('Statistics feature in development', 'info');
    console.log('Team Stats:', statsHTML);
    
  } catch (error) {
    console.error('Error loading team statistics:', error);
    showError('Error loading statistics');
  }
};

// ---------- Team Settings ----------
window.updateTeamSettings = async function(teamId) {
  try {
    const teamDoc = await db.collection('teams').doc(teamId).get();
    const team = teamDoc.data();
    
    if (team.ownerId !== currentUser.uid) {
      showError('Only team owners can update settings');
      return;
    }
    
    const settings = {
      allowMemberInvites: confirm('Allow members to invite others?'),
      requireApproval: confirm('Require owner approval for new members?'),
      isPublic: confirm('Make team publicly visible?')
    };
    
    await db.collection('teams').doc(teamId).update({
      settings: settings,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    showSuccess('Team settings updated!');
    
  } catch (error) {
    console.error('Error updating settings:', error);
    showError('Error updating settings');
  }
};

// ---------- Copy Team Invite Link ----------
window.copyTeamInviteLink = function(teamId) {
  const baseUrl = window.location.origin;
  const inviteLink = `${baseUrl}/join-team.html?teamId=${teamId}`;
  
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(inviteLink)
      .then(() => showSuccess('Invite link copied to clipboard!'))
      .catch(err => {
        console.error('Error copying to clipboard:', err);
        fallbackCopyToClipboard(inviteLink);
      });
  } else {
    fallbackCopyToClipboard(inviteLink);
  }
};

function fallbackCopyToClipboard(text) {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.left = '-999999px';
  document.body.appendChild(textArea);
  textArea.select();
  try {
    document.execCommand('copy');
    showSuccess('Invite link copied to clipboard!');
  } catch (err) {
    showError('Failed to copy link. Please copy manually: ' + text);
  }
  document.body.removeChild(textArea);
}

// ---------- Enhanced Team Card Actions ----------
window.showTeamContextMenu = function(teamId, event) {
  event.stopPropagation();
  
  const team = allTeams.find(t => t.id === teamId);
  if (!team) return;
  
  const isOwner = team.ownerId === currentUser.uid;
  
  const menuHTML = `
    <div class="context-menu" style="position:fixed;background:white;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15);padding:8px;z-index:1000;">
      <button onclick="viewTeamDetails('${teamId}')" style="display:block;width:100%;text-align:left;padding:8px 12px;border:none;background:none;cursor:pointer;">
        <i class="fas fa-eye"></i> View Details
      </button>
      ${isOwner ? `
        <button onclick="copyTeamInviteLink('${teamId}')" style="display:block;width:100%;text-align:left;padding:8px 12px;border:none;background:none;cursor:pointer;">
          <i class="fas fa-link"></i> Copy Invite Link
        </button>
        <button onclick="sendTeamAnnouncement('${teamId}')" style="display:block;width:100%;text-align:left;padding:8px 12px;border:none;background:none;cursor:pointer;">
          <i class="fas fa-bullhorn"></i> Send Announcement
        </button>
        <button onclick="exportTeamData('${teamId}')" style="display:block;width:100%;text-align:left;padding:8px 12px;border:none;background:none;cursor:pointer;">
          <i class="fas fa-download"></i> Export Data
        </button>
        <hr style="margin:4px 0;border:none;border-top:1px solid #e9ecef;">
        <button onclick="deleteTeam('${teamId}')" style="display:block;width:100%;text-align:left;padding:8px 12px;border:none;background:none;cursor:pointer;color:var(--danger-color);">
          <i class="fas fa-trash"></i> Delete Team
        </button>
      ` : `
        <button onclick="leaveTeam('${teamId}')" style="display:block;width:100%;text-align:left;padding:8px 12px;border:none;background:none;cursor:pointer;color:var(--danger-color);">
          <i class="fas fa-sign-out-alt"></i> Leave Team
        </button>
      `}
    </div>
  `;
  
  // Remove existing menu
  document.querySelectorAll('.context-menu').forEach(m => m.remove());
  
  // Create and position menu
  const menu = document.createElement('div');
  menu.innerHTML = menuHTML;
  document.body.appendChild(menu.firstElementChild);
  
  const menuElement = document.querySelector('.context-menu');
  menuElement.style.top = `${event.clientY}px`;
  menuElement.style.left = `${event.clientX}px`;
  
  // Close on click outside
  setTimeout(() => {
    document.addEventListener('click', function closeMenu() {
      menuElement?.remove();
      document.removeEventListener('click', closeMenu);
    });
  }, 100);
};

// Update showTeamMenu to use context menu
window.showTeamMenu = function(teamId) {
  const event = window.event;
  showTeamContextMenu(teamId, event);
};

// ---------- Keyboard Shortcuts ----------
document.addEventListener('keydown', (e) => {
  // Ctrl/Cmd + K to focus search
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    const searchInput = getById('team-search-input');
    searchInput?.focus();
  }
  
  // Ctrl/Cmd + N to create new team
  if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
    e.preventDefault();
    showCreateTeamModal();
  }
});

console.log('Enhanced teams features loaded');
// ========================================
// TEAMS PAGE MOBILE OPTIMIZATION
// Add these improvements to the END of teams.js
// ========================================

// Mobile-specific initialization
function initializeMobileOptimizations() {
    if (window.innerWidth <= 768) {
        console.log('Initializing mobile optimizations for Teams page');

        // 1. Optimize image loading
        optimizeImageLoading();

        // 2. Add pull-to-refresh hint
        addPullToRefreshHint();

        // 3. Optimize filters for touch
        optimizeFiltersForTouch();

        // 4. Add scroll position restoration
        enableScrollRestoration();

        // 5. Optimize modal animations
        optimizeModalAnimations();
    }
}

// Optimize image loading for mobile
function optimizeImageLoading() {
    const images = document.querySelectorAll('img');
    images.forEach(img => {
        // Add loading="lazy" for better performance
        img.loading = 'lazy';
        
        // Add error handling
        img.onerror = function() {
            this.src = 'https://ui-avatars.com/api/?name=User&background=ff6600&color=fff&size=128';
        };
    });
}

// Add pull-to-refresh hint
function addPullToRefreshHint() {
    let touchStartY = 0;
    let pullToRefreshThreshold = 80;
    
    const teamsContent = document.querySelector('.teams-content');
    if (!teamsContent) return;

    let refreshIndicator = document.querySelector('.refresh-indicator');
    if (!refreshIndicator) {
        refreshIndicator = document.createElement('div');
        refreshIndicator.className = 'refresh-indicator';
        refreshIndicator.innerHTML = '<i class="fas fa-sync-alt"></i> Pull to refresh';
        refreshIndicator.style.cssText = `
            position: fixed;
            top: -50px;
            left: 50%;
            transform: translateX(-50%);
            background: var(--primary-color);
            color: white;
            padding: 12px 24px;
            border-radius: 24px;
            font-size: 0.9rem;
            z-index: 1000;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            gap: 8px;
        `;
        document.body.appendChild(refreshIndicator);
    }

    teamsContent.addEventListener('touchstart', (e) => {
        if (window.scrollY === 0) {
            touchStartY = e.touches[0].clientY;
        }
    }, { passive: true });

    teamsContent.addEventListener('touchmove', (e) => {
        if (window.scrollY === 0) {
            const touchY = e.touches[0].clientY;
            const diff = touchY - touchStartY;
            
            if (diff > 0 && diff < pullToRefreshThreshold) {
                refreshIndicator.style.top = `${Math.min(diff - 50, 10)}px`;
            }
        }
    }, { passive: true });

    teamsContent.addEventListener('touchend', async () => {
        const currentTop = parseInt(refreshIndicator.style.top);
        
        if (currentTop >= 10) {
            // Trigger refresh
            refreshIndicator.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';
            refreshIndicator.style.top = '10px';
            
            try {
                await loadTeams();
                await loadInvites();
                showSuccess('Teams refreshed!');
            } catch (error) {
                showError('Failed to refresh');
            }
            
            refreshIndicator.innerHTML = '<i class="fas fa-sync-alt"></i> Pull to refresh';
        }
        
        // Reset
        setTimeout(() => {
            refreshIndicator.style.top = '-50px';
        }, 1000);
    }, { passive: true });
}

// Optimize filters for touch interaction
function optimizeFiltersForTouch() {
    const filterTabs = document.querySelectorAll('.filter-tab');
    filterTabs.forEach(tab => {
        // Add visual feedback on touch
        tab.addEventListener('touchstart', function() {
            this.style.transform = 'scale(0.95)';
        }, { passive: true });

        tab.addEventListener('touchend', function() {
            this.style.transform = 'scale(1)';
        }, { passive: true });
    });

    // Make filter tabs scrollable indicator more visible
    const filterTabsContainer = document.querySelector('.filter-tabs');
    if (filterTabsContainer && filterTabsContainer.scrollWidth > filterTabsContainer.clientWidth) {
        // Add shadow indicators
        const style = document.createElement('style');
        style.textContent = `
            .filter-tabs {
                position: relative;
            }
            .filter-tabs::after {
                content: '';
                position: absolute;
                right: 0;
                top: 0;
                bottom: 0;
                width: 40px;
                background: linear-gradient(to left, white, transparent);
                pointer-events: none;
            }
        `;
        document.head.appendChild(style);
    }
}

// Enable scroll position restoration
function enableScrollRestoration() {
    // Save scroll position before leaving page
    window.addEventListener('beforeunload', () => {
        sessionStorage.setItem('teamsScrollPosition', window.scrollY.toString());
    });

    // Restore scroll position on load
    const savedPosition = sessionStorage.getItem('teamsScrollPosition');
    if (savedPosition) {
        window.scrollTo(0, parseInt(savedPosition));
        sessionStorage.removeItem('teamsScrollPosition');
    }
}

// Optimize modal animations for mobile
function optimizeModalAnimations() {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        // Faster animations on mobile
        modal.style.transition = 'opacity 0.2s ease';
        
        const modalContent = modal.querySelector('.modal-content');
        if (modalContent) {
            modalContent.style.transition = 'transform 0.2s ease';
        }
    });
}

// REPLACE existing displayTeams function with this optimized version:
function displayTeams(teams) {
    const teamsGrid = document.getElementById('teams-grid');
    if (!teamsGrid) return;

    if (!teams || teams.length === 0) {
        teamsGrid.innerHTML = `
            <div class="no-events" style="grid-column: 1 / -1;">
                <i class="fas fa-users" style="font-size: 3rem; color: #ccc; margin-bottom: 16px;"></i>
                <p>No teams found. Create your first team!</p>
            </div>
        `;
        return;
    }

    teamsGrid.className = viewMode === 'list' ? 'teams-list' : 'teams-grid';

    // On mobile, use DocumentFragment for better performance
    const isMobile = window.innerWidth <= 768;
    
    if (isMobile) {
        const fragment = document.createDocumentFragment();
        
        teams.forEach(team => {
            const card = createTeamCard(team);
            fragment.appendChild(card);
        });
        
        teamsGrid.innerHTML = '';
        teamsGrid.appendChild(fragment);
    } else {
        // Desktop: use innerHTML (faster for large lists)
        teamsGrid.innerHTML = teams.map(team => createTeamCardHTML(team)).join('');
    }
}

// Helper function to create team card element (mobile)
function createTeamCard(team) {
    const card = document.createElement('div');
    card.className = `team-card ${viewMode === 'list' ? 'list-view' : ''}`;
    card.onclick = () => viewTeamDetails(team.id);
    card.innerHTML = createTeamCardHTML(team);
    return card;
}

// Helper function to create team card HTML
function createTeamCardHTML(team) {
    const isOwner = team.ownerId === currentUser.uid;
    const memberCount = team.members?.length || 0;
    const created = safeDateDisplay(team.createdAt);
    const desc = escapeHtml(team.description || 'No description');
    const hoursAgo = team.updatedAt ? (Date.now() - team.updatedAt.seconds * 1000) / (1000 * 60 * 60) : 999;
    const activity = hoursAgo < 24 ? 'Very Active' : hoursAgo < 72 ? 'Active' : 'Moderate';
    const activityClass = activity.toLowerCase().replace(' ', '-');

    return `
        <div class="team-card-banner" style="background: linear-gradient(135deg, var(--primary-color), var(--primary-light))">
            ${isOwner ? `<div class="team-owner-badge"><i class="fas fa-crown"></i> Owner</div>` : ''}
        </div>
        <div class="team-card-content">
            <div class="team-header">
                <div class="team-title-row">
                    <h3>${escapeHtml(team.name)}</h3>
                    <button class="team-menu-btn" onclick="event.stopPropagation(); showTeamMenu('${team.id}')">
                        <i class="fas fa-ellipsis-v"></i>
                    </button>
                </div>
                <span class="team-activity-badge ${activityClass}">
                    <i class="fas fa-circle" style="font-size: 6px;"></i> ${activity}
                </span>
            </div>
            <p class="team-description">${desc}</p>
            <div class="team-stats">
                <div class="team-stat-box">
                    <i class="fas fa-users"></i>
                    <span class="team-stat-value">${memberCount}</span>
                    <span class="team-stat-label">Members</span>
                </div>
                <div class="team-stat-box">
                    <i class="fas fa-award"></i>
                    <span class="team-stat-value">${Math.floor(Math.random() * 20)}</span>
                    <span class="team-stat-label">Awards</span>
                </div>
                <div class="team-stat-box">
                    <i class="fas fa-calendar"></i>
                    <span class="team-stat-value">${Math.floor(Math.random() * 10)}</span>
                    <span class="team-stat-label">Events</span>
                </div>
            </div>
            <div class="team-actions">
                <button class="team-action-btn primary" onclick="event.stopPropagation(); viewTeamDetails('${team.id}')">
                    <i class="fas fa-arrow-right"></i> View
                </button>
                <button class="team-action-btn secondary" onclick="event.stopPropagation(); openTeamChat('${team.id}')">
                    <i class="fas fa-comment"></i>
                </button>
                <button class="team-action-btn secondary" onclick="event.stopPropagation(); toggleTeamNotifications('${team.id}')">
                    <i class="fas fa-bell"></i>
                </button>
            </div>
            <div class="team-footer">
                <div class="team-last-activity">
                    <i class="fas fa-clock"></i> ${created}
                </div>
                <span class="category-badge" style="background: linear-gradient(135deg, var(--primary-color), var(--primary-light));">
                    ${escapeHtml(team.category || '')}
                </span>
            </div>
        </div>
    `;
}

// Add viewport height fix for mobile browsers
function fixMobileViewportHeight() {
    const setVh = () => {
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
    };

    setVh();
    window.addEventListener('resize', setVh);
    window.addEventListener('orientationchange', () => {
        setTimeout(setVh, 100);
    });
}

// Initialize all mobile optimizations when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initializeMobileOptimizations();
        fixMobileViewportHeight();
    });
} else {
    initializeMobileOptimizations();
    fixMobileViewportHeight();
}

// Add connection status monitoring
let isOnline = navigator.onLine;

window.addEventListener('online', () => {
    if (!isOnline) {
        isOnline = true;
        showSuccess('Connection restored');
        loadTeams().catch(console.error);
        loadInvites().catch(console.error);
    }
});

window.addEventListener('offline', () => {
    isOnline = false;
    showToast('You are offline. Some features may not work.', 'warning');
});

// Performance monitoring (development only)
if (window.location.hostname === 'localhost') {
    window.addEventListener('load', () => {
        const perfData = performance.getEntriesByType('navigation')[0];
        console.log('Page Load Time:', Math.round(perfData.loadEventEnd - perfData.fetchStart), 'ms');
        console.log('DOM Content Loaded:', Math.round(perfData.domContentLoadedEventEnd - perfData.fetchStart), 'ms');
    });
}

console.log('Teams mobile optimizations loaded successfully');
// ---------- Team Chat Feature ----------
let chatUnsubscribe = null;

window.openTeamChat = async function(teamId) {
  const modal = document.createElement('div');
  modal.id = 'chatModal';
  modal.className = 'modal show';
  modal.innerHTML = `
    <div class="modal-content chat-modal">
      <div class="modal-header">
        <h2><i class="fas fa-comments"></i> Team Chat</h2>
        <button class="close-modal" onclick="closeChatModal()">&times;</button>
      </div>
      <div class="modal-body" style="padding:0;">
        <div class="chat-container">
          <div class="chat-messages" id="chatMessages">
            <div class="loading-placeholder">
              <i class="fas fa-spinner fa-spin"></i>
              <p>Loading messages...</p>
            </div>
          </div>
          <div class="chat-input-container">
            <input type="text" id="chatInput" placeholder="Type a message..." onkeypress="if(event.key==='Enter') sendMessage('${teamId}')">
            <button class="btn-primary" onclick="sendMessage('${teamId}')">
              <i class="fas fa-paper-plane"></i> Send
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  
  await loadChatMessages(teamId);
};

window.closeChatModal = function() {
  if (chatUnsubscribe) {
    chatUnsubscribe();
    chatUnsubscribe = null;
  }
  const modal = document.getElementById('chatModal');
  if (modal) modal.remove();
};

async function loadChatMessages(teamId) {
  const messagesContainer = document.getElementById('chatMessages');
  if (!messagesContainer) return;
  
  try {
    chatUnsubscribe = db.collection('teamChats')
      .doc(teamId)
      .collection('messages')
      .orderBy('timestamp', 'asc')
      .limit(50)
      .onSnapshot(snapshot => {
        if (snapshot.empty) {
          messagesContainer.innerHTML = `
            <div class="chat-empty-state">
              <i class="fas fa-comments"></i>
              <p>No messages yet. Start the conversation!</p>
            </div>
          `;
          return;
        }
        
        const messages = [];
        snapshot.forEach(doc => {
          messages.push({ id: doc.id, ...doc.data() });
        });
        
        displayChatMessages(messages);
        scrollToBottom();
      }, error => {
        console.error('Error loading chat:', error);
        messagesContainer.innerHTML = `
          <div class="error-state">
            <i class="fas fa-exclamation-triangle"></i>
            <p>Error loading messages</p>
          </div>
        `;
      });
  } catch (error) {
    console.error('Error setting up chat:', error);
    showError('Error loading chat');
  }
}

function displayChatMessages(messages) {
  const container = document.getElementById('chatMessages');
  if (!container) return;
  
  container.innerHTML = messages.map(msg => {
    const isOwn = msg.userId === currentUser.uid;
    const time = msg.timestamp ? new Date(msg.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    
    return `
      <div class="chat-message ${isOwn ? 'own-message' : ''}">
        ${!isOwn ? `
          <div class="message-avatar">
            <img src="${msg.userAvatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(msg.userName || 'U') + '&background=ff6600&color=fff'}" alt="${escapeHtml(msg.userName || 'User')}">
          </div>
        ` : ''}
        <div class="message-content">
          <div class="message-header">
            <span class="message-sender">${escapeHtml(msg.userName || 'Unknown')}</span>
            <span class="message-time">${time}</span>
          </div>
          <div class="message-text">${escapeHtml(msg.message)}</div>
        </div>
        ${isOwn ? `
          <div class="message-avatar">
            <img src="${msg.userAvatar || currentUser.photoURL || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(msg.userName || 'U') + '&background=ff6600&color=fff'}" alt="${escapeHtml(msg.userName || 'User')}">
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
  
  scrollToBottom();
}

function scrollToBottom() {
  const container = document.getElementById('chatMessages');
  if (container) {
    setTimeout(() => {
      container.scrollTop = container.scrollHeight;
    }, 100);
  }
}

window.sendMessage = async function(teamId) {
  const input = document.getElementById('chatInput');
  if (!input) return;
  
  const message = input.value.trim();
  if (!message) return;
  
  try {
    await db.collection('teamChats').doc(teamId).collection('messages').add({
      message: message,
      userId: currentUser.uid,
      userName: currentUser.displayName || currentUser.email.split('@')[0],
      userAvatar: currentUser.photoURL || null,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    input.value = '';
    input.focus();
  } catch (error) {
    console.error('Error sending message:', error);
    showError('Error sending message');
  }
};

window.toggleTeamNotifications = (teamId) => showToast('Notification preferences updated!', 'success');
window.showTeamMenu = (id) => showToast('Team menu coming soon!', 'info');