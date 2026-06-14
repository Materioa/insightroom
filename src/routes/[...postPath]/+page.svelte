<script>
  import { onMount, tick, onDestroy } from "svelte";
  import {
    addHeadingAnchorLinks,
    initializeListenComponent,
    toggleListen,
    seekBackward,
    seekForward,
    stopAudio,
  } from "$lib/utils/postLogic.js";
  import { page } from "$app/stores";
  import { dev } from "$app/environment";
  import { initializePostBase } from "$lib/utils/postBaseLogic.js";
  import { initTOC } from "$lib/utils/toc.js";
  import QRCodeGenerator from "$lib/components/QRCodeGenerator.svelte";
  import AISummary from "$lib/components/AISummary.svelte";
  import authorsData from "$lib/authors.json";

  const authorsMap = /** @type {Record<string, {name: string, passportPhoto: string, tags: string[], description: string | string[]}>} */ (authorsData);

  /** @type {{ data: any }} */
  let { data } = $props();
  // State for content binding
  /** @type {HTMLElement | undefined} */
  let contentElement = $state();
  /** @type {HTMLElement | undefined} */
  let visibleContentElement = $state();
  let postContentText = $state("");
  // If server provided pre-rendered content (for crawlers), use it immediately
  let decodedContent = $state("");
  let isLoading = $state(true);
  let claps = $state(0);

  $effect.pre(() => {
    decodedContent = data.ssrContent || "";
    isLoading = !data.ssrContent;
    claps = data.claps || 0;
  });
  let formattedClaps = $derived(claps >= 1000000 ? Intl.NumberFormat('en-US', { notation: "compact", maximumFractionDigits: 1 }).format(claps) : Intl.NumberFormat('en-US').format(claps));
  let isClapping = $state(false);
  let hasApplauded = $state(false);
  let showBurst = $state(false);

  // Custom Search State
  let showSearchBox = $state(false);
  let searchQuery = $state("");
  let matchCount = $state(0);
  let currentMatchIndex = $state(0);
  /** @type {any} */
  let markInstance = null;
  /** @type {NodeListOf<Element> | null} */
  let markElements = null;
  /** @type {HTMLInputElement | undefined} */
  let searchInputRef = $state();

  async function clapPost() {
    if (isClapping || !data.postId) return;
    isClapping = true;
    
    // Optimistic update
    claps += 1;
    hasApplauded = true;
    showBurst = true;
    setTimeout(() => {
      showBurst = false;
    }, 600);

    try {
      const res = await fetch('/api/posts/clap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: data.postId })
      });
      if (res.ok) {
        const result = await res.json();
        if (result.success && result.claps !== undefined) {
          claps = result.claps;
        }
      } else {
        // Revert on error
        claps -= 1;
        hasApplauded = false;
      }
    } catch (e) {
      console.error('Failed to clap:', e);
      // Revert on error
      claps -= 1;
      hasApplauded = false;
    } finally {
      isClapping = false;
    }
  }

  function defaultAvatar() {
    return "/assets/img/default-avatar.svg";
  }

  /** @typedef {{ name: string, avatar: string }} PostAuthor */

  /** @param {any} value */
  function parseAuthorList(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === "object") return [value];
    const raw = String(value).trim();
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && typeof parsed === "object") return [parsed];
    } catch {
      // Plain custom fields can use comma-separated author names.
    }
    return raw.split(",").map((name) => name.trim()).filter(Boolean);
  }

  /** @param {any} author */
  function normalizeAuthor(author) {
    if (!author) return null;
    if (typeof author === "string") {
      return { name: author, avatar: defaultAvatar() };
    }
    const name = author.displayName || author.name || author.username || author.title || author.label;
    if (!name) return null;
    return {
      name,
      avatar: author.avatar || author.profilePicture || author.image || author.photo || defaultAvatar(),
    };
  }

  /** @param {PostAuthor | null} author @returns {author is PostAuthor} */
  function isPostAuthor(author) {
    return Boolean(author);
  }

  function getPostAuthors() {
    const candidates = [
      ...parseAuthorList(data.authors),
      ...parseAuthorList(data.author),
      ...parseAuthorList(data.editors),
      ...parseAuthorList(data.editor),
      ...parseAuthorList(data.collaborators),
      ...parseAuthorList(data.collaborator),
    ];

    if (data.author_name || data.author_avatar) {
      candidates.unshift({
        name: data.author_name,
        avatar: data.author_avatar,
      });
    }

    const seen = new Set();
    const authors = candidates
      .map(normalizeAuthor)
      .filter(isPostAuthor)
      .filter((author) => {
        const key = author.name.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

    return authors.length ? authors : [{ name: "Materio", avatar: defaultAvatar() }];
  }

  /** @param {PostAuthor[]} authors */
  function authorNames(authors) {
    return authors.map((author) => author.name).join(", ");
  }

  let postAuthors = $derived(() => getPostAuthors());

  /** @param {string|undefined|null} dateStr */
  function formatDate(dateStr) {
    if (!dateStr) return "";
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    } catch (e) {
      return "";
    }
  }

  // ... (existing helper functions: isVideo, getVideoType, sharePost, printPost, toggleVideo)
  /** @param {string|undefined|null} url */
  function isVideo(url) {
    if (!url) return false;
    return (
      url.endsWith(".mp4") || url.endsWith(".webm") || url.endsWith(".mov")
    );
  }

  /** @param {string|undefined|null} url */
  function getVideoType(url) {
    if (!url) return "video/mp4";
    if (url.endsWith(".webm")) return "video/webm";
    if (url.endsWith(".mov")) return "video/quicktime";
    return "video/mp4";
  }

  function sharePost() {
    if (typeof navigator !== "undefined" && navigator.share) {
      navigator.share({
        title: data.title,
        url: window.location.href,
      });
    } else if (typeof navigator !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      alert("Link copied to clipboard!");
    }
  }

  function printPost() {
    window.print();
  }

  /** @param {string} videoId */
  function toggleVideo(videoId) {
    const video = document.getElementById(videoId);
    if (video instanceof HTMLVideoElement) {
      const controls = video.parentElement?.querySelector(".video-controls");
      if (video.paused) {
        video.play();
        controls?.classList.remove("paused");
        controls?.classList.add("playing");
        const icon = controls?.querySelector("i");
        if (icon) {
          icon.className = "fa-solid fa-pause";
        }
      } else {
        video.pause();
        controls?.classList.add("paused");
        controls?.classList.remove("playing");
        const icon = controls?.querySelector("i");
        if (icon) {
          icon.className = "fa-solid fa-play";
        }
      }
    }
  }

  // Make toggleVideo globally available
  if (typeof window !== "undefined") {
    // @ts-ignore
    window.toggleVideo = toggleVideo;
  }

  let categories = $derived(() => {
    if (data.categories) {
      return Array.isArray(data.categories)
        ? data.categories.join(", ").replace(/ /g, "-")
        : data.categories.replace(/ /g, "-");
    }
    return data.category?.replace(/ /g, "-") || "";
  });

  /** @param {string} name */
  function getCookie(name) {
    if (typeof document === "undefined") return null;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
      const popped = parts.pop();
      if (popped) {
        return popped.split(";").shift() || null;
      }
    }
    return null;
  }

  onMount(() => {
    async function init() {
      // If SSR content was already provided (bot request), skip the fetch
      // and just initialize post features on the already-rendered content.
      if (data.ssrContent && decodedContent) {
        isLoading = false;
        setTimeout(async () => {
          initPostFeatures();
        }, 0);
        return;
      }

      // Fetch post content dynamically to keep view-source clean (regular users)
      if (!data.isLocked) {
        try {
          const category = encodeURIComponent(data.categorySlug || data.category || "_permalink");
          const slug = encodeURIComponent(data.slug || "");
          const res = await fetch(`/api/posts/content/${category}/${slug}`);
          if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
          const result = await res.json();
          decodedContent = result.html;
          isLoading = false;

          // Now that content is in the DOM, initialize features
          setTimeout(async () => {
            initPostFeatures();
          }, 0);

        } catch (e) {
          console.error("Failed to load post content:", e);
          isLoading = false;
        }
      } else {
        isLoading = false;
      }
    }

    /** Shared post-render initialization for both SSR and client-fetched content */
    async function initPostFeatures() {
      // 1. Run raw HTML string replacements FIRST to avoid wiping out DOM event listeners
      initializePostBase();

      // 2. DOM manipulation and enhancements
      enhancePostLinks(".post-body");
      enhancePostLinks(".post-content");

      // Highlight code blocks, excluding diagram classes
      // @ts-ignore
      if (typeof hljs !== "undefined") {
        const codeBlocks = document.querySelectorAll('pre code');
        codeBlocks.forEach((block) => {
          const lang = block.className;
          const diagramLangs = ['language-mermaid', 'language-markmap', 'language-graphviz', 'language-dot', 'language-flashcards'];
          if (diagramLangs.some(d => lang.includes(d))) return;
          // @ts-ignore
          hljs.highlightElement(block);
        });
      }

      // @ts-ignore
      if (typeof mermaid !== "undefined") {
        // @ts-ignore
        mermaid.initialize({ startOnLoad: false, theme: 'default' });
        // @ts-ignore
        await mermaid.run();
      }

      addHeadingAnchorLinks();
      initTOC();
      initializeListenComponent();
      renderMath();
    }

    /** @param {string} rootSelector */
    function enhancePostLinks(rootSelector) {
      const roots = document.querySelectorAll(rootSelector);
      if (!roots.length) return;
      roots.forEach(function (root) {
        const anchors = root.querySelectorAll("a[href]:not(.no-pill)");
        // @ts-ignore
        anchors.forEach(function (/** @type {HTMLAnchorElement} */ a) {
          if (a.querySelector("img")) return;
          if (a.closest("code, pre")) return;
          if (!a.classList.contains("link-pill")) a.classList.add("link-pill");

          const lastChild = a.lastElementChild;
          if (
            lastChild instanceof HTMLElement &&
            lastChild.tagName === "I" &&
            (lastChild.classList.contains("fa-arrow-up-right") ||
              lastChild.classList.contains("fa-link-simple"))
          ) {
            lastChild.classList.add("link-pill-icon");
          }

          let icon = a.querySelector("i.link-pill-icon");
          if (!icon) {
            icon = document.createElement("i");
            icon.className = "link-pill-icon fa-regular";
            a.appendChild(icon);
          }

          try {
            const href = (a.getAttribute("href") || "").trim();
            const url = href ? new URL(href, window.location.href) : null;
            if (url && url.origin !== window.location.origin) {
              a.setAttribute("target", "_blank");
              a.setAttribute("rel", "noopener noreferrer");
              // @ts-ignore
              icon.className = "link-pill-icon fa-regular fa-arrow-up-right";
            } else {
              // @ts-ignore
              icon.className = "link-pill-icon fa-regular fa-link-simple";
              // @ts-ignore
              icon.style.transform = "rotate(-20deg)";
            }
          } catch (e) {
            // @ts-ignore
            icon.className = "link-pill-icon fa-regular fa-link-simple";
          }
        });
      });
    }

    function renderMath() {
        // @ts-ignore
        if (typeof renderMathInElement !== "undefined") {
            const options = {
                delimiters: [
                    { left: "$$", right: "$$", display: false },
                    { left: "$", right: "$", display: false },
                    { left: "\\(", right: "\\)", display: false },
                    { left: "\\[", right: "\\]", display: true },
                ],
            };
            // @ts-ignore
            renderMathInElement(document.body, options);
        } else {
            // Retry after a short delay in case the defer script hasn't loaded yet
            setTimeout(renderMath, 100);
        }
    }

    init();

    const startTime = Date.now();
    return () => {
      const duration = Math.round((Date.now() - startTime) / 1000);
    };
  });

  $effect(() => {
    if (decodedContent && contentElement && visibleContentElement) {
      const el = contentElement;
      const visEl = visibleContentElement;
      tick().then(() => {
        postContentText = el.textContent || "";
        // Wait for mark.js CDN script to load
        function tryInitMark() {
          // @ts-ignore
          if (typeof window !== 'undefined' && window.Mark) {
            // @ts-ignore
            markInstance = new window.Mark(visEl);
          } else {
            // Retry until CDN script loads
            setTimeout(tryInitMark, 200);
          }
        }
        if (!markInstance) {
          tryInitMark();
        }
      });
    }
  });

  // Search Logic
  /** @param {KeyboardEvent} e */
  function handleKeydown(e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      showSearchBox = true;
      tick().then(() => searchInputRef?.focus());
    } else if (e.key === 'Escape' && showSearchBox) {
      closeSearch();
    }
  }

  function performSearch() {
    const visEl = visibleContentElement;
    if (!markInstance || !visEl) return;
    markInstance.unmark({
      done: () => {
        if (!searchQuery.trim()) {
          matchCount = 0;
          currentMatchIndex = 0;
          markElements = null;
          return;
        }
        markInstance.mark(searchQuery, {
          separateWordSearch: false,
          done: (/** @type {number} */ count) => {
            matchCount = count;
            currentMatchIndex = count > 0 ? 1 : 0;
            markElements = visEl.querySelectorAll('mark[data-markjs="true"]');
            updateActiveMatch(false);
          }
        });
      }
    });
  }

  function updateActiveMatch(smooth = true) {
    if (!markElements || matchCount === 0) return;
    markElements.forEach(el => el.classList.remove('active'));
    const activeEl = markElements[currentMatchIndex - 1];
    if (activeEl) {
      activeEl.classList.add('active');
      
      // Delay scrolling to ensure DOM/CSS updates don't block the scroll event
      setTimeout(() => {
        try {
          activeEl.scrollIntoView({ block: 'center' });
        } catch(e) {
          activeEl.scrollIntoView();
        }
      }, 10);
    }
  }

  function nextMatch() {
    if (matchCount === 0) return;
    currentMatchIndex = currentMatchIndex < matchCount ? currentMatchIndex + 1 : 1;
    updateActiveMatch(true);
  }

  function prevMatch() {
    if (matchCount === 0) return;
    currentMatchIndex = currentMatchIndex > 1 ? currentMatchIndex - 1 : matchCount;
    updateActiveMatch(true);
  }

  function closeSearch() {
    showSearchBox = false;
    searchQuery = "";
    performSearch();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<svelte:head>
  <title>{data.title} - Materio InsightRoom</title>
  <meta
    property="og:title"
    content={data.title || "Materio - The InsightRoom"}
  />
  <meta
    property="og:description"
    content={data.excerpt ||
      "For minds that want more - a lil more than academics."}
  />
  <meta
    property="og:image"
    content={`https://room.getmaterio.app${data.image || "/assets/img/og-theinsroom.jpg"}`}
  />
  <meta
    property="og:url"
    content={`https://room.getmaterio.app/blog/${data.slug}`}
  />
  <meta property="og:type" content="article" />
  <meta name="description" content={data.excerpt || ""} />
  <meta name="twitter:card" content="summary_large_image" />
  <meta
    name="twitter:title"
    content={data.title || "Materio - The InsightRoom"}
  />
  <meta name="twitter:description" content={data.excerpt || ""} />
  <meta
    name="twitter:image"
    content={`https://room.getmaterio.app${data.image || "/assets/img/og-theinsroom.jpg"}`}
  />
  <!-- Post specific scripts -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/contrib/auto-render.min.js"></script>
  <script defer src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/highlight.min.js"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/mermaid@10.6.1/dist/mermaid.min.js"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/mark.js@8.11.1/dist/mark.min.js"></script>

  <!-- Markmap for mindmaps -->
  <script defer src="https://cdn.jsdelivr.net/npm/d3@7"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/markmap-view@0.18.12"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/markmap-lib@0.18.12"></script>

  <!-- Graphviz for FSM/automata diagrams -->
  <script defer src="https://cdn.jsdelivr.net/npm/@viz-js/viz@3.11.0/lib/viz-standalone.js"></script>
  <script defer src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js"></script>

  <!-- JSON-LD Article structured data for search engines -->
  {@html `<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": data.title || "",
    "description": data.excerpt || "",
    "image": data.image ? `https://room.getmaterio.app${data.image}` : "https://room.getmaterio.app/assets/img/og-theinsroom.jpg",
    "datePublished": data.date || "",
    "publisher": {
      "@type": "Organization",
      "name": "Materio InsightRoom",
      "url": "https://room.getmaterio.app"
    },
    "mainEntityOfPage": {
      "@type": "WebPage",
          "@id": `https://room.getmaterio.app/${data.categorySlug || ""}/${data.slug || ""}`
    }
  })}</script>`}
</svelte:head>

<!-- Custom Search UI -->
{#if showSearchBox}
  <div class="custom-search-box">
    <div class="search-input-wrapper">
      <i class="fa-solid fa-magnifying-glass search-icon"></i>
      <input
        bind:this={searchInputRef}
        bind:value={searchQuery}
        oninput={performSearch}
        onkeydown={(e) => {
          if (e.key === 'Enter') {
            if (e.shiftKey) prevMatch();
            else nextMatch();
          }
        }}
        placeholder="Find in post..."
        type="text"
      />
    </div>
    <div class="search-controls">
      <span class="match-count">
        {#if searchQuery}
          {matchCount > 0 ? currentMatchIndex : 0} / {matchCount}
        {/if}
      </span>
      <button class="icon-btn" onclick={prevMatch} disabled={matchCount === 0} title="Previous match (Shift+Enter)">
        <i class="fa-solid fa-chevron-up"></i>
      </button>
      <button class="icon-btn" onclick={nextMatch} disabled={matchCount === 0} title="Next match (Enter)">
        <i class="fa-solid fa-chevron-down"></i>
      </button>
      <div class="divider"></div>
      <button class="icon-btn close-btn" onclick={closeSearch} title="Close (Esc)">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
  </div>
{/if}


<main
  class="post-container"
  style="font-family: var(--font-primary);"
  data-visibility={data.visibility}
  data-category={data.category}
  data-no-ads={data["no-ads"]}
>
  <article class="post" style="max-width: 700px; margin: 0 auto;">
    <div style="text-align: center;">
      <!-- Date, Category, and Reading Time Pill -->
      <div
        style="display: flex; justify-content: center; align-items: center; gap: 0.75rem; margin-bottom: 1rem; flex-wrap: wrap;"
      >
        {#if isLoading}
          <div class="skeleton" style="width: 140px; height: 28px; border-radius: 20px;"></div>
        {:else}
          <div
            class="post-date-pill"
            style="border-radius: 20px; padding: 0.4rem 0.8rem; font-size: 12px;"
          >
            {formatDate(data.date)}
            {#if categories()}
              • {categories()}
            {/if}
            <span class="reading-time">• {data.readingTime || 1} min read</span>
          </div>

          <!-- Print-only clean meta information -->
          <div class="print-meta" style="display: none;">
            {formatDate(data.date)}
            {#if categories()}
              • {categories()}
            {/if}
            <span class="reading-time">• {data.readingTime || 1} minute read</span
            >
          </div>

          <!-- Previous Post Button -->
          {#if data["previous_post"]}
            <a
              href={data["previous_post"]}
              class="post-nav-button"
              style="border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; text-decoration: none; transition: all 0.2s ease;"
              title="Previous Post"
            >
              <i class="fa-solid fa-chevron-left" style="font-size: 12px;"></i>
            </a>
          {/if}

          <!-- Next Post Button -->
          {#if data["next_post"]}
            <a
              href={data["next_post"]}
              class="post-nav-button"
              style="border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; text-decoration: none; transition: all 0.2s ease;"
              title="Next Post"
            >
              <i class="fa-solid fa-chevron-right" style="font-size: 12px;"></i>
            </a>
          {/if}
        {/if}
      </div>

      <div class="post-title" style="font-size: 32px; font-weight: bold; min-height: 40px; display: flex; align-items: center; justify-content: center;">
        {#if isLoading}
          <div class="skeleton" style="width: 80%; height: 32px; border-radius: 8px;"></div>
        {:else}
          {data.title}
          {#if data.visibility === "private"}
            <span class="private-badge"
              ><i class="fa-solid fa-lock"></i> Private</span
            >
          {/if}
        {/if}
      </div>

      {#if isLoading}
        <div style="margin-top: 0.8rem; display: flex; justify-content: center;">
          <div class="skeleton" style="width: 60%; height: 20px; border-radius: 4px;"></div>
        </div>
      {:else if data.excerpt}
        <p
          class="post-description"
          style="font-size: 14px; margin-top: 0.5rem; color: var(--gray);"
        >
          {data.excerpt}
        </p>
      {/if}

      {#if isLoading}
        <div style="display: block; position: relative; margin: 1.5rem auto; max-width: 700px;">
          <div class="skeleton" style="width: 100%; height: 400px; border-radius: 17px;"></div>
        </div>
      {:else if data.image}
        <div
          style="display: block; position: relative; margin: 1.5rem auto; max-width: 700px;"
        >
          <div
            class="post-image-frame"
            style="padding: 5px; border-radius: 17px;"
          >
            {#if isVideo(data.image)}
              <!-- Video cover -->
              <div class="video-cover" style="margin: 0;">
                <video id="cover-video" muted loop style="border-radius: 12px;">
                  <source
                    src={data.image || ""}
                    type={getVideoType(data.image)}
                  />
                  Your browser does not support the video tag.
                </video>
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                  class="video-controls paused"
                  onclick={() => toggleVideo("cover-video")}
                >
                  <i class="fa-solid fa-play"></i>
                </div>
              </div>
            {:else}
              <!-- Image cover -->
              <img
                src={data.image || ""}
                alt={data.title || "Cover image"}
                class="post-cover"
                style="border-radius: 12px; display: block; width: 100%; height: auto; object-fit: cover;"
              />
            {/if}
          </div>
        </div>
      {/if}

      {#if isLoading}
        <div
          class="author-share-row"
          style="display: flex; justify-content: space-between; align-items: center; margin: 1.5rem auto; max-width: 700px; padding: 0 1rem;"
        >
          <div style="display: flex; align-items: center; gap: 0.8rem;">
            <div class="skeleton" style="width: 35px; height: 35px; border-radius: 50%;"></div>
            <div class="skeleton" style="width: 80px; height: 14px; border-radius: 4px;"></div>
          </div>
          <div style="display: flex; gap: 1rem;">
             <div class="skeleton" style="width: 60px; height: 24px; border-radius: 20px;"></div>
             <div class="skeleton" style="width: 20px; height: 20px; border-radius: 4px;"></div>
          </div>
        </div>
      {:else if !data["hide_author_share_row"]}
        <div
          class="author-share-row"
          style="display: flex; justify-content: space-between; align-items: center; margin: 0.5rem auto; max-width: 700px; padding: 0 1rem;"
        >
          <!-- Author Profile Section -->
          <div style="display: flex; align-items: center; gap: 0.8rem;">
            {#if !data["hide_author"]}
              <div class="post-author-stack" aria-label="Authors">
                {#each postAuthors().slice(0, 4) as author}
                  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
                  <div class="author-hover-container" tabindex="0">
                    <div
                      class="author-avatar stacked-author-avatar"
                      title={author.name}
                      style="width: 35px; height: 35px; border-radius: 50%; overflow: hidden; border: 2px solid rgba(0,0,0,0.1);"
                    >
                      <img
                        src={author.avatar}
                        alt={author.name}
                        style="width: 100%; height: 100%; object-fit: cover;"
                      />
                    </div>
                    {#if authorsMap[author.name]}
                      <div class="author-hover-card">
                        <div class="author-hover-photo">
                          <img src={authorsMap[author.name].passportPhoto} alt={author.name} />
                        </div>
                        <div class="author-hover-info">
                          <div class="author-hover-name">{authorsMap[author.name].name}</div>
                          <div class="author-hover-tags">
                            {authorsMap[author.name].tags.join(", ")}
                          </div>
                          <div class="author-hover-desc">
                            <div>
                              {typeof authorsMap[author.name].description === 'string'
                                ? authorsMap[author.name].description
                                : authorsMap[author.name].description.join(' ')}
                            </div>
                          </div>
                        </div>
                      </div>
                    {/if}
                  </div>
                {/each}
              </div>
              <div class="author-info">
                <div
                  class="author-name"
                  style="font-size: 14px; font-weight: 600; color: var(--text); line-height: 1.2;"
                >
                  {authorNames(postAuthors())}
                </div>
              </div>
            {/if}
          </div>

          <!-- Share, Print, and Listen icons Container (Right Aligned via justify-content: space-between on parent) -->
          <div
            style="display: flex; justify-content: center; align-items: center; gap: 1rem;"
          >
            <!-- Listen Component -->
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              id="listen-component"
              class="listen-pill"
              style="display: flex; align-items: center; background: rgba(0,0,0,0.05); border-radius: 20px; padding: 0.3rem 0.6rem; cursor: pointer; transition: all 0.2s ease;"
              onclick={toggleListen}
              role="button"
              tabindex="0"
              onkeypress={(e) => {
                if (e.key === "Enter") toggleListen();
              }}
            >
              <i
                id="listen-icon"
                class="fa-solid fa-play"
                style="font-size: 12px; margin-right: 0.4rem; color: #333;"
              ></i>
              <div
                class="waveform-container"
                id="listen-waveform"
                style="display: flex; align-items: center; gap: 1px; margin-right: 0.4rem;"
              >
                {#each Array(15) as _, i}
                  <div
                    class="wave-bar"
                    style="width: 2px; height: {9 +
                      (i % 2) *
                        3}px; background: #666; border-radius: 1px; animation-delay: {i *
                      0.1}s"
                  ></div>
                {/each}
              </div>
              <span
                id="listen-duration"
                style="font-size: 11px; color: #666; font-weight: 500;"
                >Listen</span
              >
            </div>

            <!-- Seek controls (only visible when playing/paused) -->
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              id="seek-controls"
              class="seek-controls"
              style="display: none; align-items: center; gap: 0.3rem; margin-left: 0.5rem;"
              onclick={(e) => e.stopPropagation()}
            >
              <button
                onclick={seekBackward}
                class="seek-btn"
                title="Go back 5 seconds"
                style="background: none; border: none; color: #666; cursor: pointer; padding: 0.2rem; border-radius: 50%; transition: all 0.2s ease;"
              >
                <i class="fa-solid fa-backward" style="font-size: 10px;"></i>
              </button>
              <button
                onclick={seekForward}
                class="seek-btn"
                title="Skip forward 5 seconds"
                style="background: none; border: none; color: #666; cursor: pointer; padding: 0.2rem; border-radius: 50%; transition: all 0.2s ease;"
              >
                <i class="fa-solid fa-forward" style="font-size: 10px;"></i>
              </button>
              <button
                onclick={stopAudio}
                class="seek-btn stop-btn"
                title="Stop"
                style="background: none; border: none; color: #d32f2f; cursor: pointer; padding: 0.2rem; border-radius: 50%; transition: all 0.2s ease;"
              >
                <i class="fa-solid fa-stop" style="font-size: 10px;"></i>
              </button>
            </div>

            <!-- Share and Print icons -->
            <div class="clap-wrapper" class:animate-burst={showBurst}>
              <!-- Particles for burst animation -->
              {#if showBurst}
                {#each [0, 72, 144, 216, 288] as deg}
                  <div class="particle-group" style="transform: rotate({deg}deg)">
                    <div class="particle circle"></div>
                    <div class="particle triangle"></div>
                  </div>
                {/each}
              {/if}
              <div
                role="button"
                tabindex="0"
                class="clap-button"
                onclick={clapPost}
                onkeypress={(e) => e.key === 'Enter' && clapPost()}
                aria-label="Applaud"
                title="Applaud"
                style="display: flex; align-items: center; gap: 0.3rem; cursor: pointer; transition: all 0.2s ease; {isClapping ? 'transform: scale(1.1);' : ''} {hasApplauded ? 'color: var(--primary, #e25555);' : 'color: var(--text);'}"
              >
                <i class="{hasApplauded ? 'fa-solid' : 'fa-regular'} fa-hands-clapping" style="font-size: 14px;"></i>
                <span style="font-size: 13px; font-weight: 500;">{formattedClaps}</span>
              </div>
            </div>
            {#if !data["hide_share"]}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <i
                class="fa-regular fa-link-simple"
                onclick={sharePost}
                style="transform: rotate(-45deg); font-size: 14px; cursor: pointer; color: var(--text);"
                title="Share"
              ></i>
            {/if}
            {#if !data["hide_print"]}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <i
                class="fa-regular fa-print"
                onclick={printPost}
                style="font-size: 14px; cursor: pointer; color: var(--text);"
                title="Print"
              ></i>
            {/if}
            {#if data.accessTier === 'super' || data.accessTier === 'plus'}
              <a
                href={`/writer/editor/${data.postId}`}
                style="color: var(--text); display: flex; align-items: center; justify-content: center; text-decoration: none;"
                title="Edit Post"
              >
                <i class="fa-regular fa-user-pen" style="font-size: 14px; cursor: pointer;"></i>
              </a>
            {/if}
          </div>
        </div>
      {/if}

      <!-- AI Summary/Ask Card -->
      {#if !data.isLocked}
        {#if isLoading}
          <div class="ai-card" style="margin-top: 1.5rem; margin-bottom: 1.5rem;">
             <div class="ai-actions-row" style="background: transparent; border: none; gap: 0.75rem;">
                <div class="skeleton" style="flex: 1; height: 42px; border-radius: 32px;"></div>
                <div class="skeleton" style="flex: 1; height: 42px; border-radius: 32px;"></div>
             </div>
          </div>
        {:else}
          <AISummary
            postContent={postContentText}
            postTitle={data.title || ""}
            canSummarize={data.summarize !== false &&
              data.aiSummarize !== false &&
              (data.accessTier === "plus" || data.accessTier === "super")}
            canAsk={data.summarize !== false &&
              data.aiAsk !== false &&
              (data.accessTier === "plus" || data.accessTier === "super")}
          />
        {/if}
      {/if}
    </div>

    <div class="post-layout">
      <div class="post-body">
        {#if data.isLocked}
          <!-- Locked Content with Blurred Dummy Text -->
          <div class="locked-content-wrapper">
            <!-- Dummy blurred content behind -->
            <div class="locked-dummy-content" aria-hidden="true">
              <h2>Understanding the Core Concepts</h2>
              <p>
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
                eiusmod tempor incididunt ut labore et dolore magna aliqua.
              </p>
              <p>
                Duis aute irure dolor in reprehenderit in voluptate velit esse
                cillum dolore eu fugiat nulla pariatur.
              </p>
            </div>

            <!-- Gradient overlay that fades from transparent to solid -->
            <div class="locked-gradient-overlay"></div>

            <!-- Upgrade Card -->
            <div class="locked-card">
              <!-- Unlock with label -->
              <span class="upgrade-label">Unlock with</span>

              <!-- Materio Plus SVG Logo -->
              <div class="materio-plus-logo">
                <img src="/assets/img/plus_shim.svg" alt="materio. plus" />
              </div>

              <!-- Benefits list -->
              <ul class="locked-benefits">
                <li>
                  <i class="fa-solid fa-check"></i> Ad-free, distraction-free reading
                </li>
                <li>
                  <i class="fa-solid fa-check"></i>Unlimited access to all
                  premium content
                </li>
                <li>
                  <i class="fa-solid fa-check"></i> Full access to AI-powered learning
                  tools
                </li>
                <li>
                  <i class="fa-solid fa-check"></i> Early access to new articles
                  and originals
                </li>
                <li>
                  <i class="fa-solid fa-check"></i> Try upcoming features early through
                  our beta program
                </li>
              </ul>

              <!-- Action buttons -->
              <div class="locked-actions">
                <a
                  href={dev
                    ? `http://localhost:1000/account?callback=${encodeURIComponent("http://localhost:5173" + $page.url.pathname)}`
                    : `https://materioa.vercel.app/account?callback=${encodeURIComponent("https://room.getmaterio.app" + $page.url.pathname)}`}
                  class="locked-btn locked-btn-login no-pill"
                >
                  <i class="fa-solid fa-user"></i>
                  Log In
                </a>
                <a
                  href={dev
                    ? "http://localhost:1000/account/upgrade"
                    : "https://materioa.vercel.app/account/upgrade"}
                  class="locked-btn locked-btn-upgrade no-pill"
                >
                  <i class="fa-solid fa-bolt"></i>
                  Upgrade
                </a>
              </div>
            </div>

            <!-- Bottom image section with gradient overlay -->
            <div class="locked-bottom-image">
              <div class="locked-bottom-image-overlay"></div>
              <img
                src="/assets/img/4ed2a66f.webp"
                alt=""
                aria-hidden="true"
                class="locked-img-light"
              />
              <img
                src="/assets/img/8cba0a2b.webp"
                alt=""
                aria-hidden="true"
                class="locked-img-dark"
              />
            </div>
          </div>
        {:else if isLoading}
          <div class="post-body">
            <div class="skeleton" style="width: 100%; height: 20px; margin-bottom: 12px; border-radius: 4px;"></div>
            <div class="skeleton" style="width: 95%; height: 20px; margin-bottom: 12px; border-radius: 4px;"></div>
            <div class="skeleton" style="width: 98%; height: 20px; margin-bottom: 12px; border-radius: 4px;"></div>
            <div class="skeleton" style="width: 92%; height: 20px; margin-bottom: 12px; border-radius: 4px;"></div>
            <div class="skeleton" style="width: 90%; height: 20px; margin-bottom: 24px; border-radius: 4px;"></div>
            
            <div class="skeleton" style="width: 100%; height: 20px; margin-bottom: 12px; border-radius: 4px;"></div>
            <div class="skeleton" style="width: 96%; height: 20px; margin-bottom: 12px; border-radius: 4px;"></div>
            <div class="skeleton" style="width: 94%; height: 20px; margin-bottom: 12px; border-radius: 4px;"></div>
          </div>
        {:else}
          <!-- Capture content for summary (hidden, no IDs to avoid duplicates) -->
          <div
            bind:this={contentElement}
            class="summary-capture"
            style="display: none;"
          >
            {@html decodedContent}
          </div>

          <div bind:this={visibleContentElement} class="post-content-visible">
            {@html decodedContent}
          </div>
        {/if}
      </div>

      <!-- TOC is generated dynamically by toc.js and moved to sidebar; this placeholder is hidden by default to prevent FOUC -->
      <aside
        class="post-toc"
        aria-label="Table of contents"
        style="display: none;"
      >
        <!-- TOC will be generated by JavaScript and moved to sidebar -->
      </aside>
    </div>
  </article>

  <!-- Hidden QR code for print header -->
  <div
    id="hidden-qr-code"
    style="position: absolute; left: -9999px; top: -9999px; visibility: hidden;"
  >
    <QRCodeGenerator
      data={$page.url.href}
      size={120}
      hideActions={true}
      hideContainer={true}
    />
  </div>

  <!-- SSR content for crawlers/bots: rendered as a noscript fallback so
       search engines, AI assistants, and ad verification bots (AdSense)
       can always read the full article text even without JavaScript. -->
  {#if data.ssrContent}
    <noscript>
      <div class="post-body post-content-visible">
        {@html data.ssrContent}
      </div>
    </noscript>
  {/if}
</main>

<!-- Site-level TOC sidebar - starts with no-transition to prevent flash on load -->
<div id="toc-scroll-rail" class="toc-scroll-rail" aria-hidden="true">
  <!-- TOC section markers are injected by toc.js -->
</div>
<div
  id="site-toc-sidebar"
  class="site-toc-sidebar no-transition"
  aria-hidden="true"
>
  <button
    id="site-toc-sheet-handle"
    class="site-toc-sheet-handle"
    type="button"
    data-drag="idle"
    aria-label="Drag table of contents sheet"
  >
    <span class="sheet-handle-chevrons" aria-hidden="true">
      <i class="sheet-handle-icon up fa-regular fa-chevron-up"></i>
      <i class="sheet-handle-icon down fa-regular fa-chevron-down"></i>
    </span>
  </button>
  <!-- TOC content will be moved here -->
</div>
<div
  id="site-toc-overlay"
  class="site-toc-overlay"
  tabindex="-1"
  aria-hidden="true"
  onclick={() => {
    document.body.classList.remove("toc-open");
    document.body.classList.remove("toc-sheet-open");
    document.body.classList.remove("toc-hover-open");
    document.body.classList.remove("toc-sheet-dragging");
    const sidebar = document.getElementById("site-toc-sidebar");
    if (sidebar) {
      sidebar.setAttribute("aria-hidden", "true");
      sidebar.style.setProperty("--toc-sheet-drag", "0px");
    }
    const handle = document.getElementById("site-toc-sheet-handle");
    if (handle) {
      handle.setAttribute("data-drag", "idle");
    }
    const mobileToggle = document.querySelector(".toc-mobile-toggle");
    if (mobileToggle) {
      mobileToggle.setAttribute("data-state", "closed");
    }
  }}
></div>

<style>
  :global(::-webkit-scrollbar) {
    display: none;
  }
  :global(*) {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }

  :global(a.link-pill) {
    font-family: var(--font-primary, "PP Mori", sans-serif) !important;
  }

  /* Clap Burst Animation */
  :global(.clap-wrapper) {
    position: relative;
    display: inline-flex;
    align-items: center;
  }
  :global(.particle-group) {
    position: absolute;
    top: 50%;
    left: 14px; /* Centered around the icon */
    width: 0;
    height: 0;
    z-index: 10;
  }
  :global(.particle) {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }
  :global(.particle.circle) {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: #2ab7ca;
    left: -3px;
    top: -3px;
  }
  :global(.particle.triangle) {
    width: 0;
    height: 0;
    background-color: transparent;
    border-left: 5px solid transparent;
    border-right: 5px solid transparent;
    border-top: 10px solid #fe4a90;
    left: -5px;
    top: -5px;
  }

  :global(.animate-burst .particle.circle) { animation: shootCircle 0.6s cubic-bezier(0.1, 0.8, 0.3, 1) forwards; }
  :global(.animate-burst .particle.triangle) { animation: shootTriangle 0.6s cubic-bezier(0.1, 0.8, 0.3, 1) forwards; }

  @keyframes shootCircle { 
    0% { transform: translate(-10px, -10px) scale(0.5); opacity: 1; } 
    100% { transform: translate(-20px, -35px) scale(1); opacity: 0; } 
  }
  @keyframes shootTriangle { 
    0% { transform: translate(0, 0) scale(0.5); opacity: 1; } 
    100% { transform: translate(0, -50px) scale(1.2); opacity: 0; } 
  }

  /* Custom Search Box Styles */
  .custom-search-box {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 9999;
    background: #fff;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
    display: flex;
    align-items: center;
    padding: 6px 12px;
    gap: 12px;
    font-family: inherit;
    animation: slideDown 0.2s ease-out;
  }
  @keyframes slideDown {
    from { transform: translateY(-20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
  .search-input-wrapper {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(0,0,0,0.04);
    border-radius: 6px;
    padding: 4px 8px;
  }
  .search-input-wrapper input {
    border: none;
    background: transparent;
    outline: none;
    font-size: 14px;
    width: 180px;
    color: #333;
  }
  .search-icon {
    color: #888;
    font-size: 12px;
  }
  .search-controls {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .match-count {
    font-size: 12px;
    color: #666;
    min-width: 40px;
    text-align: center;
    margin-right: 8px;
  }
  .icon-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    border-radius: 4px;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #555;
    transition: background 0.1s;
  }
  .icon-btn:hover:not(:disabled) {
    background: rgba(0,0,0,0.08);
  }
  .icon-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .divider {
    width: 1px;
    height: 16px;
    background: #ddd;
    margin: 0 4px;
  }
  .close-btn:hover {
    color: #e53935;
    background: rgba(229, 57, 53, 0.1);
  }

  /* highlight styles */
  :global(mark) {
    background-color: #ffd54f !important;
    color: #000 !important;
    padding: 2px 0;
    border-radius: 2px;
  }
  :global(mark.active) {
    background-color: #ff9800 !important;
  }
  :global(body.dark-mode .custom-search-box) {
    background: #2a2a2a;
    border-color: #444;
  }
  :global(body.dark-mode .search-input-wrapper) {
    background: rgba(255,255,255,0.05);
  }
  :global(body.dark-mode .search-input-wrapper input) {
    color: #fff;
  }
  :global(body.dark-mode .icon-btn) {
    color: #bbb;
  }
  :global(body.dark-mode .icon-btn:hover:not(:disabled)) {
    background: rgba(255,255,255,0.1);
  }
  :global(body.dark-mode .divider) {
    background: #555;
  }
  :global(body.dark-mode .match-count) {
    color: #aaa;
  }
</style>
