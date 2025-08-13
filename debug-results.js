/**
 * Debug utility to check the results.json file and report any issues
 * Run with: node debug-results.js
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const RESULTS_FILE = path.join(DATA_DIR, 'results.json');

console.log('🔍 Debug Results.json Utility');
console.log('============================');

// Check if the file exists
console.log(`\n1. Checking if results.json exists at: ${RESULTS_FILE}`);
if (fs.existsSync(RESULTS_FILE)) {
  console.log('✅ File exists');
  
  // Check file size
  const stats = fs.statSync(RESULTS_FILE);
  console.log(`📊 File size: ${stats.size} bytes`);
  
  // Check file permissions
  console.log(`📊 File permissions: ${(stats.mode & 0o777).toString(8)}`);
  
  // Try to read the file
  console.log('\n2. Attempting to read the file');
  try {
    const fileContent = fs.readFileSync(RESULTS_FILE, 'utf8');
    console.log(`✅ File read successfully (${fileContent.length} characters)`);
    
    // Check for empty file
    if (fileContent.trim() === '') {
      console.log('⚠️ Warning: File is empty');
      
      // Create a valid empty structure
      fs.writeFileSync(RESULTS_FILE, JSON.stringify({}, null, 2));
      console.log('✅ Created valid empty structure');
    } else {
      // Try to parse the JSON
      console.log('\n3. Attempting to parse JSON');
      try {
        const data = JSON.parse(fileContent);
        console.log('✅ JSON parsed successfully');
        
        // Check the structure
        if (typeof data !== 'object' || data === null) {
          console.log('❌ Error: Root is not an object');
        } else {
          const userCount = Object.keys(data).length;
          console.log(`📊 Contains data for ${userCount} users`);
          
          // Display some stats about each user's sessions
          Object.entries(data).forEach(([username, sessions]) => {
            if (!Array.isArray(sessions)) {
              console.log(`❌ Error: Sessions for ${username} is not an array`);
            } else {
              console.log(`📊 ${username}: ${sessions.length} sessions`);
            }
          });
        }
      } catch (parseError) {
        console.log(`❌ Error parsing JSON: ${parseError.message}`);
        
        // Try to identify the location of the error
        const errorMatch = parseError.message.match(/position (\d+)/);
        if (errorMatch && errorMatch[1]) {
          const position = parseInt(errorMatch[1]);
          const start = Math.max(0, position - 20);
          const end = Math.min(fileContent.length, position + 20);
          console.log(`Error near: ...${fileContent.substring(start, position)}[HERE]${fileContent.substring(position, end)}...`);
        }
        
        // If the file seems to be corrupted, offer to create a new one
        console.log('\nThe file appears to be corrupted. Do you want to reset it to a valid empty structure?');
        console.log('To reset, run: node -e "require(\'fs\').writeFileSync(\'./data/results.json\', JSON.stringify({}, null, 2))"');
      }
    }
  } catch (readError) {
    console.log(`❌ Error reading file: ${readError.message}`);
  }
} else {
  console.log('❌ File does not exist');
  
  // Create the file with a valid empty structure
  try {
    // Make sure the data directory exists
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      console.log(`✅ Created data directory at: ${DATA_DIR}`);
    }
    
    fs.writeFileSync(RESULTS_FILE, JSON.stringify({}, null, 2));
    console.log('✅ Created file with valid empty structure');
  } catch (createError) {
    console.log(`❌ Error creating file: ${createError.message}`);
  }
}

console.log('\nDone!');
