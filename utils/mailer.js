const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');

// Gmail SMTP Transport
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'ehrcgu@gmail.com',
    pass: 'mjndywxshjlafjzt' // 🔐 Use App Password from your Google account
  }
});

async function sendHealthRecordEmail({ email, name, subject, message, pdfBuffer, patientId }) {
  const pdfPath = path.join(__dirname, '../pdfs', `${patientId}.pdf`);

  // Save PDF to disk
  fs.writeFileSync(pdfPath, pdfBuffer);

  const mailOptions = {
    from: 'ehrcgu@gmail.com',
    to: email,
    subject: subject || 'Your Health Record',
    text: message || `Dear ${name},\n\nPlease find your health report attached.`,
    attachments: [
      {
        filename: `${patientId}.pdf`,
        path: pdfPath
      }
    ]
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`📧 Email sent to ${email}`);
  } catch (error) {
    console.error(`❌ Email failed to send:`, error);
    throw error;
  }
}

module.exports = { sendHealthRecordEmail };
