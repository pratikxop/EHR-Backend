require('dotenv').config();
const twilio = require('twilio');

// Initialize Twilio client
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Function to send SMS
async function sendSMS(to, message) {
  try {
    const response = await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: to
    });
    
    console.log('Message sent successfully!');
    console.log('Message SID:', response.sid);
    return response;
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
}

// Example usage
(async () => {
  try {
    // Replace with the actual phone number you want to send to
    // Format should be E.164 (e.g., "+15551234567")
    const recipientNumber = '+917735030422'; 
    const messageText = 'Hello from Twilio! This is a test message.';
    
    await sendSMS(recipientNumber, messageText);
  } catch (error) {
    console.error('Error in example usage:', error);
  }
})();
