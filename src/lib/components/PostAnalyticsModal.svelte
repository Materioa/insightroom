<script>
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import D3AreaChart from './D3AreaChart.svelte';

  // Props using Svelte 5 runes
  /** @type {{ postId: string, postTitle: string, onClose: () => void }} */
  let { postId, postTitle, onClose } = $props();

  let loading = $state(true);
  /** @type {string | null} */
  let error = $state(null);
  
  /** @type {any} */
  let analyticsData = $state(null);

  async function fetchAnalytics() {
    try {
      loading = true;
      const res = await fetch(`/api/analytics/post?postId=${postId}&days=14`);
      if (!res.ok) {
        throw new Error(`Failed to load analytics: ${res.statusText}`);
      }
      analyticsData = await res.json();
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      loading = false;
    }
  }

  /** @param {number} seconds */
  function formatDuration(seconds) {
    if (!seconds) return '0s';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hrs > 0) return `${hrs}h ${mins}m`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  }

  onMount(() => {
    fetchAnalytics();
    
    // Prevent background scrolling when modal is open
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  });

  /** @param {HTMLElement} node */
  function portal(node) {
    if (typeof document !== 'undefined') {
      document.body.appendChild(node);
      return {
        destroy() {
          if (node.parentNode) {
            node.parentNode.removeChild(node);
          }
        }
      };
    }
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div class="modal-overlay" onclick={onClose} use:portal transition:fade={{ duration: 150 }} role="dialog" aria-modal="true" aria-labelledby="modal-title" tabindex="-1">
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-card" onclick={(e) => e.stopPropagation()}>
    <div class="modal-header">
      <div class="header-text-group">
        <h2 id="modal-title">Post Analytics</h2>
        <p class="post-title-sub">{postTitle}</p>
      </div>
      <button class="close-btn" onclick={onClose} title="Close analytics">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>

    {#if loading}
      <div class="modal-body loading-state">
        <div class="skeleton skeleton-title"></div>
        <div class="skeleton-grid">
          <div class="skeleton skeleton-box"></div>
          <div class="skeleton skeleton-box"></div>
          <div class="skeleton skeleton-box"></div>
        </div>
        <div class="skeleton skeleton-chart"></div>
      </div>
    {:else if error}
      <div class="modal-body error-state">
        <i class="fa-solid fa-triangle-exclamation"></i>
        <p>{error}</p>
        <button class="retry-btn" onclick={fetchAnalytics}>Retry</button>
      </div>
    {:else if analyticsData}
      <div class="modal-body">
          <!-- 1. Stats Grid -->
          <div class="metrics-grid">
            <div class="metric-card">
              <span class="label">Views</span>
              <span class="value">{analyticsData.stats.totalViews}</span>
              <span class="subtext">Unique reading sessions</span>
            </div>
            <div class="metric-card">
              <span class="label">Reading Time</span>
              <span class="value">{formatDuration(analyticsData.stats.totalDuration)}</span>
              <span class="subtext">Total time spent reading</span>
            </div>
            <div class="metric-card">
              <span class="label">Avg Scroll Depth</span>
              <span class="value">{Math.round(analyticsData.stats.avgScrollDepth || 0)}%</span>
              <span class="subtext">Average scroll activity</span>
            </div>
            <div class="metric-card">
              <span class="label">Retention Rate</span>
              <span class="value">{analyticsData.stats.retentionRate}%</span>
              <span class="subtext">Sessions reading > 30s</span>
            </div>
            <div class="metric-card">
              <span class="label">Claps</span>
              <span class="value">{analyticsData.stats.totalClaps}</span>
              <span class="subtext">Claps from reader sessions</span>
            </div>
          </div>

          <!-- 2. Chart section -->
          <div class="chart-section">
            <h3>Views (Last 14 Days)</h3>
            <D3AreaChart data={analyticsData.timeline} height={180} />
          </div>

          <!-- 3. Left off points -->
          {#if analyticsData.leftOffPoints && analyticsData.leftOffPoints.length > 0}
            <div class="leftoff-section">
              <h3>Drop-off Sections</h3>
              <div class="leftoff-list">
                {#each analyticsData.leftOffPoints as item}
                  <div class="leftoff-item">
                    <span class="section-name">{item.section}</span>
                    <span class="count-pill">{item.count} readers</span>
                  </div>
                {/each}
              </div>
            </div>
          {/if}

      </div>
    {/if}
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    overflow-y: auto;
    z-index: 2147483647;
    padding: 60px 20px 40px 20px;
    box-sizing: border-box;
  }

  .modal-card {
    background: var(--card-bg, #faf9f5);
    border: 1px solid var(--border, rgba(0, 0, 0, 0.1));
    border-radius: 36px;
    corner-shape: squircle;
    width: 100%;
    max-width: 680px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 40px -5px rgba(0, 0, 0, 0.1), 0 10px 15px -5px rgba(0, 0, 0, 0.04);
    overflow: hidden;
    color: var(--text, #333);
    font-family: inherit;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 20px 24px 15px 24px;
    border-bottom: 1px solid var(--border, rgba(0, 0, 0, 0.1));
  }

  .header-text-group h2 {
    margin: 0;
    font-size: 20px;
    font-weight: 800;
    letter-spacing: -0.5px;
  }

  .post-title-sub {
    margin: 4px 0 0 0;
    font-size: 13px;
    color: var(--text, #888);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 550px;
  }

  .close-btn {
    background: transparent;
    border: none;
    font-size: 18px;
    color: var(--text, #888);
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 50%;
    transition: background 0.2s;
  }

  .close-btn:hover {
    background: rgba(128, 128, 128, 0.1);
    color: var(--text, #333);
  }

  .close-btn:hover {
    background: rgba(128, 128, 128, 0.1);
    color: var(--text, #333);
  }

  .modal-body {
    padding: 24px;
    overflow-y: auto;
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  /* Metrics Grid */
  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
    gap: 12px;
  }

  .metric-card {
    background: var(--metric-bg, #f8fafc);
    border: 1px solid var(--border, rgba(0, 0, 0, 0.1));
    border-radius: 12px;
    padding: 14px;
    display: flex;
    flex-direction: column;
  }

  .metric-card .label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text, #888);
    font-weight: 700;
  }

  .metric-card .value {
    font-size: 20px;
    font-weight: 800;
    margin: 6px 0 2px 0;
    color: var(--text, #0f172a);
  }

  .metric-card .subtext {
    font-size: 10px;
    color: var(--gray, #94a3b8);
  }

  .chart-section h3, .leftoff-section h3 {
    margin: 0 0 12px 0;
    font-size: 14px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text, #333);
  }

  /* Leftoff section */
  .leftoff-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .leftoff-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--metric-bg, #f8fafc);
    border: 1px solid var(--border, rgba(0, 0, 0, 0.1));
    padding: 8px 12px;
    border-radius: 8px;
    font-size: 12px;
  }

  .leftoff-item .section-name {
    font-weight: 600;
    color: var(--text, #334155);
  }

  .leftoff-item .count-pill {
    background: var(--pill-bg, #e2e8f0);
    color: var(--text, #475569);
    padding: 2px 8px;
    border-radius: 12px;
    font-weight: 700;
  }

  .leftoff-item .count-pill {
    background: var(--pill-bg, #e2e8f0);
    color: var(--text, #475569);
    padding: 2px 8px;
    border-radius: 12px;
    font-weight: 700;
  }

  /* States */
  .loading-state, .error-state {
    align-items: center;
    justify-content: center;
    padding: 60px 40px;
    text-align: center;
  }

  .error-state i {
    font-size: 32px;
    color: #ef4444;
    margin-bottom: 12px;
  }

  .error-state p {
    color: #ef4444;
    font-weight: 600;
    margin: 0 0 16px 0;
  }

  .retry-btn {
    background: var(--brand-orange, #ff5400);
    color: #fff;
    border: none;
    border-radius: 20px;
    padding: 8px 20px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }

  .empty-msg {
    color: var(--gray, #94a3b8);
    font-size: 12px;
    font-style: italic;
    margin: 8px 0;
  }

  /* Skeletons */
  .skeleton {
    background: var(--skeleton-bg, #e2e8f0);
    border-radius: 4px;
    animation: skeleton-pulse 1.5s infinite ease-in-out;
  }

  .skeleton-title {
    width: 60%;
    height: 18px;
    margin-bottom: 15px;
  }

  .skeleton-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    width: 100%;
  }

  .skeleton-box {
    height: 60px;
    border-radius: 8px;
  }

  .skeleton-chart {
    width: 100%;
    height: 160px;
    border-radius: 12px;
    margin-top: 15px;
  }

  @keyframes skeleton-pulse {
    0% { opacity: 0.6; }
    50% { opacity: 0.3; }
    100% { opacity: 0.6; }
  }

  /* Themes */
  :global(body.dark) {
    --modal-bg: #1e1e1e;
    --modal-border: #333;
    --text: #eee;
    --gray: #888;
    --hover-bg: #2b2b2b;
    --metric-bg: #222;
    --pill-bg: #333;
    --skeleton-bg: #333;
  }

  @media (max-width: 600px) {
    .modal-card {
      max-height: 95vh;
      border-radius: 16px;
    }
    .metrics-grid {
      grid-template-columns: repeat(2, 1fr);
    }
    .post-title-sub {
      max-width: 250px;
    }
  }
</style>
