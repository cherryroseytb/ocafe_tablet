// StateManager.js - URL 및 세션 상태 관리

import { GlobalState } from './GlobalState.js';
import { Utils } from './Utils.js';

export class StateManager {
    constructor(tableManager, chartManager, analysisManager) {
        this.state = GlobalState.getInstance();
        this.tableManager = tableManager;
        this.chartManager = chartManager;
        this.analysisManager = analysisManager;
    }

    /**
     * Delta V 기준선 에디터 열기
     */
    openBaselineEditor() {
        Utils.openEditor(URLS.openBaseline, 'baseline', () => {
            // 기준선 드롭다운 새로고침
            if (this.chartManager) {
                this.chartManager.refreshDeltaVBaselineDropdown();
            }
        });
    }
}
