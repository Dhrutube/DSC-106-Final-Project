import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

document.addEventListener("DOMContentLoaded", () => {
    const pages = document.querySelectorAll(".page");
    let index = 0;

    function updateArrows() {
        const left = document.getElementById("left-arrow");
        const right = document.getElementById("right-arrow");

        if (index === 0) {
            left.classList.add("hidden");
        } else {
            left.classList.remove("hidden");
        }

        if (index === pages.length - 1) {
            right.classList.add("hidden");
        } else {
            right.classList.remove("hidden");
        }
    }

    function showPage(nextIndex) {
        const current = pages[index];
        const next = pages[nextIndex];

        // Fade out current page
        current.classList.remove("active");

        // Wait for fade-out BEFORE switching pages
        setTimeout(() => {
            // Now fade in next page
            next.classList.remove("active");

            setTimeout(() => {
                next.classList.add("active");
                index = nextIndex;
                updateArrows();

                // If this is Page 2, fade in images one by one
                if (nextIndex === 1) {
                    const images = next.querySelectorAll(".quadrants-scroll img");
                    images.forEach((img, i) => {
                        setTimeout(() => {
                            img.classList.add("fade-in");
                        }, i * 1000);
                    })
                }     
            }, 200);
        }, 500); // tiny delay ensures transition is applied properly
        const images = next.querySelectorAll(".quadrants-scroll img");
        images.forEach((img) => img.classList.remove("fade-in"));
    }

    document.getElementById("right-arrow").onclick = () => {
        let nextIndex = (index + 1) % pages.length;
        showPage(nextIndex);
    };

    document.getElementById("left-arrow").onclick = () => {
        let nextIndex = (index - 1 + pages.length) % pages.length;
        showPage(nextIndex);
    };
    updateArrows();
});

async function loadData(){
    const heatmapData = await d3.csv('data/heatmap_data.csv', (row) => ({
        ...row,
        year: +row.year,
        x: +row.x,
        y: +row.y,
        value: +row.value
  }));

    const linePlotData = await d3.csv('data/heatmapDataWithState.csv', (row) =>({
        ...row,
        year: +row.year,
        density: +row.mean_evi,
        state: row.state
    }));

    return [heatmapData, linePlotData];
}

function populateDropdowns(data) {
 // Get unique years from data   
  const years = [2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];

  const startSelect = document.getElementById("startYear");
  const endSelect = document.getElementById("endYear");

  // Clear existing options
  startSelect.innerHTML = '';
  endSelect.innerHTML = '';
  
  
  // Assign repsective years to 1 - 12
  for (let i = 0; i < years.length; i++){
    const startOption = new Option(Number(years[i]));
    const endOption = new Option(Number(years[i]));
    
    startSelect.add(startOption);
    endSelect.add(endOption);
  };
  startSelect.value = 2012
  endSelect.value = 2024
  
  let startYear = startSelect.value;
  let endYear = endSelect.value;
  
  return [startYear, endYear];
}

function setupStateDropdown(data) {
    const select = document.getElementById("stateSelect");

    // List of states in the dataset
    const states = Array.from(new Set(data.map(d => d.state))).sort();

    select.innerHTML = "";

    // Always add "US" option first
    select.append(new Option("United States", "US"));

    // Add states
    states.forEach(state => {
        select.append(new Option(state, state));
    });
}

const scale = 2;
const width = 512 * scale;   // 1024
const height = 256 * scale;  // 512

const gridSizeX = 512;   // number of unique x pixels
const gridSizeY = 256;   // number of unique y pixels

const cellSize = 1;      // if you draw full resolution

const cellWidth = width / gridSizeX;  // = 1 px
const cellHeight = height / gridSizeY; // = 1 px

const svg = d3.select("#viz")
  .append("svg")
  .attr("width", width)
  .attr("height", height);

// Draw legend
function drawLegendVertical(colors) {
    // Remove old legend
    svg.selectAll(".legend").remove();

    const padding = 10;
    const rectWidth = 20;
    const rectHeight = 20;
    const spacing = 5;

    // Descriptions for each color
    const labels = [
        "Large decrease in 🌳",
        "Moderate decrease in 🌳",
        "Little to no change",
        "Moderate increase in 🌳",
        "Large increase in 🌳"
    ];



    const legend = svg.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${width - rectWidth - padding - 150}, ${height - (colors.length * (rectHeight + spacing)) - padding})`);
    
    // legend.append("text")
    //     .attr("class", "legend-title")
    //     .attr("x", 0)
    //     .attr("y", -10)
    //     .attr("font-size", "14px")
    //     .attr("font-weight", "bold")
    //     .text("Diff in Density \nbetween 2024 and 2023");
    // Draw colored rectangles
    legend.selectAll("rect")
        .data(colors)
        .join("rect")
        .attr("x", 0)
        .attr("y", (d, i) => i * (rectHeight + spacing))
        .attr("width", rectWidth)
        .attr("height", rectHeight)
        .attr("fill", d => d)
        .attr("stroke", "#000");

    // Draw text labels to the right
    legend.selectAll("text")
        legend.selectAll("text.legend-label")
        .data(labels)
        .join("text")
        .attr("class", "legend-label")
        .attr("x", rectWidth + 5)
        .attr("y", (d, i) => i * (rectHeight + spacing) + rectHeight / 2 + 4) // vertically center
        .attr("font-size", "12px")
        .attr("fill", "white")   
        .text(d => d);
    
    const title = legend.append("text")
        .attr("class", "legend-title")
        .attr("x", 0)
        .attr("y", -25)
        .attr("font-size", "14px")
        .attr("font-weight", "bold")
        .attr("fill", "white");

    // First line
    title.append("tspan")
        .attr("x", 0)
        .text("Difference in Vegetation");

    // Second line (indented)
    title.append("tspan")
        .attr("x", 0)     // indent by 10 px — adjust as needed
        .attr("dy", 14)    // move down one line
        .text("between 2024 and 2023");
}


function drawHeatmap(data, startYear, endYear) {
    const instruction = document.getElementById("instruction");
    instruction.innerHTML = '';

    svg.selectAll("rect").remove();

    // Filter data for the two years
    const startData = data.filter(d => d.year == startYear);
    const endData   = data.filter(d => d.year == endYear);

    // Build a lookup for fast access by x,y
    const startMap = new Map(startData.map(d => [`${d.x},${d.y}`, d.value]));
    const endMap   = new Map(endData.map(d => [`${d.x},${d.y}`, d.value]));

    // Get all unique (x,y) pairs from either year
    const allKeys = new Set([...startMap.keys(), ...endMap.keys()]);

    const stats = Array.from(allKeys).map(key => {
        const [x, y] = key.split(',').map(Number);
        const valStart = startMap.get(key);
        const valEnd   = endMap.get(key);

        let diff = NaN;
        let hasMissing = false;

        if (valStart === 133 || valEnd === 133 || valStart == null || valEnd == null) {
            hasMissing = true;
        } else {
            diff = valEnd - valStart;
        }

        return {
            xpx: x,
            ypx: y,
            diff,
            hasMissing
        };
    });

    // Filter out missing values for scale
    // const validDiffs = stats.filter(d => !d.hasMissing).map(d => d.diff);

    // Dynamic thresholds based on distribution
    const thresholds = [-20, -8, 8, 20]; 
    const colors = [
        "#c49a00",  // large decrease
        "#f4c542",  // moderate decrease
        "#fff7a0",  // little/no change
        "#66c2a5",  // moderate increase
        "#006400"   // large increase
    ];
        
    const colorScale = d3.scaleThreshold()
        .domain(thresholds)
        .range(colors);

    // Draw heatmap
    svg.selectAll("rect")
        .data(stats)
        .join("rect")
        .attr("x", d => (d.xpx - 1) * cellWidth)
        .attr("y", d => (d.ypx - 1) * cellHeight)
        .attr("width", cellWidth)
        .attr("height", cellHeight)
        .attr("fill", d => d.hasMissing ? "#212121" : colorScale(d.diff));
    
    drawLegendVertical(colors);
}

var lineMargin = {top: 20, right: 20, bottom: 30, left: 40},
    lineWidth = 960 - lineMargin.left - lineMargin.right,
    lineHeight = 500 - lineMargin.top - lineMargin.bottom;

var svgLine = d3.select('#lineViz')
    .append("svg")
    .attr("width", lineWidth + lineMargin.left + lineMargin.right)
    .attr("height", lineHeight + lineMargin.top + lineMargin.bottom)
    .append("g")
    .attr("transform", "translate(" + lineMargin.left + "," + lineMargin.top + ")");

function renderLinePlot(data, selectedState = "US") {
    // Remove old chart content
    svgLine.selectAll("*").remove();

    // Group data
    let grouped;
    if (selectedState === "US") {
        // Average by year for all states
        grouped = d3.rollups(
            data,
            v => d3.mean(v, d => d.density),
            d => d.year
        ).map(([year, density]) => ({ year, density }));
    } else {
        // Filter by specific state
        const filtered = data.filter(d => d.state === selectedState);

        grouped = d3.rollups(
            filtered,
            v => d3.mean(v, d => d.density),
            d => d.year
        ).map(([year, density]) => ({ year, density }));
    }

    grouped.sort((a, b) => a.year - b.year);

    const startYear = 2000;
    const endYear = 2015;

    // Scales
    const x = d3.scaleLinear()
        .domain([startYear, endYear])
        .range([0, lineWidth]);

    const y = d3.scaleLinear()
        .domain([
            d3.min(grouped, d => d.density) - 0.01,
            d3.max(grouped, d => d.density) + 0.01
        ])
        .range([lineHeight, 0]);

    // Axes
    svgLine.append("g")
        .attr("transform", `translate(0,${lineHeight})`)
        .call(d3.axisBottom(x).tickFormat(d3.format("d")));

    svgLine.append("g")
        .call(d3.axisLeft(y));

    // Line
    svgLine.append("path")
        .datum(grouped)
        .attr("fill", "none")
        .attr("stroke", "#1f77b4")
        .attr("stroke-width", 2)
        .attr("d", d3.line()
            .x(d => x(d.year))
            .y(d => y(d.density))
        );

    // Title
    svgLine.append("text")
        .attr("x", lineWidth / 2)
        .attr("y", -5)
        .attr("text-anchor", "middle")
        .attr("font-size", "18px")
        .attr("font-weight", "bold")
        .attr("fill", "white")
        .text(selectedState === "US"
            ? "Mean EVI for the United States"
            : `Mean EVI for ${selectedState}`);
}


// Init
async function init() {
    const [heatmapData, linePlotData] = await loadData();
    const [startYear, endYear] = populateDropdowns(heatmapData);

    const updateButton = document.getElementById("updateButton");
    if (updateButton) {
        updateButton.onclick = () => {
            const startYear = parseInt(document.getElementById("startYear").value);
            const endYear = parseInt(document.getElementById("endYear").value);
            
            if (startYear > endYear) {
            alert("Start month must be before end month");
            return;
            }

            svg.selectAll("*").remove();
            drawHeatmap(heatmapData, startYear, endYear)
        };
    }
    setupStateDropdown(linePlotData);
    document.getElementById("stateSelect").onchange = (e) => {
        renderLinePlot(linePlotData, e.target.value);
    };
    renderLinePlot(linePlotData, "US");
}

init() 
