const express = require('express')
const fs = require('fs')
const app = express()
const PORT = 3000

app.use(express.static('public'))
app.use(express.json())

app.post('/addUser', (req, res) => {
  const { username, hash, role } = req.body
  const users = JSON.parse(fs.readFileSync('public/users.json', 'utf-8'))

  if (users.find(u => u.username === username)) {
    return res.status(409).send('User already exists.')
  }

  users.push({ username, hash, role })
  fs.writeFileSync('public/users.json', JSON.stringify(users, null, 2))
  res.send('User added successfully.')
})
app.post('/deleteUser', (req, res) => {
  const { username } = req.body
  const users = JSON.parse(fs.readFileSync('public/users.json', 'utf-8'))
  const updated = users.filter(u => u.username !== username)

  if (users.length === updated.length) {
    return res.status(404).send("User not found.")
  }

  fs.writeFileSync('public/users.json', JSON.stringify(updated, null, 2))
  res.send(`User "${username}" deleted.`)
})
app.get('/getWordList', (req, res) => {
  const username = req.query.user
  if (!username) return res.status(400).send("Username required")

  const data = JSON.parse(fs.readFileSync('public/wordlists.json', 'utf-8'))
  res.json(data[username] || [])
})

app.post('/saveWordList', (req, res) => {
  const { username, words } = req.body
  if (!username || !Array.isArray(words)) {
    return res.status(400).send("Username and words array required")
  }

  const data = JSON.parse(fs.readFileSync('public/wordlists.json', 'utf-8'))
  data[username] = words
  fs.writeFileSync('public/wordlists.json', JSON.stringify(data, null, 2))
  res.send(`✅ Word list saved for ${username}`)
})

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`))
