<script>
    import { onMount } from 'svelte';
    import { page } from '$app/stores';

    export let data;

    let id = $page.params.id;
    /** @type {any} */
    let post = data.post || {
        title: '',
        slug: '',
        content: '',
        metadata: {
            category: '',
            date: new Date().toISOString().split('T')[0],
            excerpt: '',
            image: '',
            visibility: 'public'
        },
        hidden: false,
        draft: false
    };

    let title = post.title;
    let slug = post.slug;
    let content = post.content || '';
    let hidden = post.hidden;
    let draft = post.draft;
    let visibility = post.metadata.visibility || 'public';
    let image = post.metadata.image || '';

    const coreKeys = ['title', 'slug', 'category', 'date', 'excerpt', 'image', 'visibility', 'hidden', 'draft'];
    let metadataArray = Object.keys(post.metadata)
        .filter(k => !coreKeys.includes(k))
        .map(key => ({ key, value: String(post.metadata[key]) }));

    let category = post.metadata.category || '';
    let date = post.metadata.date || new Date().toISOString().split('T')[0];
    let excerpt = post.metadata.excerpt || '';

    function addMetadataField() {
        metadataArray = [...metadataArray, { key: '', value: '' }];
    }

    /** @param {number} index */
    function removeMetadataField(index) {
        metadataArray = metadataArray.filter((_, i) => i !== index);
    }

    /** @type {HTMLTextAreaElement} */
    let textareaEl;
    let isUploading = false;
    let uploadStatus = '';
    
    let coverUploading = false;

    /** @param {DragEvent} e */
    async function handleFileDrop(e) {
        e.preventDefault();
        const files = e.dataTransfer?.files;
        if (files && files.length) {
            await uploadFile(files[0]);
        }
    }

    /** @param {Event} e */
    async function handleFileSelect(e) {
        const target = /** @type {HTMLInputElement} */ (e.target);
        const files = target.files;
        if (files && files.length) {
            await uploadFile(files[0]);
        }
    }

    /** @param {File} file */
    async function uploadFile(file) {
        if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
            alert('Only images and videos are allowed.');
            return;
        }

        isUploading = true;
        uploadStatus = 'Uploading...';

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('/api/admin/upload', {
                method: 'POST',
                body: formData
            });

            const result = await res.json();
            if (result.url) {
                const markdownImage = `\n![${file.name}](${result.url})\n`;
                insertAtCursor(markdownImage);
                uploadStatus = 'Uploaded successfully!';
                setTimeout(() => uploadStatus = '', 3000);
            } else {
                alert(result.error || 'Upload failed');
                uploadStatus = '';
            }
        } catch (err) {
            console.error(err);
            alert('Upload failed');
            uploadStatus = '';
        }

        isUploading = false;
    }

    /** @param {DragEvent} e */
    async function handleCoverDrop(e) {
        e.preventDefault();
        const files = e.dataTransfer?.files;
        if (files && files.length) {
            await uploadCover(files[0]);
        }
    }

    /** @param {Event} e */
    async function handleCoverSelect(e) {
        const target = /** @type {HTMLInputElement} */ (e.target);
        const files = target.files;
        if (files && files.length) {
            await uploadCover(files[0]);
        }
    }

    /** @param {File} file */
    async function uploadCover(file) {
        if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
            alert('Only images and videos are allowed for cover.');
            return;
        }

        coverUploading = true;
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('/api/admin/upload', {
                method: 'POST',
                body: formData
            });

            const result = await res.json();
            if (result.url) {
                image = result.url;
            } else {
                alert(result.error || 'Upload failed');
            }
        } catch (err) {
            console.error(err);
            alert('Upload failed');
        }
        coverUploading = false;
    }

    function removeCover() {
        image = '';
    }

    /** @param {string} text */
    function insertAtCursor(text) {
        if (!textareaEl) return;
        const startPos = textareaEl.selectionStart;
        const endPos = textareaEl.selectionEnd;
        content = content.substring(0, startPos) + text + content.substring(endPos, content.length);
        
        setTimeout(() => {
            textareaEl.focus();
            textareaEl.selectionStart = startPos + text.length;
            textareaEl.selectionEnd = startPos + text.length;
        }, 0);
    }

    /** @param {string} type */
    function insertFormatting(type) {
        if (!textareaEl) return;
        const startPos = textareaEl.selectionStart;
        const endPos = textareaEl.selectionEnd;
        const selectedText = content.substring(startPos, endPos) || (type === 'table' ? '' : 'text');
        
        let insertText = '';
        if (type === 'bold') insertText = `**${selectedText}**`;
        else if (type === 'italic') insertText = `*${selectedText}*`;
        else if (type === 'heading') insertText = `\n### ${selectedText}\n`;
        else if (type === 'link') insertText = `[${selectedText}](url)`;
        else if (type === 'code') insertText = `\`${selectedText}\``;
        else if (type === 'quote') insertText = `\n> ${selectedText}\n`;
        else if (type === 'list') insertText = `\n- ${selectedText}\n`;
        else if (type === 'table') insertText = `\n| Header 1 | Header 2 |\n| -------- | -------- |\n| Cell 1   | Cell 2   |\n`;

        content = content.substring(0, startPos) + insertText + content.substring(endPos, content.length);
        
        setTimeout(() => {
            textareaEl.focus();
        }, 0);
    }

    async function savePost() {
        /** @type {Record<string, any>} */
        const payloadMetadata = {
            category,
            date,
            excerpt,
            image,
            visibility,
            hidden,
            draft
        };

        metadataArray.forEach(m => {
            if (m.key.trim()) {
                payloadMetadata[m.key.trim()] = m.value;
            }
        });

        const payload = {
            id: id === 'new' ? null : id,
            title,
            slug,
            content,
            metadata: payloadMetadata
        };

        const res = await fetch('/api/admin/posts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await res.json();
        if (result.success) {
            alert('Saved successfully!');
            if (id === 'new') {
                window.location.href = `/admin/editor/${result.id}`;
            }
        } else {
            alert('Error saving: ' + result.error);
        }
    }
</script>

<div class="editor-container">
    <div class="editor-header">
        <h1>{id === 'new' ? '✨ Create Post' : '✏️ Edit Post'}</h1>
        <div class="actions">
            <a href="/admin" class="btn btn-secondary"><i class="fa-solid fa-arrow-left"></i> Tracker</a>
            <button class="btn btn-primary" onclick={savePost}><i class="fa-solid fa-floppy-disk"></i> Save Post</button>
        </div>
    </div>

    <div class="editor-layout">
        <div class="main-content">
            <!-- Title -->
            <div class="form-group">
                <input type="text" class="input-title" placeholder="Post Title..." bind:value={title} />
            </div>

            <!-- Toolbar & Editor -->
            <div class="editor-box">
                <div class="toolbar">
                    <button class="tool-btn" onclick={() => insertFormatting('heading')} title="Heading"><i class="fa-solid fa-heading"></i></button>
                    <button class="tool-btn" onclick={() => insertFormatting('bold')} title="Bold"><i class="fa-solid fa-bold"></i></button>
                    <button class="tool-btn" onclick={() => insertFormatting('italic')} title="Italic"><i class="fa-solid fa-italic"></i></button>
                    <span class="divider"></span>
                    <button class="tool-btn" onclick={() => insertFormatting('quote')} title="Quote"><i class="fa-solid fa-quote-left"></i></button>
                    <button class="tool-btn" onclick={() => insertFormatting('list')} title="Bullet List"><i class="fa-solid fa-list-ul"></i></button>
                    <button class="tool-btn" onclick={() => insertFormatting('table')} title="Table"><i class="fa-solid fa-table"></i></button>
                    <span class="divider"></span>
                    <button class="tool-btn" onclick={() => insertFormatting('link')} title="Link"><i class="fa-solid fa-link"></i></button>
                    <button class="tool-btn" onclick={() => insertFormatting('code')} title="Code"><i class="fa-solid fa-code"></i></button>
                    
                    <span class="divider"></span>
                    <div class="upload-wrapper">
                        <label class="tool-btn upload-btn" title="Upload Media">
                            <input type="file" accept="image/*,video/*" hidden onchange={handleFileSelect} />
                            <i class="fa-solid fa-paperclip"></i> Media
                        </label>
                    </div>
                    {#if isUploading}
                        <span class="upload-status"><i class="fa-solid fa-spinner fa-spin"></i> {uploadStatus}</span>
                    {/if}
                </div>

                <textarea
                    class="content-textarea"
                    bind:this={textareaEl}
                    bind:value={content}
                    placeholder="Write your markdown content here...&#10;Drag and drop images here to directly upload them inside your body!"
                    ondrop={handleFileDrop}
                    ondragover={(e) => e.preventDefault()}
                ></textarea>
            </div>
        </div>

        <div class="sidebar">
            <div class="settings-box">
                <h3><i class="fa-solid fa-gear"></i> Settings</h3>
                
                <div class="form-group">
                    <label for="input-slug">Slug Path</label>
                    <input id="input-slug" type="text" bind:value={slug} placeholder="my-awesome-post" />
                </div>

                <div class="form-group">
                    <label for="input-category">Category</label>
                    <input id="input-category" type="text" bind:value={category} placeholder="e.g. Tutorials" />
                </div>

                <div class="form-group">
                    <label for="input-date">Date Published</label>
                    <input id="input-date" type="date" bind:value={date} />
                </div>

                <div class="form-group">
                    <label for="input-visibility">Visibility Tier</label>
                    <select id="input-visibility" bind:value={visibility}>
                        <option value="public">🌍 Public (Everyone)</option>
                        <option value="private">🔒 Private (Plus & Super)</option>
                    </select>
                </div>

                <div class="form-group checkboxes">
                    <label><input type="checkbox" bind:checked={draft} /> Draft Mode</label>
                    <label><input type="checkbox" bind:checked={hidden} /> Hidden (Unlisted)</label>
                </div>

                <div class="form-group">
                    <span class="label-heading">Cover Image</span>
                    {#if image}
                        <div class="cover-preview">
                            <img src={image} alt="Cover Preview" />
                            <div class="cover-actions">
                                <label class="btn-sm btn-outline" style="cursor: pointer;" aria-label="Upload new cover image">
                                    <input type="file" accept="image/*,video/*" hidden onchange={handleCoverSelect} />
                                    <i class="fa-solid fa-pen"></i> Update
                                </label>
                                <button class="btn-sm btn-danger" onclick={removeCover}><i class="fa-solid fa-trash-can"></i> Clear</button>
                            </div>
                        </div>
                    {:else}
                        <!-- svelte-ignore a11y_no_static_element_interactions -->
                        <div class="cover-dropzone" ondrop={handleCoverDrop} ondragover={(e) => e.preventDefault()} role="region" aria-label="Cover image dropzone">
                            <label class="dropzone-label">
                                <input type="file" accept="image/*,video/*" hidden onchange={handleCoverSelect} />
                                {#if coverUploading}
                                    <i class="fa-solid fa-spinner fa-spin fa-2x"></i>
                                    <p>Uploading...</p>
                                {:else}
                                    <i class="fa-solid fa-cloud-arrow-up fa-2x"></i>
                                    <p>Drag & Drop or click to browse</p>
                                {/if}
                            </label>
                        </div>
                    {/if}
                    <input id="input-image" type="text" bind:value={image} placeholder="...or insert url physically" style="margin-top: 0.5rem; font-size: 0.8rem;" />
                </div>
                
                <div class="form-group">
                    <label for="input-excerpt">Excerpt / Meta Description</label>
                    <textarea id="input-excerpt" bind:value={excerpt} rows="3" placeholder="Brief summary..."></textarea>
                </div>
            </div>

            <div class="settings-box">
                <h3><i class="fa-solid fa-tags"></i> Custom Variables</h3>
                <p class="help-text">Inject arbitrary frontmatter variables into your template.</p>
                
                {#each metadataArray as item, i}
                    <div class="metadata-row">
                        <input type="text" placeholder="Key" bind:value={item.key} aria-label="Metadata Key" />
                        <input type="text" placeholder="Value" bind:value={item.value} aria-label="Metadata Value" />
                        <button class="btn-icon btn-danger" onclick={() => removeMetadataField(i)} aria-label="Remove variable"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                {/each}
                
                <button class="btn btn-outline" onclick={addMetadataField}><i class="fa-solid fa-plus"></i> Add Variable</button>
            </div>
        </div>
    </div>
</div>

<style>
    .editor-container {
        padding: 2.5rem 2rem;
        max-width: 1500px;
        margin: 0 auto;
        font-family: var(--font-primary, system-ui, sans-serif);
    }

    .editor-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 2rem;
    }

    .editor-header h1 {
        font-size: 2rem;
        margin: 0;
        color: var(--text, #111);
    }

    .actions {
        display: flex;
        gap: 0.75rem;
    }

    .btn {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem 1.5rem;
        border-radius: 10px;
        text-decoration: none;
        font-weight: 600;
        cursor: pointer;
        border: none;
        font-size: 0.95rem;
        transition: all 0.2s ease;
    }

    .btn-primary { 
        background: linear-gradient(135deg, var(--primary, #ff9320) 0%, #ff7b00 100%);
        color: white; 
        box-shadow: 0 4px 12px rgba(255, 147, 32, 0.25);
    }
    .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(255, 147, 32, 0.35); }
    
    .btn-secondary { background: #f0f0f0; color: #444; }
    .btn-secondary:hover { background: #e0e0e0; color: #111; }
    
    .btn-outline { background: transparent; border: 1px dashed #ccc; width: 100%; margin-top: 0.5rem; color: #555; }
    .btn-outline:hover { background: #f9f9f9; border-color: #999; color: #111; }

    .btn-icon { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 6px; border: none; cursor: pointer; transition: all 0.2s ease; }
    
    .btn-danger { background: #fff1f0; color: #ff4d4f; border: 1px solid #ffa39e; }
    .btn-danger:hover { background: #ff4d4f; color: white; }
    
    .btn-sm { padding: 0.4rem 0.8rem; font-size: 0.85rem; border-radius: 6px; display: inline-flex; align-items: center; gap: 0.4rem; }

    .editor-layout {
        display: grid;
        grid-template-columns: 1fr 380px;
        gap: 2rem;
    }

    .main-content {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }

    .input-title {
        width: 100%;
        font-size: 2.2rem;
        font-weight: 800;
        padding: 1.25rem 1.5rem;
        border: 1px solid var(--border, #eaeaea);
        border-radius: 12px;
        background: var(--card-bg, #fff);
        color: var(--text, #111);
        box-sizing: border-box;
        box-shadow: 0 4px 12px rgba(0,0,0,0.02);
        transition: border-color 0.2s ease;
    }
    .input-title:focus { outline: none; border-color: var(--primary, #ff9320); }

    .editor-box {
        border: 1px solid var(--border, #eaeaea);
        border-radius: 12px;
        background: var(--card-bg, #fff);
        overflow: hidden;
        display: flex;
        flex-direction: column;
        height: 75vh;
        min-height: 600px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.02);
    }

    .toolbar {
        padding: 0.6rem 0.8rem;
        border-bottom: 1px solid var(--border, #eaeaea);
        background: var(--hover-bg, #fcfcfc);
        display: flex;
        gap: 0.4rem;
        align-items: center;
        flex-wrap: wrap;
    }

    .divider { width: 1px; height: 20px; background: #ddd; margin: 0 0.2rem; }

    .tool-btn {
        background: transparent;
        border: none;
        border-radius: 6px;
        width: 34px;
        height: 34px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font-size: 1rem;
        color: #555;
        transition: all 0.2s ease;
    }
    
    .tool-btn:hover { background: #efefef; color: #111; transform: translateY(-1px); }

    .upload-wrapper { position: relative; }
    .upload-btn { width: auto; padding: 0 0.8rem; gap: 0.4rem; font-size: 0.9rem; font-weight: 500; background: rgba(255,147,32,0.1); color: var(--primary, #ff9320); }
    .upload-btn:hover { background: rgba(255,147,32,0.2); color: var(--primary, #e68010); }

    .upload-status { font-size: 0.85rem; color: var(--primary, #ff9320); display: flex; align-items: center; gap: 0.4rem; margin-left: 0.5rem; }

    .content-textarea {
        flex: 1;
        width: 100%;
        padding: 1.5rem 2rem;
        border: none;
        resize: none;
        font-family: 'Consolas', 'Monaco', monospace;
        font-size: 1.05rem;
        line-height: 1.7;
        background: transparent;
        color: var(--text, #333);
        outline: none;
        box-sizing: border-box;
    }

    .sidebar .settings-box {
        background: var(--card-bg, #fff);
        border: 1px solid var(--border, #eaeaea);
        border-radius: 12px;
        padding: 1.5rem;
        margin-bottom: 1.5rem;
        box-shadow: 0 4px 12px rgba(0,0,0,0.02);
    }

    .sidebar h3 { margin-top: 0; margin-bottom: 1.25rem; font-size: 1.1rem; display: flex; align-items: center; gap: 0.5rem; color: var(--text, #111); }
    .sidebar h3 i { color: var(--primary, #ff9320); }

    .form-group { margin-bottom: 1.25rem; }
    .form-group label, .form-group .label-heading { display: block; font-weight: 600; margin-bottom: 0.5rem; font-size: 0.85rem; color: #555; text-transform: uppercase; letter-spacing: 0.5px; }
    .form-group input[type="text"],
    .form-group input[type="date"],
    .form-group select,
    .form-group textarea {
        width: 100%;
        padding: 0.7rem 0.8rem;
        border: 1px solid var(--border, #ccc);
        border-radius: 8px;
        background: #fbfbfb;
        color: var(--text, #333);
        box-sizing: border-box;
        font-family: inherit;
        transition: border-color 0.2s ease;
    }
    .form-group input:focus, .form-group select:focus, .form-group textarea:focus { outline: none; border-color: var(--primary, #ff9320); background: #fff; }
    
    .checkboxes label { display: flex; align-items: center; gap: 0.5rem; font-weight: 500; margin-bottom: 0.6rem; text-transform: none; font-size: 0.95rem; color: #333; cursor: pointer; }

    /* Cover Area */
    .dropzone-label {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        width: 100%;
        cursor: pointer;
    }

    .cover-dropzone {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        padding: 2rem 1.5rem;
        border: 2px dashed #ccc;
        border-radius: 12px;
        background: #fafafa;
        color: #888;
        transition: all 0.2s ease;
        text-align: center;
    }
    .cover-dropzone:hover { border-color: var(--primary, #ff9320); color: var(--primary, #ff9320); background: rgba(255,147,32,0.02); }
    .cover-dropzone p { margin: 0; font-size: 0.85rem; }
    
    .cover-preview { position: relative; border-radius: 12px; overflow: hidden; border: 1px solid #eaeaea; }
    .cover-preview img { display: block; width: 100%; height: auto; aspect-ratio: 16/9; object-fit: cover; }
    .cover-actions { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); opacity: 0; display: flex; align-items: center; justify-content: center; gap: 1rem; transition: opacity 0.2s ease; }
    .cover-preview:hover .cover-actions { opacity: 1; }
    
    .metadata-row { display: flex; gap: 0.5rem; margin-bottom: 0.5rem; }
    .metadata-row input { flex: 1; min-width: 0; padding: 0.5rem; border: 1px solid #ccc; border-radius: 6px; background: #fbfbfb; }
    
    .help-text { font-size: 0.85rem; color: #777; margin-bottom: 1.25rem; line-height: 1.4; }

    :global(.dark) .input-title,
    :global(.dark) .editor-box,
    :global(.dark) .sidebar .settings-box {
        background: #1e1e1e;
        border-color: #333;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    }
    :global(.dark) .editor-header h1, :global(.dark) .sidebar h3 { color: #fff; }
    :global(.dark) .form-group label { color: #aaa; }
    :global(.dark) .checkboxes label { color: #ddd; }
    
    :global(.dark) .toolbar { background: #252525; border-color: #333; }
    :global(.dark) .divider { background: #444; }
    :global(.dark) .tool-btn { color: #aaa; }
    :global(.dark) .tool-btn:hover { background: #333; color: #fff; }
    
    :global(.dark) .form-group input, :global(.dark) .form-group select, :global(.dark) .form-group textarea, :global(.dark) .metadata-row input { background: #121212; border-color: #3a3a3a; color: #eee; }
    :global(.dark) .form-group input:focus, :global(.dark) .form-group select:focus, :global(.dark) .form-group textarea:focus { border-color: var(--primary, #ff9320); }
    
    :global(.dark) .btn-secondary { background: #333; color: #eee; }
    :global(.dark) .btn-secondary:hover { background: #444; }
    
    :global(.dark) .cover-dropzone { background: #121212; border-color: #444; }
    :global(.dark) .cover-dropzone:hover { border-color: var(--primary, #ff9320); }
    :global(.dark) .cover-preview { border-color: #333; }
</style>
