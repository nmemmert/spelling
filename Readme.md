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

- 🔐 Login system with **admin** and **student** roles  
- 🌈 Theme switching *(Playground, Chalkboard, Galaxy, Nature)*  
- 📚 Student-specific word list storage *(on server!)*  
- 📤 Upload word lists or enter manually  
- 🎮 Spelling game with instant feedback and retry mode  
- 🧑‍🏫 Admin tools to manage users and word lists  
- 🐳 Fully containerized via **Docker Compose**
