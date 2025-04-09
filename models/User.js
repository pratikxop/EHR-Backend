const bcrypt = require('bcrypt');

const users = [
  {
    role: 'admin',
    username: 'admin',
    password: 'admin123'
  },
  {
    role: 'doctor',
    email: 'doctor@example.com',
    password: bcrypt.hashSync('doctor123', 10)
  },
  {
    role: 'patient',
    patientId: 'P001',
    name: 'Rajesh Kumar Sharma'
  }
];

// Optional MongoDB setup for future
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  role: { type: String, enum: ['admin', 'doctor', 'patient'], required: true },
  username: String,
  email: String,
  password: String,
  patientId: String,
  name: String
});

module.exports = mongoose.model('User', userSchema);

module.exports = users;
