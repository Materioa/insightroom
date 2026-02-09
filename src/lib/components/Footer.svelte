<script>
  import { dev, browser } from "$app/environment";
  import { onMount } from "svelte";

  let props = $props();

  let showProfileMenu = $state(false);
  let showAppearanceMenu = $state(false);

  // Scroll button states
  let scrollY = $state(0);
  let pageHeight = $state(0);
  let windowHeight = $state(0);
  let footerOffset = $state(0);

  let showScrollTop = $derived(scrollY > 200);
  let showScrollBottom = $derived(
    pageHeight > 0 && scrollY < pageHeight - windowHeight - 200,
  );

  function updateScrollInfo() {
    if (!browser) return;
    scrollY = window.scrollY;
    pageHeight = document.documentElement.scrollHeight;
    windowHeight = window.innerHeight;

    // Logic to prevent overlap with footer
    const footer = document.querySelector(".site-footer");
    if (footer) {
      const footerRect = footer.getBoundingClientRect();
      // If the top of the footer enters the viewport
      if (footerRect.top < windowHeight) {
        footerOffset = windowHeight - footerRect.top;
      } else {
        footerOffset = 0;
      }
    }
  }

  onMount(() => {
    updateScrollInfo();
    window.addEventListener("scroll", updateScrollInfo, { passive: true });
    window.addEventListener("resize", updateScrollInfo);

    // Initial check after everything loads
    setTimeout(updateScrollInfo, 1000);

    return () => {
      window.removeEventListener("scroll", updateScrollInfo);
      window.removeEventListener("resize", updateScrollInfo);
    };
  });

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function scrollToBottom() {
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: "smooth",
    });
  }

  function toggleProfileMenu() {
    showProfileMenu = !showProfileMenu;
    if (showProfileMenu) showAppearanceMenu = false;
  }

  function toggleAppearanceMenu() {
    showAppearanceMenu = !showAppearanceMenu;
    if (showAppearanceMenu) showProfileMenu = false;
  }

  function handleLogout() {
    document.cookie =
      "materio_auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;";
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

  /** @param {MouseEvent} event */
  function handleClickOutside(event) {
    const target = /** @type {HTMLElement} */ (event.target);
    const profilePill = target?.closest(".profile-pill-container");
    const appearancePill = target?.closest(".theme-switcher-container");

    if (!profilePill) {
      showProfileMenu = false;
    }
    if (!appearancePill) {
      showAppearanceMenu = false;
    }
  }

  const themeIcons = {
    light: "fa-regular fa-sun-bright",
    dark: "fa-regular fa-moon",
    system: "fa-regular fa-computer-classic",
  };

  const currentThemeIcon = $derived(() => {
    return (
      themeIcons[/** @type {keyof typeof themeIcons} */ (props.currentTheme)] ||
      themeIcons.system
    );
  });

  const fonts = [
    { id: "default", name: "Default", family: "Manrope" },
    { id: "secondary", name: "Sans", family: "Inter" },
    { id: "serif", name: "Serif", family: "Crimson Pro" },
    { id: "system", name: "System", family: "System" },
    { id: "dyslexic", name: "Dyslexic", family: "OpenDyslexic" },
  ];
</script>

<svelte:window onclick={handleClickOutside} />

<div class="global-scroll-controls" style="--footer-offset: {footerOffset}px">
  <button
    class="scroll-btn top"
    class:visible={showScrollTop}
    onclick={scrollToTop}
    aria-label="Scroll to top"
  >
    <i class="fa-solid fa-arrow-up"></i>
  </button>
  <button
    class="scroll-btn bottom"
    class:visible={showScrollBottom}
    onclick={scrollToBottom}
    aria-label="Scroll to bottom"
  >
    <i class="fa-solid fa-arrow-down"></i>
  </button>
</div>

<footer class="site-footer">
  <!-- Profile Pill - Left Side -->
  <div class="profile-pill-container">
    {#if props.user}
      <button class="profile-pill" onclick={toggleProfileMenu}>
        <img
          src={props.user.profilePicture || "/assets/img/default-avatar.svg"}
          alt={props.user.displayName || props.user.username}
          class="profile-avatar"
        />
        <span class="profile-name"
          >{props.user.displayName || props.user.username}</span
        >
        {#if props.accessTier === "plus"}
          <i class="fa-solid fa-badge-check badge-plus" title="Plus Member"></i>
        {:else if props.accessTier === "super"}
          <i class="fa-solid fa-badge-check badge-super" title="Super Member"
          ></i>
        {/if}
      </button>

      <!-- Profile Popup Menu -->
      <div class="popup-menu profile-menu" class:show={showProfileMenu}>
        <button class="menu-item" onclick={goToProfile}>
          <i class="fa-regular fa-user"></i>
          Profile
        </button>
        <button class="menu-item logout" onclick={handleLogout}>
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
      &copy; {new Date().getFullYear()} Materio - The Insightroom
    </p>
  </div>

  <div class="theme-switcher-container">
    <button
      class="appearance-pill"
      onclick={toggleAppearanceMenu}
      aria-label="Appearance Settings"
    >
      <i class={currentThemeIcon() + " active-theme-icon"}></i>
      <i
        class="fa-regular fa-chevron-up chevron-icon"
        class:rotated={showAppearanceMenu}
      ></i>
    </button>

    <div class="appearance-card" class:show={showAppearanceMenu}>
      <h3 class="appearance-title">Appearance</h3>

      <div class="appearance-section">
        <h4 class="section-label">Color mode</h4>
        <div class="theme-grid">
          <button
            class="theme-card"
            class:active={props.currentTheme === "light"}
            onclick={() => props.setTheme("light")}
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
            class="theme-card"
            class:active={props.currentTheme === "system"}
            onclick={() => props.setTheme("system")}
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
            class="theme-card"
            class:active={props.currentTheme === "dark"}
            onclick={() => props.setTheme("dark")}
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

      <div class="appearance-section">
        <h4 class="section-label">Font</h4>
        <div class="font-grid">
          {#each fonts as font}
            <div class="font-item">
              <button
                class="font-option-card"
                class:active={props.currentFont === font.id}
                onclick={() => props.setFont(font.id)}
                style="font-family: {font.family === 'System'
                  ? 'system-ui'
                  : font.family === 'OpenDyslexic'
                    ? 'OpenDyslexicRegular'
                    : font.family === 'Inter'
                      ? 'Inter'
                      : font.family === 'Crimson Pro'
                        ? 'Crimson Pro'
                        : 'Manrope'};"
              >
                Aa
              </button>
              <span class="font-name">{font.name}</span>
            </div>
          {/each}
        </div>
      </div>
    </div>
  </div>
</footer>

<style>
  .site-footer {
    position: relative;
    padding-bottom: 7rem !important;
    display: flex;
    flex-direction: column;
    align-items: center;
    border-top: 1px solid var(--border, rgba(0, 0, 0, 0.05));
    margin-top: 4rem;
  }

  .global-scroll-controls {
    position: fixed;
    bottom: calc(20px + var(--footer-offset, 0px));
    right: 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    z-index: 90;
    transition: bottom 0.2s ease-out;
  }

  .scroll-btn {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: #b8270a;
    border: 2px solid #b8270a;
    color: white;
    cursor: pointer;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 15px;
    transition:
      opacity 0.3s ease,
      visibility 0.3s ease,
      transform 0.3s ease,
      background-color 0.2s ease;
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
  }

  .scroll-btn.visible {
    opacity: 1;
    visibility: visible;
    pointer-events: auto;
  }

  .scroll-btn:hover {
    background: white;
    color: #b8270a;
    transform: translateY(-2px);
  }

  :global(body.dark) .scroll-btn:hover {
    background: #444444;
    border-color: #555555;
    color: #b8270a;
  }

  .profile-pill-container {
    position: absolute;
    bottom: 30px;
    left: 20px;
    z-index: 100;
  }

  .theme-switcher-container {
    position: absolute;
    bottom: 30px;
    right: 20px;
    z-index: 100;
  }

  .profile-pill,
  .appearance-pill {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 6px 16px;
    background: var(--card-bg, #fff);
    border: 1px solid var(--border, rgba(0, 0, 0, 0.1));
    border-radius: 40px;
    corner-shape: squircle;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    font-family: var(--font-primary);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    height: 42px;
    box-sizing: border-box;
    cursor: pointer;
    color: var(--text);
  }

  .active-theme-icon {
    color: var(--text);
    font-size: 16px;
  }

  .profile-pill {
    padding-left: 6px;
  }

  .appearance-pill {
    padding: 6px 14px;
    min-width: 65px;
    justify-content: center;
  }

  .chevron-icon {
    font-size: 10px;
    transition: transform 0.3s ease;
    color: var(--text);
    opacity: 0.6;
  }

  .chevron-icon.rotated {
    transform: rotate(180deg);
  }

  .profile-pill:hover,
  .appearance-pill:hover {
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.12);
    transform: translateY(-2px);
  }

  .profile-avatar {
    width: 30px;
    height: 30px;
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

  .popup-menu,
  .appearance-card {
    position: absolute;
    bottom: calc(100% + 16px);
    background: var(--card-bg, #fff);
    border: 1px solid var(--border, rgba(0, 0, 0, 0.1));
    border-radius: 24px;
    corner-shape: squircle;
    box-shadow:
      0 10px 40px rgba(0, 0, 0, 0.15),
      0 0 0 1px rgba(0, 0, 0, 0.05);
    padding: 8px;
    opacity: 0;
    transform: translateY(12px) scale(0.98);
    pointer-events: none;
    transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    z-index: 1000;
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
  }

  .popup-menu.show,
  .appearance-card.show {
    opacity: 1;
    transform: translateY(0) scale(1);
    pointer-events: auto;
  }

  .profile-menu {
    left: 0;
    min-width: 160px;
  }

  .menu-item {
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
    font-family: var(--font-primary);
    border-radius: 12px;
    corner-shape: squircle;
    text-align: left;
  }

  .menu-item:hover {
    background: rgba(0, 0, 0, 0.04);
  }

  .menu-item.logout {
    color: #dc3545;
  }

  .menu-item.logout:hover {
    background: rgba(220, 53, 69, 0.08);
  }

  .appearance-card {
    right: 0;
    width: 320px;
    padding: 24px;
  }

  .appearance-title {
    font-size: 18px;
    font-weight: 700;
    margin: 0 0 20px 0;
    color: var(--text);
  }

  .appearance-section {
    margin-bottom: 24px;
  }

  .appearance-section:last-child {
    margin-bottom: 0;
  }

  .section-label {
    font-size: 13px;
    font-weight: 600;
    color: var(--text);
    opacity: 0.6;
    margin: 0 0 12px 0;
    letter-spacing: 0.5px;
    text-align: left;
  }

  .theme-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }

  .theme-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    font-family: var(--font-primary);
  }

  .theme-preview {
    width: 100%;
    aspect-ratio: 1.4;
    border-radius: 15px;
    corner-shape: squircle;
    border: 2px solid transparent;
    position: relative;
    overflow: hidden;
    transition: all 0.2s ease;
    display: flex;
    justify-content: center;
    align-items: center;
    background: #f0f0f0;
  }

  .theme-card:hover .theme-preview {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .theme-card.active .theme-preview {
    border-color: #ff8200;
    box-shadow: 0 0 0 1px #ff8200;
  }

  .theme-preview.light {
    background: #ffffff;
    border: 1px solid rgba(0, 0, 0, 0.05);
  }
  .theme-preview.dark {
    background: #1a1a1a;
  }

  .preview-half {
    position: absolute;
    inset: 0;
    width: 50%;
    height: 100%;
  }
  .preview-half.light {
    left: 0;
    background: #ffffff;
  }
  .preview-half.dark {
    right: 0;
    background: #1a1a1a;
  }

  .preview-ui {
    position: absolute;
    bottom: 8px;
    left: 8px;
    right: 8px;
    display: flex;
    flex-direction: column;
    gap: 3px;
    z-index: 1;
    opacity: 0.3;
  }

  .preview-line {
    height: 3px;
    border-radius: 1px;
    background: #888;
  }
  .preview-line.short {
    width: 30%;
  }
  .preview-line.long {
    width: 60%;
  }

  .theme-card span {
    font-size: 12px;
    font-weight: 500;
    color: var(--text);
    font-family: inherit;
  }

  .font-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px 8px;
  }

  .font-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .font-option-card {
    width: 100%;
    aspect-ratio: 1.4;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(128, 128, 128, 0.05);
    border: 2px solid transparent;
    border-radius: 15px;
    corner-shape: squircle;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 24px;
    color: var(--text);
    padding: 0;
  }

  .font-option-card:hover {
    background: rgba(128, 128, 128, 0.1);
    transform: translateY(-2px);
  }

  .font-option-card.active {
    border-color: #ff8200;
    background: rgba(255, 130, 0, 0.05);
  }

  .font-name {
    font-size: 11px;
    font-weight: 600;
    color: var(--text);
    text-align: center;
    line-height: 1.2;
    min-height: 2.4em;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    font-family: var(--font-primary);
  }

  :global(body.dark) .profile-pill,
  :global(body.dark) .appearance-pill,
  :global(body.dark) .popup-menu,
  :global(body.dark) .appearance-card {
    background: #1e1e1e;
    border-color: #333;
  }

  :global(body.dark) .menu-item:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  :global(body.dark) .font-option-card {
    background: rgba(255, 255, 255, 0.03);
  }

  :global(body.dark) .font-option-card:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  @media print {
    .global-scroll-controls {
      display: none !important;
    }
  }

  @media (max-width: 768px) {
    .profile-pill-container {
      bottom: 20px;
      left: 15px;
    }

    .theme-switcher-container {
      bottom: 20px;
      right: 15px;
    }

    .global-scroll-controls {
      bottom: calc(15px + var(--footer-offset, 0px));
      right: 15px;
    }

    .appearance-card {
      width: 280px;
      padding: 16px;
      right: -10px;
    }

    .profile-name {
      max-width: 80px;
    }

    .font-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>
