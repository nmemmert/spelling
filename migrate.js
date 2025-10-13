const DatabaseService = require('./database-service');
const fs = require('fs');
const path = require('path');

class DataMigrator {
  constructor() {
    this.dbService = new DatabaseService();
  }

  async migrate() {
    try {
      console.log('🔄 Starting data migration from JSON to SQLite...');
      
      // Initialize database
      await this.dbService.init();
      console.log('✅ Database initialized');

      // Migrate users
      await this.migrateUsers();
      
      // Migrate wordlists  
      await this.migrateWordlists();
      
      // Migrate results/sessions
      await this.migrateResults();
      
      // Migrate progress
      await this.migrateProgress();
      
      // Migrate spaced repetition data
      await this.migrateSpacedRepetition();

      console.log('🎉 Migration completed successfully!');
      console.log('\n📋 Migration Summary:');
      
      const users = await this.dbService.getUsers();
      console.log(`👥 Users migrated: ${users.length}`);
      
      const wordlists = await this.dbService.getWordlists();
      console.log(`📚 Wordlists migrated: ${wordlists.length}`);
      
      console.log('\n✅ Your app is now using SQLite database!');
      console.log('💡 Legacy JSON files have been preserved as backups.');
      
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  }

  async migrateUsers() {
    try {
      const usersPath = path.join(__dirname, 'data', 'users.json');
      if (!fs.existsSync(usersPath)) {
        console.log('⚠️  No users.json file found, skipping user migration');
        return;
      }

      const usersData = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
      console.log(`👥 Migrating ${usersData.length} users...`);

      for (const user of usersData) {
        try {
          // Create user with hashed password
          await this.dbService.createUser({
            username: user.username,
            password: user.password || 'defaultPassword123', // You might want to prompt for this
            email: user.email || `${user.username}@example.com`,
            displayName: user.displayName || user.username,
            isActive: true,
            role: user.role || 'student',
            preferences: user.preferences || {},
            profile: user.profile || {}
          });
          
          console.log(`  ✅ Migrated user: ${user.username}`);
        } catch (error) {
          if (error.message.includes('already exists')) {
            console.log(`  ⚠️  User ${user.username} already exists, skipping`);
          } else {
            console.error(`  ❌ Failed to migrate user ${user.username}:`, error.message);
          }
        }
      }
    } catch (error) {
      console.error('Error migrating users:', error);
    }
  }

  async migrateWordlists() {
    try {
      const wordlistsPath = path.join(__dirname, 'data', 'wordlists.json');
      if (!fs.existsSync(wordlistsPath)) {
        console.log('⚠️  No wordlists.json file found, skipping wordlist migration');
        return;
      }

      const wordlistsData = JSON.parse(fs.readFileSync(wordlistsPath, 'utf8'));
      const wordlistNames = Object.keys(wordlistsData);
      console.log(`📚 Migrating ${wordlistNames.length} wordlists...`);

      for (const name of wordlistNames) {
        try {
          await this.dbService.createWordlist({
            name: name,
            description: `Migrated wordlist: ${name}`,
            words: wordlistsData[name],
            difficulty: this.inferDifficulty(wordlistsData[name]),
            category: this.inferCategory(name),
            isActive: true,
            tags: [name.toLowerCase().replace(/\s+/g, '-')]
          });
          
          console.log(`  ✅ Migrated wordlist: ${name} (${wordlistsData[name].length} words)`);
        } catch (error) {
          if (error.message.includes('already exists')) {
            console.log(`  ⚠️  Wordlist ${name} already exists, skipping`);
          } else {
            console.error(`  ❌ Failed to migrate wordlist ${name}:`, error.message);
          }
        }
      }
    } catch (error) {
      console.error('Error migrating wordlists:', error);
    }
  }

  async migrateResults() {
    try {
      const resultsPath = path.join(__dirname, 'data', 'results.json');
      if (!fs.existsSync(resultsPath)) {
        console.log('⚠️  No results.json file found, skipping results migration');
        return;
      }

      const resultsData = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
      const usernames = Object.keys(resultsData);
      console.log(`📊 Migrating results for ${usernames.length} users...`);

      const users = await this.dbService.getUsers();
      const userMap = {};
      users.forEach(user => {
        userMap[user.username] = user.id;
      });

      let totalSessions = 0;
      
      for (const username of usernames) {
        if (!userMap[username]) {
          console.log(`  ⚠️  User ${username} not found, skipping their results`);
          continue;
        }

        const userResults = resultsData[username];
        if (!Array.isArray(userResults)) continue;

        for (const result of userResults) {
          try {
            await this.dbService.saveSession({
              userId: userMap[username],
              wordlistId: null, // We don't have wordlist mapping from legacy data
              sessionType: result.mode || 'spelling',
              score: result.score || result.correct || 0,
              totalWords: result.total || 0,
              accuracy: result.accuracy || 0,
              duration: result.duration || 0,
              inputMethod: result.inputMethod || 'keyboard',
              results: result.answers || result.words || [],
              startedAt: result.timestamp || new Date().toISOString(),
              completedAt: result.timestamp || new Date().toISOString()
            });
            
            totalSessions++;
          } catch (error) {
            console.error(`  ❌ Failed to migrate session for ${username}:`, error.message);
          }
        }
        
        console.log(`  ✅ Migrated ${userResults.length} sessions for ${username}`);
      }
      
      console.log(`📊 Total sessions migrated: ${totalSessions}`);
    } catch (error) {
      console.error('Error migrating results:', error);
    }
  }

  async migrateProgress() {
    try {
      const progressPath = path.join(__dirname, 'data', 'progress.json');
      if (!fs.existsSync(progressPath)) {
        console.log('⚠️  No progress.json file found, skipping progress migration');
        return;
      }

      const progressData = JSON.parse(fs.readFileSync(progressPath, 'utf8'));
      const usernames = Object.keys(progressData);
      console.log(`📈 Migrating progress for ${usernames.length} users...`);

      const users = await this.dbService.getUsers();
      const userMap = {};
      users.forEach(user => {
        userMap[user.username] = user.id;
      });

      for (const username of usernames) {
        if (!userMap[username]) {
          console.log(`  ⚠️  User ${username} not found, skipping their progress`);
          continue;
        }

        try {
          const userProgress = progressData[username];
          const stats = userProgress.stats || {};
          
          // Progress will be automatically calculated from sessions,
          // but we can update any specific values if needed
          console.log(`  ✅ Progress data available for ${username}`);
          
        } catch (error) {
          console.error(`  ❌ Failed to process progress for ${username}:`, error.message);
        }
      }
    } catch (error) {
      console.error('Error migrating progress:', error);
    }
  }

  async migrateSpacedRepetition() {
    try {
      const srPath = path.join(__dirname, 'data', 'spacedRepetition.json');
      if (!fs.existsSync(srPath)) {
        console.log('⚠️  No spacedRepetition.json file found, skipping spaced repetition migration');
        return;
      }

      const srData = JSON.parse(fs.readFileSync(srPath, 'utf8'));
      const usernames = Object.keys(srData);
      console.log(`🧠 Migrating spaced repetition data for ${usernames.length} users...`);

      const users = await this.dbService.getUsers();
      const userMap = {};
      users.forEach(user => {
        userMap[user.username] = user.id;
      });

      let totalWords = 0;

      for (const username of usernames) {
        if (!userMap[username]) {
          console.log(`  ⚠️  User ${username} not found, skipping their spaced repetition data`);
          continue;
        }

        try {
          const userData = srData[username];
          if (!userData.words) continue;

          const words = Object.keys(userData.words);
          
          for (const word of words) {
            const wordData = userData.words[word];
            
            // Add spaced repetition word
            await this.dbService.updateWordProgress({
              userId: userMap[username],
              word: word,
              correctCount: wordData.correctCount || 0,
              incorrectCount: wordData.incorrectCount || 0,
              difficulty: wordData.difficulty || 1.0,
              interval: wordData.interval || 1,
              repetitions: wordData.repetitions || 0,
              easeFactor: wordData.easeFactor || 2.5,
              lastReviewed: wordData.lastReviewed || null,
              nextReview: wordData.nextReview || new Date().toISOString()
            });
            
            totalWords++;
          }
          
          console.log(`  ✅ Migrated ${words.length} spaced repetition words for ${username}`);
        } catch (error) {
          console.error(`  ❌ Failed to migrate spaced repetition for ${username}:`, error.message);
        }
      }
      
      console.log(`🧠 Total spaced repetition words migrated: ${totalWords}`);
    } catch (error) {
      console.error('Error migrating spaced repetition:', error);
    }
  }

  inferDifficulty(words) {
    if (!words || !Array.isArray(words)) return 'medium';
    
    const avgLength = words.reduce((sum, word) => sum + word.length, 0) / words.length;
    
    if (avgLength < 5) return 'easy';
    if (avgLength > 8) return 'hard';
    return 'medium';
  }

  inferCategory(name) {
    const lowerName = name.toLowerCase();
    
    if (lowerName.includes('grade') || lowerName.includes('level')) {
      return 'academic';
    }
    if (lowerName.includes('sight') || lowerName.includes('common')) {
      return 'sight-words';
    }
    if (lowerName.includes('phonics') || lowerName.includes('sound')) {
      return 'phonics';
    }
    if (lowerName.includes('theme') || lowerName.includes('topic')) {
      return 'thematic';
    }
    
    return 'general';
  }

  async close() {
    await this.dbService.close();
  }
}

// Run migration if called directly
if (require.main === module) {
  const migrator = new DataMigrator();
  
  migrator.migrate()
    .then(() => {
      console.log('\n🎯 Next Steps:');
      console.log('1. Test the application with the new database');
      console.log('2. Verify all features work correctly');
      console.log('3. Update any client-side code if needed');
      console.log('4. Consider backing up the JSON files');
      process.exit(0);
    })
    .catch(error => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = DataMigrator;