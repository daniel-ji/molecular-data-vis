import { Graph } from '@cosmograph/cosmos'
import * as d3 from "d3";
import './styles/index.scss'

// ----------- GLOBAL VARIABLES ------------
/** READING FILES */
// size of chunks to read from uploaded file
const CHUNK_SIZE = 1024 * 1024 * 10;

/** GRAPH DATA */
const data = {
    nodes: [],
    links: [],
}
// record if graph has updated while not in view
let updatedGraph = false;
// current graph / diagram / summary statistic being shown 
let graphCounter = 0;
// graph elements that can be switched between (also diagrams, summary statistics, etc.)
const graphElements = document.getElementsByClassName("graph-element");

/** PAIRWISE DISTANCES (LINKS) */
// Maximum threshold for pairwise distances to be added to map
const MAX_THRESHOLD = 0.05;
// Actual threshold for pairwise distances to be added to map (the user input)
let threshold = 0.015;
// array of all pairwise distances (links), parsed from uploaded file
const pairwiseDistances = [];

/** SEQUENCES (NODES) */
// a set of all nodes uploaded from the file, only changes when a new file is uploaded
const ALL_NODES = new Set();
// a map of all current nodes in the graph, mapped by ID to an object containing adjacentNodes
// TODO: this doesn't update with the cluster filters, should it? 
const dataNodesMap = new Map();
// extra demographic data, mapped by ID
const nodeDemoData = new Map();
// a map of demographic data categories to their type of value and a set of all possible values
const nodeDemoDataCategories = new Map();
// maximum number of node categories to show in the form (a sanity check to make sure the uploaded demographic data is valid)
const MAX_NODE_CATEGORIES = 25;

/** CLUSTERS */
// the type of cluster filtering that's currently being used: show all clusters, show clusters with a minimum number of nodes, or show x largest clusters
let clusterFilterType = "all";
// the minimum number of nodes a cluster must have to be shown
let clusterNodeMin = 0;
// the number of largest clusters to show
let maxClusterCount = 0;
// current cluster data
let clusterData;

/** FORM INTERFACE */
// number of steps in the form
const TOTAL_STEPS = 3;
// current step in the form
let stepCounter = 1;

// --- STEP 2 --- 
// auto zoom to fit view
let autoZoom = true;
// whether or not the threshold input value is valid
let thresholdValid = true;
// whether or not the cluster filter input value is valid
let clusterValid = false;

// ----------- COSMOGRAPH PARAMETERS ------------
const PAIRWISE_GRAPH_CANVAS = document.getElementById('pairwise-graph');
const PAIRWISE_GRAPH_CONFIG = {
    backgroundColor: "#ffffff",
    nodeColor: "#000000",
    nodeSize: 6,
    linkColor: "#a3a3a3",
    linkArrows: false,
    linkWidth: 0.2,
    linkVisibilityMinTransparency: 1,
    randomSeed: 0,
    events: {
        onClick: () => {
            autoZoom = false;
        },
        onZoomStart: (event, userDriven) => {
            if (userDriven) {
                autoZoom = false;
            }
        }
    },
    simulation: {
        repulsion: 2,
        repulsionFromMouse: 0,
        linkDistRandomVariationRange: [1, 1],
        scaleNodesOnZoom: true,
        friction: 1,
        linkDistance: 50,
        gravity: 0.2,
        decay: 100000,
        linkSpring: 0.1,
    }
}

// ----------- GENERAL DATA FUNCTIONS ------------
/**
 * Clears all data from the graph and resets all global variables
 */
const resetData = () => {
    // reset graph data
    data.nodes.length = 0;
    data.links.length = 0;
    updatedGraph = true;

    // reset link data
    pairwiseDistances.length = 0;

    // reset node data
    ALL_NODES.clear();
    dataNodesMap.clear();
    nodeDemoData.clear();
    nodeDemoDataCategories.clear();
}

/**
 * Updates the graph's displayed nodes and links based on the current threshold value and cluster filters.
 */
const updateData = () => {
    console.log("\n\n\n-------- UPDATING DATA -------- \n\n\n")
    log("Updating data...", true)
    updatedGraph = true;
    // clears currently shown nodes and links
    data.nodes = [];
    data.links = [];
    dataNodesMap.clear();
    // loops through all uploaded pairwise distances and adds links to data if below threshold
    for (let i = 0; i < pairwiseDistances.length; i++) {
        const link = pairwiseDistances[i];
        if (link.value < threshold) {
            // source node
            if (!dataNodesMap.has(link.source)) {
                dataNodesMap.set(link.source, {
                    adjacentNodes: new Set([link.target])
                });
            }

            // target node
            if (!dataNodesMap.has(link.target)) {
                dataNodesMap.set(link.target, {
                    adjacentNodes: new Set([link.source])
                });
            }

            // update source and target nodes' adjacentNodes set
            dataNodesMap.get(link.source).adjacentNodes.add(link.target);
            dataNodesMap.get(link.target).adjacentNodes.add(link.source);

            // add link to data
            data.links.push(link)
        }
    };

    // set nodes
    data.nodes = [...dataNodesMap.keys()].map(node => { return { id: node } })

    getClusterData();

    if (clusterFilterType === "all") {
        // do no filtering
    } else if (clusterFilterType === "clusterNodeMin" || clusterFilterType === "maxClusterCount") {
        log("Filtering clusters...")
        const filteredNodes = [];
        let filteredNodesSet = new Set();

        // filter out clusters with less than clusterNodeMin nodes
        if (clusterFilterType === "clusterNodeMin") {
            for (let i = 0; i < clusterData.clusters.length; i++) {
                if (clusterData.clusters[i].size >= clusterNodeMin) {
                    filteredNodes.push(...clusterData.clusters[i])
                }
            }
            // only keep the largest maxClusterCount clusters
        } else {
            clusterData.clusters.sort((a, b) => b.size - a.size)
            for (let i = 0; i < maxClusterCount; i++) {
                filteredNodes.push(...clusterData.clusters[i])
            }
        }

        filteredNodesSet = new Set(filteredNodes);

        // filter out links that do not connect to filtered nodes
        const filteredLinks = []
        for (let i = 0; i < data.links.length; i++) {
            const link = data.links[i];
            if (filteredNodesSet.has(link.source) && filteredNodesSet.has(link.target)) {
                filteredLinks.push(link)
            }
        }

        // set data to filtered nodes and links
        data.nodes = filteredNodes.map(node => ({ id: node }));
        data.links = filteredLinks;

        // update dataNodesMap
        dataNodesMap.clear();
        for (let i = 0; i < data.links.length; i++) {
            const source = data.links[i].source;
            const target = data.links[i].target;

            if (!dataNodesMap.has(source)) {
                dataNodesMap.set(source, {
                    adjacentNodes: new Set([target])
                });
            }

            if (!dataNodesMap.has(target)) {
                dataNodesMap.set(target, {
                    adjacentNodes: new Set([source])
                });
            }

            dataNodesMap.get(source).adjacentNodes.add(target);
            dataNodesMap.get(target).adjacentNodes.add(source);
        }

        log("Done filtering clusters...")
        getClusterData();
    }

    log("Setting graph data...")
    PAIRWISE_GRAPH.setData(data.nodes, data.links)
    log("Done setting graph data...")
    // auto zoom after a delay (wait for nodes to finish rendering)
    setTimeout(() => {
        autoZoom && PAIRWISE_GRAPH.fitView()
    }, 1500)

    // generate other diagrams
    generateSummaryStatistics()
    generateHistogram()
    generateClusterGraph()
    log("Done generating other diagrams (done updating data)...")
}

// ----------- TOGGLE GRAPH ELEMENTS (switch between different diagrams) ------------
// NOTE: 0-indexed

// go back and forth between different graph elements
document.getElementById("graph-arrow-left").addEventListener("click", () => {
    // change graph
    graphCounter = (graphCounter - 1) % graphElements.length;
    updateGraphElement();
})
document.getElementById("graph-arrow-right").addEventListener("click", () => {
    // change graph
    graphCounter = (graphCounter + 1) % graphElements.length;
    updateGraphElement();
})

/**
 * Helper function to update the graph element being shown
 */
const updateGraphElement = () => {
    // hide all graph elements and show the current one
    for (let i = 0; i < graphElements.length; i++) {
        graphElements[i].classList.add('d-none')
    }
    graphElements[graphCounter].classList.remove('d-none')

    // update cluster graph if necessary
    if (updatedGraph && graphCounter === 0) {
        setTimeout(() => {
            PAIRWISE_GRAPH.fitView()
            updatedGraph = false;
        }, 250)
    }

    // update label
    document.getElementById('footer-label').innerHTML = 'Figure ' + (graphCounter + 1) + ' of ' + graphElements.length;
}

// ----------- FORM BACK AND FORTH BUTTONS ------------
// NOTE: 1-indexed
document.getElementById("step-back").addEventListener("click", () => {
    if (stepCounter === 1) {
        return;
    }
    stepCounter--;
    updateForm();
})

document.getElementById("step-next").addEventListener("click", () => {
    if (stepCounter === TOTAL_STEPS) {
        return;
    }
    stepCounter++;
    updateForm();
})

/**
 * Helper function to update the form step being shown
 */
const updateForm = () => {
    // hide all form steps and show the current one
    for (let i = 1; i <= TOTAL_STEPS; i++) {
        document.getElementById("input-step-" + i).classList.add("d-none");
    }
    document.getElementById("input-step-" + stepCounter).classList.remove("d-none");

    // update back and forth buttons' display based on current step
    if (stepCounter === 1) {
        document.getElementById("step-back").classList.add("invisible");
    } else {
        document.getElementById("step-back").classList.remove("invisible");
    }
    if (stepCounter === TOTAL_STEPS) {
        document.getElementById("step-next").classList.add("invisible");
    } else {
        document.getElementById("step-next").classList.remove("invisible");
    }
}

// ----------- FILE UPLOAD EVENT HANDLERS ------------
document.getElementById("upload-pairwise-file").addEventListener("click", () => {
    document.getElementById("upload-pairwise-file").value = "";
    document.getElementById("upload-success").classList.add("d-none");
})

document.getElementById("upload-data-file").addEventListener("click", () => {
    document.getElementById("upload-data-file").value = "";
    document.getElementById("upload-success").classList.add("d-none");
})

document.getElementById("upload-pairwise-file").addEventListener("change", () => {
    document.getElementById("upload-success").innerHTML = "";
})

document.getElementById("upload-data-file").addEventListener("change", () => {
    document.getElementById("upload-success").innerHTML = "";
})

// Submit button for uploading data file
document.getElementById("read-file").addEventListener("click", async () => {
    if (!document.getElementById("upload-pairwise-file").files[0]) {
        alert("Please select a file.");
        return;
    }

    // update status
    document.getElementById("upload-success").classList.remove("d-none");
    document.getElementById("upload-success").innerHTML = "Loading...";

    // reset data, get node demographic data, and get pairwise distances (actual node / link data)
    resetData();
    getNodeDemoData();
    await getPairwiseDistances();

    // update graph after getting data
    updateData();
    PAIRWISE_GRAPH_CANVAS.style.display = "block";

    // update status
    document.getElementById("upload-success").style.display = "block";
    document.getElementById("upload-success").innerHTML = "Done!"
})

// ----------- SEQUENCE (nodes) AND PAIRWISE DISTANCE (links) PARSING ------------
/**
 * Reads the uploaded data file and updates global variables with the node and link node data (not demographic data, but actual data)
 */
const getPairwiseDistances = async () => {
    const file = document.getElementById("upload-pairwise-file").files[0];
    console.log("\n\n\n-------- READING FILE -------- \n\n\n")
    log("Reading file...", true)

    const array = await readFileAsync(file);
    log("Done reading file...")

    const decoder = new TextDecoder("utf-8");
    // for when the chunk_size split doesn't match a full line
    let splitString = "";

    log("Parsing file...", true)
    // iterate over the file in chunks, readAsText can't read the entire file 
    for (let i = 0; i < array.byteLength; i += CHUNK_SIZE) {
        // get chunk and decode it
        const text = decoder.decode(array.slice(i, i + CHUNK_SIZE));
        const lines = text.split("\n")
        for (let j = 0; j < lines.length; ++j) {
            // line represents a single pairwise distance entry
            let line = lines[j];
            // split line into data entry columns
            let columns = line.split("\t");

            // edge case: very first line of file (header line)
            if (i === 0 && j === 0) {
                continue;
            }

            // edge case: first line is split (part of the line is in the previous chunk)
            if (j === 0 && columns.length < 3) {
                // add it to the splitString and reset split string
                line = splitString + line;
                splitString = "";
                columns = line.split("\t")
            }

            // edge case: last line is split (part of the line is in the next chunk)
            if (j === lines.length - 1 && lines[j].length > 0) {
                // set the splitString to the last line
                splitString = line;
                continue;
            }

            // add to map of all pairwise distances if below threshold
            if (parseFloat(columns[2]) < MAX_THRESHOLD) {
                pairwiseDistances.push({
                    source: columns[0],
                    target: columns[1],
                    value: parseFloat(columns[2]),
                })
            }

            // skip empty lines / lines with missing data
            if (columns[0] === undefined || columns[0] === "" || columns[1] === undefined || columns[1] === "") {
                continue;
            }

            // add nodes to set of all nodes
            ALL_NODES.add(columns[0]);
            ALL_NODES.add(columns[1]);
        }
    }

    log("Done parsing file...")
}

// helper function to promise-fy file read and make it awaitable 
const readFileAsync = async (file, asText = false) => {
    const reader = new FileReader();
    return new Promise((resolve, reject) => {
        reader.onload = (e) => {
            resolve(e.target.result);
        };
        reader.onerror = reject;
        asText ? reader.readAsText(file) : reader.readAsArrayBuffer(file);
    })
}

// ----------- CLUSTER GENERATION ------------
/**
 * Creates cluster data from the pairwise distance data by using a BFS to find all nodes within a cluster
 */
const getClusterData = () => {
    log("Generating clusters...")
    // list of current nodes on graph, a list of ids (strings) 
    const nodes = new Set(dataNodesMap.keys());
    // array of clusters, each cluster is a set of ids (strings)
    const clusters = [];
    // array of cluster sizes
    const clusterSizes = [];
    // map of cluster size to number of clusters of that size
    const clusterDistribution = new Map();

    // iterate over all nodes, perform BFS
    let nodesIterator = nodes.values();
    while (nodes.size > 0) {
        const cluster = new Set();
        // get first node in set (id string)
        const starterNode = nodesIterator.next().value;
        cluster.add(starterNode);
        nodes.delete(starterNode)
        // queue of nodes to visit, which are id strings
        // each key in dataNodesMap points to a node object, which has an adjacentNodes property that is a list of id strings
        const queue = [...(dataNodesMap.get(starterNode).adjacentNodes)];
        while (queue.length > 0) {
            const node = queue.pop();
            if (!cluster.has(node)) {
                cluster.add(node);
                nodes.delete(node);
                queue.push(...(dataNodesMap.get(node).adjacentNodes));
            }
        }

        // update cluster data
        clusters.push(cluster);
        clusterSizes.push(cluster.size);
        clusterDistribution.set(cluster.size, (clusterDistribution.get(cluster.size) || 0) + 1);
    }

    log("Done generating clusters...")
    clusterData = { clusters, clusterSizes, clusterDistribution };
}

// ----------- CLUSTER GRAPH GENERATION ------------
const generateClusterGraph = () => {

}

// ----------- HISTOGRAM GENERATION ------------
const generateHistogram = () => {
    if (clusterData.clusterSizes.length === 0) {
        return;
    }

    // set the dimensions and margins of the graph
    const graphWidth = document.body.clientWidth * 0.7;
    const graphHeight = document.body.clientHeight;
    const margin = { top: graphHeight * 0.15, right: graphWidth * 0.15, bottom: graphHeight * 0.15, left: graphWidth * 0.2 }
    const width = document.body.clientWidth * 0.7 - margin.left - margin.right;
    const height = graphHeight - margin.top - margin.bottom;

    // remove old svg
    document.getElementById("cluster-histogram").innerHTML = "";

    // append the svg object to the body of the page
    const svg = d3.select("#cluster-histogram")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform",
            `translate(${margin.left},${margin.top})`);

    // X axis: scale and draw:
    const x = d3.scaleLinear()
        .domain([0, Math.max(...clusterData.clusterSizes) * 1.05])
        .range([0, width]);
    svg.append("g")
        .attr("transform", `translate(0, ${height})`)
        .call(d3.axisBottom(x));

    // X axis label:
    svg.append("text")
        .attr("class", "x label")
        .attr("text-anchor", "middle")
        .attr("x", width / 2)
        .attr("y", height + 40)
        .text("Cluster size");

    // set the parameters for the histogram
    const histogram = d3.bin()
        .domain(x.domain())  // then the domain of the graphic
        .thresholds(x.ticks(50)); // then the numbers of bins
    // TODO: make bins editable

    // And apply this function to data to get the bins
    const bins = histogram(clusterData.clusterSizes);

    // Y axis: scale and draw:
    const y = d3.scaleLinear()
        .range([height, 0]);
    y.domain([0, d3.max(bins, function (d) { return d.length; })]);
    svg.append("g")
        .call(d3.axisLeft(y));

    // Y axis label
    svg.append("text")
        .attr("class", "y label")
        .attr("text-anchor", "middle")
        .attr("y", -50)
        .attr("x", -height / 2)
        .attr("dy", ".75em")
        .attr("transform", "rotate(-90)")
        .text("Frequency");

    // append the bar rectangles to the svg element
    svg.selectAll("rect")
        .data(bins)
        .join("rect")
        .attr("x", 1)
        .attr("transform", function (d) { return `translate(${x(d.x0)} , ${y(d.length)})` })
        .attr("width", function (d) { return x(d.x1) - x(d.x0) < 1 ? 0 : x(d.x1) - x(d.x0) - 2 })
        .attr("height", function (d) { return height - y(d.length); })
        .style("fill", "#0D6EFD")

    svg.selectAll(".text")
        .data(bins)
        .enter()
        .append("text")
        .attr("class", "label")
        .attr("text-anchor", "middle")
        .attr("font-size", "12px")
        .attr("x", (function (d) { return (x(d.x1) + x(d.x0)) / 2 }))
        .attr("y", function (d) { return y(d.length) - 12; })
        .text(d => d.length > 0 ? d.length : null);
}

// ---------- SUMMARY STATISTICS GENERATION ------------
const generateSummaryStatistics = () => {
    // sort cluster sizes to get median
    clusterData.clusterSizes.sort((a, b) => a - b);

    document.getElementById("summary-node-count").innerHTML = data.nodes.length;
    document.getElementById("summary-singleton-count").innerHTML = ALL_NODES.size - data.nodes.length;
    document.getElementById("summary-edge-count").innerHTML = data.links.length;
    document.getElementById("summary-cluster-count").innerHTML = clusterData.clusters.length;
    document.getElementById("summary-cluster-mean").innerHTML = (clusterData.clusterSizes.reduce((a, b) => a + b, 0) / clusterData.clusterSizes.length).toFixed(2);
    document.getElementById("summary-cluster-median").innerHTML = clusterData.clusterSizes[Math.floor(clusterData.clusterSizes.length / 2)];
}

// ----------- GET NODE DEMOGRAPHIC (SUPPLEMENTARY) DATA ------------
const getNodeDemoData = async () => {
    const file = document.getElementById("upload-data-file").files[0];

    // validation
    if (!file) {
        return;
    }
    if (!(file.name.endsWith(".tsv") || file.name.endsWith(".csv"))) {
        alert("Invalid supplementary data file.")
        return;
    }

    // read file and define delimiter 
    const text = await readFileAsync(file, true)
    const delimiter = file.name.endsWith(".csv") ? "," : "\t";

    const lines = text.split("\n")
    lines[0] = lines[0].toUpperCase();
    // first line is categories
    const categories = lines[0].split(delimiter);
    // create new category for each column
    for (let i = 0; i < categories.length; i++) {
        nodeDemoDataCategories.set(categories[i], { type: 'number', elements: new Set() })
    }

    // edge case to remove empty line at end of file
    if (lines[lines.length - 1] === "") {
        lines.pop();
    }

    // validation by checking number of data entry columns
    if (nodeDemoDataCategories.size < 2 || nodeDemoDataCategories.size > MAX_NODE_CATEGORIES) {
        alert("Invalid supplementary data file.")
        return;
    }

    log("Parsing node supplementary data...")

    // create node demographic data
    for (let i = 1; i < lines.length; i++) {
        const dataEntry = lines[i].split(delimiter);
        // validation by checking if number of data entry columns matches number of categories
        if (dataEntry.length !== nodeDemoDataCategories.size) {
            alert("Invalid supplementary data file.")
            return;
        }

        // create object for each data entry, corresponds to a node
        const dataEntryObject = {};

        for (let j = 1; j < categories.length; j++) {
            if (isNaN(dataEntry[j])) {
                nodeDemoDataCategories.get(categories[j]).type = 'string';
            }

            if (nodeDemoDataCategories.get(categories[j]).type === 'string') {
                dataEntryObject[categories[j]] = dataEntry[j];
                nodeDemoDataCategories.get(categories[j]).elements.add(dataEntry[j])
            } else {
                dataEntryObject[categories[j]] = parseFloat(dataEntry[j]);
                nodeDemoDataCategories.get(categories[j]).elements.add(parseFloat(dataEntry[j]))
            }
        }

        // add data entry to node demographic data
        nodeDemoData.set(dataEntry[0], dataEntryObject)
    }

    // generate HTML elements for filters
    generateNodeFilters();

    log("Done parsing node supplementary data...")
}

/**
 * Generates HTML elements for node filters, one per category.
 */
const generateNodeFilters = () => {
    const categories = [...nodeDemoDataCategories.keys()];
    const container = document.getElementById("filters-container");
    container.innerHTML = "";
    // loop through each category
    for (let i = 1; i < categories.length; i++) {
        const filter = document.createElement("div");
        filter.classList.add("pairwise-filter", "mb-3", "w-100");

        // create label
        const label = document.createElement("label");
        label.htmlFor = "filter-select-" + categories[i];
        label.classList.add("form-label", "w-100", "text-center");
        label.innerHTML = "View by " + categories[i].toLowerCase() + ": ";

        // create select input
        const select = document.createElement("select");
        select.id = "filter-select-" + categories[i];
        select.classList.add("form-select");

        // add default option 
        const defaultOption = document.createElement("option");
        defaultOption.selected = true;
        defaultOption.innerHTML = "All";
        select.appendChild(defaultOption);

        // add options for each possible value
        const values = [...nodeDemoDataCategories.get(categories[i]).elements];
        if (nodeDemoDataCategories.get(categories[i]).type === 'number') {
            values.sort((a, b) => a - b);
            // create default 10 options for each range of values
            const min = values[0];
            const max = values[values.length - 1];
            const step = (max - min) / 10;
            for (let j = min; j <= max; j += step) {
                const option = document.createElement("option");
                option.innerHTML = j.toFixed(2) + " - " + (j + step).toFixed(2);
                option.value = j.toFixed(2) + " - " + (j + step).toFixed(2);
                select.appendChild(option);
            }
        } else {
            values.sort();
            // make "other" last value
            const otherIndex = values.map(string => string.toLowerCase()).indexOf("other");
            if (otherIndex !== -1) {
                const otherText = values.splice(otherIndex, 1);
                values.push(otherText);
            }

            for (let j = 0; j < values.length; j++) {
                const option = document.createElement("option");
                option.innerHTML = values[j];
                option.value = values[j];
                select.appendChild(option);
            }
        }

        // append everything
        filter.appendChild(label);
        filter.appendChild(select);
        container.appendChild(filter);

    }
}

// ----------- THRESHOLD SLIDER HANDLING ------------

// threshold slider input handling, checks if input is valid and updates threshold if so
document.getElementById("threshold-select").addEventListener("input", (e) => {
    threshold = parseFloat(e.target.value);
    thresholdValid = !isNaN(threshold) && threshold >= 0 && threshold <= MAX_THRESHOLD;
    if (thresholdValid) {
        document.getElementById("threshold-select").classList.remove('is-invalid')
        updateThresholdLabel();
    } else {
        document.getElementById("threshold-select").classList.add('is-invalid')
    }
})

const updateThresholdLabel = () => {
    document.getElementById("threshold-label").innerHTML = "Pairwise Distance Threshold Level: " + threshold.toFixed(4);
}

// ----------- CLUSTER FILTERS ------------
// cluster filter type select input handling
document.getElementById("cluster-filter-select").addEventListener("change", () => {
    clusterFilterType = document.getElementById("cluster-filter-select").value;
    if (clusterFilterType === "clusterNodeMin") {
        document.getElementById("cluster-filter-value").classList.remove("d-none");
        document.getElementById("cluster-filter-value").value = "";
        // TODO: Singletons not getting shown so...
        clusterNodeMin = 0;
    } else if (clusterFilterType === "maxClusterCount") {
        document.getElementById("cluster-filter-value").classList.remove("d-none");
        document.getElementById("cluster-filter-value").value = "";
        maxClusterCount = 0;
    } else {
        document.getElementById("cluster-filter-value").classList.add("d-none");
    }
})

// cluster filter value input handling
document.getElementById("cluster-filter-value").addEventListener("input", () => {
    // check if value is valid and returns if invalid
    checkClusterValueValid()
    if (!clusterValid) {
        return;
    }

    // update cluster filter value
    const value = document.getElementById("cluster-filter-value").value;
    if (clusterFilterType === "clusterNodeMin") {
        clusterNodeMin = value;
    } else if (clusterFilterType === "maxClusterCount") {
        maxClusterCount = value;
    }
})

/**
 * Checks if the cluster filter value is valid and updates the clusterValid variable and DOM.
 */
const checkClusterValueValid = () => {
    if (clusterFilterType === "all") {
        clusterValid = true;
    } else {
        const value = document.getElementById("cluster-filter-value").value;
        if (isNaN(value) || value < 0 || !Number.isInteger(parseInt(value))) {
            document.getElementById("cluster-filter-value").classList.add("is-invalid");
            clusterValid = false;
        } else if (value === "") {
            // do nothing
            clusterValid = false;
        } else {
            document.getElementById("cluster-filter-value").classList.remove("is-invalid");
            clusterValid = true;
        }
    }
}

// ----------- UPDATE BUTTON ------------
// timeout to clear status message
let filterStatusTimeout;

// update button click handling, checks if inputs are valid and updates graph if so
document.getElementById("filter-update").addEventListener("click", () => {
    if (!thresholdValid) {
        document.getElementById("threshold-select").classList.add("is-invalid");
    } else {
        document.getElementById("threshold-select").classList.remove("is-invalid");
    }

    checkClusterValueValid();
    if (!clusterValid) {
        document.getElementById("cluster-filter-value").classList.add("is-invalid");
    } else {
        document.getElementById("cluster-filter-value").classList.remove("is-invalid");
    }

    if (thresholdValid && clusterValid) {
        document.getElementById("filter-update-status").classList.remove("d-none");
        document.getElementById("filter-update-status").innerHTML = "Graph updated!";
        updateData();
        clearTimeout(filterStatusTimeout)
        filterStatusTimeout = setTimeout(() => {
            document.getElementById("filter-update-status").classList.add("d-none");
        }, 5000)
    }
})


// ----------- GRAPH INTERACTION  ------------
document.getElementById("zoom-to-fit").addEventListener("click", () => {
    PAIRWISE_GRAPH.fitView();
})

// ----------- PERFORMANCE LOGGING ------------ 
let basetime = performance.now();

const log = (message, reset = false) => {
    if (reset) {
        basetime = performance.now();
    }
    console.log(message + "\n" + "Time: " + (performance.now() - basetime) + "ms");
}

// ----------- INITIALIZATION ------------
// create new graph and hide it until user uploads a file
const PAIRWISE_GRAPH = new Graph(PAIRWISE_GRAPH_CANVAS, PAIRWISE_GRAPH_CONFIG);
PAIRWISE_GRAPH_CANVAS.style.display = "none";
// update threshold label
document.getElementById("threshold-label").innerHTML = "Pairwise Distance Threshold Level: " + threshold.toFixed(4);
// show first graph element
document.getElementById('graph-element-0').classList.remove('d-none')
updateGraphElement();
// update form step
updateForm();
updateThresholdLabel();