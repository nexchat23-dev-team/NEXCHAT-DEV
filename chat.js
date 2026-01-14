// CREATED BY DEMON ALEX
// RIGHT RESERVED 
import { auth, db } from "./firebase-config.js";
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, onSnapshot, serverTimestamp, orderBy, limit, Timestamp
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { signOut } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

// ============================================================
// GLOBAL STATE
// ============================================================

let currentChatUser = null;
let myUID = null;
let myUsername = null;
let myProfilePic = null;
let messageListener = null;
let contactsListener = null;
let callActive = false;
let callStartTime = null;
let callTimer = null;

const emojis = [
  '😊', '😂', '😍', '🤔', '😎', '😢', '❤️', '👍', '🔥', '✨',
  '🎉', '🎊', '😴', '😤', '😡', '😳', '😌', '🤐', '😷', '🤒',
  '🤕', '😪', '😵', '🤤', '😲', '😨', '😰', '😥', '😢', '😭',
  '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡',
  '👋', '👏', '🙌', '👐', '🤝', '🤲', '🤞', '🖖', '🤘', '🤟'
];

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function showNotif(msg, type = "info", duration = 3000) {
  const container = document.getElementById("notificationContainer");
  if (!container) return;
  
  const notif = document.createElement("div");
  notif.className = `notification ${type}`;
  notif.style.cssText = `
    padding: 12px 20px;
    margin: 10px;
    border-radius: 8px;
    background: ${type === "success" ? "#4CAF50" : type === "error" ? "#f44336" : "#2196F3"};
    color: white;
    font-weight: 500;
    animation: slideInRight 0.3s ease;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  `;
  notif.textContent = msg;
  container.appendChild(notif);
  
  setTimeout(() => {
    notif.style.animation = "slideOutRight 0.3s ease";
    setTimeout(() => notif.remove(), 300);
  }, duration);
}

function escape(text) {
  const div = document.createElement("div");
  div.textContent = text || "";
  return div.innerHTML;
}

function formatTime(timestamp) {
  const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(timestamp) {
  const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// ============================================================
// VIEW SWITCHER - Chat list to detail
// ============================================================

function showChatListView() {
  const listView = document.getElementById("chatListView");
  const detailView = document.getElementById("chatDetailView");
  if (listView) listView.style.display = "flex";
  if (detailView) detailView.style.display = "none";
}

function showChatDetailView() {
  const listView = document.getElementById("chatListView");
  const detailView = document.getElementById("chatDetailView");
  if (listView) listView.style.display = "none";
  if (detailView) detailView.style.display = "flex";
}

document.getElementById("backBtn")?.addEventListener("click", () => {
  showChatListView();
  goBack();
});

// Profile button is now a direct link in HTML

// (nav dropdown removed) navigation uses direct links now

// ============================================================
// SEARCH FUNCTIONALITY
// ============================================================

function openSearch() {
  console.log("🔍 Opening search...");
  const overlay = document.getElementById("search-overlay");
  const modal = document.getElementById("search-modal");
  const input = document.getElementById("search-input");
  
  if (!overlay || !modal || !input) {
    console.error("❌ Search elements not found!");
    showNotif("Search not available", "error");
    return;
  }
  
  // Force display on Android
  overlay.style.display = "flex";
  overlay.style.visibility = "visible";
  overlay.style.opacity = "1";
  overlay.style.pointerEvents = "auto";
  
  modal.style.display = "flex";
  modal.style.visibility = "visible";
  modal.style.opacity = "1";
  
  // Load all users when search opens
  loadAllUsers();
  
  // Focus input with delay for mobile
  setTimeout(() => {
    input.focus();
    input.click(); // Trigger keyboard on mobile
    console.log("✅ Search input focused");
  }, 100);
}

async function loadAllUsers() {
  console.log("📱 Loading all users...");
  
  if (!myUID) {
    console.warn("⚠️ User not authenticated");
    return;
  }

  try {
    const q = query(collection(db, "users"));
    const snap = await getDocs(q);
    
    console.log("📊 Total users in database:", snap.docs.length);
    
    let allUsers = [];
    snap.forEach(docSnap => {
      const user = docSnap.data();
      user.uid = docSnap.id;
      
      // Skip current user
      if (user.uid !== myUID) {
        allUsers.push(user);
      }
    });
    
    const resultsDiv = document.getElementById("search-results");
    resultsDiv.innerHTML = ""; // Clear previous results
    
    if (allUsers.length === 0) {
      resultsDiv.innerHTML = "<div style='padding: 16px; text-align: center; color: #999; font-size: 14px;'>No other users yet</div>";
      return;
    }

    // Display all users
    allUsers.forEach(user => {
      const resultItem = document.createElement("div");
      resultItem.className = "search-result-item";
      resultItem.style.cssText = `
        padding: 14px;
        border: 1.5px solid rgba(0, 255, 102, 0.3);
        border-radius: 12px;
        margin: 10px;
        cursor: pointer;
        background: linear-gradient(135deg, rgba(10, 15, 26, 0.8), rgba(0, 255, 102, 0.05));
        color: #fff;
        transition: all 0.3s;
        display: flex;
        align-items: center;
        gap: 12px;
      `;
      
      const displayName = user.username || user.name || user.email;
      const profilePic = user.profilePic || user.profilePicUrl || '👤';
      
      // Create profile image or fallback
      let profileHTML = '';
      if (typeof profilePic === 'string' && (profilePic.startsWith('data:') || profilePic.startsWith('http'))) {
        profileHTML = `<img src="${escape(profilePic)}" alt="" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover; border: 2px solid #00ff66; flex-shrink: 0;">`;
      } else {
        profileHTML = `<div style="width: 50px; height: 50px; border-radius: 50%; background: #00ff66; color: #000; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 20px; flex-shrink: 0;">${displayName.charAt(0).toUpperCase()}</div>`;
      }
      
      resultItem.innerHTML = `
        ${profileHTML}
        <div style="flex: 1; min-width: 0;">
          <h4 style="margin: 0; color: #00ff66; font-weight: 600; word-break: break-word;">@${escape(displayName)}</h4>
          <p style="margin: 4px 0; color: #00d4ff; font-size: 12px; word-break: break-all;">${escape(user.email || 'No email')}</p>
          <p style="margin: 0; font-size: 11px; color: ${user.online ? '#4CAF50' : '#666'};">${user.online ? '🟢 Online' : '⚫ Offline'}</p>
        </div>
      `;
      
      resultItem.addEventListener("click", async () => {
        try {
          await openChat(user.uid, displayName, profilePic);
          closeSearch();
          showChatDetailView();
          showNotif("✓ Chat opened", "success");
        } catch (chatErr) {
          console.error("Error opening chat:", chatErr);
          showNotif("Error opening chat: " + chatErr.message, "error");
        }
      });
      
      resultItem.addEventListener("mouseover", () => {
        resultItem.style.background = "linear-gradient(135deg, #00ff66, #00d4ff)";
        resultItem.style.borderColor = "#00ff66";
        resultItem.style.color = "#000";
        resultItem.style.boxShadow = "0 0 20px rgba(0, 255, 102, 0.4)";
      });
      
      resultItem.addEventListener("mouseout", () => {
        resultItem.style.background = "linear-gradient(135deg, rgba(10, 15, 26, 0.8), rgba(0, 255, 102, 0.05))";
        resultItem.style.borderColor = "rgba(0, 255, 102, 0.3)";
        resultItem.style.color = "#fff";
        resultItem.style.boxShadow = "none";
      });
      
      resultsDiv.appendChild(resultItem);
    });
    
    console.log("✅ Loaded " + allUsers.length + " users");
  } catch (err) {
    console.error("Error loading users:", err);
    const resultsDiv = document.getElementById("search-results");
    resultsDiv.innerHTML = "<div style='padding: 16px; text-align: center; color: #ff4d4d;'>Error loading users</div>";
  }
}

function closeSearch() {
  console.log("❌ Closing search...");
  const overlay = document.getElementById("search-overlay");
  const modal = document.getElementById("search-modal");
  const input = document.getElementById("search-input");
  
  if (overlay) {
    overlay.style.display = "none";
    overlay.style.visibility = "hidden";
  }
  if (modal) {
    modal.style.display = "none";
    modal.style.visibility = "hidden";
  }
  if (input) {
    input.value = "";
    input.blur();
  }
  const resultsDiv = document.getElementById("search-results");
  if (resultsDiv) resultsDiv.innerHTML = "";
}

async function searchUser(e) {
  if (e) e.preventDefault();
  
  // Check if user is authenticated
  if (!myUID) {
    console.warn("⚠️ User not authenticated yet, waiting...");
    showNotif("Please wait, loading user data...", "info");
    return;
  }
  
  const searchInput = document.getElementById("search-input");
  if (!searchInput) {
    console.error("❌ Search input element not found!");
    showNotif("Search input error", "error");
    return;
  }
  
  const searchTerm = searchInput.value.trim().toLowerCase();
  console.log("🔍 Raw search input value:", searchInput.value);
  console.log("🔍 Trimmed search term:", searchTerm);
  console.log("🔍 Current user UID:", myUID);
  
  if (!searchTerm) {
    document.getElementById("search-results").innerHTML = "";
    return;
  }

  try {
    console.log("🔍 Starting search for:", searchTerm);
    
    // Get all users and filter client-side for more flexibility
    const q = query(collection(db, "users"));
    const snap = await getDocs(q);
    
    console.log("🔍 Searching for:", searchTerm);
    console.log("📊 Total users in database:", snap.docs.length);
    
    let foundUsers = [];
    snap.forEach(docSnap => {
      const user = docSnap.data();
      user.uid = docSnap.id; // Ensure uid is set
      
      // Debug: Log each user's data
      console.log("User data:", { uid: user.uid, email: user.email, username: user.username, name: user.name });
      
      // Skip current user and check if search term matches email or username
      if (user.uid !== myUID) {
        const email = (user.email || "").toLowerCase();
        const username = (user.username || "").toLowerCase();
        const name = (user.name || "").toLowerCase();
        
        console.log(`  Comparing: email="${email}" | username="${username}" | name="${name}" with searchTerm="${searchTerm}"`);
        
        // Check if search term matches any field (partial match for flexibility)
        if (email.includes(searchTerm) || username.includes(searchTerm) || name.includes(searchTerm)) {
          console.log("✅ Match found:", user.username || user.email);
          foundUsers.push(user);
        }
      } else {
        console.log("⏭️ Skipping current user (myUID):", myUID);
      }
    });
    
    console.log("Found users count:", foundUsers.length);
    
    const resultsDiv = document.getElementById("search-results");
    
    if (foundUsers.length === 0) {
      if (searchTerm.length > 0) {
        resultsDiv.innerHTML = "<div style='padding: 16px; text-align: center; color: #999; font-size: 14px;'>❌ No users found. Try searching by email, username, or name.</div>";
      } else {
        resultsDiv.innerHTML = "";
      }
      return;
    }

    resultsDiv.innerHTML = "";

    foundUsers.forEach(user => {
      const resultItem = document.createElement("div");
      resultItem.className = "search-result-item";
      resultItem.style.cssText = `
        padding: 14px;
        border: 1.5px solid rgba(0, 255, 102, 0.3);
        border-radius: 12px;
        margin: 10px 0;
        cursor: pointer;
        background: linear-gradient(135deg, rgba(10, 15, 26, 0.8), rgba(0, 255, 102, 0.05));
        color: #fff;
        transition: all 0.3s;
        display: flex;
        align-items: center;
        gap: 12px;
      `;
      
      const displayName = user.username || user.name || user.email;
      const profilePic = user.profilePic || user.profilePicUrl || '👤';
      
      // Create profile image or fallback
      let profileHTML = '';
      if (typeof profilePic === 'string' && (profilePic.startsWith('data:') || profilePic.startsWith('http'))) {
        profileHTML = `<img src="${escape(profilePic)}" alt="" style="width: 45px; height: 45px; border-radius: 50%; object-fit: cover; border: 2px solid #00ff66; flex-shrink: 0;">`;
      } else {
        profileHTML = `<div style="width: 45px; height: 45px; border-radius: 50%; background: #00ff66; color: #000; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 20px; flex-shrink: 0;">${displayName.charAt(0).toUpperCase()}</div>`;
      }
      
      resultItem.innerHTML = `
        ${profileHTML}
        <div style="flex: 1; min-width: 0;">
          <h4 style="margin: 0; color: #00ff66; font-weight: 600; word-break: break-word;">${escape(displayName)}</h4>
          <p style="margin: 4px 0; color: #00d4ff; font-size: 12px; word-break: break-all;">${escape(user.email || 'No email')}</p>
          <p style="margin: 0; font-size: 11px; color: ${user.online ? '#4CAF50' : '#666'};">${user.online ? '🟢 Online' : '⚫ Offline'}</p>
        </div>
      `;
      
      resultItem.addEventListener("click", async () => {
        try {
          await openChat(user.uid, displayName, profilePic);
          closeSearch();
          showChatDetailView();
          showNotif("✓ Chat opened", "success");
        } catch (chatErr) {
          console.error("Error opening chat:", chatErr);
          showNotif("Error opening chat: " + chatErr.message, "error");
        }
      });
      
      resultItem.addEventListener("mouseover", () => {
        resultItem.style.background = "linear-gradient(135deg, #00ff66, #00d4ff)";
        resultItem.style.borderColor = "#00ff66";
        resultItem.style.color = "#000";
        resultItem.style.boxShadow = "0 0 20px rgba(0, 255, 102, 0.4)";
      });
      
      resultItem.addEventListener("mouseout", () => {
        resultItem.style.background = "linear-gradient(135deg, rgba(10, 15, 26, 0.8), rgba(0, 255, 102, 0.05))";
        resultItem.style.borderColor = "rgba(0, 255, 102, 0.3)";
        resultItem.style.color = "#fff";
        resultItem.style.boxShadow = "none";
      });
      
      resultsDiv.appendChild(resultItem);
    });
  } catch (err) {
    console.error("Search error:", err);
    showNotif("Error: " + err.message, "error");
    document.getElementById("search-results").innerHTML = "<div style='padding: 16px; text-align: center; color: #ff4d4d;'>Error performing search</div>";
  }
}

document.getElementById("search-btn-header")?.addEventListener("click", openSearch);
document.getElementById("search-btn-header")?.addEventListener("touchstart", (e) => {
  e.preventDefault();
  openSearch();
}, { passive: false });

document.getElementById("close-search-btn")?.addEventListener("click", closeSearch);
document.getElementById("close-search-btn")?.addEventListener("touchstart", (e) => {
  e.preventDefault();
  closeSearch();
}, { passive: false });

// Close search when clicking outside (but not on modal content)
document.getElementById("search-overlay")?.addEventListener("click", (e) => {
  if (e.target.id === "search-overlay") {
    closeSearch();
  }
});

document.getElementById("search-submit-btn")?.addEventListener("click", searchUser);

// Real-time search as user types (debounced)
let searchTimeout;
document.getElementById("search-input")?.addEventListener("input", (e) => {
  clearTimeout(searchTimeout);
  // Debounce search: wait 300ms after user stops typing
  searchTimeout = setTimeout(() => {
    searchUser(e);
  }, 300);
});

// Also search on Enter key
document.getElementById("search-input")?.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    clearTimeout(searchTimeout);
    searchUser(e);
  }
});

// ============================================================
// BACK BUTTON & CHAT NAVIGATION
// ============================================================

function goBack() {
  currentChatUser = null;
  const messages = document.getElementById("messages-area");
  if (messages) {
    messages.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">💬</div>
        <p>Select a chat to start messaging</p>
        <p class="empty-hint">Search for users or select from contacts</p>
      </div>
    `;
  }
  document.getElementById("chatName").textContent = "Select a chat";
  document.getElementById("chatProfilePic").src = "";
  document.getElementById("statusText").textContent = "Offline";
  if (messageListener) messageListener();
}

document.getElementById("backBtn")?.addEventListener("click", goBack);

// ============================================================
// EMOJI PICKER
// ============================================================

function initializeEmojiPicker() {
  const emojiGrid = document.getElementById("emoji-grid");
  if (emojiGrid) {
    emojiGrid.innerHTML = emojis.map(e => 
      `<button type="button" class="emoji-item" data-emoji="${e}" style="background: none; border: 1px solid #ddd; font-size: 20px; cursor: pointer; padding: 8px; border-radius: 6px; transition: all 0.2s">${e}</button>`
    ).join("");

    emojiGrid.addEventListener("click", (e) => {
      if (e.target.classList.contains("emoji-item")) {
        const emoji = e.target.getAttribute("data-emoji");
        const input = document.getElementById("message-input");
        input.value += emoji;
        input.focus();
      }
    });
  }
}

function toggleEmojiPicker() {
  const picker = document.getElementById("emoji-picker");
  if (picker) {
    picker.style.display = picker.style.display === "none" ? "block" : "none";
  }
}

document.getElementById("emoji-btn")?.addEventListener("click", (e) => {
  e.preventDefault();
  toggleEmojiPicker();
});

document.getElementById("close-emoji-btn")?.addEventListener("click", () => {
  document.getElementById("emoji-picker").style.display = "none";
});


// ============================================================
// MESSAGE SENDING & RECEIVING
// ============================================================

async function sendMessage(e) {
  if (e) e.preventDefault();
  
  if (!currentChatUser) {
    showNotif("Select a chat first", "error");
    return;
  }

  const messageText = document.getElementById("message-input");
  const text = messageText?.value.trim();
  
  if (!text) {
    showNotif("Message cannot be empty", "error");
    return;
  }

  try {
    await addDoc(collection(db, "messages"), {
      from: myUID,
      to: currentChatUser,
      text: text,
      time: serverTimestamp(),
      read: false,
      type: "text",
      edited: false,
      reactions: []
    });

    messageText.value = "";
    showNotif("✓ Message sent", "success", 1500);
    document.getElementById("emoji-picker").style.display = "none";
  } catch (err) {
    showNotif("Error sending message: " + err.message, "error");
  }
}

function loadMessages() {
  if (!currentChatUser) return;
  
  if (messageListener) messageListener();
  
  const messagesDiv = document.getElementById("messages-area");
  if (!messagesDiv) return;
  
  messagesDiv.innerHTML = "<p style='text-align: center; color: #888; padding: 20px;'>Loading messages...</p>";

  const q = query(
    collection(db, "messages"),
    orderBy("time", "asc"),
    limit(100)
  );
  
  messageListener = onSnapshot(q, (snap) => {
    messagesDiv.innerHTML = "";
    
    const relevantMessages = snap.docs.filter(docSnap => {
      const m = docSnap.data();
      return (
        (m.from === myUID && m.to === currentChatUser) ||
        (m.from === currentChatUser && m.to === myUID)
      );
    });

    if (relevantMessages.length === 0) {
      messagesDiv.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">💭</div>
          <p>No messages yet</p>
          <p class="empty-hint">Start the conversation!</p>
        </div>
      `;
      return;
    }

    relevantMessages.forEach(docSnap => {
      const m = docSnap.data();
      const isOwn = m.from === myUID;
      
      const div = document.createElement("div");
      div.className = `message-wrapper ${isOwn ? "sent" : "received"}`;
      div.style.cssText = `
        display: flex;
        justify-content: ${isOwn ? "flex-end" : "flex-start"};
        margin: 8px 0;
        padding: 0 12px;
      `;
      
      const msgDate = m.time?.toDate?.() || new Date();
      const time = formatTime(msgDate);
      
      const bubble = document.createElement("div");
      bubble.className = "message-bubble";
      bubble.style.cssText = `
        background: ${isOwn ? "#00ff66" : "#222"};
        color: ${isOwn ? "#000" : "#fff"};
        padding: 10px 14px;
        border-radius: 12px;
        max-width: 70%;
        word-wrap: break-word;
        transition: all 0.2s;
      `;
      
      const content = document.createElement("p");
      content.style.margin = "0";
      content.textContent = m.text;
      
      const timeSpan = document.createElement("div");
      timeSpan.style.cssText = `font-size: 11px; margin-top: 4px; opacity: 0.7;`;
      timeSpan.textContent = time + (m.edited ? " (edited)" : "");
      
      bubble.appendChild(content);
      bubble.appendChild(timeSpan);
      
      bubble.addEventListener("mouseenter", () => {
        bubble.style.transform = "scale(1.02)";
      });
      bubble.addEventListener("mouseleave", () => {
        bubble.style.transform = "scale(1)";
      });
      
      div.appendChild(bubble);
      messagesDiv.appendChild(div);
      
      // Mark as read
      if (!isOwn && !m.read) {
        updateDoc(docSnap.ref, { read: true }).catch(() => {});
      }
    });
    
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }, (err) => {
    showNotif("Error loading messages: " + err.message, "error");
  });
}

document.getElementById("message-form")?.addEventListener("submit", sendMessage);

// ============================================================
// CONTACTS & USER MANAGEMENT
// ============================================================

async function loadContacts() {
  const user = auth.currentUser;
  if (!user) return;

  const contactList = document.getElementById("contactList");
  if (!contactList) return;

  contactList.innerHTML = "";

  try {
    const usersRef = collection(db, "users");
    const usersSnapshot = await getDocs(usersRef);

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      if (userData.uid === myUID || userDoc.id === myUID) continue;

      // Check if user has profilePic or profilePicUrl
      const profilePic = userData.profilePic || userData.profilePicUrl;
      const displayName = userData.username || userData.name || userData.email;
      
      // Only show contacts with proper data
      if (!displayName) continue;

      // Fetch last message from this user
      const messagesRef = collection(
        db,
        `users/${user.uid}/chats/${userDoc.id}/messages`
      );
      const messagesQuery = query(
        messagesRef,
        orderBy("timestamp", "desc"),
        limit(1)
      );
      
      let lastMessage = "No messages yet";
      try {
        const messagesSnapshot = await getDocs(messagesQuery);
        if (messagesSnapshot.docs.length > 0) {
          const lastMsg = messagesSnapshot.docs[0].data();
          lastMessage =
            lastMsg.message?.substring(0, 40) || "No messages yet";
          if (lastMsg.message && lastMsg.message.length > 40) {
            lastMessage += "...";
          }
        }
      } catch (msgErr) {
        // If messages don't exist, just use default
        lastMessage = "No messages yet";
      }

      const contactItem = document.createElement("div");
      contactItem.className = "chat-list-item";
      
      // Create profile image HTML
      let profileHTML = '';
      if (profilePic && (profilePic.startsWith('data:') || profilePic.startsWith('http'))) {
        profileHTML = `<img class="chat-avatar" src="${escape(profilePic)}" alt="${escape(displayName)}">`;
      } else {
        profileHTML = `<div class="chat-avatar" style="background: #00ff66; color: #000; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 18px;">${displayName.charAt(0).toUpperCase()}</div>`;
      }
      
      contactItem.innerHTML = `
        ${profileHTML}
        <div class="chat-item-content">
          <div class="chat-item-header">
            <span class="chat-name">${escape(displayName)}</span>
          </div>
          <small class="chat-preview">${escape(lastMessage)}</small>
        </div>
      `;
      contactItem.style.cursor = "pointer";
      contactItem.onclick = () => {
        openChat(userDoc.id, displayName, profilePic || '👤');
        showChatDetailView();
      };
      contactList.appendChild(contactItem);
    }
  } catch (err) {
    console.error("Error loading contacts:", err);
    showNotif("Error loading contacts: " + err.message, "error");
  }
}

async function loadStories() {
  const user = auth.currentUser;
  if (!user) return;

  const storiesList = document.getElementById("storiesList");
  if (!storiesList) return;

  storiesList.innerHTML = "";

  try {
    const usersRef = collection(db, "users");
    const usersSnapshot = await getDocs(usersRef);

    usersSnapshot.forEach((userDoc) => {
      const userData = userDoc.data();
      if (userData.uid === myUID) return;

      if (userData.name && userData.profilePicUrl) {
        const storyItem = document.createElement("div");
        storyItem.className = "story-item";
        storyItem.innerHTML = `
          <img src="${userData.profilePicUrl}" alt="${userData.name}" class="story-avatar">
          <span class="story-name">${escape(userData.name)}</span>
        `;
        storyItem.style.cursor = "pointer";
        storyItem.onclick = () => {
          openChat(userDoc.id, userData.name, userData.profilePicUrl);
          showChatDetailView();
        };
        storiesList.appendChild(storyItem);
      }
    });
  } catch (err) {
    showNotif("Error loading stories: " + err.message, "error");
  }
}

// ============================================================
// OPEN CHAT & UPDATE UI
// ============================================================

async function openChat(uid, username, profilePic) {
  currentChatUser = uid;
  
  document.getElementById("chatName").textContent = username;
  document.getElementById("chatProfilePic").src = profilePic || "👤";

  // Update info sidebar
  document.getElementById("infoName").textContent = username;
  document.getElementById("infoPic").src = profilePic || "👤";
  
  try {
    const userDoc = await getDoc(doc(db, "users", uid));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      document.getElementById("infoEmail").textContent = userData.email || "";
      document.getElementById("statusText").textContent = userData.online ? "🟢 Online" : "⚫ Offline";
      document.getElementById("infoStatus").textContent = userData.online ? "🟢 Online" : "⚫ Offline";
      
      // Show that user exists and display user info
      alert(`✅ User ${username} found! Redirecting to chat...`);
      showNotif(`✅ Opened chat with ${username}`, "success");
      
      // Automatically add to contacts if not already there
      try {
        const myUserRef = doc(db, "users", myUID);
        const myUserDoc = await getDoc(myUserRef);
        const myContacts = myUserDoc.data()?.contacts || [];
        
        if (!myContacts.includes(uid)) {
          myContacts.push(uid);
          await updateDoc(myUserRef, { contacts: myContacts });
          console.log("✅ Added user to contacts");
        }
      } catch (contactErr) {
        console.warn("Could not update contacts:", contactErr);
      }
    } else {
      // User does not exist
      showNotif("❌ User not found or profile incomplete", "error");
      console.warn("User document does not exist for UID:", uid);
      currentChatUser = null;
      return;
    }
  } catch (err) {
    console.error("Error loading user info:", err);
    showNotif("❌ Error loading user info: " + err.message, "error");
    currentChatUser = null;
    return;
  }

  loadMessages();
}

// ============================================================
// CHAT OPTIONS MENU
// ============================================================

document.getElementById("menuBtn")?.addEventListener("click", () => {
  const menu = document.getElementById("chatOptionsMenu");
  if (menu) {
    menu.style.display = menu.style.display === "none" ? "block" : "none";
  }
});

document.getElementById("muteBtn")?.addEventListener("click", async () => {
  if (!currentChatUser) return;
  showNotif("🔇 Chat muted", "success");
  document.getElementById("chatOptionsMenu").style.display = "none";
});

document.getElementById("blockBtn")?.addEventListener("click", async () => {
  if (!currentChatUser) return;
  
  try {
    const userRef = doc(db, "users", myUID);
    const userDoc = await getDoc(userRef);
    const blockedUsers = userDoc.data()?.blockedUsers || [];
    
    if (!blockedUsers.includes(currentChatUser)) {
      await updateDoc(userRef, {
        blockedUsers: [...blockedUsers, currentChatUser]
      });
      showNotif("🚫 User blocked", "success");
      goBack();
    } else {
      showNotif("User already blocked", "error");
    }
  } catch (err) {
    showNotif("Error blocking user: " + err.message, "error");
  }
  document.getElementById("chatOptionsMenu").style.display = "none";
});

document.getElementById("deleteBtn")?.addEventListener("click", async () => {
  if (!currentChatUser || !confirm("Delete this chat? Messages will be removed.")) return;
  
  try {
    const q = query(
      collection(db, "messages"),
      where("from", "in", [myUID, currentChatUser])
    );
    const snap = await getDocs(q);
    
    const batch = [];
    snap.forEach(docSnap => {
      const m = docSnap.data();
      if ((m.from === myUID && m.to === currentChatUser) || 
          (m.from === currentChatUser && m.to === myUID)) {
        batch.push(deleteDoc(docSnap.ref));
      }
    });
    
    await Promise.all(batch);
    showNotif("🗑️ Chat deleted", "success");
    goBack();
  } catch (err) {
    showNotif("Error deleting chat: " + err.message, "error");
  }
  document.getElementById("chatOptionsMenu").style.display = "none";
});

document.getElementById("reportBtn")?.addEventListener("click", async () => {
  if (!currentChatUser) return;
  showNotif("⚠️ User reported - our team will review", "success");
  document.getElementById("chatOptionsMenu").style.display = "none";
});

// ============================================================
// CALL FUNCTIONALITY
// ============================================================

function startCall(isVideo = false) {
  if (!currentChatUser) {
    showNotif("Select a chat first", "error");
    return;
  }
  
  callActive = true;
  callStartTime = Date.now();
  
  showNotif(isVideo ? "📹 Video call started" : "📞 Voice call started", "success");
  
  // Start timer
  callTimer = setInterval(() => {
    const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    // Update any call timer UI element if it exists
  }, 1000);
}

function endCall() {
  if (callTimer) clearInterval(callTimer);
  callActive = false;
  callStartTime = null;
  showNotif("📞 Call ended", "info");
}

document.getElementById("callBtn")?.addEventListener("click", () => {
  startCall(false);
});

document.getElementById("videoCallBtn")?.addEventListener("click", () => {
  startCall(true);
});

document.getElementById("infoCallBtn")?.addEventListener("click", () => {
  startCall(false);
});

document.getElementById("infoVideoBtn")?.addEventListener("click", () => {
  startCall(true);
});

// ============================================================
// INFO SIDEBAR
// ============================================================

document.getElementById("infoBtn")?.addEventListener("click", () => {
  const sidebar = document.getElementById("infoSidebar");
  if (sidebar && currentChatUser) {
    sidebar.style.display = sidebar.style.display === "none" ? "block" : "none";
  }
});

document.getElementById("closeInfoBtn")?.addEventListener("click", () => {
  document.getElementById("infoSidebar").style.display = "none";
});

document.getElementById("infoBlockBtn")?.addEventListener("click", async () => {
  if (!currentChatUser) return;
  
  try {
    const userRef = doc(db, "users", myUID);
    const userDoc = await getDoc(userRef);
    const blockedUsers = userDoc.data()?.blockedUsers || [];
    
    if (!blockedUsers.includes(currentChatUser)) {
      await updateDoc(userRef, {
        blockedUsers: [...blockedUsers, currentChatUser]
      });
      showNotif("🚫 User blocked", "success");
      goBack();
    }
  } catch (err) {
    showNotif("Error: " + err.message, "error");
  }
});

document.getElementById("infoDeleteBtn")?.addEventListener("click", async () => {
  if (!currentChatUser || !confirm("Delete this chat?")) return;
  
  try {
    const q = query(collection(db, "messages"));
    const snap = await getDocs(q);
    
    const batch = [];
    snap.forEach(docSnap => {
      const m = docSnap.data();
      if ((m.from === myUID && m.to === currentChatUser) || 
          (m.from === currentChatUser && m.to === myUID)) {
        batch.push(deleteDoc(docSnap.ref));
      }
    });
    
    await Promise.all(batch);
    showNotif("Chat deleted", "success");
    goBack();
  } catch (err) {
    showNotif("Error: " + err.message, "error");
  }
});

document.getElementById("infoReportBtn")?.addEventListener("click", () => {
  showNotif("⚠️ User reported", "success");
});

// ============================================================
// SIDEBAR BUTTONS
// ============================================================

document.getElementById("settingsBtn")?.addEventListener("click", () => {
  showNotif("⚙️ Settings - Coming soon!", "info");
});

// ============================================================
// LOGOUT
// ============================================================

window.logoutUser = async function() {
  try {
    if (myUID) {
      await updateDoc(doc(db, "users", myUID), { online: false });
    }
    await signOut(auth);
    window.location.href = "index.html";
  } catch (err) {
    showNotif("Logout error: " + err.message, "error");
  }
};

document.getElementById("logout-btn")?.addEventListener("click", logoutUser);

// ============================================================
// BOTTOM NAVIGATION
// ============================================================

document.getElementById("nav-messages")?.addEventListener("click", () => {
  showChatListView();
  showNotif("Messages", "info", 800);
});

// Profile and Reels buttons are now direct links in HTML

// ============================================================
// ATTACH FILE BUTTON
// ============================================================

document.getElementById("attach-btn")?.addEventListener("click", (e) => {
  e.preventDefault();
  showNotif("📎 File attachment coming soon", "info");
});

// ============================================================
// SETTINGS MODAL
// ============================================================

function openSettingsModal() {
  const modal = document.getElementById("settingsModal");
  if (modal) {
    modal.style.display = "flex";
    loadSettingsPreferences();
  }
}

function closeSettingsModal() {
  const modal = document.getElementById("settingsModal");
  if (modal) {
    modal.style.display = "none";
  }
}

function loadSettingsPreferences() {
  // Load preferences from localStorage
  const prefs = JSON.parse(localStorage.getItem("nexchat_settings")) || {};
  
  document.getElementById("notifToggle").checked = prefs.notifications !== false;
  document.getElementById("soundToggle").checked = prefs.sound !== false;
  document.getElementById("onlineStatusToggle").checked = prefs.onlineStatus !== false;
  document.getElementById("readReceiptsToggle").checked = prefs.readReceipts !== false;
  
  const theme = prefs.theme || "dark";
  document.getElementById("theme" + theme.charAt(0).toUpperCase() + theme.slice(1)).checked = true;
}

function saveSettingsPreferences() {
  const prefs = {
    notifications: document.getElementById("notifToggle").checked,
    sound: document.getElementById("soundToggle").checked,
    onlineStatus: document.getElementById("onlineStatusToggle").checked,
    readReceipts: document.getElementById("readReceiptsToggle").checked,
    theme: document.querySelector('input[name="theme"]:checked')?.value || "dark"
  };
  
  localStorage.setItem("nexchat_settings", JSON.stringify(prefs));
  showNotif("✅ Settings saved", "success");
}

// Settings button click
document.getElementById("settings-btn-header")?.addEventListener("click", (e) => {
  e.preventDefault();
  openSettingsModal();
});

// Close settings modal
document.getElementById("closeSettingsBtn")?.addEventListener("click", () => {
  saveSettingsPreferences();
  closeSettingsModal();
});

// Settings changes - auto save
document.getElementById("notifToggle")?.addEventListener("change", saveSettingsPreferences);
document.getElementById("soundToggle")?.addEventListener("change", saveSettingsPreferences);
document.getElementById("onlineStatusToggle")?.addEventListener("change", saveSettingsPreferences);
document.getElementById("readReceiptsToggle")?.addEventListener("change", saveSettingsPreferences);
document.querySelectorAll('input[name="theme"]').forEach(radio => {
  radio.addEventListener("change", saveSettingsPreferences);
});

// Edit profile button
document.getElementById("editProfileBtn")?.addEventListener("click", () => {
  saveSettingsPreferences();
  window.location.href = "profile-upload.html";
});

// Change password button
document.getElementById("changePasswordBtn")?.addEventListener("click", () => {
  showNotif("🔑 Password change feature coming soon", "info");
});

// Clear cache button
document.getElementById("clearCacheBtn")?.addEventListener("click", () => {
  if (confirm("Are you sure? This will clear all cached data.")) {
    localStorage.clear();
    showNotif("✅ Cache cleared", "success");
    setTimeout(() => {
      window.location.href = "index.html";
    }, 1000);
  }
});

// Logout from settings
document.getElementById("logoutSettingsBtn")?.addEventListener("click", () => {
  if (confirm("Are you sure you want to logout?")) {
    signOut(auth)
      .then(() => {
        localStorage.clear();
        showNotif("👋 Logged out", "success");
        setTimeout(() => {
          window.location.href = "index.html";
        }, 1000);
      })
      .catch((err) => {
        showNotif("❌ Logout error: " + err.message, "error");
      });
  }
});

// ============================================================
// INITIALIZATION
// ============================================================

function initializeApp() {
  // Initialize emoji picker
  initializeEmojiPicker();
  
  // Load contacts and stories on startup
  try {
    loadContacts();
    loadStories();
  } catch (e) {
    // ignore
  }
  
  // Listen for auth changes
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      myUID = user.uid;
      
      try {
        const userDoc = await getDoc(doc(db, "users", myUID));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          myUsername = userData.username || userData.email;
          myProfilePic = userData.profilePic || "";
        } else {
          // User document doesn't exist yet, redirect to profile setup
          window.location.href = "profile-upload.html";
          return;
        }
        
        // Mark as online
        try {
          await updateDoc(doc(db, "users", myUID), {
            online: true,
            lastSeen: serverTimestamp()
          });
        } catch (updateErr) {
          console.warn("Could not update online status:", updateErr);
          // Don't show error - could be offline, will sync when back online
        }
      } catch (err) {
        console.error("Error loading profile:", err);
        // Check if user exists - if not, redirect to profile setup
        if (err.message && err.message.includes("offline")) {
          showNotif("You appear to be offline. Please check your connection.", "error", 5000);
        } else {
          showNotif("Error loading profile: " + err.message, "error");
        }
      }
    } else {
      window.location.href = "index.html";
    }
  });
  
  // Cleanup on page unload
  window.addEventListener("beforeunload", async () => {
    if (myUID && messageListener) {
      messageListener();
      if (contactsListener) contactsListener();
      try {
        await updateDoc(doc(db, "users", myUID), {
          online: false,
          lastSeen: serverTimestamp()
        });
      } catch (err) {}
    }
  });
}

// Start app when DOM is ready 

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeApp);
} else {
  initializeApp();
}
