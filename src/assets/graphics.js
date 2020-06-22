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
    .y(d => y(outline.yValue(d)))
    .curve(d3.curveBasis);

let areaGenerator = (x, y, outline) => d3.area()
    .x(d => x(outline.xValue(d)))
    .y0(outline.innerHeight)
    .y1(d => y(outline.yValue(d)))
    .curve(d3.curveBasis);

let tooltip = (g, width, height, padding, gwidth, gheight) => {
    let tt = g.append("rect")
	.attr("class", "tooltip")
	.attr("width", width)
	.attr("height", height)
	.style("fill", "#b3b3b3");
    let tooltipText = g.append("text")
	.attr("class", "tooltip")
	.attr("transform", "translate(0, 15)")
    tt.setText = text => tooltipText.text(text)
    tt.fitSizeToText = () => tt.attr("width", tooltipText.node().getBBox().width);
    g.selectAll(".tooltip")
	.style("opacity", 0);
    g.on("mouseover", d => g.selectAll(".tooltip")
	 .transition().duration(50).style("opacity", 1))
	.on("mousemove", function(d) {
	    let ttwidth = tt.attr("width");
	    let ttheight = tt.attr("height");
	    let xOffset = (d3.mouse(this)[0] > (gwidth -
						ttwidth - padding) ?
			   -padding - ttwidth: padding);
	    let yOffset = (d3.mouse(this)[1] > (gheight -
						ttheight) ?
			   -ttheight : 0);

	    g.selectAll(".tooltip")
		.attr("x", d3.mouse(this)[0] + xOffset)
		.attr("y", d3.mouse(this)[1] + yOffset);
	})
	.on("mouseout", d => g.selectAll(".tooltip")
	    .transition().duration(200).style("opacity", 0))

    return tt;
}

function setPanel(panel) {
    document.querySelectorAll(".panel")
	.forEach(node => node.style.display = "none");
    document.querySelectorAll(`.${panel}`)
	.forEach(node => node.style.display = "block");
}

function heatTable(id, data, values, mapColumn, comparisons=[], notices=[]) {
    let toGraph = outline(id, data, values,
			  {top:10, left:10, right:10, bottom:10});
    const rowHeight = 40;
    const rowPadding = 5;
    const textPadding = 5;
    const tooltipHeight = 20;
    const tooltipPadding = 5;
    const color = d3.scaleLinear()
	  .domain(d3.extent(data.map((d, i) => (i==0) ? data[i+1][mapColumn] : d[mapColumn])))
	  .range(["white", "#65eb72"]);
	
    const render = graph => {
	console.log(graph.data)
	const g = graph.svg.append("g")
	      .attr("transform", `translate(${graph.margin.left}, ${graph.margin.top})`)
	g.selectAll("g")
	    .data(graph.data)
	    .enter().append("g").attr("class", "data")
	    .append("rect")
	    .attr("width", graph.innerWidth)
	    .attr("height", rowHeight)
	    .attr("y", (d, i) => i * (rowHeight + rowPadding))
	    .attr("fill", (d, i) => i == 0 ? "#f5b505" : color(d[mapColumn]));
	values.forEach((d, i) => {
	    g.selectAll(".data")
		.each((r, i, n) => {
		    noticeInd = notices.map(note => note.identifier)
			.findIndex(elem => elem == r[d]);
		    if (noticeInd != -1) {
			tt = tooltip(d3.select(n[i]), 5, tooltipHeight,
				tooltipPadding, graph.innerWidth, rowHeight);
			tt.setText(notices[noticeInd].message)
			tt.fitSizeToText()
		    }
		})
		.append("text")
		.text(r => r[d])
		.attr("x", (graph.innerWidth)/(2*values.length) * (2 * i + 1) + textPadding)
		.attr("y", (d, i) => i * (rowHeight + rowPadding) + (rowHeight + rowPadding)/2)
		.style("fill", (r, i) => {
		    let color = "black";
		    comparisons.forEach(compareCol => {
			if (d ==  compareCol[1] &&
			    !notices.map(d => d.identifier).includes(r[compareCol[0]]) &&
			    i != 0) {
			    positive = "blue"
			    negative = "red"
			    if (compareCol[2] == "inverse") {
				positive = "red"
				negative = "blue"
			    }

			    if (r[compareCol[0]] == r[compareCol[1]]) color = "green";
			    else if (r[compareCol[0]] > r[compareCol[1]]) color = negative;
			    else if (r[compareCol[0]] < r[compareCol[1]]) color = positive;
			}
		    });
		    return color;
		})
		.style("text-anchor", "middle")


	});
	
    }
    render(toGraph);
}    

function chainmap(id, data, values, blocks,
		  mapColor="green", tooltipLabel="", axis=true) {
    let toGraph = outline(id, data, values,
			  (axis ?
			   {top:0, left:10, right:0, bottom:50} :
			   {top:0, left:10, right:0, bottom:0}));
    const blockWidth = 20;
    const numBlocks = Math.floor(toGraph.innerWidth/blockWidth);
    const blockVal = Math.floor(blocks/numBlocks);
    const blockPadding = 5;
    const tooltipHeight = 20;
    const tooltipWidth = 20;
    const tooltipPadding = 10;
    const axisLabelOffset = 15;
    let blocksArr = []

    for (let i =0; i < numBlocks; i++)
	blocksArr.push({mapVal: 0, "data":[]});

    const x = d3.scaleQuantize()
	  .domain([0, blocks])
	  .range(Array.from(blocksArr.keys()))

    toGraph.data.forEach((d, i) => {
	blocksArr[x(toGraph.xValue(d) % blocks)].mapVal += 1
	blocksArr[x(toGraph.xValue(d) % blocks)].data.push(d.label);
    });

    const color = d3.scaleLinear()
	  .domain([0, d3.max(blocksArr.map(d => d.mapVal))+0.01])
	  .range(["white", mapColor]);

    const y = d3.scaleLinear()
	  .domain([0, d3.max(blocksArr.map(d => d.mapVal))+0.01])
	  .range([5, toGraph.innerHeight]);

    const xAxis = d3.axisBottom(d3.scaleOrdinal()
				.domain([0, blocks-1])
				.range([0, blockWidth*numBlocks-blockPadding]))
	  .tickSize(10)
	  .tickPadding(15)
    const render = graph => {
	const g = graph.svg.append("g")
	      .attr("transform", `translate(${graph.margin.left}, ${graph.margin.top})`)

	g.selectAll(".databar").data(blocksArr)
	    .enter().append('rect')
	    .attr("class", "databar")
	    .attr("y",  d => graph.innerHeight - y(d.mapVal))
	    .attr("x", (d, i) => i * blockWidth)
	    .attr("width", blockWidth-blockPadding)
	    .attr("height", d => y(d.mapVal))
	    .style("fill", d => color(d.mapVal))
	    .style("stroke-width", 1)
	    .style("stroke", "black");

	let label = tooltip(g, tooltipWidth, tooltipHeight, tooltipPadding,
			    graph.innerWidth, graph.innerHeight);

	g.selectAll(".databar")
	    .on("mouseover", function(d) {
		label.setText(`${tooltipLabel}${d.mapVal}: ${d.data}`);
		label.fitSizeToText()

	    });

	if(axis) {
	    g.append("g")
		.call(xAxis)
		.attr("transform", `translate(0, ${graph.innerHeight})`)
		.select(".domain")
		.remove()
	    g.append("text")
		.attr("y", graph.innerHeight - axisLabelOffset)
		.attr("transform",
		      `translate(${graph.innerWidth/2},${graph.innerHeight})`)
		.style("text-anchor", "middle")
		.text("Cycle Position")
	}
    }
    render(toGraph);
}

function stackedBarGraph(id, data, values, colorSet=0, callback=d=>{return;}) {
    let toGraph = outline(id, data, values, {top:0, left:10, right:0, bottom:15});
    const colorSchemes = [d3.schemeSet1, d3.schemeSet2, d3.schemeSet3,
			  d3.schemeCategory10, d3.schemeAccent, d3.schemeDark2,
			  d3.schemePaired, d3.schemePastel1, d3.schemePastel2,
			  d3.schemeTableau10];
    const colorScheme = colorSchemes[colorSet];
    const render = graph => {
	const sum = d3.sum(graph.data, graph.xValue)
	let tooltipHeight = 20    
	let defaultInd = graph.data.findIndex(d => d.default == "true");
	if (defaultInd == -1) 
	    defaultInd = 0;
	graph.data[defaultInd]["default"] = "true";
	let defaultVal = graph.data[defaultInd];

	graph.data.forEach((d, i) => d["sum"] = d3.sum(graph.data.slice(0,i), graph.xValue))

	const x = d3.scaleLinear()
	      .domain([0, sum])
	      .range([0, graph.innerWidth])
	var color = d3.scaleOrdinal().domain(graph.data.map(graph.yValue))
	    .range(colorScheme)

	const xAxis = d3.axisBottom(x)
	      .tickSize(10)
	      .tickPadding(15)
	
	const g = graph.svg.append("g")
	      .attr("transform", `translate(${graph.margin.left}, ${graph.margin.top})`)
	
	let tooltip = g.append("g")
	    .attr("class", "tooltip")
	    .attr("transform", `translate(1, ${graph.innerHeight-tooltipHeight})`)
	tooltip.append("rect")
	    .attr("width", graph.innerWidth/2)
	    .attr("height", tooltipHeight)
	    .style("fill", "#b3b3b3")
	    .style("stroke-width", 1)
	    .style("stroke", "black")
	tooltip.append("text")
	    .attr("id", "tooltip_text")
	    .attr("x", 5)
	    .attr("y", graph.margin.top+tooltipHeight*.75)
	    .style("fill", "black")
	    .text(graph.yValue(defaultVal));

	g.selectAll("rect.databar").data(graph.data)
	    .enter().append('rect')
	    .attr("class", d => "databar " + (d.default == "true" ? "default":"normal"))
	    .attr("fill", d => color(graph.yValue(d)))
	    .attr("y", 0)
	    .attr("x", d => x(d.sum))
	    .attr("width", d => graph.xValue(d)*graph.innerWidth)
	    .attr("height", graph.innerHeight - tooltipHeight);
	
	let defaultRect = g.select(".default")

	defaultRect
	    .style("fill", d3.rgb(defaultRect.attr("fill")).darker())		

	g.selectAll("rect.databar")
	    .on("mouseover", function(d) {
		defaultRect
		    .style("fill", color(graph.yValue(defaultVal)))
		let rect = d3.select(this)
		rect.style("fill", d3.rgb(rect.attr("fill")).darker(2))
		g.select("#tooltip_text")
		    .attr("opacity", 0)
		    .text(graph.yValue(d))
		    .transition()
		    .duration(100)
		    .attr("opacity", 1);
	    })
	    .on("mouseout", function(d) {
	    	d3.select(this)
	    	    .style("fill", color(graph.yValue(d)))
	    	g.select("#tooltip_text")
		    .text(graph.yValue(defaultVal));
		defaultRect
		    .style("fill", d3.rgb(defaultRect.attr("fill")).darker(2))		
	    })
	    .on("click", function(d) {
		callback(d);
	    });
    }
    render(toGraph)
}    

function linegraph(id, data, values, yExtent, time=true, area=false) {
    let xScale = time ? d3.scaleTime() : d3.scaleLinear();
    let grapher = area ? areaGenerator : lineGenerator
    const toGraph = outline(id, data, values,
			    {top:10, left: 60, right:60, bottom:30});
    const render = graph => {
	const x = xScale
	      .domain(d3.extent(graph.data, graph.xValue))
	      .range([0, graph.innerWidth])

	const y =  d3.scaleLinear()
	      .domain(yExtent)
	      .range([graph.innerHeight, 0])
	      .nice()

	const xAxis = d3.axisBottom(x)
	      .tickSize(0)
	      .tickPadding(15)

	const yAxis = d3.axisLeft(y)
	      .tickSize(0)
	      .tickPadding(10)

	const g = graph.svg.append("g")
	      .attr("transform", `translate(${graph.margin.left}, ${graph.margin.top})`)

	let line = g.append("path");
	line.attr("d", grapher(x, y, graph)(graph.data))
	    .transition().duration(1000)
	    .attr("fill", area ? "steelblue" : "none")
	    .attr("stroke", "steelblue")
	    .attr("stroke-width", 5)
	    .attr("stroke-linejoin", "round")

	g.append("g")
	    .call(yAxis)
	    .select(".domain")
	    .remove()

	g.append("g")
	    .call(xAxis)
	    .attr("transform", `translate(0, ${graph.innerHeight})`)
	    .select(".domain")
	    .remove()
    }
    render(toGraph)
}
