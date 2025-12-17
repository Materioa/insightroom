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
   Heading Anchor Links
   ========================================= */

export function addHeadingAnchorLinks() {
    // Target visible content container to avoid hidden summary-capture
    const postBody = document.querySelector('.post-body .post-content-visible') || document.querySelector('.post-body');
    if (!postBody) return;

    const headings = postBody.querySelectorAll('h1, h2, h3');

    headings.forEach(heading => {
        // Ensure heading has an ID
        if (!heading.id) {
            heading.id = slugify(heading.textContent || heading.innerText || '');
            // Ensure unique ID
            let uniqueId = heading.id;
            let counter = 1;
            while (document.querySelectorAll(`#${CSS.escape(uniqueId)}`).length > 1) {
                uniqueId = heading.id + '-' + counter++;
            }
            heading.id = uniqueId;
        }

        // Skip if already has anchor
        if (heading.querySelector('.heading-anchor')) return;

        // Create anchor link
        const anchor = document.createElement('a');
        anchor.className = 'heading-anchor';
        anchor.href = '#' + heading.id;
        anchor.innerHTML = '<i class="fa-solid fa-link"></i>';
        anchor.title = 'Copy link to this section';
        anchor.setAttribute('aria-label', 'Copy link to section: ' + heading.textContent);

        // Handle click - copy link to clipboard
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const url = window.location.origin + window.location.pathname + '#' + heading.id;

            // Copy to clipboard
            navigator.clipboard.writeText(url).then(() => {
                showAnchorToast('Link copied to clipboard!');
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
                    showAnchorToast('Link copied to clipboard!');
                } catch (err) {
                    showAnchorToast('Failed to copy link');
                }
                document.body.removeChild(textArea);
            });
        });

        // Append anchor at the end of the heading
        heading.appendChild(anchor);
    });
}

// Show toast notification for anchor copy
function showAnchorToast(message) {
    // Remove existing toast
    const existingToast = document.querySelector('.anchor-toast');
    if (existingToast) {
        existingToast.remove();
    }

    // Create toast
    const toast = document.createElement('div');
    toast.className = 'anchor-toast';
    toast.innerHTML = `<i class="fa-solid fa-check"></i>${message}`;
    document.body.appendChild(toast);

    // Show toast
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    // Hide and remove after 2 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 2000);
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
