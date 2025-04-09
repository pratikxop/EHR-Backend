const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { Gateway, Wallets } = require('fabric-network');
const path = require('path');
const fs = require('fs');
const Doctor = require('../models/Doctor'); // Make sure the path is correct

// Hyperledger Fabric connection profile
const ccpPath = path.resolve(
  __dirname,
  '/home/xop/fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/connection-org1.json'
);
const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

exports.login = async (req, res) => {
  const { role, username, password, email, patientId, name } = req.body;

  // 🧑‍💼 Admin authentication (hardcoded)
  if (role === 'admin') {
    if (username === 'admin' && password === 'admin123') {
      const token = jwt.sign({ role: 'admin', username }, 'secretKey');
      return res.json({ token });
    }
    return res.status(401).json({ message: 'Invalid admin credentials' });
  }

  // 🩺 Doctor authentication (from MongoDB)
  if (role === 'doctor') {
    try {
      const doctor = await Doctor.findOne({ email });
  
      if (!doctor) {
        return res.status(401).json({ message: 'Doctor not found' });
      }
  
      const isMatch = await bcrypt.compare(password, doctor.password);
      if (!isMatch) {
        return res.status(401).json({ message: 'Invalid doctor credentials' });
      }
  
      const token = jwt.sign(
        {
          role: 'doctor',
          doctorId: doctor.doctorId,
          email: doctor.email,
          name: doctor.name,
        },
        'secretKey',
        { expiresIn: '2h' } // optional: set token expiry
      );
  
      return res.status(200).json({ token });
    } catch (err) {
      console.error('❌ MongoDB error during doctor login:', err.message);
      return res.status(500).json({ message: 'Server error during doctor login' });
    }
  }
  

  // 🧑‍⚕️ Patient authentication (via Hyperledger Fabric)
  if (role === 'patient') {
    try {
      console.log('🔐 Attempting patient login:', patientId, name);

      const walletPath = path.join(process.cwd(), 'wallet');
      const wallet = await Wallets.newFileSystemWallet(walletPath);

      const gateway = new Gateway();
      await gateway.connect(ccp, {
        wallet,
        identity: 'user1',
        discovery: { enabled: true, asLocalhost: true },
      });

      const network = await gateway.getNetwork('ehrchannel');
      const contract = network.getContract('ehr-go');

      const result = await contract.evaluateTransaction('QueryHealthRecord', patientId);
      console.log('📦 Fetched record:', result.toString());

      const record = JSON.parse(result.toString());
      await gateway.disconnect();

      if (record.name.trim().toLowerCase() === name.trim().toLowerCase()) {
        const token = jwt.sign({ role: 'patient', patientId }, 'secretKey');
        return res.json({ token });
      } else {
        console.log('❌ Name mismatch:', record.name, 'vs', name);
        return res.status(401).json({ message: 'Name does not match records' });
      }

    } catch (err) {
      console.error('❌ Blockchain error during patient login:', err.message);
      return res.status(401).json({ message: 'Invalid patient credentials or not found' });
    }
  }

  // 🚫 Invalid Role
  res.status(400).json({ message: 'Invalid role or credentials' });
};
