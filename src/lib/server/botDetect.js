/**
 * Bot/Crawler Detection Utility
 * 
 * Detects search engine crawlers, AI assistants, and ad verification bots
 * so that server-side rendered content can be served to them directly.
 */

/** @type {RegExp} */
const BOT_PATTERN = new RegExp([
    // Search engine crawlers
    'googlebot',
    'google-inspectiontool',     // Google Search Console
    'bingbot',
    'slurp',                     // Yahoo
    'duckduckbot',
    'baiduspider',
    'yandexbot',
    'sogou',
    'exabot',
    'ia_archiver',               // Alexa
    'facebot',
    'facebookexternalhit',       // Facebook link preview
    'twitterbot',                // Twitter/X card preview
    'linkedinbot',               // LinkedIn
    'whatsapp',                  // WhatsApp link preview
    'telegrambot',               // Telegram link preview
    'slackbot',                  // Slack link unfurl
    'discordbot',                // Discord link preview
    'pinterestbot',

    // AI assistants & LLM crawlers
    'chatgpt-user',
    'gptbot',
    'oai-searchbot',             // OpenAI search
    'claudebot',
    'claude-web',
    'anthropic-ai',
    'perplexitybot',
    'cohere-ai',
    'meta-externalagent',        // Meta AI
    'bytespider',                // ByteDance/TikTok
    'google-extended',           // Gemini/Bard
    'ccbot',                     // Common Crawl (used by many AI)

    // Ad verification & monetization
    'adsbot-google',
    'mediapartners-google',      // AdSense crawler - CRITICAL for your issue
    'google-adwords',
    'adsbot',

    // SEO & monitoring tools
    'semrushbot',
    'ahrefsbot',
    'mj12bot',
    'dotbot',
    'rogerbot',
    'screaming frog',
    'sitebulb',

    // Generic crawler patterns
    'bot/',
    'crawler',
    'spider',
    'headlesschrome',
    'lighthouse',
    'pagespeed',
    'gtmetrix',
].join('|'), 'i');

/**
 * Detect if the request is from a bot/crawler
 * @param {Request} request - The SvelteKit request object
 * @returns {boolean}
 */
export function isBot(request) {
    const ua = request.headers.get('user-agent') || '';
    return BOT_PATTERN.test(ua);
}

/**
 * Get the bot name for logging/debugging
 * @param {Request} request
 * @returns {string|null}
 */
export function getBotName(request) {
    const ua = request.headers.get('user-agent') || '';
    const match = ua.match(BOT_PATTERN);
    return match ? match[0] : null;
}
