<script>
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { browser } from "$app/environment";
  import Header from "$lib/components/Header.svelte";
  import Footer from "$lib/components/Footer.svelte";

  let { children, data } = $props();

  let isPost = $derived(!!$page.params.slug);
  let isHome = $derived($page.url.pathname === "/");
  let bodyClass = $derived(isPost ? "body-post" : isHome ? "blog-layout" : "");
  let isDark = $state(false);
  let currentTheme = $state("system");
  let currentFont = $state("default");

  $effect(() => {
    if (browser) {
      document.body.className =
        bodyClass + (isDark ? " dark dark-mode" : "") + ` font-${currentFont}`;
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
  <link rel="stylesheet" href="/assets/style/style.css" />
  <link rel="stylesheet" href="/assets/style/post.css" />
  <link
    rel="stylesheet"
    href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css"
  />
  <link
    id="highlight-theme"
    href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/styles/github-dark.min.css"
    rel="stylesheet"
  />

  <!-- Scripts -->
  <script
    defer
    src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js"
  ></script>
  <script
    defer
    src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/contrib/auto-render.min.js"
  ></script>
  <script
    src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/highlight.min.js"
  ></script>
  <script
    src="https://cdn.jsdelivr.net/npm/mermaid@10.6.1/dist/mermaid.min.js"
  ></script>

  <!-- Markmap for mindmaps -->
  <script src="https://cdn.jsdelivr.net/npm/d3@7"></script>
  <script src="https://cdn.jsdelivr.net/npm/markmap-view@0.18.12"></script>
  <script src="https://cdn.jsdelivr.net/npm/markmap-lib@0.18.12"></script>

  <!-- Graphviz for FSM/automata diagrams -->
  <script
    src="https://cdn.jsdelivr.net/npm/@viz-js/viz@3.11.0/lib/viz-standalone.js"
  ></script>
  <script
    src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"
  ></script>
  <script
    src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js"
  ></script>
  <script>
    if (typeof window !== "undefined" && window.pdfjsLib) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js";
    }
  </script>

  <!-- FontAwesome -->
  <link
    rel="stylesheet"
    href="https://site-assets.fontawesome.com/releases/v7.0.0/css/all.css"
  />
  <!-- Google Analytics -->
  <script
    async
    src="https://www.googletagmanager.com/gtag/js?id=G-MJ4P8TZNBR"
  ></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag() {
      dataLayer.push(arguments);
    }
    gtag("js", new Date());
    gtag("config", "G-MJ4P8TZNBR");
  </script>
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

<style>
  /* Default link color for light mode */
  :global(body) {
    --link: #000000;
  }
  :global(body.dark) {
    --bg: #121212;
    --text: #eeeeee;
    --card-bg: #1e1e1e;
    --border: #333;
  }
  :global(.dark .site-header) {
    background-color: rgba(33, 33, 33, 0.5);
    background-image: url("/assets/img/materio_new_wh.svg");
  }
  :global(body.blog-layout .site-header) {
    background-image: url("/assets/img/logo-b.svg");
    background-size: auto 32px;
  }
  :global(body.blog-layout.dark .site-header) {
    background-image: url("/assets/img/logo-w.svg");
    background-size: auto 32px;
  }
  /* Mobile: ensure header is full width and properly sized */
  @media (max-width: 768px) {
    :global(body.blog-layout .site-header),
    :global(body.blog-layout.dark .site-header) {
      width: 100% !important;
      max-width: 100% !important;
    }
  }
  /* Use Libre Baskerville for emphasized/italic text in posts */
  :global(article em),
  :global(article i),
  :global(.post-content em),
  :global(.post-content i),
  :global(.changelog-excerpt em),
  :global(.changelog-excerpt i) {
    font-family: "Libre Baskerville", serif;
    font-style: italic;
    font-weight: 400;
  }
  /* Link pill styling for in-post links */
  :global(.post-body a.link-pill),
  :global(.post-content a.link-pill) {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.35rem 0.7rem;
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.04);
    color: var(--link, #0b66c3);
    text-decoration: none;
    font-weight: 600;
    font-size: 0.95rem;
    line-height: 1;
    border: 1px solid rgba(0, 0, 0, 0.04);
  }
  :global(body.dark .post-body a.link-pill),
  :global(body.dark .post-content a.link-pill) {
    background: rgba(255, 255, 255, 0.04);
    border-color: rgba(255, 255, 255, 0.04);
    color: var(--text);
  }

  /* Font switching support */
  :global(body) {
    --font-primary: "Manrope", sans-serif;
  }
  :global(body.font-secondary) {
    --font-primary: "Inter", sans-serif;
    font-feature-settings:
      "tnum" 1,
      "frac" 1,
      "case" 1,
      "ss01" 1,
      "ss02" 1,
      "cv01" 1,
      "cv02" 1,
      "cv03" 1,
      "cv04" 1,
      "cv05" 1,
      "cvo9" 1,
      "liga" 1,
      "calt" 1;
  }
  @supports (font-variation-settings: normal) {
    :global(body.font-secondary) {
      font-family: InterVariable, sans-serif;
    }
  }
  :global(body.font-serif) {
    --font-primary: "Crimson Pro", serif;
  }
  :global(body.font-system) {
    --font-primary: sans-serif, system-ui, -apple-system, BlinkMacSystemFont;
  }
  :global(body.font-dyslexic) {
    --font-primary: "OpenDyslexicRegular", sans-serif;
  }

  :global(body) {
    font-family: var(--font-primary);
  }
</style>
