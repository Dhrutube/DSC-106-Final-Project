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
    const heatmapData = await d3.csv('heatmapSd.csv', (row) => ({
        ...row,
        hasMissing: +row.hasMissing,
        x: +row.x,
        y: +row.y,
        value: +row.value,
        state: +row.state,
        sd: +row.sd,
        count: +row.count
  }));

    const linePlotData = await d3.csv('lineplot_data.csv', (row) =>({
        ...row,
        year: +row.year,
        density: +row.density
    }))

    heatmapData.forEach(d => {
        d.x = +d.x;
        d.y = +d.y;
        d.value = +d.value;
        d.state = +d.state;

        // Convert std: empty string -> NaN
        d.std = d.std === "" ? NaN : +d.std;

        // Convert hasMissing: treat anything >0 as true
        d.hasMissing = d.hasMissing === "" || d.hasMissing === "NaN"
            ? NaN
            : (d.hasMissing === "True" || d.hasMissing === "true" || d.hasMissing === "1" || d.hasMissing === 1);
    });


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
function drawLegendVertical(colors, thresholds) {
    svg.selectAll(".legend").remove();

    const labels = [
        `Large decrease (std < ${thresholds[0].toFixed(2)})`,
        `Moderate decrease (${thresholds[0].toFixed(2)} – ${thresholds[1].toFixed(2)})`,
        `Little to no change (${thresholds[1].toFixed(2)} – ${thresholds[2].toFixed(2)})`,
        `Moderate increase (${thresholds[2].toFixed(2)} – ${thresholds[3].toFixed(2)})`,
        `Large increase (>= ${thresholds[3].toFixed(2)})`,
    ];

    const padding = 10;
    const rectWidth = 20;
    const rectHeight = 20;
    const spacing = 5;

    const legend = svg.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${width - rectWidth - padding - 180}, 380)`);

    // rectangles
    legend.selectAll("rect")
        .data(colors)
        .join("rect")
        .attr("x", 0)
        .attr("y", (d, i) => i * (rectHeight + spacing))
        .attr("width", rectWidth)
        .attr("height", rectHeight)
        .attr("fill", d => d)
        .attr("stroke", "#000");

    // labels
    legend.selectAll("text.legend-label")
        .data(labels)
        .join("text")
        .attr("class", "legend-label")
        .attr("x", rectWidth + 7)
        .attr("y", (d, i) => i * (rectHeight + spacing) + rectHeight - 4)
        .attr("font-size", "12px")
        .attr("fill", "white")
        .text(d => d);

    // title
    legend.append("text")
        .attr("x", 0)
        .attr("y", -18)
        .attr("font-size", "14px")
        .attr("font-weight", "bold")
        .attr("fill", "white")
        .text("Vegetation Variability (Std Dev)");
}

function drawHeatmap(data) {
    svg.selectAll("rect").remove();

    const stdValues = data
        .map(d => d.std)
        .filter(v => !isNaN(v))
        .sort(d3.ascending);

    if (stdValues.length === 0) {
        console.error("ERROR: No valid std values found.");
        return;
    }

    const q20 = d3.quantile(stdValues, 0.20);
    const q40 = d3.quantile(stdValues, 0.40);
    const q60 = d3.quantile(stdValues, 0.60);
    const q80 = d3.quantile(stdValues, 0.80);

    const thresholds = [q20, q40, q60, q80];
    const colors = [
        "#c49a00",  
        "#f4c542",  
        "#fff7a0",  
        "#66c2a5",  
        "#006400"
    ];

    const colorScale = d3.scaleThreshold()
        .domain(thresholds)
        .range(colors);
    
    svg.selectAll("rect")
        .data(data)
        .join("rect")
        .attr("x", d => (d.x - 1) * cellWidth)
        .attr("y", d => (d.y - 1) * cellHeight)
        .attr("width", cellWidth)
        .attr("height", cellHeight)
        .attr("fill", d => {
            const stdMissing = isNaN(d.std);

            if (stdMissing) return "#212121"; // missing → black
            return colorScale(d.std);
        });

    drawLegendVertical(colors, thresholds);
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

function renderLinePlot(data) {
    const startYear = 2000;
    const endYear = 2024;

    // Filter data to your year range
    const filteredData = data.filter(d => d.year >= startYear && d.year <= endYear);

    // X scale: years
    const x = d3.scaleLinear()
        .domain([startYear, endYear])
        .range([0, lineWidth]);

    // Y scale: density values
    const y = d3.scaleLinear()
        .domain([d3.min(filteredData, d => d.density) - 0.02, d3.max(filteredData, d => d.density) + 0.015])
        .range([lineHeight, 0]);

    // Draw X axis
    svgLine.append("g")
        .attr("transform", `translate(0,${lineHeight})`)
        .call(d3.axisBottom(x).tickFormat(d3.format("d"))); // format as integers

    // Draw Y axis
    svgLine.append("g")
        .call(d3.axisLeft(y));

    // Draw line
    svgLine.append("path")
        .datum(filteredData)
        .attr("fill", "none")
        .attr("stroke", "#1f77b4") // any color you like
        .attr("stroke-width", 2)
        .attr("d", d3.line()
            .x(d => x(d.year))
            .y(d => y(d.density))
        );
    svgLine.append("text")
    .attr("x", lineWidth / 2)
    .attr("y", -lineMargin.top / 2 + 10) // above the plot
    .attr("text-anchor", "middle")
    .attr("font-size", "18px")
    .attr("font-weight", "bold")
    .attr("fill", "white") 
    .text("Vegetation Density Fluctuates Greatly");
}

// Init
async function init() {
    const [heatmapData, linePlotData] = await loadData();

    svg.selectAll("*").remove();
    drawHeatmap(heatmapData);
    renderLinePlot(linePlotData);
    // generate dropdown options based on data
}

init() 
