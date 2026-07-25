<script>
  import { smoothCorners } from "@lisse/svelte";
    import { onMount, tick } from "svelte";
    import { page } from "$app/stores";
    import { Marked } from "marked";
    import { diffLines } from "diff";
    import { initializeArtifacts } from "$lib/utils/postBaseLogic.js";

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
    /** @type {number | null} */
    let activePresetMenu = null;
    /** @type {{ id: number, message: string, type: string }[]} */
    let toasts = [];
    let toastId = 0;
    /** @type {{ title: string, message: string, confirmText: string, cancelText: string, danger: boolean, resolve: (value: boolean) => void } | null} */
    let confirmToast = null;

    /** @param {string} message @param {string} [type] @param {number} [timeout] */
    function showToast(message, type = "info", timeout = 3500) {
        const toast = { id: ++toastId, message, type };
        toasts = [...toasts, toast];
        if (timeout > 0) {
            setTimeout(() => dismissToast(toast.id), timeout);
        }
    }

    /** @param {number} id */
    function dismissToast(id) {
        toasts = toasts.filter((toast) => toast.id !== id);
    }

    /**
     * @param {{ title: string, message: string, confirmText?: string, cancelText?: string, danger?: boolean }} options
     */
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

    function defaultAvatar() {
        return "/assets/img/default-avatar.svg";
    }

    /** @typedef {{ name: string, avatar: string }} HistoryAuthor */

    /** @param {any} value */
    function parseAuthorList(value) {
        if (!value) return [];
        if (Array.isArray(value)) return value;
        if (typeof value === "object") return [value];
        const raw = String(value).trim();
        if (!raw) return [];
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed;
            if (parsed && typeof parsed === "object") return [parsed];
        } catch {
            // Custom tags often use comma-separated names.
        }
        return raw
            .split(",")
            .map((name) => name.trim())
            .filter(Boolean);
    }

    /** @param {any} author */
    function normalizeAuthor(author) {
        if (!author) return null;
        if (typeof author === "string") {
            return { name: author, avatar: defaultAvatar() };
        }
        const name =
            author.displayName ||
            author.name ||
            author.username ||
            author.title ||
            author.label;
        if (!name) return null;
        return {
            name,
            avatar:
                author.avatar ||
                author.profilePicture ||
                author.image ||
                author.photo ||
                defaultAvatar(),
        };
    }

    /** @param {HistoryAuthor | null} author @returns {author is HistoryAuthor} */
    function isHistoryAuthor(author) {
        return Boolean(author);
    }

    /** @param {any} source */
    function getAuthors(source) {
        const metadata = source?.metadata || source || {};
        const candidates = [
            ...parseAuthorList(metadata.authors),
            ...parseAuthorList(metadata.author),
            ...parseAuthorList(metadata.editors),
            ...parseAuthorList(metadata.editor),
            ...parseAuthorList(metadata.collaborators),
            ...parseAuthorList(metadata.collaborator),
        ];

        if (metadata.author_name || metadata.author_avatar) {
            candidates.unshift({
                name: metadata.author_name,
                avatar: metadata.author_avatar,
            });
        }

        if (source?.saved_by_name || source?.saved_by_avatar) {
            candidates.unshift({
                name: source.saved_by_display_name || source.saved_by_name,
                avatar: source.saved_by_avatar,
            });
        }

        const seen = new Set();
        return candidates
            .map(normalizeAuthor)
            .filter(isHistoryAuthor)
            .filter((author) => {
                const key = author.name.toLowerCase();
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
    }

    /** @param {any} version */
    function versionAuthors(version) {
        const authors = getAuthors(version);
        if (authors.length) return authors;
        const u = data.user;
        const fallbackName =
            u?.displayName || u?.username || u?.name || "Materio";
        const fallbackAvatar =
            u?.avatar || u?.profilePicture || defaultAvatar();
        return [{ name: fallbackName, avatar: fallbackAvatar }];
    }

    /** @param {HistoryAuthor[]} authors */
    function authorNames(authors) {
        return authors.map((author) => author.name).join(", ");
    }

    /** @param {string} key */
    function isAuthorMetadataKey(key) {
        return [
            "authors",
            "author",
            "editors",
            "editor",
            "collaborators",
            "collaborator",
        ].includes(key.trim().toLowerCase());
    }

    /** @param {string} value */
    function editableAuthors(value) {
        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) {
                const mapped = parsed.map((a) => ({
                    name: a.displayName || a.name || "",
                    avatar: a.avatar || "",
                }));
                if (mapped.length) return mapped;
            }
        } catch (e) {
            // Fallback for legacy formats
        }

        const authors = parseAuthorList(value)
            .map(normalizeAuthor)
            .filter(isHistoryAuthor);
        return authors.length ? authors : [{ name: "", avatar: "" }];
    }

    /** @param {HistoryAuthor[]} authors */
    function serializeAuthors(authors) {
        const cleanAuthors = authors.map((author) => ({
            displayName: (author.name || "").trim(),
            avatar: (author.avatar || "").trim(),
        }));
        // DO NOT filter blanks here, otherwise the "Add author" button can't append a blank row!
        // We will clean them up in savePost() instead.
        return JSON.stringify(cleanAuthors, null, 2);
    }

    /**
     * @param {number} fieldIndex
     * @param {number} authorIndex
     * @param {"name" | "avatar"} field
     * @param {string} value
     */
    function updateAuthorMetadataField(fieldIndex, authorIndex, field, value) {
        const authors = editableAuthors(metadataArray[fieldIndex].value);
        authors[authorIndex] = { ...authors[authorIndex], [field]: value };
        metadataArray[fieldIndex].value = serializeAuthors(authors);
        metadataArray = [...metadataArray];
    }

    /** @param {number} fieldIndex */
    function addAuthorMetadataRow(fieldIndex) {
        const authors = editableAuthors(metadataArray[fieldIndex].value);
        metadataArray[fieldIndex].value = serializeAuthors([
            ...authors,
            { name: "", avatar: "" },
        ]);
        metadataArray = [...metadataArray];
    }

    /** @param {number} fieldIndex @param {number} authorIndex */
    function removeAuthorMetadataRow(fieldIndex, authorIndex) {
        const authors = editableAuthors(metadataArray[fieldIndex].value).filter(
            (_, index) => index !== authorIndex,
        );
        metadataArray[fieldIndex].value = serializeAuthors(authors);
        metadataArray = [...metadataArray];
    }

    /**
     * @param {number} fieldIndex
     * @param {string} type
     */
    function addPresetAuthor(fieldIndex, type) {
        if (!type) return;
        const authors = editableAuthors(metadataArray[fieldIndex].value);
        let preset = { name: "", avatar: "" };

        if (type === "jinansh") {
            preset = {
                name:
                    data.user?.displayName ||
                    data.user?.name ||
                    data.user?.username ||
                    "Jinansh",
                avatar:
                    data.user?.avatar ||
                    data.user?.profilePicture ||
                    "/assets/img/authors/jinansh.png",
            };
        } else if (type === "materio") {
            preset = {
                name: "Materio",
                avatar: "/assets/img/a8f76d19-64b9-4183-90c1-ecb1f7d3f7c2.webp",
            };
        }

        // If there is only one author and it's empty, replace it rather than appending
        if (authors.length === 1 && !authors[0].name && !authors[0].avatar) {
            metadataArray[fieldIndex].value = serializeAuthors([preset]);
        } else {
            metadataArray[fieldIndex].value = serializeAuthors([
                ...authors,
                preset,
            ]);
        }
        metadataArray = [...metadataArray];
    }

    $: historyAuthors = (() => {
        const seen = new Set();
        const all = [
            ...getAuthors(post),
            ...versions.flatMap((version) => getAuthors(version)),
        ];
        return all.filter((author) => {
            const key = author.name.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    })();

    /** @param {DragEvent} e */
    async function handleFileDrop(e) {
        e.preventDefault();
        const files = e.dataTransfer?.files;
        if (files && files.length) {
            for (const file of files) {
                await uploadFile(file);
            }
        }
    }

    /**
     * Try to extract an image/gif URL from HTML clipboard data.
     * The Windows emoji picker and GBoard embed the Tenor GIF URL
     * inside an `<img src="...">` tag in the text/html payload.
     * @param {DataTransfer | null | undefined} dt
     * @returns {string | null}
     */
    function extractEmbeddedMediaUrl(dt) {
        if (!dt) return null;
        try {
            const html = dt.getData("text/html");
            if (html) {
                const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
                if (m && m[1] && /^https?:\/\//.test(m[1])) return m[1];
            }
            const uri = dt.getData("text/uri-list");
            if (uri && /^https?:\/\//.test(uri.trim())) {
                const url = uri.trim().split("\n")[0];
                if (/\.(gif|webp|png|jpe?g|mp4|webm)/i.test(url)) return url;
            }
        } catch {
            // getData may throw in some contexts
        }
        return null;
    }

    /** @param {ClipboardEvent} e */
    async function handlePaste(e) {
        // 1. Try to grab the original media URL (e.g. Tenor GIF)
        const url = extractEmbeddedMediaUrl(e.clipboardData);
        if (url) {
            e.preventDefault();
            insertAtCursor(`\n![](${url})\n`);
            return;
        }
        // 2. Fall back to file upload
        const items = e.clipboardData?.items;
        if (!items) return;
        for (const item of items) {
            if (
                item.kind === "file" &&
                (item.type.startsWith("image/") ||
                    item.type.startsWith("video/"))
            ) {
                e.preventDefault();
                const file = item.getAsFile();
                if (file) await uploadFile(file);
                return;
            }
        }
    }

    /** @param {InputEvent} e */
    async function handleBeforeInput(e) {
        if (
            e.inputType !== "insertFromPaste" &&
            e.inputType !== "insertFromDrop"
        )
            return;
        const dt = e.dataTransfer;
        if (!dt) return;
        // 1. Try to grab the original media URL (e.g. Tenor GIF)
        const url = extractEmbeddedMediaUrl(dt);
        if (url) {
            e.preventDefault();
            insertAtCursor(`\n![](${url})\n`);
            return;
        }
        // 2. Fall back to file upload
        const files = dt.files;
        if (!files || !files.length) return;
        for (const file of files) {
            if (
                file.type.startsWith("image/") ||
                file.type.startsWith("video/")
            ) {
                e.preventDefault();
                await uploadFile(file);
                return;
            }
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
            showToast("Only images and videos are allowed.", "warning");
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
                showToast("Media uploaded.", "success");
                setTimeout(() => (uploadStatus = ""), 3000);
            } else {
                showToast(result.error || "Upload failed", "error");
                uploadStatus = "";
            }
        } catch (err) {
            console.error(err);
            showToast("Upload failed", "error");
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
            showToast(
                "Only images and videos are allowed for cover.",
                "warning",
            );
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
                showToast("Cover uploaded.", "success");
            } else {
                showToast(result.error || "Upload failed", "error");
            }
        } catch (err) {
            console.error(err);
            showToast("Upload failed", "error");
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
        if (!title.trim()) {
            showToast("Title is required.", "warning");
            return;
        }

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
                let finalValue = m.value;
                // Strip completely blank authors right before saving to the DB
                if (isAuthorMetadataKey(m.key)) {
                    try {
                        const parsed = JSON.parse(finalValue);
                        if (Array.isArray(parsed)) {
                            const cleaned = parsed.filter(
                                (a) =>
                                    (a.displayName || a.name)?.trim() ||
                                    a.avatar?.trim(),
                            );
                            finalValue = JSON.stringify(cleaned);
                            // If empty, maybe don't save the field at all, or save as empty array
                        }
                    } catch (e) {}
                }
                payloadMetadata[m.key.trim()] = finalValue;
            }
        });

        const u = data.user;
        const payload = {
            id: id === "new" ? null : id,
            title,
            slug,
            content,
            metadata: {
                ...payloadMetadata,
            },
            saved_by_name: u?.username || u?.name || u?.displayName,
            saved_by_display_name: u?.displayName || u?.username || u?.name,
            saved_by_avatar: u?.avatar || u?.profilePicture,
        };

        const res = await fetch("/api/admin/posts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        const result = await res.json();
        if (result.success) {
            showToast("Saved successfully.", "success");
            if (id === "new") {
                setTimeout(() => {
                    window.location.href = `/writer/editor/${result.id}`;
                }, 500);
            }
        } else {
            showToast("Error saving: " + result.error, "error");
        }
    }

    async function deletePost() {
        if (id === "new") {
            window.location.href = "/writer";
            return;
        }
        const shouldDelete = await requestConfirmation({
            title: "Delete post?",
            message:
                "This will permanently delete this post and its version history.",
            confirmText: "Delete",
            danger: true,
        });
        if (shouldDelete) {
            const res = await fetch(`/api/admin/posts?id=${id}`, {
                method: "DELETE",
            });
            if (res.ok) {
                showToast("Deleted successfully.", "success");
                setTimeout(() => {
                    window.location.href = "/writer";
                }, 500);
            } else {
                showToast("Failed to delete.", "error");
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
            showToast("Save the post first to view history.", "warning");
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
                showToast("Failed to load history.", "error");
            }
        } catch (e) {
            console.error(e);
            showToast("Failed to load history.", "error");
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
        const month = d.toLocaleDateString("en-US", { month: "long" });
        const weekday = d.toLocaleDateString("en-US", { weekday: "long" });
        const year = d.getFullYear();
        return `${day} ${month}, ${weekday} ${year}`;
    }

    /** @param {string|Date|number} dateStr */
    function formatVersionTime(dateStr) {
        if (!dateStr) return "";
        const d = new Date(dateStr);
        return d.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
        });
    }

    let isPreviewMode = false;
    let previewHtml = "";
    let isFullscreen = false;

    async function togglePreview() {
        isPreviewMode = !isPreviewMode;
        if (isPreviewMode) {
            const customMarked = new Marked({ gfm: true, breaks: true });
            let rawContent = content || "";

            const attachmentRegex = /\[attachment:([^\]]+):([^\]:]+)\]/g;
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
                    return `<div use:smoothCorners={{ corners: { radius: 25, smoothing: 0.6 } }} class="attachment-card" data-file-path="${cleanUrl}" data-attachment-id="${rndId}">
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
                    const isCover = vparams.trim().endsWith(":cover");
                    const videoUrl = isCover
                        ? vparams.trim().slice(0, -6).trim()
                        : vparams.trim();
                    return `<div class="video-embed"><video muted loop autoplay playsinline src="${videoUrl}"></video></div>`;
                },
            );

            // Highlighter replacement
            const highlightRegex = /==([\s\S]+?)==(?:\{([^}]+)\})?/g;
            rawContent = rawContent.replace(highlightRegex, (/** @type {string} */ match, /** @type {string} */ text, /** @type {string} */ optionsStr) => {
                let attrs = 'class="custom-highlight"';
                if (optionsStr) {
                    const attrRegex = /([a-zA-Z0-9_-]+)=["']([^"']+)["']/g;
                    let attrMatch;
                    while ((attrMatch = attrRegex.exec(optionsStr)) !== null) {
                        const key = attrMatch[1];
                        const value = attrMatch[2];
                        if (['swatch', 'palette', 'style'].includes(key)) {
                            attrs += ` data-${key}="${value.replace(/"/g, '&quot;')}"`;
                        }
                    }
                }
                return `<mark ${attrs}>${text}</mark>`;
            });

            // MCQ replacement
            const mcqRegex = /\[mcq:([\s\S]+?)\]/g;
            rawContent = rawContent.replace(
                mcqRegex,
                (/** @type {string} */ match, /** @type {string} */ mcqContent) => {
                    const trimmed = mcqContent.trim();
                    let question = '';
                    /** @type {{text: string, isCorrect: boolean}[]} */
                    let options = [];

                    if (trimmed.includes('|')) {
                        const parts = trimmed.split('|').map((/** @type {string} */ p) => p.trim());
                        question = parts[0];
                        options = parts.slice(1).map((/** @type {string} */ opt) => {
                            const isCorrect = (opt.startsWith('**') && opt.endsWith('**')) ||
                                              (opt.startsWith('*') && opt.endsWith('*')) ||
                                              (opt.startsWith('_') && opt.endsWith('_'));
                            const text = opt.replace(/^(\*\*|\*|_)+|(\*\*|\*|_)+$/g, '').trim();
                            return { text, isCorrect };
                        });
                    } else {
                        const lines = trimmed.split('\n').map((/** @type {string} */ l) => l.trim()).filter(Boolean);
                        if (lines.length > 0) {
                            const optionLines = lines.filter((/** @type {string} */ l) => l.startsWith('-') || l.startsWith('*') || /^\d+\./.test(l));
                            const questionLines = lines.filter((/** @type {string} */ l) => !optionLines.includes(l));
                            
                            question = questionLines.join(' ');
                            options = optionLines.map((/** @type {string} */ opt) => {
                                const cleanOpt = opt.replace(/^([-\*]|\d+\.)\s*/, '').trim();
                                const isCorrect = (cleanOpt.startsWith('**') && cleanOpt.endsWith('**')) ||
                                                  (cleanOpt.startsWith('*') && cleanOpt.endsWith('*')) ||
                                                  (cleanOpt.startsWith('_') && cleanOpt.endsWith('_'));
                                const text = cleanOpt.replace(/^(\*\*|\*|_)+|(\*\*|\*|_)+$/g, '').trim();
                                return { text, isCorrect };
                            });
                        }
                    }

                    if (!question || options.length === 0) return match;

                    const escapeHtml = (/** @type {string} */ str) => {
                        return str
                            .replace(/&/g, '&amp;')
                            .replace(/</g, '&lt;')
                            .replace(/>/g, '&gt;')
                            .replace(/"/g, '&quot;')
                            .replace(/'/g, '&#039;');
                    };

                    const escapedQuestion = escapeHtml(question);
                    const correctIndex = options.findIndex((/** @type {any} */ opt) => opt.isCorrect);

                    const optionsHtml = options.map((/** @type {any} */ opt, /** @type {number} */ idx) => {
                        const letter = String.fromCharCode(65 + idx);
                        const escapedText = escapeHtml(opt.text);
                        const clickHandler = "(function(btn){var card=btn.closest('.mcq-card');if(card.classList.contains('answered'))return;card.classList.add('answered');var correctIdx=parseInt(card.getAttribute('data-correct-index'),10);var selectedIdx=parseInt(btn.getAttribute('data-index'),10);var isCorrect=correctIdx===selectedIdx;var btns=card.querySelectorAll('.mcq-option');btns.forEach(function(b,idx){var icon=b.querySelector('.mcq-option-icon i');if(idx===correctIdx){b.classList.add('correct');if(icon)icon.className='fa-solid fa-circle-check';}else if(idx===selectedIdx){b.classList.add('incorrect');if(icon)icon.className='fa-solid fa-circle-xmark';}});card.dispatchEvent(new CustomEvent('mcq-answer',{detail:{correct:isCorrect},bubbles:true}));})(this)";
                        
                        return `<button class="mcq-option" data-index="${idx}" onclick="${clickHandler}">` +
                            `<span class="mcq-option-letter">${letter}</span>` +
                            `<span class="mcq-option-text">${escapedText}</span>` +
                            `<span class="mcq-option-icon"><i class="fa-regular"></i></span>` +
                        `</button>`;
                    }).join('');

                    const resetHandler = "(function(btn){var card=btn.closest('.mcq-card');card.classList.remove('answered');var btns=card.querySelectorAll('.mcq-option');btns.forEach(function(b){b.classList.remove('correct','incorrect');var icon=b.querySelector('.mcq-option-icon i');if(icon)icon.className='fa-regular';});card.dispatchEvent(new CustomEvent('mcq-reset',{bubbles:true}));})(this)";

                    return `<div class="mcq-card" data-correct-index="${correctIndex}">` +
                        `<div class="mcq-header">` +
                            `<div class="mcq-question">${escapedQuestion}</div>` +
                            `<button use:smoothCorners={{ corners: { radius: 25, smoothing: 0.6 } }} class="mcq-reset-btn" onclick="${resetHandler}" title="Reset Question"><i class="fa-solid fa-rotate-left"></i></button>` +
                        `</div>` +
                        `<div class="mcq-options">${optionsHtml}</div>` +
                    `</div>`;
                }
            );

            // Cover replacement - extract cover BEFORE markdown parsing
            const coverRegex = /```(?:cover|artifact:cover)\s*\n([\s\S]*?)\n```/g;
            let coverHtml = '';
            rawContent = rawContent.replace(coverRegex, (/** @type {string} */ match, /** @type {string} */ innerContent) => {
                coverHtml = innerContent;
                return ''; // remove from body
            });

            // Artifact replacement - extract artifacts BEFORE markdown parsing to preserve HTML
            const artifactRegex = /```artifact\s*\n([\s\S]*?)\n```/g;
            /** @type {Record<string, string>} */
            const artifacts = {};
            rawContent = rawContent.replace(
                artifactRegex,
                (
                    /** @type {string} */ match,
                    /** @type {string} */ contentArtifact,
                ) => {
                    const id = Math.random().toString(36).substr(2, 9);
                    artifacts[id] = contentArtifact;
                    return `\n\n<div data-artifact-placeholder="${id}"></div>\n\n`;
                },
            );

            previewHtml = await customMarked.parse(rawContent);

            // Restore artifacts with their HTML intact, no height limits, transparent background
            Object.entries(artifacts).forEach(([id, content]) => {
                const artifactHtml = `<div class="artifact-container"><div>${content}</div></div>`;
                previewHtml = previewHtml.replace(
                    `<div data-artifact-placeholder="${id}"></div>`,
                    artifactHtml,
                );
            });

            // Append cover artifact source
            if (coverHtml) {
                previewHtml += `<div data-cover-artifact-source style="display:none;"><div class="artifact-container"><div>${coverHtml}</div></div></div>`;
            }

            await tick();
            initializeArtifacts();
        }
    }

    $: permalinkField = metadataArray.find((m) => m.key === "permalink");
    $: permalink =
        permalinkField && permalinkField.value ? permalinkField.value : null;
    $: liveUrl = permalink
        ? permalink.startsWith("/") || permalink.startsWith("http")
            ? permalink
            : `/${permalink}`
        : draft
          ? `/draft/${slug}`
          : category
            ? `/${category}/${slug}`
            : `/${slug}`;
</script>

<svelte:head>
    <title>Insightroom Writer</title>
    <link rel="icon" type="image/x-icon" href="/assets/img/room-icon-x.svg" />

    <link
        href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap"
        rel="stylesheet"
    />
</svelte:head>

<svelte:window
    onclick={() => (activePresetMenu = null)}
    onkeydown={(e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "s") {
            e.preventDefault();
            savePost();
        }
    }}
/>

<div use:smoothCorners={{ corners: { radius: 40, smoothing: 0.6 } }} class="cms-wrapper" class:fullscreen={isFullscreen}>
    <div class="cms-layout">
        <!-- Main Form Column -->
        <div class="cms-main">
            <div class="breadcrumbs">
                <h2>
                    <a href="/writer" class="home-link"
                        ><i class="fa-solid fa-house"></i> Posts</a
                    >
                    /
                    <span class="light">{liveUrl.replace(/^\/+/, "")}</span>
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
                    placeholder="Choose a home for this story."
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
                    placeholder="Every story begins with a headline."
                />
            </div>

            <!-- Editor Toolbar & Textarea -->
            <div use:smoothCorners={{ corners: { radius: 40, smoothing: 0.6 } }} class="editor-container">
                <div class="toolbar">
                    <button
 use:smoothCorners={{ corners: { radius: 25, smoothing: 0.6 } }}                        class="tool-btn"
                        onclick={() => insertFormatting("bold")}
                        title="Bold"><i class="fa-solid fa-bold"></i></button
                    >
                    <button
 use:smoothCorners={{ corners: { radius: 25, smoothing: 0.6 } }}                        class="tool-btn"
                        onclick={() => insertFormatting("italic")}
                        title="Italic"
                        ><i class="fa-solid fa-italic"></i></button
                    >
                    <button
 use:smoothCorners={{ corners: { radius: 25, smoothing: 0.6 } }}                        class="tool-btn"
                        onclick={() => insertFormatting("heading")}
                        title="Heading"
                        ><i class="fa-solid fa-heading"></i></button
                    >

                    <span class="divider"></span>

                    <button
 use:smoothCorners={{ corners: { radius: 25, smoothing: 0.6 } }}                        class="tool-btn"
                        onclick={() => insertFormatting("code")}
                        title="Code"><i class="fa-solid fa-code"></i></button
                    >
                    <button
 use:smoothCorners={{ corners: { radius: 25, smoothing: 0.6 } }}                        class="tool-btn"
                        onclick={() => insertFormatting("quote")}
                        title="Quote"
                        ><i class="fa-solid fa-quote-left"></i></button
                    >
                    <button
 use:smoothCorners={{ corners: { radius: 25, smoothing: 0.6 } }}                        class="tool-btn"
                        onclick={() => insertFormatting("list-ul")}
                        title="Bulleted List"
                        ><i class="fa-solid fa-list-ul"></i></button
                    >
                    <button
 use:smoothCorners={{ corners: { radius: 25, smoothing: 0.6 } }}                        class="tool-btn"
                        onclick={() => insertFormatting("list-ol")}
                        title="Numbered List"
                        ><i class="fa-solid fa-list-ol"></i></button
                    >

                    <span class="divider"></span>

                    <button
 use:smoothCorners={{ corners: { radius: 25, smoothing: 0.6 } }}                        class="tool-btn"
                        onclick={() => insertFormatting("link")}
                        title="Link"
                        ><i class="fa-regular fa-link-simple"></i></button
                    >
                    <label
 use:smoothCorners={{ corners: { radius: 25, smoothing: 0.6 } }}                        class="tool-btn"
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
 use:smoothCorners={{ corners: { radius: 25, smoothing: 0.6 } }}                        class="tool-btn"
                        onclick={() => insertFormatting("table")}
                        title="Table"><i class="fa-solid fa-table"></i></button
                    >

                    <span class="divider"></span>

                    <button
 use:smoothCorners={{ corners: { radius: 25, smoothing: 0.6 } }}                        class="tool-btn {isPreviewMode ? 'active' : ''}"
                        onclick={togglePreview}
                        title="Preview"
                        ><i class="fa-regular fa-eye"></i></button
                    >
                    <button
 use:smoothCorners={{ corners: { radius: 25, smoothing: 0.6 } }}                        class="tool-btn"
                        onclick={() => (isFullscreen = !isFullscreen)}
                        title="Fullscreen"
                        ><i class="fa-solid fa-expand"></i></button
                    >
                    <button use:smoothCorners={{ corners: { radius: 25, smoothing: 0.6 } }} class="tool-btn" onclick={savePost} title="Save"
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
                        <div id="post-cover-target" style="margin-bottom: 1.5rem; display: none;"></div>
                        {@html previewHtml}
                    </div>
                {:else}
                    <textarea
                        class="content-textarea"
                        bind:this={textareaEl}
                        bind:value={content}
                        ondrop={handleFileDrop}
                        ondragover={(e) => e.preventDefault()}
                        onpaste={handlePaste}
                        onbeforeinput={handleBeforeInput}
                    ></textarea>
                {/if}
            </div>

            <!-- Metadata Section Below Editor -->
            <div class="metadata-section">
                <div use:smoothCorners={{ corners: { radius: 25, smoothing: 0.6 } }} class="meta-card">
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

                <div use:smoothCorners={{ corners: { radius: 25, smoothing: 0.6 } }} class="meta-card">
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
 use:smoothCorners={{ corners: { radius: 25, smoothing: 0.6 } }}                            type="button"
                            class="btn btn-gray-sm"
                            style="margin: 0;"
                            onclick={setDateToNow}
                            title="Set to current time"
                        >
                            <i class="fa-solid fa-clock"></i> Now
                        </button>
                    </div>
                </div>

                <div use:smoothCorners={{ corners: { radius: 25, smoothing: 0.6 } }} class="meta-card">
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

                <div use:smoothCorners={{ corners: { radius: 25, smoothing: 0.6 } }} class="meta-card">
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

                <div use:smoothCorners={{ corners: { radius: 25, smoothing: 0.6 } }} class="meta-card">
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

                <div use:smoothCorners={{ corners: { radius: 25, smoothing: 0.6 } }} class="meta-card">
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
 use:smoothCorners={{ corners: { radius: 25, smoothing: 0.6 } }}                                class="btn-new-meta"
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
 use:smoothCorners={{ corners: { radius: 25, smoothing: 0.6 } }}                            class="meta-card"
                            draggable="true"
                            ondragstart={(/** @type {DragEvent} */ e) => handleDragStart(e, i)}
                            ondragover={(/** @type {DragEvent} */ e) => handleDragOver(e, i)}
                            ondrop={(/** @type {DragEvent} */ e) => handleDrop(e, i)}
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
 use:smoothCorners={{ corners: { radius: 25, smoothing: 0.6 } }}                                        class="btn-icon"
                                        onclick={() => removeMetadataField(i)}
                                        aria-label="Remove field"
                                        ><i class="fa-solid fa-xmark"
                                        ></i></button
                                    >
                                </div>
                                <i class="fa-solid fa-chevron-down chevron"></i>
                            </div>
                            <div class="meta-body">
                                {#if isAuthorMetadataKey(item.key)}
                                    <div class="author-field-editor">
                                        {#each editableAuthors(item.value) as author, authorIndex}
                                            <div class="author-field-row">
                                                <input
                                                    type="text"
                                                    value={author.name}
                                                    class="meta-input"
                                                    placeholder="Display name"
                                                    aria-label="Author display name"
                                                    oninput={(e) =>
                                                        updateAuthorMetadataField(
                                                            i,
                                                            authorIndex,
                                                            "name",
                                                            e.currentTarget
                                                                .value,
                                                        )}
                                                />
                                                <input
                                                    type="text"
                                                    value={author.avatar}
                                                    class="meta-input"
                                                    placeholder="Avatar URL"
                                                    aria-label="Author avatar URL"
                                                    oninput={(e) =>
                                                        updateAuthorMetadataField(
                                                            i,
                                                            authorIndex,
                                                            "avatar",
                                                            e.currentTarget
                                                                .value,
                                                        )}
                                                />
                                                <button
 use:smoothCorners={{ corners: { radius: 25, smoothing: 0.6 } }}                                                    class="btn-icon"
                                                    onclick={() =>
                                                        removeAuthorMetadataRow(
                                                            i,
                                                            authorIndex,
                                                        )}
                                                    aria-label="Remove author"
                                                >
                                                    <i class="fa-solid fa-xmark"
                                                    ></i>
                                                </button>
                                            </div>
                                        {/each}
                                        <div
                                            class="author-actions"
                                            style="display: flex; gap: 8px; margin-top: 10px;"
                                        >
                                            <button
 use:smoothCorners={{ corners: { radius: 25, smoothing: 0.6 } }}                                                class="btn-new-meta"
                                                onclick={() =>
                                                    addAuthorMetadataRow(i)}
                                            >
                                                <i
                                                    class="fa-solid fa-circle-plus"
                                                ></i> Add author
                                            </button>
                                            <div
                                                class="preset-dropdown-container"
                                                style="position: relative;"
                                            >
                                                <button
 use:smoothCorners={{ corners: { radius: 25, smoothing: 0.6 } }}                                                    class="btn-new-meta"
                                                    onclick={(/** @type {MouseEvent} */ e) => {
                                                        e.stopPropagation();
                                                        activePresetMenu =
                                                            activePresetMenu ===
                                                            i
                                                                ? null
                                                                : i;
                                                    }}
                                                >
                                                    <i
                                                        class="fa-solid fa-chevron-down"
                                                    ></i> Select preset
                                                </button>
                                                <div
                                                    class="popup-menu profile-menu"
                                                    class:show={activePresetMenu ===
                                                        i}
                                                    style="bottom: auto; top: calc(100% + 8px); left: 0; "
                                                >
                                                    <button
                                                        class="menu-item"
                                                        onclick={() => {
                                                            addPresetAuthor(
                                                                i,
                                                                "jinansh",
                                                            );
                                                            activePresetMenu =
                                                                null;
                                                        }}
                                                    >
                                                        <img
                                                            src={data.user
                                                                ?.avatar ||
                                                                data.user
                                                                    ?.profilePicture ||
                                                                "/assets/img/authors/jinansh.png"}
                                                            alt="Jinansh"
                                                            class="profile-avatar"
                                                            style="width: 20px; height: 20px; border-radius: 50%; object-fit: cover;"
                                                        />
                                                        {data.user
                                                            ?.displayName ||
                                                            data.user
                                                                ?.username ||
                                                            data.user?.name ||
                                                            "Jinansh"}
                                                    </button>
                                                    <button
                                                        class="menu-item"
                                                        onclick={() => {
                                                            addPresetAuthor(
                                                                i,
                                                                "materio",
                                                            );
                                                            activePresetMenu =
                                                                null;
                                                        }}
                                                    >
                                                        <img
                                                            src="/assets/img/a8f76d19-64b9-4183-90c1-ecb1f7d3f7c2.webp"
                                                            alt="Materio"
                                                            class="profile-avatar"
                                                            style="width: 20px; height: 20px; border-radius: 50%; object-fit: cover;"
                                                        />
                                                        Materio
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                {:else}
                                    <input
                                        type="text"
                                        bind:value={item.value}
                                        class="meta-input"
                                        aria-label="Field value"
                                    />
                                {/if}
                            </div>
                        </div>
                    {/each}
                </div>

                <div class="new-meta-row">
                    <button use:smoothCorners={{ corners: { radius: 25, smoothing: 0.6 } }} class="btn-new-meta" onclick={addMetadataField}>
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
                <button use:smoothCorners={{ corners: { radius: 25, smoothing: 0.6 } }} class="btn btn-green" onclick={savePost}
                    ><i class="fa-regular fa-floppy-disk"></i> Save</button
                >
                <button use:smoothCorners={{ corners: { radius: 25, smoothing: 0.6 } }} class="btn btn-gray" onclick={togglePreview}
                    ><i
                        class="fa-regular {isPreviewMode
                            ? 'fa-pen-to-square'
                            : 'fa-eye'}"
                    ></i>
                    {isPreviewMode ? "Edit" : "Preview"}</button
                >
                <button
 use:smoothCorners={{ corners: { radius: 25, smoothing: 0.6 } }}                    class="btn btn-gray"
                    onclick={() => window.open(liveUrl, "_blank")}
                    ><i class="fa-solid fa-arrow-up-right-from-square"></i> Live</button
                >
                <button use:smoothCorners={{ corners: { radius: 25, smoothing: 0.6 } }} class="btn btn-gray" onclick={viewHistory}
                    ><i class="fa-solid fa-clock-rotate-left"></i> History</button
                >
                <button use:smoothCorners={{ corners: { radius: 25, smoothing: 0.6 } }} class="btn btn-gray" onclick={deletePost}
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
 use:smoothCorners={{ corners: { radius: 40, smoothing: 0.6 } }}            class="modal-content history-modal"
            onclick={(/** @type {MouseEvent} */ e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            tabindex="-1"
            aria-label="Page History"
        >
            <div class="modal-header">
                <h3>Page History</h3>
                <button
 use:smoothCorners={{ corners: { radius: 25, smoothing: 0.6 } }}                    class="btn-icon"
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
                                {@const authors = versionAuthors(v)}
                                <li class:active={selectedVersion === v}>
                                    <button
                                        class="version-btn"
                                        onclick={() => compareVersion(v)}
                                        aria-label="Compare with version from {new Date(
                                            v.version_saved_at,
                                        ).toLocaleString()}"
                                    >
                                        <div class="v-date">
                                            {formatVersionDate(
                                                v.version_saved_at,
                                            )}
                                        </div>
                                        <div class="v-author">
                                            <span
                                                >{formatVersionTime(
                                                    v.version_saved_at,
                                                )} -</span
                                            >
                                            {#if authors.length > 1}
                                                <span
                                                    class="author-stack mini"
                                                    aria-label="Authors"
                                                >
                                                    {#each authors.slice(0, 3) as author}
                                                        <img
                                                            src={author.avatar}
                                                            alt={author.name}
                                                            class="history-avatar stacked"
                                                        />
                                                    {/each}
                                                </span>
                                                <span
                                                    >{authorNames(
                                                        authors,
                                                    )}</span
                                                >
                                            {:else}
                                                <img
                                                    src={authors[0].avatar}
                                                    alt={authors[0].name}
                                                    class="history-avatar"
                                                />
                                                <span>{authors[0].name}</span>
                                            {/if}
                                        </div>
                                    </button>
                                </li>
                            {/each}
                        </ul>
                        {#if historyAuthors.length > 1}
                            <div class="history-authors">
                                <div class="history-authors-label">
                                    {authorNames(historyAuthors)}
                                </div>
                                <div class="author-stack">
                                    {#each historyAuthors.slice(0, 5) as author}
                                        <img
                                            src={author.avatar}
                                            alt={author.name}
                                            title={author.name}
                                            class="history-avatar large stacked"
                                        />
                                    {/each}
                                </div>
                            </div>
                        {/if}
                    {/if}
                </div>
                <div
                    class="history-main"
                    style="font-family: var(--font-primary, 'PP Mori', sans-serif);"
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
                                                        : line.type ===
                                                            "removed"
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
 use:smoothCorners={{ corners: { radius: 25, smoothing: 0.6 } }}                                class="btn btn-gray"
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
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        border-radius: var(--squircle-inner, 25px);
        font-family: var(--font-primary, "PP Mori", sans-serif);
        font-weight: 700;
        font-size: 14px;
        padding: 10px 20px;
        cursor: pointer;
        border: none;
        transition: all 0.2s ease;
        text-decoration: none;
    }

    .btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    }

    .btn-orange {
        background: var(--brand-orange, #ff5400);
        color: white;
    }

    .btn-green {
        background: var(--pastel-green);
        color: #1b5e20;
        border: 1px solid #c8e6c9;
    }

    .btn-green:hover {
        background: #c8e6c9;
    }

    .btn-gray {
        background: var(--pastel-grey);
        color: #444;
        border: 1px solid #e0e0e0;
    }

    .btn-gray:hover {
        background: #e0e0e0;
    }

    .btn-gray-sm {
        background: var(--pastel-grey);
        color: #666;
        padding: 6px 12px;
        font-size: 13px;
        border: 1px solid #e0e0e0;
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
        font-family: var(--font-primary, "PP Mori", sans-serif);
        font-size: 15px;
        color: #333;
        outline: none;
        box-sizing: border-box;
        border-radius: 0 !important;
    }

    .input-title {
        width: 100%;
        background: transparent;
        border: none;
        border-bottom: 2px solid var(--brand-orange);
        padding: 8px 0;
        font-family: var(--font-primary, "PP Mori", sans-serif);
        font-size: 42px;
        font-weight: 700;
        color: #111;
        outline: none;
        box-sizing: border-box;
        border-radius: 0 !important;
        letter-spacing: -1px;
    }

    /* Editor Box */
    .editor-container {
        background: white;
        border: 1px solid #ddd;
        border-radius: var(--squircle-outer, 40px);
        margin-top: 30px;
        margin-bottom: 40px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
        overflow: hidden;
    }

    .toolbar {
        display: flex;
        padding: 8px 12px;
        border-bottom: 1px solid #ddd;
        background: #faf9f5;
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
        border-radius: var(--squircle-inner, 25px);
        cursor: pointer;
        font-size: 14px;
        transition: all 0.2s;
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
        font-family: var(--font-primary, "PP Mori", sans-serif);
        font-size: 15px;
        line-height: 1.6;
        color: #333;
        resize: vertical;
        box-sizing: border-box;
        outline: none;
    }

    .preview-box {
        min-height: 400px;
        padding: 30px;
        font-family: var(--font-primary, "PP Mori", sans-serif);
        line-height: 1.7;
        overflow-wrap: break-word;
        word-wrap: break-word;
        word-break: break-word;
        overflow-x: hidden;
        box-sizing: border-box;
        background: white;
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

    .author-field-editor {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .author-field-row {
        display: grid;
        grid-template-columns: minmax(140px, 0.8fr) minmax(180px, 1.2fr) 32px;
        gap: 8px;
        align-items: center;
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
        border-radius: var(--squircle-outer, 40px);
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
        background: #faf9f5;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }

    .version-list {
        list-style: none;
        padding: 0;
        margin: 0;
        flex: 1;
        overflow-y: auto;
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
        border-radius: var(--squircle-inner, 25px);
        cursor: pointer;
        display: block;
        font-family: var(--font-primary, "PP Mori", sans-serif);
    }

    .v-date {
        font-size: 13px;
        font-weight: 600;
        color: #333;
        margin-bottom: 4px;
    }
    .v-author {
        display: flex;
        align-items: center;
        gap: 5px;
        font-size: 12px;
        color: #666;
    }

    .history-avatar {
        width: 18px;
        height: 18px;
        border-radius: 50%;
        object-fit: cover;
        border: 1px solid #e7e3df;
        background: #111;
        flex-shrink: 0;
    }

    .history-avatar.large {
        width: 44px;
        height: 44px;
        border: 2px solid #e7e3df;
    }

    .author-stack {
        display: flex;
        align-items: center;
    }

    .author-stack.mini {
        margin-left: 2px;
    }

    .history-avatar.stacked + .history-avatar.stacked {
        margin-left: -8px;
    }

    .author-stack .history-avatar.large + .history-avatar.large {
        margin-left: -12px;
    }

    .history-authors {
        padding: 14px 15px 16px;
        border-top: 1px solid #eee;
        background: #faf9f5;
    }

    .history-authors-label {
        margin-bottom: 8px;
        color: #666;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.04em;
    }

    :global(body.dark) .history-authors {
        background: #1e1e1e;
        border-top-color: #333;
    }

    :global(body.dark) .history-authors-label {
        color: #999;
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
        border-radius: var(--squircle-inner, 25px);
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
        border-radius: var(--squircle-inner, 25px);
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
        border-radius: var(--squircle-inner, 25px);
        padding: 10px 12px;
        font-family: var(--font-primary, "PP Mori", sans-serif);
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
        border-radius: var(--squircle-inner, 25px);
        font-weight: 600;
        font-size: 14px;
        font-family: var(--font-primary, "PP Mori", sans-serif);
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
        font-family: var(--font-primary, "PP Mori", sans-serif);
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
        border-color: var(--brand-orange);
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
        font-family: var(--font-primary, "PP Mori", sans-serif);
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

    :global(body.dark) {
        background-color: #121212;
        --toast-bg: #1f1f1f;
        --toast-border: #333;
        --toast-color: #eee;
    }
    :global(body.dark) .cms-wrapper {
        background-color: #121212;
        color: #eee;
    }
    :global(body.dark) .cms-wrapper.fullscreen {
        background: #121212;
    }
    :global(body.dark) .history-avatar {
        border-color: #1a1a1a;
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
    :global(body.dark) .btn-green {
        background-color: var(--pastel-green, #e8f5e9);
        color: #1b5e20;
    }
    :global(body.dark) .btn-green:hover {
        background-color: #c8e6c9;
    }
    :global(body.dark) .btn-gray,
    :global(body.dark) .btn-gray-sm {
        background-color: #333;
        color: #eee;
        border-color: #444;
    }
    :global(body.dark) .btn-gray:hover,
    :global(body.dark) .btn-gray-sm:hover {
        background-color: #444;
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

    :global(body.dark) .preview-box {
        background: #121212;
        color: #eee;
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
            height: 100vh;
            border-radius: 0 !important;
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
            border-radius: 12px !important;
        }
        .toolbar {
            flex-wrap: wrap;
            padding: 4px;
            gap: 4px;
        }
        .tool-btn {
            width: 36px;
            height: 36px;
        }
        .input-title {
            font-size: 28px;
        }
        .preview-box {
            padding: 15px;
            overflow-x: hidden;
        }
        .author-field-row {
            grid-template-columns: 1fr 1fr 30px;
        }
    }

    /* Style overrides for the cover target inside editor preview */
    .preview-box #post-cover-target {
        width: 100% !important;
        max-width: 100% !important;
        margin-left: 0 !important;
        margin-right: 0 !important;
        left: 0 !important;
        border-radius: 40px !important;
        padding: 5px !important;
        margin-top: 1rem !important;
        margin-bottom: 1rem !important;
        background: #e7e3df !important;
    }
    :global(body.dark-mode) .preview-box #post-cover-target,
    :global(body.dark) .preview-box #post-cover-target {
        background: #2c2c2a !important;
    }
</style>
