let users = []

// 🔁 Load users from server-side users.json
async function loadUsers() {
  try {
    const res = await fetch("users.json")
    users = await res.json()
  } catch (e) {
    console.error("Failed to load users.json:", e)
    users = []
  }
}

// 🔐 Password hashing
function hashPassword(password) {
  const shaObj = new jsSHA("SHA-256", "TEXT")
  shaObj.update(password)
  return shaObj.getHash("HEX")
}

// 👤 Login
async function verifyLogin() {
  const uname = document.getElementById('username').value.trim()
  const pw = document.getElementById('password').value
  const hash = hashPassword(pw)
  const msg = document.getElementById('loginMessage')

  const user = users.find(u => u.username === uname && u.hash === hash)

  if (user) {
    localStorage.setItem('loggedInUser', JSON.stringify(user))
    msg.textContent = ''
    setupSession(user)
    await showAdmin()
  } else {
    msg.textContent = "Invalid username or password."
  }
}

// 🧠 On load
window.addEventListener('DOMContentLoaded', async () => {
  await loadUsers()
  displayUserDropdown()

  const savedTheme = localStorage.getItem('theme') || 'playground'
  document.body.className = savedTheme
  const dropdown = document.getElementById('themeSelect')
  if (dropdown) dropdown.value = savedTheme

  const savedUser = localStorage.getItem('loggedInUser')
  if (savedUser) setupSession(JSON.parse(savedUser))
})

// 🧑‍🏫 Admin setup
async function setupSession(user) {
  document.getElementById('loginPanel').classList.add('hidden')
  document.getElementById('nav').classList.remove('hidden')
  document.getElementById('userInfo').textContent = `${user.username} (${user.role})`

  if (user.role === "admin") {
    document.getElementById('adminBtn').classList.remove('hidden')
    await showAdmin()
    await loadUsers()
    displayUserDropdown()
    populateWordUserDropdown()
  } else {
    document.getElementById('adminBtn').classList.add('hidden')
    showStudent()
  }
}


function logoutUser() {
  localStorage.removeItem('loggedInUser')
  document.getElementById('loginPanel').classList.remove('hidden')
  document.getElementById('nav').classList.add('hidden')
  document.getElementById('adminPanel').classList.add('hidden')
  document.getElementById('studentPanel').classList.add('hidden')
}

async function showAdmin() {
  document.getElementById('adminPanel').classList.remove('hidden')
  document.getElementById('studentPanel').classList.add('hidden')
  loadWords()
  displayWordList()
  await loadUsers()
  displayUserDropdown()
}

// ➕ Add User
async function addNewUser() {
  const username = document.getElementById("newUsername").value.trim()
  const password = document.getElementById("newPassword").value
  const role = document.getElementById("newRole").value
  const msg = document.getElementById("userAddMessage")
  const hashPreview = document.getElementById("hashPreview")

  if (!username || !password) {
    msg.textContent = "Please fill out all fields."
    return
  }

  const hash = hashPassword(password)

  // Live hash preview (optional visual confirmation for admin)
  if (hashPreview) {
    hashPreview.textContent = hash
  }

  try {
    await saveUserToServer(username, hash, role)
    msg.textContent = `✅ User "${username}" added to server.`

    // Clear fields after success
    document.getElementById("newUsername").value = ''
    document.getElementById("newPassword").value = ''
    if (hashPreview) hashPreview.textContent = '[auto]'
    
    await loadUsers()
    displayUserDropdown()
  } catch (e) {
    msg.textContent = "❌ Failed to add user."
    console.error("Add user error:", e)
  }
}

async function saveUserToServer(username, hash, role) {
  const res = await fetch('/addUser', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, hash, role })
  })

  const msg = await res.text()
  alert(msg)
}

// 🗑 User deletion
function displayUserDropdown() {
  const dropdown = document.getElementById("userDropdown")
  dropdown.innerHTML = `<option value="">-- Select a user --</option>`

  users.forEach(user => {
    dropdown.innerHTML += `<option value="${user.username}">${user.username} (${user.role})</option>`
  })
}

function selectUserAction(username) {
  if (!username) return

  const confirmDelete = confirm(`Are you sure you want to delete user "${username}"?`)
  if (!confirmDelete) {
    document.getElementById("userDropdown").value = ""
    return
  }

  fetch("/deleteUser", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username })
  })
    .then(res => res.text())
    .then(msg => {
      alert(msg)
      loadUsers().then(displayUserDropdown)
    })
}

// 🎨 Theme
function changeTheme(themeName) {
  document.body.className = themeName
  localStorage.setItem('theme', themeName)
}

// 📚 Word list


function saveWords() {
  const text = document.getElementById('wordInput').value.trim()
  allWords = text.split('\n').map(w => w.trim()).filter(Boolean)
  localStorage.setItem('spellingWords', JSON.stringify(allWords))
  displayWordList()
  alert("Word list saved!")
}

function clearWords() {
  localStorage.removeItem('spellingWords')
  allWords = []
  displayWordList()
  alert("Saved words cleared.")
}

function displayWordList() {
  const ul = document.getElementById('wordListDisplay')
  ul.innerHTML = allWords.map(word => `<li>${word}</li>`).join('')
}

function handleFileUpload(event) {
  const file = event.target.files[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = function(e) {
    const text = e.target.result
    const newWords = text.includes(",") ? text.split(",") : text.split("\n")
    allWords = newWords.map(w => w.trim()).filter(Boolean)
    localStorage.setItem('spellingWords', JSON.stringify(allWords))
    displayWordList()
    alert("Words uploaded and saved!")
  }
  reader.readAsText(file)
}

// 🎮 Spelling Game
let allWords = [], words = [], current = 0, results = []

function showStudent() {
  document.getElementById('studentPanel').classList.remove('hidden')
  document.getElementById('adminPanel').classList.add('hidden')
}

function startGame() {
  loadWords()
  if (allWords.length === 0) {
    alert("No words found. Please add words in Admin Panel.")
    return
  }

  words = [...allWords]
  current = 0
  results = []
  document.getElementById('summary').classList.add('hidden')
  showWord()
}

function showWord() {
  const wordBox = document.getElementById('wordBox')
  const wordEl = document.getElementById('word')
  wordBox.classList.remove('hidden')
  wordEl.textContent = words[current]

  setTimeout(() => {
    wordBox.classList.add('hidden')
    document.getElementById('inputSection').classList.remove('hidden')
    document.getElementById('userInput').value = ''
    document.getElementById('userInput').focus()
  }, 2000)
}

function submitAnswer() {
  const input = document.getElementById('userInput').value.trim()
  results.push({ word: words[current], attempt: input })
  current++
  document.getElementById('inputSection').classList.add('hidden')

  if (current < words.length) {
    showWord()
  } else {
    showSummary()
  }
}

function showSummary() {
  const summary = document.getElementById('summary')
  let correct = 0
  let missed = []

  const report = results.map(({ word, attempt }) => {
    const isCorrect = word.toLowerCase() === attempt.toLowerCase()
    if (isCorrect) correct++
    else missed.push(word)
    return `<li>${word} — <strong style="color:${isCorrect ? 'green' : 'red'}">${attempt || '(no answer)'}</strong></li>`
  }).join('')

  summary.innerHTML = `
    <h2>Results</h2>
    <p>You got ${correct} out of ${words.length} correct (${Math.round((correct / words.length) * 100)}%)</p>
    <ul>${report}</ul>
    ${missed.length ? `<button onclick="retryMissed(${JSON.stringify(missed)})">Retry Missed Words</button>` : ''}
  `
  summary.classList.remove('hidden')
}

function retryMissed(missedWords) {
  words = missedWords
  current = 0
  results = []
  document.getElementById('summary').classList.add('hidden')
  showWord()
}
async function loadWords() {
  const user = JSON.parse(localStorage.getItem('loggedInUser'))
  if (!user) return allWords = []

  const res = await fetch(`/getWordList?user=${encodeURIComponent(user.username)}`)
  allWords = await res.json()
  displayWordList()
}
async function saveWords() {
  const user = JSON.parse(localStorage.getItem('loggedInUser'))
  if (!user) return

  const text = document.getElementById('wordInput').value.trim()
  allWords = text.split('\n').map(w => w.trim()).filter(Boolean)

  await fetch('/saveWordList', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: user.username, words: allWords })
  })

  displayWordList()
  alert("✅ Word list saved to server")
}
async function clearWords() {
  const user = JSON.parse(localStorage.getItem('loggedInUser'))
  if (!user) return

  allWords = []
  await fetch('/saveWordList', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: user.username, words: [] })
  })

  displayWordList()
  alert("🗑 Word list cleared")
}
function populateWordUserDropdown() {
  const dropdown = document.getElementById("wordUserSelect")
  dropdown.innerHTML = `<option value="">-- Select a user --</option>`
  users.forEach(user => {
    dropdown.innerHTML += `<option value="${user.username}">${user.username}</option>`
  })
}
async function loadWordsForSelectedUser() {
  const selectedUser = document.getElementById("wordUserSelect").value
  if (!selectedUser) return

  const res = await fetch(`/getWordList?user=${encodeURIComponent(selectedUser)}`)
  allWords = await res.json()
  displayWordList()
}
