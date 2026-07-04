<script>
    import { onMount } from "svelte";
    import { page } from "$app/stores";
    
    /** @type {{ post: any, user?: any }} */
    export let data;
    
    let post = data.post;
    let content = post.content || "";
    let image = post.metadata.image || "";
    let isSaving = false;
    
    /** @type {any[]} */
    let widgetUploadedImages = [];
    /** @type {HTMLInputElement | undefined} */
    let widgetFileInput;
    let isWidgetDragOver = false;
    
    /** @type {string} */
    let openDropdownId = "";
    
    /** @type {any[]} */
    let toasts = [];
    
    /**
     * @param {string} message
     * @param {string} type
     */
    function showToast(message, type = "info") {
        const id = Date.now() + Math.random().toString();
        toasts = [...toasts, { id, message, type }];
        setTimeout(() => {
            toasts = toasts.filter(t => t.id !== id);
        }, 3000);
    }
    
    /**
     * Parse headings from markdown content.
     * @param {string} mdContent
     * @returns {any[]}
     */
    function getPostHeadings(mdContent) {
        if (!mdContent) return [];
        /** @type {string[]} */
        const lines = mdContent.split("\n");
        /** @type {any[]} */
        const headings = [];
        let h1Count = 0;
        let h2Count = 0;
        let h3Count = 0;

        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("# ")) {
                h1Count++;
                h2Count = 0;
                h3Count = 0;
                const text = trimmed.substring(2).trim();
                headings.push({ level: 1, text, index: `${h1Count}`, raw: line });
            } else if (trimmed.startsWith("## ")) {
                h2Count++;
                h3Count = 0;
                const text = trimmed.substring(3).trim();
                headings.push({ level: 2, text, index: `${h1Count}.${h2Count}`, raw: line });
            } else if (trimmed.startsWith("### ")) {
                h3Count++;
                const text = trimmed.substring(4).trim();
                headings.push({ level: 3, text, index: `${h1Count}.${h2Count}.${h3Count}`, raw: line });
            }
        }
        return headings;
    }
    
    /**
     * @param {string[]} lines
     * @param {any[]} headings
     * @param {string} tag
     * @returns {number}
     */
    function findHeadingLineIndex(lines, headings, tag) {
        const cleanTag = tag.trim().toLowerCase();
        
        /** @type {any} */
        let match = headings.find((/** @type {any} */ h) => h.index === cleanTag);
        
        if (!match) {
            match = headings.find((/** @type {any} */ h) => {
                /** @type {string[]} */
                const words = h.text.toLowerCase().split(/\s+/);
                return words.includes(cleanTag) || h.text.toLowerCase().startsWith(cleanTag);
            });
        }

        if (!match) {
            match = headings.find((/** @type {any} */ h) => h.text.toLowerCase().includes(cleanTag));
        }

        if (match) {
            const matchRaw = match.raw.trim();
            return lines.findIndex((/** @type {string} */ l) => l.trim() === matchRaw);
        }
        return -1;
    }
    
    /**
     * @param {string} imageUrl
     * @param {string} imageName
     * @param {string} tag
     * @returns {boolean}
     */
    function insertImageByTag(imageUrl, imageName, tag) {
        if (!tag || !tag.trim()) {
            showToast("Please provide a tag (e.g. '1.1' or 'cover')", "warning");
            return false;
        }

        const cleanTag = tag.trim().toLowerCase();

        if (cleanTag === "cover") {
            image = imageUrl;
            showToast("Set as cover image locally. Click 'Save Placements' to persist.", "success");
            return true;
        }

        /** @type {string[]} */
        const lines = content.split("\n");
        const headings = getPostHeadings(content);
        const headingLineIdx = findHeadingLineIndex(lines, headings, cleanTag);

        if (headingLineIdx === -1) {
            showToast(`Could not find a section matching tag "${tag}"`, "error");
            return false;
        }

        const currentHeading = headings.find((/** @type {any} */ h) => lines[headingLineIdx].trim() === h.raw.trim());
        const currentLevel = currentHeading ? currentHeading.level : 2;

        let insertIdx = headingLineIdx + 1;
        for (let i = headingLineIdx + 1; i < lines.length; i++) {
            const line = lines[i].trim();
            
            if (line.startsWith("#")) {
                const level = line.split(" ")[0].length;
                if (level <= currentLevel) {
                    insertIdx = i;
                    break;
                }
            }
            
            if (line === "---" || line.startsWith("[mcq:") || line.startsWith("mcq:")) {
                insertIdx = i;
                break;
            }

            if (i === lines.length - 1) {
                insertIdx = lines.length;
            }
        }

        const sectionText = lines.slice(headingLineIdx, insertIdx).join("\n");
        if (sectionText.includes(imageUrl)) {
            showToast(`Image already inserted in section "${tag}"`, "info");
            return true;
        }

        const imageMarkdown = `\n![${imageName || 'image'}](${imageUrl})\n`;
        lines.splice(insertIdx, 0, imageMarkdown);
        content = lines.join("\n");
        
        showToast(`Ready to insert under section "${tag}". Save to apply.`, "success");
        return true;
    }
    
    /** @param {DragEvent} e */
    function handleWidgetDragOver(e) {
        e.preventDefault();
        isWidgetDragOver = true;
    }

    function handleWidgetDragLeave() {
        isWidgetDragOver = false;
    }

    /** @param {DragEvent} e */
    async function handleWidgetDrop(e) {
        e.preventDefault();
        isWidgetDragOver = false;
        const dt = e.dataTransfer;
        if (!dt) return;
        const files = dt.files;
        if (files && files.length) {
            await handleWidgetFiles(files);
        }
    }

    /** @param {Event} e */
    async function handleWidgetFileSelect(e) {
        const target = /** @type {HTMLInputElement} */ (e.target);
        const files = target.files;
        if (files && files.length) {
            await handleWidgetFiles(files);
        }
    }

    /** @param {FileList} files */
    async function handleWidgetFiles(files) {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (!file.type.startsWith("image/")) {
                showToast(`File ${file.name} is not an image.`, "warning");
                continue;
            }

            const id = Date.now() + Math.random().toString(36).substring(2, 9);
            /** @type {any} */
            const newItem = {
                id,
                name: file.name,
                url: "",
                tag: "",
                status: "uploading",
                progress: "Uploading..."
            };

            widgetUploadedImages = [...widgetUploadedImages, newItem];
            uploadWidgetFile(file, id);
        }
    }

    /** 
     * @param {File} file 
     * @param {string} itemId
     */
    async function uploadWidgetFile(file, itemId) {
        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await fetch("/api/admin/upload", {
                method: "POST",
                body: formData,
            });

            const result = await res.json();
            if (result.url) {
                widgetUploadedImages = widgetUploadedImages.map(item => {
                    if (item.id === itemId) {
                        let autoTag = "";
                        const numMatch = file.name.match(/(\d+[\._]\d+)/);
                        if (numMatch) {
                            autoTag = numMatch[1].replace("_", ".");
                        } else if (file.name.toLowerCase().includes("cover")) {
                            autoTag = "cover";
                        }

                        return {
                            ...item,
                            url: result.url,
                            tag: autoTag,
                            status: "success",
                            progress: "Uploaded"
                        };
                    }
                    return item;
                });
                showToast(`Uploaded ${file.name}`, "success");
            } else {
                widgetUploadedImages = widgetUploadedImages.map(item => {
                    if (item.id === itemId) {
                        return { ...item, status: "error", progress: result.error || "Failed" };
                    }
                    return item;
                });
                showToast(`Failed to upload ${file.name}: ${result.error}`, "error");
            }
        } catch (err) {
            console.error(err);
            widgetUploadedImages = widgetUploadedImages.map(item => {
                if (item.id === itemId) {
                    return { ...item, status: "error", progress: "Failed" };
                }
                return item;
            });
            showToast(`Upload failed for ${file.name}`, "error");
        }
    }

    /** @param {string} itemId */
    async function removeWidgetImage(itemId) {
        const item = widgetUploadedImages.find(i => i.id === itemId);
        if (item && item.url && item.status === "success") {
            try {
                await fetch("/api/admin/upload", {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ url: item.url })
                });
            } catch (err) {
                console.error("Failed to delete from server:", err);
            }
        }
        widgetUploadedImages = widgetUploadedImages.filter(i => i.id !== itemId);
    }

    async function saveWidgetPlacements() {
        let appliedCount = 0;
        for (const item of widgetUploadedImages) {
            if (item.status === "success" && item.url && item.tag) {
                const success = insertImageByTag(item.url, item.name, item.tag);
                if (success) appliedCount++;
            }
        }
        
        isSaving = true;
        
        const updatedMetadata = {
            ...post.metadata,
            image: image,
            draft: post.draft,
            hidden: post.hidden,
            visibility: post.metadata.visibility || 'public',
            category: post.metadata.category || '',
            date: post.metadata.date || new Date().toISOString().split("T")[0]
        };
        
        const payload = {
            id: post.id,
            title: post.title,
            slug: post.slug,
            content: content,
            metadata: updatedMetadata,
            saved_by_name: "mcp_widget"
        };
        
        try {
            const res = await fetch("/api/admin/posts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            const result = await res.json();
            if (result.success) {
                showToast("Post placements saved successfully in database!", "success");
                widgetUploadedImages = widgetUploadedImages.filter(img => img.status !== "success" || !img.tag);
            } else {
                showToast(result.error || "Failed to save post", "error");
            }
        } catch (err) {
            console.error(err);
            showToast("Failed to save post in database", "error");
        } finally {
            isSaving = false;
        }
    }

    /** @param {MouseEvent} event */
    function handleDocumentClick(event) {
        const target = /** @type {HTMLElement} */ (event.target);
        if (!target.closest(".custom-select-container")) {
            openDropdownId = "";
        }
    }

    onMount(() => {
        document.addEventListener("click", handleDocumentClick);
        return () => {
            document.removeEventListener("click", handleDocumentClick);
        };
    });
</script>

<div class="mcp-widget-container">
    <div class="widget-header">
        <h1>Upload images</h1>
        <p class="widget-subtitle">
            Uploading images for: <strong>{post.title}</strong>
        </p>
    </div>

    <!-- Active Dropzone -->
    <div 
        class="dropzone-box {isWidgetDragOver ? 'dragover' : ''}" 
        ondragover={handleWidgetDragOver}
        ondragleave={handleWidgetDragLeave}
        ondrop={handleWidgetDrop}
        onclick={() => widgetFileInput?.click()}
        role="button"
        tabindex="0"
        onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') widgetFileInput?.click(); }}
    >
        <div class="cloud-icon-container">
            <i class="fa-solid fa-cloud-arrow-up"></i>
        </div>
        <h3>Drag & Drop multiple images here</h3>
        <p>Or click to browse files from your computer</p>
        <input 
            type="file" 
            multiple 
            accept="image/*" 
            style="display: none;" 
            bind:this={widgetFileInput} 
            onchange={handleWidgetFileSelect} 
        />
    </div>

    <!-- Preview List -->
    {#if widgetUploadedImages.length > 0}
        <div class="uploaded-images-list-container">
            <h2>Uploaded Images</h2>
            <div class="uploaded-images-list">
                {#each widgetUploadedImages as img (img.id)}
                    <div class="uploaded-image-row">
                        {#if img.status === 'uploading'}
                            <div class="image-preview-thumb-placeholder">
                                <i class="fa-regular fa-loader fa-spin"></i>
                            </div>
                        {:else if img.status === 'error'}
                            <div class="image-preview-thumb-placeholder error">
                                <i class="fa-solid fa-triangle-exclamation"></i>
                            </div>
                        {:else}
                            <img src={img.url} alt={img.name} class="image-preview-thumb" />
                        {/if}
                        
                        <div class="image-info">
                            <input type="text" class="image-filename-input" bind:value={img.name} title="Rename file" />
                            <div class="image-status-text {img.status}">{img.progress}</div>
                        </div>
                        
                        {#if img.status === 'success'}
                            <div class="tag-wrapper">
                                <div class="custom-select-container">
                                    <button 
                                        type="button" 
                                        class="custom-select-trigger" 
                                        onclick={(e) => { e.stopPropagation(); openDropdownId = openDropdownId === img.id ? "" : img.id; }}
                                    >
                                        <span>{img.tag ? (img.tag === 'cover' ? 'Cover Image (cover)' : `Section ${img.tag}`) : 'Choose Placement...'}</span>
                                        <i class="fa-solid fa-chevron-down {openDropdownId === img.id ? 'rotated' : ''}"></i>
                                    </button>
                                    
                                    {#if openDropdownId === img.id}
                                        <div class="custom-select-dropdown">
                                            <div class="custom-tag-input-row">
                                                <i class="fa-solid fa-tag"></i>
                                                <input 
                                                    type="text" 
                                                    placeholder="Type tag (e.g. 1.1, cover)..." 
                                                    bind:value={img.tag} 
                                                    onclick={(e) => e.stopPropagation()} 
                                                />
                                            </div>
                                            
                                            <div class="dropdown-options-list">
                                                <button 
                                                    type="button" 
                                                    class="dropdown-option {img.tag === 'cover' ? 'selected' : ''}"
                                                    onclick={() => { img.tag = 'cover'; openDropdownId = ""; }}
                                                >
                                                    <i class="fa-solid fa-image"></i>
                                                    <span class="option-text">Cover Image (cover)</span>
                                                </button>
                                                
                                                {#each getPostHeadings(content) as h}
                                                    <button 
                                                        type="button" 
                                                        class="dropdown-option {img.tag === h.index ? 'selected' : ''}"
                                                        onclick={() => { img.tag = h.index; openDropdownId = ""; }}
                                                    >
                                                        <span class="option-index">{h.index}</span>
                                                        <span class="option-text" title={h.text}>{h.text}</span>
                                                    </button>
                                                {/each}
                                            </div>
                                        </div>
                                    {/if}
                                </div>
                            </div>
                        {/if}
                        
                        <div class="image-actions">
                            <button 
                                type="button" 
                                class="btn-remove" 
                                onclick={() => removeWidgetImage(img.id)}
                                title="Remove image"
                            >
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        </div>
                    </div>
                {/each}
            </div>
        </div>
    {/if}

    <div class="action-footer">
        {#if image}
            <div class="cover-indicator">
                <strong>Cover image set:</strong> <span class="cover-url">{image}</span>
            </div>
        {/if}
        <button 
            type="button" 
            class="btn btn-orange btn-large" 
            disabled={isSaving}
            onclick={saveWidgetPlacements}
        >
            {#if isSaving}
                Saving...
            {:else}
                Save
            {/if}
        </button>
    </div>
</div>

<!-- Toast Container -->
<div class="toast-container">
    {#each toasts as toast (toast.id)}
        <div class="toast-item {toast.type}">
            {toast.message}
        </div>
    {/each}
</div>

<style>
    .mcp-widget-container {
        max-width: 800px;
        margin: 20px auto 40px;
        padding: 30px 40px 40px;
        background: var(--card-bg, #ffffff);
        border: 1px solid var(--border, #e5e5e5);
        border-radius: var(--squircle-outer, 40px);
        corner-shape: squircle;
        box-shadow: 0 8px 30px rgba(0, 0, 0, 0.05);
        font-family: var(--font-primary, "PP Mori", sans-serif);
    }
    
    :global(body.dark) .mcp-widget-container {
        box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3);
    }
    
    .widget-header {
        margin-bottom: 25px;
        border-bottom: 1px solid var(--border, #eee);
        padding-bottom: 15px;
    }
    
    .widget-header h1 {
        font-size: 28px;
        font-weight: 700;
        margin: 0 0 8px 0;
        color: var(--text, #111);
        display: flex;
        align-items: center;
        gap: 12px;
    }
    
    .widget-subtitle {
        color: var(--text, #666);
        opacity: 0.8;
        margin: 0;
        font-size: 15px;
    }
    
    .dropzone-box {
        border: 2px dashed var(--border, #ccc);
        border-radius: var(--squircle-inner, 25px);
        corner-shape: squircle;
        padding: 50px 20px;
        text-align: center;
        cursor: pointer;
        background: var(--bg, #fbfbfb);
        transition: all 0.25s ease;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
    }
    
    .dropzone-box:hover {
        border-color: var(--brand-orange, #ff5400);
        background: var(--card-bg, #ffffff);
        transform: translateY(-2px);
        box-shadow: 0 8px 24px rgba(0,0,0,0.04);
    }
    
    :global(body.dark) .dropzone-box:hover {
        box-shadow: 0 8px 24px rgba(0,0,0,0.2);
    }
    
    .dropzone-box.dragover {
        border-color: var(--brand-orange, #ff5400);
        background: rgba(255, 84, 0, 0.05);
    }
    
    .cloud-icon-container {
        width: 60px;
        height: 60px;
        background: var(--card-bg, #ffffff);
        border-radius: var(--squircle-inner, 18px);
        corner-shape: squircle;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 12px rgba(0,0,0,0.06);
        margin-bottom: 5px;
        border: 1px solid var(--border, #eee);
    }
    
    .cloud-icon-container i {
        font-size: 24px;
        color: var(--brand-orange, #ff5400);
    }
    
    .dropzone-box h3 {
        margin: 0;
        font-size: 18px;
        font-weight: 700;
        color: var(--text, #222);
    }
    
    .dropzone-box p {
        margin: 0;
        font-size: 14px;
        color: var(--text, #777);
        opacity: 0.7;
    }
    
    .uploaded-images-list-container {
        margin-top: 40px;
    }
    
    .uploaded-images-list-container h2 {
        font-size: 20px;
        font-weight: 700;
        color: var(--text, #222);
        margin-bottom: 20px;
    }
    
    .uploaded-images-list {
        display: flex;
        flex-direction: column;
        gap: 15px;
    }
    
    .uploaded-image-row {
        display: flex;
        align-items: center;
        gap: 20px;
        padding: 16px;
        background: var(--card-bg, #ffffff);
        border: 1px solid var(--border, #e5e5e5);
        border-radius: var(--squircle-inner, 25px);
        corner-shape: squircle;
        transition: box-shadow 0.2s ease, transform 0.2s ease;
    }
    
    .uploaded-image-row:hover {
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.04);
        transform: translateY(-1px);
    }
    
    .image-preview-thumb {
        width: 70px;
        height: 70px;
        object-fit: cover;
        border-radius: var(--squircle-inner, 18px);
        corner-shape: squircle;
        border: 1px solid var(--border, #eee);
    }
    
    .image-preview-thumb-placeholder {
        width: 70px;
        height: 70px;
        border-radius: var(--squircle-inner, 18px);
        corner-shape: squircle;
        background: var(--bg, #f5f5f5);
        border: 1px solid var(--border, #eee);
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--text, #888);
        font-size: 22px;
        opacity: 0.5;
    }
    
    .image-preview-thumb-placeholder.error {
        color: #dc3545;
        background: #fdf3f4;
        border-color: #f5c6cb;
        opacity: 1;
    }
    
    :global(body.dark) .image-preview-thumb-placeholder.error {
        background: rgba(220, 53, 69, 0.1);
        border-color: rgba(220, 53, 69, 0.2);
    }
    
    .image-info {
        flex: 1;
        min-width: 0;
    }
    
    .image-filename-input {
        width: calc(100% + 16px);
        min-width: 0;
        margin-left: -8px;
        padding: 4px 8px;
        box-sizing: border-box;
        border: none;
        background: transparent;
        font-family: inherit;
        font-weight: 700;
        font-size: 15px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        color: var(--text, #222);
        margin-bottom: 2px;
        outline: none;
        border-radius: 8px;
        transition: all 0.2s ease;
    }
    
    .image-filename-input:focus,
    .image-filename-input:hover {
        background: rgba(0, 0, 0, 0.04);
    }
    
    :global(body.dark) .image-filename-input:focus,
    :global(body.dark) .image-filename-input:hover {
        background: rgba(255, 255, 255, 0.08);
    }
    
    .image-status-text {
        font-size: 13px;
        font-weight: 500;
        color: var(--text, #888);
        opacity: 0.7;
    }
    
    .image-status-text.uploading { color: #007aff; opacity: 1; }
    .image-status-text.success { color: #1a7f37; opacity: 1; }
    .image-status-text.error { color: #dc3545; opacity: 1; }
    
    :global(body.dark) .image-status-text.uploading { color: #3ea6ff; }
    :global(body.dark) .image-status-text.success { color: #3fb950; }
    
    .tag-wrapper {
        display: flex;
        align-items: center;
    }
    
    /* Custom Dropdown Styles */
    .custom-select-container {
        position: relative;
        width: 250px;
    }
    
    .custom-select-trigger {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 18px;
        background: var(--bg, #fbfbfb);
        border: 1px solid var(--border, #e5e5e5);
        border-radius: var(--squircle-inner, 25px);
        corner-shape: squircle;
        font-family: var(--font-primary, "PP Mori", sans-serif);
        font-size: 13px;
        font-weight: 700;
        color: var(--text, #333);
        cursor: pointer;
        transition: all 0.2s ease;
    }
    
    .custom-select-trigger:hover {
        border-color: var(--brand-orange, #ff5400);
        background: var(--card-bg, #ffffff);
        box-shadow: 0 4px 12px rgba(0,0,0,0.03);
    }
    
    .custom-select-trigger i {
        font-size: 12px;
        color: var(--text, #888);
        opacity: 0.5;
        transition: transform 0.2s ease;
    }
    
    .custom-select-trigger i.rotated {
        transform: rotate(180deg);
    }
    
    .custom-select-dropdown {
        position: absolute;
        top: calc(100% + 8px);
        left: 0;
        width: 100%;
        max-height: 280px;
        background: var(--card-bg, #ffffff);
        border: 1px solid var(--border, #e5e5e5);
        border-radius: var(--squircle-inner, 25px);
        corner-shape: squircle;
        box-shadow: 0 16px 40px rgba(0,0,0,0.1);
        z-index: 100;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        animation: slideFadeDown 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }
    
    :global(body.dark) .custom-select-dropdown {
        box-shadow: 0 16px 40px rgba(0,0,0,0.4);
    }
    
    @keyframes slideFadeDown {
        from { transform: translateY(-4px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
    }
    
    .custom-tag-input-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 14px 16px;
        border-bottom: 1px solid var(--border, #eee);
        background: var(--bg, #fdfdfd);
    }
    
    .custom-tag-input-row i {
        font-size: 13px;
        color: var(--text, #888);
        opacity: 0.5;
    }
    
    .custom-tag-input-row input {
        flex: 1;
        border: none;
        background: transparent;
        font-family: var(--font-primary, "PP Mori", sans-serif);
        font-size: 14px;
        outline: none;
        color: var(--text, #333);
        padding: 0;
    }
    
    .dropdown-options-list {
        flex: 1;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        padding: 8px;
    }
    
    .dropdown-option {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 14px;
        border: none;
        background: none;
        text-align: left;
        cursor: pointer;
        border-radius: var(--squircle-inner, 18px);
        corner-shape: squircle;
        font-family: var(--font-primary, "PP Mori", sans-serif);
        font-size: 13px;
        color: var(--text, #555);
        transition: all 0.15s ease;
    }
    
    .dropdown-option:hover {
        background: var(--bg, #f5f5f5);
        color: var(--text, #111);
    }
    
    .dropdown-option.selected {
        background: var(--brand-orange, #ff5400);
        color: white;
    }
    
    .dropdown-option.selected .option-index {
        background: rgba(255,255,255,0.25);
        color: white;
    }
    
    .option-index {
        padding: 4px 8px;
        background: var(--bg, #f0f0f0);
        border-radius: var(--squircle-inner, 12px);
        corner-shape: squircle;
        font-size: 11px;
        font-weight: 700;
        color: var(--text, #666);
    }
    
    .option-text {
        flex: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        font-weight: 500;
    }
    
    .image-actions {
        display: flex;
        align-items: center;
    }
    
    .btn-remove {
        background: var(--bg, #f9f9f9);
        border: 1px solid var(--border, #eee);
        border-radius: var(--squircle-inner, 18px);
        corner-shape: squircle;
        color: #dc3545;
        cursor: pointer;
        padding: 12px;
        font-size: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
    }
    
    .btn-remove:hover {
        background: #fdf3f4;
        border-color: #f5c6cb;
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(220, 53, 69, 0.1);
    }
    
    :global(body.dark) .btn-remove:hover {
        background: rgba(220, 53, 69, 0.15);
        border-color: rgba(220, 53, 69, 0.25);
    }
    
    .action-footer {
        margin-top: 40px;
        border-top: 1px solid var(--border, #eee);
        padding-top: 25px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 20px;
        width: 100%;
    }
    
    .cover-indicator {
        font-size: 14px;
        color: var(--text, #555);
        background: var(--bg, #fbfbfb);
        padding: 10px 20px;
        border: 1px solid var(--border, #eee);
        border-radius: var(--squircle-inner, 25px);
        corner-shape: squircle;
        max-width: 60%;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    
    .cover-url {
        color: var(--brand-orange, #ff5400);
        font-weight: 700;
    }
    
    .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 14px 28px;
        border-radius: var(--squircle-inner, 25px);
        corner-shape: squircle;
        font-family: var(--font-primary, "PP Mori", sans-serif);
        font-weight: 700;
        font-size: 14px;
        cursor: pointer;
        border: none;
        transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        text-decoration: none;
    }
    
    .btn:hover {
        transform: translateY(-3px) scale(1.02);
        box-shadow: 0 8px 20px rgba(255, 84, 0, 0.25);
    }
    
    .btn-orange {
        background: var(--brand-orange, #ff5400);
        color: white;
    }
    
    .btn-orange:hover {
        background: #e04a00;
    }
    
    .btn-orange:disabled {
        background: var(--border, #ccc);
        color: var(--bg, #fff);
        cursor: not-allowed;
        transform: none;
        box-shadow: none;
    }
    
    .btn-large {
        padding: 16px 32px;
        font-size: 15px;
    }
    
    /* Toast Styles */
    .toast-container {
        position: fixed;
        bottom: 30px;
        right: 30px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        z-index: 9999;
    }
    
    .toast-item {
        padding: 14px 24px;
        border-radius: var(--squircle-inner, 20px);
        corner-shape: squircle;
        color: white;
        font-size: 14px;
        font-weight: 700;
        box-shadow: 0 8px 24px rgba(0,0,0,0.12);
        animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        border: 1px solid transparent;
        font-family: var(--font-primary, "PP Mori", sans-serif);
    }
    
    .toast-item.info { 
        background: #e3f2fd; 
        color: #0d47a1;
        border-color: #bbdefb;
    }
    .toast-item.success { 
        background: #e8f5e9; 
        color: #1b5e20;
        border-color: #c8e6c9;
    }
    .toast-item.error { 
        background: #ffebee; 
        color: #c62828;
        border-color: #ffcdd2;
    }
    .toast-item.warning { 
        background: #fff8e1; 
        color: #f57f17; 
        border-color: #ffe082;
    }
    
    @keyframes slideIn {
        from { transform: translateX(100px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @media (max-width: 640px) {
        .mcp-widget-container {
            margin: 15px;
            width: auto;
            padding: 20px 15px;
            border-radius: 25px;
            box-sizing: border-box;
        }
        
        .widget-header h1 {
            font-size: 22px;
        }
        
        .dropzone-box {
            padding: 30px 15px;
        }
        
        .uploaded-image-row {
            flex-wrap: wrap;
            padding: 15px;
            gap: 12px;
        }
        
        .tag-wrapper {
            width: calc(100% - 50px);
            order: 3;
        }
        
        .custom-select-container {
            width: 100%;
        }
        
        .image-actions {
            width: 38px;
            order: 4;
        }
        
        .btn-remove {
            padding: 0;
            width: 38px;
            height: 38px;
        }
        
        .action-footer {
            flex-direction: column;
            gap: 15px;
        }
        
        .cover-indicator {
            max-width: 100%;
            width: 100%;
            text-align: center;
        }
        
        .btn {
            width: 100%;
        }
    }
</style>
