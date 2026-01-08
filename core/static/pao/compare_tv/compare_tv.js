// compare_tv.js - 메인 엔트리 포인트

import { GlobalState } from './GlobalState.js';
import { Utils } from './Utils.js';
import { TableManager } from './TableManager.js';
import { DataLoader } from './DataLoader.js';
import { ChartManager } from './ChartManager.js';
import { AnalysisManager } from './AnalysisManager.js';
import { StateManager } from './StateManager.js';
import { ExportManager } from './ExportManager.js';
import { DoesStructureComponent } from "../device_structure/device_structure.js";

// ============================================
// 전역 변수
// ============================================

let state = GlobalState.getInstance();
let tableManager;
let dataLoader;
let chartManager;
let analysisManager;
let stateManager;
let exportManager;


/**
 * TPID 매핑 초기화
 */
function initializeTpidMapping() {
    state.doeIdToTpidMap = {};
    
    if (typeof selectedDoes !== 'undefined' && selectedDoes) {
        selectedDoes.forEach(doe => {
            const lot = String(doe.runsheet_lot || 0).padStart(2, '0');
            const gls = String(doe.gls_id || 0).padStart(2, '0');
            const tpid = lot + gls;
            const sequence = doe.sequence;
            
            state.doeIdToTpidMap[doe.id] = {
                tpid: tpid,
                sequence: sequence,
                displayName: `${sequence}-${tpid}`,
            };
        });
        console.log("📋 TPID 매핑 초기화 완료:", state.doeIdToTpidMap);
    }
}

/**
 * DOE ID를 TPID로 변환
 * @param {string|number} doeIdOrString - "DOE-5" 또는 5 또는 "5" 또는 "DOE-5_45°"
 * @returns {string} - TPID displayName 또는 원본 값
 */
function convertDoeIdToTpid(doeIdOrString) {
    const str = String(doeIdOrString);
    
    // "DOE-123_45°" 형태 처리 (각도 정보)
    const angleMatch = str.match(/(.+?)(_\d+°)$/);
    if (angleMatch) {
        const doePartMatch = angleMatch[1].match(/\d+/);
        if (doePartMatch) {
            const mapping = state.doeIdToTpidMap[parseInt(doePartMatch[0])];
            if (mapping) {
                return mapping.displayName + angleMatch[2];
            }
        }
        return str;
    }
    
    // "DOE-123_White_x" 형태 처리 (색상 + x/y)
    const colorXYMatch = str.match(/(.+?)_(White|Red|Green|Blue)_(x|y)$/i);
    if (colorXYMatch) {
        const doePartMatch = colorXYMatch[1].match(/\d+/);
        if (doePartMatch) {
            const mapping = state.doeIdToTpidMap[parseInt(doePartMatch[0])];
            if (mapping) {
                return mapping.displayName + '_' + colorXYMatch[2] + '_' + colorXYMatch[3];
            }
        }
        return str;
    }
    
    // "DOE-123_white" 형태 처리 (색상만)
    const colorMatch = str.match(/(.+?)_(White|Red|Green|Blue)$/i);
    if (colorMatch) {
        const doePartMatch = colorMatch[1].match(/\d+/);
        if (doePartMatch) {
            const mapping = state.doeIdToTpidMap[parseInt(doePartMatch[0])];
            if (mapping) {
                return mapping.displayName + '_' + colorMatch[2];
            }
        }
        return str;
    }
    
    // 숫자인 경우
    if (typeof doeIdOrString === 'number') {
        const mapping = state.doeIdToTpidMap[doeIdOrString];
        return mapping ? mapping.displayName : str;
    }
    
    // 일반 문자열
    const match = str.match(/\d+/);
    if (match) {
        const mapping = state.doeIdToTpidMap[parseInt(match[0])];
        return mapping ? mapping.displayName : str;
    }
    
    return str;
}

/**
 * Plotly traces의 이름을 TPID로 변환
 * @param {Array} traces - Plotly traces 배열
 * @returns {Array} - 변환된 traces
 */
function convertTracesToTpid(traces) {
    if (!Array.isArray(traces)) return traces;
    
    return traces.map(trace => {
        if (trace.name) {
            trace.name = convertDoeIdToTpid(trace.name);
        }
        return trace;
    });
}

/**
 * 그래프 필터 UI 업데이트 (원본 line 1524-1535)
 */
function updateGraphFilters() {
    const color = document.getElementById("tvColorFilter")?.value || "";
    const line = document.getElementById("tvLineFactor")?.value || "";
    
    const colorFilterElem = document.getElementById('currentGraphColorFilter');
    const lineFactorElem = document.getElementById('currentGraphLineFactor');
    
    if (colorFilterElem) colorFilterElem.textContent = color || "선택안됨";
    if (lineFactorElem) lineFactorElem.textContent = line || "선택안됨";
    
    state.currentFilters.colorFilter = color;
    state.currentFilters.lineFactor = line;
    
    // validateForm 호출 (chartManager가 있으면)
    if (chartManager) {
        chartManager.validateForm();
    }
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

    new Choices("#doeSelect", {
        allowHTML: true,
    });

    const getStructureBtn = document.getElementById("getStructureBtn");
    getStructureBtn.addEventListener("click", () => {
        const selectedDoe = document.getElementById("doeSelect");
        const structureUrl = URLS.structure.replace(0, selectedDoe.value);
        const structureArea = document.getElementById('structureArea');
        new DoesStructureComponent(
            structureArea,
            structureUrl,
            URLS.drip,
            ["Order", "EV_Chamber", "Cell_No"],
            true,
            selectedDoe[selectedDoe.selectedIndex].text,
            true,
            true,
        );
    });



    // 2. TPID 매핑 초기화
    if (typeof does !== 'undefined') {
        selectedDoes = does;
        initializeTpidMapping();
    }

    // 3. Manager 초기화
    tableManager = new TableManager();
    analysisManager = new AnalysisManager(tableManager);
    chartManager = new ChartManager(tableManager, analysisManager);
    dataLoader = new DataLoader(tableManager, analysisManager, chartManager);
    stateManager = new StateManager(tableManager, chartManager, analysisManager);
    exportManager = new ExportManager(tableManager);

    tableManager.initializeTableState();
    await tableManager.loadInitialTableData();

    //  차트 레이아웃 초기화 (원본 line 1963-1981)
    if (typeof initialLayouts !== 'undefined' && initialLayouts) {
        console.log("📊 차트 레이아웃 초기화 시작...");
        console.log("📋 initialLayouts:", Object.keys(initialLayouts));
        console.log("📋 chartConfigs:", state.chartConfigs.map(c => c.id));
        
        // chartConfigs에 layout 설정
        state.chartConfigs.forEach(config => {
            if (initialLayouts[config.id]) {
                config.data.layout = initialLayouts[config.id];
                console.log(`  ✅ ${config.id} layout 설정 완료`);
            } else {
                console.log(`  ⚠️ ${config.id} layout 없음`);
            }
        });
        
        // ChartShowcaseManager가 있으면 호출 (외부 차트 스크립트에서 제공)
        if (window.ChartShowcaseManager) {
            console.log("📊 ChartShowcaseManager 발견, createAllCharts() 호출...");
            window.ChartShowcaseManager.createAllCharts();
            console.log("✅ ChartShowcaseManager.createAllCharts() 완료");
        } else {
            console.warn("⚠️ ChartShowcaseManager를 찾을 수 없습니다.");
            
            // ChartShowcaseManager가 없으면 수동으로 빈 차트 생성
            state.chartConfigs.forEach(config => {
                const chartDiv = document.getElementById(config.id);
                if (chartDiv) {
                    try {
                        // 빈 차트로 초기화 (나중에 데이터 추가 가능하도록)
                        Plotly.newPlot(
                            config.id,
                            [],  // 빈 데이터
                            config.data.layout || {},
                            { responsive: true }
                        );
                        console.log(`  ✅ ${config.id} 수동 초기화 완료`);
                    } catch (err) {
                        console.error(`  ❌ ${config.id} 초기화 실패:`, err);
                    }
                }
            });
        }
    } else {
        console.warn("⚠️ initialLayouts가 정의되지 않았습니다.");
    }

    const colorFilterVal = document.getElementById("tvColorFilter").value;
    const lineFactorVal = document.getElementById("tvLineFactor").value;
    
    if (colorFilterVal && lineFactorVal) {
        await dataLoader.loadAllAdditionalTablesAsync();
    }
    
    // 8. UI 컴포넌트 초기화
    tableManager.initializeColumnVisibilityDropdown();
    tableManager.initializeRowVisibilityDropdown();
    
    //  이벤트 리스너 등록

    //  Color Filter 편집 버튼
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


    // 13. 초기 Gamut 버튼 상태 설정
    if (chartManager) {
        chartManager.validateGamutButton();
    }

    console.log("✅ Compare TV 페이지 초기화 완료");
});

window.addEventListener("beforeunload", function () {
    if (state.gamutAnalysisWindow && !state.gamutAnalysisWindow.closed) {
        state.gamutAnalysisWindow.close();
    }
})

// ============================================
// 전역 함수 노출 (HTML onclick에서 사용)
// ============================================

window.initializeTpidMapping = initializeTpidMapping;
window.convertDoeIdToTpid = convertDoeIdToTpid;
window.convertTracesToTpid = convertTracesToTpid;
window.updateGraphFilters = updateGraphFilters;
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
