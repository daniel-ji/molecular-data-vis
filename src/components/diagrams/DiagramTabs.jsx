import React, { Component } from 'react'

export class DiagramTabs extends Component {
	componentDidMount() {
		this.highlightTab(this.props.diagramCounter);
	}

	componentDidUpdate(prevProps, prevState) {
		if (prevProps.diagramCounter !== this.props.diagramCounter) {
			this.highlightTab(this.props.diagramCounter);
		}
	}

	highlightTab = (index) => {
		const tabs = document.getElementsByClassName('diagram-tab');
		for (let i = 0; i < tabs.length; i++) {
			tabs[i].classList.remove('diagram-tab-selected');
		}

		tabs[index].classList.add('diagram-tab-selected');
	}

	render() {
		return (
			<div id="diagram-tabs">
				{["Molecular Cluster Graph", "Cluster Summary Statistics", "Clusters By Zip", "Cluster Size Histogram"].map((tab, index) => {
					return (
						<div className="diagram-tab" key={index} onClick={() => { this.props.setDiagramCounter(index) }}>
							{tab}
						</div>
					)
				})}
			</div>
		)
	}
}

export default DiagramTabs