/**
 * Test script to verify the saveResults endpoint
 * Run with: node test-save-results.js
 */
const http = require('http');

console.log('🧪 Testing saveResults endpoint...');

// Create a test session
const testSession = {
  username: 'testuser',
  result: {
    score: 85,
    completed: true,
    answers: [
      { word: 'apple', correct: true },
      { word: 'banana', correct: true },
      { word: 'cherry', correct: true },
      { word: 'difficult', correct: false },
      { word: 'elephant', correct: true }
    ]
  }
};

// Function to make a POST request
function postRequest(data) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/saveResults',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(JSON.stringify(data))
      }
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        resolve({ 
          statusCode: res.statusCode,
          data: responseData
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(JSON.stringify(data));
    req.end();
  });
}

// Function to make a GET request
function getRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(responseData);
          resolve({ 
            statusCode: res.statusCode,
            data: jsonData
          });
        } catch (e) {
          resolve({ 
            statusCode: res.statusCode,
            data: responseData
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

// First check if server is running
function checkServerIsRunning() {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/',
      method: 'GET',
      timeout: 2000
    }, (res) => {
      resolve(true);
    });

    req.on('error', () => {
      resolve(false);
    });

    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

// Run the test
async function runTest() {
  // First verify the server is running
  console.log('🔍 Checking if the server is running...');
  const serverRunning = await checkServerIsRunning();
  
  if (!serverRunning) {
    console.error('❌ Server is not running at http://localhost:3000');
    console.log('🔧 Please make sure the server is running in a separate terminal with "node server.js"');
    return;
  }
  
  console.log('✅ Server is running');
  
  try {
    // Step 1: First just try to save a session
    console.log('\n1️⃣ Saving new session for testuser...');
    const saveResponse = await postRequest(testSession);
    
    if (saveResponse.statusCode !== 200) {
      throw new Error(`Failed to save results: Status ${saveResponse.statusCode}, Message: ${saveResponse.data}`);
    }
    
    console.log(`✅ Save response: ${saveResponse.data}`);
    
    // Step 2: Now check that we can retrieve the session
    console.log('\n2️⃣ Verifying session was saved...');
    const afterResponse = await getRequest('/getResults');
    
    if (afterResponse.statusCode !== 200) {
      throw new Error(`Failed to get results: Status ${afterResponse.statusCode}`);
    }
    
    const allUsers = Object.keys(afterResponse.data);
    console.log(`📊 Found data for ${allUsers.length} users: ${allUsers.join(', ')}`);
    
    const testUserSessions = afterResponse.data.testuser || [];
    console.log(`📊 Found ${testUserSessions.length} sessions for testuser`);
    
    if (testUserSessions.length > 0) {
      // Check the most recent session
      const latestSession = testUserSessions[testUserSessions.length - 1];
      console.log('\n📊 Latest session details:');
      console.log(`   Score: ${latestSession.score}`);
      console.log(`   Words: ${latestSession.answers ? latestSession.answers.length : 'N/A'}`);
      if (latestSession.timestamp) {
        console.log(`   Time: ${new Date(latestSession.timestamp).toLocaleString()}`);
      } else {
        console.log(`   Time: Not available`);
      }
    } else {
      console.log('❌ No sessions found for testuser!');
    }
    
    console.log('\n✅ Test completed successfully!');
    
  } catch (error) {
    console.error(`❌ Test failed: ${error.message}`);
  }
  
  console.log('\n📱 You can check the application to verify the new session appears in the UI.');
}

// Explicitly exit after a delay to avoid hanging
runTest().then(() => {
  console.log("\nPress Ctrl+C to exit or wait 5 seconds...");
  setTimeout(() => process.exit(0), 5000);
});
