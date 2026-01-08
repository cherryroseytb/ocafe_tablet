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
        this.ivlColorTableInstance = null;
        this.angleTableInstance = null;
        this.ltTableInstance = null;

        // 테이블 상태
        this.selectedColumns = new Set();
        this.referenceColumns = new Set();
        this.hiddenColumns = new Set();
        this.hiddenRows = new Set();
        this.columnOrder = [];

        // 필터 상태
        this.prevColorFilter = "";
        this.prevLineFactor = "";

        // 차트 설정
        this.chartConfigs = [];

        // 차트 필터 상태
        this.angularSelectedAngles = ['0'];      // Angular Spectrum (기본 차트): 0도만 체크

        // Gamut 분석
        this.gamutAnalysisWindow = null;
        this.gamutGraphData = null;

        GlobalState.instance = this;
    }
}
