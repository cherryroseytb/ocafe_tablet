// DataLoader.js - 데이터 로딩 관리

import { GlobalState } from './GlobalState.js';
import { Utils } from './Utils.js';

export class DataLoader {
    constructor(tableManager, chartManager, stateManager) {
        this.state = GlobalState.getInstance();
        this.tableManager = tableManager;
        this.chartManager = chartManager;
        this.stateManager = stateManager;
    }

    /**
     * 모든 추가 테이블 비동기 로드
     */
    async loadAllAdditionalTablesAsync() {
        const colorFilter = document.getElementById('tvColorFilter').value;
        const lineFactor = document.getElementById('tvLineFactor').value;
        const agingTime = document.getElementById('ltAgingTime').value || 30;

        if (!colorFilter || !lineFactor) {
            console.warn("Color Filter 또는 Line Factor가 선택되지 않았습니다.");
            return;
        }

        // 이전 값과 동일하면 스킵
        if (colorFilter === this.state.prevColorFilter &&
            lineFactor === this.state.prevLineFactor) {
            return;
        }

        this.state.prevColorFilter = colorFilter;
        this.state.prevLineFactor = lineFactor;

        try {
            const ids = new URLSearchParams(window.location.search).get("ids") || "";

            // IVL Color 테이블
            const ivlColorResponse = await fetch(
                `${URLS.ivlColorTable}?ids=${ids}&color_filter=${colorFilter}&line_factor=${lineFactor}`
            );
            const ivlColorData = await ivlColorResponse.json();
            if (ivlColorData.success && this.state.ivlColorTableInstance) {
                this.state.ivlColorTableInstance.setData(ivlColorData.table_data);
            }

            // Angle 테이블
            const angleResponse = await fetch(
                `${URLS.angleTable}?ids=${ids}&color_filter=${colorFilter}&line_factor=${lineFactor}`
            );
            const angleData = await angleResponse.json();
            if (angleData.success && this.state.angleTableInstance) {
                this.state.angleTableInstance.setData(angleData.table_data);
            }

            // LT 테이블
            const ltResponse = await fetch(
                `${URLS.ltTable}?ids=${ids}&color_filter=${colorFilter}&line_factor=${lineFactor}&aging_time=${agingTime}`
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
