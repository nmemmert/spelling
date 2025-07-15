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

    // Hide student dashboard and game section
    document.getElementById('studentPanel').style.display = 'none';
    document.getElementById('gameSection').classList.add('hidden');
    document.getElementById('gameSection').style.display = 'none';
    document.getElementById('typingSection').classList.remove('hidden');
    document.getElementById('typingSection').style.display = 'block';

    const typingPrompt = document.getElementById('typingPrompt');
    typingPrompt.textContent = 'Loading...';

    try {
        const response = await fetch(`/getWordList?username=${encodeURIComponent(user.username)}`);
        const data = await response.json();
        console.log('Words received:', data);

        if (data.words?.length) {
            typingState.words = [...data.words];
            showNextWord();
        } else {
            typingPrompt.textContent = 'No words available';
        }
    } catch (error) {
        console.error('Error:', error);
        typingPrompt.textContent = 'Error loading words';
    }
}

window.showNextWord = function() {
  const promptEl = document.getElementById('typingPrompt');
  const inputEl = document.getElementById('typingInput');
  if (!promptEl || !inputEl) return;

  if (!typingState.words.length) {
    promptEl.textContent = '🎉 Practice complete!';
    inputEl.disabled = true;
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


window.submitTyping = function() {
    const input = document.getElementById('typingInput')?.value.trim() || '';
    const feedback = document.getElementById('typingFeedback');
    if (!feedback) return;
    
    if (input.toLowerCase() === typingState.currentWord.toLowerCase()) {
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