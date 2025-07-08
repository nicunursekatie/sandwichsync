// Test script to verify hosts API endpoint
async function testHostsAPI() {
  try {
    console.log('Testing /api/hosts-with-contacts endpoint...');
    
    const response = await fetch('http://localhost:5000/api/hosts-with-contacts', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include'
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', response.headers);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error response:', errorText);
    } else {
      const data = await response.json();
      console.log('Success! Hosts data:', JSON.stringify(data, null, 2));
      console.log('Number of hosts:', data.length);
    }
  } catch (error) {
    console.error('Network error:', error);
  }
}

// Run the test
testHostsAPI();