<script>
  /** @type {{ data: import('./$types').PageData }} */
  let { data } = $props();
</script>

<svelte:head>
  <title>{data.title}</title>
</svelte:head>

<main class="page-content">
  <h1 class="page-title">{data.title}</h1>
  <article class="markdown-body">
    <data.content />
  </article>
</main>

<style>
  .page-content {
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem 1rem;
  }
  .page-title {
    margin-bottom: 2rem;
    text-align: center;
  }
</style>
