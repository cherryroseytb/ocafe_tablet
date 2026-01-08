/**
 * @fileoverview 차트 쇼케이스 메인 스크립트
 * 차트를 렌더링하고 ChartEditorBridge를 사용하여 편집 기능을 연결합니다.
 */

// @ts-nocheck
// 이 파일은 전역으로 로드되는 라이브러리들을 사용합니다

const CHART_COLORS = [
  "#000000",
  "#FF0000",
  "#00FF00",
  "#0000FF",
  "#00FFFF",
  "#FF00FF",
  "#FFFF00",
  "#808000",
  "#000080",
  "#800080",
  "#800000",
  "#008000",
  "#008080",
  "#0000A0",
  "#FF8000",
  "#8000FF",
  "#FF0080",
  "#FFFFFF",
  "#C0C0C0",
  "#808080",
  "#FFFF80",
  "#80FFFF",
  "#FF80FF",
  "#404040",
];

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

    /** @type {number} 차트 고유 ID 생성을 위한 카운터 */
    this.chartCounter = 0;

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

      // 컨트롤 설정 (선택 박스 및 추가 버튼)
      this.setupControls();

      // 전역 이벤트 리스너 설정
      this.setupGlobalEventListeners();

      console.log("차트 쇼케이스 초기화 완료");
    } catch (error) {
      console.error("차트 쇼케이스 초기화 중 오류:", error);
      this.showErrorMessage(
        "차트 시스템을 초기화하는 중 오류가 발생했습니다: " + error.message,
      );
    }
  }

  /**
   * 컨트롤 설정 (Select Box & Add Button)
   * @private
   */
  setupControls() {
    const chartSelect = document.getElementById("chartSelect");
    const addChartBtn = document.getElementById("addChartBtn");

    if (!chartSelect || !addChartBtn) {
      console.error("차트 컨트롤 요소를 찾을 수 없습니다.");
      return;
    }

    // Select 옵션 채우기
    if (typeof chartConfigs !== "undefined") {
      chartConfigs.forEach((config) => {
        const option = document.createElement("option");
        option.value = config.id;
        option.textContent = config.title;
        chartSelect.appendChild(option);
      });
    }

    // 추가 버튼 이벤트 리스너
    addChartBtn.addEventListener("click", () => {
      const selectedId = chartSelect.value;
      if (selectedId) {
        this.addChart(selectedId);
      } else {
        alert("추가할 차트를 선택해주세요.");
      }
    });

    // 기본적으로 모든 차트 하나씩 추가 (선택 사항)
    // if (typeof chartConfigs !== "undefined") {
    //   chartConfigs.forEach(config => this.addChart(config.id));
    // }
  }

  /**
   * 차트 추가
   * @public
   * @param {string} configId - 원본 차트 설정 ID
   */
  async addChart(configId) {
    const baseConfig = chartConfigs.find((c) => c.id === configId);
    if (!baseConfig) {
      console.error(`차트 설정을 찾을 수 없습니다: ${configId}`);
      return;
    }

    // 고유 ID 생성
    this.chartCounter++;
    const uniqueId = `${baseConfig.id}-${Date.now()}-${this.chartCounter}`;
    
    // 설정 복사 및 ID 업데이트
    const newConfig = {
        ...baseConfig,
        id: uniqueId,
        // 타이틀은 유지하거나 고유하게 변경 가능
    };

    // DOM 요소 생성
    this.createChartDOM(newConfig);

    // 차트 생성 및 렌더링
    await this.createChart(newConfig);

    // 툴바 설정 (편집, 다운로드, 삭제 등)
    this.setupChartTools(uniqueId);
  }

  /**
   * 차트 DOM 구조 생성
   * @private
   * @param {ChartConfig}
   */
  createChartDOM(config) {
    const container = document.getElementById("dynamicChartsContainer");
    if (!container) return;

    const colDiv = document.createElement("div");
    colDiv.className = "col-lg-6";
    colDiv.id = `container-${config.id}`;

    colDiv.innerHTML = `
      <div class="card h-100">
          <div class="card-header d-flex align-items-center">
              <div class="me-auto">
                  <h5 class="card-title mb-0">${config.title}</h5>
              </div>
              <div class="chart-actions">
                  <!-- Actions will be added here -->
              </div>
              <button type="button" class="btn-close ms-2" aria-label="Close" onclick="window.chartShowcaseManager.removeChart('${config.id}')"></button>
          </div>
          <div class="card-body">
              <div id="${config.id}"></div>
          </div>
      </div>
    `;

    container.appendChild(colDiv);
  }

  /**
   * 차트 제거
   * @public
   * @param {string} uniqueId
   */
  removeChart(uniqueId) {
    // 1. 차트 인스턴스 정리
    if (this.charts.has(uniqueId)) {
        this.charts.delete(uniqueId);
    }

    // 2. 브리지 정리
    if (this.bridges.has(uniqueId)) {
        const bridge = this.bridges.get(uniqueId);
        bridge.destroy();
        this.bridges.delete(uniqueId);
    }

    // 3. Plotly Purge
    const chartElement = document.getElementById(uniqueId);
    if (chartElement && typeof Plotly !== "undefined") {
        try {
            Plotly.purge(chartElement);
        } catch (e) {
            console.warn("Plotly purge failed", e);
        }
    }

    // 4. DOM 제거
    const container = document.getElementById(`container-${uniqueId}`);
    if (container) {
        container.remove();
    }
  }

  /**
   * 개별 차트 생성
   * @private
   * @param {ChartConfig} config - 차트 설정
   * @returns {Promise<void>}
   */
  async createChart(config) {
    try {
      /** @type {HTMLElement|null} */
      const chartElement = document.getElementById(config.id);
      if (!chartElement) {
        console.warn(`차트 컨테이너를 찾을 수 없습니다: ${config.id}`);
        return;
      }

      /** @type {Object} */
      let chartData;

      // 데이터 로드 (URL 또는 직접 데이터)
      if (config.dataUrl) {
        /** @type {Response} */
        const response = await fetch(config.dataUrl);
        if (!response.ok) {
          throw new Error(`데이터 로드 실패: ${response.status}`);
        }
        chartData = await response.json();
      } else {
        // Deep copy data to prevent shared reference issues
        chartData = JSON.parse(JSON.stringify(config.data));
      }

      // 차트 컨테이너 크기 설정
      this.setupChartContainer(chartElement);

      // 레이아웃에서 고정 크기 제거 및 반응형 설정 + 기본 색상 적용
      const responsiveLayout = this.makeLayoutResponsive({
        ...chartData.layout,
        colorway: CHART_COLORS,
      });

      // Plotly 차트 렌더링
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

      // 차트 인스턴스 저장
      /** @type {ChartInstance} */
      const chartInstance = {
        element: chartElement,
        config: config,
        data: chartData,
      };
      this.charts.set(config.id, chartInstance);

      if (this.observer) {
        this.observer.observe(chartElement);
      }

      console.log(`차트 생성 완료: ${config.title} (${config.id})`);
    } catch (error) {
      console.error(`차트 생성 실패 (${config.id}):`, error);
      this.showChartError(config.id, error.message);
    }
  }

  /**
   * 차트 도구 설정 (편집, 다운로드 등)
   * @private
   * @param {string} chartId
   */
  setupChartTools(chartId) {
    const chart = this.charts.get(chartId);
    if (!chart) return;

    const chartCard = chart.element.closest(".card");
    if (!chartCard) return;

    const actionsContainer = chartCard.querySelector(".chart-actions");
    if (!actionsContainer) return;

    // 편집 버튼
    const editButton = this.createEditButton(chartId);
    actionsContainer.appendChild(editButton);

    // 다운로드 버튼
    const downloadButton = this.createDownloadButton(chartId);
    actionsContainer.appendChild(downloadButton);

    // ChartEditorBridge 연결
    try {
        const bridge = new ChartEditorBridge(chart.element, editButton, {
            modalTitle: `${chart.config.title} 편집`,
            onSave: (layout, data, chartElement) => {
                this.onChartSaved(chartId, layout, data, chartElement);
            },
        });
        this.bridges.set(chartId, bridge);
    } catch (error) {
        console.error(`브리지 연결 실패 (${chartId}):`, error);
    }
  }

  /**
   * 다운로드 버튼 생성
   * @private
   * @param {string} chartId - 차트 ID
   * @returns {HTMLButtonElement} 다운로드 버튼 요소
   */
  createDownloadButton(chartId) {
    /** @type {HTMLButtonElement} */
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn btn-outline-secondary btn-sm ms-2";
    button.innerHTML = '<i class="bi bi-download"></i>';
    button.title = "차트 다운로드";

    // CSV로 변환 함수
    function convertToCSV(data) {
      let csv = "";
      let headers = "";
      // 데이터가 있는지 확인
      if (!data || data.length === 0) return "";
      
      for (let i = 0; i < data.length; i++) {
        headers += `${data[i].name || 'Trace ' + i}_x,${data[i].name || 'Trace ' + i}_y,`;
      }
      headers = headers.slice(0, -1); // 마지막 콤마 제거
      csv += headers + "\n";

      // 데이터 길이 확인 안전장치
      const maxLength = Math.max(...data.map((trace) => (trace.x ? trace.x.length : 0)));
      
      for (let i = 0; i < maxLength; i++) {
        let row = "";
        for (let j = 0; j < data.length; j++) {
          const trace = data[j];
          const xVal = trace.x && trace.x[i] !== undefined ? trace.x[i] : "";
          const yVal = trace.y && trace.y[i] !== undefined ? trace.y[i] : "";
          row += `${xVal},${yVal},`;
        }
        row = row.slice(0, -1);
        csv += row + "\n";
      }

      return csv;
    }

    button.addEventListener("click", async () => {
      const chartInstance = this.charts.get(chartId); // 안전하게 인스턴스 가져오기
      if (!chartInstance) return;

      const data = chartInstance.element.data; // Plotly 요소에서 최신 데이터 가져오기
      const layout = chartInstance.element.layout;
      
      const csv = convertToCSV(data);
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${layout.title.text || 'chart'}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    });

    return button;
  }

  /**
   * 편집 버튼 생성
   * @private
   * @param {string} chartId - 차트 ID
   * @returns {HTMLButtonElement} 편집 버튼 요소
   */
  createEditButton(chartId) {
    /** @type {HTMLButtonElement} */
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn btn-outline-primary btn-sm ms-2";
    button.innerHTML = '<i class="bi bi-pencil-square"></i>';
    button.title = "차트 편집";
    return button;
  }

  /**
   * 차트 저장 이벤트 처리
   * @private
   * @param {string} chartId - 차트 ID
   * @param {ChartLayout} layout - 새 레이아웃
   * @param {Array<ChartData>} data - 새 데이터
   * @param {PlotlyChartElement} chartElement - 차트 요소
   * @returns {void}
   */
  onChartSaved(chartId, layout, data, chartElement) {
    // 차트 정보 업데이트
    /** @type {ChartInstance|undefined} */
    const chart = this.charts.get(chartId);
    if (chart) {
      chart.data.layout = { ...chart.data.layout, ...layout };
      if (data) {
        chart.data.data = data;
      }
    }

    // 성공 알림 표시
    this.showSuccessMessage(
      `${chart?.config?.title || "차트"}가 성공적으로 업데이트되었습니다.`,
    );
  }

  /**
   * 전역 이벤트 리스너 설정
   * @private
   * @returns {void}
   */
  setupGlobalEventListeners() {
    // 윈도우 리사이즈 이벤트 (차트 반응형 처리)
    window.addEventListener(
      "resize",
      this.debounce(() => {
        requestAnimationFrame(() => {
          this.handleChartResize();
        });
      }, 250),
    );

    // Intersection Observer로 뷰포트 진입 시 차트 리사이즈
    this.setupIntersectionObserver();
  }

  /**
   * 차트 컨테이너 크기 및 스타일 설정
   * @private
   * @param {HTMLElement} chartElement - 차트 요소
   * @returns {void}
   */
  setupChartContainer(chartElement) {
    // 컨테이너 크기 제한 스타일 적용
    chartElement.style.width = "100%";
    chartElement.style.height = "400px";
    chartElement.style.minHeight = "300px";
    chartElement.style.maxHeight = "500px";
    chartElement.style.overflow = "hidden";
  }

  /**
   * 레이아웃을 반응형으로 만들기 (고정 크기 제거)
   * @private
   * @param {ChartLayout} layout - 원본 레이아웃
   * @returns {ChartLayout} 반응형 레이아웃
   */
  makeLayoutResponsive(layout) {
    /** @type {ChartLayout} */
    const responsiveLayout = {
      ...layout,
      // 고정 크기 제거
      width: undefined,
      height: undefined,
      // 자동 크기 조정 활성화
      autosize: true,
      // 여백을 적절히 설정
      margin: {
        l: 60,
        r: 30,
        t: layout.title?.text ? 60 : 30,
        b: 60,
        pad: 5,
      },
    };

    // 제목 길이 제한
    if (
      responsiveLayout.title?.text &&
      responsiveLayout.title.text.length > 50
    ) {
      responsiveLayout.title.text =
        responsiveLayout.title.text.substring(0, 47) + "...";
    }

    return responsiveLayout;
  }

  /**
   * 차트 리사이즈 처리
   * @private
   * @returns {void}
   */
  handleChartResize = this.debounce(() => {
    requestAnimationFrame(() => {
      this.charts.forEach((chart) => {
        if (chart.element && typeof Plotly !== "undefined") {
          try {
            this.setupChartContainer(chart.element);
            Plotly.Plots.resize(chart.element);
          } catch (error) {
            console.warn(`차트 리사이즈 실패: ${chart.element.id}`, error);
          }
        }
      });
    });
  }, 250);

  /**
   * Intersection Observer 설정 (뷰포트 진입 시 차트 최적화)
   * @private
   * @returns {void}
   */
  setupIntersectionObserver() {
    if (!("IntersectionObserver" in window)) {
      return;
    }

    /** @type {IntersectionObserver} */
    const observer = new IntersectionObserver(
      this.debounce((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const chartElement = entry.target;
            requestAnimationFrame(() => {
              if (typeof Plotly !== "undefined") {
                try {
                  Plotly.Plots.resize(chartElement);
                } catch (error) {
                  // ignore
                }
              }
            });
          }
        });
      }, 100),
      {
        threshold: 0.1,
        rootMargin: "0px",
      },
    );

    // 새 차트가 추가될 때마다 관찰해야 하므로, createChart에서 처리하거나
    // 여기서는 기존 차트만 처리 (현재 흐름상 createChart에서 하는 게 좋지만, 
    // IntersectionObserver를 멤버 변수로 저장해두고 addChart에서 observe 호출하도록 변경 필요)
    this.observer = observer;
  }
  
  /**
   * 에러 메시지 표시
   * @private
   * @param {string} message - 에러 메시지
   */
  showErrorMessage(message) {
    const alertDiv = document.createElement("div");
    alertDiv.className = "alert alert-danger alert-dismissible fade show";
    alertDiv.innerHTML = `
      <h4 class="alert-heading">오류 발생</h4>
      <p>${message}</p>
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    const container = document.querySelector(".container-lg");
    if (container) {
      container.prepend(alertDiv);
    }

    setTimeout(() => {
      alertDiv.remove();
    }, 5000);
  }

  /**
   * 개별 차트 에러 표시
   * @private
   * @param {string} chartId
   * @param {string} error
   */
  showChartError(chartId, error) {
    const chartElement = document.getElementById(chartId);
    if (chartElement) {
      chartElement.innerHTML = `
        <div class="d-flex align-items-center justify-content-center h-100 text-muted">
          <div class="text-center">
            <i class="fas fa-exclamation-triangle fa-2x mb-2"></i>
            <p>차트를 불러올 수 없습니다</p>
            <small>${error}</small>
          </div>
        </div>
      `;
    }
  }

  /**
   * 성공 메시지 표시
   * @private
   * @param {string} message
   */
  showSuccessMessage(message) {
    const toastHtml = `
      <div class="toast" role="alert" style="position: fixed; top: 20px; right: 20px; z-index: 9999;">
        <div class="toast-header">
          <i class="fas fa-check-circle text-success me-2"></i>
          <strong class="me-auto">성공</strong>
          <button type="button" class="btn-close" data-bs-dismiss="toast"></button>
        </div>
        <div class="toast-body">
          ${message}
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML("beforeend", toastHtml);
    const toastElement = document.body.lastElementChild;
    const toast = new bootstrap.Toast(toastElement);
    toast.show();

    toastElement.addEventListener("hidden.bs.toast", () => {
      toastElement.remove();
    });
  }

  /**
   * 디바운스 유틸리티 함수
   * @private
   */
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        if (timeout) clearTimeout(timeout);
        func(...args);
      };
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  /**
   * 모든 브리지 해제 및 정리
   * @public
   */
  destroy() {
    this.bridges.forEach((bridge) => {
      bridge.destroy();
    });
    this.bridges.clear();
    this.charts.clear();
    if (this.observer) {
        this.observer.disconnect();
    }
  }
}

// DOM 로드 완료 시 초기화
document.addEventListener("DOMContentLoaded", () => {
  if (typeof ChartEditorBridge === "undefined") {
    console.error("ChartEditorBridge가 로드되지 않았습니다.");
    return;
  }
  if (typeof Plotly === "undefined") {
    console.error("Plotly가 로드되지 않았습니다.");
    return;
  }

  window.chartShowcaseManager = new ChartShowcaseManager();
});