<script>
  import * as d3 from 'd3';
  import { onMount } from 'svelte';

  // Props using Svelte 5 runes
  /** @type {{ data: Array<{ date: string, views: number, duration: number }>, height?: number }} */
  let { data = [], height = 220 } = $props();

  let container = $state();
  let width = $state(500);
  let hoverIndex = $state(-1);
  let hoverX = $state(0);
  let hoverY = $state(0);

  const margin = { top: 20, right: 20, bottom: 30, left: 40 };

  // Parse and sort data
  let parsedData = $derived(
    data.map(d => ({
      date: new Date(d.date),
      views: Number(d.views || 0),
      duration: Number(d.duration || 0)
    })).sort((a, b) => a.date.getTime() - b.date.getTime())
  );

  // Scales
  let xScale = $derived(
    d3.scaleTime()
      .domain(
        /** @type {[Date, Date]} */ (d3.extent(parsedData, d => d.date))[0] && 
        /** @type {[Date, Date]} */ (d3.extent(parsedData, d => d.date))[1]
          ? /** @type {[Date, Date]} */ (d3.extent(parsedData, d => d.date))
          : [new Date(), new Date()]
      )
      .range([margin.left, width - margin.right])
  );

  let yScale = $derived(
    d3.scaleLinear()
      .domain([0, (d3.max(parsedData, d => d.views) ?? 10) * 1.15 || 10])
      .nice()
      .range([height - margin.bottom, margin.top])
  );

  // Paths generators
  let linePath = $derived(
    (/** @type {any} */ (d3.line()))
      .x((/** @type {any} */ d) => xScale(d.date))
      .y((/** @type {any} */ d) => yScale(d.views))
      .curve(d3.curveMonotoneX)(parsedData)
  );

  // @ts-ignore
  let areaPath = $derived(
    (/** @type {any} */ (d3.area()))
      .x((/** @type {any} */ d) => xScale(d.date))
      .y0(height - margin.bottom)
      .y1((/** @type {any} */ d) => yScale(d.views))
      .curve(d3.curveMonotoneX)(parsedData)
  );

  // Ticks
  let yTicks = $derived(yScale.ticks(5));
  let xTicks = $derived(
    parsedData.length > 7
      ? xScale.ticks(d3.timeDay.every(Math.ceil(parsedData.length / 5)) || d3.timeDay)
      : xScale.ticks(parsedData.length || 5)
  );

  // Resize listener
  onMount(() => {
    if (typeof window !== 'undefined') {
      const resizeObserver = new ResizeObserver(entries => {
        for (let entry of entries) {
          width = entry.contentRect.width || 500;
        }
      });
      if (container) {
        resizeObserver.observe(container);
      }
      return () => {
        resizeObserver.disconnect();
      };
    }
  });

  // Handle hover tooltips
  /** @param {MouseEvent} event */
  function handleMouseMove(event) {
    if (!parsedData.length) return;
    const target = /** @type {SVGElement} */ (event.currentTarget);
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    
    // Find closest index
    const dateAtMouse = xScale.invert(mouseX);
    const bisect = d3.bisector(d => d.date).left;
    let index = bisect(parsedData, dateAtMouse);
    
    // Boundary check
    if (index >= parsedData.length) index = parsedData.length - 1;
    if (index < 0) index = 0;
    
    // Compare closest to left or right
    if (index > 0) {
      const dLeft = parsedData[index - 1];
      const dRight = parsedData[index];
      if (dateAtMouse.getTime() - dLeft.date.getTime() < dRight.date.getTime() - dateAtMouse.getTime()) {
        index = index - 1;
      }
    }
    
    hoverIndex = index;
    hoverX = xScale(parsedData[index].date);
    hoverY = yScale(parsedData[index].views);
  }

  function handleMouseLeave() {
    hoverIndex = -1;
  }
</script>

<div class="chart-wrapper" bind:this={container}>
  {#if !data || data.length === 0}
    <div class="empty-chart" style="height: {height}px;">No data available</div>
  {:else}
    <svg {width} {height} onmouseleave={handleMouseLeave} role="application" aria-label="Views Timeline">
      <defs>
        <!-- Neutral Premium Gradients -->
        <linearGradient id="chart-area-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--chart-fill-start, #e2e8f0)" stop-opacity="0.55" />
          <stop offset="100%" stop-color="var(--chart-fill-end, #f8fafc)" stop-opacity="0.05" />
        </linearGradient>
      </defs>

      <!-- Grid lines -->
      <g class="grid-lines">
        {#each yTicks as tick}
          <line
            x1={margin.left}
            x2={width - margin.right}
            y1={yScale(tick)}
            y2={yScale(tick)}
            stroke="var(--chart-grid, #f1f5f9)"
            stroke-width="1"
          />
        {/each}
      </g>

      <!-- Area Path -->
      <path d={areaPath} fill="url(#chart-area-grad)" />

      <!-- Line Path -->
      <path
        d={linePath}
        fill="none"
        stroke="var(--chart-stroke, #475569)"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />

      <!-- X Axis Ticks -->
      <g class="axis x-axis">
        {#each xTicks as tick}
          <text
            x={xScale(tick)}
            y={height - margin.bottom + 18}
            text-anchor="middle"
            fill="var(--chart-text, #94a3b8)"
            font-size="10px"
          >
            {d3.timeFormat('%b %d')(tick)}
          </text>
        {/each}
      </g>

      <!-- Y Axis Ticks -->
      <g class="axis y-axis">
        {#each yTicks as tick}
          <text
            x={margin.left - 10}
            y={yScale(tick) + 3}
            text-anchor="end"
            fill="var(--chart-text, #94a3b8)"
            font-size="10px"
          >
            {tick}
          </text>
        {/each}
      </g>

      <!-- Hover Interactive Rect -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <rect
        x={margin.left}
        y={margin.top}
        width={width - margin.left - margin.right}
        height={height - margin.top - margin.bottom}
        fill="transparent"
        onmousemove={handleMouseMove}
      />

      <!-- Hover Info Line & Circle -->
      {#if hoverIndex !== -1}
        <line
          x1={hoverX}
          x2={hoverX}
          y1={margin.top}
          y2={height - margin.bottom}
          stroke="var(--chart-stroke-hover, #64748b)"
          stroke-dasharray="3 3"
          stroke-width="1.2"
        />

        <circle
          cx={hoverX}
          cy={hoverY}
          r="5"
          fill="var(--chart-stroke, #475569)"
          stroke="var(--chart-dot-border, #fff)"
          stroke-width="1.5"
          style="box-shadow: 0 0 10px rgba(0,0,0,0.15)"
        />
      {/if}
    </svg>

    <!-- Tooltip Overlay -->
    {#if hoverIndex !== -1}
      <div
        class="chart-tooltip"
        style="
          left: {Math.min(width - 150, Math.max(margin.left + 5, hoverX - 70))}px;
          bottom: {height - hoverY + 12}px;
        "
      >
        <div class="tooltip-date">
          {d3.timeFormat('%A, %B %d, %Y')(parsedData[hoverIndex].date)}
        </div>
        <div class="tooltip-row">
          <span class="dot"></span>
          <span class="label">Views:</span>
          <span class="value">{parsedData[hoverIndex].views}</span>
        </div>
        {#if parsedData[hoverIndex].duration > 0}
          <div class="tooltip-row">
            <span class="dot sec"></span>
            <span class="label">Read Time:</span>
            <span class="value">
              {parsedData[hoverIndex].duration >= 60 
                ? `${Math.round(parsedData[hoverIndex].duration / 60)}m` 
                : `${parsedData[hoverIndex].duration}s`}
            </span>
          </div>
        {/if}
      </div>
    {/if}
  {/if}
</div>

<style>
  .chart-wrapper {
    position: relative;
    width: 100%;
    margin: 1rem 0;
  }

  .empty-chart {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--chart-text, #94a3b8);
    font-size: 13px;
    border: 1px dashed var(--chart-grid, #f1f5f9);
    border-radius: 8px;
    width: 100%;
  }

  svg {
    display: block;
    overflow: visible;
  }

  .chart-tooltip {
    position: absolute;
    background: var(--tooltip-bg, #1e293b);
    color: var(--tooltip-color, #f8fafc);
    border-radius: 6px;
    padding: 8px 12px;
    font-size: 11px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    pointer-events: none;
    z-index: 100;
    min-width: 130px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-family: var(--font-primary, system-ui, sans-serif);
    transition: left 0.05s ease-out, bottom 0.05s ease-out;
  }

  .tooltip-date {
    font-weight: 600;
    margin-bottom: 2px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    padding-bottom: 3px;
    opacity: 0.85;
  }

  .tooltip-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .tooltip-row .dot {
    width: 6px;
    height: 6px;
    background-color: var(--chart-stroke, #3b82f6);
    border-radius: 50%;
  }

  .tooltip-row .dot.sec {
    background-color: #a8a29e;
  }

  .tooltip-row .label {
    opacity: 0.7;
    flex-grow: 1;
  }

  .tooltip-row .value {
    font-weight: 700;
  }

  /* Themes support */
  :global(body.dark) {
    --chart-stroke: #cbd5e1;
    --chart-fill-start: #334155;
    --chart-fill-end: #1e293b;
    --chart-grid: #334155;
    --chart-text: #64748b;
    --chart-stroke-hover: #94a3b8;
    --chart-dot-border: #0f172a;
    --tooltip-bg: #f8fafc;
    --tooltip-color: #0f172a;
  }
</style>
