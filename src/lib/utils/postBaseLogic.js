/* src/lib/utils/postBaseLogic.js */
// @ts-nocheck

export function initializePostBase() {
    if (typeof window === 'undefined') return;

    // Use setTimeout to ensure DOM is fully ready and styles applied
    setTimeout(() => {
        initializeBlankCharFix();
        initializeCodeBlocks();
        processGitHubCallouts();
        processAttachmentTags();
        processVideoTags();
        initializePrintEnhancements();
        initializeScrollToTop();
        initializeSecureMode();
        initializeMermaid();
        initializeMarkmap();
        initializeGraphviz();
        initializeFlashcards();
    }, 100);
}

function initializeBlankCharFix() {
    const postBody = document.querySelector('.post-body');
    if (postBody) {
        // Replace encoded blank character with actual unicode char if present
        postBody.innerHTML = postBody.innerHTML.replace(/&amp;#8206;/g, '\u200E');
    }
}

/* =========================================
   Code Block Enhancements
   ========================================= */

function initializeCodeBlocks() {
    // Wrap tables
    document.querySelectorAll('table').forEach(function (table) {
        if (table.parentElement && table.parentElement.classList.contains('table-wrapper')) return;
        const wrapper = document.createElement('div');
        wrapper.className = 'table-wrapper';
        if (table.parentNode) {
            table.parentNode.insertBefore(wrapper, table);
            wrapper.appendChild(table);
        }
    });

    // Process code blocks
    document.querySelectorAll('pre code').forEach(function (codeBlock) {
        const pre = codeBlock.parentElement;
        if (!pre) return;

        const classList = codeBlock.className;
        let language = '';

        // Detection logic
        const rougeMatch = classList.match(/(?:^|\s)language-([a-zA-Z0-9-]+)(?:\s|$)/);
        if (rougeMatch) language = rougeMatch[1];

        if (!language) {
            const hlMatch = classList.match(/(?:^|\s)(?:hljs-|hljs )([a-zA-Z0-9-]+)(?:\s|$)/);
            if (hlMatch) language = hlMatch[1];
        }

        if (!language) {
            const parentMatch = pre.className.match(/(?:^|\s)language-([a-zA-Z0-9-]+)(?:\s|$)/);
            if (parentMatch) language = parentMatch[1];
        }

        // Auto-detection fallback
        if (!language && codeBlock.textContent) {
            const txt = codeBlock.textContent.toLowerCase();
            if (txt.includes('func ') && txt.includes('package ')) language = 'go';
            else if (txt.includes('function ') || txt.includes('const ') || txt.includes('=>')) language = 'javascript';
            else if (txt.includes('public class')) language = 'java';
            else if (txt.includes('def ') && txt.includes('print(')) language = 'python';
        }

        // Mermaid, Markmap, Graphviz, Flashcards handling - skip here, handled separately
        if (['mermaid', 'markmap', 'graphviz', 'dot', 'flashcards'].includes(language)) return;

        const content = codeBlock.textContent || '';
        const lineCount = content.trim().split('\n').length;
        if (lineCount <= 1) pre.classList.add('single-line');

        if (language) {
            pre.classList.add('has-language');
            const langLabel = document.createElement('div');
            langLabel.className = 'code-language';
            langLabel.textContent = language.toUpperCase();
            pre.insertBefore(langLabel, codeBlock);
        }

        const copyBtn = document.createElement('button');
        copyBtn.className = 'code-copy-btn';
        copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i> ';
        copyBtn.setAttribute('aria-label', 'Copy code to clipboard');

        copyBtn.addEventListener('click', function () {
            const code = codeBlock.textContent || '';
            navigator.clipboard.writeText(code).then(() => {
                copyBtn.innerHTML = '<i class="fa-solid fa-copy"></i> ';
                setTimeout(() => {
                    copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i> ';
                }, 2000);
            }).catch(() => fallbackCopyToClipboard(code, copyBtn));
        });

        pre.appendChild(copyBtn);
    });
}

/**
 * @param {string} text
 * @param {HTMLElement} button
 */
function fallbackCopyToClipboard(text, button) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        // @ts-ignore
        const successful = document.execCommand('copy');
        if (successful) {
            button.innerHTML = ' ';
            setTimeout(() => button.innerHTML = '<i class="fa-regular fa-copy"></i> ', 2000);
        }
    } catch (err) {
        button.innerHTML = 'Error';
    }
    document.body.removeChild(textArea);
}

/* =========================================
   Mermaid Diagrams
   ========================================= */

function initializeMermaid() {
    // @ts-ignore
    if (typeof mermaid === 'undefined') return;

    // @ts-ignore
    mermaid.initialize({
        startOnLoad: false,
        theme: document.body.classList.contains('dark') ? 'dark' : 'default',
        securityLevel: 'loose',
        fontFamily: '"Manrope", sans-serif'
    });

    const mermaidBlocks = document.querySelectorAll('pre code.language-mermaid');
    mermaidBlocks.forEach(element => {
        const code = element.textContent;
        const div = document.createElement('div');
        div.className = 'mermaid-diagram';
        div.style.textAlign = 'center';
        div.textContent = code;

        const pre = element.parentElement;
        if (pre && pre.parentElement) {
            pre.replaceWith(div);
        } else if (pre) {
            pre.replaceWith(div);
        }
    });

    try {
        // @ts-ignore
        mermaid.init(undefined, document.querySelectorAll('.mermaid-diagram'));
    } catch (e) {
        console.error('Mermaid init error:', e);
    }
}

/* =========================================
   Markmap Mindmaps
   ========================================= */

function initializeMarkmap() {
    // @ts-ignore
    if (typeof markmap === 'undefined' || typeof markmap.Transformer === 'undefined') {
        console.warn('Markmap library not loaded');
        return;
    }

    const markmapBlocks = document.querySelectorAll('pre code.language-markmap');
    if (markmapBlocks.length === 0) return;

    // @ts-ignore
    const transformer = new markmap.Transformer();

    markmapBlocks.forEach((element, index) => {
        const code = element.textContent || '';
        const pre = element.parentElement;
        if (!pre || !pre.parentElement) return;

        // Create mindmap card container
        const card = document.createElement('div');
        card.className = 'mindmap-card';
        card.id = `mindmap-${index}`;

        // Create SVG for the mindmap
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.id = `mindmap-svg-${index}`;
        svg.style.width = '100%';
        svg.style.height = '400px';

        card.appendChild(svg);
        pre.replaceWith(card);

        try {
            // Transform markdown to markmap data
            const { root } = transformer.transform(code);

            // Create markmap instance with interactivity
            // @ts-ignore
            markmap.Markmap.create(svg, {
                colorFreezeLevel: 2,
                duration: 300,
                maxWidth: 200,
                zoom: true,
                pan: true,
            }, root);
        } catch (e) {
            console.error('Markmap render error:', e);
            card.innerHTML = `<div class="diagram-error">Error rendering mindmap: ${e.message}</div>`;
        }
    });
}

/* =========================================
   Graphviz FSM/Automata Diagrams
   ========================================= */

async function initializeGraphviz() {
    // @ts-ignore
    if (typeof Viz === 'undefined') {
        console.warn('Viz.js library not loaded');
        return;
    }

    const graphvizBlocks = document.querySelectorAll('pre code.language-graphviz, pre code.language-dot');
    if (graphvizBlocks.length === 0) return;

    try {
        // @ts-ignore
        const viz = await Viz.instance();

        graphvizBlocks.forEach((element, index) => {
            const code = element.textContent || '';
            const pre = element.parentElement;
            if (!pre || !pre.parentElement) return;

            // Create graphviz diagram container
            const container = document.createElement('div');
            container.className = 'graphviz-diagram';
            container.id = `graphviz-${index}`;

            try {
                // Render DOT to SVG
                const svgString = viz.renderSVGElement(code);
                container.appendChild(svgString);
                pre.replaceWith(container);
            } catch (e) {
                console.error('Graphviz render error:', e);
                container.innerHTML = `<div class="diagram-error">Error rendering diagram: ${e.message}</div>`;
                pre.replaceWith(container);
            }
        });
    } catch (e) {
        console.error('Viz.js initialization error:', e);
    }
}

/* =========================================
   Flashcards Carousel
   ========================================= */

function initializeFlashcards() {
    const flashcardBlocks = document.querySelectorAll('pre code.language-flashcards');
    if (flashcardBlocks.length === 0) return;

    flashcardBlocks.forEach((element, blockIndex) => {
        const code = element.textContent || '';
        const pre = element.parentElement;
        if (!pre || !pre.parentElement) return;

        // Parse flashcards from markdown
        // Format: Q: question text
        //         A: answer text
        //         ---  (separator between cards)
        const cards = parseFlashcards(code);
        if (cards.length === 0) return;

        // Create flashcard carousel container
        const container = document.createElement('div');
        container.className = 'flashcard-carousel';
        container.id = `flashcard-carousel-${blockIndex}`;

        // Create cards container
        const cardsContainer = document.createElement('div');
        cardsContainer.className = 'flashcard-cards';

        // Create individual cards
        cards.forEach((card, cardIndex) => {
            const cardEl = document.createElement('div');
            cardEl.className = 'flashcard';
            cardEl.dataset.index = cardIndex;
            if (cardIndex === 0) cardEl.classList.add('active');

            const cardInner = document.createElement('div');
            cardInner.className = 'flashcard-inner';

            // Front (Question)
            const front = document.createElement('div');
            front.className = 'flashcard-front';
            front.innerHTML = `
                <div class="flashcard-label">Question</div>
                <div class="flashcard-content">${escapeHtml(card.question)}</div>
                <div class="flashcard-hint">Click to reveal answer</div>
            `;

            // Back (Answer)
            const back = document.createElement('div');
            back.className = 'flashcard-back';
            back.innerHTML = `
                <div class="flashcard-label">Answer</div>
                <div class="flashcard-content">${escapeHtml(card.answer)}</div>
                <div class="flashcard-hint">Click to see question</div>
            `;

            cardInner.appendChild(front);
            cardInner.appendChild(back);
            cardEl.appendChild(cardInner);

            // Flip on click
            cardEl.addEventListener('click', () => {
                cardEl.classList.toggle('flipped');
            });

            cardsContainer.appendChild(cardEl);
        });

        // Navigation controls - create buttons separately for inline placement
        const prevBtn = document.createElement('button');
        prevBtn.className = 'flashcard-btn flashcard-prev';
        prevBtn.setAttribute('aria-label', 'Previous card');
        prevBtn.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';

        const nextBtn = document.createElement('button');
        nextBtn.className = 'flashcard-btn flashcard-next';
        nextBtn.setAttribute('aria-label', 'Next card');
        nextBtn.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';

        const counter = document.createElement('span');
        counter.className = 'flashcard-counter';
        counter.textContent = `1 / ${cards.length}`;

        // Build layout: prev button, cards, next button (inline)
        container.appendChild(prevBtn);
        container.appendChild(cardsContainer);
        container.appendChild(nextBtn);
        cardsContainer.appendChild(counter);
        pre.replaceWith(container);

        // Navigation logic
        let currentIndex = 0;
        const cardEls = cardsContainer.querySelectorAll('.flashcard');

        function showCard(index) {
            cardEls.forEach((el, i) => {
                el.classList.remove('active', 'prev', 'next', 'hidden');
                el.classList.remove('flipped'); // Reset flip state
                if (i === index) {
                    el.classList.add('active');
                } else if (i === index - 1) {
                    el.classList.add('prev');
                } else if (i === index + 1) {
                    el.classList.add('next');
                } else {
                    el.classList.add('hidden');
                }
            });
            counter.textContent = `${index + 1} / ${cards.length}`;
        }

        prevBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (currentIndex > 0) {
                currentIndex--;
                showCard(currentIndex);
            }
        });

        nextBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (currentIndex < cards.length - 1) {
                currentIndex++;
                showCard(currentIndex);
            }
        });

        // Keyboard navigation
        container.tabIndex = 0;
        container.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft' && currentIndex > 0) {
                currentIndex--;
                showCard(currentIndex);
            } else if (e.key === 'ArrowRight' && currentIndex < cards.length - 1) {
                currentIndex++;
                showCard(currentIndex);
            } else if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                cardEls[currentIndex].classList.toggle('flipped');
            }
        });
    });
}

/**
 * Parse flashcard markdown format
 * @param {string} content
 * @returns {Array<{question: string, answer: string}>}
 */
function parseFlashcards(content) {
    const cards = [];
    const cardBlocks = content.split(/\n---\n|\n---$|^---\n/);

    cardBlocks.forEach(block => {
        const trimmed = block.trim();
        if (!trimmed) return;

        // Match Q: and A: patterns
        const qMatch = trimmed.match(/^Q:\s*(.+?)(?=\nA:|$)/s);
        const aMatch = trimmed.match(/\nA:\s*(.+?)$/s);

        if (qMatch) {
            cards.push({
                question: qMatch[1].trim(),
                answer: aMatch ? aMatch[1].trim() : 'No answer provided'
            });
        }
    });

    return cards;
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/* =========================================
   AI Summary
   ========================================= */

/**
 * Initialize AI Summary feature
 * @param {Object} options
 * @param {string} options.title - Post title
 * @param {string} options.content - Post content text
 * @param {string|null} options.token - Auth token
 * @param {string|null} options.accessTier - User access tier
 */
export function initializeAISummary(options = {}) {
    const { title = '', content = '', token = null, accessTier = null } = options;

    const container = document.getElementById('ai-summary-container');
    if (!container) return;

    // Prevent re-initialization
    if (container.dataset.initialized === 'true') return;
    container.dataset.initialized = 'true';

    const API_BASE = window.location.hostname === 'localhost'
        ? 'http://localhost:1000'
        : 'https://materioa.vercel.app';

    // State
    let state = {
        showSummarySection: false,
        isSummaryExpanded: false,
        isGeneratingSummary: false,
        summaryContent: '',
        summaryError: '',
        isFollowupLoading: false,
        followupQuery: '',
        followupResponse: ''
    };

    // Check access
    async function checkSummaryAccess() {
        if (accessTier === 'super' || accessTier === 'plus') {
            state.showSummarySection = true;
            render();
            return;
        }

        if (!token) return;

        try {
            const response = await fetch(`${API_BASE}/api/v2/profile`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) throw new Error('Failed to verify user');
            const userData = await response.json();
            const hasAccess = userData.user?.hasAdminPrivileges || userData.user?.isPlusUser;

            if (hasAccess) {
                state.showSummarySection = true;
                render();
            }
        } catch (error) {
            console.error('Error checking summary access:', error);
        }
    }

    function parseBasicMarkdown(text) {
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/^\* (.*$)/gm, '<li>$1</li>')
            .replace(/^\- (.*$)/gm, '<li>$1</li>')
            .replace(/\n\n/g, '<br><br>');
    }

    async function generateSummary() {
        if (!content) return;
        state.isGeneratingSummary = true;
        state.summaryError = '';
        render();

        try {
            const wordCount = content.split(/\s+/).length;
            const targetWords = Math.max(30, Math.min(80, Math.floor(wordCount / 6)));

            const summaryPrompt = `Please provide an ultra-concise summary (max ${targetWords} words). Focus ONLY on the main point and 2-3 key takeaways. Use simple, clear language and bullet points. Preserve LaTeX where present.\n\nTitle: ${title}\n\n${content}`;

            const response = await fetch(`${API_BASE}/api/v2/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    message: summaryPrompt,
                    messages: [],
                    mode: 'general',
                    model: 'openai/gpt-oss-120b:free'
                })
            });

            if (!response.ok) throw new Error('Failed to generate summary');
            const resData = await response.json();
            if (!resData.success) throw new Error(resData.error || 'Failed');

            state.summaryContent = parseBasicMarkdown(resData.response);
            render();

            // Render math if available
            setTimeout(() => {
                if (typeof renderMathInElement !== 'undefined') {
                    const el = document.getElementById('summary-text');
                    if (el) {
                        renderMathInElement(el, {
                            delimiters: [
                                { left: '$$', right: '$$', display: false },
                                { left: '$', right: '$', display: false },
                                { left: '\\(', right: '\\)', display: false },
                                { left: '\\[', right: '\\]', display: true }
                            ]
                        });
                    }
                }
            }, 100);
        } catch (err) {
            console.error(err);
            state.summaryError = 'Failed to generate summary. Please try again.';
        } finally {
            state.isGeneratingSummary = false;
            render();
        }
    }

    async function askFollowupQuestion() {
        const query = state.followupQuery.trim();
        if (!query) return;

        state.isFollowupLoading = true;
        state.followupResponse = '';
        render();

        try {
            const prompt = `Based on the following content, satisfy the user's request: "${query}".\n\nContent: ${content}`;

            const response = await fetch(`${API_BASE}/api/v2/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    message: prompt,
                    messages: [],
                    mode: 'general',
                    model: 'openai/gpt-oss-20b:free'
                })
            });

            if (!response.ok) throw new Error('Failed to get answer');
            const resData = await response.json();
            if (!resData.success) throw new Error(resData.error || 'Failed');
            state.followupResponse = parseBasicMarkdown(resData.response);
        } catch (e) {
            state.followupResponse = 'Error: Could not get a response.';
        } finally {
            state.isFollowupLoading = false;
            render();
        }
    }

    function toggleSummary() {
        state.isSummaryExpanded = !state.isSummaryExpanded;
        if (state.isSummaryExpanded && !state.summaryContent && !state.isGeneratingSummary) {
            generateSummary();
        }
        render();
    }

    function render() {
        if (!state.showSummarySection) {
            container.innerHTML = '';
            return;
        }

        const chevronRotate = state.isSummaryExpanded ? 'rotate(180deg)' : 'rotate(0deg)';

        let contentHtml = '';
        if (state.isSummaryExpanded) {
            if (state.isGeneratingSummary) {
                contentHtml = `
                    <div style="color: var(--text); padding: 1rem 0; font-style: italic;">
                        <i class="fa-solid fa-spinner fa-spin" style="margin-right: 0.5rem;"></i>
                        Generating summary...
                    </div>`;
            } else if (state.summaryError) {
                contentHtml = `
                    <div style="color: #ff6b6b; padding: 1rem 0;">
                        <i class="fa-solid fa-exclamation-triangle"></i>
                        ${state.summaryError}
                    </div>`;
            } else if (state.summaryContent) {
                contentHtml = `
                    <div id="summary-text">${state.summaryContent}</div>
                    <div id="followup-section" style="margin-top: 1.5rem; border-top: 1px solid rgba(0,0,0,0.1); padding-top: 1rem;">
                        <div style="display: flex; align-items: center; margin-bottom: 0.75rem;">
                            <i class="fa-solid fa-question-circle" style="margin-right: 0.5rem; font-size: 14px; opacity: 0.7;"></i>
                            <span style="font-size: 14px; font-weight: 600; opacity: 0.8;">Ask a Follow up:</span>
                        </div>
                        <div style="display: flex; gap: 0.5rem; align-items: flex-start;">
                            <div class="followup-pill" style="position: relative; flex: 1; display: flex; align-items: center; background: rgba(255,255,255,0.7); border: 1px solid rgba(0,0,0,0.2); border-radius: 25px; padding: 0.5rem 3rem 0.5rem 1rem;">
                                <input type="text" id="followup-input" placeholder="e.g., What are the main benefits discussed?" style="flex: 1; border: none; background: transparent; font-size: 14px; outline: none;" value="${escapeHtml(state.followupQuery)}">
                                <button id="followup-btn" style="position: absolute; right: 4px; width: 32px; height: 32px; background: #ff8200; color: white; border: none; border-radius: 50%; cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center;">
                                    ${state.isFollowupLoading
                        ? '<i class="fa-solid fa-spinner fa-spin" style="font-size: 12px;"></i>'
                        : '<i class="fa-solid fa-arrow-up" style="font-size: 12px;"></i>'}
                                </button>
                            </div>
                        </div>
                        ${state.followupResponse ? `
                            <div id="followup-response" style="margin-top: 0.75rem; padding: 0.75rem; background: rgba(0,0,0,0.03); border-radius: 6px; font-size: 14px; line-height: 1.5;">
                                ${state.followupResponse}
                            </div>
                        ` : ''}
                    </div>`;
            } else {
                contentHtml = `<p style="margin: 0; font-style: italic; opacity: 0.7;">Click to generate AI summary...</p>`;
            }
        }

        container.innerHTML = `
            <div class="ai-summary-section">
                <div id="summary-header" class="summary-header" style="cursor: pointer;">
                    <div style="display: flex; align-items: center;">
                        <i class="fa-solid fa-wand-magic-sparkles" style="margin-right: 0.5rem; font-size: 18px;"></i>
                        <h3 style="margin: 0; font-size: 18px; font-weight: 600;">Summary</h3>
                    </div>
                    <i class="fa-solid fa-chevron-down" style="transition: transform 0.3s ease; transform: ${chevronRotate};"></i>
                </div>
                ${state.isSummaryExpanded ? `
                    <div class="summary-content">
                        ${contentHtml}
                    </div>
                ` : ''}
            </div>`;

        // Attach event listeners
        const header = container.querySelector('#summary-header');
        if (header) {
            header.addEventListener('click', toggleSummary);
        }

        const followupInput = container.querySelector('#followup-input');
        if (followupInput) {
            followupInput.addEventListener('input', (e) => {
                state.followupQuery = e.target.value;
            });
            followupInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') askFollowupQuestion();
            });
        }

        const followupBtn = container.querySelector('#followup-btn');
        if (followupBtn) {
            followupBtn.addEventListener('click', askFollowupQuestion);
        }
    }

    // Initialize
    checkSummaryAccess();
}


/* =========================================
   GitHub Callouts
   ========================================= */

function processGitHubCallouts() {
    const postBody = document.querySelector('.post-body');
    if (!postBody) return;

    const blockquotes = postBody.querySelectorAll('blockquote');
    const useHugeicons = localStorage.getItem('materio_ota_hugeicons') === 'true';

    const calloutConfig = {
        'NOTE': {
            faIcon: 'fa-solid fa-circle-info',
            hugeIcon: 'hgi-stroke hgi-information-circle',
            class: 'callout-note',
            titleClass: 'callout-title-note',
            iconClass: 'callout-icon-note',
            label: 'Note'
        },
        'TIP': {
            faIcon: 'fa-solid fa-lightbulb',
            hugeIcon: 'hgi-stroke hgi-bulb',
            class: 'callout-tip',
            titleClass: 'callout-title-tip',
            iconClass: 'callout-icon-tip',
            label: 'Tip'
        },
        'IMPORTANT': {
            faIcon: 'fa-solid fa-circle-exclamation',
            hugeIcon: 'hgi-stroke hgi-alert-circle',
            class: 'callout-important',
            titleClass: 'callout-title-important',
            iconClass: 'callout-icon-important',
            label: 'Important'
        },
        'WARNING': {
            faIcon: 'fa-solid fa-triangle-exclamation',
            hugeIcon: 'hgi-stroke hgi-alert-02',
            class: 'callout-warning',
            titleClass: 'callout-title-warning',
            iconClass: 'callout-icon-warning',
            label: 'Warning'
        },
        'CAUTION': {
            faIcon: 'fa-solid fa-hand',
            hugeIcon: 'hgi-stroke hgi-stop-sign',
            class: 'callout-caution',
            titleClass: 'callout-title-caution',
            iconClass: 'callout-icon-caution',
            label: 'Caution'
        }
    };

    blockquotes.forEach(blockquote => {
        if (blockquote.closest('pre, code, .highlight')) return;
        if (blockquote.querySelector('code') && !blockquote.querySelector('p')) return;

        const firstP = blockquote.querySelector('p:first-child');
        if (!firstP) return;

        const text = firstP.innerHTML;
        const match = text.match(/^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i);

        if (match) {
            const type = match[1].toUpperCase();
            // @ts-ignore
            const config = calloutConfig[type];

            if (config) {
                blockquote.classList.add(config.class);
                blockquote.setAttribute('data-callout', type.toLowerCase());

                const remainingText = text.replace(match[0], '').trim();

                const titleDiv = document.createElement('div');
                titleDiv.className = `callout-title ${config.titleClass}`;

                const iconEl = document.createElement('i');
                const iconClasses = useHugeicons ? config.hugeIcon : config.faIcon;
                iconEl.className = `${iconClasses} callout-icon ${config.iconClass}`;

                const labelSpan = document.createElement('span');
                labelSpan.textContent = config.label;

                titleDiv.appendChild(iconEl);
                titleDiv.appendChild(labelSpan);

                const contentDiv = document.createElement('div');
                contentDiv.className = 'callout-content';

                if (remainingText) {
                    firstP.innerHTML = remainingText;
                    contentDiv.appendChild(firstP.cloneNode(true));
                }

                const otherElements = Array.from(blockquote.children).slice(remainingText ? 1 : 0);
                otherElements.forEach(el => {
                    if (el !== firstP || !remainingText) {
                        contentDiv.appendChild(el.cloneNode(true));
                    }
                });

                blockquote.innerHTML = '';
                blockquote.appendChild(titleDiv);
                if (contentDiv.children.length > 0) {
                    blockquote.appendChild(contentDiv);
                }
            }
        }
    });
}

/* =========================================
   Attachments & Video
   ========================================= */

function processAttachmentTags() {
    const postBody = document.querySelector('.post-body');
    if (!postBody) return;

    const attachmentPattern = /\[attachment:(.+):([^\]]+)\]/g;
    let replacements = 0;

    /** @param {Node} node */
    function walk(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.nodeValue || '';
            let match;
            let lastIndex = 0;
            const frag = document.createDocumentFragment();
            attachmentPattern.lastIndex = 0;
            let found = false;

            while ((match = attachmentPattern.exec(text)) !== null) {
                found = true;
                const [fullMatch, filePath, displayName] = match;
                const start = match.index;
                if (start > lastIndex) {
                    frag.appendChild(document.createTextNode(text.slice(lastIndex, start)));
                }
                const attachmentEl = createAttachmentElement(filePath.trim(), displayName.trim());
                frag.appendChild(attachmentEl);
                lastIndex = start + fullMatch.length;
                replacements++;
            }
            if (found) {
                if (lastIndex < text.length) {
                    frag.appendChild(document.createTextNode(text.slice(lastIndex)));
                }
                if (node.parentNode) node.parentNode.replaceChild(frag, node);
            }
        } else if (node.nodeType === Node.ELEMENT_NODE && !['A', 'SCRIPT', 'STYLE'].includes(node.nodeName)) {
            const children = Array.from(node.childNodes);
            for (const child of children) {
                walk(child);
            }
        }
    }

    walk(postBody);

    if (replacements > 0) {
        setTimeout(initializeAttachmentCards, 100);
    }
}

/**
 * @param {string} filePath
 * @param {string} displayName
 */
function createAttachmentElement(filePath, displayName) {
    const container = document.createElement('div');
    const attachmentId = 'attachment-' + Math.random().toString(36).substr(2, 9);
    const fileExtension = (filePath.split('.').pop() || '').toLowerCase();

    container.className = 'attachment-card';
    container.setAttribute('data-file-path', filePath);
    container.setAttribute('data-attachment-id', attachmentId);

    const details = document.createElement('div');
    details.className = 'attachment-details';

    const title = document.createElement('div');
    title.className = 'attachment-title';
    title.textContent = displayName || (filePath.split('/').pop() || filePath);

    const meta = document.createElement('div');
    meta.className = 'attachment-meta';
    meta.innerHTML = `<span class="file-type">${fileExtension.toUpperCase()}</span> • <span class="file-size">Click to view</span>`;

    details.appendChild(title);
    details.appendChild(meta);

    const preview = document.createElement('div');
    preview.className = 'attachment-preview';
    const canvas = document.createElement('canvas');
    canvas.id = `canvas-${attachmentId}`;
    canvas.width = 100;
    canvas.height = 130;
    const img = document.createElement('img');
    img.id = `img-${attachmentId}`;
    img.style.display = 'none';
    preview.appendChild(canvas);
    preview.appendChild(img);

    container.appendChild(details);
    container.appendChild(preview);

    container.addEventListener('click', () => window.open(filePath, '_blank'));

    return container;
}

function initializeAttachmentCards() {
    document.querySelectorAll('.attachment-card').forEach(async (card) => {
        const filePath = card.getAttribute('data-file-path');
        const attachmentId = card.getAttribute('data-attachment-id');
        if (filePath && attachmentId) {
            await generateAttachmentPreview(filePath, attachmentId);
        }
    });
}

/**
 * @param {string} filePath
 * @param {string} attachmentId
 */
async function generateAttachmentPreview(filePath, attachmentId) {
    /** @type {HTMLCanvasElement | null} */
    // @ts-ignore
    const canvas = document.getElementById(`canvas-${attachmentId}`);
    /** @type {HTMLImageElement | null} */
    // @ts-ignore
    const img = document.getElementById(`img-${attachmentId}`);

    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const fileExtension = (filePath.split('.').pop() || '').toLowerCase();

    try {
        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExtension)) {
            generateImagePreview(filePath, canvas, img);
        } else if (fileExtension === 'pdf') {
            await generatePDFPreview(filePath, canvas);
        } else if (['doc', 'docx', 'txt', 'rtf'].includes(fileExtension)) {
            generateDocumentPreview(fileExtension, canvas, ctx);
        } else {
            generateGenericPreview(fileExtension, canvas, ctx);
        }
    } catch (error) {
        console.error('Error generating preview:', error);
        generateGenericPreview(fileExtension, canvas, ctx);
    }
}

/**
 * @param {string} filePath
 * @param {HTMLCanvasElement} canvas
 * @param {HTMLImageElement} img
 */
function generateImagePreview(filePath, canvas, img) {
    img.src = filePath;
    img.onload = function () {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = 100;
        canvas.height = 130;
        const aspectRatio = img.width / img.height;
        let drawWidth = 100;
        let drawHeight = 100 / aspectRatio;
        if (drawHeight > 130) {
            drawHeight = 130;
            drawWidth = 130 * aspectRatio;
        }
        const x = (100 - drawWidth) / 2;
        const y = (130 - drawHeight) / 2;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, 100, 130);
        ctx.drawImage(img, x, y, drawWidth, drawHeight);
    };
    img.onerror = () => generateGenericPreview('IMG', canvas, canvas.getContext('2d'));
}

/**
 * @param {string} filePath
 * @param {HTMLCanvasElement} canvas
 */
async function generatePDFPreview(filePath, canvas) {
    // @ts-ignore
    if (typeof pdfjsLib === 'undefined') {
        generateGenericPreview('PDF', canvas, canvas.getContext('2d'));
        return;
    }
    try {
        // @ts-ignore
        const pdf = await pdfjsLib.getDocument(filePath).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 0.4 });
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = 100;
        canvas.height = 130;
        const scale = Math.min(100 / viewport.width, 130 / viewport.height);
        const scaledViewport = page.getViewport({ scale: scale });
        await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;
    } catch (error) {
        console.error('PDF preview error:', error);
        generateGenericPreview('PDF', canvas, canvas.getContext('2d'));
    }
}

/**
 * @param {string} fileExtension
 * @param {HTMLCanvasElement} canvas
 * @param {CanvasRenderingContext2D | null} ctx
 */
function generateDocumentPreview(fileExtension, canvas, ctx) {
    if (!ctx) return;
    canvas.width = 100;
    canvas.height = 130;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 100, 130);
    ctx.strokeStyle = "#e0e0e0";
    ctx.lineWidth = 1;
    for (let i = 20; i < 120; i += 8) {
        ctx.beginPath();
        ctx.moveTo(10, i);
        ctx.lineTo(90, i);
        ctx.stroke();
    }
    ctx.fillStyle = "#4285f4";
    ctx.font = "bold 12px Arial";
    ctx.textAlign = "center";
    ctx.fillText(fileExtension.toUpperCase(), 50, 110);
    ctx.fillStyle = "#666";
    ctx.font = "16px Arial";
    ctx.fillText("📄", 50, 25);
}

/**
 * @param {string} fileExtension
 * @param {HTMLCanvasElement} canvas
 * @param {CanvasRenderingContext2D | null} ctx
 */
function generateGenericPreview(fileExtension, canvas, ctx) {
    if (!ctx) return;
    canvas.width = 100; // Force sizes
    canvas.height = 130;
    ctx.fillStyle = "#f5f5f5";
    ctx.fillRect(0, 0, 100, 130);
    ctx.strokeStyle = "#ddd";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, 100, 130);
    ctx.fillStyle = "#666";
    ctx.font = "24px Arial";
    ctx.textAlign = "center";
    ctx.fillText("📎", 50, 45);
    ctx.fillStyle = "#333";
    ctx.font = "bold 14px Arial";
    ctx.fillText(fileExtension.toUpperCase(), 50, 70);
    ctx.fillStyle = "#888";
    ctx.font = "10px Arial";
    ctx.fillText("File", 50, 90);
}

function processVideoTags() {
    const postBody = document.querySelector('.post-body');
    if (!postBody) return;

    const videoTagRegex = /\[video:([^\]]+)\]/g;
    const matches = [...postBody.innerHTML.matchAll(videoTagRegex)];
    if (matches.length === 0) return;

    let html = postBody.innerHTML;
    matches.forEach((match, index) => {
        html = html.replace(match[0], `<span class="video-placeholder" data-video-index="${index}" data-video-params="${match[1]}"></span>`);
    });
    postBody.innerHTML = html;

    document.querySelectorAll('.video-placeholder').forEach(placeholder => {
        // @ts-ignore
        const params = placeholder.dataset.videoParams;
        if (!params) return;

        const parts = params.split(':');
        const videoPath = parts[0].trim();
        const isCover = parts[1] && parts[1].trim() === 'cover';

        const videoId = 'video-' + Math.random().toString(36).substr(2, 9);
        const coverClass = isCover ? 'video-cover' : 'video-embed';

        const container = document.createElement('div');
        container.className = coverClass;

        const video = document.createElement('video');
        video.id = videoId;
        video.muted = true;
        video.loop = true;
        video.autoplay = true;
        video.playsInline = true;
        video.preload = 'auto';
        video.src = videoPath;
        video.setAttribute('playsinline', '');
        video.setAttribute('webkit-playsinline', '');
        video.setAttribute('autoplay', '');
        video.setAttribute('muted', '');
        video.defaultMuted = true;

        const controls = document.createElement('div');
        controls.className = 'video-controls playing';
        controls.onclick = () => toggleVideo(videoId);
        controls.innerHTML = '<i class="fa-solid fa-pause"></i>';

        container.appendChild(video);
        container.appendChild(controls);
        placeholder.replaceWith(container);

        // Auto-play logic with retries
        video.addEventListener('loadedmetadata', () => {
            video.play().catch(e => console.log("Autoplay prevented", e));
        });
    });
}

/**
 * @param {string} videoId
 */
function toggleVideo(videoId) {
    /** @type {HTMLVideoElement | null} */
    // @ts-ignore
    const video = document.getElementById(videoId);
    if (!video) return;
    const controls = video.parentElement?.querySelector('.video-controls');

    let icon = null;
    if (controls) {
        icon = controls.querySelector('i');
    }

    if (video.paused) {
        video.play();
        if (icon) icon.className = 'fa-solid fa-pause';
        if (controls) {
            controls.classList.remove('paused');
            controls.classList.add('playing');
        }
    } else {
        video.pause();
        if (icon) icon.className = 'fa-solid fa-play';
        if (controls) {
            controls.classList.add('paused');
            controls.classList.remove('playing');
        }
    }
}

/* =========================================
   Scroll To Top & Print
   ========================================= */

function initializeScrollToTop() {
    if (document.getElementById('scroll-to-top')) return;

    const scrollBtn = document.createElement('button');
    scrollBtn.id = 'scroll-to-top';
    scrollBtn.setAttribute('aria-label', 'Scroll to top');
    scrollBtn.innerHTML = '<i class="fa-solid fa-arrow-up"></i>';
    document.body.appendChild(scrollBtn);

    let scrollTicking = false;
    window.addEventListener('scroll', function () {
        if (!scrollTicking) {
            requestAnimationFrame(function () {
                if (window.pageYOffset > 300) {
                    scrollBtn.classList.add('visible');
                } else {
                    scrollBtn.classList.remove('visible');
                }
                scrollTicking = false;
            });
            scrollTicking = true;
        }
    }, { passive: true });

    scrollBtn.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

function initializePrintEnhancements() {
    window.addEventListener('beforeprint', generatePrintElements);
    window.addEventListener('afterprint', cleanupPrintElements);

    // Hidden QR Code Generation
    const postContainer = document.querySelector('.post-container');
    if (postContainer && !document.getElementById('hidden-qr-code')) {
        const hiddenQR = document.createElement('div');
        hiddenQR.id = 'hidden-qr-code';
        hiddenQR.style.cssText = 'position: absolute; left: -9999px; top: -9999px; visibility: hidden;';
        document.body.appendChild(hiddenQR);

        const qrSize = 90;
        const currentUrl = encodeURIComponent(window.location.href);
        const qrUrl = `https://chart.googleapis.com/chart?chs=${qrSize}x${qrSize}&cht=qr&chl=${currentUrl}&choe=UTF-8`;

        const img = document.createElement('img');
        img.src = qrUrl;
        img.style.cssText = 'width: 90px; height: 90px; display: block;';
        img.onload = () => hiddenQR.appendChild(img);
    }
}

function generatePrintElements() {
    if (document.querySelector('.print-page-header')) return;

    const postContainer = document.querySelector('.post-container');
    if (!postContainer) return;

    const printContainer = document.createElement('div');
    printContainer.className = 'print-only-element print-page-header';
    printContainer.style.cssText = `
    display: none; width: 100%; height: 120px; margin-bottom: 10px; position: relative;
    border-bottom: 1px solid #ddd; padding-top: 8px; padding-bottom: 8px;
  `;

    const logoDiv = document.createElement('div');
    logoDiv.style.cssText = 'position: absolute; left: 0; top: 33px;';
    logoDiv.innerHTML = '<img src="/assets/printables/header.svg" alt="Materio" style="height: 32px; width: auto;">';

    const qrSection = document.createElement('div');
    qrSection.style.cssText = 'position: absolute; right: 0; top: -3px; text-align: center; display: flex; flex-direction: column; align-items: center;';

    const qrTitle = document.createElement('div');
    qrTitle.style.cssText = 'font-family: "Libre Baskerville", serif; font-size: 9px; color: #666; margin: 0 0 6px 0; z-index: 2;';
    qrTitle.textContent = 'Scan to read online';

    const qrContainer = document.createElement('div');
    qrContainer.style.cssText = 'width: 90px; height: 90px; margin-top: 0; z-index: 1;';

    const hiddenQR = document.getElementById('hidden-qr-code');
    if (hiddenQR && hiddenQR.firstChild) {
        qrContainer.appendChild(hiddenQR.firstChild.cloneNode(true));
    }

    qrSection.appendChild(qrTitle);
    qrSection.appendChild(qrContainer);

    printContainer.appendChild(logoDiv);
    printContainer.appendChild(qrSection);
    postContainer.insertBefore(printContainer, postContainer.firstChild);

    if (!document.getElementById('print-element-style')) {
        const style = document.createElement('style');
        style.id = 'print-element-style';
        style.textContent = `
      @media print {
        .print-page-header { display: block !important; }
        .print-only-element { display: block !important; }
      }
      @media screen {
        .print-only-element { display: none !important; }
      }
    `;
        document.head.appendChild(style);
    }
}

function cleanupPrintElements() {
    document.querySelectorAll('.print-only-element').forEach(el => el.remove());
    const style = document.getElementById('print-element-style');
    if (style) style.remove();
}

function initializeSecureMode() {
    document.addEventListener('keydown', function (e) {
        const key = e.key.toLowerCase();
        const isBlocked = key === 'f12' || (e.ctrlKey && e.shiftKey && ['i', 'j', 'c'].includes(key)) || (e.ctrlKey && key === 'u');
        if (isBlocked) {
            e.preventDefault();
            e.stopPropagation();
        }
    }, true);
    document.addEventListener('contextmenu', function (e) {
        /** @type {HTMLElement} */
        // @ts-ignore
        const target = e.target;
        if (!target) return;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA' && !target.isContentEditable) e.preventDefault();
    });
    document.body.style.userSelect = 'none';
    // @ts-ignore
    document.body.style.webkitUserSelect = 'none';
    document.addEventListener('selectstart', blockIfNotInput);
    document.addEventListener('dragstart', blockIfNotInput);
}

/** @param {Event} e */
function blockIfNotInput(e) {
    /** @type {HTMLElement} */
    // @ts-ignore
    const target = e.target;
    if (!target) return;

    const tag = target.tagName;
    if (tag !== 'INPUT' && tag !== 'TEXTAREA' && !target.isContentEditable) e.preventDefault();
}
