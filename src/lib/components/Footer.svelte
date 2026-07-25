<script>
  import { browser } from "$app/environment";
  import { onMount } from "svelte";

  let props = $props();

  // Scroll button states
  let scrollY = $state(0);
  let pageHeight = $state(0);
  let windowHeight = $state(0);
  let footerOffset = $state(0);

  let showScrollTop = $derived(scrollY > 200);
  let showScrollBottom = $derived(
    pageHeight > 0 && scrollY < pageHeight - windowHeight - 200,
  );

  function updateScrollInfo() {
    if (!browser) return;
    scrollY = window.scrollY;
    pageHeight = document.documentElement.scrollHeight;
    windowHeight = window.innerHeight;

    // Logic to prevent overlap with footer
    const footer = document.querySelector(".site-footer");
    if (footer) {
      const footerRect = footer.getBoundingClientRect();
      // If the top of the footer enters the viewport
      if (footerRect.top < windowHeight) {
        footerOffset = windowHeight - footerRect.top;
      } else {
        footerOffset = 0;
      }
    }

    // Expose footer offset globally so floating UI can stay in sync.
    document.documentElement.style.setProperty(
      "--global-footer-offset",
      `${footerOffset}px`,
    );
  }

  onMount(() => {
    updateScrollInfo();
    window.addEventListener("scroll", updateScrollInfo, { passive: true });
    window.addEventListener("resize", updateScrollInfo);

    // Initial check after everything loads
    setTimeout(updateScrollInfo, 1000);

    return () => {
      window.removeEventListener("scroll", updateScrollInfo);
      window.removeEventListener("resize", updateScrollInfo);
      document.documentElement.style.setProperty("--global-footer-offset", "0px");
    };
  });

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // @ts-ignore
  function scrollToBottom() {
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: "smooth",
    });
  }
</script>

<div class="global-scroll-controls" style="--footer-offset: {footerOffset}px">
  <button
    class="scroll-btn top"
    class:visible={showScrollTop}
    onclick={scrollToTop}
    aria-label="Scroll to top"
  >
    <i class="fa-solid fa-arrow-up"></i>
  </button>
  <button
    class="scroll-btn bottom"
    class:visible={showScrollBottom}
    onclick={scrollToBottom}
    aria-label="Scroll to bottom"
  >
    <i class="fa-solid fa-arrow-down"></i>
  </button>
</div>

<footer class="site-footer" data-highlight-exclude>
  <div class="footer-img">
    <img src="/assets/img/banner.svg" alt="Banner" width="279" height="47" />
  </div>
  <div class="footer-content">
    <p>
      &copy; {new Date().getFullYear()} Materio - The Insightroom
    </p>
  </div>
</footer>



