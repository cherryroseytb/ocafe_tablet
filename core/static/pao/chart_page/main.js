import ChartPageManager from "./chart_page_manager.js";

const RAW_DATA_TABLE_ID = "raw-data-table-container";
const RAW_DATA_CHART_ID = "raw-data-chart-container";
const RESULTS_TABLE_ID = "results-table-container";
const RESULTS_CHART_ID = "results-chart-container";
const SELECT_FIT_ID = "select-fit-type";
const REGRESSION_BUTTON_ID = "btn-regression";
const EXTRACT_BUTTON_ID = "btn-extract-fit";
const SAVE_DATA_BUTTON_ID = "btn-save-data";
const GRAPH_STYLE_BUTTON_ID = "btn-graph-style";
const RESULTS_GRAPH_STYLE_BUTTON_ID = "btn-graph-style-results";

document.addEventListener("DOMContentLoaded", async () => {
  const rawTableContainer = document.getElementById(RAW_DATA_TABLE_ID);
  const rawChartContainer = document.getElementById(RAW_DATA_CHART_ID);
  const resultsTableContainer = document.getElementById(RESULTS_TABLE_ID);
  const resultsChartContainer = document.getElementById(RESULTS_CHART_ID);
  const selectFitElement = /** @type {HTMLSelectElement | null} */ (
    document.getElementById(SELECT_FIT_ID)
  );
  const regressionButton = /** @type {HTMLButtonElement | null} */ (
    document.getElementById(REGRESSION_BUTTON_ID)
  );
  const extractButtonElement = /** @type {HTMLButtonElement | null} */ (
    document.getElementById(EXTRACT_BUTTON_ID)
  );
  const saveDataButton = /** @type {HTMLButtonElement | null} */ (
    document.getElementById(SAVE_DATA_BUTTON_ID)
  );
  const graphStyleButton = /** @type {HTMLButtonElement | null} */ (
    document.getElementById(GRAPH_STYLE_BUTTON_ID)
  );
  const resultsGraphStyleButton = /** @type {HTMLButtonElement | null} */ (
    document.getElementById(RESULTS_GRAPH_STYLE_BUTTON_ID)
  );

  if (
    !rawTableContainer ||
    !rawChartContainer ||
    !resultsTableContainer ||
    !regressionButton ||
    !selectFitElement ||
    !extractButtonElement ||
    !graphStyleButton ||
    !saveDataButton ||
    !resultsGraphStyleButton
  ) {
    console.error(
      "ChartPageManager: One or more critical UI elements not found.",
    );
    alert("Critical page elements missing. Cannot initialize page.");
    return;
  }

  try {
    new ChartPageManager({
      rawTableContainer,
      rawChartContainer,
      resultsTableContainer,
      regressionButton,
      selectFitElement,
      extractButtonElement,
      resultsChartContainer,
      saveDataButton,
      graphStyleButton,
      resultsGraphStyleButton,
    });
  } catch (error) {
    console.error("Failed to instantiate ChartPageManager:", error);
    alert("Error initializing page logic.");
  }
});
