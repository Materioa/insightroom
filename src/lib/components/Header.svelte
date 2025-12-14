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

<style>
  /* Header Search Box */
  .header-search {
    position: absolute;
    right: 20px;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    align-items: center;
    background: rgba(231, 231, 221, 0.5);
    border: 1px solid var(--border, #e0e0e0);
    border-radius: 25px;
    padding: 0.5rem 1rem;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    transition: all 0.3s ease;
    width: 250px;
  }

  .header-search:focus-within {
    border-color: var(--primary, #ff9320);
    box-shadow: 0 0 0 2px rgba(255, 145, 0, 0.2);
  }

  .header-search input {
    font-family: "Manrope", sans-serif;
    background: transparent;
    border: none;
    outline: none;
    flex: 1;
    font-size: 0.9rem;
    color: var(--text, #333);
    padding: 0;
  }

  .header-search input::placeholder {
    color: var(--muted-text, #999);
  }

  .header-search i {
    color: var(--muted-text, #999);
    margin-left: 0.5rem;
    font-size: 0.9rem;
  }

  /* Dark mode styles for search */
  :global(.dark) .header-search {
    background: rgba(33, 33, 33, 0.5);
    border-color: var(--border, #404040);
  }

  :global(.dark) .header-search input {
    color: var(--text, #ccc);
  }

  @media (max-width: 768px) {
    .header-search {
      width: 200px;
      padding: 0.4rem 0.8rem;
      right: 15px;
    }

    .header-search input {
      font-size: 0.85rem;
    }
  }
</style>
