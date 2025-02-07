const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const cors = require("cors");
const { Server } = require("socket.io");
require("dotenv").config();

const Document = require("./models/Document");
const documentRoutes = require("./routes/documentRoutes");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("Successfully connected to MongoDB!"))
    .catch((err) => console.error(" MongoDB connection error:", err));

const io = new Server(server, {
    cors: {
        origin: "*",
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
    
        socket.to(documentId).emit("update-document", document.content);
    });
    
});

// API Routes
app.use("/documents", documentRoutes);

// Start the Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server is running: http://localhost:${PORT}`));

app.get("/", (req, res) => {
    res.send("Collaborative Text Editor Backend is running!");
});

app.post("/save-document", async (req, res) => {
    const { documentId, content, username } = req.body;

    if (!username) {
        return res.status(400).json({ error: "Username is required!" });
    }

    try {
        await Document.findOneAndUpdate(
            { documentId },
            { content, lastModified: new Date() },
            { upsert: true }
        );

        res.status(200).json({ message: `Saved by ${username}!` });
    } catch (error) {
        res.status(500).json({ error: " Error saving the document." });
    }
});

// Clear Conversation History API
app.delete("/clear-history", async (req, res) => {
    try {
        await Document.deleteMany({});
        res.status(200).json({ message: "Conversation history cleared!" });
    } catch (error) {
        res.status(500).json({ error: " Error clearing history." });
    }
});
