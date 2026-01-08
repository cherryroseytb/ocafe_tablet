import {
  getCookie,
  isFirefox,
  getAllFilesFromDataTransfer,
} from "./helpers.js";

document.addEventListener("DOMContentLoaded", function () {
  const csrfToken = getCookie("csrftoken");

  function setupFileHandler(type) {
    const cfg = config[type];

    const {
      dropArea,
      fileInput,
      tableBody,
      uploadBtn,
      productInput,
      modelChoice,
      expDateSequenceSelect,
    } = cfg;

    // 드롭다운(모델/날짜) UI 존재 여부
    if (!!(cfg.modelChoice && cfg.expDateSequenceSelect)) {
      async function fetchDoeOptions() {
        try {
          const url = `/pao/api/doeoptions/?productType=${productInput}`;
          const response = await fetch(url);
          return await response.json();
        } catch (error) {
          console.error("Failed to fetch doe options:", error);
          return { options: {} };
        }
      }

      // --- 이미 한 번만 생성 (모델 바뀔 때 재생성 안 함) ---
      cfg.modelChoices = new Choices(modelChoice, {
        allowHTML: true,
        shouldSort: false,
        removeItemButton: true,
        placeholder: true,
        placeholderValue: "제품 모델 선택",
      });

      cfg.expDateSequenceChoices = new Choices(expDateSequenceSelect, {
        allowHTML: true,
        shouldSort: false,
        searchEnabled: true,
        itemSelectText: "",
      });

      // --- 날짜/차수 셀렉트 리셋 (placeholder + disabled) ---
      function resetExpDateChoices(placeholder = "실험날짜/차수 선택") {
        cfg.expDateSequenceChoices.clearChoices();
        cfg.expDateSequenceChoices.removeActiveItems();
        cfg.expDateSequenceChoices.setChoices(
          [{ value: "", label: placeholder, disabled: true, selected: true }],
          "value",
          "label",
          true // replaceChoices = true (완전 교체)
        );
        expDateSequenceSelect.disabled = true;
      }

      // --- 특정 모델에 대한 날짜/차수 채워넣기 ---
      function setExpDateChoicesForModel(list) {
        // list: [{ exp_date: 'YYYY-MM-DD', sequence: 1 }, ...]
        const items = (list || []).map((o) => ({
          value: `${o.exp_date}_${o.sequence}`,
          label: `${o.exp_date} (차수 ${o.sequence}차)`,
        }));
        cfg._dateItems = items;
        cfg.expDateSequenceChoices.clearChoices();
        cfg.expDateSequenceChoices.setChoices(items, "value", "label", true); // 완전 교체
        expDateSequenceSelect.disabled = items.length === 0;
      }

      resetExpDateChoices();
      // --- 모델 드롭다운 펼칠 때: 모델 목록 교체 주입 ---
      cfg.modelChoices.passedElement.element.addEventListener(
        "showDropdown",
        async () => {
          try {
            const data = await fetchDoeOptions();
            const models = Object.keys(data.options || {});
            const selectedModel = cfg.modelChoices.getValue(true); // 현재 선택한 모델
            const items = models
              .filter((m) => m !== selectedModel) // 선택한 모델 제외
              .map((m) => ({ value: m, label: m }));
            cfg._modelItems = items;
            cfg.modelChoices.clearChoices();
            cfg.modelChoices.setChoices(
              items,
              "value",
              "label",
              true // 완전 교체
            );
          } catch (e) {
            cfg.modelChoices.clearChoices();
            cfg.modelChoices.setChoices([], "value", "label", true);
          }
        }
      );

      // --- 모델 변경 시: 날짜/차수 리셋 → 해당 모델의 값만 세팅 ---
      cfg.modelChoices.passedElement.element.addEventListener(
        "change",
        async () => {
          const selectedModel = cfg.modelChoices.getValue(true); // string
          resetExpDateChoices(); // 먼저 초기화/비활성
          if (!selectedModel) return;

          try {
            const data = await fetchDoeOptions();
            const byModel = data.options[selectedModel] || [];
            setExpDateChoicesForModel(byModel);
          } catch (e) {
            console.error("update exp choices failed:", e);
            resetExpDateChoices("불러오기에 실패했습니다");
          }
        }
      );
    } else if (cfg.modelChoice && !cfg.expDateSequenceSelect) {
      if (cfg.modelChoice) {
        cfg.modelChoices = new Choices(cfg.modelChoice, {
          allowHTML: true,
          shouldSort: false,
          removeItemButton: true,
          addChoices: true,
          placeholder: true,
          placeholderValue: "제품 모델 선택 (추가 가능)",
        });
      }
    }

    function updateFileCount() {
      const fileCountElement = document.getElementById(`${type}FileCount`);
      if (fileCountElement) {
        fileCountElement.textContent = `총 ${filesToUpload[type].length} 개`;
      }
    }

    const clearAllBtn = document.getElementById(`${type}ClearAllBtn`);
    if (clearAllBtn && tableBody) {
      clearAllBtn.addEventListener("click", () => {
        filesToUpload[type] = [];
        tableBody.innerHTML = "";
        updateFileCount();
        htmx.trigger(document.body, "toast-message", {
          message: `${type.toUpperCase()} 파일이 모두 삭제되었습니다.`,
          tag: "info",
        });
      });
    }

    if (dropArea && fileInput) {
      function handleFiles(input) {
        const files =
          input instanceof FileList
            ? Array.from(input)
            : Array.isArray(input)
            ? input
            : [];
        const allowedTypes = ["doe"].includes(type)
          ? [
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ]
          : type === "ivl"
          ? [
              "text/csv",
              "application/vnd.ms-excel", // .xls
            ]
          : ["text/csv"]; // 기본값은 CSV만 허용

        if (filesToUpload[type].length + files.length > 50) {
          htmx.trigger(document.body, "toast-message", {
            message: `최대 50개의 파일을 업로드 할 수 있습니다. 현재 ${
              filesToUpload[type].length + files.length
            }개의 파일이 선택되어 있습니다.`,
            tag: "warning",
          });
          return;
        }

        for (let file of files) {
          if (!allowedTypes.includes(file.type)) {
            htmx.trigger(document.body, "toast-message", {
              message: `${file.name} 은(는) 허용되지 않는 파일 형식입니다.`,
              tag: "error",
            });
            continue;
          }

          filesToUpload[type].push(file);
          updateFileCount();

          const row = document.createElement("tr");
          row.innerHTML = `
                    <td>${file.name}</td>
                    <td><span class="badge bg-secondary">대기 중</span></td>
                    <td><button type="button" class="btn-close"></button></td>
                  `;
          const deleteBtn = row.querySelector("button");
          deleteBtn.addEventListener("click", () => {
            filesToUpload[type] = filesToUpload[type].filter((f) => f !== file);
            row.remove();
            updateFileCount();
          });

          tableBody.appendChild(row);
        }
      }

      // 클릭 이벤트 처리
      const handleClick = () => fileInput.click();
      dropArea.addEventListener("click", handleClick);

      // 파일 변경 이벤트 처리
      const handleFileChange = (e) => {
        e.preventDefault();
        handleFiles(e.target.files);
      };
      fileInput.addEventListener("change", handleFileChange);

      // 드래그 오버 이벤트 처리
      const handleDragOver = (e) => {
        e.preventDefault();
        dropArea.classList.add("bg-secondary", "bg-opacity-25");
      };
      dropArea.addEventListener("dragover", handleDragOver);

      // 드래그 리브 이벤트 처리
      const handleDragLeave = (e) => {
        e.preventDefault();
        dropArea.classList.remove("bg-secondary", "bg-opacity-25");
      };
      dropArea.addEventListener("dragleave", handleDragLeave);

      // 드롭 이벤트 처리
      const handleDrop = async (e) => {
        e.preventDefault();
        dropArea.classList.remove("bg-secondary", "bg-opacity-25");

        const files = isFirefox()
          ? Array.from(e.dataTransfer.files)
          : await getAllFilesFromDataTransfer(e.dataTransfer);

        handleFiles(files);
      };
      dropArea.addEventListener("drop", handleDrop);
    }

    if (uploadBtn) {
      function pollTaskStatus(taskId, row) {
        const statusCell = row.cells[1];
        statusCell.innerHTML = `<span class="badge bg-secondary"><span class="spinner-border spinner-border-sm me-1" style="width:0.7em;height:0.7em;"></span>처리 중</span>`;

        const intervalId = setInterval(() => {
          fetch(`/pao/upload_status/${taskId}/`)
            .then((res) => res.json())
            .then((data) => {
              if (data.status === "SUCCESS") {
                clearInterval(intervalId);
                statusCell.innerHTML = `<span class="badge bg-success">완료</span>`;
              } else if (data.status === "FAILURE") {
                clearInterval(intervalId);
                const msg =
                  data.info && data.info.error ? data.info.error : "실패";

                const badge = document.createElement("span");
                badge.className = "badge bg-danger";
                badge.textContent = "실패";
                badge.style.cursor = "help";
                badge.setAttribute("data-bs-toggle", "tooltip");
                badge.setAttribute("data-bs-placement", "top");
                badge.setAttribute("title", msg);

                statusCell.innerHTML = "";
                statusCell.appendChild(badge);

                if (typeof bootstrap !== "undefined") {
                  new bootstrap.Tooltip(badge);
                }
              } else if (data.status === "REVOKED") {
                clearInterval(intervalId);
                statusCell.innerHTML = `<span class="badge bg-warning">취소됨</span>`;
              }
            })
            .catch((err) => {
              console.error("Polling error", err);
            });
        }, 1500);
      }

      uploadBtn.addEventListener("click", () => {
        filesToUpload[type] = filesToUpload[type].filter(
          (file) => file !== null
        );

        if (filesToUpload[type].length === 0) {
          htmx.trigger(document.body, "toast-message", {
            message: "업로드할 파일을 선택하세요.",
            tag: "error",
          });
          return;
        }

        const formData = new FormData();
        formData.append("model_name", type.toUpperCase());

        const ivlOverwrite = document.getElementById("ivlOverwriteChk")?.checked
          ? "1"
          : "0";
        const ltOverwrite = document.getElementById("ltOverwriteChk")?.checked
          ? "1"
          : "0";
        const cvOverwrite = document.getElementById("cvOverwriteChk")?.checked
          ? "1"
          : "0";
        const ivOverwrite = document.getElementById("ivOverwriteChk")?.checked
          ? "1"
          : "0";

        formData.append("ivlOverwrite", ivlOverwrite);
        formData.append("ltOverwrite", ltOverwrite);
        formData.append("cvOverwrite", cvOverwrite);
        formData.append("ivOverwrite", ivOverwrite);
        formData.append("product_type", productInput);
        filesToUpload[type].forEach((file, idx) => {
          formData.append(`files[${idx}]`, file);
        });
        if (type === "doe" && productInput === "TV") {
          const choiceVal = cfg?.modelChoices?.getValue(true) || false;
          if (!choiceVal) {
            htmx.trigger(document.body, "toast-message", {
              message: `모델을 선택 혹은 입력해주세요.`,
              tag: "error",
            });
            return;
          }
          formData.append("modelName", choiceVal);
        } else if (["ivl", "lt", "cv", "iv", "angle"].includes(type)) {
          const choiceVal = cfg?.expDateSequenceChoices?.getValue(true) || "";
          const ymd = choiceVal ? choiceVal.split("_")[0] : "";
          if (!ymd) {
            htmx.trigger(document.body, "toast-message", {
              message: `${type} 날짜/차수를 선택하세요.`,
              tag: "error",
            });
            return;
          }
          formData.append(`${type}Date`, ymd);
        }
        const originalBtnText = uploadBtn.innerHTML;
        uploadBtn.disabled = true;
        uploadBtn.innerHTML = `
          <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>요청 중...
        `;

        fetch(uploadUrl, {
          method: "POST",
          body: formData,
          headers: {
            "X-CSRFToken": csrfToken,
          },
        })
          .then((response) => response.json())
          .then((data) => {
            if (data.status === "started" && data.tasks) {
              htmx.trigger(document.body, "toast-message", {
                message: "업로드 요청이 접수되었습니다. 처리 중...",
                tag: "info",
              });

              data.tasks.forEach((task, index) => {
                if (index < filesToUpload[type].length) {
                  const row = tableBody.rows[index];
                  pollTaskStatus(task.task_id, row);
                }
              });
            } else {
              throw new Error(data.message || "Unknown error");
            }
          })
          .catch((error) => {
            console.error("업로드 요청 실패:", error);
            htmx.trigger(document.body, "toast-message", {
              message: `업로드 요청 실패: ${error.message}`,
              tag: "error",
            });
            for (let i = 0; i < filesToUpload[type].length; i++) {
              const statusCell = tableBody.rows[i].cells[1];
              statusCell.innerHTML = `
              <span class="badge bg-danger">요청 실패</span>
            `;
            }
          })
          .finally(() => {
            uploadBtn.disabled = false;
            uploadBtn.innerHTML = originalBtnText;
          });
      });
    }
  }

  const filesToUpload = {
    doe: [],
    ivl: [],
    lt: [],
    cv: [],
    iv: [],
    angle: [],
  };
  const config = {
    doe: {
      dropArea: document.getElementById("doeDropArea"),
      fileInput: document.getElementById("doeFileInput"),
      tableBody: document.querySelector("#doeFileTable tbody"),
      uploadBtn: document.getElementById("doeUploadBtn"),
      productInput: document.getElementById("productType").innerText,
      modelChoice: document.getElementById("tv_modelName"),
    },
    ivl: {
      dropArea: document.getElementById("ivlDropArea"),
      fileInput: document.getElementById("ivlFileInput"),
      tableBody: document.querySelector("#ivlFileTable tbody"),
      uploadBtn: document.getElementById("ivlUploadBtn"),
      productInput: document.getElementById("productType").innerText,
      modelChoice: document.getElementById("model-select-ivl"),
      expDateSequenceSelect: document.getElementById("exp-date-select-ivl"),
    },
    lt: {
      dropArea: document.getElementById("ltDropArea"),
      fileInput: document.getElementById("ltFileInput"),
      tableBody: document.querySelector("#ltFileTable tbody"),
      uploadBtn: document.getElementById("ltUploadBtn"),
      productInput: document.getElementById("productType").innerText,
      modelChoice: document.getElementById("model-select-lt"),
      expDateSequenceSelect: document.getElementById("exp-date-select-lt"),
    },
    cv: {
      dropArea: document.getElementById("cvDropArea"),
      fileInput: document.getElementById("cvFileInput"),
      tableBody: document.querySelector("#cvFileTable tbody"),
      uploadBtn: document.getElementById("cvUploadBtn"),
      productInput: document.getElementById("productType").innerText,
      modelChoice: document.getElementById("model-select-cv"),
      expDateSequenceSelect: document.getElementById("exp-date-select-cv"),
    },
    iv: {
      dropArea: document.getElementById("ivDropAreaInCV"),
      fileInput: document.getElementById("ivFileInputInCV"),
      tableBody: document.querySelector("#ivFileTableInCV tbody"),
      uploadBtn: document.getElementById("ivUploadBtnInCV"),
      productInput: document.getElementById("productType").innerText,
      modelChoice: document.getElementById("model-select-iv"),
      expDateSequenceSelect: document.getElementById("exp-date-select-iv"),
    },
    angle: {
      dropArea: document.getElementById("angleDropArea"),
      fileInput: document.getElementById("angleFileInput"),
      tableBody: document.querySelector("#angleFileTable tbody"),
      uploadBtn: document.getElementById("angleUploadBtn"),
      productInput: document.getElementById("productType").innerText,
      modelChoice: document.getElementById("model-select-angle"),
      expDateSequenceSelect: document.getElementById("exp-date-select-angle"),
    },
  };

  ["doe", "ivl", "lt", "cv", "iv", "angle"].forEach((type) => {
    setupFileHandler(type);

    let fileCountElement = document.getElementById(`${type}FileCount`);
    if (!fileCountElement) {
      fileCountElement = document.createElement("span");
      fileCountElement.id = `${type}FileCount`;
      document.body.appendChild(fileCountElement);
    }

    fileCountElement.textContent = `총 ${0}개`;
  });

  // const tvModelNameSelect = document.getElementById("tv_modelName");
  // if (tvModelNameSelect) {
  //   const tvChoice = new Choices(tvModelNameSelect, {
  //     allowHTML: true,
  //     shouldSort: false,
  //     removeItemButton: true,
  //     addChoices: true,
  //     placeholder: true,
  //     placeholderValue: "제품 모델 선택 (추가 가능)",
  //   });
  // }
});
