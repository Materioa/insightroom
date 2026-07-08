<script>
  import { page } from "$app/stores";
  import { searchTerm, showSearchBoxStore } from "$lib/stores/search";
  import { dev, browser } from "$app/environment";
  import { optimizeSupabaseUrl } from "$lib/utils/image.js";


  let {
    isPost = false,
    isHome = false,
    setTheme,
    currentTheme,
    setFont,
    currentFont,
    user,
    accessTier,
  } = $props();

  let showSettingsMenu = $state(false);
  let showHomeSearch = $state(false);

  function toggleSettingsMenu() {
    showSettingsMenu = !showSettingsMenu;
  }

  /** @param {string} name */
  function expireCookie(name) {
    const expiry = "expires=Thu, 01 Jan 1970 00:00:00 GMT";
    const secure = window.location.protocol === "https:" ? "; secure" : "";
    const domains = ["", "; domain=.getmaterio.app", "; domain=getmaterio.app"];

    for (const domain of domains) {
      document.cookie = `${name}=; path=/; ${expiry}; samesite=lax${domain}${secure}`;
    }
  }

  function handleLogout() {
    expireCookie("materio_auth_token");
    expireCookie("materio_user_id");
    localStorage.removeItem("materio_user_id");
    localStorage.removeItem("has_ask_privileges");
    window.location.reload();
  }

  function goToLogin() {
    const useLocalAuth = false; // Set to true to use local Materio auth service on port 1000
    const loginUrl =
      dev && useLocalAuth
        ? `http://localhost:1000/account?callback=${encodeURIComponent(window.location.href)}`
        : `https://getmaterio.app/account?callback=${encodeURIComponent(window.location.href)}`;
    window.location.href = loginUrl;
  }

  function goToProfile() {
    const useLocalAuth = false; // Set to true to use local Materio auth service on port 1000
    const profileUrl =
      dev && useLocalAuth
        ? "http://localhost:1000/account/profile"
        : "https://getmaterio.app/account/profile";
    window.location.href = profileUrl;
  }

  /** @param {MouseEvent} event */
  function handleClickOutside(event) {
    const target = /** @type {HTMLElement} */ (event.target);
    const settingsContainer = target?.closest(".settings-container");
    if (!settingsContainer) {
      showSettingsMenu = false;
    }
  }

  const fonts = [
    { id: "default", name: "Default", family: "PP Mori" },
    { id: "secondary", name: "Sans", family: "PP Mori" },
    { id: "arizona", name: "Arizona", family: "ABC Arizona Superfamily" },
    { id: "serif", name: "Old", family: "Manrope" },
    { id: "system", name: "System", family: "System" },
    { id: "dyslexic", name: "Dyslexic", family: "OpenDyslexic" },
  ];
</script>

<svelte:window onclick={handleClickOutside} />

<header class="site-header">
  <a href="/" class="header-logo" role="button" aria-label="Go to homepage"></a>

  <!-- Settings container with toggle button and unified modal -->
  <div class="settings-container">
    <!-- Search box trigger for all layouts -->
    <button
      class="header-search-trigger"
      onclick={() => showSearchBoxStore.update(v => !v)}
      aria-label="Search"
      title="Search"
    >
      <svg
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        stroke-width="1"
        stroke-linecap="round"
        stroke-linejoin="round"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
      </svg>
    </button>

    {#if isPost}
      <button
        class="toc-mobile-toggle"
        data-state="closed"
        aria-label="Open table of contents"
        title="Open table of contents"
      >
        <span class="toc-mobile-icon toc-mobile-icon-menu" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            width="22"
            height="22"
            stroke-width="1"
            ><path
              d="M13.5 18.5L9 18.5M13.5 15.5L9 15.5M13.5 9L9 9M13.5 6L9 6M16.5 12.25L6 12.25"
              stroke="currentColor"
              stroke-linecap="square"
            ></path></svg
          >
        </span>
        <span class="toc-mobile-icon toc-mobile-icon-close" aria-hidden="true">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            width="22"
            height="22"
            fill="none"
            stroke="currentColor"
            stroke-width="1"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M6 6L18 18" />
            <path d="M18 6L6 18" />
          </svg>
        </span>
      </button>
    {/if}

    <button
      class="settings-toggle-btn"
      onclick={toggleSettingsMenu}
      aria-label="Settings and Profile"
      title="Settings and Profile"
    >
      <svg
        width="20"
        height="20"
        fill="currentColor"
        viewBox="0 0 25 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M11 9H12V10H11V9Z"></path>
        <path d="M8 9H9V10H8V9Z"></path>
        <path d="M8 6H9V7H8V6Z"></path>
        <path d="M11 6H12V7H11V6Z"></path>
        <path d="M16 17H17V18H16V17Z"></path>
        <path d="M13 17H14V18H13V17Z"></path>
        <path d="M13 14H14V15H13V14Z"></path>
        <path d="M16 14H17V15H16V14Z"></path>
        <path d="M20 9V8H13V7H12V9H20Z"></path>
        <path d="M10 5H9V6H10H11V5H10Z"></path>
        <path d="M11 11V10H9V11H11Z"></path>
        <path d="M4 8V9H8V8V7H7V8H4Z"></path>
        <path d="M20 17V16H18V15H17V17H20Z"></path>
        <path d="M14 13V14H16V13H14Z"></path>
        <path d="M4 16V17H13V15H12V16H4Z"></path>
        <path d="M16 19V18H14V19H16Z"></path>
      </svg>
    </button>

    <div class="settings-overlay" class:show={showSettingsMenu} aria-hidden="true" onclick={toggleSettingsMenu}></div>

    <div
      class="settings-modal"
      class:show={showSettingsMenu}
      style="corner-shape: squircle;"
    >
      <div class="site-toc-sheet-handle" aria-hidden="true">
        <div class="sheet-handle-chevrons">
          <i class="fa-solid fa-chevron-up sheet-handle-icon up"></i>
          <i class="fa-solid fa-chevron-down sheet-handle-icon down"></i>
        </div>
      </div>
      <!-- TOP SECTION: Appearance Settings -->
      <div class="settings-section appearance-section">
        <h3 class="settings-title">Appearance</h3>

        <!-- Color mode -->
        <div class="appearance-subsection">
          <h4 class="section-label">Color mode</h4>
          <div class="theme-grid">
            <button
              type="button"
              class="theme-card"
              class:active={currentTheme === "light"}
              onclick={() => setTheme("light")}
            >
              <div class="theme-preview light">
                <div class="preview-ui">
                  <div class="preview-line short"></div>
                  <div class="preview-line long"></div>
                </div>
              </div>
              <span>Light</span>
            </button>

            <button
              type="button"
              class="theme-card"
              class:active={currentTheme === "system"}
              onclick={() => setTheme("system")}
            >
              <div class="theme-preview system">
                <div class="preview-half light"></div>
                <div class="preview-half dark"></div>
                <div class="preview-ui">
                  <div class="preview-line short"></div>
                  <div class="preview-line long"></div>
                </div>
              </div>
              <span>Auto</span>
            </button>

            <button
              type="button"
              class="theme-card"
              class:active={currentTheme === "dark"}
              onclick={() => setTheme("dark")}
            >
              <div class="theme-preview dark">
                <div class="preview-ui">
                  <div class="preview-line short"></div>
                  <div class="preview-line long"></div>
                </div>
              </div>
              <span>Dark</span>
            </button>
          </div>
        </div>

        <!-- Font -->
        <div class="appearance-subsection" style="margin-top: 16px;">
          <h4 class="section-label">Font</h4>
          <div class="font-grid">
            {#each fonts as font}
              <div class="font-item">
                <button
                  type="button"
                  class="font-option-card"
                  class:active={currentFont === font.id}
                  onclick={() => setFont(font.id)}
                  style="font-family: {font.family === 'System'
                    ? 'system-ui'
                    : font.family === 'OpenDyslexic'
                      ? 'OpenDyslexicRegular'
                      : font.family === 'Manrope'
                        ? 'Manrope'
                        : font.family === 'ABC Arizona Superfamily'
                          ? 'ABC Arizona Superfamily'
                          : 'PP Mori'};"
                >
                  Aa
                </button>
                <span class="font-name">{font.name}</span>
              </div>
            {/each}
          </div>
        </div>
      </div>

      <hr class="settings-divider" />

      <!-- BOTTOM SECTION: Profile Info & Actions -->
      <div class="settings-section profile-section">
        {#if user}
          <div class="profile-info">
            <img
              src={optimizeSupabaseUrl(user.profilePicture || "/assets/img/default-avatar.svg", 30)}
              alt={user.displayName || user.username}
              class="profile-avatar"
              width="30"
              height="30"
            />
            <div class="profile-details">
              <button
                type="button"
                class="profile-link-btn"
                onclick={goToProfile}
                title="View Profile"
              >
                <span class="profile-name-text"
                  >{user.displayName || user.username}</span
                >
                {#if accessTier === "plus"}
                  <i
                    class="fa-solid fa-badge-check badge-plus"
                    title="Plus Member"
                  ></i>
                {:else if accessTier === "super"}
                  <i
                    class="fa-solid fa-badge-check badge-super"
                    title="Super Member"
                  ></i>
                {/if}
              </button>
              <span class="profile-username">@{user.username || "user"}</span>
            </div>
          </div>
          <div class="profile-actions">
            {#if accessTier === "super" || accessTier === "plus"}
              <button
                type="button"
                class="menu-item writer-btn"
                onclick={() => window.location.href = "/writer"}
                style="margin-bottom: 4px;"
              >
                <i class="fa-regular fa-user-pen"></i>
                Go to Writer
              </button>
            {/if}
            <button
              type="button"
              class="menu-item logout"
              onclick={handleLogout}
            >
              <i class="fa-regular fa-right-from-bracket"></i>
              Logout
            </button>
          </div>
        {:else}
          <div class="login-prompt">
            <button
              type="button"
              class="menu-item login-btn"
              onclick={goToLogin}
            >
              <div class="profile-avatar login-icon">
                <i class="fa-solid fa-user"></i>
              </div>
              <span class="profile-name-text">Log In</span>
            </button>
          </div>
        {/if}
      </div>
    </div>
  </div>
</header>

<style>
  .settings-container {
    gap: 6px;
  }

  .header-search-trigger {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    background: transparent;
    border: none;
    border-radius: 50%;
    cursor: pointer;
    color: var(--text, #333);
    transition: background-color 0.2s, color 0.2s, transform 0.2s;
    padding: 0;
  }

  .header-search-trigger:hover {
    color: var(--brand-orange, #ff5400);
    transform: scale(1.05);
  }

  .header-search-trigger:active {
    transform: scale(0.95);
  }

  :global(.dark) .header-search-trigger {
    color: #eee;
  }

  :global(.dark) .header-search-trigger:hover {
    color: #fff;
  }
</style>
