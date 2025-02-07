const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const cors = require("cors");
const { Server } = require("socket.io");
require("dotenv").config();
const path = require("path");

const Document = require("./models/Document");
const documentRoutes = require("./routes/documentRoutes");

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || "*" })); 
app.use(express.json());

const server = http.createServer(app);

mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log("✅ Successfully connected to MongoDB!"))
.catch((err) => console.error("❌ MongoDB connection error:", err));

const io = new Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL || "*",
        methods: ["GET", "POST"]
    }
});

io.on("connection", (socket) => {
    console.log("🔗 New user connected:", socket.id);

    socket.on("join-document", async ({ documentId, username }) => {
        if (!username) {
            socket.emit("error", "Username is required!");
            return;
        }

        socket.join(documentId);
        console.log(`📄 User (${username}) joined the document.`);

        const document = await Document.findOne({ documentId });
        if (document) {
            socket.emit("load-document", document.content);
        } else {
            await Document.create({ documentId, content: "", changes: [] });
            socket.emit("load-document", "");
        }
    });

    socket.on("edit-document", async ({ documentId, content, username }) => {
        if (!username || !content.trim()) return;
    
        const timestamp = Date.now(); 
    
        const newEdit = { username, content, timestamp };
    
        let document = await Document.findOne({ documentId });
    
        if (!document) {
            document = await Document.create({
                documentId,
                changes: [newEdit],
                content
            });
        } else {
            document.changes.push(newEdit);
            document.changes.sort((a, b) => a.timestamp - b.timestamp); 
            document.content = document.changes.map(edit => edit.content).join("\n"); 
            await document.save();
        }
    
        socket.to(documentId).emit("update-document", document.content);
    });
});

// ✅ Frontend'i de aynı servisten sunuyoruz (Render için)
app.use(express.static(path.join(__dirname, "collaborative-editor-frontend/build")));

app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "collaborative-editor-frontend/build", "index.html"));
});

// Start the Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server is running on port ${PORT}`));
