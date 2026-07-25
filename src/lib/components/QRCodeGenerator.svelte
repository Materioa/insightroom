<script>
  import { smoothCorners } from "@lisse/svelte";
  import { onMount } from 'svelte';

  let { 
    data = '', 
    size = 300, 
    colorDark = '#000000', 
    colorLight = '#FFFFFF', 
    hideActions = false,
    hideContainer = false
  } = $props();

  /** @type {HTMLDivElement | null} */
  let containerRef = $state(null);
  
  /** @type {any} */
  let qrCodeInstance = $state(null);

  onMount(async () => {
    if (typeof window !== 'undefined' && containerRef) {
      const { default: QRCodeStyling } = await import('qr-code-styling');

      qrCodeInstance = new QRCodeStyling({
        type: 'svg',
        width: size,
        height: size,
        data: data || window.location.href,
        dotsOptions: {
          color: colorDark,
          type: 'rounded',
        },
        backgroundOptions: {
          color: colorLight,
        },
        cornersSquareOptions: {
          color: colorDark,
          type: 'square',
        },
        cornersDotOptions: {
          color: colorDark,
          type: 'square',
        },
        qrOptions: {
          errorCorrectionLevel: 'H',
        },
      });

      if (containerRef && qrCodeInstance) {
        containerRef.innerHTML = '';
        qrCodeInstance.append(containerRef);
      }
    }
  });

  function downloadQRCode() {
    if (qrCodeInstance) {
      qrCodeInstance.download({ name: 'qr-code', extension: 'png' });
    }
  }

  function copyToClipboard() {
    if (qrCodeInstance) {
      qrCodeInstance.getRawData('png').then((/** @type {Blob} */ blob) => {
        if (blob) {
          navigator.clipboard.write([
            new ClipboardItem({
              'image/png': blob,
            }),
          ]);
        }
      });
    }
  }
</script>

<div class="qr-code-container" class:hide-container={hideContainer}>
  <div bind:this={containerRef} class="qr-code-wrapper"></div>
  {#if !hideActions}
    <div class="qr-code-actions">
      <button use:smoothCorners={{ corners: { radius: 25, smoothing: 0.6 } }} onclick={downloadQRCode} class="btn-action" title="Download QR Code">
        <i class="fa-solid fa-download"></i>
        Download
      </button>
      <button use:smoothCorners={{ corners: { radius: 25, smoothing: 0.6 } }} onclick={copyToClipboard} class="btn-action" title="Copy to Clipboard">
        <i class="fa-solid fa-copy"></i>
        Copy
      </button>
    </div>
  {/if}
</div>


