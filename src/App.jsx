import React, { Component } from 'react'

import DiagramsContainer from './components/diagrams/DiagramsContainer'
import ClusterGraph from './components/diagrams/graphs/ClusterGraph'
import NodesGraph from './components/diagrams/graphs/NodesGraph'
import ClusterHistogram from './components/diagrams/histograms/ClusterHistogram'
import SummaryStats from './components/diagrams/stats/SummaryStats'

import FormContainer from './components/form/FormContainer'

import './App.scss'

import { DEFAULT_DATA, LOG, NODE_GRAPH_CANVAS_ID, NODE_GRAPH_BASE_CONFIG, CALCULATE_ASSORT_PY, DIAGRAMS_COUNT } from './constants';
import { Graph } from '@cosmograph/cosmos'

export class App extends Component {
	constructor(props) {
		super(props)

		this.state = {
			/** PAIRWISE DISTANCE DATA / STATS */
			data: DEFAULT_DATA,
			/** DIAGRAMS DATA */
			diagramCounter: 0,
			nodeGraph: undefined,
			clusterHistogram: {
				histogramTicks: 0,
				maxHistogramTicks: 0,
			},
			/** PYODIDE */
			pyodide: undefined,
			CALCULATE_STATS_PYTHON_CODE: undefined,
			/** FORM DATA */
			threshold: 0.015,
			thresholdValid: true,
			selectingCluster: false,
			selectedClusterIndex: undefined,
		}
	}

	async componentDidMount() {
		// add event listeners to cosmograph config 
		const nodeGraphConfig = {
			...NODE_GRAPH_BASE_CONFIG,
			events: {
				// when selecting a cluster, highlight all nodes in the cluster on hover
				onNodeMouseOver: (node, index) => {
					if (!this.state.selectingCluster) {
						return;
					}

					// find the cluster that the node belongs to and highlight all nodes in that cluster 
					for (const clusterObj of this.state.data.clusterData.clusters) {
						if (clusterObj.clusterNodes.has(node.id)) {
							const selectedNodes = [...clusterObj.clusterNodes.values()];
							this.state.nodeGraph.selectNodesByIds(selectedNodes);
						}
					}
				},
				// select a cluster on click 
				onClick: (node, index) => {
					if (!this.state.selectingCluster || node === undefined) {
						return;
					}

					this.setState({ selectingCluster: false })
					// find the cluster that the node belongs to and set that cluster as the selected cluster 
					for (let i = 0; i < this.state.data.clusterData.clusters.length; i++) {
						const clusterObj = this.state.data.clusterData.clusters[i];
						if (clusterObj.clusterNodes.has(node.id)) {
							this.setSelectedCluster(i);
							break;
						}
					}
				}
			}
		}

		// initialize cosmograph
		this.setState({ nodeGraph: new Graph(document.getElementById(NODE_GRAPH_CANVAS_ID), nodeGraphConfig) }, this.updateNodesGraph)

		// this.setState({ pyodide: await window.loadPyodide() }, async () => {
		// 	await this.state.pyodide.loadPackage('networkx');
		// 	await this.state.pyodide.loadPackage("scipy");
		// })

		// load python code for calculating stats
		// this.setState({ CALCULATE_STATS_PYTHON_CODE: await (await fetch(CALCULATE_ASSORT_PY)).text() })
	}

	/**
	 * Set pairwise distance data. 
	 * 
	 * @param {*} newData New data to set (a property of the data object, see constants.js)
	 * @param {*} callback 
	 */
	setData = (newData, callback) => {
		this.setState((prevState) => { return { data: { ...prevState.data, ...newData } } }, callback);
	}

	/**
	 * Set cluster histogram data, corresponding to the Cluster Histogram diagram. 
	 * 
	 * @param {*} newData New data to set (a property of the clusterHistogram object, see component state object above)
	 * @param {*} callback 
	 */
	setClusterHistogramData = (newData, callback) => {
		this.setState((prevState) => { return { clusterHistogram: { ...prevState.clusterHistogram, ...newData } } }, callback);
	}

	/**
	 * Set the intervals for a given quantitative demographic data category.
	 * @param {*} key Demographic data category to modify, corresponds to name of category as uploaded in the demographic data file. 
	 * @param {*} intervals new intervals to set, a list of objects with keys "interval" and "valid"
	 */
	setIntervals = (key, intervals) => {
		const newCategories = new Map(this.state.data.demographicData.categories)
		const newCategory = JSON.parse(JSON.stringify(newCategories.get(key)))
		newCategory.intervals = intervals;
		newCategories.set(key, newCategory)

		this.setData({ demographicData: { ...this.state.data.demographicData, categories: newCategories } })
	}

	/**
	 * For specific cluster examination, set whether or not the user is currently selecting a cluster.
	 * 
	 * @param {Boolean} value whether or not the user is currently selecting a cluster  
	 */
	setSelectingCluster = (value) => {
		const diagramCounter = value ? 0 : this.state.diagramCounter;
		value && this.nodeGraphFixFitView();

		// if selecting a cluster, show the node cosmograph
		this.setState({ selectingCluster: value, diagramCounter })
	}

	/**
	 * When the user actually selects a cluster, set the selected cluster index and highlight the nodes in the cluster.
	 * 
	 * @param {Boolean} value 
	 */
	setSelectedCluster = (value) => {
		// cancel cluster selection, do not highlight any nodes
		if (value === undefined) {
			this.state.nodeGraph.unselectNodes();
		} else {
			const selectedNodes = [...this.state.data.clusterData.clusters[value].clusterNodes.values()]
			this.state.nodeGraph.selectNodesByIds(selectedNodes);
		}

		this.setState({ selectedClusterIndex: value })
	}

	/**
	 * For input field, set the threshold value.
	 * @param {*} threshold threshold value to update
	 * @returns whether or not the threshold is valid
	 */
	setThreshold = (threshold) => {
		const thresholdValid = threshold !== "" && threshold >= 0 && threshold <= MAX_THRESHOLD;
		this.setState({ threshold, thresholdValid })

		return thresholdValid;
	}

	setDiagram = (value) => {
		this.setState({ diagramCounter: value })
	}

	incrementDiagramCounter = () => {
		this.setState({ diagramCounter: Math.min(this.state.diagramCounter + 1, DIAGRAMS_COUNT - 1) })
	}

	decrementDiagramCounter = () => {
		if (this.state.diagramCounter - 1 === 0) {
			this.nodeGraphFixFitView();
		}

		this.setState({ diagramCounter: Math.max(this.state.diagramCounter - 1, 0) })
	}

	nodeGraphFixFitView = () => {
		if (this.state.nodeGraph.getZoomLevel() < 0.05) {
			setTimeout(() => {
				this.state.nodeGraph.fitView();
			}, 250)
		}
	}

	/** PAIRWISE DISTANCE DATA FUNCTIONS */
	updateNodesGraph = () => {
		LOG("Setting nodes graph...")
		this.state.nodeGraph.setData(this.state.data.nodes, this.state.data.links);
		setTimeout(() => { this.state.nodeGraph.fitView() }, 750)
		LOG("Done setting nodes graph.")
	}

	updateDiagrams = () => {
		console.log("\n\n\n-------- UPDATING DATA -------- \n\n\n")
		LOG("Updating data...")

		const linksMap = new Map();
		const nodesMap = new Map();

		const allLinks = [...this.state.data.allLinks.values()];

		for (const link of allLinks) {
			if (link.value < this.state.threshold) {
				this.addLinkToNodesMap(link, nodesMap);
				linksMap.set(link.id, link);
			}
		}

		const nodes = [...nodesMap.values()]
		const links = [...linksMap.values()]
		links.sort((a, b) => a.value - b.value);

		LOG("Setting data...");
		this.setData({ nodes, links, linksMap, nodesMap }, () => {
			this.updateClusterData(this.updateSummaryStats);
			this.updateNodesFromNodeViews();
			LOG("Done setting data.");
		});
	}

	/**
	 * Add the source and target nodes of a link to the nodes map, if they are not already in the map.
	 */
	addLinkToNodesMap = (link, nodesMap) => {
		// source node
		if (!nodesMap.has(link.source)) {
			nodesMap.set(link.source, {
				id: link.source,
				color: "#000000",
				adjacentNodes: new Set([link.target]),
				individualID: link.source.split("|")[1] ?? link.source,
				views: new Set()
			});
		}

		// target node
		if (!nodesMap.has(link.target)) {
			nodesMap.set(link.target, {
				id: link.target,
				color: "#000000",
				adjacentNodes: new Set([link.source]),
				individualID: link.target.split("|")[1] ?? link.target,
				views: new Set()
			});
		}

		// update source and target nodes' adjacentNodes set
		nodesMap.get(link.source).adjacentNodes.add(link.target);
		nodesMap.get(link.target).adjacentNodes.add(link.source);
	}

	updateClusterData = (callback) => {
		LOG("Generating clusters...")
		// alias
		const nodesMap = this.state.data.nodesMap;
		// list of current nodes on graph, a list of ids (strings) 
		const nodes = new Set(this.state.data.nodesMap.keys());
		// array of clusters, each cluster is a set of ids (strings)
		const clusters = [];
		// array of cluster sizes
		const clusterSizes = [];
		// map of cluster size to number of clusters of that size
		const clusterDistribution = new Map();

		// iterate over all nodes, perform BFS
		let nodesIterator = nodes.values();
		while (nodes.size > 0) {
			const clusterNodes = new Set();
			const clusterLinks = new Set();
			// get first node in set (id string)
			const starterNode = nodesIterator.next().value;
			clusterNodes.add(starterNode);
			nodes.delete(starterNode)
			// queue of nodes to visit, which are id strings
			// each key in nodesMap points to a node object, which has an adjacentNodes property that is a list of id strings
			const queue = [...(nodesMap.get(starterNode).adjacentNodes)];
			while (queue.length > 0) {
				const node = queue.pop();
				if (!clusterNodes.has(node)) {
					clusterNodes.add(node);
					nodes.delete(node);
					queue.push(...(nodesMap.get(node).adjacentNodes));
				}
			}

			// iterate over all nodes in cluster, get stats
			let triangleCount = 0;
			let tripleCount = 0;
			let edgeCount = 0;
			const clusterOfNodes = [...clusterNodes.values()];
			for (let i = 0; i < clusterOfNodes.length; i++) {
				const node1 = clusterOfNodes[i];
				const adjacentNodes = nodesMap.get(node1).adjacentNodes;
				const adjacentNodesArray = [...adjacentNodes];
				edgeCount += adjacentNodesArray.length;
				tripleCount += adjacentNodesArray.length * (adjacentNodesArray.length - 1) / 2;

				for (let j = 0; j < adjacentNodesArray.length; j++) {
					const node2 = adjacentNodesArray[j];
					const adjacentNodes2 = [...nodesMap.get(node2).adjacentNodes];
					const min = node1.localeCompare(node2) < 0 ? node1 : node2;
					const max = node1.localeCompare(node2) < 0 ? node2 : node1;
					clusterLinks.add(`${min}-${max}`);

					for (let k = 0; k < adjacentNodes2.length; k++) {
						if (adjacentNodes.has(adjacentNodes2[k])) {
							triangleCount++;
						}
					}
				}
			}

			tripleCount /= 3;
			triangleCount /= 6;
			edgeCount /= 2;

			// update cluster data
			clusters.push({
				clusterNodes,
				clusterLinks,
				size: clusterNodes.size,
				triangleCount,
				tripleCount,
				edgeCount,
			});
			clusterSizes.push(clusterNodes.size);
			clusterDistribution.set(clusterNodes.size, (clusterDistribution.get(clusterNodes.size) || 0) + 1);
		}

		// also set histogram bar count variable to largest cluster size 
		const maxHistogramTicks = Math.max(...clusterSizes);
		this.setClusterHistogramData({ histogramTicks: maxHistogramTicks, maxHistogramTicks });

		clusters.sort((a, b) => a.clusterNodes.size - b.clusterNodes.size)
		clusterSizes.sort((a, b) => a - b);
		this.setData({ clusterData: { clusters, clusterSizes, clusterDistribution } }, callback)
		LOG("Done generating clusters...")
	}

	/** NODE VIEWS & COLOR FUNCTIONS */
	createView = (viewID, viewData, callback) => {
		const nodeViews = new Map(this.state.data.nodeViews);
		nodeViews.set(viewID, viewData);

		this.setData({ nodeViews }, () => this.updateNodesFromNodeViews(viewID, callback));
	}

	updateNodesFromNodeViews = (viewID, callback) => {
		LOG("Updating node views...")
		const nodeViews = this.state.data.nodeViews;
		const nodesMap = new Map(this.state.data.nodesMap);

		let viewDataArray;

		if (viewID === undefined) {
			viewDataArray = [...nodeViews.keys()];
		} else {
			viewDataArray = [viewID];
		}

		const nodeKeys = [...nodesMap.keys()];

		for (const node of nodeKeys) {
			// get sequence's corresponding individual, continue if not found
			const correspondingIndividual = this.state.data.demographicData.data.get(node.split("|")[1]);
			if (correspondingIndividual === undefined) {
				continue;
			}

			// get individual's (demographic) data
			const individualDemoKeys = Object.keys(correspondingIndividual);
			const individualDemoValues = Object.values(correspondingIndividual);
			let add = true;

			// check if sequence's corresponding individual matches view
			for (const viewIDKey of viewDataArray) {
				const viewData = nodeViews.get(viewIDKey);

				for (let j = 0; j < individualDemoKeys.length; j++) {
					if (viewData.values[j] === "All") {
						continue;
					}

					if (this.state.data.demographicData.categories.get(individualDemoKeys[j]).type === 'number') {
						const range = viewData.values[j].split(" - ");
						if (!(individualDemoValues[j] >= parseFloat(range[0]) && individualDemoValues[j] <= parseFloat(range[1]))) {
							add = false;
							break;
						}
					} else {
						if (individualDemoValues[j] !== viewData.values[j]) {
							add = false;
							break;
						}
					}
				}

				if (add) {
					nodesMap.get(node).views.add(viewIDKey)
				}
			}

			// set node color
			nodesMap.get(node).color = this.getNodeColor(node);
		}

		this.setData({ nodesMap, nodes: [...nodesMap.values()] }, () => {
			this.updateNodesGraph();
			LOG("Done updating node views.")
			if (callback) {
				callback();
			}
		});
	}

	updateNodesColor = () => {
		const nodesMap = new Map(this.state.data.nodesMap);
		const nodeKeys = [...nodesMap.keys()];

		for (const node of nodeKeys) {
			nodesMap.get(node).color = this.getNodeColor(node);
		}

		this.setData({ nodesMap, nodes: [...nodesMap.values()] }, () => {
			this.updateNodesGraph();
		});
	}

	deleteNodeViewFromNodes = (viewID) => {
		LOG("Deleting node view from nodes...")
		const nodesMap = new Map(this.state.data.nodesMap);
		const nodeKeys = [...nodesMap.keys()];

		for (const node of nodeKeys) {
			nodesMap.get(node).views.delete(viewID);
			nodesMap.get(node).color = this.getNodeColor(node);
		}

		this.setData({ nodesMap, nodes: [...nodesMap.values()] }, () => {
			this.updateNodesGraph();
			LOG("Done deleting node view from nodes.")
		});
	}

	getNodeColor = (node) => {
		const view = [...this.state.data.nodesMap.get(node).views.keys()]
		if (view.length > 0) {
			return this.state.data.nodeViews.get(view[0]).color
		}
	}

	updateSummaryStats = () => {
		// alias
		const data = this.state.data;

		if (data.links.length === 0) {
			this.setData({ stats: { clusterMedian: 0, clusterMean: 0, transitivity: 0, triangleCount: 0, meanPairwiseDistance: 0, medianPairwiseDistance: 0, assortativity: 0 } })
			return;
		}

		const clusterMedian = data.clusterData.clusterSizes[Math.floor(data.clusterData.clusterSizes.length / 2)];
		const clusterMean = (data.clusterData.clusterSizes.reduce((a, b) => a + b, 0) / data.clusterData.clusterSizes.length);

		// calculate mean pairwise distance
		let sum = 0;
		for (const link of data.links) {
			sum += link.value;
		}
		const meanPairwiseDistance = (sum / data.links.length);
		// calculate median pairwise distance
		const medianPairwiseDistance = data.links[Math.floor(data.links.length / 2)].value;

		// calculate assortativity
		let sourceAverage = 0;
		let targetAverage = 0;
		for (const link of data.links) {
			sourceAverage += data.nodesMap.get(link.source).adjacentNodes.size;
			targetAverage += data.nodesMap.get(link.target).adjacentNodes.size;
		}

		sourceAverage /= data.links.length;
		targetAverage /= data.links.length;

		let assortNumerator = 0; // similar to covariance
		let sourceVariance = 0;
		let targetVariance = 0;

		for (const link of data.links) {
			assortNumerator += (data.nodesMap.get(link.source).adjacentNodes.size - sourceAverage) * (data.nodesMap.get(link.target).adjacentNodes.size - targetAverage);
			sourceVariance += Math.pow(data.nodesMap.get(link.source).adjacentNodes.size - sourceAverage, 2);
			targetVariance += Math.pow(data.nodesMap.get(link.target).adjacentNodes.size - targetAverage, 2);
		}

		const assortativity = (assortNumerator / Math.sqrt(sourceVariance * targetVariance));

		// get triple and triangle count
		let triangleCount = 0;
		let tripleCount = 0;
		for (let i = 0; i < data.clusterData.clusters.length; i++) {
			triangleCount += data.clusterData.clusters[i].triangleCount;
			tripleCount += data.clusterData.clusters[i].tripleCount;
		}

		// calculate transitivity
		const transitivity = (triangleCount / tripleCount);

		// this.state.pyodide.globals.set("G", this.state.pyodide.toPy(data.links.map(link => [link.sourceNumericID, link.targetNumericID])));
		// this.state.pyodide.runPython(this.state.CALCULATE_STATS_PYTHON_CODE);
		// const assortativity = this.state.pyodide.globals.get("assortativity");
		// const transitivity = this.state.pyodide.globals.get("transitivity");
		// const triangleCount = this.state.pyodide.globals.get("triangle_count");

		this.setData({ stats: { clusterMedian, clusterMean, transitivity, triangleCount, meanPairwiseDistance, medianPairwiseDistance, assortativity } })
	}

	resetData = () => {
		this.setState({ data: DEFAULT_DATA, selectedClusterIndex: undefined, selectingCluster: false })
	}

	render() {
		return (
			<>
				<DiagramsContainer
					nodeGraphFixFitView={this.nodeGraphFixFitView}
					diagramCounter={this.state.diagramCounter}
					incrementDiagramCounter={this.incrementDiagramCounter}
					decrementDiagramCounter={this.decrementDiagramCounter}
				>
					{/** each of the following components is a diagram **/}
					<NodesGraph
						nodeGraph={this.state.nodeGraph}
					/>
					<ClusterGraph />
					<ClusterHistogram
						histogramTicks={this.state.clusterHistogram.histogramTicks}
						maxHistogramTicks={this.state.clusterHistogram.maxHistogramTicks}
						setClusterHistogramData={this.setClusterHistogramData}
						data={this.state.data}
					/>
					<SummaryStats
						data={this.state.data}
						selectedClusterIndex={this.state.selectedClusterIndex}
					/>
				</DiagramsContainer>
				<FormContainer
					data={this.state.data}
					setData={this.setData}
					resetData={this.resetData}
					threshold={this.state.threshold}
					thresholdValid={this.state.thresholdValid}
					nodeGraph={this.state.nodeGraph}
					setThreshold={this.setThreshold}
					setIntervals={this.setIntervals}
					updateDiagrams={this.updateDiagrams}
					createView={this.createView}
					updateNodesFromNodeViews={this.updateNodesFromNodeViews}
					updateNodesColor={this.updateNodesColor}
					deleteNodeViewFromNodes={this.deleteNodeViewFromNodes}
					selectedClusterIndex={this.state.selectedClusterIndex}
					setSelectedCluster={this.setSelectedCluster}
					selectingCluster={this.state.selectingCluster}
					setSelectingCluster={this.setSelectingCluster}
					setDiagram={this.setDiagram}
				/>
			</>
		)
	}
}

export default App