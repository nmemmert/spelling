// 🌍 Game state
let words = [];
let currentWord = '';
let currentIndex = 0;
let results = [];
let isSpacedRepetitionMode = false;
// 📝 Check user's answer and move to next
window.submitAnswer = function() {
    const input = document.getElementById('userInput').value.trim();
    
    // Record the attempt
    results.push({
        word: currentWord,
        attempt: input
    });

    if (input.toLowerCase() === currentWord.toLowerCase()) {
        currentIndex++;
        document.getElementById('inputSection').classList.add('hidden');
        setTimeout(() => showWord(), 500); // Brief pause before next word
    } else {
        // Show feedback for incorrect answer
        const inputEl = document.getElementById('userInput');
        inputEl.style.borderColor = 'var(--error)';
        inputEl.style.backgroundColor = '#fef2f2';
        
        setTimeout(() => {
            inputEl.style.borderColor = '';
            inputEl.style.backgroundColor = '';
            inputEl.focus();
        }, 1000);
    }
}

// Add Enter key support for game input
document.addEventListener('DOMContentLoaded', () => {
    const gameInput = document.getElementById('userInput');
    if (gameInput) {
        gameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                submitAnswer();
            }
        });
    }
});[];
let currentSentence = '';

function showStudent() {
    console.log("🔊 Showing student panel");
    
    // Hide admin panel
    document.getElementById('adminPanel')?.classList.add('hidden');
    
    // Show student panel and its components
    const studentPanel = document.getElementById('studentPanel');
    studentPanel?.classList.remove('hidden');
    
    // Get the buttons and explicitly set their properties
    const gameBtn = document.getElementById('startGameBtn');
    const typingBtn = document.getElementById('startTypingBtn');
    
    if (gameBtn && typingBtn) {
        console.log("Found buttons, making visible");
        // Remove all possible hiding classes/styles
        gameBtn.classList.remove('hidden');
        typingBtn.classList.remove('hidden');
        
        // Explicitly set display style
        gameBtn.style.cssText = 'display: inline-block !important; visibility: visible !important;';
        typingBtn.style.cssText = 'display: inline-block !important; visibility: visible !important;';
    } else {
        console.error("Could not find game buttons");
    }
}

// 🚀 Begin game session
window.startGame = async function(customWords = null, isSpacedRepetition = false) {
    console.log('🎮 Starting spelling game');
    
    const user = JSON.parse(localStorage.getItem('loggedInUser'));
    if (!user) {
        alert('Please log in first');
        return;
    }

    try {
        // Hide student dashboard and other sections
        document.getElementById('studentPanel').style.display = 'none';
        document.getElementById('typingSection').style.display = 'none';
        document.getElementById('bibleSection').style.display = 'none';
        
        // Show game section
        document.getElementById('gameSection').classList.remove('hidden');
        document.getElementById('gameSection').style.display = 'block';
        document.getElementById('wordBox').textContent = 'Loading...';
        document.getElementById('summary')?.classList.add('hidden');
        document.getElementById('badgeDisplay')?.classList.add('hidden');

        let wordList;
        
        // Use custom words if provided (for spaced repetition)
        if (customWords && Array.isArray(customWords) && customWords.length > 0) {
            wordList = customWords;
            isSpacedRepetitionMode = isSpacedRepetition;
            console.log('Using custom word list for spaced repetition:', wordList);
        } else {
            // Fetch words from user's word list
            const response = await fetch(`/getWordList?username=${user.username}`);
            const data = await response.json();
            console.log('Received words:', data);
            
            let weekWords = [];
            // If weeks format and activeWeek is set, use only that week's words
            if (data.words && Array.isArray(data.words)) {
                weekWords = data.words;
            } else if (data.words && data.words.weeks && data.words.activeWeek) {
                const active = data.words.activeWeek;
                const found = data.words.weeks.find(w => w.date === active);
                if (found) weekWords = found.words;
            } else if (Array.isArray(data)) {
                // If data is already an array
                weekWords = data;
            }
            
            wordList = weekWords;
        }

        if (!wordList.length) {
            alert('No words found for practice');
            return;
        }

        // Start game
        words = [...wordList];
        typingWords = [...wordList]; // Initialize typing words too
        currentIndex = 0;
        results = [];  // Reset results array
        showWord();

    } catch (error) {
        console.error('Error:', error);
        alert('Failed to load words');
    }
}

function showWord() {
    if (currentIndex >= words.length) {
        showSummary();
        return;
    }

    currentWord = words[currentIndex];
    console.log('Current word:', currentWord);

    // Show word briefly then hide
    const wordBox = document.getElementById('wordBox');
    const inputSection = document.getElementById('inputSection');
    
    wordBox.textContent = currentWord;
    inputSection.classList.add('hidden');

    setTimeout(() => {
        wordBox.textContent = '';
        inputSection.classList.remove('hidden');
        document.getElementById('userInput').value = '';
        document.getElementById('userInput').focus();
    }, 2000);
}

// 📝 Check user’s answer and move to next
function submitAnswer() {
    const input = document.getElementById('userInput').value.trim();
    
    // Record the attempt
    results.push({
        word: currentWord,
        attempt: input
    });

    if (input.toLowerCase() === currentWord.toLowerCase()) {
        currentIndex++;
        document.getElementById('inputSection').classList.add('hidden');
        showWord();
    } else {
        alert('Try again!');
    }
}

// 📊 Show results summary
function showSummary() {
  const summary = document.getElementById('summary');
  let correct = 0;
  let missed = [];
  
  // Process results to calculate correct answers and build a report
  const report = results.map(({ word, attempt }) => {
    const isCorrect = word.toLowerCase() === attempt.toLowerCase();
    if (isCorrect) correct++;
    else missed.push(word);
    return `<li>${word} — <strong style="color:${isCorrect ? 'green' : 'red'}">${attempt || '(no answer)'}</strong></li>`;
  }).join('');

  // Create detailed results for spaced repetition processing
  const detailedResults = results.map(({ word, attempt }) => {
    return {
      word,
      correct: word.toLowerCase() === attempt.toLowerCase(),
      attempt
    };
  });

  // Dispatch event for spaced repetition system if in SR mode
  if (isSpacedRepetitionMode) {
    const event = new CustomEvent('gameResultsAvailable', {
      detail: {
        isSpacedRepetition: true,
        results: detailedResults
      }
    });
    document.dispatchEvent(event);
  }

  // Build and display summary
  summary.innerHTML = `
    <h2>Results</h2>
    <p>You got ${correct} out of ${words.length} correct (${Math.round((correct / words.length) * 100)}%)</p>
    <ul>${report}</ul>
    ${missed.length ? `<button onclick='retryMissed(${JSON.stringify(missed)})'>Retry Missed Words</button>` : ''}
    ${isSpacedRepetitionMode ? `<button onclick='backToStudentDashboard()' class="btn-primary">Back to Dashboard</button>` : ''}
  `;

  summary.classList.remove('hidden');

  // 🏆 Badge evaluation
  const earnedBadges = [];
  
  // Performance badges
  if (correct === words.length) earnedBadges.push({
    id: "perfect_round",
    name: "Perfect Round",
    description: "Got all words correct in a round",
    icon: "🎯",
    color: "#ffd700",
    category: "achievement"
  });
  
  if (missed.length === 0) earnedBadges.push({
    id: "no_misses",
    name: "No Misses", 
    description: "Completed a round without any mistakes",
    icon: "⭐", 
    color: "#ff9500",
    category: "achievement"
  });
  
  // Speed badges
  const averageTime = totalTime / words.length;
  if (averageTime < 5 && words.length >= 5) earnedBadges.push({
    id: "speed_demon",
    name: "Speed Demon",
    description: "Average time less than 5 seconds per word",
    icon: "⚡",
    color: "#00b4d8",
    category: "speed"
  });
  
  if (totalTime < 30 && words.length >= 10) earnedBadges.push({
    id: "quick_study",
    name: "Quick Study",
    description: "Complete 10+ words in under 30 seconds",
    icon: "🚀",
    color: "#8338ec",
    category: "speed"
  });
  
  // Difficulty badges
  const averageLength = words.reduce((sum, word) => sum + word.length, 0) / words.length;
  if (averageLength > 8 && correct > words.length * 0.8) earnedBadges.push({
    id: "word_wizard",
    name: "Word Wizard",
    description: "Master of complex vocabulary",
    icon: "🧙‍♂️",
    color: "#7209b7",
    category: "mastery"
  });
  
  // Streak tracking (access from localStorage)
  let streakCount = parseInt(localStorage.getItem('practice_streak') || '0');
  if (correct / words.length >= 0.7) { // At least 70% correct to count for streak
    streakCount++;
    localStorage.setItem('practice_streak', streakCount);
  } else {
    streakCount = 0;
    localStorage.setItem('practice_streak', '0');
  }
  
  // Streak badges
  if (streakCount >= 3) earnedBadges.push({
    id: "consistent_learner",
    name: "Consistent Learner",
    description: "3-day practice streak with 70%+ accuracy",
    icon: "🔥",
    color: "#ff006e",
    category: "consistency"
  });
  
  if (streakCount >= 7) earnedBadges.push({
    id: "weekly_warrior",
    name: "Weekly Warrior",
    description: "7-day practice streak with 70%+ accuracy",
    icon: "⚔️",
    color: "#3a0ca3",
    category: "consistency"
  });

  const user = JSON.parse(localStorage.getItem('loggedInUser'));
  if (user) {
    // 📡 Save structured results
    fetch('/saveResults', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: user.username,
        result: {
          score: correct,
          completed: true,
          answers: results.map(({ word, attempt }) => ({
            word,
            correct: word.toLowerCase() === attempt.toLowerCase()
          }))
        }
      })
    });

    // 🎖 Send earned badges
    if (earnedBadges.length) {
      fetch('/awardBadges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: user.username,
          badges: earnedBadges
        })
      });

      // 🎨 Display badges with improved visuals
      const badgeSection = document.getElementById("badgeDisplay");
      const badgeList = document.getElementById("badgeList");

      badgeList.innerHTML = "";
      
      // Add header for the badge showcase
      const badgeHeader = document.createElement("div");
      badgeHeader.className = "badge-showcase-header";
      badgeHeader.innerHTML = `<span class="badge-count">${earnedBadges.length}</span> New Badge${earnedBadges.length > 1 ? 's' : ''} Earned!`;
      badgeList.appendChild(badgeHeader);
      
      // Create badge container
      const badgeContainer = document.createElement("div");
      badgeContainer.className = "badge-container";
      
      earnedBadges.forEach(badge => {
        const badgeCard = document.createElement("div");
        badgeCard.className = "badge-card";
        badgeCard.style.borderColor = badge.color || "#4a5568";
        badgeCard.style.boxShadow = `0 4px 6px rgba(0,0,0,0.1), 0 0 10px ${badge.color}40`;
        
        badgeCard.innerHTML = `
          <div class="badge-icon" style="background-color: ${badge.color}40">
            <span>${badge.icon || "🏅"}</span>
          </div>
          <div class="badge-info">
            <h3>${badge.name}</h3>
            <p>${badge.description}</p>
          </div>
        `;
        
        // Add animation class after a small delay for staggered effect
        setTimeout(() => {
          badgeCard.classList.add("badge-card-animate");
        }, 150 * badgeContainer.children.length);
        
        badgeContainer.appendChild(badgeCard);
      });
      
      badgeList.appendChild(badgeContainer);
      badgeSection.classList.remove("hidden");
    } else {
      document.getElementById("badgeDisplay")?.classList.add("hidden");
    }
  }
}

// 🔁 Retry only the missed words
function retryMissed(missedWords) {
  words = missedWords;
  current = 0;
  results = [];

  document.getElementById('summary')?.classList.add('hidden');
  document.getElementById('badgeDisplay')?.classList.add('hidden');
  showWord();
}

// New function to start typing practice
async function startTypingPractice() {
    console.log("⌨️ Starting typing practice...");
    const user = JSON.parse(localStorage.getItem('loggedInUser'));
    if (!user) {
        console.error("No user logged in");
        return;
    }

    try {
        const res = await fetch(`/getWordList?username=${encodeURIComponent(user.username)}`);
        const data = await res.json();
        const words = data.words || [];

        if (!words.length) {
            alert("No words found for practice. Please contact your teacher.");
            return;
        }

        // Hide game section, show typing section
        document.getElementById('gameSection')?.classList.add('hidden');
        document.getElementById('typingSection').classList.remove('hidden');
        
        // Initialize typing practice
        localStorage.setItem('typingWords', JSON.stringify(words));
        showNextTypingSentence();
    } catch (error) {
        console.error('Error starting typing practice:', error);
        alert('Error loading typing practice. Please try again.');
    }
}

function createSentenceWithWord(word) {
    const templates = [
        `The word to spell is "${word}."`,
        `Please spell the word "${word}."`,
        `Type the word "${word}" carefully.`,
        `Practice spelling "${word}" in this sentence.`
    ];
    return templates[Math.floor(Math.random() * templates.length)];
}

function showNextTypingSentence() {
    console.log('Showing next sentence...'); // Debug log
    
    if (!typingWords.length) {
        document.getElementById('typingPrompt').textContent = '🎉 All done! Great job!';
        document.getElementById('typingInput').disabled = true;
        return;
    }

    const word = typingWords[0];
    currentSentence = createSentenceWithWord(word);
    console.log('Current sentence:', currentSentence); // Debug log

    document.getElementById('typingPrompt').textContent = currentSentence;
    document.getElementById('typingInput').value = '';
    document.getElementById('typingInput').disabled = false;
    document.getElementById('typingInput').focus();
    document.getElementById('typingFeedback').textContent = '';
}

function submitTyping() {
    const input = document.getElementById('typingInput').value.trim();
    const feedback = document.getElementById('typingFeedback');

    if (input.toLowerCase() === currentSentence.toLowerCase()) {
        feedback.textContent = '✅ Perfect!';
        feedback.style.color = 'green';
        typingWords.shift(); // Remove completed word
        setTimeout(showNextTypingSentence, 1500);
    } else {
        feedback.textContent = '❌ Try again. Type the exact sentence as shown.';
        feedback.style.color = 'red';
    }
}