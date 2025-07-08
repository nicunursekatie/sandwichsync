// Debug script to check authentication
async function debugAuth() {
  console.log('=== DEBUGGING AUTHENTICATION ===');
  
  // Check current cookies
  console.log('Current cookies:', document.cookie);
  
  // Check auth status
  try {
    const authResponse = await fetch('/api/auth/user', {
      credentials: 'include'
    });
    console.log('Auth status:', authResponse.status);
    if (authResponse.ok) {
      const user = await authResponse.json();
      console.log('Authenticated user:', user);
    } else {
      console.log('Auth failed:', await authResponse.text());
    }
  } catch (error) {
    console.error('Auth check error:', error);
  }
  
  // Test conversations endpoint
  try {
    const convResponse = await fetch('/api/conversations', {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    console.log('Conversations status:', convResponse.status);
    console.log('Conversations headers:', Object.fromEntries(convResponse.headers.entries()));
    if (!convResponse.ok) {
      console.log('Conversations error:', await convResponse.text());
    } else {
      console.log('Conversations data:', await convResponse.json());
    }
  } catch (error) {
    console.error('Conversations error:', error);
  }
  
  // Check if we're on the right origin
  console.log('Current origin:', window.location.origin);
  console.log('Current href:', window.location.href);
}

// Run the debug
debugAuth();