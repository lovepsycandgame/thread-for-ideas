import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { GraphData, GraphNode, GraphLink } from '../types';

interface GraphProps {
  data: GraphData;
  onNodeClick: (id: string) => void;
}

const Graph: React.FC<GraphProps> = ({ data, onNodeClick }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };
    
    window.addEventListener('resize', handleResize);
    handleResize(); // Init
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!svgRef.current || !data.nodes.length) return;

    // Deep clone data to prevent D3 from mutating state directly causing re-render glitches
    const nodes = data.nodes.map(d => ({...d}));
    const links = data.links.map(d => ({...d}));

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear previous render

    const width = dimensions.width;
    const height = dimensions.height;

    // Simulation setup
    const simulation = d3.forceSimulation(nodes as d3.SimulationNodeDatum[])
      .force("link", d3.forceLink(links).id((d: any) => d.id).distance(100))
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius(30));

    // Render Links
    const link = svg.append("g")
      .attr("stroke", "#e2e8f0") // slate-200
      .attr("stroke-opacity", 0.8)
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke-width", 1.5);

    // Render Nodes
    const node = svg.append("g")
      .attr("stroke", "#fff") // white border
      .attr("stroke-width", 2)
      .selectAll("circle")
      .data(nodes)
      .join("circle")
      // Thread: 8, Tag: 6, Signal: 4
      .attr("r", (d) => d.type === 'thread' ? 9 : d.type === 'tag' ? 7 : 5)
      // Thread: Violet, Tag: Fuchsia, Signal: Slate
      .attr("fill", (d) => {
          if (d.type === 'thread') return "#8b5cf6"; // violet-500
          if (d.type === 'tag') return "#d946ef"; // fuchsia-500
          return "#94a3b8"; // slate-400
      }) 
      .call(drag(simulation) as any)
      .on("click", (event, d) => {
        onNodeClick(d.id);
        event.stopPropagation();
      });

    // Labels
    // Show labels for Threads, Tags, and larger nodes
    const text = svg.append("g")
      .selectAll("text")
      .data(nodes.filter(n => n.type === 'thread' || n.type === 'tag' || n.val > 1))
      .join("text")
      .text(d => d.type === 'tag' ? `#${d.label}` : d.label.length > 20 ? d.label.substring(0, 17) + "..." : d.label)
      .attr("font-size", (d) => d.type === 'tag' ? "12px" : "11px")
      .attr("font-weight", (d) => d.type === 'tag' ? "bold" : "500")
      .attr("fill", (d) => d.type === 'tag' ? "#c026d3" : "#475569") // fuchsia-600 : slate-600
      .attr("dx", 12)
      .attr("dy", 4)
      .style("pointer-events", "none");

    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      node
        .attr("cx", (d: any) => d.x)
        .attr("cy", (d: any) => d.y);

      text
        .attr("x", (d: any) => d.x)
        .attr("y", (d: any) => d.y);
    });

    return () => {
      simulation.stop();
    };
  }, [data, dimensions]);

  // Drag utility
  const drag = (simulation: d3.Simulation<d3.SimulationNodeDatum, undefined>) => {
    function dragstarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event: any) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event: any) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }

    return d3.drag()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended);
  }

  return (
    <div ref={containerRef} className="w-full h-full min-h-[300px] bg-white/60 border border-slate-200/50 backdrop-blur-sm rounded-2xl overflow-hidden relative shadow-inner">
      <svg ref={svgRef} className="w-full h-full" width={dimensions.width} height={dimensions.height} />
      <div className="absolute top-3 left-3 text-xs font-medium text-slate-500 pointer-events-none select-none flex gap-3 bg-white/80 px-2 py-1 rounded-full border border-slate-100">
        <span className="flex items-center gap-1"><span className="text-violet-500">●</span> Threads</span>
        <span className="flex items-center gap-1"><span className="text-fuchsia-500">●</span> Tags</span>
        <span className="flex items-center gap-1"><span className="text-slate-400">●</span> Signals</span>
      </div>
    </div>
  );
};

export default Graph;