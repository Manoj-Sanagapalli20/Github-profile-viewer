// #####################################################################################
document.addEventListener("DOMContentLoaded", () => {
  // Element references (match exactly the IDs in your HTML)
  const usernameInput = document.getElementById("usernameInput");
  const searchBtn = document.querySelector(".search-box button");
  const profileContainer = document.getElementById("profileContainer");
  const avatar = document.getElementById("avatar");
  const nameEl = document.getElementById("name");
  const bio = document.getElementById("bio");
  const profileLink = document.getElementById("profileLink");
  const followers = document.getElementById("followers");
  const following = document.getElementById("following");
  const reposCount = document.getElementById("reposCount");
  const reposList = document.getElementById("reposList");
  const errorEl = document.getElementById("error");

  // Utility: show / hide helpers (assumes .hidden class in your CSS)
  function show(el) { el.classList.remove("hidden"); }
  function hide(el) { el.classList.add("hidden"); }

  async function getUser() {
    const username = usernameInput.value.trim();
    // reset UI
    hide(profileContainer);
    reposList.innerHTML = "";
    errorEl.textContent = "";

    if (!username) {
      errorEl.textContent = "Please enter a username!";
      show(errorEl);
      return;
    }

    try {
      // Fetch user data
      const userResponse = await fetch(`https://api.github.com/users/${username}`);
      if (!userResponse.ok) {
        if (userResponse.status === 404) throw new Error("User not found (404)");
        throw new Error(`Error: ${userResponse.status}`);
      }
      const userData = await userResponse.json();

      // Fill profile info (guard checks not strictly necessary because elements exist)
      avatar.src = userData.avatar_url || "";
      avatar.alt = `${userData.login || username}'s avatar`;
      nameEl.textContent = userData.name || userData.login || "";
      bio.textContent = userData.bio || "No bio available for the user.";
      profileLink.href = userData.html_url || "#";
      profileLink.textContent = "View Profile ↗";
      followers.textContent = userData.followers ?? 0;
      following.textContent = userData.following ?? 0;
      reposCount.textContent = userData.public_repos ?? 0;

      // Fetch top repos (you can change per_page)
      if (userData.public_repos > 0) {
        const reposResponse = await fetch(`https://api.github.com/users/${username}/repos?per_page=10&sort=updated`);
        if (reposResponse.ok) {
          const repos = await reposResponse.json();
          reposList.innerHTML = repos.map(r => {
            const desc = r.description ? ` — ${r.description}` : "";
            return `<div class="repo-item">
                      <a href="${r.html_url}" target="_blank" rel="noopener noreferrer">${r.name}</a>
                      <span class="repo-desc">${desc}</span>
                    </div>`;
          }).join("");
        } else {
          reposList.innerHTML = "<p>Unable to load repos.</p>";
        }
      } else {
        reposList.innerHTML = "<p>No public repositories.</p>";
      }

      // show profile
      show(profileContainer);
      hide(errorEl);
    } catch (err) {
      console.error(err);
      errorEl.textContent = err.message || "An error occurred";
      show(errorEl);
    }
  }

  // Wire up button (preferred to inline onclick)
  if (searchBtn) {
    searchBtn.addEventListener("click", getUser);
  } else {
    // fallback if your HTML changes
    window.getUser = getUser; // makes it callable by inline onclick if needed
  }

  // optionally allow Enter key on input
  usernameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") getUser();
  });
});
// ####################################################################################################
