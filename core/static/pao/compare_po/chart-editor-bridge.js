/**
 * @fileoverview ChartEditorBridge - 기존 차트와 버튼을 차트 에디터 모달에 연결하는 클래스
 * 차트 렌더링은 하지 않고, 오직 에디터 기능만 추가합니다.
 *
 * 사용법:
 * const bridge = new ChartEditorBridge(chartElement, editButtonElement, options);
 */

// @ts-nocheck
// 이 파일은 전역으로 로드되는 Plotly와 bootstrap을 사용합니다

/**
 * @typedef {Object} PlotlyChartElement
 * @property {string} id - 차트 요소의 ID
 * @property {Array<Object>} data - Plotly 차트 데이터 배열
 * @property {Object} layout - Plotly 차트 레이아웃
 * @property {Function} dispatchEvent - 이벤트 발생 함수
 */

/**
 * @typedef {Object} ChartEditorOptions
 * @property {string|null} [modalId=null] - 모달 ID (null이면 자동 생성)
 * @property {SaveCallback|null} [onSave=null] - 저장 시 콜백 함수
 * @property {OpenCallback|null} [onOpen=null] - 모달 열릴 때 콜백 함수
 * @property {CloseCallback|null} [onClose=null] - 모달 닫힐 때 콜백 함수
 * @property {string} [modalTitle='차트 편집'] - 모달 제목
 */

/**
 * @typedef {Object} ChartLayout
 * @property {Object} [title] - 차트 제목 설정
 * @property {string} [title.text] - 제목 텍스트
 * @property {Object} [title.font] - 제목 폰트 설정
 * @property {number} [width] - 차트 너비
 * @property {number} [height] - 차트 높이
 * @property {Object} [xaxis] - X축 설정
 * @property {Object} [yaxis] - Y축 설정
 * @property {boolean} [showlegend] - 범례 표시 여부
 * @property {Object} [margin] - 여백 설정
 * @property {string} [paper_bgcolor] - 배경색
 * @property {string} [plot_bgcolor] - 플롯 영역 배경색
 */

/**
 * @typedef {Object} ChartData
 * @property {Array} x - X축 데이터
 * @property {Array} y - Y축 데이터
 * @property {string} type - 차트 타입
 * @property {string} [name] - 트레이스 이름
 * @property {Object} [marker] - 마커 설정
 */

/**
 * @typedef {Object} ChartInfo
 * @property {PlotlyChartElement} element - 차트 요소
 * @property {Array<ChartData>} data - 차트 데이터
 * @property {ChartLayout} layout - 차트 레이아웃
 * @property {boolean} isModalOpen - 모달 열림 상태
 * @property {string} modalId - 모달 ID
 */

/**
 * @callback SaveCallback
 * @param {ChartLayout} layout - 새 레이아웃
 * @param {Array<ChartData>} data - 새 데이터
 * @param {PlotlyChartElement} chartElement - 차트 요소
 * @returns {void}
 */

/**
 * @callback OpenCallback
 * @param {ChartLayout} layout - 현재 레이아웃
 * @param {Array<ChartData>} data - 현재 데이터
 * @returns {void}
 */

/**
 * @callback CloseCallback
 * @returns {void}
 */
/**
 * ChartEditorBridge - 기존 차트와 버튼을 차트 에디터 모달에 연결하는 클래스
 * @class
 */
class ChartEditorBridge {
  /**
   * ChartEditorBridge 생성자
   * @param {PlotlyChartElement} chartElement - 이미 렌더링된 차트 요소 (Plotly div)
   * @param {HTMLButtonElement} editButtonElement - 편집 버튼 요소
   * @param {ChartEditorOptions} [options={}] - 설정 옵션
   * @throws {Error} 차트 요소나 편집 버튼이 제공되지 않은 경우
   */
  constructor(chartElement, editButtonElement, options = {}) {
    // 필수 요소 검증
    if (!chartElement) {
      throw new Error("차트 요소가 제공되지 않았습니다.");
    }
    if (!editButtonElement) {
      throw new Error("편집 버튼 요소가 제공되지 않았습니다.");
    }

    /** @type {PlotlyChartElement} */
    this.chartElement = chartElement;

    /** @type {HTMLButtonElement} */
    this.editButtonElement = editButtonElement;

    /** @type {ChartEditorOptions} */
    this.options = {
      modalId: null, // null이면 자동 생성
      onSave: null, // 저장 시 콜백 함수
      onOpen: null, // 모달 열릴 때 콜백 함수
      onClose: null, // 모달 닫힐 때 콜백 함수
      modalTitle: "차트 편집", // 모달 제목
      ...options,
    };

    /** @type {string} 고유한 모달 ID */
    this.modalId =
      this.options.modalId ||
      `chartEditorModal_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;

    /** @type {HTMLElement|null} 차트 에디터 요소 */
    this.chartEditor = null;

    /** @type {Object|null} Bootstrap 모달 인스턴스 */
    this.modalInstance = null;

    /** @type {boolean} 모달 열림 상태 */
    this.isModalOpen = false;

    this.init();
  }

  /**
   * 초기화 - 버튼에 클릭 이벤트 연결
   * @private
   * @returns {void}
   */
  init() {
    this.editButtonElement.addEventListener("click", (event) => {
      event.preventDefault();
      this.openChartEditor();
    });

    console.log("ChartEditorBridge 초기화 완료:", {
      chartElement: this.chartElement.id,
      buttonElement: this.editButtonElement.textContent,
      modalId: this.modalId,
    });
  }

  /**
   * 차트 에디터 모달 열기
   * @public
   * @returns {void}
   */
  openChartEditor() {
    if (this.isModalOpen) {
      console.warn("모달이 이미 열려있습니다.");
      return;
    }

    // 차트 데이터 검증
    if (!this.chartElement.data || this.chartElement.data.length === 0) {
      alert("차트에 데이터가 없습니다. 먼저 데이터를 추가해주세요.");
      return;
    }

    // 현재 차트 상태 가져오기
    /** @type {ChartLayout} */
    const currentLayout = this.chartElement.layout;
    /** @type {Array<ChartData>} */
    const currentData = this.chartElement.data;

    console.log("ORIGINAL DATA in chart element", this.chartElement.data);
    console.log("ORIGINAL LAYOUT in chart element", this.chartElement.layout);

    // onOpen 콜백 실행
    if (this.options.onOpen) {
      this.options.onOpen(currentLayout, currentData);
    }

    // 모달 생성 및 표시
    this.createModal(currentLayout, currentData);
  }

  /**
   * 모달 HTML 생성 및 이벤트 설정
   * @private
   * @param {ChartLayout} currentLayout - 현재 차트 레이아웃
   * @param {Array<ChartData>} currentData - 현재 차트 데이터
   * @returns {void}
   */
  createModal(currentLayout, currentData) {
    // 기존 모달이 있으면 제거
    const existingModal = document.getElementById(this.modalId);
    if (existingModal) {
      existingModal.remove();
    }

    // 모달 HTML 생성
    const modalHtml = `
      <div class="modal fade" id="${this.modalId}" tabindex="-1" aria-labelledby="${this.modalId}Label" aria-hidden="true">
        <div class="modal-dialog modal-fullscreen">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title" id="${this.modalId}Label">${this.options.modalTitle}</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="닫기"></button>
            </div>
            <div class="modal-body">
              <chart-editor id="chart-editor-${this.modalId}"></chart-editor>
            </div>
          </div>
        </div>
      </div>
    `;

    // DOM에 모달 추가
    document.body.insertAdjacentHTML("beforeend", modalHtml);

    // 모달 요소와 차트 에디터 가져오기
    /** @type {HTMLElement|null} */
    const modalElement = document.getElementById(this.modalId);
    /** @type {HTMLElement|null} */
    const chartEditor = document.getElementById(`chart-editor-${this.modalId}`);

    if (!chartEditor) {
      console.error("차트 에디터 요소를 찾을 수 없습니다.");
      return;
    }

    // 순환 참조 제거된 깨끗한 레이아웃 생성
    /** @type {ChartLayout} */
    const cleanLayout = this.cleanLayout(currentLayout);

    // 차트 에디터에 초기 데이터 설정
    chartEditor.setAttribute("initial-layout", JSON.stringify(cleanLayout));
    chartEditor.setAttribute("initial-data", JSON.stringify(currentData));

    // Bootstrap 모달 인스턴스 생성
    this.modalInstance = new bootstrap.Modal(modalElement);

    // 저장 이벤트 리스너 설정
    /** @type {EventListener} */
    const saveHandler = (event) => {
      /** @type {{layout: ChartLayout, data: Array<ChartData>}} */
      const { layout, data } = event.detail;
      console.log("차트 에디터에서 저장 이벤트 수신:", { layout, data });

      this.handleSave(layout, data);
      this.modalInstance.hide();
    };

    chartEditor.addEventListener("save", saveHandler);

    // 모달 닫힘 이벤트 리스너 설정
    modalElement.addEventListener("hidden.bs.modal", () => {
      this.isModalOpen = false;
      chartEditor.removeEventListener("save", saveHandler);
      modalElement.remove();

      console.log("차트 에디터 모달 닫힘 및 정리 완료");

      // onClose 콜백 실행
      if (this.options.onClose) {
        this.options.onClose();
      }
    });

    // 모달 표시
    this.isModalOpen = true;
    this.modalInstance.show();
  }

  /**
   * 순환 참조를 제거한 깨끗한 레이아웃 생성 (flatted 라이브러리 사용)
   * @private
   * @param {ChartLayout} layout - 원본 레이아웃
   * @returns {ChartLayout} 정리된 레이아웃
   */
  cleanLayout(layout) {
    try {
      // flatted를 사용하여 순환 참조 제거 및 딥 클론
      const serialized = Flatted.stringify(layout);
      const cleanedLayout = Flatted.parse(serialized);

      console.log("Layout cleaned with flatted:", {
        original: layout,
        cleaned: cleanedLayout,
        serializedSize: serialized.length,
      });

      return cleanedLayout;
    } catch (error) {
      console.error("Flatted serialization failed, using fallback:", error);

      // 기본적인 fallback - 최소한의 안전한 레이아웃
      return {
        title: { text: layout.title?.text || "" },
        width: layout.width || 800,
        height: layout.height || 600,
        xaxis: {
          title: { text: layout.xaxis?.title?.text || "X 축" },
          type: layout.xaxis?.type || "linear",
        },
        yaxis: {
          title: { text: layout.yaxis?.title?.text || "Y 축" },
          type: layout.yaxis?.type || "linear",
        },
      };
    }
  }

  /**
   * 저장 이벤트 처리
   * @private
   * @param {ChartLayout} layout - 새 레이아웃
   * @param {Array<ChartData>} data - 새 데이터
   * @returns {void}
   */
  handleSave(layout, data) {
    try {
      // 레이아웃 업데이트
      if (layout) {
        Plotly.relayout(this.chartElement, layout);
        console.log("차트 레이아웃 업데이트 완료");
      }

      // 데이터 업데이트
      if (data && Array.isArray(data)) {
        // 기존 트레이스 개수 확인
        /** @type {Array<ChartData>} */
        const currentData = this.chartElement.data || [];
        /** @type {number} */
        const currentTraceCount = currentData.length;

        // 기존 트레이스 삭제
        if (currentTraceCount > 0) {
          /** @type {Array<number>} */
          const traceIndices = Array.from(
            { length: currentTraceCount },
            (_, i) => i
          );
          Plotly.deleteTraces(this.chartElement, traceIndices);
        }

        // 새 트레이스 추가
        Plotly.addTraces(this.chartElement, data);
        console.log("차트 데이터 업데이트 완료:", data.length, "개 트레이스");
      }

      // 커스텀 이벤트 발생
      this.chartElement.dispatchEvent(
        new CustomEvent("chartUpdated", {
          detail: {
            layout: this.chartElement.layout,
            data: this.chartElement.data,
            source: "ChartEditorBridge",
          },
        })
      );

      // onSave 콜백 실행
      if (this.options.onSave) {
        this.options.onSave(layout, data, this.chartElement);
      }

      console.log("차트 업데이트 완료");
    } catch (error) {
      console.error("차트 업데이트 중 오류 발생:", error);
      alert("차트 업데이트 중 오류가 발생했습니다. 콘솔을 확인해주세요.");
    }
  }

  /**
   * 브리지 해제 및 리소스 정리
   * @public
   * @returns {void}
   */
  destroy() {
    // 열린 모달이 있으면 닫기
    if (this.isModalOpen && this.modalInstance) {
      this.modalInstance.hide();
    }

    // 모달 요소 제거
    /** @type {HTMLElement|null} */
    const modalElement = document.getElementById(this.modalId);
    if (modalElement) {
      modalElement.remove();
    }

    // 버튼 이벤트 리스너 제거 (새로 추가한 것만)
    // 원본 버튼은 건드리지 않음

    console.log("ChartEditorBridge 해제 완료");
  }

  /**
   * 현재 차트 상태 정보 반환
   * @public
   * @returns {ChartInfo} 차트 정보
   */
  getChartInfo() {
    return {
      element: this.chartElement,
      data: this.chartElement.data,
      layout: this.chartElement.layout,
      isModalOpen: this.isModalOpen,
      modalId: this.modalId,
    };
  }
}

// 전역으로 사용 가능하게 설정
if (typeof window !== "undefined") {
  window.ChartEditorBridge = ChartEditorBridge;
}

// 모듈로 내보내기
if (typeof module !== "undefined" && module.exports) {
  module.exports = ChartEditorBridge;
}
