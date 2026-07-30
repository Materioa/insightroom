<script>
    import { onMount } from 'svelte';
    import { smoothCorners } from "@lisse/svelte";

    // State for interactive features in the guide (Svelte 5 Runes)
    let sliderVal = $state(5);
    let checked1 = $state(true);
    let checked2 = $state(false);
    let toggleVal = $state(true);
    let activeTab = $state('tab1');
    let activeNode = $state('node1');

    // State for code display collapse (typed for index access)
    /** @type {Record<string, boolean>} */
    let showCodes = $state({
        buttons: false,
        inputs: false,
        layouts: false,
        ciphers: false,
        alerts: false
    });

    // State for preview theme override
    let previewTheme = $state('system'); // 'light', 'dark', or 'system'
    let systemPrefersDark = $state(false);

    onMount(() => {
        if (typeof window !== 'undefined') {
            const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
            systemPrefersDark = mediaQuery.matches;
            
            /** @param {MediaQueryListEvent} e */
            const handler = (e) => { systemPrefersDark = e.matches; };
            mediaQuery.addEventListener("change", handler);
            return () => mediaQuery.removeEventListener("change", handler);
        }
    });

    let isDark = $derived(
        previewTheme === 'dark' || (previewTheme === 'system' && systemPrefersDark)
    );

    // Copies text to clipboard
    /** @param {string} text @param {string} key */
    function copyCode(text, key) {
        navigator.clipboard.writeText(text);
        alert(`Copied code for ${key}!`);
    }

    // Toggle collapse
    /** @param {string} section */
    function toggleCode(section) {
        showCodes[section] = !showCodes[section];
    }
</script>

<svelte:head>
    <title>Artifacts Style Guide - Insightroom</title>
    <link rel="icon" type="image/x-icon" href="/assets/img/room-icon-x.svg" />
</svelte:head>

<div class="cms-wrapper">
    <!-- Header -->
    <div class="cms-header">
        <div class="header-left">
            <a href="/writer" class="back-link">
                <i class="fa-solid fa-arrow-left"></i> Writer's Desk
            </a>
            <h1 style="margin-left: 15px;">Artifacts Style Guide</h1>
        </div>
        <div class="header-right">
            <!-- Mode Selector for checking styles -->
            <div class="theme-pill-selector">
                <button 
                    class:active={previewTheme === 'light'} 
                    onclick={() => { previewTheme = 'light'; }}
                >Light</button>
                <button 
                    class:active={previewTheme === 'dark'} 
                    onclick={() => { previewTheme = 'dark'; }}
                >Dark</button>
                <button 
                    class:active={previewTheme === 'system'} 
                    onclick={() => { previewTheme = 'system'; }}
                >System</button>
            </div>
        </div>
    </div>

    <div class="guide-intro">
        <p>This style guide details the unified CSS classes and standard HTML element styles built for embedded artifact code blocks (e.g. <code>```artifact</code> ciphers, visual charts, and math models). Artifacts automatically inherit these classes, removing the need for creators to write repetitive local inline styles.</p>
        <div class="alert alert-note">
            <strong>Protip:</strong> Simply add <code>class="artifact-viewport"</code> to your top-level wrapper or body in your artifact code block if you are using it outside the standard post iframe. In posts, the system injects this class automatically!
        </div>
    </div>

    <!-- Preview Container with override themes -->
    <div class="preview-canvas" class:dark-mode={isDark} class:light-mode={!isDark}>
        <div class="artifact-viewport">
            
            <!-- SECTION 1: Buttons & Toggles -->
            <div class="guide-section">
                <div class="section-header">
                    <h2>Buttons & Interactive Controls</h2>
                    <button class="btn btn-secondary btn-sm" onclick={() => toggleCode('buttons')}>
                        <i class="fa-solid fa-code"></i> {showCodes.buttons ? 'Hide Code' : 'Show Code'}
                    </button>
                </div>
                
                <div class="demo-block">
                    <h4>Buttons</h4>
                    <div class="flex-row flex-wrap gap-3 items-center">
                        <button class="btn">Primary Button</button>
                        <button class="btn btn-secondary">Secondary Button</button>
                        <button class="btn btn-success"><i class="fa-solid fa-check"></i> Success</button>
                        <button class="btn btn-danger"><i class="fa-solid fa-trash"></i> Danger</button>
                        <button class="btn" disabled>Disabled</button>
                    </div>

                    <h4 style="margin-top: 20px;">Checkboxes, Radios & Switches</h4>
                    <div class="flex-row flex-wrap gap-4 items-center">
                        <label class="flex-row items-center cursor-pointer">
                            <input type="checkbox" bind:checked={checked1} />
                            Checkbox 1 ({checked1 ? 'Checked' : 'Unchecked'})
                        </label>
                        <label class="flex-row items-center cursor-pointer">
                            <input type="checkbox" bind:checked={checked2} />
                            Checkbox 2 ({checked2 ? 'Checked' : 'Unchecked'})
                        </label>
                        <label class="flex-row items-center cursor-pointer">
                            <input type="checkbox" class="toggle-switch" bind:checked={toggleVal} />
                            Toggle Switch ({toggleVal ? 'On' : 'Off'})
                        </label>
                        <label class="flex-row items-center cursor-pointer">
                            <input type="radio" name="demo-radio" checked /> Radio Option A
                        </label>
                        <label class="flex-row items-center cursor-pointer">
                            <input type="radio" name="demo-radio" /> Radio Option B
                        </label>
                    </div>
                </div>

                {#if showCodes.buttons}
                    <div class="code-block-container">
                        <button class="copy-btn" onclick={() => copyCode(
`<button class="btn">Primary Button</button>
<button class="btn btn-secondary">Secondary Button</button>
<button class="btn btn-success"><i class="fa-solid fa-check"></i> Success</button>
<button class="btn btn-danger"><i class="fa-solid fa-trash"></i> Danger</button>

<label><input type="checkbox" checked /> Checkbox</label>
<label><input type="checkbox" class="toggle-switch" checked /> Toggle Switch</label>
<label><input type="radio" name="grp" checked /> Option A</label>`, 'Buttons & Toggles')}>Copy</button>
                        <pre><code>&lt;button class="btn"&gt;Primary Button&lt;/button&gt;
&lt;button class="btn btn-secondary"&gt;Secondary/Outline Button&lt;/button&gt;
&lt;button class="btn btn-success"&gt;&lt;i class="fa-solid fa-check"&gt;&lt;/i&gt; Success&lt;/button&gt;
&lt;button class="btn btn-danger"&gt;&lt;i class="fa-solid fa-trash"&gt;&lt;/i&gt; Danger&lt;/button&gt;

&lt;!-- Custom Checkbox & Radio --&gt;
&lt;label&gt;&lt;input type="checkbox" checked /&gt; Checked Checkbox&lt;/label&gt;
&lt;label&gt;&lt;input type="checkbox" class="toggle-switch" checked /&gt; Toggle Switch&lt;/label&gt;
&lt;label&gt;&lt;input type="radio" name="group" checked /&gt; Radio Option&lt;/label&gt;</code></pre>
                    </div>
                {/if}
            </div>

            <!-- SECTION 2: Form Inputs & Sliders -->
            <div class="guide-section">
                <div class="section-header">
                    <h2>Inputs, Dropdowns & Sliders</h2>
                    <button class="btn btn-secondary btn-sm" onclick={() => toggleCode('inputs')}>
                        <i class="fa-solid fa-code"></i> {showCodes.inputs ? 'Hide Code' : 'Show Code'}
                    </button>
                </div>
                
                <div class="demo-block">
                    <div class="grid-cols-2">
                        <div class="flex-col gap-2">
                            <label for="demo-text">Text Input</label>
                            <input type="text" id="demo-text" placeholder="Type something premium..." />
                        </div>
                        <div class="flex-col gap-2">
                            <label for="demo-select">Select Dropdown</label>
                            <select id="demo-select">
                                <option>Vigenère Cipher</option>
                                <option>Caesar Cipher</option>
                                <option>Hill Cipher</option>
                                <option>One-Time Pad</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="flex-col gap-2" style="margin-top: 15px;">
                        <label for="demo-range" class="flex-row justify-between">
                            <span>Sleek Premium Slider</span>
                            <span class="slider-value">Shift Key: <strong>{sliderVal}</strong></span>
                        </label>
                        <input type="range" id="demo-range" min="0" max="25" bind:value={sliderVal} />
                    </div>
                </div>

                {#if showCodes.inputs}
                    <div class="code-block-container">
                        <button class="copy-btn" onclick={() => copyCode(
`<input type="text" placeholder="Type something..." />

<select>
  <option>Option 1</option>
</select>

<label>Key: <span id="val">5</span></label>
<input type="range" min="0" max="25" value="5" id="slider" />`, 'Inputs & Sliders')}>Copy</button>
                        <pre><code>&lt;!-- Standard Text Input --&gt;
&lt;input type="text" placeholder="Type something..." /&gt;

&lt;!-- Dropdown Select --&gt;
&lt;select&gt;
  &lt;option&gt;Option 1&lt;/option&gt;
&lt;/select&gt;

&lt;!-- Range Slider --&gt;
&lt;label&gt;Slider Label&lt;/label&gt;
&lt;input type="range" min="0" max="25" value="5" /&gt;</code></pre>
                    </div>
                {/if}
            </div>

            <!-- SECTION 3: Layouts & Tables -->
            <div class="guide-section">
                <div class="section-header">
                    <h2>Layout Utilities & Data Tables</h2>
                    <button class="btn btn-secondary btn-sm" onclick={() => toggleCode('layouts')}>
                        <i class="fa-solid fa-code"></i> {showCodes.layouts ? 'Hide Code' : 'Show Code'}
                    </button>
                </div>
                
                <div class="demo-block">
                    <h4>Flex Grid Layout (4 columns)</h4>
                    <div class="grid-cols-4" style="margin-bottom: 20px;">
                        <div class="card" style="margin: 0; text-align: center;">Col 1</div>
                        <div class="card" style="margin: 0; text-align: center;">Col 2</div>
                        <div class="card" style="margin: 0; text-align: center;">Col 3</div>
                        <div class="card" style="margin: 0; text-align: center;">Col 4</div>
                    </div>

                    <h4>Data Table (<code>.data-table</code>)</h4>
                    <div class="table-container">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Cipher Scheme</th>
                                    <th>Key Size</th>
                                    <th>Security Level</th>
                                    <th>Type</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>Caesar Cipher</td>
                                    <td>1 Shift (0-25)</td>
                                    <td>Trivial / Weak</td>
                                    <td>Monoalphabetic</td>
                                </tr>
                                <tr>
                                    <td>Vigenère</td>
                                    <td>Variable Keyword</td>
                                    <td>Weak (Kasiski)</td>
                                    <td>Polyalphabetic</td>
                                </tr>
                                <tr>
                                    <td>One-Time Pad</td>
                                    <td>≥ Plaintext Length</td>
                                    <td>Perfect / Unbreakable</td>
                                    <td>Vernam Stream</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {#if showCodes.layouts}
                    <div class="code-block-container">
                        <button class="copy-btn" onclick={() => copyCode(
`<div class="grid-cols-2">
  <div>Column 1</div>
  <div>Column 2</div>
</div>

<div class="table-container">
  <table class="data-table">
    <thead>
      <tr><th>Header 1</th><th>Header 2</th></tr>
    </thead>
    <tbody>
      <tr><td>Cell 1</td><td>Cell 2</td></tr>
    </tbody>
  </table>
</div>`, 'Layouts & Tables')}>Copy</button>
                        <pre><code>&lt;!-- Grid Helper (2 Column Layout) --&gt;
&lt;div class="grid-cols-2"&gt;
  &lt;div&gt;Column 1 Content&lt;/div&gt;
  &lt;div&gt;Column 2 Content&lt;/div&gt;
&lt;/div&gt;

&lt;!-- Data Table with Container --&gt;
&lt;div class="table-container"&gt;
  &lt;table class="data-table"&gt;
    &lt;thead&gt;
      &lt;tr&gt;
        &lt;th&gt;Header A&lt;/th&gt;
        &lt;th&gt;Header B&lt;/th&gt;
      &lt;/tr&gt;
    &lt;/thead&gt;
    &lt;tbody&gt;
      &lt;tr&gt;
        &lt;td&gt;Data 1&lt;/td&gt;
        &lt;td&gt;Data 2&lt;/td&gt;
      &lt;/tr&gt;
    &lt;/tbody&gt;
  &lt;/table&gt;
&lt;/div&gt;</code></pre>
                    </div>
                {/if}
            </div>

            <!-- SECTION 4: Interactive Cipher Visuals -->
            <div class="guide-section">
                <div class="section-header">
                    <h2>Cipher Specific & Visual Components</h2>
                    <button class="btn btn-secondary btn-sm" onclick={() => toggleCode('ciphers')}>
                        <i class="fa-solid fa-code"></i> {showCodes.ciphers ? 'Hide Code' : 'Show Code'}
                    </button>
                </div>
                
                <div class="demo-block">
                    <h4>Flow Nodes (interactive)</h4>
                    <div class="flow-container">
                        <div class="flow-node" role="button" tabindex="0" class:active={activeNode === 'node1'} onclick={() => activeNode = 'node1'} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') activeNode = 'node1'; }}>Plaintext</div>
                        <div class="flow-arrow">&rarr;</div>
                        <div class="flow-node" role="button" tabindex="0" class:active={activeNode === 'node2'} onclick={() => activeNode = 'node2'} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') activeNode = 'node2'; }}>Cipher Engine</div>
                        <div class="flow-arrow">&rarr;</div>
                        <div class="flow-node" role="button" tabindex="0" class:active={activeNode === 'node3'} onclick={() => activeNode = 'node3'} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') activeNode = 'node3'; }}>Ciphertext</div>
                    </div>
                    <div class="output-box" style="margin-bottom: 20px;">
                        {#if activeNode === 'node1'}
                            <strong>Plaintext Node Selected:</strong> The original readable message, e.g. "ATTACK AT DAWN".
                        {:else if activeNode === 'node2'}
                            <strong>Cipher Engine Selected:</strong> Cryptographic mathematical algorithm used to encrypt/decrypt data.
                        {:else if activeNode === 'node3'}
                            <strong>Ciphertext Selected:</strong> Scrambled unreadable output data.
                        {/if}
                    </div>

                    <h4>Tabs Navigation</h4>
                    <div class="tab-group">
                        <button class="tab-item" class:active={activeTab === 'tab1'} onclick={() => activeTab = 'tab1'}>Substitution</button>
                        <button class="tab-item" class:active={activeTab === 'tab2'} onclick={() => activeTab = 'tab2'}>Transposition</button>
                        <button class="tab-item" class:active={activeTab === 'tab3'} onclick={() => activeTab = 'tab3'}>Algebraic</button>
                    </div>
                    <div class="panel" style="margin-top: -7px; border-top-left-radius: 0;">
                        {#if activeTab === 'tab1'}
                            Replaces letters with other letters (e.g. Caesar, Vigenère, Monoalphabetic ciphers).
                        {:else if activeTab === 'tab2'}
                            Scrambles/reorders letters without changing them (e.g. Rail fence, Columnar transposition).
                        {:else if activeTab === 'tab3'}
                            Performs multi-letter mathematical matrix calculations (e.g. Hill cipher).
                        {/if}
                    </div>

                    <div class="grid-cols-2" style="margin-top: 20px;">
                        <div>
                            <h4>Matrix Inputs (Hill style)</h4>
                            <div class="flex-row items-center gap-3">
                                <span>Key Matrix K = </span>
                                <div class="matrix-grid">
                                    <input type="number" class="matrix-input" value="3" />
                                    <input type="number" class="matrix-input" value="5" />
                                    <input type="number" class="matrix-input" value="1" />
                                    <input type="number" class="matrix-input" value="2" />
                                </div>
                            </div>
                        </div>
                        <div>
                            <h4>Letter Row & Badges</h4>
                            <div class="letter-row">
                                <div class="letter-cell">A</div>
                                <div class="letter-cell highlight">B</div>
                                <div class="letter-cell">C</div>
                                <div class="letter-cell highlight">D</div>
                                <div class="letter-cell">E</div>
                            </div>
                        </div>
                    </div>
                </div>

                {#if showCodes.ciphers}
                    <div class="code-block-container">
                        <button class="copy-btn" onclick={() => copyCode(
`<!-- Flow Nodes -->
<div class="flow-container">
  <div class="flow-node active">Plaintext</div>
  <div class="flow-arrow">&rarr;</div>
  <div class="flow-node">Ciphertext</div>
</div>

<!-- Tabs Group -->
<div class="tab-group">
  <button class="tab-item active">Tab A</button>
  <button class="tab-item">Tab B</button>
</div>

<!-- Matrix Inputs -->
<div class="matrix-grid">
  <input type="number" class="matrix-input" value="1" />
  <input type="number" class="matrix-input" value="0" />
  <input type="number" class="matrix-input" value="0" />
  <input type="number" class="matrix-input" value="1" />
</div>

<!-- Letter Row Grid -->
<div class="letter-row">
  <div class="letter-cell">X</div>
  <div class="letter-cell highlight">Y</div>
</div>

<!-- Output Calculations panel -->
<div class="output-box">Calculations log...</div>`, 'Cipher Components')}>Copy</button>
                        <pre><code>&lt;!-- Flow Diagram Nodes --&gt;
&lt;div class="flow-container"&gt;
  &lt;div class="flow-node active"&gt;Plaintext&lt;/div&gt;
  &lt;div class="flow-arrow"&gt;&amp;rarr;&lt;/div&gt;
  &lt;div class="flow-node"&gt;Cipher Engine&lt;/div&gt;
&lt;/div&gt;

&lt;!-- Tab Selector Bar --&gt;
&lt;div class="tab-group"&gt;
  &lt;button class="tab-item active"&gt;Tab 1&lt;/button&gt;
  &lt;button class="tab-item"&gt;Tab 2&lt;/button&gt;
&lt;/div&gt;

&lt;!-- Matrix Grid (2x2) --&gt;
&lt;div class="matrix-grid"&gt;
  &lt;input type="number" class="matrix-input" value="3" /&gt;
  &lt;input type="number" class="matrix-input" value="5" /&gt;
  &lt;input type="number" class="matrix-input" value="1" /&gt;
  &lt;input type="number" class="matrix-input" value="2" /&gt;
&lt;/div&gt;

&lt;!-- Letter cells for transposition grids --&gt;
&lt;div class="letter-row"&gt;
  &lt;div class="letter-cell"&gt;A&lt;/div&gt;
  &lt;div class="letter-cell highlight"&gt;B&lt;/div&gt;
&lt;/div&gt;

&lt;!-- Monospace output panel --&gt;
&lt;div class="output-box"&gt;Output result panel...&lt;/div&gt;</code></pre>
                    </div>
                {/if}
            </div>

            <!-- SECTION 5: Alert Callouts -->
            <div class="guide-section" style="margin-bottom: 0;">
                <div class="section-header">
                    <h2>Alert Banners & Callouts</h2>
                    <button class="btn btn-secondary btn-sm" onclick={() => toggleCode('alerts')}>
                        <i class="fa-solid fa-code"></i> {showCodes.alerts ? 'Hide Code' : 'Show Code'}
                    </button>
                </div>
                
                <div class="demo-block flex-col gap-2">
                    <div class="alert alert-note">
                        <strong>Note:</strong> Used for general suggestions, background info, and tips.
                    </div>
                    <div class="alert alert-tip">
                        <strong>Tip:</strong> Used for performance tweaks and optimization techniques.
                    </div>
                    <div class="alert alert-warning">
                        <strong>Warning:</strong> Used for caveats, security hazards, and code deprecation.
                    </div>
                    <div class="alert alert-caution">
                        <strong>Caution:</strong> High-priority warnings, data loss, and critical security issues.
                    </div>
                </div>

                {#if showCodes.alerts}
                    <div class="code-block-container">
                        <button class="copy-btn" onclick={() => copyCode(
`<div class="alert alert-note"><strong>Note:</strong> ...</div>
<div class="alert alert-tip"><strong>Tip:</strong> ...</div>
<div class="alert alert-warning"><strong>Warning:</strong> ...</div>
<div class="alert alert-caution"><strong>Caution:</strong> ...</div>`, 'Alerts')}>Copy</button>
                        <pre><code>&lt;div class="alert alert-note"&gt;&lt;strong&gt;Note:&lt;/strong&gt; Info banner...&lt;/div&gt;
&lt;div class="alert alert-tip"&gt;&lt;strong&gt;Tip:&lt;/strong&gt; Success/Tip banner...&lt;/div&gt;
&lt;div class="alert alert-warning"&gt;&lt;strong&gt;Warning:&lt;/strong&gt; Warning banner...&lt;/div&gt;
&lt;div class="alert alert-caution"&gt;&lt;strong&gt;Caution:&lt;/strong&gt; Critical danger banner...&lt;/div&gt;</code></pre>
                    </div>
                {/if}
            </div>

        </div>
    </div>
</div>

<style>
    .back-link {
        color: var(--muted-text, #666);
        text-decoration: none;
        font-weight: 600;
        font-size: 0.9rem;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        transition: color 0.2s;
    }

    .back-link:hover {
        color: var(--primary, #ff5400);
    }

    .guide-intro {
        margin: 20px 0;
        color: var(--text);
        opacity: 0.9;
        font-size: 0.95rem;
        line-height: 1.6;
    }

    .theme-pill-selector {
        display: inline-flex;
        background-color: var(--border, #e7e7db);
        padding: 3px;
        border-radius: 99px;
    }

    .theme-pill-selector button {
        background: transparent;
        border: none;
        padding: 5px 14px;
        border-radius: 99px;
        font-size: 12.5px;
        font-weight: 600;
        cursor: pointer;
        color: var(--text);
        opacity: 0.75;
        transition: all 0.2s;
    }

    .theme-pill-selector button.active {
        background-color: var(--card-bg, #ffffff);
        opacity: 1;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }

    /* Style Guide Sections */
    .preview-canvas {
        border: 1px solid var(--border, #ddd);
        border-radius: var(--squircle-outer, 16px);
        padding: 24px;
        background-color: var(--bg, #faf9f5);
        margin-top: 15px;
        transition: background-color 0.3s, border-color 0.3s;
    }

    /* Simulate Dark/Light mode overrides inside the guide canvas */
    .preview-canvas.dark-mode {
        background-color: #1f1f1e !important;
        border-color: #333 !important;
        color: #eeeeee !important;
        --bg: #1f1f1e;
        --text: #eeeeee;
        --card-bg: #252524;
        --border: #333;
        --primary: #ff5400;
    }

    .preview-canvas.light-mode {
        background-color: #faf9f5 !important;
        border-color: #ddd !important;
        color: #000000 !important;
        --bg: #faf9f5;
        --text: #000000;
        --card-bg: #ffffff;
        --border: #ddd;
        --primary: #ff5400;
    }

    .guide-section {
        border-bottom: 1px solid var(--border, #ddd);
        padding-bottom: 25px;
        margin-bottom: 25px;
    }

    .section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
    }

    .section-header h2 {
        margin: 0;
        font-size: 1.25rem;
    }

    .btn-sm {
        padding: 5px 10px !important;
        font-size: 11.5px !important;
    }

    .demo-block {
        background-color: rgba(0, 0, 0, 0.015);
        border: 1px dashed var(--border, #ddd);
        border-radius: 8px;
        padding: 20px;
    }

    .dark-mode .demo-block {
        background-color: rgba(255, 255, 255, 0.01);
    }

    .demo-block h4 {
        margin-top: 0;
        margin-bottom: 10px;
        font-size: 0.9rem;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        opacity: 0.6;
    }

    /* Code Blocks styling */
    .code-block-container {
        position: relative;
        margin-top: 15px;
    }

    .code-block-container pre {
        margin: 0;
        padding: 14px;
        background-color: #121212 !important;
        color: #f8f8f2;
        border-radius: 6px;
        font-family: 'JetBrains Mono', monospace;
        font-size: 12px;
        overflow-x: auto;
    }

    .code-block-container code {
        font-family: inherit;
    }

    .copy-btn {
        position: absolute;
        top: 8px;
        right: 8px;
        background-color: rgba(255, 255, 255, 0.15) !important;
        color: #ffffff !important;
        font-size: 10.5px !important;
        padding: 4px 8px !important;
        border-radius: 4px !important;
    }

    .copy-btn:hover {
        background-color: rgba(255, 255, 255, 0.25) !important;
    }

    .cursor-pointer {
        cursor: pointer;
    }
</style>
