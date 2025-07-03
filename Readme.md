# 📝 Spelling App

A lightweight, multi-user spelling practice app with admin controls, customizable themes, and per-user word list management. Built with **Node.js**, **Express**, and **Docker**.
---
## [Watch the video](https://www.youtube.com/watch?v=K29zCFZPEjE)
[![alt text](https://img.youtube.com/vi/K29zCFZPEjE/0.jpg)](https://www.youtube.com/watch?v=K29zCFZPEjE)

---

## 🚀 Quick Start (Docker Compose)

Clone and run from anywhere using Docker Compose:

```bash
git clone https://git.necloud.us/nmemmert/Spelling.git
cd Spelling
docker-compose up --build
```

Then visit: 👉 http://localhost:3000


## 👥 Default Login

| Username  | Password | Role   |
|-----------|----------|--------|
| admin1    | password | Admin  |
| student1  | 123456   | Student|

> You can add new users from the Admin Panel.

## ⚙️ Features

# 🎮 Student-Facing Features

- **Word Game Session**  
  Timed word presentation with answer input and summary feedback

- **Retry Missed Words**  
  Quick review round for any words answered incorrectly

- **Result Summary Panel**  
  Shows score, accuracy percentage, and answers with color-coded feedback

- **🎖 Badge Display Section**  
  Earned badges appear after each session based on milestone triggers

- **Responsive Design**  
  Touch-friendly interface optimized across devices

---

# 📋 Admin Panel Features

- **User Management**  
  Add and remove student accounts from the system

- **Word List Editor**  
  Customize spelling lists per student

- **Game Preview & Play Trigger**  
  Admins can test gameplay directly

- **Analytics Tab**  
  Aggregate stats like average scores, most missed words, and per-student breakdown

- **Badge Viewer Tab**  
  Shows every user's earned badges and lets admins inspect progress visually

- **Reports Tab**  
  Print-friendly HTML summaries per student with words, scores, and badges

- **Clipboard Copy Button**  
  Quick export for emailing or recordkeeping

---

# 🔄 Server-Side Logic

- **Structured Result Saving**  
  Stores user sessions with score, completion status, and answer accuracy

- **Badge Awarding & Storage**  
  Server tracks earned achievements in `badges.json`

- **Safe Data Handling**  
  Validates all inputs and formats before writing JSON

---

# 🚀 Upcoming Features (in progress or proposed)

- **Multi-Session History Tracking**  
  Store multiple results per user for trends and performance graphs

- **Performance Trends Viewer**  
  Line/bar charts to show score progression over time

- **Practice Streak Badges**  
  Awarded for consistent use across days

- **Thematic Word Lists**  
  Organize challenges by topic (e.g. animals, tech, holidays)

- **Email Export Button**  
  Opens a pre-filled `mailto:` with progress summary text

- **PDF Export Option**  
  Convert report data into downloadable documents
