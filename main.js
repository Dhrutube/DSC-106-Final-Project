import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

// Load data
async function loadData(){
    const data = await d3.csv('data.csv', (row) => ({
        ...row,
        year: +row.year,
        month: +row.month,
        density: +row.density
  }));
    return data;
}

// Will need to break it down or else long long scroll :(
function populateDropdowns(data) {
 // Get unique years from data   
  const years = [...new Set(data.map(d => +d.year))];

  const startSelect = document.getElementById("startYear");
  const endSelect = document.getElementById("endYear");

  // Clear existing options
  startSelect.innerHTML = '';
  endSelect.innerHTML = '';
  
  // Assign repsective months to 1 - 12
  years.forEach((year) => {
    const startOption = new Option(Number(year));
    const endOption = new Option(Number(year));
    
    startSelect.add(startOption);
    endSelect.add(endOption);
  });
  
  [startSelect.value, endSelect.value ]= d3.extent(data, function(d) { return d.year; });
  let startYear = startSelect.value;
  let endYear = String(Number(startSelect.value) + 4);
  endSelect.value = endYear;
  
  return [startYear, endYear];
}

var margin = {top: 20, right: 20, bottom: 30, left: 40},
    width = 960 - margin.left - margin.right,
    height = 500 - margin.top - margin.bottom;

var svg = d3.select('#viz')
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

function renderLinePlot(data, startYear, endYear) {
    let startToEndYears = [];
    for(let i = Number(startYear); i <= Number(endYear); i++) {
        startToEndYears.push(data.filter(function(d) { return d.year === i; }));
    }
    const colors = d3.schemeTableau10;

    const [min, max] = d3.extent(data.filter(function(d) {return d.year >= Number(startYear) && d.year <= Number(endYear)}), 
      function(d) { return d.density; }
    );

    var x = d3.scaleLinear()
        .domain(d3.extent(data, function(d) { return d.month; }))
        .range([0, width]);
    svg.append("g")
      .attr("transform", "translate(0," + height + ")")
      .call(d3.axisBottom(x));

    var y = d3.scaleLinear()
      .domain([min, max])
      .range([ height, 0 ]);
    svg.append("g")
      .call(d3.axisLeft(y));

    const legendData = [];
    
    for (let i = 0; i < startToEndYears.length; i++) {
      let yearData = startToEndYears[i];
      svg.append("path")
        .datum(yearData)
        .attr("fill", "none")
        .attr("stroke", colors[i % colors.length])
        .attr("stroke-width", 1.5)
        .attr("d", d3.line()
          .x(function(d) { return x(d.month) })
          .y(function(d) { return y(d.density) })
          );
      legendData.push({
        color: colors[i % colors.length],
        label: `${Number(startYear) + i}`
      });
    }

    const legendContainer = d3.select("#legend");
    legendContainer.html(""); // Clear previous legend

    // Add title
    legendContainer.append("div")
      .text("Legend")
      .style("font-weight", "bold")
      .style("margin-bottom", "6px");

  // Each legend row: flex container
  const legendItems = legendContainer.selectAll(".legendItem")
    .data(legendData)
    .join("div")
    .attr("class", "legendItem")
    .style("display", "flex")
    .style("align-items", "center")
    .style("margin-bottom", "4px");

  // Color box
  legendItems.append("div")
    .style("width", "20px")
    .style("height", "20px")
    .style("background-color", d => d.color)
    .style("margin-right", "6px")
    .style("flex-shrink", "0"); // Prevent color box from shrinking
    
  // Label text
  legendItems.append("div")
    .text(d => d.label)
    .style("font-size", "12px")
    .style("white-space", "nowrap"); // Prevent text wrapping
}

async function init() {
    const data = await loadData();
    const [startYear, endYear] = populateDropdowns(data);

    const updateButton = document.getElementById("updateButton");
    if (updateButton) {
      updateButton.onclick = () => {
        const startYear = parseInt(document.getElementById("startYear").value);
        const endYear = parseInt(document.getElementById("endYear").value);
        
        if (startYear > endYear) {
          alert("Start month must be before end month");
          return;
        }
        if (endYear - startYear > 4) {
          alert("You can only select a range of up to 5 years");
          return;
        }

        svg.selectAll("*").remove();
        renderLinePlot(data, startYear, endYear);
      };
    }
    renderLinePlot(data, startYear, endYear);
}

init();