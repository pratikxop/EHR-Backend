const jwt = require('jsonwebtoken');

exports.generateToken = (payload) => {
  return jwt.sign(payload, 'secretKey', {
    expiresIn: '1d' // Set expiration as per your requirement
  });
};
