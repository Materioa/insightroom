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

  /** @type {{ data: any }} */
  let { data } = $props();
  // State for content binding
  /** @type {HTMLElement | undefined} */
  let contentElement = $state();
  let postContentText = $state("");
  let decodedContent = $state("");

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
      // Fetch post content dynamically to keep view-source clean
      if (!data.isLocked) {
        try {
          const category = encodeURIComponent(data.category || "");
          const slug = encodeURIComponent(data.slug || "");
          const res = await fetch(`/api/posts/content/${category}/${slug}`);
          if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
          const result = await res.json();
          decodedContent = result.html;

          // Now that content is in the DOM, initialize features
          setTimeout(async () => {
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
            initializePostBase();
          }, 0);

        } catch (e) {
          console.error("Failed to load post content:", e);
        }
      }
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
        }
    }

    init();

    const startTime = Date.now();
    return () => {
      const duration = Math.round((Date.now() - startTime) / 1000);
    };
  });
  $effect(() => {
    if (contentElement && contentElement.textContent) {
      postContentText = contentElement.textContent;
    }
  });
</script>

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
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/contrib/auto-render.min.js"></script>
  <script defer src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/highlight.min.js"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/mermaid@10.6.1/dist/mermaid.min.js"></script>

  <!-- Markmap for mindmaps -->
  <script defer src="https://cdn.jsdelivr.net/npm/d3@7"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/markmap-view@0.18.12"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/markmap-lib@0.18.12"></script>

  <!-- Graphviz for FSM/automata diagrams -->
  <script defer src="https://cdn.jsdelivr.net/npm/@viz-js/viz@3.11.0/lib/viz-standalone.js"></script>
  <script defer src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js"></script>

</svelte:head>

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
      </div>

      <p class="post-title" style="font-size: 32px; font-weight: bold;">
        {data.title}
        {#if data.visibility === "private"}
          <span class="private-badge"
            ><i class="fa-solid fa-lock"></i> Private</span
          >
        {/if}
      </p>

      {#if data.excerpt}
        <p
          class="post-description"
          style="font-size: 14px; margin-top: 0.5rem; color: var(--gray);"
        >
          {data.excerpt}
        </p>
      {/if}

      {#if data.image}
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

      <!-- Author and Share Row -->
      {#if !data["hide_author_share_row"]}
        <div
          class="author-share-row"
          style="display: flex; justify-content: space-between; align-items: center; margin: 0.5rem auto; max-width: 700px; padding: 0 1rem;"
        >
          <!-- Author Profile Section -->
          <div style="display: flex; align-items: center; gap: 0.8rem;">
            {#if !data["hide_author"]}
              <div
                class="author-avatar"
                style="width: 35px; height: 35px; border-radius: 50%; overflow: hidden; border: 2px solid rgba(0,0,0,0.1);"
              >
                <img
                  src="/assets/img/default-avatar.svg"
                  alt="Author"
                  style="width: 100%; height: 100%; object-fit: cover;"
                />
              </div>
              <div class="author-info">
                <div
                  class="author-name"
                  style="font-size: 14px; font-weight: 600; color: var(--text); line-height: 1.2;"
                >
                  Materio
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
          </div>
        </div>
      {/if}

      <!-- AI Summary/Ask Card -->
      {#if !data.isLocked}
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
        {:else}
          <!-- Capture content for summary (hidden, no IDs to avoid duplicates) -->
          <div
            bind:this={contentElement}
            class="summary-capture"
            style="display: none;"
          >
            {@html decodedContent}
          </div>

          <div class="post-content-visible">
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
