/** @type {import('./$types').PageLoad} */
export const load = async ({ data, params }) => {
  // data contains the result from +page.server.js (metadata, validation success)

  // We need to find the correct file since slug is now just the title key,
  // excluding the date prefix present in the filename.
  const modules = import.meta.glob('/src/posts/*.md');

  let matchPath = '';

  for (const path in modules) {
    const filename = path.split('/').pop()?.replace('.md', '') ?? '';

    // Extract slug from YYYY-MM-DD-slug format
    const match = filename.match(/^(\d{4}-\d{2}-\d{2})-(.+)$/);
    if (match) {
      if (match[2] === params.slug) {
        matchPath = path;
        break;
      }
    } else {
      // Fallback if no date prefix
      if (filename === params.slug) {
        matchPath = path;
        break;
      }
    }
  }

  if (!matchPath) {
    // Should not happen if server validation passed, but safety check
    throw new Error(`Post content not found for slug: ${params.slug}`);
  }

  const post = await modules[matchPath]();
  // @ts-ignore
  const content = post.default;

  return {
    ...data,
    content
  };
};
