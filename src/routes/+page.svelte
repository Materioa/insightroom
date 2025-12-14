<script>
  import { onMount } from 'svelte';
  import { searchTerm } from '$lib/stores/search';
  
  /** @type {{ data: import('./$types').PageData }} */
  let { data } = $props();

  // Logic to organize posts
  let posts = $derived(data.posts.filter(p => p.hasAccess));
  let postsWithImages = $derived(posts.filter(p => p.image));
  let heroPost = $derived(postsWithImages.length > 0 ? postsWithImages[0] : null);
  
  // Quick Reads - posts without images, limit to 10
  let quickReads = $derived(posts
    .filter(p => !p.image)
    .slice(0, 10));

  // Grid posts - all posts with images, excluding the hero post
  let gridPosts = $derived(postsWithImages.slice(1));

  // Categories
  let categories = $derived(data.categories || []);
  let selectedCategory = $state('all');

  // Search
  /** @type {any[]} */
  let searchResults = $state([]);

  // Reactively update search results when $searchTerm changes
  $effect(() => {
    if (!$searchTerm.trim()) {
      searchResults = [];
    } else {
      const term = $searchTerm.toLowerCase();
      searchResults = posts.filter(post => 
        post.title?.toLowerCase().includes(term) || 
        (post.excerpt && post.excerpt.toLowerCase().includes(term))
      );
    }
  });

  /** @param {string} url */
  function isVideo(url) {
    return url && (url.endsWith('.mp4') || url.endsWith('.webm') || url.endsWith('.mov'));
  }

  /** @param {string} url */
  function getVideoType(url) {
    if (url.endsWith('.webm')) return 'video/webm';
    if (url.endsWith('.mov')) return 'video/quicktime';
    return 'video/mp4';
  }

  /** @param {string} dateStr */
  function formatDate(dateStr, format = 'long') {
    const date = new Date(dateStr);
    if (format === 'short') {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }

  /** @param {any} post */
  function getCategory(post) {
    if (post.category) return post.category;
    if (post.categories) {
      return Array.isArray(post.categories) ? post.categories[0] : post.categories;
    }
    return null;
  }

  /** @param {any} post */
  function matchesCategory(post) {
    if (selectedCategory === 'all') return true;
    const cat = getCategory(post);
    return cat?.toLowerCase().replace(/\s+/g, '-') === selectedCategory.toLowerCase().replace(/\s+/g, '-');
  }
</script>

<svelte:head>
  <title>Materio - The InsightRoom</title>
  <meta property="og:title" content="Materio - The InsightRoom">
  <meta property="og:description" content="The InsightRoom is a place to find insightful reads">
  <meta property="og:image" content="https://materioa.vercel.app/assets/img/og-theinsroom.jpg">
  <meta property="og:url" content="https://materioa.vercel.app/room">
  <meta property="og:type" content="website">
</svelte:head>

<div class="home-container">
  <!-- Hero Section -->
  <div class="hero-section">
    {#if $searchTerm}
      <!-- Search Results Mode -->
      <div class="search-results-hero">
        <h2 class="search-results-title">Search Results</h2>
        {#if searchResults.length > 0}
          <div class="search-results-grid">
            {#each searchResults as post}
              <a class="post-card no-border" href={post.url}>
                {#if post.image}
                  {#if isVideo(post.image)}
                    <div class="video-thumbnail">
                      <video muted loop autoplay>
                        <source src={post.image} type={getVideoType(post.image)}>
                      </video>
                    </div>
                  {:else}
                    <img src={post.image} class="post-image rounded" alt="{post.title} thumbnail">
                  {/if}
                {/if}
                <div class="post-meta">
                  <h2 class="post-title">
                    {post.title}
                    {#if post.visibility === 'private'}
                      <span class="private-badge"><i class="fa-solid fa-lock"></i> Private</span>
                    {/if}
                  </h2>
                  <p class="post-date">{formatDate(post.date)}</p>
                </div>
              </a>
            {/each}
          </div>
        {:else}
          <div class="no-results">
            <p>No posts found matching your search.</p>
          </div>
        {/if}
      </div>
    {:else}
      <!-- Normal Hero Mode -->
      {#if heroPost}
        <div class="hero-content">
          <a class="hero-post" href={heroPost.url} data-visibility={heroPost.visibility}>
            {#if isVideo(heroPost.image)}
              <div class="hero-video">
                <video muted loop autoplay>
                  <source src={heroPost.image} type={getVideoType(heroPost.image)}>
                </video>
              </div>
            {:else}
              <img src={heroPost.image} class="hero-image" alt="{heroPost.title} thumbnail">
            {/if}
            <div class="hero-meta">
              <p class="post-date">{formatDate(heroPost.date)}</p>
              <h2 class="post-title">
                {heroPost.title}
                {#if heroPost.visibility === 'private'}
                  <span class="private-badge"><i class="fa-solid fa-lock"></i> Private</span>
                {/if}
              </h2>
            </div>
          </a>
        </div>
      {/if}

      <!-- Quick Reads -->
      <div class="uncategorized-posts">
        <h3 class="uncategorized-title">Quick Reads</h3>
        <div class="uncategorized-list">
          {#each quickReads as post}
            <a class="uncategorized-item" href={post.url} data-visibility={post.visibility}>
              <h4 class="uncategorized-item-title">
                {post.title}
                {#if post.visibility === 'private'}
                  <i class="fa-solid fa-lock"></i>
                {/if}
              </h4>
              <p class="uncategorized-item-date">{formatDate(post.date, 'short')}</p>
            </a>
          {/each}
        </div>
      </div>
    {/if}
  </div>

  {#if !$searchTerm}
    <!-- Category Selector -->
    <div class="category-selector">
      <button 
        class="category-pill {selectedCategory === 'all' ? 'active' : ''}" 
        onclick={() => selectedCategory = 'all'}
      >All Posts</button>
      {#each categories as category}
        <button 
          class="category-pill {selectedCategory === category ? 'active' : ''}" 
          onclick={() => selectedCategory = category}
        >{category}</button>
      {/each}
    </div>

    <!-- Post Grid -->
    <div class="post-grid">
      {#each gridPosts as post}
        {#if matchesCategory(post)}
          <a class="post-card no-border" href={post.url} data-visibility={post.visibility} data-category={getCategory(post)?.toLowerCase().replace(/\s+/g, '-')}>
            {#if isVideo(post.image)}
              <div class="video-thumbnail">
                <video muted loop autoplay>
                  <source src={post.image} type={getVideoType(post.image)}>
                </video>
              </div>
            {:else}
              <img src={post.image} class="post-image rounded" alt="{post.title} thumbnail">
            {/if}
            <div class="post-meta">
              <h2 class="post-title">
                {post.title}
                {#if post.visibility === 'private'}
                  <span class="private-badge"><i class="fa-solid fa-lock"></i> Private</span>
                {/if}
              </h2>
              {#if getCategory(post)}
                <p class="post-category">{getCategory(post)}</p>
              {/if}
              <p class="post-date">{formatDate(post.date)}</p>
            </div>
          </a>
        {/if}
      {/each}
    </div>
  {/if}
</div>

<style>
  /* Hero Section Layout */
  .hero-section {
    display: flex;
    gap: 2rem;
    margin-bottom: 3rem;
    align-items: flex-start;
  }

  .hero-content {
    flex: 1;
    min-width: 0;
  }

  /* Search Results at Hero Position */
  .search-results-hero {
    flex: 1;
    min-width: 0;
  }

  .search-results-title {
    font-size: 1.5rem;
    margin: 0 0 1.5rem 0;
    color: var(--text, #333);
    font-weight: 600;
  }

  .search-results-grid {
    display: grid;
    gap: 1.5rem;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  }

  .no-results {
    text-align: center;
    padding: 2rem;
    color: var(--muted-text, #666);
    background: var(--card-bg, #ffffff);
    border: 1px solid var(--border, #e5e5e5);
    border-radius: 12px;
  }

  /* Quick Reads Container */
  .uncategorized-posts {
    width: 300px;
    flex-shrink: 0;
    background: var(--card-bg, #f9f8f7);
    border-radius: 16px;
    padding: 1.5rem;
    height: 400px;
    display: flex;
    flex-direction: column;
    border: 1px solid var(--border, #e5e5e5);
    box-sizing: border-box;
  }

  .uncategorized-title {
    margin: 0 0 1rem 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text, #333);
  }

  .uncategorized-list {
    flex: 1;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--border, #e5e5e5) transparent;
  }

  .uncategorized-item {
    display: block;
    text-decoration: none;
    color: inherit;
    padding: 0.75rem 0;
    border-bottom: 1px solid var(--border, #f0f0f0);
    transition: background-color 0.2s ease;
  }

  .uncategorized-item:hover {
    background: var(--hover-bg, #f8f8f8);
    border-radius: 8px;
    margin: 0 -0.5rem;
    padding-left: 0.5rem;
    padding-right: 0.5rem;
  }

  .uncategorized-item:last-child {
    border-bottom: none;
  }

  .uncategorized-item-title {
    margin: 0 0 0.25rem 0;
    font-size: 0.95rem;
    font-weight: 500;
    line-height: 1.3;
    color: var(--text, #333);
  }

  .uncategorized-item-date {
    margin: 0;
    font-size: 0.8rem;
    color: var(--muted-text, #666);
  }

  /* Category Selector */
  .category-selector {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 2rem;
    flex-wrap: wrap;
    align-items: center;
  }

  .category-pill {
    font-family: 'Manrope', sans-serif;
    background: var(--pill-bg, #f9f8f7);
    border: 1px solid var(--border, #e0e0e0);
    color: var(--text, #666);
    padding: 0.5rem 1rem;
    border-radius: 25px;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
  }

  .category-pill:hover {
    background: var(--pill-hover-bg, #e8e8e8);
    backdrop-filter: blur(10px);
    transform: translateY(-1px);
  }

  .category-pill.active {
    background: var(--primary, #ff9320);
    color: white;
    border-color: var(--primary, #ffcc1d);
  }

  /* Video thumbnail styles */
  .video-thumbnail {
    position: relative;
    width: 100%;
    height: 180px;
    overflow: hidden;
    border-radius: 12px;
  }

  .video-thumbnail video {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  /* Hero video thumbnail styles */
  .hero-video {
    position: relative;
    width: 100%;
    height: 250px;
    overflow: hidden;
    border-radius: 12px;
  }

  .hero-video video {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  /* Dark mode styles */
  :global(.dark) .uncategorized-posts {
    background: var(--card-bg, #1e1e1e);
    border-color: var(--border, #333);
  }

  :global(.dark) .uncategorized-item:hover {
    background: var(--hover-bg, #2a2a2a);
  }

  :global(.dark) .category-pill {
    background: var(--pill-bg, #2a2a2a);
    border-color: var(--border, #404040);
    color: var(--text, #ccc);
  }

  :global(.dark) .category-pill:hover {
    background: var(--pill-hover-bg, #3a3a3a);
  }

  :global(.dark) .no-results {
    background: var(--card-bg, #1e1e1e);
    border-color: var(--border, #333);
  }

  /* Responsive design */
  @media (max-width: 768px) {
    .hero-section {
      flex-direction: column;
      gap: 1rem;
    }

    .search-results-grid {
      grid-template-columns: 1fr;
      gap: 1rem;
    }

    .uncategorized-posts {
      width: 100%;
      max-width: 100%;
      height: 200px;
      padding: 1rem;
      margin: 0;
      box-sizing: border-box;
    }

    .uncategorized-title {
      font-size: 1.1rem;
      margin-bottom: 0.75rem;
    }

    .uncategorized-item {
      padding: 0.5rem 0;
    }

    .uncategorized-item-title {
      font-size: 0.9rem;
      line-height: 1.2;
    }

    .uncategorized-item-date {
      font-size: 0.75rem;
    }

    .category-selector {
      overflow-x: auto;
      flex-wrap: nowrap;
      padding-bottom: 0.5rem;
      scrollbar-width: none;
      -ms-overflow-style: none;
      margin: 0 -1rem;
      padding-left: 1rem;
      padding-right: 1rem;
    }

    .category-selector::-webkit-scrollbar {
      display: none;
    }

    .category-pill {
      padding: 0.4rem 0.8rem;
      font-size: 0.85rem;
    }
  }
</style>
