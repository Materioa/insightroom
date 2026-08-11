import { smoothCorners } from "@lisse/svelte";

/**
 * Automatically applies Lisse squircle corners to visual elements with a computed border-radius >= 8px.
 * Uses a highly optimized two-pass batch execution (Read-then-Write) to eliminate layout thrashing.
 */
export function initGlobalSquircles() {
    if (typeof window === "undefined") return;

    const targetSelectors = [
        // Interactive Elements
        "button",
        "input[type='text']",
        "input[type='email']",
        "input[type='password']",
        "input[type='search']",
        "textarea",
        "select",
        "a.btn",
        "a.category-pill",
        "a.font-option-card",
        "a.uncategorized-item",
        ".btn",
        ".category-pill",
        ".tag-pill",
        ".toast-btn",
        ".mcq-reset-btn",
        // Media/Graphics
        "img",
        "video",
        "canvas",
        ".post-preview-img",
        ".post-image",
        ".quick-reads-image",
        // Callouts & Blockquotes
        "blockquote",
        "[data-callout]",
        ".callout-note",
        ".callout-tip",
        ".callout-important",
        ".callout-warning",
        ".callout-caution",
        // Specific Visual Cards and Containers (with background/borders)
        ".attachment-card",
        ".quick-reads-card",
        ".post-card",
        ".font-option-card",
        ".modal-content",
        ".uncategorized-posts",
        ".toast-region *",
        ".mcq-card",
        ".mcq-option",
        // All elements inside any iframe's sandboxed document viewports
        ".artifact-viewport *",
        "[class*='scm-']"
    ].join(", ");

    /** @type {MutationObserver[]} */
    const iframeObservers = [];

    /**
     * @param {HTMLIFrameElement} iframe
     * @param {Document} doc
     */
    function observeIframe(iframe, doc) {
        const obs = new MutationObserver((mutations) => {
            let shouldRun = false;
            for (const mutation of mutations) {
                // Clean up destroyed elements inside the iframe to prevent SVG overlay leaks
                mutation.removedNodes.forEach((node) => {
                    if (node instanceof HTMLElement) {
                        const elementsWithLisse = node.querySelectorAll("[data-global-squircle='true']");
                        elementsWithLisse.forEach((child) => {
                            // @ts-ignore
                            if (child instanceof HTMLElement && typeof child.__lisse_destroy === "function") {
                                // @ts-ignore
                                child.__lisse_destroy();
                            }
                        });
                        
                        // @ts-ignore
                        if (node.dataset.globalSquircle === "true" && typeof node.__lisse_destroy === "function") {
                            // @ts-ignore
                            node.__lisse_destroy();
                        }
                    }
                });

                if (mutation.addedNodes.length > 0) {
                    shouldRun = true;
                }
            }
            
            if (shouldRun) {
                requestAnimationFrame(applySquircles);
            }
        });
        obs.observe(doc.body, {
            childList: true,
            subtree: true
        });
        iframeObservers.push(obs);
    }

    function applySquircles() {
        const elements = Array.from(document.querySelectorAll(targetSelectors));

        // Gather elements from same-origin artifact iframes
        const iframes = document.querySelectorAll('iframe.artifact-iframe');
        iframes.forEach(el => {
            if (!(el instanceof HTMLIFrameElement)) return;
            const iframe = el;
            try {
                const doc = iframe.contentDocument || iframe.contentWindow?.document;
                if (doc && doc.body) {
                    elements.push(...doc.querySelectorAll(targetSelectors));

                    // Add observer to iframe document if not already done
                    // @ts-ignore
                    if (!iframe.__observed) {
                        // @ts-ignore
                        iframe.__observed = true;
                        observeIframe(iframe, doc);
                    }

                    // Add load listener in case the content is still rendering
                    // @ts-ignore
                    if (!iframe.__loadListenerAdded) {
                        // @ts-ignore
                        iframe.__loadListenerAdded = true;
                        iframe.addEventListener('load', () => {
                            requestAnimationFrame(applySquircles);
                        });
                    }
                }
            } catch (e) {
                // Cross-origin fallback
            }
        });

        /** @type {{ el: HTMLElement, radius: number, needsOverlay: boolean }[]} */
        const toApply = [];

        // --- PASS 1: Read Phase (Collect computed styles without mutating the DOM) ---
        elements.forEach((element) => {
            if (!(element instanceof HTMLElement)) return;
            const el = element;

            // Skip if already processed
            if (el.dataset.globalSquircle === "true") {
                return;
            }

            // Skip code blocks / math / layout structures
            if (
                el.closest("pre") ||
                el.closest("code") ||
                el.closest(".katex") ||
                el.closest(".math-block")
            ) {
                return;
            }

            const elWin = el.ownerDocument?.defaultView || window;
            const computedStyle = elWin.getComputedStyle(el);
            
            // Skip fixed position elements (they detach from relative overlays)
            if (computedStyle.position === "fixed") return;

            const borderRadius = computedStyle.borderRadius;
            
            // Apply only if the element has a valid non-circular border-radius
            if (borderRadius && borderRadius !== "0px" && !borderRadius.includes("%")) {
                const radiusVal = parseFloat(borderRadius);
                if (!isNaN(radiusVal) && radiusVal >= 8) {
                    // Mark as processed synchronously
                    el.dataset.globalSquircle = "true";

                    // Detect if the element has an outer box shadow.
                    // We only use autoEffects: true if it has an outer box shadow (which is static).
                    // Inset shadows and borders do not require autoEffects since they are inside the element and don't get clipped.
                    const hasOuterShadow = computedStyle.boxShadow && 
                                           computedStyle.boxShadow !== "none" && 
                                           !computedStyle.boxShadow.includes("inset") &&
                                           !computedStyle.boxShadow.includes("rgba(0, 0, 0, 0) 0px 0px 0px");
                    
                    const needsOverlay = !!hasOuterShadow;
                    
                    // Add attribute so global CSS only overrides border-radius to 0 when an SVG overlay is created
                    if (needsOverlay) {
                        el.dataset.lisseOverlay = "true";
                    } else {
                        el.dataset.lisseOverlay = "false";
                    }

                    toApply.push({ el, radius: radiusVal, needsOverlay });
                }
            }
        });

        // --- PASS 2: Write Phase (Mutate the DOM in a single batched pass) ---
        toApply.forEach(({ el, radius, needsOverlay }) => {
            try {
                // Call smoothCorners and store its destroy function on the element for cleanups
                const result = smoothCorners(el, {
                    corners: { radius, smoothing: 0.6 }, // iOS-style smoothing
                    autoEffects: needsOverlay
                });
                
                if (result && typeof result.destroy === "function") {
                    // @ts-ignore
                    el.__lisse_destroy = result.destroy;
                }
            } catch (err) {
                console.error("Failed to apply smoothCorner:", el, err);
            }
        });
    }

    // Run initially
    applySquircles();

    // Use MutationObserver to apply squircles to added nodes AND clean up overlays from removed nodes
    const observer = new MutationObserver((mutations) => {
        let shouldRun = false;
        
        for (const mutation of mutations) {
            // Clean up destroyed elements to prevent SVG overlay leaks
            mutation.removedNodes.forEach((node) => {
                if (node instanceof HTMLElement) {
                    const elementsWithLisse = node.querySelectorAll("[data-global-squircle='true']");
                    elementsWithLisse.forEach((child) => {
                        // @ts-ignore
                        if (child instanceof HTMLElement && typeof child.__lisse_destroy === "function") {
                            // @ts-ignore
                            child.__lisse_destroy();
                        }
                    });
                    
                    // @ts-ignore
                    if (node.dataset.globalSquircle === "true" && typeof node.__lisse_destroy === "function") {
                        // @ts-ignore
                        node.__lisse_destroy();
                    }
                }
            });

            if (mutation.addedNodes.length > 0) {
                shouldRun = true;
            }
        }
        
        if (shouldRun) {
            requestAnimationFrame(applySquircles);
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // Return destroy function for cleanup
    return () => {
        observer.disconnect();
        iframeObservers.forEach(obs => obs.disconnect());
    };
}
