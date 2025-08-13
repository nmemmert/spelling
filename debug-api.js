// Debug script to test the /getUsers endpoint
const http = require('http');

console.log('Testing /getUsers endpoint...');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/getUsers',
  method: 'GET',
  headers: {
    'Accept': 'application/json'
  }
};

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
  
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Response body length:', data.length);
    
    try {
      if (data.length > 0) {
        const users = JSON.parse(data);
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
      console.log('Raw response:', data.substring(0, 100) + (data.length > 100 ? '...' : ''));
    }
    
    process.exit(0); // Exit successfully
  });
});

req.on('error', (e) => {
  console.error(`❌ ERROR: ${e.message}`);
  process.exit(1); // Exit with error
});

req.end();
