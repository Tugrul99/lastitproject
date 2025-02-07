// models/Document.js
const mongoose = require('mongoose');

const DocumentSchema = new mongoose.Schema({
  documentId: { type: String, required: true },
  content: { type: String, default: "" },
  changes: [{
    username: String,
    content: String,
    timestamp: Number
  }],
  lastModified: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Document', DocumentSchema);
