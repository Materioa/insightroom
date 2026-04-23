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

    // Expose footer offset globally so floating UI can stay in sync.
    document.documentElement.style.setProperty(
      "--global-footer-offset",
      `${footerOffset}px`,
    );
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
      document.documentElement.style.setProperty("--global-footer-offset", "0px");
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

  const currentThemeIcon = $derived(
    themeIcons[/** @type {keyof typeof themeIcons} */ (props.currentTheme)] ||
      themeIcons.system,
  );

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
      <i class={currentThemeIcon + " active-theme-icon"}></i>
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


