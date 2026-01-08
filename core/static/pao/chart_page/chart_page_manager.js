import {
  fetchJson,
  convertedEfficiency,
  calculateRawChartData as calculateRawChartData,
} from "./helpers.js";
import {
  initializeRawDataTable,
  initializeResultsTable,
} from "./table_setup.js";
import { initializeRawChart, initializeResultsChart } from "./chart_setup.js";

// const RAW_DATA_URL = "/pao/get_ivl_for_regression";
// const RESULTS_DATA_URL = "/pao/get_coeff_result_po";
// const SAVE_CE_CONDITION_URL = "/pao/save_ce_condition_data/";
export default class ChartPageManager {
  // DOM 요소 참조
  /** @type {HTMLElement | null} */
  rawTableContainer = null;
  /** @type {HTMLElement & {data: any[], layout: Plotly.Layout}} | null} */
  rawChartContainer = null;
  /** @type {HTMLElement | null} */
  resultsTableContainer = null;
  /** @type {HTMLElement & {data: any[], layout: Plotly.Layout}} | null} */
  resultsChartContainer = null;
  /** @type {HTMLElement | null} */
  regressionButton = null;
  /** @type {HTMLSelectElement | null} */
  selectFitElement = null;
  /** @type {HTMLElement | null} */
  extractButtonElement = null;
  /** @type {HTMLElement | null} */
  saveDataButton = null;
  /** @type {HTMLElement | null} */
  graphStyleButton = null;
  /** @type {HTMLElement | null} */
  resultsGraphStyleButton = null;

  // 인스턴스
  /** @type {import("tabulator-tables").Tabulator | null} */
  rawDataTableInstance = null;
  /** @type {import("tabulator-tables").Tabulator | null} */
  resultsTableInstance = null;

  // // 회귀 분석 및 추출 상태
  // /** @type {RegressionResult | null} */
  // latestFit2nd = null;
  // /** @type {RegressionResult | null} */
  // latestFit3rd = null;
  // /** @type {Array<number[]> | null} */
  // latestFormattedData = null;
  // /** @type {string | null} */
  // latestFitColor = null;

  // 현재 차트에 표시된 데이터 및 관련 정보
  /** @type {Array<{x: number, y: number}> | null} */
  currentChartData = null;
  /** @type {string | null} */
  currentChartDataColor = null;
  /** @type {Partial<Plotly.Layout> | null} */
  resultsChartLayout = null;
  /** @type {Partial<Plotly.Layout> | null} */
  rawChartLayout = null;
  /** @type {HTMLElement | null} */
  chartEditorComponent = null;
  /** @type {'raw' | 'results' | null} */
  _editingChartTarget = null;

  // Modal properties
  /** @type {HTMLElement | null} */
  _graphStyleModalElement = null;
  /** @type {import("bootstrap").Modal | null} */
  _graphStyleModalInstance = null;
  /** @type {EventListener | null} */
  _chartEditorSaveHandler = null;
  /** @type {number} */
  _modalId = 0;

  /**
   * @param {{
   *  rawTableContainer: HTMLElement,
   *  rawChartContainer: HTMLElement
   *  resultsTableContainer: HTMLElement,
   *  regressionButton: HTMLElement,
   *  selectFitElement: HTMLSelectElement,
   *  extractButtonElement: HTMLElement,
   *  resultsChartContainer: HTMLElement,
   *  saveDataButton: HTMLElement,
   *  graphStyleButton: HTMLElement,
   *  resultsGraphStyleButton: HTMLElement,
   * }} options
   */
  constructor(options) {
    // 옵션에서 요소 참조 할당
    this.rawTableContainer = options.rawTableContainer;

    this.rawChartContainer =
      /** @type {HTMLElement & {data: Plotly.PlotData[], layout: Plotly.Layout}} */ (
        options.rawChartContainer
      );
    this.resultsTableContainer = options.resultsTableContainer;
    this.regressionButton = options.regressionButton;
    this.selectFitElement = options.selectFitElement;
    this.extractButtonElement = options.extractButtonElement;
    this.resultsChartContainer =
      /** @type {HTMLElement & {data: Plotly.PlotData[], layout: Plotly.Layout}} */ (
        options.resultsChartContainer
      );
    this.saveDataButton = options.saveDataButton;
    this.graphStyleButton = options.graphStyleButton;
    this.resultsGraphStyleButton = options.resultsGraphStyleButton;
    // Get WC reference after DOM is potentially ready
    // Note: Ensure this runs after the WC is defined and element exists
    this.chartEditorComponent = document.getElementById(
      "chart-editor-component",
    );

    // Initialize Bootstrap Modal Instance
    // this._graphStyleModalElement = document.getElementById("graphStyleModal");
    // // @ts-ignore
    // if (this._graphStyleModalElement && typeof bootstrap !== "undefined") {
    //   // @ts-ignore
    //   this._graphStyleModalInstance = new bootstrap.Modal(
    //     this._graphStyleModalElement
    //   );
    // } else {
    //   console.error(
    //     "Graph style modal element not found or Bootstrap not loaded."
    //   );
    // }

    // Call async initialization method and handle any errors
    this._initialize().catch((error) => {
      console.error("ChartPageManager: 비동기 초기화 중 오류 발생", error);
    });
  }

  // --- 초기화 메서드 (Private) ---

  /** @description 초기화 함수입니다. 필요한 이벤트 리스너 등을 설정합니다. */
  async _initialize() {
    try {
      // 데이터, 차트 초기화
      this._initializeChart();
      this._initializeResultsChart();

      // 테이블 비동기 초기화 (await 추가)
      await this._initializeTables();

      // 테이블 초기화 후 이벤트 리스너 설정 (이제 rawDataTableInstance가 있음)
      // 여기서 모든 이벤트 리스너를 한번에 설정합니다
      this._setupEventListeners();
    } catch (error) {
      console.error("ChartPageManager: 초기화 실패", error);
      htmx.trigger(document.body, "toast-message", {
        message:
          "페이지 구성 요소를 초기화하지 못했습니다. 자세한 내용은 콘솔을 확인하세요.",
        tag: "error",
      });
    }
  }

  /** @description 원본 데이터 차트를 초기화합니다. */
  _initializeChart() {
    if (!this.rawChartContainer) {
      console.error(
        "ChartPageManager: 원본 차트 컨테이너가 제공되지 않았습니다.",
      );
      return;
    }
    initializeRawChart(this.rawChartContainer);
    if (this.rawChartContainer) {
      // Store the initial layout
      this.rawChartLayout = initializeRawChart(this.rawChartContainer);
    }
  }

  /** @description 결과 비교 차트를 초기화합니다. */
  _initializeResultsChart() {
    if (!this.resultsChartContainer) {
      console.warn("ChartPageManager: Results chart container not provided.");
      return;
    }
    // Store the layout returned by the initialization function
    this.resultsChartLayout = initializeResultsChart(
      this.resultsChartContainer,
    );
  }

  /** @description 원본 데이터 테이블과 결과 테이블을 비동기적으로 초기화합니다. */
  async _initializeTables() {
    if (!this.rawTableContainer || !this.resultsTableContainer) {
      console.error("ChartPageManager: 테이블 컨테이너가 제공되지 않았습니다.");
      return;
    }
    try {
      // const rawDataJson = await fetchJson(RAW_DATA_URL);
      this.rawDataTableInstance = initializeRawDataTable(
        this.rawTableContainer,
        // rawDataJson,
        RAW_DATA,
      );
      const resultsDataJson = await fetchJson(RESULTS_DATA_URL);
      this.resultsTableInstance = initializeResultsTable(
        this.resultsTableContainer,
        resultsDataJson,
      );

      if (!this.rawDataTableInstance) {
        console.error(
          "ChartPageManager: 원본 데이터 테이블 인스턴스 초기화 실패",
        );
      }
      if (!this.resultsTableInstance) {
        console.error("ChartPageManager: 결과 테이블 인스턴스 초기화 실패");
      }

      // 추가: 결과 테이블 선택 리스너
      if (this.resultsTableInstance) {
        this.resultsTableInstance.on("rowSelectionChanged", () =>
          this._updateResultsChart(),
        );
      } else {
        console.warn(
          "ChartPageManager: 결과 테이블 인스턴스가 없어 선택 리스너를 설정할 수 없습니다.",
        );
      }

      // 이벤트 리스너는 _setupEventListeners()에서 설정하므로 여기서 제거
    } catch (error) {
      console.error("ChartPageManager: 테이블 초기화 중 오류:", error);
    }
  }

  /** @description 필요한 DOM 요소들에 이벤트 리스너를 설정합니다. */
  _setupEventListeners() {
    // 디버깅용 로깅 추가
    console.log("_setupEventListeners 실행 - 테이블 인스턴스 상태:", {
      rawDataTableInstance: !!this.rawDataTableInstance,
      resultsTableInstance: !!this.resultsTableInstance,
    });

    // 원본 테이블 선택 리스너
    if (this.rawDataTableInstance) {
      this.rawDataTableInstance.on("rowSelectionChanged", (_, selectedRows) => {
        this._handleRowSelectionChange(selectedRows);
      });
    } else {
      console.warn(
        "ChartPageManager: 선택 리스너에 사용할 원본 데이터 테이블 인스턴스 없음",
      );
    }

    // 회귀 분석 버튼 리스너
    if (this.regressionButton) {
      this.regressionButton.addEventListener("click", () =>
        this._handleRegressionClick(),
      );
    } else {
      console.warn("ChartPageManager: 회귀 분석 버튼을 찾을 수 없음");
    }

    // 추출 리스너
    if (this.extractButtonElement && this.selectFitElement) {
      this.extractButtonElement.addEventListener("click", () =>
        this._extractSelectedFit(),
      );
    } else {
      console.warn("ChartPageManager: 추출 버튼 또는 선택 요소를 찾을 수 없음");
    }

    // 데이터 저장 버튼 리스너 (Table init에서 이동)
    if (this.saveDataButton) {
      this.saveDataButton.addEventListener("click", () =>
        this._handleSaveDataClick(),
      );
    } else {
      console.warn("ChartPageManager: '데이터 저장' 버튼을 찾을 수 없음");
    }

    // 그래프 서식 버튼 리스너 (Table init에서 이동)
    if (this.graphStyleButton) {
      this.graphStyleButton.addEventListener("click", () => {
        // Set target to raw chart
        this._editingChartTarget = "raw";
        this._handleOpenGraphStyleModal();
      });
    } else {
      console.warn("ChartPageManager: '그래프 서식' 버튼을 찾을 수 없음");
    }

    // 새로운 이벤트 리스너 추가
    if (this.resultsGraphStyleButton) {
      this.resultsGraphStyleButton.addEventListener("click", () => {
        this._editingChartTarget = "results";
        this._handleOpenGraphStyleModal();
      });
    } else {
      console.warn("ChartPageManager: '결과 차트 서식' 버튼을 찾을 수 없음");
    }
  }

  // --- 이벤트 핸들러 및 로직 메서드 (Private) ---

  /** @description 원본 데이터 테이블에서 행 선택 변경 시 호출되며, 차트를 업데이트합니다. */
  /** @param {Array<import("tabulator-tables").RowComponent>} selectedRows */
  _handleRowSelectionChange(selectedRows) {
    if (selectedRows.length === 0) return; // 선택된 행이 없으면 종료

    const lastRowComp = selectedRows[selectedRows.length - 1];
    const lastData = lastRowComp.getData();
    this.currentChartDataColor = lastData.Color;

    // 선택된 모든 행의 색이 동일한지 확인
    const isAllColorSame = selectedRows.every((rowComp) => {
      const rowData = rowComp.getData();
      return rowData.Color === lastData.Color;
    });

    if (!isAllColorSame) {
      this.rawDataTableInstance.deselectRow(lastRowComp);
      htmx.trigger(document.body, "toast-message", {
        message: `데이터 간 색상이 다릅니다.`,
        tag: "warning",
      });
      return;
    }

    this.currentChartData = calculateRawChartData(selectedRows);
    this._updateRawDataChart(this.currentChartData);
  }

  /** @description 주어진 데이터로 원본 데이터 차트를 업데이트하고, 기존 회귀 분석 결과를 지웁니다. */
  /** @param {Array<{x: number, y: number}>} data */
  _updateRawDataChart(data) {
    const xValues = [];
    const yValues = [];
    let xTitle = this.currentChartDataColor === "B" ? "CIE y" : "CIE x";
    let yTitle = this.currentChartDataColor === "B" ? "BI" : "CIE y";

    data.forEach((row) => {
      xValues.push(row.x);
      yValues.push(row.y);
    });

    const chartContainer = this.rawChartContainer;
    if (!chartContainer) return;

    // 현재 차트에 트레이스가 있는지 확인
    const traceCount = chartContainer.data ? chartContainer.data.length : 0;
    const lineIndexes = chartContainer.data.filter(
      (trace) => trace.mode === "lines",
    );

    if (traceCount === 0) {
      // 트레이스가 없으면 Scatter 트레이스 추가
      // @ts-ignore
      Plotly.addTraces(chartContainer, {
        x: xValues,
        y: yValues,
        mode: "markers",
        type: "scatter",
        name: "Raw Data Points",
      });
    } else {
      // 회귀선이 있으면 삭제
      if (lineIndexes.length > 0) {
        // @ts-ignore
        Plotly.deleteTraces(
          chartContainer,
          lineIndexes.map((_, i) => i + 1),
        );
      }
      // Scatter 트레이스만 남겨서 업데이트
      // @ts-ignore
      var data_update = {
        x: [xValues],
        y: [yValues],
      };
      var layout_update = {
        xaxis: { title: { text: xTitle } },
        yaxis: { title: { text: yTitle } },
      };
      Plotly.update(chartContainer, data_update, layout_update, [0]);
    }
  }

  /**
   * @description 회귀선을 그리기 위한 점들을 생성합니다.
   * @param {number} minX - x축 최소값
   * @param {number} maxX - x축 최대값
   * @param {number} a0 - 상수항 계수
   * @param {number} a1 - 1차항 계수
   * @param {number} a2 - 2차항 계수
   * @param {number} a3 - 3차항 계수
   * @returns {{x: number[], y: number[]}} x, y 좌표 배열
   */
  _generateRegressionPoints(minX, maxX, a0, a1, a2, a3) {
    const rangeX = maxX - minX;

    // 곡선을 부드럽게 그리기 위해 충분한 수의 점 생성
    // 1차: 2점, 2차: 30점, 3차: 50점
    const numPoints = a3 !== 0 ? 50 : a2 !== 0 ? 30 : 2;
    const stepX = rangeX === 0 ? 0 : rangeX / (numPoints - 1);

    // x값 생성
    const xPoints = Array.from(
      { length: numPoints },
      (_, k) => minX + k * stepX,
    );

    // y값 계산 (다항식 계산)
    const yPoints = xPoints.map((x) => a0 + a1 * x + a2 * x ** 2 + a3 * x ** 3);

    return { x: xPoints, y: yPoints };
  }

  /** @description '회귀 분석 실행' 버튼 클릭 시 호출되며, 선택된 데이터로 다항 회귀 분석을 수행하고 결과를 차트에 표시합니다. */
  _handleRegressionClick() {
    const tableInstance = this.rawDataTableInstance;
    const chartContainer = this.rawChartContainer;

    if (!tableInstance || !chartContainer) {
      console.error(
        "ChartPageManager: 테이블 또는 차트가 초기화되지 않았습니다.",
      );
      return;
    }
    const currentChartData = chartContainer.data[0]; // 첫 번째 트레이스에서 데이터 가져오기

    // 현재 차트 데이터 사용
    if (
      !currentChartData ||
      !currentChartData.x ||
      currentChartData.x.length < 3
    ) {
      htmx.trigger(document.body, "toast-message", {
        message: `최소 3개의 데이터를 선택해주세요.`,
        tag: "warning",
      });
      return;
    }

    const color = tableInstance.getSelectedRows()[0].getData().Color;
    if (!color) {
      htmx.trigger(document.body, "toast-message", {
        message: "회귀 분석을 위한 데이터 색상을 결정할 수 없습니다.",
        tag: "error",
      });
      return;
    }

    // 현재 차트 데이터를 회귀 분석용 형식으로 변환 [[x, y], ...]
    const formattedData = [];
    for (let i = 0; i < currentChartData.x.length; i++) {
      formattedData.push([
        Number(currentChartData.x[i]),
        Number(currentChartData.y[i]),
      ]);
    }

    const options = { precision: 6 };
    let fit2nd, fit3rd;
    let errorMsg = "";
    try {
      fit2nd = regression.polynomial(formattedData, {
        ...options,
        order: 2,
      });
    } catch (e) {
      console.error("2차 회귀 계산 오류:", e);
      errorMsg += "2차 회귀 계산 실패. ";
    }

    if (formattedData.length >= 4) {
      try {
        fit3rd = regression.polynomial(formattedData, { ...options, order: 3 });
      } catch (e) {
        console.error("3차 회귀 계산 오류:", e);
        errorMsg += "3차 회귀 계산 실패. ";
      }
    }

    if (errorMsg) {
      htmx.trigger(document.body, "toast-message", {
        message: errorMsg,
        tag: "error",
      });
    }

    // 회귀선을 위한 포인트 생성
    const xVals = formattedData.map((p) => p[0]);
    const minX = Math.min(...xVals);
    const maxX = Math.max(...xVals);

    // 기존 트레이스 인덱스 찾기
    const existingTraces = chartContainer.data;

    // 2차 회귀 처리
    if (fit2nd) {
      const { x: xFit2, y: yFit2 } = this._generateRegressionPoints(
        minX,
        maxX,
        Number(fit2nd.equation[2]),
        Number(fit2nd.equation[1]),
        Number(fit2nd.equation[0]),
        0,
      );

      if (existingTraces.length > 1) {
        // 기존 트레이스 업데이트
        // @ts-ignore
        Plotly.restyle(
          chartContainer,
          {
            x: [xFit2],
            y: [yFit2],
          },
          [1],
        );
      } else {
        // 새 트레이스 추가
        // @ts-ignore
        Plotly.addTraces(chartContainer, {
          x: xFit2,
          y: yFit2,
          mode: "lines",
          name: "2nd Order Fit",
          //line: { color: color },
        });
      }
    }

    // 3차 회귀 처리
    if (fit3rd) {
      const { x: xFit3, y: yFit3 } = this._generateRegressionPoints(
        minX,
        maxX,
        Number(fit3rd.equation[3]),
        Number(fit3rd.equation[2]),
        Number(fit3rd.equation[1]),
        Number(fit3rd.equation[0]),
      );

      if (existingTraces.length > 2) {
        // 기존 트레이스 업데이트
        // @ts-ignore
        Plotly.restyle(
          chartContainer,
          {
            x: [xFit3],
            y: [yFit3],
          },
          [2],
        );
      } else {
        // 새 트레이스 추가
        // @ts-ignore
        Plotly.addTraces(chartContainer, {
          x: xFit3,
          y: yFit3,
          mode: "lines",
          name: "3rd Order Fit",
          //line: { color: color },
        });
      }
    }

    // latestFit 속성 업데이트 (클래스에 이 속성을 추가해야 함)
    this.latestFit2nd = fit2nd;
    this.latestFit3rd = fit3rd;
    this.latestFormattedData = formattedData;
    this.latestFitColor = color;
  }

  /** @description '결과 추출' 버튼 클릭 시 호출되며, 선택된 차수의 회귀 분석 결과를 결과 테이블에 추가합니다. */
  _extractSelectedFit() {
    const rawTableInstance = this.rawDataTableInstance;
    const resultsTableInstance = this.resultsTableInstance;
    const selectElement = this.selectFitElement;

    const selectedRows = rawTableInstance.getSelectedData();
    const ivl_id = selectedRows.map((row) => row.ivl_id);

    function checkAllSame(arr) {
      // Return null for empty arrays
      if (arr.length === 0) return null;

      // Store the first element as reference
      const firstElement = arr[0];

      // Use Array.every() to check all elements match the first
      if (arr.every((element) => element === firstElement)) {
        return firstElement;
      } else {
        return null;
      }
    }
    const exp_date = checkAllSame(selectedRows.map((row) => row.exp_date));

    if (!resultsTableInstance || !selectElement) {
      console.error(
        "결과를 추출할 수 없음: 결과 테이블 또는 선택 요소 사용 불가",
      );
      return;
    }
    const fitTypeValue = selectElement.value;

    if (!fitTypeValue) {
      htmx.trigger(document.body, "toast-message", {
        message: "회귀 차수(2차 또는 3차)를 선택해주세요.",
        tag: "error",
      });
      return;
    }

    const selectedFit =
      fitTypeValue === "2" ? this.latestFit2nd : this.latestFit3rd;

    if (!selectedFit || !this.latestFormattedData || !this.latestFitColor) {
      htmx.trigger(document.body, "toast-message", {
        message:
          "유효한 회귀 분석 결과가 없습니다. 먼저 회귀 분석을 실행해주세요.",
        tag: "error",
      });
      return;
    }

    const coefficients = selectedFit.equation;
    if (!coefficients || coefficients.length < (fitTypeValue === "2" ? 3 : 4)) {
      // 2차는 3개, 3차는 4개 필요
      htmx.trigger(document.body, "toast-message", {
        message:
          "잘못된 회귀 계수가 발견되었거나 선택한 차수에 비해 계수가 부족합니다.",
        tag: "error",
      });
      return;
    }
    // 내림차순( [an, ..., a2, a1, a0] ) 기반으로 계수 올바르게 할당
    const a0 = coefficients[coefficients.length - 1] ?? 0;
    const a1 = coefficients[coefficients.length - 2] ?? 0;
    const a2 = coefficients[coefficients.length - 3] ?? 0;
    // 3차 피팅이고 계수가 존재할 경우에만 thirdCoefficient 할당
    const a3 =
      fitTypeValue === "3" && coefficients.length > 3
        ? coefficients[coefficients.length - 4] ?? 0
        : 0;

    let efficiency = null;
    const colorcoords = {
      R: sessionData.rx,
      G: sessionData.gx,
      B: sessionData.by,
    };
    try {
      efficiency = convertedEfficiency(this.latestFitColor, colorcoords, {
        a0,
        a1,
        a2,
        a3,
      });
      efficiency =
        efficiency !== null ? parseFloat(efficiency.toFixed(4)) : null;
    } catch (error) {
      console.error("효율 계산 오류:", error);
      htmx.trigger(document.body, "toast-message", {
        message: `효율 계산 오류: ${error.message}`,
        tag: "error",
      });
    }

    // Generate a unique ID for this result
    // const resultId =
    //   "result_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);

    const newRowData = {
      Max색좌표: -1,
      minrange: 0,
      maxrange: 1,
      Color: this.latestFitColor,
      Condi: "",
      0: a0,
      1: a1,
      2: a2,
      3: a3,
      "환산 효율": efficiency,
      fitData: JSON.stringify(this.latestFormattedData),
      ivl_id: ivl_id,
      exp_date: exp_date,
    };

    resultsTableInstance.addRow(newRowData);
    console.log("결과 테이블로 추출된 피팅:", newRowData);
  }

  /** @description 선택된 결과 테이블 항목들을 기반으로 결과 비교 차트를 업데이트합니다. */
  _updateResultsChart() {
    if (!this.resultsChartContainer || !this.resultsTableInstance) {
      console.warn(
        "ChartPageManager: 결과 차트 또는 테이블 인스턴스가 없습니다.",
      );
      return;
    }

    const selectedRows = this.resultsTableInstance.getSelectedRows();
    const chartDiv = this.resultsChartContainer;
    const currentTraces = chartDiv.data || [];

    // Create Sets to track existing and selected resultIds
    const existingResultIds = new Set();
    const selectedResultIds = new Set();

    // Map to quickly find traces by resultId and type (dataPoints or fitLine)
    const traceMap = {}; // resultId -> { dataIndex, fitIndex }

    // Build map of existing traces by resultId
    currentTraces.forEach((trace, index) => {
      if (trace.resultId) {
        existingResultIds.add(trace.resultId);

        if (!traceMap[trace.resultId]) {
          traceMap[trace.resultId] = { dataIndex: -1, fitIndex: -1 };
        }

        if (trace.isDataPoints) {
          traceMap[trace.resultId].dataIndex = index;
        } else if (trace.isFitLine) {
          traceMap[trace.resultId].fitIndex = index;
        }
      }
    });

    // Arrays to hold our operations
    const tracesToKeep = [];
    const tracesToAdd = [];
    const indicesToRemove = [];

    // Process each selected row
    const colors = new Set();
    selectedRows.forEach((row, i) => {
      const rowData = row.getData();
      const resultId = rowData.resultId || "result_" + i; // Fallback if no ID
      selectedResultIds.add(resultId);

      const color = rowData.Color;
      if (color) {
        colors.add(color);
      }

      let points = [];
      try {
        const parsedData = JSON.parse(rowData.fitData || "[]");
        if (
          Array.isArray(parsedData) &&
          parsedData.every(
            (p) =>
              Array.isArray(p) &&
              p.length === 2 &&
              !isNaN(p[0]) &&
              !isNaN(p[1]),
          )
        ) {
          points = parsedData;
        } else {
          console.warn("Invalid fitData format for row:", rowData);
        }
      } catch (e) {
        console.error("Error parsing fitData for row:", rowData, e);
      }

      // Skip if no valid points
      if (points.length === 0) {
        return;
      }

      const a0 = rowData["0"] ?? 0;
      const a1 = rowData["1"] ?? 0;
      const a2 = rowData["2"] ?? 0;
      const a3 = rowData["3"] ?? 0;

      // Extract x, y values for data points
      const xValues = points.map((p) => p[0]);
      const yValues = points.map((p) => p[1]);

      // Calculate regression line points
      const minX = Math.min(...xValues);
      const maxX = Math.max(...xValues);
      const { x: xFitPoints, y: yFitPoints } = this._generateRegressionPoints(
        minX,
        maxX,
        a0,
        a1,
        a2,
        a3,
      );

      if (existingResultIds.has(resultId)) {
        // This resultId already exists in the chart - update its data
        const indices = traceMap[resultId];

        if (indices.dataIndex >= 0) {
          // Update data points trace
          const existingDataTrace = { ...currentTraces[indices.dataIndex] };
          existingDataTrace.x = xValues;
          existingDataTrace.y = yValues;
          tracesToKeep.push({
            index: indices.dataIndex,
            trace: existingDataTrace,
          });
        }

        if (indices.fitIndex >= 0) {
          // Update fit line trace
          const existingFitTrace = { ...currentTraces[indices.fitIndex] };
          existingFitTrace.x = xFitPoints;
          existingFitTrace.y = yFitPoints;
          tracesToKeep.push({
            index: indices.fitIndex,
            trace: existingFitTrace,
          });
        }
      } else {
        // This is a new resultId - create new traces
        const dataPointTrace = {
          x: xValues,
          y: yValues,
          mode: "markers",
          type: "scatter",
          name: `${rowData.Color || "Result"} ${i + 1} (Data)`,
          resultId: resultId,
          isDataPoints: true,
        };

        const fitLineTrace = {
          x: xFitPoints,
          y: yFitPoints,
          mode: "lines",
          type: "scatter",
          name: `${rowData.Color || "Result"} ${i + 1} (Fit)`,
          resultId: resultId,
          isFitLine: true,
        };

        tracesToAdd.push(dataPointTrace);
        tracesToAdd.push(fitLineTrace);
      }
    });

    if (colors.size > 1) {
      // 선택한 행들의 색상이 서로 다름
      this.resultsTableInstance.deselectRow();
      htmx.trigger(document.body, "toast-message", {
        message: `데이터 간 색상이 다릅니다.`,
        tag: "warning",
      });
      return;
    }

    // Find traces to remove (those not in selected rows)
    currentTraces.forEach((trace, index) => {
      if (trace.resultId && !selectedResultIds.has(trace.resultId)) {
        indicesToRemove.push(index);
      }
    });

    // Sort indices to remove in descending order so we don't affect other indices
    indicesToRemove.sort((a, b) => b - a);

    // Get the current layout or use a default one
    const currentLayout = chartDiv.layout || {};
    const uniqueColor = colors.values().next().value;
    const xTitle = uniqueColor === "B" ? "CIE y" : "CIE x";
    const yTitle = uniqueColor === "B" ? "BI" : "CIE y";
    const baseLayout = {
      // Preserve existing layout properties
      ...currentLayout,
      xaxis: {
        title: { text: xTitle },
      },
      yaxis: {
        title: { text: yTitle },
      },
    };

    try {
      // Apply our changes to the chart

      // 1. Remove unneeded traces
      if (indicesToRemove.length > 0) {
        // @ts-ignore - Plotly is loaded globally
        Plotly.deleteTraces(chartDiv, indicesToRemove);

        // Adjust indices in tracesToKeep since we've removed traces
        tracesToKeep.forEach((item) => {
          indicesToRemove.forEach((removedIndex) => {
            if (removedIndex < item.index) {
              item.index -= 1;
            }
          });
        });
      }

      // 2. Update existing traces
      if (tracesToKeep.length > 0) {
        // Group updates by index for Plotly.restyle
        const updatesByIndex = {};

        tracesToKeep.forEach(({ index, trace }) => {
          updatesByIndex[index] = {
            x: [trace.x],
            y: [trace.y],
          };
        });

        // Apply updates for each index
        Object.entries(updatesByIndex).forEach(([indexStr, update]) => {
          const index = parseInt(indexStr, 10);
          // @ts-ignore - Plotly is loaded globally
          Plotly.restyle(chartDiv, update, [index]);
        });
      }

      // 3. Add new traces
      if (tracesToAdd.length > 0) {
        // @ts-ignore - Plotly is loaded globally
        Plotly.addTraces(chartDiv, tracesToAdd);
      }

      // 4. Update layout
      // @ts-ignore - Plotly is loaded globally
      Plotly.relayout(chartDiv, baseLayout);

      // @ts-ignore
      this.resultsChartLayout = chartDiv.layout || baseLayout;

      console.log(
        "Results chart updated successfully:",
        `${indicesToRemove.length} removed, ${tracesToKeep.length} updated, ${tracesToAdd.length} added`,
      );
    } catch (error) {
      console.error("Error updating results chart:", error);
    }
  }

  /** @description '데이터 저장' 버튼 클릭 시 호출됩니다.*/
  _handleSaveDataClick() {
    if (!this.resultsTableInstance) {
      console.error("결과 테이블 인스턴스가 없습니다.");
      htmx.trigger(document.body, "toast-message", {
        message: "오류: 결과 테이블을 찾을 수 없습니다.",
        tag: "error",
      });
      return;
    }
    const csrfToken = document.getElementsByName("csrfmiddlewaretoken")[0]
      .value;
    // const tableData = this.resultsTableInstance.getData();
    const selectedRows = this.resultsTableInstance.getSelectedRows();
    const tableData = this.resultsTableInstance.getSelectedData();
    if (tableData.length === 0) {
      htmx.trigger(document.body, "toast-message", {
        message: "선택된 행이 없습니다. 저장할 행을 선택해주세요.",
        tag: "warning",
      });
      return;
    }
    const invalidRowIndex = tableData.findIndex(
      (row) =>
        !row.Condi ||
        row.Condi.trim() === "" ||
        !row.exp_date ||
        row.exp_date.trim() === "",
    );
    console.log(tableData);

    if (invalidRowIndex !== -1) {
      const originalIndex = selectedRows[invalidRowIndex].getPosition(true);
      htmx.trigger(document.body, "toast-message", {
        message: `${originalIndex}번째 행의 조건 혹은 투입일자 필드가 비어 있습니다. 값을 입력해주세요.`,
        tag: "error",
      });
      return;
    }

    // 모든 행이 유효하면 데이터를 로그에 기록 (추후 서버 전송 로직으로 대체)
    console.log("유효성 검사 통과. 저장할 데이터:", tableData);
    // 여기에 실제 데이터 저장 로직 추가 (e.g., fetch API 사용)
    fetch(SAVE_CE_CONDITION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": csrfToken,
      },
      body: JSON.stringify({ data: tableData }),
    })
      .then((response) => response.json())
      .then((data) => {
        htmx.trigger(document.body, "toast-message", data);
        this.resultsTableInstance.replaceData(RESULTS_DATA_URL);
      })
      .catch((err) => {
        console.error("저장 중 에러:", err);
        htmx.trigger(document.body, "toast-message", {
          message: `저장 중 오류가 발생했습니다: ${err}`,
          tag: "error",
        });
      });
  }

  // --- Chart Editor Methods ---

  /** @description Returns the stored layout for the specified chart target. */
  /** @param {'raw' | 'results'} target */
  _getCurrentLayout(target) {
    if (target === "raw") {
      // Get the current layout from the Plotly div
      const container = /** @type {any} */ (this.rawChartContainer);
      if (container && container._fullLayout) {
        // Create a clean copy of the layout without circular references
        return this._cleanLayout(container._fullLayout);
      }
      return {};
    } else if (target === "results") {
      // For results chart, we already store a clean layout
      return this.resultsChartLayout || {};
    }
    return {};
  }

  /** @description Creates a clean copy of a Plotly layout without circular references */
  /** @param {Object} layout */
  _cleanLayout(layout) {
    // Create a new object with only the properties we need
    const clean = {
      title: layout.title,
      xaxis: {
        title: layout.xaxis.title,
        range: layout.xaxis.range,
        autorange: layout.xaxis.autorange,
      },
      yaxis: {
        title: layout.yaxis.title,
        range: layout.yaxis.range,
        autorange: layout.yaxis.autorange,
      },
      margin: {
        l: layout.margin.l,
        r: layout.margin.r,
        t: layout.margin.t,
        b: layout.margin.b,
      },
    };
    return clean;
  }

  /**
   * Creates a fresh graph style modal with a new chart editor component
   * @returns {HTMLElement} Newly created modal element
   */
  _createGraphStyleModal() {
    // Generate unique ID to avoid any potential conflicts
    const modalId = `graphStyleModal-${this._modalId++}`;

    // Create the modal element
    const modalElement = document.createElement("div");
    modalElement.id = "graphStyleModal"; // Keep same ID for event handling
    modalElement.className = "modal";
    modalElement.tabIndex = -1;

    modalElement.innerHTML = `
        <div class="modal-dialog modal-fullscreen">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">차트 서식 설정</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
              <chart-editor id="chart-editor-component"></chart-editor>
            </div>
          </div>
        </div>
      `;

    // Add to document
    document.body.appendChild(modalElement);

    // Get new references
    this._graphStyleModalElement = modalElement;
    this.chartEditorComponent = modalElement.querySelector(
      "#chart-editor-component",
    );

    // @ts-ignore
    this._graphStyleModalInstance = new bootstrap.Modal(modalElement);

    // Add event listener for modal hidden event
    modalElement.addEventListener("hidden.bs.modal", () => {
      if (this._graphStyleModalInstance) {
        this._graphStyleModalInstance.dispose();
        this._graphStyleModalInstance = null;
      }

      this._editingChartTarget = null;

      // Remove save event listener when modal is hidden
      if (this.chartEditorComponent && this._chartEditorSaveHandler) {
        this.chartEditorComponent.removeEventListener(
          "save",
          this._chartEditorSaveHandler,
        );
        this._chartEditorSaveHandler = null;
      }

      // Remove the modal element entirely to force a fresh web component on next open
      if (this._graphStyleModalElement) {
        this._graphStyleModalElement.remove();
        this._graphStyleModalElement = null;
      }
    });

    return modalElement;
  }

  /** @description '그래프 서식' 버튼 클릭 시 웹 컴포넌트 에디터를 엽니다. */
  _handleOpenGraphStyleModal() {
    console.log(
      "Showing graph style modal for chart:",
      this._editingChartTarget,
    );

    // Create a fresh modal with new chart editor component
    const modalElement = this._createGraphStyleModal();
    const editor = modalElement.querySelector("#chart-editor-component");

    if (!editor) {
      console.error("Failed to find chart editor in newly created modal");
      return;
    }

    const targetContainer =
      this._editingChartTarget === "raw"
        ? this.rawChartContainer
        : this.resultsChartContainer;

    if (!targetContainer) {
      console.error("Target chart container not found");
      return;
    }

    // Check if chart has data
    const chartData = /** @type {any} */ (targetContainer).data;
    if (!chartData || chartData.length === 0) {
      htmx.trigger(document.body, "toast-message", {
        message:
          "차트에 데이터가 없습니다. 먼저 데이터를 선택하거나 추가해주세요.",
        tag: "warning",
      });

      return;
    }

    // For raw chart, check if x and y arrays have data
    if (this._editingChartTarget === "raw") {
      const hasData =
        chartData[0]?.x?.length > 0 && chartData[0]?.y?.length > 0;
      if (!hasData) {
        htmx.trigger(document.body, "toast-message", {
          message:
            "원본 데이터 차트에 데이터가 없습니다. 먼저 데이터를 선택해주세요.",
          tag: "warning",
        });
        return;
      }
    }
    // For results chart, check if there are any traces with data
    else {
      const hasData = chartData.some(
        (trace) =>
          (trace.x?.length > 0 && trace.y?.length > 0) ||
          (trace.mode === "lines" && trace.x?.length > 0),
      );
      if (!hasData) {
        htmx.trigger(document.body, "toast-message", {
          message:
            "결과 비교 차트에 데이터가 없습니다. 먼저 결과를 선택해주세요.",
          tag: "warning",
        });
        return;
      }
    }

    // Get the current layout from the Plotly div
    const currentLayout = /** @type {any} */ (targetContainer)._fullLayout;
    if (!currentLayout) {
      console.error("Could not get current layout from chart");
      return;
    }

    console.log("currentLayout:", currentLayout);
    // Create a clean copy of the layout without circular references
    const cleanLayout = {
      title: {
        text: currentLayout.title.text,
        font: {
          family: currentLayout.title.font.family,
          size: currentLayout.title.font.size,
          color: currentLayout.title.font.color,
        },
        subtitle: {
          text: currentLayout.title.subtitle.text,
          font: {
            family: currentLayout.title.subtitle.font.family,
            size: currentLayout.title.subtitle.font.size,
            color: currentLayout.title.subtitle.font.color,
          },
        },
      },
      width: currentLayout.width,
      height: currentLayout.height,
      colorway: currentLayout.colorway,
      xaxis: {
        title: {
          text: currentLayout.xaxis.title.text,
          font: {
            family: currentLayout.xaxis.title.font.family,
            size: currentLayout.xaxis.title.font.size,
            color: currentLayout.xaxis.title.font.color,
          },
        },
        showgrid: currentLayout.xaxis.showgrid,
        gridcolor: currentLayout.xaxis.gridcolor,
        gridwidth: currentLayout.xaxis.gridwidth,
        type: currentLayout.xaxis.type,
        autorange: currentLayout.xaxis.autorange,
        range: currentLayout.xaxis.range,
        tickmode: currentLayout.xaxis.tickmode,
        nticks: currentLayout.xaxis.nticks,
      },
      yaxis: {
        title: {
          text: currentLayout.yaxis.title.text,
          font: {
            family: currentLayout.yaxis.title.font.family,
            size: currentLayout.yaxis.title.font.size,
            color: currentLayout.yaxis.title.font.color,
          },
        },
        showgrid: currentLayout.yaxis.showgrid,
        gridcolor: currentLayout.yaxis.gridcolor,
        gridwidth: currentLayout.yaxis.gridwidth,
        type: currentLayout.yaxis.type,
        autorange: currentLayout.yaxis.autorange,
        range: currentLayout.yaxis.range,
        tickmode: currentLayout.yaxis.tickmode,
        nticks: currentLayout.yaxis.nticks,
      },
      legend: {
        orientation: currentLayout.legend.orientation,
        x: currentLayout.legend.x,
        y: currentLayout.legend.y,
        bgcolor: currentLayout.legend.bgcolor,
        bordercolor: currentLayout.legend.bordercolor,
        borderwidth: currentLayout.legend.borderwidth,
        font: {
          family: currentLayout.legend.font.family,
          size: currentLayout.legend.font.size,
          color: currentLayout.legend.font.color,
        },
        xanchor: currentLayout.legend.xanchor,
        yanchor: currentLayout.legend.yanchor,
        traceorder: currentLayout.legend.traceorder,
      },
      showlegend: currentLayout.showlegend,
      margin: {
        l: currentLayout.margin.l,
        r: currentLayout.margin.r,
        t: currentLayout.margin.t,
        b: currentLayout.margin.b,
      },
      hovermode: currentLayout.hovermode,
      hoverlabel: currentLayout.hoverlabel
        ? {
            align: currentLayout.hoverlabel.align,
            bgcolor: currentLayout.hoverlabel.bgcolor,
            bordercolor: currentLayout.hoverlabel.bordercolor,
            font: currentLayout.hoverlabel.font
              ? {
                  family: currentLayout.hoverlabel.font.family,
                  size: currentLayout.hoverlabel.font.size,
                  color: currentLayout.hoverlabel.font.color,
                }
              : undefined,
          }
        : undefined,
      paper_bgcolor: currentLayout.paper_bgcolor,
      plot_bgcolor: currentLayout.plot_bgcolor,
      dragmode: currentLayout.dragmode,
      clickmode: currentLayout.clickmode,
    };

    editor.setAttribute("initial-layout", JSON.stringify(cleanLayout));
    editor.setAttribute("initial-data", JSON.stringify(chartData));

    this._chartEditorSaveHandler = /** @type {EventListener} */ (
      (
        /** @type {CustomEvent<{layout: import('plotly.js-dist-min').Layout, data: any}>} */ event,
      ) => {
        const { layout, data } = event.detail;
        this._applyLayoutUpdate(this._editingChartTarget, layout, data);
        this._graphStyleModalInstance?.hide();
      }
    );

    // Add the new event listener
    editor.addEventListener("save", this._chartEditorSaveHandler);

    // Show the modal
    this._graphStyleModalInstance?.show();
  }

  /** @description 차트 에디터에서 저장 버튼 클릭 시 호출됩니다. */
  /** @param {'raw' | 'results' | null} target */
  /** @param {Partial<Plotly.Layout>} layoutUpdate */
  /** @param {any} dataUpdate */
  _applyLayoutUpdate(target, layoutUpdate, dataUpdate) {
    if (!target) {
      console.error("Cannot apply layout update, target chart unknown.");
      return;
    }

    const targetContainer =
      target === "raw" ? this.rawChartContainer : this.resultsChartContainer;

    if (!targetContainer) {
      console.error("Target chart container not found for layout update.");
      return;
    }

    console.log("Applying updates: ", {
      layout: layoutUpdate,
      data: dataUpdate,
    });

    try {
      const chartElement = /** @type {any} */ (targetContainer);
      const currentData = chartElement.data || [];

      // @ts-ignore - Plotly is loaded globally
      Plotly.relayout(targetContainer, layoutUpdate);
      // Update the data if provided
      if (Array.isArray(dataUpdate) && dataUpdate.length > 0) {
        // Handle data update by replacing existing traces
        // Get references to the existing traces
        const traceIndices = Array.from(
          { length: currentData.length },
          (_, i) => i,
        );

        // If there are existing traces, delete them
        if (traceIndices.length > 0) {
          // @ts-ignore - Plotly is loaded globally
          Plotly.deleteTraces(targetContainer, traceIndices);
        }

        // Add the new traces
        // @ts-ignore - Plotly is loaded globally
        Plotly.addTraces(targetContainer, dataUpdate);
      }

      // Update stored layout reference
      if (target === "raw") {
        this.rawChartLayout = {
          ...(this.rawChartLayout || {}),
          ...layoutUpdate,
        };
      } else {
        this.resultsChartLayout = {
          ...(this.resultsChartLayout || {}),
          ...layoutUpdate,
        };
      }

      console.log(`Chart (${target}) updated successfully`);
    } catch (error) {
      console.error("Error updating chart:", error);
    }
  }

  // Note: _handleCloseGraphStyleModal removed as component calls close internally via onClose prop
}
