/**
 * Server-side content rendering
 * 
 * Renders post markdown content to HTML on the server.
 * Shared logic extracted from the content API so the same output
 * can be produced during SSR for crawlers.
 */

import { Marked } from 'marked';

/**
 * Render raw post content (markdown + custom shortcodes) into HTML.
 * @param {string} rawContent - The raw markdown content from the database
 * @returns {Promise<string>} - Rendered HTML
 */
export async function renderPostContent(rawContent) {
    if (!rawContent) return '';

    let content = rawContent;

    // ── Attachment shortcodes ──
    const attachmentRegex = /\[attachment:([^\]]+):([^\]:]+)\]/g;
    content = content.replace(attachmentRegex, (/** @type {string} */ match, /** @type {string} */ url, /** @type {string} */ title) => {
        const cleanUrl = url.trim();
        const cleanTitle = title.trim();
        const fileExt = cleanUrl.split('.').pop()?.toUpperCase() || 'FILE';
        const id = 'attachment-' + Math.random().toString(36).substr(2, 5);

        return `<div class="attachment-card" data-file-path="${cleanUrl}" data-attachment-id="${id}" onclick="window.open('${cleanUrl}', '_blank')">
            <div class="attachment-details">
                <div class="attachment-title">${cleanTitle}</div>
                <div class="attachment-meta"><span class="file-type">${fileExt}</span> • <span class="file-size">Click to view</span></div>
            </div>
            <div class="attachment-preview">
                <canvas id="canvas-${id}" width="100" height="130"></canvas>
                <img id="img-${id}" style="display: none;" alt="" />
            </div>
        </div>`;
    });

    // ── Video shortcodes ──
    const videoRegex = /\[video:([\s\S]+?)\]/g;
    content = content.replace(videoRegex, (/** @type {string} */ match, /** @type {string} */ vparams) => {
        const isCover = vparams.trim().endsWith(':cover');
        const videoUrl = isCover ? vparams.trim().slice(0, -6).trim() : vparams.trim();
        const id = 'video-' + Math.random().toString(36).substr(2, 5);

        if (isCover) {
            return `<div class="video-cover"><video id="${id}" muted loop autoplay playsinline src="${videoUrl}"></video><div class="video-controls playing" onclick="window.toggleVideo('${id}')"><i class="fa-solid fa-pause"></i></div></div>`;
        }
        return `<div class="video-embed"><video id="${id}" muted loop autoplay playsinline src="${videoUrl}"></video><div class="video-controls playing" onclick="window.toggleVideo('${id}')"><i class="fa-solid fa-pause"></i></div></div>`;
    });

    // ── Artifact code blocks (extract before markdown parsing) ──
    const artifactRegex = /```artifact\s*\n([\s\S]*?)\n```/g;
    /** @type {Record<string, string>} */
    const artifacts = {};
    content = content.replace(artifactRegex, (/** @type {string} */ match, /** @type {string} */ innerContent) => {
        const id = Math.random().toString(36).substr(2, 9);
        artifacts[id] = innerContent;
        return `\n\n<div data-artifact-placeholder="${id}"></div>\n\n`;
    });

    // ── Markdown parsing ──
    const customMarked = new Marked({
        gfm: true,
        breaks: true,
        pedantic: false
    });

    let html = await customMarked.parse(content);

    // ── Restore artifacts ──
    Object.entries(artifacts).forEach(([id, innerContent]) => {
        const artifactHtml = `<div class="artifact-container"><div>${innerContent}</div></div>`;
        html = html.replace(`<div data-artifact-placeholder="${id}"></div>`, artifactHtml);
    });

    return html;
}
