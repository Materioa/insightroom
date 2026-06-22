---
name: insightroom-orchestrator
description: Teaches Claude how to use the Insightroom MCP server tools to create, outline, publish, and delete blog posts using the proprietary writing style.
---

# Insightroom Orchestrator Skill

This skill allows Claude to interact with the Insightroom server using a slash command-like workflow to draft, review, and publish posts.

## Tool Workflow & Mapping

*   **Create Draft**: Interpret inputs like `/create <title>` as a request to invoke the `create_post` tool with that title, saving it as a draft post.
*   **Outline & Write**: Interpret inputs like `/outline <topic>` as a request to call the `outline` tool to fetch the proprietary writing guidelines, then draft the post body in markdown format directly inside the chat.
*   **Commit/Publish**: Interpret inputs like `/publish` as a request to take the generated markdown draft and write it to the active post by invoking `update_post` with the current post ID (setting the `draft` flag to false).
*   **Delete**: Interpret inputs like `/delete` as a request to call the `delete_post` tool on the active post ID.
