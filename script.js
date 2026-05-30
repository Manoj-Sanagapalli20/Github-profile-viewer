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

  // ─── Scraped GitHub Contribution Parser ───────────────────
  function parseContributions(html) {
    if (!html) {
      return { total: 0, activeDays: 0, maxStreak: 0, currentStreak: 0 };
    }
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    // Extract Total Contributions
    let total = 0;
    const headerEl = tempDiv.querySelector('.js-yearly-contributions h2');
    if (headerEl) {
      const match = headerEl.textContent.match(/([\d,]+)\s+contribution/i);
      if (match) total = parseInt(match[1].replace(/,/g, '')) || 0;
    }

    // Query days
    const dayCells = Array.from(tempDiv.querySelectorAll('td.ContributionCalendar-day, rect.ContributionCalendar-day'));
    dayCells.sort((a, b) => {
      const dateA = a.getAttribute('data-date') || "";
      const dateB = b.getAttribute('data-date') || "";
      return dateA.localeCompare(dateB);
    });

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

    return { total, activeDays, maxStreak, currentStreak };
  }

  // ─── RPG Skill Stats & Class Determiner ───────────────────
  function calculateRPGStats(profile, repos, parsedConts) {
    // 1. Calculate Power (PWR) based on cumulative stars + forks
    let stars = 0, forks = 0;
    let langCountObj = {};
    repos.forEach(r => {
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
    const activeRepos = repos.filter(r => new Date(r.updated_at) > sixtyDaysAgo).length;
    const spScore = Math.min(100, Math.max(10, Math.round(activeRepos * 22)));

    // 3. Calculate Stamina (STM) based on parsed contributions data
    const stmScore = parsedConts 
      ? Math.min(100, Math.max(15, Math.round((parsedConts.activeDays * 0.45) + (parsedConts.maxStreak * 2.2))))
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

    return {
      pwr: pwrScore,
      sp: spScore,
      stm: stmScore,
      vrs: vrsScore,
      className,
      level,
      classBadge,
      flavorText
    };
  }

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
    showAllRepos = false; // Reset expandable toggle state on new search
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
    
    // Theme-adaptive Chart properties
    const isDark = currentTheme === 'dark';
    const chartGridColor = isDark ? 'rgba(26, 35, 51, 0.4)' : 'rgba(208, 215, 222, 0.4)';
    const chartPointBorder = isDark ? '#0b0f17' : '#ffffff';
    const chartTooltipBg = isDark ? '#0d131f' : '#ffffff';
    const chartTooltipTitle = isDark ? '#ffffff' : '#24292f';
    const chartTooltipBody = isDark ? '#58a6ff' : '#218bff';
    const chartTooltipBorder = isDark ? '#1a2333' : '#d0d7de';
    const chartTickColor = isDark ? '#7d8590' : '#57606a';

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
          pointBorderColor: chartPointBorder,
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
            backgroundColor: chartTooltipBg,
            titleColor: chartTooltipTitle,
            bodyColor: chartTooltipBody,
            borderColor: chartTooltipBorder,
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
              color: chartGridColor,
              tickBorderDash: [3, 3]
            },
            ticks: {
              color: chartTickColor,
              font: {
                size: 10
              },
              maxTicksLimit: 10
            }
          },
          y: {
            grid: {
              color: chartGridColor,
              tickBorderDash: [3, 3]
            },
            ticks: {
              color: chartTickColor,
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
  let showAllRepos = false; // toggle state

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

    // Dynamic Show All Button visibility & text calculation
    const reposToggleContainer = document.getElementById("reposToggleContainer");
    const toggleAllReposText = document.getElementById("toggleAllReposText");
    const btnToggleAllRepos = document.getElementById("btnToggleAllRepos");

    if (reposToggleContainer) {
      if (activeReposData.length > 6) {
        reposToggleContainer.classList.remove("hidden");
        if (toggleAllReposText) {
          if (showAllRepos) {
            toggleAllReposText.textContent = "Show Less";
            if (btnToggleAllRepos) btnToggleAllRepos.classList.add("expanded");
          } else {
            toggleAllReposText.textContent = `Show All Projects (${activeReposData.length})`;
            if (btnToggleAllRepos) btnToggleAllRepos.classList.remove("expanded");
          }
        }
      } else {
        reposToggleContainer.classList.add("hidden");
      }
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

    // Slice based on expanded state
    const toShow = showAllRepos ? activeReposData : activeReposData.slice(0, 6);

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
      const [data1, data2, contributionsHTML1, contributionsHTML2] = await Promise.all([
        fetchUserData(user1).catch(e => { throw new Error(`User 1: ${e.message}`); }),
        fetchUserData(user2).catch(e => { throw new Error(`User 2: ${e.message}`); }),
        fetchContributionsData(user1).catch(() => ""),
        fetchContributionsData(user2).catch(() => "")
      ]);

      const [repos1, repos2] = await Promise.all([
        data1.public_repos > 0 ? fetchReposData(user1) : Promise.resolve([]),
        data2.public_repos > 0 ? fetchReposData(user2) : Promise.resolve([])
      ]);

      // Persist both users to cache after fetching
      setCache(user1, data1, repos1, contributionsHTML1);
      setCache(user2, data2, repos2, contributionsHTML2);

      const parsedConts1 = parseContributions(contributionsHTML1);
      const parsedConts2 = parseContributions(contributionsHTML2);

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

      // ─── Calculate Craftsmanship Quality Scores (DQI) ───────
      const calculateDQI = (repos) => {
        if (!repos || repos.length === 0) {
          return { docRate: 0, origRate: 0, avgSizeMB: "0.0", densityRate: 0, dqiScore: 0 };
        }
        const docRepos = repos.filter(r => r.description || (r.topics && r.topics.length > 0) || r.homepage).length;
        const docRate = Math.round((docRepos / repos.length) * 100);

        const originalRepos = repos.filter(r => !r.fork).length;
        const origRate = Math.round((originalRepos / repos.length) * 100);

        const totalSizeKB = repos.reduce((sum, r) => sum + (r.size || 0), 0);
        const avgSizeKB = totalSizeKB / repos.length;
        const avgSizeMB = (avgSizeKB / 1024).toFixed(1);

        // Score avg size out of 100: assume average 15MB is 100 score
        const sizeScore = Math.min(100, Math.round((avgSizeKB / 15360) * 100));
        const densityRate = Math.max(10, sizeScore);

        const dqiScore = Math.round((docRate + origRate + densityRate) / 3);

        return { docRate, origRate, avgSizeMB, densityRate, dqiScore };
      };

      const dqi1 = calculateDQI(repos1);
      const dqi2 = calculateDQI(repos2);

      // ─── Calculate RPG Class Skill Attributes ────────────────
      const rpg1 = calculateRPGStats(data1, repos1, parsedConts1);
      const rpg2 = calculateRPGStats(data2, repos2, parsedConts2);

      // Overall composite builder DNA score
      const score1 = Math.round((dqi1.dqiScore * 0.4) + (rpg1.pwr * 0.2) + (rpg1.sp * 0.15) + (rpg1.stm * 0.15) + (rpg1.vrs * 0.1));
      const score2 = Math.round((dqi2.dqiScore * 0.4) + (rpg2.pwr * 0.2) + (rpg2.sp * 0.15) + (rpg2.stm * 0.15) + (rpg2.vrs * 0.1));

      const card1 = document.getElementById('cmpUser1');
      const card2 = document.getElementById('cmpUser2');
      card1.classList.remove('winner-card');
      card2.classList.remove('winner-card');

      // Clear previous crown classes/displays
      const crown1 = card1.querySelector('.cmp-crown-icon');
      const crown2 = card2.querySelector('.cmp-crown-icon');
      if (crown1) crown1.style.display = 'none';
      if (crown2) crown2.style.display = 'none';

      if (score1 > score2) {
        card1.classList.add('winner-card');
        if (crown1) crown1.style.display = 'block';
      } else if (score2 > score1) {
        card2.classList.add('winner-card');
        if (crown2) crown2.style.display = 'block';
      }

      generateDeveloperAnalysis(data1, data2, rpg1, rpg2, dqi1, dqi2);

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

  function generateDeveloperAnalysis(data1, data2, rpg1, rpg2, dqi1, dqi2) {
    const analysisContainer = document.getElementById('developer-analysis');
    if (!analysisContainer) return;

    analysisContainer.innerHTML = '';

    const name1 = data1.login || "User 1";
    const name2 = data2.login || "User 2";

    // 1. Calculate Tug of War divider percentages
    const getTugWidths = (val1, val2) => {
      const total = (val1 + val2) || 1;
      const w1 = Math.round((val1 / total) * 100);
      const w2 = 100 - w1;
      return { w1, w2 };
    };

    const pwrTug = getTugWidths(rpg1.pwr, rpg2.pwr);
    const spTug = getTugWidths(rpg1.sp, rpg2.sp);
    const stmTug = getTugWidths(rpg1.stm, rpg2.stm);
    const vrsTug = getTugWidths(rpg1.vrs, rpg2.vrs);

    // 2. Calculate compatibility synergy
    const calculateSynergy = (r1, r2) => {
      const diffPwr = Math.abs(r1.pwr - r2.pwr);
      const diffSp = Math.abs(r1.sp - r2.sp);
      const diffStm = Math.abs(r1.stm - r2.stm);
      const diffVrs = Math.abs(r1.vrs - r2.vrs);
      const totalDiff = diffPwr + diffSp + diffStm + diffVrs;

      if (r1.classBadge === r2.classBadge) {
        const syn = Math.min(98, 90 + Math.round(10 - totalDiff / 12));
        return {
          score: syn,
          title: "Coding Twins & Rivals",
          desc: `Both are talented <strong>${r1.className}</strong> classes. You share identical programming instincts and work speed, enabling rapid collaborative development but occasionally competing over who gets to merge changes!`
        };
      }

      if ((r1.classBadge === 'Mage' && r2.classBadge === 'Paladin') || (r2.classBadge === 'Mage' && r1.classBadge === 'Paladin')) {
        const syn = Math.min(99, 94 + Math.round((diffVrs + diffStm) / 10));
        return {
          score: syn,
          title: "The Unstoppable Engine",
          desc: `An absolute dream team! One provides the incredible code consistency and stamina of a <strong>Paladin</strong>, while the other weaves versatile systems architecture magic as an <strong>Archmage</strong>.`
        };
      }

      if ((r1.classBadge === 'Warrior' && r2.classBadge === 'Rogue') || (r2.classBadge === 'Warrior' && r1.classBadge === 'Rogue')) {
        const syn = Math.min(99, 93 + Math.round((diffPwr + diffSp) / 10));
        return {
          score: syn,
          title: "Power & Blinding Speed",
          desc: `A highly lethal combination. One builds massive, global, highly-starred landmark repositories as a <strong>Warlord</strong>, while the other hotfixes, optimizes, and ships at blinding speed as a <strong>Swiftblade</strong>.`
        };
      }

      const syn = Math.min(96, 85 + Math.round(totalDiff / 8));
      return {
        score: syn,
        title: "Balanced Tech Collaborators",
        desc: `Your programming attributes blend in excellent synergy. With highly complementary skills across velocity, stamina, versatility, and power, you make a highly reliable development team.`
      };
    };

    const synergy = calculateSynergy(rpg1, rpg2);

    const html = `
      <div class="arena-grid-panels">
        
        <!-- Section A: 4 Core Dimensions Tug-of-War -->
        <div class="arena-card-premium dna-comparison-card">
          <div class="card-header-arena">
            <span class="arena-icon-wrapper theme-orange">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="4 7 4 4 20 4 20 7"></polyline>
                <line x1="9" y1="20" x2="15" y2="20"></line>
                <line x1="12" y1="4" x2="12" y2="20"></line>
              </svg>
            </span>
            <div class="arena-title-text">
              <h3>Developer DNA Tug-of-War</h3>
              <p>Side-by-side force balance on 4 core programming pillars</p>
            </div>
          </div>

          <div class="tug-sliders-container">
            <!-- Power Row -->
            <div class="tug-slider-row">
              <div class="tug-labels-row">
                <span class="tug-score left-score">${rpg1.pwr}</span>
                <span class="tug-metric-name">⚔️ Power (Code Impact)</span>
                <span class="tug-score right-score">${rpg2.pwr}</span>
              </div>
              <div class="tug-slider-track">
                <div class="tug-bar left-bar" style="width: ${pwrTug.w1}%"></div>
                <div class="tug-bar right-bar" style="width: ${pwrTug.w2}%"></div>
                <div class="tug-marker" style="left: ${pwrTug.w1}%"></div>
              </div>
            </div>

            <!-- Velocity Row -->
            <div class="tug-slider-row">
              <div class="tug-labels-row">
                <span class="tug-score left-score">${rpg1.sp}</span>
                <span class="tug-metric-name">⚡ Velocity (Momentum)</span>
                <span class="tug-score right-score">${rpg2.sp}</span>
              </div>
              <div class="tug-slider-track">
                <div class="tug-bar left-bar" style="width: ${spTug.w1}%"></div>
                <div class="tug-bar right-bar" style="width: ${spTug.w2}%"></div>
                <div class="tug-marker" style="left: ${spTug.w1}%"></div>
              </div>
            </div>

            <!-- Stamina Row -->
            <div class="tug-slider-row">
              <div class="tug-labels-row">
                <span class="tug-score left-score">${rpg1.stm}</span>
                <span class="tug-metric-name">🛡️ Stamina (Consistency)</span>
                <span class="tug-score right-score">${rpg2.stm}</span>
              </div>
              <div class="tug-slider-track">
                <div class="tug-bar left-bar" style="width: ${stmTug.w1}%"></div>
                <div class="tug-bar right-bar" style="width: ${stmTug.w2}%"></div>
                <div class="tug-marker" style="left: ${stmTug.w1}%"></div>
              </div>
            </div>

            <!-- Versatility Row -->
            <div class="tug-slider-row">
              <div class="tug-labels-row">
                <span class="tug-score left-score">${rpg1.vrs}</span>
                <span class="tug-metric-name">🔮 Versatility (Languages)</span>
                <span class="tug-score right-score">${rpg2.vrs}</span>
              </div>
              <div class="tug-slider-track">
                <div class="tug-bar left-bar" style="width: ${vrsTug.w1}%"></div>
                <div class="tug-bar right-bar" style="width: ${vrsTug.w2}%"></div>
                <div class="tug-marker" style="left: ${vrsTug.w1}%"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Section B: Craftsmanship & DQI Score -->
        <div class="arena-card-premium DQI-metrics-card">
          <div class="card-header-arena">
            <span class="arena-icon-wrapper theme-green">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
              </svg>
            </span>
            <div class="arena-title-text">
              <h3>Craftsmanship & Project Quality Index</h3>
              <p>Focusing on code original depth and clean project documentation standards</p>
            </div>
          </div>

          <div class="craftsmanship-grid-arena">
            <!-- DQI Card -->
            <div class="craft-metric-item overall-dqi-item">
              <div class="craft-header-row">
                <h4>Developer Quality Index (DQI)</h4>
                <span class="dqi-formula-tip" title="Composite score of Documentation, Originality, and Size density">Craftsmanship Standard</span>
              </div>
              <div class="craft-comparison-body">
                <div class="craft-user-score left-user">
                  <span class="score-percent">${dqi1.dqiScore}%</span>
                  <span class="username-sub">${name1}</span>
                </div>
                <div class="dqi-vs-bar-container">
                  <div class="dqi-vs-track">
                    <div class="dqi-vs-fill left-fill" style="width: ${dqi1.dqiScore}%"></div>
                  </div>
                  <div class="dqi-vs-track">
                    <div class="dqi-vs-fill right-fill" style="width: ${dqi2.dqiScore}%"></div>
                  </div>
                </div>
                <div class="craft-user-score right-user">
                  <span class="score-percent">${dqi2.dqiScore}%</span>
                  <span class="username-sub">${name2}</span>
                </div>
              </div>
            </div>

            <!-- 3 Specific Metrics Grid -->
            <div class="craft-sub-grid">
              <!-- Doc Rate -->
              <div class="craft-sub-card">
                <div class="sub-card-header">
                  <span>📝 Documentation Rate</span>
                </div>
                <div class="sub-card-comparison">
                  <div class="sub-val left-val ${dqi1.docRate > dqi2.docRate ? 'val-winner' : ''}">${dqi1.docRate}%</div>
                  <div class="sub-divider-vs">vs</div>
                  <div class="sub-val right-val ${dqi2.docRate > dqi1.docRate ? 'val-winner' : ''}">${dqi2.docRate}%</div>
                </div>
                <div class="sub-card-desc">Repos with descriptions or linked homepages</div>
              </div>

              <!-- Originality Focus -->
              <div class="craft-sub-card">
                <div class="sub-card-header">
                  <span>🔨 Originality Focus</span>
                </div>
                <div class="sub-card-comparison">
                  <div class="sub-val left-val ${dqi1.origRate > dqi2.origRate ? 'val-winner' : ''}">${dqi1.origRate}%</div>
                  <div class="sub-divider-vs">vs</div>
                  <div class="sub-val right-val ${dqi2.origRate > dqi1.origRate ? 'val-winner' : ''}">${dqi2.origRate}%</div>
                </div>
                <div class="sub-card-desc">Directly owned projects vs simple forks</div>
              </div>

              <!-- Average Size -->
              <div class="craft-sub-card">
                <div class="sub-card-header">
                  <span>📁 Average Project Depth</span>
                </div>
                <div class="sub-card-comparison">
                  <div class="sub-val left-val ${parseFloat(dqi1.avgSizeMB) > parseFloat(dqi2.avgSizeMB) ? 'val-winner' : ''}">${dqi1.avgSizeMB} MB</div>
                  <div class="sub-divider-vs">vs</div>
                  <div class="sub-val right-val ${parseFloat(dqi2.avgSizeMB) > parseFloat(dqi1.avgSizeMB) ? 'val-winner' : ''}">${dqi2.avgSizeMB} MB</div>
                </div>
                <div class="sub-card-desc">Average storage size of code repositories</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Section C: RPG Compatibility Synergy -->
        <div class="arena-card-premium synergy-clash-card">
          <div class="card-header-arena">
            <span class="arena-icon-wrapper theme-purple">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                <polyline points="2 17 12 22 22 17"></polyline>
                <polyline points="2 12 12 17 22 12"></polyline>
              </svg>
            </span>
            <div class="arena-title-text">
              <h3>Archetype Clash & Team Synergy</h3>
              <p>Compatibility analysis based on role play developer classes</p>
            </div>
          </div>

          <div class="synergy-clash-body">
            <div class="synergy-mini-card left-mini">
              <span class="mini-lvl-badge">Lvl ${rpg1.level}</span>
              <h5>${rpg1.className}</h5>
              <span class="mini-role-tag">${rpg1.classBadge}</span>
            </div>

            <div class="synergy-score-circle-container">
              <div class="synergy-score-radial">
                <svg viewBox="0 0 36 36" class="circular-chart-arena">
                  <path class="circle-bg-arena"
                    d="M18 2.0845
                      a 15.9155 15.9155 0 0 1 0 31.831
                      a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path class="circle-fill-arena"
                    stroke-dasharray="${synergy.score}, 100"
                    d="M18 2.0845
                      a 15.9155 15.9155 0 0 1 0 31.831
                      a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div class="synergy-percentage-label">${synergy.score}%</div>
              </div>
              <span class="synergy-label-sub">Team Synergy</span>
            </div>

            <div class="synergy-mini-card right-mini">
              <span class="mini-lvl-badge">Lvl ${rpg2.level}</span>
              <h5>${rpg2.className}</h5>
              <span class="mini-role-tag">${rpg2.classBadge}</span>
            </div>
          </div>

          <div class="synergy-compatibility-summary">
            <h4>⚔️ Synergy: ${synergy.title}</h4>
            <p>${synergy.desc}</p>
          </div>
        </div>

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

  // Toggle dynamic Show All Repos list expansion
  const btnToggleAllRepos = document.getElementById("btnToggleAllRepos");
  if (btnToggleAllRepos) {
    btnToggleAllRepos.addEventListener("click", () => {
      showAllRepos = !showAllRepos;
      renderReposList(activeReposData, true); // skip sorting, just re-layout
      
      // Smooth scroll back to repositories header if user collapses
      if (!showAllRepos) {
        const reposSection = document.querySelector(".repos-section");
        if (reposSection) {
          reposSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    });
  }

  // === Holographic RPG Persona Card Generator ===
  function generateRPGCard(userData, reposData, contributionsHTML) {
    const rpgCardSection = document.getElementById("rpgCardSection");
    if (!rpgCardSection) return;

    rpgCardSection.innerHTML = "";

    const parsedConts = parseContributions(contributionsHTML);
    const stats = calculateRPGStats(userData, reposData, parsedConts);

    const cardMarkup = `
      <div class="rpg-persona-card">
        <div class="rpg-header">
          <div class="rpg-avatar-wrapper">
            <img src="${userData.avatar_url}" alt="${userData.login}" class="rpg-avatar" />
            <span class="rpg-level-badge">Lvl ${stats.level} ${stats.classBadge}</span>
          </div>
          <h2 class="rpg-class-title">${stats.className}</h2>
          <p class="rpg-flavor-text">"${stats.flavorText}"</p>
        </div>

        <div class="rpg-attributes">
          <div class="attribute-item attr-pwr">
            <div class="attribute-info">
              <span class="attribute-name">⚔️ Power (Impact)</span>
              <span class="attribute-val">${stats.pwr}</span>
            </div>
            <div class="attribute-track">
              <div class="attribute-bar" style="width: ${stats.pwr}%"></div>
            </div>
          </div>

          <div class="attribute-item attr-sp">
            <div class="attribute-info">
              <span class="attribute-name">⚡ Speed (Velocity)</span>
              <span class="attribute-val">${stats.sp}</span>
            </div>
            <div class="attribute-track">
              <div class="attribute-bar" style="width: ${stats.sp}%"></div>
            </div>
          </div>

          <div class="attribute-item attr-stm">
            <div class="attribute-info">
              <span class="attribute-name">🛡️ Stamina (Consistency)</span>
              <span class="attribute-val">${stats.stm}</span>
            </div>
            <div class="attribute-track">
              <div class="attribute-bar" style="width: ${stats.stm}%"></div>
            </div>
          </div>

          <div class="attribute-item attr-vrs">
            <div class="attribute-info">
              <span class="attribute-name">🔮 Versatility (Languages)</span>
              <span class="attribute-val">${stats.vrs}</span>
            </div>
            <div class="attribute-track">
              <div class="attribute-bar" style="width: ${stats.vrs}%"></div>
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