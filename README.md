# 🚀 GitHub Account Analyzer & Enhancer

A web-based **GitHub analytics dashboard** that analyzes developer profiles using the **GitHub REST API** and presents meaningful insights such as repository statistics, language distribution, and profile comparisons.

This project transforms a simple GitHub profile viewer into a **developer analytics tool** that helps understand GitHub activity and repository impact through visualizations and comparisons.

---

## 🌐 Live Demo

🔗 https://github-profile-analysis29.vercel.app

---

## ✨ Features

### 🔎 GitHub Profile Search
Search any GitHub username to view profile information including:

- Avatar
- Username
- Bio
- Followers
- Following
- Public repositories
- Profile link

The data is retrieved using the **GitHub REST API**.

---

### 📦 Repository Insights
Displays a list of public repositories for the searched user with key details:

- Repository name
- Description
- Stars ⭐
- Forks 🍴
- Primary language
- Last updated date

This helps quickly analyze a developer's public projects.

---

### 📊 Language Distribution Chart
Analyzes the programming languages used across repositories and visualizes them using a **Pie Chart**.

Example:

- JavaScript – 5 repositories
- Python – 3 repositories
- HTML – 2 repositories

Implemented using **Chart.js**.

---

### ⭐ Stars Distribution Chart
Displays a **Bar Chart** showing the star count of repositories.

Features:

- Repositories sorted by popularity
- Top repositories visualized
- Helps identify impactful projects

---

### ⚖️ Compare Two GitHub Users
Allows comparison between two GitHub profiles.

Metrics compared:

- Followers
- Public repositories
- Total stars
- Forks

Both profiles are displayed side-by-side for easy analysis.

---

### 🧠 Developer Strength Analysis
The application calculates a **Developer Strength Score** to determine which profile is stronger.

Score formula:

```
score =
(repos * 0.25) +
(stars * 0.35) +
(forks * 0.20) +
(followers * 0.20)
```

The system then displays the result:

🏆 *User A has a stronger GitHub profile than User B*

---

### 🕘 Search History
Stores the **last 5 searched usernames** using `localStorage`.

Features:

- Quick access to recently searched profiles
- Clickable search history
- Faster navigation

---

### ⚡ Performance Optimization (Caching)
To reduce unnecessary API requests and improve performance, the application uses **localStorage caching**.

When a username is searched:

1. The fetched data is stored locally
2. If the same user is searched again within **10 minutes**
3. Cached data is used instead of calling the API

Benefits:

- Faster loading
- Reduced API calls
- Helps avoid GitHub API rate limits

---

## ⚠️ Error Handling

The project includes robust error handling for common issues.

### User Not Found
If a username does not exist:

```
GitHub user not found
```

### API Rate Limit Exceeded

GitHub allows **60 requests per hour for unauthenticated requests**.

If the rate limit is reached, the application displays:

```
GitHub API rate limit exceeded. Please try again later.
```

### Network Errors

Unexpected errors are handled gracefully with user-friendly messages.

---

## 🛠 Tech Stack

**Frontend**

- HTML5
- CSS3
- JavaScript (Vanilla)

**Libraries**

- Chart.js

**API**

- GitHub REST API

**Deployment**

- Vercel

---

## 📁 Project Structure

```
project-folder
│
├── index.html
├── style.css
├── script.js
├── assets/
│   └── loading.gif
└── README.md
```

---

## ⚙️ How It Works

1. User enters a GitHub username
2. Application sends request to **GitHub REST API**
3. Profile and repository data are retrieved
4. Repository data is processed to compute:
   - Language distribution
   - Star distribution
5. Charts are generated using **Chart.js**
6. Search history and cached results are stored in **localStorage**

---

## 🔗 GitHub API Endpoints Used

Fetch user profile

```
https://api.github.com/users/{username}
```

Fetch repositories

```
https://api.github.com/users/{username}/repos
```

---

## 💻 Installation

Clone the repository

```
git clone https://github.com/Manoj-Sanagapalli20/Github-profile-viewer.git
```

Navigate to the project folder

```
cd github-account-analyzer
```

Open the project

```
Open index.html in your browser
```

---

## 🚧 Future Improvements

Possible enhancements:

- GitHub contribution activity visualization
- Radar chart for developer skill comparison
- Repository quality scoring
- Dark / Light theme toggle
- GitHub organization insights

---

## 👨‍💻 Author

**Manoj Sanagapalli**

AIML Student | Software Developer

---

## 📄 License

This project is licensed under the **MIT License**.
