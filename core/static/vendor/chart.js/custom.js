// 차트에 필요한 커스텀 함수

// 소수점 반올림
function roundToDecimals(num, decimals) {
  const factor = Math.pow(10, decimals);
  return Math.round(num * factor) / factor;
}

// Plugins
/** 차트의 커서에서 수직 선을 보여주는 함수 */
const verticalHoverLine = {
  id: "verticalHoverLine",
  beforeDatasetsDraw(chart, args, plugins) {
    const {
      ctx,
      chartArea: { top, bottom, height },
    } = chart;
    ctx.save();
    // console.log(ctx)
    chart.getDatasetMeta(0).data.forEach((dataPoint, index) => {
      if (dataPoint.active === true) {
        ctx.beginPath();
        ctx.strokeStyle = "gray";
        ctx.moveTo(dataPoint.x, top);
        ctx.lineTo(dataPoint.x, bottom);
        ctx.stroke();
      }
    });
  },
};

/** 범례 테두리 생성 함수 */
const legendBorder = {
  id: "legendBorder",
  beforeDatasetsDraw(chart, args, plugins) {
    const { ctx, legend } = chart;
    let minLeft = Infinity;
    let maxRight = 0;
    let minTop = Infinity;
    let maxBottom = 0;

    for (let i = 0; i < legend.legendHitBoxes.length; i++) {
      let box = legend.legendHitBoxes[i];
      minLeft = Math.min(minLeft, box.left);
      maxRight = Math.max(maxRight, box.left + box.width);
      minTop = Math.min(minTop, box.top);
      maxBottom = Math.max(maxBottom, box.top + box.height);
    }

    let result = {
      left: minLeft - 10,
      top: minTop - 5,
      bottom: maxBottom + 5,
      right: maxRight + 10,
    };
    // console.log(legend)

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(result.left, result.top);
    ctx.lineTo(result.right, result.top);
    ctx.lineTo(result.right, result.bottom);
    ctx.lineTo(result.left, result.bottom);
    // add backgroundColor
    // ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    // ctx.fillRect(result.left, result.top, result.right-result.left, result.bottom-result.top);
    ctx.closePath();
    ctx.stroke();
  },
};

// 차트 업데이트 함수
/** 줌 초기화 함수 설정된 min, max scale로 변경됨 */
function resetZoomChart(Chart) {
  Chart.resetZoom();
}

function handleApplyScale(chart, type) {
  const xScaleMin = document.getElementById(`${type}XScaleMin`).value;
  const xScaleMax = document.getElementById(`${type}XScaleMax`).value;
  const xStepSize = document.getElementById(`${type}XStepSize`).value;
  const xScale = document.getElementById(`${type}XScale`);

  const yScaleMin = document.getElementById(`${type}YScaleMin`).value;
  const yScaleMax = document.getElementById(`${type}YScaleMax`).value;
  const yStepSize = document.getElementById(`${type}YStepSize`).value;
  const yScale = document.getElementById(`${type}YScale`);

  const y2ScaleMin = document.getElementById(`${type}Y2ScaleMin`);
  const y2ScaleMax = document.getElementById(`${type}Y2ScaleMax`);
  const y2StepSize = document.getElementById(`${type}Y2StepSize`);
  const y2Scale = document.getElementById(`${type}Y2Scale`);

  if (xScaleMin) {
    chart.options.scales.x.min = parseFloat(xScaleMin);
  }
  if (xScaleMax) {
    chart.options.scales.x.max = parseFloat(xScaleMax);
  }
  if (xStepSize) {
    chart.options.scales.x.ticks.stepSize = parseFloat(xStepSize);
  }
  if (xScale) {
    chart.options.scales.x.type = xScale.value;
  }
  if (yScaleMin) {
    chart.options.scales.y.min = parseFloat(yScaleMin);
  }
  if (yScaleMax) {
    chart.options.scales.y.max = parseFloat(yScaleMax);
  }
  if (yStepSize) {
    chart.options.scales.y.ticks.stepSize = parseFloat(yStepSize);
  }
  if (yScale) {
    chart.options.scales.y.type = yScale.value;
  }
  if (y2ScaleMin) {
    chart.options.scales.y2.min = parseFloat(y2ScaleMin.value);
  }
  if (y2ScaleMax) {
    chart.options.scales.y2.max = parseFloat(y2ScaleMax.value);
  }
  if (y2StepSize) {
    chart.options.scales.y.ticks.stepSize = parseFloat(y2StepSize);
  }
  if (y2Scale) {
    chart.options.scales.y2.type = y2Scale.value;
  }
  chart.update();
}

function downloadCSV(myChart, filename) {
  // 헤더 생성
  const headers = [];
  myChart.data.datasets.forEach((dataset) => {
    headers.push(`${dataset.label} X`, `${dataset.label} Y`);
  });

  // 데이터 생성
  const data = [headers];
  const maxLength = Math.max(
    ...myChart.data.datasets.map((dataset) => dataset.data.length)
  );

  for (let i = 0; i < maxLength; i++) {
    const row = [];
    myChart.data.datasets.forEach((dataset) => {
      const dataPoint = dataset.data[i] || { x: "", y: "" };
      row.push(dataPoint.x, dataPoint.y);
    });
    data.push(row);
  }

  // CSV 문자열 생성
  const csvContent = data.map((e) => e.join(",")).join("\n");

  // CSV 파일 다운로드
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename || "chart-data.csv");
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function changeLegendPosition(myChart, position) {
  if (["top", "bottom", "right", "left", "chartArea"].includes(position)) {
    myChart.options.plugins.legend.position = position;
  } else {
    myChart.options.plugins.legend.align = position;
  }
  myChart.update();
}

const cmapList = {
  ppt: [
    "rgba(0, 0, 0, 255)",
    "rgba(255, 0, 0, 255)",
    "rgba(0, 0, 255, 255)",
    "rgba(0, 255, 0, 255)",
    "rgba(255, 165, 0, 255)",
    "rgba(0, 255, 255, 255)",
    "rgba(255, 0, 255, 255)",
    "rgba(165, 165, 165, 255)",
    "rgba(100, 255, 200, 255)",
    "rgba(180, 255, 180, 255)",
  ],
  rainbow: [
    "rgba(127, 0, 255, 255)",
    "rgba(71, 86, 251, 255)",
    "rgba(15, 162, 239, 255)",
    "rgba(42, 220, 220, 255)",
    "rgba(98, 250, 195, 255)",
    "rgba(156, 250, 163, 255)",
    "rgba(212, 220, 127, 255)",
    "rgba(255, 162, 86, 255)",
    "rgba(255, 86, 43, 255)",
    "rgba(255, 0, 0, 255)",
  ],
  Pastel1: [
    "rgba(251, 180, 174, 255)",
    "rgba(179, 205, 227, 255)",
    "rgba(204, 235, 197, 255)",
    "rgba(222, 203, 228, 255)",
    "rgba(254, 217, 166, 255)",
    "rgba(255, 255, 204, 255)",
    "rgba(229, 216, 189, 255)",
    "rgba(229, 216, 189, 255)",
    "rgba(242, 242, 242, 255)",
    "rgba(242, 242, 242, 255)",
  ],
  seismic: [
    "rgba(0, 0, 76, 255)",
    "rgba(0, 0, 154, 255)",
    "rgba(0, 0, 233, 255)",
    "rgba(85, 85, 255, 255)",
    "rgba(197, 197, 255, 255)",
    "rgba(255, 197, 197, 255)",
    "rgba(255, 85, 85, 255)",
    "rgba(239, 0, 0, 255)",
    "rgba(183, 0, 0, 255)",
    "rgba(127, 0, 0, 255)",
  ],
  viridis: [
    "rgba(68, 1, 84, 255)",
    "rgba(71, 39, 119, 255)",
    "rgba(62, 73, 137, 255)",
    "rgba(48, 103, 141, 255)",
    "rgba(37, 130, 142, 255)",
    "rgba(30, 157, 136, 255)",
    "rgba(53, 183, 120, 255)",
    "rgba(109, 206, 88, 255)",
    "rgba(181, 221, 43, 255)",
    "rgba(253, 231, 36, 255)",
  ],
  Set1: [
    "rgba(228, 26, 28, 255)",
    "rgba(55, 126, 184, 255)",
    "rgba(77, 175, 74, 255)",
    "rgba(152, 78, 163, 255)",
    "rgba(255, 127, 0, 255)",
    "rgba(255, 255, 51, 255)",
    "rgba(166, 86, 40, 255)",
    "rgba(166, 86, 40, 255)",
    "rgba(153, 153, 153, 255)",
    "rgba(153, 153, 153, 255)",
  ],
  PuOr: [
    "rgba(127, 59, 8, 255)",
    "rgba(183, 92, 7, 255)",
    "rgba(229, 140, 35, 255)",
    "rgba(253, 197, 126, 255)",
    "rgba(250, 233, 210, 255)",
    "rgba(229, 230, 240, 255)",
    "rgba(190, 186, 218, 255)",
    "rgba(137, 125, 179, 255)",
    "rgba(88, 46, 139, 255)",
    "rgba(45, 0, 75, 255)",
  ],
  BrBG: [
    "rgba(84, 48, 5, 255)",
    "rgba(145, 85, 13, 255)",
    "rgba(197, 141, 60, 255)",
    "rgba(230, 206, 148, 255)",
    "rgba(245, 237, 216, 255)",
    "rgba(218, 238, 235, 255)",
    "rgba(151, 214, 205, 255)",
    "rgba(67, 161, 152, 255)",
    "rgba(6, 106, 98, 255)",
    "rgba(0, 60, 48, 255)",
  ],
  prism: [
    "rgba(255, 0, 0, 255)",
    "rgba(255, 111, 0, 255)",
    "rgba(255, 251, 0, 255)",
    "rgba(50, 232, 0, 255)",
    "rgba(0, 77, 205, 255)",
    "rgba(105, 0, 254, 255)",
    "rgba(255, 0, 58, 255)",
    "rgba(255, 120, 0, 255)",
    "rgba(254, 255, 0, 255)",
    "rgba(84, 254, 0, 255)",
  ],
  brg: [
    "rgba(0, 0, 255, 255)",
    "rgba(56, 0, 199, 255)",
    "rgba(112, 0, 143, 255)",
    "rgba(170, 0, 85, 255)",
    "rgba(226, 0, 29, 255)",
    "rgba(226, 29, 0, 255)",
    "rgba(170, 85, 0, 255)",
    "rgba(112, 143, 0, 255)",
    "rgba(56, 199, 0, 255)",
    "rgba(0, 255, 0, 255)",
  ],
  gnuplot: [
    "rgba(0, 0, 0, 255)",
    "rgba(84, 0, 162, 255)",
    "rgba(119, 2, 250, 255)",
    "rgba(147, 9, 220, 255)",
    "rgba(169, 22, 89, 255)",
    "rgba(190, 44, 0, 255)",
    "rgba(208, 75, 0, 255)",
    "rgba(225, 121, 0, 255)",
    "rgba(240, 179, 0, 255)",
    "rgba(255, 255, 0, 255)",
  ],
  turbo: [
    "rgba(48, 18, 59, 255)",
    "rgba(69, 96, 214, 255)",
    "rgba(54, 168, 249, 255)",
    "rgba(26, 228, 182, 255)",
    "rgba(113, 253, 95, 255)",
    "rgba(200, 238, 51, 255)",
    "rgba(249, 186, 56, 255)",
    "rgba(245, 104, 23, 255)",
    "rgba(201, 41, 3, 255)",
    "rgba(122, 4, 2, 255)",
  ],
  RdYlBu: [
    "rgba(165, 0, 38, 255)",
    "rgba(217, 53, 41, 255)",
    "rgba(245, 121, 72, 255)",
    "rgba(253, 190, 112, 255)",
    "rgba(254, 237, 164, 255)",
    "rgba(237, 248, 223, 255)",
    "rgba(188, 225, 238, 255)",
    "rgba(126, 181, 213, 255)",
    "rgba(73, 122, 182, 255)",
    "rgba(49, 54, 149, 255)",
  ],
  nipy_spectral: [
    "rgba(0, 0, 0, 255)",
    "rgba(109, 0, 156, 255)",
    "rgba(0, 46, 221, 255)",
    "rgba(0, 164, 187, 255)",
    "rgba(0, 155, 18, 255)",
    "rgba(0, 225, 0, 255)",
    "rgba(203, 249, 0, 255)",
    "rgba(255, 173, 0, 255)",
    "rgba(227, 0, 0, 255)",
    "rgba(204, 204, 204, 255)",
  ],
  hsv: [
    "rgba(255, 0, 0, 255)",
    "rgba(255, 165, 0, 255)",
    "rgba(179, 255, 0, 255)",
    "rgba(7, 255, 0, 255)",
    "rgba(0, 255, 157, 255)",
    "rgba(0, 181, 255, 255)",
    "rgba(0, 15, 255, 255)",
    "rgba(155, 0, 255, 255)",
    "rgba(255, 0, 189, 255)",
    "rgba(255, 0, 23, 255)",
  ],
  tab10: [
    "rgba(31, 119, 180, 255)",
    "rgba(255, 127, 14, 255)",
    "rgba(44, 160, 44, 255)",
    "rgba(214, 39, 40, 255)",
    "rgba(148, 103, 189, 255)",
    "rgba(140, 86, 75, 255)",
    "rgba(227, 119, 194, 255)",
    "rgba(127, 127, 127, 255)",
    "rgba(188, 189, 34, 255)",
    "rgba(23, 190, 207, 255)",
  ],
  plasma: [
    "rgba(12, 7, 134, 255)",
    "rgba(69, 3, 158, 255)",
    "rgba(114, 0, 168, 255)",
    "rgba(155, 23, 158, 255)",
    "rgba(188, 54, 133, 255)",
    "rgba(215, 87, 107, 255)",
    "rgba(236, 120, 83, 255)",
    "rgba(250, 159, 58, 255)",
    "rgba(252, 201, 38, 255)",
    "rgba(239, 248, 33, 255)",
  ],
  Spectral: [
    "rgba(158, 1, 66, 255)",
    "rgba(216, 66, 77, 255)",
    "rgba(245, 121, 72, 255)",
    "rgba(253, 190, 110, 255)",
    "rgba(254, 237, 161, 255)",
    "rgba(240, 249, 168, 255)",
    "rgba(190, 229, 160, 255)",
    "rgba(115, 199, 164, 255)",
    "rgba(55, 141, 186, 255)",
    "rgba(94, 79, 162, 255)",
  ],
  tab20b: [
    "rgba(57, 59, 121, 255)",
    "rgba(107, 110, 207, 255)",
    "rgba(99, 121, 57, 255)",
    "rgba(181, 207, 107, 255)",
    "rgba(140, 109, 49, 255)",
    "rgba(231, 203, 148, 255)",
    "rgba(173, 73, 74, 255)",
    "rgba(231, 150, 156, 255)",
    "rgba(165, 81, 148, 255)",
    "rgba(222, 158, 214, 255)",
  ],
  tab20: [
    "rgba(31, 119, 180, 255)",
    "rgba(255, 127, 14, 255)",
    "rgba(44, 160, 44, 255)",
    "rgba(214, 39, 40, 255)",
    "rgba(148, 103, 189, 255)",
    "rgba(196, 156, 148, 255)",
    "rgba(247, 182, 210, 255)",
    "rgba(199, 199, 199, 255)",
    "rgba(219, 219, 141, 255)",
    "rgba(158, 218, 229, 255)",
  ],
  Paired: [
    "rgba(166, 206, 227, 255)",
    "rgba(31, 120, 180, 255)",
    "rgba(178, 223, 138, 255)",
    "rgba(251, 154, 153, 255)",
    "rgba(227, 26, 28, 255)",
    "rgba(253, 191, 111, 255)",
    "rgba(202, 178, 214, 255)",
    "rgba(106, 61, 154, 255)",
    "rgba(255, 255, 153, 255)",
    "rgba(177, 89, 40, 255)",
  ],
  jet: [
    "rgba(0, 0, 127, 255)",
    "rgba(0, 0, 254, 255)",
    "rgba(0, 96, 255, 255)",
    "rgba(0, 212, 255, 255)",
    "rgba(76, 255, 170, 255)",
    "rgba(170, 255, 76, 255)",
    "rgba(255, 229, 0, 255)",
    "rgba(255, 122, 0, 255)",
    "rgba(254, 18, 0, 255)",
    "rgba(127, 0, 0, 255)",
  ],
};
