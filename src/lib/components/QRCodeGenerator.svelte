<script>
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
      <button onclick={downloadQRCode} class="btn-action" title="Download QR Code">
        <i class="fa-solid fa-download"></i>
        Download
      </button>
      <button onclick={copyToClipboard} class="btn-action" title="Copy to Clipboard">
        <i class="fa-solid fa-copy"></i>
        Copy
      </button>
    </div>
  {/if}
</div>

<style>
  .qr-code-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    padding: 20px;
    background: var(--card-bg, #fff);
    border-radius: 12px;
    border: 1px solid var(--border, rgba(0, 0, 0, 0.1));
  }

  .qr-code-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .qr-code-wrapper :global(canvas) {
    display: block;
    border-radius: 8px;
  }

  .qr-code-actions {
    display: flex;
    gap: 12px;
    width: 100%;
    justify-content: center;
  }

  .btn-action {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: #ff8200;
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    transition: all 0.2s ease;
    font-family: var(--font-primary, system-ui);
  }

  .btn-action:hover {
    background: #e67300;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(255, 130, 0, 0.3);
  }

  .btn-action:active {
    transform: translateY(0);
  }

  .btn-action i {
    font-size: 16px;
  }

  :global(body.dark) .qr-code-container {
    background: #1e1e1e;
    border-color: #333;
  }

  .hide-container {
    padding: 0 !important;
    background: transparent !important;
    border: none !important;
    gap: 0 !important;
  }
</style>
