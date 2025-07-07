const fs = require('fs');
const path = require('path');

const resultsPath = path.join(__dirname, 'data', 'results.json');
const existingData = JSON.parse(fs.readFileSync(resultsPath));

for (const username in existingData) {
  const singleResult = existingData[username];
  existingData[username] = [{
    ...singleResult,
    timestamp: new Date().toISOString()
  }];
}

fs.writeFileSync(resultsPath, JSON.stringify(existingData, null, 2));
console.log("✅ Migration complete. Results are now session arrays.");