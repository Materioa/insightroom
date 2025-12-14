<script>
    import { onMount, tick } from "svelte";
    import { dev } from "$app/environment";

    let { data = { title: "", content: "" }, token = null } = $props();

    let componentState = $state({
        showSummarySection: false,
        isSummaryExpanded: false,
        isGeneratingSummary: false,
        summaryContent: "",
        summaryError: "",
        isFollowupLoading: false,
        followupQuery: "",
        followupResponse: "",
    });

    const API_BASE = dev
        ? "http://localhost:1000"
        : "https://materioa.vercel.app";

    async function checkSummaryAccess() {
        if (!token) {
            console.log("No token provided to AISummary.");
            return;
        }

        console.log("Checking summary access with token...");
        try {
            const response = await fetch(`${API_BASE}/api/v2/profile`, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) {
                throw new Error(
                    `Failed to verify user privileges: ${response.status}`,
                );
            }

            const userData = await response.json();
            console.log("User data received:", userData);

            const hasAccess =
                userData.user?.hasAdminPrivileges || userData.user?.isPlusUser;
            console.log("Has access?", hasAccess);

            if (hasAccess) {
                componentState.showSummarySection = true;
                console.log(
                    "showSummarySection set to:",
                    componentState.showSummarySection,
                );
            } else {
                console.log("Access denied: User is not admin or plus.");
                componentState.showSummarySection = false;
            }
        } catch (error) {
            console.error("Error checking summary access:", error);
            componentState.showSummarySection = false;
        }
    }

    async function toggleSummary() {
        componentState.isSummaryExpanded = !componentState.isSummaryExpanded;
        if (
            componentState.isSummaryExpanded &&
            !componentState.summaryContent &&
            !componentState.isGeneratingSummary
        ) {
            // Trigger auto-generation if first time opening
            await generateSummary();
        }
    }

    /** @param {string} text */
    function parseBasicMarkdown(text) {
        return text
            .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
            .replace(/^\* (.*$)/gm, "<li>$1</li>")
            .replace(/^\- (.*$)/gm, "<li>$1</li>")
            .replace(/\n\n/g, "<br><br>");
    }

    async function generateSummary() {
        if (!data.content) return;
        componentState.isGeneratingSummary = true;
        componentState.summaryError = "";

        try {
            const wordCount = data.content.split(/\s+/).length;
            const targetWords = Math.max(
                30,
                Math.min(80, Math.floor(wordCount / 6)),
            );

            const summaryPrompt = `Please provide an ultra-concise summary (max ${targetWords} words). Focus ONLY on the main point and 2-3 key takeaways. Use simple, clear language and bullet points. Preserve LaTeX where present.\n\nTitle: ${data.title}\n\n${data.content}`;

            const response = await fetch(`${API_BASE}/api/v2/chat`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    message: summaryPrompt,
                    messages: [],
                    mode: "general",
                    model: "openai/gpt-oss-120b:free",
                }),
            });

            if (!response.ok) throw new Error("Failed to generate summary");

            const resData = await response.json();
            if (!resData.success) throw new Error(resData.error || "Failed");

            componentState.summaryContent = parseBasicMarkdown(
                resData.response,
            );

            await tick();
            // @ts-ignore
            if (typeof renderMathInElement !== "undefined") {
                // @ts-ignore
                const el = document.getElementById("summary-text");
                // @ts-ignore
                if (el)
                    // @ts-ignore
                    renderMathInElement(el, {
                        delimiters: [
                            { left: "$$", right: "$$", display: false },
                            { left: "$", right: "$", display: false },
                            { left: "\\(", right: "\\)", display: false },
                            { left: "\\[", right: "\\]", display: true },
                        ],
                    });
            }
        } catch (err) {
            console.error(err);
            componentState.summaryError =
                "Failed to generate summary. Please try again.";
        } finally {
            componentState.isGeneratingSummary = false;
        }
    }

    async function askFollowupQuestion() {
        if (!componentState.followupQuery.trim()) return;
        componentState.isFollowupLoading = true;
        componentState.followupResponse = "";

        try {
            const prompt = `Based on the following content, satisfy the user's request: "${componentState.followupQuery}".\n\nContent: ${data.content}`;

            const response = await fetch(`${API_BASE}/api/v2/chat`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    message: prompt,
                    messages: [],
                    mode: "general",
                    model: "openai/gpt-oss-20b:free",
                }),
            });

            if (!response.ok) throw new Error("Failed to get answer");
            const resData = await response.json();
            if (!resData.success) throw new Error(resData.error || "Failed");
            componentState.followupResponse = parseBasicMarkdown(
                resData.response,
            );
        } catch (e) {
            componentState.followupResponse =
                "Error: Could not get a response.";
        } finally {
            componentState.isFollowupLoading = false;
        }
    }

    /** @param {KeyboardEvent} event */
    function handleFollowupKeypress(event) {
        if (event.key === "Enter") {
            askFollowupQuestion();
        }
    }

    $effect(() => {
        console.log("Effect triggered. Token:", token);
        if (token) {
            checkSummaryAccess();
        }
    });
</script>

<!-- Debug Info -->
<div
    style="background: #eee; padding: 5px; font-size: 10px; border: 1px solid #ccc; margin-bottom: 1rem;"
>
    <strong>Debug ({Date.now()}):</strong>
    showSummarySection: {componentState.showSummarySection} | Token available: {!!token}
    | isExpanded:
    {componentState.isSummaryExpanded}
</div>

{#if componentState.showSummarySection}
    <!-- AI Summary Section -->
    <div id="ai-summary-section" class="ai-summary-section">
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div id="summary-header" class="summary-header" onclick={toggleSummary}>
            <div style="display: flex; align-items: center;">
                <i
                    class="fa-solid fa-wand-magic-sparkles"
                    style="margin-right: 0.5rem; font-size: 18px;"
                ></i>
                <h3 style="margin: 0; font-size: 18px; font-weight: 600;">
                    Summary
                </h3>
            </div>
            <i
                id="summary-chevron"
                class="fa-solid fa-chevron-down"
                style="transition: transform 0.3s ease; transform: {componentState.isSummaryExpanded
                    ? 'rotate(180deg)'
                    : '0deg'};"
            ></i>
        </div>

        {#if componentState.isSummaryExpanded}
            <div id="ai-summary-content" class="summary-content">
                {#if componentState.isGeneratingSummary}
                    <div
                        style="color: var(--text); padding: 1rem 0; font-style: italic;"
                    >
                        <i
                            class="fa-solid fa-spinner fa-spin"
                            style="margin-right: 0.5rem;"
                        ></i>
                        Generating summary...
                    </div>
                {:else if componentState.summaryError}
                    <div style="color: #ff6b6b; padding: 1rem 0;">
                        <i class="fa-solid fa-exclamation-triangle"></i>
                        {componentState.summaryError}
                    </div>
                {:else if componentState.summaryContent}
                    <div id="summary-text">
                        {@html componentState.summaryContent}
                    </div>

                    <!-- Follow-up Question Box -->
                    <div
                        id="followup-section"
                        style="margin-top: 1.5rem; border-top: 1px solid rgba(0,0,0,0.1); padding-top: 1rem;"
                    >
                        <div
                            style="display: flex; align-items: center; margin-bottom: 0.75rem;"
                        >
                            <i
                                class="fa-solid fa-question-circle"
                                style="margin-right: 0.5rem; font-size: 14px; opacity: 0.7;"
                            ></i>
                            <span
                                style="font-size: 14px; font-weight: 600; opacity: 0.8;"
                                >Ask a Follow up:</span
                            >
                        </div>

                        <div
                            style="display: flex; gap: 0.5rem; align-items: flex-start;"
                        >
                            <div
                                class="followup-pill"
                                style="position: relative; flex: 1; display: flex; align-items: center; background: rgba(255,255,255,0.7); border: 1px solid rgba(0,0,0,0.2); border-radius: 25px; padding: 0.5rem 3rem 0.5rem 1rem;"
                            >
                                <!-- svelte-ignore a11y_autofocus -->
                                <input
                                    type="text"
                                    id="followup-input"
                                    placeholder="e.g., What are the main benefits discussed?"
                                    style="flex: 1; border: none; background: transparent; font-size: 14px; outline: none;"
                                    bind:value={componentState.followupQuery}
                                    onkeypress={handleFollowupKeypress}
                                />
                                <button
                                    onclick={askFollowupQuestion}
                                    id="followup-btn"
                                    disabled={componentState.isFollowupLoading}
                                    style="position: absolute; right: 4px; width: 32px; height: 32px; background: #ff8200; color: white; border: none; border-radius: 50%; cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center; transition: all 0.2s ease;"
                                >
                                    {#if componentState.isFollowupLoading}
                                        <i
                                            class="fa-solid fa-spinner fa-spin"
                                            style="font-size: 12px;"
                                        ></i>
                                    {:else}
                                        <i
                                            class="fa-solid fa-arrow-up"
                                            style="font-size: 12px;"
                                        ></i>
                                    {/if}
                                </button>
                            </div>
                        </div>

                        {#if componentState.followupResponse}
                            <div
                                id="followup-response"
                                style="margin-top: 0.75rem; padding: 0.75rem; background: rgba(0,0,0,0.03); border-radius: 6px; font-size: 14px; line-height: 1.5;"
                            >
                                {@html componentState.followupResponse}
                            </div>
                        {/if}
                    </div>
                {:else}
                    <!-- Placeholder if expanded but no content (should be covered by loading state) -->
                    <p
                        id="summary-placeholder"
                        style="margin: 0; font-style: italic; opacity: 0.7;"
                    >
                        Click to generate AI summary...
                    </p>
                {/if}
            </div>
        {/if}
    </div>
{/if}

<style>
    .ai-summary-section {
        background: #f8f9fa;
        border: 1px solid #e0e0e0;
        border-radius: 12px;
        padding: 1.5rem;
        margin: 2rem auto;
        color: var(--text, #333);
    }

    :global(body.dark) .ai-summary-section {
        background: #232323;
        border-color: #3a3a3a;
        color: #eaeaea;
    }

    .summary-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: pointer;
        user-select: none;
    }

    .summary-content {
        margin-top: 1rem;
        padding-top: 1rem;
        border-top: 1px solid rgba(0, 0, 0, 0.1);
        font-size: 0.95rem;
        line-height: 1.6;
    }

    :global(body.dark) .summary-content {
        border-top-color: rgba(255, 255, 255, 0.1);
    }
</style>
