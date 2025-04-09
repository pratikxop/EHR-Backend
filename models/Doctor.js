const mongoose = require('mongoose');

const doctorSchema = new mongoose.Schema({
  doctorId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phoneNumber: { type: String, required: true },
  department: { type: String, required: true },
  specialization: { type: String, required: true },
  experience: { type: String, required: true },
  password: { type: String, required: true }, // ✅ Added password field
});

module.exports = mongoose.model('Doctor', doctorSchema);
