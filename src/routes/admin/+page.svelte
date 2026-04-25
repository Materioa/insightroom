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
    <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
</svelte:head>

<div class="cms-wrapper">
    <div class="cms-header">
        <div class="header-left">
            <h1>Pages</h1>
            <a href="/admin/editor/new" class="btn btn-orange">New page</a>
        </div>
        <div class="header-right">
            <input type="text" bind:value={searchQuery} placeholder="Search by filename" class="search-input" />
        </div>
    </div>

    <div class="table-container">
        <table class="cms-table">
            <thead>
                <tr>
                    <th>FILENAME</th>
                    <th class="text-right">ACTIONS</th>
                </tr>
            </thead>
            <tbody>
                {#each filteredPosts as post}
                    <tr>
                        <td class="col-filename">
                            <div class="file-info">
                                <i class="fa-regular fa-file-lines file-icon"></i>
                                <a href={`/admin/editor/${post.id}`} class="file-link">
                                    {post.slug || post.id}.md
                                </a>
                                {#if post.draft}
                                    <span class="badge badge-draft">Draft</span>
                                {:else if post.hidden}
                                    <span class="badge badge-hidden">Hidden</span>
                                {:else if post.visibility === 'private'}
                                    <span class="badge badge-private">Private</span>
                                {/if}
                            </div>
                        </td>
                        <td class="col-actions text-right">
                            <button class="btn btn-gray-sm" onclick={() => deletePost(post)}><i class="fa-solid fa-trash-can"></i> Delete</button>
                            <a href={`${post.url}`} target="_blank" class="btn btn-gray-sm"><i class="fa-solid fa-eye"></i> View</a>
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
        max-width: 1000px;
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
        font-size: 28px;
        font-weight: 300;
        color: #444;
        margin: 0;
        letter-spacing: -0.5px;
    }

    .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 3px;
        font-family: 'Manrope', sans-serif;
        font-weight: 600;
        text-decoration: none;
        cursor: pointer;
        border: none;
        transition: opacity 0.2s;
    }

    .btn:hover {
        opacity: 0.9;
    }

    .btn-orange {
        background: #f38a00;
        color: white;
        padding: 8px 16px;
        font-size: 14px;
    }

    .search-input {
        padding: 8px 12px;
        border: 1px solid #e5e5e5;
        border-radius: 3px;
        font-family: 'Manrope', sans-serif;
        font-size: 14px;
        width: 200px;
        outline: none;
        color: #333;
    }

    .search-input:focus {
        border-color: #ccc;
    }

    .table-container {
        background: white;
        border: 1px solid #e5e5e5;
        border-radius: 3px;
        overflow: hidden;
    }

    .cms-table {
        width: 100%;
        border-collapse: collapse;
    }

    .cms-table th {
        background: #333;
        color: white;
        font-size: 13px;
        font-weight: 700;
        text-align: left;
        padding: 12px 20px;
        letter-spacing: 0.5px;
    }

    .cms-table td {
        padding: 12px 20px;
        border-bottom: 1px solid #f0f0f0;
        vertical-align: middle;
    }

    .cms-table tbody tr:nth-child(even) {
        background: #fcfcfc;
    }
    
    .cms-table tbody tr:hover {
        background: #f9f9f9;
    }

    .text-right {
        text-align: right !important;
    }

    .file-info {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .file-icon {
        color: #999;
        font-size: 16px;
    }

    .file-link {
        color: #333;
        text-decoration: none;
        font-size: 15px;
        font-weight: 500;
    }

    .file-link:hover {
        color: #f38a00;
        text-decoration: underline;
    }

    .badge {
        font-size: 11px;
        padding: 2px 6px;
        border-radius: 12px;
        font-weight: 600;
        text-transform: uppercase;
        margin-left: 10px;
    }
    .badge-draft { background: #fffbe6; color: #faad14; border: 1px solid #ffe58f; }
    .badge-hidden { background: #f5f5f5; color: #8c8c8c; border: 1px solid #d9d9d9; }
    .badge-private { background: #fff0f6; color: #eb2f96; border: 1px solid #ffadd2; }

    .btn-gray-sm {
        background: #9ea3a8;
        color: white;
        padding: 6px 12px;
        font-size: 13px;
        gap: 6px;
        margin-left: 8px;
    }

    .empty-state {
        text-align: center;
        padding: 40px !important;
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
        border-radius: 10px;
        border: 1px solid #e7e1dc;
        background: #fff;
        color: #2d2a27;
        box-shadow: 0 14px 34px rgba(0, 0, 0, 0.14);
        font-size: 14px;
        line-height: 1.45;
        pointer-events: auto;
    }

    .toast-card.success { border-color: #b9e7c2; }
    .toast-card.error,
    .toast-card.confirm.danger { border-color: #ffb8b8; }
    .toast-card.confirm { padding-right: 16px; }

    .toast-title {
        margin-bottom: 4px;
        font-weight: 800;
    }

    .toast-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        margin-top: 12px;
    }

    .toast-btn {
        border: 0;
        border-radius: 6px;
        padding: 7px 12px;
        font-family: 'Manrope', sans-serif;
        font-weight: 700;
        cursor: pointer;
    }

    .toast-btn.secondary {
        background: #f1eee9;
        color: #4f4a45;
    }

    .toast-btn.primary {
        background: #ff5200;
        color: #fff;
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
    :global(.dark) .cms-wrapper { color: #eee; }
    :global(.dark) .header-left h1 { color: #eee; }
    :global(.dark) .search-input { background: #1e1e1e; border-color: #333; color: #eee; }
    :global(.dark) .table-container { background: #1e1e1e; border-color: #333; }
    :global(.dark) .cms-table th { background: #252525; border-color: #333; }
    :global(.dark) .cms-table td { border-bottom-color: #333; }
    :global(.dark) .cms-table tbody tr:nth-child(even) { background: #222; }
    :global(.dark) .cms-table tbody tr:hover { background: #2a2a2a; }
    :global(.dark) .file-link { color: #eee; }
    :global(.dark) .file-link:hover { color: #f38a00; }
    :global(.dark) .btn-gray-sm { background: #444; }
    :global(.dark) .btn-gray-sm:hover { background: #555; }
    :global(.dark) .toast-card { background: #1f1f1f; border-color: #333; color: #eee; box-shadow: 0 14px 34px rgba(0,0,0,.35); }
    :global(.dark) .toast-btn.secondary { background: #333; color: #eee; }
    :global(.dark) .toast-close { color: #aaa; }
</style>
