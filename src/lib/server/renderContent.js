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

    // ── Extract LaTeX display math blocks ──
    /** @type {Record<string, string>} */
    const mathBlocks = {};
    const blockMathRegex = /\$\$([\s\S]+?)\$\$/g;
    content = content.replace(blockMathRegex, (match, formula) => {
        const id = Math.random().toString(36).substr(2, 9);
        mathBlocks[id] = formula.trim();
        return `<div data-math-block-placeholder="${id}"></div>`;
    });

    // ── Extract LaTeX inline math blocks ──
    /** @type {Record<string, string>} */
    const mathInlines = {};
    // Matches inline math that starts and ends with $, but is not followed/preceded by whitespace
    const inlineMathRegex = /\$([^\$\s](?:[^\$]*?[^\$\s])?)\$/g;
    content = content.replace(inlineMathRegex, (match, formula) => {
        const id = Math.random().toString(36).substr(2, 9);
        mathInlines[id] = formula.trim();
        return `<span data-math-inline-placeholder="${id}"></span>`;
    });

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

    // ── MCQ shortcodes ──
    const mcqRegex = /\[mcq:([\s\S]+?)\]/g;
    content = content.replace(mcqRegex, (/** @type {string} */ match, /** @type {string} */ mcqContent) => {
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
                `<button class="mcq-reset-btn" onclick="${resetHandler}" title="Reset Question"><i class="fa-solid fa-rotate-left"></i></button>` +
            `</div>` +
            `<div class="mcq-options">${optionsHtml}</div>` +
        `</div>`;
    });

    // ── Cover artifact code blocks (extract before markdown parsing) ──
    const coverRegex = /```(?:cover|artifact:cover)\s*\n([\s\S]*?)\n```/g;
    let coverHtml = '';
    content = content.replace(coverRegex, (/** @type {string} */ match, /** @type {string} */ innerContent) => {
        coverHtml = innerContent;
        return ''; // remove it from the main body content
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
        const artifactHtml = `<div class="artifact-container"><template>${innerContent}</template></div>`;
        html = html.replace(`<div data-artifact-placeholder="${id}"></div>`, artifactHtml);
    });

    // ── Restore LaTeX display math blocks ──
    Object.entries(mathBlocks).forEach(([id, formula]) => {
        const formulaHtml = `$$\n${formula}\n$$`;
        html = html.replace(`<div data-math-block-placeholder="${id}"></div>`, formulaHtml);
    });

    // ── Restore LaTeX inline math blocks ──
    Object.entries(mathInlines).forEach(([id, formula]) => {
        const formulaHtml = `$${formula}$`;
        html = html.replace(`<span data-math-inline-placeholder="${id}"></span>`, formulaHtml);
    });

    // Replace double-escaped blank characters
    html = html.replace(/&amp;#8206;/g, '\u200E');

    // ── Append cover artifact source if present ──
    if (coverHtml) {
        html += `<div data-cover-artifact-source style="display:none;"><div class="artifact-container"><template>${coverHtml}</template></div></div>`;
    }

    return html;
}
