#!/usr/bin/env node

/**
 * Insightroom MCP Bridge
 * Bridges stdio (stdin/stdout) to/from the remote Streamable HTTP / SSE MCP server.
 * Compatible with Node.js (18+) and Bun.js. No external dependencies required.
 */

const readline = require('readline');

const token = process.env.INSIGHTROOM_TOKEN;
const baseUrl = (process.env.INSIGHTROOM_URL || 'http://localhost:5173').replace(/\/$/, '');

if (!token) {
    console.error('Error: INSIGHTROOM_TOKEN environment variable is not defined.');
    process.exit(1);
}

const sseUrl = `${baseUrl}/mcp?token=${encodeURIComponent(token)}`;

// Session state
let postUrl = '';
let isInitialized = false;

console.error(`[MCP Bridge] Connecting to remote MCP server at: ${baseUrl}/mcp`);

/**
 * Establishes the SSE connection and processes events.
 */
async function startSseConnection() {
    try {
        const response = await fetch(sseUrl, {
            headers: {
                'Accept': 'text/event-stream',
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            console.error(`[MCP Bridge] SSE connection failed: HTTP ${response.status} ${response.statusText}`);
            process.exit(1);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        // Process SSE stream chunks
        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                console.error('[MCP Bridge] SSE stream closed by remote server.');
                process.exit(0);
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep the last incomplete line

            let currentEvent = 'message'; // Default event type

            for (let line of lines) {
                line = line.trim();
                if (!line) continue;

                if (line.startsWith('event:')) {
                    currentEvent = line.substring(6).trim();
                } else if (line.startsWith('data:')) {
                    const dataContent = line.substring(5).trim();
                    handleSseEvent(currentEvent, dataContent);
                } else if (line.startsWith(':')) {
                    // SSE Comment (e.g. keep-alive ping)
                }
            }
        }
    } catch (err) {
        console.error('[MCP Bridge] SSE network error:', err);
        process.exit(1);
    }
}

/**
 * Handles incoming SSE events from the remote server.
 * @param {string} eventName 
 * @param {string} data 
 */
function handleSseEvent(eventName, data) {
    if (eventName === 'endpoint') {
        // Resolve the postUrl relative to baseUrl
        let relativePath = data;
        if (relativePath.startsWith('/')) {
            postUrl = `${baseUrl}${relativePath}`;
        } else {
            postUrl = relativePath;
        }
        console.error(`[MCP Bridge] Established session. Messages endpoint: ${postUrl}`);
        isInitialized = true;
        
        // Start listening to stdin now that we have the endpoint
        startStdinReader();
    } else if (eventName === 'message') {
        // Print the JSON-RPC message straight to stdout for the MCP client
        console.log(data);
    }
}

/**
 * Listens to standard input and forwards messages to the remote POST endpoint.
 */
function startStdinReader() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false
    });

    rl.on('line', async (line) => {
        if (!line.trim()) return;

        if (!postUrl) {
            console.error('[MCP Bridge] Error: Received stdin message before session endpoint was resolved.');
            return;
        }

        try {
            // Forward JSON-RPC request to Vercel/serverless endpoint
            const res = await fetch(postUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: line
            });

            if (!res.ok) {
                console.error(`[MCP Bridge] Failed to forward message: HTTP ${res.status}`);
                return;
            }

            // In serverless environments, the response is returned directly in the POST body.
            // If the body is non-empty, print it to stdout.
            const text = await res.text();
            if (text.trim()) {
                console.log(text);
            }
        } catch (err) {
            console.error('[MCP Bridge] Network error during message forwarding:', err);
        }
    });

    rl.on('close', () => {
        console.error('[MCP Bridge] Stdin stream closed. Exiting.');
        process.exit(0);
    });
}

// Start the bridge connection
startSseConnection();
