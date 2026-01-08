// compare_tv.js - 메인 엔트리 포인트

import { GlobalState } from './GlobalState.js';
import { Utils } from './Utils.js';
import { TableManager } from './TableManager.js';
import { DataLoader } from './DataLoader.js';
import { ChartManager } from './ChartManager.js';
import { AnalysisManager } from './AnalysisManager.js';
import { StateManager } from './StateManager.js';
import { ExportManager } from './ExportManager.js';

// ============================================
// 전역 변수
// ============================================

let state;
let tableManager;
let dataLoader;
let chartManager;
let analysisManager;
let stateManager;
let exportManager;

// ============================================
// TPID 매핑 함수들 (HTML onclick에서 사용)
// ============================================

let doeIdToTpidMap = {};
let selectedDoes = [];

/**
 * TPID 매핑 초기화
 */
function initializeTpidMapping() {
    doeIdToTpidMap = {};
    selectedDoes.forEach(doe => {
        const lot = String(doe.runsheet_lot || 0).padStart(2, '0');
        const gls = String(doe.gls_id || 0).padStart(2, '0');
        const tpid = lot + gls;
        const sequence = doe.sequence;

        doeIdToTpidMap[doe.id] = {
            tpid: tpid,
            sequence: sequence,
            displayName: `${sequence}-${tpid}`,
        };
    });
}

/**
 * DOE ID를 TPID로 변환
 */
function convertDoeIdToTpid(doeIdOrString) {
    const str = String(doeIdOrString);

    if (str.startsWith("DOE-")) {
        const doeId = parseInt(str.replace("DOE-", ""));
        if (doeIdToTpidMap[doeId]) {
            return doeIdToTpidMap[doeId].displayName;
        }
        return str;
    }

    const doeId = parseInt(str);
    if (!isNaN(doeId) && doeIdToTpidMap[doeId]) {
        return doeIdToTpidMap[doeId].displayName;
    }

    return str;
}

/**
 * Plotly traces의 이름을 TPID로 변환
 */
function convertTracesToTpid(traces) {
    return traces.map(trace => ({
        ...trace,
        name: convertDoeIdToTpid(trace.name)
    }));
}

/**
 * 컬럼 전체 선택/해제 (HTML onclick에서 호출)
 */
function toggleSelectAllColumns() {
    if (tableManager) {
        tableManager.toggleSelectAllColumns();
    }
}

/**
 * Delta V 기준선 에디터 열기 (HTML onclick에서 호출)
 */
function openBaselineEditor() {
    if (stateManager) {
        stateManager.openBaselineEditor();
    } else {
        Utils.openEditor(URLS.openBaseline, 'baseline', () => {
            if (chartManager) {
                chartManager.refreshDeltaVBaselineDropdown();
            }
        });
    }
}

// ============================================
// 그래프 생성 버튼
// ============================================

document.getElementById('generateChartsBtn')?.addEventListener('click', async function() {
    const colorFilter = document.getElementById('tvColorFilter').value;
    const lineFactor = document.getElementById('tvLineFactor').value;
    const agingTime = document.getElementById('ltAgingTime').value || 30;
    const selectedCols = tableManager.getSelectedColumns();

    if (!colorFilter || !lineFactor) {
        Utils.showToast("Color Filter와 Line Factor를 선택해주세요.", "warning");
        return;
    }

    if (selectedCols.length === 0) {
        Utils.showToast('그래프에 표시할 DOE를 선택해주세요.', 'warning');
        return;
    }

    try {
        const ids = new URLSearchParams(window.location.search).get("ids") || "";
        const params = new URLSearchParams({
            ids: ids,
            color_filter: colorFilter,
            line_factor: lineFactor,
            aging_time: agingTime
        });

        if (selectedCols.length > 0) {
            params.append('selected_columns', selectedCols.join(','));
        }

        const url = `${URLS.getChart}?${params}`;

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP 오류: ${response.status}`);
        }

        const data = await response.json();

        if (data.success) {
            // 차트 데이터 업데이트
            state.chartConfigs.forEach(config => {
                const dataKey = config.id.replace('tv-', '').replace(/-/g, '_');
                if (data.chart_data[dataKey]) {
                    config.data.data = convertTracesToTpid(data.chart_data[dataKey].traces || []);
                }
            });

            // 차트 렌더링
            state.chartConfigs.forEach(config => {
                const chartDiv = document.getElementById(config.id);
                if (chartDiv && chartDiv.data) {
                    const mergedLayout = {
                        ...chartDiv.layout,
                        ...data.layouts[config.id]
                    };

                    Plotly.react(
                        config.id,
                        config.data.data,
                        mergedLayout
                    );
                }
            });

            // 차트 이벤트 등록
            setTimeout(() => {
                if (chartManager) {
                    chartManager.attachAllChartEvents();
                }
            }, 100);

            Utils.showToast(data.message, "success");
        } else {
            console.error("❌ 서버 응답 실패:", data.error);
            Utils.showToast(data.error || "차트 데이터 로드 실패", "error");
        }
    } catch (error) {
        console.error("TV 차트 생성 오류:", error);
        Utils.showToast("차트 생성 중 오류가 발생했습니다.", "error");
    }
});

// ============================================
// DOMContentLoaded - 초기화
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log("📊 Compare TV 페이지 초기화 시작");

    // 1. 전역 상태 초기화
    state = GlobalState.getInstance();

    // 2. TPID 매핑 초기화
    if (typeof does !== 'undefined') {
        selectedDoes = does;
        initializeTpidMapping();
    }

    // 3. Manager 초기화
    tableManager = new TableManager();
    analysisManager = new AnalysisManager(tableManager);
    chartManager = new ChartManager(tableManager, analysisManager);
    dataLoader = new DataLoader(tableManager, chartManager, null);
    stateManager = new StateManager(tableManager, chartManager, analysisManager);
    exportManager = new ExportManager(tableManager);

    // 4. Color Filter 편집 버튼
    document.getElementById("colorOpenEditorBtn")?.addEventListener("click", () =>
        Utils.openEditor(URLS.colorfilterEditor, 'colorFilter', () => {
            if (chartManager) {
                chartManager.refreshColorFilterDropdown();
            }
        })
    );

    // 5. Line Factor 편집 버튼
    document.getElementById("lineOpenEditorBtn")?.addEventListener("click", () =>
        Utils.openEditor(URLS.linefactorEditor, 'lineFactor', () => {
            if (chartManager) {
                chartManager.refreshLineFactorDropdown();
            }
        })
    );

    // 6. Delta V 기준선 드롭다운 이벤트 (초기 등록)
    const baselineDropdown = document.getElementById('tvDeltaVBaseline');
    if (baselineDropdown) {
        baselineDropdown.addEventListener('change', () => {
            if (chartManager) {
                chartManager.applyDeltaVBaseline();
            }
        });
    }

    // 7. Gamut 색역분석 버튼 이벤트
    const gamutBtn = document.getElementById('gamutAnalysisBtn');
    if (gamutBtn) {
        gamutBtn.addEventListener('click', () => {
            if (chartManager) {
                chartManager.openGamutAnalysisWindow();
            }
        });
    }

    // 8. Color Filter 변경 이벤트
    document.getElementById("tvColorFilter")?.addEventListener("change", async () => {
        await dataLoader.loadAllAdditionalTablesAsync();
        if (chartManager) {
            chartManager.validateGamutButton();
        }
    });

    // 9. Line Factor 변경 이벤트
    document.getElementById("tvLineFactor")?.addEventListener("change", async () => {
        await dataLoader.loadAllAdditionalTablesAsync();
        if (chartManager) {
            chartManager.validateGamutButton();
        }
    });

    // 10. LT Aging Time 변경 이벤트
    document.getElementById("ltAgingTime")?.addEventListener("change", async () => {
        await dataLoader.loadAllAdditionalTablesAsync();
    });

    // 11. Excel Export 버튼
    document.getElementById('exportExcelBtn')?.addEventListener('click', () => {
        if (exportManager) {
            exportManager.exportSelectedData();
        }
    });

    // 12. 컬럼/행 visibility 드롭다운 이벤트
    document.getElementById('columnVisibilityDropdown')?.addEventListener('shown.bs.dropdown', () => {
        if (tableManager) {
            tableManager.updateColumnVisibilityList();
        }
    });

    document.getElementById('rowVisibilityDropdown')?.addEventListener('shown.bs.dropdown', () => {
        if (tableManager) {
            tableManager.updateRowVisibilityList();
        }
    });

    // 13. 초기 Gamut 버튼 상태 설정
    if (chartManager) {
        chartManager.validateGamutButton();
    }

    console.log("✅ Compare TV 페이지 초기화 완료");
});

// ============================================
// 전역 함수 노출 (HTML onclick에서 사용)
// ============================================

window.initializeTpidMapping = initializeTpidMapping;
window.convertDoeIdToTpid = convertDoeIdToTpid;
window.convertTracesToTpid = convertTracesToTpid;
window.toggleSelectAllColumns = toggleSelectAllColumns;
window.openBaselineEditor = openBaselineEditor;

// 디버깅용 getter
window.getGlobalState = () => state;
window.getTableManager = () => tableManager;
window.getDataLoader = () => dataLoader;
window.getAnalysisManager = () => analysisManager;
window.getChartManager = () => chartManager;
window.getStateManager = () => stateManager;
window.getExportManager = () => exportManager;

// 차트 접근
window.chartConfigs = state?.chartConfigs;
