// =============================
// COMPLETE teams.js with Create Team & Chat Features
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
let currentChatTeamId = null;
let allTeams = [];
let allCategories = new Set(['Sports', 'Cultural', 'Technical', 'Academic', 'Social']);
let viewMode = 'grid';
let activeFilter = 'all';
let sortOption = 'recent';
let searchTerm = '';
let chatUnsubscribe = null;
let unreadMessagesCount = {};

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

function formatTimestamp(timestamp) {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
  if (diff < 604800000) return Math.floor(diff / 86400000) + 'd ago';
  return date.toLocaleDateString();
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
    setupUnreadMessagesListener();
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

// ---------- Unread Messages Listener ----------
function setupUnreadMessagesListener() {
  allTeams.forEach(team => {
    db.collection('teamChats').doc(team.id)
      .collection('messages')
      .where('senderId', '!=', currentUser.uid)
      .onSnapshot(snapshot => {
        let unreadCount = 0;
        snapshot.forEach(doc => {
          const msg = doc.data();
          if (!msg.readBy || !msg.readBy.includes(currentUser.uid)) {
            unreadCount++;
          }
        });
        unreadMessagesCount[team.id] = unreadCount;
        updateUnreadBadges();
      });
  });
}

function updateUnreadBadges() {
  Object.keys(unreadMessagesCount).forEach(teamId => {
    const count = unreadMessagesCount[teamId];
    const chatBtn = document.querySelector(`[onclick*="openTeamChat('${teamId}')"]`);
    if (chatBtn) {
      let badge = chatBtn.querySelector('.notification-badge');
      if (count > 0) {
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'notification-badge';
          chatBtn.style.position = 'relative';
          chatBtn.appendChild(badge);
        }
        badge.textContent = count > 9 ? '9+' : count;
      } else if (badge) {
        badge.remove();
      }
    }
  });
}

// ---------- FIXED: Create Team ----------
window.showCreateTeamModal = function () {
  const modal = getById('createTeamModal');
  if (modal) modal.classList.add('show');
  
  // Setup category change listener
  const categorySelect = getById('teamCategory');
  const customCategoryGroup = getById('customCategoryGroup');
  
  if (categorySelect && customCategoryGroup) {
    categorySelect.onchange = function() {
      customCategoryGroup.style.display = this.value === 'Custom' ? 'block' : 'none';
      if (this.value !== 'Custom') {
        getById('customCategory').value = '';
      }
    };
  }
};

window.closeCreateTeamModal = function () {
  const modal = getById('createTeamModal');
  if (modal) modal.classList.remove('show');
  getById('createTeamForm')?.reset();
  const customCategoryGroup = getById('customCategoryGroup');
  if (customCategoryGroup) customCategoryGroup.style.display = 'none';
};

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

    // Ensure all teams have chat rooms
    await ensureAllTeamsHaveChatRooms();

    updateCategoryFilter();
    await updateStats();
    applyFilters();
  } catch (error) {
    console.error('Error loading teams:', error);
    showError('Error loading teams');
  }
}

// Ensure all teams have chat rooms (for legacy teams)
async function ensureAllTeamsHaveChatRooms() {
  try {
    for (const team of allTeams) {
      const chatDoc = await db.collection('teamChats').doc(team.id).get();
      if (!chatDoc.exists) {
        await db.collection('teamChats').doc(team.id).set({
          teamId: team.id,
          teamName: team.name,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          lastMessage: null,
          lastMessageTime: null
        });
        console.log('Created missing chat room for team:', team.name);
      }
    }
  } catch (error) {
    console.error('Error ensuring chat rooms exist:', error);
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

// ---------- CHAT FEATURE ----------
window.openTeamChat = async function(teamId) {
  currentChatTeamId = teamId;
  const modal = getById('teamChatModal');
  if (!modal) {
    createChatModal();
  }
  
  try {
    const teamDoc = await db.collection('teams').doc(teamId).get();
    if (!teamDoc.exists) {
      showError('Team not found');
      return;
    }
    
    const team = teamDoc.data();
    
    // Check if user is member
    if (!team.members.includes(currentUser.uid)) {
      showError('You are not a member of this team');
      return;
    }
    
    // Ensure chat room exists
    await ensureChatRoomExists(teamId, team.name);
    
    getById('chatTeamName').textContent = team.name;
    getById('teamChatModal').classList.add('show');
    
    // Load chat messages
    loadChatMessages(teamId);
    
    // Mark messages as read
    markMessagesAsRead(teamId);
    
  } catch (error) {
    console.error('Error opening chat:', error);
    showError('Error opening chat');
  }
};

// Ensure chat room exists before sending messages
async function ensureChatRoomExists(teamId, teamName) {
  try {
    const chatDoc = await db.collection('teamChats').doc(teamId).get();
    
    if (!chatDoc.exists) {
      // Create chat room if it doesn't exist
      await db.collection('teamChats').doc(teamId).set({
        teamId: teamId,
        teamName: teamName,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        lastMessage: null,
        lastMessageTime: null
      });
      console.log('Chat room created for team:', teamId);
    }
  } catch (error) {
    console.error('Error ensuring chat room exists:', error);
    throw error;
  }
}

function createChatModal() {
  const modalHTML = `
    <div id="teamChatModal" class="modal">
      <div class="modal-content chat-modal">
        <div class="modal-header" style="background:linear-gradient(135deg,var(--primary-color),var(--primary-light));color:white;">
          <h2 id="chatTeamName" style="margin:0;">Team Chat</h2>
          <button class="close-modal" onclick="closeTeamChat()" style="color:white;">&times;</button>
        </div>
        <div class="chat-container">
          <div id="chatMessages" class="chat-messages"></div>
          <div class="chat-input-container">
            <input type="text" id="chatInput" placeholder="Type a message..." onkeypress="if(event.key==='Enter') sendChatMessage()">
            <button onclick="sendChatMessage()" class="btn-primary"><i class="fas fa-paper-plane"></i></button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHTML);
}

window.closeTeamChat = function() {
  const modal = getById('teamChatModal');
  if (modal) modal.classList.remove('show');
  if (chatUnsubscribe) {
    chatUnsubscribe();
    chatUnsubscribe = null;
  }
  currentChatTeamId = null;
};

function loadChatMessages(teamId) {
  if (chatUnsubscribe) chatUnsubscribe();
  
  const chatMessages = getById('chatMessages');
  if (!chatMessages) return;
  
  chatMessages.innerHTML = '<div style="text-align:center;padding:20px;color:#6c757d;"><i class="fas fa-spinner fa-spin"></i> Loading messages...</div>';
  
  chatUnsubscribe = db.collection('teamChats').doc(teamId)
    .collection('messages')
    .orderBy('timestamp', 'asc')
    .limit(100)
    .onSnapshot((snapshot) => {
      const messages = [];
      snapshot.forEach(doc => {
        messages.push({ id: doc.id, ...doc.data() });
      });
      
      displayChatMessages(messages);
      
      // Scroll to bottom
      setTimeout(() => {
        chatMessages.scrollTop = chatMessages.scrollHeight;
      }, 100);
      
      // Show notification for new messages
      if (messages.length > 0) {
        const lastMessage = messages[messages.length - 1];
        if (lastMessage.senderId !== currentUser.uid && 
            (!lastMessage.readBy || !lastMessage.readBy.includes(currentUser.uid))) {
          showChatNotification(lastMessage);
        }
      }
    }, (error) => {
      console.error('Error loading messages:', error);
      chatMessages.innerHTML = '<div style="text-align:center;padding:20px;color:#dc3545;">Error loading messages</div>';
    });
}

function displayChatMessages(messages) {
  const chatMessages = getById('chatMessages');
  if (!chatMessages) return;
  
  if (messages.length === 0) {
    chatMessages.innerHTML = `
      <div style="text-align:center;padding:40px;color:#6c757d;">
        <i class="fas fa-comments" style="font-size:3rem;margin-bottom:16px;"></i>
        <p>No messages yet. Start the conversation!</p>
      </div>
    `;
    return;
  }
  
  chatMessages.innerHTML = messages.map(msg => {
    const isOwn = msg.senderId === currentUser.uid;
    return `
      <div class="chat-message ${isOwn ? 'own-message' : ''}">
        <div class="message-avatar">
          <img src="${msg.senderAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(msg.senderName || 'U')}&background=ff6600&color=fff`}" 
               alt="${escapeHtml(msg.senderName)}">
        </div>
        <div class="message-content">
          <div class="message-header">
            <span class="message-sender">${escapeHtml(msg.senderName)}</span>
            <span class="message-time">${formatTimestamp(msg.timestamp)}</span>
          </div>
          <div class="message-text">${escapeHtml(msg.message)}</div>
        </div>
      </div>
    `;
  }).join('');
}

window.sendChatMessage = async function() {
  const input = getById('chatInput');
  if (!input || !currentChatTeamId) return;
  
  const message = input.value.trim();
  if (!message) return;
  
  try {
    // First, ensure the chat room exists
    const teamDoc = await db.collection('teams').doc(currentChatTeamId).get();
    const team = teamDoc.data();
    await ensureChatRoomExists(currentChatTeamId, team.name);
    
    // Add message to subcollection
    await db.collection('teamChats').doc(currentChatTeamId)
      .collection('messages').add({
        message: message,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || currentUser.email,
        senderAvatar: currentUser.photoURL,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        readBy: [currentUser.uid]
      });
    
    // Update last message in team chat document
    await db.collection('teamChats').doc(currentChatTeamId).update({
      lastMessage: message,
      lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
      lastMessageSender: currentUser.uid
    });
    
    input.value = '';
    
  } catch (error) {
    console.error('Error sending message:', error);
    showError('Error sending message: ' + error.message);
  }
};

async function markMessagesAsRead(teamId) {
  try {
    const messagesSnapshot = await db.collection('teamChats').doc(teamId)
      .collection('messages')
      .get();
    
    const batch = db.batch();
    let updated = false;
    
    messagesSnapshot.forEach(doc => {
      const data = doc.data();
      if (!data.readBy || !data.readBy.includes(currentUser.uid)) {
        batch.update(doc.ref, {
          readBy: FieldValue.arrayUnion(currentUser.uid)
        });
        updated = true;
      }
    });
    
    if (updated) {
      await batch.commit();
      unreadMessagesCount[teamId] = 0;
      updateUnreadBadges();
    }
  } catch (error) {
    console.error('Error marking messages as read:', error);
  }
}

function showChatNotification(message) {
  if (Notification.permission === 'granted' && document.hidden) {
    new Notification(`New message from ${message.senderName}`, {
      body: message.message,
      icon: message.senderAvatar || '/gatherlogo.jpeg',
      badge: '/gatherlogo.jpeg'
    });
  }
  
  // Also show in-app notification
  if (document.hidden || !getById('teamChatModal')?.classList.contains('show')) {
    showToast(`New message from ${message.senderName} in team chat`, 'info');
  }
}

// Request notification permission
if ('Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission();
}

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
    await db.collection('teams').doc(currentTeamId).delete();
    
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

// ---------- Assign Role ----------
window.assignRole = async function(teamId, userId, role) {
  try {
    const teamDoc = await db.collection('teams').doc(teamId).get();
    const team = teamDoc.data();
    
    if (team.ownerId !== currentUser.uid) {
      showError('Only team owners can assign roles');
      return;
    }
    
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

// ---------- Leave Team ----------
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

// ---------- Export Team Data ----------
window.exportTeamData = async function (teamId) {
  try {
    const teamDoc = await db.collection('teams').doc(teamId).get();
    const team = teamDoc.data();
    
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

// ---------- Stats ----------
async function updateStats() {
  try {
    const myTeamsCount = allTeams.filter(t => t.ownerId === currentUser.uid).length;
    const totalMembers = allTeams.reduce((sum, t) => sum + (t.members?.length || 0), 0);
    
    const invitesSnapshot = await db.collection('teamInvites')
      .where('inviteeEmail', '==', currentUser.email)
      .where('status', '==', 'pending')
      .get();
    const pendingInvites = invitesSnapshot.size;
    
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
    
    if (getById('my-teams-count')) getById('my-teams-count').textContent = myTeamsCount;
    if (getById('total-members-count')) getById('total-members-count').textContent = totalMembers;
    if (getById('pending-invites-count')) getById('pending-invites-count').textContent = pendingInvites;
    if (getById('pending-requests-count')) getById('pending-requests-count').textContent = pendingRequests;
  } catch (error) {
    console.error('updateStats error:', error);
  }
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

// ---------- Notifications Toggle ----------
window.toggleTeamNotifications = async function(teamId) {
  try {
    const userDoc = await db.collection('users').doc(currentUser.uid).get();
    const userData = userDoc.data() || {};
    const mutedTeams = userData.mutedTeams || [];
    
    if (mutedTeams.includes(teamId)) {
      await db.collection('users').doc(currentUser.uid).update({
        mutedTeams: FieldValue.arrayRemove(teamId)
      });
      showSuccess('Notifications enabled for this team');
    } else {
      await db.collection('users').doc(currentUser.uid).update({
        mutedTeams: FieldValue.arrayUnion(teamId)
      });
      showSuccess('Notifications muted for this team');
    }
  } catch (error) {
    console.error('Error toggling notifications:', error);
    showError('Error updating notification settings');
  }
};

// ---------- Team Menu ----------
window.showTeamMenu = function(teamId) {
  const team = allTeams.find(t => t.id === teamId);
  if (!team) return;
  
  const isOwner = team.ownerId === currentUser.uid;
  const event = window.event;
  
  const menuHTML = `
    <div class="context-menu" style="position:fixed;background:white;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15);padding:8px;z-index:1000;">
      <button onclick="viewTeamDetails('${teamId}')" style="display:block;width:100%;text-align:left;padding:8px 12px;border:none;background:none;cursor:pointer;">
        <i class="fas fa-eye"></i> View Details
      </button>
      <button onclick="openTeamChat('${teamId}')" style="display:block;width:100%;text-align:left;padding:8px 12px;border:none;background:none;cursor:pointer;">
        <i class="fas fa-comment"></i> Open Chat
      </button>
      ${isOwner ? `
        <button onclick="copyTeamInviteLink('${teamId}')" style="display:block;width:100%;text-align:left;padding:8px 12px;border:none;background:none;cursor:pointer;">
          <i class="fas fa-link"></i> Copy Invite Link
        </button>
        <button onclick="exportTeamData('${teamId}')" style="display:block;width:100%;text-align:left;padding:8px 12px;border:none;background:none;cursor:pointer;">
          <i class="fas fa-download"></i> Export Data
        </button>
        <hr style="margin:4px 0;border:none;border-top:1px solid #e9ecef;">
        <button onclick="deleteTeam()" style="display:block;width:100%;text-align:left;padding:8px 12px;border:none;background:none;cursor:pointer;color:var(--danger-color);">
          <i class="fas fa-trash"></i> Delete Team
        </button>
      ` : `
        <button onclick="leaveTeam('${teamId}')" style="display:block;width:100%;text-align:left;padding:8px 12px;border:none;background:none;cursor:pointer;color:var(--danger-color);">
          <i class="fas fa-sign-out-alt"></i> Leave Team
        </button>
      `}
    </div>
  `;
  
  document.querySelectorAll('.context-menu').forEach(m => m.remove());
  
  const menu = document.createElement('div');
  menu.innerHTML = menuHTML;
  document.body.appendChild(menu.firstElementChild);
  
  const menuElement = document.querySelector('.context-menu');
  menuElement.style.top = `${event.clientY}px`;
  menuElement.style.left = `${event.clientX}px`;
  
  setTimeout(() => {
    document.addEventListener('click', function closeMenu() {
      menuElement?.remove();
      document.removeEventListener('click', closeMenu);
    });
  }, 100);
};

// ---------- DOM Ready & Event Listeners ----------
document.addEventListener('DOMContentLoaded', () => {
  // Team search
  const teamSearchInput = getById('team-search-input');
  if (teamSearchInput) {
    teamSearchInput.addEventListener('input', e => handleTeamSearch(e.target.value));
  }

  // Sort select
  const sortSelect = getById('sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', e => setSortOption(e.target.value));
  }

  // Category filter
  const categoryFilter = getById('category-filter');
  if (categoryFilter) {
    categoryFilter.addEventListener('change', () => applyFilters());
  }

  // Create team form
  const createTeamForm = getById('createTeamForm');
  if (createTeamForm) {
    createTeamForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const nameInput = getById('teamName');
      const categorySelect = getById('teamCategory');
      const customCategoryInput = getById('customCategory');
      const descriptionInput = getById('teamDescription');
      
      const name = nameInput?.value.trim();
      let category = categorySelect?.value;
      const description = descriptionInput?.value.trim();
      
      if (!name || !category || !description) {
        showError('Please fill in all required fields');
        return;
      }
      
      if (category === 'Custom') {
        const customCategory = customCategoryInput?.value.trim();
        if (!customCategory) {
          showError('Please enter a custom category name');
          return;
        }
        category = customCategory;
        allCategories.add(category);
      }
      
      try {
        const teamData = {
          name: name,
          category: category,
          description: description,
          ownerId: currentUser.uid,
          ownerName: currentUser.displayName || currentUser.email,
          members: [currentUser.uid],
          roles: {
            [currentUser.uid]: 'Owner'
          },
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          settings: {
            allowMemberInvites: false,
            requireApproval: true,
            isPublic: false
          }
        };
        
        const docRef = await db.collection('teams').add(teamData);
        
        await db.collection('teamChats').doc(docRef.id).set({
          teamId: docRef.id,
          teamName: name,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          lastMessage: null,
          lastMessageTime: null
        });
        
        showSuccess('Team created successfully!');
        closeCreateTeamModal();
        await loadTeams();
        
        setTimeout(() => viewTeamDetails(docRef.id), 500);
        
      } catch (error) {
        console.error('Error creating team:', error);
        showError('Error creating team: ' + error.message);
      }
    });
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

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      teamSearchInput?.focus();
    }
    
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      showCreateTeamModal();
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
  chatUnsubscribe && chatUnsubscribe();
});

// ---------- Modal Click Outside to Close ----------
window.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal')) {
    e.target.classList.remove('show');
  }
});

console.log('Teams page with complete functionality initialized successfully');