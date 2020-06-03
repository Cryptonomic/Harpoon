let dimensions = (svg, m={top:0, left:0, right:0, bottom:0}) =>
    ({width: +svg.attr("width"), height: +svg.attr("height"), margin: m,
      innerWidth: +svg.attr("width") - m.left- m.right,
      innerHeight: svg.attr("height") - m.top - m.bottom});

let getSVG = (id) => {
    d3.select(`#${id} > *`).remove();
    return d3.select(`#${id}`);
}
 
let outline = (id, data, values, m={top:0, left:0, right:0, bottom:0}) => {
    const svg = getSVG(id);
    const outline = dimensions(svg, m);
    outline["xValue"] = d => d[values.x];
    outline["yValue"] = d => d[values.y];
    outline["data"] = data;
    outline["svg"] = svg
    return outline
}

let yMap = (outline) =>  d3.scaleLinear()
    .domain([0, 50])
    .range([outline.innerHeight, 0])
    .nice();

let lineGenerator = (x, y, outline) => d3.line()
    .x(d => x(outline.xValue(d)))
    .y(d => y(outline.yValue(d)));



function stackedBarGraph(id, data, values) {
    let toGraph = outline(id, data, values, {top:0, left: 10, right:0, bottom:15});

	
    const render = graph => {
	const sum = d3.sum(graph.data, graph.xValue)
	let tooltipHeight = 10    

	graph.data.forEach((d, i) => d["sum"] = d3.sum(graph.data.slice(0,i), graph.xValue))

	const x = d3.scaleLinear()
	      .domain([0, sum])
	      .range([0, graph.innerWidth])
	var color = d3.scaleOrdinal().domain(graph.data.map(graph.yValue))
	    .range(d3.schemeSet2)

	const xAxis = d3.axisBottom(x)
	      .tickSize(10)
	      .tickPadding(15)
	
	const g = graph.svg.append("g")
	      .attr("transform", `translate(${graph.margin.left}, ${graph.margin.top})`)
	

	// let tooltip = g.append("g")
	//     .attr("class", "tooltip")
	//     .attr("transform", `translate(0, ${graph.inneHeight-graph.margin.bottom})`)
	// tooltip.append("rect")
	//     .attr("width", graph.innerWidth)
	//     .attr("height", tooltipHeight)
	//     .style("fill", "black");

	g.selectAll("rect").data(graph.data)
	    .enter().append('rect')
	    .attr("fill", d => color(graph.yValue(d)))
	    .attr("y", 0)
	    .attr("x", d => x(d.sum))
	    .attr("width", d => graph.xValue(d)*graph.innerWidth)
	    .attr("height", graph.innerHeight - tooltipHeight);

	g.selectAll("rect")
	    .on("mouseover", function(d) {
		let rect = d3.select(this)
		rect.style("fill", d3.rgb(rect.attr("fill")).darker())
		let tooltip = g.append("text")
		    .text(graph.yValue(d))
		    .attr("class", "tooltip")
		    .attr("opacity", 0)
		    .style("fill", "black")
		    .attr("x", 0)
		    .attr("y", graph.height)
		    .transition()
		    .duration(100)
		    .attr("opacity", 1);
	    })
	    .on("mouseout", function(d) {
		let rect = d3.select(this)
		g.selectAll(".tooltip")
		    .transition()
		    .duration(100)
		    .attr("opacity", 0)
		    .remove()
		rect.style("fill", color(graph.yValue(d)))
	    });

    }
    render(toGraph)


}    
function linegraph(id, data, values) {
    const toGraph = outline(id, data, values,
			    {top:10, left: 30, right:30, bottom:30});
    const render = graph => {
	const x = d3.scaleTime()
	      .domain(d3.extent(graph.data, graph.xValue))
	      .range([0, graph.innerWidth])
	      .nice()

	const y = yMap(graph)
	const xAxis = d3.axisBottom(x)
	      .tickSize(-graph.innerHeight)
	      .tickPadding(15)

	const yAxis = d3.axisLeft(y)
	      .tickSize(-graph.innerWidth)
	
	const g = graph.svg.append("g")
	      .attr("transform", `translate(${graph.margin.left}, ${graph.margin.top})`)

	g.append("path")
	    .attr("d", lineGenerator(x, y, graph)(graph.data))
	    .transition().duration(1000)
	    .attr("fill", "none")
	    .attr("stroke", "steelblue")
	    .attr("stroke-width", 5)
	    .attr("stroke-linejoin", "round")


	g.append("g")
	    .call(yAxis)
	
	g.append("g")
	    .call(xAxis)
	    .attr("transform", `translate(0, ${graph.innerHeight})`)
	    .select(".domain")
	    .remove()

    }
    render(toGraph)
}
