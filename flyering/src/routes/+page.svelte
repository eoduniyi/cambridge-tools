<script lang="ts">
	import { onMount } from 'svelte';
	import {
		LOCATIONS,
		CAMBRIDGE_BOUNDS,
		LEGAL_RULES,
		buildDistanceMatrix,
		nearestNeighbor,
		twoOpt,
		bruteForce,
		theme,
		THEMES,
		type ThemeName,
		type ThemeTokens,
		type SolverResult,
		type FlyerLocation
	} from '$lib';

	let map: L.Map | null = $state(null);
	let tileLayer: L.TileLayer | null = $state(null);
	let routeLayer: L.Polyline | null = $state(null);
	let markers: L.CircleMarker[] = $state([]);
	let solverResult: SolverResult | null = $state(null);
	let selectedAlgorithm = $state<'nearest' | '2opt' | 'brute'>('nearest');
	let startIdx = $state(0);
	let showAlgorithm = $state(false);
	let showLegal = $state(false);
	let animating = $state(false);
	let currentTheme = $state<ThemeName>('dark');

	// Floating panel state
	let codeFloating = $state(false);
	let floatX = $state(400);
	let floatY = $state(100);
	let dragging = $state(false);
	let dragOffsetX = 0;
	let dragOffsetY = 0;

	const matrix = buildDistanceMatrix(LOCATIONS);

	$effect(() => {
		theme.set(currentTheme);
	});

	function tokens(): ThemeTokens {
		return THEMES[currentTheme];
	}

	const ALGORITHM_INFO: Record<string, { name: string; complexity: string; description: string; pseudocode: string[] }> = {
		nearest: {
			name: 'Nearest Neighbor',
			complexity: 'O(n\u00B2)',
			description: 'Greedy heuristic. From start, always visit the closest unvisited node. Fast but suboptimal.',
			pseudocode: [
				'function nearestNeighbor(s, V):',
				'  visited \u2190 {s}',
				'  route \u2190 [s]',
				'  cur \u2190 s',
				'',
				'  while |visited| < |V|:',
				'    nn \u2190 argmin d(cur, j), j \u2209 visited',
				'    route.append(nn)',
				'    visited.add(nn)',
				'    cur \u2190 nn',
				'',
				'  return route'
			]
		},
		'2opt': {
			name: '2-Opt Local Search',
			complexity: 'O(n\u00B2 \u00D7 k)',
			description: 'Improvement heuristic. Reverse sub-segments of an initial tour; keep if shorter. Converges to a local minimum.',
			pseudocode: [
				'function twoOpt(route, D):',
				'  improved \u2190 true',
				'',
				'  while improved:',
				'    improved \u2190 false',
				'    for i \u2208 1\u2026n-1:',
				'      for j \u2208 i+1\u2026n:',
				'        r\u2032 \u2190 reverse(route[i..j])',
				'        if cost(r\u2032) < cost(route):',
				'          route \u2190 r\u2032',
				'          improved \u2190 true',
				'',
				'  return route'
			]
		},
		brute: {
			name: 'Brute Force',
			complexity: 'O(n!)',
			description: 'Exhaustive enumeration. Guarantees optimality. 12 nodes = 39,916,800 tours. Intractable beyond small n.',
			pseudocode: [
				'function bruteForce(s, V):',
				'  best \u2190 \u221E',
				'  bestR \u2190 null',
				'',
				'  for P in permutations(V\\{s}):',
				'    r \u2190 [s] + P',
				'    d \u2190 cost(r) + d(last(P), s)',
				'    if d < best:',
				'      best \u2190 d',
				'      bestR \u2190 r',
				'',
				'  return bestR'
			]
		}
	};

	function solve() {
		let result: SolverResult;
		switch (selectedAlgorithm) {
			case 'brute':
				result = bruteForce(matrix, startIdx);
				break;
			case '2opt': {
				const nn = nearestNeighbor(matrix, startIdx);
				result = twoOpt(matrix, nn.route);
				break;
			}
			case 'nearest':
			default:
				result = nearestNeighbor(matrix, startIdx);
				break;
		}
		solverResult = result;
		drawRoute(result.route);
		updateMarkerStyles();
	}

	function drawRoute(route: number[]) {
		if (!map) return;
		if (routeLayer) map.removeLayer(routeLayer);

		const t = tokens();
		const coords = route.map((idx) => LOCATIONS[idx].coords as [number, number]);
		coords.push(LOCATIONS[route[0]].coords);

		if (animating) {
			animateRoute(coords, t);
		} else {
			routeLayer = L.polyline(coords, {
				color: t.text,
				weight: 1.5,
				opacity: 0.5,
				dashArray: '6, 6'
			}).addTo(map);
		}
	}

	function animateRoute(coords: [number, number][], t: ThemeTokens) {
		if (!map) return;
		let i = 0;
		const drawn: [number, number][] = [coords[0]];

		routeLayer = L.polyline(drawn, {
			color: t.text,
			weight: 1.5,
			opacity: 0.7
		}).addTo(map);

		const interval = setInterval(() => {
			i++;
			if (i >= coords.length) {
				clearInterval(interval);
				animating = false;
				return;
			}
			drawn.push(coords[i]);
			routeLayer!.setLatLngs(drawn);
		}, 250);
	}

	function updateMarkerStyles() {
		if (!map) return;
		const t = tokens();
		markers.forEach((marker, idx) => {
			const loc = LOCATIONS[idx];
			const isStart = idx === startIdx;
			const fillColor = loc.legal === 'permitted' ? t.markerBright
				: loc.legal === 'ask-permission' ? t.markerMid : t.markerDim;
			marker.setStyle({
				fillColor,
				color: isStart ? t.text : 'transparent',
				weight: isStart ? 2 : 0,
				radius: isStart ? 8 : 5
			});
		});
	}

	function updateMapTheme() {
		if (!map) return;
		const t = tokens();

		if (tileLayer) map.removeLayer(tileLayer);
		tileLayer = L.tileLayer(t.mapTile, {
			attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
			subdomains: 'abcd',
			maxZoom: 19
		}).addTo(map);

		updateMarkerStyles();
		if (solverResult) drawRoute(solverResult.route);
	}

	function onDragStart(e: MouseEvent) {
		dragging = true;
		dragOffsetX = e.clientX - floatX;
		dragOffsetY = e.clientY - floatY;
		e.preventDefault();
	}

	function onDragMove(e: MouseEvent) {
		if (!dragging) return;
		floatX = e.clientX - dragOffsetX;
		floatY = e.clientY - dragOffsetY;
	}

	function onDragEnd() {
		dragging = false;
	}

	function highlightLine(line: string): string {
		if (!line.trim()) return '&nbsp;';
		let out = line
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;');
		out = out.replace(/\b(function|return|while|for|if|in)\b/g, '<span class="kw">$1</span>');
		out = out.replace(/(\u2190)/g, '<span class="op">$1</span>');
		out = out.replace(/(\u221E|\u2209|\u2208|\u2216)/g, '<span class="sym">$1</span>');
		out = out.replace(/^(<span class="kw">function<\/span>) (\w+)/, '$1 <span class="fn">$2</span>');
		return out;
	}

	function cycleTheme() {
		const order: ThemeName[] = ['dark', 'cambridge', 'light'];
		const idx = order.indexOf(currentTheme);
		currentTheme = order[(idx + 1) % order.length];
		updateMapTheme();
	}

	onMount(async () => {
		const L = await import('leaflet');
		const t = tokens();

		map = L.map('map', {
			center: CAMBRIDGE_BOUNDS.center,
			zoom: 14,
			zoomControl: false
		});

		L.control.zoom({ position: 'bottomright' }).addTo(map);

		tileLayer = L.tileLayer(t.mapTile, {
			attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
			subdomains: 'abcd',
			maxZoom: 19
		}).addTo(map);

		LOCATIONS.forEach((loc, idx) => {
			const isStart = idx === startIdx;
			const radius = isStart ? 8 : 5;
			const fillColor = loc.legal === 'permitted' ? t.markerBright
				: loc.legal === 'ask-permission' ? t.markerMid : t.markerDim;

			const marker = L.circleMarker(loc.coords, {
				radius,
				fillColor,
				color: isStart ? t.text : 'transparent',
				weight: isStart ? 2 : 0,
				opacity: 1,
				fillOpacity: isStart ? 1 : 0.7
			}).addTo(map!);

			const confirmedBadge = loc.confirmed
				? '<span style="display:inline-block;background:#2a5a3a;color:#fff;font-size:0.6rem;padding:0.1rem 0.35rem;border-radius:2px;margin-top:0.25rem;">confirmed</span>'
				: '';

			marker.bindPopup(`
				<div style="color:#1a1a1a;font-family:inherit;min-width:180px;line-height:1.5;">
					<strong style="font-size:0.85rem;">${loc.name}</strong><br/>
					<span style="color:#555;font-size:0.8rem;">${loc.neighborhood}</span><br/>
					<span style="font-size:0.75rem;color:#333;">${loc.notes}</span>
					${confirmedBadge}
				</div>
			`);

			markers.push(marker);
		});

		solve();
	});
</script>

<svelte:window onmousemove={onDragMove} onmouseup={onDragEnd} />

<main
	style="
		--bg: {tokens().bg};
		--bg-panel: {tokens().bgPanel};
		--bg-card: {tokens().bgCard};
		--border: {tokens().border};
		--border-subtle: {tokens().borderSubtle};
		--text: {tokens().text};
		--text-muted: {tokens().textMuted};
		--text-dim: {tokens().textDim};
		--accent: {tokens().accent};
		--code-bg: {tokens().codeBg};
		--code-text: {tokens().codeText};
		--code-kw: {tokens().codeKw};
		--code-op: {tokens().codeOp};
		--code-sym: {tokens().codeSym};
		--code-fn: {tokens().codeFn};
		--code-line-num: {tokens().codeLineNum};
	"
>
	<header>
		<div class="header-content">
			<h1>The Traveling Flyerperson</h1>
			<p class="subtitle">Where do I place these flyers in Cambridge, MA?</p>
		</div>
		<div class="header-right">
			<button class="theme-btn" onclick={cycleTheme} title="Switch theme">
				{currentTheme === 'dark' ? '\u25CF' : currentTheme === 'cambridge' ? '\u25D0' : '\u25CB'}
				<span class="theme-label">{currentTheme}</span>
			</button>
			<a href="https://www.cambridge-dev.org/" class="org" target="_blank" rel="noopener">cambridge-dev.org</a>
		</div>
	</header>

	<div class="layout">
		<aside class="panel">
			<!-- Start Point -->
			<section class="section">
				<h2>Start</h2>
				<select class="start-select" bind:value={startIdx} onchange={() => solve()}>
					{#each LOCATIONS as loc, i}
						<option value={i}>{loc.name}{loc.confirmed ? ' \u2713' : ''}</option>
					{/each}
				</select>
			</section>

			<!-- Solver Controls -->
			<section class="section">
				<h2>Solver</h2>
				<div class="algorithm-select">
					{#each [
						{ value: 'nearest', label: 'Nearest Neighbor' },
						{ value: '2opt', label: '2-Opt' },
						{ value: 'brute', label: 'Brute Force' }
					] as algo}
						<button
							class="algo-btn"
							class:active={selectedAlgorithm === algo.value}
							onclick={() => { selectedAlgorithm = algo.value as typeof selectedAlgorithm; solve(); }}
						>{algo.label}</button>
					{/each}
				</div>

				<div class="actions">
					<button class="action-btn" onclick={() => { animating = true; solve(); }}>Animate</button>
					<button class="action-btn secondary" onclick={() => (showAlgorithm = !showAlgorithm)}>
						{showAlgorithm ? 'Hide' : 'Show'} algorithm
					</button>
				</div>
			</section>

			<!-- Algorithm Detail -->
			{#if showAlgorithm}
				<section class="section algorithm-detail">
					<div class="algo-header-row">
						<div>
							<h2>{ALGORITHM_INFO[selectedAlgorithm].name}</h2>
							<span class="complexity">{ALGORITHM_INFO[selectedAlgorithm].complexity}</span>
						</div>
						<button
							class="float-btn"
							onclick={() => (codeFloating = !codeFloating)}
							title={codeFloating ? 'Dock pseudocode' : 'Float pseudocode'}
						>
							{codeFloating ? '\u25A3' : '\u2197'}
						</button>
					</div>
					<p class="algo-description">{ALGORITHM_INFO[selectedAlgorithm].description}</p>

					{#if !codeFloating}
						<div class="pseudocode">
							{#each ALGORITHM_INFO[selectedAlgorithm].pseudocode as line, i}
								<div class="code-line">
									<span class="line-num">{i + 1}</span>
									<span class="line-content">{@html highlightLine(line)}</span>
								</div>
							{/each}
						</div>
					{/if}
				</section>
			{/if}

			<!-- Results -->
			{#if solverResult}
				<section class="section">
					<h2>Route</h2>
					<div class="stats">
						<div class="stat-row">
							<span>Distance</span>
							<span class="stat-value">{solverResult.distance.toFixed(2)} mi</span>
						</div>
						<div class="stat-row">
							<span>Stops</span>
							<span class="stat-value">{solverResult.route.length}</span>
						</div>
						{#if solverResult.iterations}
							<div class="stat-row">
								<span>Iterations</span>
								<span class="stat-value">{solverResult.iterations.toLocaleString()}</span>
							</div>
						{/if}
						<div class="stat-row">
							<span>Confirmed</span>
							<span class="stat-value">{LOCATIONS.filter(l => l.confirmed).length} / {LOCATIONS.length}</span>
						</div>
					</div>

					<ol class="route-list">
						{#each solverResult.route as idx, i}
							<li>
								<span class="stop-num">{i + 1}</span>
								<span class="stop-name">
									{LOCATIONS[idx].name}
									{#if LOCATIONS[idx].confirmed}
										<span class="confirmed-badge">\u2713</span>
									{/if}
								</span>
							</li>
						{/each}
					</ol>
					<div class="route-return">Return to {LOCATIONS[startIdx].name}</div>
				</section>
			{/if}

			<!-- Legal -->
			<section class="section">
				<button class="section-toggle" onclick={() => (showLegal = !showLegal)}>
					<h2>Legal</h2>
					<span class="toggle-indicator">{showLegal ? '\u2212' : '+'}</span>
				</button>

				{#if showLegal}
					<div class="legal-list">
						{#each LEGAL_RULES as rule}
							<div class="legal-item">
								<div class="legal-header">
									<span class="legal-title">{rule.title}</span>
									<span class="legal-category" class:prohibited={rule.category === 'prohibited'} class:permitted={rule.category === 'permitted'}>{rule.category}</span>
								</div>
								<p class="legal-desc">{rule.description}</p>
								{#if rule.penalty}
									<span class="legal-penalty">{rule.penalty}</span>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</section>

			<!-- Legend -->
			<section class="section legend">
				<h2>Map</h2>
				<div class="legend-items">
					<div class="legend-row"><span class="legend-dot start"></span><span>Start point</span></div>
					<div class="legend-row"><span class="legend-dot bright"></span><span>Permitted</span></div>
					<div class="legend-row"><span class="legend-dot mid"></span><span>Ask permission</span></div>
					<div class="legend-row"><span class="legend-dot dim"></span><span>Restricted</span></div>
				</div>
			</section>
		</aside>

		<div id="map"></div>
	</div>

	<!-- Floating pseudocode panel -->
	{#if codeFloating && showAlgorithm}
		<div
			class="floating-code"
			style="left: {floatX}px; top: {floatY}px;"
			role="dialog"
			aria-label="Pseudocode"
		>
			<div class="floating-header" role="toolbar" aria-label="Drag to reposition" onmousedown={onDragStart}>
				<span class="floating-title">{ALGORITHM_INFO[selectedAlgorithm].name}</span>
				<button class="floating-close" onclick={() => (codeFloating = false)}>&times;</button>
			</div>
			<div class="floating-body">
				{#each ALGORITHM_INFO[selectedAlgorithm].pseudocode as line, i}
					<div class="code-line">
						<span class="line-num">{i + 1}</span>
						<span class="line-content">{@html highlightLine(line)}</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</main>

<style>
	main {
		height: 100vh;
		display: flex;
		flex-direction: column;
		background: var(--bg);
		color: var(--text);
		transition: background 0.2s, color 0.2s;
	}

	header {
		padding: 1.25rem 2rem;
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		border-bottom: 1px solid var(--border);
	}

	h1 {
		margin: 0;
		font-size: 1.1rem;
		font-weight: 500;
		letter-spacing: -0.01em;
		color: var(--text);
	}

	.subtitle {
		margin: 0.2rem 0 0;
		color: var(--text-dim);
		font-size: 0.8rem;
	}

	.header-right {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.theme-btn {
		background: none;
		border: 1px solid var(--border);
		color: var(--text-dim);
		padding: 0.35rem 0.6rem;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.75rem;
		display: flex;
		align-items: center;
		gap: 0.4rem;
		transition: all 0.15s;
	}

	.theme-btn:hover {
		color: var(--text);
		border-color: var(--text-muted);
	}

	.theme-label {
		text-transform: capitalize;
	}

	.org {
		color: var(--text-dim);
		font-size: 0.75rem;
		text-decoration: none;
		transition: color 0.15s;
	}

	.org:hover {
		color: var(--text);
	}

	.layout {
		display: flex;
		flex: 1;
		overflow: hidden;
	}

	aside.panel {
		width: 380px;
		padding: 1.5rem 2rem;
		overflow-y: auto;
		border-right: 1px solid var(--border);
		background: var(--bg-panel);
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}

	#map {
		flex: 1;
		min-height: 0;
	}

	.section {
		display: flex;
		flex-direction: column;
	}

	h2 {
		margin: 0 0 0.75rem;
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--text-dim);
		font-weight: 500;
	}

	/* Start select */
	.start-select {
		width: 100%;
		padding: 0.5rem 0.75rem;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: 4px;
		color: var(--text);
		font-size: 0.78rem;
		cursor: pointer;
		appearance: none;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23888' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 0.75rem center;
	}

	.start-select:focus {
		outline: none;
		border-color: var(--text-muted);
	}

	/* Algorithm selector */
	.algorithm-select {
		display: flex;
		gap: 0;
		border: 1px solid var(--border);
		border-radius: 4px;
		overflow: hidden;
	}

	.algo-btn {
		flex: 1;
		background: transparent;
		border: none;
		border-right: 1px solid var(--border);
		color: var(--text-dim);
		padding: 0.6rem 0.5rem;
		font-size: 0.75rem;
		cursor: pointer;
		transition: all 0.15s;
	}

	.algo-btn:last-child {
		border-right: none;
	}

	.algo-btn:hover {
		color: var(--text-muted);
	}

	.algo-btn.active {
		background: var(--bg-card);
		color: var(--text);
	}

	.actions {
		display: flex;
		gap: 0.5rem;
		margin-top: 1rem;
	}

	.action-btn {
		background: transparent;
		border: 1px solid var(--border);
		color: var(--text-muted);
		padding: 0.5rem 0.75rem;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.75rem;
		transition: all 0.15s;
	}

	.action-btn:hover {
		border-color: var(--text-muted);
		color: var(--text);
	}

	.action-btn.secondary {
		border-color: transparent;
		color: var(--text-dim);
	}

	.action-btn.secondary:hover {
		color: var(--text-muted);
	}

	/* Algorithm detail */
	.algorithm-detail {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 1.5rem;
		overflow: hidden;
	}

	.algo-header-row {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
	}

	.algorithm-detail h2 {
		color: var(--text);
		font-size: 0.85rem;
		text-transform: none;
		letter-spacing: -0.01em;
		font-weight: 500;
		margin-bottom: 0.2rem;
		font-family: 'Georgia', 'Times New Roman', serif;
	}

	.complexity {
		font-size: 0.7rem;
		color: var(--text-dim);
		font-family: 'SF Mono', 'Fira Code', monospace;
	}

	.float-btn {
		background: none;
		border: 1px solid var(--border);
		color: var(--text-dim);
		width: 1.6rem;
		height: 1.6rem;
		border-radius: 3px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.8rem;
		transition: all 0.15s;
		flex-shrink: 0;
	}

	.float-btn:hover {
		color: var(--text);
		border-color: var(--text-muted);
	}

	.algo-description {
		margin: 0.75rem 0 1rem;
		font-size: 0.8rem;
		line-height: 1.65;
		color: var(--text-muted);
		text-align: justify;
		hyphens: auto;
		font-family: 'Georgia', 'Times New Roman', serif;
	}

	/* Pseudocode block */
	.pseudocode {
		padding: 1rem 0;
		border-top: 1px solid var(--border);
		overflow-x: auto;
		max-width: 100%;
	}

	.code-line {
		display: flex;
		align-items: baseline;
		gap: 0.75rem;
		line-height: 1.9;
	}

	.line-num {
		width: 1.2rem;
		min-width: 1.2rem;
		text-align: right;
		font-size: 0.6rem;
		color: var(--code-line-num);
		font-family: 'SF Mono', 'Fira Code', monospace;
		flex-shrink: 0;
		user-select: none;
	}

	.line-content {
		font-family: 'SF Mono', 'Fira Code', monospace;
		font-size: 0.72rem;
		color: var(--code-text);
		white-space: pre;
	}

	:global(.code-line .kw) {
		color: var(--code-kw);
		font-weight: 500;
	}

	:global(.code-line .op) {
		color: var(--code-op);
	}

	:global(.code-line .sym) {
		color: var(--code-sym);
		font-style: italic;
	}

	:global(.code-line .fn) {
		color: var(--code-fn);
	}

	/* Floating panel */
	.floating-code {
		position: fixed;
		z-index: 9999;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 8px;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
		min-width: 280px;
		max-width: 420px;
	}

	.floating-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.6rem 1rem;
		border-bottom: 1px solid var(--border);
		cursor: grab;
		user-select: none;
	}

	.floating-header:active {
		cursor: grabbing;
	}

	.floating-title {
		font-size: 0.7rem;
		color: var(--text-dim);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.floating-close {
		background: none;
		border: none;
		color: var(--text-dim);
		font-size: 1.1rem;
		cursor: pointer;
		padding: 0;
		line-height: 1;
	}

	.floating-close:hover {
		color: var(--text);
	}

	.floating-body {
		padding: 1rem 1.25rem;
		overflow-x: auto;
	}

	/* Stats */
	.stats {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		margin-bottom: 1rem;
	}

	.stat-row {
		display: flex;
		justify-content: space-between;
		font-size: 0.8rem;
		color: var(--text-dim);
	}

	.stat-value {
		color: var(--text);
		font-family: 'SF Mono', 'Fira Code', monospace;
		font-size: 0.75rem;
	}

	/* Route list */
	.route-list {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}

	.route-list li {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.35rem 0;
		font-size: 0.78rem;
		border-bottom: 1px solid var(--border-subtle);
	}

	.route-list li:last-child {
		border-bottom: none;
	}

	.stop-num {
		width: 1.4rem;
		height: 1.4rem;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.65rem;
		color: var(--text-dim);
		border: 1px solid var(--border);
		border-radius: 50%;
		flex-shrink: 0;
	}

	.stop-name {
		color: var(--text-muted);
		font-size: 0.78rem;
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.confirmed-badge {
		font-size: 0.65rem;
		color: var(--accent);
		opacity: 0.7;
	}

	.route-return {
		margin-top: 0.5rem;
		font-size: 0.7rem;
		color: var(--text-dim);
		font-style: italic;
		opacity: 0.6;
	}

	/* Legal */
	.section-toggle {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		color: inherit;
	}

	.section-toggle h2 {
		margin: 0;
	}

	.toggle-indicator {
		color: var(--text-dim);
		font-size: 1rem;
	}

	.legal-list {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		margin-top: 0.75rem;
	}

	.legal-item {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.legal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.legal-title {
		font-size: 0.8rem;
		color: var(--text);
		font-weight: 500;
		font-family: 'Georgia', 'Times New Roman', serif;
	}

	.legal-category {
		font-size: 0.6rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-dim);
	}

	.legal-category.prohibited {
		color: var(--text-muted);
	}

	.legal-category.permitted {
		color: var(--text-dim);
	}

	.legal-desc {
		margin: 0.15rem 0 0;
		font-size: 0.75rem;
		line-height: 1.55;
		color: var(--text-dim);
		text-align: justify;
		hyphens: auto;
		font-family: 'Georgia', 'Times New Roman', serif;
	}

	.legal-penalty {
		font-size: 0.7rem;
		color: var(--text-muted);
		font-family: 'SF Mono', 'Fira Code', monospace;
		margin-top: 0.15rem;
	}

	/* Legend */
	.legend {
		margin-top: auto;
		padding-top: 1rem;
		border-top: 1px solid var(--border-subtle);
	}

	.legend-items {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.legend-row {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		font-size: 0.75rem;
		color: var(--text-dim);
	}

	.legend-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.legend-dot.start {
		background: var(--text);
		box-shadow: 0 0 0 2px var(--bg), 0 0 0 3px var(--text);
	}

	.legend-dot.bright {
		background: var(--text);
	}

	.legend-dot.mid {
		background: var(--text-muted);
	}

	.legend-dot.dim {
		background: var(--text-dim);
	}
</style>
