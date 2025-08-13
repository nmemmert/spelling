// js/typing.js
// Global state
const typingState = {
    words: [],
    currentWord: ''
};

// Make functions globally accessible
window.startTypingPractice = async function() {
    console.log('Starting typing practice');
    
    const user = JSON.parse(localStorage.getItem('loggedInUser'));
    if (!user) return;

    // Hide student dashboard and other sections
    document.getElementById('studentPanel').style.display = 'none';
    document.getElementById('gameSection').classList.add('hidden');
    document.getElementById('gameSection').style.display = 'none';
    document.getElementById('bibleSection').style.display = 'none';
    document.getElementById('typingSection').classList.remove('hidden');
    document.getElementById('typingSection').style.display = 'block';

    const typingPrompt = document.getElementById('typingPrompt');
    typingPrompt.textContent = 'Loading...';

    try {
        const response = await fetch(`/getWordList?username=${encodeURIComponent(user.username)}`);
        const data = await response.json();
        console.log('Words received:', data);

        let wordList = [];
        
        // Handle various potential response formats
        if (data && data.words && Array.isArray(data.words)) {
            // Server returns {words: [array]}
            wordList = data.words;
        } else if (data && data.words && typeof data.words === 'object' && data.words.weeks && data.words.activeWeek) {
            // Server returns {words: {weeks: [], activeWeek: ""}}
            const active = data.words.activeWeek;
            const found = data.words.weeks.find(w => w.date === active);
            if (found && Array.isArray(found.words)) {
                wordList = found.words;
            }
        } else if (Array.isArray(data)) {
            // Server returns direct array
            wordList = data;
        } else if (typeof data === 'object' && Array.isArray(Object.values(data)[0])) {
            // Handle unexpected format as best we can
            wordList = Object.values(data)[0];
        }
        
        if (wordList.length > 0) {
            typingState.words = [...wordList];
            showNextWord();
        } else {
            typingPrompt.textContent = 'No words available';
        }
    } catch (error) {
        console.error('Error:', error);
        typingPrompt.textContent = 'Error loading words';
    }
}


// Track answers for results
typingState.answers = [];

window.showNextWord = async function() {
  const promptEl = document.getElementById('typingPrompt');
  const inputEl = document.getElementById('typingInput');
  if (!promptEl || !inputEl) return;

  if (!typingState.words.length) {
    promptEl.textContent = '🎉 Practice complete!';
    inputEl.disabled = true;
    // Save results to backend
    await saveTypingPracticeResults();
    return;
  }

  // Handle both string and object formats
  const wordObj = typingState.words[0];
  typingState.currentWord = typeof wordObj === 'string' ? wordObj : wordObj.word;

  console.log('Showing word:', typingState.currentWord);
  promptEl.textContent = typingState.currentWord;
  promptEl.style.display = 'block';

  inputEl.value = '';
  inputEl.disabled = false;
  inputEl.focus();
}

async function saveTypingPracticeResults() {
  const user = JSON.parse(localStorage.getItem('loggedInUser'));
  if (!user) return;
  const result = {
    score: typingState.answers.filter(a => a.correct).length,
    completed: true,
    answers: typingState.answers
  };
  try {
    await fetch('/saveTypingResults', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user.username, result })
    });
    console.log('Typing practice results saved');
  } catch (e) {
    console.error('Failed to save typing results', e);
  }
}


window.submitTyping = function() {
    const input = document.getElementById('typingInput')?.value.trim() || '';
    const feedback = document.getElementById('typingFeedback');
    if (!feedback) return;

    const correct = input.toLowerCase() === typingState.currentWord.toLowerCase();
    typingState.answers.push({ word: typingState.currentWord, input, correct });

    if (correct) {
        feedback.textContent = '✅ Correct!';
        feedback.style.color = 'green';
        typingState.words.shift();
        setTimeout(showNextWord, 1500);
    } else {
        feedback.textContent = '❌ Try again';
        feedback.style.color = 'red';
    }
}

// Add event listener for Enter key
document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('typingInput');
    if (input) {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') submitTyping();
        });
    }
});