<script>
  import { dev } from "$app/environment";

  let { setTheme, user, accessTier } = $props();

  let showProfileMenu = $state(false);

  function toggleProfileMenu() {
    showProfileMenu = !showProfileMenu;
  }

  function handleLogout() {
    // Clear the auth cookie
    document.cookie =
      "materio_auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;";
    // Reload the page to reflect logged out state
    window.location.reload();
  }

  function goToLogin() {
    const loginUrl = dev
      ? `http://localhost:1000/account?callback=${encodeURIComponent(window.location.href)}`
      : `https://materioa.vercel.app/account?callback=${encodeURIComponent(window.location.href)}`;
    window.location.href = loginUrl;
  }

  function goToProfile() {
    const profileUrl = dev
      ? "http://localhost:1000/account/profile"
      : "https://materioa.vercel.app/account/profile";
    window.location.href = profileUrl;
  }

  // Close menu when clicking outside
  /** @param {MouseEvent} event */
  function handleClickOutside(event) {
    const target = /** @type {HTMLElement} */ (event.target);
    const pill = target?.closest(".profile-pill-container");
    if (!pill) {
      showProfileMenu = false;
    }
  }
</script>

<svelte:window onclick={handleClickOutside} />

<footer class="site-footer">
  <!-- Profile Pill - Left Side -->
  <div class="profile-pill-container">
    {#if user}
      <button class="profile-pill" onclick={toggleProfileMenu}>
        <img
          src={user.profilePicture || "/assets/img/default-avatar.svg"}
          alt={user.displayName || user.username}
          class="profile-avatar"
        />
        <span class="profile-name">{user.displayName || user.username}</span>
        {#if accessTier === "plus"}
          <i class="fa-solid fa-badge-check badge-plus" title="Plus Member"></i>
        {:else if accessTier === "super"}
          <i class="fa-solid fa-badge-check badge-super" title="Super Member"
          ></i>
        {/if}
      </button>

      <!-- Popup Menu -->
      <div class="profile-menu" class:show={showProfileMenu}>
        <button class="profile-menu-item" onclick={goToProfile}>
          <i class="fa-regular fa-user"></i>
          Profile
        </button>
        <button class="profile-menu-item logout" onclick={handleLogout}>
          <i class="fa-regular fa-right-from-bracket"></i>
          Logout
        </button>
      </div>
    {:else}
      <button class="profile-pill" onclick={goToLogin}>
        <div class="profile-avatar login-icon">
          <i class="fa-solid fa-user"></i>
        </div>
        <span class="profile-name">Log In</span>
      </button>
    {/if}
  </div>

  <div class="footer-img">
    <img src="/assets/img/banner.svg" alt="Banner" />
  </div>
  <div class="footer-content">
    <p>
      &copy; {new Date().getFullYear()} Materio - The InsightRoom All rights reserved.
    </p>
  </div>

  <div class="theme-switcher">
    <button
      aria-label="Light Mode"
      onclick={() => setTheme("light")}
      id="light-btn"
    >
      <i class="fa-regular fa-sun-bright"></i>
    </button>
    <button
      aria-label="Dark Mode"
      onclick={() => setTheme("dark")}
      id="dark-btn"
    >
      <i class="fa-regular fa-moon"></i>
    </button>
    <button
      aria-label="System Theme"
      onclick={() => setTheme("system")}
      id="system-btn"
    >
      <i class="fa-regular fa-computer-classic"></i>
    </button>
  </div>
</footer>

<style>
  .site-footer {
    position: relative;
    padding-bottom: 7rem !important; /* Make room for floating pills */
  }
  .profile-pill-container {
    position: absolute;
    bottom: 30px;
    left: 20px;
    z-index: 10;
  }

  .profile-pill,
  .theme-switcher {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 6px 16px;
    background: var(--card-bg, #fff);
    border: 1px solid var(--border, rgba(0, 0, 0, 0.1));
    border-radius: 40px; /* Base radius */
    corner-shape: squircle; /* User requested */
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    font-family: "Manrope", sans-serif;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    height: 42px; /* Fixed height for consistency */
    box-sizing: border-box;
  }

  .profile-pill {
    padding-left: 6px;
    cursor: pointer;
  }

  .theme-switcher {
    margin: 2rem auto 0;
    width: fit-content;
    padding: 6px 16px;
  }

  .theme-switcher button {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1rem;
    color: var(--text);
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    transition:
      transform 0.2s ease,
      opacity 0.2s ease;
  }

  .theme-switcher button:hover {
    transform: scale(1.1);
    opacity: 0.8;
  }

  .profile-pill:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    transform: translateY(-1px);
  }

  .profile-avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    object-fit: cover;
  }

  .profile-avatar.login-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.05);
    color: var(--text);
  }

  :global(body.dark) .profile-avatar.login-icon {
    background: rgba(255, 255, 255, 0.1);
  }

  .profile-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--text, #333);
    max-width: 100px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .badge-plus {
    color: #d4af37;
    font-size: 14px;
  }

  .badge-super {
    color: #800020;
    font-size: 14px;
  }

  /* Popup Menu */
  .profile-menu {
    position: absolute;
    bottom: calc(100% + 8px);
    left: 0;
    background: var(--card-bg, #fff);
    border: 1px solid var(--border, rgba(0, 0, 0, 0.1));
    border-radius: 12px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
    overflow: hidden;
    opacity: 0;
    transform: translateY(10px);
    pointer-events: none;
    transition: all 0.2s ease;
    min-width: 140px;
  }

  .profile-menu.show {
    opacity: 1;
    transform: translateY(0);
    pointer-events: auto;
  }

  .profile-menu-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 12px 16px;
    background: none;
    border: none;
    font-size: 14px;
    font-weight: 500;
    color: var(--text, #333);
    cursor: pointer;
    transition: background 0.15s ease;
    font-family: "Manrope", sans-serif;
  }

  .profile-menu-item:hover {
    background: rgba(0, 0, 0, 0.05);
  }

  .profile-menu-item.logout {
    color: #dc3545;
  }

  .profile-menu-item.logout:hover {
    background: rgba(220, 53, 69, 0.1);
  }

  .profile-menu-item i {
    font-size: 14px;
    width: 16px;
    text-align: center;
  }

  /* Dark mode */
  :global(body.dark) .profile-pill {
    background: #1e1e1e;
    border-color: #333;
  }

  :global(body.dark) .profile-menu {
    background: #1e1e1e;
    border-color: #333;
  }

  :global(body.dark) .profile-menu-item:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  :global(body.dark) .profile-menu-item.logout:hover {
    background: rgba(220, 53, 69, 0.15);
  }

  /* Mobile adjustments */
  @media (max-width: 768px) {
    .profile-pill-container {
      bottom: 30px;
      left: 15px;
    }

    .theme-switcher {
      position: absolute;
      bottom: 30px;
      right: 15px;
      margin: 0;
      padding: 6px 16px;
    }

    .profile-name {
      max-width: 80px;
    }

    .theme-switcher button {
      font-size: 0.9rem;
    }
  }
</style>
