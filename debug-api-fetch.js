// Debug script to test the /getUsers endpoint
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

(async () => {
  try {
    console.log('Testing /getUsers endpoint...');
    
    const response = await fetch('http://localhost:3000/getUsers');
    console.log(`STATUS: ${response.status} ${response.statusText}`);
    
    const headers = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });
    console.log('HEADERS:', headers);
    
    if (!response.ok) {
      console.error(`⚠️ API responded with ${response.status}`);
      return;
    }
    
    const text = await response.text();
    console.log('Response body length:', text.length);
    
    try {
      if (text.length > 0) {
        const users = JSON.parse(text);
        console.log('✅ Response contains valid JSON');
        if (Array.isArray(users)) {
          console.log(`Found ${users.length} users:`, users.map(u => u.username));
          
          if (users.length === 0) {
            console.log('⚠️ WARNING: No users returned from API');
          }
        } else {
          console.log('⚠️ Response is not an array:', users);
        }
      } else {
        console.log('⚠️ Empty response received');
      }
    } catch (e) {
      console.error('❌ ERROR: Invalid JSON in response:', e.message);
      console.log('Raw response:', text.substring(0, 100) + (text.length > 100 ? '...' : ''));
    }
  } catch (error) {
    console.error(`❌ ERROR: ${error.message}`);
  }
})();
