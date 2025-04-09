// routes/authRoutes.js

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Unified login route for all roles: Admin, Doctor, Patient
router.post('/login', authController.login);

module.exports = router;
