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

app.use(cors());
app.use(express.json());

const server = http.createServer(app);

// MongoDB bağlantısı
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ Successfully connected to MongoDB!"))
    .catch((err) => console.error("❌ MongoDB connection error:", err));

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// WebSocket bağlantısı
io.on("connection", (socket) => {
    console.log("🔗 New user connected:", socket.id);

    // Kullanıcı bir dokümana katıldığında
    socket.on("join-document", async ({ documentId, username }) => {
        if (!username) {
            socket.emit("error", "Username is required!");
            return;
        }

        socket.join(documentId); // Kullanıcıyı belirli bir dokümana bağla
        console.log(`📄 User (${username}) joined the document.`);

        // Dokümanı bul ve içeriğini gönder
        const document = await Document.findOne({ documentId });
        if (document) {
            socket.emit("load-document", document.content); // Veriyi yolla
        } else {
            // Doküman yoksa yeni bir doküman oluştur
            await Document.create({ documentId, content: "", changes: [] });
            socket.emit("load-document", "");
        }
    });

    // Belirli bir doküman üzerinde değişiklik yapıldığında
    socket.on("edit-document", async ({ documentId, content, username }) => {
        if (!username || !content.trim()) return;

        const timestamp = Date.now();

        const newEdit = {
            username,
            content,
            timestamp
        };

        let document = await Document.findOne({ documentId });

        // Eğer doküman mevcutsa, değişiklikleri ekleyin
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
            document.changes.sort((a, b) => a.timestamp - b.timestamp); // Zaman sırasına göre sırala
            document.content = document.changes.map(edit => edit.content).join("\n");

            await document.save(); // Değişiklikleri kaydet
        }

        // Diğer cihazları bu değişikliklerle güncelle
        socket.to(documentId).emit("update-document", document.content);
    });
});

// API Routes
app.use("/documents", documentRoutes);

// Backend portu üzerinden servisi başlatıyoruz
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server is running on port ${PORT}`));

// React frontend dosyalarını statik olarak sunuyoruz
app.use(express.static(path.join(__dirname, 'collaborative-editor-frontend/build')));

// Herhangi bir sayfaya erişim sağlandığında index.html dosyasını gönderiyoruz
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'collaborative-editor-frontend/build', 'index.html'));
});
