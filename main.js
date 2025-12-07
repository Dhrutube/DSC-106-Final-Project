import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
let overlayMask;
let regionMaskData;

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
        }, 500);
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
    const percentChangeData = await d3.csv('data/5YearPercentChange_ByRegion.csv', (row) => ({
        startYear: +row.startYear,
        endYear: +row.endYear,
        region: row.region,
        incPerc: +row.increase_percent,
        decPerc: +row.decrease_percent,
        stablPerc: +row.stable_percent
    }));

    const stateRefData = await d3.csv('data/state_reference_data.csv', row => ({
        x: +row.x,
        y: +row.y,
        region: row.region || null  // store null if NaN
    }));

    const heatmapData = await d3.csv('data/heatmapDataWithState.csv', (row) => ({
        ...row,
        year: +row.year,
        x: +row.x,
        y: +row.y,
        value: +row.mean_evi,
        state: row.state
    }));

    const linePlotData = await d3.csv('data/heatmapDataWithState.csv', (row) =>({
        ...row,
        year: +row.year,
        density: +row.mean_evi,
        state: row.state
    }));

    const droughtData = await d3.csv('data/drought_fig-1.csv', (row) => ({
        ...row,
        year: +row.Year,
        drought: +row['Annual average']
    }));

    const co2Data = await d3.csv('data/us-ghg-emissions_fig-1.csv', row => ({
        year: +row.Year,
        co2: +row['Carbon dioxide']
    }));

    return [percentChangeData, stateRefData, heatmapData, linePlotData, droughtData, co2Data];
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

function drawLegendVertical(colors, startYear) {
    // Remove old legend
    svg.selectAll(".legend").remove();

    const padding = 10;
    const rectWidth = 20;
    const rectHeight = 20;
    const spacing = 5;

    // Numerical ranges for clarity
    const labels = [
        "Decrease > 20%",
        "Decrease 5-20%",
        "Change ±5%",
        "Increase 5-20%",
        "Increase > 20%"
    ];

    const legend = svg.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${width - rectWidth - padding - 150}, ${height - (colors.length * (rectHeight + spacing)) - padding})`);

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
    legend.selectAll("text.legend-label")
        .data(labels)
        .join("text")
        .attr("class", "legend-label")
        .attr("x", rectWidth + 5)
        .attr("y", (d, i) => i * (rectHeight + spacing) + rectHeight / 2 + 4)
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
        .text("Vegetation Change");

    // Second line (indented)
    title.append("tspan")
        .attr("x", 0)
        .attr("dy", 14)
        .text(`${startYear} -> ${startYear+4}`);
}

function updateHeatMap(data, startYear) {
    console.log("updateHeatMap called with startYear:", startYear);
    console.log("Available years in data:", [...new Set(data.map(d => d.year))].sort());
    
    svg.selectAll("rect").remove();
    const startData = data.filter(d => d.year == startYear);
    const endData   = data.filter(d => d.year == startYear + 4);
    
    const startMap = new Map(startData.map(d => [`${d.x},${d.y}`, d.value]));
    const endMap   = new Map(endData.map(d => [`${d.x},${d.y}`, d.value]));

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

    const thresholds = [-0.2, -0.05, 0.05, 0.2];
    
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
    
    // Update legend labels to be more precise
    drawLegendVertical(colors, startYear);
}

function getPercByStartYear(data, startYear) {
    const filtered = data.filter(d => d.startYear === startYear);

    const transformed = filtered.map(d => {

        console.log(
            `Region ${d.region}: ${d.decPerc}% decrease`
        );

        return {
            region: d.region,
            incPerc: d.incPerc,
            decPerc: d.decPerc,
            stablPerc: d.stablPerc
        };
    });

    return transformed;
}

function updateInfoBox(data, startYear, hoveredRegion = null) {
    const regionData = getPercByStartYear(data, startYear);
    const displayData = hoveredRegion ? regionData.filter(d => d.region === hoveredRegion) : regionData;

    // Select the container, not the ul
    const container = d3.select('#info-box-container');
    
    // Clear the entire container
    container.html('');
    
    // Add title (outside the ul)
    container.append('h3')
        .text('Area (%) With Decrease in Vegetation');
    
    // Add instruction (outside the ul)
    container.append('div')
        .attr('class', 'instruction')
        .text('Hover over any boxes below to highlight it on the map');

    // Create the ul for the region list
    const infoBox = container.append('ul')
        .attr('id', 'info-box');

    // Bind data to list items
    const items = infoBox.selectAll('li')
        .data(displayData.slice(0, 4), d => d.region);

    const newItems = items.enter().append('li');

    newItems.merge(items)
        .html(d => `
            <div class="region-name">${d.region}</div>
            <div class="region-value">${d.decPerc}% 📉</div>
        `)
        .each(function(d){
            // Make the ENTIRE list item hoverable
            d3.select(this)
                .on('mouseover', () => {
                    console.log(`Hovered on ${d.region}`);
                    dimNonRegionPixels(d.region);
                })
                .on('mouseout', () => {
                    resetOverlay();
                });
        });

    items.exit().remove();
}
// Function to dim non-region pixels using the overlay mask
function dimNonRegionPixels(regionName) {
    if (!regionMaskData) {
        console.error('regionMaskData is undefined');
        return;
    }
    
    console.log(`Looking for region: ${regionName}`);
    console.log(`Total regionMaskData records: ${regionMaskData.length}`);
    
    // First, make the entire map semi-transparent #212121
    overlayMask
        .transition()
        .duration(200)
        .attr("fill", "rgba(33, 33, 33, 0.7)"); // #212121 with 70% opacity
    
    // Find all pixels that are NOT in the hovered region
    const nonRegionPixels = regionMaskData.filter(d => {
        // Keep pixels that don't belong to any region OR belong to a different region
        return !d.region || d.region !== regionName;
    });
    
    console.log(`Found ${nonRegionPixels.length} pixels to dim (non-${regionName})`);
    
    // Remove any existing dimming rectangles
    svg.selectAll(".dim-rect").remove();
    
    if (nonRegionPixels.length > 0) {
        // Add dimming rectangles for non-region pixels
        svg.selectAll(".dim-rect")
            .data(nonRegionPixels)
            .enter()
            .append("rect")
            .attr("class", "dim-rect")
            .attr("x", d => (d.x - 1) * cellWidth)
            .attr("y", d => (d.y - 1) * cellHeight)
            .attr("width", cellWidth)
            .attr("height", cellHeight)
            .attr("fill", "rgba(33, 33, 33, 0.7)") // #212121 with 70% opacity
            .attr("pointer-events", "none");
    }
}

// Reset overlay to transparent
function resetOverlay() {
    // Remove the semi-transparent overlay
    overlayMask
        .transition()
        .duration(200)
        .attr("fill", "transparent");
    
    // Remove all dimming rectangles
    svg.selectAll(".dim-rect").remove();
    
    // Remove region borders if they exist
    svg.selectAll(".region-border").remove();
}



var lineMargin = {top: 20, right: 40, bottom: 30, left: 40},
    lineWidth = 960 - lineMargin.left - lineMargin.right,
    lineHeight = 500 - lineMargin.top - lineMargin.bottom;

var svgLine = d3.select('#lineViz')
    .append("svg")
    .attr("width", lineWidth + lineMargin.left + lineMargin.right)
    .attr("height", lineHeight + lineMargin.top + lineMargin.bottom)
    .append("g")
    .attr("transform", "translate(" + lineMargin.left + "," + lineMargin.top + ")");

function updateActiveLine({ active, selectedState }) {
    // Hide both lines & both axes first
    d3.selectAll(".drought-line").style("visibility", "hidden");
    d3.select(".yAxisDrought").style("visibility", "hidden");

    d3.selectAll(".co2-line").style("visibility", "hidden");
    d3.select(".yAxisCO2").style("visibility", "hidden");

    // Update title text
    const title = d3.select(".plotTitle");

    // Case 1: Drought ON
    if (active === "drought") {
        d3.selectAll(".drought-line").style("visibility", "visible");
        d3.select(".yAxisDrought").style("visibility", "visible");

        title.text(
            selectedState === "US"
                ? "Mean EVI and Drought Index for the United States"
                : `Mean EVI and Drought Index for ${selectedState}`
        );
    }

    // Case 2: CO₂ ON
    else if (active === "co2") {
        d3.selectAll(".co2-line").style("visibility", "visible");
        d3.select(".yAxisCO2").style("visibility", "visible");

        title.text(
            selectedState === "US"
                ? "Mean EVI and CO₂ Levels for the United States"
                : `Mean EVI and CO₂ Levels for ${selectedState}`
        );
    }

    // Case 3: Neither ON
    else {
        title.text(
            selectedState === "US"
                ? "Mean EVI for the United States"
                : `Mean EVI for ${selectedState}`
        );
    }
}

function renderLinePlot(data, selectedState = "US", droughtData = [], co2Data = []) {
    // Remove old content
    svgLine.selectAll("*").remove();

    // ----- EVI DATA (left axis) -----
    let grouped;
    if (selectedState === "US") {
        grouped = d3.rollups(
            data,
            v => d3.mean(v, d => d.density),
            d => d.year
        ).map(([year, density]) => ({ year, density }));
    } else {
        const filtered = data.filter(d => d.state === selectedState);
        grouped = d3.rollups(
            filtered,
            v => d3.mean(v, d => d.density),
            d => d.year
        ).map(([year, density]) => ({ year, density }));
    }

    grouped.sort((a, b) => a.year - b.year);

    // ----- SCALES -----

    // X scale (shared)
    const years = grouped.map(d => d.year);
    const allYears = d3.extent([
        ...years,
        ...droughtData.map(d => d.year)
    ]);

    const x = d3.scaleLinear()
        .domain(allYears)
        .range([0, lineWidth]);

    // Left Y scale (EVI)
    const yLeft = d3.scaleLinear()
        .domain([
            d3.min(grouped, d => d.density) - 0.02,
            d3.max(grouped, d => d.density) + 0.02
        ])
        .range([lineHeight, 0]);

    // Right Y scale (Drought)
    const yRight = d3.scaleLinear()
        .domain(d3.extent(droughtData, d => d.drought))
        .range([lineHeight, 0]);

    // Right y-axis for CO2
    const yRightCO2 = d3.scaleLinear()
        .domain(d3.extent(co2Data, d => d.co2))
        .range([lineHeight, 0]);

    // ----- AXES -----

    // Bottom x-axis
    svgLine.append("g")
        .attr("transform", `translate(0, ${lineHeight})`)
        .call(d3.axisBottom(x).tickFormat(d3.format("d")));

    // Left y-axis (EVI)
    svgLine.append("g")
        .call(d3.axisLeft(yLeft))
        .append("text")
        .attr("fill", "white")
        .attr("x", -40)
        .attr("y", -10)
        .text("Mean EVI");

    // Right y-axis (Drought Index)
    svgLine.append("g")
        .attr("transform", `translate(${lineWidth}, 0)`)
        .call(d3.axisRight(yRight))
        .style("visibility", "hidden")
        .attr("class", "yAxisDrought")
        .append("text")
        .attr("fill", "white")
        .attr("x", 40)
        .attr("y", -10)
        .text("Drought Index");

    // Right y-axis (co2 level)
    svgLine.append("g")
        .attr("class", "yAxisCO2")
        .attr("transform", `translate(${lineWidth}, 0)`)
        .call(d3.axisRight(yRightCO2))
        .style("visibility", "hidden") 
        .append("text")
        .attr("fill", "white")
        .attr("x", 40)
        .attr("y", -10)
        .text("CO₂ Levels");

    // ----- LINES -----

    // EVI line
    svgLine.append("path")
        .datum(grouped)
        .attr("fill", "none")
        .attr("stroke", "#47e664ff")
        .attr("stroke-width", 2)
        .attr("d", d3.line()
            .x(d => x(d.year))
            .y(d => yLeft(d.density))
        );

    // Drought line
    svgLine.append("path")
        .datum(droughtData)
        .attr("class", "drought-line")
        .attr("fill", "none")
        .attr("stroke", "#ffcc00")
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "4 2")  // dashed so user knows it's separate
        .attr("d", d3.line()
            .x(d => x(d.year))
            .y(d => yRight(d.drought))
        )
        .style("visibility", "hidden");

    // co2 line
    svgLine.append("path")
        .datum(co2Data)
        .attr("class", "co2-line")
        .attr("fill", "none")
        .attr("stroke", "#71ffd9ff")
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "5 2")
        .attr("d", d3.line()
            .x(d => x(d.year))
            .y(d => yRightCO2(d.co2))
        )
        .style("visibility", "hidden");


    // plot title
    svgLine.append("text")
        .attr("class", "plotTitle")
        .attr("x", lineWidth / 2)
        .attr("y", 10)
        .attr("text-anchor", "middle")
        .attr("font-size", "18px")
        .attr("font-weight", "bold")
        .attr("fill", "white")
        .text(
            selectedState === "US"
                ? "Mean EVI for the United States"
                : `Mean EVI for ${selectedState}`
        );
    
    d3.select("#toggleDrought").on("change", function () {
        if (this.checked) {
            // Turn off CO₂ checkbox
            d3.select("#toggleCO2").property("checked", false);

            updateActiveLine({ active: "drought", selectedState });
        } else {
            updateActiveLine({ active: null, selectedState });
        }
    });

    d3.select("#toggleCO2").on("change", function () {
        if (this.checked) {
            // Turn off drought checkbox
            d3.select("#toggleDrought").property("checked", false);

            updateActiveLine({ active: "co2", selectedState });
        } else {
            updateActiveLine({ active: null, selectedState });
        }
    });

    // ----- LEGEND -----
    svgLine.append("circle").attr("cx", 10).attr("cy", 20).attr("r", 6).style("fill", "#47e664ff");
    svgLine.append("text").attr("x", 25).attr("y", 25).text("EVI").attr("fill", "white");

    svgLine.append("circle").attr("cx", 10).attr("cy", 45).attr("r", 6).style("fill", "#ffcc00");
    svgLine.append("text").attr("x", 25).attr("y", 50).text("Drought Index").attr("fill", "white");

    svgLine.append("circle").attr("cx", 10).attr("cy", 70).attr("r", 6).style("fill", "#71ffd9ff");
    svgLine.append("text").attr("x", 25).attr("y", 75).text("CO₂ Levels").attr("fill", "white");
}

// Init
async function init() {
    const [percentChangeData, stateRefData, heatmapData, linePlotData, droughtData, co2Data] = await loadData();
    regionMaskData = stateRefData

    let currentYear = 2000;
    // Initial heatmap
    updateHeatMap(heatmapData, currentYear);
    // Add a single overlay rect
    overlayMask = svg.append("rect")
    .attr("width", width)
    .attr("height", height)
    .attr("fill", "transparent")
    .attr("pointer-events", "none")
    .attr("class", "overlay-mask")
    .style("z-index", "10");

    updateInfoBox(percentChangeData, currentYear, null);

    const timeSlider = document.getElementById('time-slider');
    const selectedTime = document.getElementById("selected-Year-Range");

    function updateTimeDisplay(){
        let timeFilter = Number(timeSlider.value);
        
        if (timeFilter === -1){
            selectedTime.textContent = '';
        }
        else {
            currentYear = 2000 + timeFilter*5; // Update the current year
            
            selectedTime.textContent = `${currentYear}-${currentYear + 4}`;
            
            // Update heatmap with current year
            updateHeatMap(heatmapData, currentYear);
            updateInfoBox(percentChangeData, currentYear);
        }
    }

    timeSlider.addEventListener('input', updateTimeDisplay);
    
    // Set initial display
    timeSlider.value = "0"; // Show 2000-2004 initially
    updateTimeDisplay();
    
    setupStateDropdown(linePlotData);
    document.getElementById("stateSelect").onchange = (e) => {
        // Reset checkboxes
        d3.select("#toggleDrought").property("checked", false);
        d3.select("#toggleCO2").property("checked", false);
        
        // redraw line plot
        renderLinePlot(linePlotData, e.target.value, droughtData, co2Data);
    };
    renderLinePlot(linePlotData, "US", droughtData, co2Data);
}

init() 

