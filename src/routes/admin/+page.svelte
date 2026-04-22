<script>
    export let data;
    let posts = data.posts;
</script>

<div class="admin-container">
    <div class="admin-header">
        <h1><i class="fa-solid fa-shapes"></i> Admin CMS</h1>
        <a href="/admin/editor/new" class="btn-primary"><i class="fa-solid fa-plus" style="margin-right: 0.5rem;"></i> Create New Post</a>
    </div>

    <div class="table-wrapper">
        <table class="admin-table">
            <thead>
                <tr>
                    <th>Post Title</th>
                    <th>Category</th>
                    <th>Date Published</th>
                    <th>Status</th>
                    <th class="actions-header">Actions</th>
                </tr>
            </thead>
            <tbody>
                {#each posts as post}
                    <tr>
                        <td class="col-title">
                            <span class="title-text">{post.title}</span>
                            {#if post.slug}
                                <span class="slug-text">/{post.slug}</span>
                            {/if}
                        </td>
                        <td>{post.category || post.categorySlug || 'Uncategorized'}</td>
                        <td class="col-date">{post.date}</td>
                        <td>
                            {#if post.draft}
                                <span class="badge badge-draft"><i class="fa-solid fa-pen-ruler"></i> Draft</span>
                            {:else if post.hidden}
                                <span class="badge badge-hidden"><i class="fa-solid fa-eye-slash"></i> Hidden</span>
                            {:else if post.visibility === 'private'}
                                <span class="badge badge-private"><i class="fa-solid fa-lock"></i> Private</span>
                            {:else}
                                <span class="badge badge-public"><i class="fa-solid fa-globe"></i> Public</span>
                            {/if}
                        </td>
                        <td class="col-actions">
                            <a href={`/admin/editor/${post.id}`} class="btn-sm" title="Edit Post"><i class="fa-solid fa-pen-to-square"></i></a>
                            <a href={`${post.url}`} target="_blank" class="btn-sm btn-outline" title="View Live"><i class="fa-solid fa-arrow-up-right-from-square"></i></a>
                            <button class="btn-sm btn-danger" onclick={() => confirm('Deletion not implemented yet. Delete via database.')} title="Delete Post"><i class="fa-solid fa-trash-can"></i></button>
                        </td>
                    </tr>
                {/each}
                {#if posts.length === 0}
                    <tr>
                        <td colspan="5" class="empty-state">No posts found. Start writing!</td>
                    </tr>
                {/if}
            </tbody>
        </table>
    </div>
</div>

<style>
    .admin-container {
        padding: 2.5rem 2rem;
        max-width: 1300px;
        margin: 0 auto;
        font-family: var(--font-primary, system-ui, sans-serif);
    }
    
    .admin-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 2.5rem;
    }

    .admin-header h1 {
        font-size: 2rem;
        margin: 0;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        color: var(--text, #111);
    }
    
    .admin-header h1 i {
        color: var(--primary, #ff9320);
    }

    .btn-primary {
        background: linear-gradient(135deg, var(--primary, #ff9320) 0%, #ff7b00 100%);
        color: white;
        padding: 0.85rem 1.75rem;
        border-radius: 12px;
        text-decoration: none;
        font-weight: 600;
        box-shadow: 0 4px 12px rgba(255, 147, 32, 0.25);
        transition: all 0.2s ease;
        display: inline-flex;
        align-items: center;
    }
    .btn-primary:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 16px rgba(255, 147, 32, 0.35);
    }

    .table-wrapper {
        background: var(--card-bg, #fff);
        border-radius: 16px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.04);
        border: 1px solid var(--border, #eaeaea);
        overflow-x: auto;
    }

    .admin-table {
        width: 100%;
        border-collapse: collapse;
        min-width: 900px;
    }

    .admin-table th, .admin-table td {
        padding: 1.25rem 1.5rem;
        text-align: left;
        border-bottom: 1px solid var(--border, #eaeaea);
        color: var(--text, #333);
        vertical-align: middle;
    }

    .admin-table th {
        background: var(--hover-bg, #fbfbfb);
        font-weight: 600;
        font-size: 0.85rem;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: #777;
    }

    .admin-table tbody tr {
        transition: background-color 0.15s ease;
    }
    .admin-table tbody tr:hover {
        background: var(--hover-bg, #f8f9fa);
    }

    .col-title {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }
    .title-text {
        font-weight: 600;
        font-size: 1.05rem;
    }
    .slug-text {
        font-size: 0.8rem;
        color: #888;
        font-family: monospace;
    }

    .col-date {
        white-space: nowrap;
        font-size: 0.9rem;
        color: #555;
    }

    .badge {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0.35rem 0.65rem;
        border-radius: 20px;
        font-size: 0.75rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }
    .badge-draft { background: #fffbe6; color: #faad14; border: 1px solid #ffe58f; }
    .badge-hidden { background: #f5f5f5; color: #8c8c8c; border: 1px solid #d9d9d9; }
    .badge-private { background: #fff0f6; color: #eb2f96; border: 1px solid #ffadd2; }
    .badge-public { background: #f6ffed; color: #52c41a; border: 1px solid #b7eb8f; }

    .actions-header {
        text-align: right;
    }
    
    .col-actions {
        text-align: right;
        white-space: nowrap;
    }

    .btn-sm {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border-radius: 8px;
        text-decoration: none;
        background: #f0f0f0;
        color: #444;
        font-size: 1rem;
        border: none;
        cursor: pointer;
        margin-left: 0.5rem;
        transition: all 0.2s ease;
    }
    .btn-sm:hover { background: #e0e0e0; color: #111; transform: translateY(-1px); }

    .btn-outline { background: transparent; border: 1px solid #ddd; }
    .btn-outline:hover { background: #f9f9f9; border-color: #bbb; }

    .btn-danger {
        background: #fff1f0;
        color: #ff4d4f;
        border: 1px solid #ffa39e;
    }
    .btn-danger:hover {
        background: #ff4d4f;
        color: white;
    }

    .empty-state {
        text-align: center;
        padding: 4rem !important;
        color: #888;
        font-style: italic;
    }

    :global(.dark) .admin-container h1 { color: #fff; }
    :global(.dark) .table-wrapper {
        background: #1e1e1e;
        border: 1px solid #333;
        box-shadow: 0 8px 24px rgba(0,0,0,0.2);
    }
    :global(.dark) .admin-table th { background: #222; border-color: #333; color: #aaa;}
    :global(.dark) .admin-table td { border-color: #333; color: #ddd; }
    :global(.dark) .admin-table tbody tr:hover { background: #252525; }
    :global(.dark) .slug-text { color: #777; }
    :global(.dark) .col-date { color: #999; }
    
    :global(.dark) .badge-draft { background: rgba(250, 173, 20, 0.1); border-color: rgba(250, 173, 20, 0.3); }
    :global(.dark) .badge-hidden { background: rgba(140, 140, 140, 0.1); border-color: rgba(140, 140, 140, 0.3); }
    :global(.dark) .badge-private { background: rgba(235, 47, 150, 0.1); border-color: rgba(235, 47, 150, 0.3); }
    :global(.dark) .badge-public { background: rgba(82, 196, 26, 0.1); border-color: rgba(82, 196, 26, 0.3); }
    
    :global(.dark) .btn-sm { background: #333; color: #ddd; }
    :global(.dark) .btn-sm:hover { background: #444; color: #fff; }
    :global(.dark) .btn-outline { background: transparent; border-color: #444; }
    :global(.dark) .btn-outline:hover { background: #2a2a2a; border-color: #666; }
    :global(.dark) .btn-danger { background: rgba(255, 77, 79, 0.15); border-color: rgba(255, 77, 79, 0.3); color: #ff7875; }
    :global(.dark) .btn-danger:hover { background: #a8071a; color: #fff; border-color: #a8071a; }
</style>
