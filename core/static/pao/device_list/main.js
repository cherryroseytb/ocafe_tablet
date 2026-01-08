// View DOE structure
function viewStructure(id) {
  const structureUrl = deviceStructureBaseUrl.replace(0, id);
  fetch(structureUrl)
    .then((response) => response.text())
    .then((data) => {
      const structureArea = document.getElementById("structureArea");
      structureArea.insertAdjacentHTML("beforeend", data);
    });
}

// structure 테이블 삭제
function deleteTable(event) {
  // 테이블과 함께 내용이 삭제되는 로직 구현
  event.target.closest(".table-responsive").remove();
}

function confirmDelete() {
  return confirm("정말 삭제하시겠습니까?");
}

class deviceListEditor {
  constructor(url, container) {
    this.container = container;
    this.url = url;
    //doe list count 시 중복 방지 등
    this.selectedDoeMap = new Map();

    //offcanvas에 분석 프로필 : #표시
    this.existingIds = [];
    this.init(); // Start initialization
  }
  init() {
    this.table = new Tabulator(this.container, {
      ajaxURL: this.url,
      ajaxResponse: function (url, params, response) {
        //url - the URL of the request
        //params - the parameters passed with the request
        //response - the JSON object returned in the body of the response.
        response.data = response.data.map((item) => {
          let exptData = `IVL:${item.ivl_count}, LT:${item.lt_count}, CV:${item.cv_count}, IV:${item.iv_count}, Angle:${item.angle_count}`;
          if (DOE_PRODUCT_TYPE === "TV") {
            exptData = `IVL:${item.ivl_count}, LT:${item.lt_count}, Angle:${item.angle_count}`;
          } else if (DOE_PRODUCT_TYPE === "PO") {
            exptData = `IVL:${item.ivl_count}, LT:${item.lt_count}, CV:${item.cv_count}, IV:${item.iv_count}`;
          }

          return {
            ...item,
            tpid: `${item.runsheet_lot.toString().padStart(2, "0")}${item.gls_id
              .toString()
              .padStart(2, "0")}`,
            structure: `<button type="button" class="btn btn-sm btn-link p-0" onclick="viewStructure(${item.id})">
              View
            </button>`,
            exptData: exptData,
          };
        });

        return response; //return the response data to tabulator
      },
      ajaxURLGenerator: function (url, config, params) {
        //url - the url from the ajaxURL property or setData function
        //config - the request config object from the ajaxConfig property
        //params - the params object from the ajaxParams property, this will also include any pagination, filter and sorting properties based on table setup
        function addUrlParams(url, params) {
          const queryParams = {};

          // 페이지 및 크기 파라미터 추가
          if (params.page) queryParams.page = params.page;
          if (params.size) queryParams.size = params.size;
          if (params.sort.length !== 0)
            queryParams.sort = `${params.sort[0].field},${params.sort[0].dir}`;

          // 필터 조건 파라미터 추가
          params.filter.forEach((filter) => {
            queryParams[filter.field] = filter.value;
          });

          const searchParams = new URLSearchParams(queryParams);
          return `${url}&${searchParams.toString()}`;
        }
        const newUrl = addUrlParams(url, params);
        return newUrl;
      },
      layout: "fitDataFill",
      headerSortClickElement: "icon",
      clipboard: "copy", // true, false, "copy", "paste"
      clipboardCopyConfig: {
        rowHeaders: false, //do not include row headers in clipboard output
        columnHeaders: false, //do not include column headers in clipboard output
      },
      history: true,
      pagination: true, //enable pagination
      paginationMode: "remote", //enable remote pagination
      paginationSizeSelector: [10, 20, 30, 50, 100],
      paginationSize: 10,
      paginationCounter: "rows",
      filterMode: "remote",
      sortMode: "remote",
      columnDefaults: {
        headerSort: true,
        headerHozAlign: "center",
        editor: false,
        resizable: "header",
      },
      rowHeader: {
        formatter: "rowSelection",
        titleFormatter: "rowSelection",
        headerSort: false,
        resizable: false,
        frozen: true,
        headerHozAlign: "center",
        hozAlign: "center",
      },
      index: "id",
      columns: [
        {
          title: "id",
          field: "id",
          validator: "integer",
          visible: false,
        },
        {
          title: "생성일자",
          field: "created_at",
          visible: false,
        },
        {
          title: "작성자",
          field: "username",
          headerSort: false,
          headerFilter: "input",
          hozAlign: "center",
        },
        {
          title: "실험일자",
          field: "exp_date",
          sorter: "date",
          sorterParams: { format: "yyyy-MM-dd" },
          headerFilter: function (cell, onRendered, success, cancel) {
            // Create the date input element
            const input = document.createElement("input");
            input.type = "text";
            input.placeholder = "exp_date";
            input.id = "exactExpDateInput";

            // Render the date picker
            onRendered(function () {
              flatpickr(input, {
                dateFormat: "Y-m-d",
                onChange: function (selectedDates, dateStr, instance) {
                  success(input.value);
                },
              });
            });

            return input;
          },
          headerFilterLiveFilter: false, // Prevent immediate filtering on every input change
          hozAlign: "center",
        },
        {
          title: "모델",
          field: "model",
          headerFilter: "input",
          hozAlign: "center",
        },
        {
          title: "차수",
          field: "sequence",
          headerFilter: "input",
          hozAlign: "center",
        },
        {
          title: "색",
          field: "color",
          validator: "string",
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
          headerFilter: "list",
          headerFilterParams: {
            values: [
              { label: "R", value: "R" },
              { label: "G", value: "G" },
              { label: "B", value: "B" },
              { label: "W", value: "W" },
            ],
          },
          hozAlign: "center",
        },
        {
          title: "TPID",
          field: "tpid",
          headerFilter: "number",
          headerFilterFunc: "=",
          headerSort: false,
          hozAlign: "center",
          minWidth: 80,
        },
        {
          title: "LOT#",
          field: "runsheet_lot",
          validator: "integer",
          headerFilter: "number",
          sorter: "number",
          headerFilterFunc: "=",
          hozAlign: "center",
        },
        {
          title: "GLS",
          field: "gls_id",
          validator: "integer",
          headerFilter: "number",
          sorter: "number",
          headerFilterFunc: "=",
          hozAlign: "center",
        },
        {
          title: "조건",
          field: "condition",
          headerFilter: "input",
          headerSort: false,
          minWidth: 450,
          formatter: "textarea",
          // cellClick:function(e, cell){
          //   const pk = cell.getRow().getIndex()
          //   window.location.href = '{% url "pao:device_detail" 0 %}?profile_id={{profile.id}}'.replace("0", pk);
          // },
        },
        {
          title: "구조",
          field: "structure",
          formatter: "html",
          headerSort: false,
          hozAlign: "center",
        },
        {
          title: "실험",
          field: "exptData",
          formatter: "html",
          headerSort: false,
          hozAlign: "center",
        },
      ],
      style: {
        th: {
          padding: "12px 12px",
        },
        td: {
          padding: "12px 12px",
        },
      },
    });
    this.keywordSearch();

    if (!hasProfile) {
      this.table.on("rowDblClick", function (e, row) {
        const pk = row.getIndex();
        window.location.href = deviceDetailBaseUrl.replace("0", pk);
      });
      this.deleteBtn();
    } else {
      this.initOffcanvasButton();
    }
  }

  deleteBtn() {
    const deleteBtn = document.getElementById("deleteDeviceBtn");
    const urlWithIds = (baseUrl) => {
      const data = this.table.getSelectedData();
      const idsToCompare = data.map((item) => item.id);
      if (!idsToCompare || !idsToCompare.length) {
        htmx.trigger(document.body, "toast-message", {
          tag: "warning",
          message: "선택된 데이터가 없습니다.",
        });
        return;
      }
      const url = `${baseUrl.replace(
        /\/$/,
        "",
      )}?ids=${idsToCompare.toString()}`;
      location.href = url;
    };
    deleteBtn.addEventListener("click", () => {
      urlWithIds(deleteDeviceBaseUrl);
    });
  }

  keywordSearch() {
    document.getElementById("applyFilter").addEventListener("click", () => {
      const keyword = document.getElementById("keyword").value;
      const startDate = document.getElementById("startDate").value;
      const endDate = document.getElementById("endDate").value;
      const ivlExist = document.getElementById("ivlExist").checked;
      const ltExist = document.getElementById("ltExist").checked;
      const cvExist = document.getElementById("cvExist")?.checked || false;
      const ivExist = document.getElementById("ivExist")?.checked || false;
      const angleExist =
        document.getElementById("angleExist")?.checked || false;

      const filters = [
        { field: "keyword", type: "keywords", value: keyword },
        { field: "start", type: "=", value: startDate },
        { field: "end", type: "=", value: endDate },
        { field: "ivlExist", type: "=", value: ivlExist },
        { field: "ltExist", type: "=", value: ltExist },
      ];

      if (document.getElementById("cvExist")) {
        filters.push({ field: "cvExist", type: "=", value: cvExist });
        filters.push({ field: "ivExist", type: "=", value: ivExist });
      }
      if (document.getElementById("angleExist")) {
        filters.push({ field: "angleExist", type: "=", value: angleExist });
      }
      this.table.setFilter(filters);
    });
  }

  updateExistingIdsFromCanvas() {
    const tablebody = document.getElementById("deviceTableBody");
    const rows = tablebody.querySelectorAll("tr");

    if (!tablebody) return;
    this.existingIds = Array.from(tablebody.querySelectorAll("tr"))
      .map((tr) => parseInt(tr.dataset.doeId))
      .filter((id) => !isNaN(id));
  }

  //분석 리스트 추가 페이지 open button event 등록
  initOffcanvasButton() {
    const openOffcanvasBtn = document.getElementById("openOffcanvasBtn");
    if (openOffcanvasBtn) {
      openOffcanvasBtn.addEventListener("click", () =>
        this.renderSelectedToStaticTable(),
      );
    }
  }

  //한 페이지 내에서 id 중복 방지
  renderSelectedToStaticTable() {
    this.updateExistingIdsFromCanvas();
    const selectedData = this.table.getSelectedData();
    const newSelections = selectedData.filter(
      (row) =>
        !this.existingIds.includes(row.id) && !this.selectedDoeMap.has(row.id),
    );

    newSelections.forEach((row) => {
      this.selectedDoeMap.set(row.id, row);
      this.appendRowToCanvasTable(row, "신규");
    });

    if (!newSelections.length) {
      htmx.trigger(document.body, "toast-message", {
        message: "신규 데이터가 없습니다.",
        tag: "warning",
      });
      return;
    }

    if (newSelections.length > 0) {
      this.updateSelectedCount();
    }
  }

  //list에서 선택한 doe id offcanvas에서 삭제 시 count 반영 + 추가 영역
  appendRowToCanvasTable(row, status = "신규") {
    const tr = document.createElement("tr");
    const tbody = document.getElementById("deviceTableBody");
    tr.dataset.doeId = row.id;

    const delTd = document.createElement("td");
    const delBtn = document.createElement("button");
    delBtn.className = "btn btn-sm btn-close";
    delBtn.addEventListener("click", () => {
      tr.remove();
      this.selectedDoeMap.delete(row.id);
      this.updateSelectedCount();
      this.table.deselectRow(row.id);
    });
    delTd.appendChild(delBtn);

    const idTd = document.createElement("td");
    idTd.textContent = row.id;

    const labelTd = document.createElement("td");
    const model = row.model;
    const expDate = row.exp_date;
    const color = row.color;
    const lot = row.runsheet_lot;
    const gls = row.gls_id;
    labelTd.textContent = `${model}_${expDate}_${color}_${lot}_${gls}`;

    const statusTd = document.createElement("td");
    statusTd.textContent = status;

    tr.appendChild(delTd);
    tr.appendChild(idTd);
    tr.appendChild(labelTd);
    tr.appendChild(statusTd);
    tbody.appendChild(tr);
  }

  // 추가로 선택된 doe만 count
  updateSelectedCount() {
    const tablebody = document.getElementById("deviceTableBody");
    const selectedDoeInfo = document.getElementById("selectedDoeInfo");

    // 행 수 업데이트 함수
    const updateRowCount = function () {
      const rowCount = tablebody.rows.length;
      selectedDoeInfo.innerText = `총 DOE 수: ${rowCount} (신규: ${this.selectedDoeMap.size})`;
    }.bind(this);

    // 초기에 행 수 업데이트
    updateRowCount();

    // MutationObserver 설정
    const observer = new MutationObserver(updateRowCount);
    observer.observe(tablebody, {
      childList: true,
    });
  }
}

document.addEventListener("DOMContentLoaded", function () {
  // Flatpickr initiation
  flatpickr("#startDate", {
    dateFormat: "Y-m-d",
    allowInput: true,
  });
  flatpickr("#endDate", {
    dateFormat: "Y-m-d",
    allowInput: true,
  });

  var popoverTriggerList = [].slice.call(
    document.querySelectorAll('[data-bs-toggle="popover"]'),
  );
  var popoverList = popoverTriggerList.map(function (popoverTriggerEl) {
    return new bootstrap.Popover(popoverTriggerEl);
  });

  // compare 버튼 생성
  const keywordChoices = new Choices("#keyword", {
    allowHTML: true,
    allowHtmlUserInput: false,
    maxItemCount: 5,
    editItems: true,
    removeItemButton: true,
    duplicateItemsAllowed: false,
    placeholderValue: "예시: AHT0-E15, HTL:AHT0-E15, HTL:750 ",
    // 1. material_name
    // 2. layer_name:layer_thickness
    // 3. layer_name:material_name
  });

  function generateCompareUrl(btnId, urlName) {
    const btn = document.getElementById(btnId);
    if (btn) {
      btn.addEventListener("click", () => {
        const compareBaseUrl =
          profileId && COMPARE_URL_MAPPING[urlName]
            ? COMPARE_URL_MAPPING[urlName].replace("0", profileId)
            : "";
        const rows = document.querySelectorAll("#deviceTableBody tr");
        const ids = Array.from(rows)
          .map((tr) => tr.dataset.doeId)
          .filter(Boolean);
        const finalUrl = `${compareBaseUrl}?ids=${ids.join(",")}`;
        window.location.href = finalUrl;
      });
    }
  }

  generateCompareUrl("comparePOBtn", "compare_po");
  generateCompareUrl("compareTVBtn", "compare_tv");

  const container = document.getElementById("deviceList");
  const listTable = new deviceListEditor(deviceListUrl, container);
});
