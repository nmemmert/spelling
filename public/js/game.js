// 🌍 Game state
let allWords = [], words = [], current = 0, results = [];

// 👩‍🎓 Show student interface
function showStudent() {
  console.log("🔊 showStudent() executed");

  const studentPanel = document.getElementById('studentPanel');
  const adminPanel = document.getElementById('adminPanel');
  studentPanel?.classList.remove('hidden');
  adminPanel?.classList.add('hidden');

  setTimeout(() => {
    const btn = document.getElementById('startGameBtn');
    if (btn) {
      console.log("🎯 Button found in delayed reveal");
      btn.classList.remove('hidden');
      btn.style.display = 'inline-block';
    } else {
      console.warn("⚠️ Button still missing after timeout");
    }
  }, 100);
}

// 🚀 Begin game session
async function startGame() {
  const user = JSON.parse(localStorage.getItem('loggedInUser'));
  if (!user) return;

  const res = await fetch(`/getWordList?user=${encodeURIComponent(user.username)}`);
  allWords = await res.json();

  if (!allWords.length) {
    alert("No words found. Please add words in Admin Panel.");
    return;
  }

  words = [...allWords];
  current = 0;
  results = [];

  document.getElementById('summary')?.classList.add('hidden');
  document.getElementById('badgeDisplay')?.classList.add('hidden');
  showWord();
}

// 🔤 Show a word, then hide after timeout
function showWord() {
  const wordBox = document.getElementById('wordBox');
  const wordEl = document.getElementById('word');

  if (!words[current]) {
    endGame(); return;
  }

  wordEl.textContent = words[current];
  wordBox.classList.remove('hidden');

  setTimeout(() => {
    wordBox.classList.add('hidden');
    document.getElementById('inputSection').classList.remove('hidden');
    document.getElementById('userInput').value = '';
    document.getElementById('userInput').focus();
  }, 2000);
}

// 📝 Check user’s answer and move to next
function submitAnswer() {
  const input = document.getElementById('userInput').value.trim();
  results.push({ word: words[current], attempt: input });
  current++;

  document.getElementById('inputSection').classList.add('hidden');

  if (current < words.length) {
    showWord();
  } else {
    showSummary();
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