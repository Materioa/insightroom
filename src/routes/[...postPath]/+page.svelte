<script>
  import { onMount, tick, onDestroy } from "svelte";
  import { fade } from 'svelte/transition';
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
  import { showSearchBoxStore } from "$lib/stores/search";
  import { initializePostBase } from "$lib/utils/postBaseLogic.js";
  import { initTOC } from "$lib/utils/toc.js";
  import QRCodeGenerator from "$lib/components/QRCodeGenerator.svelte";
  import AISummary from "$lib/components/AISummary.svelte";
  import authorsData from "$lib/authors.json";
  import { optimizeCloudinaryUrl, optimizeSupabaseUrl } from "$lib/utils/image.js";


  const authorsMap = /** @type {Record<string, {name: string, passportPhoto: string, tags: string[], description: string | string[]}>} */ (authorsData);

  /** @type {{ data: any }} */
  let { data } = $props();

  let postContentText = $state("");
  // If server provided pre-rendered content (for crawlers), use it immediately
  // svelte-ignore state_referenced_locally
  let decodedContent = $state(data.ssrContent || "");
  // svelte-ignore state_referenced_locally
  let isLoading = $state(!data.ssrContent);
  let claps = $state(0);
  let postHasMath = $state(false);
  
  let hasCoverArtifact = $derived(decodedContent && decodedContent.includes('data-cover-artifact-source'));

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
  let searchQuery = $state("");
  let matchCount = $state(0);
  let currentMatchIndex = $state(0);

  /** @type {HTMLInputElement | undefined} */
  let searchInputRef = $state();

  // Reading Progress Bar State
  let scrollProgress = $state(0);

  // Lightbox State
  let showLightbox = $state(false);
  /** @type {{ type: 'image' | 'video' | null, src: string | null, alt: string | null }} */
  let lightboxMedia = $state({ type: null, src: null, alt: null });

  function closeLightbox() {
    showLightbox = false;
    setTimeout(() => {
      lightboxMedia = { type: null, src: null, alt: null };
    }, 200);
  }

  /** @param {MouseEvent} event */
  function handleContentClick(event) {
    const target = /** @type {HTMLElement} */ (event.target);
    if (!target) return;
    
    let current = target;
    while (current && current !== event.currentTarget) {
      if (current.closest('.locked-content-wrapper') || current.closest('.author-hover-card') || current.closest('.post-author-stack')) return;
      
      if (current.tagName === 'IMG' && !current.classList.contains('no-lightbox')) {
        const img = /** @type {HTMLImageElement} */ (current);
        lightboxMedia = { type: 'image', src: img.src, alt: img.alt };
        showLightbox = true;
        return;
      } else if (current.tagName === 'VIDEO' && !current.classList.contains('no-lightbox')) {
        const video = /** @type {HTMLVideoElement} */ (current);
        const source = video.querySelector('source');
        lightboxMedia = { type: 'video', src: video.src || (source ? source.src : null), alt: '' };
        if (lightboxMedia.src) showLightbox = true;
        return;
      }
      current = /** @type {HTMLElement} */ (current.parentElement);
    }
  }

  function handleScroll() {
    if (typeof window === 'undefined') return;
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    scrollProgress = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;

    if (hasCoverArtifact) {
      const target = document.getElementById('post-cover-target');
      if (target) {
        const progress = Math.min(scrollTop / 250, 1);
        target.style.setProperty('--progress', String(progress));
      }
    }
  }

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

  /**
   * @param {string | string[] | undefined} desc
   * @returns {string}
   */
  function formatAuthorDescription(desc) {
    if (!desc) return "";
    if (Array.isArray(desc)) {
      return desc.join(" ");
    }
    return desc;
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
      navigator.clipboard.writeText(window.location.href).catch(() => {});
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

  // Move helper functions out of the lifecycle block
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
      if (!postHasMath) return;
      // @ts-ignore
      if (typeof renderMathInElement !== "undefined") {
          const options = {
              delimiters: [
                  { left: "$$", right: "$$", display: true },
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

  // Reactive load and initialization using Svelte 5 $effect
  $effect(() => {
    // Explicitly reference the dependencies so this re-runs when post navigation happens
    const _postId = data.postId;
    const _ssrContent = data.ssrContent;
    const _isLocked = data.isLocked;
    const _slug = data.slug;
    const _category = data.category;
    const _categorySlug = data.categorySlug;

    let active = true;

    async function init() {
      try {
        // 1. Get post content (either SSR or dynamic fetch)
        if (!decodedContent && !_isLocked) {
          try {
            const category = encodeURIComponent(_categorySlug || _category || "_permalink");
            const slug = encodeURIComponent(_slug || "");
            const res = await fetch(`/api/posts/content/${category}/${slug}`);
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            const result = await res.json();
            if (!active) return;
            decodedContent = result.html;
            isLoading = false;
          } catch (e) {
            console.error("Failed to load post content:", e);
            isLoading = false;
          }
        } else {
          isLoading = false;
        }

        if (!active) return;

        // 2. Inspect decodedContent to see what needs to be loaded
        const contentStr = decodedContent || "";
        const hasMermaid = contentStr.includes("mermaid");
        const hasMarkmap = contentStr.includes("markmap");
        const hasGraphviz = contentStr.includes("graphviz") || contentStr.includes("dot");
        const hasPdf = contentStr.includes("attachment") || contentStr.includes("pdf");
        const hasKatex = contentStr.includes("$") || contentStr.includes("\\(") || contentStr.includes("\\[") || contentStr.includes("katex");
        const hasHighlight = contentStr.includes("<pre>") || contentStr.includes("code");

        postHasMath = hasKatex;

        // 3. Dynamically import only the needed libraries
        const [
          katex,
          autoRender,
          hljsModule,
          mermaidModule,
          Mark,
          d3,
          markmapView,
          markmapLib,
          VizModule,
          pdfjsLibModule
        ] = await Promise.all([
          hasKatex ? import("katex") : Promise.resolve(null),
          hasKatex ? import("katex/dist/contrib/auto-render.js") : Promise.resolve(null),
          hasHighlight ? import("highlight.js") : Promise.resolve(null),
          hasMermaid ? import("mermaid") : Promise.resolve(null),
          import("mark.js"), // search always uses mark
          hasMarkmap ? import("d3") : Promise.resolve(null),
          hasMarkmap ? import("markmap-view") : Promise.resolve(null),
          hasMarkmap ? import("markmap-lib") : Promise.resolve(null),
          hasGraphviz ? import("@viz-js/viz") : Promise.resolve(null),
          hasPdf ? import("pdfjs-dist") : Promise.resolve(null)
        ]);

        if (!active) return;

        if (hasKatex) {
          await import("katex/dist/katex.min.css");
        }

        const mermaid = mermaidModule ? (mermaidModule.default || mermaidModule) : null;

        // 4. Assign to window for backward compatibility with vanilla JS scripts
        const w = /** @type {any} */ (window);
        if (katex) w.katex = katex;
        if (autoRender) w.renderMathInElement = autoRender.default || autoRender;
        if (hljsModule) w.hljs = hljsModule.default;
        if (mermaid) w.mermaid = mermaid;
        if (Mark) w.Mark = Mark.default || Mark;
        if (d3) w.d3 = d3;
        if (markmapView && markmapLib) {
          w.markmap = {
            Transformer: markmapLib.Transformer,
            Markmap: markmapView.Markmap,
            deriveOptions: markmapView.deriveOptions,
            loadCSS: markmapView.loadCSS,
            loadJS: markmapView.loadJS,
          };
        }
        if (VizModule) w.Viz = VizModule;
        if (pdfjsLibModule) {
          w.pdfjsLib = pdfjsLibModule;
          pdfjsLibModule.GlobalWorkerOptions.workerSrc = new URL(
            "pdfjs-dist/build/pdf.worker.min.mjs",
            import.meta.url
          ).toString();
        }

        // 5. Wait for Svelte DOM tick, then initialize post features
        await tick();
        if (!active) return;
        await initPostFeatures();
      } catch (err) {
        console.error("Failed to load dependencies dynamically:", err);
        isLoading = false;
      }
    }

    /** Shared post-render initialization for both SSR and client-fetched content */
    async function initPostFeatures() {
      // 1. Run raw HTML string replacements FIRST synchronously
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

      // Render Mermaid synchronously now that initializePostBase (which replaces the nodes) ran synchronously
      // @ts-ignore
      if (typeof mermaid !== "undefined") {
        // @ts-ignore
        mermaid.initialize({ startOnLoad: false, theme: document.body.classList.contains('dark') ? 'dark' : 'default' });
        try {
          // @ts-ignore
          await mermaid.run({ querySelector: '.mermaid-diagram' });
        } catch (e) {
          console.error('Mermaid render error:', e);
        }
      }

      addHeadingAnchorLinks();
      initTOC();
      initializeListenComponent();
      renderMath();
    }

    init();

    return () => {
      active = false;
    };
  });

  $effect(() => {
    if (decodedContent) {
      if (typeof document !== 'undefined') {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = decodedContent;
        postContentText = tempDiv.textContent || "";
      }
    }
  });

  // Search Logic
  $effect(() => {
    if ($showSearchBoxStore) {
      tick().then(() => searchInputRef?.focus());
    }
  });

  /** @param {KeyboardEvent} e */
  function handleKeydown(e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      showSearchBoxStore.set(true);
    } else if (e.key === 'Escape' && $showSearchBoxStore) {
      closeSearch();
    }
  }

  function performSearch() {
    if (typeof window === 'undefined') return;
    const visEl = document.querySelector('.post-content-visible');
    if (!visEl) return;
    // @ts-ignore
    if (!window.Mark) return;
    
    // Always create a new Mark instance for the current visible element
    // @ts-ignore
    const instance = new window.Mark(visEl);
    
    instance.unmark({
      done: () => {
        if (!searchQuery.trim()) {
          matchCount = 0;
          currentMatchIndex = 0;
          return;
        }
        instance.mark(searchQuery, {
          separateWordSearch: false,
          className: 'search-mark',
          done: (/** @type {number} */ count) => {
            matchCount = count;
            currentMatchIndex = count > 0 ? 1 : 0;
            updateActiveMatch(false);
          }
        });
      }
    });
  }

  function updateActiveMatch(smooth = true) {
    if (typeof window === 'undefined' || matchCount === 0) return;
    const visEl = document.querySelector('.post-content-visible');
    if (!visEl) return;
    
    // Query DOM dynamically to ensure we always get current, valid nodes
    const elements = visEl.querySelectorAll('mark.search-mark');
    if (elements.length === 0) return;
    
    elements.forEach(el => el.classList.remove('active'));
    const activeEl = elements[currentMatchIndex - 1];
    if (activeEl) {
      activeEl.classList.add('active');
      
      // Delay scrolling to ensure DOM/CSS updates don't block the scroll event
      setTimeout(() => {
        try {
          activeEl.scrollIntoView({ block: 'center', behavior: smooth ? 'smooth' : 'auto' });
        } catch(e) {
          activeEl.scrollIntoView();
        }
      }, 10);
    }
  }

  // nextMatch and prevMatch are already bound to onclick handlers in the template
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
    showSearchBoxStore.set(false);
    searchQuery = "";
    performSearch();
  }

  /** @param {Event} e */
  function handleThemeChange(e) {
    const customEvent = /** @type {CustomEvent} */ (e);
    const dark = customEvent.detail.isDark;
    // @ts-ignore
    if (typeof window !== 'undefined' && window.mermaid) {
      // @ts-ignore
      const mermaid = window.mermaid;
      mermaid.initialize({ startOnLoad: false, theme: dark ? 'dark' : 'default' });
      const diagrams = document.querySelectorAll('.mermaid-diagram');
      diagrams.forEach(async (el, index) => {
        const src = el.getAttribute('data-mermaid-src');
        if (src) {
           try {
              // clear previous content
              el.innerHTML = '';
              el.removeAttribute('data-processed');
              const id = `mermaid-${Date.now()}-${index}`;
              const { svg } = await mermaid.render(id, src);
              el.innerHTML = svg;
           } catch (err) {
              console.error('Mermaid re-render error:', err);
           }
        }
      });
    }
  }

  onMount(() => {
    if (typeof window !== 'undefined') {
      window.addEventListener('themeChanged', handleThemeChange);
      return () => {
        window.removeEventListener('themeChanged', handleThemeChange);
      };
    }
  });

  onDestroy(() => {
    if (typeof window !== 'undefined') {
      const w = /** @type {any} */ (window);
      if (w._tocScrollHandler) {
        document.removeEventListener('scroll', w._tocScrollHandler);
        w._tocScrollHandler = null;
      }
      if (w._tocDesktopResizeHandler) {
        window.removeEventListener('resize', w._tocDesktopResizeHandler);
        w._tocDesktopResizeHandler = null;
      }
      const menu = document.getElementById('custom-context-menu');
      if (menu) menu.remove();
    }
  });
</script>

<svelte:window onkeydown={handleKeydown} onscroll={handleScroll} />

<svelte:head>
  <title>{data.title} - Insightroom</title>
  <meta
    property="og:title"
    content={data.title || "Insightroom"}
  />
  <meta
    property="og:description"
    content={data.excerpt ||
      "For minds that want more - a lil more than academics."}
  />
  <meta
    property="og:image"
    content={`${$page.url.origin}/api/og-image?url=${encodeURIComponent(data.image || "/assets/img/og-theinsroom.jpg")}`}
  />
  <meta
    property="og:url"
    content={$page.url.href}
  />
  <meta property="og:type" content="article" />
  <meta name="description" content={data.excerpt || "For minds that want more - a lil more than academics."} />
  <meta name="twitter:card" content="summary_large_image" />
  <meta
    name="twitter:title"
    content={data.title || "Insightroom"}
  />
  <meta property="article:published_time" content={new Date(data.date).toISOString()} />
  
  {#if data.tags && data.tags.length > 0}
    {#each data.tags as tag}
      <meta property="article:tag" content={tag} />
    {/each}
  {/if}

  <!-- JSON-LD Structured Data for SEO -->
  <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": {JSON.stringify(data.title)},
      "description": {JSON.stringify(data.description)},
      {#if data.coverImage}"image": {JSON.stringify(new URL(data.coverImage, $page.url.origin).toString())},{/if}
      "datePublished": {JSON.stringify(new Date(data.date).toISOString())},
      "publisher": {
        "@type": "Organization",
        "name": "Insightroom",
        "url": $page.url.origin
      },
      "mainEntityOfPage": {
        "@type": "WebPage",
        "@id": $page.url.href
      }
    }
  </script>
</svelte:head>

<div class="reading-progress-bar" style="width: {scrollProgress}%;"></div>

<!-- Custom Search UI -->
{#if $showSearchBoxStore}
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

<!-- Desktop Fixed Back Button -->
<button
  class="post-back-btn-desktop"
  title="Back"
  onclick={() => {
    if (document.referrer) history.back();
    else window.location.href = "/";
  }}
>
  <i class="fa-solid fa-arrow-left" style="font-size: 12px;"></i>
  <span class="desktop-text">Back</span>
</button>

<main
  class="post-container"
  style="font-family: var(--font-primary);"
  data-visibility={data.visibility}
  data-category={data.category}
  data-no-ads={data["no-ads"]}
>
  <article class="post" style="max-width: 700px; margin: 0 auto; position: relative;">
    <div style="text-align: center;">
      <!-- Date, Category, and Reading Time Pill -->
      <div class="post-meta-container">
        <!-- Right Side: Meta Pill & Navigation -->
        <div class="post-meta-pill-wrapper">
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
              <span class="reading-time">• {data.readingTime || 1} minute read</span>
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

      <!-- Cover Artifact Target -->
      <div id="post-cover-target" style="display: {hasCoverArtifact ? 'block' : 'none'};"></div>

      {#if !hasCoverArtifact}
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
                  src={optimizeCloudinaryUrl(data.image || "", 800)}
                  alt={data.title || "Cover image"}
                  class="post-cover"
                  style="border-radius: 12px; display: block; width: 100%; height: auto; object-fit: cover;"
                  fetchpriority="high"
                  width="700"
                  height="420"
                />
              {/if}
            </div>
          </div>
        {/if}
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
                {#each postAuthors().slice(0, 4) as author, i}
                  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
                  <div class="author-hover-container" tabindex="0" style="--author-index: {i}">
                    <div
                      class="author-avatar stacked-author-avatar"
                      title={author.name}
                      style="width: 35px; height: 35px; border-radius: 50%; overflow: hidden; border: 2px solid rgba(0,0,0,0.1);"
                    >
                      <img
                        src={optimizeSupabaseUrl(author.avatar, 35)}
                        alt={author.name}
                        style="width: 100%; height: 100%; object-fit: cover;"
                        width="35"
                        height="35"
                      />
                    </div>
                    {#if authorsMap[author.name]}
                      <div class="author-hover-card">
                        <div class="author-hover-photo">
                          <img
                            src={optimizeSupabaseUrl(authorsMap[author.name].passportPhoto, 90)}
                            alt={author.name}
                            width="90"
                            height="115"
                          />
                        </div>
                        <div class="author-hover-info">
                          <div class="author-hover-name">{authorsMap[author.name].name}</div>
                          <div class="author-hover-tags">
                            {authorsMap[author.name].tags.join(", ")}
                          </div>
                          <div class="author-hover-desc">
                            <div>
                              {formatAuthorDescription(authorsMap[author.name]?.description)}
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
                <img src="/assets/img/plus_shim.svg" alt="materio. plus" width="200" height="39" />
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
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div class="post-content-visible" onclick={handleContentClick}>
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

{#if showLightbox}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="lightbox-overlay" onclick={closeLightbox} transition:fade={{ duration: 200 }}>
    <button class="lightbox-close" aria-label="Close full screen">
      <i class="fa-solid fa-xmark"></i>
    </button>
    <div class="lightbox-content" onclick={(e) => e.stopPropagation()}>
      {#if lightboxMedia.type === 'image'}
        <img src={lightboxMedia.src} alt={lightboxMedia.alt} />
      {:else if lightboxMedia.type === 'video'}
        <!-- svelte-ignore a11y_media_has_caption -->
        <video src={lightboxMedia.src} controls autoplay></video>
      {/if}
    </div>
  </div>
{/if}

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


  .reading-progress-bar {
    position: fixed;
    top: 0;
    left: 0;
    height: 3px;
    background-color: #8c8c85;
    z-index: 10005;
    transition: width 80ms ease-out;
    pointer-events: none;
  }
  :global(body.dark-mode) .reading-progress-bar,
  :global(body.dark) .reading-progress-bar {
    background-color: #a0a09a;
  }

  @media print {
    .reading-progress-bar {
      display: none !important;
    }
  }

  .post-meta-container {
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
    margin-bottom: 1.5rem;
    min-height: 32px;
  }

  .post-meta-pill-wrapper {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .post-back-btn-desktop {
    position: fixed;
    top: 75px;
    left: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    text-decoration: none;
    transition: all 0.2s ease;
    cursor: pointer;
    font-family: var(--font-primary);
    background: none;
    border: none;
    padding: 0;
    color: inherit;
    opacity: 0.6;
    z-index: 1000;
  }

  .post-back-btn-desktop .desktop-text {
    font-size: 14px;
    font-weight: 500;
  }

  .post-back-btn-desktop:hover {
    opacity: 1;
    transform: translateX(-4px);
  }

  .post-back-btn-desktop:active {
    transform: translateX(-8px);
  }

  @media (max-width: 1100px) {
    .post-back-btn-desktop {
      display: none;
    }

    .post-meta-container {
      padding: 0 1rem;
    }
    
    .post-meta-pill-wrapper {
      width: 100%;
      justify-content: center;
    }
  }

  #post-cover-target {
    --progress: 0;
    position: relative;
    box-sizing: border-box;
    overflow: hidden;
    
    /* Breakthrough margin / breakout logic */
    width: calc(100vw - (100vw - 100%) * var(--progress));
    margin-left: calc(-50vw * (1 - var(--progress)));
    margin-right: calc(-50vw * (1 - var(--progress)));
    left: calc(50% * (1 - var(--progress)));
    
    /* Morph to squircle frame matching .post-image-frame */
    corner-shape: squircle !important;
    border-radius: calc(40px * var(--progress)) !important;
    padding: calc(5px * var(--progress));
    
    margin-top: calc(1.5rem * var(--progress));
    margin-bottom: calc(1.5rem * var(--progress));
    
    /* Background transitions */
    background: rgba(231, 227, 223, var(--progress));
    
    /* Optimize rendering and performance */
    will-change: width, margin, left, border-radius, padding, background-color;
    transform: translate3d(0, 0, 0);
  }

  :global(body.dark-mode) #post-cover-target,
  :global(body.dark) #post-cover-target {
    background: rgba(44, 44, 42, var(--progress));
  }

  /* --- Lightbox Styles --- */
  .lightbox-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    z-index: 999999;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: zoom-out;
  }
  .lightbox-close {
    position: absolute;
    top: 30px;
    right: 40px;
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(255, 255, 255, 0.2);
    backdrop-filter: blur(4px);
    color: white;
    font-size: 20px;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    cursor: pointer;
    z-index: 1000000;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }
  .lightbox-close:hover {
    background: rgba(0, 0, 0, 0.7);
    transform: scale(1.05);
  }
  .lightbox-content {
    max-width: 80vw;
    max-height: 80vh;
    cursor: default;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .lightbox-content img, .lightbox-content video {
    max-width: 80vw;
    max-height: 80vh;
    object-fit: contain;
    border-radius: 8px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
  }
</style>
