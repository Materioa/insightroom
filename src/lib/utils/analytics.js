/**
 * Analytics client for InsightRoom
 * Tracks page views and user interactions, sending them to the Materio Analytics API
 */

import { dev } from '$app/environment';
import { browser } from '$app/environment';

const ANALYTICS_API_BASE = dev
    ? 'http://localhost:3000'
    : 'https://materio-analytics.vercel.app';

const ANONYMOUS_ID_KEY = 'materio_anonymous_id';
const SESSION_ID_KEY = 'materio_session_id';
const EVENT_QUEUE_KEY = 'materio_event_queue';

/**
 * @typedef {Object} AnalyticsEvent
 * @property {string} type
 * @property {string} timestamp
 * @property {string} sessionId
 * @property {string} url
 * @property {string|null} referrer
 * @property {Object} data
 */

// Event queue for batching
/** @type {AnalyticsEvent[]} */
let eventQueue = [];
/** @type {ReturnType<typeof setTimeout>|null} */
let flushTimeout = null;
const FLUSH_INTERVAL = 5000; // 5 seconds
const MAX_QUEUE_SIZE = 10;

/**
 * Generate a UUID v4
 * @returns {string}
 */
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Get or create anonymous ID
 * @returns {string}
 */
function getAnonymousId() {
    if (!browser) return '';

    let anonymousId = localStorage.getItem(ANONYMOUS_ID_KEY);
    if (!anonymousId) {
        anonymousId = generateUUID();
        localStorage.setItem(ANONYMOUS_ID_KEY, anonymousId);
    }
    return anonymousId;
}

/**
 * Get or create session ID (expires when browser closes)
 * @returns {string}
 */
function getSessionId() {
    if (!browser) return '';

    let sessionId = sessionStorage.getItem(SESSION_ID_KEY);
    if (!sessionId) {
        sessionId = generateUUID();
        sessionStorage.setItem(SESSION_ID_KEY, sessionId);
    }
    return sessionId;
}

/**
 * Add an event to the queue
 * @param {string} type - Event type (e.g., 'post_view', 'pdf_read')
 * @param {object} data - Event-specific data
 */
export function trackEvent(type, data = {}) {
    if (!browser) return;

    const event = {
        type,
        timestamp: new Date().toISOString(),
        sessionId: getSessionId(),
        url: window.location.href,
        referrer: document.referrer || null,
        data
    };

    eventQueue.push(event);
    console.log('[Analytics] Event queued:', type, data);

    // Flush if queue is full
    if (eventQueue.length >= MAX_QUEUE_SIZE) {
        flushEvents();
    } else {
        // Schedule flush
        scheduleFlush();
    }
}

/**
 * Schedule a flush of the event queue
 */
function scheduleFlush() {
    if (flushTimeout) return;

    flushTimeout = setTimeout(() => {
        flushEvents();
    }, FLUSH_INTERVAL);
}

/**
 * Flush all queued events to the analytics API
 */
export async function flushEvents() {
    if (!browser || eventQueue.length === 0) return;

    if (flushTimeout) {
        clearTimeout(flushTimeout);
        flushTimeout = null;
    }

    const eventsToSend = [...eventQueue];
    eventQueue = [];

    const anonymousId = getAnonymousId();
    const userId = getUserId();

    const payload = {
        userId: userId || null,
        anonymousId,
        events: eventsToSend
    };

    try {
        const response = await fetch(`${ANALYTICS_API_BASE}/collect`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            console.error('[Analytics] Failed to send events:', response.status);
            // Re-queue failed events
            eventQueue = [...eventsToSend, ...eventQueue];
        } else {
            console.log('[Analytics] Events sent successfully:', eventsToSend.length);
        }
    } catch (error) {
        console.error('[Analytics] Error sending events:', error);
        // Re-queue failed events
        eventQueue = [...eventsToSend, ...eventQueue];
    }
}

/**
 * Get current user ID from localStorage (set during login)
 * @returns {string|null}
 */
function getUserId() {
    if (!browser) return null;
    // Try to get from cookie or localStorage
    const match = document.cookie.match(/materio_user_id=([^;]+)/);
    return match ? match[1] : localStorage.getItem('materio_user_id');
}

/**
 * Identify a user (call when user logs in)
 * This merges anonymous history with the user account
 * @param {string} userId - The authenticated user's ID
 */
export async function identifyUser(userId) {
    if (!browser || !userId) return;

    const anonymousId = getAnonymousId();

    // Store user ID for future events
    localStorage.setItem('materio_user_id', userId);

    try {
        const response = await fetch(`${ANALYTICS_API_BASE}/identify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId,
                anonymousId
            })
        });

        if (response.ok) {
            console.log('[Analytics] User identified:', userId);
        }
    } catch (error) {
        console.error('[Analytics] Error identifying user:', error);
    }
}

/**
 * Track a page view
 * @param {object} options - Page view options
 * @param {string} options.title - Page title
 * @param {string} options.slug - Page slug/path
 * @param {string} options.category - Page category
 * @param {string} options.contentId - Content identifier (post ID, etc.)
 */
export function trackPageView({ title, slug, category, contentId }) {
    trackEvent('post_view', {
        title,
        slug,
        category,
        contentId
    });
}

/**
 * Track reading time for a post
 * @param {string} contentId - The content ID
 * @param {number} duration - Reading duration in seconds
 */
export function trackReadingTime(contentId, duration) {
    trackEvent('reading_time', {
        contentId,
        duration
    });
}

/**
 * Track feature usage
 * @param {string} feature - Feature name (e.g., 'ai_summary', 'listen', 'dark_mode')
 * @param {object} data - Additional feature data
 */
export function trackFeatureUsage(feature, data = {}) {
    trackEvent('feature_usage', {
        feature,
        ...data
    });
}

/**
 * Track scroll depth
 * @param {string} contentId - The content ID
 * @param {number} depth - Scroll depth percentage (0-100)
 */
export function trackScrollDepth(contentId, depth) {
    trackEvent('scroll_depth', {
        contentId,
        depth
    });
}

// Flush events when page is about to unload
if (browser) {
    window.addEventListener('beforeunload', () => {
        if (eventQueue.length > 0) {
            // Use sendBeacon for reliable delivery on page unload
            const anonymousId = getAnonymousId();
            const userId = getUserId();
            const payload = JSON.stringify({
                userId: userId || null,
                anonymousId,
                events: eventQueue
            });

            navigator.sendBeacon(`${ANALYTICS_API_BASE}/collect`, payload);
        }
    });

    // Also flush on visibility change (tab switch/minimize)
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            flushEvents();
        }
    });
}
