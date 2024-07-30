import express from 'express';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Server } from 'socket.io';
import fs from 'fs';
import { rm } from 'fs/promises'; // Import rm from fs/promises for directory deletion
import { configDotenv } from 'dotenv';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 1e8, // 100 MB
  connectionStateRecovery: {}
});

const PORT = process.env.PORT || 3000;

configDotenv();

const __dirname = dirname(fileURLToPath(import.meta.url));

// Ensure the uploads directory exists
const uploadsDir = join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Serve static files from the 'views' directory
app.use(express.static(join(__dirname, 'views')));
app.use('/uploads', express.static(uploadsDir));

// Serve the index.html form enter in a room with username
app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'views', 'index.html'));
});
// Serve the home.html file for any room and user
app.get('/:roomId/:userId', (req, res) => {
  res.sendFile(join(__dirname, 'views', 'home.html'));
});

const users = {}; // Store users by roomId

io.on('connection', (socket) => {
  console.log('User connected');

  // Join the room specified by the client
  socket.on('join room', (roomId, userId, callback) => {
    console.log(`User ${userId} attempting to join room: ${roomId}`);
    
    // Check if username is already taken
    if (users[roomId] && users[roomId].includes(userId)) {
      callback({ status: 'error', message: 'Username already taken' });
      return;
    }

    socket.join(roomId);

    // Add user to the room
    if (!users[roomId]) {
      users[roomId] = [];
    }
    users[roomId].push(userId);

    // Store the user's room and userId in the socket object for easy reference on disconnect
    socket.roomId = roomId;
    socket.userId = userId;

    // Notify the room of the new connection
    io.to(roomId).emit('notifications', `${userId} has joined the room`);
    io.to(roomId).emit('update users', users[roomId]); // Send the updated user list

    callback({ status: 'success' });
  });

  // Handle chat messages
  socket.on('chat message', (msg, roomId, userId) => {
    console.log(`Message received from ${userId} in room ${roomId}: ${msg}`);
    io.to(roomId).emit('chat message', `${userId}: ${msg}`);
  });

  // Handle file uploads
  socket.on('upload', ({ fileName, fileData }, roomId, userId, callback) => {
    console.log("upload from js start")
    // Create a directory for the room if it doesn't exist
    const roomDir = join(uploadsDir, roomId);
    if (!fs.existsSync(roomDir)) {
      fs.mkdirSync(roomDir);
    }

    // Generate unique filename based on current date and random number
    const fileExt = fileName.split('.').pop(); // Get file extension
    const randomDigits = Math.floor(Math.random() * 1000).toString().padStart(3, '0'); // Generate 3-digit random number
    const currentDate = new Date().toISOString().replace(/[-:]/g, '').replace('T', '').split('.')[0]; // Format current date
    const newFileName = `${currentDate}-${randomDigits}-${fileName}`; // Construct new filename

    const filePath = join(roomDir, newFileName);
    fs.writeFile(filePath, Buffer.from(fileData), (err) => {
      if (err) {
        console.error(err);
        callback('File upload failed');
        return;
      }
      const fileUrl = `/uploads/${roomId}/${newFileName}`;
      io.to(roomId).emit('file upload', { userId, fileName: newFileName, fileUrl }); // Emit new filename
      callback('File upload successful');
    });
    console.log("upload from js end")

  });

  // Handle disconnection
  socket.on('disconnect', async () => {
    if (socket.roomId && socket.userId) {
      const { roomId, userId } = socket;
      console.log(`User ${userId} disconnected from room ${roomId}`);
      
      // Remove user from the room
      if (users[roomId]) {
        users[roomId] = users[roomId].filter(user => user !== userId);
        if (users[roomId].length === 0) {
          delete users[roomId];
          // Delete the room directory if it exists
          const roomDir = join(uploadsDir, roomId);
          if (fs.existsSync(roomDir)) {
            try {
              await rm(roomDir, { recursive: true, force: true });
              console.log(`Directory ${roomDir} deleted successfully`);
            } catch (err) {
              console.error(`Failed to delete directory ${roomDir}: ${err}`);
            }
          }
        } else {
          io.to(roomId).emit('notifications', `${userId} has left the room`);
          io.to(roomId).emit('update users', users[roomId]); // Send the updated user list
        }
      }
    }
  });
});

server.listen(PORT, () => {
  console.log('Server running at http://localhost:3000');
});
