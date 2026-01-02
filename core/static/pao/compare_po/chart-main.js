
//compare_tables.js
class VJLTableEditor {
	constructor(url, container, extraURLs) {
		//
	}
	init() {
		//
	}
	multiCellEditBtn() {
		//
	}
	submitBtnInit() {
		//
	}
	regressionBtnInit() {
		//
	}
	protBtnInit() {
		document.getElementById("plotBtn").addEventListener("click", async() => {
			const selectedRows = this.table.getRangesData().flat();
			const ids = selectedRows.map((row) => row.id);
			const graphURL = `${this.extraURLs.getGraphBaseUrl}?ids=${ids.join(",")}`;
			
			fetch(graphURL)
				.then(function (res) {
					if (!res.ok) {
						throw new Error(`HTTP오류: ${res.status}`);
					}
					return res.json();
				})
				.then(function (data) {
					if (data.tag === "success") {
						const vjl_layout = document.getElementById("vjl-chart").layout;
						Plotly.react("vjl-chart", data.vjl_data, vjl_layout);
						//cj,el 동일
					} else {
						htmx.trigger(document.body, "toast-message", data);
					}
				})
				.catch(function (error) {
					//
				});
		});
	}
}


//chart-main.js
/** 
 * @fileoverview
 */
const CHART_COLORS = [~~];

/**
 * @typeof {Object} ChartConfig
 * @property {string} id
 * @property {string} [dataUrl]
 * @property {Object} [data]
 * @property {string} type
 * @property {string} title
 */
 
/**
 * @typeof {Object} ChartInstance
 * @property {PlotlyChartElement} element
 * @property {ChartConfig} config
 * @property {Object} data
 */
 
/**
 * @typeof {Object} ChartState
 * @property {string} chartId
 * @property {ChartLayout} layout
 * @property {Array<ChartData>} data
 * @property {string} timestamp
 */
 
/**
 * @typeof {Function} DebounceFunction
 * @param {...any} args
 * @returns {void}
 */
 
/**
 * 차트 쇼케이스 관리자 클래스
 * @class
 */
class ChartShowcaseManager {
	/**
	 * ChartShowcaseManager 생성자
	*/
	constructor() {
		/** @type {Map<string, ChartInstance>} 차트 인스턴스 저장 */
		this.charts = new Map();
		/** @type {Map<string, ChartEditorBridge>} 브리지 인스턴스 저장 */
		this.bridges = new Map();
		
		this.init();
	}
	
	/**
	 * 초기화 함수
	 * @private
	 * @returns {Promise<void>}
	*/
	async init() {
		try {
			console.log("차트 쇼케이스 초기화 시작...");
			// 차트 생성 및 렌더링
			await this.createAllCharts()
			this.connectEditButtons();
			this.setupGlobalEventListeners();
		} catch (error) {
			this.showErrorMessage("차트를 불러오는 중 오류가 발생했습니다:" + error.message);
		}
	}
	
	/**
	 * 모든 차트 생성 및 렌더링
	 * @private
	 * @returns {Promise<void>}
	*/
	async createAllCharts() {
		/** @type {Array<ChartConfig>} */
		// const chartConfigs = [
		//	{
		//		id: "vjl-chart",
		//		title: "VJL Chart",
		//		data: vjl_config,
		//	}, 
		//	/** 그외 여러 데이터 */
		// ];
		//모든차트를병렬로생성
		/** @type {Array<Promise<void>>} */
		const chartPromises = chartConfigs.map((config) =>
			this.createChart(config),);
		await Promise.all(chartPromises);
	}
	
	/**
	 * 개별 차트 생성
	 * @private
	 * @param {ChartConfig} config
	 * @returns {Promise<void<}
	*/
	async createChart(config) {
		try {
			/** @type {HTMLElement|null} */
			const chartElement = document.getElementById(config.id);
			id (!chartElement) {
				console.warn(`차트 컨테이너를 찾을수 없습니다 ${config.id}`);
				return;
			}
			
			/** @type {Object} */
			let chartData;
			
			if (config.dataUrl) {
				/** @type {Respose} */
				const response = await fetch(config.dataUrl);
				if (!response.ok) {
					throw new Error(`데이터 로드 실패: ${response.status}`);
				}
				chartData = await response.json();
			} else {
				chartData = config.data;
			}
			
			this.setupChartContainer(chartElement);
			
			const responsiveLayout = this.makeLayoutResponsive({
				...chartData.layout,
				colorway: CHART_COLORS,
			});
			
			/** @type {Object} */
			const plotConfig = {
				responsive: true,
				displayModeBar: true,
				displaylogo: false,
				modeBarButtonsToRemove: ["pan2d", "lasso2d", "select2d"],
			};
			await Plotly.newPlot(
				chartElement,
				chartData.data,
				responsiveLayout,
				plotConfig,
			);
			
			/** @type {ChartInstance} */
			const ChartInstance = {
				element: chartElement,
				config: config,
				data: chartData,
			};
			this.charts.set(config.id, ChartInstance);
		} catch (error) {
			this.showChartError(config.id, error.message);
		}
	}
	/**
	 * 편집버튼과 차트를 브리지로 연결 코드 생략
	*/
	/**
	 * 편집버튼 생성 코드 생략
	/**
	 * 차트 저장 이벤트 처리 코드 생략
	/**
	 * 전역 이벤트 리스터 설정 코드 생략
	/**
	 * 레이아웃을 반응형으로 만들기 코드 생략
	/**
	 * 차트 리사이즈 처리 코드 생략
	/**
	 * intersection observer 설정 코드 생략
	/**
	 * 에러메세지 코드 생략
	/**
	 * 개별차트 에러표시 코드 생략
	/**
	 * 성공메세지 코드 생략
	*/
	/**
	 * 디바운스 유틸리티 함수 코드 생략
	*/
	/**
	 * 모든 브리지 해제 및 정리 코드 생략
	*/
}
 
// DOM 로드 완료시 초기화
document.addEventListener("DOMContentLoaded", () => {
	if (typeof ChartEditorBridge === "undefined") {
		consle.error("ChartEditorBridge가 로드되지 않았습니다.");
		return;
	}
	if (typeof Plotly === "undefined") {
		consle.error("Plotly가 로드되지 않았습니다.");
		return;
	}
	window.ChartShowcaseManager = new ChartShowcaseManager();
});