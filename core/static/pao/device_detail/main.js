function deleteDOE(pk) {
  var userConfirmed = confirm(`DOE${pk}를 정말 삭제하시겠습니까?`);
  if (userConfirmed) {
    if (sourceFrom === "compare_tv" && sourceProfileId && sourceIds) {
      const changes = {
        deletedDoeId: pk,
        action: "delete",
        timestamp: Date.now(),
      };
      sessionStorage.setItem("doe_changes", JSON.stringify(changes));

      const url =
        deleteDeviceBaseUrl +
        pk.toString() +
        `&from=compare_tv&profile_id=${sourceProfileId}&ids=${encodeURIComponent(
          sourceIds,
        )}`;
      location.href = url;
    } else {
      const url = deleteDeviceBaseUrl + pk.toString();
      location.href = url;
    }
  } else {
    return;
  }
}
function confirmDelete() {
  return confirm("정말 삭제하시겠습니까?");
}
document.addEventListener("DOMContentLoaded", () => {
  // Extract IVL IDs and DOE ID upfront
  const getIds = (id) => {
    const vjlIdCells = document.querySelectorAll(
      `${id} tbody tr td:first-child`,
    );
    return Array.from(vjlIdCells).map((cell) => cell.textContent.trim());
  };

  // Helper function for fetch with error handling
  async function fetchWithRetry(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP 오류: ${res.status}`);
      return { success: true, data: await res.json() };
    } catch (error) {
      console.error("요청 실패:", error);
      htmx.trigger(document.body, "toast-message", {
        message: "데이터를 불러오지 못했습니다.",
        tag: "error",
      });
      return { success: false, error: error.message };
    }
  }

  document.getElementById("plotBtn").addEventListener("click", async () => {
    try {
      const ivlIds = getIds("#vjl-table");
      const ivlParams = new URLSearchParams({
        ids: ivlIds.join(","),
      });
      const ivlChartUrl = `${ivlChartBaseUrl}?${ivlParams.toString()}`;
      const ltIds = getIds("#lt-table");
      const ltParams = new URLSearchParams({
        ids: ltIds.join(","),
      });
      const ltChartUrl = `${ltChartBaseUrl}?${ltParams.toString()}`;

      // Execute in parallel using Promise.allSettled
      const results = await Promise.allSettled([
        fetchWithRetry(ivlChartUrl),
        fetchWithRetry(ltChartUrl),
        fetchWithRetry(cvChartUrl),
        fetchWithRetry(ivChartUrl),
        fetchWithRetry(angleChartUrl),
      ]);

      const [ivlResult, ltResult, cvResult, ivResult, angleResult] = results;

      // Process IVL results
      if (ivlResult.value?.success && ivlResult.value.data.tag === "success") {
        const { vjl_data, cj_data, el_data } = ivlResult.value.data;
        console.log("el_data in device_detail:", el_data);
        const vjl_layout = document.getElementById("vjl-chart").layout;
        const cj_layout = document.getElementById("cj-chart").layout;
        const el_layout = document.getElementById("el-chart").layout;
        Plotly.react("vjl-chart", vjl_data, vjl_layout);
        Plotly.react("cj-chart", cj_data, cj_layout);
        Plotly.react("el-chart", el_data, el_layout);
      } else if (ivlResult.status === "fulfilled" && ivlResult.value.data) {
        htmx.trigger(document.body, "toast-message", ivlResult.value.data);
      }

      // Process LT results
      if (ltResult.value?.success && ltResult.value.data.tag === "success") {
        const lt_data = ltResult.value.data.lt_data;
        const lt_layout = document.getElementById("lt-chart").layout;
        Plotly.react("lt-chart", lt_data, lt_layout);
      } else if (ltResult.status === "fulfilled" && ltResult.value.data) {
        htmx.trigger(document.body, "toast-message", ltResult.value.data);
      }

      if (doeProductType === "PO") {
        // Process cv results
        if (cvResult.value?.success && cvResult.value.data.tag === "success") {
          const cv_data = cvResult.value.data.cv_data;
          const cv_layout = document.getElementById("cv-chart").layout;
          Plotly.react("cv-chart", cv_data, cv_layout);
        } else if (cvResult.status === "fulfilled" && cvResult.value.data) {
          htmx.trigger(document.body, "toast-message", cvResult.value.data);
        }

        // Process iv results
        if (ivResult.value?.success && ivResult.value.data.tag === "success") {
          const jv_data = ivResult.value.data.jv_data;
          const jv_layout = document.getElementById("iv-chart").layout;
          Plotly.react("iv-chart", jv_data, jv_layout);
        } else if (ivResult.status === "fulfilled" && ivResult.value.data) {
          htmx.trigger(document.body, "toast-message", ivResult.value.data);
        }
      } else if (doeProductType === "TV") {
        // Process angle results
        if (
          angleResult.value?.success &&
          angleResult.value.data.data.tag === "success"
        ) {
          const angleData = angleResult.value.data;
          Plotly.react(
            "angle-spectrum-chart",
            angleData.data.angle_spectrum_data,
            angleSpectrumLayout,
          );
          Plotly.react(
            "delta-uv-angle-chart",
            angleData.data.delta_uv_angle_data,
            deltaUvAngleLayout,
          );
        } else if (
          angleResult.status === "fulfilled" &&
          angleResult.value?.data
        ) {
          htmx.trigger(document.body, "toast-message", angleResult.value.data);
        }
      }
    } catch (error) {
      console.error("Unknown error:", error);
    }
  });
});
