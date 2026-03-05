# 🚀 GitHub Profile Analyzer Dashboard

A modern, responsive, dark-themed dashboard that allows users to analyze GitHub profiles, compare two developers side-by-side, and visualize their top languages and repository statistics—all powered by the GitHub REST API.

![GitHub Profile Analyzer](https://socialify.git.ci/Manoj-Sanagapalli20/Github-profile-viewer/image?description=1&font=Inter&name=1&owner=1&pattern=Circuit%20Board&theme=Dark)

## ✨ Features

- **🔍 Profile Search**: Instantly fetch any public GitHub profile by username.
- **📊 Interactive Charts**: Visualizes repository data like "Most Used Languages" (Pie Chart) and "Top Starred Repos" (Bar Chart) using Chart.js.
- **🆚 User Comparison**: Compare two developers side-by-side! See who has more followers, stars, and repositories with automatic winner highlighting.
- **🌗 Dark / Light Mode**: Beautiful glassmorphism UI with automatic system preference detection and manual toggle.
- **📜 Search History**: Remembers your recent searches using `localStorage` for quick access.
- **🛡️ Unlimited API Requests**: Uses a Vercel Serverless Function proxy to securely attach a GitHub Personal Access Token, protecting against the standard 60 requests/hr rate limit.

## 🛠️ Tech Stack

- **Frontend**: HTML5, CSS3 (Custom Variables, Flexbox/Grid, Glassmorphism), Vanilla JavaScript
- **Data Visualization**: [Chart.js](https://www.chartjs.org/)
- **Backend / Deployment**: [Vercel](https://vercel.com/) (Serverless Functions for secure API routing)
- **API**: [GitHub REST API v3](https://docs.github.com/en/rest)

## 🚀 Live Demo

[View Live Site](https://github-profile-viewer-black-mu.vercel.app/) _(Requires your active Vercel deployment URL)_

## 💻 Local Development Setup

To run this project locally, simply clone the repository and use a local server.

```bash
# 1. Clone the repository
git clone https://github.com/Manoj-Sanagapalli20/Github-profile-viewer.git

# 2. Navigate to directory
cd Github-profile-viewer

# 3. Start a local server (e.g., using Python, Node, or VS Code Live Server)
# If using Python 3:
python -m http.server 8000

# 4. Open in browser
http://localhost:8000
```

> **Note on Rate Limits (Local vs Vercel)**
> When running locally using standard `index.html`, the app falls back to direct unauthenticated GitHub API calls (limited to 60 requests per hour).
> When deployed to Vercel, it routes requests through `/api/github.js` using a stored server-side token (up to 5,000 requests per hour).

## ☁️ Vercel Deployment & Token Configuration

To deploy this yourself and avoid the GitHub API rate limits, follow these steps:

1. **Deploy to Vercel**: Import this repository into your Vercel dashboard.
2. **Generate a GitHub Token**:
   - Go to GitHub -> Settings -> Developer Settings -> Personal access tokens (Tokens (classic)).
   - Generate a new token with **no scopes checked** (or just `public_repo` if you wish). This is enough to increase the rate limit.
3. **Add Environment Variable**:
   - In your Vercel Project Settings, go to **Environment Variables**.
   - Add a new variable:
     - **Name**: `GITHUB_TOKEN`
     - **Value**: `ghp_YOUR_TOKEN_HERE`
4. **Redeploy**: Go to the Deployments tab and hit **Redeploy** so the token is injected into the serverless function.

## 📂 Project Structure

```text
├── index.html       # Main UI skeleton
├── style.css        # Animations, layouts, dark/light themes
├── script.js        # DOM manipulation, stats calculation, Chart.js logic
├── vercel.json      # Routing configuration for Vercel deployment
└── api/
    └── github.js    # Vercel Serverless Function (Handles secure GitHub API calls)
```

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!
Feel free to check [issues page](https://github.com/Manoj-Sanagapalli20/Github-profile-viewer/issues).

## 📜 License

This project is open-source and available under the [MIT License](LICENSE).