// Very simple test to fetch from our own server
const http = require('http');

console.log('Testing server...');

try {
  // Simple HTTP GET request
  http.get('http://localhost:3000/', (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      console.log('Status:', res.statusCode);
      console.log('Response length:', data.length);
      console.log('Response preview:', data.substring(0, 100) + '...');
    });

  }).on('error', (err) => {
    console.error('Error connecting to server:', err.message);
  });
} catch (error) {
  console.error('Failed to make request:', error);
}
