const http = require('http');

// Create a new user with a timestamp to avoid conflicts
const username = `testuser_${Date.now()}`;
const postData = JSON.stringify({
  username: username,
  hash: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8', // "password"
  role: 'student'
});

console.log(`🧪 Testing addUser with username: ${username}`);

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/addUser',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = http.request(options, (res) => {
  console.log(`🔍 Response Status: ${res.statusCode}`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    if (res.statusCode === 200) {
      console.log(`✅ Success: ${data}`);
    } else {
      console.log(`❌ Error: ${data}`);
    }
    
    // Now try to verify the user was created by calling getUsers
    verifyUserCreated(username);
  });
});

req.on('error', (e) => {
  console.error(`🔴 Request Error: ${e.message}`);
});

// Write data to request body
req.write(postData);
req.end();

function verifyUserCreated(username) {
  const verifyOptions = {
    hostname: 'localhost',
    port: 3001,
    path: '/getUsers',
    method: 'GET'
  };
  
  const verifyReq = http.request(verifyOptions, (res) => {
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
        const users = JSON.parse(data);
        const foundUser = users.find(u => u.username === username);
        
        if (foundUser) {
          console.log(`✅ User ${username} was successfully created and verified`);
        } else {
          console.log(`❌ User ${username} was not found in the users list`);
          console.log(`📋 Current users: ${users.map(u => u.username).join(', ')}`);
        }
        
        process.exit(0);
      } catch (e) {
        console.error(`🔴 Error parsing users response: ${e.message}`);
        process.exit(1);
      }
    });
  });
  
  verifyReq.on('error', (e) => {
    console.error(`🔴 Verification Error: ${e.message}`);
    process.exit(1);
  });
  
  verifyReq.end();
}
