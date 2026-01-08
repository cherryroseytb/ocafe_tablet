// GlobalState.js - 전역 상태 관리 (Singleton)

export class GlobalState {
    static instance = null;

    static getInstance() {
        if (!GlobalState.instance) {
            GlobalState.instance = new GlobalState();
        }
        return GlobalState.instance;
    }

    constructor() {
        if (GlobalState.instance) {
            return GlobalState.instance;
        }

        // 테이블 인스턴스
        this.ivlTableInstance = null;
        this.hiddenColumns = new Set();
        this.hiddenRows = new Set();
        this.selectedColumns = new Set();
        this.referenceColumns = new Set();
        this.columnOrder = [];
        this.isDragging = false;

        // 그래프 관련
        this.prevColorFilter = "";
        this.prevLineFactor = "";
        this.gamutGraphData = null;
        this.gamutAnalysisWindow = null;
        this.currentFilters = { colorFilter: "", lineFactor: ""};        
        this.selectedAngles = ["all"];
        
        this.angularSelectedAngles = ['0'];      // Angular Spectrum (기본 차트): 0도만 체크
        this.doeIdToTpidMap = {};

        // 차트 설정
        this.chartConfigs = [
	        {
	            id: "tv-jv-chart",
	            title: "TV J-V Chart",
	            data: {
					data: [],
					layout: {}
	            },
	        },
	        {
	            id: "tv-cj-chart",
	            title: "TV CJ Chart", 
	            data: {
					data: [],
					layout: {}
	            },
	        },
	        {
	            id: "tv-spectrum-chart",
	            title: "TV Spectrum Chart",
	            data: {
					data: [],
					layout: {}
	            },
	        },
	        {
	            id: "tv-wxy-chart",
	            title: "TV Wxy Chart",
	            data: {
					data: [],
					layout: {}
	            },
	        },
	        {
	            id: "tv-angular-spectrum-chart",
	            title: "TV Angular Spectrum Chart",
	            data: {
					data: [],
					layout: {}
	            },
	        },
	        {
	            id: "tv-delta-uv-angle-chart",
	            title: "TV Delta UV Angle Chart",
	            data: {
					data: [],
					layout: {}
	            },
	        },
	        {
	            id: "tv-lt-chart",
	            title: "TV LT Chart",
	            data: {
					data: [],
					layout: {}
	            },
	        },
	        {
	            id: "tv-delta-v-chart",
	            title: "TV Delta V Chart",
	            data: {
					data: [],
					layout: {}
	            },
	        },
	        {
	            id: "tv-color-coordinate-chart",
	            title: "TV Color Coordinate Chart",
	            data: {
					data: [],
					layout: {}
	            },
	        },
	        {
	            id: "tv-delta-u-delta-v-chart",
	            title: "TV Delta U Delta V Chart",
	            data: {
					data: [],
					layout: {}
	            },
	        }
	    ];
    }
}
