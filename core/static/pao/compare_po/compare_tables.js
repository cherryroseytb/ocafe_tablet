const tableLayout = {
  layout: "fitDataFill", // fitDataFill, fitDataStretch, fitDataTable, fitColumns
  headerSortClickElement: "icon",
  selectableRange: true, // Rows 옵션과 따로 써야함.
  selectableRangeColumns: true,
  selectableRangeRows: true,
  selectableRangeClearCells: true,
  editTriggerEvent: "dblclick", //trigger edit on double click, spreadsheet에서 편집 사용 시 항상 선언되어야 함.
  editorEmptyValue: undefined,
  clipboard: true, // true, false, "copy", "paste"
  clipboardCopyRowRange: "range",
  clipboardCopyConfig: {
    rowHeaders: false, //do not include row headers in clipboard output
    columnHeaders: false, //do not include column headers in clipboard output
  },
  clipboardPasteParser: "range",
  clipboardPasteAction: "range",
  clipboardCopyStyled: false,
  // MovableColumns: true, column 선택 기능과 충돌하기 때문에 안됨
  history: true,
};

//define column header menu as column visibility toggle
var headerMenu = function () {
  var menu = [];
  var columns = this.getColumns().slice();
  [, ...columns] = columns.slice(2);

  for (let column of columns) {
    //create checkbox element using font awesome icons
    let icon = document.createElement("i");
    icon.classList.add("fas");
    icon.classList.add(column.isVisible() ? "fa-check-square" : "fa-square");

    //build label
    let label = document.createElement("span");
    let title = document.createElement("span");

    title.textContent = " " + column.getDefinition().title;

    label.appendChild(icon);
    label.appendChild(title);

    //create menu item
    menu.push({
      label: label,
      action: function (e) {
        //prevent menu closing
        e.stopPropagation();

        //toggle current column visibility
        column.toggle();

        //change menu item icon
        if (column.isVisible()) {
          icon.classList.remove("fa-square");
          icon.classList.add("fa-check-square");
        } else {
          icon.classList.remove("fa-check-square");
          icon.classList.add("fa-square");
        }
      },
    });
  }

  return menu;
};

class VJLTableEditor {
  constructor(url, container, extraURLs) {
    let productspecID;
    this.productspecID = productspecID;
    this.container = container;
    this.extraURLs = extraURLs;
    this.url = url;
    this.vjlDataConfig = {
      ajaxURL: this.url,
      ajaxResponse: (url, params, response) => {
        htmx.trigger(document.body, "toast-message", {
          tag: response.tag,
          message: response.msg,
        });
        if (response.tag !== "success") {
          return [];
        } else {
          return response.data; //return the response data to tabulator
        }
      },
    };
    if (Object.keys(profileVJLTableData).length !== 0) {
      this.vjlDataConfig["data"] = profileVJLTableData;
    }
    this.init(); // Start initialization
  }
  init() {
    this.table = new Tabulator(this.container, {
      // height:"100%", // WARNING:rubber banding while scrolling when you enable
      ...this.vjlDataConfig,
      columnDefaults: {
        headerSort: true,
        headerHozAlign: "center",
        editor: false,
        resizable: "header",
      },
      rowHeader: {
        formatter: "rownum", //rowSelection
        // field: "_id", // not working
        // titleFormatter: "rowSelection",
        headerSort: false,
        resizable: false,
        frozen: true,
        headerHozAlign: "center",
        hozAlign: "right",
        // cellClick: function (e, cell) {
        //     cell.getRow().toggleSelect();
        // },
      },
      index: "id",
      columns: [
        {
          title: "doe_id",
          field: "doe_id",
          validator: "integer",
          visible: false,
          headerMenu: headerMenu,
        },
        {
          title: "id",
          field: "id",
          validator: "integer",
          visible: false,
          headerMenu: headerMenu,
        },
        {
          title: "IVL ID",
          field: "ivl_id",
          validator: "integer",
          headerFilter: "input",
          headerHozAlign: "left",
          hozAlign: "left",
          headerMenu: headerMenu,
        },
        {
          title: "조건",
          field: "condition",
          validator: "string",
          headerFilter: "input",
          headerHozAlign: "left",
          hozAlign: "left",
          headerMenu: headerMenu,
        },
        {
          title: "색",
          field: "color",
          validator: "string",
          headerFilter: "list",
          formatter: function (cell, formatterParams, onRendered) {
            //cell - the cell component
            //formatterParams - parameters set for the column
            //onRendered - function to call when the formatter has been rendered
            const colorCode = {
              R: "red",
              G: "green",
              B: "blue",
              W: "black",
            };
            return `<b style="color:${
              colorCode[cell.getValue()]
            }">${cell.getValue()}</b>`; //return the contents of the cell;
          },
          headerFilterParams: {
            values: [
              { label: "-", value: "" },
              { label: "R", value: "R" },
              { label: "G", value: "G" },
              { label: "B", value: "B" },
            ],
          },
          headerHozAlign: "center",
          hozAlign: "center",
          headerMenu: headerMenu,
        },
        {
          title: "목표전압1",
          field: "목표전압1",
          validator: "float",
          headerHozAlign: "right",
          hozAlign: "right",
          headerMenu: headerMenu,
        },
        {
          title: "Vth<br>@0.001(J)",
          field: "predicted_Vth",
          validator: "float",
          headerHozAlign: "right",
          hozAlign: "right",
          headerMenu: headerMenu,
        },
        {
          title: "목표전압2",
          field: "목표전압2",
          validator: "float",
          headerHozAlign: "right",
          hozAlign: "right",
          headerMenu: headerMenu,
        },
        {
          title: "x",
          field: "x",
          validator: "float",
          headerHozAlign: "right",
          hozAlign: "right",
          headerMenu: headerMenu,
        },
        {
          title: "y",
          field: "y",
          validator: "float",
          headerHozAlign: "right",
          hozAlign: "right",
          headerMenu: headerMenu,
        },
        {
          title: "CE<br>(cd/A)",
          field: "CE(cd/A)",
          validator: "float",
          headerHozAlign: "right",
          hozAlign: "right",
          headerMenu: headerMenu,
        },
        {
          title: "Max Calc<br>(cd/m2)",
          field: "Max Calc cd/m2",
          validator: "float",
          headerHozAlign: "right",
          hozAlign: "right",
          headerMenu: headerMenu,
        },
        {
          title: "Max 효율",
          field: "Max 효율",
          validator: "float",
          headerHozAlign: "right",
          hozAlign: "right",
          headerMenu: headerMenu,
        },
        {
          title: "Current<br>(mA)",
          field: "Current(mA)",
          validator: "float",
          headerHozAlign: "right",
          hozAlign: "right",
          headerMenu: headerMenu,
        },
        {
          title: "J<br>(mA/cm2)",
          field: "J(mA/cm2)",
          validator: "float",
          headerHozAlign: "right",
          hozAlign: "right",
          headerMenu: headerMenu,
        },
        {
          title: "색좌표",
          field: "색좌표",
          validator: "float",
          headerHozAlign: "right",
          hozAlign: "right",
          headerMenu: headerMenu,
        },
        {
          title: "BI",
          field: "BI",
          validator: "float",
          headerHozAlign: "right",
          hozAlign: "right",
          headerMenu: headerMenu,
        },

        {
          title: "환산효율",
          field: "환산효율",
          validator: "float",
          headerHozAlign: "right",
          hozAlign: "right",
          headerMenu: headerMenu,
        },
        {
          title: "추세선<br>환산효율",
          field: "추세선 환산효율",
          validator: "float",
          headerHozAlign: "right",
          hozAlign: "right",
          headerMenu: headerMenu,
        },
        {
          title: "환산 조건",
          field: "ce_condition",
          validator: "string",
          editor: "list",
          editorParams: (cell) => {
            const data = cell.getData();
            const color = data.color;

            if (!color) {
              console.warn("No color found for row:", data);
              return { values: [] };
            }
            const url = this.extraURLs.getCECondBaseUrl;
            return {
              valuesURL: `${url}?color=${encodeURIComponent(color)}`,
              //Value Lookup Configuration (use these with valuesLookup Option)
              valuesLookupField: "value", //the field to lookup values from

              //General Options
              clearable: true, //show clear "x" button on editor
              verticalNavigation: "hybrid", //navigate to new row when at the top or bottom of the selection list
              placeholderLoading: "Loading List...", //set custom placeholder when loading list values
              placeholderEmpty: "No Results Found", //set custom placeholder when list is empty
            };
          },
          cellEdited: (cell) => {
            var data = cell.getData();
            var row = cell.getRow();

            const id = data.id;
            const productspecID = document.getElementById("id_label").value;
            const ce_condition = data.ce_condition;

            if (!id || !productspecID || !ce_condition) {
              console.warn("필수 데이터 누락:", {
                id,
                productspecID,
                ce_condition,
              });
              return;
            }

            fetch(
              `${
                this.extraURLs.updateTrendEffBaseUrl
              }?id=${id}&productspec_id=${encodeURIComponent(
                productspecID,
              )}&ce_condition=${encodeURIComponent(ce_condition)}`,
            )
              .then((response) => response.json())
              .then((result) => {
                if (result.tag === "success") {
                  row.update({ "추세선 환산효율": result.message });
                } else if (result.tag === "error") {
                  if (result.message === "색상 불일치") {
                    row.update({ "추세선 환산효율": result.message });
                  }
                } else if (result.tag === "warning") {
                  //  **새로 추가된 경고 처리 블록**
                  htmx.trigger(document.body, "toast-message", {
                    tag: "warning",
                    message: result.message,
                  });
                } else {
                  htmx.trigger(document.body, "toast-message", result);
                }
              })
              .catch((error) => {
                console.error("요청 처리 중 오류 발생:", error);
                htmx.trigger(document.body, "toast-message", {
                  tag: "error",
                  message: "시스템 오류가 발생했습니다.",
                });
              });
          },
          headerMenu: headerMenu,
        },
        {
          title: "LE<br>(lm/W)",
          field: "LE(lm/W)",
          validator: "float",
          headerMenu: headerMenu,
          headerHozAlign: "right",
          hozAlign: "right",
        },

        {
          title: "cd/m2<br>(nit)",
          field: "cd/m2(nit)",
          validator: "float",
          headerMenu: headerMenu,
          headerHozAlign: "right",
          hozAlign: "right",
        },
        {
          title: "판정",
          field: "판정",
          validator: "string",
          headerMenu: headerMenu,
          headerHozAlign: "right",
          hozAlign: "right",
        },
      ],
      ...tableLayout,
    });

    this.submitBtnInit();
    this.regressionBtnInit();
    this.plotBtnInit();
    this.multiCellEditBtn();
  }

  multiCellEditBtn() {
    const btn = document.getElementById("editCellBtn");
    btn.addEventListener("click", async (e) => {
      const tableRanges = this.table.getRanges();
      const uniqueRowsData = [
        ...new Set(
          tableRanges.flatMap((range) =>
            range.getRows().map((row) => JSON.stringify(row.getData())),
          ),
        ),
      ].map(JSON.parse);

      const selectedIds = new Set(uniqueRowsData.map((row) => row.id));

      const ce_input = document.getElementById("ce_condition_list");
      if (!ce_input) {
        // 엘리먼트가 없을 경우 예외 처리
        return;
      }
      const ce_condition = ce_input.value;

      this.table.getRows().forEach((rowComp) => {
        const data = rowComp.getData();

        // Match rows via unique ID to avoid reference mismatch
        if (selectedIds.has(data.id)) {
          const cell = rowComp.getCell("ce_condition");
          if (cell) {
            cell.setValue(ce_condition, true); // true triggers cellEdited
          } else {
            console.warn(
              `Cell for 'ce_condition' not found in row with ID=${data.id}`,
            );
          }
        }
      });
    });
  }

  submitBtnInit() {
    const form = document.getElementById("fittingForm");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById("formSubmit");
      const originalBtnText = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = `
                            <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>환산 중
                        `;
      const ids = this.table
        .getData()
        .map((item) => item.id)
        .join(",");

      if (ids.length && form.querySelector("select[name='label']").value) {
        const urlParams = new URLSearchParams(new FormData(form));
        urlParams.set("ids", ids);
        this.productspecID = form.querySelector("select[name='label']").value;
        urlParams.set("productspec_id", this.productspecID);
        urlParams.delete("label");

        try {
          const response = await fetch(
            `${form.action}?${urlParams.toString()}`,
            {
              headers: { Accept: "application/json" },
            },
          );
          const data = await response.json();
          this.table.setData(data);
        } catch (error) {
          console.error("Error fetching updated data:", error);
        } finally {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalBtnText;
        }
      } else {
        if (!this.productspecID) {
          htmx.trigger(document.body, "toast-message", {
            message: "제품 스펙을 선택하세요.",
            tag: "warning",
          });
        } else {
          htmx.trigger(document.body, "toast-message", {
            message: "환산할 IVL 데이터가 없습니다.",
            tag: "warning",
          });
        }
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
        return;
      }
    });
  }

  regressionBtnInit() {
    document
      .getElementById("regressionBtn")
      .addEventListener("click", async () => {
        const data = this.table.getData();
        const keys = [
          "CE(cd/A)",
          "x",
          "y",
          "color",
          "id",
          "doe_id",
          "ivl_id",
          "condition",
          "exp_date",
        ];
        const filteredData = data.map((item) =>
          keys.reduce((acc, key) => {
            if (Object.prototype.hasOwnProperty.call(item, key)) {
              acc[key] = item[key];
            }
            return acc;
          }, {}),
        );

        const compareUrl = this.extraURLs.compareUrl;

        const bodyData = {
          data: filteredData,
          rx: document.getElementById("id_rx").value,
          gx: document.getElementById("id_gx").value,
          by: document.getElementById("id_by").value,
        };

        // POST 요청으로 데이터를 서버에 저장
        const url = this.extraURLs.storeRegBaseUrl;

        try {
          const res = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-CSRFToken": getCookie("csrftoken"),
              "X-Compare-Url": compareUrl,
            },
            body: JSON.stringify(bodyData),
          });

          if (res.ok) {
            const result = await res.json();
            window.location.href = `${result.redirect_url}`;
          } else {
            return response.json().then((errorData) => {
              showToastError(errorData.error);
            });
          }
        } catch (error) {
          console.error("Error:", error);
        }
      });
  }

  plotBtnInit() {
    document.getElementById("plotBtn").addEventListener("click", async () => {
      const tableRanges = this.table.getRanges();
      const uniqueRowsData = [
        ...new Set(
          tableRanges.flatMap((range) =>
            range.getRows().map((row) => JSON.stringify(row.getData())),
          ),
        ),
      ].map(JSON.parse);

      const ids = uniqueRowsData.map((row) => row.id);
      const graphURL = `${this.extraURLs.getGraphBaseUrl}?ids=${ids.join(",")}`;

      fetch(graphURL)
        .then(function (res) {
          if (!res.ok) {
            throw new Error(`HTTP 오류: ${res.status}`);
          }
          return res.json();
        })
        .then(function (data) {
          if (data.tag === "success") {
            // 그래프 업데이트
            const vjl_layout = document.getElementById("vjl-chart").layout;
            const cj_layout = document.getElementById("cj-chart").layout;
            const el_layout = document.getElementById("el-chart").layout;
            Plotly.react("vjl-chart", data.vjl_data, vjl_layout);
            Plotly.react("cj-chart", data.cj_data, cj_layout);
            Plotly.react("el-chart", data.el_data, el_layout);

            // 로딩 완료 후 그래프로 이동
            document
              .getElementById("rawExperimentData")
              .scrollIntoView({ behavior: "instant" });
          } else {
            htmx.trigger(document.body, "toast-message", data);
          }
        })
        .catch(function (error) {
          console.error("그래프 요청 실패:", error);
          htmx.trigger(document.body, "toast-message", {
            message: "그래프 생성에 실패했습니다.",
            tag: "error",
          });
        });
    });
  }
}

class LTTableEditor {
  constructor(url, container, extraURLs) {
    this.container = container;
    this.url = url;
    this.extraURLs = extraURLs;
    this.init(); // Start initialization
  }

  init() {
    //console.log("fullUrl on init", this.fullUrl);
    this.table = new Tabulator(this.container, {
      data: [],
      columnDefaults: {
        headerSort: true,
        headerHozAlign: "center",
        editor: false,
        resizable: "header",
      },
      rowHeader: {
        formatter: "rownum", //rowSelection
        // titleFormatter: "rowSelection",
        headerSort: false,
        resizable: false,
        frozen: true,
        headerHozAlign: "center",
        hozAlign: "right",
        // cellClick: function (e, cell) {
        //     cell.getRow().toggleSelect();
        // },
      },
      columns: [
        {
          title: "id",
          field: "id",
          validator: "integer",
          visible: false,
        },
        {
          title: "doe_id",
          field: "doe_id",
          validator: "integer",
          visible: false,
        },
        {
          title: "LT ID",
          field: "lt_id",
          headerFilter: "input",
          headerHozAlign: "left",
          hozAlign: "left",
          validator: "integer",
        },
        {
          title: "조건",
          field: "condition",
          validator: "string",
          headerHozAlign: "left",
          hozAlign: "left",
          headerFilter: "input",
        },
        {
          title: "색",
          field: "color",
          validator: "string",
          headerFilter: "list",
          headerFilterParams: {
            values: [
              { label: "-", value: "" },
              { label: "R", value: "R" },
              { label: "G", value: "G" },
              { label: "B", value: "B" },
            ],
          },
          formatter: function (cell, formatterParams, onRendered) {
            //cell - the cell component
            //formatterParams - parameters set for the column
            //onRendered - function to call when the formatter has been rendered
            const colorCode = {
              R: "red",
              G: "green",
              B: "blue",
              W: "black",
            };
            return `<b style="color:${
              colorCode[cell.getValue()]
            }">${cell.getValue()}</b>`; //return the contents of the cell;
          },
          headerHozAlign: "center",
          hozAlign: "center",
        },
        {
          title: "거치전류<br>(mA)",
          field: "current",
          headerHozAlign: "right",
          hozAlign: "right",
          validator: "integer",
        },
        {
          title: "PhotoVolt<br>(V)",
          field: "photovolt",
          headerHozAlign: "right",
          hozAlign: "right",
          validator: "integer",
        },
        {
          title: "거치시간<br>(hr)",
          field: "elapsed_time",
          headerHozAlign: "right",
          hozAlign: "right",
          validator: "integer",
        },
        {
          title: "SED<br>(hr)",
          field: "sed_fitting_T95",
          headerHozAlign: "right",
          hozAlign: "right",
          validator: "integer",
        },
        {
          title: "Linear<br>(hr)",
          field: "linear_fitting_T95",
          headerHozAlign: "right",
          hozAlign: "right",
          validator: "integer",
          formatter: (cell, formatterParams, onRendered) => {
            const row = cell.getRow().getData();
            const val = cell.getValue();
            return row.approximate_linear ? `${val}*` : val;
          },
        },
      ],
      ...tableLayout,
    });
    this.reloadBtnInit();
    this.loadData();
    this.plotBtnInit();
  }
  reloadBtnInit() {
    document.getElementById("reloadBtn").addEventListener("click", () => {
      const agingTime = document.getElementById("agingInput").value;
      this.table.clearData();
      this.loadData(agingTime); // 버튼 누를 때도 동일 로직 사용
    });
  }

  loadData(agingTime = 3) {
    // 기본값 설정
    const joiner = this.url.includes("?") ? "&" : "?";
    const fullUrl = `${this.url}${joiner}aging_time=${agingTime}`;

    fetch(fullUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP 오류: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (data.tag === "success") {
          this.table.setData(data.table_data);
        } else {
          htmx.trigger(document.body, "toast-message", data);
        }
      })
      .catch((error) => {
        console.error("데이터 요청 실패:", error);
        const toastMessage = {
          message: "데이터를 불러오지 못했습니다.",
          tag: "error",
        };
        htmx.trigger(document.body, "toast-message", toastMessage);
      });
  }

  plotBtnInit() {
    document.getElementById("plotltBtn").addEventListener("click", async () => {
      const agingTime = document.getElementById("agingInput").value;
      // 선택한 행의 ID를 가져옵니다.
      const tableRanges = this.table.getRanges();
      const uniqueRowsData = [
        ...new Set(
          tableRanges.flatMap((range) =>
            range.getRows().map((row) => JSON.stringify(row.getData())),
          ),
        ),
      ].map(JSON.parse);

      const ids = uniqueRowsData.map((row) => row.id);
      console.log("ltids", ids);

      const linearChecked = document.getElementById("toggleLinear").checked;
      const sedChecked = document.getElementById("toggleSed").checked;

      const joiner = this.extraURLs.getltGraphBaseUrl.includes("?") ? "&" : "?";
      const graphURL = `${
        this.extraURLs.getltGraphBaseUrl
      }${joiner}ids=${ids.join(
        ",",
      )}&aging_time=${agingTime}&linear=${linearChecked}&sed=${sedChecked}`;
      console.log("GraphURL", graphURL);
      // 그래프 데이터를 가져옵니다.
      fetch(graphURL)
        .then(function (res) {
          if (!res.ok) {
            throw new Error(`HTTP 오류: ${res.status}`);
          }
          return res.json();
        })
        .then(function (data) {
          if (data.tag === "success") {
            // 그래프를 업데이트합니다.
            console.log("data", data);
            // lt_chart 안불러와도 되는지????????
            // const lt_layout = document.getElementById("lt-chart").layout;
            // if (data.layout?.xaxis?.range) {
            //   Plotly.relayout("lt-chart", {
            //     "xaxis.range": data.layout.xaxis.range,
            //   });
            // }
            Plotly.react("lt-chart", data.lt_data, data.layout);
            // console.log("lt_layout_final", lt_layout);
          } else {
            // 오류 메시지를 표시합니다.
            htmx.trigger(document.body, "toast-message", data);
          }
        })
        .catch(function (error) {
          console.error("그래프 요청 실패:", error);
          // 오류 메시지를 표시합니다.
          htmx.trigger(document.body, "toast-message", {
            message: "그래프 생성에 실패했습니다.",
            tag: "error",
          });
        });
    });
  }

  // loadData(agingTime = 3) {
  //   // 기본값 설정
  //   const joiner = this.url.includes("?") ? "&" : "?";
  //   const fullUrl = `${this.url}${joiner}aging_time=${agingTime}`;

  //   fetch(fullUrl)
  //     .then((res) => {
  //       if (!res.ok) throw new Error(`HTTP 오류: ${res.status}`);
  //       return res.json();
  //     })
  //     .then((data) => {
  //       if (data.tag === "success") {
  //         const lt_layout = document.getElementById("lt-chart").layout;
  //         Plotly.react("lt-chart", data.lt_data, lt_layout);
  //         this.table.setData(data.selected_data);
  //         htmx.trigger(document.body, "toast-message", data);
  //       } else {
  //         htmx.trigger(document.body, "toast-message", data);
  //       }
  //     })
  //     .catch((error) => {
  //       console.error("데이터 요청 실패:", error);
  //       const toastMessage = {
  //         message: "데이터를 불러오지 못했습니다.",
  //         tag: "error",
  //       };
  //       htmx.trigger(document.body, "toast-message", toastMessage);
  //     });
  // }
}

class CVTableEditor {
  constructor(url, container) {
    this.container = container;
    this.url = url;
    this.init(); // Start initialization
  }

  init() {
    this.table = new Tabulator(this.container, {
      data: [],
      columnDefaults: {
        headerSort: true,
        headerHozAlign: "center",
        editor: false,
        resizable: "header",
      },
      rowHeader: {
        formatter: "rownum", //rowSelection
        // titleFormatter: "rowSelection",
        headerSort: false,
        resizable: false,
        frozen: true,
        headerHozAlign: "center",
        hozAlign: "right",
        // cellClick: function (e, cell) {
        //     cell.getRow().toggleSelect();
        // },
      },
      columns: [
        { title: "id", field: "id", validator: "integer", visible: false },
        {
          title: "doe_id",
          field: "doe_id",
          validator: "integer",
          visible: false,
        },
        {
          title: "CV ID",
          field: "cv_id",
          headerHozAlign: "left",
          hozAlign: "left",
          validator: "integer",
        },
        {
          title: "조건",
          field: "condition",
          headerHozAlign: "left",
          hozAlign: "left",
          validator: "string",
        },
        { title: "색", field: "color", validator: "string", visible: false },
        {
          title: "Raw off<br>(F@-2V)",
          field: "real_off",
          headerHozAlign: "right",
          hozAlign: "right",
          validator: "integer",
        },
        {
          title: "Raw Max<br>(F)",
          field: "real_max",
          headerHozAlign: "right",
          hozAlign: "right",
          validator: "integer",
        },
        {
          title: "면적 off<br>(F/mm<sup>2</sup>@-2V)",
          field: "cap_area_off",
          headerHozAlign: "right",
          hozAlign: "right",
          validator: "integer",
        },
        {
          title: "면적 Max<br>(F/mm<sup>2</sup>)",
          field: "cap_area_max",
          headerHozAlign: "right",
          hozAlign: "right",
          validator: "integer",
        },
        {
          title: "Simps 면적<br>(C 쿨롱)",
          field: "simps",
          headerHozAlign: "right",
          hozAlign: "right",
          validator: "integer",
        },
        {
          title: "Trapz 면적<br>(C 쿨롱)",
          field: "trapz",
          headerHozAlign: "right",
          hozAlign: "right",
          validator: "integer",
        },
      ],
      ...tableLayout,
    });

    this.loadData();
  }

  async loadData() {
    try {
      const response = await fetch(this.url); // fetch()는 Promise 반환
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      const data = await response.json();
      if (data.tag === "success") {
        const cv_layout = document.getElementById("cv-chart").layout;
        this.table.setData(data.selected_data); // 테이블 갱신
        Plotly.react("cv-chart", data.cv_data, cv_layout); // 차트 업데이트
      }

      // 토스트 메시지 전달 (성공/실패와 관계없이 실행)
      htmx.trigger(document.body, "toast-message", data);
    } catch (error) {
      console.error("로딩 중 오류 발생:", error);
      htmx.trigger(document.body, "toast-message", {
        tag: "error",
        message: error.message,
      });
    }
  }
}

class IVTableEditor {
  constructor(url, container, getJUrl) {
    this.container = container;
    this.url = url;
    this.getJUrl = getJUrl;
    this.init(); // Start initialization
  }

  init() {
    this.table = new Tabulator(this.container, {
      data: [],
      columnDefaults: {
        headerSort: true,
        headerHozAlign: "center",
        editor: false,
        resizable: "header",
      },
      rowHeader: {
        formatter: "rownum", //rowSelection
        // titleFormatter: "rowSelection",
        headerSort: false,
        resizable: false,
        frozen: true,
        headerHozAlign: "center",
        hozAlign: "right",
        // cellClick: function (e, cell) {
        //     cell.getRow().toggleSelect();
        // },
      },
      columns: [
        { title: "id", field: "id", validator: "integer", visible: false },
        {
          title: "doe_id",
          field: "doe_id",
          validator: "integer",
          visible: false,
        },
        {
          title: "IV ID",
          field: "iv_id",
          headerHozAlign: "left",
          hozAlign: "left",
          validator: "integer",
        },
        {
          title: "조건",
          field: "condition",
          headerHozAlign: "left",
          hozAlign: "left",
          validator: "string",
        },
        { title: "색", field: "color", validator: "string", visible: false },
        {
          title: "LLC<br>(@0V)",
          field: "LLC_at_0V_str",
          headerHozAlign: "right",
          hozAlign: "right",
          validator: "integer",
        },
        {
          title: "J @Vth<br>(0.001V)",
          field: "j_at_vth_str",
          headerHozAlign: "right",
          hozAlign: "right",
          validator: "integer",
        },
        {
          title: "Input V",
          field: "v_input",
          editor: "number", //
          editorParams: {
            step: 0.001,
            min: 0,
            placeholder: "V 입력",
            elementAttributes: { maxlength: "100" },
            selectContents: true,
            verticalNavigation: "table",
          },
          cellEdited: async (cell) => {
            const row = cell.getRow();
            const data = row.getData();
            const v = parseFloat(data.v_input);
            const ivId = data.id;
            if (isNaN(v)) {
              row.update({ j_result: "잘못된 v" });
              return;
            }
            const fetchUrl = `${this.getJUrl}?v=${v}&id=${ivId}`;
            try {
              const res = await fetch(fetchUrl);
              const result = await res.json();
              if (result.tag === "success") {
                data.j_result = result.j.toExponential(3);
                row.update({ j_result: data.j_result });
              } else {
                htmx.trigger(document.body, "toast-message", {
                  tag: "error",
                  message: result.message,
                });
              }
            } catch (err) {
              htmx.trigger(document.body, "toast-message", {
                tag: "error",
                message: `fetch 실패: ${err}`,
              });
            }
          },
          headerHozAlign: "right",
          hozAlign: "right",
        },
        {
          title: "J 결과",
          field: "j_result",
          headerHozAlign: "right",
          hozAlign: "right",
          formatter: "plaintext",
        },
      ],
      ...tableLayout,
    });

    this.loadData();
  }

  async loadData() {
    try {
      const response = await fetch(this.url); // fetch()는 Promise 반환
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      const data = await response.json();
      if (data.tag === "success") {
        const jv_layout = document.getElementById("iv-chart").layout;

        this.table.setData(data.selected_data); // 테이블 갱신
        Plotly.react("iv-chart", data.jv_data, jv_layout); // 차트 업데이트
      }
      // 토스트 메시지 전달 (성공/실패와 관계없이 실행)
      htmx.trigger(document.body, "toast-message", data);
    } catch (error) {
      console.error("로딩 중 오류 발생:", error);
      htmx.trigger(document.body, "toast-message", {
        tag: "error",
        message: error.message,
      });
    }
  }
}
