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
      renderCharts(window.lastReposData, window.lastContributionsData);
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

    const rpgCardSection = document.getElementById("rpgCardSection");
    const timelineCardSection = document.getElementById("timelineCardSection");
    if (rpgCardSection) hide(rpgCardSection);
    if (timelineCardSection) hide(timelineCardSection);

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

  function setCache(username, profile, repos, contributions) {
    const key = username.toLowerCase();
    const entry = {
      username: key,
      profile,
      repos,
      contributions: contributions || "",
      timestamp: Date.now()
    };
    sessionCache.set(key, entry); // always write to memory
    try {
      localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
    } catch (_) {
      // Storage quota exceeded — silently ignore
    }
  }

  async function fetchContributionsData(username) {
    const cached = getCached(username);
    if (cached && cached.contributions) return cached.contributions; // cache hit

    const response = await fetch(`/api/contributions?username=${encodeURIComponent(username)}`);
    if (!response.ok) return "";
    return await response.text();
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

  async function processSingleUser(username) {
    try {
      const graphContainer = document.getElementById("contributionGraph");
      const contributionCard = document.getElementById("contributionCard");
      
      // Reset contributions section
      graphContainer.innerHTML = '<div class="spinner" style="margin: 20px auto;"></div>';
      hide(contributionCard);

      // Start fetching contributions in parallel
      const contributionsPromise = fetchContributionsData(username).catch(() => "");

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

      // Wait for contributions to complete
      const contributionsData = await contributionsPromise;

      // Persist to cache after fetching profile, repos and contributions
      setCache(username, userData, reposData, contributionsData);

      window.lastReposData = reposData; // cache for theme toggle re-renders
      window.lastContributionsData = contributionsData; // cache for theme toggle re-renders

      calculateStats(reposData);
      renderCharts(reposData, contributionsData);
      renderReposList(reposData);
      generateRPGCard(userData, reposData, contributionsData);
      generateTimeline(userData, reposData);

      // Inject contributions graph if loaded successfully
      if (contributionsData) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = contributionsData;

        // 1. Extract Total Contributions from text
        let totalCountText = "0";
        const headerEl = tempDiv.querySelector('.js-yearly-contributions h2');
        if (headerEl) {
          const match = headerEl.textContent.match(/([\d,]+)\s+contribution/i);
          if (match) totalCountText = match[1];
        }

        // 2. Query all days
        const dayCells = Array.from(tempDiv.querySelectorAll('td.ContributionCalendar-day, rect.ContributionCalendar-day'));
        
        // Sort chronologically
        dayCells.sort((a, b) => {
          const dateA = a.getAttribute('data-date') || "";
          const dateB = b.getAttribute('data-date') || "";
          return dateA.localeCompare(dateB);
        });

        // 3. Streaks and Active Days Calculations
        let activeDays = 0;
        let maxStreak = 0;
        let currentStreak = 0;
        const todayStr = new Date().toISOString().split('T')[0];

        dayCells.forEach(cell => {
          const date = cell.getAttribute('data-date');
          if (!date) return;

          const level = parseInt(cell.getAttribute('data-level') || "0");
          if (level > 0) {
            activeDays++;
            currentStreak++;
            if (currentStreak > maxStreak) {
              maxStreak = currentStreak;
            }
          } else {
            if (date < todayStr) {
              currentStreak = 0;
            }
          }
        });

        // Dynamic HTML Header and Stats Cards Markup matching the attached premium mockup!
        const heatmapHeaderHTML = `
          <div class="heatmap-header">
            <div class="heatmap-title-container">
              <span class="heatmap-fire-icon">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path>
                </svg>
              </span>
              <div class="heatmap-title-text">
                <h3>Contribution Heatmap</h3>
                <p>Your daily contribution activity over the year</p>
              </div>
            </div>
            
            <div class="heatmap-stats-grid">
              <div class="heatmap-stat-card theme-green">
                <span class="stat-card-icon">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <circle cx="12" cy="12" r="6"></circle>
                    <circle cx="12" cy="12" r="2"></circle>
                  </svg>
                </span>
                <div class="stat-card-details">
                  <span class="stat-card-value">${totalCountText}</span>
                  <span class="stat-card-label">Total</span>
                </div>
              </div>
              <div class="heatmap-stat-card theme-blue">
                <span class="stat-card-icon">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                  </svg>
                </span>
                <div class="stat-card-details">
                  <span class="stat-card-value">${activeDays}</span>
                  <span class="stat-card-label">Active Days</span>
                </div>
              </div>
              <div class="heatmap-stat-card theme-purple">
                <span class="stat-card-icon">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path>
                  </svg>
                </span>
                <div class="stat-card-details">
                  <span class="stat-card-value">${maxStreak}</span>
                  <span class="stat-card-label">Max Streak</span>
                </div>
              </div>
              <div class="heatmap-stat-card theme-orange">
                <span class="stat-card-icon">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
                    <polyline points="17 6 23 6 23 12"></polyline>
                  </svg>
                </span>
                <div class="stat-card-details">
                  <span class="stat-card-value">${currentStreak}</span>
                  <span class="stat-card-label">Current</span>
                </div>
              </div>
            </div>
          </div>
        `;

        // Extract raw table
        const calendarTable = tempDiv.querySelector('.ContributionCalendar-grid');
        let gridHTML = "";
        if (calendarTable) {
          gridHTML = calendarTable.outerHTML;
        } else {
          gridHTML = tempDiv.innerHTML;
        }

        // Custom premium footer legend (dots centered, Less left, More right)
        const legendHTML = `
          <div class="heatmap-legend">
            <span>Less</span>
            <div class="legend-dots">
              <div class="legend-dot" data-level="0"></div>
              <div class="legend-dot" data-level="1"></div>
              <div class="legend-dot" data-level="2"></div>
              <div class="legend-dot" data-level="3"></div>
              <div class="legend-dot" data-level="4"></div>
            </div>
            <span>More</span>
          </div>
        `;

        graphContainer.innerHTML = heatmapHeaderHTML + `<div class="heatmap-grid-container">${gridHTML}</div>` + legendHTML;
        show(contributionCard);
      } else {
        hide(contributionCard);
      }

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

  function renderCharts(repos, contributionsHTML) {
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
    
    // Map language colors
    const langColors = {
      'javascript': '#f1e05a',
      'typescript': '#3178c6',
      'html': '#e34c26',
      'css': '#563d7c',
      'python': '#3572a5',
      'ruby': '#701516',
      'go': '#00add8',
      'java': '#b07219',
      'c++': '#f34b7d',
      'c#': '#178600',
      'c': '#555555',
      'php': '#4f5d95',
      'rust': '#dea584',
      'shell': '#89e051'
    };

    const fallbackColors = ['#ff6384', '#36a2eb', '#ffce56', '#4bc0c0', '#9966ff', '#ff9f40', '#e83e8c', '#20c997'];
    const segmentColors = langLabels.map((lang, idx) => {
      const langLower = lang.toLowerCase();
      return langColors[langLower] || fallbackColors[idx % fallbackColors.length];
    });

    // Update overlay text
    const overlayLangCount = document.getElementById('overlayLangCount');
    if (overlayLangCount) {
      overlayLangCount.textContent = `${langLabels.length} ${langLabels.length === 1 ? 'Language' : 'Languages'}`;
    }

    const ctxPie = document.getElementById('langPieChart').getContext('2d');
    chartsInstance.pie = new Chart(ctxPie, {
      type: 'doughnut',
      data: {
        labels: langLabels,
        datasets: [{
          data: langData,
          backgroundColor: segmentColors,
          borderWidth: 0,
          borderRadius: 4,
          cutout: '75%'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            enabled: true,
            callbacks: {
              label: function(context) {
                const label = context.label || '';
                const value = context.raw || 0;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                return ` ${label}: ${value} repos (${percentage}%)`;
              }
            }
          }
        }
      }
    });

    // === Render Custom Details & Quick Stats ===
    const sortedLangs = Object.entries(langCount)
      .sort((a, b) => b[1] - a[1]);

    const totalReposWithLang = Object.values(langCount).reduce((sum, val) => sum + val, 0);
    const breakdownList = document.getElementById('langBreakdownList');
    if (breakdownList) {
      breakdownList.innerHTML = sortedLangs.map(([lang, count]) => {
        const percentage = totalReposWithLang > 0 ? ((count / totalReposWithLang) * 100).toFixed(1) : 0;
        const langLower = lang.toLowerCase();
        const dotColor = langColors[langLower] || fallbackColors[sortedLangs.findIndex(([l]) => l === lang) % fallbackColors.length];

        return `
          <div class="lang-breakdown-item">
            <div class="item-info-row">
              <div class="item-name-group">
                <span class="item-dot" style="background-color: ${dotColor}"></span>
                <span>${lang}</span>
              </div>
              <span class="item-percentage">${percentage}%</span>
            </div>
            <div class="item-progress-track">
              <div class="item-progress-bar" style="background-color: ${dotColor}; width: ${percentage}%"></div>
            </div>
          </div>
        `;
      }).join('');
    }

    const quickMostUsed = document.getElementById('quickMostUsed');
    const quickTotalLangs = document.getElementById('quickTotalLangs');
    if (quickMostUsed && sortedLangs.length > 0) {
      const topLang = sortedLangs[0][0];
      const topLangLower = topLang.toLowerCase();
      const topColor = langColors[topLangLower] || '#58a6ff';
      quickMostUsed.textContent = topLang;
      quickMostUsed.style.color = topColor;
    }
    if (quickTotalLangs) {
      quickTotalLangs.textContent = langLabels.length;
    }

    // === Recent Activity Chart (Last 30 Days of Contributions) ===
    let contributions = [];
    
    if (contributionsHTML) {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = contributionsHTML;
      
      const dayCells = Array.from(tempDiv.querySelectorAll('td.ContributionCalendar-day, rect.ContributionCalendar-day'));
      
      // Sort chronologically
      dayCells.sort((a, b) => {
        const dateA = a.getAttribute('data-date') || "";
        const dateB = b.getAttribute('data-date') || "";
        return dateA.localeCompare(dateB);
      });
      
      // Slice the last 30 days
      const last30Cells = dayCells.slice(-30);
      
      contributions = last30Cells.map(cell => {
        const dateStr = cell.getAttribute('data-date') || "";
        const count = parseInt(cell.getAttribute('data-count') || cell.getAttribute('data-level') || "0");
        
        // Format date: e.g. "2026-05-21" -> "May 21"
        let formattedDate = dateStr;
        if (dateStr) {
          const parts = dateStr.split('-');
          if (parts.length === 3) {
            const dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            formattedDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          }
        }
        
        return { date: formattedDate, count };
      });
    }

    // Fallback if no contributions are loaded yet
    if (contributions.length === 0) {
      for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const formattedDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        contributions.push({ date: formattedDate, count: 0 });
      }
    }

    let totalAct = contributions.reduce((sum, item) => sum + item.count, 0);
    let peakAct = Math.max(...contributions.map(item => item.count));
    let avgAct = (totalAct / contributions.length).toFixed(1);
    
    // Update HTML pill metrics
    const actTotalEl = document.getElementById('actTotal');
    const actAvgEl = document.getElementById('actAvg');
    const actPeakEl = document.getElementById('actPeak');
    
    if (actTotalEl) actTotalEl.textContent = `${totalAct} Total`;
    if (actAvgEl) actAvgEl.textContent = `${avgAct} Avg/Day`;
    if (actPeakEl) actPeakEl.textContent = `${peakAct} Peak`;

    const ctxAct = document.getElementById('recentActivityChart').getContext('2d');
    
    // Create gradient fill
    const gradientFill = ctxAct.createLinearGradient(0, 0, 0, 250);
    gradientFill.addColorStop(0, 'rgba(88, 166, 255, 0.25)');
    gradientFill.addColorStop(1, 'rgba(88, 166, 255, 0.0)');
    
    chartsInstance.bar = new Chart(ctxAct, {
      type: 'line',
      data: {
        labels: contributions.map(item => item.date),
        datasets: [{
          label: 'Contributions',
          data: contributions.map(item => item.count),
          borderColor: '#58a6ff',
          borderWidth: 2.5,
          pointBackgroundColor: '#58a6ff',
          pointBorderColor: '#0b0f17',
          pointBorderWidth: 1.5,
          pointRadius: 4,
          pointHoverRadius: 6,
          fill: true,
          backgroundColor: gradientFill,
          tension: 0.3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            enabled: true,
            backgroundColor: '#0d131f',
            titleColor: '#ffffff',
            bodyColor: '#58a6ff',
            borderColor: '#1a2333',
            borderWidth: 1,
            padding: 10,
            displayColors: false,
            callbacks: {
              label: function(context) {
                return ` ${context.raw} contributions`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              color: 'rgba(26, 35, 51, 0.4)',
              tickBorderDash: [3, 3]
            },
            ticks: {
              color: '#7d8590',
              font: {
                size: 10
              },
              maxTicksLimit: 10
            }
          },
          y: {
            grid: {
              color: 'rgba(26, 35, 51, 0.4)',
              tickBorderDash: [3, 3]
            },
            ticks: {
              color: '#7d8590',
              font: {
                size: 10
              },
              stepSize: 1,
              precision: 0
            }
          }
        }
      }
    });
  }

  let activeReposData = [];
  let currentSortMode = 'updated';
  let currentViewMode = 'grid';

  function renderReposList(repos, skipSort = false) {
    if (!repos) return;
    
    // Save to local reference
    if (repos !== activeReposData) {
      activeReposData = repos;
    }

    reposList.innerHTML = "";
    if (activeReposData.length === 0) {
      reposList.innerHTML = "<p style='color:var(--text-muted); grid-column: 1/-1; text-align: center; padding: 20px;'>No public repositories found.</p>";
      return;
    }

    // Sort repositories if not skipped
    if (!skipSort) {
      activeReposData.sort((a, b) => {
        if (currentSortMode === 'stars') {
          return (b.stargazers_count || 0) - (a.stargazers_count || 0);
        } else if (currentSortMode === 'forks') {
          return (b.forks_count || 0) - (a.forks_count || 0);
        } else if (currentSortMode === 'name') {
          return a.name.localeCompare(b.name);
        } else {
          // Default: updated
          return new Date(b.updated_at) - new Date(a.updated_at);
        }
      });
    }

    // Map language colors
    const langColors = {
      'javascript': '#f1e05a',
      'typescript': '#3178c6',
      'html': '#e34c26',
      'css': '#563d7c',
      'python': '#3572a5',
      'ruby': '#701516',
      'go': '#00add8',
      'java': '#b07219',
      'c++': '#f34b7d',
      'c#': '#178600',
      'c': '#555555',
      'php': '#4f5d95',
      'rust': '#dea584',
      'shell': '#89e051'
    };

    // Slice top 6
    const toShow = activeReposData.slice(0, 6);

    reposList.innerHTML = toShow.map(r => {
      // Date formatting: DD/MM/YYYY matching mockup
      const dateObj = new Date(r.updated_at);
      const day = String(dateObj.getDate()).padStart(2, '0');
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const year = dateObj.getFullYear();
      const formattedDate = `${day}/${month}/${year}`;

      // Language dot color
      const langLower = (r.language || "").toLowerCase();
      const dotColor = langColors[langLower] || '#58a6ff';

      return `
        <div class="repo-item-premium">
          <div class="repo-top-premium">
            <a href="${r.html_url}" target="_blank" rel="noopener noreferrer" class="repo-title-premium">${r.name}</a>
          </div>
          
          <div class="repo-badge-pills">
            ${r.language ? `
            <span class="repo-badge-pill lang-pill">
              <span class="lang-dot" style="background-color: ${dotColor}"></span>
              ${r.language}
            </span>` : ''}
            
            <span class="repo-badge-pill stars-pill">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="badge-icon icon-star"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
              ${r.stargazers_count || 0}
            </span>
            
            <span class="repo-badge-pill forks-pill">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="badge-icon icon-fork"><line x1="6" y1="3" x2="6" y2="15"></line><circle cx="18" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle><path d="M18 9a9 9 0 0 1-9 9"></path></svg>
              ${r.forks_count || 0}
            </span>
            
            <span class="repo-badge-pill watchers-pill">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="badge-icon icon-eye"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              ${r.watchers_count || 0}
            </span>
          </div>
          
          <div class="repo-footer-premium">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="icon-clock"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            <span>Updated ${formattedDate}</span>
          </div>
        </div>
      `;
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

  // Repos Control Event Listeners (Grid/List & Sorting)
  const btnViewGrid = document.getElementById("btnViewGrid");
  const btnViewList = document.getElementById("btnViewList");
  
  const sortButtons = {
    stars: document.getElementById("btnSortStars"),
    updated: document.getElementById("btnSortUpdated"),
    name: document.getElementById("btnSortName"),
    forks: document.getElementById("btnSortForks")
  };

  if (btnViewGrid && btnViewList) {
    btnViewGrid.addEventListener("click", () => {
      currentViewMode = 'grid';
      btnViewGrid.classList.add("active");
      btnViewList.classList.remove("active");
      reposList.className = "repos-list grid-view";
      renderReposList(activeReposData, true); // re-render layout, skip sorting
    });

    btnViewList.addEventListener("click", () => {
      currentViewMode = 'list';
      btnViewList.classList.add("active");
      btnViewGrid.classList.remove("active");
      reposList.className = "repos-list list-view";
      renderReposList(activeReposData, true); // re-render layout, skip sorting
    });
  }

  Object.entries(sortButtons).forEach(([mode, btn]) => {
    if (btn) {
      btn.addEventListener("click", () => {
        currentSortMode = mode;
        // Toggle active states
        Object.values(sortButtons).forEach(b => { if (b) b.classList.remove("active"); });
        btn.classList.add("active");
        renderReposList(activeReposData); // re-sort and render!
      });
    }
  });

  // === Holographic RPG Persona Card Generator ===
  function generateRPGCard(userData, reposData, contributionsHTML) {
    const rpgCardSection = document.getElementById("rpgCardSection");
    if (!rpgCardSection) return;

    rpgCardSection.innerHTML = "";

    // 1. Calculate Power (PWR) based on cumulative stars + forks
    let stars = 0, forks = 0;
    let langCountObj = {};
    reposData.forEach(r => {
      stars += r.stargazers_count || 0;
      forks += r.forks_count || 0;
      if (r.language) {
        langCountObj[r.language] = (langCountObj[r.language] || 0) + 1;
      }
    });
    const totalImpact = stars + forks;
    const pwrScore = Math.min(100, Math.max(12, Math.round(Math.sqrt(totalImpact) * 16)));

    // 2. Calculate Speed (SP) based on repositories active in the past 60 days
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    const activeRepos = reposData.filter(r => new Date(r.updated_at) > sixtyDaysAgo).length;
    const spScore = Math.min(100, Math.max(10, Math.round(activeRepos * 22)));

    // 3. Calculate Stamina (STM) based on contributions calendar data
    let activeDays = 0;
    let maxStreak = 0;
    if (contributionsHTML) {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = contributionsHTML;
      const dayCells = tempDiv.querySelectorAll('td.ContributionCalendar-day, rect.ContributionCalendar-day');
      let currentStreak = 0;
      const todayStr = new Date().toISOString().split('T')[0];

      dayCells.forEach(cell => {
        const date = cell.getAttribute('data-date');
        if (!date) return;
        const level = parseInt(cell.getAttribute('data-level') || "0");
        if (level > 0) {
          activeDays++;
          currentStreak++;
          if (currentStreak > maxStreak) maxStreak = currentStreak;
        } else {
          if (date < todayStr) currentStreak = 0;
        }
      });
    }
    const stmScore = contributionsHTML 
      ? Math.min(100, Math.max(15, Math.round((activeDays * 0.45) + (maxStreak * 2.2))))
      : 50;

    // 4. Calculate Versatility (VRS) based on distinct languages
    const distinctLangs = Object.keys(langCountObj).length;
    const vrsScore = Math.min(100, Math.max(10, Math.round(distinctLangs * 18)));

    // Determine highest attribute for Class determination
    const scores = { PWR: pwrScore, SP: spScore, STM: stmScore, VRS: vrsScore };
    let highestAttr = "SP";
    let maxVal = -1;
    for (const [attr, val] of Object.entries(scores)) {
      if (val > maxVal) {
        maxVal = val;
        highestAttr = attr;
      }
    }

    let className = "Rapid Swiftblade";
    let level = Math.max(1, Math.round((spScore + vrsScore) / 5.2));
    let classBadge = "Rogue";
    let flavorText = "A silent, rapid striker. Pushing hotfixes, refactoring architectures, and launching builds at blinding speeds. You resolve bugs before the browser can even refresh!";

    if (highestAttr === "PWR") {
      className = "Elite Code Warlord";
      level = Math.max(1, Math.round((pwrScore + stmScore) / 5.2));
      classBadge = "Warrior";
      flavorText = "Your code holds colossal impact. Starred and forked by developers worldwide, you forge high-caliber repository monuments that stand tall in the GitHub arena!";
    } else if (highestAttr === "STM") {
      className = "Commit Paladin";
      level = Math.max(1, Math.round((stmScore + spScore) / 5.2));
      classBadge = "Paladin";
      flavorText = "An unstoppable force of commits. Day after day, you push green nodes into the calendar grid, building an unbreakable coding legacy through pure grit!";
    } else if (highestAttr === "VRS") {
      className = "Polyglot Archmage";
      level = Math.max(1, Math.round((vrsScore + pwrScore) / 5.2));
      classBadge = "Mage";
      flavorText = "A master of many tongues, weaving spells in JavaScript, Python, and CSS. No tech stack is too foreign, and no compiler can resist your incantations!";
    }

    const cardMarkup = `
      <div class="rpg-persona-card">
        <div class="rpg-header">
          <div class="rpg-avatar-wrapper">
            <img src="${userData.avatar_url}" alt="${userData.login}" class="rpg-avatar" />
            <span class="rpg-level-badge">Lvl ${level} ${classBadge}</span>
          </div>
          <h2 class="rpg-class-title">${className}</h2>
          <p class="rpg-flavor-text">"${flavorText}"</p>
        </div>

        <div class="rpg-attributes">
          <div class="attribute-item attr-pwr">
            <div class="attribute-info">
              <span class="attribute-name">⚔️ Power (Impact)</span>
              <span class="attribute-val">${pwrScore}</span>
            </div>
            <div class="attribute-track">
              <div class="attribute-bar" style="width: ${pwrScore}%"></div>
            </div>
          </div>

          <div class="attribute-item attr-sp">
            <div class="attribute-info">
              <span class="attribute-name">⚡ Speed (Velocity)</span>
              <span class="attribute-val">${spScore}</span>
            </div>
            <div class="attribute-track">
              <div class="attribute-bar" style="width: ${spScore}%"></div>
            </div>
          </div>

          <div class="attribute-item attr-stm">
            <div class="attribute-info">
              <span class="attribute-name">🛡️ Stamina (Consistency)</span>
              <span class="attribute-val">${stmScore}</span>
            </div>
            <div class="attribute-track">
              <div class="attribute-bar" style="width: ${stmScore}%"></div>
            </div>
          </div>

          <div class="attribute-item attr-vrs">
            <div class="attribute-info">
              <span class="attribute-name">🔮 Versatility (Languages)</span>
              <span class="attribute-val">${vrsScore}</span>
            </div>
            <div class="attribute-track">
              <div class="attribute-bar" style="width: ${vrsScore}%"></div>
            </div>
          </div>
        </div>
      </div>
    `;

    rpgCardSection.innerHTML = cardMarkup;
    rpgCardSection.classList.remove("hidden");
  }

  // === Chronological Coding Journey Timeline Generator ===
  function generateTimeline(userData, reposData) {
    const timelineCardSection = document.getElementById("timelineCardSection");
    if (!timelineCardSection) return;

    timelineCardSection.innerHTML = "";

    const sortedRepos = [...reposData].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const milestones = [];

    // Milestone 1: Account Creation
    if (userData.created_at) {
      const createdDate = new Date(userData.created_at);
      milestones.push({
        date: createdDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        title: "Started Coding Journey",
        desc: `You officially created your GitHub account <strong>@${userData.login}</strong>! This marked the beginning of your software engineering journey.`,
        type: "ms-creation"
      });
    }

    // Milestone 2: First Repository
    if (sortedRepos.length > 0) {
      const repo = sortedRepos[0];
      const repoDate = new Date(repo.created_at);
      milestones.push({
        date: repoDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        title: "First Public Project",
        desc: `Created your very first public repository: <a href="${repo.html_url}" target="_blank" class="repo-title-premium" style="font-size:inherit; font-weight:700;">${repo.name}</a> and committed your first set of files!`,
        type: "ms-creation"
      });
    }

    // Milestone 3: Language Acquisitions
    const acquiredLangs = new Set();
    let languageMilestonesCount = 0;
    for (let i = 0; i < sortedRepos.length; i++) {
      const repo = sortedRepos[i];
      if (repo.language && !acquiredLangs.has(repo.language)) {
        acquiredLangs.add(repo.language);
        languageMilestonesCount++;
        const repoDate = new Date(repo.created_at);
        milestones.push({
          date: repoDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          title: `First ${repo.language} Project`,
          desc: `Used <strong>${repo.language}</strong> for the first time on GitHub by creating your repository <a href="${repo.html_url}" target="_blank" class="repo-title-premium" style="font-size:inherit; font-weight:700;">${repo.name}</a>!`,
          type: "ms-language"
        });
        if (languageMilestonesCount >= 3) break; // Limit to first 3 distinct languages to keep timeline concise
      }
    }

    // Milestone 4: Most Starred Repository
    if (reposData.length > 0) {
      const sortedByStars = [...reposData].sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0));
      const topRepo = sortedByStars[0];
      if (topRepo && topRepo.stargazers_count > 0) {
        const repoDate = new Date(topRepo.created_at);
        milestones.push({
          date: repoDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          title: "Most Popular Project 🌟",
          desc: `Created <a href="${topRepo.html_url}" target="_blank" class="repo-title-premium" style="font-size:inherit; font-weight:700;">${topRepo.name}</a>, which earned ${topRepo.stargazers_count} stars and became your most popular project on GitHub!`,
          type: "ms-starred"
        });
      }
    }

    // Milestone 5: Present Active State
    milestones.push({
      date: new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      title: "The Journey Continues",
      desc: "Currently active, committing code, building new projects, and learning new technologies. The road ahead is open!",
      type: "ms-latest"
    });

    // Remove duplicates or sort chronologically to be absolutely certain
    milestones.sort((a, b) => {
      if (a.title.includes("Started")) return -1;
      if (b.title.includes("Started")) return 1;
      if (a.title.includes("Continues")) return 1;
      if (b.title.includes("Continues")) return -1;
      return new Date(a.date) - new Date(b.date);
    });

    // Render Timeline Header
    let timelineHTML = `
      <div class="timeline-header">
        <span class="timeline-compass-icon">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon>
          </svg>
        </span>
        <div class="timeline-title-text">
          <h3>Coding Journey Timeline</h3>
          <p>A timeline of your major programming milestones on GitHub</p>
        </div>
      </div>
      <div class="odyssey-timeline">
        <div class="odyssey-line"></div>
    `;

    // Render Timeline Items
    milestones.forEach((ms, index) => {
      const alignment = index % 2 === 0 ? "odyssey-left" : "odyssey-right";
      timelineHTML += `
        <div class="odyssey-item ${alignment} ${ms.type}">
          <div class="odyssey-marker"></div>
          <div class="odyssey-card-wrapper">
            <div class="odyssey-card">
              <span class="odyssey-date">${ms.date}</span>
              <h4>${ms.title}</h4>
              <p>${ms.desc}</p>
            </div>
          </div>
        </div>
      `;
    });

    timelineHTML += `</div>`;
    timelineCardSection.innerHTML = timelineHTML;
    timelineCardSection.classList.remove("hidden");
  }

});