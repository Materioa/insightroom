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

  $effect(() => {
    if (browser) {
      document.body.className = bodyClass + (isDark ? " dark dark-mode" : "");
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

  // Make setTheme globally available
  if (browser) {
    // @ts-ignore
    window.setTheme = setTheme;
  }

  onMount(() => {
    // Initialize theme
    const userTheme = getCookie("theme");
    if (userTheme === "dark") {
      applyTheme(true);
    } else if (userTheme === "light") {
      applyTheme(false);
    } else {
      const systemPrefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)",
      ).matches;
      applyTheme(systemPrefersDark);
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
  });
</script>

<svelte:head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
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

<Footer {setTheme} />

<style>
  /* Default link color for light mode */
  :global(body) {
    --link: #000000;
  }
  :global(body.dark) {
    --bg: #121212;
    --text: #eeeeee;
    --link: #3ea6ff;
    --card-bg: #1e1e1e;
    --border: #333;
  }
  :global(.dark .site-header) {
    background-color: rgba(33, 33, 33, 0.5);
    background-image: url("/assets/img/materio_new_wh.svg");
  }
  :global(body.blog-layout .site-header) {
    background-image: url("/assets/img/The InsightRoom-bk.png");
    background-size: auto 32px;
  }
  :global(body.blog-layout.dark .site-header) {
    background-image: url("/assets/img/The InsightRoom.png");
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
</style>
