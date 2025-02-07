const express = require("express");
const Document = require("../models/Document");

const router = express.Router();

// Belirli bir dökümanı getir
router.get("/:id", async (req, res) => {
    const document = await Document.findOne({ documentId: req.params.id });
    if (document) {
        res.json(document);
    } else {
        res.status(404).json({ error: "Document not found" });
    }
});

module.exports = router; 
