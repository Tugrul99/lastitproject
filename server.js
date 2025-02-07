// server.js
const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const { Server } = require('socket.io');
require('dotenv').config();
const path = require('path');

const Document = require('./models/Document');
const documentRoutes = require('./routes/documentRoutes');

const app = express();

// CORS ayarları
const allowedOrigins = [
  'http://localhost:3000',              // Lokal geliştirme
  'https://lastitproject.onrender.com'   // Render üzerindeki frontend URL'si
];

app.use(cors({
  origin: function(origin, callback) {
    // Origin olmayan istekler (örneğin Postman) için izin ver
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    } else {
      return callback(new Error('CORS error: Not allowed by CORS policy'));
    }
  }
}));

app.use(express.json());

// React frontend dosyalarını statik sunma (build edilmiş klasör)
app.use(express.static(path.join(__dirname, 'collaborative-editor-frontend/build')));

const server = http.createServer(app);

// MongoDB bağlantısı
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Successfully connected to MongoDB!"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

const io = new Server(server, {
  cors: {
    origin: "*",  // Tüm frontend bağlantılarına izin
    methods: ["GET", "POST"]
  }
});

// WebSocket bağlantıları
io.on("connection", (socket) => {
  console.log("🔗 New user connected:", socket.id);

  socket.on("join-document", async ({ documentId, username }) => {
    if (!username) {
      socket.emit("error", "Username is required!");
      return;
    }

    socket.join(documentId);
    console.log(`📄 User (${username}) joined document ${documentId}.`);

    let document = await Document.findOne({ documentId });
    if (document) {
      socket.emit("load-document", document.content);
    } else {
      document = await Document.create({ documentId, content: "", changes: [] });
      socket.emit("load-document", document.content);
    }
  });

  socket.on("edit-document", async ({ documentId, content, username }) => {
    if (!username || !content.trim()) return;

    const timestamp = Date.now();

    const newEdit = {
      username,
      content,
      timestamp
    };

    let document = await Document.findOne({ documentId });

    if (!document) {
      document = await Document.create({
        documentId,
        changes: [newEdit],
        content
      });
    } else {
      if (!document.changes) {
        document.changes = [];
      }
      document.changes.push(newEdit);
      document.changes.sort((a, b) => a.timestamp - b.timestamp);
      document.content = document.changes.map(edit => edit.content).join("\n");
      await document.save();
    }

    // Diğer kullanıcılara güncellemeyi gönder
    socket.to(documentId).emit("update-document", document.content);
  });
});

// API Routes
app.use("/documents", documentRoutes);

// Diğer tüm GET isteklerini React index.html ile cevapla
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'collaborative-editor-frontend/build', 'index.html'));
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server is running on port ${PORT}`));
