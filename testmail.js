const nodemailer = require('nodemailer');

async function sendTestEmail() {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'ehrcgu@gmail.com',
      pass: 'mjndywxshjlafjzt'
    }
  });

  const mailOptions = {
    from: 'ehrcgu@gmail.com',
    to: 'pratiksngh1706@gmail.com',
    subject: 'Test Email',
    text: 'Hello from EHR system!'
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Sent:', info.response);
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

sendTestEmail();
