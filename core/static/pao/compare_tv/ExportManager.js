// ExportManager.js - Excel 내보내기 관리

import { GlobalState } from './GlobalState.js';
import { Utils } from './Utils.js';

export class ExportManager {
    constructor(tableManager) {
        this.state = GlobalState.getInstance();
        this.tableManager = tableManager;
    }

    /**
     * 선택된 데이터 Excel로 내보내기
     */
    exportSelectedData() {
        if (!this.state.ivlTableInstance || this.state.selectedColumns.size === 0) {
            Utils.showToast("Export할 컬럼을 먼저 선택해주세요.", "warning");
            return;
        }

        // 1. 컬럼 순서 가져오기 (선택된 것만)
        const currentColumns = this.state.ivlTableInstance.getColumns();
        const orderedFields = ['fieldName'];
        currentColumns.forEach(col => {
            const field = col.getField();
            const fieldId = Utils.fieldToId(field);
            if (field !== 'fieldName' && fieldId && this.state.selectedColumns.has(fieldId)) {
                orderedFields.push(field);
            }
        });

        // 2. 숨겨진 행 제외 + 헤더 변환
        const allData = this.state.ivlTableInstance.getData();
        const filteredData = allData
            .filter(row => !this.state.hiddenRows.has(row.fieldName))
            .map(row => {
                const newRow = {};
                orderedFields.forEach(field => {
                    let headerName;
                    if (field === 'fieldName') {
                        headerName = '측정 항목';
                    } else {
                        const tpidName = window.convertDoeIdToTpid(field);
                        const fieldId = Utils.fieldToId(field);
                        headerName = fieldId && this.state.referenceColumns.has(fieldId)
                            ? `${tpidName} (ref.)`
                            : tpidName;
                    }
                    newRow[headerName] = row[field];
                });
                return newRow;
            });

        // 3. Excel 생성
        const worksheet = XLSX.utils.json_to_sheet(filteredData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "TV Data");

        // 4. 다운로드
        const today = new Date();
        const dateStr = today.getFullYear().toString().slice(2) +
                        (today.getMonth() + 1).toString().padStart(2, '0') +
                        today.getDate().toString().padStart(2, '0');
        const profileTitle = typeof window.profile !== 'undefined' ? window.profile.title : 'TV_Data';
        const safeTitle = profileTitle.replace(/[<>:"/\\|?*]/g, '_');
        const xlsxfilename = `${safeTitle}_${dateStr}.xlsx`;

        XLSX.writeFile(workbook, xlsxfilename);
        Utils.showToast(`${this.state.selectedColumns.size}개 컬럼이 "${xlsxfilename}"으로 다운로드됩니다.`, "success");
    }
}
