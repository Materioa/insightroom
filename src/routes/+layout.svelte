<script>
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { browser } from "$app/environment";
  import Header from "$lib/components/Header.svelte";
  import Footer from "$lib/components/Footer.svelte";
  import githubDark from "highlight.js/styles/github-dark.css?raw";
  import a11yLight from "highlight.js/styles/a11y-light.css?raw";

  let { children, data } = $props();

  let isPost = $derived(!!$page.params.postPath);
  let isHome = $derived($page.url.pathname === "/");
  let bodyClass = $derived(isPost ? "body-post" : isHome ? "blog-layout" : "");
  
  // Reactive Svelte 5 Runes for Theme and Font
  let currentTheme = $state(data.theme || "system");
  let currentFont = $state(data.font || "default");
  let systemPrefersDark = $state(false);

  // Derive isDark reactively
  let isDark = $derived(
    currentTheme === "dark" ||
    (currentTheme === "system" && systemPrefersDark)
  );

  // React to prop changes from page navigation/layout data reload
  $effect.pre(() => {
    if (data.theme) currentTheme = data.theme;
    if (data.font) currentFont = data.font;
  });

  $effect(() => {
    if (browser) {
      // Manage theme classes
      document.body.classList.toggle("dark", isDark);
      document.body.classList.toggle("dark-mode", isDark);

      // Manage theme classes on header
      const header = document.querySelector("header");
      if (header) {
        header.classList.toggle("dark", isDark);
        header.classList.toggle("dark-mode", isDark);
      }
      
      // Manage font classes
      const fontClasses = ["font-default", "font-secondary", "font-serif", "font-system", "font-dyslexic", "font-arizona"];
      fontClasses.forEach(c => document.body.classList.remove(c));
      document.body.classList.add(`font-${currentFont}`);
      
      // Manage layout classes
      document.body.classList.toggle("body-post", isPost);
      document.body.classList.toggle("blog-layout", isHome);

      // Dispatch event for components like Mermaid
      window.dispatchEvent(new CustomEvent("themeChanged", { detail: { isDark } }));
    }
  });

  /** @param {string} name */
  function getCookie(name) {
    if (!browser) return null;
    const nameEQ = name + "=";
    const ca = document.cookie.split(";");
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i].trim();
      if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length);
    }
    return null;
  }

  /**
   * @param {string} name
   * @param {string} value
   * @param {number} [days]
   */
  function setCookie(name, value, days) {
    if (!browser) return;
    let expires = "";
    if (days) {
      const date = new Date();
      date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
      expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + value + expires + "; path=/";
  }

  /** @param {string} theme */
  function setTheme(theme) {
    if (!browser) return;
    currentTheme = theme;
    setCookie("theme", theme, 30);
  }

  /** @param {string} font */
  function setFont(font) {
    if (!browser) return;
    currentFont = font;
    setCookie("font", font, 30);
  }

  // Make setters globally available
  if (browser) {
    // @ts-ignore
    window.setTheme = setTheme;
    // @ts-ignore
    window.setFont = setFont;
  }

  onMount(() => {
    // Setup prefers-color-scheme listener
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    systemPrefersDark = mediaQuery.matches;

    /** @param {MediaQueryListEvent} e */
    const handleMediaQueryChange = (e) => {
      systemPrefersDark = e.matches;
    };
    
    // Add listener
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleMediaQueryChange);
    } else {
      mediaQuery.addListener(handleMediaQueryChange);
    }

    // Sync state on mount (ensuring cookies or system media query matches layout data)
    const cookieTheme = getCookie("theme");
    if (cookieTheme) {
      currentTheme = cookieTheme;
    }
    const cookieFont = getCookie("font");
    if (cookieFont) {
      currentFont = cookieFont;
    }

    // @ts-ignore
    if (typeof hljs !== "undefined") hljs.highlightAll();
    // @ts-ignore
    if (typeof renderMathInElement !== "undefined") {
      // @ts-ignore
      renderMathInElement(document.body, {
        delimiters: [
          { left: "$$", right: "$$", display: false },
          { left: "$", right: "$", display: false },
          { left: "\\(", right: "\\)", display: false },
          { left: "\\[", right: "\\]", display: true },
        ],
      });
    }

    // Lazy load Google Adsense to prevent rendering thread blocking on initial load
    const loadAdsense = () => {
      // @ts-ignore
      if (window._adsenseLoaded) return;
      // @ts-ignore
      window._adsenseLoaded = true;
      
      const meta = document.createElement("meta");
      meta.name = "google-adsense-account";
      meta.content = "ca-pub-7539227284131407";
      document.head.appendChild(meta);

      const script = document.createElement("script");
      script.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7539227284131407";
      script.async = true;
      script.crossOrigin = "anonymous";
      document.head.appendChild(script);
    };

    const adsenseTimer = setTimeout(loadAdsense, 2500);
    const triggerEvents = ["mousemove", "scroll", "touchstart", "click"];
    
    const handleInteraction = () => {
      clearTimeout(adsenseTimer);
      loadAdsense();
      triggerEvents.forEach(e => window.removeEventListener(e, handleInteraction));
    };

    triggerEvents.forEach(event => {
      window.addEventListener(event, handleInteraction, { once: true, passive: true });
    });

    return () => {
      clearTimeout(adsenseTimer);
      triggerEvents.forEach(e => window.removeEventListener(e, handleInteraction));
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", handleMediaQueryChange);
      } else {
        mediaQuery.removeListener(handleMediaQueryChange);
      }
    };
  });
</script>

<svelte:head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Materio - The InsightRoom</title>
  <meta name="description" content="The InsightRoom is a place to find insightful reads - a little more than academics." />
  {#if currentTheme === 'system'}
    <meta name="theme-color" content="#faf9f5" media="(prefers-color-scheme: light)" />
    <meta name="theme-color" content="#1f1f1e" media="(prefers-color-scheme: dark)" />
  {:else}
    <meta name="theme-color" content={currentTheme === 'dark' ? '#1f1f1e' : '#faf9f5'} />
  {/if}
  <link
    rel="icon"
    type="image/x-icon"
    href="/assets/img/room-icon-x.svg"
    sizes="256x256"
  />

  <!-- Preconnect to Font Hosts -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
  <link rel="preconnect" href="https://rsms.me/" />
  <link rel="preconnect" href="https://cdn.jsdelivr.net" />

  <!-- Preload Critical Styles & Font -->
  <link rel="preload" href="/assets/style/global.css" as="style" />
  <link rel="preload" href="/assets/style/style.css" as="style" />
  <link rel="preload" href="/assets/style/post.css" as="style" />
  <link rel="preload" href="/assets/fonts/PPMori_Regular.otf" as="font" type="font/otf" crossorigin="anonymous" />

  <!-- Stylesheets -->
  <link rel="stylesheet" href="/assets/style/global.css" />
  <link rel="stylesheet" href="/assets/style/style.css" />
  <link rel="stylesheet" href="/assets/style/post.css" />
  {@html `<style>${isDark ? githubDark : a11yLight}</style>`}

  <!-- Fonts (Non-blocking Asynchronous Loading) -->
  <link
    href="https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,200..900;1,200..900&family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Manrope:wght@200..800&family=Space+Mono:ital,wght@0,400;0,700;1,400;1,700&display=swap"
    rel="stylesheet"
    media="print"
    onload={(e) => { if (e.currentTarget instanceof HTMLLinkElement) e.currentTarget.media = 'all'; }}
  />
  <link
    rel="stylesheet"
    href="https://rsms.me/inter/inter.css"
    media="print"
    onload={(e) => { if (e.currentTarget instanceof HTMLLinkElement) e.currentTarget.media = 'all'; }}
  />

  <noscript>
    <link
      href="https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,200..900;1,200..900&family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Manrope:wght@200..800&family=Space+Mono:ital,wght@0,400;0,700;1,400;1,700&display=swap"
      rel="stylesheet"
    />
    <link rel="stylesheet" href="https://rsms.me/inter/inter.css" />
  </noscript>

  <!-- Materioa Kit (Deferred to prevent parsing block) -->
  <script src="https://materioa.github.io/kit/6a787c7335.js" crossorigin="anonymous" defer></script>
</svelte:head>

<Header
  {isPost}
  {isHome}
  {setTheme}
  {currentTheme}
  {setFont}
  {currentFont}
  user={data.user}
  accessTier={data.accessTier}
/>

<main>
  {@render children()}
</main>

<Footer
  {setTheme}
  {currentTheme}
  {setFont}
  {currentFont}
  user={data.user}
  accessTier={data.accessTier}
/>
