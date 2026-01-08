// Utils.js - 공통 유틸리티 함수

export class Utils {
    /**
     * Toast 메시지 표시
     */
    static showToast(message, type = "info") {
        const toastHtml = `
            <div class="toast align-items-center text-white bg-${type === "success" ? "success" : type === "error" ? "danger" : type === "warning" ? "warning" : "primary"} border-0" role="alert">
                <div class="d-flex">
                    <div class="toast-body">${message}</div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
                </div>
            </div>
        `;

        let container = document.getElementById("toast-container");
        if (!container) {
            container = document.createElement("div");
            container.id = "toast-container";
            container.className = "toast-container position-fixed top-0 end-0 p-3";
            container.style.zIndex = "9999";
            document.body.appendChild(container);
        }

        const toastElement = document.createElement("div");
        toastElement.innerHTML = toastHtml;
        container.appendChild(toastElement.firstElementChild);

        const toast = new bootstrap.Toast(toastElement.firstElementChild, { delay: 3000 });
        toast.show();

        toastElement.firstElementChild.addEventListener("hidden.bs.toast", () => {
            toastElement.remove();
        });
    }

    /**
     * 에디터 창 열기
     */
    static openEditor(url, type, refreshCallback) {
        const editorWindow = window.open(url, "_blank", "width=800,height=600");
        const timer = setInterval(() => {
            if (editorWindow.closed) {
                clearInterval(timer);
                if (refreshCallback) {
                    refreshCallback();
                }
            }
        }, 500);
    }

    /**
     * field를 ID로 변환
     * @param {string} field - "DOE-5" 형식
     * @returns {number|null} - 5 또는 null
     */
    static fieldToId(field) {
        const id = parseInt(field.replace(/\D/g, ''));
        return isNaN(id) ? null : id;
    }

    /**
     * ID를 field로 변환
     * @param {number} id - 5
     * @returns {string} - "DOE-5"
     */
    static idToField(id) {
        return `DOE-${id}`;
    }

    /**
     * CSRF 토큰 가져오기
     */
    static getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }
}
