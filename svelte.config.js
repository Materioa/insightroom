import adapter from '@sveltejs/adapter-auto';
import { mdsvex } from 'mdsvex';
import remarkGfm from 'remark-gfm';

// Custom rehype plugin to escape Svelte syntax in text nodes
function rehypeEscapeSvelte() {
    return (tree) => {
        function visit(node) {
            if (node.type === 'text' && node.value) {
                // Escape curly braces and angle brackets that could be interpreted as Svelte
                node.value = node.value
                    .replace(/\{/g, '&#123;')
                    .replace(/\}/g, '&#125;')
                    .replace(/</g, '&lt;');
            }
            if (node.children) {
                node.children.forEach(visit);
            }
        }
        visit(tree);
    };
}

/** @type {import('mdsvex').MdsvexOptions} */
const mdsvexOptions = {
    extensions: ['.md'],
    smartypants: false,
    highlight: false, // Disable build-time highlighting to prevent Svelte parsing errors on code block content
    remarkPlugins: [remarkGfm],
    rehypePlugins: [rehypeEscapeSvelte]
};

/** @type {import('@sveltejs/kit').Config} */
const config = {
    extensions: ['.svelte', '.md'],
    preprocess: [mdsvex(mdsvexOptions)],
    kit: {
        adapter: adapter()
    }
};

export default config;
