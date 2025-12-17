/* static/assets/scripts/toc.js - Standalone TOC logic, copied from assets/scripts/post.js */
/* This file runs independently of Svelte, using DOMContentLoaded like the original */

(function () {
    'use strict';

    function isVisible(el) {
        return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
    }

    function getTargetById(id) {
      if (!id) return null;
      let target = document.getElementById(id);
      // If found but hidden (likely in .summary-capture), try to find a visible duplicate
      if (target && !isVisible(target)) {
        try {
          const escaped = CSS.escape(id);
          const all = document.querySelectorAll('#' + escaped);
          for (let i = 0; i < all.length; i++) {
            if (isVisible(all[i])) return all[i];
          }
        } catch (e) {}
      }
      return target;
    }

    function fixDuplicateIds() {
        // Remove IDs from the hidden summary capture div to prevent conflicts
        const hidden = document.querySelector('.summary-capture');
        if (hidden) {
            const elements = hidden.querySelectorAll('[id]');
            elements.forEach(el => el.removeAttribute('id'));
        }
    }

    function slugify(text) {
      return text.toString().toLowerCase().trim()
        .replace(/[\u2018\u2019\u201C\u201D]/g, '')
        .replace(/[^a-z0-9\s\-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/\-+/g, '-');
    }

    function buildTOCFallback() {
      const aside = document.querySelector('.post-toc');
      if (!aside) return;

      // If server-side plugin already produced content, do nothing
      if (aside.querySelector('.toc') && aside.querySelector('.toc').children.length > 0) return;

      // Prefer visible content container to avoid picking up hidden summary headings
      const postBody = document.querySelector('.post-content-visible') || document.querySelector('.post-body');
      if (!postBody) return;

      // Collect headings (skip h1 which is usually the title)
      // include only h1, h2, h3 as requested (#, ##, ###)
      const headings = postBody.querySelectorAll('h1, h2, h3');
      if (!headings || headings.length === 0) return;

      // Create nav.toc
      const nav = document.createElement('nav');
      nav.className = 'toc';

      const title = document.createElement('h2');
      title.textContent = 'On this page';
      nav.appendChild(title);

      const ul = document.createElement('ul');
      nav.appendChild(ul);

      headings.forEach(h => {
        let id = h.id;
        if (!id) {
          id = slugify(h.textContent || h.innerText || '');
          // ensure unique
          let uniq = id;
          let i = 1;
          while (document.getElementById(uniq)) {
            uniq = id + '-' + i++;
          }
          id = uniq;
          h.id = id;
        }

        const li = document.createElement('li');
        li.className = 'toc-level-' + (parseInt(h.tagName.replace('H', ''), 10));

        const a = document.createElement('a');
        a.href = '#' + id;
        
        // Clone header to remove anchor link without affecting DOM
        const clone = h.cloneNode(true);
        const anchor = clone.querySelector('.heading-anchor');
        if (anchor) {
          anchor.remove();
        }

        // Use innerHTML so any math delimiters or inline HTML remains intact for KaTeX auto-render
        a.innerHTML = clone.innerHTML || (clone.textContent || clone.innerText);
        a.addEventListener('click', function (ev) {
          ev.preventDefault();
          const target = getTargetById(id);
          if (target) {
            const offset = 80; // adjust for sticky header
            const top = target.getBoundingClientRect().top + window.scrollY - offset;
            window.scrollTo({ top, behavior: 'smooth' });
          }
        });

        li.appendChild(a);
        ul.appendChild(li);
      });

      aside.appendChild(nav);

      // If KaTeX auto-render isn't available, remove raw latex markers from links to avoid ugly $$...$$ showing
      if (typeof window.renderMathInElement !== 'function') {
        const mathStripRegex = /(\$\$[\s\S]*?\$\$|\$[^\$]*\$)/g;
        const anchors = aside.querySelectorAll('a');
        anchors.forEach(a => {
          a.innerHTML = a.innerHTML.replace(mathStripRegex, '').trim();
        });
      }
    }

    // Move `.post-toc` into `#site-toc-sidebar` and wire toggle handlers
    function wireTOCSidebar() {
      const siteSidebar = document.getElementById('site-toc-sidebar');
      const postToc = document.querySelector('.post-toc');

      if (!siteSidebar || !postToc) return;

      // Move postToc directly into sidebar (preserve content)
        if (!siteSidebar.contains(postToc)) {
            siteSidebar.appendChild(postToc);
        }
        postToc.style.display = 'block';
        siteSidebar.setAttribute('aria-hidden', 'true');
        const overlayEl = document.getElementById('site-toc-overlay');
        if (overlayEl) overlayEl.setAttribute('aria-hidden', 'true');

        // Use event delegation for the toggle button to handle Svelte hydration/replacement
        if (!window._tocHandlersAttached) {
            window._tocHandlersAttached = true;

            document.addEventListener('click', function (e) {
                const toggleBtn = e.target.closest('.toc-toggle');
                if (toggleBtn) {
                    e.preventDefault();
                    const sidebar = document.getElementById('site-toc-sidebar');
                    const overlay = document.getElementById('site-toc-overlay');
                    
                    const isOpen = document.body.classList.contains('toc-open');
                    
                    if (isOpen) {
                        // Close
                        document.body.classList.remove('toc-open');
                        if (sidebar) sidebar.setAttribute('aria-hidden', 'true');
                        if (overlay) overlay.setAttribute('aria-hidden', 'true');
                        
                        const icon = toggleBtn.querySelector('i');
                        if (icon) {
                            icon.classList.remove('fa-regular');
                            icon.classList.add('fa-light');
                        }
                    } else {
                        // Open
                        document.body.classList.add('toc-open');
                        if (sidebar) sidebar.setAttribute('aria-hidden', 'false');
                        if (overlay) overlay.setAttribute('aria-hidden', 'false');
                        
                        const icon = toggleBtn.querySelector('i');
                        if (icon) {
                            icon.classList.remove('fa-light');
                            icon.classList.add('fa-regular');
                        }
                        
                        // Center active
                        setTimeout(() => { centerActiveInSidebar('auto'); }, 120);
                    }
                }
            });

            // Close on ESC
            document.addEventListener('keydown', function (e) {
                if (e.key === 'Escape' && document.body.classList.contains('toc-open')) {
                    document.body.classList.remove('toc-open');
                    const sidebar = document.getElementById('site-toc-sidebar');
                    const overlay = document.getElementById('site-toc-overlay');
                    if (sidebar) sidebar.setAttribute('aria-hidden', 'true');
                    if (overlay) overlay.setAttribute('aria-hidden', 'true');
                    
                    // Reset icon
                    const toggleBtn = document.querySelector('.toc-toggle');
                    if (toggleBtn) {
                        const icon = toggleBtn.querySelector('i');
                        if (icon) {
                            icon.classList.remove('fa-regular');
                            icon.classList.add('fa-light');
                        }
                    }
                }
            });
            
            // Handle overlay click (if not handled by Svelte)
            document.addEventListener('click', function(e) {
                if (e.target.id === 'site-toc-overlay' && document.body.classList.contains('toc-open')) {
                     document.body.classList.remove('toc-open');
                     const sidebar = document.getElementById('site-toc-sidebar');
                     if (sidebar) sidebar.setAttribute('aria-hidden', 'true');
                     e.target.setAttribute('aria-hidden', 'true');
                     
                     // Reset icon
                    const toggleBtn = document.querySelector('.toc-toggle');
                    if (toggleBtn) {
                        const icon = toggleBtn.querySelector('i');
                        if (icon) {
                            icon.classList.remove('fa-regular');
                            icon.classList.add('fa-light');
                        }
                    }
                }
            });
        }
          // run auto-render on the sidebar so $$...$$ is converted
          if (typeof window.renderMathInElement === 'function') {
              window.renderMathInElement(siteSidebar, {
                delimiters: [
                  { left: '$$', right: '$$', display: true },
                  { left: '$', right: '$', display: false }
                ],
                throwOnError: false
              });
          }
    }

    // Center the currently active TOC link inside the sidebar (used on open and on load)
    function centerActiveInSidebar(behavior) {
      behavior = behavior || 'smooth';
      const sidebarEl = document.getElementById('site-toc-sidebar');
      if (!sidebarEl) return;
      // Skip if sidebar is display:none
      if (getComputedStyle(sidebarEl).display === 'none') return;
      const active = sidebarEl.querySelector('.toc a.active');
      if (!active) return;
      // Use scrollTo on the sidebar container directly instead of scrollIntoView
      // to avoid accidentally scrolling the main document
      try {
        const activeRect = active.getBoundingClientRect();
        const sidebarRect = sidebarEl.getBoundingClientRect();
        const currentScroll = sidebarEl.scrollTop;
        const offset = (activeRect.top - sidebarRect.top) - (sidebarEl.clientHeight / 2) + (activeRect.height / 2);
        sidebarEl.scrollTo({ top: currentScroll + offset, behavior: behavior });
      } catch (e) {
        // Silent fail - don't use scrollIntoView as fallback to prevent scroll fighting
      }
    }

    // Track active TOC link based on scroll position and clicks
    function wireTOCActiveTracking() {
      const sidebar = document.getElementById('site-toc-sidebar');
      const postBody = document.querySelector('.post-body');
      if (!sidebar || !postBody) return;

      const links = Array.from(sidebar.querySelectorAll('.toc a'));
      if (!links.length) return;

      // Map link -> target heading ID (store IDs to handle hydration/replacement)
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

      function setActive(index, shouldScrollSidebar) {
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
        if (!sidebarEl || getComputedStyle(sidebarEl).display === 'none') {
          return;
        }
        const active = links[index];
        if (active) {
          try {
            const activeRect = active.getBoundingClientRect();
            const sidebarRect = sidebarEl.getBoundingClientRect();
            const currentScroll = sidebarEl.scrollTop;
            const offset = (activeRect.top - sidebarRect.top) - (sidebarEl.clientHeight / 2) + (activeRect.height / 2);
            sidebarEl.scrollTo({ top: currentScroll + offset, behavior: 'smooth' });
          } catch (e) {
            // Silent fail
          }
        }
      }

      // on click, mark active and scroll sidebar
      links.forEach((a, i) => {
        a.addEventListener('click', (ev) => {
          setActive(i, true); // true = scroll sidebar to active item
          suspendScrollHandler = true;
          if (suspendTimeoutId) clearTimeout(suspendTimeoutId);
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
          const el = getTargetById(id); // Dynamic lookup to handle hydration
          
          if (!el) continue;
          // Ignore hidden or detached elements to prevent jumping to top
          if (!el.getClientRects().length) continue;

          const rect = el.getBoundingClientRect();
          const offset = Math.abs(rect.top - 120);
          if (rect.top <= 150 && offset < bestOffset) {
            best = i; bestOffset = offset;
          }
        }
        
        if (best >= 0) {
            setActive(best, true);
        } else if (linkIds.length > 0) {
            // Default to first item if above all headings (e.g. at top of page)
            setActive(0, true);
        }
      }

      // Use requestAnimationFrame-based throttle for smoother performance
      let ticking = false;
      const scrollHandler = function() {
        if (!ticking && !suspendScrollHandler) {
          requestAnimationFrame(function() {
            onScroll();
            ticking = false;
          });
          ticking = true;
        }
      };

      // Clean up previous listener if exists
      if (window._tocScrollHandler) {
          document.removeEventListener('scroll', window._tocScrollHandler);
      }
      window._tocScrollHandler = scrollHandler;
      document.addEventListener('scroll', scrollHandler, { passive: true });
      
      // initial highlight
      setTimeout(() => { onScroll(); }, 600);
    }

    // Initialize everything when DOM is ready
    function initTOC() {
        try {
            fixDuplicateIds();
        } catch (e) { }
        try {
            buildTOCFallback();
        } catch (e) {
            console.error('Error building TOC fallback:', e);
        }
        try {
            wireTOCSidebar();
        } catch (e) {
            console.error('Error wiring TOC sidebar:', e);
        }
        try {
            wireTOCActiveTracking();
        } catch (e) { }
    }

    // Run on DOMContentLoaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTOC);
    } else {
        // DOM already loaded (e.g., script loaded async or defer)
        initTOC();
    }

    // Also expose for manual re-initialization if needed (e.g., after SvelteKit navigation)
    window.initTOC = initTOC;

})();
