### Spelling Game ###

---

### 🐳 **How to Clone and Run the Spelling App from Gitea with Docker Compose**

1. **Install Docker & Docker Compose**
   - Mac: [Docker Desktop for Mac](https://www.docker.com/products/docker-desktop/)
   - Windows: [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/)
   - Linux: Use your package manager (e.g. `apt install docker docker-compose`)

2. **Clone the Repository**

```bash
git clone https://git.necloud.us/nmemmert/Spelling.git
cd Spelling
```

3. **Build & Start the Container**

```bash
docker-compose up --build
```

This will:
- Build the Docker image using the included `Dockerfile`
- Start the container on port 3000
- Mount your user data (like `users.json` and `wordlists.json`) so they persist

4. **Access the App**

Open your browser and visit:

```
http://localhost:3000
```

🎉 You’re in! Log in with a predefined user from `users.json` (e.g., `admin1` / `password`).

5. **Stop the App**

To shut it down when you're done:

```bash
docker-compose down
```

---

### ✅ Optional: Run in the Background

```bash
docker-compose up -d
```

To stop it later:

```bash
docker-compose down
```

---

Want me to generate a `README.md` from this? Or help automate updates with a webhook from your Gitea server? You’re primed for self-hosted greatness.