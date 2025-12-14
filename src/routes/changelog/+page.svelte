<script>
  /** @type {{ data: import('./$types').PageData }} */
  let { data } = $props();
</script>

<svelte:head>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,200..900;1,8..60,200..900&display=swap" rel="stylesheet">
</svelte:head>

<main class="changelogs-page" style="font-family: 'Manrope', sans-serif; padding: 3rem 1rem;">
  <header class="changelogs-header" style="text-align:center; margin-bottom:2rem;">
    <h1 style="font-size:2.25rem; font-weight:400; font-family: 'Source Serif 4', serif;">What's New?</h1>
  </header>

  <section class="changelogs-list" style="display:flex; justify-content:center;">
    <div class="changelogs-container" style="width:100%; max-width:600px; display:flex; flex-direction:column; gap:2rem;">
      <div class="changelog-rows" style="display:flex; flex-direction:column; gap:2rem;">
        {#each data.changelogs as post}
          <div class="changelog-row" style="display:grid; grid-template-columns:100px 1fr; gap:5rem; align-items:start;">
            <div class="date-cell" style="padding-top:1rem; display:block;">
              <a class="date-link" href="{post.url}" aria-label="Open {post.title}">
                <span class="date-pill" aria-hidden="true" style="font-size:0.8rem; padding:0.35rem 0.6rem; border-radius:6px; display:inline-block; min-width:80px; text-align:center; transition:background .18s ease, color .18s ease;">
                  {new Date(post.date).toLocaleDateString('en-GB').replace(/\//g, '.')}
                </span>
              </a>
            </div>

            <div class="post-cell">
              <article class="changelog-item" style="display:block; padding:1rem; border-radius:8px;">
                <div class="date-inline" aria-hidden="true" style="display:none; margin-bottom:0.5rem;">
                  <a class="date-link" href="{post.url}" aria-label="Open {post.title}">
                    <span class="date-pill">{new Date(post.date).toLocaleDateString('en-GB').replace(/\//g, '.')}</span>
                  </a>
                </div>
                <h2 style="margin:0; font-size:1.125rem;">
                  <a href="{post.url}" style="color:inherit; text-decoration:none;">{post.title}</a>
                </h2>

                <div class="changelog-body" style="margin-top:0.75rem;">
                  <a class="excerpt-link" href="{post.url}" style="text-decoration:none; color:inherit; display:block;">
                    <p class="changelog-excerpt" style="margin:0 0 0.75rem; color:var(--muted,#61616a); font-size:0.95rem; line-height:1.45;">
                      {post.excerpt ? post.excerpt.substring(0, 320) : ''}
                    </p>
                  </a>
                  <div style="display:flex; align-items:center; gap:0.75rem;">
                    <a class="read-more" href="{post.url}" style="font-weight:600; color:inherit; text-decoration:none; display:inline-flex; align-items:center; gap:0.5rem;">
                      <span>Show changes</span>
                      <span class="read-arrow" aria-hidden="true" style="display:inline-block; transition:transform .18s ease, margin-left .18s ease;">
                        <span class="short-arrow"></span>
                      </span>
                    </a>
                  </div>
                </div>

                <div class="changelog-cover" style="margin-top:1rem;">
                  {#if post.image}
                    <a href="{post.url}">
                      <img src={post.image} alt="{post.title} cover" style="width:100%; max-width:432px; height:175px; object-fit:cover; border-radius:6px; display:block;">
                    </a>
                  {:else}
                    <a href="{post.url}">
                      <div style="width:100%; max-width:432px; height:175px; background:#f2f2f4; border-radius:6px; display:flex; align-items:center; justify-content:center; color:#999;">No image</div>
                    </a>
                  {/if}
                </div>
              </article>
            </div>
          </div>
        {/each}
      </div>
    </div>
  </section>
</main>

<style>
  .read-more .short-arrow { display:inline-block; transition:all .18s ease; }
  .read-arrow .short-arrow::after { content: '>' ; display:inline-block; }
  .changelog-item:hover .read-arrow .short-arrow::after { content: '->'; margin-left:6px; }
  /* remove hover shadow on cards per request */
  .changelog-item:hover { box-shadow: none; }
  .date-pill { background: #E8E8E4; color: #3a3a3a; }
  /* dark-mode overrides */
  :global(body.dark) .date-pill { background: var(--date-pill-bg-dark,#2b2b2b); color: var(--date-pill-fg-dark,#d8d8d8); }
  .date-pill, .date-inline .date-pill, .date-link .date-pill { font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, 'Roboto Mono', 'Courier New', monospace; font-weight:500; letter-spacing:0.02em; }
  /* inline date shown on small screens above title */
  .date-inline { display:none; }

  @media (max-width: 768px) {
    .changelog-row { grid-template-columns: 1fr !important; }
    .date-cell { display:none !important; }
    .date-inline { display:block !important; }
    .date-inline .date-pill { font-size:0.85rem; padding:0.35rem 0.6rem; border-radius:6px; background:#e1e1e1; color:#3a3a3a; display:inline-block; }
    .changelog-cover img, .changelog-cover div { width:100%; max-width:none; height:auto; }
    .changelogs-header { text-align:left !important; padding-left:1rem; }
  }
</style>
