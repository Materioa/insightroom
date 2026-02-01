<script>
  import { page } from "$app/stores";
  import { searchTerm } from "$lib/stores/search";

  let { isPost = false, isHome = false } = $props();
</script>

<header class="site-header">
  <a href="/" class="header-logo" role="button" aria-label="Go to homepage"></a>

  {#if isPost}
    <button
      class="toc-toggle"
      aria-label="Toggle table of contents"
      title="Toggle table of contents"
    >
      <i class="fa-light fa-sidebar"></i>
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
