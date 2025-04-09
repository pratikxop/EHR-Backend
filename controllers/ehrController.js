require('dotenv').config();
const { getContract } = require('../config/fabricConnection');
const { sendHealthRecordEmail } = require('../utils/mailer');
const { generateHealthReport } = require('../utils/pdfGenerator');
const bcrypt = require('bcrypt');
const Doctor = require('../models/Doctor');
const twilio = require('twilio');

// Initialize Twilio client with error handling
let twilioClient;
try {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    throw new Error('Twilio credentials not configured in environment variables');
  }
  twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );
  console.log('Twilio client initialized successfully');
} catch (err) {
  console.error('❌ Twilio initialization error:', err.message);
  twilioClient = null;
}

// Enhanced SMS sender with validation
async function sendSMS(to, message, operation = 'notification') {
  if (!twilioClient) {
    console.warn('⚠️ SMS not sent - Twilio client not initialized');
    return false;
  }

  if (!to || !message) {
    console.warn('⚠️ SMS not sent - missing recipient or message');
    return false;
  }

  // Validate phone number format
  const formattedNumber = to.startsWith('+') ? to : `+${to.replace(/\D/g, '')}`;
  if (!formattedNumber.match(/^\+\d{10,15}$/)) {
    console.warn(`⚠️ Invalid phone number format: ${to}`);
    return false;
  }

  try {
    const response = await twilioClient.messages.create({
      body: `[EHR System] ${message}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: formattedNumber
    });
    
    console.log(`✓ SMS ${operation} sent to ${formattedNumber} (SID: ${response.sid})`);
    return true;
  } catch (err) {
    console.error(`❌ Failed to send SMS to ${formattedNumber}:`, err.message);
    return false;
  }
}

// Helper to disconnect from gateway
const disconnectGateway = async (gateway) => {
  try {
    if (gateway && typeof gateway.disconnect === 'function') {
      await gateway.disconnect();
    }
  } catch (e) {
    console.warn('⚠️ Failed to disconnect gateway:', e.message);
  }
};

// Create new health record
exports.createRecord = async (req, res) => {
  try {
    const {
      patientId, name, age, gender, email,
      phoneNumber, diagnosis, treatmentPlan, symptoms, medications, allergies, doctorName, doctorId
    } = req.body;

    // Validate required fields
    if (!patientId || !name || !phoneNumber) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const { contract, gateway } = await getContract();

    await contract.submitTransaction(
      'CreateHealthRecord',
      patientId,
      name,
      String(age),
      gender,
      email,
      phoneNumber,
      diagnosis,
      treatmentPlan,
      symptoms,
      medications,
      allergies,
      doctorName,
      doctorId
    );
    await disconnectGateway(gateway);

    // Generate PDF report
    const recordData = {
      patientId, name, age, gender, email,
      phoneNumber, diagnosis, treatmentPlan, symptoms, medications, allergies, doctorName, doctorId
    };
    const pdfBuffer = await generateHealthReport(recordData);

    // Send notifications
    const notifications = {
      email: false,
      sms: false
    };

    try {
      await sendHealthRecordEmail({
        email,
        name,
        patientId,
        subject: 'New Health Record Created',
        message: `Hello ${name},\n\nYour new health record has been created successfully.\n\nPatient ID: ${patientId}\nDoctor: ${doctorName}\n\nBest regards,\nEHR System`,
        pdfBuffer
      });
      notifications.email = true;
    } catch (emailError) {
      console.error('❌ Email sending failed:', emailError.message);
    }

    notifications.sms = await sendSMS(
      phoneNumber,
      `Hi ${name}, your health record was created. ID: ${patientId}. Doctor: ${doctorName}`,
      'record_creation'
    );

    res.status(201).json({ 
      message: 'Health record created successfully',
      patientId,
      notifications
    });

  } catch (err) {
    console.error('❌ Error creating record:', err.message);
    res.status(500).json({ 
      error: 'Failed to create health record',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Query health record by patient ID
exports.queryRecord = async (req, res) => {
  try {
    const { patientId } = req.params;
    if (!patientId) {
      return res.status(400).json({ error: 'Patient ID is required' });
    }

    const { contract, gateway } = await getContract();
    const result = await contract.evaluateTransaction('QueryHealthRecord', patientId);
    const record = JSON.parse(result.toString());
    await disconnectGateway(gateway);

    if (!record) {
      return res.status(404).json({ error: 'Record not found' });
    }

    // Send access notification if record exists
    const viewer = req.user?.name || 'System';
    await sendSMS(
      record.phoneNumber,
      `Your record (ID: ${patientId}) was accessed by ${viewer} on ${new Date().toLocaleString()}`,
      'record_access'
    );

    res.json({
      ...record,
      lastAccessed: new Date().toISOString(),
      accessedBy: viewer
    });

  } catch (err) {
    console.error('❌ Error querying record:', err.message);
    res.status(500).json({ 
      error: 'Failed to retrieve health record',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Query all health records
exports.queryAllRecords = async (req, res) => {
  try {
    const { contract, gateway } = await getContract();
    const result = await contract.evaluateTransaction('QueryAllHealthRecords');
    await disconnectGateway(gateway);

    const records = JSON.parse(result.toString());
    res.json({
      count: records.length,
      records,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('❌ Error querying all records:', err.message);
    res.status(500).json({ 
      error: 'Failed to retrieve records',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Update a health record
exports.updateRecord = async (req, res) => {
  try {
    const { patientId, diagnosis, treatmentPlan, symptoms, medications, allergies, doctorName, doctorId } = req.body;
    
    if (!patientId) {
      return res.status(400).json({ error: 'Patient ID is required' });
    }

    const { contract, gateway } = await getContract();

    // First get current record to compare changes
    const currentResult = await contract.evaluateTransaction('QueryHealthRecord', patientId);
    const currentRecord = JSON.parse(currentResult.toString());

    await contract.submitTransaction(
      'UpdateHealthRecord',
      patientId,
      diagnosis || currentRecord.diagnosis,
      treatmentPlan || currentRecord.treatmentPlan,
      symptoms || currentRecord.symptoms,
      medications || currentRecord.medications,
      allergies || currentRecord.allergies,
      doctorName || currentRecord.doctorName,
      doctorId || currentRecord.doctorId
    );

    const updatedResult = await contract.evaluateTransaction('QueryHealthRecord', patientId);
    const updatedRecord = JSON.parse(updatedResult.toString());
    await disconnectGateway(gateway);

    // Generate updated PDF
    const pdfBuffer = await generateHealthReport(updatedRecord);

    // Send notifications
    const notifications = {
      email: false,
      sms: false
    };

    try {
      await sendHealthRecordEmail({
        email: updatedRecord.email,
        name: updatedRecord.name,
        patientId: updatedRecord.patientId,
        subject: 'Health Record Updated',
        message: `Hi ${updatedRecord.name},\n\nYour health record was updated by ${doctorName}.\n\nChanges made:\n${getChangeSummary(currentRecord, updatedRecord)}\n\nRegards,\nEHR System`,
        pdfBuffer
      });
      notifications.email = true;
    } catch (emailError) {
      console.error('❌ Email sending failed:', emailError.message);
    }

    const changes = getChangeSummary(currentRecord, updatedRecord);
    notifications.sms = await sendSMS(
      updatedRecord.phoneNumber,
      `Your record was updated by Dr. ${doctorName}. Changes: ${changes}`,
      'record_update'
    );

    res.json({ 
      message: 'Health record updated successfully',
      patientId,
      changes,
      notifications
    });

  } catch (err) {
    console.error('❌ Error updating record:', err.message);
    res.status(500).json({ 
      error: 'Failed to update health record',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Helper function to detect changes between records
function getChangeSummary(before, after) {
  const changes = [];
  const fields = ['diagnosis', 'treatmentPlan', 'symptoms', 'medications', 'allergies'];
  
  fields.forEach(field => {
    if (before[field] !== after[field]) {
      changes.push(field);
    }
  });

  return changes.length > 0 ? changes.join(', ') : 'Minor updates';
}

// Delete health record
exports.deleteRecord = async (req, res) => {
  try {
    const { patientId } = req.params;
    if (!patientId) {
      return res.status(400).json({ error: 'Patient ID is required' });
    }

    const { contract, gateway } = await getContract();
    
    // Get record before deletion for notification
    const currentResult = await contract.evaluateTransaction('QueryHealthRecord', patientId);
    const currentRecord = JSON.parse(currentResult.toString());

    await contract.submitTransaction('DeleteHealthRecord', patientId);
    await disconnectGateway(gateway);

    // Send deletion notification
    if (currentRecord) {
      await sendSMS(
        currentRecord.phoneNumber,
        `Your health record (ID: ${patientId}) has been deleted from our system`,
        'record_deletion'
      );
    }

    res.json({ 
      message: 'Health record deleted successfully',
      patientId,
      deletionTime: new Date().toISOString()
    });

  } catch (err) {
    console.error('❌ Error deleting record:', err.message);
    res.status(500).json({ 
      error: 'Failed to delete health record',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Admin: Add new doctor
exports.addDoctor = async (req, res) => {
  try {
    const {
      doctorId, name, email, phoneNumber,
      department, specialization, experience, password
    } = req.body;

    // Validation
    if (!doctorId || !name || !email || !password) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const existing = await Doctor.findOne({ $or: [{ doctorId }, { email }] });
    if (existing) {
      return res.status(400).json({ 
        message: existing.doctorId === doctorId ? 
          'Doctor ID already exists' : 'Email already registered'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newDoctor = new Doctor({
      doctorId,
      name,
      email,
      phoneNumber,
      department,
      specialization,
      experience,
      password: hashedPassword,
      createdAt: new Date()
    });

    await newDoctor.save();

    // Send welcome SMS if phone number provided
    if (phoneNumber) {
      await sendSMS(
        phoneNumber,
        `Dr. ${name}, your EHR system account is ready. ID: ${doctorId}`,
        'doctor_welcome'
      );
    }

    res.status(201).json({
      message: 'Doctor added successfully',
      doctor: {
        doctorId: newDoctor.doctorId,
        name: newDoctor.name,
        email: newDoctor.email,
        department: newDoctor.department
      }
    });

  } catch (err) {
    console.error('❌ Error adding doctor:', err.message);
    res.status(500).json({ message: 'Failed to add doctor' });
  }
};

// Doctor: Delete self by ID
exports.deleteDoctor = async (req, res) => {
  try {
    const { doctorId } = req.params;
    if (!doctorId) {
      return res.status(400).json({ message: 'Doctor ID is required' });
    }

    const deleted = await Doctor.findOneAndDelete({ doctorId });
    if (!deleted) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    // Send goodbye SMS if phone number exists
    if (deleted.phoneNumber) {
      await sendSMS(
        deleted.phoneNumber,
        `Dr. ${deleted.name}, your EHR system account has been deleted`,
        'doctor_goodbye'
      );
    }

    res.json({ 
      message: 'Doctor deleted successfully',
      doctorId,
      name: deleted.name
    });

  } catch (err) {
    console.error('❌ Error deleting doctor:', err.message);
    res.status(500).json({ message: 'Failed to delete doctor' });
  }
};