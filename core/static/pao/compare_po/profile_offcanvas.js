function updateDoeCount(doeList) {
  const countEl = document.getElementById("doeCount");
  if (countEl) {
    countEl.textContent = doeList.length;
  }
}

function updateCompareURL(idList) {
  const url = new URL(window.location.href);
  const idsParam = Array.isArray(idList) ? idList.join(",") : "";
  if (idsParam) {
    url.searchParams.set("ids", idsParam);
  } else {
    url.searchParams.delete("ids");
  }

  // 페이지 이력 갱신
  history.replaceState({}, "", url);
}

// doe 목록 업데이트
function updateDoeListTable(doeList) {
  const tableBody = document.getElementById("deviceTableBody");
  tableBody.innerHTML = "";

  doeList.forEach((doe, index) => {
    const tr = document.createElement("tr");
    tr.setAttribute("data-doe-id", doe.id);

    tr.innerHTML = `
        <td>
        <button class="btn btn-close btn-sm delete-btn"></button>
        </td>
        <td>${doe.id}</td>
        <td>${doe.model}_${doe.exp_date}_${doe.color}_${doe.lot}_${doe.gls}</td>
    `;
    tableBody.appendChild(tr);
  });
}

// 삭제 버튼 이벤트 핸들러
function handleDeleteButtonClick(e, doeList, VJLTable) {
  if (e.target.classList.contains("delete-btn")) {
    const tr = e.target.closest("tr");
    const doeId = parseInt(tr.getAttribute("data-doe-id"));

    tr.remove();
    // VJL 테이블에서 행 삭제
    VJLTable.getRows().forEach((row) => {
      const data = row.getData();
      if (data.doe_id === doeId) {
        row.delete();
      }
    });

    const updatedDoeList = doeList.filter((d) => Number(d.id) !== doeId);
    updateDoeCount(updatedDoeList);
    updateCompareURL(updatedDoeList.map((d) => d.id));
    return updatedDoeList;
  }
}

// 저장 버튼 클릭 이벤트 핸들러
async function handleSaveButtonClick(
  doeList,
  profileId,
  baseAPSaveUrl,
  baseAPaddSaveUrl,
  VJLTableData
) {
  try {
    if (!doeList.length) {
      alert("저장할 DOE가 없습니다.");
      return;
    }

    const saveUrl = baseAPSaveUrl.replace(0, profileId);
    const poSaveUrl = baseAPaddSaveUrl.replace(0, profileId);

    const response = await fetch(saveUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": getCookie("csrftoken"),
      },
      body: JSON.stringify({
        does: doeList.map((d) => d.id),
      }),
    });

    const result = await response.json();
    // ...

    const poResponse = await fetch(poSaveUrl, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": getCookie("csrftoken"),
      },
      body: JSON.stringify({
        productspec: document.getElementById("id_label").value,
        layout: captureCharts(),
        vjl_table: VJLTableData,
      }),
    });

    if (!poResponse.ok) {
      const errorData = await poResponse.json();
      const errorMessage =
        errorData.detail || errorData.message || JSON.stringify(errorData);
      console.error("PO", errorMessage);
      throw new Error(`POAdditions save failed: ${errorMessage}`);
    } else {
      htmx.trigger(document.body, "toast-message", {
        tag: "success",
        message: "분석이 저장되었습니다.",
      });
    }

    const messages = [];
    if (Array.isArray(result.added) && result.added.length > 0) {
      messages.push(
        `${result.added.length}개의 DOE (ID: ${result.added})를 새로 추가했습니다.`
      );
    }
    if (Array.isArray(result.removed) && result.removed.length > 0) {
      messages.push(
        `${result.removed.length}개의 DOE (ID: ${result.removed})를 삭제했습니다.`
      );
    }
    if (messages.length) {
      alert(messages.join("\n"));
    }

    if (Array.isArray(result.removed) && result.removed.length > 0) {
      setTimeout(() => location.reload(), 100);
    }
  } catch (error) {
    console.error(error);
    alert("오류가 발생했습니다.");
  }
}

// 레이아웃 및 트레이스 추출
function captureCharts() {
  const layouts = {};
  const chartIds = [
    "vjl-chart",
    "cj-chart",
    "el-chart",
    "lt-chart",
    "cv-chart",
    "iv-chart",
  ];

  for (const id of chartIds) {
    const gd = document.getElementById(id);
    if (!gd) continue;
    layouts[id] = gd.layout || {};
  }

  return layouts;
}
