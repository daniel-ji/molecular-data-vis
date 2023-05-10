import React, { Component } from 'react'

export class ClusterHistogram extends Component {
    setIntervals = (e) => {
        this.props.setClusterHistogramData({ histogramTicks: e.target.value });
    }

    render() {
        return (
            <div className="graph-element" id="cluster-graph-container">
                <h1 className="graph-title">Cluster Size Histogram</h1>
                <div id="cluster-histogram"></div>
                <div id="cluster-histogram-controls">
                    <h5 className="mb-3">Bar Tick Intervals Count:</h5>
                    <input className="form-control w-50" type="number" id="cluster-histogram-bar-count" min="1" value={this.props.histogramTicks} onChange={this.setIntervals} />
                    <div className="form-text" id="cluster-histogram-bar-hint">Max (Intervals of 1): {this.props.maxHistogramTicks}</div>
                </div>
            </div>
        )
    }
}

export default ClusterHistogram