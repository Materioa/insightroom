<script>
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { browser } from "$app/environment";
  import Header from "$lib/components/Header.svelte";
  import Footer from "$lib/components/Footer.svelte";

  let { children, data } = $props();

  let isPost = $derived(!!$page.params.postPath);
  let isHome = $derived($page.url.pathname === "/");
  let bodyClass = $derived(isPost ? "body-post" : isHome ? "blog-layout" : "");
  let isDark = $state(false);
  let currentTheme = $state("system");
  let currentFont = $state("default");

  $effect(() => {
    if (browser) {
      // Manage theme classes
      document.body.classList.toggle("dark", isDark);
      document.body.classList.toggle("dark-mode", isDark);
      
      // Manage font classes
      const fontClasses = ["font-default", "font-secondary", "font-serif", "font-system", "font-dyslexic"];
      fontClasses.forEach(c => document.body.classList.remove(c));
      document.body.classList.add(`font-${currentFont}`);
      
      // Manage layout classes
      document.body.classList.toggle("body-post", isPost);
      document.body.classList.toggle("blog-layout", isHome);
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

  /** @param {boolean} dark */
  function updateHighlightTheme(dark) {
    if (!browser) return;
    const highlightTheme = /** @type {HTMLLinkElement | null} */ (
      document.getElementById("highlight-theme")
    );
    if (!highlightTheme) return;
    highlightTheme.href = dark
      ? "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/styles/github-dark.min.css"
      : "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/styles/a11y-light.min.css";
  }

  /** @param {boolean} dark */
  function applyTheme(dark) {
    isDark = dark;
    if (browser) {
      document.body.classList.toggle("dark", dark);
      document.body.classList.toggle("dark-mode", dark);
      const header = document.querySelector("header");
      if (header) {
        header.classList.toggle("dark", dark);
        header.classList.toggle("dark-mode", dark);
      }
    }
    updateHighlightTheme(dark);
  }

  /** @param {string} theme */
  function setTheme(theme) {
    if (!browser) return;
    currentTheme = theme;
    setCookie("theme", theme, 30);
    if (theme === "dark") {
      applyTheme(true);
    } else if (theme === "light") {
      applyTheme(false);
    } else if (theme === "system") {
      const systemPrefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)",
      ).matches;
      applyTheme(systemPrefersDark);
    }
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
    // Initialize theme
    const userTheme = getCookie("theme") || "system";
    currentTheme = userTheme;
    setTheme(userTheme);

    // Initialize font
    const userFont = getCookie("font") || "default";
    currentFont = userFont;

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
  });
</script>

<svelte:head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="theme-color" content={isDark ? "#1a1a1a" : "#e8e4e0"} />
  <link
    rel="icon"
    type="image/x-icon"
    href="/assets/img/room-icon-x.svg"
    sizes="256x256"
  />

  <!-- Fonts -->
  <link
    href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700&display=swap"
    rel="stylesheet"
  />
  <link
    href="https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&display=swap"
    rel="stylesheet"
  />
  <link rel="preconnect" href="https://rsms.me/" />
  <link rel="stylesheet" href="https://rsms.me/inter/inter.css" />
  <link
    href="https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,200..900;1,200..900&display=swap"
    rel="stylesheet"
  />
  <link
    rel="stylesheet"
    href="https://cdn.jsdelivr.net/npm/open-dyslexic@1.0.3/open-dyslexic-regular.css"
  />

  <!-- Styles -->
  <link rel="stylesheet" href="/assets/style/global.css" />
  <link rel="stylesheet" href="/assets/style/style.css" />
  <link rel="stylesheet" href="/assets/style/post.css" />
  <link
    rel="stylesheet"
    href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css"
  />
  <link
    id="highlight-theme"
    href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/styles/a11y-light.min.css"
    rel="stylesheet"
  />



  <!-- Materioa Kit -->
  <script src="https://materioa.github.io/kit/6a787c7335.js" crossorigin="anonymous"></script>


</svelte:head>

<Header {isPost} {isHome} />

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


