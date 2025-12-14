import { error } from '@sveltejs/kit';

/** @type {import('./$types').PageLoad} */
export const load = async ({ params }) => {
  try {
    const page = await import(`../../pages/${params.slug}.md`);
    return {
      content: page.default,
      ...page.metadata
    };
  } catch (e) {
    throw error(404, 'Page not found');
  }
};
