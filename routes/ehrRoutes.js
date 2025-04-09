const express = require('express');
const router = express.Router();
const ehrController = require('../controllers/ehrController');
const auth = require('../middleware/auth');

// === DOCTOR ROUTES ===
// Create a health record (Doctor only)
router.post(
  '/create',
  auth.verifyToken,
  auth.restrictTo('doctor'),
  ehrController.createRecord
);

// View a single health record (Doctor or Patient)
router.get(
  '/record/:patientId',
  auth.verifyToken,
  ehrController.queryRecord // middleware will check role and ownership
);

// View all patient records (Doctor only)
router.get(
  '/queryAll',
  auth.verifyToken,
  auth.restrictTo('doctor'),
  ehrController.queryAllRecords
);

// Update a health record (Doctor only)
router.put(
  '/update',
  auth.verifyToken,
  auth.restrictTo('doctor'),
  ehrController.updateRecord
);

// === ADMIN ROUTES ===
// Add a doctor (Admin only)
router.post(
  '/doctor/add',
  auth.verifyToken,
  auth.restrictTo('admin'),
  ehrController.addDoctor
);

// Delete a doctor (Admin only)
router.delete(
  '/doctor/delete/:doctorId',
  auth.verifyToken,
  auth.restrictTo('admin'),
  ehrController.deleteDoctor
);

// Delete a patient record (Admin only)
router.delete(
  '/patient/delete/:patientId',
  auth.verifyToken,
  auth.restrictTo('admin'),
  ehrController.deleteRecord
);

module.exports = router;