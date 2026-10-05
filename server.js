const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
 
const app = express();
const server = http.createServer(app);
const io = new Server(server);
 
app.use(express.static(path.join(__dirname, "public")));

// username -> { id, room }
const users = {};
// roomName -> array of { user, text, time }
const chatHistory = {};
 
io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);
 
  socket.on("join", ({ username, room }) => {
    socket.username = username;
    socket.room = room;
    socket.join(room);
    users[socket.id] = { username, room };

    // send this user the existing chat history for the room
    socket.emit("chatHistory", chatHistory[room] || []);

    // tell everyone else in the room that someone joined
    socket.to(room).emit("systemMessage", `${username} joined the room`);

    // send the updated online-user list to everyone
    io.emit("onlineUsers", Object.values(users));
  });
 
  socket.on("roomMessage", ({ room, text }) => {
    const message = { user: socket.username, text, time: new Date().toLocaleTimeString() };
    if (!chatHistory[room]) chatHistory[room] = [];
    chatHistory[room].push(message);
    if (chatHistory[room].length > 100) chatHistory[room].shift();
    io.to(room).emit("roomMessage", message);
  });
 
  socket.on("privateMessage", ({ toSocketId, text }) => {
    const message = { from: socket.username, fromId: socket.id, text, time: new Date().toLocaleTimeString() };
    io.to(toSocketId).emit("privateMessage", message);
    socket.emit("privateMessage", message);
  });
 
  socket.on("typing", ({ room }) => socket.to(room).emit("typing", socket.username));
  socket.on("stopTyping", ({ room }) => socket.to(room).emit("stopTyping", socket.username));
 
  socket.on("roomImage", ({ room, dataUrl }) => {
    const message = { user: socket.username, image: dataUrl, time: new Date().toLocaleTimeString() };
    if (!chatHistory[room]) chatHistory[room] = [];
    chatHistory[room].push(message);
    io.to(room).emit("roomImage", message);
  });
 
  socket.on("disconnect", () => {
    const user = users[socket.id];
    if (user) {
      delete users[socket.id];
      socket.to(user.room).emit("systemMessage", `${user.username} left the room`);
      io.emit("onlineUsers", Object.values(users));
    }
  });
});
 
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
