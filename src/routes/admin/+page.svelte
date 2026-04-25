<script>
    export let data;
    let posts = data.posts;
    let searchQuery = '';
    /** @type {{ id: number, message: string, type: string }[]} */
    let toasts = [];
    let toastId = 0;
    /** @type {{ title: string, message: string, confirmText: string, cancelText: string, danger: boolean, resolve: (value: boolean) => void } | null} */
    let confirmToast = null;

    $: filteredPosts = posts.filter(p => 
        (p.title || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
        (p.slug || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    /** @param {string} message @param {string} [type] @param {number} [timeout] */
    function showToast(message, type = 'info', timeout = 3500) {
        const toast = { id: ++toastId, message, type };
        toasts = [...toasts, toast];
        if (timeout > 0) setTimeout(() => dismissToast(toast.id), timeout);
    }

    /** @param {number} id */
    function dismissToast(id) {
        toasts = toasts.filter((toast) => toast.id !== id);
    }

    /** @param {{ title: string, message: string, confirmText?: string, cancelText?: string, danger?: boolean }} options */
    function requestConfirmation(options) {
        return new Promise((resolve) => {
            confirmToast = {
                title: options.title,
                message: options.message,
                confirmText: options.confirmText || 'Confirm',
                cancelText: options.cancelText || 'Cancel',
                danger: Boolean(options.danger),
                resolve,
            };
        });
    }

    /** @param {boolean} value */
    function resolveConfirmation(value) {
        if (!confirmToast) return;
        confirmToast.resolve(value);
        confirmToast = null;
    }

    /** @param {any} post */
    async function deletePost(post) {
        const shouldDelete = await requestConfirmation({
            title: 'Delete page?',
            message: `Delete "${post.title || post.slug}" and its version history?`,
            confirmText: 'Delete',
            danger: true,
        });
        if (!shouldDelete) return;

        const res = await fetch(`/api/admin/posts?id=${post.id}`, { method: 'DELETE' });
        if (res.ok) {
            posts = posts.filter((item) => item.id !== post.id);
            showToast('Page deleted.', 'success');
        } else {
            const result = await res.json().catch(() => ({}));
            showToast(result.error || 'Failed to delete page.', 'error');
        }
    }
</script>

<svelte:head>
    <title>Insightroom Kitchen</title>
    <link rel="icon" type="image/x-icon" href="/assets/img/room-icon-x.svg" />
    <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
</svelte:head>

<div class="cms-wrapper">
    <div class="cms-header">
        <div class="header-left">
            <h1>Kitchen</h1>
            <a href="/admin/editor/new" class="new-post-btn" title="New Page">
                <i class="fa-solid fa-plus"></i>
            </a>
        </div>
        <div class="header-right">
            <input type="text" bind:value={searchQuery} placeholder="Search kitchen..." class="search-input" />
        </div>
    </div>

    <div class="table-container">
        <table class="cms-table">
            <thead>
                <tr>
                    <th class="col-post">Post</th>
                    <th class="col-actions">Actions</th>
                </tr>
            </thead>
            <tbody>
                {#each filteredPosts as post}
                    <tr>
                        <td class="col-post">
                            <div class="post-info">
                                <div class="post-preview-img">
                                    {#if post.image}
                                        <img src={post.image} alt="" />
                                    {:else}
                                        <i class="fa-regular fa-image"></i>
                                    {/if}
                                </div>
                                <div class="post-details">
                                    <div class="post-title-row">
                                        <a href={`/admin/editor/${post.id}`} class="file-link">
                                            {post.title || post.slug.replace(/\.md$/, '')}
                                        </a>
                                        <div class="visibility-icons">
                                            {#if post.draft}
                                                <i class="fa-solid fa-person-digging status-draft" title="Draft"></i>
                                            {:else if post.hidden}
                                                <i class="fa-solid fa-link-slash status-unlisted" title="Unlisted/Hidden"></i>
                                            {:else if post.visibility === 'private'}
                                                <i class="fa-solid fa-lock status-private" title="Private"></i>
                                            {:else}
                                                <i class="fa-solid fa-globe status-public" title="Public"></i>
                                            {/if}
                                        </div>
                                    </div>
                                    <div class="post-meta">
                                        <span class="post-category">{post.category || 'Uncategorized'}</span>
                                        <span class="meta-dot">•</span>
                                        <span class="post-date">{new Date(post.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                    </div>
                                </div>
                            </div>
                        </td>
                        <td class="col-actions">
                            <a href={`${post.url}`} target="_blank" class="action-icon view" title="View Live">
                                <i class="fa-solid fa-arrow-up-right-from-square"></i>
                            </a>
                            <button class="action-icon delete" onclick={() => deletePost(post)} title="Delete">
                                <i class="fa-regular fa-trash-can"></i>
                            </button>
                        </td>
                    </tr>
                {/each}
                {#if filteredPosts.length === 0}
                    <tr>
                        <td colspan="2" class="empty-state">No pages found.</td>
                    </tr>
                {/if}
            </tbody>
        </table>
    </div>
</div>

<div class="toast-region" aria-live="polite" aria-atomic="false">
    {#if confirmToast}
        <div class="toast-card confirm" class:danger={confirmToast.danger}>
            <div class="toast-title">{confirmToast.title}</div>
            <div class="toast-message">{confirmToast.message}</div>
            <div class="toast-actions">
                <button class="toast-btn secondary" onclick={() => resolveConfirmation(false)}>
                    {confirmToast.cancelText}
                </button>
                <button class="toast-btn primary" onclick={() => resolveConfirmation(true)}>
                    {confirmToast.confirmText}
                </button>
            </div>
        </div>
    {/if}
    {#each toasts as toast (toast.id)}
        <div class="toast-card {toast.type}">
            <div class="toast-message">{toast.message}</div>
            <button class="toast-close" onclick={() => dismissToast(toast.id)} aria-label="Dismiss notification">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>
    {/each}
</div>

<style>
    :global(body) {
        background-color: #f5f5f5;
        margin: 0;
    }

    .cms-wrapper {
        font-family: 'Manrope', sans-serif;
        max-width: 1100px;
        margin: 0 auto;
        padding: 40px 20px;
        color: #333;
    }

    .cms-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 25px;
    }

    .header-left {
        display: flex;
        align-items: center;
        gap: 20px;
    }

    .header-left h1 {
        font-size: 32px;
        font-weight: 800;
        color: #1a1a1a;
        margin: 0;
        letter-spacing: -1px;
    }

    .new-post-btn {
        width: 38px;
        height: 38px;
        background: #ff5400 !important;
        color: white;
        border-radius: var(--squircle-inner, 25px);
        corner-shape: squircle;
        display: flex;
        align-items: center;
        justify-content: center;
        text-decoration: none;
        font-size: 18px;
        transition: transform 0.2s;
        border: none;
        cursor: pointer;
    }

    .new-post-btn:hover {
        transform: scale(1.05);
    }

    .search-input {
        padding: 8px 16px;
        border: 1px solid #e5e5e5;
        border-radius: var(--squircle-inner, 25px);
        corner-shape: squircle;
        font-family: 'Manrope', sans-serif;
        font-size: 14px;
        width: 200px;
        outline: none;
        color: #333;
        background: white;
        transition: border-color 0.2s;
    }

    .search-input:focus {
        border-color: var(--brand-orange);
    }

    .table-container {
        background: white;
        border: 1px solid #e5e5e5;
        border-radius: var(--squircle-outer, 40px);
        corner-shape: squircle;
        overflow: hidden;
    }

    .cms-table {
        width: 100%;
        border-collapse: collapse;
    }

    .cms-table th {
        background: #fafafa;
        color: #888;
        font-size: 11px;
        font-weight: 800;
        text-align: left;
        padding: 14px 24px;
        letter-spacing: 1px;
        border-bottom: 1px solid #f0f0f0;
    }

    .cms-table td {
        padding: 16px 24px;
        border-bottom: 1px solid #f0f0f0;
        vertical-align: middle;
    }

    .cms-table tbody tr:hover {
        background: #f9f9f9;
    }

    .col-post {
        width: 85%;
    }

    .post-info {
        display: flex;
        align-items: center;
        gap: 18px;
    }

    .post-preview-img {
        width: 80px;
        height: 48px;
        background: #f5f5f5;
        border-radius: var(--squircle-inner, 25px);
        corner-shape: squircle;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        flex-shrink: 0;
        color: #bbb;
    }

    .post-preview-img img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .post-details {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
    }

    .post-title-row {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .file-link {
        color: #1a1a1a;
        text-decoration: none;
        font-size: 16px;
        font-weight: 700;
        letter-spacing: -0.2px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .file-link:hover {
        color: var(--brand-orange);
    }

    .visibility-icons {
        display: flex;
        gap: 6px;
        font-size: 13px;
        flex-shrink: 0;
    }

    .status-public { color: #4caf50; }
    .status-private { color: #2196f3; }
    .status-draft { color: var(--brand-orange); }
    .status-unlisted { color: #f44336; }

    .post-meta {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        color: #888;
        font-weight: 500;
    }

    .meta-dot {
        font-size: 10px;
        opacity: 0.5;
    }

    .post-category {
        color: var(--brand-orange);
        font-weight: 700;
        letter-spacing: 0.5px;
    }

    .col-actions {
        display: flex;
        justify-content: flex-end;
        gap: 16px;
    }

    .action-icon {
        background: transparent;
        border: none;
        color: #999;
        cursor: pointer;
        font-size: 18px;
        transition: color 0.2s, transform 0.2s;
        padding: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        text-decoration: none;
    }

    .action-icon:hover {
        transform: translateY(-1px);
    }

    .action-icon.view:hover { color: #007aff; }
    .action-icon.delete:hover { color: #ff3b30; }

    .empty-state {
        text-align: center;
        padding: 60px !important;
        color: #888;
        font-style: italic;
    }

    .toast-region {
        position: fixed;
        right: 18px;
        bottom: 18px;
        z-index: 5000;
        display: flex;
        flex-direction: column;
        gap: 10px;
        width: min(360px, calc(100vw - 32px));
        pointer-events: none;
    }

    .toast-card {
        position: relative;
        padding: 14px 42px 14px 16px;
        border-radius: var(--squircle-inner, 25px);
        corner-shape: squircle;
        border: 1px solid var(--toast-border, #eee);
        background: var(--toast-bg, #fff);
        color: var(--toast-color, #2d2a27);
        box-shadow: 0 14px 34px rgba(0, 0, 0, 0.14);
        font-size: 14px;
        line-height: 1.45;
        pointer-events: auto;
    }

    .toast-card.success { color: #1b5e20; }
    .toast-card.error { color: #cf1322; }
    .toast-card.confirm.danger { color: var(--toast-color, #333); }

    .toast-title {
        margin-bottom: 8px;
        font-weight: 800;
        font-size: 16px;
        color: #ff3b30;
    }

    .toast-message {
        color: #666;
        font-weight: 500;
    }

    .toast-actions {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        margin-top: 20px;
    }

    .toast-btn {
        border: 0;
        border-radius: var(--squircle-inner, 25px);
        corner-shape: squircle;
        font-family: 'Manrope', sans-serif;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.2s;
        padding: 8px 16px;
        font-size: 14px;
    }

    .toast-btn.secondary {
        background: #f1eee9;
        color: #4f4a45;
    }

    .toast-btn.secondary:hover {
        background: #e7e3df;
    }

    .toast-btn.primary {
        background: #ff3b30;
        color: #fff;
    }

    .toast-btn.primary:hover {
        opacity: 0.9;
        transform: translateY(-1px);
    }

    .toast-close {
        position: absolute;
        top: 10px;
        right: 10px;
        width: 24px;
        height: 24px;
        border: 0;
        border-radius: 50%;
        background: transparent;
        color: #777;
        cursor: pointer;
    }

    /* Dark Mode */
    :global(body.dark) { 
        background-color: #121212; 
        --toast-bg: #1f1f1f;
        --toast-border: #333;
        --toast-color: #eee;
    }
    :global(body.dark) .cms-wrapper { color: #eee; }
    :global(body.dark) .header-left h1 { color: #eee; }
    :global(body.dark) .search-input { background: #1e1e1e; border-color: #333; color: #eee; }
    :global(body.dark) .search-input:focus { border-color: var(--brand-orange); }
    :global(body.dark) .table-container { background: #1a1a1a; border-color: #333; }
    :global(body.dark) .cms-table th { background: #1e1e1e; border-color: #333; color: #666; }
    :global(body.dark) .cms-table td { border-bottom-color: #222; }
    :global(body.dark) .cms-table tbody tr:hover { background: #222; }
    :global(body.dark) .file-link { color: #eee; }
    :global(body.dark) .file-link:hover { color: var(--brand-orange); }
    :global(body.dark) .post-preview-img { background: #252525; }
    :global(body.dark) .toast-card { box-shadow: 0 14px 34px rgba(0,0,0,.35); }
    :global(body.dark) .toast-btn.secondary { background: #333; color: #eee; }
    :global(body.dark) .toast-close { color: #aaa; }
    :global(body.dark) .toast-message { color: #aaa; }

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
        .cms-table th:nth-child(2),
        .cms-table td:nth-child(2) {
            padding-left: 10px;
            padding-right: 15px;
        }
        .post-info {
            gap: 10px;
        }
        .post-preview-img {
            width: 60px;
            height: 36px;
        }
        .file-link {
            font-size: 14px;
        }
        .post-meta {
            font-size: 11px;
            flex-wrap: wrap;
        }
    }
</style>
