// Debug utility to check if users.json exists
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const SEED_DIR = path.join(__dirname, 'seed');
const usersFile = path.join(DATA_DIR, 'users.json');

console.log('Checking for users.json file...');
console.log(`DATA_DIR: ${DATA_DIR}`);

// Check if data directory exists
if (fs.existsSync(DATA_DIR)) {
    console.log('✅ Data directory exists');
} else {
    console.log('❌ Data directory does not exist!');
    console.log('Creating data directory...');
    fs.mkdirSync(DATA_DIR);
}

// Check if users.json exists
if (fs.existsSync(usersFile)) {
    console.log('✅ users.json exists');
    
    // Read file and check content
    try {
        const content = fs.readFileSync(usersFile, 'utf-8');
        console.log('File content length:', content.length);
        
        try {
            const users = JSON.parse(content);
            console.log('✅ users.json contains valid JSON');
            console.log(`Found ${users.length} users:`, users.map(u => u.username));
        } catch (e) {
            console.log('❌ users.json contains invalid JSON:', e.message);
            console.log('File content:', content);
        }
    } catch (e) {
        console.log('❌ Could not read users.json:', e.message);
    }
} else {
    console.log('❌ users.json does not exist!');
    
    // Check if seed exists
    const seedFile = path.join(SEED_DIR, 'users.json');
    if (fs.existsSync(seedFile)) {
        console.log('✅ Seed users.json exists');
        
        try {
            const content = fs.readFileSync(seedFile, 'utf-8');
            console.log('Copying seed to data directory...');
            fs.writeFileSync(usersFile, content);
            console.log('✅ Seed copied to data directory');
        } catch (e) {
            console.log('❌ Could not copy seed users.json:', e.message);
        }
    } else {
        console.log('❌ Seed users.json does not exist!');
        
        // Create default users
        const defaultUsers = [
            {
                "username": "admin1",
                "hash": "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8", // password
                "role": "admin"
            },
            {
                "username": "nate",
                "hash": "5a2a558c78d3717db731600c4f354fa1d9c84b556f108091a891f444f1bdec40", // nate123
                "role": "student"
            },
            {
                "username": "student1",
                "hash": "8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92", // 123456
                "role": "student"
            }
        ];
        
        console.log('Creating default users.json...');
        fs.writeFileSync(usersFile, JSON.stringify(defaultUsers, null, 2));
        console.log('✅ Default users.json created');
    }
}
