// AnalysisManager.js - 색역 분석 관리

import { GlobalState } from './GlobalState.js';

export class AnalysisManager {
    constructor(tableManager) {
        this.state = GlobalState.getInstance();
        this.tableManager = tableManager;
    }

    /**
     * Gamut 데이터를 분석 창으로 전송
     */
    sendGamutDataToWindow() {
        if (!this.state.gamutAnalysisWindow || this.state.gamutAnalysisWindow.closed || !this.state.gamutGraphData) {
            return;
        }

        const colorFilterSelect = document.getElementById('tvColorFilter');
        const lineFactorSelect = document.getElementById('tvLineFactor');

        const colorFilterId = colorFilterSelect.value;
        const lineFactorId = lineFactorSelect.value;

        const colorFilterLabel = colorFilterSelect.options[colorFilterSelect.selectedIndex]?.text || colorFilterId;
        const lineFactorLabel = lineFactorSelect.options[lineFactorSelect.selectedIndex]?.text || lineFactorId;

        const selectedCols = this.tableManager.getSelectedColumns();

        // TPID로 변환
        const convertedGamutData = { ...this.state.gamutGraphData };
        if (convertedGamutData.user_uv) {
            const convertedUserUv = {};

            Object.entries(convertedGamutData.user_uv).forEach(([doeLabel, coords]) => {
                // "DOE-123" → TPID 변환
                if (selectedCols.length === 0 || selectedCols.includes(doeLabel)) {
                    const tpidLabel = window.convertDoeIdToTpid(doeLabel);
                    convertedUserUv[tpidLabel] = coords;
                }
            });

            convertedGamutData.user_uv = convertedUserUv;
        }

        const messageData = {
            type: 'updategamutData',
            data: {
                gamutGraphData: convertedGamutData,
                colorFilter: colorFilterId,
                lineFactor: lineFactorId,
                colorFilterLabel: colorFilterLabel,
                lineFactorLabel: lineFactorLabel,
                timestamp: Date.now()
            }
        };

        try {
            this.state.gamutAnalysisWindow.postMessage(messageData, '*');
        } catch (error) {
            if (error.name === 'DataCloneError') {
                try {
                    const simplifiedData = {
                        type: 'updategamutData',
                        data: {
                            gamutGraphData: {
                                cie1976_gamut: convertedGamutData.cie1976_gamut || [],
                                user_uv: convertedGamutData.user_uv || {},
                                ref_uv: convertedGamutData.ref_uv || {}
                            },
                            colorFilter: colorFilterId,
                            lineFactor: lineFactorId,
                            colorFilterLabel: colorFilterLabel,
                            lineFactorLabel: lineFactorLabel,
                            timestamp: Date.now()
                        }
                    };
                    this.state.gamutAnalysisWindow.postMessage(simplifiedData, '*');
                } catch (retryError) {
                    console.error("재시도도 실패:", retryError);
                }
            }
        }
    }
}
