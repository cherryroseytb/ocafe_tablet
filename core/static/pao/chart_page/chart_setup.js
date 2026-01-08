import { fetchJson } from "./helpers.js";

export const CHART_COLORS = [
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

// const RAW_DATA_PATH = "/pao/get_initial_chart_data";

/**
 * 원본 데이터 Plotly 차트를 초기화합니다.
 * 데이터를 표시할 준비가 된 빈 산점도 구조를 생성합니다.
 * @param {HTMLElement} container - 차트가 렌더링될 DOM 요소입니다.
 * @returns {HTMLElement} 차트가 렌더링된 컨테이너 요소입니다.
 */
export async function initializeRawChart(container) {
  /** @type {Plotly.Data[]} */

  //const data = await fetchJson(RAW_DATA_PATH);
  const data = [
    {
      mode: "markers",
      name: "Selected Condition",
      marker: {
        color: "rgb(0, 0, 0)",
        size: 12,
        line: {
          color: "rgb(0, 0, 0)",
          width: 0,
        },
        opacity: 0.6,
      },
      line: {
        color: "rgb(0, 0, 0)",
      },
      type: "scatter",
    },
  ];

  /** @type {Partial<Plotly.Layout>} */
  const layout = {
    height: 360,
    colorway: CHART_COLORS,
    title: {
      text: "Raw Data",
    },
    xaxis: {
      title: {
        text: "x axis",
      },
    },
    yaxis: {
      title: {
        text: "y axis",
      },
    },
    hovermode: "closest",
    showlegend: true,
    legend: {
      orientation: "h",
      xanchor: "center",
      yanchor: "bottom",
      y: 1,
      x: 0.5,
    },
    margin: { l: 60, r: 40, t: 80, b: 40 },
  };

  if (container) {
    // @ts-ignore
    Plotly.newPlot(container, data, layout);
    console.log("Plotly 원본 데이터 차트 초기화 완료.");
  } else {
    console.error("원본 데이터 차트 컨테이너가 없습니다.");
  }

  return container;
}

/**
 * 결과 비교 차트를 기본 레이아웃으로 초기화합니다.
 * @param {HTMLElement} container - 차트를 위한 컨테이너 요소입니다.
 * @returns {Partial<Plotly.Layout> | undefined} 사용된 레이아웃 객체 또는 컨테이너가 null인 경우 undefined입니다.
 */
export function initializeResultsChart(container) {
  if (!container) return;

  /** @type {Partial<Plotly.Layout>} */
  const layout = {
    height: 360,
    colorway: CHART_COLORS,
    title: {
      text: "Selected Results Comparison",
    },
    xaxis: {
      title: {
        text: "x axis",
      },
    },
    yaxis: {
      title: {
        text: "y axis",
      },
    },
    showlegend: true,
    legend: {
      orientation: "h",
      xanchor: "center",
      yanchor: "bottom",
      y: 1,
      x: 0.5,
    },
    margin: { l: 60, r: 40, t: 80, b: 40 },
  };

  const initialData = [];

  // @ts-ignore
  Plotly.newPlot(container, initialData, layout);
  console.log("결과 비교 차트 초기화 완료.");
  return layout;
}
