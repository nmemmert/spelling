// 🌍 Game state
let words = [];
let currentWord = '';
let currentIndex = 0;
let results = [];
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
window.startGame = async function() {
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

        // Fetch words
        const response = await fetch(`/getWordList?username=${user.username}`);
        const data = await response.json();
        console.log('Received words:', data);

        if (!data.words || data.words.length === 0) {
            alert('No words found for practice');
            return;
        }

        // Start game
        words = [...data.words];
        typingWords = [...data.words]; // Initialize typing words too
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

  const report = results.map(({ word, attempt }) => {
    const isCorrect = word.toLowerCase() === attempt.toLowerCase();
    if (isCorrect) correct++;
    else missed.push(word);
    return `<li>${word} — <strong style="color:${isCorrect ? 'green' : 'red'}">${attempt || '(no answer)'}</strong></li>`;
  }).join('');

  summary.innerHTML = `
    <h2>Results</h2>
    <p>You got ${correct} out of ${words.length} correct (${Math.round((correct / words.length) * 100)}%)</p>
    <ul>${report}</ul>
    ${missed.length ? `<button onclick='retryMissed(${JSON.stringify(missed)})'>Retry Missed Words</button>` : ''}
  `;

  summary.classList.remove('hidden');

  // 🏆 Badge evaluation
  const earnedBadges = [];
  if (correct === words.length) earnedBadges.push("Perfect Round");
  if (missed.length === 0) earnedBadges.push("No Misses");

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

      // 🎨 Display badges
      const badgeSection = document.getElementById("badgeDisplay");
      const badgeList = document.getElementById("badgeList");

      badgeList.innerHTML = "";
      earnedBadges.forEach(b => {
        const li = document.createElement("li");
        li.textContent = `🏅 ${b}`;
        badgeList.appendChild(li);
      });

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