import * as d3 from 'd3';
import { COLOR_PRIMARY, COLOR_SECONDARY } from '$lib/constants';

export function gradientColor(t: number): string {
	return d3.interpolate(COLOR_PRIMARY, COLOR_SECONDARY)(t);
}

export function makeLinearScales(
	points: [number, number][],
	opts: { width: number; height: number; pad?: number }
) {
	const pad = opts.pad ?? 0.1;
	const xRaw = d3.extent(points, (d) => d[0]);
	const yRaw = d3.extent(points, (d) => d[1]);
	const xExtent: [number, number] = [xRaw[0] ?? -1, xRaw[1] ?? 1];
	const yExtent: [number, number] = [yRaw[0] ?? -1, yRaw[1] ?? 1];
	const xScale = d3
		.scaleLinear()
		.domain([xExtent[0] - pad, xExtent[1] + pad])
		.range([0, opts.width]);
	const yScale = d3
		.scaleLinear()
		.domain([yExtent[0] - pad, yExtent[1] + pad])
		.range([opts.height, 0]);
	return { xScale, yScale, xExtent, yExtent };
}

type SvgG = d3.Selection<SVGGElement, unknown, null, undefined>;
type Scale = d3.ScaleLinear<number, number>;

export function drawSciFiAxes(
	svg: SvgG,
	xScale: Scale,
	yScale: Scale,
	opts: { width: number; height: number; labels?: { x: string; y: string } }
) {
	const style = (g: d3.Selection<SVGGElement, unknown, null, undefined>) => {
		g.select('.domain').remove();
		g.selectAll('line').attr('stroke', COLOR_PRIMARY).attr('stroke-opacity', 0.1);
		g.selectAll('text')
			.attr('fill', COLOR_PRIMARY)
			.attr('font-family', 'Rajdhani')
			.attr('font-size', '12px');
	};
	svg.append('g')
		.attr('transform', `translate(0,${opts.height})`)
		.call(d3.axisBottom(xScale).tickSize(-opts.height).tickPadding(10))
		.call(style);
	svg.append('g').call(d3.axisLeft(yScale).tickSize(-opts.width).tickPadding(10)).call(style);
	if (opts.labels) {
		svg.append('text')
			.attr('x', opts.width / 2)
			.attr('y', opts.height + 40)
			.attr('fill', COLOR_PRIMARY)
			.attr('text-anchor', 'middle')
			.attr('font-family', 'Orbitron')
			.attr('font-size', '14px')
			.text(opts.labels.x);
		svg.append('text')
			.attr('transform', 'rotate(-90)')
			.attr('x', -opts.height / 2)
			.attr('y', -40)
			.attr('fill', COLOR_PRIMARY)
			.attr('text-anchor', 'middle')
			.attr('font-family', 'Orbitron')
			.attr('font-size', '14px')
			.text(opts.labels.y);
	}
}

export function plotGradientPoints(
	svg: SvgG,
	points: [number, number][],
	opts: { xScale: Scale; yScale: Scale; r?: number; opacity?: number; glow?: boolean }
) {
	const sel = svg
		.selectAll('circle')
		.data(points)
		.enter()
		.append('circle')
		.attr('cx', (d) => opts.xScale(d[0]))
		.attr('cy', (d) => opts.yScale(d[1]))
		.attr('r', opts.r ?? 2)
		.attr('fill', (_d, i) => gradientColor(points.length > 0 ? i / points.length : 0))
		.attr('opacity', opts.opacity ?? 0.8);
	if (opts.glow) sel.attr('filter', 'drop-shadow(0 0 2px rgba(0, 243, 255, 0.5))');
}
