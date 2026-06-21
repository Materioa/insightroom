<script>
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';

  // Props using Svelte 5 runes
  /** @type {{ postId: string, slug: string, title: string }} */
  let { postId, slug, title } = $props();

  let sessionId = '';
  let duration = 0; // in seconds
  let scrollDepth = 0;
  let lastLeftOff = 'Beginning';
  let claps = 0;
  
  /** @type {Array<{ id: string, tag: string, text: string, timestamp: Date }>} */
  let clicks = [];
  
  /** @type {Array<{ type: string, value: string, timestamp: Date }>} */
  let settingsChanges = [];

  /** @type {any} */
  let intervalId;
  /** @type {any} */
  let activeTimerId;
  let isPageActive = true;

  let isUserIdle = false;
  /** @type {any} */
  let idleTimeoutId;

  // Generate or retrieve a session ID
  function getOrCreateSessionId() {
    const storageKey = `insightroom_session_${postId}`;
    let storedSession = null;
    
    try {
      storedSession = sessionStorage.getItem(storageKey);
    } catch (e) {}

    if (storedSession) return storedSession;

    let newId = '';
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      newId = crypto.randomUUID();
    } else {
      newId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }

    try {
      sessionStorage.setItem(storageKey, newId);
    } catch (e) {}

    return newId;
  }

  // Reset idle timer (1.5 minutes)
  function resetIdleTimer() {
    isUserIdle = false;
    if (idleTimeoutId) clearTimeout(idleTimeoutId);
    idleTimeoutId = setTimeout(() => {
      isUserIdle = true;
    }, 90000);
  }

  // Get current telemetry payload
  function getPayload() {
    return {
      postId,
      slug,
      title,
      sessionId,
      duration,
      scrollDepth,
      lastLeftOff,
      claps,
      clicks,
      settingsChanges
    };
  }

  // Send data to ingestion API
  function sendTelemetry(isFinal = false) {
    if (!browser || !sessionId || !postId) return;
    
    const payload = getPayload();
    
    // Only send if there is some activity to record
    if (duration === 0 && clicks.length === 0 && claps === 0 && scrollDepth === 0 && !isFinal) {
      return;
    }

    const url = '/api/analytics/track';
    const bodyStr = JSON.stringify(payload);

    if (isFinal && typeof navigator !== 'undefined' && navigator.sendBeacon) {
      // Use sendBeacon for final unload if possible
      const blob = new Blob([bodyStr], { type: 'application/json' });
      navigator.sendBeacon(url, blob);
    } else {
      // Standard fetch with keepalive: true for heartbeat/unloads
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: bodyStr,
        keepalive: true
      }).catch(err => console.warn('[AnalyticsTracker] Send failed:', err));
    }
  }

  // Track active reading time
  function startActiveTimeTracker() {
    if (activeTimerId) clearInterval(activeTimerId);
    activeTimerId = setInterval(() => {
      if (isPageActive && document.visibilityState === 'visible' && !isUserIdle) {
        duration += 1;
      }
    }, 1000);
  }

  // Track scroll activity and determine last left off section
  function handleScroll() {
    resetIdleTimer();
    if (!browser) return;
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    
    if (scrollHeight > 0) {
      const currentScroll = Math.round((scrollTop / scrollHeight) * 100);
      if (currentScroll > scrollDepth) {
        scrollDepth = currentScroll;
      }
    }

    // Determine current section (nearest heading)
    if (scrollTop < 100) {
      lastLeftOff = 'Beginning';
      return;
    }

    const headings = document.querySelectorAll('.post-content-visible h2, .post-content-visible h3, .post-content-visible h4, article.post h2, article.post h3, article.post h4');
    let currentHeading = lastLeftOff;
    
    headings.forEach(heading => {
      const rect = heading.getBoundingClientRect();
      // If heading is near top of viewport or has been scrolled past
      if (rect.top <= 120) {
        const text = heading.textContent || '';
        const tag = heading.tagName.toLowerCase();
        currentHeading = `${tag.toUpperCase()}: ${text.trim().substring(0, 50)}`;
      }
    });

    lastLeftOff = currentHeading;
  }

  // Track click activity
  /** @param {MouseEvent} event */
  function handleDocumentClick(event) {
    resetIdleTimer();
    let target = /** @type {HTMLElement} */ (event.target);
    if (!target) return;

    // Traverse up to find buttons, links, or custom interactive roles
    let element = target;
    let interactiveEl = null;

    while (element && element !== document.body) {
      const tagName = element.tagName.toLowerCase();
      const role = element.getAttribute('role');
      const isClickableClass = Array.from(element.classList).some(cls => 
        cls.includes('btn') || 
        cls.includes('button') || 
        cls.includes('pill') || 
        cls.includes('icon') ||
        cls.includes('clickable')
      );

      if (tagName === 'button' || tagName === 'a' || role === 'button' || isClickableClass) {
        interactiveEl = element;
        break;
      }
      element = /** @type {HTMLElement} */ (element.parentElement);
    }

    if (interactiveEl) {
      const id = interactiveEl.id || Array.from(interactiveEl.classList).join('.') || 'unnamed-element';
      const tag = interactiveEl.tagName.toLowerCase();
      
      // Get human readable text/label
      let text = interactiveEl.innerText || interactiveEl.getAttribute('title') || interactiveEl.getAttribute('aria-label') || '';
      text = text.trim().substring(0, 60);

      // Avoid collecting highly sensitive form values
      if (!text && interactiveEl.querySelector('i')) {
        // Fallback to icon class
        const icon = interactiveEl.querySelector('i');
        text = Array.from(icon?.classList || []).filter(c => c.startsWith('fa-')).join(' ');
      }

      if (!text) {
        text = interactiveEl.getAttribute('href') || 'icon-button';
      }

      clicks.push({
        id,
        tag,
        text: text || 'Interactive element',
        timestamp: new Date()
      });

      // Keep click log capped to prevent payload explosion
      if (clicks.length > 50) {
        clicks = clicks.slice(-50);
      }
    }
  }

  // Listen to custom Svelte events/Cookie alterations for settings changes
  /** @param {Event} event */
  function handleThemeChange(event) {
    const customEvent = /** @type {CustomEvent} */ (event);
    const theme = customEvent.detail.isDark ? 'dark' : 'light';
    
    settingsChanges.push({
      type: 'theme',
      value: theme,
      timestamp: new Date()
    });
  }

  /** @param {Event} event */
  function handleFontChange(event) {
    const customEvent = /** @type {CustomEvent} */ (event);
    const font = customEvent.detail.font;
    
    settingsChanges.push({
      type: 'font',
      value: font,
      timestamp: new Date()
    });
  }

  // Listen to clap events
  /** @param {Event} event */
  function handleClapEvent(event) {
    const customEvent = /** @type {CustomEvent} */ (event);
    const count = customEvent.detail.count || 1;
    claps += count;
  }

  onMount(() => {
    if (!browser) return;

    sessionId = getOrCreateSessionId();

    // Trigger initial pageview tracking
    setTimeout(() => {
      resetIdleTimer();
      handleScroll(); // initial state
      sendTelemetry(false);
    }, 1000);

    // Setup Event Listeners
    window.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('click', handleDocumentClick, { passive: true });
    window.addEventListener('mousemove', resetIdleTimer, { passive: true });
    window.addEventListener('keydown', resetIdleTimer, { passive: true });
    window.addEventListener('touchstart', resetIdleTimer, { passive: true });
    window.addEventListener('themeChanged', handleThemeChange);
    window.addEventListener('fontChanged', handleFontChange);
    window.addEventListener('post-clap', handleClapEvent);

    // Listen to tab visibility to pause timer
    document.addEventListener('visibilitychange', () => {
      isPageActive = document.visibilityState === 'visible';
      if (!isPageActive) {
        sendTelemetry(false); // Send current state when tab goes background
      }
    });

    // Unload listeners
    window.addEventListener('pagehide', () => sendTelemetry(true));
    window.addEventListener('beforeunload', () => sendTelemetry(true));

    // Timers
    startActiveTimeTracker();
    
    // Heartbeat every 2 minutes (liberal interval to save Vercel requests)
    intervalId = setInterval(() => {
      sendTelemetry(false);
    }, 120000);

    return () => {
      clearInterval(intervalId);
      clearInterval(activeTimerId);
      if (idleTimeoutId) clearTimeout(idleTimeoutId);
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('click', handleDocumentClick);
      window.removeEventListener('mousemove', resetIdleTimer);
      window.removeEventListener('keydown', resetIdleTimer);
      window.removeEventListener('touchstart', resetIdleTimer);
      window.removeEventListener('themeChanged', handleThemeChange);
      window.removeEventListener('fontChanged', handleFontChange);
      window.removeEventListener('post-clap', handleClapEvent);
      sendTelemetry(true);
    };
  });

  onDestroy(() => {
    if (browser) {
      sendTelemetry(true);
    }
  });
</script>

<!-- Transparent element representing the tracker -->
<div class="analytics-tracker" style="display: none;" aria-hidden="true"></div>
