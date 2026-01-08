/**
 * JSON 파일을 가져오는 함수
 *
 * @param {string} path The path to the JSON file.
 * @returns {Promise<any>} The JSON data.
 */
export async function fetchJson(path) {
  try {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(
        `HTTP error loading raw data! status: ${response.status}`,
      );
    }
    return response.json();
  } catch (error) {
    console.error("Error fetching JSON:", error);
    return [];
  }
}

/**
 * 마지막 x 값과 마지막 y 값에 따라 색상을 결정합니다.
 *
 * @param {number} lastXValue 마지막 x 값.
 * @param {number} lastYValue 마지막 y 값.
 * @param {number} [xThreshold=0.6] x 값 임계값.
 * @param {number} [yThreshold=0.2] y 값 임계값.
 * @returns {string} 결정된 색상.
 */
export function checkColor(
  lastXValue,
  lastYValue,
  xThreshold = 0.6,
  yThreshold = 0.2,
) {
  if (lastXValue > xThreshold) {
    return "R";
  } else if (lastYValue < yThreshold) {
    return lastYValue === 0 ? "-" : "B";
  } else {
    return "G";
  }
}

/**
 * 주어진 색상에 대한 원시 차트 데이터를 계산합니다.
 *
 * @param {import("tabulator-tables").RowComponent[]} rows 원시 데이터.
 * @returns {Array<{x: number, y: number}>} 원시 차트 데이터.
 */
export function calculateRawChartData(rows) {
  if (!rows.length) return [];

  const color = rows[rows.length - 1].getData().Color;
  if (color === "B") {
    return rows
      .map((row) => {
        const x = row.getData().y;
        const y = row.getData()["CE(cd/A)"] / row.getData().y;
        return { x, y };
      })
      .sort((a, b) => a.x - b.x);
  } else {
    return rows
      .map((row) => ({
        x: row.getData().x,
        y: row.getData()["CE(cd/A)"],
      }))
      .sort((a, b) => a.x - b.x);
  }
}

/**
 * 변환된 효율을 계산합니다.
 *
 * @param {string} color 색상. 'R', 'G', or 'B'
 * @param {{
 *  a1?: number | null,
 *  a2?: number | null,
 *  a3?: number | null,
 *  a0?: number | null,
 * }} coefficients 계수.
 * @returns {number} 변환된 효율.
 */
export function convertedEfficiency(color, bases, coefficients) {
  // const bases = { R: 0.682, G: 0.24, B: 0.045 };
  console.log(bases);
  if (!(color in bases)) {
    throw new Error("Invalid color");
  }

  const base = bases[color];
  const { a0, a1, a2, a3 } = coefficients;
  return (
    (a3 ?? 0) * Math.pow(base, 3) +
    (a2 ?? 0) * Math.pow(base, 2) +
    (a1 ?? 0) * base +
    (a0 ?? 0)
  );
}
