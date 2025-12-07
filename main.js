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
    const percentChangeData = await d3.csv('data/5YearPercentChange_ByRegion.csv', (row) => ({
        startYear: +row.startYear,
        endYear: +row.endYear,
        region: +row.region,
        incPerc: +row.increase_percent,
        decPerc: +row.decrease_percent,
        stablPerc: +row.stable_percent
    }));

    const heatmapData = await d3.csv('data/heatmapDataWithState.csv', (row) => ({
        ...row,
        year: +row.year,
        x: +row.x,
        y: +row.y,
        value: +row.mean_evi,
        state: +row.state
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

    return [heatmapData, linePlotData, droughtData, co2Data];
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
        .text(`${startYear+4} vs ${startYear}`);
}

function updateHeatMap(data, startYear) {
    console.log("updateHeatMap called with startYear:", startYear);
    console.log("Available years in data:", [...new Set(data.map(d => d.year))].sort());
    
    svg.selectAll("rect").remove();
    const startData = data.filter(d => d.year == startYear);
    const endData   = data.filter(d => d.year == startYear + 4);
    
    console.log("startData length:", startData.length);
    console.log("endData length:", endData.length);
    
    const startMap = new Map(startData.map(d => [`${d.x},${d.y}`, d.value]));
    const endMap   = new Map(endData.map(d => [`${d.x},${d.y}`, d.value]));

    const allKeys = new Set([...startMap.keys(), ...endMap.keys()]);
    console.log("Total keys to process:", allKeys.size);

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

    // More intuitive thresholds for 0-1 normalized data
    // These thresholds give you 5 clear categories
    const thresholds = [-0.2, -0.05, 0.05, 0.2];
    
    // Distinct, intuitive color scheme
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

var lineMargin = {top: 30, right: 40, bottom: 30, left: 40},
    lineWidth = 960 - lineMargin.left - lineMargin.right,
    lineHeight = 500 - lineMargin.top - lineMargin.bottom;

var svgLine = d3.select('#lineViz')
    .append("svg")
    .attr("width", lineWidth + lineMargin.left + lineMargin.right)
    .attr("height", lineHeight + lineMargin.top + lineMargin.bottom)
    .append("g")
    .attr("transform", "translate(" + lineMargin.left + "," + lineMargin.top + ")");

let activeLine = null;

function updateActiveLine({ active, selectedState }) {
    activeLine = active;

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
                ? "Mean Vegetation Density and Drought Index for the United States"
                : `Mean Vegetation Density and Drought Index for ${selectedState}`
        );
    }

    // Case 2: CO₂ ON
    else if (active === "co2") {
        d3.selectAll(".co2-line").style("visibility", "visible");
        d3.select(".yAxisCO2").style("visibility", "visible");

        title.text(
            selectedState === "US"
                ? "Mean Vegetation Density and CO₂ Levels for the United States"
                : `Mean Vegetation Density and CO₂ Levels for ${selectedState}`
        );
    }

    // Case 3: Neither ON
    else {
        title.text(
            selectedState === "US"
                ? "Mean Vegetation Density for the United States"
                : `Mean Vegetation Density for ${selectedState}`
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
    grouped = grouped.filter(d => d.year >= 2000 && d.year <= 2015);
    droughtData = droughtData.filter(d => d.year >= 2000 && d.year <= 2015);
    co2Data = co2Data.filter(d => d.year >= 2000 && d.year <= 2015);

    // ----- SCALES -----
    // X scale (restricted to 2000–2015)
    const x = d3.scaleLinear()
        .domain([2000, 2015])
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
    svgLine.append("g")
        .attr("transform", `translate(0, ${lineHeight})`)
        .call(d3.axisBottom(x).tickFormat(d3.format("d")));

    // EVI
    svgLine.append("g")
        .call(d3.axisLeft(yLeft))
        .append("text")
        .attr("fill", "white")
        .attr("x", -40)
        .attr("y", -10)
        .text("Mean Vegetation Density");

    // drought
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

    // CO2
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
    const eviLine = d3.line()
        .x(d => x(d.year))
        .y(d => yLeft(d.density));

    // Visible EVI line
    svgLine.append("path")
        .datum(grouped)
        .attr("class", "evi-visible")
        .attr("fill", "none")
        .attr("stroke", "#47e664ff")
        .attr("stroke-width", 2)
        .attr("d", eviLine);

    const overlay = svgLine.append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", lineWidth)
        .attr("height", lineHeight)
        .attr("fill", "transparent")
        .style("cursor", "crosshair")
        .on("mousemove", onOverlayMouseMove)
        .on("mouseleave", onOverlayMouseLeave);

    // Dotted tooltip line
    const hoverLine = svgLine.append("line")
        .attr("class", "hover-line")
        .attr("y1", 0)
        .attr("y2", lineHeight)
        .attr("stroke", "white")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "4 4")
        .style("visibility", "hidden");

    // Drought line
    svgLine.append("path")
        .datum(droughtData)
        .attr("class", "drought-line")
        .attr("fill", "none")
        .attr("stroke", "#ffcc00")
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "4 2")
        .attr("d", d3.line()
            .x(d => x(d.year))
            .y(d => yRight(d.drought))
        )
        .style("visibility", "hidden");

    // CO2 line
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
    d3.select("#toggleDrought").on("change", function () {
        if (this.checked) {
            d3.select("#toggleCO2").property("checked", false);
            updateActiveLine({ active: "drought", selectedState });
        } else {
            updateActiveLine({ active: null, selectedState });
        }
    });

    d3.select("#toggleCO2").on("change", function () {
        if (this.checked) {
            d3.select("#toggleDrought").property("checked", false);
            updateActiveLine({ active: "co2", selectedState });
        } else {
            updateActiveLine({ active: null, selectedState });
        }
    });

    // ----- LEGEND -----
    svgLine.append("circle").attr("cx", 10).attr("cy", 20).attr("r", 6).style("fill", "#47e664ff");
    svgLine.append("text").attr("x", 25).attr("y", 25).text("Vegetation Density").attr("fill", "white");

    svgLine.append("circle").attr("cx", 10).attr("cy", 45).attr("r", 6).style("fill", "#ffcc00");
    svgLine.append("text").attr("x", 25).attr("y", 50).text("Drought Index").attr("fill", "white");

    svgLine.append("circle").attr("cx", 10).attr("cy", 70).attr("r", 6).style("fill", "#71ffd9ff");
    svgLine.append("text").attr("x", 25).attr("y", 75).text("CO₂ Levels").attr("fill", "white");

    // ----- TOOLTIP -----
    const tooltip = d3.select("#lineTooltip");

    function onOverlayMouseMove(event) {
        const [mouseX] = d3.pointer(event, this);
        const year = Math.round(x.invert(mouseX));

        // --- Snap to nearest EVI point ---
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
        const svgRect = svgLine.node().getBoundingClientRect();
        let tooltipX = svgRect.left + cx - tooltip.node().offsetWidth + 130;
        let tooltipY = svgRect.top + cy + window.scrollY - 20;

        // Keep tooltip inside screen
        const tw = tooltip.node().offsetWidth;
        const th = tooltip.node().offsetHeight;
        const screenW = window.innerWidth;
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
    const [heatmapData, linePlotData, droughtData, co2Data] = await loadData();

    let currentYear = 2000;

    // Initial heatmap
    updateHeatMap(heatmapData, currentYear);

    const timeSlider = document.getElementById('time-slider');
    const selectedTime = document.getElementById("selected-Year-Range");
    const anyTimeLabel = document.getElementById('any-time');

    function updateTimeDisplay(){
        let timeFilter = Number(timeSlider.value);
        
        if (timeFilter === -1){
            selectedTime.textContent = '';
            anyTimeLabel.style.display = 'block';
        }
        else {
            currentYear = 2000 + timeFilter*5; // Update the current year
            
            selectedTime.textContent = `${currentYear}-${currentYear + 4}`;
            anyTimeLabel.style.display = 'none';
            
            // Update heatmap with current year
            updateHeatMap(heatmapData, currentYear);
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

