// 전역 변수
let prevColorFilter = "";
let prevLineFactor = "";
let ivlTableInstance = null;
let graphOptions = null;
let currentGraphType = 'dynamic';
let dynamicGraphData = null;
let gamutGraphData = null;
let currentFilters = { colorFilter: '', lineFactor: '' };
let gamutAnalysisWindow = null;
let currentYAxisOptions = [];
let selectedAngles = ['all']; // 기본값: 모든 각도 (동적 그래프용)
let isHighResolution = false; // 기본값: Standard (4nm)
let isDragging = false;
let tvChartsData = null;
let currentChartFilters = {
	spectrum: 'white',
	lt: 'white',
	color_coordinate: 'white',
	angular_spectrum: 'all'
};
let doeIdToTpidMap = {};
let angularSelectedAngles = ['0']; // ✨ 추가: Angular Spectrum 차트용 (기본값: 0도만)

let hiddenColumns = new Set(); // 숨겨진 컬럼 DOE ID
let hiddenRows = new Set(); // 숨겨진 Row fieldName
let selectedColumns = new Set();
let referenceColumns = new Set();
let columnOrder = [];


const chartConfigs = [
	        {
	            id: "tv-jv-chart",
	            title: "TV J-V Chart",
	            data: {
					data: [],
					layout: {}
	            },
	        },
	        {
	            id: "tv-cj-chart",
	            title: "TV CJ Chart", 
	            data: {
					data: [],
					layout: {}
	            },
	        },
	        {
	            id: "tv-spectrum-chart",
	            title: "TV Spectrum Chart",
	            data: {
					data: [],
					layout: {}
	            },
	        },
	        {
	            id: "tv-wxy-chart",
	            title: "TV Wxy Chart",
	            data: {
					data: [],
					layout: {}
	            },
	        },
	        {
	            id: "tv-angular-spectrum-chart",
	            title: "TV Angular Spectrum Chart",
	            data: {
					data: [],
					layout: {}
	            },
	        },
	        {
	            id: "tv-delta-uv-angle-chart",
	            title: "TV Delta UV Angle Chart",
	            data: {
					data: [],
					layout: {}
	            },
	        },
	        {
	            id: "tv-lt-chart",
	            title: "TV LT Chart",
	            data: {
					data: [],
					layout: {}
	            },
	        },
	        {
	            id: "tv-delta-v-chart",
	            title: "TV Delta V Chart",
	            data: {
					data: [],
					layout: {}
	            },
	        },
	        {
	            id: "tv-color-coordinate-chart",
	            title: "TV Color Coordinate Chart",
	            data: {
					data: [],
					layout: {}
	            },
	        },
	        {
	            id: "tv-delta-u-delta-v-chart",
	            title: "TV Delta U Delta V Chart",
	            data: {
					data: [],
					layout: {}
	            },
	        }
	    ];
	    
// ㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡ
// 1. 유틸리티 및 공통 함수
// ㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡ


function showToast(message, level) {
    const toastClass = {
        success: "bg-success text-white",
        warning: "bg-warning text-dark",
        error: "bg-danger text-white"
    }[level] || "bg-primary text-white";

    const toastHtml = `
        <div class="toast align-items-center ${toastClass} border-0 mb-2" role="alert" data-bs-delay="2000">
            <div class="d-flex">
                <div class="toast-body">${message}</div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        </div>
    `;

    const toastContainer = document.getElementById("toast-container");
    const temp = document.createElement("div");
    temp.innerHTML = toastHtml;
    const toastElement = temp.firstElementChild;
    toastContainer.appendChild(toastElement);
    new bootstrap.Toast(toastElement).show();
    toastElement.addEventListener('hidden.bs.toast', () => toastElement.remove());
}


function openEditor(url, type) {
    const editorWindow = window.open(url, "_blank", "width=800,height=600");
    const timer = setInterval(() => {
        if (editorWindow.closed) {
            clearInterval(timer);
            // ✨ 전체 새로고침 대신 드롭다운만 갱신
            if (type === 'colorFilter') {
                refreshColorFilterDropdown();
            } else if (type === 'lineFactor') {
                refreshLineFactorDropdown();
            }
        }
    }, 500);
}

// ✨ 헬퍼 함수: field ↔ ID 변환
function fieldToId(field) {
    // "DOE-5" → 5
    const id = parseInt(field.replace(/\D/g, ''));
    return isNaN(id) ? null : id;
}

function idToField(id) {
    // 5 → "DOE-5"
    return `DOE-${id}`;
}

// 테이블이 키보드 이벤트를 받을수 있도록 설정
function enableTableFocus() {
	const tableElement = document.getElementById("ivl-table");
	if (tableElement && !tableElement.hasAttribute('tabindex')) {
		tableElement.setAttribute("tabindex", "0");
	}
}

// ✨ 추가: 클립보드 단축키 설정
function setupClipboardShortcuts() {
    const tableElement = document.getElementById('ivl-table');
    
    if (!tableElement) return;
    
    // 기존 이벤트 리스너 제거 (중복 방지)
    tableElement.removeEventListener('keydown', handleClipboardShortcut);
    
    // 새 이벤트 리스너 추가
    tableElement.addEventListener('keydown', handleClipboardShortcut);
}

// ✨ 추가: 클립보드 단축키 핸들러
function handleClipboardShortcut(e) {
    if (!ivlTableInstance) return;
    
    // Ctrl+C (Windows/Linux) 또는 Cmd+C (Mac)
    if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        const selectedRanges = ivlTableInstance.getRanges();
        
        if (selectedRanges && selectedRanges.length > 0) {
            // Tabulator의 기본 복사 기능 사용
            ivlTableInstance.copyToClipboard("range");
            showToast("선택된 셀이 복사되었습니다.", "success");
            e.preventDefault();
        }
    }
}

// ✨ 추가: 전체 테이블 데이터 복사
function copyAllTableData() {
    if (!ivlTableInstance) return;
    
    // 전체 테이블 복사 (active는 현재 보이는 데이터 모두)
    ivlTableInstance.copyToClipboard("active");
    
    showToast("전체 데이터가 클립보드에 복사되었습니다.", "success");
}

// ㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡ
// 2. 테이블 초기화 및 상태 관리
// ㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡ

function initializeTableState() {
    if (typeof initialHiddenColumns !== 'undefined' && Array.isArray(initialHiddenColumns)) {
        hiddenColumns = new Set(initialHiddenColumns);
    }
    if (typeof initialHiddenRows !== 'undefined' && Array.isArray(initialHiddenRows)) {
        hiddenRows = new Set(initialHiddenRows);
    }
    if (typeof initialColumnOrder !== 'undefined' && Array.isArray(initialColumnOrder)) {
        columnOrder = initialColumnOrder;
    }
    if (typeof initialReferenceColumns !== 'undefined' && Array.isArray(initialReferenceColumns)) {
        referenceColumns = new Set(initialReferenceColumns);
    }
    
    console.log("📦 초기 테이블 상태 로드:", {
        hiddenColumns: Array.from(hiddenColumns),
        hiddenRows: Array.from(hiddenRows),
        columnOrder: columnOrder,
        referenceColumns: Array.from(referenceColumns)
    });
}

// 1) 초기 기본 테이블 로드 (모든 테이블 구조 포함)
async function loadInitialTableData() {
    const ids = new URLSearchParams(window.location.search).get("ids") || "";
    const tableUrl = `${URLS.ivlTable}?ids=${ids}`;

    try {
        const response = await fetch(tableUrl);
        if (!response.ok) throw new Error("네트워크 응답이 올바르지 않습니다.");

        const data = await response.json();

        if (data.message) {
            showToast(data.message, data.level);
        }

        if (data.table_data && data.table_data.length > 0) {
            // ✨ 수정: createTable이 완료될 때까지 대기
            createTable(data.table_data);
            console.log("✅ loadInitialTableData: 테이블 생성 및 가시성 복원 완료");
        } else {
            showToast("테이블 데이터가 없습니다.", "warning");
        }

    } catch (err) {
        console.error("❌ 초기 테이블 로드 실패:", err);
        showToast("테이블 로드에 실패했습니다.", "error");
    }
}

function createTable(tableData) {
    if (!tableData || tableData.length === 0) {
        console.warn("테이블 데이터가 없습니다.");
        return;
    }

    const firstRow = tableData[0] || {};
    const dynamicColumns = Object.keys(firstRow)
        .filter(key => key !== "fieldName")
        .map(key => ({
            title: convertDoeIdToTpid(key),
            field: key,
            hozAlign: "center",
            headerHozAlign: "center",
            width: 120,
            headerSort: false,

            headerMouseDown: function(e, column) {
                isDragging = false;
            },
            headerMouseMove: function(e, column) {
                isDragging = true;
            },
            headerClick: function(e, column) {
                if (!isDragging) {
                    e.stopPropagation();
                    toggleColumnSelection(column.getField());
                }
                isDragging = false;
            },
            headerContextMenu: function(e, column) {
                e.preventDefault();
                showContextMenu(e, column.getField());
            }
        }));

    const columns = [
        {
            title: "All Copy",
            field: "fieldName",
            frozen: true,
            hozAlign: "center",
            headerHozAlign: "center",
            width: 150,
            headerSort: false,
            selectableRange: false,
            titleFormatter: function(cell) {
                cell.getElement().style.color = "#0d6efd";
                cell.getElement().style.fontWeight = "bold";
                return "All Copy";
            },
            headerClick: function(e, column) {
                e.stopPropagation();
                copyAllTableData();
            }
        },
        ...dynamicColumns
    ];

    if (ivlTableInstance) {
        ivlTableInstance.destroy();
    }

    ivlTableInstance = new Tabulator("#ivl-table", {
        data: tableData,
        columns: columns,
        layout: "fitColumns",
        clipboard: true,
        clipboardCopyConfig: {
            columnHeaders: true,
            rowHeaders: "fieldName",
            columnGroups: false,
            rowGroups: false,
            columnCalcs: false,
            dataTree: false,
            formatCells: false
        },
        clipboardCopySelector: "range",
        clipboardPasteAction: "range",
        selectableRange: true,
        selectableRangeMode: "click",
        movableColumns: true,
        height: "500px",
        index: "fieldName",

        selectableRangeCheck: function(e) {
            return e.ctrlKey || e.shiftKey || e.metaKey;
        },

    });
    
    // ✨ 이벤트 방식으로 변경
	ivlTableInstance.on("tableBuilt", function() {
	    console.log('🏗️ tableBuilt 이벤트: 테이블 생성 완료');
	    applyVisibilityState();
	    updateColumnStyles();
	    enableTableFocus();
	    setupClipboardShortcuts();
	    
	    // ✨ 추가: Row 숨김 적용 (렌더링 후 약간의 딜레이)
	    setTimeout(() => {
	        applyRowVisibilityState();
	    }, 200);
	});
	
	// ✨ 추가: 컬럼 이동 시 드롭다운 갱신
	ivlTableInstance.on("columnMoved", function(column, columns) {
	    console.log('🔀 columnMoved 이벤트: 컬럼 이동됨');
	    updateColumnVisibilityList();
	});
}


function getTableStateForSave() {
    // 현재 컬럼 순서 가져오기 (숫자 ID로)
    const currentColumnOrder = ivlTableInstance 
        ? ivlTableInstance.getColumns()
            .filter(col => col.getField() !== 'fieldName')
            .map(col => fieldToId(col.getField()))  // ✨ 헬퍼 함수 사용
            .filter(id => id !== null)
        : [];
    
    return {
        hidden_columns: Array.from(hiddenColumns).filter(id => id !== null && !isNaN(id)),
        hidden_rows: Array.from(hiddenRows).filter(name => name !== null && name !== ''),
        column_order: currentColumnOrder,
        reference_columns: Array.from(referenceColumns).filter(id => id !== null && !isNaN(id))
    };
}

// ✨ 가시성 상태 적용 (서버에서 받은 초기 데이터 적용)
function applyVisibilityState() {
    if (!ivlTableInstance) {
        console.warn("⚠️ applyVisibilityState: 테이블 인스턴스 없음");
        return;
    }

    console.log("🔍 가시성 적용 시작");

    setTimeout(() => {
        ivlTableInstance.blockRedraw();

        try {
            // 컬럼 순서 적용
            if (columnOrder && columnOrder.length > 0) {
                columnOrder.forEach((fieldId, index) => {
                    if (fieldId === null || fieldId === undefined) return;
                    
                    const field = idToField(fieldId);
                    const column = ivlTableInstance.getColumn(field);
                    
                    if (!column) {
                        console.warn(`⚠️ 컬럼 순서 적용 실패 - 컬럼 없음: ${field}`);
                        return;
                    }
                    
                    const columns = ivlTableInstance.getColumns();
                    const targetCol = columns[index + 1];
                    if (targetCol && targetCol.getField() !== field) {
                        ivlTableInstance.moveColumn(field, targetCol, true);
                    }
                });
                console.log("✅ 컬럼 순서 적용 완료");
            }

            // 컬럼 숨김 적용
            hiddenColumns.forEach(fieldId => {
                if (fieldId === null || fieldId === undefined || isNaN(fieldId)) return;
                
                const field = idToField(fieldId);
                const column = ivlTableInstance.getColumn(field);
                
                if (!column) {
                    console.warn(`⚠️ 컬럼 숨김 적용 실패 - 컬럼 없음: ${field}`);
                    return;
                }
                
                if (column.isVisible()) {
                    column.hide();
                }
            });

            // ✨ Row 숨김은 여기서 제거 - 별도 함수로 처리

        } finally {
            ivlTableInstance.restoreRedraw();
        }

        updateColumnStyles();
        console.log("✅ 컬럼 가시성 적용 완료");
    }, 100);
}

function applyRowVisibilityState() {
    if (!ivlTableInstance || hiddenRows.size === 0) return;
    
    console.log("🔍 Row 가시성 적용 시작, hiddenRows:", Array.from(hiddenRows));
    
    const rows = Array.from(ivlTableInstance.getRows());
    
    if (rows.length === 0) {
        console.warn("⚠️ Row가 없음 - 나중에 다시 시도");
        return;
    }
    
    hiddenRows.forEach(fieldName => {
        if (!fieldName) return;
        
        const targetRow = rows.find(row => row.getData().fieldName === fieldName);
        
        if (targetRow) {
            const rowElement = targetRow.getElement();
            if (rowElement) {
                rowElement.style.display = 'none';
                console.log(`✅ Row 숨김 적용: ${fieldName}`);
            }
        } else {
            console.warn(`⚠️ Row 못 찾음: ${fieldName}`);
        }
    });
    
    updateRowVisibilityList();
}

// ✨ Row 숨김 상태 재적용 (데이터 업데이트 후)
function reapplyRowVisibility() {
    if (!ivlTableInstance || hiddenRows.size === 0) return;
    
    hiddenRows.forEach(fieldName => {
        const rows = Array.from(ivlTableInstance.getRows());
        const targetRow = rows.find(row => row.getData().fieldName === fieldName);
        
        if (targetRow) {
            const rowElement = targetRow.getElement();
            if (rowElement) {
                rowElement.style.display = 'none';
            }
        }
    });
}



// ㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡ
// 3. 테이블 컬럼/행 가시설 관련 함수
// ㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡ

// ✨ 추가: 컬럼 가시성 드롭다운 초기화
function initializeColumnVisibilityDropdown() {
    const searchInput = document.getElementById('columnSearchInput');
    const selectAllBtn = document.getElementById('columnSelectAllBtn');
    const deselectAllBtn = document.getElementById('columnDeselectAllBtn');
    
    if (searchInput) {
        searchInput.addEventListener('input', function(e) {
            const searchTerm = e.target.value.toLowerCase();
            document.querySelectorAll('#columnVisibilityList .dropdown-item').forEach(item => {
                item.style.display = item.textContent.toLowerCase().includes(searchTerm) ? '' : 'none';
            });
        });
        searchInput.addEventListener('click', e => e.stopPropagation());
    }
    
    if (selectAllBtn) selectAllBtn.addEventListener('click', e => { e.stopPropagation(); showAllColumns(); });
    if (deselectAllBtn) deselectAllBtn.addEventListener('click', e => { e.stopPropagation(); hideAllColumns(); });
    
    const dropdownBtn = document.getElementById('columnVisibilityBtn');
    if (dropdownBtn) {
        const dropdownContainer = dropdownBtn.closest('.dropdown');
        if (dropdownContainer) {
            dropdownContainer.addEventListener('shown.bs.dropdown', updateColumnVisibilityList);
        }
    }
    updateColumnVisibilityList();
}

function initializeRowVisibilityDropdown() {
    const searchInput = document.getElementById('rowSearchInput');
    const selectAllBtn = document.getElementById('rowSelectAllBtn');
    const deselectAllBtn = document.getElementById('rowDeselectAllBtn');
    
    if (searchInput) {
        searchInput.addEventListener('input', function(e) {
            const searchTerm = e.target.value.toLowerCase();
            document.querySelectorAll('#rowVisibilityList .dropdown-item').forEach(item => {
                item.style.display = item.textContent.toLowerCase().includes(searchTerm) ? '' : 'none';
            });
        });
        searchInput.addEventListener('click', e => e.stopPropagation());
    }
    
    if (selectAllBtn) selectAllBtn.addEventListener('click', e => { e.stopPropagation(); showAllRows(); });
    if (deselectAllBtn) deselectAllBtn.addEventListener('click', e => { e.stopPropagation(); hideAllRows(); });
    
    const dropdownBtn = document.getElementById('rowVisibilityBtn');
    if (dropdownBtn) {
        const dropdownContainer = dropdownBtn.closest('.dropdown');
        if (dropdownContainer) {
            dropdownContainer.addEventListener('shown.bs.dropdown', updateRowVisibilityList);
        }
    }
    updateRowVisibilityList();
}

// ✨ 수정: columnPositions 관련 로직 제거
function updateColumnVisibilityList() {
    if (!ivlTableInstance) return;
    
    const listContainer = document.getElementById('columnVisibilityList');
    if (!listContainer) return;
    
    const columns = ivlTableInstance.getColumns();
    const allFields = columns
        .filter(col => col.getField() !== 'fieldName')
        .map(col => col.getField());
    
    listContainer.innerHTML = '';
    
    allFields.forEach(field => {
        const fieldId = fieldToId(field);  // ✨ 헬퍼 함수 사용
        const isVisible = fieldId !== null ? !hiddenColumns.has(fieldId) : true;
        const tpid = convertDoeIdToTpid(field);
        
        // ✨ 디버깅용
        console.log(`📝 드롭다운 항목: ${field} (ID: ${fieldId}), visible: ${isVisible}, hiddenColumns: [${Array.from(hiddenColumns)}]`);
        
        const item = document.createElement('li');
        item.className = 'dropdown-item';
        
        item.innerHTML = `
            <div class="form-check">
                <input class="form-check-input" type="checkbox" id="col-${field}" ${isVisible ? 'checked' : ''}>
                <label class="form-check-label ${!isVisible ? 'text-muted' : ''}" for="col-${field}">
                    ${tpid}${!isVisible ? ' (숨김)' : ''}
                </label>
            </div>
        `;
        
        const checkbox = item.querySelector('input');
        
        checkbox.addEventListener('change', function(e) {
            e.stopPropagation();
            toggleColumnVisibility(field);
            updateColumnVisibilityList();  // ✨ 추가: 토글 후 리스트 갱신
        });
        
        item.addEventListener('click', function(e) {
            if (e.target.tagName === 'INPUT') return;
            e.stopPropagation();
            checkbox.click();
        });
        
        listContainer.appendChild(item);
    });
}

function updateRowVisibilityList() {
    if (!ivlTableInstance) return;
    
    const listContainer = document.getElementById('rowVisibilityList');
    if (!listContainer) return;
    
    const rows = ivlTableInstance.getRows();
    
    listContainer.innerHTML = '';
    
    rows.forEach(row => {
        const fieldName = row.getData().fieldName;
        if (!fieldName) return;
        
        const isVisible = !hiddenRows.has(fieldName);
        
        const item = document.createElement('li');
        item.className = 'dropdown-item';
        
        item.innerHTML = `
            <div class="form-check">
                <input class="form-check-input" type="checkbox" id="row-${fieldName}" ${isVisible ? 'checked' : ''}>
                <label class="form-check-label ${!isVisible ? 'text-muted' : ''}" for="row-${fieldName}">
                    ${fieldName}${!isVisible ? ' (숨김)' : ''}
                </label>
            </div>
        `;
        
        const checkbox = item.querySelector('input');
        
        checkbox.addEventListener('change', function(e) {
            e.stopPropagation();
            toggleRowVisibility(fieldName);
        });
        
        item.addEventListener('click', function(e) {
            if (e.target.tagName === 'INPUT') return;
            e.stopPropagation();
            checkbox.click();
        });
        
        listContainer.appendChild(item);
    });
}

// ✨ 수정: 서버 저장 추가
function toggleColumnVisibility(field) {
    if (!ivlTableInstance) return;
    
    const column = ivlTableInstance.getColumn(field);
    if (!column) return;
    
    const fieldId = parseInt(field.replace(/\D/g, ''));
    const isCurrentlyHidden = hiddenColumns.has(fieldId);
    
    if (isCurrentlyHidden) {
        hiddenColumns.delete(fieldId);
        column.show();
    } else {
        const visibleCount = ivlTableInstance.getColumns()
            .filter(col => {
                const f = col.getField();
                return f !== 'fieldName' && col.isVisible();
            })
            .length;
        
        if (visibleCount <= 1) {
            showToast("최소 1개의 컬럼은 표시되어야 합니다.", "warning");
            const checkbox = document.getElementById(`col-${field}`);
            if (checkbox) checkbox.checked = true;
            return;
        }
        
        selectedColumns.delete(fieldId);
        referenceColumns.delete(fieldId);
        hiddenColumns.add(fieldId);
        column.hide();
    }
    
    updateColumnStyles();
    // ✨ 삭제: saveTableStateToServer() 호출 제거
}


// ✨ 수정: 서버 저장 추가
function toggleRowVisibility(fieldName) {
    if (!ivlTableInstance) return;
    
    // ✨ CSS 방식으로 Row 숨김 처리
    const rows = Array.from(ivlTableInstance.getRows());
    const targetRow = rows.find(row => row.getData().fieldName === fieldName);
    
    if (!targetRow) return;
    
    const rowElement = targetRow.getElement();
    if (!rowElement) return;
    
    if (hiddenRows.has(fieldName)) {
        // 숨김 해제
        hiddenRows.delete(fieldName);
        rowElement.style.display = '';
    } else {
        // 숨김 처리
        const visibleCount = rows.filter(row => {
            const el = row.getElement();
            return el && el.style.display !== 'none';
        }).length;
        
        if (visibleCount <= 1) {
            showToast("최소 1개의 행은 표시되어야 합니다.", "warning");
            return;
        }
        
        hiddenRows.add(fieldName);
        rowElement.style.display = 'none';
    }
    
    updateRowVisibilityList();
}

function showAllRows() {
    if (!ivlTableInstance) return;
    
    ivlTableInstance.getRows().forEach(row => {
        const fieldName = row.getData().fieldName;
        hiddenRows.delete(fieldName);
        const rowElement = row.getElement();
        if (rowElement) {
            rowElement.style.display = '';
        }
    });
    
    updateRowVisibilityList();
    showToast("모든 행이 표시됩니다.", "success");
}

function hideAllRows() {
    if (!ivlTableInstance) return;
    
    const rows = ivlTableInstance.getRows();
    if (rows.length <= 1) {
        showToast("최소 1개의 행은 표시되어야 합니다.", "warning");
        return;
    }
    
    rows.forEach((row, index) => {
        const fieldName = row.getData().fieldName;
        const rowElement = row.getElement();
        
        if (index === 0) {
            hiddenRows.delete(fieldName);
            if (rowElement) rowElement.style.display = '';
        } else {
            hiddenRows.add(fieldName);
            if (rowElement) rowElement.style.display = 'none';
        }
    });
    
    updateRowVisibilityList();
    showToast("첫 번째 행을 제외한 모든 행이 숨겨졌습니다.", "success");
}

function showAllColumns() {
    if (!ivlTableInstance) return;
    
    ivlTableInstance.getColumns().forEach(col => {
        const field = col.getField();
        if (field !== 'fieldName') {
            const fieldId = fieldToId(field);  // ✨ 헬퍼 함수 사용
            if (fieldId !== null) {
                hiddenColumns.delete(fieldId);
            }
            col.show();
        }
    });
    
    console.log("📋 showAllColumns 후 hiddenColumns:", Array.from(hiddenColumns));
    
    updateColumnVisibilityList();  // 드롭다운 갱신
    updateColumnStyles();
    showToast("모든 컬럼이 표시됩니다.", "success");
}

function hideAllColumns() {
    if (!ivlTableInstance) return;
    
    const dataColumns = ivlTableInstance.getColumns().filter(col => col.getField() !== 'fieldName');
    if (dataColumns.length <= 1) {
        showToast("최소 1개의 컬럼은 표시되어야 합니다.", "warning");
        return;
    }
    
    dataColumns.forEach((col, index) => {
        const field = col.getField();
        const fieldId = fieldToId(field);  // ✨ 헬퍼 함수 사용
        
        if (index === 0) {
            // 첫 번째 컬럼은 보이게
            if (fieldId !== null) hiddenColumns.delete(fieldId);
            col.show();
        } else {
            // 나머지는 숨김
            if (fieldId !== null) {
                selectedColumns.delete(fieldId);
                referenceColumns.delete(fieldId);
                hiddenColumns.add(fieldId);
            }
            col.hide();
        }
    });
    
    console.log("📋 hideAllColumns 후 hiddenColumns:", Array.from(hiddenColumns));
    
    updateColumnVisibilityList();  // 드롭다운 갱신
    updateColumnStyles();
    showToast("첫 번째 컬럼을 제외한 모든 컬럼이 숨겨졌습니다.", "success");
}


// ㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡ
// 4. 컬럼 선택 및 스타일 관련 함수
// ㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡ

// 컨텍스트 메뉴 표시
function showContextMenu(event, field) {
    // 기존 메뉴 제거
    const existingMenu = document.getElementById('columnContextMenu');
    if (existingMenu) existingMenu.remove();
    
    const menu = document.createElement('div');
    menu.id = 'columnContextMenu';
    menu.className = 'dropdown-menu show';
    menu.style.cssText = `
        position: fixed;
        left: ${event.clientX}px;
        top: ${event.clientY}px;
        z-index: 1000;
    `;
    
    const isSelected = selectedColumns.has(field);
    const isReference = referenceColumns.has(field);
    
    // 메뉴 아이템들
    const items = [
        {
            text: isSelected ? '선택 해제' : '선택',
            action: () => toggleColumnSelection(field)
        },
        {
            text: isReference ? 'Reference 해제' : 'Reference 지정',
            action: () => toggleReferenceColumn(field),
            className: 'text-danger fw-bold'
        },
        {
			text: 'Data 편집',
			action: () => goToDeviceDetail(field),
			className: 'text-primary fw-bold'
        }
    ];
    
    items.forEach(item => {
        const menuItem = document.createElement('button');
        menuItem.className = `dropdown-item ${item.className || ''}`;
        menuItem.textContent = item.text;

        menuItem.addEventListener('click', () => {
            item.action();
            menu.remove();
        });
        
        menu.appendChild(menuItem);
    });
    
    document.body.appendChild(menu);
    
    // 외부 클릭시 메뉴 닫기
    setTimeout(() => {
        document.addEventListener('click', function closeMenu() {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        });
    }, 0);
}

// 컬럼 선택/해제 토글 함수
function toggleColumnSelection(field) {
    // ✨ 수정: field → ID 변환
    const fieldId = fieldToId(field);
    if (fieldId === null) return;
    
    if (selectedColumns.has(fieldId)) {
        selectedColumns.delete(fieldId);
    } else {
        selectedColumns.add(fieldId);
    }
    
    updateColumnStyles();
}

function toggleReferenceColumn(field) {
    // ✨ 수정: field → ID 변환
    const fieldId = fieldToId(field);
    if (fieldId === null) return;
    
    console.log(`🔧 toggleReferenceColumn: ${field} → ID: ${fieldId}`);
    
    if (referenceColumns.has(fieldId)) {
        referenceColumns.delete(fieldId);
    } else {
        referenceColumns.add(fieldId);
    }
    
    console.log(`📋 referenceColumns 현재 상태:`, Array.from(referenceColumns));
    
    updateColumnStyles();
}


// 모든 컬럼 스타일 업데이트
function updateColumnStyles() {
    if (!ivlTableInstance) return;
    
    function waitForTable(callback, attempts = 0) {
        const maxAttempts = 50;
        try {
            const columns = ivlTableInstance.getColumns();
            if (columns && columns.length > 0) {
                callback();
            } else if (attempts < maxAttempts) {
                requestAnimationFrame(() => waitForTable(callback, attempts + 1));
            }
        } catch (error) {
            if (attempts < maxAttempts) {
                requestAnimationFrame(() => waitForTable(callback, attempts + 1));
            }
        }
    }
    
    function applyStyles() {
        ivlTableInstance.getColumns().forEach(column => {
            const field = column.getField();
            if (field === 'fieldName') return;
            
            // 숨겨진 컬럼은 건너뛰기
            if (!column.isVisible()) return;
            
            // ✨ 수정: field → ID 변환
            const fieldId = fieldToId(field);
            if (fieldId === null) return;
            
            try {
                const headerElement = column.getElement();
                if (!headerElement) return;
                
                const titleElement = headerElement.querySelector('.tabulator-col-title');
                if (!titleElement) return;
                
                const isSelected = selectedColumns.has(fieldId);
                const isReference = referenceColumns.has(fieldId);
                
                // ✨ 디버깅용
                console.log(`🎨 스타일 적용: ${field} (ID: ${fieldId}), selected: ${isSelected}, ref: ${isReference}`);
                
                // 스타일 초기화
                headerElement.style.backgroundColor = '';
                headerElement.style.color = '';
                titleElement.style.color = '';
                
                const refIndicators = titleElement.querySelectorAll('.ref-indicator');
                refIndicators.forEach(indicator => indicator.remove());
                
                // 스타일 적용
                if (isSelected && isReference) {
                    headerElement.style.backgroundColor = '#007bff';
                    headerElement.style.color = 'white';
                    titleElement.style.color = '#ffcccb';
                    const refIndicator = document.createElement('div');
                    refIndicator.className = 'ref-indicator';
                    refIndicator.style.cssText = 'font-size: 10px; color: #ffcccb; font-weight: bold;';
                    refIndicator.textContent = 'ref.';
                    titleElement.appendChild(refIndicator);
                } else if (isSelected) {
                    headerElement.style.backgroundColor = '#007bff';
                    headerElement.style.color = 'white';
                } else if (isReference) {
                    titleElement.style.color = '#dc3545';
                    const refIndicator = document.createElement('div');
                    refIndicator.className = 'ref-indicator';
                    refIndicator.style.cssText = 'font-size: 10px; color: #dc3545; font-weight: bold;';
                    refIndicator.textContent = 'ref.';
                    titleElement.appendChild(refIndicator);
                }
                
                // 셀 스타일
                try {
                    const cells = column.getCells();
                    cells.forEach(cell => {
                        const cellElement = cell.getElement();
                        if (!cellElement) return;
                        cellElement.classList.add("line-break-cell");
                        if (isReference) {
                            cellElement.style.color = '#dc3545';
                            cellElement.style.fontWeight = 'bold';
                        } else {
                            cellElement.style.color = '';
                            cellElement.style.fontWeight = 'normal';
                        }
                    });
                } catch (cellError) {
                    console.warn(`셀 스타일 업데이트 실패 (${field}):`, cellError);
                }
            } catch (columnError) {
                console.warn(`컬럼 스타일 업데이트 실패 (${field}):`, columnError);
            }
        });
    }
    
    waitForTable(applyStyles);
    updateSelectAllButton();
}

// 선택된 컬럼들을 가져오는 함수
function getSelectedColumns() {
    return Array.from(selectedColumns);
}

// Reference 컬럼들을 가져오는 함수
function getReferenceColumns() {
    return Array.from(referenceColumns);
}

function clearColumnSelection() {
    selectedColumns.clear();
    updateColumnStyles();
}

function clearReferenceColumns() {
    referenceColumns.clear();
    updateColumnStyles();
}

	// 모든 컬럼 선택/해제 토글 함수 (수정된 버전)
function toggleSelectAllColumns() {
    if (!ivlTableInstance) {
        showToast("테이블이 아직 로드되지 않았습니다.", "warning");
        return;
    }
    
    const allFields = Object.keys(ivlTableInstance.getData()[0] || {})
        .filter(key => key !== "fieldName");
    
    // 현재 모든 컬럼이 선택되어 있는지 확인
    const allSelected = allFields.length > 0 && allFields.every(field => selectedColumns.has(field));
    
    if (allSelected) {
        // 모두 선택되어 있으면 → 모두 해제
        selectedColumns.clear();
        showToast("모든 선택이 해제되었습니다.", "info");
    } else {
        // 일부만 선택되어 있거나 아무것도 선택되지 않았으면 → 모두 선택
        selectedColumns = new Set(allFields);
        showToast(`${allFields.length}개 컬럼이 모두 선택되었습니다.`, "success");
    }
    
    updateColumnStyles();
}

// 버튼 텍스트 업데이트 함수
function updateSelectAllButton() {
    const selectAllBtn = document.getElementById('selectAllDataBtn');
    if (!selectAllBtn || !ivlTableInstance) return;
    
    const allFields = Object.keys(ivlTableInstance.getData()[0] || {})
        .filter(key => key !== "fieldName");
    const selectedCount = selectedColumns.size;
    
    if (selectedCount === 0) {
        selectAllBtn.textContent = '모든데이터선택';
        selectAllBtn.className = 'btn btn-outline-primary';
    } else if (selectedCount === allFields.length) {
        selectAllBtn.textContent = '모든선택해제';
        selectAllBtn.className = 'btn btn-outline-danger';
    } else {
        selectAllBtn.textContent = `모든데이터선택 (${selectedCount}/${allFields.length})`;
        selectAllBtn.className = 'btn btn-outline-primary';
    }
}

// ㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡ
// 5. 데이터 로딩 - 추가 테이블 (IVL / Angle / LT)
// ㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡ

// 2) IVL + Color 테이블 업데이트
function loadIvlColorTableData() {
    const ids = new URLSearchParams(window.location.search).get("ids") || "";
    const color = document.getElementById("tvColorFilter").value;
    const line = document.getElementById("tvLineFactor").value;
    
    if (!color || !line) return Promise.resolve();

    const colorUrl = `${URLS.ivlColorTable}?ids=${ids}&color_filter=${encodeURIComponent(color)}&line_factor=${encodeURIComponent(line)}`;

    return fetch(colorUrl)
        .then(res => res.json())
        .then(colorData => {
            if (colorData.message) showToast(colorData.message, colorData.level);
            
            if (ivlTableInstance && colorData.table_data && colorData.table_data.length > 0) {
                ivlTableInstance.updateOrAddData(colorData.table_data);
                reapplyRowVisibility();
            }
            
            if (colorData.graph_data) {
                gamutGraphData = colorData.graph_data;
                if (gamutAnalysisWindow && !gamutAnalysisWindow.closed) {
                    sendGamutDataToWindow();
                }
            }
            
            updateGraphFilters();
            prevColorFilter = color;
            prevLineFactor = line;
        })
        .catch(err => {
            console.error("컬러 데이터 불러오기 실패:", err);
            showToast("Color 데이터 로드 실패", "error");
            throw err;
        });
}

// 3) Angle 테이블 업데이트
function loadAngleTableData() {
    const color = document.getElementById("tvColorFilter").value;
    const line = document.getElementById("tvLineFactor").value;
    
    if (!color || !line) return Promise.resolve();
    
    const ids = new URLSearchParams(window.location.search).get("ids") || "";
    const angleUrl = `${URLS.angleTable}?ids=${ids}`;

    return fetch(angleUrl)
        .then(res => res.json())
        .then(angleData => {
            if (angleData.message) showToast(angleData.message, angleData.level);
            if (ivlTableInstance && angleData.table_data && angleData.table_data.length > 0) {
                ivlTableInstance.updateOrAddData(angleData.table_data);
                reapplyRowVisibility();
            }
        })
        .catch(err => {
            console.error("Angle 데이터 불러오기 실패:", err);
            showToast("Angle 데이터 로드 실패", "error");
            throw err;
        });
}

// 4) LT 테이블 업데이트
function loadLtTableData() {
    const color = document.getElementById("tvColorFilter").value;
    if (!color) return Promise.resolve();
    
    const ids = new URLSearchParams(window.location.search).get("ids") || "";
    const agingTime = document.getElementById("ltAgingTime").value || 30;
    const ltUrl = `${URLS.ltTable}?ids=${ids}&color_filter=${encodeURIComponent(color)}&aging_time=${agingTime}`;

    return fetch(ltUrl)
        .then(res => res.json())
        .then(ltData => {
            if (ltData.message) showToast(ltData.message, ltData.level);
            if (ivlTableInstance && ltData.table_data && ltData.table_data.length > 0) {
                ivlTableInstance.updateOrAddData(ltData.table_data);
                reapplyRowVisibility();
            }
        })
        .catch(err => {
            console.error("LT 데이터 불러오기 실패:", err);
            showToast("LT 데이터 로드 실패", "error");
            throw err;
        });
}

// 모든 추가 테이블 로드 (Color/Line Factor 선택 후)
async function loadAllAdditionalTablesAsync() {
    const color = document.getElementById("tvColorFilter").value;
    const line = document.getElementById("tvLineFactor").value;

    if (!color || !line) return;

    try {
        console.log("🔄 추가 데이터 로드 시작...");
        await Promise.all([loadIvlColorTableData(), loadAngleTableData(), loadLtTableData()]);
        reapplyRowVisibility();
        console.log("✅ 추가 데이터 로드 완료");
    } catch (err) {
        console.error("추가 테이블 로드 중 오류:", err);
    }
}


// ㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡ
// 6. 색역분석(Gamut Analysis) 관련 함수
// ㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡ

function validateGamutButton() {
    const colorFilter = document.getElementById('tvColorFilter').value;
    const lineFactor = document.getElementById('tvLineFactor').value;
    const gamutBtn = document.getElementById('gamutAnalysisBtn');
    
    if (!gamutBtn) return;
    
    const hasFilters = colorFilter && lineFactor;
    
    gamutBtn.disabled = !hasFilters;
    
    if (hasFilters) {
        gamutBtn.textContent = "색역분석 (새창)";
        gamutBtn.classList.remove('btn-secondary');
        gamutBtn.classList.add('btn-info');
    } else {
        gamutBtn.textContent = "필터 선택 필요";
        gamutBtn.classList.remove('btn-info');
        gamutBtn.classList.add('btn-secondary');
    }
}

// 색역분석 창 열기 (수정된 버전)
function openGamutAnalysisWindow() {
    const colorFilter = document.getElementById('tvColorFilter').value;
    const lineFactor = document.getElementById('tvLineFactor').value;
    
    if (!colorFilter || !lineFactor) {
        showToast("Color Filter와 Line Factor를 선택해주세요.", "warning");
        return;
    }
    
    // 기존 창이 열려있으면 포커스만 이동
    if (gamutAnalysisWindow && !gamutAnalysisWindow.closed) {
        gamutAnalysisWindow.focus();
        // 현재 데이터로 업데이트
        sendGamutDataToWindow();
        return;
    }
    
    // 새창 열기
    const windowFeatures = "width=900,height=700,scrollbars=yes,resizable=yes,toolbar=no,menubar=no";
    
    try {
		gamutAnalysisWindow = window.open(`${URLS.GamutAnalysis}`, "GamutAnalysis", windowFeatures);
		
		if (!gamutAnalysisWindow) {
			showToast("팝업이 차단되었습니다. 팝업 차단을 해제해주세요.", "warning");
			return;
		}
		
		gamutAnalysisWindow.addEventListener('load', function() {
			setTimeout(() => {
				sendGamutDataToWindow();
			}, 100);
		});
		
		setTimeout(() => {
			sendGamutDataToWindow();
		}, 500);
		
    } catch (error) {
	showToast("색역분석 창을 열수 없습니다.", "error");
    }
}


// 색역분석 창에 데이터 전송
function sendGamutDataToWindow() {
    if (!gamutAnalysisWindow || gamutAnalysisWindow.closed || !gamutGraphData) {
        return;
    }
    
    const colorFilterSelect = document.getElementById('tvColorFilter');
    const lineFactorSelect = document.getElementById('tvLineFactor');
    
    const colorFilterId = colorFilterSelect.value;
    const lineFactorId = lineFactorSelect.value;
    
    const colorFilterLabel = colorFilterSelect.options[colorFilterSelect.selectedIndex]?.text || colorFilterId;
    const lineFactorLabel = lineFactorSelect.options[lineFactorSelect.selectedIndex]?.text || lineFactorId;
    
    const selectedCols = getSelectedColumns();
    
    // ✨ 추가: user_uv의 키를 TPID로 변환
    const convertedGamutData = { ...gamutGraphData };
    if (convertedGamutData.user_uv) {
        const convertedUserUv = {};
        
        Object.entries(convertedGamutData.user_uv).forEach(([doeLabel, coords]) => {
            // "DOE-123" → TPID 변환
            if (selectedCols.length === 0 || selectedCols.includes(doeLabel)) {
	            const tpidLabel = convertDoeIdToTpid(doeLabel);
	            convertedUserUv[tpidLabel] = coords;
            }
        });
        
        convertedGamutData.user_uv = convertedUserUv;
    }
    
    const messageData = {
        type: 'updategamutData',
        data: {
            gamutGraphData: convertedGamutData,  // ✨ 변환된 데이터 전송
            colorFilter: colorFilterId,
            lineFactor: lineFactorId,
            colorFilterLabel: colorFilterLabel,
            lineFactorLabel: lineFactorLabel,
            timestamp: Date.now()
        }
    };
    
    try {
        gamutAnalysisWindow.postMessage(messageData, '*');
    } catch (error) {
        if (error.name === 'DataCloneError') {
            try {
                const simplifiedData = {
                    type: 'updategamutData',
                    data: {
                        gamutGraphData: {
                            cie1976_gamut: convertedGamutData.cie1976_gamut || [],
                            user_uv: convertedGamutData.user_uv || {},
                            ref_uv: convertedGamutData.ref_uv || {}
                        },
                        colorFilter: colorFilterId,
                        lineFactor: lineFactorId,
                        colorFilterLabel: colorFilterLabel,
                        lineFactorLabel: lineFactorLabel,
                        timestamp: Date.now()
                    }
                };
                gamutAnalysisWindow.postMessage(simplifiedData, '*');
            } catch (retryError) {
                console.error("재시도도 실패:", retryError);
            }
        }
    }
}

// ㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡ
// 7. 그래프 옵션 및 필터링 관련 함수
// ㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡ

// 그래프 옵션 로드
async function loadGraphOptions() {
    try {
        const ids = new URLSearchParams(window.location.search).get("ids") || "";
        const url = `${URLS.graphOption}?ids=${ids}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.success) {
            graphOptions = data.options;
            populateXAxisOptions(); // 함수명 변경
        } else {
            showToast("그래프 옵션 로드 실패", "error");
        }
    } catch (error) {
        console.error("옵션 로드 오류:", error);
        showToast("옵션 로드 중 오류가 발생했습니다.", "error");
    }
}

function getYAxisOptionsByX(xValue) {
    if (xValue === 'doe_id') {
        return graphOptions.y_axis_options;
    } else if (xValue === 'wavelength') {
        return [
            {value: "j10_spectrum_intensity", label: "J10 Spectrum Intensity", category: "스펙트럼"},
            {value: "angular_spectrum_intensity", label: "Angular Spectrum Intensity", category: "스펙트럼"}
        ];
    } else if (xValue === 'time') {
        return [
            {value: "white_intensity", label: "White Intensity(%)", category: "LT"},
            {value: "red_intensity", label: "Red Intensity(%)", category: "LT"},
            {value: "green_intensity", label: "Green Intensity(%)", category: "LT"},
            {value: "blue_intensity", label: "Blue Intensity(%)", category: "LT"},
            {value: "blue_peak_intensity", label: "Blue Peak Intensity(%)", category: "LT"},
            {value: "vdelta", label: "ΔV", category: "LT"},
        ];
    } else if (xValue === 'angle') {
        return [
            {value: "delta_uv", label: "Δu'v'", category: "각도"},
        ];
    } else if (xValue === 'delta_u') {
	    return [
	        {value: "delta_v", label: "Δv'", category: "각도"}
	    ];
	}
    return [];
}

// 3. 옵션으로 select 구성하는 공통 함수 (새로 추가)
function populateSelectWithOptions(selectElement, options, excludeValue = '') {
    selectElement.innerHTML = `<option value="">-- ${selectElement.id.includes('y2') ? 'Y2' : 'Y'}축 선택 --</option>`;
    
    const groups = {};
    options.forEach(option => {
        if (option.value !== excludeValue) {
            if (!groups[option.category]) groups[option.category] = [];
            groups[option.category].push(option);
        }
    });
    
    Object.entries(groups).forEach(([category, categoryOptions]) => {
        const optgroup = document.createElement('optgroup');
        optgroup.label = category;
        
        categoryOptions.forEach(option => {
            const opt = document.createElement('option');
            opt.value = option.value;
            opt.textContent = option.label;
            optgroup.appendChild(opt);
        });
        
        selectElement.appendChild(optgroup);
    });
}

// 4. populateSelects 함수를 populateXAxisOptions로 변경
function populateXAxisOptions() {
    const xSelect = document.getElementById('xAxisSelect');
    
    // X축 옵션 구성
    const xGroups = {};
    graphOptions.x_axis_options.forEach(option => {
        if (!xGroups[option.category]) xGroups[option.category] = [];
        xGroups[option.category].push(option);
    });
    
    Object.entries(xGroups).forEach(([category, options]) => {
        const optgroup = document.createElement('optgroup');
        optgroup.label = category;
        options.forEach(option => {
            const opt = document.createElement('option');
            opt.value = option.value;
            opt.textContent = option.label;
            optgroup.appendChild(opt);
        });
        xSelect.appendChild(optgroup);
    });
    
    // Y/Y2축 초기 구성
    updateYAxisOptions();
}

// 5. updateYAxisOptions 함수 수정
function updateYAxisOptions() {
    const xValue = document.getElementById('xAxisSelect').value;
    const ySelect = document.getElementById('yAxisSelect');
    const y2Select = document.getElementById('y2AxisSelect');
    
    // 현재 X축에 맞는 옵션들 저장
    currentYAxisOptions = getYAxisOptionsByX(xValue);
    
    // Y축 옵션 구성
    populateSelectWithOptions(ySelect, currentYAxisOptions);
    
    // wavelength, angle일 때 Y2축 비활성화
    if (xValue === 'wavelength' || xValue === 'angle' || xValue === 'delta_u') {
        y2Select.disabled = true;
        y2Select.value = '';
        y2Select.innerHTML = '<option value="">-- Y2축 사용 불가 --</option>';
    } else {
        y2Select.disabled = false;
        // Y2축 옵션 구성 (Y축 선택값 제외)
        const yValue = ySelect.value;
        populateSelectWithOptions(y2Select, currentYAxisOptions, yValue);
    }
    
    toggleAngleFilter();
}

// 6. filterY2Options 함수 수정
function filterY2Options() {
    const xValue = document.getElementById('xAxisSelect').value;
    const yValue = document.getElementById('yAxisSelect').value;
    const y2Select = document.getElementById('y2AxisSelect');
    
    // wavelength, angle일 때는 Y2축 비활성화 유지
    if (xValue === 'wavelength' || xValue === 'angle' || xValue === 'delta_u') {
        return;
    }
    
    // 현재 Y축 옵션에서 선택된 값 제외하고 Y2축 재구성
    populateSelectWithOptions(y2Select, currentYAxisOptions, yValue);
}

function updateGraphFilters() {
	const color = document.getElementById("tvColorFilter").value;
	const line = document.getElementById("tvLineFactor").value;
	
	document.getElementById('currentGraphColorFilter').textContent = color || "선택안됨";
	document.getElementById('currentGraphLineFactor').textContent = line || "선택안됨";
	
	currentFilters.colorFilter = color;
	currentFilters.lineFactor = line;
	
	validateForm();
}

// 3. 각도 필터 표시/숨김 함수 추가
function toggleAngleFilter() {
    const xValue = document.getElementById('xAxisSelect').value;
    const yValue = document.getElementById('yAxisSelect').value;
    const angleFilterRow = document.getElementById('angleFilterRow');
    const angleFilterSection = document.getElementById('angleFilterSection');
    
    if (xValue === 'wavelength') {
        angleFilterRow.classList.replace('d-none', 'd-block');
        
        // 각도 필터만 보이기/숨기기
        if (yValue === 'angular_spectrum_intensity') {
            angleFilterSection.classList.replace('d-none', 'd-block');
        } else {
            angleFilterSection.classList.replace('d-none', 'd-block');
        }
    } else {
        angleFilterRow.classList.replace('d-none', 'd-block');
        
        // 초기화
        document.getElementById('angleAll').checked = true;
        ['angle0', 'angle15', 'angle30', 'angle45', 'angle60'].forEach(id => {
            const checkbox = document.getElementById(id);
            checkbox.checked = true;
            checkbox.disabled = true;
        });
        selectedAngles = ['all'];
        
        document.getElementById('resolutionToggle').checked = false;
        document.getElementById('resolutionLabel').textContent = 'Standard (4nm)';
        isHighResolution = false;
        
    }
}

function handleAllAngleCheck() {
    const allCheckbox = document.getElementById('angleAll');
    const individualCheckboxes = ['angle0', 'angle15', 'angle30', 'angle45', 'angle60'];
    
    if (allCheckbox.checked) {
        // All 체크 시: 모든 개별 각도 체크 + 비활성화
        individualCheckboxes.forEach(id => {
            const checkbox = document.getElementById(id);
            checkbox.checked = true;
            checkbox.disabled = true;
        });
        selectedAngles = ['all'];
    } else {
        // All 해제 시: 모든 개별 각도 해제 + 활성화
        individualCheckboxes.forEach(id => {
            const checkbox = document.getElementById(id);
            checkbox.checked = false;
            checkbox.disabled = false;
        });
        selectedAngles = [];
    }
    
    // 그래프 업데이트
    if (dynamicGraphData) {
        renderDynamicGraph();
    }
}

function handleIndividualAngleCheck() {
    const individualCheckboxes = ['angle0', 'angle15', 'angle30', 'angle45', 'angle60'];
    
    selectedAngles = [];
    individualCheckboxes.forEach(id => {
        const checkbox = document.getElementById(id);
        if (checkbox.checked) {
            selectedAngles.push(checkbox.value);
        }
    });
    
    // 그래프 업데이트
    if (dynamicGraphData) {
        renderDynamicGraph();
    }
}

function filterSpectrumData(wavelengths, intensities) {
    if (isHighResolution || !Array.isArray(wavelengths) || !Array.isArray(intensities)) {
        return { x: wavelengths, y: intensities }; // High Resolution 또는 데이터 오류 시 그대로
    } else {
        // Standard Resolution: 4nm 간격 (index % 4 === 0)
        const filteredX = wavelengths.filter((_, i) => i % 4 === 0);
        const filteredY = intensities.filter((_, i) => i % 4 === 0);
        return { x: filteredX, y: filteredY };
    }
}

function handleResolutionToggle() {
    const toggle = document.getElementById('resolutionToggle');
    const label = document.getElementById('resolutionLabel');
    
    isHighResolution = toggle.checked;
    label.textContent = isHighResolution ? 'High Resolution (1nm)' : 'Standard (4nm)';
    
    if (dynamicGraphData) renderDynamicGraph();
}

function hideInitialMessage() {
	const initialMsg = document.getElementById('initialGraphMessage');
	if (initialMsg) {
		initialMsg.classList.remove('d-flex', 'align-items-center', 'justify-content-center');
		initialMsg.classList.add('d-none');
	}
	
	const gamutMsg = document.getElementById('gamutAvailableMsg');
	if (gamutMsg) {
		gamutMsg.remove()
	}
}

// ㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡ
// 8. 동적 그래프(Dynamic Graph) 업데이트 및 렌더링
// ㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡ

// 동적 그래프 업데이트
async function updateDynamicGraph() {
    const xAxis = document.getElementById('xAxisSelect').value;
    const yAxis = document.getElementById('yAxisSelect').value;
    const y2Axis = document.getElementById('y2AxisSelect').value;
    const chartType = document.getElementById('chartTypeSelect').value;
    const colorFilter = document.getElementById('tvColorFilter').value;
    const lineFactor = document.getElementById('tvLineFactor').value;
    
    // 선택된 컬럼 정보 추가
    const selectedCols = getSelectedColumns();
    
    if (!xAxis || !yAxis) {
        showToast("X축과 Y축을 모두 선택해주세요.", "warning");
        return;
    }
    
    if (!colorFilter || !lineFactor) {
        showToast("Color Filter, Line Factor를 모두 선택해 주세요.", "warning");
        return;
    }
    
    // 선택된 컬럼이 없으면 경고 (새로 추가)
    if (selectedCols.length === 0) {
        showToast("그래프에 표시할 DOE를 선택해주세요.", "warning");
        return;
    }
    
    try {
        const ids = new URLSearchParams(window.location.search).get("ids") || "";
        const params = new URLSearchParams({
            ids: ids,
            x_axis: xAxis,
            y_axis: yAxis,
            chart_type: chartType,
            color_filter: currentFilters.colorFilter,
            line_factor: currentFilters.lineFactor
        });
        
        if (y2Axis) params.append('y2_axis', y2Axis);
        
        // 선택된 컬럼 정보 추가
        if (selectedCols.length > 0) {
            params.append('selected_columns', selectedCols.join(','));
        }
        
        const response = await fetch(`${URLS.updateDynamic}?${params}`);
        const data = await response.json();
        
        if (data.success) {
            dynamicGraphData = { traces: data.data, config: data.config };
            renderDynamicGraph();
            hideInitialMessage();
        } else {
            showToast(data.error || "그래프 데이터 로드 실패", "error");
        }
    } catch (error) {
        console.error("동적 그래프 업데이트 오류:", error);
        showToast("그래프 생성 중 오류가 발생했습니다.", "error");
    }
}


// 동적 그래프 렌더링
function renderDynamicGraph() {
    if (!dynamicGraphData) return;
    
    const traces = [];
    const actualTraces = dynamicGraphData.traces || [];
    const chartType = dynamicGraphData.config.chart_type;
    const hasY2Axis = dynamicGraphData.config.y2_field;
    const xValue = document.getElementById('xAxisSelect').value;
    const yValue = document.getElementById('yAxisSelect').value;
    
    const isBarWithY2 = (chartType === 'bar' && hasY2Axis);
    const barWidth = isBarWithY2 ? 0.4 : 0.8;
    
    actualTraces.forEach(trace => {
        const isSpectrumGraph = (xValue === 'wavelength');
        
        let filteredData = { x: trace.x, y: trace.y };
        if (isSpectrumGraph) {
            filteredData = filterSpectrumData(trace.x, trace.y);
        }
        
        // X축이 doe_id일 때는 TPID로 변환
        let xData = filteredData.x;
        if (xValue === 'doe_id') {
            xData = filteredData.x.map(id => convertDoeIdToTpid(id));
        }
        
        // Legend 이름 처리
        let displayName = trace.name;
        if (xValue === 'doe_id') {
            displayName = trace.name;
        } else {
            displayName = convertDoeIdToTpid(trace.name);
        }
        
        const plotlyTrace = {
            x: xData,
            y: filteredData.y,
            name: displayName,
            mode: chartType === 'line' ? 'lines+markers' : 'markers',
            type: chartType === 'bar' ? 'bar' : 'scatter'
        };
        
        if (chartType === 'bar') {
            plotlyTrace.width = barWidth;
            if (isBarWithY2) plotlyTrace.offsetgroup = trace.yaxis === "y2" ? 'y2' : 'y1';
        }
        
        if (trace.yaxis === "y2") {
            plotlyTrace.yaxis = "y2";
        }
        
        const needsAngleFiltering = xValue === 'wavelength' && yValue === 'angular_spectrum_intensity';
        
        if (needsAngleFiltering) {
            if (selectedAngles.includes('all')) {
                traces.push(plotlyTrace);
            } else if (selectedAngles.length > 0 && 
                       trace.angle !== undefined && 
                       selectedAngles.includes(trace.angle.toString())) {
                traces.push(plotlyTrace);
            }
        } else {
            traces.push(plotlyTrace);
        }
    });
    
    const layout = {
        title: `${getFieldLabel(dynamicGraphData.config.y_field)} vs ${getFieldLabel(dynamicGraphData.config.x_field)}`,
        xaxis: { title: getFieldLabel(dynamicGraphData.config.x_field) },
        yaxis: { title: getFieldLabel(dynamicGraphData.config.y_field) },
        margin: { t: 80, b: 50, l: 60, r: 60 },
        showlegend: true,
        barmode: 'group', 
    };
    
    if (dynamicGraphData.config.y2_field) {
        layout.yaxis2 = {
            title: getFieldLabel(dynamicGraphData.config.y2_field),
            side: 'right',
            overlaying: 'y'
        };
    }
    
    try {
        Plotly.newPlot('unifiedGraph', traces, layout, {responsive: true});
        currentGraphType = 'dynamic';
        hideInitialMessage();
    } catch (plotlyError) {
        console.error("Plotly 렌더링 오류:", plotlyError);
        showToast("그래프 렌더링 중 오류가 발생했습니다.", "error");
    }
}

// 필드 라벨 가져오기
function getFieldLabel(fieldValue) {
    if (!graphOptions) return fieldValue;
    
    const allOptions = [
        ...graphOptions.x_axis_options,
        ...graphOptions.y_axis_options
    ];
    
    const option = allOptions.find(opt => opt.value === fieldValue);
    return option ? option.label : fieldValue;
}

// 유효성 검사
function validateForm() {
    const xAxis = document.getElementById('xAxisSelect').value;
    const yAxis = document.getElementById('yAxisSelect').value;
    const colorFilter = document.getElementById('tvColorFilter').value;
    const lineFactor = document.getElementById('tvLineFactor').value;
    const updateBtn = document.getElementById('updateGraphBtn');
    
    const hasXY = xAxis && yAxis;
    const hasFilters = colorFilter && lineFactor;
    const shouldEnable = hasXY && hasFilters;
    
    updateBtn.disabled = !shouldEnable;
    
    if (!hasFilters) {
		updateBtn.textContent = "Color Filter & Line Factor 선택 필요";
		updateBtn.classList.add('btn-secondary');
		updateBtn.classList.remove('btn-primary');
    } else if (!hasXY) {
		updateBtn.textContent = "X축 & Y축 선택 필요";
		updateBtn.classList.add('btn-secondary');
		updateBtn.classList.remove('btn-primary');
    } else {
		updateBtn.textContent = "그래프 업데이트";
		updateBtn.classList.add('btn-primary');
		updateBtn.classList.remove('btn-secondary');
    }
    
    validateGamutButton();
}

// ㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡ
// 9. TV차트(고정차트) 관련 함수
// ㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡ


// Angular Spectrum 차트 (각도 필터링)
function renderAngularSpectrumChart() {
    if (!tvChartsData.angular_spectrum_chart) return;
    
    const selectedAngle = currentChartFilters.angular_spectrum;
    let filteredTraces = tvChartsData.angular_spectrum_chart.traces;
    
    if (selectedAngle !== 'all') {
        filteredTraces = filteredTraces.filter(trace => 
            trace.name.includes(`_${selectedAngle}°`)
        );
    }
    
    const chartData = { traces: filteredTraces };
    Plotly.react("tv-angular-spectrum-chart", filteredTraces, layout)
}

// 차트 옵션 이벤트 처리
function setupChartOptionEvents() {
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('chart-color-option')) {
            e.preventDefault();
            currentChartFilters[e.target.dataset.chart] = e.target.dataset.color;
        }
    });
    
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('chart-angle-option')) {
            e.preventDefault();
            currentChartFilters.angular_spectrum = e.target.dataset.angle;
        }
    });
    
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('chart-option') && e.target.dataset.option === 'export') {
            e.preventDefault();
            exportChart(e.target.dataset.chart);
        }
    });
}

// 차트 내보내기
function exportChart(chartType) {
    const containerId = chartType.replace('_', '-') + '-chart';
    const element = document.getElementById(containerId);
    
    if (element && element.data) {
        Plotly.downloadImage(element, {
            format: 'png',
            filename: `${chartType}_chart`,
            width: 800,
            height: 600
        });
    }
}


function filterColorChart(chartId, checkboxPrefix) {
    const selectedColors = [];
    ['white', 'red', 'green', 'blue'].forEach(color => {
        const checkbox = document.getElementById(`${checkboxPrefix}-${color}`);
        if (checkbox?.checked) selectedColors.push(color);
    });
    
    const chartDiv = document.getElementById(chartId);
    if (!chartDiv || !chartDiv.data) return;
    
    const update = {
        visible: chartDiv.data.map(trace => {
            const traceName = trace.name ? trace.name.toLowerCase() : "";
            return selectedColors.some(color => traceName.includes(color));
        })
    };
    
    Plotly.restyle(chartId, update);
}

// 범용 이벤트 등록 함수
function attachColorCheckboxEvents(chartId, checkboxPrefix) {
    ['white', 'red', 'green', 'blue'].forEach(color => {
        const checkbox = document.getElementById(`${checkboxPrefix}-${color}`);
        if (!checkbox) {
            console.warn(`체크박스 없음: ${checkboxPrefix}-${color}`); // ✨ 추가
            return;
        }
        
        const newCheckbox = checkbox.cloneNode(true);
        checkbox.parentNode.replaceChild(newCheckbox, checkbox);
    });
    
    // 새 이벤트 등록
    ['white', 'red', 'green', 'blue'].forEach(color => {
        const checkbox = document.getElementById(`${checkboxPrefix}-${color}`);
        if (checkbox) {
            checkbox.addEventListener('change', () => {
                filterColorChart(chartId, checkboxPrefix);
            });
        }
    });
}

function initializeChartLayouts() {
    // ✅ fetch 제거, 바로 initialLayouts 사용
    if (!initialLayouts) {
        console.warn("initialLayouts가 없습니다.");
        return;
    }
    
    chartConfigs.forEach(config => {
        if (initialLayouts[config.id]) {
            config.data.layout = initialLayouts[config.id];
        }
    });
    
    if (window.ChartShowcaseManager) {
        window.ChartShowcaseManager.createAllCharts();
    } else {
        console.warn('ChartShowcaseManager를 찾을 수 없습니다.');
    }
}


// ㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡ
// 10. 드롭다운 Refresh 및 데이터 재조회 관련
// ㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡ


async function refreshColorFilterDropdown() {
    try {
        const response = await fetch(URLS.colorFilterList);
        const data = await response.json();
        
        const select = document.getElementById('tvColorFilter');
        const currentValue = select.value;
        
        select.innerHTML = '<option value="">-- Color Filter 선택 --</option>';
        data.forEach(filter => {
            const option = document.createElement('option');
            option.value = filter.id;
            option.textContent = filter.label;
            select.appendChild(option);
        });
        
        // 기존 선택값 복원 (존재하면)
        if (currentValue && select.querySelector(`option[value="${currentValue}"]`)) {
            select.value = currentValue;
        } else if (currentValue) {
            // 선택된 필터가 삭제됨 → 테이블 초기화
            select.value = '';
            resetFilteredTableData();
            showToast("선택된 Color Filter가 삭제되어 테이블이 초기화되었습니다.", "warning");
        }
        
    } catch (error) {
        console.error("Color Filter 목록 갱신 실패:", error);
    }
}

// ✨ 새로 추가: Line Factor 드롭다운 갱신
async function refreshLineFactorDropdown() {
    try {
        const response = await fetch(URLS.lineFactorList);
        const data = await response.json();
        
        const select = document.getElementById('tvLineFactor');
        const currentValue = select.value;
        
        select.innerHTML = '<option value="">-- Line Factor 선택 --</option>';
        data.forEach(factor => {
            const option = document.createElement('option');
            option.value = factor.id;
            option.textContent = factor.label;
            select.appendChild(option);
        });
        
        // 기존 선택값 복원 (존재하면)
        if (currentValue && select.querySelector(`option[value="${currentValue}"]`)) {
            select.value = currentValue;
        } else if (currentValue) {
            // 선택된 필터가 삭제됨 → 테이블 초기화
            select.value = '';
            resetFilteredTableData();
            showToast("선택된 Line Factor가 삭제되어 테이블이 초기화되었습니다.", "warning");
        }
        
    } catch (error) {
        console.error("Line Factor 목록 갱신 실패:", error);
    }
}

// ✨ 새로 추가: 필터 관련 테이블 데이터 초기화
function resetFilteredTableData() {
    if (!ivlTableInstance) return;
    
    // IVL 기본 데이터만 다시 로드
    loadInitialTableData();
    
    // 필터 상태 초기화
    prevColorFilter = "";
    prevLineFactor = "";
    
    validateForm();

// ㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡ
// 11. TPID 매핑 및 이름 변환 관련
// ㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡ


// TPID 생성 및 매핑 함수 (새로 추가)
function initializeTpidMapping() {
    doeIdToTpidMap = {};
    selectedDoes.forEach(doe => {
        const lot = String(doe.runsheet_lot || 0).padStart(2, '0');
        const gls = String(doe.gls_id || 0).padStart(2, '0');
        const tpid = lot + gls;
        const sequence = doe.sequence; // sequence가 없으면 '0'
        
        doeIdToTpidMap[doe.id] = {
            tpid: tpid,              // 순수 TPID: "0512"
            sequence: sequence,       // sequence: "A" or "0"
            displayName: `${sequence}-${tpid}`,  // 표시용: "A-0512"
        };
    });
}

// doe_id를 TPID로 변환하는 함수 (새로 추가)
function convertDoeIdToTpid(doeIdOrString) {
    const str = String(doeIdOrString);
    
    // "DOE-123_45°" 형태 처리 (각도 정보)
    const angleMatch = str.match(/(.+?)(_\d+°)$/);
    if (angleMatch) {
        const doePartMatch = angleMatch[1].match(/\d+/);
        if (doePartMatch) {
            const mapping = doeIdToTpidMap[parseInt(doePartMatch[0])];
            if (mapping) {
                return mapping.displayName + angleMatch[2];
            }
        }
        return str;
    }
    
    const colorXYMatch = str.match(/(.+?)_(White|Red|Green|Blue)_(x|y)$/i);
    if (colorXYMatch) {
        const doePartMatch = colorXYMatch[1].match(/\d+/);
        if (doePartMatch) {
            const mapping = doeIdToTpidMap[parseInt(doePartMatch[0])];
            if (mapping) {
                // "V12-0512_White_x" 형태로 반환
                return mapping.displayName + '_' + colorXYMatch[2] + '_' + colorXYMatch[3];
            }
        }
        return str;
    }
    
    // "DOE-123_white" 형태 처리 (색상만)
    const colorMatch = str.match(/(.+?)_(White|Red|Green|Blue)$/i);
    if (colorMatch) {
        const doePartMatch = colorMatch[1].match(/\d+/);
        if (doePartMatch) {
            const mapping = doeIdToTpidMap[parseInt(doePartMatch[0])];
            if (mapping) {
                return mapping.displayName + '_' + colorMatch[2];
            }
        }
        return str;
    }
    
    // 숫자인 경우
    if (typeof doeIdOrString === 'number') {
        const mapping = doeIdToTpidMap[doeIdOrString];
        return mapping ? mapping.displayName : str;
    }
    
    // 일반 문자열
    const match = str.match(/\d+/);
    if (match) {
        const mapping = doeIdToTpidMap[parseInt(match[0])];
        return mapping ? mapping.displayName : str;
    }
    
    return str;
}

// TV 차트의 traces를 TPID로 변환하는 함수 (새로 추가)
function convertTracesToTpid(traces) {
    if (!traces || !Array.isArray(traces)) return traces;
    return traces.map(trace => ({ ...trace, name: convertDoeIdToTpid(trace.name) }));
}

// ㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡ
// 12. Angular Spectrum Filter 관련
// ㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡ


// Angular Spectrum 차트 각도 필터 함수들 (새로 추가)
function handleAngularAllCheck() {
    const allCheckbox = document.getElementById('angular-all');
    const individualCheckboxes = ['angular-0', 'angular-15', 'angular-30', 'angular-45', 'angular-60'];
    
    if (allCheckbox.checked) {
        // All 체크 시: 모든 개별 각도 체크 + 비활성화
        individualCheckboxes.forEach(id => {
            const checkbox = document.getElementById(id);
            if (checkbox) {
                checkbox.checked = true;
                checkbox.disabled = true;
            }
        });
        angularSelectedAngles = ['all'];
    } else {
        // All 해제 시: 모든 개별 각도 해제 + 활성화
        individualCheckboxes.forEach(id => {
            const checkbox = document.getElementById(id);
            if (checkbox) {
                checkbox.checked = false;
                checkbox.disabled = false;
            }
        });
        angularSelectedAngles = [];
    }
    
    // 차트 다시 렌더링
    filterAngularSpectrumChart();
}

function handleAngularIndividualCheck() {
    const individualCheckboxes = ['angular-0', 'angular-15', 'angular-30', 'angular-45', 'angular-60'];
    
    angularSelectedAngles = [];
    individualCheckboxes.forEach(id => {
        const checkbox = document.getElementById(id);
        if (checkbox && checkbox.checked) {
            angularSelectedAngles.push(checkbox.value);
        }
    });
    
    // 차트 다시 렌더링
    filterAngularSpectrumChart();
}

// Angular Spectrum 차트 필터링 함수 (새로 추가)
function filterAngularSpectrumChart() {
    const chartDiv = document.getElementById('tv-angular-spectrum-chart');
    
    if (!chartDiv || !chartDiv.data) {
        console.warn('Angular Spectrum 차트 데이터가 없습니다.');
        return;
    }
    
    const update = {
        visible: chartDiv.data.map(trace => {
            // All이 선택된 경우 모든 trace 표시
            if (angularSelectedAngles.includes('all')) {
                return true;
            }
            
            // trace.name에서 각도 추출 (예: "V12-0512_0°" -> "0")
            const angleMatch = trace.name.match(/_(\d+)°/);
            if (angleMatch) {
                return angularSelectedAngles.includes(angleMatch[1]);
            }
            return true;
        })
    };
    
    Plotly.restyle('tv-angular-spectrum-chart', update);
}

// ㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡ
// 13. Delta V 기준선 관련
// ㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡ


function openBaselineEditor() {
    const editorWindow = window.open(`${URLS.openBaseline}`, "_blank", "width=800,height=600");
    const timer = setInterval(() => {
        if (editorWindow.closed) {
            clearInterval(timer);
            refreshBaselineDropdown();
        }
    }, 500);
}

async function refreshBaselineDropdown() {
    try {
        const response = await fetch(`${URLS.refreshBaseline}`);
        const data = await response.json();
        
        const dropdown = document.getElementById('tvDeltaVBaseline');
        const currentValue = dropdown.value;
        
        dropdown.innerHTML = '<option value="">-- 선택 안함 --</option>';
        data.baselines.forEach(baseline => {
            const option = document.createElement('option');
            option.value = baseline.id;
            option.textContent = `${baseline.label} (${baseline.created_user?.full_name || "Unknown"})`;
            dropdown.appendChild(option);
        });
        
        if (currentValue && dropdown.querySelector(`option[value='${currentValue}']`)) {
            dropdown.value = currentValue;
        }
        
        showToast("기준선 목록이 업데이트되었습니다.", "success");
    } catch (error) {
        console.error("기준선 목록 업데이트 실패:", error);
        showToast("기준선 목록 업데이트 실패", "error");
    }
}

async function applyDeltaVBaseline() {
    const selectedId = document.getElementById('tvDeltaVBaseline').value;
    const chartDiv = document.getElementById('tv-delta-v-chart');
    
    if (!chartDiv || !chartDiv.data) return;
    
    const existingTraces = chartDiv.data
        .filter(trace => trace && (!trace.name || !trace.name.toLowerCase().includes('baseline')))
        .map(trace => ({ ...trace, line: trace.line ? {...trace.line} : undefined, marker: trace.marker ? {...trace.marker} : undefined }));
    
    if (!selectedId) {
        Plotly.react('tv-delta-v-chart', existingTraces, chartDiv.layout);
        return;
    }
    
    try {
        const response = await fetch(`${URLS.applyDelta}?baseline_id=${encodeURIComponent(selectedId)}`);
        if (!response.ok) { showToast('서버 오류: 기준선을 찾을 수 없습니다.', "error"); return; }
        
        const data = await response.json();
        if (!data.success) { showToast(data.error || "기준선 데이터를 불러올 수 없습니다.", "error"); return; }
        
        const baselineTrace = {
            x: data.times, y: data.delta_vs, name: 'Baseline: ' + data.label,
            type: 'scatter', mode: 'lines',
            line: { color: 'rgba(128, 128, 128, 0.5)', width: 1, dash: 'dot' },
            showlegend: true, hoverinfo: 'x+y+name'
        };
        
        Plotly.react('tv-delta-v-chart', [...existingTraces, baselineTrace], chartDiv.layout);
        showToast('기준선 "' + data.label + '"이 적용되었습니다.', "success");
    } catch (error) {
        console.error("기준선 적용 오류:", error);
        showToast("기준선 적용 중 오류가 발생했습니다.", "error");
    }
}

// ㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡ
// 14. 페이지 이동 및 상태 저장/복원
// ㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡ

// 상태 저장/복원 관련 함수들
function goToDeviceDetail(doeId) {
    const match = String(doeId).match(/\d+/);
    const pk = match ? match[0] : doeId;
    const currentIds = new URLSearchParams(window.location.search).get("ids") || '';
    
    sessionStorage.setItem('compare_tv_state', JSON.stringify({
        colorFilter: document.getElementById('tvColorFilter').value,
        lineFactor: document.getElementById('tvLineFactor').value,
        agingTime: document.getElementById('ltAgingTime').value,
        profileId: profileId, ids: currentIds, timestamp: Date.now()
    }));
    
    window.location.href = `/pao/device_detail/${pk}/?from=compare_tv&profile_id=${profileId}&ids=${encodeURIComponent(currentIds)}`;
}

function restoreCompareState() {
	const savedState = sessionStorage.getItem('compare_tv_state');
	if (!savedState) return false;
	
	const state = JSON.parse(savedState);
	
	// 타임 스템프 체크 (5분 이상 경과시 무시)
	if (Date.now() - state.timestamp > 300000) {
		sessionStorage.removeItem('compare_tv_state');
		return false;
	}
	
	document.getElementById('tvColorFileter').value = state.colorFilter || '';
	document.getElementById('tvLineFactor').value = state.lineFactor || '';
	document.getElementById('ltAgingTime').value = state.agingTime || '';
	
	sessionStorage.removeItem('compare_tv_state');
	return true;
}

async function handleDoeChanges() {
	const changes = sessionStorage.getItem('doe_changes');
	if (!changes) return;
	
	const changeData = JSON.parse(changes);
	sessionStorage.removeItem('doe_changes');
	
	if (changeData.action === 'delete') {
		const deletedId = changeData.deletedDoeId.toSting();
		
		id (ivlTableInstance) {
			const column = ivlTableInstance.getColumns();
			const targetColumn = columns.find(col => col.getField() === deletedId);
			
			if (targetColumn) {
				targetColumn.delete();
				selectedColumns.delete(deletedId);
				referenceColumns.delete(deletedId);
				hiddenColumns.delete(deletedId);
                showToast(`DOE ${convertDoeIdToTpid(deletedId)}가 삭제되었습니다.`, 'warning');
			}
		}
	} else if (changeData.action === 'update') {
		// DOE 수정된 경우: 해당 컬럼만 재조회
		const updatedId = changeData.updatedDoeId;
		await refreshSingleDoeColumn(updatedId);
		showToast(`DOE ${convertDoeIdToTpid(updatedId)} 데이터가 갱신되었습니다.`, 'success');
	}
}

async function refreshSingleDoeColumn(doeId) {
    if (!ivlTableInstance) return;
    
    const colorFilter = document.getElementById('tvColorFilter').value;
    const lineFactor = document.getElementById('tvLineFactor').value;
    const agingTime = document.getElementById('ltAgingTime').value || 30;
    
    try {
        const ivlResponse = await fetch(`${URLS.ivlTable}?ids=${doeId}`);
        const iclData = await ivlResponse.json();
        
        if (ivlData.table_data) {
            ivlTableInstance.updateOrAddData(ivlData.table_data);
        }
        
        if (colorFilter && lineFactor) {
            const colorResponse = await fetch(
                `${URLS.ivlColorTable}?ids=${doeId}&dolor_filter=${encodeURIComponent(colorFilter)}&line_factor=${encodeURIComponent(lineFactor)}`
            );
            const colorData = await colorResponse.json();
            
            if (colorData.table_data) {
                ivlTableInstance.updateOrAddData(colorData.table_data);
            }
            
            const angleResponse = await fetch(`${URLS.angleTable}?ids=${doeId}`);
            const angleData = await angleResponse.json();
            
            if (angleData.table_data) {
                ivlTableInstance.updateOrAddData(angleData.table_data);
            }
            
            const ltResponse = await fetch(`${ltTable}?ids=${doeId}&color_filter=${encodeURIComponent(colorFilter)}&aging_tile=${agingTime}`
            );
            const ltData = await ltResponse.json();
            
            if (ltData.table_data) {
                ivlTableInstance.updateOrAddData(ltData.table_data);
            }
        }
        
        updateColumnStyles();
        applyVisibilityState(); // ✨ 추가: 숨김 상태 재적용
        
    } catch (error) {
        console.error('DOE 컬럼 갱신 실패:', error);
        showToast('데이터 갱신 중 오류가 발생했습니다.', 'error');
    }
}

// ㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡ
// 15. export 관련
// ㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡ

function exportSelectedData() {
    if (!ivlTableInstance) {
        showToast("테이블이 아직 로드되지 않았습니다.", "warning");
        return;
    }
    
    if (selectedColumns.size === 0) {
        showToast("Export할 컬럼을 먼저 선택해주세요. (헤더 클릭으로 선택)", "warning");
        return;
    }
    
    // ✨ 1. 현재 테이블의 컬럼 순서 가져오기 (드래그로 변경된 순서 반영)
    const currentColumns = ivlTableInstance.getColumns();
    const orderedColumns = ['fieldName'];  // 첫 컬럼은 항상 fieldName
    
    currentColumns.forEach(col => {
        const field = col.getField();
        // fieldName 제외, 선택된 컬럼만 추가
        if (field !== 'fieldName' && selectedColumns.has(field)) {
            orderedColumns.push(field);
        }
    });
    
    const allData = ivlTableInstance.getData();
    
    // ✨ 2. 헤더에 ref. 표시 추가
    const filteredData = allData.map(row => {
        const newRow = {};
        orderedColumns.forEach(col => {
            let headerName;
            
            if (col === 'fieldName') {
                headerName = '측정 항목';
            } else {
                // TPID 변환
                const tpidName = convertDoeIdToTpid(col);
                
                // ✨ ref. 표시 추가
                if (referenceColumns.has(col)) {
                    headerName = `${tpidName} (ref.)`;
                } else {
                    headerName = tpidName;
                }
            }
            
            newRow[headerName] = row[col];
        });
        return newRow;
    });
    
    // SheetJS로 Excel 생성
    const worksheet = XLSX.utils.json_to_sheet(filteredData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "TV Data");
    
    // 파일명 생성
    const today = new Date();
    const dateStr = today.getFullYear().toString().slice(2) +
                    (today.getMonth() + 1).toString().padStart(2, '0') +
                    today.getDate().toString().padStart(2, '0');
    const safeTitle = profileTitle.replace(/[<>:"/\\|?*]/g, '_');
    const xlsxfilename = `${safeTitle}_${dateStr}.xlsx`;
    
    XLSX.writeFile(workbook, xlsxfilename);
    
    showToast(`${selectedColumns.size}개 컬럼이 "${xlsxfilename}"으로 다운로드됩니다.`, "success");
}


// ㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡ
// 16. DOMContentLoaded 및 이벤트 바인딩
// ㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡ



// [그래프생성] 버튼 이벤트 
document.getElementById('generateChartsBtn').addEventListener('click', async function() {
    const colorFilter = document.getElementById('tvColorFilter').value;
    const lineFactor = document.getElementById('tvLineFactor').value;
    const agingTime = document.getElementById('ltAgingTime').value || 30;
    const selectedCols = getSelectedColumns();
    
    if (!colorFilter || !lineFactor) {
        showToast("Color Filter와 Line Factor를 선택해주세요.", "warning");
        return;
    }
    
    if (selectedCols.length === 0) {
		showToast('그래프에 표시할 DOE를 선택해주세요.', 'warning');
		return;
    }
    
    try {
        const ids = new URLSearchParams(window.location.search).get("ids") || "";
        const params = new URLSearchParams({
            ids: ids, 
            color_filter: colorFilter, 
            line_factor: lineFactor,
            aging_time: agingTime
        });
        
        if (selectedCols.length > 0) {
            params.append('selected_columns', selectedCols.join(','));
        }
        
        const url = `${URLS.getChart}?${params}`;
        
        fetch(url)
            .then(function (res) {
                if (!res.ok) {
                    throw new Error(`HTTP 오류: ${res.status}`);
                }
                return res.json();
            })
            .then(function (data) {
                if (data.success) {
					chartConfigs.forEach(config => {
						const dataKey = config.id.replace('tv-', '').replace(/-/g, '_');
						if (data.chart_data[dataKey]) {
							config.data.data = convertTracesToTpid(data.chart_data[dataKey].traces || []);
						}
					});
					
					chartConfigs.forEach(config => {
						const chartDiv = document.getElementById(config.id);
						if (chartDiv && chartDiv.data) {
							const mergedLayout = {
								...chartDiv.layout,
								...data.layouts[config.id]
							};
							
							Plotly.react(
								config.id,
								config.data.data,
								mergedLayout
							);
						}
					});
					
					setTimeout(() => {
					    attachColorCheckboxEvents('tv-lt-chart', 'lt');
					    attachColorCheckboxEvents('tv-wxy-chart', 'wxy');
					    attachColorCheckboxEvents('tv-color-coordinate-chart', 'cc');
					    
					    // ✨ 추가: Angular Spectrum 각도 필터 이벤트 등록
					    const angularAllCheckbox = document.getElementById('angular-all');
					    if (angularAllCheckbox) {
					        const newCheckbox = angularAllCheckbox.cloneNode(true);
					        angularAllCheckbox.parentNode.replaceChild(newCheckbox, angularAllCheckbox);
					        newCheckbox.addEventListener('change', handleAngularAllCheck);
					    }
					    
					    ['angular-0', 'angular-15', 'angular-30', 'angular-45', 'angular-60'].forEach(id => {
					        const checkbox = document.getElementById(id);
					        if (checkbox) {
					            const newCheckbox = checkbox.cloneNode(true);
					            checkbox.parentNode.replaceChild(newCheckbox, checkbox);
					            newCheckbox.addEventListener('change', handleAngularIndividualCheck);
					        }
					    });
					    filterAngularSpectrumChart();
					    
					    // ✨ 추가: Delta V 기준선 드롭다운 이벤트 재등록
					    const baselineDropdown = document.getElementById('tvDeltaVBaseline');
					    if (baselineDropdown) {
					        // 기존 이벤트 제거 후 재등록
					        const newDropdown = baselineDropdown.cloneNode(true);
					        baselineDropdown.parentNode.replaceChild(newDropdown, baselineDropdown);
					        newDropdown.addEventListener('change', applyDeltaVBaseline);
					    }
					}, 100);
					
                    showToast(data.message, "success");
                } else {
                    showToast(data.error || "차트 데이터 로드 실패", "error");
                }
            })
            .catch(function(error) {
                showToast("차트 생성 중 오류가 발생했습니다.", "error");
            });
    } catch (error) {
        console.error("TV 차트 생성 오류:", error);
        showToast("차트 생성 중 오류가 발생했습니다.", "error");
    }
});


import { DoeStructureComponent } from "../device_structure/device_structure.js";


document.addEventListener("DOMContentLoaded", async () => {

    new Choices("#doeSelect", {
        allowHTML: true,
    });

    const getStructureBtn = document.getElementById("getStructureBtn");
    getStructureBtn.addEventListener("click", () => {
        const selectedDoe = document.getElementById("doeSelect");
        const structureUrl = URLS.structure.replace(0, selectedDoe.value);
        const structureArea = document.getElementById("structureArea");
        new DoeStructureComponent(
            structureArea,
            structureUrl,
            URLS.drip,
            ["Order", "EC_Chamber", "Cell_No"],
            true,
            selectedDoes[selectedDoe.selectedIndex].text,
            true,
            true,
        );
    });

    tableManager = new TableManager();
    exportManager = new exportManager(tableManager);

    const exportBtn = document.getElementById('exportExcelBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            exportManager.exportSelectedData();
        });
    }

    // 1. 기초 매핑 및 데이터 준비
    initializeTpidMapping();
    
    // 2. ✨ 서버에서 받은 숨김 상태 초기화
    initializeTableState();
    
    // 3. 초기 테이블 로드
    await loadInitialTableData();
    
    // 4. 그래프 옵션 로드
    await loadGraphOptions();
    
    // 5. 차트 레이아웃 초기화
    if (typeof initialLayouts !== 'undefined' && initialLayouts) {
        initializeChartLayouts();
    }
    
    // 6. 세션 복원 및 초기 필터 데이터 로드
    const restored = restoreCompareState();
    const colorFilterVal = document.getElementById("tvColorFilter").value;
    const lineFactorVal = document.getElementById("tvLineFactor").value;
    
    if (colorFilterVal && lineFactorVal) {
        await loadAllAdditionalTablesAsync();
    }
    
    // 7. UI 컴포넌트 초기화
    initializeColumnVisibilityDropdown();
    initializeRowVisibilityDropdown();
    
    if (restored) handleDoeChanges();

    // 8. 이벤트 리스너 등록
    
    
    document.getElementById("colorOpenEditorBtn")?.addEventListener("click", () => openEditor(URLS.colorfilterEditor, 'colorFilter'));
	document.getElementById("lineOpenEditorBtn")?.addEventListener("click", () => openEditor(URLS.linefactorEditor, 'lineFactor'));

    document.getElementById("tvColorFilter").addEventListener("change", async () => {
        await loadAllAdditionalTablesAsync();
        validateForm();
    });
    
    document.getElementById("tvLineFactor").addEventListener("change", async () => {
        await loadAllAdditionalTablesAsync();
        validateForm();
    });
    
    document.getElementById("ltAgingTime").addEventListener("change", () => {
        if (document.getElementById("tvColorFilter").value) loadLtTableData();
    });

    const baselineDropdown = document.getElementById('tvDeltaVBaseline');
    if (baselineDropdown) baselineDropdown.addEventListener('change', applyDeltaVBaseline);

    document.getElementById('xAxisSelect').addEventListener('change', () => { updateYAxisOptions(); validateForm(); });
    document.getElementById('yAxisSelect').addEventListener('change', () => { filterY2Options(); toggleAngleFilter(); validateForm(); });

    document.getElementById('angleAll').addEventListener('change', handleAllAngleCheck);
    ['angle0', 'angle15', 'angle30', 'angle45', 'angle60'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', handleIndividualAngleCheck);
    });
    
    document.getElementById('resolutionToggle').addEventListener('change', handleResolutionToggle);
    document.getElementById('updateGraphBtn').addEventListener('click', updateDynamicGraph);
    
    const gamutBtn = document.getElementById('gamutAnalysisBtn');
    if (gamutBtn) gamutBtn.addEventListener('click', openGamutAnalysisWindow);

    document.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !document.getElementById('updateGraphBtn').disabled) updateDynamicGraph();
    });

    validateForm();
    setupChartOptionEvents();
    
    console.log("🚀 모든 기능 초기화 및 이벤트 등록 완료");
});

window.addEventListener('beforeunload', function() {
    if (gamutAnalysisWindow && !gamutAnalysisWindow.closed) gamutAnalysisWindow.close();
});
