const express = require('express');
const path = require('path');
const router = express.Router();

router.get('/', (req, res) => {
  // Serveer test UI voor development
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

module.exports = router;
