// Debug script to check password hashes
const { createHash } = require('crypto');

function hashPassword(password) {
  return createHash('sha256').update(password).digest('hex');
}

console.log('Testing password hashes:');
console.log('password -> ', hashPassword('password'));
console.log('123456 -> ', hashPassword('123456'));
console.log('test -> ', hashPassword('test'));

// Known hashes from users.json:
console.log('\nExpected hashes from users.json:');
console.log('admin1 (password): 5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8');
console.log('student1 (123456): 8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92');
console.log('nate: 5a2a558c78d3717db731600c4f354fa1d9c84b556f108091a891f444f1bdec40');
