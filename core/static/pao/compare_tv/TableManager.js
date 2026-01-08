// TableManager.js - 테이블 관리

import { GlobalState } from './GlobalState.js';
import { Utils } from './Utils.js';

export class TableManager {
    constructor() {
        this.state = GlobalState.getInstance();
    }

    /**
     * 초기 테이블 데이터 로드
     */
    async loadInitialTableData() {
        try {
            const ids = new URLSearchParams(window.location.search).get("ids") || "";
            const response = await fetch(`${URLS.ivlTable}?ids=${ids}`);
            const data = await response.json();

            if (data.success && this.state.ivlTableInstance) {
                this.state.ivlTableInstance.setData(data.table_data);
            }
        } catch (error) {
            console.error("테이블 데이터 로드 실패:", error);
        }
    }

    /**
     * 컬럼 선택/해제
     */
    toggleColumnSelection(fieldId) {
        if (this.state.selectedColumns.has(fieldId)) {
            this.state.selectedColumns.delete(fieldId);
        } else {
            this.state.selectedColumns.add(fieldId);
        }
        this.updateColumnStyles();
    }

    /**
     * 전체 선택/해제 (숨겨진 컬럼 제외)
     */
    toggleSelectAllColumns() {
        const allFields = Object.keys(this.state.ivlTableInstance.getData()[0] || {})
            .filter(key => key !== "fieldName")
            .map(field => Utils.fieldToId(field))
            .filter(id => id !== null && !this.state.hiddenColumns.has(id));

        const allSelected = allFields.length > 0 && allFields.every(id => this.state.selectedColumns.has(id));

        if (allSelected) {
            this.state.selectedColumns.clear();
        } else {
            this.state.selectedColumns = new Set(allFields);
        }
        this.updateColumnStyles();
    }

    /**
     * 컬럼 스타일 업데이트
     */
    updateColumnStyles() {
        if (!this.state.ivlTableInstance) return;

        const columns = this.state.ivlTableInstance.getColumns();
        columns.forEach(col => {
            const field = col.getField();
            const fieldId = Utils.fieldToId(field);

            if (field === 'fieldName' || !fieldId) return;

            const element = col.getElement();
            if (this.state.selectedColumns.has(fieldId)) {
                element.classList.add('selected-column');
            } else {
                element.classList.remove('selected-column');
            }

            if (this.state.referenceColumns.has(fieldId)) {
                element.classList.add('reference-column');
            } else {
                element.classList.remove('reference-column');
            }
        });
    }

    /**
     * 컬럼 표시/숨김
     */
    toggleColumnVisibility(fieldId) {
        if (this.state.hiddenColumns.has(fieldId)) {
            this.state.hiddenColumns.delete(fieldId);
        } else {
            this.state.hiddenColumns.add(fieldId);
            // 숨길 때 선택/참조 해제
            this.state.selectedColumns.delete(fieldId);
            this.state.referenceColumns.delete(fieldId);
        }

        const field = Utils.idToField(fieldId);
        const column = this.state.ivlTableInstance.getColumn(field);
        if (column) {
            column.toggle();
        }

        this.updateColumnStyles();
    }

    /**
     * 행 표시/숨김
     */
    toggleRowVisibility(rowName) {
        if (this.state.hiddenRows.has(rowName)) {
            this.state.hiddenRows.delete(rowName);
        } else {
            this.state.hiddenRows.add(rowName);
        }

        if (this.state.ivlTableInstance) {
            const rows = this.state.ivlTableInstance.getRows();
            rows.forEach(row => {
                const data = row.getData();
                if (data.fieldName === rowName) {
                    const element = row.getElement();
                    if (this.state.hiddenRows.has(rowName)) {
                        element.style.display = 'none';
                    } else {
                        element.style.display = '';
                    }
                }
            });
        }
    }

    /**
     * 컬럼 visibility 드롭다운 업데이트
     */
    updateColumnVisibilityList() {
        const list = document.getElementById('columnVisibilityList');
        if (!list || !this.state.ivlTableInstance) return;

        list.innerHTML = '';

        const columns = this.state.ivlTableInstance.getColumns();
        columns.forEach(col => {
            const field = col.getField();
            if (field === 'fieldName') return;

            const fieldId = Utils.fieldToId(field);
            if (!fieldId) return;

            const tpidName = window.convertDoeIdToTpid(field);
            const isHidden = this.state.hiddenColumns.has(fieldId);

            const item = document.createElement('div');
            item.className = 'dropdown-item';
            item.innerHTML = `
                <input type="checkbox" ${isHidden ? '' : 'checked'}
                       onchange="window.getTableManager().toggleColumnVisibility(${fieldId})">
                <span>${tpidName}</span>
            `;
            list.appendChild(item);
        });
    }

    /**
     * 행 visibility 드롭다운 업데이트
     */
    updateRowVisibilityList() {
        const list = document.getElementById('rowVisibilityList');
        if (!list || !this.state.ivlTableInstance) return;

        list.innerHTML = '';

        const rows = this.state.ivlTableInstance.getData();
        rows.forEach(row => {
            const rowName = row.fieldName;
            const isHidden = this.state.hiddenRows.has(rowName);

            const item = document.createElement('div');
            item.className = 'dropdown-item';
            item.innerHTML = `
                <input type="checkbox" ${isHidden ? '' : 'checked'}
                       onchange="window.getTableManager().toggleRowVisibility('${rowName}')">
                <span>${rowName}</span>
            `;
            list.appendChild(item);
        });
    }

    /**
     * 선택된 컬럼 가져오기 (Field 형식)
     */
    getSelectedColumns() {
        return Array.from(this.state.selectedColumns).map(id => Utils.idToField(id));
    }

    /**
     * 참조 컬럼 가져오기 (Field 형식)
     */
    getReferenceColumns() {
        return Array.from(this.state.referenceColumns).map(id => Utils.idToField(id));
    }

    /**
     * 저장용 테이블 상태 가져오기
     */
    getTableStateForSave() {
        return {
            hidden_columns: JSON.stringify(Array.from(this.state.hiddenColumns)),
            hidden_rows: JSON.stringify(Array.from(this.state.hiddenRows)),
            column_order: JSON.stringify(this.state.columnOrder),
            reference_columns: JSON.stringify(Array.from(this.state.referenceColumns))
        };
    }
}
