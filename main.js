import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
let overlayMask;
let regionMaskData;

// Listen to arrow clicks
document.addEventListener("DOMContentLoaded", () => {
    const pages = document.querySelectorAll(".page");
    let index = 0;

    // Hide arrows if on first/last page
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

// Import in data from CSVs
async function loadData(){
    // For info-box-container
    const percentChangeData = await d3.csv('data/5YearPercentChange_ByRegion.csv', (row) => ({
        startYear: +row.startYear,
        endYear: +row.endYear,
        region: row.region,
        incPerc: +row.increase_percent,
        decPerc: +row.decrease_percent,
        stablPerc: +row.stable_percent
    }));

    // For region masking on heatmap
    const stateRefData = await d3.csv('data/state_reference_data.csv', row => ({
        x: +row.x,
        y: +row.y,
        region: row.region || null  // store null if NaN
    }));

    // For plotting heatmap
    const heatmapData = await d3.csv('data/heatmapDataWithState.csv', (row) => ({
        ...row,
        year: +row.year,
        x: +row.x,
        y: +row.y,
        value: +row.mean_evi,
        state: row.state
    }));

    // For line visualization
    const linePlotData = await d3.csv('data/heatmapDataWithState.csv', (row) =>({
        ...row,
        year: +row.year,
        density: +row.mean_evi,
        state: row.state
    }));

    // For line visualization
    const droughtData = await d3.csv('data/drought_fig-1.csv', (row) => ({
        ...row,
        year: +row.Year,
        drought: +row['Annual average']
    }));

    // For line visualization
    const co2Data = await d3.csv('data/us-ghg-emissions_fig-1.csv', row => ({
        year: +row.Year,
        co2: +row['Carbon dioxide']
    }));

    return [percentChangeData, stateRefData, heatmapData, linePlotData, droughtData, co2Data];
}

// Setting the canvas and resolution of heatmap
const scale = 2;
const width = 512 * scale;
const height = 256 * scale;

const gridSizeX = 512;   // number of unique x pixels
const gridSizeY = 256;   // number of unique y pixels

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

    const labels = [
        "Decrease > 20%",
        "Decrease 5-20%",
        "Change ±5%",
        "Increase 5-20%",
        "Increase > 20%"
    ];

    // Positioning to desired location
    const legend = svg.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${width - rectWidth - padding - 150}, ${height - (colors.length * (rectHeight + spacing)) - padding})`);

    // More styling
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
    
    // Text Styling
    const title = legend.append("text")
        .attr("class", "legend-title")
        .attr("x", 0)
        .attr("y", -25)
        .attr("font-size", "14px")
        .attr("font-weight", "bold")
        .attr("fill", "white");

    // First line of legend title
    title.append("tspan")
        .attr("x", 0)
        .text("Vegetation Change");

    // Second line of legend title
    title.append("tspan")
        .attr("x", 0)
        .attr("dy", 14)
        .text(`${startYear} -> ${startYear+4}`);
}

function updateHeatMap(data, startYear) {
    // Removing prior heatmap
    svg.selectAll("rect").remove();

    const startData = data.filter(d => d.year == startYear);
    const endData   = data.filter(d => d.year == startYear + 4);
    
    // Maps coordinates to density
    const startMap = new Map(startData.map(d => [`${d.x},${d.y}`, d.value]));
    const endMap   = new Map(endData.map(d => [`${d.x},${d.y}`, d.value]));
    const allKeys = new Set([...startMap.keys(), ...endMap.keys()]);

    // Process into heatmap-friendly data
    const stats = Array.from(allKeys).map(key => {
        const [x, y] = key.split(',').map(Number);
        const valStart = startMap.get(key);
        const valEnd   = endMap.get(key);

        let diff = NaN;
        let hasMissing = false;

        // null or 133 represents non-US px
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

// Grabbing needed info from info from data
function getPercByStartYear(data, startYear) {
    const filtered = data.filter(d => d.startYear === startYear);

    const transformed = filtered.map(d => {
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
    // Grabbing data + Deteremining which 
    const regionData = getPercByStartYear(data, startYear);
    // Keep only the region that matches hoveredRegion once you 'hover the text'
    const displayData = hoveredRegion ? regionData.filter(d => d.region === hoveredRegion) : regionData;

    const container = d3.select('#info-box-container');
    
    // Clear the entire container
    container.html('');
    
    // Add title
    container.append('h3').text('Area (%) With Decrease in Vegetation');
    
    // Add instruction
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
                    // Reset the map overlay to show all regions normall
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
    
    // Transparent-like any existing dimming px
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

// ############### Line Graphs ###############

function setupStateDropdown(data, selectId = "stateSelect") {
    const select = document.getElementById(selectId);

    const states = Array.from(new Set(data.map(d => d.state))).sort();

    select.innerHTML = "";
    select.append(new Option("United States", "US"));

    states.forEach(state => {
        select.append(new Option(state, state));
    });
}

var lineMargin = {top: 20, right: 100, bottom: 30, left: 60},
    lineWidth = 960 - lineMargin.left - lineMargin.right,
    lineHeight = 500 - lineMargin.top - lineMargin.bottom;

let activeLine = null;

function updateActiveLine({ active, selectedState, containerId }) {
    activeLine = active;
    const svg = d3.select(`#${containerId} svg`);

    // Hide all lines & axes first
    svg.selectAll(".drought-line").style("visibility", "hidden");
    svg.select(".yAxisDrought").style("visibility", "hidden");
    svg.select(".yAxisLabelDrought").style("visibility", "hidden"); 

    svg.selectAll(".co2-line").style("visibility", "hidden");
    svg.select(".yAxisCO2").style("visibility", "hidden");
    svg.select(".yAxisLabelCO2").style("visibility", "hidden"); 

    const title = svg.select(".plotTitle");

    // Update visible line and right axis
    if (active === "drought") {
        svg.selectAll(".drought-line").style("visibility", "visible");
        svg.select(".yAxisDrought").style("visibility", "visible");
        svg.select(".yAxisLabelDrought").style("visibility", "visible"); 
    } else if (active === "co2") {
        svg.selectAll(".co2-line").style("visibility", "visible");
        svg.select(".yAxisCO2").style("visibility", "visible");
        svg.select(".yAxisLabelCO2").style("visibility", "visible"); 
    } else {
        title.text(
            selectedState === "US"
                ? "Mean Vegetation Density for the United States"
                : `Mean Vegetation Density for ${selectedState}`
        );
    }
}


function renderLinePlot(data, selectedState = "US", droughtData = [], co2Data = [], minYear = 2000, maxYear = 2015, 
containerId = 'lineViz', tooltipId = 'lineTooltip', droughtCheckboxId = 'toggleDrought', co2CheckboxId = 'toggleCO2') {
    // Remove old content
    const svgLineContainer = d3.select(`#${containerId}`);
    svgLineContainer.selectAll("*").remove();

    // Select svg container
    const svgLineLocal = svgLineContainer
        .append("svg")
        .attr("width", lineWidth + lineMargin.left + lineMargin.right)
        .attr("height", lineHeight + lineMargin.top + lineMargin.bottom)
        .append("g")
        .attr("transform", "translate(" + lineMargin.left + "," + lineMargin.top + ")");

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

    // Filter by year values
    grouped.sort((a, b) => a.year - b.year);
    grouped = grouped.filter(d => d.year >= minYear && d.year <= maxYear);
    droughtData = droughtData.filter(d => d.year >= minYear && d.year <= maxYear);
    co2Data = co2Data.filter(d => d.year >= minYear && d.year <= maxYear);

    // ----- SCALES -----
    // X scale 
    const x = d3.scaleLinear()
        .domain([minYear, maxYear])
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

    // Right Y scale (CO2)
    const yRightCO2 = d3.scaleLinear()
        .domain(d3.extent(co2Data, d => d.co2))
        .range([lineHeight, 0]);

    // ----- AXES -----
    svgLineLocal.append("g")
        .attr("transform", `translate(0, ${lineHeight})`)
        .call(d3.axisBottom(x).tickFormat(d3.format("d")));

    // EVI
    svgLineLocal.append("g")
        .call(d3.axisLeft(yLeft))
        .append("text")
        .attr("fill", "white")
        .attr("x", -40)
        .attr("y", -10);

    // Drought
    svgLineLocal.append("g")
        .attr("transform", `translate(${lineWidth}, 0)`)
        .call(d3.axisRight(yRight))
        .style("visibility", "hidden")
        .attr("class", "yAxisDrought")
        .append("text")
        .attr("fill", "white")
        .attr("x", 40)
        .attr("y", -10);

    // CO2
    svgLineLocal.append("g")
        .attr("class", "yAxisCO2")
        .attr("transform", `translate(${lineWidth}, 0)`)
        .call(d3.axisRight(yRightCO2))
        .style("visibility", "hidden")
        .append("text")
        .attr("fill", "white")
        .attr("x", 40)
        .attr("y", -10);

    // ----- LABELS -----
    // X-axis label
    svgLineLocal.append("text")
        .attr("class", "axis-label")
        .attr("x", lineWidth / 2)
        .attr("y", lineHeight + lineMargin.bottom - 5)
        .attr("text-anchor", "middle")
        .attr("fill", "white")
        .attr("font-size", 14)
        .text("Year");

    // Left Y-axis label
    svgLineLocal.append("text")
        .attr("class", "axis-label")
        .attr("transform", "rotate(-90)")
        .attr("x", -lineHeight / 2)
        .attr("y", -lineMargin.left + 15)
        .attr("text-anchor", "middle")
        .attr("fill", "white")
        .attr("font-size", 14)
        .text("Mean Vegetation Density (EVI)");

    // Right Y-axis label for Drought
    svgLineLocal.append("text")
        .attr("class", "yAxisLabelDrought")
        .attr("transform", "rotate(-90)")
        .attr("x", -lineHeight / 2)
        .attr("y", lineWidth + lineMargin.right - 55)
        .attr("text-anchor", "middle")
        .attr("fill", "#ffcc00")
        .attr("font-size", 14)
        .text("Drought Index (U.S. Total)")
        .style("visibility", "hidden"); // initially hidden

    // Right Y-axis label for CO2
    svgLineLocal.append("text")
        .attr("class", "yAxisLabelCO2")
        .attr("transform", "rotate(-90)")
        .attr("x", -lineHeight / 2)
        .attr("y", lineWidth + lineMargin.right - 45)
        .attr("text-anchor", "middle")
        .attr("fill", "#71ffd9ff")
        .attr("font-size", 14)
        .text("CO₂ Levels (U.S. Total)")
        .style("visibility", "hidden"); // initially hidden
        
    // ----- LINES -----
    // Split EVI, drought, and CO2 data to pre and post 2015
    const groupedPre2015 = grouped.filter(d => d.year <= 2015);
    const groupedPost2015 = grouped.filter(d => d.year >= 2015);

    const droughtPre2015 = droughtData.filter(d => d.year <= 2015);
    const droughtPost2015 = droughtData.filter(d => d.year >= 2015);

    const co2Pre2015 = co2Data.filter(d => d.year <= 2015);
    const co2Post2015 = co2Data.filter(d => d.year >= 2015);

    const eviLine = d3.line()
        .x(d => x(d.year))
        .y(d => yLeft(d.density));

    // EVI
    svgLineLocal.append("path")
        .datum(groupedPre2015)
        .attr("class", "evi-visible")
        .attr("fill", "none")
        .attr("stroke", "#47e664ff")
        .attr("stroke-width", 2)
        .attr("d", eviLine);

    if (groupedPost2015.length > 0) {
        svgLineLocal.append("path")
            .datum(groupedPost2015)
            .attr("class", "evi-visible-bold")
            .attr("fill", "none")
            .attr("stroke", "#47e664ff")
            .attr("stroke-width", 6)
            .attr("d", eviLine);
    }

    // Drought
    const droughtLine = d3.line()
        .x(d => x(d.year))
        .y(d => yRight(d.drought));

    svgLineLocal.append("path")
        .datum(droughtPre2015)
        .attr("class", "drought-line")
        .attr("fill", "none")
        .attr("stroke", "#ffcc00")
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "4 2")
        .style("visibility", "hidden")
        .attr("d", droughtLine);

    if (droughtPost2015.length > 0) {
        svgLineLocal.append("path")
            .datum(droughtPost2015)
            .attr("class", "drought-line")
            .attr("fill", "none")
            .attr("stroke", "#ffcc00")
            .attr("stroke-width", 6)
            .attr("stroke-dasharray", "4 2")
            .style("visibility", "hidden")
            .attr("d", droughtLine);
    }

    // CO2
    const co2Line = d3.line()
        .x(d => x(d.year))
        .y(d => yRightCO2(d.co2));

    svgLineLocal.append("path")
        .datum(co2Pre2015)
        .attr("class", "co2-line")
        .attr("fill", "none")
        .attr("stroke", "#71ffd9ff")
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "6 6")
        .style("visibility", "hidden")
        .attr("d", co2Line);

    if (co2Post2015.length > 0) {
        svgLineLocal.append("path")
            .datum(co2Post2015)
            .attr("class", "co2-line")
            .attr("fill", "none")
            .attr("stroke", "#71ffd9ff")
            .attr("stroke-width", 6)
            .attr("stroke-dasharray", "6 6")
            .style("visibility", "hidden")
            .attr("d", co2Line);
    }

    // Rectangle for tooltip functionality
    svgLineLocal.append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", lineWidth)
        .attr("height", lineHeight)
        .attr("fill", "transparent")
        .style("cursor", "crosshair")
        .on("mousemove", onOverlayMouseMove)
        .on("mouseleave", onOverlayMouseLeave);

    // Dotted tooltip line
    const hoverLine = svgLineLocal.append("line")
        .attr("class", "hover-line")
        .attr("y1", 0)
        .attr("y2", lineHeight)
        .attr("stroke", "white")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "4 4")
        .style("visibility", "hidden");

    // Plot title
    svgLineLocal.append("text")
        .attr("class", "plotTitle")
        .attr("x", lineWidth / 2)
        .attr("y", -5)
        .attr("text-anchor", "middle")
        .attr("font-size", "18px")
        .attr("font-weight", "bold")
        .attr("fill", "white")
        .text(
            selectedState === "US"
                ? "Mean Vegetation Density for the United States"
                : `Mean Vegetation Density for ${selectedState}`
        );

    // ----- CHECKBOX LOGIC -----
    d3.select(`#${droughtCheckboxId}`).on("change", function () {
        if (this.checked) {
            d3.select(`#${co2CheckboxId}`).property("checked", false);
            updateActiveLine({ active: "drought", selectedState, containerId });
        } else {
            updateActiveLine({ active: null, selectedState, containerId });
        }
    });

    d3.select(`#${co2CheckboxId}`).on("change", function () {
        if (this.checked) {
            d3.select(`#${droughtCheckboxId}`).property("checked", false);
            updateActiveLine({ active: "co2", selectedState, containerId });
        } else {
            updateActiveLine({ active: null, selectedState, containerId });
        }
    });

    // ----- LEGEND -----
    const legend = svgLineLocal.append("g")
        .attr("class", "legend")
        .attr("transform", "translate(0, 0)");

    // EVI legend
    const eviLegend = legend.append("g").attr("transform", "translate(0, 0)");

    eviLegend.append("line")
        .attr("x1", 0)
        .attr("x2", 20)
        .attr("y1", 15)
        .attr("y2", 15)
        .attr("stroke", "#47e664ff")
        .attr("stroke-width", 3)
        .attr("stroke-dasharray", "none");   

    eviLegend.append("text")
        .attr("x", 30)
        .attr("y", 20)
        .attr("fill", "white")
        .text("Vegetation Density");


    // Drought legend
    const droughtLegend = legend.append("g").attr("transform", "translate(0, 30)");

    droughtLegend.append("line")
        .attr("x1", 0)
        .attr("x2", 20)
        .attr("y1", 15)
        .attr("y2", 15)
        .attr("stroke", "#ffcc00")
        .attr("stroke-width", 3)
        .attr("stroke-dasharray", "4 2");   

    droughtLegend.append("text")
        .attr("x", 30)
        .attr("y", 20)
        .attr("fill", "white")
        .text("Drought Index (U.S. Total)");


    // CO2 legend
    const co2Legend = legend.append("g").attr("transform", "translate(0, 60)");

    co2Legend.append("line")
        .attr("x1", 0)
        .attr("x2", 20)
        .attr("y1", 15)
        .attr("y2", 15)
        .attr("stroke", "#71ffd9ff")
        .attr("stroke-width", 3)
        .attr("stroke-dasharray", "6 6");

    co2Legend.append("text")
        .attr("x", 30)
        .attr("y", 20)
        .attr("fill", "white")
        .text("CO₂ Levels (U.S. Total)");


    // ----- TOOLTIP -----
    const tooltip = d3.select(`#${tooltipId}`);

    function onOverlayMouseMove(event) {
        const [mouseX] = d3.pointer(event, this);
        const year = Math.round(x.invert(mouseX));

        // Snap to nearest EVI point 
        const closestEVI = grouped.reduce((a, b) =>
            Math.abs(b.year - year) < Math.abs(a.year - year) ? b : a
        );
        const cx = x(closestEVI.year);
        const cy = yLeft(closestEVI.density);

        // Show vertical line
        hoverLine.attr("x1", cx).attr("x2", cx).style("visibility", "visible");

        // Tooltip content
        let tooltipHTML = `
            <strong>Year:</strong> ${closestEVI.year}<br>
            <strong>EVI:</strong> ${closestEVI.density.toFixed(3)}
        `;

        if (activeLine === "drought") {
            const closestDrought = droughtData.reduce((a, b) =>
                Math.abs(b.year - year) < Math.abs(a.year - year) ? b : a
            );
            tooltipHTML += `<br><strong>Drought Index:</strong> ${closestDrought.drought.toFixed(3)}`;
        } else if (activeLine === "co2") {
            const closestCO2 = co2Data.reduce((a, b) =>
                Math.abs(b.year - year) < Math.abs(a.year - year) ? b : a
            );
            tooltipHTML += `<br><strong>CO₂ Levels:</strong> ${closestCO2.co2.toFixed(3)}`;
        }

        // Tooltip position slightly left of line
        const svgRect = svgLineLocal.node().getBoundingClientRect();
        let tooltipX = svgRect.left + cx - tooltip.node().offsetWidth + 50;
        let tooltipY = svgRect.top + cy + window.scrollY - 20;

        // Keep tooltip inside screen
        const th = tooltip.node().offsetHeight;
        const screenH = window.innerHeight;
        if (tooltipX < 8) tooltipX = 8;
        if (tooltipY + th > window.scrollY + screenH - 8) tooltipY = window.scrollY + screenH - th - 8;
        if (tooltipY < window.scrollY + 8) tooltipY = window.scrollY + 8;

        tooltip
            .style("visibility", "visible")
            .style("left", tooltipX + "px")
            .style("top", tooltipY + "px")
            .html(tooltipHTML);
    }

    function onOverlayMouseLeave() {
        tooltip.style("visibility", "hidden");
        hoverLine.style("visibility", "hidden");
    }

}

// Init
async function init() {
    const [percentChangeData, stateRefData, heatmapData, linePlotData, droughtData, co2Data] = await loadData();
    regionMaskData = stateRefData

    // Initial heatmap
    let currentYear = 2000;
    updateHeatMap(heatmapData, currentYear);

    // Prepping but applying an invisible map for later
    overlayMask = svg.append("rect")
    .attr("width", width)
    .attr("height", height)
    .attr("fill", "transparent")
    .attr("pointer-events", "none")
    .attr("class", "overlay-mask")
    .style("z-index", "10");

    // Update the mask visually if necessary
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
    // Listen for sliding
    timeSlider.addEventListener('input', updateTimeDisplay);
    
    timeSlider.value = "0"; // Show 2000-2004 initially
    updateTimeDisplay();
    
    // First line plot
    setupStateDropdown(linePlotData);
    document.getElementById("stateSelect").onchange = (e) => {
        // Reset checkboxes
        d3.select("#toggleDrought").property("checked", false);
        d3.select("#toggleCO2").property("checked", false);
        
        // redraw line plot
        renderLinePlot(linePlotData, e.target.value, droughtData, co2Data);
    };
    // Second line plot
    setupStateDropdown(linePlotData, "stateSelectExtended");
    document.getElementById("stateSelectExtended").onchange = (e) => {
        // Reset checkboxes
        d3.select("#toggleDroughtExtended").property("checked", false);
        d3.select("#toggleCO2Extended").property("checked", false);

        // redraw extended line plot for selected state
        renderLinePlot(linePlotData, e.target.value, droughtData, co2Data, 2000, 2022, "lineVizExtended", "lineTooltipExtended",
            "toggleDroughtExtended", "toggleCO2Extended");
    };

    // Initialize line plots
    renderLinePlot(linePlotData, "US", droughtData, co2Data);
    renderLinePlot(linePlotData, "US", droughtData, co2Data, 2000, 2022, "lineVizExtended", "lineTooltipExtended", 
        "toggleDroughtExtended","toggleCO2Extended");
}

init() 

