document.addEventListener("DOMContentLoaded", () => {
  // Main Elements
  const usernameInput = document.getElementById("usernameInput");
  const compareInput = document.getElementById("compareInput");
  const searchBtn = document.getElementById("searchBtn");
  const themeToggle = document.getElementById("themeToggle");
  const historyList = document.getElementById("historyList");
  const loadingEl = document.getElementById("loading");
  const errorEl = document.getElementById("error");
  const dashboardSection = document.getElementById("dashboardSection");
  const compareSection = document.getElementById("compareSection");

  // Single Profile Elements
  const avatar = document.getElementById("avatar");
  const nameEl = document.getElementById("name");
  const bio = document.getElementById("bio");
  const profileLink = document.getElementById("profileLink");
  const followers = document.getElementById("followers");
  const following = document.getElementById("following");
  const reposCount = document.getElementById("reposCount");
  const reposList = document.getElementById("reposList");

  // Stats Elements
  const totalStarsEl = document.getElementById("totalStars");
  const totalForksEl = document.getElementById("totalForks");
  const avgStarsEl = document.getElementById("avgStars");
  const topLanguageEl = document.getElementById("topLanguage");
  const topRepoEl = document.getElementById("topRepo");
  const accountAgeEl = document.getElementById("accountAge");

  let chartsInstance = {}; // store chart instances for destruction

  // Theme support
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  let currentTheme = localStorage.getItem('gh_theme') || (prefersDark ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', currentTheme);
  updateThemeToggleText();

  themeToggle.addEventListener("click", () => {
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', currentTheme);
    localStorage.setItem('gh_theme', currentTheme);
    updateThemeToggleText();
    // Re-render charts to switch label text colors
    if (window.lastReposData && dashboardSection.classList.contains("hidden") === false) {
      renderCharts(window.lastReposData);
    }
  });

  function updateThemeToggleText() {
    themeToggle.textContent = currentTheme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode';
  }

  // Utilities
  function show(el) { el.classList.remove("hidden"); }
  function hide(el) { el.classList.add("hidden"); }

  // Search History Management
  function loadHistory() {
    const history = JSON.parse(localStorage.getItem("gh_history") || "[]");
    historyList.innerHTML = "";
    if (history.length === 0) {
      historyList.innerHTML = "<li style='color:var(--text-muted); padding:10px;'>No recent searches</li>";
      return;
    }
    history.forEach(user => {
      const li = document.createElement("li");
      li.innerHTML = `<span style="font-size:1.2rem;">🔍</span> ${user}`;
      li.addEventListener("click", () => {
        usernameInput.value = user;
        compareInput.value = "";
        handleSearch();
      });
      historyList.appendChild(li);
    });
  }

  function saveHistory(username) {
    if (!username) return;
    let history = JSON.parse(localStorage.getItem("gh_history") || "[]");
    // Remove if already exists to move it to the top
    history = history.filter(u => u.toLowerCase() !== username.toLowerCase());
    history.unshift(username);
    if (history.length > 5) history.pop(); // Keep only 5
    localStorage.setItem("gh_history", JSON.stringify(history));
    loadHistory();
  }

  loadHistory();

  // Handle Search Actions (Single or Compare)
  async function handleSearch() {
    const mainUser = usernameInput.value.trim();
    const compareUser = compareInput.value.trim();

    if (!mainUser) {
      showError("Please enter a main GitHub username.");
      return;
    }

    // Reset UI
    hide(dashboardSection);
    hide(compareSection);
    hide(errorEl);
    show(loadingEl);

    if (compareUser) {
      saveHistory(mainUser);
      saveHistory(compareUser);
      await processCompare(mainUser, compareUser);
    } else {
      saveHistory(mainUser);
      await processSingleUser(mainUser);
    }
  }

  function showError(msg) {
    hide(loadingEl);
    hide(dashboardSection);
    hide(compareSection);
    errorEl.textContent = msg;
    show(errorEl);
  }

  // Fetch via Vercel serverless proxy (/api/github)
  // The GitHub token is stored as a Vercel environment variable (GITHUB_TOKEN)
  // and is injected server-side — never exposed to the browser.
  async function githubFetch(apiPath) {
    const usernameParam = encodeURIComponent(apiPath.replace(/^users\//, ''));
    return fetch(`/api/github?username=${usernameParam}`);
  }

  // ─── Cache Utilities (Layer 1: Memory  |  Layer 2: localStorage) ──────────
  const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
  const CACHE_PREFIX = 'gh_cache_';
  const sessionCache = new Map(); // in-memory, lives for the browser session

  function getCached(username) {
    const key = username.toLowerCase();
    // Layer 1 — in-memory session cache (instant, no I/O)
    if (sessionCache.has(key)) return sessionCache.get(key);
    // Layer 2 — localStorage (survives page refresh, expires after TTL)
    try {
      const raw = localStorage.getItem(CACHE_PREFIX + key);
      if (!raw) return null;
      const entry = JSON.parse(raw);
      if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
        localStorage.removeItem(CACHE_PREFIX + key);
        return null; // expired
      }
      sessionCache.set(key, entry); // promote to memory for this session
      return entry; // { username, profile, repos, timestamp }
    } catch (_) {
      return null;
    }
  }

  function setCache(username, profile, repos) {
    const key = username.toLowerCase();
    const entry = {
      username: key,
      profile,
      repos,
      timestamp: Date.now()
    };
    sessionCache.set(key, entry); // always write to memory
    try {
      localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
    } catch (_) {
      // Storage quota exceeded — silently ignore
    }
  }
  // ───────────────────────────────────────────────────────────────────────────

  async function fetchUserData(username) {
    const cached = getCached(username);
    if (cached && cached.profile) return cached.profile; // cache hit

    const userResponse = await githubFetch(`users/${username}`);
    if (!userResponse.ok) {
      if (userResponse.status === 404) throw new Error(`User '${username}' not found (404)`);
      if (userResponse.status === 403 || userResponse.status === 429)
        throw new Error(`Rate limit exceeded for GitHub API. Please try again later.`);
      throw new Error(`Failed to fetch user: ${userResponse.status}`);
    }
    return await userResponse.json();
  }

  async function fetchReposData(username) {
    const cached = getCached(username);
    if (cached && cached.repos) return cached.repos; // cache hit

    const reposResponse = await githubFetch(`users/${username}/repos?per_page=100&sort=updated`);
    if (!reposResponse.ok) return [];
    return await reposResponse.json();
  }

  // Single User Logic
  async function processSingleUser(username) {
    try {
      const userData = await fetchUserData(username);

      // Update basic profile
      avatar.src = userData.avatar_url || "";
      avatar.alt = `${userData.login || username}'s avatar`;
      nameEl.textContent = userData.name || userData.login || "No Name Provided";
      bio.textContent = userData.bio || "No bio available.";
      profileLink.href = userData.html_url || "#";
      followers.textContent = userData.followers ?? 0;
      following.textContent = userData.following ?? 0;
      reposCount.textContent = userData.public_repos ?? 0;

      // Stats calculation
      const createdDate = new Date(userData.created_at);
      const ageDiff = new Date() - createdDate;
      const ageYears = (ageDiff / (1000 * 60 * 60 * 24 * 365.25)).toFixed(1);
      accountAgeEl.textContent = isNaN(ageYears) ? "0 Years" : `${ageYears} Years`;

      let reposData = [];
      if (userData.public_repos > 0) {
        reposData = await fetchReposData(username);
      }

      // Persist to cache after fetching both profile and repos
      setCache(username, userData, reposData);

      window.lastReposData = reposData; // cache for theme toggle re-renders

      calculateStats(reposData);
      renderCharts(reposData);
      renderReposList(reposData);

      hide(loadingEl);
      show(dashboardSection);
    } catch (err) {
      showError(err.message || "A network error occurred.");
    }
  }

  function calculateStats(repos) {
    if (!repos || repos.length === 0) {
      totalStarsEl.textContent = "0";
      totalForksEl.textContent = "0";
      avgStarsEl.textContent = "0";
      topLanguageEl.textContent = "-";
      topRepoEl.textContent = "-";
      return;
    }

    let stars = 0, forks = 0;
    let langCount = {};
    let topRepoObj = null;
    let maxStars = -1;

    repos.forEach(r => {
      stars += r.stargazers_count || 0;
      forks += r.forks_count || 0;

      if (r.language) {
        langCount[r.language] = (langCount[r.language] || 0) + 1;
      }

      if ((r.stargazers_count || 0) >= maxStars) {
        maxStars = r.stargazers_count || 0;
        topRepoObj = r;
      }
    });

    totalStarsEl.textContent = stars.toLocaleString();
    totalForksEl.textContent = forks.toLocaleString();
    avgStarsEl.textContent = (stars / repos.length).toFixed(1);

    // Calculate Most Used Language
    let msLang = "-";
    let maxLang = 0;
    for (const [lang, count] of Object.entries(langCount)) {
      if (count > maxLang) { maxLang = count; msLang = lang; }
    }
    topLanguageEl.textContent = msLang;

    topRepoEl.textContent = topRepoObj && topRepoObj.name ? topRepoObj.name : "-";
  }

  function renderCharts(repos) {
    if (chartsInstance.pie) chartsInstance.pie.destroy();
    if (chartsInstance.bar) chartsInstance.bar.destroy();

    if (!repos || repos.length === 0) return; // Note: Canvas remains empty

    const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-main').trim();

    // === Pie Chart Data (Language Distribution) ===
    let langCount = {};
    repos.forEach(r => {
      if (r.language) langCount[r.language] = (langCount[r.language] || 0) + 1;
    });

    const langLabels = Object.keys(langCount);
    const langData = Object.values(langCount);
    const pieColors = ['#ff6384', '#36a2eb', '#ffce56', '#4bc0c0', '#9966ff', '#ff9f40', '#e83e8c', '#20c997'];

    const ctxPie = document.getElementById('langPieChart').getContext('2d');
    chartsInstance.pie = new Chart(ctxPie, {
      type: 'doughnut',
      data: {
        labels: langLabels,
        datasets: [{ data: langData, backgroundColor: pieColors.slice(0, langLabels.length), borderWidth: 0 }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: textColor } } } }
    });

    // === Bar Chart Data (Top 5 Starred Repos) ===
    const sortedRepos = [...repos].sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0)).slice(0, 5);
    const barLabels = sortedRepos.map(r => r.name);
    const barData = sortedRepos.map(r => r.stargazers_count || 0);

    const ctxBar = document.getElementById('starsBarChart').getContext('2d');
    chartsInstance.bar = new Chart(ctxBar, {
      type: 'bar',
      data: {
        labels: barLabels,
        datasets: [{ label: 'Stars', data: barData, backgroundColor: '#58a6ff' }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: textColor, maxRotation: 45, minRotation: 0 } },
          y: { ticks: { color: textColor } }
        }
      }
    });
  }

  function renderReposList(repos) {
    reposList.innerHTML = "";
    if (!repos || repos.length === 0) {
      reposList.innerHTML = "<p>No public repositories found.</p>";
      return;
    }
    // Only show top 6 recent / or just first 6
    const toShow = repos.slice(0, 6);
    reposList.innerHTML = toShow.map(r => {
      const descText = r.description ? (r.description.length > 70 ? r.description.substring(0, 70) + '...' : r.description) : "";
      const desc = r.description ? `<p class="repo-desc">${descText}</p>` : "";
      return `<div class="repo-item">
                <a href="${r.html_url}" target="_blank" rel="noopener noreferrer">${r.name}</a>
                ${desc}
                <div style="font-size:0.85rem; color:var(--text-muted); margin-top:10px;">
                  ⭐ ${r.stargazers_count || 0} | 🍴 ${r.forks_count || 0} 
                  ${r.language ? `| 💻 ${r.language}` : ''}
                </div>
              </div>`;
    }).join("");
  }

  // Compare Two Users Logic
  async function processCompare(user1, user2) {
    try {
      // Fetch concurrently for performance
      const [data1, data2] = await Promise.all([
        fetchUserData(user1).catch(e => { throw new Error(`User 1: ${e.message}`); }),
        fetchUserData(user2).catch(e => { throw new Error(`User 2: ${e.message}`); })
      ]);

      const [repos1, repos2] = await Promise.all([
        data1.public_repos > 0 ? fetchReposData(user1) : Promise.resolve([]),
        data2.public_repos > 0 ? fetchReposData(user2) : Promise.resolve([])
      ]);

      // Persist both users to cache after fetching
      setCache(user1, data1, repos1);
      setCache(user2, data2, repos2);

      const stars1 = repos1.reduce((sum, r) => sum + (r.stargazers_count || 0), 0);
      const stars2 = repos2.reduce((sum, r) => sum + (r.stargazers_count || 0), 0);

      const forks1 = repos1.reduce((sum, r) => sum + (r.forks_count || 0), 0);
      const forks2 = repos2.reduce((sum, r) => sum + (r.forks_count || 0), 0);

      renderCompareCard(1, data1, stars1);
      renderCompareCard(2, data2, stars2);

      // Highlight individual winners
      highlightWinner('cmpFollowers1', 'cmpFollowers2', data1.followers || 0, data2.followers || 0);
      highlightWinner('cmpRepos1', 'cmpRepos2', data1.public_repos || 0, data2.public_repos || 0);
      highlightWinner('cmpStars1', 'cmpStars2', stars1, stars2);

      // Overall winner logic (rough score)
      const score1 = (data1.followers || 0) + stars1;
      const score2 = (data2.followers || 0) + stars2;

      const card1 = document.getElementById('cmpUser1');
      const card2 = document.getElementById('cmpUser2');
      card1.classList.remove('winner-card');
      card2.classList.remove('winner-card');

      if (score1 > score2) card1.classList.add('winner-card');
      else if (score2 > score1) card2.classList.add('winner-card');

      generateDeveloperAnalysis(data1, data2, stars1, stars2, forks1, forks2);

      hide(loadingEl);
      show(compareSection);
    } catch (err) {
      showError(err.message || "A network error occurred during comparison.");
    }
  }

  function renderCompareCard(num, data, stars) {
    document.getElementById(`cmpAvatar${num}`).src = data.avatar_url || "";
    document.getElementById(`cmpName${num}`).textContent = data.name || data.login || "User";
    document.getElementById(`cmpBio${num}`).textContent = data.bio || "No bio available.";
    document.getElementById(`cmpFollowers${num}`).textContent = (data.followers || 0).toLocaleString();
    document.getElementById(`cmpRepos${num}`).textContent = (data.public_repos || 0).toLocaleString();
    document.getElementById(`cmpStars${num}`).textContent = stars.toLocaleString();
    document.getElementById(`cmpLink${num}`).href = data.html_url || "#";
  }

  function highlightWinner(id1, id2, val1, val2) {
    const el1 = document.getElementById(id1);
    const el2 = document.getElementById(id2);
    el1.classList.remove('winner-stat');
    el2.classList.remove('winner-stat');
    // We only highlight if strictly greater
    if (val1 > val2) {
      el1.classList.add('winner-stat');
    } else if (val2 > val1) {
      el2.classList.add('winner-stat');
    }
  }

  function generateDeveloperAnalysis(data1, data2, stars1, stars2, forks1, forks2) {
    const analysisContainer = document.getElementById('developer-analysis');
    if (!analysisContainer) return;

    analysisContainer.innerHTML = '';

    const repos1 = data1.public_repos || 0;
    const repos2 = data2.public_repos || 0;
    const followers1 = data1.followers || 0;
    const followers2 = data2.followers || 0;

    const name1 = data1.login || "User 1";
    const name2 = data2.login || "User 2";

    const getWinner = (val1, val2) => {
      if (val1 > val2) return name1;
      if (val2 > val1) return name2;
      return "Tie";
    };

    const reposWinner = getWinner(repos1, repos2);
    const starsWinner = getWinner(stars1, stars2);
    const forksWinner = getWinner(forks1, forks2);
    const followersWinner = getWinner(followers1, followers2);

    const score1 = (repos1 * 0.25) + (stars1 * 0.35) + (forks1 * 0.20) + (followers1 * 0.20);
    const score2 = (repos2 * 0.25) + (stars2 * 0.35) + (forks2 * 0.20) + (followers2 * 0.20);

    let finalResultHTML = '';
    if (score1 > score2) {
      finalResultHTML = `🏆 ${name1} has a stronger GitHub profile than ${name2}`;
    } else if (score2 > score1) {
      finalResultHTML = `🏆 ${name2} has a stronger GitHub profile than ${name1}`;
    } else {
      finalResultHTML = `Both profiles have similar strength.`;
    }

    const html = `
      <h3>Developer Comparison Analysis</h3>
      <div class="analysis-category">
        <span>Repositories Winner:</span> <strong>${reposWinner}</strong>
      </div>
      <div class="analysis-category">
        <span>Stars Winner:</span> <strong>${starsWinner}</strong>
      </div>
      <div class="analysis-category">
        <span>Forks Winner:</span> <strong>${forksWinner}</strong>
      </div>
      <div class="analysis-category">
        <span>Followers Winner:</span> <strong>${followersWinner}</strong>
      </div>
      <div class="analysis-result">
        ${finalResultHTML}
      </div>
    `;

    analysisContainer.innerHTML = html;
  }

  // Event Listeners
  searchBtn.addEventListener("click", handleSearch);

  usernameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleSearch();
  });

  compareInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleSearch();
  });

});