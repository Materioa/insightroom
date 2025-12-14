<script>
  import { onMount } from "svelte";
  import {
    addHeadingAnchorLinks,
    buildTOCFallback,
    wireTOCSidebar,
    wireTOCActiveTracking,
    initializeListenComponent,
    toggleListen,
    seekBackward,
    seekForward,
    stopAudio,
  } from "../../../lib/utils/postLogic.js";
  import { initializePostBase } from "../../../lib/utils/postBaseLogic.js";

  /** @type {{ data: any }} */
  let { data } = $props();

  /** @param {string} dateStr */
  function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  /** @param {string} url */
  function isVideo(url) {
    return (
      url &&
      (url.endsWith(".mp4") || url.endsWith(".webm") || url.endsWith(".mov"))
    );
  }

  /** @param {string} url */
  function getVideoType(url) {
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

  onMount(() => {
    // Enhanced post links script
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
          if (!a.querySelector("i.fa-arrow-up-right")) {
            const i = document.createElement("i");
            i.className = "fa-regular fa-arrow-up-right";
            a.appendChild(i);
          }
          try {
            const href = a.getAttribute("href");
            if (href) {
              const url = new URL(href, window.location.href);
              if (url.origin && url.origin !== window.location.origin) {
                a.setAttribute("target", "_blank");
                a.setAttribute("rel", "noopener noreferrer");
              }
            }
          } catch (e) {
            // ignore parse errors
          }
        });
      });
    }

    enhancePostLinks(".post-body");
    enhancePostLinks(".post-content");

    // Highlight code blocks
    // @ts-ignore
    if (typeof hljs !== "undefined") hljs.highlightAll();

    // Initialize mermaid
    // @ts-ignore
    if (typeof mermaid !== "undefined") {
      // @ts-ignore
      mermaid.initialize({ startOnLoad: true });
    }

    // Initialize Post Logic (TOC, Anchors, Listen)
    addHeadingAnchorLinks();
    buildTOCFallback();
    wireTOCSidebar();
    wireTOCActiveTracking();
    initializeListenComponent();

    // Render math
    // @ts-ignore
    if (typeof renderMathInElement !== "undefined") {
      setTimeout(() => {
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
        // Explicitly render sidebar in case it was missed
        const sidebar = document.getElementById("site-toc-sidebar");
        if (sidebar) {
          // @ts-ignore
          renderMathInElement(sidebar, options);
        }
      }, 100);
    }

    // Initialize Post Base Features (Code Blocks, Print, Security)
    initializePostBase();
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
    content={`https://materioa.vercel.app${data.image || "/assets/img/og-theinsroom.jpg"}`}
  />
  <meta
    property="og:url"
    content={`https://materioa.vercel.app/blog/${data.slug}`}
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
    content={`https://materioa.vercel.app${data.image || "/assets/img/og-theinsroom.jpg"}`}
  />
</svelte:head>

<main
  class="post-container"
  style="font-family: 'Manrope', sans-serif;"
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
                  <source src={data.image} type={getVideoType(data.image)} />
                  Your browser does not support the video tag.
                </video>
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
                src={data.image}
                alt="Cover image"
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
              <i
                class="fa-regular fa-link-simple"
                onclick={sharePost}
                style="transform: rotate(-45deg); font-size: 14px; cursor: pointer; color: var(--text);"
                title="Share"
              ></i>
            {/if}
            {#if !data["hide_print"]}
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
    </div>

    <div class="post-layout">
      <div class="post-body">
        {#if data.isLocked}
          <div
            style="text-align: center; padding: 2rem; max-width: 500px; margin: 0 auto;"
          >
            <h1 style="color: #ff8759; margin-bottom: 1rem;">
              <i class="fa-solid fa-lock"></i> Uh-oh! This Page is Off-limits
            </h1>
            <p style="font-size: 1.1rem; margin-bottom: 1.5rem;">
              This Post is only available to Plus and Super users.
            </p>
            <p style="color: var(--gray); margin-bottom: 2rem;">
              Please log in with your Plus or Super account to view this
              content.
            </p>
            <a
              href="https://materioa.vercel.app/account"
              style="background: #ff8200; color: white; padding: 0.75rem 1.5rem; border-radius: 8px; text-decoration: none; font-weight: 600;"
            >
              Log In
            </a>
          </div>
        {:else}
          <data.content />
        {/if}
      </div>

      <aside class="post-toc" aria-label="Table of contents">
        <!-- TOC will be generated by JavaScript and moved to sidebar -->
      </aside>
    </div>
  </article>
</main>

<!-- Site-level TOC sidebar -->
<div id="site-toc-sidebar" class="site-toc-sidebar" aria-hidden="true">
  <!-- TOC content will be moved here -->
</div>
<div
  id="site-toc-overlay"
  class="site-toc-overlay"
  tabindex="-1"
  aria-hidden="true"
  onclick={() => {
    document.body.classList.remove("toc-open");
    const sidebar = document.getElementById("site-toc-sidebar");
    if (sidebar) sidebar.setAttribute("aria-hidden", "true");
  }}
></div>
