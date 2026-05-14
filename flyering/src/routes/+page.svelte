<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import {
		LOCATIONS,
		CAMBRIDGE_BOUNDS,
		FLYER_POPULATION_ESTIMATE,
		LEGAL_RULES,
		buildDistanceMatrix,
		nearestNeighbor,
		twoOpt,
		bruteForce,
		theme,
		THEMES,
		TRAFFIC_SIGNALS,
		BOARD_CANDIDATES,
		TRANSIT_POINTS,
		OVERPASS_SUMMARY,
		EVIDENCE_PHOTOS,
		type ThemeName,
		type ThemeTokens,
		type SolverResult,
		type FlyerLocation,
		type OverpassPOI,
		type EvidencePhoto
	} from '$lib';

	let map: L.Map | null = $state(null);
	let tileLayer: L.TileLayer | null = $state(null);
	let routeLayer: L.Polyline | null = $state(null);
	let markers: L.CircleMarker[] = $state([]);

	// Overpass layer groups
	let signalsLayer: L.LayerGroup | null = null;
	let boardsLayer: L.LayerGroup | null = null;
	let transitLayer: L.LayerGroup | null = null;
	let photosLayer: L.LayerGroup | null = null;

	let showSignals = $state(false);
	let showBoards = $state(false);
	let showTransit = $state(false);
	let showPhotos = $state(true);
	let solverResult: SolverResult | null = $state(null);
	let selectedAlgorithm = $state<'nearest' | '2opt' | 'brute'>('nearest');
	let startIdx = $state(0);
	let showAlgorithm = $state(false);
	let algoPopped = $state(false);
	let showLegal = $state(false);
	let animating = $state(false);
	let currentTheme = $state<ThemeName>('dark');

	// Evidence viewer
	let evidenceLocation = $state<FlyerLocation | null>(null);

	// Mobile state
	let sheetState = $state<'collapsed' | 'peek' | 'full'>('peek');
	let sheetDragging = $state(false);
	let sheetStartY = 0;
	let sheetStartState: typeof sheetState = 'peek';

	// Desktop floating panel state
	let codeFloating = $state(false);
	let floatX = $state(400);
	let floatY = $state(100);
	let dragging = $state(false);
	let dragOffsetX = 0;
	let dragOffsetY = 0;

	const matrix = buildDistanceMatrix(LOCATIONS);

	$effect(() => { theme.set(currentTheme); });

	function tokens(): ThemeTokens { return THEMES[currentTheme]; }

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
			case 'brute': result = bruteForce(matrix, startIdx); break;
			case '2opt': { const nn = nearestNeighbor(matrix, startIdx); result = twoOpt(matrix, nn.route); break; }
			default: result = nearestNeighbor(matrix, startIdx); break;
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
		if (animating) { animateRoute(coords, t); }
		else { routeLayer = L.polyline(coords, { color: t.text, weight: 1.5, opacity: 0.5, dashArray: '6, 6' }).addTo(map); }
	}

	function animateRoute(coords: [number, number][], t: ThemeTokens) {
		if (!map) return;
		let i = 0;
		const drawn: [number, number][] = [coords[0]];
		routeLayer = L.polyline(drawn, { color: t.text, weight: 1.5, opacity: 0.7 }).addTo(map);

		let lastTime = 0;
		const stepDelay = 200; // ms between steps

		function step(timestamp: number) {
			if (timestamp - lastTime < stepDelay) {
				requestAnimationFrame(step);
				return;
			}
			lastTime = timestamp;
			i++;
			if (i >= coords.length) { animating = false; return; }
			drawn.push(coords[i]);
			routeLayer!.setLatLngs([...drawn]);
			requestAnimationFrame(step);
		}
		requestAnimationFrame(step);
	}

	function updateMarkerStyles() {
		if (!map) return;
		const t = tokens();
		markers.forEach((marker, idx) => {
			const loc = LOCATIONS[idx];
			const isStart = idx === startIdx;
			const fillColor = loc.legal === 'permitted' ? t.markerBright : loc.legal === 'ask-permission' ? t.markerMid : t.markerDim;
			marker.setStyle({ fillColor, color: isStart ? t.text : 'transparent', weight: isStart ? 2 : 0, radius: isStart ? 8 : 5 });
		});
	}

	function updateMapTheme() {
		if (!map) return;
		const t = tokens();
		if (tileLayer) map.removeLayer(tileLayer);
		tileLayer = L.tileLayer(t.mapTile, { attribution: '&copy; OSM &copy; CARTO', subdomains: 'abcd', maxZoom: 19 }).addTo(map);
		updateMarkerStyles();
		if (solverResult) drawRoute(solverResult.route);
		// Rebuild overlay layers with new theme colors
		rebuildLayer('signals');
		rebuildLayer('boards');
		rebuildLayer('transit');
		rebuildLayer('photos');
	}

	function rebuildLayer(which: 'signals' | 'boards' | 'transit' | 'photos') {
		if (!map) return;
		const t = tokens();

		if (which === 'signals') {
			if (signalsLayer) { map.removeLayer(signalsLayer); signalsLayer = null; }
			if (!showSignals) return;
			signalsLayer = L.layerGroup();
			TRAFFIC_SIGNALS.forEach((p) => {
				L.circleMarker([p.lat, p.lng], {
					radius: 2,
					fillColor: '#ef4444',
					color: 'transparent',
					weight: 0,
					fillOpacity: 0.5
				}).addTo(signalsLayer!);
			});
			signalsLayer.addTo(map);
		}

		if (which === 'boards') {
			if (boardsLayer) { map.removeLayer(boardsLayer); boardsLayer = null; }
			if (!showBoards) return;
			boardsLayer = L.layerGroup();
			BOARD_CANDIDATES.forEach((p) => {
				const amenity = p.tags.amenity || p.tags.shop || 'other';
				const color = amenity === 'library' ? '#3b82f6'
					: amenity === 'cafe' ? '#a855f7'
					: amenity === 'community_centre' ? '#14b8a6'
					: amenity === 'books' ? '#f59e0b'
					: '#71717a';
				const marker = L.circleMarker([p.lat, p.lng], {
					radius: 3,
					fillColor: color,
					color: 'transparent',
					weight: 0,
					fillOpacity: 0.7
				}).addTo(boardsLayer!);
				const label = p.name || `(unnamed ${amenity})`;
				marker.bindPopup(`<div style="color:#1a1a1a;font-family:inherit;min-width:140px;font-size:0.75rem;"><strong>${label}</strong><br/><span style="color:#666;font-size:0.7rem;">${amenity}</span></div>`);
			});
			boardsLayer.addTo(map);
		}

		if (which === 'transit') {
			if (transitLayer) { map.removeLayer(transitLayer); transitLayer = null; }
			if (!showTransit) return;
			transitLayer = L.layerGroup();
			TRANSIT_POINTS.forEach((p) => {
				const marker = L.circleMarker([p.lat, p.lng], {
					radius: 4,
					fillColor: '#10b981',
					color: '#10b981',
					weight: 1,
					fillOpacity: 0.6
				}).addTo(transitLayer!);
				const label = p.name || 'Transit point';
				const kind = p.tags.railway || p.tags.public_transport || 'station';
				marker.bindPopup(`<div style="color:#1a1a1a;font-family:inherit;min-width:140px;font-size:0.75rem;"><strong>${label}</strong><br/><span style="color:#666;font-size:0.7rem;">${kind}</span></div>`);
			});
			transitLayer.addTo(map);
		}

		if (which === 'photos') {
			if (photosLayer) { map.removeLayer(photosLayer); photosLayer = null; }
			if (!showPhotos) return;
			photosLayer = L.layerGroup();
			EVIDENCE_PHOTOS.forEach((photo) => {
				const marker = L.circleMarker(photo.coords, {
					radius: 7,
					fillColor: t.accent,
					color: '#ffffff',
					weight: 2,
					opacity: 1,
					fillOpacity: 0.9
				}).addTo(photosLayer!);

				const dateStr = photo.takenAt ? new Date(photo.takenAt).toLocaleString() : 'unknown';
				marker.bindPopup(`
					<div style="color:#1a1a1a;font-family:inherit;min-width:200px;line-height:1.5;">
						<strong style="font-size:0.8rem;">Flyer photo</strong><br/>
						<span style="color:#666;font-size:0.7rem;">${dateStr}</span><br/>
						<img src="${base}/evidence/${photo.filename}" alt="Flyer evidence" style="width:100%;border-radius:4px;margin:0.5rem 0;max-height:240px;object-fit:cover;" />
						<span style="font-size:0.65rem;color:#888;font-family:monospace;">${photo.coords[0].toFixed(5)}, ${photo.coords[1].toFixed(5)}</span>
					</div>
				`, { maxWidth: 260 });
			});
			photosLayer.addTo(map);
		}
	}

	function toggleSignals() { showSignals = !showSignals; rebuildLayer('signals'); }
	function toggleBoards() { showBoards = !showBoards; rebuildLayer('boards'); }
	function toggleTransit() { showTransit = !showTransit; rebuildLayer('transit'); }
	function togglePhotos() { showPhotos = !showPhotos; rebuildLayer('photos'); }

	function cycleTheme() {
		const order: ThemeName[] = ['dark', 'cambridge', 'light'];
		const idx = order.indexOf(currentTheme);
		currentTheme = order[(idx + 1) % order.length];
		updateMapTheme();
	}

	// Sheet touch handling
	function onSheetTouchStart(e: TouchEvent) {
		sheetDragging = true;
		sheetStartY = e.touches[0].clientY;
		sheetStartState = sheetState;
	}

	function onSheetTouchMove(e: TouchEvent) {
		if (!sheetDragging) return;
		// Don't call preventDefault — touch listeners are passive by default in modern browsers.
		// We use CSS touch-action: none on the sheet handle instead.
	}

	function onSheetTouchEnd(e: TouchEvent) {
		if (!sheetDragging) return;
		sheetDragging = false;
		const dy = e.changedTouches[0].clientY - sheetStartY;
		const threshold = 50;

		if (dy < -threshold) {
			// Swiped up
			if (sheetStartState === 'collapsed') sheetState = 'peek';
			else if (sheetStartState === 'peek') sheetState = 'full';
		} else if (dy > threshold) {
			// Swiped down
			if (sheetStartState === 'full') sheetState = 'peek';
			else if (sheetStartState === 'peek') sheetState = 'collapsed';
		}
	}

	// Desktop drag
	function onDragStart(e: MouseEvent) { dragging = true; dragOffsetX = e.clientX - floatX; dragOffsetY = e.clientY - floatY; e.preventDefault(); }
	function onDragMove(e: MouseEvent) { if (!dragging) return; floatX = e.clientX - dragOffsetX; floatY = e.clientY - dragOffsetY; }
	function onDragEnd() { dragging = false; }

	function highlightLine(line: string): string {
		if (!line.trim()) return '&nbsp;';
		let out = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
		out = out.replace(/\b(function|return|while|for|if|in)\b/g, '<span class="kw">$1</span>');
		out = out.replace(/(\u2190)/g, '<span class="op">$1</span>');
		out = out.replace(/(\u221E|\u2209|\u2208|\u2216)/g, '<span class="sym">$1</span>');
		out = out.replace(/^(<span class="kw">function<\/span>) (\w+)/, '$1 <span class="fn">$2</span>');
		return out;
	}

	onMount(async () => {
		const L = await import('leaflet');
		const t = tokens();
		map = L.map('map', { center: CAMBRIDGE_BOUNDS.center, zoom: 14, zoomControl: false });
		L.control.zoom({ position: 'bottomright' }).addTo(map);
		tileLayer = L.tileLayer(t.mapTile, { attribution: '&copy; OSM &copy; CARTO', subdomains: 'abcd', maxZoom: 19 }).addTo(map);

		LOCATIONS.forEach((loc, idx) => {
			const isStart = idx === startIdx;
			const fillColor = loc.legal === 'permitted' ? t.markerBright : loc.legal === 'ask-permission' ? t.markerMid : t.markerDim;
			const marker = L.circleMarker(loc.coords, {
				radius: isStart ? 8 : 5, fillColor, color: isStart ? t.text : 'transparent',
				weight: isStart ? 2 : 0, opacity: 1, fillOpacity: isStart ? 1 : 0.7
			}).addTo(map!);

			// Build popup with photo if evidence exists
			let popupContent = `<div style="color:#1a1a1a;font-family:inherit;min-width:200px;line-height:1.5;">`;
			popupContent += `<strong style="font-size:0.85rem;">${loc.name}</strong><br/>`;
			popupContent += `<span style="color:#555;font-size:0.75rem;">${loc.neighborhood}</span><br/>`;
			if (loc.evidence) {
				popupContent += `<img src="${base}/evidence/${loc.evidence}" alt="Flyer at ${loc.name}" style="width:100%;border-radius:4px;margin:0.5rem 0;max-height:200px;object-fit:cover;" />`;
			}
			popupContent += `<span style="font-size:0.7rem;color:#333;">${loc.notes}</span>`;
			if (loc.confirmed) {
				popupContent += `<br/><span style="display:inline-block;background:#2a5a3a;color:#fff;font-size:0.6rem;padding:0.1rem 0.35rem;border-radius:2px;margin-top:0.4rem;">${loc.confirmedDate || 'confirmed'}</span>`;
			}
			popupContent += `</div>`;

			marker.bindPopup(popupContent, { maxWidth: 240 });
			markers.push(marker);
		});
		solve();
		rebuildLayer('photos');
	});
</script>

<svelte:window onmousemove={onDragMove} onmouseup={onDragEnd} />

<main style="--bg:{tokens().bg};--bg-panel:{tokens().bgPanel};--bg-card:{tokens().bgCard};--border:{tokens().border};--border-subtle:{tokens().borderSubtle};--text:{tokens().text};--text-muted:{tokens().textMuted};--text-dim:{tokens().textDim};--accent:{tokens().accent};--code-bg:{tokens().codeBg};--code-text:{tokens().codeText};--code-kw:{tokens().codeKw};--code-op:{tokens().codeOp};--code-sym:{tokens().codeSym};--code-fn:{tokens().codeFn};--code-line-num:{tokens().codeLineNum};">

	<!-- Desktop header -->
	<header class="desktop-only">
		<div class="header-content">
			<h1>The Traveling Flyerperson</h1>
			<p class="subtitle">Where do I place these flyers in Cambridge, MA?</p>
		</div>
		<div class="header-right">
			<button class="theme-btn" onclick={cycleTheme} title="Switch theme">
				{currentTheme === 'dark' ? '●' : currentTheme === 'cambridge' ? '◐' : '○'}
				<span class="theme-label">{currentTheme}</span>
			</button>
			<a href="https://www.cambridge-dev.org/" class="org" target="_blank" rel="noopener">cambridge-dev.org</a>
		</div>
	</header>

	<div class="layout">
		<!-- Desktop sidebar -->
		<aside class="panel desktop-only">
			<section class="section">
				<h2>Start</h2>
				<select class="start-select" bind:value={startIdx} onchange={() => solve()}>
					{#each LOCATIONS as loc, i}
						<option value={i}>{loc.name}{loc.confirmed ? ' ✓' : ''}</option>
					{/each}
				</select>
			</section>

			<section class="section">
				<h2>Solver</h2>
				<div class="algorithm-select">
					{#each [{ value: 'nearest', label: 'Nearest Neighbor' }, { value: '2opt', label: '2-Opt' }, { value: 'brute', label: 'Brute Force' }] as algo}
						<button class="algo-btn" class:active={selectedAlgorithm === algo.value} onclick={() => { selectedAlgorithm = algo.value as typeof selectedAlgorithm; solve(); }}>{algo.label}</button>
					{/each}
				</div>
				<div class="actions">
					<button class="action-btn" onclick={() => { animating = true; solve(); }}>Animate</button>
				</div>
			</section>

			{#if !algoPopped}
				<section class="section algorithm-detail">
					<div class="algo-header-row">
						<div>
							<h3 class="algo-inline-title">{ALGORITHM_INFO[selectedAlgorithm].name}</h3>
							<span class="algo-inline-complexity">{ALGORITHM_INFO[selectedAlgorithm].complexity}</span>
						</div>
						<button class="float-btn" onclick={() => (algoPopped = true)} title="Pop out over map">↗</button>
					</div>
					<p class="algo-description">{ALGORITHM_INFO[selectedAlgorithm].description}</p>
					<div class="pseudocode">
						{#each ALGORITHM_INFO[selectedAlgorithm].pseudocode as line, i}
							<div class="code-line"><span class="line-num">{i + 1}</span><span class="line-content">{@html highlightLine(line)}</span></div>
						{/each}
					</div>
				</section>
			{/if}

			{#if algoPopped}
				<section class="section algo-popped-hint">
					<span class="algo-hint-text">Algorithm is over the map</span>
					<button class="action-btn" onclick={() => (algoPopped = false)}>Dock here</button>
				</section>
			{/if}

			{#if solverResult}
				<section class="section">
					<h2>Route</h2>
					<div class="stats">
						<div class="stat-row"><span>Distance</span><span class="stat-value">{solverResult.distance.toFixed(2)} mi</span></div>
						<div class="stat-row"><span>Stops</span><span class="stat-value">{solverResult.route.length}</span></div>
						{#if solverResult.iterations}<div class="stat-row"><span>Iterations</span><span class="stat-value">{solverResult.iterations.toLocaleString()}</span></div>{/if}
					</div>

					<ol class="route-list">
						{#each solverResult.route as idx, i}
							<li>
								<span class="stop-num">{i + 1}</span>
								<span class="stop-name">{LOCATIONS[idx].name}</span>
								{#if LOCATIONS[idx].confirmed}
									<button class="evidence-btn" onclick={() => (evidenceLocation = LOCATIONS[idx])} title="View evidence">✓</button>
								{/if}
							</li>
						{/each}
					</ol>
					<div class="route-return">Return to {LOCATIONS[startIdx].name}</div>
				</section>
			{/if}

			<!-- Flyer Census -->
			<section class="section">
				<h2>Flyer Census</h2>
				<div class="census-grid">
					<div class="census-card">
						<span class="census-value">{EVIDENCE_PHOTOS.length}</span>
						<span class="census-label">Found</span>
					</div>
					<div class="census-card">
						<span class="census-value">{FLYER_POPULATION_ESTIMATE}</span>
						<span class="census-label">Estimated</span>
					</div>
					<div class="census-card">
						<span class="census-value">{Math.round((EVIDENCE_PHOTOS.length / FLYER_POPULATION_ESTIMATE) * 100)}%</span>
						<span class="census-label">Confirmed</span>
					</div>
				</div>
				<div class="census-bar">
					<div class="census-bar-fill" style="width: {(EVIDENCE_PHOTOS.length / FLYER_POPULATION_ESTIMATE) * 100}%"></div>
				</div>
				<p class="census-note">{FLYER_POPULATION_ESTIMATE - EVIDENCE_PHOTOS.length} flyers still unaccounted for. Ride out and find them.</p>
			</section>

			<section class="section">
				<button class="section-toggle" onclick={() => (showLegal = !showLegal)}><h2>Legal</h2><span class="toggle-indicator">{showLegal ? '−' : '+'}</span></button>
				{#if showLegal}
					<div class="legal-list">
						{#each LEGAL_RULES as rule}
							<div class="legal-item">
								<div class="legal-header"><span class="legal-title">{rule.title}</span><span class="legal-category" class:prohibited={rule.category === 'prohibited'} class:permitted={rule.category === 'permitted'}>{rule.category}</span></div>
								<p class="legal-desc">{rule.description}</p>
								{#if rule.penalty}<span class="legal-penalty">{rule.penalty}</span>{/if}
							</div>
						{/each}
					</div>
				{/if}
			</section>

			<section class="section">
				<h2>Layers</h2>
				<div class="layer-toggles">
					<label class="layer-toggle">
						<input type="checkbox" checked={showPhotos} onchange={togglePhotos} />
						<span class="layer-dot" style="background:var(--accent);"></span>
						<span class="layer-label">Flyer photos</span>
						<span class="layer-count">{EVIDENCE_PHOTOS.length}</span>
					</label>
					<label class="layer-toggle">
						<input type="checkbox" checked={showSignals} onchange={toggleSignals} />
						<span class="layer-dot" style="background:#ef4444;"></span>
						<span class="layer-label">Traffic signals</span>
						<span class="layer-count">{OVERPASS_SUMMARY.counts.trafficSignals}</span>
					</label>
					<label class="layer-toggle">
						<input type="checkbox" checked={showBoards} onchange={toggleBoards} />
						<span class="layer-dot" style="background:#a855f7;"></span>
						<span class="layer-label">Bulletin boards</span>
						<span class="layer-count">{BOARD_CANDIDATES.length}</span>
					</label>
					<label class="layer-toggle">
						<input type="checkbox" checked={showTransit} onchange={toggleTransit} />
						<span class="layer-dot" style="background:#10b981;"></span>
						<span class="layer-label">Transit</span>
						<span class="layer-count">{OVERPASS_SUMMARY.counts.transit}</span>
					</label>
				</div>
				<p class="layer-source">Photos: EXIF GPS · Other: OpenStreetMap</p>
			</section>

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

		<!-- Map (full screen on mobile) -->
		<div id="map"></div>

		<!-- Mobile FABs -->
		<div class="fab-group mobile-only">
			<button class="fab" onclick={cycleTheme} title="Theme">
				{currentTheme === 'dark' ? '●' : currentTheme === 'cambridge' ? '◐' : '○'}
			</button>
			<button class="fab" onclick={() => { animating = true; solve(); }} title="Solve & Animate">
				▶
			</button>
			<button class="fab" onclick={() => (showAlgorithm = !showAlgorithm)} title="Algorithm">
				λ
			</button>
		</div>

		<!-- Mobile bottom sheet -->
		<div
			class="sheet mobile-only"
			class:collapsed={sheetState === 'collapsed'}
			class:peek={sheetState === 'peek'}
			class:full={sheetState === 'full'}
			role="region"
			aria-label="Route details"
		>
			<div
				class="sheet-handle"
				ontouchstart={onSheetTouchStart}
				ontouchmove={onSheetTouchMove}
				ontouchend={onSheetTouchEnd}
				role="slider"
				aria-label="Drag to resize panel"
				tabindex="0"
			>
				<div class="handle-bar"></div>
			</div>

			<div class="sheet-content">
				<!-- Quick stats bar (always visible in peek) -->
				{#if solverResult}
					<div class="sheet-stats">
						<span class="sheet-stat">{solverResult.distance.toFixed(1)} mi</span>
						<span class="sheet-stat-sep">·</span>
						<span class="sheet-stat">{solverResult.route.length} stops</span>
						<span class="sheet-stat-sep">·</span>
						<span class="sheet-stat">{EVIDENCE_PHOTOS.length}/{FLYER_POPULATION_ESTIMATE} found</span>
					</div>
				{/if}

				<!-- Algorithm selector (compact) -->
				<div class="sheet-algo-row">
					{#each [{ value: 'nearest', label: 'NN' }, { value: '2opt', label: '2-Opt' }, { value: 'brute', label: 'BF' }] as algo}
						<button class="sheet-algo-btn" class:active={selectedAlgorithm === algo.value} onclick={() => { selectedAlgorithm = algo.value as typeof selectedAlgorithm; solve(); }}>{algo.label}</button>
					{/each}
				</div>

				<!-- Start selector -->
				<select class="start-select" bind:value={startIdx} onchange={() => solve()}>
					{#each LOCATIONS as loc, i}
						<option value={i}>{loc.name}{loc.confirmed ? ' ✓' : ''}</option>
					{/each}
				</select>

				<!-- Route list (scrollable in full) -->
				{#if solverResult}
					<ol class="route-list">
						{#each solverResult.route as idx, i}
							<li>
								<span class="stop-num">{i + 1}</span>
								<span class="stop-name">{LOCATIONS[idx].name}</span>
								{#if LOCATIONS[idx].confirmed}
									<button class="evidence-btn" onclick={() => (evidenceLocation = LOCATIONS[idx])} title="View evidence">✓</button>
								{/if}
							</li>
						{/each}
					</ol>
				{/if}
			</div>
		</div>

		<!-- Algorithm panel (popped out over map, desktop only) -->
		{#if algoPopped}
			<div class="algo-panel desktop-only" role="dialog" aria-label="Algorithm details">
				<div class="algo-panel-header">
					<div class="algo-panel-tabs">
						{#each [{ value: 'nearest', label: 'Nearest Neighbor' }, { value: '2opt', label: '2-Opt' }, { value: 'brute', label: 'Brute Force' }] as algo}
							<button
								class="algo-panel-tab"
								class:active={selectedAlgorithm === algo.value}
								onclick={() => { selectedAlgorithm = algo.value as typeof selectedAlgorithm; solve(); }}
							>{algo.label}</button>
						{/each}
					</div>
					<div class="algo-panel-header-actions">
						<button class="algo-panel-minimize" onclick={() => (algoPopped = false)} title="Dock in sidebar">↙</button>
						<button class="algo-panel-close" onclick={() => (algoPopped = false)}>×</button>
					</div>
				</div>
				<div class="algo-panel-body">
					<div class="algo-panel-meta">
						<h3>{ALGORITHM_INFO[selectedAlgorithm].name}</h3>
						<span class="algo-panel-complexity">{ALGORITHM_INFO[selectedAlgorithm].complexity}</span>
					</div>
					<p class="algo-panel-desc">{ALGORITHM_INFO[selectedAlgorithm].description}</p>
					<div class="algo-panel-code">
						{#each ALGORITHM_INFO[selectedAlgorithm].pseudocode as line, i}
							<div class="code-line"><span class="line-num">{i + 1}</span><span class="line-content">{@html highlightLine(line)}</span></div>
						{/each}
					</div>
				</div>
			</div>
		{/if}

		<!-- Mobile algorithm overlay (triggered by FAB) -->
		{#if showAlgorithm}
			<div class="algo-panel mobile-only" role="dialog" aria-label="Algorithm details">
				<div class="algo-panel-header">
					<div class="algo-panel-tabs">
						{#each [{ value: 'nearest', label: 'NN' }, { value: '2opt', label: '2-Opt' }, { value: 'brute', label: 'BF' }] as algo}
							<button
								class="algo-panel-tab"
								class:active={selectedAlgorithm === algo.value}
								onclick={() => { selectedAlgorithm = algo.value as typeof selectedAlgorithm; solve(); }}
							>{algo.label}</button>
						{/each}
					</div>
					<div class="algo-panel-header-actions">
						<button class="algo-panel-close" onclick={() => (showAlgorithm = false)}>×</button>
					</div>
				</div>
				<div class="algo-panel-body">
					<div class="algo-panel-meta">
						<h3>{ALGORITHM_INFO[selectedAlgorithm].name}</h3>
						<span class="algo-panel-complexity">{ALGORITHM_INFO[selectedAlgorithm].complexity}</span>
					</div>
					<p class="algo-panel-desc">{ALGORITHM_INFO[selectedAlgorithm].description}</p>
					<div class="algo-panel-code">
						{#each ALGORITHM_INFO[selectedAlgorithm].pseudocode as line, i}
							<div class="code-line"><span class="line-num">{i + 1}</span><span class="line-content">{@html highlightLine(line)}</span></div>
						{/each}
					</div>
				</div>
			</div>
		{/if}
	</div>

	<!-- Evidence viewer -->
	{#if evidenceLocation}
		<div class="evidence-overlay" onclick={() => (evidenceLocation = null)} role="dialog" aria-label="Placement evidence">
			<div class="evidence-card" onclick={(e) => e.stopPropagation()}>
				<div class="evidence-header">
					<div>
						<h3 class="evidence-title">{evidenceLocation.name}</h3>
						<span class="evidence-meta">{evidenceLocation.neighborhood} · {evidenceLocation.confirmedDate || 'confirmed'}</span>
					</div>
					<button class="evidence-close" onclick={() => (evidenceLocation = null)}>×</button>
				</div>
				{#if evidenceLocation.evidence}
					<div class="evidence-image-wrap">
						<img
							src="{base}/evidence/{evidenceLocation.evidence}"
							alt="Flyer placement at {evidenceLocation.name}"
							class="evidence-image"
						/>
					</div>
				{:else}
					<div class="evidence-placeholder">
						<span>No photo yet</span>
					</div>
				{/if}
				<p class="evidence-notes">{evidenceLocation.notes}</p>
			</div>
		</div>
	{/if}
</main>

<style>
	/* ===== Base ===== */
	main {
		height: 100vh;
		height: 100dvh;
		display: flex;
		flex-direction: column;
		background: var(--bg);
		color: var(--text);
		transition: background 0.2s, color 0.2s;
		overflow: hidden;
	}

	.layout {
		display: flex;
		flex: 1;
		overflow: hidden;
		position: relative;
	}

	#map {
		flex: 1;
		min-height: 0;
		z-index: 1;
	}

	h1 { margin: 0; font-size: 1.1rem; font-weight: 500; letter-spacing: -0.01em; color: var(--text); }
	h2 { margin: 0 0 0.75rem; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-dim); font-weight: 500; }
	h3 { margin: 0; font-size: 0.9rem; font-weight: 500; color: var(--text); }

	/* ===== Responsive visibility ===== */
	.desktop-only { display: flex; }
	.mobile-only { display: none; }

	@media (max-width: 768px) {
		.desktop-only { display: none !important; }
		.mobile-only { display: flex; }
	}

	/* ===== Desktop header ===== */
	header {
		padding: 1.25rem 2rem;
		align-items: baseline;
		justify-content: space-between;
		border-bottom: 1px solid var(--border);
	}

	.subtitle { margin: 0.2rem 0 0; color: var(--text-dim); font-size: 0.8rem; }
	.header-right { display: flex; align-items: center; gap: 1rem; }
	.theme-btn { background: none; border: 1px solid var(--border); color: var(--text-dim); padding: 0.35rem 0.6rem; border-radius: 4px; cursor: pointer; font-size: 0.75rem; display: flex; align-items: center; gap: 0.4rem; transition: all 0.15s; }
	.theme-btn:hover { color: var(--text); border-color: var(--text-muted); }
	.theme-label { text-transform: capitalize; }
	.org { color: var(--text-dim); font-size: 0.75rem; text-decoration: none; transition: color 0.15s; }
	.org:hover { color: var(--text); }

	/* ===== Desktop sidebar ===== */
	aside.panel {
		width: 380px;
		padding: 1.5rem 2rem;
		overflow-y: auto;
		border-right: 1px solid var(--border);
		background: var(--bg-panel);
		flex-direction: column;
		gap: 2rem;
	}

	.section { display: flex; flex-direction: column; }

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
	.start-select:focus { outline: none; border-color: var(--text-muted); }

	.algorithm-select { display: flex; border: 1px solid var(--border); border-radius: 4px; overflow: hidden; }
	.algo-btn { flex: 1; background: transparent; border: none; border-right: 1px solid var(--border); color: var(--text-dim); padding: 0.6rem 0.5rem; font-size: 0.75rem; cursor: pointer; transition: all 0.15s; }
	.algo-btn:last-child { border-right: none; }
	.algo-btn:hover { color: var(--text-muted); }
	.algo-btn.active { background: var(--bg-card); color: var(--text); }

	.actions { display: flex; gap: 0.5rem; margin-top: 1rem; }
	.action-btn { background: transparent; border: 1px solid var(--border); color: var(--text-muted); padding: 0.5rem 0.75rem; border-radius: 4px; cursor: pointer; font-size: 0.75rem; transition: all 0.15s; }
	.action-btn:hover { border-color: var(--text-muted); color: var(--text); }
	.action-btn.secondary { border-color: transparent; color: var(--text-dim); }
	.action-btn.secondary:hover { color: var(--text-muted); }

	/* Algorithm detail — now an overlay panel on the map */
	.algo-panel {
		position: absolute;
		top: 1rem;
		right: 1rem;
		bottom: 1rem;
		width: 380px;
		max-width: calc(100% - 2rem);
		z-index: 500;
		background: var(--bg-panel);
		border: 1px solid var(--border);
		border-radius: 12px;
		box-shadow: 0 16px 48px rgba(0, 0, 0, 0.4);
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	@media (max-width: 768px) {
		.algo-panel {
			top: 0.75rem;
			right: 0.75rem;
			bottom: 0.75rem;
			left: 0.75rem;
			width: auto;
			max-width: none;
		}
	}

	.algo-panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--border);
		gap: 0.5rem;
	}

	.algo-panel-tabs {
		display: flex;
		gap: 0;
		border: 1px solid var(--border);
		border-radius: 4px;
		overflow: hidden;
		flex: 1;
	}

	.algo-panel-tab {
		flex: 1;
		background: transparent;
		border: none;
		border-right: 1px solid var(--border);
		color: var(--text-dim);
		padding: 0.45rem 0.5rem;
		font-size: 0.7rem;
		cursor: pointer;
		transition: all 0.15s;
	}

	.algo-panel-tab:last-child { border-right: none; }
	.algo-panel-tab:hover { color: var(--text-muted); }
	.algo-panel-tab.active { background: var(--bg-card); color: var(--text); }

	.algo-panel-close {
		background: none;
		border: none;
		color: var(--text-dim);
		font-size: 1.4rem;
		cursor: pointer;
		padding: 0 0.25rem;
		line-height: 1;
		flex-shrink: 0;
	}

	.algo-panel-close:hover { color: var(--text); }

	.algo-panel-header-actions {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.algo-panel-minimize {
		background: none;
		border: 1px solid var(--border);
		color: var(--text-dim);
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 3px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.75rem;
		transition: all 0.15s;
	}

	.algo-panel-minimize:hover { color: var(--text); border-color: var(--text-muted); }

	/* Sidebar inline algorithm detail */
	.algorithm-detail {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 1.5rem;
		gap: 0;
	}

	.algo-header-row { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 1rem; }
	.algo-inline-title { margin: 0; font-size: 1rem; font-weight: 500; color: var(--text); font-family: 'Georgia', serif; }
	.algo-inline-complexity { font-size: 0.75rem; color: var(--text-dim); font-family: 'SF Mono', 'Fira Code', monospace; display: block; margin-top: 0.2rem; }
	.float-btn { background: none; border: 1px solid var(--border); color: var(--text-dim); width: 1.8rem; height: 1.8rem; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.85rem; transition: all 0.15s; flex-shrink: 0; }
	.float-btn:hover { color: var(--text); border-color: var(--text-muted); background: var(--bg); }
	.algo-description { margin: 0 0 1.25rem; font-size: 0.82rem; line-height: 1.7; color: var(--text-muted); text-align: justify; hyphens: auto; font-family: 'Georgia', serif; }

	.algo-popped-hint {
		flex-direction: row;
		align-items: center;
		justify-content: space-between;
		padding: 0.6rem 0;
		gap: 0.5rem;
	}

	.algo-hint-text {
		font-size: 0.72rem;
		color: var(--text-dim);
		font-style: italic;
	}

	.algo-panel-body {
		flex: 1;
		overflow-y: auto;
		padding: 1.5rem;
	}

	.algo-panel-meta {
		margin-bottom: 1rem;
	}

	.algo-panel-meta h3 {
		font-family: 'Georgia', serif;
		font-size: 1rem;
		font-weight: 500;
		margin-bottom: 0.25rem;
	}

	.algo-panel-complexity {
		font-size: 0.75rem;
		color: var(--text-dim);
		font-family: 'SF Mono', 'Fira Code', monospace;
	}

	.algo-panel-desc {
		margin: 0 0 1.5rem;
		font-size: 0.85rem;
		line-height: 1.7;
		color: var(--text-muted);
		text-align: justify;
		hyphens: auto;
		font-family: 'Georgia', serif;
	}

	.algo-panel-code {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 1.25rem;
		overflow-x: auto;
	}

	/* Pseudocode */
	.pseudocode { padding: 1.25rem; border-top: none; overflow-x: auto; max-width: 100%; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; }
	.code-line { display: flex; align-items: baseline; gap: 0.75rem; line-height: 2; }
	.line-num { width: 1.2rem; min-width: 1.2rem; text-align: right; font-size: 0.62rem; color: var(--code-line-num); font-family: 'SF Mono', 'Fira Code', monospace; flex-shrink: 0; user-select: none; }
	.line-content { font-family: 'SF Mono', 'Fira Code', monospace; font-size: 0.74rem; color: var(--code-text); white-space: pre; }
	:global(.code-line .kw) { color: var(--code-kw); font-weight: 500; }
	:global(.code-line .op) { color: var(--code-op); }
	:global(.code-line .sym) { color: var(--code-sym); font-style: italic; }
	:global(.code-line .fn) { color: var(--code-fn); }

	/* Stats & route */
	.stats { display: flex; flex-direction: column; gap: 0.3rem; margin-bottom: 1rem; }
	.stat-row { display: flex; justify-content: space-between; font-size: 0.8rem; color: var(--text-dim); }
	.stat-value { color: var(--text); font-family: 'SF Mono', 'Fira Code', monospace; font-size: 0.75rem; }
	.route-list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 0.1rem; }
	.route-list li { display: flex; align-items: center; gap: 0.6rem; padding: 0.35rem 0; font-size: 0.78rem; border-bottom: 1px solid var(--border-subtle); }
	.route-list li:last-child { border-bottom: none; }
	.stop-num { width: 1.4rem; height: 1.4rem; display: flex; align-items: center; justify-content: center; font-size: 0.65rem; color: var(--text-dim); border: 1px solid var(--border); border-radius: 50%; flex-shrink: 0; }
	.stop-name { color: var(--text-muted); font-size: 0.78rem; display: flex; align-items: center; gap: 0.4rem; }
	.confirmed-badge { font-size: 0.65rem; color: var(--accent); opacity: 0.7; }
	.evidence-btn { background: none; border: 1px solid var(--accent); color: var(--accent); font-size: 0.6rem; width: 1.2rem; height: 1.2rem; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; margin-left: auto; flex-shrink: 0; opacity: 0.7; transition: all 0.15s; }
	.evidence-btn:hover { opacity: 1; background: var(--accent); color: var(--bg); }
	.route-return { margin-top: 0.5rem; font-size: 0.7rem; color: var(--text-dim); font-style: italic; opacity: 0.6; }

	/* Flyer Census */
	.census-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.5rem;
		margin-bottom: 0.75rem;
	}

	.census-card {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		padding: 0.75rem;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: 6px;
	}

	.census-value {
		font-size: 1.4rem;
		font-weight: 500;
		color: var(--text);
		font-family: 'Georgia', serif;
		line-height: 1.1;
	}

	.census-label {
		font-size: 0.65rem;
		color: var(--text-dim);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-top: 0.25rem;
	}

	.census-bar {
		height: 4px;
		background: var(--bg-card);
		border-radius: 2px;
		overflow: hidden;
		margin-bottom: 0.5rem;
	}

	.census-bar-fill {
		height: 100%;
		background: var(--accent);
		border-radius: 2px;
		transition: width 0.3s ease;
	}

	.census-note {
		margin: 0;
		font-size: 0.72rem;
		color: var(--text-dim);
		font-style: italic;
		font-family: 'Georgia', serif;
	}

	/* Evidence viewer */
	.evidence-overlay {
		position: fixed;
		inset: 0;
		z-index: 10000;
		background: rgba(0, 0, 0, 0.75);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.5rem;
		backdrop-filter: blur(4px);
	}

	.evidence-card {
		background: var(--bg-panel);
		border: 1px solid var(--border);
		border-radius: 12px;
		max-width: 480px;
		width: 100%;
		max-height: 85vh;
		overflow-y: auto;
		box-shadow: 0 24px 80px rgba(0, 0, 0, 0.5);
	}

	.evidence-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		padding: 1.25rem 1.25rem 0.75rem;
	}

	.evidence-title {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 500;
		color: var(--text);
		font-family: 'Georgia', serif;
	}

	.evidence-meta {
		font-size: 0.7rem;
		color: var(--text-dim);
		margin-top: 0.2rem;
		display: block;
	}

	.evidence-close {
		background: none;
		border: none;
		color: var(--text-dim);
		font-size: 1.5rem;
		cursor: pointer;
		padding: 0;
		line-height: 1;
		flex-shrink: 0;
	}

	.evidence-close:hover {
		color: var(--text);
	}

	.evidence-image-wrap {
		padding: 0 1.25rem;
	}

	.evidence-image {
		width: 100%;
		border-radius: 6px;
		display: block;
	}

	.evidence-placeholder {
		margin: 0 1.25rem;
		padding: 3rem;
		background: var(--bg-card);
		border: 1px dashed var(--border);
		border-radius: 6px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-dim);
		font-size: 0.8rem;
	}

	.evidence-notes {
		padding: 1rem 1.25rem 1.25rem;
		margin: 0;
		font-size: 0.78rem;
		line-height: 1.5;
		color: var(--text-muted);
		font-family: 'Georgia', serif;
	}
	.section-toggle { display: flex; align-items: center; justify-content: space-between; width: 100%; background: none; border: none; padding: 0; cursor: pointer; color: inherit; }
	.section-toggle h2 { margin: 0; }
	.toggle-indicator { color: var(--text-dim); font-size: 1rem; }
	.legal-list { display: flex; flex-direction: column; gap: 1.25rem; margin-top: 0.75rem; }
	.legal-item { display: flex; flex-direction: column; gap: 0.2rem; }
	.legal-header { display: flex; align-items: center; justify-content: space-between; }
	.legal-title { font-size: 0.8rem; color: var(--text); font-weight: 500; font-family: 'Georgia', serif; }
	.legal-category { font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-dim); }
	.legal-category.prohibited { color: var(--text-muted); }
	.legal-category.permitted { color: var(--text-dim); }
	.legal-desc { margin: 0.15rem 0 0; font-size: 0.75rem; line-height: 1.55; color: var(--text-dim); text-align: justify; hyphens: auto; font-family: 'Georgia', serif; }
	.legal-penalty { font-size: 0.7rem; color: var(--text-muted); font-family: 'SF Mono', 'Fira Code', monospace; margin-top: 0.15rem; }

	/* Layers */
	.layer-toggles {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.layer-toggle {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.4rem 0.6rem;
		border: 1px solid var(--border);
		border-radius: 4px;
		font-size: 0.78rem;
		color: var(--text-muted);
		cursor: pointer;
		transition: all 0.15s;
	}

	.layer-toggle:hover {
		border-color: var(--text-muted);
		color: var(--text);
	}

	.layer-toggle input[type="checkbox"] {
		margin: 0;
		cursor: pointer;
		accent-color: var(--text);
	}

	.layer-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.layer-label { flex: 1; }

	.layer-count {
		color: var(--text-dim);
		font-family: 'SF Mono', 'Fira Code', monospace;
		font-size: 0.72rem;
	}

	.layer-source {
		margin: 0.5rem 0 0;
		font-size: 0.7rem;
		color: var(--text-dim);
		font-style: italic;
	}

	/* Legend */
	.legend { margin-top: auto; padding-top: 1rem; border-top: 1px solid var(--border-subtle); }
	.legend-items { display: flex; flex-direction: column; gap: 0.4rem; }
	.legend-row { display: flex; align-items: center; gap: 0.6rem; font-size: 0.75rem; color: var(--text-dim); }
	.legend-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
	.legend-dot.start { background: var(--text); box-shadow: 0 0 0 2px var(--bg), 0 0 0 3px var(--text); }
	.legend-dot.bright { background: var(--text); }
	.legend-dot.mid { background: var(--text-muted); }
	.legend-dot.dim { background: var(--text-dim); }

	/* ===== Mobile: FABs ===== */
	.fab-group {
		position: absolute;
		top: 1rem;
		right: 1rem;
		flex-direction: column;
		gap: 0.6rem;
		z-index: 100;
	}

	.fab {
		width: 2.75rem;
		height: 2.75rem;
		border-radius: 50%;
		background: var(--bg);
		border: 1px solid var(--border);
		color: var(--text);
		font-size: 1rem;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		box-shadow: 0 4px 12px rgba(0,0,0,0.3);
		transition: all 0.15s;
	}

	.fab:active {
		transform: scale(0.92);
	}

	/* ===== Mobile: Bottom Sheet ===== */
	.sheet {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		z-index: 200;
		background: var(--bg-panel);
		border-top: 1px solid var(--border);
		border-radius: 16px 16px 0 0;
		flex-direction: column;
		transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		max-height: 75vh;
		touch-action: none;
	}

	.sheet.collapsed {
		transform: translateY(calc(100% - 2rem));
	}

	.sheet.peek {
		transform: translateY(calc(100% - 10rem));
	}

	.sheet.full {
		transform: translateY(0);
	}

	.sheet-handle {
		display: flex;
		justify-content: center;
		padding: 0.6rem 0 0.4rem;
		cursor: grab;
		touch-action: none;
	}

	.handle-bar {
		width: 2.5rem;
		height: 4px;
		border-radius: 2px;
		background: var(--border);
	}

	.sheet-content {
		padding: 0.5rem 1.25rem 1.5rem;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.sheet-stats {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.8rem;
		color: var(--text-muted);
		font-family: 'SF Mono', 'Fira Code', monospace;
	}

	.sheet-stat-sep {
		color: var(--text-dim);
	}

	.sheet-algo-row {
		display: flex;
		gap: 0.4rem;
	}

	.sheet-algo-btn {
		flex: 1;
		padding: 0.5rem;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: transparent;
		color: var(--text-dim);
		font-size: 0.75rem;
		cursor: pointer;
		transition: all 0.15s;
	}

	.sheet-algo-btn.active {
		background: var(--bg-card);
		color: var(--text);
		border-color: var(--text-dim);
	}

	/* ===== Mobile: Algorithm Overlay ===== */
	@media (max-width: 768px) {
		/* Adjust route list for mobile */
		.sheet-content .route-list li {
			padding: 0.5rem 0;
		}

		.sheet-content .stop-name {
			font-size: 0.82rem;
		}

		.sheet-content .start-select {
			font-size: 0.85rem;
			padding: 0.6rem 0.75rem;
		}
	}
</style>
