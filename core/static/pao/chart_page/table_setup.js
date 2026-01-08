import { checkColor } from "./helpers.js";

/**
 * Initialize the raw data table.
 *
 * @param {HTMLElement} container The container for the raw data table.
 * @param {Array<{ivl_id: number, "CE(cd/A)": number, x: number, y: number}>} initialData The initial data.
 * @returns {InstanceType<Tabulator>} The Tabulator instance for the raw data table.
 */
export function initializeRawDataTable(container, initialData) {
  if (!container) {
    console.error("Raw data table container not found.");
    return null;
  }

  const tableData = initialData.map((row) => ({
    ...row,
    Color: checkColor(row.x, row.y),
    Select: false,
  }));

  const tableInstance = new Tabulator(container, {
    height: "400px",
    layout: "fitColumns",
    data: tableData,
    placeholder: "데이터가 없습니다.",
    clipboard: "copy",
    clipboardCopyRowRange: "selected",
    selectableRows: true, //make rows selectable
    selectableRowsRangeMode: "click",
    columnDefaults: {
      headerSort: true,
      headerHozAlign: "center",
      resizable: true,
    },
    rowHeader: {
      formatter: "rownum", //rowSelection
      // titleFormatter: "rowSelection",
      headerSort: false,
      resizable: false,
      width: 50,
      frozen: true,
      headerHozAlign: "center",
      hozAlign: "center",
    },
    columns: [
      {
        title: "조건",
        field: "condition",
        hozAlign: "center",
        headerFilter: "input",
      },
      {
        title: "ID",
        field: "ivl_id",
        hozAlign: "center",
        headerFilter: "input",
      },
      {
        title: "CE<br>(cd/A)",
        field: "CE(cd/A)",
        hozAlign: "right",
        sorter: "number",
      },
      {
        title: "x",
        field: "x",
        hozAlign: "right",
        sorter: "number",
      },
      {
        title: "y",
        field: "y",
        hozAlign: "right",
        sorter: "number",
      },
    ],
  });

  return tableInstance;
}

/**
 * Initialize the results data table.
 *
 * @param {HTMLElement} container The container element for the results table.
 * @params {Array<{color: string, dopant: string, a3: number, a2: number, a1: number, a0: number, calcEff: number, fitData: string}>} initialData The initial data.
 * @returns {InstanceType<Tabulator> } The Tabulator instance
 */
export function initializeResultsTable(container, initialData) {
  if (!container) {
    console.error("Results table container not found.");
    return null;
  }

  const tableData = initialData.map((row) => ({
    ...row,
  }));

  const tableInstance = new Tabulator(container, {
    data: tableData,
    layout: "fitColumns",
    placeholder: "데이터가 없습니다.",
    maxHeight: "300px",
    clipboard: "copy",
    clipboardCopyRowRange: "selected",
    editTriggerEvent: "dblclick",
    dependencies: {
      DateTime: luxon.DateTime, //library implementation
    },
    rowHeader: {
      headerSort: false,
      resizable: false,
      width: 50,
      headerHozAlign: "center",
      hozAlign: "center",
      formatter: "rowSelection",
      titleFormatter: "rowSelection",
      cellClick: function (e, cell) {
        cell.getRow().toggleSelect();
      },
    },
    columnDefaults: {
      headerSort: true,
      headerHozAlign: "center",
      resizable: true,
    },
    columns: [
      {
        title: "id",
        field: "id",
        visible: false,
      },
      {
        title: "조건",
        field: "Condi",
        hozAlign: "center",
        editor: "input",
        headerFilter: "input",
      },
      {
        title: "Max<br>색좌표",
        field: "Max색좌표",
        hozAlign: "right",
        sorter: "number",
        editor: "number",
        validator: "max:1",
      },
      {
        title: "최소<br>범위",
        field: "minrange",
        hozAlign: "right",
        validator: ["min:0", "max:1"],
        editor: "number",
        editorParams: {
          min: 0,
          max: 1,
          step: 0.01,
        },
      },
      {
        title: "최대<br>범위",
        field: "maxrange",
        hozAlign: "right",
        editor: "number",
        validator: ["min:0", "max:1"],
        editor: "number",
        editorParams: {
          min: 0,
          max: 1,
          step: 0.01,
        },
      },
      {
        title: "투입<br>일자",
        field: "exp_date",
        hozAlign: "center",
        editor: "date",
        editorParams: {
          format: "yyyy-MM-dd", // the format of the date value stored in the cell
          verticalNavigation: "table", //navigate cursor around table without changing the value
          elementAttributes: {
            title: "slide bar to choose option", // custom tooltip
          },
        },
      },
      {
        title: "제품<br>스펙",
        field: "productLabel",
        hozAlign: "center",
        editor: "list",
        headerFilter: "input",
        editorParams: {
          values: labelChoices,
        },
      },
      {
        title: "ivl id",
        field: "ivl_id",
        visible: false,
      },
      {
        title: "색",
        field: "Color",
        hozAlign: "center",
        validator: "string",
        editor: "list",
        editorParams: {
          values: ["R", "G", "B"],
          clearable: true, //show clear "x" button on editor
        },
        headerFilter: "list",
        formatter: function (cell, formatterParams, onRendered) {
          //cell - the cell component
          //formatterParams - parameters set for the column
          //onRendered - function to call when the formatter has been rendered
          const colorCode = {
            R: "red",
            G: "green",
            B: "blue",
          };
          return `<b style="color:${
            colorCode[cell.getValue()]
          }">${cell.getValue()}</b>`; //return the contents of the cell;
        },
        headerFilterParams: {
          values: [
            { label: "R", value: "R" },
            { label: "G", value: "G" },
            { label: "B", value: "B" },
          ],
        },
      },
      {
        title: "3",
        field: "3",
        hozAlign: "right",
        sorter: "number",
        editor: "input",
      },
      {
        title: "2",
        field: "2",
        hozAlign: "right",
        sorter: "number",
        editor: "input",
      },
      {
        title: "1",
        field: "1",
        hozAlign: "right",
        sorter: "number",
        editor: "input",
      },
      {
        title: "0",
        field: "0",
        hozAlign: "right",
        sorter: "number",
        editor: "input",
      },
      {
        title: "환산<br>효율",
        field: "환산 효율",
        hozAlign: "right",
        sorter: "number",
        editor: "input",
      },
      {
        title: "작성자<br>(입력 X)",
        field: "작성자",
        hozAlign: "center",
        headerFilter: "input",
      },
      { title: "Data(hide)", field: "fitData", visible: false },
      {
        title: "삭제",
        formatter: function (cell) {
          const data = cell.getRow().getData();
          if (data["작성자"]) {
            return '<button class="btn btn-close btn-sm delete-btn"></button>';
          } else {
            return "";
          }
        },
        headerSort: false,
        resizable: false,
        headerHozAlign: "center",
        hozAlign: "center",
        width: 70,
        cellClick: function (e, cell) {
          const data = cell.getRow().getData();
          if (confirm("정말로 삭제하시겠습니까? 확인 시 되돌릴 수 없습니다.")) {
            const id = data["id"];
            const csrfToken = document.getElementsByName(
              "csrfmiddlewaretoken"
            )[0].value;
            fetch(REMOVE_CE_CONDITION_URL, {
              method: "POST",
              headers: {
                "X-Requested-With": "XMLHttpRequest",
                "X-CSRFToken": csrfToken,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ id: id }),
            })
              .then((response) => response.json())
              .then((data) => {
                htmx.trigger(document.body, "toast-message", data);
                if (data["tag"] === "success") {
                  if (cell.getRow().isSelected()) {
                    cell.getRow().deselect();
                  }
                  cell.getRow().delete();
                }
              })
              .catch((err) => {
                console.error("저장 중 에러:", err);
                htmx.trigger(document.body, "toast-message", {
                  message: `저장 중 오류가 발생했습니다: ${err}`,
                  tag: "error",
                });
              });
          }
        },
      },
    ],
  });

  document.getElementById("btn-add-row").addEventListener("click", function () {
    tableInstance.addRow({
      Max색좌표: -1,
      minrange: 0,
      maxrange: 1,
      Color: "R",
      0: 0,
      1: 0,
      2: 0,
      3: 0,
      "환산 효율": 0,
    });
  });

  return tableInstance;
}
