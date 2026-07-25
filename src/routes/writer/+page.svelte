<script>
  import { smoothCorners } from "@lisse/svelte";
    export let data;
    let posts = data.posts;
    let searchQuery = "";
    /** @type {{ id: number, message: string, type: string }[]} */
    let toasts = [];
    let toastId = 0;
    /** @type {{ title: string, message: string, confirmText: string, cancelText: string, danger: boolean, resolve: (value: boolean) => void } | null} */
    let confirmToast = null;

    $: filteredPosts = posts.filter(
        (p) =>
            (p.title || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (p.slug || "").toLowerCase().includes(searchQuery.toLowerCase()),
    );

    /** @param {string} message @param {string} [type] @param {number} [timeout] */
    function showToast(message, type = "info", timeout = 3500) {
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
                confirmText: options.confirmText || "Confirm",
                cancelText: options.cancelText || "Cancel",
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
            title: "Delete page?",
            message: `Delete "${post.title || post.slug}" and its version history?`,
            confirmText: "Delete",
            danger: true,
        });
        if (!shouldDelete) return;

        const res = await fetch(`/api/admin/posts?id=${post.id}`, {
            method: "DELETE",
        });
        if (res.ok) {
            posts = posts.filter((item) => item.id !== post.id);
            showToast("Page deleted.", "success");
        } else {
            const result = await res.json().catch(() => ({}));
            showToast(result.error || "Failed to delete page.", "error");
        }
    }
</script>

<svelte:head>
    <title>Insightroom Writer's Desk</title>
    <link rel="icon" type="image/x-icon" href="/assets/img/room-icon-x.svg" />
</svelte:head>

<div use:smoothCorners={{ corners: { radius: 40, smoothing: 0.6 } }} class="cms-wrapper">
    <div class="cms-header">
        <div class="header-left">
            <h1>Writer's Desk</h1>
            <a href="/writer/editor/new" class="new-post-btn" title="New Page">
                <i class="fa-solid fa-plus"></i>
            </a>
            <a
                href="https://www.perplexity.ai/spaces/materio-originals-d7YoQavxRVms0vvwnEac8g"
                target="_blank"
                class="space-btn"
                title="Space"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    width="20"
                    height="20"
                    color="#ffffff"
                    fill="none"
                    stroke="#ffffff"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                    <path
                        d="M6 16C4.58579 16 3.87868 16 3.43934 15.5607C3 15.1213 3 14.4142 3 13V11C3 9.58579 3 8.87868 3.43934 8.43934C3.87868 8 4.58579 8 6 8H18C19.4142 8 20.1213 8 20.5607 8.43934C21 8.87868 21 9.58579 21 11V13C21 14.4142 21 15.1213 20.5607 15.5607C20.1213 16 19.4142 16 18 16"
                    ></path>
                    <path d="M12 2V22"></path>
                    <path
                        d="M5 8V2.70711C5 2.31658 5.31658 2 5.70711 2C5.89464 2 6.0745 2.0745 6.20711 2.20711L12 8"
                    ></path>
                    <path
                        d="M19 8V2.70711C19 2.31658 18.6834 2 18.2929 2C18.1054 2 17.9255 2.0745 17.7929 2.20711L12 8"
                    ></path>
                    <path
                        d="M6.64855 12.9055L12 8L17.3514 12.9055C17.7647 13.2843 18 13.8192 18 14.3798V20.3067C18 20.6896 17.6896 21 17.3067 21C17.1114 21 16.9251 20.9176 16.7937 20.7731L12 15.5L7.20631 20.7731C7.07491 20.9176 6.88864 21 6.6933 21C6.3104 21 6 20.6896 6 20.3067V14.3798C6 13.8192 6.23529 13.2843 6.64855 12.9055Z"
                    ></path>
                </svg>
                <span>Space</span>
            </a>
        </div>
        <div class="header-right">
            <input
                type="text"
                bind:value={searchQuery}
                placeholder="Search writer's desk..."
                class="search-input"
            />
        </div>
    </div>

    <div use:smoothCorners={{ corners: { radius: 40, smoothing: 0.6 } }} class="table-container">
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
                                <div use:smoothCorners={{ corners: { radius: 25, smoothing: 0.6 } }} class="post-preview-img">
                                    {#if post.image}
                                        <img src={post.image} alt="" />
                                    {:else}
                                        <i class="fa-regular fa-image"></i>
                                    {/if}
                                </div>
                                <div class="post-details">
                                    <div class="post-title-row">
                                        <a
                                            href={`/writer/editor/${post.id}`}
                                            class="file-link"
                                        >
                                            {post.title ||
                                                post.slug.replace(/\.md$/, "")}
                                        </a>
                                        <div class="visibility-icons">
                                            {#if post.draft}
                                                <i
                                                    class="fa-solid fa-person-digging status-draft"
                                                    title="Draft"
                                                ></i>
                                            {:else if post.hidden}
                                                <i
                                                    class="fa-solid fa-link-slash status-unlisted"
                                                    title="Unlisted/Hidden"
                                                ></i>
                                            {:else if post.visibility === "private"}
                                                <i
                                                    class="fa-solid fa-lock status-private"
                                                    title="Private"
                                                ></i>
                                            {:else}
                                                <i
                                                    class="fa-solid fa-globe status-public"
                                                    title="Public"
                                                ></i>
                                            {/if}
                                        </div>
                                    </div>
                                    <div class="post-meta">
                                        <span class="post-category"
                                            >{post.category ||
                                                "Uncategorized"}</span
                                        >
                                        <span class="meta-dot">•</span>
                                        <span class="post-date"
                                            >{new Date(
                                                post.date,
                                            ).toLocaleDateString("en-US", {
                                                month: "short",
                                                day: "numeric",
                                                year: "numeric",
                                            })}</span
                                        >
                                    </div>
                                </div>
                            </div>
                        </td>
                        <td class="col-actions">
                            <a
                                href={`${post.url}`}
                                target="_blank"
                                class="action-icon view"
                                title="View Live"
                            >
                                <i
                                    class="fa-solid fa-arrow-up-right-from-square"
                                ></i>
                            </a>
                            <button
                                class="action-icon delete"
                                onclick={() => deletePost(post)}
                                title="Delete"
                            >
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
                <button
 use:smoothCorners={{ corners: { radius: 25, smoothing: 0.6 } }}                    class="toast-btn secondary"
                    onclick={() => resolveConfirmation(false)}
                >
                    {confirmToast.cancelText}
                </button>
                <button
 use:smoothCorners={{ corners: { radius: 25, smoothing: 0.6 } }}                    class="toast-btn primary"
                    onclick={() => resolveConfirmation(true)}
                >
                    {confirmToast.confirmText}
                </button>
            </div>
        </div>
    {/if}
    {#each toasts as toast (toast.id)}
        <div class="toast-card {toast.type}">
            <div class="toast-message">{toast.message}</div>
            <button
                class="toast-close"
                onclick={() => dismissToast(toast.id)}
                aria-label="Dismiss notification"
            >
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>
    {/each}
</div>

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
        background-color: #f5f5f5;
        margin: 0;
    }

    .cms-wrapper {
        font-family: var(--font-primary, "PP Mori", sans-serif);
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

    .space-btn {
        width: auto;
        height: 38px;
        padding: 0 16px;
        background: #20808d;
        color: white;
        border-radius: var(--squircle-inner, 25px);
        display: flex;
        align-items: center;
        gap: 8px;
        text-decoration: none;
        font-size: 15px;
        font-weight: 500;
        transition:
            transform 0.2s,
            background 0.2s;
        border: none;
        cursor: pointer;
    }

    .space-btn:hover {
        transform: scale(1.05);
        background: #1a6872;
    }

    .search-input {
        padding: 8px 16px;
        border: 1px solid #e5e5e5;
        border-radius: var(--squircle-inner, 25px);
        font-family: var(--font-primary, "PP Mori", sans-serif);
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
        overflow: hidden;
    }

    .cms-table {
        width: 100%;
        border-collapse: collapse;
    }

    .cms-table th {
        background: #faf9f5;
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

    .status-public {
        color: #4caf50;
    }
    .status-private {
        color: #2196f3;
    }
    .status-draft {
        color: var(--brand-orange);
    }
    .status-unlisted {
        color: #f44336;
    }

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
        transition:
            color 0.2s,
            transform 0.2s;
        padding: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        text-decoration: none;
    }

    .action-icon:hover {
        transform: translateY(-1px);
    }

    .action-icon.view:hover {
        color: #007aff;
    }
    .action-icon.delete:hover {
        color: #ff3b30;
    }

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
        border: 1px solid var(--toast-border, #eee);
        background: var(--toast-bg, #fff);
        color: var(--toast-color, #2d2a27);
        box-shadow: 0 14px 34px rgba(0, 0, 0, 0.14);
        font-size: 14px;
        line-height: 1.45;
        pointer-events: auto;
    }

    .toast-card.success {
        color: #1b5e20;
    }
    .toast-card.error {
        color: #cf1322;
    }
    .toast-card.confirm.danger {
        color: var(--toast-color, #333);
    }

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
        font-family: var(--font-primary, "PP Mori", sans-serif);
        font-weight: 700;
        cursor: pointer;
        transition: all 0.2s;
        padding: 8px 16px;
        font-size: 14px;
    }

    .toast-btn.secondary {
        background: #faf9f5;
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
    :global(body.dark) .cms-wrapper {
        color: #eee;
    }
    :global(body.dark) .header-left h1 {
        color: #eee;
    }
    :global(body.dark) .search-input {
        background: #1e1e1e;
        border-color: #333;
        color: #eee;
    }
    :global(body.dark) .search-input:focus {
        border-color: var(--brand-orange);
    }
    :global(body.dark) .table-container {
        background: #1a1a1a;
        border-color: #333;
    }
    :global(body.dark) .cms-table th {
        background: #1e1e1e;
        border-color: #333;
        color: #666;
    }
    :global(body.dark) .cms-table td {
        border-bottom-color: #222;
    }
    :global(body.dark) .cms-table tbody tr:hover {
        background: #222;
    }
    :global(body.dark) .file-link {
        color: #eee;
    }
    :global(body.dark) .file-link:hover {
        color: var(--brand-orange);
    }
    :global(body.dark) .post-preview-img {
        background: #252525;
    }
    :global(body.dark) .toast-card {
        box-shadow: 0 14px 34px rgba(0, 0, 0, 0.35);
    }
    :global(body.dark) .toast-btn.secondary {
        background: #333;
        color: #eee;
    }
    :global(body.dark) .toast-close {
        color: #aaa;
    }
    :global(body.dark) .toast-message {
        color: #aaa;
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
