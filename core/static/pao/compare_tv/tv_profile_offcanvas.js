// tv_profile_offcanvas.js
/**
 * TV 분석 프로필 Offcanvas 관리
 * - DOE 리스트 표시 및 관리
 * - DOE 삭제 기능
 * - Profile에 필터 설정 저장
 */

/**
 * DOE 개수 업데이트
 * @param {number} count - DOE 개수
 */
function updateDoeCount(count) {
    const countEl = document.getElementById("doeCount");
    if (countEl) {
        countEl.textContent = count;
    }
}

/**
 * URL의 ids 파라미터 업데이트
 * @param {Array<number>} idList - DOE ID 배열
 */
function updateCompareURL(idList) {
    const url = new URL(window.location.href);
    const idsParam = Array.isArray(idList) ? idList.join(",") : "";
    
    if (idsParam) {
        url.searchParams.set("ids", idsParam);
    } else {
        url.searchParams.delete("ids");
    }
    
    history.replaceState({}, "", url);
}

/**
 * Offcanvas DOE 테이블 업데이트
 * @param {Array<Object>} doeList - DOE 객체 배열
 */
function updateDoeListTable(doeList) {
    const tableBody = document.getElementById("deviceTableBody");
    if (!tableBody) return;
    
    tableBody.innerHTML = "";
    
    doeList.forEach((doe) => {
        const tr = document.createElement("tr");
        tr.setAttribute("data-doe-id", doe.id);
        
        // DOE 정보 형식: model_exp_date_color_runsheet_lot_gls_id
        const doeInfo = `${doe.model}_${doe.exp_date}_${doe.color}_${doe.runsheet_lot}_${doe.gls_id}`;
        
        tr.innerHTML = `
            <td>
                <button class="btn btn-close btn-sm delete-btn"></button>
            </td>
            <td>${doe.id}</td>
            <td>${doeInfo}</td>
        `;
        
        tableBody.appendChild(tr);
    });
    
    updateDoeCount(doeList.length);
}

/**
 * DOE 삭제 버튼 클릭 처리
 * @param {Event} e - 클릭 이벤트
 * @param {Array<Object>} doeList - 현재 DOE 리스트
 * @returns {Array<Object>} 업데이트된 DOE 리스트
 */
function handleDeleteButtonClick(e, doeList) {
    if (!e.target.classList.contains("delete-btn")) {
        return doeList;
    }
    
    const tr = e.target.closest("tr");
    const doeId = parseInt(tr.getAttribute("data-doe-id"));
    
    // 테이블에서 행 제거
    tr.remove();
    
    // DOE 리스트 업데이트
    const updatedDoeList = doeList.filter((d) => Number(d.id) !== doeId);
    
    // URL 업데이트
    updateDoeCount(updatedDoeList.length);
    updateCompareURL(updatedDoeList.map((d) => d.id));
    
    return updatedDoeList;
}

/**
 * 저장 버튼 클릭 처리
 * - Profile의 DOE 리스트 저장
 * - TVAdditions의 필터 설정 저장
 */
async function handleSaveButtonClick() {
    try {
        // 현재 URL에서 profile_id와 DOE IDs 추출
        const urlParams = new URLSearchParams(window.location.search);
        const profileId = window.location.pathname.split('/').filter(Boolean).pop();
        const idsParam = urlParams.get("ids");
        
        if (!idsParam) {
            alert("저장할 DOE가 없습니다.");
            return;
        }
        
        const doeIds = idsParam.split(",").map(id => parseInt(id));
        
        // 1. Profile DOE 리스트 저장
        const saveProfileUrl = `/pao/analysis-profiles/${profileId}/save-does/`;
        
        const profileResponse = await fetch(saveProfileUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-CSRFToken": getCookie("csrftoken"),
            },
            body: JSON.stringify({
                does: doeIds,
            }),
        });
        
        if (!profileResponse.ok) {
            throw new Error("Profile DOE 저장 실패");
        }
        
        const profileResult = await profileResponse.json();
        
        // 2. TVAdditions 필터 설정 저장
        const colorFilter = document.getElementById("tvColorFilter").value;
        const lineFactor = document.getElementById("tvLineFactor").value;
        const agingTime = parseInt(document.getElementById("ltAgingTime").value) || 30;
        
        const saveAdditionsUrl = `/pao/device/tv/save-additions/${profileId}/`;
        
        const additionsResponse = await fetch(saveAdditionsUrl, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                "X-CSRFToken": getCookie("csrftoken"),
            },
            body: JSON.stringify({
                color_filter: colorFilter,
                line_factor: lineFactor,
                aging_time: agingTime,
            }),
        });
        
        if (!additionsResponse.ok) {
            const errorData = await additionsResponse.json();
            const errorMessage = errorData.detail || errorData.message || JSON.stringify(errorData);
            console.error("TVAdditions 저장 실패:", errorMessage);
            throw new Error(`TVAdditions 저장 실패: ${errorMessage}`);
        }
        
        // 3. 성공 메시지
        const messages = [];
        if (Array.isArray(profileResult.added) && profileResult.added.length > 0) {
            messages.push(`${profileResult.added.length}개의 DOE (ID: ${profileResult.added.join(", ")})를 새로 추가했습니다.`);
        }
        if (Array.isArray(profileResult.removed) && profileResult.removed.length > 0) {
            messages.push(`${profileResult.removed.length}개의 DOE (ID: ${profileResult.removed.join(", ")})를 제거했습니다.`);
        }
        
        if (messages.length > 0) {
            alert(messages.join("\n"));
        } else {
            alert("분석이 저장되었습니다.");
        }
        
        // 4. DOE가 제거된 경우 페이지 새로고침
        if (Array.isArray(profileResult.removed) && profileResult.removed.length > 0) {
            setTimeout(() => location.reload(), 100);
        }
        
    } catch (error) {
        console.error("저장 오류:", error);
        alert("저장 중 오류가 발생했습니다: " + error.message);
    }
}

/**
 * CSRF 토큰 가져오기
 * @param {string} name - 쿠키 이름
 * @returns {string|null} 쿠키 값
 */
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== "") {
        const cookies = document.cookie.split(";");
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === name + "=") {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

/**
 * Offcanvas DOE 리스트 초기화
 * - URL에서 DOE IDs 추출
 * - selected_does 데이터로 테이블 생성
 * - 이벤트 리스너 연결
 */
function initializeDoeList() {
    // URL에서 DOE IDs 추출
    const urlParams = new URLSearchParams(window.location.search);
    const idsParam = urlParams.get("ids");
    
    if (!idsParam) {
        updateDoeCount(0);
        return;
    }
    
    const doeIds = idsParam.split(",").map(id => parseInt(id));
    
    // selected_does는 Django에서 전달 (전역 변수로 설정 필요)
    if (typeof selectedDoes === "undefined") {
        console.warn("selectedDoes 변수를 찾을 수 없습니다.");
        return;
    }
    
    // IDs에 해당하는 DOE만 필터링
    const filteredDoes = selectedDoes.filter(doe => doeIds.includes(doe.id));
    
    // 테이블 업데이트
    updateDoeListTable(filteredDoes);
    
    // 삭제 버튼 이벤트 연결
    const tableBody = document.getElementById("deviceTableBody");
    if (tableBody) {
        tableBody.addEventListener("click", (e) => {
            const updatedList = handleDeleteButtonClick(e, filteredDoes);
            if (updatedList !== filteredDoes) {
                // 리스트가 변경되면 테이블 다시 렌더링
                updateDoeListTable(updatedList);
            }
        });
    }
    
    // 저장 버튼 이벤트 연결
    const saveBtn = document.getElementById("saveSelectedBtn");
    if (saveBtn) {
        saveBtn.addEventListener("click", handleSaveButtonClick);
    }
}