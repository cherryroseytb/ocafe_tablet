// ChartManager.js - 차트 관리

import { GlobalState } from './GlobalState.js';
import { Utils } from './Utils.js';

export class ChartManager {
    constructor(tableManager, analysisManager) {
        this.state = GlobalState.getInstance();
        this.tableManager = tableManager;
        this.analysisManager = analysisManager;
    }

    /**
     * 모든 차트 이벤트 등록 (그래프 생성 후 호출)
     */
    attachAllChartEvents() {
        console.log("📊 차트 이벤트 등록 시작");

        // 1. WRGB 색상 필터 (3개 차트)
        this.attachColorCheckboxEvents('tv-lt-chart', 'lt');
        this.attachColorCheckboxEvents('tv-wxy-chart', 'wxy');
        this.attachColorCheckboxEvents('tv-color-coordinate-chart', 'cc');

        // 2. Angular Spectrum 각도 필터 (기본 차트용)
        this.attachAngularCheckboxEvents();

        // 3. Delta V 기준선 드롭다운
        this.attachDeltaVBaselineEvent();

        console.log("✅ 모든 차트 이벤트 등록 완료");
    }

    // ============================================
    // WRGB 색상 필터 관련
    // ============================================

    /**
     * WRGB 색상 체크박스 이벤트 등록
     */
    attachColorCheckboxEvents(chartId, checkboxPrefix) {
        // 기존 이벤트 제거 (cloneNode로 복제)
        ['white', 'red', 'green', 'blue'].forEach(color => {
            const checkbox = document.getElementById(`${checkboxPrefix}-${color}`);
            if (!checkbox) {
                console.warn(`⚠️ 체크박스 없음: ${checkboxPrefix}-${color}`);
                return;
            }

            const newCheckbox = checkbox.cloneNode(true);
            checkbox.parentNode.replaceChild(newCheckbox, checkbox);
        });

        // 새 이벤트 등록
        ['white', 'red', 'green', 'blue'].forEach(color => {
            const checkbox = document.getElementById(`${checkboxPrefix}-${color}`);
            if (checkbox) {
                checkbox.addEventListener('change', () => {
                    this.filterColorChart(chartId, checkboxPrefix);
                });
            }
        });

        console.log(`  ✅ ${checkboxPrefix} 색상 필터 등록`);
    }

    /**
     * 색상별 차트 필터링
     */
    filterColorChart(chartId, checkboxPrefix) {
        const selectedColors = [];
        ['white', 'red', 'green', 'blue'].forEach(color => {
            const checkbox = document.getElementById(`${checkboxPrefix}-${color}`);
            if (checkbox?.checked) selectedColors.push(color);
        });

        const chartDiv = document.getElementById(chartId);
        if (!chartDiv || !chartDiv.data) return;

        const update = {
            visible: chartDiv.data.map(trace => {
                const traceName = trace.name ? trace.name.toLowerCase() : "";
                return selectedColors.some(color => traceName.includes(color));
            })
        };

        Plotly.restyle(chartId, update);
    }

    // ============================================
    // Angular Spectrum 각도 필터 (기본 차트용)
    // ============================================

    /**
     * Angular Spectrum 각도 체크박스 이벤트 등록
     */
    attachAngularCheckboxEvents() {
        // "All" 체크박스
        const angularAllCheckbox = document.getElementById('angular-all');
        if (angularAllCheckbox) {
            const newCheckbox = angularAllCheckbox.cloneNode(true);
            angularAllCheckbox.parentNode.replaceChild(newCheckbox, angularAllCheckbox);
            newCheckbox.addEventListener('change', () => this.handleAngularAllCheck());
        }

        // 개별 각도 체크박스 (0, 15, 30, 45, 60도)
        ['angular-0', 'angular-15', 'angular-30', 'angular-45', 'angular-60'].forEach(id => {
            const checkbox = document.getElementById(id);
            if (checkbox) {
                const newCheckbox = checkbox.cloneNode(true);
                checkbox.parentNode.replaceChild(newCheckbox, checkbox);
                newCheckbox.addEventListener('change', () => this.handleAngularIndividualCheck());
            }
        });

        // 초기 필터링 적용
        this.filterAngularSpectrumChart();

        console.log("  ✅ Angular Spectrum 각도 필터 등록");
    }

    /**
     * Angular Spectrum "All" 체크박스 핸들러
     */
    handleAngularAllCheck() {
        const allCheckbox = document.getElementById('angular-all');
        const individualIds = ['angular-0', 'angular-15', 'angular-30', 'angular-45', 'angular-60'];

        if (allCheckbox && allCheckbox.checked) {
            // All 체크 시: 모든 개별 각도 체크 + 비활성화
            individualIds.forEach(id => {
                const checkbox = document.getElementById(id);
                if (checkbox) {
                    checkbox.checked = true;
                    checkbox.disabled = true;
                }
            });
            this.state.angularSelectedAngles = ['all'];
        } else {
            // All 해제 시: 모든 개별 각도 해제 + 활성화
            individualIds.forEach(id => {
                const checkbox = document.getElementById(id);
                if (checkbox) {
                    checkbox.checked = false;
                    checkbox.disabled = false;
                }
            });
            this.state.angularSelectedAngles = [];
        }

        this.filterAngularSpectrumChart();
    }

    /**
     * Angular Spectrum 개별 체크박스 핸들러
     */
    handleAngularIndividualCheck() {
        const individualIds = ['angular-0', 'angular-15', 'angular-30', 'angular-45', 'angular-60'];

        this.state.angularSelectedAngles = [];

        individualIds.forEach(id => {
            const checkbox = document.getElementById(id);
            if (checkbox && checkbox.checked) {
                // ID에서 각도 추출 (angular-15 → "15")
                const angle = id.replace('angular-', '');
                this.state.angularSelectedAngles.push(angle);
            }
        });

        this.filterAngularSpectrumChart();
    }

    /**
     * Angular Spectrum 차트 필터링
     */
    filterAngularSpectrumChart() {
        const chartDiv = document.getElementById('tv-angular-spectrum-chart');

        if (!chartDiv || !chartDiv.data) {
            console.warn('⚠️ Angular Spectrum 차트 데이터가 없습니다.');
            return;
        }

        const selectedAngles = this.state.angularSelectedAngles || [];

        const update = {
            visible: chartDiv.data.map(trace => {
                // All이 선택된 경우 모든 trace 표시
                if (selectedAngles.includes('all')) {
                    return true;
                }

                // trace.name에서 각도 추출 (예: "A-0512_0°" -> "0")
                const angleMatch = trace.name?.match(/_(\d+)°/);
                if (angleMatch) {
                    return selectedAngles.includes(angleMatch[1]);
                }
                return true;
            })
        };

        Plotly.restyle('tv-angular-spectrum-chart', update);
    }

    // ============================================
    // Delta V 기준선
    // ============================================

    /**
     * Delta V 기준선 드롭다운 이벤트 등록
     */
    attachDeltaVBaselineEvent() {
        const baselineDropdown = document.getElementById('tvDeltaVBaseline');
        if (baselineDropdown) {
            // 기존 이벤트 제거 후 재등록
            const newDropdown = baselineDropdown.cloneNode(true);
            baselineDropdown.parentNode.replaceChild(newDropdown, baselineDropdown);
            newDropdown.addEventListener('change', () => this.applyDeltaVBaseline());
        }

        console.log("  ✅ Delta V 기준선 드롭다운 등록");
    }

    /**
     * Delta V 기준선 적용
     */
    async applyDeltaVBaseline() {
        const selectedId = document.getElementById('tvDeltaVBaseline').value;
        const chartDiv = document.getElementById('tv-delta-v-chart');

        if (!chartDiv || !chartDiv.data) {
            console.warn('⚠️ Delta V 차트가 없습니다.');
            return;
        }

        // Baseline이 아닌 trace들만 유지
        const existingTraces = chartDiv.data
            .filter(trace => {
                // null/undefined 체크
                if (!trace) return false;
                // baseline이 아닌 것만
                return !trace.name || !trace.name.toLowerCase().includes('baseline');
            })
            .map(trace => {
                // 안전한 복사
                const newTrace = {...trace};

                // line, marker가 있으면 복사
                if (trace.line) {
                    newTrace.line = {...trace.line};
                }
                if (trace.marker) {
                    newTrace.marker = {...trace.marker};
                }

                return newTrace;
            });

        // 기준선 선택 해제 시
        if (!selectedId) {
            Plotly.react('tv-delta-v-chart', existingTraces, chartDiv.layout);
            return;
        }

        try {
            const response = await fetch(`${URLS.applyDelta}?baseline_id=${encodeURIComponent(selectedId)}`);

            if (!response.ok) {
                Utils.showToast('서버 오류: 기준선을 찾을 수 없습니다.', "error");
                return;
            }

            const data = await response.json();

            if (!data.success) {
                Utils.showToast(data.error || "기준선 데이터를 불러올 수 없습니다.", "error");
                return;
            }

            // 기준선 trace 추가
            const baselineTrace = {
                x: data.times,
                y: data.delta_vs,
                name: 'Baseline: ' + data.label,
                type: 'scatter',
                mode: 'lines',
                line: { color: 'rgba(128, 128, 128, 0.5)', width: 1, dash: 'dot' },
                showlegend: true,
                hoverinfo: 'x+y+name'
            };

            Plotly.react('tv-delta-v-chart', [...existingTraces, baselineTrace], chartDiv.layout);
            Utils.showToast('기준선 "' + data.label + '"이 적용되었습니다.', "success");

        } catch (error) {
            console.error("❌ 기준선 적용 오류:", error);
            Utils.showToast("기준선 적용 중 오류가 발생했습니다.", "error");
        }
    }

    /**
     * Delta V 기준선 드롭다운 새로고침
     */
    async refreshDeltaVBaselineDropdown() {
        try {
            const response = await fetch(URLS.refreshBaseline);
            const data = await response.json();

            const select = document.getElementById('tvDeltaVBaseline');
            if (!select) return;

            const currentValue = select.value;

            // 드롭다운 재구성
            select.innerHTML = '<option value="">-- Select --</option>';
            data.forEach(baseline => {
                const option = document.createElement('option');
                option.value = baseline.id;
                option.textContent = `${baseline.label}(${baseline.created_user_full_name || baseline.created_user?.full_name || ''})`;
                select.appendChild(option);
            });

            // 기존 선택값이 여전히 존재하는지 확인
            if (currentValue && select.querySelector(`option[value="${currentValue}"]`)) {
                // 존재하면 복원
                select.value = currentValue;
            } else if (currentValue) {
                // 삭제되었으면 → 선택 해제 + 차트에서 기준선 제거
                select.value = '';
                await this.applyDeltaVBaseline();
                Utils.showToast("선택된 기준선이 삭제되어 차트에서 제거되었습니다.", "warning");
            }

        } catch (error) {
            console.error("Delta V 기준선 목록 갱신 실패:", error);
        }
    }

    /**
     * Color Filter 드롭다운 새로고침
     */
    async refreshColorFilterDropdown() {
        try {
            const response = await fetch(URLS.colorFilterList);
            const data = await response.json();

            const select = document.getElementById('tvColorFilter');
            const currentValue = select.value;

            select.innerHTML = '<option value="">-- Color Filter 선택 --</option>';
            data.forEach(filter => {
                const option = document.createElement('option');
                option.value = filter.id;
                option.textContent = filter.created_user_full_name
                    ? `${filter.label}(${filter.created_user_full_name})`
                    : filter.label;
                select.appendChild(option);
            });

            // 기존 선택값 복원
            if (currentValue && select.querySelector(`option[value="${currentValue}"]`)) {
                select.value = currentValue;
            } else if (currentValue) {
                select.value = '';
                this.resetFilteredTableData();
                Utils.showToast("선택된 Color Filter가 삭제되어 테이블이 초기화되었습니다.", "warning");
            }

        } catch (error) {
            console.error("Color Filter 목록 갱신 실패:", error);
        }
    }

    /**
     * Line Factor 드롭다운 새로고침
     */
    async refreshLineFactorDropdown() {
        try {
            const response = await fetch(URLS.lineFactorList);
            const data = await response.json();

            const select = document.getElementById('tvLineFactor');
            const currentValue = select.value;

            select.innerHTML = '<option value="">-- Line Factor 선택 --</option>';
            data.forEach(factor => {
                const option = document.createElement('option');
                option.value = factor.id;
                option.textContent = factor.created_user_full_name
                    ? `${factor.label}(${factor.created_user_full_name})`
                    : factor.label;
                select.appendChild(option);
            });

            // 기존 선택값 복원
            if (currentValue && select.querySelector(`option[value="${currentValue}"]`)) {
                select.value = currentValue;
            } else if (currentValue) {
                select.value = '';
                this.resetFilteredTableData();
                Utils.showToast("선택된 Line Factor가 삭제되어 테이블이 초기화되었습니다.", "warning");
            }

        } catch (error) {
            console.error("Line Factor 목록 갱신 실패:", error);
        }
    }

    /**
     * 필터 삭제 시 테이블 초기화
     */
    resetFilteredTableData() {
        if (!this.state.ivlTableInstance) return;

        // IVL 기본 데이터만 다시 로드
        if (this.tableManager && this.tableManager.loadInitialTableData) {
            this.tableManager.loadInitialTableData();
        }

        // 필터 상태 초기화
        this.state.prevColorFilter = "";
        this.state.prevLineFactor = "";
    }

    /**
     * Gamut 버튼 검증
     */
    validateGamutButton() {
        const colorFilter = document.getElementById('tvColorFilter').value;
        const lineFactor = document.getElementById('tvLineFactor').value;
        const gamutBtn = document.getElementById('gamutAnalysisBtn');

        if (!gamutBtn) return;

        const hasFilters = colorFilter && lineFactor;

        gamutBtn.disabled = !hasFilters;

        if (hasFilters) {
            gamutBtn.textContent = "색역분석 (새창)";
            gamutBtn.classList.remove('btn-secondary');
            gamutBtn.classList.add('btn-info');
        } else {
            gamutBtn.textContent = "필터 선택 필요";
            gamutBtn.classList.remove('btn-info');
            gamutBtn.classList.add('btn-secondary');
        }
    }

    /**
     * Gamut 분석 창 열기
     */
    openGamutAnalysisWindow() {
        const colorFilter = document.getElementById('tvColorFilter').value;
        const lineFactor = document.getElementById('tvLineFactor').value;

        if (!colorFilter || !lineFactor) {
            Utils.showToast("Color Filter와 Line Factor를 선택해주세요.", "warning");
            return;
        }

        const ids = new URLSearchParams(window.location.search).get("ids") || "";
        const url = `${URLS.gamutAnalysis}?ids=${ids}&color_filter=${colorFilter}&line_factor=${lineFactor}`;

        if (this.state.gamutAnalysisWindow && !this.state.gamutAnalysisWindow.closed) {
            this.state.gamutAnalysisWindow.focus();
            if (this.analysisManager) {
                this.analysisManager.sendGamutDataToWindow();
            }
        } else {
            this.state.gamutAnalysisWindow = window.open(url, "GamutAnalysis", "width=1200,height=800");

            if (this.state.gamutAnalysisWindow) {
                this.state.gamutAnalysisWindow.addEventListener('load', () => {
                    if (this.analysisManager) {
                        this.analysisManager.sendGamutDataToWindow();
                    }
                });
            }
        }
    }
}
