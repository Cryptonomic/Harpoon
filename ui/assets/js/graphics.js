//Colors
const TEAL = [
  "white",
  "#B7D6CC",
  "#B7D6CC",
  "#8BC7B2",
  "#8BC7B2",
  "#63A68F",
  "#63A68F",
  "#447363",
];
const DARK_BLUE = [
  "white",
  "#D8D9FF",
  "#D8D9FF",
  "#BEBFF1",
  "#BEBFF1",
  "#8F91D0",
  "#8F91D0",
  "#5255C6",
];
const BRICK_RED = [
  "white",
  "#E0C4B2",
  "#E0C4B2",
  "#cda298",
  "#cda298",
  "#b67667",
  "#b67667",
  "#963A25",
];

let dimensions = (svg, m = { top: 0, left: 0, right: 0, bottom: 0 }) => ({
  width: +svg.attr("width"),
  height: +svg.attr("height"),
  margin: m,
  innerWidth: +svg.attr("width") - m.left - m.right,
  innerHeight: svg.attr("height") - m.top - m.bottom,
});

let getSVG = (id) => {
  d3.select(`#${id} > *`).remove();
  return d3.select(`#${id}`);
};

/**
 * A helper method to aid in constructing visualizations. Lays out necessary dimensions
 * as well as data fields to use
 * @param {string} id - the id of the svg element to use
 * @param {Array.<Object>} data - array of objects containing all of the data
 * @param {Object} values - an object of the form {"x":string, "y":string} that selects
 *     the fields in data to use
 * @param {Object} m - margins
 */
let outline = (
  id,
  data,
  values,
  m = { top: 0, left: 0, right: 0, bottom: 0 }
) => {
  const svg = getSVG(id);
  const outline = dimensions(svg, m);
  outline["xValue"] = (d) => d[values.x];
  outline["yValue"] = (d) => d[values.y];
  outline["data"] = data;
  outline["svg"] = svg;
  return outline;
};

/**
 * D3 linear scale wrapper
 */
let yMap = (outline) =>
  d3.scaleLinear().domain([0, 50]).range([outline.innerHeight, 0]).nice();

/**
 * D3 line wrapper
 */
let lineGenerator = (x, y, outline) =>
  d3
    .line()
    .x((d) => x(outline.xValue(d)))
    .y((d) => y(outline.yValue(d)))
    .curve(d3.curveBasis);

/**
 * D3 area wrapper
 */
let areaGenerator = (x, y, outline) =>
  d3
    .area()
    .x((d) => x(outline.xValue(d)))
    .y0(outline.innerHeight)
    .y1((d) => y(outline.yValue(d)))
    .curve(d3.curveBasis);

/**
 * A small box which contains information and follows the user's mouse around.
 * Can be applied to any svg
 *
 * @param {Object} g = group element that the tooltip should reside in
 * @param {number} width = tooltip width
 * @param {number} height = tooltip height
 * @param {number} padding = padding with the parent element
 * @param {number} gwidth = width of g element
 * @param {number} gheight = height of g element
 */
// let tooltip = (g, width, height, padding, gwidth, gheight) => {
//   let tt = g
//     .append("rect")
//     .attr("class", "tooltip")
//     .attr("width", width)
//     .attr("height", height)
//     .style("fill", "#b3b3b3");
//   let tooltipText = g
//     .append("text")
//     .attr("class", "tooltip")
//     .attr("transform", "translate(50, 50)");
//     // .attr("transform", "translate(0, 15)");
//   tt.setText = (text) => tooltipText.text(text);
//   tt.fitSizeToText = () => tt.attr("width", tooltipText.node().getBBox().width);
//   g.selectAll(".tooltip").style("opacity", 0);
//   g.on("mouseover", (d) =>
//     g.selectAll(".tooltip").transition().duration(30).style("opacity", 1)
//   )
//     .on("mousemove", function (d) {
//       let ttwidth = tt.attr("width");
//       let ttheight = tt.attr("height");
//       let xOffset =
//         d3.mouse(this)[0] > gwidth - ttwidth - padding
//           ? -padding - ttwidth
//           : padding;
//       let yOffset = d3.mouse(this)[1] > gheight - ttheight ? -ttheight : 0;

//       g.selectAll(".tooltip")
//         .attr("x", d3.mouse(this)[0] + xOffset)
//         .attr("y", d3.mouse(this)[1] + yOffset);
//     })
//     .on("mouseout", (d) =>
//       g.selectAll(".tooltip").transition().duration(200).style("opacity", 0)
//     );

//   return tt;
// };

let tooltip = (g, text) => {
  g.on("mousemove", function (d) {
    let tooltip = document.getElementById("tooltip");
    tooltip.innerHTML = text;
    tooltip.style.display = "block";
    tooltip.style.left = d3.event.pageX + 10 + 'px';
    tooltip.style.top = d3.event.pageY + 10 + 'px';
  })
  .on("mouseout", (d) => {
    const tooltip = document.getElementById("tooltip");
    tooltip.style.display = "none";
  });

  return g;
};

/**
 * A helper function to allow switching panels to be shown. Hides all
 * other panels
 *
 * @param {string} panel - id of the panel to show
 */

function setPanel(panel) {
  document
    .querySelectorAll(".panel")
    .forEach((node) => (node.style.display = "none"));
  document
    .querySelectorAll(`.${panel}`)
    .forEach((node) => (node.style.display = "block"));
}

/**
 * Constructs a table where each row is colored based off of a selected data field
 *
 * @param {string} id - id of the svg element to use
 * @param {Array.<Object>} data - data to be used in the table
 * @param {Array.<string>} values - array of field names in data to use as columns for
 *     each row in the table
 * @param {Object} colorMappings - an object mapping the field to the column color to use in the heat table
 * @param {Array.<Array.<string>>} comparisons - used to map two columns to each other so that
 *     for each element, e, of mapColumn, the color of the text of datapoints e[1] are based off of
 *     the values for datapoints in field e[0]
 * @param {Array.<Object>} notices - an array of objects of the form {identifier:string, message:string}.
 *     If the specified identifier shows up in the table, then a tooltip will be created with the coresponding
 *     message for the row which the identifier appears in.
 * @param {number} cellWidth - highlighted cell width.
 */
function heatTable(
  id,
  data,
  values,
  units,
  colorMappings,
  comparisons = [],
  notices = []
) {
  let toGraph = outline(id, data, values, {
    top: 10,
    left: 10,
    right: 10,
    bottom: 10,
  });
  const rowHeight = 30;
  const rowPadding = 5;
  const cycleWidth = 60;
  const textPadding = 5;
  const tooltipHeight = 20;
  const tooltipPadding = 5;

  // Create a scale for each column that varies the opacity
  const scaleOffset = 0.05;
  const opacityRange = [0.1, 0.8];
  const scales = {};
  Object.keys(colorMappings).forEach((entry) => {
    let extent = d3.extent(
      data.map((d, i) => (i == 0 ? data[i + 1][entry] : d[entry]))
    );

    // If there is no change in value, the column should look a tiny bit colored
    // Adding 1 to the extent[1] to create a proper domain acheives this
    if (extent[0] == extent[1]) extent[1] += 1;
    scales[entry] = d3.scaleLinear().domain(extent).range(opacityRange);
  });

  const render = (graph) => {
    const g = graph.svg
      .append("g")
      .attr(
        "transform",
        `translate(${graph.margin.left}, ${graph.margin.top})`
      );
    g.selectAll("g")
      .data(graph.data)
      .enter()
      .append("g")
      .attr("class", "data")
      .append("rect")
      .attr("width", graph.innerWidth)
      .attr("height", rowHeight)
      .attr("y", (d, i) => i * (rowHeight + rowPadding))
      .attr("fill", (d, i) => "white");
    values.forEach((column, columnInd) => {
      g.selectAll(".data")
        .each((data, nodeInd, nodes) => {
          noticeInd = notices
            .map((note) => note.identifier)
            .findIndex((elem) => elem == data[column]);
          if (noticeInd != -1) {
            // tt = tooltip(
            //   d3.select(nodes[nodeInd]),
            //   5,
            //   tooltipHeight,
            //   tooltipPadding,
            //   graph.innerWidth,
            //   rowHeight
            // );
            // tt.setText(notices[noticeInd].message);
            // tt.fitSizeToText();

            tt = tooltip(d3.select(nodes[nodeInd]), notices[noticeInd].message);
          }
        })
        .append("text")
        .text((d, i) => {
          if (i === 0) {
            return ''
          }
          if (d[column] !== 0 && !d[column] || d[column] === '*' || d[column] === '-') {
            return d[column];
          }
          if (!!units[columnInd]) {
            return `${d[column]} ${units[columnInd]}`
          }
          return d[column];
        })
        .attr(
          "x",
          columnInd == 0
            ? cycleWidth / 2 + textPadding
            : ((graph.innerWidth - textPadding * 2 - cycleWidth) /
                (2 * (values.length - 1))) *
                (2 * columnInd - 1) +
                textPadding +
                cycleWidth
        )
        .attr(
          "y",
          (row, rowInd) =>
            rowInd * (rowHeight + rowPadding) + (rowHeight + rowPadding) / 2
        )
        .style("fill", (row, rowInd) => {
          let color = "black";
          comparisons.forEach((compareCol) => {
            if (
              column == compareCol[1] &&
              !notices.map((d) => d.identifier).includes(row[compareCol[0]]) &&
              rowInd != 0
            ) {
              positive = "blue";
              negative = "red";
              if (compareCol[2] == "inverse") {
                positive = "red";
                negative = "blue";
              }

              if (row[compareCol[0]] == row[compareCol[1]]) color = "green";
              else if (row[compareCol[0]] > row[compareCol[1]])
                color = negative;
              else if (row[compareCol[0]] < row[compareCol[1]])
                color = positive;
            }
          });
          return color;
        })
        .style("font-size", (row, rowInd) => {
          return rowInd === 0 ? 20 : 16;
        })
        .style("text-anchor", "middle")
        .each((row, rowInd, nodes) => {
          if (rowInd != 0) {
            d3.select(nodes[rowInd].parentNode)
              .insert("rect", "text")
              .attr(
                "x",
                columnInd == 0
                  ? textPadding
                  : ((graph.innerWidth - textPadding * 2 - cycleWidth) /
                      (2 * (values.length - 1))) *
                      (2 * columnInd - 2) +
                      textPadding +
                      cycleWidth
              )
              .attr("y", rowInd * (rowHeight + rowPadding) - rowPadding)
              .attr(
                "width",
                columnInd == 0
                  ? cycleWidth
                  : (graph.innerWidth - textPadding * 2 - cycleWidth) /
                      (values.length - 1)
              )
              .attr("height", rowHeight + rowPadding)
              .style("fill", colorMappings[column] ? colorMappings[column] : "white")
			        .style("opacity", scales[column] ? scales[column](data[rowInd][column]) : 0)
          }
        });
    });
  };
  render(toGraph);
}

/**
 * Constructs a table where each row is colored based off of a selected data field
 *
 * @param {string} id - id of the svg element to use
 * @param {Array.<Object>} data - data to be used in the table
 * @param {Array.<string>} values - array of field names in data to use as columns for
 * @param {string} tooltipID - id of tooltip div.
 */
function chainmap(
  id,
  data,
  values,
  blocks,
  mapColor = TEAL,
  tooltipLabel = "",
  axis = true,
  tooltipID
) {
  let toGraph = outline(
    id,
    data,
    values,
    axis
      ? { top: 0, left: 10, right: 0, bottom: 20 }
      : { top: 0, left: 10, right: 0, bottom: 0 }
  );
  const blockWidth = 22.5;
  const numBlocks = Math.floor(toGraph.innerWidth / blockWidth);
  const blockVal = Math.floor(blocks / numBlocks);
  const blockPadding = 5;
  const tooltipHeight = 20;
  const tooltipWidth = 20;
  const tooltipPadding = 10;
  const axisLabelOffset = 15;
  let blocksArr = [];

  for (let i = 0; i < numBlocks; i++) blocksArr.push({ mapVal: 0, data: [] });

  const x = d3
    .scaleQuantize()
    .domain([0, blocks])
    .range(Array.from(blocksArr.keys()));

  toGraph.data.forEach((d, i) => {
    blocksArr[x(toGraph.xValue(d) % blocks)].mapVal += 1;
    blocksArr[x(toGraph.xValue(d) % blocks)].data.push(d.label);
  });

  const color = d3
    .scaleQuantize()
    .domain([0, d3.max(blocksArr.map((d) => d.mapVal)) - 1])
    .range(mapColor);
 
  const y = d3
    .scaleLinear()
    .domain([0, d3.max(blocksArr.map((d) => d.mapVal)) + 0.01])
    .range([3, toGraph.innerHeight - 8]);

  const xAxis = d3
    .axisBottom(
      d3
        .scaleOrdinal()
        .domain([0, blocks - 1])
        .range([0, blockWidth * numBlocks - blockPadding])
    )
    .tickSize(5)
    .tickPadding(5);
  const render = (graph) => {
    const g = graph.svg
      .append("g")
      .attr(
        "transform",
        `translate(${graph.margin.left}, ${graph.margin.top})`
      );

    g.selectAll(".databar")
      .data(blocksArr)
      .enter()
      .append("rect")
      .attr("class", "databar")
      .attr("y", (d) => graph.innerHeight - y(d.mapVal) - 8 )
      .attr("x", (d, i) => i * blockWidth)
      .attr("width", blockWidth - blockPadding)
      .attr("height", (d) => y(d.mapVal))
      .style("fill", (d) => (d.mapVal == 0 ? "white" : color(d.mapVal)))
      .style("stroke-width", 1)
      .style("stroke", (d) =>
        d.mapVal == 0 || color(d.mapVal) == "white" ? "#707070" : "white"
      );

      let outRect = g
      .append("rect")
      .style("stroke-width", 2)
      .style("stroke", "#00BFFF")
      .attr("width",  blockWidth - blockPadding-1)
      .attr("fill", "none");

    g.selectAll(".databar").on("mouseover", function (d) {
      let rect = d3.select(this);
      outRect
        .attr("x", rect._groups[0][0].x.baseVal.value + 1)
        .attr("y", graph.innerHeight - y(d.mapVal) - 8)
        .attr("height", y(d.mapVal));
      document.getElementById(
        tooltipID
      ).innerHTML = `${d.mapVal}${tooltipLabel}: ${d.data}`;
    }).on("mouseout", function (d) {
      let rect = d3.select(this);
      outRect.attr("x", rect._groups[0][0].x.baseVal.value);
    });

    if (axis) {
      g.append("g")
        .call(xAxis)
        .attr("transform", `translate(0, ${graph.innerHeight})`);
      g.append("text")
        .attr("y", graph.innerHeight - axisLabelOffset)
        .attr(
          "transform",
          `translate(${graph.innerWidth / 2},${graph.innerHeight})`
        )
        .style("text-anchor", "middle");
    }
  };
  render(toGraph);
}

/**
 * Constructs a stacked bar graph provided an svg id
 *
 * @param {string} id - the id of the svg element to build on
 * @param {Array.<Object>} data - an array of elements with the data in them
 * @param {number} colorSet - an integer 1 - 10 to choose the color scheme to use for
 * the graph
 * @param {function} - a function to make when one of the boxes are clicked on
 * @param {string} - id of the anchor symbol with baker's name
 */

function stackedBarGraph(
  id,
  data,
  values,
  colorSet = 0,
  anchorId,
  callback = (d) => {
    return;
  }
) {
  let toGraph = outline(id, data, values, {
    top: 0,
    left: 1,
    right: 0,
    bottom: 15,
  });
  const colorSchemes = [
    d3.schemeSet1,
    d3.schemeSet2,
    d3.schemeSet3,
    d3.schemeCategory10,
    d3.schemeAccent,
    d3.schemeDark2,
    d3.schemePaired,
    d3.schemePastel1,
    d3.schemePastel2,
    d3.schemeTableau10,
    [
      "#99CCE2",
      "#A7F1FF",
      "#CCD5E8",
      "#6DBEF3",
      "#7ACCC8",
      "#C9F5D9",
      "#B6C1E7",
      "#CCCCCC",
      "#B4E3CD",
      "#D2DBF9",
    ],
  ];
  const colorScheme = colorSchemes[colorSet];
  const render = (graph) => {
    const sum = d3.sum(graph.data, graph.xValue);
    let tooltipHeight = 35;

    // Find the default box to highlight
    let defaultInd = graph.data.findIndex((d) => d.default == "true");
    if (defaultInd == -1) defaultInd = 0;
    graph.data[defaultInd]["default"] = "true";
    let defaultVal = graph.data[defaultInd];

    // Sum the target field from the datapoints
    graph.data.forEach(
      (d, i) => (d["sum"] = d3.sum(graph.data.slice(0, i), graph.xValue))
    );

    // Create the x and color scale to use
    const x = d3.scaleLinear().domain([0, sum]).range([0, graph.innerWidth]);
    var color = d3
      .scaleOrdinal()
      .domain(graph.data.map(graph.yValue))
      .range(colorScheme);

    const xAxis = d3.axisBottom(x).tickSize(10).tickPadding(15);

    const g = graph.svg
      .append("g")
      .attr(
        "transform",
        `translate(${graph.margin.left}, ${graph.margin.top})`
      );

    // Add tooltip
    let tooltip = g
      .append("g")
      .attr("class", "tooltip")
      .attr("transform", `translate(1, ${graph.innerHeight - tooltipHeight})`);
    tooltip
      .append("rect")
      .attr("width", 500)
      .attr("height", tooltipHeight)
      .style("fill", "#F6F7FB")
      .attr("rx", 10)
      .attr("ry", 10)
      .style("stroke-width", 1)
      .style("stroke", "#E4EAF2");
    tooltip
      .append("text")
      .attr("id", "tooltip_text")
      .attr("font-size", 14)
      .attr("x", 5)
      .attr("y", graph.margin.top + tooltipHeight * 0.65)
      .style("fill", "#636E95")
      .text(graph.yValue(defaultVal));

    g.selectAll("rect.databar")
      .data(graph.data)
      .enter()
      .append("rect")
      .attr(
        "class",
        (d) => "databar " + (d.default == "true" ? "default" : "normal")
      )
      .attr("fill", (d) => color(graph.yValue(d)))
      .attr("y", 8)
      .attr("x", (d) => x(d.sum))
      .attr("width", (d) => graph.xValue(d) * graph.innerWidth)
      .attr("height", graph.innerHeight - tooltipHeight - 8);

    // Set the anchor above default data
    let defaultRect = g.select(".default");
    let defaultNext = defaultRect._groups[0][0].nextSibling;
    let outRect = g
      .append("rect")
      .style("stroke-width", 2)
      .style("stroke", "#7C88B1")
      .attr(
        "width",
        !!defaultNext
          ? defaultNext.x.baseVal.value -
              defaultRect._groups[0][0].x.baseVal.value
          : 0
      )
      .attr("fill", "none")
      .attr("height", graph.innerHeight - tooltipHeight + 7)
      .attr("x", defaultRect._groups[0][0].x.baseVal.value)
      .attr("y", 1);

    // For each of the data rectangles, highlight it on mouseover
    g.selectAll("rect.databar")
      .on("mouseover", function (d) {
        let rect = d3.select(this);
        let nextNode = rect._groups[0][0].nextSibling;
        outRect
          .attr("x", rect._groups[0][0].x.baseVal.value - 1)
          .attr(
            "width",
            nextNode.x.baseVal.value - rect._groups[0][0].x.baseVal.value + 2
          );
        g.select("#tooltip_text")
          .attr("opacity", 0)
          .text(graph.yValue(d))
          .transition()
          .duration(100)
          .attr("opacity", 1);
      })
      .on("mouseout", function (d) {
        g.select("#tooltip_text").text(graph.yValue(defaultVal));
        outRect
          .attr(
            "width",
            !!defaultNext
              ? defaultNext.x.baseVal.value -
                  defaultRect._groups[0][0].x.baseVal.value
              : 0
          )
          .attr("x", defaultRect._groups[0][0].x.baseVal.value);
      })
      .on("click", function (d) {
        callback(d);
      });
  };
  render(toGraph);
}

/**
 * Constructs a linegraph in a given svg
 *
 * @param {string} id - the id of the svg element to build on
 * @param {Array.<Object>} data - an array of elements with the data in them
 * @param {Array.<number>} yExtent - an array of two numbers bounding the range of the graph
 * @param {boolean} time - flag indicating whether or not the x axis should display time
 * @param {boolean} area - flag indicating whehter or not the area under the line should be filled in
 */
function linegraph(id, data, values, yExtent, time = true, area = false) {
  let xScale = time ? d3.scaleTime() : d3.scaleLinear();
  let grapher = area ? areaGenerator : lineGenerator;
  const dateFormatter = d3.timeFormat("%Y %m/%d %H:%M");
  
  const xTickSize = 5;
  const xTickPadding = 5;
  const yTickSize = 5;
  const yTickPadding = 5;

  const toGraph = outline(id, data, values, {
    top: 10,
    left: 35,
    right: 10,
    bottom: 30,
  });
  const render = (graph) => {
    const interp = d3.interpolateBasis(graph.data.map(function(p) {
      return p[values.y];
    }));
    const xmax = d3.max(graph.data, function(d) {return d[values.x] })
    const x = xScale
      .domain(d3.extent(graph.data, graph.xValue))
      .range([0, graph.innerWidth]);

    const y = d3
      .scaleLinear()
      .domain(yExtent)
      .range([graph.innerHeight, 0])
      .nice();
    const xAxisBefore = time ? 
    d3.axisBottom(x).tickFormat(d3.timeFormat("%a %d")).ticks(d3.timeDay.filter(d=>d3.timeDay.count(0, d) % 2 === 0)) : d3.axisBottom(x)

    const xAxis = xAxisBefore
      .tickSize(xTickSize)
      .tickPadding(xTickPadding);

    const yAxisBefore = d3
      .axisLeft(y)
      .tickSize(yTickSize)
      .tickPadding(yTickPadding);
    let yAxis = time ? yAxisBefore : yAxisBefore.tickFormat(d3.format(".2s"));

    const g = graph.svg
      .append("g")
      .attr(
        "transform",
        `translate(${graph.margin.left}, ${graph.margin.top})`
      );
      

    let line = g.append("path");
    line
      .attr("d", grapher(x, y, graph)(graph.data))
      .transition()
      .duration(1000)
      .attr("fill", area ? "#0099ff38" : "none")
      .attr("stroke", area ? "none" : "#C7E9FF")
      .attr("stroke-width", 4)
      .attr("stroke-linejoin", "round");

    g.append("g").call(yAxis);

    const focus = g.append("g")
      .attr("class", "focus")
      .style("display", "none");
    focus.append("circle")
      .attr("r", 4);

      focus.append("rect")
        .attr("class", "line-tooltip")
        .attr("width", 68)
        .attr("height", 29)
        .attr("x", -34)
        .attr("y", -40)
        .attr("rx", 4)
        .attr("ry", 4);
      focus.append("polygon")
        .attr("class", "line-tooltip-tri")
        .attr("points", "-5.5,-12 5.5,-12 0,-5");

      focus.append("text")
        .attr("class", "tooltip-date")
        .attr("text-anchor", 'middle')
        .attr("x", -0)
        .attr("y", -17);

      focus.append("text")
        .attr("class", "tooltip-likes")
        .attr("text-anchor", 'middle')
        .attr("x", -0)
        .attr("y", -26);

    g.append("g")
      .call(xAxis)
      .attr("transform", `translate(0, ${graph.innerHeight})`)
      .selectAll(".tick text")
      .call(function (t) {
        t.each(function (d) {
          var self = d3.select(this);
          var s = self.text().split(" ");
          self.text("");
          self.append("tspan").attr("x", 0).attr("dy", ".8em").text(s[0]);
          self.append("tspan").attr("x", 0).attr("dy", "1.1em").text(s[1]);
        });
      });

      g.append("rect")
        .attr("class", "overlay")
        .attr("width", graph.innerWidth - 20)
        .attr("height", graph.innerHeight)
        .on("mouseover", function() { focus.style("display", null); })
        .on("mouseout", function() { focus.style("display", "none"); })
        .on("mousemove", mousemove);

      function mousemove() {
        const x0 = d3.mouse(this)[0];
        const y0 = interp(x0 / x(xmax));
        focus.attr("transform", "translate(" + x0 + "," + y(y0) + ")");
        if(time) {
          focus.select(".tooltip-likes").text(`${Math.round(y0)} Blocks`);
          focus.select(".tooltip-date").text(dateFormatter(Math.round(x.invert(x0))));
        } else {
          focus.select(".tooltip-date").text(`Cycle ${Math.round(x.invert(x0))}`);
          focus.select(".tooltip-likes").text(`${Math.round(y0)} ꜩ`);
        }
        
      }
  };
  render(toGraph);
}
