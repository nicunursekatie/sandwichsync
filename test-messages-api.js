// Simple script to test the message API and see the actual data format
const fetch = require('node-fetch');

async function testMessagesAPI() {
  try {
    // Test without auth first to see the endpoint structure
    console.log('Testing messages API...\n');
    
    const response = await fetch('http://127.0.0.1:5000/api/messaging/test', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    console.log('Response status:', response.status);
    const data = await response.json();
    console.log('Response data:', JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testMessagesAPI();
