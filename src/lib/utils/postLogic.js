/* src/lib/utils/postLogic.js */
// @ts-nocheck

export function slugify(/** @type {string} */ text) {
    if (!text) return '';
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/[\u2018\u2019\u201C\u201D]/g, '')
        .replace(/[^a-z0-9\s\-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/\-+/g, '-');
}

/* =========================================
   TOC & Sidebar Logic
   ========================================= */

export function buildTOCFallback() {
    const tocContainer = document.querySelector('.post-toc');
    if (!tocContainer) return;

    if (tocContainer.innerHTML.trim().length > 10) return;

    const headings = document.querySelectorAll('.post-body h2, .post-body h3');
    if (headings.length === 0) return;

    let tocHTML = '<nav class="toc"><ul>';

    headings.forEach((heading) => {
        if (!heading.id && heading.textContent) {
            heading.id = slugify(heading.textContent);
        }

        const level = heading.tagName.toLowerCase() === 'h2' ? 2 : 3;
        const title = heading.textContent;
        // @ts-ignore
        tocHTML += `<li class="toc-level-${level}"><a href="#${heading.id}">${title}</a></li>`;
    });

    tocHTML += '</ul></nav>';
    tocContainer.innerHTML = tocHTML;
}

// Move `.post-toc` into `#site-toc-sidebar` and wire toggle handlers
export function wireTOCSidebar() {
    const siteSidebar = document.getElementById('site-toc-sidebar');
    const postToc = document.querySelector('.post-toc');

    if (!siteSidebar || !postToc) return;

    // Move postToc directly into sidebar (preserve content)
    siteSidebar.appendChild(postToc);
    postToc.style.display = 'block';
    siteSidebar.setAttribute('aria-hidden', 'true');
    const overlayToCheck = document.getElementById('site-toc-overlay');
    if (overlayToCheck) overlayToCheck.setAttribute('aria-hidden', 'true');

    // Toggle handlers
    const toggleBtn = document.querySelector('.toc-toggle');
    const overlay = document.getElementById('site-toc-overlay');

    function openTOC() {
        document.body.classList.add('toc-open');
        siteSidebar.setAttribute('aria-hidden', 'false');
        if (overlay) overlay.setAttribute('aria-hidden', 'false');
        // focus first link for accessibility
        const firstLink = siteSidebar.querySelector('a');
        if (firstLink) firstLink.focus();
        // update header icon to 'regular' when open
        if (toggleBtn) {
            const icon = toggleBtn.querySelector('i');
            if (icon) {
                icon.classList.remove('fa-light');
                icon.classList.add('fa-regular');
            }
        }
        // center currently active TOC item so user sees where they are
        setTimeout(() => { centerActiveInSidebar('auto'); }, 120);
    }

    function closeTOC() {
        document.body.classList.remove('toc-open');
        siteSidebar.setAttribute('aria-hidden', 'true');
        if (overlay) overlay.setAttribute('aria-hidden', 'true');
        if (toggleBtn) toggleBtn.focus();
        // update header icon to 'light' when closed
        if (toggleBtn) {
            const icon = toggleBtn.querySelector('i');
            if (icon) {
                icon.classList.remove('fa-regular');
                icon.classList.add('fa-light');
            }
        }
    }

    // Remove existing listeners if any (simple hack to avoid duplicates if called multiple times, though usually onMount runs once)
    // Actually, standard addEventListener accumulates. We should ideally cleanup, but calling this once per page load is fine.

    if (toggleBtn) {
        if (!toggleBtn.hasAttribute('data-toc-wired')) {
            toggleBtn.setAttribute('data-toc-wired', 'true');
            // Use addEventListener to avoid overwriting and for better event handling
            toggleBtn.addEventListener('click', function (e) {
                e.stopPropagation(); // prevent document click from closing it immediately
                if (document.body.classList.contains('toc-open')) closeTOC(); else openTOC();
            });
        }
    }

    if (overlay && !overlay.hasAttribute('data-toc-wired')) {
        overlay.setAttribute('data-toc-wired', 'true');
        overlay.addEventListener('click', closeTOC);
    }

    // Mouse clicks: close if click is outside sidebar and not on the toggle.
    // We need to be careful not to add this globally repeatedly either.
    // But strictly speaking, document listener IS global.
    // Better to name it or check.
    if (!document.body.hasAttribute('data-toc-click-wired')) {
        document.body.setAttribute('data-toc-click-wired', 'true');
        document.addEventListener('click', function (ev) {
            if (!document.body.classList.contains('toc-open')) return;
            const target = ev.target;
            // @ts-ignore
            if (siteSidebar && !siteSidebar.contains(target) && !(toggleBtn && toggleBtn.contains(target))) {
                closeTOC();
            }
        });

        // Close on ESC
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && document.body.classList.contains('toc-open')) {
                closeTOC();
            }
        });
    }
}

// Center the currently active TOC link inside the sidebar (used on open and on load)
function centerActiveInSidebar(behavior = 'smooth') {
    const sidebarEl = document.getElementById('site-toc-sidebar');
    if (!sidebarEl) return;
    // Skip if sidebar is not visible to prevent scroll fighting
    // @ts-ignore
    if (sidebarEl.offsetParent === null || getComputedStyle(sidebarEl).display === 'none') return;
    const active = sidebarEl.querySelector('.toc a.active');
    if (!active) return;
    // Use scrollTo on the sidebar container directly instead of scrollIntoView
    // to avoid accidentally scrolling the main document
    try {
        const activeRect = active.getBoundingClientRect();
        const sidebarRect = sidebarEl.getBoundingClientRect();
        const currentScroll = sidebarEl.scrollTop;
        // @ts-ignore
        const offset = (activeRect.top - sidebarRect.top) - (sidebarEl.clientHeight / 2) + (activeRect.height / 2);
        // @ts-ignore
        sidebarEl.scrollTo({ top: currentScroll + offset, behavior });
    } catch (e) {
        // Silent fail - don't use scrollIntoView as fallback to prevent scroll fighting
    }
}

// Track active TOC link based on scroll position and clicks
export function wireTOCActiveTracking() {
    const sidebar = document.getElementById('site-toc-sidebar');
    const postBody = document.querySelector('.post-body');
    if (!sidebar || !postBody) return;

    const links = Array.from(sidebar.querySelectorAll('.toc a'));
    if (!links.length) return;

    // Map link -> target ID (we store ID instead of element to handle potential DOM replacements)
    const linkIds = links.map(a => {
        const hash = a.getAttribute('href') || '';
        return hash.replace(/^#/, '');
    });

    // When we programmatically navigate (click -> smooth scroll), suspend
    // the scroll-based active calculation briefly to avoid jitter between
    // the click-set active state and scroll-based recalculation.
    let suspendScrollHandler = false;
    let suspendTimeoutId = null;

    // Track the last active index to avoid redundant updates
    let lastActiveIndex = -1;

    // @ts-ignore
    function setActive(index, shouldScrollSidebar = false) {
        // Skip if same index to avoid unnecessary DOM updates
        if (index === lastActiveIndex) return;
        lastActiveIndex = index;

        links.forEach((a, i) => {
            if (i === index) a.classList.add('active'); else a.classList.remove('active');
        });

        // Only scroll sidebar if explicitly requested (e.g., on TOC open, not during page scroll)
        // This prevents scroll fighting between page scroll and sidebar scroll
        if (!shouldScrollSidebar) return;

        const sidebarEl = document.getElementById('site-toc-sidebar');
        // @ts-ignore
        if (!sidebarEl || sidebarEl.offsetParent === null || getComputedStyle(sidebarEl).display === 'none') {
            return;
        }
        const active = links[index];
        if (active) {
            try {
                const activeRect = active.getBoundingClientRect();
                const sidebarRect = sidebarEl.getBoundingClientRect();
                const currentScroll = sidebarEl.scrollTop;
                // @ts-ignore
                const offset = (activeRect.top - sidebarRect.top) - (sidebarEl.clientHeight / 2) + (activeRect.height / 2);
                // @ts-ignore
                sidebarEl.scrollTo({ top: currentScroll + offset, behavior: 'smooth' });
            } catch (e) {
                // Silent fail
            }
        }
    }

    // on click, mark active and scroll sidebar
    links.forEach((a, i) => {
        // @ts-ignore
        a.addEventListener('click', (ev) => {
            setActive(i, true); // true = scroll sidebar to active item
            suspendScrollHandler = true;
            if (suspendTimeoutId) clearTimeout(suspendTimeoutId);
            // @ts-ignore
            suspendTimeoutId = setTimeout(() => {
                suspendScrollHandler = false;
                suspendTimeoutId = null;
            }, 1000); // longer suspend to avoid jitter
        }, true);
    });

    // on scroll, find heading nearest to top (don't scroll sidebar - just update active class)
    function onScroll() {
        if (suspendScrollHandler) return;
        let best = -1;
        let bestOffset = Infinity;

        for (let i = 0; i < linkIds.length; i++) {
            const id = linkIds[i];
            if (!id) continue;
            const el = document.getElementById(id);

            if (!el) continue;
            const rect = el.getBoundingClientRect();
            // Check if element is at least partially defined (orphaned elements might have 0 coords)
            if (rect.width === 0 && rect.height === 0 && rect.top === 0) continue;

            const offset = Math.abs(rect.top - 120);
            if (rect.top <= 150 && offset < bestOffset) {
                best = i; bestOffset = offset;
            }
        }

        if (best >= 0) {
            // User requested sidebar to scroll with content so active item is always centered
            setActive(best, true);
        }
    }

    // Use requestAnimationFrame-based throttle for smoother performance
    let ticking = false;
    document.addEventListener('scroll', function () {
        if (!ticking && !suspendScrollHandler) {
            requestAnimationFrame(function () {
                onScroll();
                ticking = false;
            });
            ticking = true;
        }
    }, { passive: true });

    // initial highlight
    setTimeout(() => { onScroll(); }, 600);
}

export function addHeadingAnchorLinks() {
    // @ts-ignore
    const headings = document.querySelectorAll('.post-body h2, .post-body h3');
    headings.forEach(heading => {
        if (!heading.id && heading.textContent) {
            heading.id = slugify(heading.textContent);
        }

        if (heading.querySelector('.heading-anchor')) return;

        const anchor = document.createElement('a');
        anchor.className = 'heading-anchor';
        // @ts-ignore
        anchor.href = `#${heading.id}`;
        anchor.innerHTML = '<i class="fa-solid fa-link"></i>';
        anchor.ariaLabel = 'Link to this section';

        // @ts-ignore
        heading.style.position = 'relative';
        heading.appendChild(anchor);

        // Handle click - copy link to clipboard
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const url = window.location.origin + window.location.pathname + '#' + heading.id;

            navigator.clipboard.writeText(url).then(() => {
                alert('Link copied to clipboard!');
            }).catch(() => {
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = url;
                textArea.style.position = 'fixed';
                textArea.style.left = '-9999px';
                document.body.appendChild(textArea);
                textArea.select();
                try {
                    document.execCommand('copy');
                    alert('Link copied to clipboard!');
                } catch (err) {
                    alert('Failed to copy link');
                }
                document.body.removeChild(textArea);
            });
        });
    });
}

/* =========================================
   Text-to-Speech (TTS) Logic
   ========================================= */

/** @type {SpeechSynthesis | undefined} */
let speechSynthesisVar;
if (typeof window !== 'undefined') {
    speechSynthesisVar = window.speechSynthesis;
}

/** @type {SpeechSynthesisUtterance | null} */
let currentUtterance = null;
let isPlaying = false;
let isPaused = false;
let currentText = '';
let startTime = 0;
let pausedTime = 0;
let totalDuration = 0;
/** @type {any} */
let waveformInterval = null;
let currentPostUrl = typeof window !== 'undefined' ? window.location.href : '';

export function initializeListenComponent() {
    if (typeof window === 'undefined') return;

    const currentUrl = window.location.href;
    if (currentPostUrl !== currentUrl) {
        clearTTSState();
        currentPostUrl = currentUrl;
    }

    /** @type {HTMLElement | null} */
    // @ts-ignore
    const postBody = document.querySelector('.post-body');
    if (postBody) {
        const wordCount = (postBody.innerText || '').split(/\s+/).length;
        const estimatedMinutes = Math.ceil(wordCount / 120);
        totalDuration = estimatedMinutes * 60;

        const durEl = document.getElementById('listen-duration');
        if (durEl) durEl.textContent = `${estimatedMinutes}m audio`;
    }

    initializeWaveform();
}

function clearTTSState() {
    if (speechSynthesisVar && speechSynthesisVar.speaking) {
        speechSynthesisVar.cancel();
    }
    currentUtterance = null;
    isPlaying = false;
    isPaused = false;
    currentText = '';
    startTime = 0;
    pausedTime = 0;
    stopWaveform();

    const listenComponent = document.getElementById('listen-component');
    const listenIcon = document.getElementById('listen-icon');
    const seekControls = document.getElementById('seek-controls');

    if (listenComponent) listenComponent.classList.remove('playing');
    if (listenIcon) listenIcon.className = 'fa-solid fa-play';
    if (seekControls) seekControls.style.display = 'none';
}

function initializeWaveform() {
    const waveBars = document.querySelectorAll('.wave-bar');
    const waveformPattern = [8, 12, 6, 14, 10, 16, 9, 11, 7, 13, 5, 15, 8, 12, 6];
    waveBars.forEach((bar, index) => {
        const height = waveformPattern[index % waveformPattern.length];
        /** @type {HTMLElement} */
        // @ts-ignore
        const el = bar;
        el.style.height = `${height}px`;
        el.style.animationDelay = `${index * 0.1}s`;
    });
}

function animateWaveform() {
    waveformInterval = setInterval(() => {
        const waveBars = document.querySelectorAll('.wave-bar');
        waveBars.forEach((bar) => {
            const randomHeight = Math.floor(Math.random() * 10) + 6;
            /** @type {HTMLElement} */
            // @ts-ignore
            const el = bar;
            el.style.height = `${randomHeight}px`;
        });
    }, 200);
}

function stopWaveform() {
    if (waveformInterval) {
        clearInterval(waveformInterval);
        waveformInterval = null;
    }
    initializeWaveform();
}

export function toggleListen() {
    if (typeof window === 'undefined' || !speechSynthesisVar) return;

    const currentUrl = window.location.href;
    if (currentPostUrl !== currentUrl) {
        clearTTSState();
        currentPostUrl = currentUrl;
    }

    const listenComponent = document.getElementById('listen-component');
    const listenIcon = document.getElementById('listen-icon');

    if (isPlaying) {
        // Pause
        speechSynthesisVar.pause();
        isPlaying = false;
        isPaused = true;
        pausedTime = Date.now() - startTime;
        if (listenComponent) listenComponent.classList.remove('playing');
        if (listenIcon) listenIcon.className = 'fa-solid fa-play';
        stopWaveform();
    } else if (isPaused) {
        // Resume
        speechSynthesisVar.resume();
        isPlaying = true;
        isPaused = false;
        startTime = Date.now() - pausedTime;
        if (listenComponent) listenComponent.classList.add('playing');
        if (listenIcon) listenIcon.className = 'fa-solid fa-pause';
        animateWaveform();
    } else {
        // Start
        clearTTSState();
        startTextToSpeech();
    }
}

function startTextToSpeech() {
    /** @type {HTMLElement | null} */
    // @ts-ignore
    const postBody = document.querySelector('.post-body');
    /** @type {HTMLElement | null} */
    // @ts-ignore
    const postTitle = document.querySelector('.post-title');

    if (!postBody) return;

    let textToRead = '';
    if (postTitle) textToRead += postTitle.innerText + '. ';

    // @ts-ignore
    const bodyText = postBody.innerText || postBody.textContent || '';

    textToRead += bodyText
        .replace(/\s+/g, ' ')
        .replace(/[^\w\s.,!?;:()\-'"]/g, '')
        .trim();

    if (textToRead.length < 5) {
        alert('No content to read');
        return;
    }

    if (textToRead.length > 32000) textToRead = textToRead.substring(0, 32000) + '...';

    currentText = textToRead;
    startTime = Date.now();
    pausedTime = 0;

    speakText(textToRead);
}

/**
 * @param {string} text
 */
function speakText(text) {
    if (!speechSynthesisVar) {
        alert('Text-to-speech not supported');
        return;
    }

    currentUtterance = new SpeechSynthesisUtterance(text);
    currentUtterance.rate = 0.9;
    currentUtterance.pitch = 1;
    currentUtterance.volume = 0.8;

    const voices = speechSynthesisVar.getVoices();
    const preferredVoice = voices.find(v => v.name.includes('Natural') || v.name.includes('Google US English'));
    if (preferredVoice) currentUtterance.voice = preferredVoice;

    currentUtterance.onstart = () => {
        isPlaying = true;
        isPaused = false;
        const listenComponent = document.getElementById('listen-component');
        const listenIcon = document.getElementById('listen-icon');
        const seekControls = document.getElementById('seek-controls');

        if (listenComponent) listenComponent.classList.add('playing');
        if (listenIcon) listenIcon.className = 'fa-solid fa-pause';
        if (seekControls) seekControls.style.display = 'flex';
        animateWaveform();
        updateProgress();
    };

    currentUtterance.onend = () => {
        clearTTSState();
    };

    currentUtterance.onerror = (e) => {
        if (e.error === 'interrupted') return;
        console.error('Speech error', e);
        clearTTSState();
    };

    speechSynthesisVar.speak(currentUtterance);
}

function updateProgress() {
    if (!isPlaying && !isPaused) return;
    const listenDuration = document.getElementById('listen-duration');

    const interval = setInterval(() => {
        if (!isPlaying && !isPaused) {
            clearInterval(interval);
            return;
        }
        if (isPlaying) {
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            const min = Math.floor(elapsed / 60);
            const sec = elapsed % 60;
            if (listenDuration) listenDuration.textContent = `${min}:${sec.toString().padStart(2, '0')}`;
        }
    }, 1000);
}

export function seekBackward() {
    if (!currentText || !speechSynthesisVar) return;
    speechSynthesisVar.cancel();

    const elapsed = isPaused ? pausedTime : (Date.now() - startTime);
    const progress = Math.max(0, (elapsed / 1000 - 5) / totalDuration);
    const targetPos = Math.floor(currentText.length * progress);

    const sentences = currentText.split(/[.!?]+/);
    let charCount = 0;
    let targetIndex = 0;
    for (let i = 0; i < sentences.length; i++) {
        charCount += sentences[i].length + 1;
        if (charCount >= targetPos) {
            targetIndex = i;
            break;
        }
    }

    const newText = sentences.slice(targetIndex).join('. ');
    if (newText.trim()) {
        const seekTime = Math.max(0, elapsed - 5000);
        startTime = Date.now() - seekTime;
        if (isPaused) pausedTime = seekTime;

        setTimeout(() => {
            speakText(newText);
            if (isPaused && speechSynthesisVar) setTimeout(() => speechSynthesisVar.pause(), 100);
        }, 100);
    }
}

export function seekForward() {
    if (!currentText || !speechSynthesisVar) return;
    speechSynthesisVar.cancel();

    const elapsed = isPaused ? pausedTime : (Date.now() - startTime);
    const progress = Math.min(1, (elapsed / 1000 + 5) / totalDuration);
    const targetPos = Math.floor(currentText.length * progress);

    const sentences = currentText.split(/[.!?]+/);
    let charCount = 0;
    let targetIndex = 0;
    for (let i = 0; i < sentences.length; i++) {
        charCount += sentences[i].length + 1;
        if (charCount >= targetPos) {
            targetIndex = i;
            break;
        }
    }

    const newText = sentences.slice(targetIndex).join('. ');
    if (newText.trim()) {
        const seekTime = elapsed + 5000;
        startTime = Date.now() - seekTime;
        if (isPaused) pausedTime = seekTime;

        setTimeout(() => {
            speakText(newText);
            if (isPaused && speechSynthesisVar) setTimeout(() => speechSynthesisVar.pause(), 100);
        }, 100);
    }
}

export function stopAudio() {
    clearTTSState();
}
