// event-details.js
// Cleaned, optimized version for Firebase (v8-style global `firebase`)

// Firebase config - ensure this matches your Firebase console
const firebaseConfig = {
    apiKey: "AIzaSyCKd_iH-McAMrKI_0YDoYG0xjn2KrQpTOQ",
    authDomain: "notifyme-events.firebaseapp.com",
    projectId: "notifyme-events",
    storageBucket: "notifyme-events.appspot.com", // fixed
    messagingSenderId: "761571632545",
    appId: "1:761571632545:web:547a7210fdebf366df97e0",
    measurementId: "G-309BJ6P79V"
  };
  
  // Initialize Firebase (v8 style)
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  
  const auth = firebase.auth();
  const db = firebase.firestore();
  const FieldValue = firebase.firestore.FieldValue;
  
  let currentUser = null;
  let currentTeamId = null;
  let allTeams = [];
  let allCategories = new Set(['Sports', 'Cultural', 'Technical', 'Academic', 'Social']);
  
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
      // val might be Firestore Timestamp or ISO string or number
      if (val.toDate) return val.toDate().toLocaleDateString();
      return new Date(val).toLocaleDateString();
    } catch (e) {
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
  
  // Toasts (kept same API but safer)
  function showToast(message, type = 'info') {
    try {
      const toast = document.createElement('div');
      toast.className = `toast ${type}`;
      toast.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
        <span>${escapeHtml(message)}</span>
      `;
      document.body.appendChild(toast);
      // animate in
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
  
  // ---------- Auth & boot ----------
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      window.location.href = 'login.html';
      return;
    }
    currentUser = user;
    updateUserInterface(user);
    // setup listeners after user is known
    setupRealtimeListeners();
    await loadTeams(); // initial load
    await loadInvites();
  });
  
  // ---------- UI helpers ----------
  function updateUserInterface(user) {
    const userNameElement = getById('user-name');
    const userAvatarElement = getById('user-avatar');
  
    if (userNameElement) {
      userNameElement.textContent = user.displayName || user.email.split('@')[0] || 'User';
    }
  
    if (userAvatarElement) {
      if (user.photoURL) {
        userAvatarElement.src = user.photoURL;
      } else {
        const initial = (user.displayName || user.email || 'U')[0].toUpperCase();
        userAvatarElement.src = `https://ui-avatars.com/api/?name=${initial}&background=ff6600&color=fff&size=128`;
      }
    }
  }
  
  // ---------- Realtime listeners ----------
  let teamsUnsubscribe = null;
  let invitesUnsubscribe = null;
  
  function setupRealtimeListeners() {
    // avoid creating multiple listeners
    if (teamsUnsubscribe) teamsUnsubscribe();
    if (invitesUnsubscribe) invitesUnsubscribe();
  
    // listen for teams where current user is a member (realtime)
    teamsUnsubscribe = db.collection('teams')
      .where('members', 'array-contains', currentUser.uid)
      .onSnapshot(() => {
        loadTeams().catch(err => console.error('loadTeams error:', err));
      }, (err) => console.error('teams onSnapshot error:', err));
  
    // listen for pending invites addressed to me
    invitesUnsubscribe = db.collection('teamInvites')
      .where('inviteeEmail', '==', currentUser.email)
      .where('status', '==', 'pending')
      .onSnapshot(() => {
        loadInvites().catch(err => console.error('loadInvites error:', err));
      }, (err) => console.error('invites onSnapshot error:', err));
  }
  
  // ---------- Load teams ----------
  async function loadTeams() {
    try {
      // Query already handled by onSnapshot filter, but to be safe we re-query here (used on initial load)
      const teamsSnapshot = await db.collection('teams')
        .where('members', 'array-contains', currentUser.uid)
        .get();
  
      allTeams = [];
      teamsSnapshot.forEach(doc => {
        const data = doc.data();
        // ensure createdAt/updatedAt are present
        allTeams.push({ id: doc.id, ...data });
        if (data.category) allCategories.add(data.category);
      });
  
      updateCategoryFilter();
      updateStats().catch(err => console.error('updateStats error', err));
      applyFilters();
    } catch (error) {
      console.error('Error loading teams:', error);
      showError('Error loading teams');
    }
  }
  
  // ---------- Category filter ----------
  function updateCategoryFilter() {
    const categoryFilter = getById('category-filter');
    if (!categoryFilter) return;
  
    const prevValue = categoryFilter.value || 'all';
    categoryFilter.innerHTML = '';
    const optAll = document.createElement('option');
    optAll.value = 'all';
    optAll.textContent = 'All Categories';
    categoryFilter.appendChild(optAll);
  
    [...allCategories].sort().forEach(category => {
      const option = document.createElement('option');
      option.value = category;
      option.textContent = category;
      categoryFilter.appendChild(option);
    });
  
    categoryFilter.value = prevValue;
    categoryFilter.onchange = applyFilters;
  }
  
  function applyFilters() {
    const categoryFilter = (getById('category-filter')?.value) || 'all';
    let filtered = allTeams;
    if (categoryFilter !== 'all') {
      filtered = allTeams.filter(t => t.category === categoryFilter);
    }
    displayTeams(filtered);
  }
  
  // ---------- Display teams ----------
  function displayTeams(teams) {
    const teamsGrid = getById('teams-grid');
    if (!teamsGrid) return;
  
    if (!teams || teams.length === 0) {
      teamsGrid.innerHTML = '<div class="no-events"><p>No teams found. Create your first team!</p></div>';
      return;
    }
  
    teamsGrid.innerHTML = teams.map(team => {
      const isOwner = team.ownerId === currentUser.uid;
      const memberCount = team.members?.length || 0;
      const created = safeDateDisplay(team.createdAt);
      const desc = escapeHtml(team.description || 'No description');
  
      return `
        <div class="team-card" onclick="viewTeamDetails('${team.id}')">
          <div class="team-header">
            <h3>${escapeHtml(team.name)} ${isOwner ? '<span class="owner-badge">Owner</span>' : ''}</h3>
            <span class="category-badge" data-category="${escapeHtml(team.category || '')}">${escapeHtml(team.category || '')}</span>
          </div>
          <div class="team-description"><p>${desc}</p></div>
          <div class="team-stats">
            <div class="team-stat"><i class="fas fa-users"></i><span>${memberCount} member${memberCount !== 1 ? 's' : ''}</span></div>
            <div class="team-stat"><i class="fas fa-calendar"></i><span>${created}</span></div>
          </div>
        </div>
      `;
    }).join('');
  }
  
  // ---------- Stats ----------
  async function updateStats() {
    try {
      const myTeamsCount = allTeams.length;
      const totalMembers = allTeams.reduce((sum, t) => sum + (t.members?.length || 0), 0);
  
      // pending invites addressed to me
      const invitesSnapshot = await db.collection('teamInvites')
        .where('inviteeEmail', '==', currentUser.email)
        .where('status', '==', 'pending')
        .get();
      const pendingInvites = invitesSnapshot.size;
  
      // pending requests for teams I own
      let pendingRequests = 0;
      const ownerTeamIds = allTeams.filter(t => t.ownerId === currentUser.uid).map(t => t.id);
      if (ownerTeamIds.length) {
        // batch counting for owner team invites
        const promises = ownerTeamIds.map(id =>
          db.collection('teamInvites')
            .where('teamId', '==', id)
            .where('status', '==', 'pending')
            .get()
        );
        const results = await Promise.all(promises);
        pendingRequests = results.reduce((acc, snap) => acc + snap.size, 0);
      }
  
      if (getById('my-teams-count')) getById('my-teams-count').textContent = myTeamsCount;
      if (getById('total-members-count')) getById('total-members-count').textContent = totalMembers;
      if (getById('pending-invites-count')) getById('pending-invites-count').textContent = pendingInvites;
      if (getById('pending-requests-count')) getById('pending-requests-count').textContent = pendingRequests;
    } catch (error) {
      console.error('Error updating stats:', error);
    }
  }
  
  // ---------- Invites ----------
  async function loadInvites() {
    try {
      const invitesSnapshot = await db.collection('teamInvites')
        .where('inviteeEmail', '==', currentUser.email)
        .where('status', '==', 'pending')
        .get();
  
      const invites = [];
      invitesSnapshot.forEach(doc => invites.push({ id: doc.id, ...doc.data() }));
  
      displayInvites(invites);
    } catch (error) {
      console.error('Error loading invites:', error);
    }
  }
  
  async function displayInvites(invites) {
    const invitesSection = getById('invites-section');
    const invitesGrid = getById('invites-grid');
    if (!invitesSection || !invitesGrid) return;
  
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
            <div class="invite-header">
              <h3>${escapeHtml(team.name)}</h3>
              <span class="category-badge" data-category="${escapeHtml(team.category || '')}">${escapeHtml(team.category || '')}</span>
            </div>
            <p class="invite-from">Invited by: ${escapeHtml(invite.inviterName || 'Unknown')}</p>
            <p class="invite-message">${escapeHtml(invite.message || 'Join our team!')}</p>
            <div class="invite-actions">
              <button class="btn-primary" onclick="acceptInvite('${invite.id}', '${invite.teamId}')">
                <i class="fas fa-check"></i> Accept
              </button>
              <button class="btn-danger" onclick="rejectInvite('${invite.id}')">
                <i class="fas fa-times"></i> Reject
              </button>
            </div>
          </div>
        `;
      } catch (err) {
        console.error('Error building invite card:', err);
        return '';
      }
    }));
  
    invitesGrid.innerHTML = inviteCards.join('');
  }
  
  window.acceptInvite = async function(inviteId, teamId) {
    try {
      const batch = db.batch();
      const inviteRef = db.collection('teamInvites').doc(inviteId);
      const teamRef = db.collection('teams').doc(teamId);
  
      batch.update(inviteRef, {
        status: 'accepted',
        respondedAt: FieldValue.serverTimestamp()
      });
      batch.update(teamRef, {
        members: FieldValue.arrayUnion(currentUser.uid),
        updatedAt: FieldValue.serverTimestamp()
      });
  
      await batch.commit();
  
      showSuccess('Team invitation accepted!');
      // local refresh handled by realtime listeners; but call these for immediate UI update
      await loadTeams();
      await loadInvites();
    } catch (error) {
      console.error('Error accepting invite:', error);
      showError('Error accepting invitation');
    }
  };
  
  window.rejectInvite = async function(inviteId) {
    try {
      await db.collection('teamInvites').doc(inviteId).update({
        status: 'rejected',
        respondedAt: FieldValue.serverTimestamp()
      });
      showSuccess('Invitation rejected');
      await loadInvites();
    } catch (error) {
      console.error('Error rejecting invite:', error);
      showError('Error rejecting invitation');
    }
  };
  
  // ---------- Team CRUD ----------
  window.showCreateTeamModal = function() {
    const modal = getById('createTeamModal');
    if (!modal) return;
    modal.style.display = 'flex';
    getById('createTeamForm')?.reset();
    const customGroup = getById('customCategoryGroup');
    if (customGroup) customGroup.style.display = 'none';
  };
  
  window.closeCreateTeamModal = function() {
    const modal = getById('createTeamModal');
    if (!modal) return;
    modal.style.display = 'none';
  };
  
  // handle category change visibility
  document.addEventListener('DOMContentLoaded', () => {
    const categorySelect = getById('teamCategory');
    if (categorySelect) {
      categorySelect.addEventListener('change', (e) => {
        const customGroup = getById('customCategoryGroup');
        if (customGroup) customGroup.style.display = e.target.value === 'Custom' ? 'block' : 'none';
      });
    }
  
    const createTeamForm = getById('createTeamForm');
    if (createTeamForm) {
      createTeamForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await createTeam();
      });
    }
  
    initializeSidebar();
    initializeDropdowns();
    initializeLogoutButtons();
  
    // debounce search input
    const memberSearch = getById('memberSearch');
    if (memberSearch) {
      memberSearch.addEventListener('input', debounce(() => {
        // only search if open modal
        if (currentTeamId) searchUsers();
      }, 350));
    }
  });
  
  async function createTeam() {
    try {
      const name = getById('teamName')?.value.trim() || '';
      let category = getById('teamCategory')?.value || '';
      const description = getById('teamDescription')?.value.trim() || '';
  
      if (!name) { showError('Please enter a team name'); return; }
  
      if (category === 'Custom') {
        category = getById('customCategory')?.value.trim();
        if (!category) { showError('Please enter a custom category name'); return; }
      }
  
      const teamData = {
        name,
        category,
        description,
        ownerId: currentUser.uid,
        ownerName: currentUser.displayName || currentUser.email,
        members: [currentUser.uid],
        createdAt: FieldValue.serverTimestamp(), // standardized
        updatedAt: FieldValue.serverTimestamp()
      };
  
      await db.collection('teams').add(teamData);
  
      closeCreateTeamModal();
      showSuccess('Team created successfully!');
      // Realtime listener will pick it up; also refresh now
      await loadTeams();
    } catch (error) {
      console.error('Error creating team:', error);
      showError('Error creating team');
    }
  }
  
  window.viewTeamDetails = async function(teamId) {
    currentTeamId = teamId;
    try {
      const teamDoc = await db.collection('teams').doc(teamId).get();
      if (!teamDoc.exists) { showError('Team not found'); return; }
  
      const team = teamDoc.data();
      const isOwner = team.ownerId === currentUser.uid;
  
      if (getById('teamDetailsName')) getById('teamDetailsName').textContent = team.name || '—';
      if (getById('teamDetailsCategory')) getById('teamDetailsCategory').textContent = team.category || '—';
      if (getById('teamDetailsDescription')) getById('teamDetailsDescription').textContent = team.description || '—';
      if (getById('teamDetailsCreated')) getById('teamDetailsCreated').textContent = safeDateDisplay(team.createdAt);
  
      if (getById('ownerActionsSection')) getById('ownerActionsSection').style.display = isOwner ? 'block' : 'none';
      if (getById('ownerFooterActions')) getById('ownerFooterActions').style.display = isOwner ? 'flex' : 'none';
  
      await loadTeamMembers(team);
      if (isOwner) await loadPendingRequests(teamId);
  
      const modal = getById('teamDetailsModal');
      if (modal) modal.style.display = 'flex';
    } catch (error) {
      console.error('Error loading team details:', error);
      showError('Error loading team details');
    }
  };
  
  window.closeTeamDetailsModal = function() {
    const modal = getById('teamDetailsModal');
    if (modal) modal.style.display = 'none';
    currentTeamId = null;
    if (getById('searchResults')) getById('searchResults').innerHTML = '';
    if (getById('memberSearch')) getById('memberSearch').value = '';
  };
  
  // ---------- Members ----------
  async function loadTeamMembers(team) {
    const membersList = getById('teamMembersList');
    const memberCount = getById('memberCount');
    if (!membersList) return;
  
    memberCount && (memberCount.textContent = (team.members || []).length);
  
    // fetch user docs for member IDs (parallel)
    try {
      const memberPromises = (team.members || []).map(id => db.collection('users').doc(id).get());
      const snaps = await Promise.all(memberPromises);
  
      const memberCards = snaps.map(snap => {
        const userData = snap.exists ? snap.data() : null;
        const memberId = snap.id;
        const isOwner = team.ownerId === memberId;
        const canRemove = (team.ownerId === currentUser.uid) && !isOwner;
  
        return `
          <div class="member-card">
            <img class="member-avatar" src="${escapeHtml(userData?.photoURL || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(userData?.displayName || 'User'))}" alt="Avatar">
            <div class="member-info">
              <h4>${escapeHtml(userData?.displayName || userData?.email || 'Unknown User')} ${isOwner ? '<span class="owner-badge">Owner</span>' : ''}</h4>
              <p>${escapeHtml(userData?.email || '')}</p>
            </div>
            ${canRemove ? `
              <button class="btn-danger btn-sm" onclick="removeMember('${memberId}')">
                <i class="fas fa-user-minus"></i> Remove
              </button>
            ` : ''}
          </div>
        `;
      }).join('');
  
      membersList.innerHTML = memberCards;
    } catch (error) {
      console.error('Error loading team members:', error);
      membersList.innerHTML = '<p class="error">Could not load members.</p>';
    }
  }
  
  window.removeMember = async function(memberId) {
    if (!currentTeamId) return;
    if (!confirm('Are you sure you want to remove this member?')) return;
  
    try {
      await db.collection('teams').doc(currentTeamId).update({
        members: FieldValue.arrayRemove(memberId),
        updatedAt: FieldValue.serverTimestamp()
      });
  
      showSuccess('Member removed successfully');
      // refresh team details and teams list
      const teamDoc = await db.collection('teams').doc(currentTeamId).get();
      if (teamDoc.exists) await loadTeamMembers(teamDoc.data());
      await loadTeams();
    } catch (error) {
      console.error('Error removing member:', error);
      showError('Error removing member');
    }
  };
  
  // ---------- Pending requests (for owners) ----------
  async function loadPendingRequests(teamId) {
    const requestsSection = getById('requestsSection');
    const requestsList = getById('pendingRequestsList');
    if (!requestsList) return;
  
    try {
      const requestsSnapshot = await db.collection('teamInvites')
        .where('teamId', '==', teamId)
        .where('status', '==', 'pending')
        .get();
  
      if (requestsSnapshot.empty) {
        if (requestsSection) requestsSection.style.display = 'none';
        requestsList.innerHTML = '';
        return;
      }
  
      if (requestsSection) requestsSection.style.display = 'block';
  
      const requests = [];
      requestsSnapshot.forEach(doc => requests.push({ id: doc.id, ...doc.data() }));
  
      requestsList.innerHTML = requests.map(request => `
        <div class="request-card">
          <div class="request-info">
            <h4>${escapeHtml(request.inviteeName || 'Unknown')}</h4>
            <p>${escapeHtml(request.inviteeEmail || '')}</p>
            <small>Invited: ${safeDateDisplay(request.createdAt)}</small>
          </div>
        </div>
      `).join('');
    } catch (error) {
      console.error('Error loading requests:', error);
    }
  }
  
  // ---------- Delete team ----------
  window.deleteTeam = async function() {
    if (!currentTeamId) return;
    if (!confirm('Are you sure you want to delete this team? This action cannot be undone.')) return;
  
    try {
      // delete team doc
      const teamRef = db.collection('teams').doc(currentTeamId);
      await teamRef.delete();
  
      // delete related invites in a batch
      const invitesSnapshot = await db.collection('teamInvites')
        .where('teamId', '==', currentTeamId)
        .get();
  
      if (!invitesSnapshot.empty) {
        const batch = db.batch();
        invitesSnapshot.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
      }
  
      closeTeamDetailsModal();
      showSuccess('Team deleted successfully');
      await loadTeams();
    } catch (error) {
      console.error('Error deleting team:', error);
      showError('Error deleting team');
    }
  };
  
  // ---------- Search & Invite users ----------
  window.searchUsers = async function() {
    const searchTerm = (getById('memberSearch')?.value || '').trim().toLowerCase();
    const resultsDiv = getById('searchResults');
    if (!resultsDiv) return;
  
    if (!searchTerm) {
      resultsDiv.innerHTML = '';
      return;
    }
    if (!currentTeamId) {
      resultsDiv.innerHTML = '<p class="no-results">Open a team first.</p>';
      return;
    }
  
    try {
      const teamDoc = await db.collection('teams').doc(currentTeamId).get();
      if (!teamDoc.exists) { resultsDiv.innerHTML = '<p class="no-results">Team not found.</p>'; return; }
      const team = teamDoc.data();
  
      // naive approach: fetch users but limit to avoid cost. For larger apps, add indexed search fields and use where() queries.
      const usersSnapshot = await db.collection('users').limit(50).get();
      const users = [];
      usersSnapshot.forEach(doc => {
        const userData = doc.data();
        const name = (userData.displayName || '').toLowerCase();
        const email = (userData.email || '').toLowerCase();
  
        if ((name.includes(searchTerm) || email.includes(searchTerm)) &&
          !team.members.includes(doc.id) &&
          doc.id !== currentUser.uid) {
          users.push({ id: doc.id, ...userData });
        }
      });
  
      if (users.length === 0) {
        resultsDiv.innerHTML = '<p class="no-results">No users found</p>';
        return;
      }
  
      resultsDiv.innerHTML = users.map(user => `
        <div class="search-result-item">
          <img class="result-avatar" src="${escapeHtml(user.photoURL || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.displayName || 'User'))}" alt="Avatar">
          <div class="result-info">
            <h4>${escapeHtml(user.displayName || 'Unknown User')}</h4>
            <p>${escapeHtml(user.email || '')}</p>
          </div>
          <button class="btn-primary btn-sm" onclick="inviteUser('${user.id}', '${escapeHtml(user.email || '')}', '${escapeHtml(user.displayName || user.email || '')}')">
            <i class="fas fa-user-plus"></i> Invite
          </button>
        </div>
      `).join('');
    } catch (error) {
      console.error('Error searching users:', error);
      showError('Error searching users');
    }
  };
  
  window.inviteUser = async function(userId, userEmail, userName) {
    if (!currentTeamId) return;
    try {
      const teamDoc = await db.collection('teams').doc(currentTeamId).get();
      if (!teamDoc.exists) { showError('Team not found'); return; }
      const team = teamDoc.data();
  
      await db.collection('teamInvites').add({
        teamId: currentTeamId,
        teamName: team.name || '',
        inviterId: currentUser.uid,
        inviterName: currentUser.displayName || currentUser.email,
        inviteeId: userId,
        inviteeEmail: userEmail,
        inviteeName: userName,
        status: 'pending',
        message: `Join ${team.name || 'our team'}!`,
        createdAt: FieldValue.serverTimestamp()
      });
  
      showSuccess(`Invitation sent to ${userName}`);
      if (getById('searchResults')) getById('searchResults').innerHTML = '';
      if (getById('memberSearch')) getById('memberSearch').value = '';
    } catch (error) {
      console.error('Error inviting user:', error);
      showError('Error inviting user');
    }
  };
  
  // ---------- Sidebar, dropdowns, logout initialization ----------
  function initializeSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const menuToggle = document.querySelector('.menu-toggle');
    const mobileMenuToggle = document.querySelector('#mobile-menu-toggle');
    const dashboardContainer = document.querySelector('.dashboard-container');
  
    if (!sidebar || !dashboardContainer) return;
  
    let overlay = document.querySelector('.sidebar-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'sidebar-overlay';
      overlay.style.cssText = `
        display: none;
        position: fixed;
        top: 0; left: 0;
        width: 100%; height: 100%;
        background: rgba(0,0,0,0.5);
        z-index: 999;
        opacity: 0;
        transition: opacity 0.3s ease;
      `;
      dashboardContainer.appendChild(overlay);
    }
  
    function toggleSidebar() {
      sidebar.classList.toggle('active');
      if (sidebar.classList.contains('active')) {
        overlay.style.display = 'block';
        requestAnimationFrame(() => overlay.style.opacity = '1');
        document.body.style.overflow = 'hidden';
      } else {
        overlay.style.opacity = '0';
        setTimeout(() => overlay.style.display = 'none', 300);
        document.body.style.overflow = '';
      }
    }
  
    menuToggle && menuToggle.addEventListener('click', toggleSidebar);
    mobileMenuToggle && mobileMenuToggle.addEventListener('click', toggleSidebar);
    overlay.addEventListener('click', toggleSidebar);
  }
  
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
  
  function initializeLogoutButtons() {
    const logoutBtn = getById('logout-btn');
    const logoutLink = getById('logout-link');
  
    const handleLogout = async () => {
      try {
        await auth.signOut();
        sessionStorage.clear();
        window.location.href = 'login.html';
      } catch (error) {
        console.error('Error signing out:', error);
        showError('Error signing out');
      }
    };
  
    logoutBtn && logoutBtn.addEventListener('click', handleLogout);
    if (logoutLink) {
      logoutLink.addEventListener('click', (e) => {
        e.preventDefault();
        handleLogout();
      });
    }
  }
  
  // ---------- Cleanup on unload ----------
  window.addEventListener('beforeunload', () => {
    if (teamsUnsubscribe) teamsUnsubscribe();
    if (invitesUnsubscribe) invitesUnsubscribe();
  });
  