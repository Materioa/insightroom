<script>
    import { onMount } from "svelte";
    import { page } from "$app/stores";
    import { Marked } from "marked";
    import { diffLines } from "diff";

    export let data;

    let id = $page.params.id;
    /** @type {any} */
    let post = data.post || {
        title: "",
        slug: "",
        content: "",
        metadata: {
            category: "",
            date: new Date().toISOString().split("T")[0],
            excerpt: "",
            image: "",
            visibility: "public",
        },
        hidden: false,
        draft: false,
    };

    let title = post.title;
    let slug = post.slug;
    let content = post.content || "";
    let hidden = post.hidden;
    let draft = post.draft;
    let visibility = post.metadata.visibility || "public";
    let image = post.metadata.image || "";

    const coreKeys = [
        "title",
        "slug",
        "category",
        "date",
        "excerpt",
        "image",
        "visibility",
        "hidden",
        "draft",
    ];
    let metadataArray = Object.keys(post.metadata)
        .filter((k) => !coreKeys.includes(k))
        .map((key) => ({ key, value: String(post.metadata[key]) }));

    /** @param {Date} d */
    function getLocalISOString(d) {
        const tzoffset = d.getTimezoneOffset() * 60000;
        return new Date(d.getTime() - tzoffset).toISOString().slice(0, 16);
    }

    let category = post.metadata.category || "";
    let date = post.metadata.date
        ? getLocalISOString(new Date(post.metadata.date))
        : getLocalISOString(new Date());
    let excerpt = post.metadata.excerpt || "";

    function setDateToNow() {
        date = getLocalISOString(new Date());
    }

    function addMetadataField() {
        metadataArray = [...metadataArray, { key: "", value: "" }];
    }

    /** @param {number} index */
    function removeMetadataField(index) {
        metadataArray = metadataArray.filter((_, i) => i !== index);
    }

    /** @type {number} */
    let draggedIndex = -1;

    /**
     * @param {DragEvent} e
     * @param {number} index
     */
    function handleDragStart(e, index) {
        draggedIndex = index;
        if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
    }

    /**
     * @param {DragEvent} e
     * @param {number} index
     */
    function handleDragOver(e, index) {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    }

    /**
     * @param {DragEvent} e
     * @param {number} targetIndex
     */
    function handleDrop(e, targetIndex) {
        e.preventDefault();
        if (draggedIndex !== -1 && draggedIndex !== targetIndex) {
            const newArray = [...metadataArray];
            const item = newArray.splice(draggedIndex, 1)[0];
            newArray.splice(targetIndex, 0, item);
            metadataArray = newArray;
        }
        draggedIndex = -1;
    }

    /** @type {HTMLTextAreaElement} */
    let textareaEl;
    let isUploading = false;
    let uploadStatus = "";
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
        if (
            !file.type.startsWith("image/") &&
            !file.type.startsWith("video/")
        ) {
            alert("Only images and videos are allowed.");
            return;
        }

        isUploading = true;
        uploadStatus = "Uploading...";

        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await fetch("/api/admin/upload", {
                method: "POST",
                body: formData,
            });

            const result = await res.json();
            if (result.url) {
                const markdownImage = `\n![${file.name}](${result.url})\n`;
                insertAtCursor(markdownImage);
                uploadStatus = "Uploaded successfully!";
                setTimeout(() => (uploadStatus = ""), 3000);
            } else {
                alert(result.error || "Upload failed");
                uploadStatus = "";
            }
        } catch (err) {
            console.error(err);
            alert("Upload failed");
            uploadStatus = "";
        }

        isUploading = false;
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
        if (
            !file.type.startsWith("image/") &&
            !file.type.startsWith("video/")
        ) {
            alert("Only images and videos are allowed for cover.");
            return;
        }

        coverUploading = true;
        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await fetch("/api/admin/upload", {
                method: "POST",
                body: formData,
            });

            const result = await res.json();
            if (result.url) {
                image = result.url;
            } else {
                alert(result.error || "Upload failed");
            }
        } catch (err) {
            console.error(err);
            alert("Upload failed");
        }
        coverUploading = false;
    }

    /** @param {string} text */
    function insertAtCursor(text) {
        if (!textareaEl) return;
        textareaEl.focus();
        document.execCommand("insertText", false, text);
    }

    /** @param {string} type */
    function insertFormatting(type) {
        if (!textareaEl) return;
        textareaEl.focus();
        const startPos = textareaEl.selectionStart;
        const endPos = textareaEl.selectionEnd;
        const selectedText =
            content.substring(startPos, endPos) ||
            (type === "table" ? "" : "text");

        let insertText = "";
        if (type === "bold") insertText = `**${selectedText}**`;
        else if (type === "italic") insertText = `*${selectedText}*`;
        else if (type === "heading") insertText = `\n### ${selectedText}\n`;
        else if (type === "code") insertText = `\`${selectedText}\``;
        else if (type === "quote") insertText = `\n> ${selectedText}\n`;
        else if (type === "list-ul") insertText = `\n- ${selectedText}\n`;
        else if (type === "list-ol") insertText = `\n1. ${selectedText}\n`;
        else if (type === "link") insertText = `[${selectedText}](url)`;
        else if (type === "table")
            insertText = `\n| Header 1 | Header 2 |\n| -------- | -------- |\n| Cell 1   | Cell 2   |\n`;

        document.execCommand("insertText", false, insertText);
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
            draft,
        };

        metadataArray.forEach((m) => {
            if (m.key.trim()) {
                payloadMetadata[m.key.trim()] = m.value;
            }
        });

        const payload = {
            id: id === "new" ? null : id,
            title,
            slug,
            content,
            metadata: {
                ...payloadMetadata,
                author_name:
                    post.metadata.author_name ||
                    data.user?.name ||
                    data.user?.username ||
                    "Materio Admin",
                author_avatar:
                    post.metadata.author_avatar ||
                    data.user?.avatar ||
                    data.user?.profilePicture ||
                    "/assets/img/default-avatar.svg",
            },
        };

        const res = await fetch("/api/admin/posts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        const result = await res.json();
        if (result.success) {
            alert("Saved successfully!");
            if (id === "new") {
                window.location.href = `/admin/editor/${result.id}`;
            }
        } else {
            alert("Error saving: " + result.error);
        }
    }

    async function deletePost() {
        if (id === "new") {
            window.location.href = "/admin";
            return;
        }
        if (confirm("Are you sure you want to delete this post?")) {
            const res = await fetch(`/api/admin/posts?id=${id}`, {
                method: "DELETE",
            });
            if (res.ok) {
                alert("Deleted successfully");
                window.location.href = "/admin";
            } else {
                alert("Failed to delete");
            }
        }
    }

    let showHistory = false;
    /** @type {any[]} */
    let versions = [];
    let loadingHistory = false;
    /** @type {any} */
    let selectedVersion = null;
    /** @type {any[]} */
    let diffResult = [];
    let diffStats = { additions: 0, deletions: 0 };

    async function viewHistory() {
        if (id === "new") {
            alert("Save the post first to view history.");
            return;
        }
        showHistory = true;
        loadingHistory = true;
        selectedVersion = null;
        try {
            const res = await fetch(`/api/admin/versions?id=${id}`);
            const data = await res.json();
            if (data.success) {
                versions = data.versions;
            } else {
                alert("Failed to load history");
            }
        } catch (e) {
            console.error(e);
        }
        loadingHistory = false;
    }

    /** @param {any} version */
    function compareVersion(version) {
        selectedVersion = version;
        const diffs = diffLines(version.content || "", content || "");

        let out = [];
        let oldLine = 1;
        let newLine = 1;
        let addCount = 0;
        let remCount = 0;

        for (let part of diffs) {
            const lines = part.value.replace(/\n$/, "").split("\n");
            if (part.added) {
                addCount += lines.length;
                for (let line of lines) {
                    out.push({
                        type: "added",
                        text: line,
                        oldLine: "",
                        newLine: newLine++,
                    });
                }
            } else if (part.removed) {
                remCount += lines.length;
                for (let line of lines) {
                    out.push({
                        type: "removed",
                        text: line,
                        oldLine: oldLine++,
                        newLine: "",
                    });
                }
            } else {
                oldLine += lines.length;
                newLine += lines.length;
            }
        }
        diffStats = { additions: addCount, deletions: remCount };
        diffResult = out;
    }

    /** @param {string|Date|number} dateStr */
    function formatVersionDate(dateStr) {
        if (!dateStr) return "";
        const d = new Date(dateStr);
        const day = d.getDate();
        const weekday = d.toLocaleDateString("en-US", { weekday: 'long' });
        const year = d.getFullYear();
        return `${day} ${weekday} ${year}`;
    }
    
    /** @param {string|Date|number} dateStr */
    function formatVersionTime(dateStr) {
        if (!dateStr) return "";
        const d = new Date(dateStr);
        return d.toLocaleTimeString("en-US", { hour: 'numeric', minute: '2-digit' });
    }

    let isPreviewMode = false;
    let previewHtml = "";
    let isFullscreen = false;

    async function togglePreview() {
        isPreviewMode = !isPreviewMode;
        if (isPreviewMode) {
            const customMarked = new Marked({ gfm: true, breaks: true });
            let rawContent = content || "";

            const attachmentRegex = /\[attachment:([\s\S]+?):([\s\S]+?)\]/g;
            rawContent = rawContent.replace(
                attachmentRegex,
                (
                    /** @type {string} */ match,
                    /** @type {string} */ url,
                    /** @type {string} */ title,
                ) => {
                    const cleanUrl = url.trim();
                    const cleanTitle = title.trim();
                    const fileExt =
                        cleanUrl.split(".").pop()?.toUpperCase() || "FILE";
                    const rndId =
                        "attachment-" + Math.random().toString(36).substr(2, 5);
                    return `<div class="attachment-card" data-file-path="${cleanUrl}" data-attachment-id="${rndId}">
                    <div class="attachment-details">
                        <div class="attachment-title">${cleanTitle}</div>
                        <div class="attachment-meta"><span class="file-type">${fileExt}</span></div>
                    </div>
                </div>`;
                },
            );

            const videoRegex = /\[video:([\s\S]+?)\]/g;
            rawContent = rawContent.replace(
                videoRegex,
                (
                    /** @type {string} */ match,
                    /** @type {string} */ vparams,
                ) => {
                    const parts = vparams.split(":");
                    const videoUrl = parts[0].trim();
                    return `<div class="video-embed"><video muted loop autoplay playsinline src="${videoUrl}"></video></div>`;
                },
            );

            previewHtml = await customMarked.parse(rawContent);
        }
    }

    $: permalinkField = metadataArray.find(m => m.key === 'permalink');
    $: permalink = permalinkField && permalinkField.value ? permalinkField.value : null;
    $: liveUrl = permalink ? (permalink.startsWith('/') || permalink.startsWith('http') ? permalink : `/${permalink}`) : `/${category || 'blog'}/${slug}`;

</script>

<svelte:head>
    <link
        href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap"
        rel="stylesheet"
    />
    <link
        href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap"
        rel="stylesheet"
    />
</svelte:head>

<svelte:window
    onkeydown={(e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "s") {
            e.preventDefault();
            savePost();
        }
    }}
/>

<div class="cms-wrapper" class:fullscreen={isFullscreen}>
    <div class="cms-layout">
        <!-- Main Form Column -->
        <div class="cms-main">
            <div class="breadcrumbs">
                <h2>
                    <a href="/admin" class="home-link"
                        ><i class="fa-solid fa-house"></i> Posts</a
                    >
                    /
                    <span class="light">{liveUrl.replace(/^\/+/, '')}</span>
                </h2>
            </div>

            <!-- Path Field -->
            <div class="field-group path-group">
                <label for="slug"
                    >Path <i class="fa-solid fa-circle-info info-icon"
                    ></i></label
                >
                <input
                    id="slug"
                    type="text"
                    class="input-path"
                    bind:value={slug}
                    placeholder="2026-01-01-my-post"
                />
            </div>

            <!-- Title Field -->
            <div class="field-group title-group">
                <label for="title">Title</label>
                <input
                    id="title"
                    type="text"
                    class="input-title"
                    bind:value={title}
                    placeholder="Insightroom Admin!"
                />
            </div>

            <!-- Editor Toolbar & Textarea -->
            <div class="editor-container">
                <div class="toolbar">
                    <button
                        class="tool-btn"
                        onclick={() => insertFormatting("bold")}
                        title="Bold"><i class="fa-solid fa-bold"></i></button
                    >
                    <button
                        class="tool-btn"
                        onclick={() => insertFormatting("italic")}
                        title="Italic"
                        ><i class="fa-solid fa-italic"></i></button
                    >
                    <button
                        class="tool-btn"
                        onclick={() => insertFormatting("heading")}
                        title="Heading"
                        ><i class="fa-solid fa-heading"></i></button
                    >

                    <span class="divider"></span>

                    <button
                        class="tool-btn"
                        onclick={() => insertFormatting("code")}
                        title="Code"><i class="fa-solid fa-code"></i></button
                    >
                    <button
                        class="tool-btn"
                        onclick={() => insertFormatting("quote")}
                        title="Quote"
                        ><i class="fa-solid fa-quote-left"></i></button
                    >
                    <button
                        class="tool-btn"
                        onclick={() => insertFormatting("list-ul")}
                        title="Bulleted List"
                        ><i class="fa-solid fa-list-ul"></i></button
                    >
                    <button
                        class="tool-btn"
                        onclick={() => insertFormatting("list-ol")}
                        title="Numbered List"
                        ><i class="fa-solid fa-list-ol"></i></button
                    >

                    <span class="divider"></span>

                    <button
                        class="tool-btn"
                        onclick={() => insertFormatting("link")}
                        title="Link"><i class="fa-solid fa-link"></i></button
                    >
                    <label
                        class="tool-btn"
                        title="Image / Media"
                        style="cursor: pointer;"
                    >
                        <input
                            type="file"
                            accept="image/*,video/*"
                            hidden
                            onchange={handleFileSelect}
                        />
                        <i class="fa-regular fa-image"></i>
                    </label>
                    <button
                        class="tool-btn"
                        onclick={() => insertFormatting("table")}
                        title="Table"><i class="fa-solid fa-table"></i></button
                    >

                    <span class="divider"></span>

                    <button
                        class="tool-btn {isPreviewMode ? 'active' : ''}"
                        onclick={togglePreview}
                        title="Preview"
                        ><i class="fa-regular fa-eye"></i></button
                    >
                    <button
                        class="tool-btn"
                        onclick={() => (isFullscreen = !isFullscreen)}
                        title="Fullscreen"
                        ><i class="fa-solid fa-expand"></i></button
                    >
                    <button class="tool-btn" onclick={savePost} title="Save"
                        ><i class="fa-regular fa-floppy-disk"></i></button
                    >

                    {#if isUploading}
                        <span class="upload-status"
                            ><i class="fa-solid fa-spinner fa-spin"></i>
                            {uploadStatus}</span
                        >
                    {/if}
                </div>

                {#if isPreviewMode}
                    <div class="preview-box">
                        {@html previewHtml}
                    </div>
                {:else}
                    <textarea
                        class="content-textarea"
                        bind:this={textareaEl}
                        bind:value={content}
                        ondrop={handleFileDrop}
                        ondragover={(e) => e.preventDefault()}
                    ></textarea>
                {/if}
            </div>

            <!-- Metadata Section Below Editor -->
            <div class="metadata-section">
                <div class="meta-card">
                    <div class="meta-header">
                        <div class="meta-key">category</div>
                        <i class="fa-solid fa-chevron-down chevron"></i>
                    </div>
                    <div class="meta-body">
                        <input
                            type="text"
                            bind:value={category}
                            class="meta-input"
                            placeholder="e.g. Tutorials"
                        />
                    </div>
                </div>

                <div class="meta-card">
                    <div class="meta-header">
                        <div class="meta-key">date</div>
                        <i class="fa-solid fa-chevron-down chevron"></i>
                    </div>
                    <div class="meta-body" style="display: flex; gap: 8px;">
                        <input
                            type="datetime-local"
                            bind:value={date}
                            class="meta-input"
                        />
                        <button
                            type="button"
                            class="btn btn-gray-sm"
                            style="margin: 0;"
                            onclick={setDateToNow}
                            title="Set to current time"
                        >
                            <i class="fa-solid fa-clock"></i> Now
                        </button>
                    </div>
                </div>

                <div class="meta-card">
                    <div class="meta-header">
                        <div class="meta-key">visibility</div>
                        <i class="fa-solid fa-chevron-down chevron"></i>
                    </div>
                    <div class="meta-body">
                        <select bind:value={visibility} class="meta-input">
                            <option value="public">Public</option>
                            <option value="private">Private</option>
                        </select>
                    </div>
                </div>

                <div class="meta-card">
                    <div class="meta-header">
                        <div class="meta-key">status</div>
                        <i class="fa-solid fa-chevron-down chevron"></i>
                    </div>
                    <div class="meta-body checkbox-group">
                        <label
                            ><input type="checkbox" bind:checked={draft} /> Draft</label
                        >
                        <label
                            ><input type="checkbox" bind:checked={hidden} /> Hidden</label
                        >
                    </div>
                </div>

                <div class="meta-card">
                    <div class="meta-header">
                        <div class="meta-key">excerpt</div>
                        <i class="fa-solid fa-chevron-down chevron"></i>
                    </div>
                    <div class="meta-body">
                        <textarea
                            bind:value={excerpt}
                            class="meta-input"
                            rows="3"
                            placeholder="Brief summary..."
                        ></textarea>
                    </div>
                </div>

                <div class="meta-card">
                    <div class="meta-header">
                        <div class="meta-key">cover_image</div>
                        <i class="fa-solid fa-chevron-down chevron"></i>
                    </div>
                    <div class="meta-body">
                        <input
                            type="text"
                            bind:value={image}
                            class="meta-input"
                            placeholder="Image URL..."
                        />
                        <div style="margin-top: 10px;">
                            <label
                                class="btn-new-meta"
                                style="cursor: pointer; display: inline-block;"
                            >
                                <input
                                    type="file"
                                    accept="image/*,video/*"
                                    hidden
                                    onchange={handleCoverSelect}
                                />
                                <i class="fa-solid fa-upload"></i> Upload Cover
                            </label>
                            {#if coverUploading}
                                <span
                                    style="margin-left: 10px; font-size: 14px; color: #777;"
                                    >Uploading...</span
                                >
                            {/if}
                        </div>
                    </div>
                </div>

                <!-- Custom User-Added Frontmatter -->
                <div class="draggable-container">
                    {#each metadataArray as item, i}
                        <div
                            class="meta-card"
                            draggable="true"
                            ondragstart={(e) => handleDragStart(e, i)}
                            ondragover={(e) => handleDragOver(e, i)}
                            ondrop={(e) => handleDrop(e, i)}
                            aria-label="Draggable metadata field"
                            role="listitem"
                        >
                            <div class="meta-header">
                                <div class="meta-key-edit">
                                    <span class="index">{i + 1}.</span>
                                    <i
                                        class="fa-solid fa-arrows-up-down-left-right drag-icon"
                                    ></i>
                                    <input
                                        type="text"
                                        bind:value={item.key}
                                        class="meta-input-inline"
                                        placeholder="key_name"
                                        aria-label="Field key"
                                    />
                                    <button
                                        class="btn-icon"
                                        onclick={() => removeMetadataField(i)}
                                        aria-label="Remove field"
                                        ><i class="fa-solid fa-xmark"
                                        ></i></button
                                    >
                                </div>
                                <i class="fa-solid fa-chevron-down chevron"></i>
                            </div>
                            <div class="meta-body">
                                <input
                                    type="text"
                                    bind:value={item.value}
                                    class="meta-input"
                                    aria-label="Field value"
                                />
                            </div>
                        </div>
                    {/each}
                </div>

                <div class="new-meta-row">
                    <button class="btn-new-meta" onclick={addMetadataField}>
                        <i class="fa-solid fa-circle-plus"></i> New metadata field
                    </button>
                    <div class="special-keys">
                        <i class="fa-solid fa-circle-info"></i> Special Keys
                    </div>
                </div>
            </div>
        </div>

        <!-- Sidebar Actions Column -->
        <div class="cms-sidebar">
            <div class="header-actions">
                <button class="btn btn-green" onclick={savePost}
                    ><i class="fa-regular fa-floppy-disk"></i> Save</button
                >
                <button class="btn btn-gray" onclick={togglePreview}
                    ><i
                        class="fa-regular {isPreviewMode
                            ? 'fa-pen-to-square'
                            : 'fa-eye'}"
                    ></i>
                    {isPreviewMode ? "Edit" : "Preview"}</button
                >
                <button
                    class="btn btn-gray"
                    onclick={() =>
                        window.open(liveUrl, "_blank")}
                    ><i class="fa-solid fa-arrow-up-right-from-square"></i> Live</button
                >
                <button class="btn btn-gray" onclick={viewHistory}
                    ><i class="fa-solid fa-clock-rotate-left"></i> History</button
                >
                <button class="btn btn-gray" onclick={deletePost}
                    ><i class="fa-regular fa-trash-can"></i> Delete</button
                >
            </div>
        </div>
    </div>
</div>

{#if showHistory}
    <div
        class="modal-overlay"
        onclick={() => (showHistory = false)}
        role="presentation"
        onkeydown={(e) => {
            if (e.key === "Escape") showHistory = false;
        }}
    >
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <div
            class="modal-content history-modal"
            onclick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            tabindex="-1"
            aria-label="Page History"
        >
            <div class="modal-header">
                <h3>Page History</h3>
                <button
                    class="btn-icon"
                    onclick={() => (showHistory = false)}
                    aria-label="Close history modal"
                    ><i class="fa-solid fa-xmark"></i></button
                >
            </div>
            <div class="history-layout">
                <div class="history-sidebar">
                    {#if loadingHistory}
                        <div style="padding: 20px; text-align: center;">
                            <i class="fa-solid fa-spinner fa-spin"></i> Loading...
                        </div>
                    {:else if versions.length === 0}
                        <div
                            style="padding: 20px; text-align: center; color: #666;"
                        >
                            No previous versions found.
                        </div>
                    {:else}
                        <ul class="version-list">
                            {#each versions as v}
                                <li class:active={selectedVersion === v}>
                                    <button
                                        class="version-btn"
                                        onclick={() => compareVersion(v)}
                                        aria-label="Compare with version from {new Date(
                                            v.version_saved_at,
                                        ).toLocaleString()}"
                                    >
                                        <div class="v-date">
                                            {formatVersionDate(v.version_saved_at)}
                                        </div>
                                        <div class="v-author">
                                            {formatVersionTime(v.version_saved_at)} - {v.saved_by_name || "Admin"}
                                        </div>
                                    </button>
                                </li>
                            {/each}
                        </ul>
                    {/if}
                </div>
                <div
                    class="history-main"
                    style="font-family: 'Manrope', sans-serif;"
                >
                    {#if selectedVersion}
                        <div class="diff-header">
                            Comparing <strong
                                >{new Date(
                                    selectedVersion.version_saved_at,
                                ).toLocaleString()}</strong
                            >
                            with Current
                            <span
                                style="margin-left: 15px; color: #22863a; font-weight: 600;"
                                >+{diffStats.additions}</span
                            >
                            <span
                                style="color: #cb2431; margin-left: 5px; font-weight: 600;"
                                >-{diffStats.deletions}</span
                            >
                        </div>
                        <div
                            class="diff-view"
                            style="font-family: 'JetBrains Mono', monospace;"
                        >
                            <table class="diff-table">
                                <tbody>
                                {#each diffResult as line}
                                    <tr class="diff-row {line.type}">
                                        <td class="diff-line-num"
                                            >{line.oldLine}</td
                                        >
                                        <td class="diff-line-num"
                                            >{line.newLine}</td
                                        >
                                        <td class="diff-line-code">
                                            <span class="diff-sign"
                                                >{line.type === "added"
                                                    ? "+"
                                                    : line.type === "removed"
                                                      ? "-"
                                                      : " "}</span
                                            >
                                            {line.text}
                                        </td>
                                    </tr>
                                {/each}
                                {#if diffResult.length === 0}
                                    <tr
                                        ><td
                                            colspan="3"
                                            style="text-align:center; padding:20px; color:#666;"
                                            >No changes detected.</td
                                        ></tr
                                    >
                                {/if}
                                </tbody>
                            </table>
                        </div>
                        <div style="margin-top: 15px;">
                            <button
                                class="btn btn-gray"
                                onclick={() => {
                                    content = selectedVersion.content;
                                    showHistory = false;
                                }}>Restore this version</button
                            >
                        </div>
                    {:else}
                        <div
                            style="padding: 40px; text-align: center; color: #888;"
                        >
                            Select a version from the left to view diff.
                        </div>
                    {/if}
                </div>
            </div>
        </div>
    </div>
{/if}

<style>
    :global(body) {
        background-color: #f5f5f5;
        margin: 0;
    }

    .cms-wrapper {
        font-family: "Manrope", sans-serif;
        max-width: 1200px;
        margin: 0 auto;
        padding: 40px 20px;
        color: #333;
    }

    /* Fullscreen specific */
    .cms-wrapper.fullscreen {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        max-width: 100%;
        padding: 0;
        margin: 0;
        z-index: 9999;
        background: #f5f5f5;
        overflow-y: auto;
    }

    .cms-wrapper.fullscreen .cms-layout {
        padding: 40px;
        max-width: 1200px;
        margin: 0 auto;
        height: 100%;
    }

    .cms-wrapper.fullscreen .editor-container {
        height: calc(100vh - 250px);
        display: flex;
        flex-direction: column;
    }

    .cms-wrapper.fullscreen .content-textarea,
    .cms-wrapper.fullscreen .preview-box {
        flex: 1;
        height: 100%;
    }

    /* Layout */
    .cms-layout {
        display: flex;
        gap: 30px;
        align-items: flex-start;
    }

    .cms-main {
        flex: 1;
        min-width: 0;
    }

    .cms-sidebar {
        width: 120px;
        flex-shrink: 0;
        margin-top: 60px; /* Align roughly with the editor input */
    }

    /* Breadcrumbs */
    .breadcrumbs {
        margin-bottom: 30px;
    }

    .breadcrumbs h2 {
        margin: 0;
        font-size: 24px;
        font-weight: 400;
        color: #444;
    }

    .breadcrumbs .home-link {
        color: inherit;
        text-decoration: none;
        font-weight: 500;
    }

    .breadcrumbs .home-link i {
        font-size: 18px;
        margin-right: 6px;
    }

    .breadcrumbs .light {
        color: #6c757d;
    }

    /* Buttons */
    .header-actions {
        display: flex;
        flex-direction: column;
        gap: 10px;
        width: 100%;
    }

    .btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 10px 16px;
        border: none;
        border-radius: 4px;
        font-family: "Manrope", sans-serif;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: opacity 0.2s;
        text-decoration: none;
        width: 100%;
    }

    .btn:hover {
        opacity: 0.9;
    }

    .btn-green {
        background-color: #7bc143;
        color: white;
    }

    .btn-gray {
        background-color: #9ea3a8;
        color: white;
    }

    .btn-gray-sm {
        background-color: #9ea3a8;
        color: white;
        padding: 6px 12px;
        font-size: 13px;
        width: auto;
    }

    /* Input Fields */
    .field-group {
        margin-bottom: 20px;
    }

    .field-group label {
        display: block;
        font-size: 13px;
        font-weight: 600;
        color: #666;
        margin-bottom: 5px;
    }

    .info-icon {
        color: #555;
        font-size: 12px;
        margin-left: 4px;
    }

    .input-path {
        width: 100%;
        background: transparent;
        border: none;
        border-bottom: 1px solid #ccc;
        padding: 5px 0;
        font-family: "Manrope", sans-serif;
        font-size: 15px;
        color: #333;
        outline: none;
        box-sizing: border-box;
    }

    .input-title {
        width: 100%;
        background: transparent;
        border: none;
        border-bottom: 2px solid #f3c200;
        padding: 5px 0;
        font-family: "Manrope", sans-serif;
        font-size: 42px;
        font-weight: 400;
        color: #222;
        outline: none;
        box-sizing: border-box;
    }

    /* Editor Box */
    .editor-container {
        background: white;
        border: 1px solid #ddd;
        border-radius: 4px;
        margin-top: 30px;
        margin-bottom: 40px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
    }

    .toolbar {
        display: flex;
        padding: 8px 12px;
        border-bottom: 1px solid #ddd;
        background: #fafafa;
        align-items: center;
        gap: 2px;
        flex-wrap: wrap;
    }

    .tool-btn {
        background: transparent;
        border: none;
        color: #666;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 3px;
        cursor: pointer;
        font-size: 14px;
        transition: background 0.1s;
    }

    .tool-btn:hover,
    .tool-btn.active {
        background: #eee;
        color: #333;
    }

    .divider {
        width: 1px;
        height: 20px;
        background: #ddd;
        margin: 0 8px;
    }

    .content-textarea {
        width: 100%;
        min-height: 400px;
        background: transparent;
        border: none;
        padding: 20px;
        font-family: "Manrope", sans-serif;
        font-size: 15px;
        line-height: 1.6;
        color: #333;
        resize: vertical;
        box-sizing: border-box;
        outline: none;
    }

    .preview-box {
        min-height: 400px;
        padding: 20px;
        font-family: "Manrope", sans-serif;
        line-height: 1.6;
        overflow-wrap: break-word;
        word-wrap: break-word;
        word-break: break-word;
        overflow-x: auto;
        box-sizing: border-box;
    }

    :global(.preview-box img),
    :global(.preview-box video) {
        max-width: 100%;
        height: auto;
        display: block;
    }

    :global(.preview-box pre),
    :global(.preview-box code) {
        max-width: 100%;
        overflow-x: auto;
    }

    :global(.preview-box table) {
        max-width: 100%;
        overflow-x: auto;
        display: block;
        border-collapse: collapse;
    }

    :global(.preview-box table th),
    :global(.preview-box table td) {
        border: 1px solid #ddd;
        padding: 8px 12px;
    }

    /* Metadata Section */
    .metadata-section {
        margin-top: 40px;
    }

    .draggable-container {
        display: flex;
        flex-direction: column;
    }

    /* Modals */
    .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 100000;
    }

    .modal-content {
        background: white;
        border-radius: 8px;
        width: 900px;
        max-width: 95vw;
        height: 80vh;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }

    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 15px 20px;
        border-bottom: 1px solid #eee;
    }

    .modal-header h3 {
        margin: 0;
        font-size: 18px;
        color: #333;
    }

    .history-layout {
        display: flex;
        flex: 1;
        overflow: hidden;
    }

    .history-sidebar {
        width: 250px;
        border-right: 1px solid #eee;
        overflow-y: auto;
        background: #fafafa;
    }

    .version-list {
        list-style: none;
        padding: 0;
        margin: 0;
    }

    .version-list li {
        border-bottom: 1px solid #eee;
    }

    .version-list li.active {
        background: #eef5ff;
    }

    .version-btn {
        width: 100%;
        text-align: left;
        background: transparent;
        border: none;
        padding: 15px;
        cursor: pointer;
        display: block;
        font-family: "Manrope", sans-serif;
    }

    .v-date {
        font-size: 13px;
        font-weight: 600;
        color: #333;
        margin-bottom: 4px;
    }
    .v-author {
        font-size: 12px;
        color: #666;
    }

    .history-main {
        flex: 1;
        display: flex;
        flex-direction: column;
        padding: 20px;
        overflow-y: auto;
    }

    .diff-header {
        font-size: 14px;
        margin-bottom: 15px;
        padding-bottom: 10px;
        border-bottom: 1px solid #eee;
        color: #444;
    }

    .diff-view {
        flex: 1;
        background: #fff;
        border: 1px solid #ddd;
        border-radius: 4px;
        overflow-y: auto;
    }

    .diff-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
        line-height: 1.5;
    }

    .diff-row.added {
        background-color: #e6ffed;
    }

    .diff-row.removed {
        background-color: #ffeef0;
    }

    .diff-line-num {
        width: 40px;
        min-width: 40px;
        color: #6e7781;
        text-align: right;
        padding: 2px 10px;
        user-select: none;
        border-right: 1px solid #eee;
    }

    .diff-row.added .diff-line-num {
        background-color: #ccffd8;
        border-color: #b4f0c4;
    }

    .diff-row.removed .diff-line-num {
        background-color: #ffdce0;
        border-color: #ffc9d0;
    }

    .diff-line-code {
        padding: 2px 10px 2px 5px;
        word-break: break-all;
        white-space: pre-wrap;
        position: relative;
    }

    .diff-sign {
        display: inline-block;
        width: 15px;
        user-select: none;
        color: #666;
    }

    .diff-row.added .diff-line-code {
        color: #22863a;
    }
    .diff-row.removed .diff-line-code {
        color: #cb2431;
    }

    .meta-card {
        border: 1px solid #e5e5e5;
        border-radius: 4px;
        background: #fbfbfb;
        margin-bottom: 15px;
        padding: 15px;
    }

    .meta-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
    }

    .meta-key {
        background: white;
        border: 1px solid #e5e5e5;
        padding: 6px 12px;
        border-radius: 3px;
        font-weight: 700;
        font-size: 14px;
        color: #333;
    }

    .chevron {
        color: #ccc;
        font-size: 14px;
    }

    .meta-body {
        width: 100%;
    }

    .meta-input {
        width: 100%;
        background: white;
        border: 1px solid #e5e5e5;
        border-radius: 3px;
        padding: 10px 12px;
        font-family: "Manrope", sans-serif;
        font-size: 14px;
        box-sizing: border-box;
        outline: none;
        resize: vertical;
    }

    .meta-input:focus {
        border-color: #ccc;
    }

    .meta-key-edit {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .index {
        color: #f38a00;
        font-weight: 600;
        font-size: 14px;
    }

    .drag-icon {
        color: #ccc;
        cursor: grab;
    }

    .drag-icon:active {
        cursor: grabbing;
    }

    .meta-input-inline {
        background: white;
        border: 1px solid #e5e5e5;
        padding: 6px 12px;
        border-radius: 3px;
        font-weight: 600;
        font-size: 14px;
        font-family: "Manrope", sans-serif;
        outline: none;
        box-sizing: border-box;
    }

    .btn-icon {
        background: transparent;
        border: none;
        color: #ccc;
        cursor: pointer;
    }

    .btn-icon:hover {
        color: #ff4d4f;
    }

    .checkbox-group {
        display: flex;
        gap: 20px;
        padding: 5px 0;
    }

    .checkbox-group label {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
        cursor: pointer;
    }

    .new-meta-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 20px;
    }

    .btn-new-meta {
        background: transparent;
        border: none;
        color: #f38a00;
        font-weight: 700;
        font-size: 15px;
        font-family: "Manrope", sans-serif;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .btn-new-meta:hover {
        text-decoration: underline;
    }

    .special-keys {
        font-size: 13px;
        color: #555;
        display: flex;
        align-items: center;
        gap: 5px;
    }

    /* Dark Mode Support */
    :global(body.dark) {
        background-color: #121212 !important;
    }
    :global(body.dark) .cms-wrapper {
        color: #eee;
    }
    :global(body.dark) .cms-wrapper.fullscreen {
        background: #121212;
    }
    :global(body.dark) .breadcrumbs h2 {
        color: #eee;
    }
    :global(body.dark) .breadcrumbs .light {
        color: #aaa;
    }
    :global(body.dark) .input-path {
        color: #eee;
        border-color: #444;
    }
    :global(body.dark) .input-title {
        color: #fff;
        border-color: #f38a00;
    }
    :global(body.dark) .editor-container {
        background: #1e1e1e;
        border-color: #333;
    }
    :global(body.dark) .toolbar {
        background: #252525;
        border-color: #333;
    }
    :global(body.dark) .tool-btn {
        color: #aaa;
    }
    :global(body.dark) .tool-btn:hover,
    :global(body.dark) .tool-btn.active {
        background: #333;
        color: #fff;
    }
    :global(body.dark) .divider {
        background: #444;
    }
    :global(body.dark) .content-textarea {
        color: #eee;
    }
    :global(body.dark) .preview-box table th,
    :global(body.dark) .preview-box table td {
        border-color: #444;
    }

    :global(body.dark) .meta-card {
        background: #1a1a1a;
        border-color: #333;
    }
    :global(body.dark) .meta-key {
        background: #252525;
        border-color: #333;
        color: #eee;
    }
    :global(body.dark) .meta-input,
    :global(body.dark) .meta-input-inline {
        background: #252525;
        border-color: #333;
        color: #eee;
    }
    :global(body.dark) .meta-input:focus,
    :global(body.dark) .meta-input-inline:focus {
        border-color: #555;
    }
    :global(body.dark) .btn-gray {
        background-color: #444;
        color: #eee;
        border-color: #444;
    }
    :global(body.dark) .btn-gray:hover {
        background-color: #555;
    }
    :global(body.dark) .btn-gray-sm {
        background-color: #444;
        color: #eee;
        border-color: #444;
    }
    :global(body.dark) .btn-gray-sm:hover {
        background-color: #555;
    }
    :global(body.dark) .cms-sidebar {
        background: #1a1a1a;
    }

    /* Modal Dark Mode */
    :global(body.dark) .modal-content {
        background: #1a1a1a;
        color: #eee;
    }
    :global(body.dark) .modal-header {
        border-bottom-color: #333;
    }
    :global(body.dark) .modal-header h3 {
        color: #eee;
    }
    :global(body.dark) .history-sidebar {
        background: #1e1e1e;
        border-right-color: #333;
    }
    :global(body.dark) .version-list li {
        border-bottom-color: #333;
    }
    :global(body.dark) .version-list li.active {
        background: #2a2a2a;
    }
    :global(body.dark) .v-date {
        color: #eee;
    }
    :global(body.dark) .v-author {
        color: #aaa;
    }
    :global(body.dark) .diff-header {
        border-bottom-color: #333;
        color: #ccc;
    }
    :global(body.dark) .diff-view {
        background: #121212;
        border-color: #333;
    }
    :global(body.dark) .diff-line-num {
        color: #6e7781;
        border-right-color: #333;
    }
    :global(body.dark) .diff-row.added {
        background-color: rgba(46, 160, 67, 0.15);
    }
    :global(body.dark) .diff-row.added .diff-line-num {
        background-color: rgba(46, 160, 67, 0.3);
        border-color: rgba(46, 160, 67, 0.4);
    }
    :global(body.dark) .diff-row.added .diff-line-code {
        color: #3fb950;
    }
    :global(body.dark) .diff-row.removed {
        background-color: rgba(248, 81, 73, 0.15);
    }
    :global(body.dark) .diff-row.removed .diff-line-num {
        background-color: rgba(248, 81, 73, 0.3);
        border-color: rgba(248, 81, 73, 0.4);
    }
    :global(body.dark) .diff-row.removed .diff-line-code {
        color: #f85149;
    }

    /* Mobile Responsive */
    @media (max-width: 768px) {
        .cms-layout {
            flex-direction: column;
            gap: 20px;
        }
        .cms-sidebar {
            width: 100%;
            margin-top: 10px;
            padding-bottom: 30px;
        }
        .header-actions {
            flex-direction: row;
            flex-wrap: wrap;
        }
        .header-actions .btn {
            flex: 1 1 calc(50% - 10px);
        }
        .cms-wrapper {
            padding: 20px 15px;
        }
        .modal-content {
            width: 100%;
            height: 95vh;
            border-radius: 0;
        }
        .history-layout {
            flex-direction: column;
        }
        .history-sidebar {
            width: 100%;
            height: 35%;
            border-right: none;
            border-bottom: 1px solid #eee;
        }
        :global(body.dark) .history-sidebar {
            border-bottom-color: #333;
        }
        .history-main {
            height: 65%;
            padding: 15px;
        }
        .meta-card {
            padding: 15px;
        }
        .toolbar {
            flex-wrap: wrap;
        }
    }
</style>
