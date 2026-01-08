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
  constructor(container, extraURLs) {
    let productspecID;
    this.productspecID = productspecID;
    this.container = container;
    this.extraURLs = extraURLs;
    this.init();
  }
  init() {
    this.table = new Tabulator(this.container, {
      // height:"100%", // WARNING:rubber banding while scrolling when you enable
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
        hozAlign: "center",
        // cellClick: function (e, cell) {
        //     cell.getRow().toggleSelect();
        // },
      },
      index: "id",
      columns: [
        {
          title: "id",
          field: "ivl_id",
          visible: false,
          headerMenu: headerMenu,
        },
        {
          title: "IVL ID",
          field: "ivl_id",
          headerFilter: "input",
          headerMenu: headerMenu,
        },
        {
          title: "파일명",
          field: "file_name",
          headerFilter: "input",
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
          hozAlign: "center",
          headerMenu: headerMenu,
        },
        {
          title: "목표전압1",
          field: "목표전압1",
          validator: "float",
          headerMenu: headerMenu,
        },
        {
          title: "Vth<br>@0.001(J)",
          field: "predicted_Vth",
          validator: "float",
          headerMenu: headerMenu,
        },
        {
          title: "목표전압2",
          field: "목표전압2",
          validator: "float",
          headerMenu: headerMenu,
        },
        {
          title: "x",
          field: "x",
          validator: "float",
          headerMenu: headerMenu,
        },
        {
          title: "y",
          field: "y",
          validator: "float",
          headerMenu: headerMenu,
        },
        {
          title: "CE<br>(cd/A)",
          field: "CE(cd/A)",
          validator: "float",
          headerMenu: headerMenu,
        },
        {
          title: "Max Calc<br>cd/m2",
          field: "Max Calc cd/m2",
          validator: "float",
          headerMenu: headerMenu,
        },
        {
          title: "Max 효율",
          field: "Max 효율",
          validator: "float",
          headerMenu: headerMenu,
        },
        {
          title: "Current<br>(mA)",
          field: "Current(mA)",
          validator: "float",
          headerMenu: headerMenu,
        },
        {
          title: "J<br>(mA/cm2)",
          field: "J(mA/cm2)",
          validator: "float",
          headerMenu: headerMenu,
        },
        {
          title: "색좌표",
          field: "색좌표",
          validator: "float",
          headerMenu: headerMenu,
        },
        {
          title: "환산효율",
          field: "환산효율",
          validator: "float",
          headerMenu: headerMenu,
        },
        {
          title: "추세선<br>환산효율",
          field: "추세선 환산효율",
          validator: "float",
          visible: false,
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
          visible: false,
          headerMenu: headerMenu,
        },
        {
          title: "LE<br>(lm/W)",
          field: "LE(lm/W)",
          validator: "float",
          headerMenu: headerMenu,
        },

        {
          title: "cd/m2<br>(nit)",
          field: "cd/m2(nit)",
          validator: "float",
          headerMenu: headerMenu,
        },
        {
          title: "판정",
          field: "판정",
          validator: "string",
          headerMenu: headerMenu,
        },
      ],
      ...tableLayout,
    });

    this.submitBtnInit();
    //this.regressionBtnInit();
    this.plotBtnInit();
    //this.multiCellEditBtn();
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
      console.log("ids", ids);
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
