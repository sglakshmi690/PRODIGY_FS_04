//connecting & joining
const socket = io();
 
let currentRoom = null;
let privateTarget = null; // { id, username } when chatting privately
 
const joinScreen = document.getElementById("join-screen");
const chatScreen = document.getElementById("chat-screen");
const usernameInput = document.getElementById("username-input");
const roomSelect = document.getElementById("room-select");
const joinBtn = document.getElementById("join-btn");
 
joinBtn.addEventListener("click", () => {
  const username = usernameInput.value.trim();
  if (!username) return alert("Please enter a username");
 
  currentRoom = roomSelect.value;
  socket.emit("join", { username, room: currentRoom });
 
  joinScreen.classList.add("hidden");
  chatScreen.classList.remove("hidden");
  document.getElementById("chat-header").textContent = "Room: " + currentRoom;
});

//sending & receiving room messages
const messagesDiv = document.getElementById("messages");
const messageForm = document.getElementById("message-form");
const messageInput = document.getElementById("message-input");
 
function addMessage({ user, text, time, mine }) {
  const div = document.createElement("div");
  div.className = "msg";
  div.innerHTML = `<div class="meta">${user} • ${time}</div><div>${text}</div>`;
  messagesDiv.appendChild(div);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}
 
function addSystemMessage(text) {
  const div = document.createElement("div");
  div.className = "system-msg";
  div.textContent = text;
  messagesDiv.appendChild(div);
}
 
messageForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (!text) return;
 
  if (privateTarget) {
    socket.emit("privateMessage", { toSocketId: privateTarget.id, text });
  } else {
    socket.emit("roomMessage", { room: currentRoom, text });
  }
  messageInput.value = "";
  socket.emit("stopTyping", { room: currentRoom });
});
 
// server sends this back to EVERYONE in the room, including us
socket.on("roomMessage", (msg) => addMessage(msg));
 
// server sends the last 100 messages when we first join
socket.on("chatHistory", (history) => {
  history.forEach((msg) => {
    if (msg.image) addImageMessage(msg); else addMessage(msg);
  });
});
 
socket.on("systemMessage", (text) => addSystemMessage(text));

//private messages
// clicking a user in the sidebar opens a private chat with them
function openPrivateChat(user) {
  privateTarget = user;
  document.getElementById("chat-header").textContent = "Private chat with " + user.username;
  messagesDiv.innerHTML = "";
}
 
// a small button in the sidebar lets the user go back to the room
// (add this inside renderUserList in Part 4 — see note below)
 
socket.on("privateMessage", (msg) => {
  addMessage({ user: msg.from, text: msg.text, time: msg.time });
});

//online users list (user presence)
const userList = document.getElementById("user-list");
 
socket.on("onlineUsers", (users) => {
  userList.innerHTML = "";
  users.forEach((u) => {
    const li = document.createElement("li");
    li.textContent = u.username + (u.room === currentRoom ? " (this room)" : "");
    li.addEventListener("click", () => {
      // find this user's socket id from the users array sent by server
      openPrivateChat({ id: u.id, username: u.username });
    });
    userList.appendChild(li);
  });
});

//typing indicator
const typingDiv = document.getElementById("typing-indicator");
let typingTimeout;
 
messageInput.addEventListener("input", () => {
  if (privateTarget) return; // keep it simple: typing indicator for rooms only
  socket.emit("typing", { room: currentRoom });
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    socket.emit("stopTyping", { room: currentRoom });
  }, 1000);
});
 
socket.on("typing", (username) => {
  typingDiv.textContent = username + " is typing...";
});
socket.on("stopTyping", () => {
  typingDiv.textContent = "";
});

//image sharing
const imageInput = document.getElementById("image-input");
 
function addImageMessage({ user, image, time }) {
  const div = document.createElement("div");
  div.className = "msg";
  div.innerHTML = `<div class="meta">${user} • ${time}</div><img src="${image}" />`;
  messagesDiv.appendChild(div);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}
 
imageInput.addEventListener("change", () => {
  const file = imageInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    socket.emit("roomImage", { room: currentRoom, dataUrl: reader.result });
  };
  reader.readAsDataURL(file);
  imageInput.value = "";
});
 
socket.on("roomImage", (msg) => addImageMessage(msg));

