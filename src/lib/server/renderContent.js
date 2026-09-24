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

    // ── Cover artifact code blocks (extract before markdown parsing/shortcode parsing) ──
    const coverRegex = /```(?:cover|artifact:cover)\s*\n([\s\S]*?)\n```/g;
    let coverHtml = '';
    content = content.replace(coverRegex, (/** @type {string} */ match, /** @type {string} */ innerContent) => {
        coverHtml = innerContent;
        return ''; // remove it from the main body content
    });

    // ── Artifact code blocks (extract before markdown parsing/shortcode parsing) ──
    const artifactRegex = /```artifact\s*\n([\s\S]*?)\n```/g;
    /** @type {Record<string, string>} */
    const artifacts = {};
    content = content.replace(artifactRegex, (/** @type {string} */ match, /** @type {string} */ innerContent) => {
        const id = Math.random().toString(36).substr(2, 9);
        artifacts[id] = innerContent;
        return `\n\n<div data-artifact-placeholder="${id}"></div>\n\n`;
    });

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

    // ── MCQ & MSQ shortcodes ──
    const mcqRegex = /\[(mcq|msq):([\s\S]+?)\]/gi;

    // ── Highlighter shortcodes ──
    const highlightRegex = /==([\s\S]+?)==(?:\{([^}]+)\})?/g;
    content = content.replace(highlightRegex, (match, text, optionsStr) => {
        let attrs = 'class="custom-highlight"';
        if (optionsStr) {
            // parse key="value" or key='value' pairs
            const attrRegex = /([a-zA-Z0-9_-]+)=["']([^"']+)["']/g;
            let attrMatch;
            while ((attrMatch = attrRegex.exec(optionsStr)) !== null) {
                const key = attrMatch[1];
                const value = attrMatch[2];
                // Only allow specific safe data attributes to be passed
                if (['swatch', 'palette', 'style'].includes(key)) {
                    attrs += ` data-${key}="${value.replace(/"/g, '&quot;')}"`;
                }
            }
        }
        return `<mark ${attrs}>${text}</mark>`;
    });

    content = content.replace(mcqRegex, (/** @type {string} */ match, /** @type {string} */ tag, /** @type {string} */ mcqContent) => {
        const trimmed = mcqContent.trim();
        let question = '';
        /** @type {{text: string, isCorrect: boolean}[]} */
        let options = [];
        let explanation = '';

        const isExplanationLine = (/** @type {string} */ str) => {
            const s = str.trim();
            return s.startsWith('~') || /^[-*]\s*~/.test(s);
        };

        const extractExplanationText = (/** @type {string} */ str) => {
            return str.trim().replace(/^([-*]\s*)?~/, '').trim();
        };

        if (trimmed.includes('|') && !trimmed.includes('\n')) {
            const parts = trimmed.split('|').map((/** @type {string} */ p) => p.trim()).filter(Boolean);
            question = parts[0] || '';
            const rawOptions = parts.slice(1);
            for (const opt of rawOptions) {
                if (isExplanationLine(opt)) {
                    explanation = extractExplanationText(opt);
                } else {
                    const isCorrect = (opt.startsWith('**') && opt.endsWith('**')) ||
                                      (opt.startsWith('*') && opt.endsWith('*')) ||
                                      (opt.startsWith('_') && opt.endsWith('_'));
                    const text = opt.replace(/^(\*\*|\*|_)+|(\*\*|\*|_)+$/g, '').trim();
                    options.push({ text, isCorrect });
                }
            }
        } else {
            const lines = trimmed.split('\n').map((/** @type {string} */ l) => l.trim()).filter(Boolean);
            if (lines.length > 0) {
                const expIdx = lines.findIndex(isExplanationLine);
                let nonExpLines = lines;
                if (expIdx !== -1) {
                    const firstExp = extractExplanationText(lines[expIdx]);
                    const remainingExp = lines.slice(expIdx + 1);
                    explanation = [firstExp, ...remainingExp].join(' ').trim();
                    nonExpLines = lines.slice(0, expIdx);
                }

                const optionLines = nonExpLines.filter((/** @type {string} */ l) => 
                    l.startsWith('-') || l.startsWith('*') || /^\d+\./.test(l) || /^[A-Ea-e]\.\s+/.test(l)
                );
                const questionLines = nonExpLines.filter((/** @type {string} */ l) => !optionLines.includes(l));
                
                question = questionLines.join(' ');
                options = optionLines.map((/** @type {string} */ opt) => {
                    const cleanOpt = opt.replace(/^([-\*]|\d+\.|[A-Ea-e]\.)\s*/, '').trim();
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
        const isExplicitMsq = tag.toLowerCase() === 'msq';
        const correctIndices = options
            .map((opt, idx) => opt.isCorrect ? idx : -1)
            .filter(idx => idx !== -1);
        const isMultiSelect = isExplicitMsq || correctIndices.length > 1;

        if (isMultiSelect) {
            const jsonCorrect = JSON.stringify(correctIndices);
            const lastCorrectIdx = correctIndices.length > 0 ? correctIndices[correctIndices.length - 1] : -1;

            const optionsHtml = options.map((opt, idx) => {
                const letter = String.fromCharCode(65 + idx);
                const escapedText = escapeHtml(opt.text);
                const clickHandler = "(function(btn){var card=btn.closest('.mcq-card');if(card.classList.contains('answered'))return;btn.classList.toggle('selected');var icon=btn.querySelector('.mcq-option-icon i');var isSel=btn.classList.contains('selected');if(icon)icon.className=isSel?'fa-solid fa-square-check':'fa-regular fa-square';var submitBtn=card.querySelector('.msq-submit-btn');var anySelected=card.querySelectorAll('.mcq-option.selected').length>0;if(submitBtn)submitBtn.disabled=!anySelected;})(this)";
                
                const explanationBlock = (idx === lastCorrectIdx && explanation)
                    ? `<div class="mcq-option-explanation" style="display: none;"><strong>Explanation:</strong> ${escapeHtml(explanation)}</div>`
                    : '';

                return `<button class="mcq-option" data-index="${idx}" onclick="${clickHandler}">` +
                    `<div class="mcq-option-main">` +
                        `<span class="mcq-option-letter">${letter}</span>` +
                        `<span class="mcq-option-text">${escapedText}</span>` +
                        `<span class="mcq-option-icon"><i class="fa-regular fa-square"></i></span>` +
                    `</div>` +
                    explanationBlock +
                `</button>`;
            }).join('');

            const submitHandler = "(function(btn){var card=btn.closest('.mcq-card');if(card.classList.contains('answered'))return;card.classList.add('answered');var correctIndices=JSON.parse(card.getAttribute('data-correct-indices')||'[]');var btns=card.querySelectorAll('.mcq-option');var allCorrect=true;btns.forEach(function(b,idx){var isSelected=b.classList.contains('selected');var isShouldBe=correctIndices.indexOf(idx)!==-1;var icon=b.querySelector('.mcq-option-icon i');if(isShouldBe){b.classList.add('correct');if(icon)icon.className='fa-solid fa-square-check';}else if(isSelected){b.classList.add('incorrect');if(icon)icon.className='fa-solid fa-square-xmark';}if(isSelected!==isShouldBe){allCorrect=false;}});card.setAttribute('data-all-correct',allCorrect?'true':'false');var exps=card.querySelectorAll('.mcq-option-explanation');exps.forEach(function(exp){exp.style.display='block';});btn.style.display='none';card.dispatchEvent(new CustomEvent('mcq-answer',{detail:{correct:allCorrect},bubbles:true}));})(this)";

            const resetHandler = "(function(btn){var card=btn.closest('.mcq-card');card.classList.remove('answered');card.removeAttribute('data-all-correct');var btns=card.querySelectorAll('.mcq-option');btns.forEach(function(b){b.classList.remove('selected','correct','incorrect');var icon=b.querySelector('.mcq-option-icon i');if(icon)icon.className='fa-regular fa-square';});var exps=card.querySelectorAll('.mcq-option-explanation');exps.forEach(function(exp){exp.style.display='none';});var submitBtn=card.querySelector('.msq-submit-btn');if(submitBtn){submitBtn.style.display='';submitBtn.disabled=true;}card.dispatchEvent(new CustomEvent('mcq-reset',{bubbles:true}));})(this)";

            return `<div class="mcq-card msq-card" data-correct-indices='${jsonCorrect}' data-type="msq">` +
                `<div class="mcq-header">` +
                    `<div class="mcq-question">${escapedQuestion}</div>` +
                    `<button class="mcq-reset-btn" onclick="${resetHandler}" title="Reset Question"><i class="fa-solid fa-rotate-left"></i></button>` +
                `</div>` +
                `<div class="mcq-options">${optionsHtml}</div>` +
                `<div class="msq-footer">` +
                    `<button class="msq-submit-btn" disabled onclick="${submitHandler}">Submit Answer</button>` +
                `</div>` +
            `</div>`;
        }

        // Single-choice MCQ
        const correctIndex = options.findIndex((/** @type {any} */ opt) => opt.isCorrect);

        const optionsHtml = options.map((/** @type {any} */ opt, /** @type {number} */ idx) => {
            const letter = String.fromCharCode(65 + idx);
            const escapedText = escapeHtml(opt.text);
            const clickHandler = "(function(btn){var card=btn.closest('.mcq-card');if(card.classList.contains('answered'))return;card.classList.add('answered');var correctIdx=parseInt(card.getAttribute('data-correct-index'),10);var selectedIdx=parseInt(btn.getAttribute('data-index'),10);var isCorrect=correctIdx===selectedIdx;var btns=card.querySelectorAll('.mcq-option');btns.forEach(function(b,idx){var icon=b.querySelector('.mcq-option-icon i');if(idx===correctIdx){b.classList.add('correct');if(icon)icon.className='fa-solid fa-circle-check';}else if(idx===selectedIdx){b.classList.add('incorrect');if(icon)icon.className='fa-solid fa-circle-xmark';}});var exp=card.querySelector('.mcq-option-explanation');if(exp)exp.style.display='block';card.dispatchEvent(new CustomEvent('mcq-answer',{detail:{correct:isCorrect},bubbles:true}));})(this)";
            
            const explanationBlock = (opt.isCorrect && explanation)
                ? `<div class="mcq-option-explanation" style="display: none;"><strong>Explanation:</strong> ${escapeHtml(explanation)}</div>`
                : '';

            return `<button class="mcq-option" data-index="${idx}" onclick="${clickHandler}">` +
                `<div class="mcq-option-main">` +
                    `<span class="mcq-option-letter">${letter}</span>` +
                    `<span class="mcq-option-text">${escapedText}</span>` +
                    `<span class="mcq-option-icon"><i class="fa-regular"></i></span>` +
                `</div>` +
                explanationBlock +
            `</button>`;
        }).join('');

        const resetHandler = "(function(btn){var card=btn.closest('.mcq-card');card.classList.remove('answered');var btns=card.querySelectorAll('.mcq-option');btns.forEach(function(b){b.classList.remove('correct','incorrect');var icon=b.querySelector('.mcq-option-icon i');if(icon)icon.className='fa-regular';});var exp=card.querySelector('.mcq-option-explanation');if(exp)exp.style.display='none';card.dispatchEvent(new CustomEvent('mcq-reset',{bubbles:true}));})(this)";

        return `<div class="mcq-card" data-correct-index="${correctIndex}">` +
            `<div class="mcq-header">` +
                `<div class="mcq-question">${escapedQuestion}</div>` +
                `<button class="mcq-reset-btn" onclick="${resetHandler}" title="Reset Question"><i class="fa-solid fa-rotate-left"></i></button>` +
            `</div>` +
            `<div class="mcq-options">${optionsHtml}</div>` +
        `</div>`;
    });

    // ── Footnotes extraction ──
    /** @type {Map<string, string>} */
    const footnoteDefs = new Map();
    const footnoteDefRegex = /^[ \t]*\[\^([^\]]+)\]:[ \t]*([\s\S]*?)(?=(?:^[ \t]*\[\^)|(?:\r?\n[ \t]*\r?\n(?![ \t]))|$)/gm;
    content = content.replace(footnoteDefRegex, (match, id, text) => {
        const cleanText = text.trim().replace(/\r?\n[ \t]*/g, ' ');
        footnoteDefs.set(id, cleanText);
        return '';
    });

    /** @type {string[]} */
    const footnoteOrder = [];
    /** @type {Map<string, number>} */
    const footnoteNumMap = new Map();

    const footnoteRefRegex = /\[\^([^\]]+)\]/g;
    content = content.replace(footnoteRefRegex, (match, id) => {
        let num = footnoteNumMap.get(id);
        if (!num) {
            num = footnoteOrder.length + 1;
            footnoteOrder.push(id);
            footnoteNumMap.set(id, num);
        }

        const rawText = footnoteDefs.get(id) || id;
        const escapeHtml = (/** @type {string} */ str) => {
            return str
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        };

        const formattedText = escapeHtml(rawText)
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/\*([^*]+)\*/g, '<em>$1</em>')
            .replace(/`([^`]+)`/g, '<code>$1</code>');

        return `<sup class="footnote-ref" id="fnref-${id}"><a href="#fn-${id}" class="footnote-link no-pill">${num}</a><span class="footnote-hover-card">${formattedText}</span></sup>`;
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

    // ── Append footnotes if any ──
    if (footnoteOrder.length > 0) {
        let footnotesHtml = '<div class="footnotes-section"><ol class="footnotes-list">';
        footnoteOrder.forEach(id => {
            const num = footnoteNumMap.get(id);
            const rawText = footnoteDefs.get(id) || id;
            const escapeHtml = (/** @type {string} */ str) => {
                return str
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#039;');
            };
            const formattedText = escapeHtml(rawText)
                .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
                .replace(/\*([^*]+)\*/g, '<em>$1</em>')
                .replace(/`([^`]+)`/g, '<code>$1</code>');

            footnotesHtml += `<li id="fn-${id}" value="${num}" class="footnote-item"><span class="footnote-text">${formattedText}</span> <a href="#fnref-${id}" class="footnote-backref no-pill" title="Jump back to reference">↩</a></li>`;
        });
        footnotesHtml += '</ol></div>';
        html += footnotesHtml;
    }

    return html;
}
