// DataLoader.js - 데이터 로딩 관리

import { GlobalState } from './GlobalState.js';
import { Utils } from './Utils.js';

export class DataLoader {
    constructor(tableManager, analysisManager, chartManager) {
        this.state = GlobalState.getInstance();
        this.tableManager = tableManager;
        this.analysisManager = analysisManager;
        this.chartManager = chartManager;
    }

    _getFormValues() {
        return {
            ids: new URLSearchParams(window.location.search).get("ids") || "",
            color: document.getElementById('tvColorFilter').value || "",
            line: document.getElementById('tvLineFactor').value || "",
            agingTime: document.getElementById('ltAgingTime').value || 30,
        };
    }

    /**
     * 모든 추가 테이블 비동기 로드
     */
    async loadAllAdditionalTablesAsync() {
        const { ids, color, line } = this._getFormValues();

        if (!color || !line) {
            console.warn("Color Filter 또는 Line Factor가 선택되지 않았습니다.");
            return;
        }

        // 이전 값과 동일하면 스킵
        if (color === this.state.prevColorFilter &&
            line === this.state.prevLineFactor) {
            return;
        }

        this.state.prevColorFilter = color;
        this.state.prevLineFactor = line;

        try {
            const ids = new URLSearchParams(window.location.search).get("ids") || "";

            // IVL Color 테이블
            const ivlColorResponse = await fetch(
                `${URLS.ivlColorTable}?ids=${ids}&color_filter=${color}&line_factor=${line}`
            );
            const ivlColorData = await ivlColorResponse.json();
            if (ivlColorData.success && this.state.ivlColorTableInstance) {
                this.state.ivlColorTableInstance.setData(ivlColorData.table_data);
            }

            // Angle 테이블
            const angleResponse = await fetch(
                `${URLS.angleTable}?ids=${ids}&color_filter=${color}&line_factor=${line}`
            );
            const angleData = await angleResponse.json();
            if (angleData.success && this.state.angleTableInstance) {
                this.state.angleTableInstance.setData(angleData.table_data);
            }

            // LT 테이블
            const ltResponse = await fetch(
                `${URLS.ltTable}?ids=${ids}&color_filter=${color}&line_factor=${line}&aging_time=${agingTime}`
            );
            const ltData = await ltResponse.json();
            if (ltData.success && this.state.ltTableInstance) {
                this.state.ltTableInstance.setData(ltData.table_data);
            }

            console.log("✅ 모든 추가 테이블 로드 완료");

        } catch (error) {
            console.error("테이블 로드 중 오류:", error);
            Utils.showToast("테이블 로드 중 오류가 발생했습니다.", "error");
        }
    }
}
