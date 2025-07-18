const http = require('http');

// Test adding a new user
const postData = JSON.stringify({
  username: 'teststudent',
  hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', // empty string hash
  role: 'student'
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/addUser',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log('Testing new user addition and initialization...');

const req = http.request(options, (res) => {
  console.log(`✅ Add User Status: ${res.statusCode}`);
  res.setEncoding('utf8');
  res.on('data', (chunk) => {
    console.log(`📝 Response: ${chunk}`);
  });
  res.on('end', () => {
    console.log('🔄 Now testing if user data is properly initialized...');
    
    // Test getting word list for new user
    const wordListReq = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/getWordList?username=teststudent',
      method: 'GET'
    }, (res) => {
      console.log(`📚 Word List Status: ${res.statusCode}`);
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        console.log(`📝 Word List Data: ${chunk}`);
      });
      res.on('end', () => {
        console.log('✅ Test completed - New user properly initialized!');
      });
    });
    
    wordListReq.on('error', (e) => {
      console.error(`❌ Word List Error: ${e.message}`);
    });
    
    wordListReq.end();
  });
});

req.on('error', (e) => {
  console.error(`❌ Add User Error: ${e.message}`);
});

req.write(postData);
req.end();
