// Bootstrap Modal Handler - Fixed DOM Loading Issue

class BootstrapModalHandler {
  constructor() {
    this.modal = null;
    this.modalElement = null;
    this.modalTitle = null;
    this.modalBody = null;
    this.modalFooter = null;
    this.isInitialized = false;
  }

  // Initialize modal elements and Bootstrap modal

  init() {
    if (this.isInitialized) return;
    // Get modal elements
    this.modalElement = document.getElementById("mainModal");
    this.modalTitle = document.getElementById("modalTitle");
    this.modalBody = document.getElementById("modalBody");
    this.modalFooter = document.getElementById("modalFooter");

    // Check if all elements exist

    if (
      !this.modalElement ||
      !this.modalTitle ||
      !this.modalBody ||
      !this.modalFooter
    ) {
      console.error(
        "Modal elements not found. Make sure the modal HTML is present."
      );

      return false;
    }

    // Initialize Bootstrap modal
    this.modal = new window.bootstrap.Modal(this.modalElement);

    // Add event listeners
    this.initEventListeners();
    this.isInitialized = true;
    return true;
  }

  initEventListeners() {
    // Handle modal hidden event to clean up

    this.modalElement.addEventListener("hidden.bs.modal", () => {
      this.clearModal();
    });

    // Handle form submissions within modal

    this.modalElement.addEventListener("submit", (e) => {
      if (e.target.tagName === "FORM") {
        e.preventDefault();

        this.handleFormSubmit(e.target);
      }
    });
  }

  async openModal(title, contentUrl, footerButtons = []) {
    // Ensure modal is initialized

    if (!this.isInitialized && !this.init()) {
      console.error("Failed to initialize modal");
      return;
    }

    try {
      // Set title
      this.modalTitle.textContent = title;
      // Show loading state
      this.modalBody.innerHTML = `
        <div class='text-center py-4'>  
        <div class='spinner-border text-primary' role='status'>
        <span class='visually-hidden'>Loading...</span>
        </div>
        <p class='mt-2 text-muted'>Loading...</p>
        </div>
        `;

      // Load content
      const content = await this.loadContent(contentUrl);
      this.modalBody.innerHTML = content;
      console.log(this.modalBody);

      // Set footer buttons
      this.setFooterButtons(footerButtons);

      // Show modal
      this.modal.show();
    } catch (error) {
      console.error("Error opening modal:", error);

      this.showError("Failed to load content. Please try again.");
    }
  }

  async loadContent(url) {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    const message = data.success ? "" : data.message || "No content available";
    return (
      data.form_html ||
      data.content ||
      `<div class='alert alert-warning'>${message}</div>`
    );
  }

  setFooterButtons(buttons) {
    // Clear existing buttons except cancel
    this.modalFooter.innerHTML = `<button type='button' class='btn btn-secondary' data-bs-dismiss='modal'>Cancel</button>`;

    // Add custom buttons
    buttons.forEach((button) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = button.className || "btn btn-primary";
      btn.textContent = button.text;
      btn.onclick = button.onclick;
      if (button.attributes) {
        Object.entries(button.attributes).forEach(([key, value]) => {
          btn.setAttribute(key, value);
        });
      }
      this.modalFooter.appendChild(btn);
    });
  }

  async handleFormSubmit(form, url) {
    let originalText = null; // Declare originalText variable
    try {
      // Show loading state on submit button
      const submitBtn = this.modalFooter.querySelector(".btn-primary");
      originalText = submitBtn?.textContent;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span class='spinner-border spinner-border-sm me-2'></span>Saving...`;
      }

      const formData = new FormData(form);
      console.log(url);
      const response = await fetch(url, {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        // Show success message
        this.showSuccess(result.message || "Operation completed successfully!");

        // Close modal after short delay
        setTimeout(() => {
          this.modal.hide();
          // Redirect or reload
          if (result.redirect) {
            window.location.href = result.redirect;
          } else {
            window.location.reload(true);
          }
        }, 1000);
      } else {
        // Show form with errors

        if (result.form_html) {
          this.modalBody.innerHTML = result.form_html;
        } else {
          this.showError(result.message);
        }
      }
    } catch (error) {
      console.error("Error submitting form:", error);

      this.showError("An error occurred while saving. Please try again.");
    } finally {
      // Restore submit button

      const submitBtn = this.modalFooter.querySelector(".btn-primary");

      if (submitBtn && typeof originalText !== "undefined") {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    }
  }

  showSuccess(message) {
    const alert = `
      <div class='alert alert-success alert-dismissible fade show' role='alert'>
      <i class='bi bi-check-circle me-2'></i>${message}
      <button type='button' class='btn-close' data-bs-dismiss='alert'></button>
      </div>
      `;

    this.modalBody.insertAdjacentHTML("afterbegin", alert);
  }

  showError(message) {
    const alert = `
      <div class='alert alert-danger alert-dismissible fade show' role='alert'>
      <i class='bi bi-exclamation-triangle me-2'></i>${message}
      <button type='button' class='btn-close' data-bs-dismiss='alert'></button>
      </div>
      `;

    this.modalBody.insertAdjacentHTML("afterbegin", alert);
  }

  clearModal() {
    if (this.modalTitle) this.modalTitle.textContent = "Modal Title";
    if (this.modalBody) this.modalBody.innerHTML = "";
    if (this.modalFooter) {
      this.modalFooter.innerHTML = `<button type='button' class='btn btn-secondary' data-bs-dismiss='modal'>Cancel</button>`;
    }
  }

  closeModal() {
    if (this.modal) {
      this.modal.hide();
    }
  }
}

// Initialize modal handler - Create instance immediately but initialize when DOM is ready
const modalHandler = new BootstrapModalHandler();
// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  modalHandler.init();
});

// Global functions for button onclick events
async function openCreateModal(url) {
  // Ensure modal is initialized before using
  if (!modalHandler.isInitialized && !modalHandler.init()) {
    console.error("Modal not available");
    return;
  }

  const footerButtons = [
    {
      text: "Save",
      className: "btn btn-primary",
      onclick: () => {
        const form = document.querySelector("#modalBody form");
        if (form) {
          modalHandler.handleFormSubmit(form, url);
        }
      },
    },
  ];

  await modalHandler.openModal("Create New Item", url, footerButtons);
}

async function openEditModal(url) {
  // Ensure modal is initialized before using
  if (!modalHandler.isInitialized && !modalHandler.init()) {
    console.error("Modal not available");
    return;
  }

  const footerButtons = [
    {
      text: "Update",
      className: "btn btn-primary",
      onclick: () => {
        const form = document.querySelector("#modalBody form");
        if (form) {
          modalHandler.handleFormSubmit(form, url);
        }
      },
    },
  ];

  await modalHandler.openModal("Edit Item", url, footerButtons);
}

async function openDeleteModal(url) {
  // Ensure modal is initialized before using
  if (!modalHandler.isInitialized && !modalHandler.init()) {
    console.error("Modal not available");
    return;
  }
  const footerButtons = [
    {
      text: "Delete",
      className: "btn btn-danger",
      onclick: async () => {
        // if (confirm("정말로 삭제하시겠습니까? 확인 시 되돌릴 수 없습니다.")) {
        try {
          const csrfToken = document.getElementsByName("csrfmiddlewaretoken")[0]
            .value;
          const response = await fetch(url, {
            method: "POST",
            headers: {
              "X-CSRFToken": csrfToken,
              "Content-Type": "application/json",
            },
          });

          const result = await response.json();
          if (result.success) {
            modalHandler.showSuccess(
              result.message || "Item deleted successfully!"
            );
            setTimeout(() => {
              modalHandler.closeModal();
              window.location.reload(true);
            }, 1000);
          } else {
            modalHandler.showError(
              result.message || "Failed to delete item. Please try again."
            );
          }
        } catch (error) {
          console.error("Error deleting item:", error);

          modalHandler.showError("An error occurred while deleting the item.");
          //   }
        }
      },
    },
  ];

  const content = `
      <div class='text-center py-4'>
      <i class='bi bi-exclamation-triangle text-warning' style='font-size: 3rem;'></i>
      <h5 class='mt-3'>제품 스펙 삭제</h5>
      <p class='text-muted'>정말로 삭제하시겠습니까?<br>확인 시 되돌릴 수 없습니다.</p>
      </div>
    `;

  modalHandler.modalTitle.textContent = "Confirm Delete";
  modalHandler.modalBody.innerHTML = content;
  modalHandler.setFooterButtons(footerButtons);
  modalHandler.modal.show();
}

// Keyboard shortcuts
document.addEventListener("keydown", (e) => {
  // Close modal on Escape key
  if (e.key === "Escape" && modalHandler?.modal?._isShown) {
    modalHandler.closeModal();
  }

  // Open create modal on Ctrl+N
  if (e.ctrlKey && e.key === "n") {
    e.preventDefault();
    openCreateModal();
  }
});

// Product Spec parameter 불러오기 함수
async function onLabelChange(url, table) {
  try {
    // Show loading state
    const fittingForm = document.querySelectorAll("[id^='id_']");

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Network response was not OK");
    }

    const data = await response.json();

    if (data.error) {
      alert(data.error);
      return;
    }

    // Populate fields
    fittingForm.forEach((field) => {
      const fieldName = field.id.replace("id_", "");

      if (data && data.hasOwnProperty(fieldName)) {
        field.value = data[fieldName];

        switch (fieldName) {
          case "w_lum":
            table.updateColumnDefinition("목표전압1", {
              title: `목표전압1<br>@${data[fieldName]} nit`,
            });
            break;
          case "w_lum_v":
            table.updateColumnDefinition("목표전압2", {
              title: `목표전압2<br>@${data[fieldName]} nit`,
            });
            break;
        }
      }
    });
  } catch (error) {
    console.error("Error:", error);
  } finally {
    // fittingForm.forEach((field) => (field.disabled = false));
  }
}
