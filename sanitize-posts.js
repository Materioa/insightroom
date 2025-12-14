/**
 * Script to sanitize markdown posts for SvelteKit/mdsvex compatibility
 * Escapes Svelte-specific characters in markdown content
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const postsDir = path.join(__dirname, 'src', 'posts');

function sanitizeForSvelte(content) {
    // Split content into frontmatter and body
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

    if (!frontmatterMatch) {
        return content;
    }

    const frontmatter = frontmatterMatch[1];
    let body = frontmatterMatch[2];

    // Protect code blocks (fenced and indented)
    const codeBlocks = [];
    body = body.replace(/```[\s\S]*?```/g, (match) => {
        codeBlocks.push(match);
        return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
    });

    // Protect inline code
    const inlineCode = [];
    body = body.replace(/`[^`\n]+`/g, (match) => {
        inlineCode.push(match);
        return `__INLINE_CODE_${inlineCode.length - 1}__`;
    });

    // Protect HTML tags we want to keep (like <details>, <summary>, etc.)
    const htmlTags = [];
    body = body.replace(/<(details|summary|b|img|br|hr|div|span)[^>]*>|<\/(details|summary|b|img|br|hr|div|span)>/gi, (match) => {
        htmlTags.push(match);
        return `__HTML_TAG_${htmlTags.length - 1}__`;
    });

    // Escape curly braces
    body = body.replace(/\{/g, '&#123;');
    body = body.replace(/\}/g, '&#125;');

    // In table cells, escape < and > that are not part of valid HTML
    // Tables are lines starting with |
    body = body.split('\n').map(line => {
        if (line.trim().startsWith('|') && !line.match(/^__/)) {
            // This is a table row - escape < and > that aren't HTML tags
            return line.replace(/\|([^|]*)\|/g, (match, cellContent) => {
                // Escape < and > that aren't part of __HTML_TAG__ placeholders
                let escaped = cellContent
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;');
                return `|${escaped}|`;
            });
        }
        return line;
    }).join('\n');

    // Restore HTML tags
    htmlTags.forEach((tag, i) => {
        body = body.replace(`__HTML_TAG_${i}__`, tag);
    });

    // Restore inline code
    inlineCode.forEach((code, i) => {
        body = body.replace(`__INLINE_CODE_${i}__`, code);
    });

    // Restore code blocks
    codeBlocks.forEach((code, i) => {
        body = body.replace(`__CODE_BLOCK_${i}__`, code);
    });

    return `---\n${frontmatter}\n---\n${body}`;
}

// Process all markdown files
const files = fs.readdirSync(postsDir).filter(f => f.endsWith('.md'));

files.forEach(file => {
    const filePath = path.join(postsDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const sanitized = sanitizeForSvelte(content);

    if (content !== sanitized) {
        fs.writeFileSync(filePath, sanitized);
        console.log(`Sanitized: ${file}`);
    }
});

console.log('Done sanitizing posts.');
