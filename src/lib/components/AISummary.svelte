<script lang="ts">
  import { tick, onMount } from "svelte";

  /** @type {{ postContent: string, postTitle: string, canSummarize?: boolean, canAsk?: boolean }} */
  let {
    postContent = "",
    postTitle = "",
    canSummarize = true,
    canAsk = true,
  } = $props();

  // Don't render anything if both features are disabled
  const shouldRender = $derived(canSummarize || canAsk);

  // State
  let activeMode: string = $state(""); // "" | "summary" | "ask"
  let isLoading: boolean = $state(false);
  let summaryText: string = $state("");
  let displayedSummary: string = $state("");
  let chatMessages: Array<{role: string, content: string, displayed?: string}> = $state([]);
  let userInput: string = $state("");
  let followUpInput: string = $state("");
  let errorMessage: string = $state("");
  let summaryGenerated: boolean = $state(false);
  let isTyping: boolean = $state(false);
  let isFollowUp: boolean = $state(false);
  let shouldStop: boolean = $state(false);
  let isClosing: boolean = $state(false);
  let abortController: AbortController | null = $state(null);
  let currentModelIndex = $state(0);

  const API_URL = "https://openrouter.ai/api/v1/chat/completions";

  const MODELS = [
    { id: "openai/gpt-oss-120b:free", name: "GPT-OSS 120B" },
    { id: "meta-llama/llama-3.3-70b-instruct:free", name: "Llama 3.3 70B" },
    { id: "google/gemma-3-27b-it:free", name: "Gemma 3 27B" },
    { id: "moonshotai/kimi-k2:free", name: "Kimi K2" },
    { id: "z-ai/glm-4.5-air:free", name: "GLM 4.5 Air" },
    { id: "qwen/qwen3-coder:free", name: "Qwen 3 Code 480B A35B" },
    { id: "deepseek/deepseek-r1-0528:free", name: "DeepSeek R1" },
    { id: "nvidia/nemotron-3-nano-30b-a3b:free", name: "Nvidia Nemotron 3 nano" },
    { id: "mistralai/mistral-small-3.1-24b-instruct:free", name: "Mistral 3 Small" },
    { id: "openrouter/free", name: "Random" },
  ];

  // Get current model info
  const currentModel = $derived(MODELS[currentModelIndex] || MODELS[0]);

  // Re-render math and highlight code when tab changes or content is shown again
  $effect(() => {
    if (activeMode && !isClosing && !isTyping) {
      tick().then(() => {
        renderMath();
        // @ts-ignore
        if (typeof hljs !== "undefined") hljs.highlightAll();
      });
    }
  });
  
  // Set up privileges for context menu and listen for ask-ai-selection event
  onMount(() => {
    // Set data attributes to indicate this component is available for AI operations
    const rootElement = document.querySelector('[data-ai-summary-component]');
    if (rootElement) {
      rootElement.setAttribute('data-ai-summary-available', 'true');
      rootElement.setAttribute('data-can-ask', String(canAsk));
    }
    
    // Also set on document for fallback detection
    if (canAsk) {
      localStorage.setItem('has_ask_privileges', 'true');
    }
    
    // Listen for ask-ai-selection event from context menu
    const handleAskSelection = (event: CustomEvent) => {
      const selectedText = event.detail?.text || '';
      if (selectedText && canAsk) {
        // Switch to ask mode and add selected text as initial message
        activeMode = 'ask';
        userInput = selectedText;
        
        // Scroll to AI summary or bring it into view
        rootElement?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    };
    
    document.addEventListener('ask-ai-selection', handleAskSelection as EventListener);
    
    return () => {
      document.removeEventListener('ask-ai-selection', handleAskSelection as EventListener);
    };
  });
  
  // @ts-ignore
  const API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY || "";

  /**
   * Typewriter effect - updates displayed text character by character
   * @param {string} fullText
   * @param {(text: string) => void} updateFn
   * @param {number} speed
   * @returns {Promise<void>}
   */
  async function typeWriter(fullText: string, updateFn: (text: string) => void, speed: number = 12) {
    isTyping = true;
    let currentText = "";
    for (let i = 0; i < fullText.length; i++) {
      if (shouldStop) {
        shouldStop = false;
        break;
      }
      currentText += fullText[i];
      updateFn(currentText);
      await new Promise((resolve) => setTimeout(resolve, speed));
    }
    isTyping = false;
  }

  /**
   * Send a message to OpenRouter API with automatic model fallback
   * @param {string} systemPrompt
   * @param {Array<{role: string, content: string}>} messages
   * @param {number} modelIndex - Starting model index for fallback
  /**
   * Send chat message to AI
   * @returns {Promise<string>}
   */
  async function sendChatMessage(
    systemPrompt: string,
    messages: Array<{role: string, content: string}>,
    modelIndex: number = currentModelIndex,
  ) {
    const model = MODELS[modelIndex];
    if (!model) {
      throw new Error(
        "All models are currently unavailable. Please try again later.",
      );
    }

    abortController = new AbortController();

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_KEY}`,
          "HTTP-Referer": window.location.origin,
          "X-Title": "Materio InsightRoom",
        },
        body: JSON.stringify({
          model: model.id,
          messages: [{ role: "system", content: systemPrompt }, ...messages],
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const status = response.status;
        const errorMsg = errorData.error?.message || "";

        // Check for rate limit, model not found, or other recoverable errors
        const shouldFallback =
          status === 429 || // Rate limit
          status === 404 || // Model not found
          status === 503 || // Service unavailable
          status === 502 || // Bad gateway
          errorMsg.toLowerCase().includes("rate limit") ||
          errorMsg.toLowerCase().includes("not found") ||
          errorMsg.toLowerCase().includes("unavailable") ||
          errorMsg.toLowerCase().includes("overloaded");

        if (shouldFallback && modelIndex < MODELS.length - 1) {
          console.warn(
            `Model ${model.id} failed (${status}), trying next model...`,
          );
          currentModelIndex = modelIndex + 1;
          return sendChatMessage(systemPrompt, messages, modelIndex + 1);
        }

        throw new Error(errorData.error?.message || `API error: ${status}`);
      }

      const data = await response.json();
      // Update current model index on success (sticky selection)
      currentModelIndex = modelIndex;
      return data.choices?.[0]?.message?.content || "No response received.";
    } catch (error) {
      // Handle network errors and abort
      if (error instanceof Error && error.name === "AbortError") {
        throw error;
      }

      // Try next model on network errors
      if (modelIndex < MODELS.length - 1) {
        console.warn(`Model ${model.id} failed, trying next model...`);
        currentModelIndex = modelIndex + 1;
        return sendChatMessage(systemPrompt, messages, modelIndex + 1);
      }

      throw error;
    }
  }

  /**
   * Handle summarize button click - only generates on first click
   */
  async function handleSummarize() {
    if (activeMode === "summary") {
      // Clicking again closes the panel with animation
      isClosing = true;
      await new Promise((resolve) => setTimeout(resolve, 200));
      activeMode = "";
      isClosing = false;
      return;
    }

    const wasFirstClick = activeMode === "";
    activeMode = "summary";

    // Only generate summary on first click, not when switching from ask tab
    if (wasFirstClick && !summaryGenerated && !isLoading) {
      await generateSummary();
    }
  }

  /**
   * Handle ask button click - just switches tab, no API call
   */
  async function handleAsk() {
    if (activeMode === "ask") {
      // Clicking again closes the panel with animation
      isClosing = true;
      await new Promise((resolve) => setTimeout(resolve, 200));
      activeMode = "";
      isClosing = false;
      return;
    }
    activeMode = "ask";
  }

  /**
   * Generate post summary
   */
  async function generateSummary() {
    isLoading = true;
    errorMessage = "";
    displayedSummary = "";

    try {
      const systemPrompt = `You are Thinklet, an AI assistant created by Materio for InsightRoom. You help users by summarizing blog posts and answering questions about them.

When asked about yourself (e.g., "who are you", "introduce yourself"), briefly introduce yourself as Thinklet by Materio.

For summarizing:
- Provide a clear, concise summary under 120 words
- Use bullet points for key takeaways
- If there's math, preserve LaTeX delimiters (use $$ for display math, $ for inline)
- Be direct and informative
- No filler phrases`;

      const userMessage = `Summarize this blog post titled "${postTitle}":\n\n${postContent.slice(0, 8000)}`;

      const fullSummary = await sendChatMessage(systemPrompt, [
        { role: "user", content: userMessage },
      ]);

      summaryText = fullSummary;
      summaryGenerated = true;
      isLoading = false;

      // Typewriter effect
      await typeWriter(fullSummary, (text) => {
        displayedSummary = text;
      });

      // Render math and highlight code after typewriter completes
      await tick();
      renderMath();
      // @ts-ignore
      if (typeof hljs !== "undefined") hljs.highlightAll();
    } catch (error) {
      errorMessage =
        error instanceof Error ? error.message : "Failed to generate summary";
      console.error("Summary error:", error);
      isLoading = false;
    }
  }

  /**
   * Render LaTeX math using KaTeX if available
   */
  function renderMath() {
    // @ts-ignore
    if (typeof renderMathInElement !== "undefined") {
      const containers = document.querySelectorAll(".ai-response-text");
      containers.forEach((container) => {
        // @ts-ignore
        renderMathInElement(container, {
          delimiters: [
            { left: "$$", right: "$$", display: true },
            { left: "$", right: "$", display: false },
            { left: "\\(", right: "\\)", display: false },
            { left: "\\[", right: "\\]", display: true },
          ],
        });
      });
    }
  }

  /**
   * Parse markdown to HTML
   * @param {string} text
   * @returns {string}
   */
  function parseMarkdown(text: string): string {
    if (!text) return "";

    let result = text;

    // Store code blocks temporarily to protect them from other transformations
    const codeBlocks: string[] = [];

    // Code blocks with language (```lang ... ```)
    result = result.replace(/```(\w+)?\n([\s\S]*?)```/g, (_: string, lang: string, code: string) => {
      const langClass = lang ? ` class="language-${lang}"` : "";
      const escapedCode = code
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .trim();
      const placeholder = `<!--CODEBLOCK${codeBlocks.length}-->`;
      codeBlocks.push(`<pre><code${langClass}>${escapedCode}</code></pre>`);
      return placeholder;
    });

    // Tables
    result = result.replace(
      /(?:^|\n)((?:\|[^\n]+\|\n)+)/g,
      (match: string, tableContent: string) => {
        const rows = tableContent.trim().split("\n");
        if (rows.length < 2) return match;

        let html = '<table class="ai-table">';

        rows.forEach(
          (row: string, index: number) => {
            // Skip separator row (|---|---|)
            if (/^\|[\s\-:]+\|$/.test(row.trim())) return;

            const cells = row
              .split("|")
              .filter(
                (_: string, i: number, arr: string[]) => i > 0 && i < arr.length - 1,
              );
            const tag = index === 0 ? "th" : "td";

            if (index === 0) html += "<thead>";
            if (index === 2) html += "<tbody>";

            html += "<tr>";
            cells.forEach((/** @type {string} */ cell) => {
              html += `<${tag}>${cell.trim()}</${tag}>`;
            });
            html += "</tr>";

            if (index === 0) html += "</thead>";
          },
        );

        html += "</tbody></table>";
        return html;
      },
    );

    // Headers
    result = result.replace(/^### (.+)$/gm, "<h4>$1</h4>");
    result = result.replace(/^## (.+)$/gm, "<h3>$1</h3>");
    result = result.replace(/^# (.+)$/gm, "<h2>$1</h2>");

    // Bold
    result = result.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    result = result.replace(/__(.+?)__/g, "<strong>$1</strong>");

    // Italic
    result = result.replace(/\*(.+?)\*/g, "<em>$1</em>");
    result = result.replace(/_(.+?)_/g, "<em>$1</em>");

    // Inline code (but not inside pre blocks)
    result = result.replace(/`([^`]+)`/g, "<code>$1</code>");

    // Bullet points (including nested ones with leading spaces)
    result = result.replace(/^([ \t]*)[\-\*] (.+)$/gm, (_: string, spaces: string, content: string) => {
      if (spaces && spaces.length > 0) {
        return `<li style="margin-left: 3.5rem; list-style-type: circle;">${content}</li>`;
      }
      return `<li>${content}</li>`;
    });

    // Numbered lists
    result = result.replace(/^\d+\. (.+)$/gm, "<li>$1</li>");

    // Line breaks (convert remaining newlines to <br>)
    result = result.replace(/\n/g, "<br>");

    // Restore code blocks
    codeBlocks.forEach((block, i) => {
      result = result.replace(`<!--CODEBLOCK${i}-->`, block);
    });

    return result;
  }

  /**
   * Handle user question submission
   */
  async function handleSubmitQuestion() {
    const question = userInput.trim();
    if (!question || isLoading) return;

    isLoading = true;
    errorMessage = "";
    userInput = "";

    chatMessages = [
      ...chatMessages,
      { role: "user", content: question, displayed: question },
    ];

    try {
      const systemPrompt = `You are Thinklet, an AI assistant created by Materio for InsightRoom. You help users by answering questions about blog posts.

When asked about yourself (e.g., "who are you", "introduce yourself"), briefly introduce yourself as Thinklet by Materio.

Rules:
- Base answers on the content provided
- If math is involved, use LaTeX: $$ for display, $ for inline
- Be concise and helpful
- If answer isn't in content, say so politely

Blog Post Title: "${postTitle}"

Blog Post Content:
${postContent.slice(0, 8000)}`;

      const response = await sendChatMessage(
        systemPrompt,
        chatMessages.map((m) => ({ role: m.role, content: m.content })),
      );

      const msgIndex = chatMessages.length;
      chatMessages = [
        ...chatMessages,
        { role: "assistant", content: response, displayed: "" },
      ];
      isLoading = false;

      await typeWriter(response, (text) => {
        chatMessages[msgIndex].displayed = text;
        chatMessages = [...chatMessages];
      });

      await tick();
      renderMath();
      // @ts-ignore
      if (typeof hljs !== "undefined") hljs.highlightAll();
    } catch (error) {
      errorMessage =
        error instanceof Error ? error.message : "Failed to get response";
      console.error("Chat error:", error);
      isLoading = false;
    }
  }

  /**
   * Handle follow-up question after summary
   */
  async function handleFollowUp() {
    const question = followUpInput.trim();
    if (!question || isLoading) return;

    activeMode = "ask";
    isFollowUp = true;
    chatMessages = [
      { role: "assistant", content: summaryText, displayed: summaryText },
      { role: "user", content: question, displayed: question },
    ];
    followUpInput = "";
    isLoading = true;
    errorMessage = "";

    try {
      const systemPrompt = `You are Thinklet, an AI assistant created by Materio for InsightRoom. You help users by answering follow-up questions about blog posts.

When asked about yourself (e.g., "who are you", "introduce yourself"), briefly introduce yourself as Thinklet by Materio.

Rules:
- You already provided a summary
- Use LaTeX for math: $$ for display, $ for inline
- Be concise

Blog Post Title: "${postTitle}"

Blog Post Content:
${postContent.slice(0, 8000)}`;

      const response = await sendChatMessage(
        systemPrompt,
        chatMessages.map((m) => ({ role: m.role, content: m.content })),
      );

      const msgIndex = chatMessages.length;
      chatMessages = [
        ...chatMessages,
        { role: "assistant", content: response, displayed: "" },
      ];
      isLoading = false;

      await typeWriter(response, (text) => {
        chatMessages[msgIndex].displayed = text;
        chatMessages = [...chatMessages];
      });

      await tick();
      renderMath();
      // @ts-ignore
      if (typeof hljs !== "undefined") hljs.highlightAll();
    } catch (error) {
      errorMessage =
        error instanceof Error ? error.message : "Failed to get response";
      console.error("Follow-up error:", error);
      isLoading = false;
    }
  }

  /**
   * Handle Enter key press
   * @param {KeyboardEvent} event
   * @param {"question" | "followup"} type
   */
  function handleKeyPress(event: KeyboardEvent, type: "question" | "followup") {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (type === "question") {
        handleSubmitQuestion();
      } else {
        handleFollowUp();
      }
    }
  }

  /**
   * Stop ongoing generation
   */
  function stopGeneration() {
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
    shouldStop = true;
    isLoading = false;
    isTyping = false;
  }

  /**
   * Clear chat and reset
   */
  function clearChat() {
    chatMessages = [];
    userInput = "";
    errorMessage = "";
    isFollowUp = false;
  }
</script>

<svelte:head>
  <link rel="stylesheet" href="/assets/style/ai.css" />
</svelte:head>

{#if shouldRender}
  <div class="ai-card" data-ai-summary-component>
    <!-- Action Buttons Row -->
    <div class="ai-actions-row">
      {#if canSummarize}
        <button
          class="ai-action-btn"
          class:active={activeMode === "summary"}
          onclick={handleSummarize}
        >
          <i class="fa-solid fa-wand-magic-sparkles"></i>
          <span>Summarize</span>
        </button>
      {/if}
      {#if canAsk}
        <button
          class="ai-action-btn"
          class:active={activeMode === "ask"}
          onclick={handleAsk}
        >
       <i class="fa-solid fa-message-question"></i>
          <span>Ask</span>
        </button>
      {/if}
    </div>

    <!-- Expanded Content -->
    {#if activeMode}
      <div class="ai-content" class:closing={isClosing}>
        {#if errorMessage}
          <div class="ai-error">
            <i class="fa-solid fa-circle-exclamation"></i>
            {errorMessage}
          </div>
        {/if}

        <!-- Summary Mode -->
        <div class="ai-tab-content" class:hidden={activeMode !== "summary"}>
          {#if isLoading && !displayedSummary}
            <div class="ai-loading">
              <div class="breathing-bubble"></div>
              <span>Generating summary...</span>
            </div>
          {:else if displayedSummary}
            <div class="ai-response">
              <div class="response-header">
                <i class="fa-solid fa-sparkles"></i>
                <span>AI Summary</span>
              </div>
              <div class="ai-response-text">
                {@html parseMarkdown(displayedSummary)}
                {#if isTyping}
                  <span class="typing-cursor">|</span>
                {/if}
              </div>
            </div>

            <!-- Follow-up input -->
            <div class="followup-divider">
              <hr />
              <span class="followup-label">
                <i class="fa-regular fa-circle-question"></i>
                Ask follow up
              </span>
            </div>
            <div class="ai-input-container">
              <textarea
                class="ai-input"
                placeholder="Ask a follow-up question..."
                bind:value={followUpInput}
                onkeydown={(e) => handleKeyPress(e, "followup")}
                disabled={isLoading || isTyping}
                rows="1"
              ></textarea>
              {#if isLoading || isTyping}
                <button
                  class="ai-send-btn stop"
                  onclick={stopGeneration}
                  aria-label="Stop generating"
                >
                  <i class="fa-solid fa-stop"></i>
                </button>
              {:else}
                <button
                  class="ai-send-btn"
                  onclick={handleFollowUp}
                  disabled={!followUpInput.trim()}
                  aria-label="Send follow-up question"
                >
                  <i class="fa-solid fa-paper-plane"></i>
                </button>
              {/if}
            </div>
          {/if}
        </div>

        <!-- Ask Mode -->
        <div class="ai-tab-content" class:hidden={activeMode !== "ask"}>
          {#if chatMessages.length > 0}
            <div class="ai-chat-messages">
              {#each chatMessages as message, index}
                <div class="chat-message {message.role}">
                  <div class="message-content ai-response-text">
                    {@html parseMarkdown(message.displayed || message.content)}
                  </div>
                </div>
                {#if isFollowUp && index === 0 && message.role === "assistant"}
                  <div class="followup-divider">
                    <hr />
                    <span class="followup-label">
                      <i class="fa-regular fa-circle-question"></i>
                      Follow up
                    </span>
                  </div>
                {/if}
              {/each}

              {#if isLoading}
                <div class="chat-message assistant">
                  <div class="message-content">
                    <div class="breathing-bubble"></div>
                  </div>
                </div>
              {/if}
            </div>

            <button class="clear-chat-btn" onclick={clearChat}>
              <i class="fa-solid fa-trash"></i>
              Clear chat
            </button>
          {/if}

          <div class="ai-input-container">
            <textarea
              class="ai-input"
              placeholder="Ask anything about this page..."
              bind:value={userInput}
              onkeydown={(e) => handleKeyPress(e, "question")}
              disabled={isLoading || isTyping}
              rows="1"
            ></textarea>
            {#if isLoading || isTyping}
              <button
                class="ai-send-btn stop"
                onclick={stopGeneration}
                aria-label="Stop generating"
              >
                <i class="fa-solid fa-stop"></i>
              </button>
            {:else}
              <button
                class="ai-send-btn"
                onclick={handleSubmitQuestion}
                disabled={!userInput.trim()}
                aria-label="Send question"
              >
                <i class="fa-solid fa-paper-plane"></i>
              </button>
            {/if}
          </div>
        </div>
      </div>
    {/if}
  </div>
{/if}
