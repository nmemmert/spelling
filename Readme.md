# 📝 Modern Spelling & Typing Practice App

A comprehensive educational application featuring spelling practice, typing exercises, and Bible verse typing with mode## ⚙️ Features Overview

### 🎓 St### 👨‍💼 Admin Panel Featuresde---

## 🔧 Configuration

## 🛡️ Security Features## Environment VariablestivitiesUI design. Built with **Node.js**, **Express**, and optimized for Docker deployment.

---

## [Watch the Demo Video](https://www.youtube.com/watch?v=K29zCFZPEjE)
[![Demo Video](https://img.youtube.com/vi/K29zCFZPEjE/0.jpg)](https://www.youtube.com/watch?v=K29zCFZPEjE)

---

## 🚀 Installation Options

### Option 1: Docker (Recommended)

#### Quick Start with Docker Compose
```bash
git clone https://git.necloud.us/nmemmert/Spelling.git
cd Spelling
docker-compose up -d
```

#### Using Pre-built Container
```bash
# Pull and run the latest container
docker run -d \
  --name spelling-app \
  -p 3000:3000 \
  -v ./data:/app/data \
  --restart unless-stopped \
  git.necloud.us/nmemmert/spelling:latest
```

#### Custom Docker Compose
```yaml
version: "3.9"
services:
  spelling-app:
    image: git.necloud.us/nmemmert/spelling:latest
    container_name: spelling-app
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
    restart: unless-stopped
    environment:
      - NODE_ENV=production
```

### Option 2: CasaOS Installation

#### Method 1: One-Click Install (Recommended)
1. **Open CasaOS Dashboard** in your web browser
2. Navigate to **App Store** → **Custom Install**
3. **Paste this complete Docker Compose configuration:**

```yaml
name: spelling-practice-app
services:
  spelling-app:
    image: git.necloud.us/nmemmert/spelling:latest
    container_name: spelling-practice
    ports:
      - "3000:3000"
    volumes:
      - /DATA/AppData/spelling:/app/data
    restart: unless-stopped
    environment:
      - NODE_ENV=production
    labels:
      - "casaos.name=Spelling Practice"
      - "casaos.icon=📝"
      - "casaos.category=Education"
      - "casaos.description=Modern spelling and typing practice application"

x-casaos:
  author: NMemmert
  category: Education
  description: 
    en_us: "A comprehensive educational application featuring spelling practice, typing exercises, and Bible verse typing with modern UI design."
  developer: "NMemmert"
  icon: "https://hotemoji.com/images/dl/7/memo-emoji-by-google.png"
  screenshot_link: ""
  tagline:
    en_us: "Modern Spelling & Typing Practice"
  thumbnail: ""
  title:
    en_us: "Spelling Practice App"
  tips: {}
  port_map: "3000"
```

4. **Click Install** and wait for deployment to complete
5. **Access the app** via CasaOS Dashboard or directly at `http://your-casaos-ip:3000`

> **💡 Tip**: The app will automatically appear in your CasaOS dashboard with the 📝 icon after installation

#### Method 2: Manual CasaOS Installation
1. **Access CasaOS Terminal**:
   - Open CasaOS Dashboard
   - Go to **Terminal** or **SSH** into your CasaOS system

2. **Create application directory:**
   ```bash
   mkdir -p /DATA/AppData/spelling
   cd /DATA/AppData/spelling
   ```

3. **Create docker-compose.yml file:**
   ```bash
   nano docker-compose.yml
   ```
   
4. **Add this configuration and save:**
   ```yaml
   version: "3.9"
   services:
     spelling-app:
       image: git.necloud.us/nmemmert/spelling:latest
       container_name: spelling-practice
       ports:
         - "3000:3000"
       volumes:
         - /DATA/AppData/spelling:/app/data
       restart: unless-stopped
       environment:
         - NODE_ENV=production
   ```

5. **Deploy the application:**
   ```bash
   docker-compose up -d
   ```

6. **Verify deployment:**
   ```bash
   docker ps | grep spelling-practice
   ```

7. **Add to CasaOS Dashboard** (Optional):
   - Go to CasaOS **Settings** → **Custom Apps**
   - Click **Add Custom App**
   - **Name**: "Spelling Practice"
   - **URL**: `http://localhost:3000`
   - **Icon**: 📝 (or upload custom icon)
   - **Category**: Education

#### CasaOS-Specific Notes:
- **Data Location**: All user data is stored in `/DATA/AppData/spelling/`
- **Automatic Restart**: Container will restart automatically with CasaOS
- **Port Access**: App will be accessible on port 3000
- **Updates**: Use CasaOS container management to update the image
- **Backups**: Data directory can be backed up through CasaOS file manager

#### Troubleshooting CasaOS Installation:
```bash
# Check if container is running
docker ps

# View container logs
docker logs spelling-practice

# Restart container if needed
docker restart spelling-practice

# Check port availability
netstat -tlnp | grep :3000
```

### Option 3: Manual Installation
```bash
# Clone repository
git clone https://git.necloud.us/nmemmert/Spelling.git
cd Spelling

# Install dependencies
npm install

# Start application
npm start
```

---

## 🌐 Access & Default Credentials

After installation, access the application at:
- **Local**: http://localhost:3000
- **CasaOS**: http://your-casaos-ip:3000

### Default Login Credentials

| Username  | Password | Role    | Description |
|-----------|----------|---------|-------------|
| admin1    | password | Admin   | Full access to admin panel |
| student1  | 123456   | Student | Access to practice activities |

> 🔐 **Important**: Change default passwords immediately after first login via Admin Panel → Password Management

---

## ⚙️ Features Overview

### � Student Activities

#### 📝 **Spelling Practice**
- Interactive word-by-word spelling challenges
- Real-time feedback with visual indicators
- Customizable word lists per student
- Progress tracking and accuracy scoring
- Retry system for missed words

#### ⌨️ **Typing Practice**
- Speed and accuracy typing exercises
- WPM (Words Per Minute) calculation
- Error highlighting and correction
- Progressive difficulty levels
- Performance analytics

#### 📖 **Bible Typing (ESV)**
- 15 popular Bible verses for typing practice
- Verse-by-verse comparison and accuracy analysis
- Word-level error detection and highlighting
- Spiritual growth through Scripture memorization
- Progress tracking for Bible study

### 🛠️ **Student Features**
- **Theme Selection**: Choose from multiple UI themes
- **Progress Dashboard**: View personal statistics and achievements
- **Badge System**: Earn badges for milestones and consistent practice
- **Responsive Design**: Optimized for desktop, tablet, and mobile
- **Clean Interface**: Modern, distraction-free learning environment

---

### 👨‍� Admin Panel Features

#### 📊 **User Management**
- Add, edit, and remove student accounts
- Role-based access control (Admin/Student)
- Password management and reset capabilities
- User activity monitoring

#### 📝 **Content Management**
- **Word List Editor**: Create and customize spelling lists per student
- **Bulk Import**: Upload word lists from text/CSV files
- **Category Organization**: Organize words by topics or difficulty
- **Preview Mode**: Test activities before assigning to students

#### 📈 **Analytics & Reporting**
- **Performance Analytics**: Track student progress and trends
- **Detailed Reports**: Generate comprehensive progress reports
- **Export Options**: Download data for external analysis
- **Visual Charts**: Graphical representation of student performance

#### 🏆 **Badge Management**
- **Achievement System**: Configure milestone badges
- **Progress Tracking**: Monitor student achievements
- **Custom Badges**: Create custom rewards for specific goals
- **Badge Viewer**: Visual display of all earned achievements

#### ⚙️ **System Administration**
- **Password Management**: Change admin and student passwords
- **Security Controls**: Manage access permissions
- **Data Backup**: Export/import user data and settings
- **System Monitoring**: View application health and usage

---

## � Configuration

### Environment Variables
```bash
# Optional environment variables
NODE_ENV=production          # Set to production for deployment
PORT=3000                   # Application port (default: 3000)
```

### Data Persistence
The application stores data in JSON files:
- `data/users.json` - User accounts and authentication
- `data/wordlists.json` - Custom word lists per student
- `data/results.json` - Student progress and results
- `data/badges.json` - Achievement and badge data

### Volume Mapping
For Docker installations, map the data directory:
```bash
-v /host/data/path:/app/data
```

---

## �️ Security Features

- **Password Hashing**: SHA-256 encryption for all passwords
- **Role-Based Access**: Separate admin and student interfaces
- **Session Management**: Secure login/logout functionality
- **Input Validation**: Protection against common security vulnerabilities
- **Data Isolation**: Per-user data segregation

---

## 🔄 Updates & Maintenance

### Updating the Application
```bash
# Pull latest image
docker pull git.necloud.us/nmemmert/spelling:latest

# Restart container
docker-compose down && docker-compose up -d
```

### Backup Data
```bash
# Backup user data
docker cp spelling-app:/app/data ./backup-$(date +%Y%m%d)
```

### Logs & Troubleshooting
```bash
# View application logs
docker logs spelling-app

# Follow live logs
docker logs -f spelling-app
```

---

## 🤝 Support & Contributing

- **Issues**: Report bugs and feature requests
- **Documentation**: Comprehensive setup guides
- **Community**: Educational technology discussions

### Technical Specifications
- **Backend**: Node.js 18+ with Express.js
- **Frontend**: Vanilla JavaScript with modern CSS
- **Storage**: JSON-based file system
- **Container**: Multi-stage Docker build (293MB)
- **Security**: SHA-256 password hashing, role-based access

---

## 📄 License

This project is designed for educational use and community deployment.

---

*Built with ❤️ for educators and students everywhere*
