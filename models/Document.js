const mongoose = require("mongoose");

const DocumentSchema = new mongoose.Schema({
    documentId: String,
    content: String,
    lastModified: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Document", DocumentSchema);
