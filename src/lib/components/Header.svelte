<script>
  import { page } from "$app/stores";
  import { searchTerm } from "$lib/stores/search";

  let { isPost = false, isHome = false } = $props();
</script>

<header class="site-header">
  <a href="/" class="header-logo" role="button" aria-label="Go to homepage"></a>

  {#if isPost}
    <button
      class="toc-mobile-toggle"
      data-state="closed"
      aria-label="Open table of contents"
      title="Open table of contents"
    >
      <span class="toc-mobile-icon toc-mobile-icon-menu" aria-hidden="true">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          width="24"
          height="24"
          color="currentColor"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M 20 19 L 10 19" />
          <path d="M 20 12 L 4 12" />
          <path d="M 20 5 L 4 5" />
        </svg>
      </span>
      <span class="toc-mobile-icon toc-mobile-icon-close" aria-hidden="true">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          width="22"
          height="22"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M6 6L18 18" />
          <path d="M18 6L6 18" />
        </svg>
      </span>
    </button>
  {/if}

  <!-- Search box for home layout -->
  {#if isHome}
    <div class="header-search">
      <input
        type="text"
        id="search-input"
        placeholder="Search posts..."
        aria-label="Search posts"
        bind:value={$searchTerm}
      />
      <i class="fa-solid fa-search"></i>
    </div>
  {/if}

  <!-- Exit icon for post pages -->
  {#if isPost}
    <button
      class="back-button"
      style="position: absolute; right: 20px; top: 50%; transform: translateY(-50%); color: var(--text); text-decoration: none; font-size: 1.2rem; background: none; border: none; cursor: pointer; z-index: 100;"
      onclick={() => {
        if (document.referrer) history.back();
        else window.location.href = "/";
      }}
      onmousedown={(e) => (e.currentTarget.style.color = "#ff8200")}
      onmouseup={(e) => (e.currentTarget.style.color = "var(--text)")}
      onmouseleave={(e) => (e.currentTarget.style.color = "var(--text)")}
      aria-label="Back"
    >
      <i class="fa-regular fa-arrow-left-from-bracket"></i>
    </button>
  {/if}
</header>
