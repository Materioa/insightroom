<script>
  import { smoothCorners } from "@lisse/svelte";
  import D3AreaChart from '$lib/components/D3AreaChart.svelte';
  import PostAnalyticsModal from '$lib/components/PostAnalyticsModal.svelte';
  import { onMount } from 'svelte';

  // Svelte 5 props
  let { data } = $props();
  let analytics = $derived(data.analytics);
  
  let searchQuery = $state('');
  
  // Selected post for modal
  /** @type {{ id: string, title: string } | null} */
  let selectedPost = $state(null);

  let filteredPosts = $derived(
    analytics.topPosts.filter((/** @type {any} */ post) => 
      (post.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (post.slug || '').toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  /** @param {number} seconds */
  function formatDuration(seconds) {
    if (!seconds) return '0s';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  }

  /** @param {any} post */
  function showPostDetails(post) {
    selectedPost = {
      id: post.id,
      title: post.title || post.slug
    };
  }
</script>

<svelte:head>
  <title>Insightroom Analytics Dashboard</title>
  <link rel="icon" type="image/x-icon" href="/assets/img/room-icon-x.svg" />
</svelte:head>

<div use:smoothCorners={{ corners: { radius: 40, smoothing: 0.6 } }} class="cms-wrapper">
  <div class="cms-header">
    <div class="header-left">
      <h1>Collective Analytics</h1>
      <a href="/writer" class="desk-link-btn" title="Back to Writer's Desk">
        <i class="fa-solid fa-arrow-left"></i>
        <span>Writer's Desk</span>
      </a>
    </div>
    <div class="header-right">
      <input
        type="text"
        bind:value={searchQuery}
        placeholder="Search posts..."
        class="search-input"
      />
    </div>
  </div>

  <!-- Metric summary cards -->
  <div class="dashboard-grid">
    <div class="summary-card">
      <div class="card-icon"><i class="fa-regular fa-eye"></i></div>
      <div class="card-info">
        <span class="card-label">Total Views</span>
        <span class="card-value">{analytics.stats.totalViews}</span>
        <span class="card-sub">Site-wide unique sessions</span>
      </div>
    </div>
    <div class="summary-card">
      <div class="card-icon"><i class="fa-regular fa-clock"></i></div>
      <div class="card-info">
        <span class="card-label">Total Reading Time</span>
        <span class="card-value">{formatDuration(analytics.stats.totalDuration)}</span>
        <span class="card-sub">Accumulated reader time</span>
      </div>
    </div>
    <div class="summary-card">
      <div class="card-icon"><i class="fa-regular fa-scroll"></i></div>
      <div class="card-info">
        <span class="card-label">Avg Scroll Depth</span>
        <span class="card-value">{Math.round(analytics.stats.avgScrollDepth || 0)}%</span>
        <span class="card-sub">Average scroll activity</span>
      </div>
    </div>
    <div class="summary-card">
      <div class="card-icon"><i class="fa-regular fa-chart-line"></i></div>
      <div class="card-info">
        <span class="card-label">Retention Rate</span>
        <span class="card-value">{analytics.stats.retentionRate}%</span>
        <span class="card-sub">Views lasting > 30s</span>
      </div>
    </div>
    <div class="summary-card">
      <div class="card-icon"><i class="fa-regular fa-hands-clapping"></i></div>
      <div class="card-info">
        <span class="card-label">Total Claps</span>
        <span class="card-value">{analytics.stats.totalClaps}</span>
        <span class="card-sub">Total session claps</span>
      </div>
    </div>
  </div>

  <!-- Charts & Geographics Layout -->
  <div class="analytics-layout">
    <div class="chart-box">
      <h2>Traffic (Last 30 Days)</h2>
      <D3AreaChart data={analytics.timeline} height={240} />
    </div>

    <div class="geographic-box">
      <h2>Top Regions & Cities</h2>
      {#if !analytics.topLocations || analytics.topLocations.length === 0}
        <div class="empty-state-inner">No geographical data available.</div>
      {:else}
        <div class="country-list">
          {#each analytics.topLocations as geo}
            <div class="country-row">
              <span class="country-name">{geo.location || 'Unknown'}</span>
              <span class="views-badge">{geo.views} views</span>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>

  <!-- Posts Table -->
  <h2>Post Engagement</h2>
  <div use:smoothCorners={{ corners: { radius: 40, smoothing: 0.6 } }} class="table-container">
    <table class="cms-table">
      <thead>
        <tr>
          <th class="col-post">Post</th>
          <th class="col-stat text-right">Views</th>
          <th class="col-stat text-right">Read Time</th>
          <th class="col-stat text-right">Avg Scroll</th>
          <th class="col-stat text-right">Retention</th>
          <th class="col-stat text-right">Claps</th>
          <th class="col-action">Detail</th>
        </tr>
      </thead>
      <tbody>
        {#each filteredPosts as post}
          <tr>
            <td class="col-post">
              <div class="post-details">
                <!-- svelte-ignore a11y_invalid_attribute -->
                <a href="javascript:void(0)" class="file-link" onclick={() => showPostDetails(post)}>
                  {post.title || post.slug}
                </a>
              </div>
            </td>
            <td class="col-stat text-right font-mono">{post.views}</td>
            <td class="col-stat text-right font-mono">{formatDuration(post.totalDuration)}</td>
            <td class="col-stat text-right font-mono">{post.avgScrollDepth}%</td>
            <td class="col-stat text-right font-mono">{post.retentionRate}%</td>
            <td class="col-stat text-right font-mono">{post.totalClaps}</td>
            <td class="col-action">
              <button class="action-icon detail" onclick={() => showPostDetails(post)} title="View post analytics">
                <i class="fa-regular fa-chart-simple"></i>
              </button>
            </td>
          </tr>
        {/each}
        {#if filteredPosts.length === 0}
          <tr>
            <td colspan="7" class="empty-state">No posts found.</td>
          </tr>
        {/if}
      </tbody>
    </table>
  </div>
</div>

<!-- Modal Pop-up -->
{#if selectedPost}
  <PostAnalyticsModal
    postId={selectedPost.id}
    postTitle={selectedPost.title}
    onClose={() => selectedPost = null}
  />
{/if}

<style>
  @font-face {
    font-family: "PP Mori";
    src: url("/assets/fonts/PPMori_Regular.otf") format("opentype");
    font-weight: 400;
    font-style: normal;
    font-display: swap;
  }
  @font-face {
    font-family: "PP Mori";
    src: url("/assets/fonts/PPMori_SemiBold.otf") format("opentype");
    font-weight: 600;
    font-style: normal;
    font-display: swap;
  }

  :global(body) {
    background-color: var(--bg, #f5f5f5);
    margin: 0;
  }

  .cms-wrapper {
    font-family: var(--font-primary, "PP Mori", sans-serif);
    max-width: 1100px;
    margin: 0 auto;
    padding: 40px 20px;
    color: var(--text, #333);
  }

  .cms-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 30px;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 20px;
  }

  .header-left h1 {
    font-size: 32px;
    font-weight: 800;
    color: var(--text, #1a1a1a);
    margin: 0;
    letter-spacing: -1px;
  }

  .desk-link-btn {
    height: 36px;
    padding: 0 16px;
    background: var(--brand-orange, #ff5400);
    color: white;
    border-radius: 20px;
    display: flex;
    align-items: center;
    gap: 8px;
    text-decoration: none;
    font-size: 13px;
    font-weight: 600;
    transition: transform 0.2s, background 0.2s;
    border: none;
    cursor: pointer;
  }

  .desk-link-btn:hover {
    transform: scale(1.03);
    background: #e04a00;
  }

  .search-input {
    padding: 8px 16px;
    border: 1px solid var(--border, #e5e5e5);
    border-radius: 20px;
    font-family: var(--font-primary, "PP Mori", sans-serif);
    font-size: 14px;
    width: 220px;
    outline: none;
    color: var(--text, #333);
    background: var(--card-bg, #fff);
    transition: border-color 0.2s;
  }

  .search-input:focus {
    border-color: #ff5400;
  }

  /* Metric cards */
  .dashboard-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
    gap: 16px;
    margin-bottom: 32px;
  }

  .summary-card {
    background: var(--card-bg, #fff);
    border: 1px solid var(--border, #e5e5e5);
    border-radius: 20px;
    padding: 20px;
    display: flex;
    align-items: flex-start;
    gap: 16px;
  }

  .card-icon {
    width: 42px;
    height: 42px;
    border-radius: 12px;
    background: #fff8f5;
    color: #ff5400;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    flex-shrink: 0;
  }

  .card-info {
    display: flex;
    flex-direction: column;
  }

  .card-label {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    color: #888;
    letter-spacing: 0.5px;
  }

  .card-value {
    font-size: 24px;
    font-weight: 800;
    color: var(--text, #1a1a1a);
    margin: 4px 0 2px 0;
    letter-spacing: -0.5px;
  }

  .card-sub {
    font-size: 10px;
    color: #999;
  }

  /* Charts layout */
  .analytics-layout {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 20px;
    margin-bottom: 40px;
  }

  .chart-box, .geographic-box {
    background: var(--card-bg, #fff);
    border: 1px solid var(--border, #e5e5e5);
    border-radius: 20px;
    padding: 24px;
  }

  .chart-box h2, .geographic-box h2, h2 {
    font-size: 16px;
    font-weight: 800;
    margin: 0 0 16px 0;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text, #1a1a1a);
  }

  h2 {
    margin-top: 20px;
    margin-bottom: 16px;
  }

  .empty-state-inner {
    color: #aaa;
    font-style: italic;
    font-size: 13px;
    text-align: center;
    padding: 40px 0;
  }

  .country-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .country-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--border, #f5f5f5);
    padding-bottom: 8px;
    font-size: 13px;
  }

  .country-row:last-child {
    border-bottom: none;
  }

  .country-name {
    font-weight: 600;
  }

  .views-badge {
    background: var(--card-bg, #faf9f5); border: 1px solid var(--border, #ddd);
    color: #555;
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 12px;
    font-weight: 700;
  }

  /* Table style */
  .table-container {
    background: var(--card-bg, #fff);
    border: 1px solid var(--border, #e5e5e5);
    border-radius: 20px;
    overflow: hidden;
  }

  .cms-table {
    width: 100%;
    border-collapse: collapse;
  }

  .cms-table th {
    background: var(--card-bg, #faf9f5);
    color: #888;
    font-size: 11px;
    font-weight: 800;
    text-align: left;
    padding: 14px 20px;
    letter-spacing: 0.5px;
    border-bottom: 1px solid var(--border, #f0f0f0);
  }

  .cms-table td {
    padding: 14px 20px;
    border-bottom: 1px solid var(--border, #f0f0f0);
    vertical-align: middle;
    font-size: 14px;
  }

  .cms-table tbody tr:hover {
    background: #f9f9f9;
  }

  .col-post {
    width: 40%;
  }

  .col-stat {
    width: 10%;
  }

  .col-action {
    width: 8%;
    text-align: center;
  }

  .text-right {
    text-align: right !important;
  }

  .font-mono {
    font-family: var(--font-mono, monospace);
  }

  .file-link {
    color: var(--text, #1a1a1a);
    text-decoration: none;
    font-weight: 700;
    letter-spacing: -0.2px;
  }

  .file-link:hover {
    color: #ff5400;
  }

  .action-icon {
    background: transparent;
    border: none;
    color: #999;
    cursor: pointer;
    font-size: 16px;
    transition: color 0.2s, transform 0.2s;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .action-icon:hover {
    transform: scale(1.05);
  }

  .action-icon.detail:hover {
    color: #ff5400;
  }

  .empty-state {
    text-align: center;
    padding: 40px !important;
    color: #888;
    font-style: italic;
  }


  @media (max-width: 768px) {
    .cms-header {
      flex-direction: column;
      gap: 15px;
      align-items: flex-start;
    }
    .header-right {
      width: 100%;
    }
    .search-input {
      width: 100%;
    }
    .analytics-layout {
      grid-template-columns: 1fr;
    }
    .dashboard-grid {
      grid-template-columns: repeat(2, 1fr);
    }
    .col-stat:nth-child(3),
    .col-stat:nth-child(4),
    .col-stat:nth-child(5) {
      display: none;
    }
  }

  @media (max-width: 480px) {
    .dashboard-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
