class AnalysisProfileManager {
  constructor() {
    this.currentPage = 1;
    this.itemsPerPage = 12;
    this.currentFilter = "all";
    this.currentSort = "created_at";
    this.searchQuery = "";
    this.favorite = "";
    this.hidden = "";
    this.createdUserFilter = "";
    this.shareUsers = [];
    this.filterUsers = [];
    this.profiles = [];
    this.dataCount = 0;
    this.nextUrl = null;
    this.previousUrl = null;
    this.currentProfileId = null;
    this.currentShares = [];
    this.viewMode = "list";

    this.init();
  }

  async init() {
    this.bindEvents();
    this.loadProfiles();
    await this.fetchUsers();
    this.initUserFilter();
    this.initShareUserSelect();
  }

  bindEvents() {
    // Search functionality
    this.debounceTimer = null;
    document.getElementById("searchInput").addEventListener("input", (e) => {
      this.searchQuery = e.target.value;

      // Clear existing timer if it exists
      clearTimeout(this.debounceTimer);

      // Set a new debounce timer (500ms)
      this.debounceTimer = setTimeout(() => {
        this.loadProfiles(); // Execute after 500ms of inactivity
      }, 500);
    });

    // User Filter
    document.getElementById("userFilterSelect").addEventListener("change", (e) => {
      this.createdUserFilter = e.target.value;
      this.loadProfiles();
    });

    // Sort functionality
    document.getElementById("sortSelect").addEventListener("change", (e) => {
      this.currentSort = e.target.value;
      this.loadProfiles();
    });
    document.getElementById("favoritesOnly").addEventListener("change", (e) => {
      this.favorite = e.target.checked ? true : "";
      this.loadProfiles();
    });
    document.getElementById("hiddenOnly").addEventListener("change", (e) => {
      this.hidden = e.target.checked ? true : "";
      this.loadProfiles();
    });
    document.getElementById("itemsPerPage").addEventListener("change", (e) => {
      this.itemsPerPage = parseInt(e.target.value);
      this.loadProfiles();
    });

    // Profile form submission
    document.getElementById("saveProfileBtn").addEventListener("click", () => {
      this.saveProfile();
    });

    // Share functionality
    document.getElementById("addShareUserBtn").addEventListener("click", () => {
      this.addShareUser();
    });

    document.getElementById("saveSharesBtn").addEventListener("click", () => {
      this.saveShares();
    });

    // Delete confirmation
    document
      .getElementById("confirmDeleteBtn")
      .addEventListener("click", () => {
        this.deleteProfile();
      });
  }

  async loadProfiles() {
    try {
      const url = new URL(profileURL, window.location.origin);
      const params = {
        keyword: this.searchQuery,
        order_key: this.currentSort,
        page: this.currentPage,
        page_size: this.itemsPerPage,
        favorite: this.favorite,
        hidden: this.hidden,
        created_user: this.createdUserFilter,
      };
      Object.keys(params).forEach((key) =>
        url.searchParams.append(key, params[key]),
      );
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });

      if (response.ok) {
        const data = await response.json();
        this.dataCount = data.count;
        this.nextUrl = data.next;
        this.previousUrl = data.previous;
        this.profiles = data.results;
        this.updateResultsInfo();
        this.displayProfiles(
          this.profiles,
          this.dataCount,
          this.nextUrl,
          this.previousUrl,
        );
      } else {
        htmx.trigger(document.body, "toast-message", {
          message: "프로필을 불러오는데 실패했습니다.",
          tag: "danger",
        });
      }
    } catch (error) {
      console.error("Error loading profiles:", error);
      htmx.trigger(document.body, "toast-message", {
        message: "네트워크 오류가 발생했습니다.",
        tag: "danger",
      });
    }
  }

  // 결과 정보 업데이트
  updateResultsInfo() {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage + 1;
    const endIndex = Math.min(
      this.currentPage * this.itemsPerPage,
      this.dataCount,
    );

    document.getElementById(
      "resultsInfo",
    ).innerHTML = `총 ${this.dataCount}개 중 ${startIndex}-${endIndex}개 표시`;
  }

  // 이름에서 이니셜 추출
  getInitials(name) {
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }

  createProfileCard(profile) {
    const tags = profile.tags
      ? profile.tags
          .map((tag) => `<span class='badge bg-secondary me-1'>#${tag}</span>`)
          .join("")
      : "";

    const createdDate = new Date(profile.created_at).toLocaleDateString(
      "ko-KR",
    );
    const updatedDate = new Date(profile.updated_at).toLocaleDateString(
      "ko-KR",
    );

    return `
        <div class="col-lg-4 col-md-6 mb-4">
            <div class="card h-100 border-0 shadow-sm hover-shadow ${
              profile.hidden ? "opacity-75" : ""
            } ${this.itemsPerPage > 12 ? "compact-card" : ""}">
                <div class="card-header bg-white border-0 pb-0 text-break">
                    <div class="d-flex justify-content-between align-items-start">
                        <div class="flex-grow-1">
                            <div class="d-flex align-items-center mb-2">
                                <h5 class="card-title fw-bold text-primary mb-0 me-2">
                                    ${profile.title}
                                </h5>
                                <span class="badge badge-pill bg-warning text-muted m-2">${
                                  profile.product_type
                                }</span>
                                <i class="bi bi-star${
                                  profile.favorite ? "-fill" : ""
                                } favorite-star ${
      profile.favorite ? "active" : ""
    } me-2" onclick="profileManager.toggleFavorite(${profile.id})"></i>
                                <i class="bi bi-eye${
                                  profile.hidden ? "-slash" : ""
                                } hidden-eye ${
      profile.hidden ? "text-secondary" : "text-muted"
    }" onclick="profileManager.toggleHidden(${profile.id})" title="${
      profile.hidden ? "숨김 해제" : "숨기기"
    }"></i>
                                            
                            </div>
                            <div class="mb-2">
                                <span>${tags}</span>
                                ${
                                  profile.title.includes("(복사본)")
                                    ? '<span class="badge bg-info ms-1 fs-6">복사본</span>'
                                    : ""
                                }
                            </div>
                            <div class="d-flex align-items-center mb-2">
                                <div class="author-avatar me-2">${this.getInitials(
                                  profile.created_user,
                                )}</div>
                                <div>
                                    <small class="text-muted d-block">작성자: ${
                                      profile.created_user
                                    }</small>
                                    <small class="text-muted">
                                        <i class="bi bi-calendar3 me-1"></i>
                                        생성일: ${createdDate}
                                    </small>
                                </div>
                            </div>
                        </div>
                        <div class="dropdown">
                            <button class="btn btn-sm btn-outline-secondary" type="button" data-bs-toggle="dropdown">
                                <i class="bi bi-three-dots-vertical"></i>
                            </button>
                            <ul class="dropdown-menu">
                                ${
                                  profile.can_edit
                                    ? `
                                <li><button class="dropdown-item" onclick="profileManager.editProfile(${profile.id})">
                                    <i class="bi bi-pencil me-2"></i>편집
                                </button></li>
                                <li><button class="dropdown-item" onclick='profileManager.shareProfile(${profile.id})'>
                                    <i class="bi bi-share me-2"></i>공유
                                </button></li>
                                `
                                    : ""
                                }
                                <li><button class="dropdown-item" onclick='profileManager.copyProfile(${
                                  profile.id
                                })'>
                                    <i class="bi bi-files me-2"></i>복사
                                </button></li>
                                ${
                                  profile.can_edit
                                    ? `
                                <li><hr class="dropdown-divider"></li>
                                <li><button class="dropdown-item text-danger" onclick='profileManager.confirmDelete(${profile.id})' title='삭제'>
                                    <i class="bi bi-trash me-2"></i>삭제
                                </button></li>
                                `
                                    : ""
                                }
                            </ul>
                        </div>
                    </div>
                </div>
                <div class="card-body">
                    <p class="card-text text-muted mb-3">${profile.summary}</p>
                    <div class="row text-center mb-3">
                        <div class="col-6">
                            <div class="border-end">
                                <h6 class="fw-bold text-primary mb-0">${
                                  profile.doe_list.length
                                }</h6>
                                <small class="text-muted">데이터 수</small>
                            </div>
                        </div>
                        <div class="col-6">
                            <h6 class="fw-bold text-success mb-0">${updatedDate}</h6>
                            <small class="text-muted">최근 수정</small>
                        </div>
                    </div>
                    ${
                      profile.shared_users_list.length > 0
                        ? `
                        <div class="mb-3">
                            <small class="text-muted d-block mb-1">공유된 사용자 (${
                              profile.shared_users_list.length
                            }명)</small>
                            <div class="shared-users">
                                ${profile.shared_users_list
                                  .slice(0, 5)
                                  .map(
                                    (user) => `
                                    <div class="shared-user-avatar" title="${user}">${this.getInitials(
                                      user.split("@")[0],
                                    )}</div>
                                `,
                                  )
                                  .join("")}
                                ${
                                  profile.shared_users_list.length > 5
                                    ? `<div class="shared-user-avatar">+${
                                        profile.shared_users_list.length - 5
                                      }</div>`
                                    : ""
                                }
                            </div>
                        </div>
                    `
                        : ""
                    }
                </div>
                <div class="card-footer bg-white border-0">
                    <div class="d-flex gap-2">
                        <button class="btn btn-primary flex-grow-1" onclick='profileManager.startAnalysis(${
                          profile.id
                        })' title='분석 시작'>
                          <i class="bi bi-arrow-right-circle me-2"></i>
                          분석 시작하기
                        </button>
                        ${
                          profile.can_edit
                            ? `
                        <button class="btn btn-outline-secondary" onclick='profileManager.editProfile(${profile.id})' title='편집'>
                            <i class='bi bi-pencil'></i>
                        </button>
                        <button class="btn btn-outline-info" onclick='profileManager.shareProfile(${profile.id})' title='공유'>
                            <i class='bi bi-share'></i>
                        </button>
                        `
                            : ""
                        }
                    </div>
                </div>
            </div>
        </div>
    `;
  }

  createProfileList(profile) {
    const tags = profile.tags
      ? profile.tags
          .map((tag) => `<span class='badge bg-secondary me-1'>#${tag}</span>`)
          .join("")
      : "";

    const createdDate = new Date(profile.created_at).toLocaleDateString(
      "ko-KR",
    );
    const updatedDate = new Date(profile.updated_at).toLocaleDateString(
      "ko-KR",
    );

    return `
      <div class="list-view-item compact">
        <div class="row align-items-center">
          <div class="col-md-4">
            <div class="d-flex align-items-center text-break">
              <div class="author-avatar me-3 col-2">${this.getInitials(
                profile.created_user,
              )}</div>
              <div>
                <h5 class="fw-bold text-primary mb-0 me-2">${profile.title}</h5>
                <small class="text-muted">작성자: ${
                  profile.created_user
                } | 생성일: ${createdDate}</small>
              </div>
            </div>
          </div>
          <div class="col-md-4">
            <div class="d-flex align-items-center gap-2">
            <i class="bi bi-star${
              profile.favorite ? "-fill" : ""
            } favorite-star ${
      profile.favorite ? "active" : ""
    }" onclick="profileManager.toggleFavorite(${profile.id})"></i>
            <i class="bi bi-eye${
              profile.hidden ? "-slash" : ""
            } hidden-eye ${
      profile.hidden ? "text-secondary" : "text-muted"
    }" onclick="profileManager.toggleHidden(${profile.id})" title="${
      profile.hidden ? "숨김 해제" : "숨기기"
    }"></i>
              <span class="badge badge-pill bg-warning text-muted">${
                profile.product_type
              }</span>
              ${
                profile.title.includes("(복사본)")
                  ? '<span class="badge bg-info">복사본</span>'
                  : ""
              }
              <span>${tags}</span>
            </div>
            <p class="text-muted mb-1 text-break">${profile.summary}</p>
          </div>
          <div class="col-md-1 text-center">
            <h6 class="fw-bold text-primary mb-0">${
              profile.doe_list.length
            }</h6>
            <small class="text-muted">데이터 수</small>
          </div>
          <div class="col-md-1 text-center">
            <h6 class="fw-bold text-success mb-0">${
              profile.shared_users_list.length
            }</h6>
            <small class="text-muted">공유 수</small>
          </div>

          <div class="col-md-2 d-flex justify-content-end mt-2">
            <button class="btn btn-primary me-2" onclick='profileManager.startAnalysis(${
              profile.id
            })' title='분석 시작'>
              <i class="bi bi-arrow-right-circle me-1"></i>분석 시작
            </button>
            <div class="dropdown">
              <button class="btn btn-outline-secondary" type="button" data-bs-toggle="dropdown">
                <i class="bi bi-three-dots-vertical"></i>
              </button>
              <ul class="dropdown-menu">
                ${
                  profile.can_edit
                    ? `
                <li><button class="dropdown-item" onclick="profileManager.editProfile(${profile.id})">
                    <i class="bi bi-pencil me-2"></i>편집
                </button></li>
                <li><button class="dropdown-item" onclick='profileManager.shareProfile(${profile.id})'>
                    <i class="bi bi-share me-2"></i>공유
                </button></li>
                `
                    : ""
                }
                <li><button class="dropdown-item" onclick='profileManager.copyProfile(${
                  profile.id
                })'>
                    <i class="bi bi-files me-2"></i>복사
                </button></li>
                ${
                  profile.can_edit
                    ? `
                <li><hr class="dropdown-divider"></li>
                <li><button class="dropdown-item text-danger" onclick='profileManager.confirmDelete(${profile.id})' title='삭제'>
                    <i class="bi bi-trash me-2"></i>삭제
                </button></li>
                `
                    : ""
                }
            </ul>
            </div>
          </div>
        </div>
      </div>

    `;
  }

  updatePagination(totalItems, next, previous) {
    const pagination = document.getElementById("pagination");
    const totalPages = Math.ceil(totalItems / this.itemsPerPage);

    if (totalPages <= 1) {
      pagination.innerHTML = "";
      return;
    }

    let paginationHTML = "";

    // Previous button
    paginationHTML += `
        <li class='page-item ${previous ? "" : "disabled"}'>
          <a class='page-link' href='#' ${
            previous ? "" : "disabled"
          } onclick='profileManager.changePage(${
      this.currentPage - 1
    })'>이전</a>
        </li>
      `;

    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
      const isActive = i === this.currentPage;
      const isDotsNeeded = i > this.currentPage + 2 || i < this.currentPage - 2;

      if (i === 1 || i === totalPages || !isDotsNeeded) {
        paginationHTML += `
            <li class='page-item ${isActive ? "active" : ""}'>
              <a class='page-link' href='#' onclick='profileManager.changePage(${i})'>${i}</a>
            </li>
          `;
      } else if (isDotsNeeded) {
        paginationHTML += `
            <li class='page-item disabled'>
              <a class='page-link'>...</a>
            </li>
          `;
      }
    }

    // Next button
    paginationHTML += `
        <li class='page-item ${next ? "" : "disabled"}'>
          <a class='page-link' href='#' ${
            next ? "" : "disabled"
          } onclick='profileManager.changePage(${
      this.currentPage + 1
    })'>다음</a>
        </li>
      `;

    pagination.innerHTML = paginationHTML;
  }

  changePage(page) {
    this.currentPage = parseInt(page);
    this.loadProfiles(); // Recheck the profiles with the new page
  }

  displayProfiles(profiles, totalItems, next, previous) {
    const container = document.getElementById("profilesContainer");

    if (profiles.length === 0) {
      container.innerHTML = `
          <div class='col-12 text-center py-5'>
            <i class='bi bi-folder-x display-1 text-muted'></i>
            <h4 class='text-muted mt-3'>프로필이 없습니다</h4>
            <p class='text-muted'>새로운 분석 프로필을 생성해보세요.</p>
          </div>
        `;
      return;
    }
    if (this.viewMode === "card") {
      container.innerHTML = profiles
        .map((profile) => this.createProfileCard(profile))
        .join("");
    } else {
      container.innerHTML = profiles
        .map((profile) => this.createProfileList(profile))
        .join("");
    }

    this.updatePagination(totalItems, next, previous);
  }

  async toggleFavorite(profileId) {
    try {
      const profile = this.profiles.find((p) => p.id === profileId);
      const url = `${profileDetailURL.replace("0", profileId)}toggle_favorite/`;
      
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCookie("csrftoken"),
        },
      });

      if (response.ok) {
        const data = await response.json();
        profile.favorite = data.favorite;
        this.displayProfiles(
          this.profiles,
          this.dataCount,
          this.nextUrl,
          this.previousUrl,
        );
        htmx.trigger(document.body, "toast-message", {
          message: "즐겨찾기가 업데이트되었습니다.",
          tag: "success",
        });
      } else {
        htmx.trigger(document.body, "toast-message", {
          message: "즐겨찾기 업데이트에 실패했습니다.",
          tag: "danger",
        });
      }
    } catch (error) {
      console.error("Error toggling favorite:", error);
      htmx.trigger(document.body, "toast-message", {
        message: "네트워크 오류가 발생했습니다.",
        tag: "danger",
      });
    }
  }

  async toggleHidden(profileId) {
    try {
      const profile = this.profiles.find((p) => p.id === profileId);
      const url = `${profileDetailURL.replace("0", profileId)}toggle_hidden/`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCookie("csrftoken"),
        },
      });

      if (response.ok) {
        const data = await response.json();
        profile.hidden = data.hidden;
        
        // 만약 현재 숨김 목록만 보는 게 아니라면, 숨긴 항목은 목록에서 제거하거나 로드 다시 함
        if (!this.hidden && data.hidden) {
            this.loadProfiles();
        } else {
            this.displayProfiles(
                this.profiles,
                this.dataCount,
                this.nextUrl,
                this.previousUrl,
            );
        }
        
        htmx.trigger(document.body, "toast-message", {
          message: profile.hidden ? "프로필이 숨김 처리되었습니다." : "프로필 숨김이 해제되었습니다.",
          tag: "success",
        });
      } else {
        htmx.trigger(document.body, "toast-message", {
          message: "숨김 상태 업데이트에 실패했습니다.",
          tag: "danger",
        });
      }
    } catch (error) {
      console.error("Error toggling hidden:", error);
      htmx.trigger(document.body, "toast-message", {
        message: "네트워크 오류가 발생했습니다.",
        tag: "danger",
      });
    }
  }

  editProfile(profileId) {
    const profile = this.profiles.find((p) => p.id === profileId);
    if (!profile) return;

    const tagsLine = profile.tags
      ? profile.tags.map((tag) => `#${tag}`).join(" ")
      : "";

    const combinedContent = `${tagsLine}\n\n${profile.summary || ""}`;

    document.getElementById("modalTitle").textContent = "분석 프로필 편집";
    document.getElementById("profileId").value = profile.id;
    document.getElementById("profileTitle").value = profile.title;
    document.getElementById("profileSummary").value = combinedContent.trim();
    document.getElementById("profileProducttype").value =
      profile.product_type || "";
    //document.getElementById("productSpec").value = profile.product_spec || "";
    document.getElementById("profileFavorite").checked = profile.favorite;
    document.getElementById("profileHidden").checked = profile.hidden;

    new window.bootstrap.Modal(
      document.getElementById("createProfileModal"),
    ).show();
  }

  async saveProfile() {
    const profileId = document.getElementById("profileId").value;
    const isEdit = !!profileId;

    const profileData = {
      title: document.getElementById("profileTitle").value,
      summary: document.getElementById("profileSummary").value,
      product_type: document.getElementById("profileProducttype").value,
      //product_spec: document.getElementById("productSpec").value,
      favorite: document.getElementById("profileFavorite").checked,
      hidden: document.getElementById("profileHidden").checked,
    };

    try {
      const url = isEdit
        ? profileDetailURL.replace("0", profileId)
        : profileURL;
      const method = isEdit ? "PATCH" : "POST";

      const response = await fetch(url, {
        method: method,
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCookie("csrftoken"),
        },
        body: JSON.stringify(profileData),
      });

      if (response.ok) {
        window.bootstrap.Modal.getInstance(
          document.getElementById("createProfileModal"),
        ).hide();
        this.loadProfiles();
        htmx.trigger(document.body, "toast-message", {
          message: `프로필이 ${isEdit ? "수정" : "생성"}되었습니다.`,
          tag: "success",
        });
        this.resetForm();
      } else {
        htmx.trigger(document.body, "toast-message", {
          message: `프로필 ${isEdit ? "수정" : "생성"}에 실패했습니다.`,
          tag: "danger",
        });
      }
    } catch (error) {
      console.error("Error saving profile:", error);
      htmx.trigger(document.body, "toast-message", {
        message: "네트워크 오류가 발생했습니다.",
        tag: "danger",
      });
    }
  }

  async copyProfile(profileId) {
    const profile = this.profiles.find((p) => p.id === profileId);
    if (!profile) return;

    const copiedProfile = {
      title: `${profile.title} (복사본)`,
      summary: profile.summary,
      product_type: profile.product_type,
      product_spec: profile.product_spec,
      favorite: false,
      original_profile_id: profile.id,
    };

    try {
      const response = await fetch(profileURL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCookie("csrftoken"),
        },
        body: JSON.stringify(copiedProfile),
      });

      if (response.ok) {
        this.loadProfiles();
        htmx.trigger(document.body, "toast-message", {
          message: "프로필이 복사되었습니다.",
          tag: "success",
        });
      } else {
        htmx.trigger(document.body, "toast-message", {
          message: "프로필 복사에 실패했습니다.",
          tag: "danger",
        });
      }
    } catch (error) {
      console.error("Error copying profile:", error);
      htmx.trigger(document.body, "toast-message", {
        message: "네트워크 오류가 발생했습니다.",
        tag: "danger",
      });
    }
  }

  async fetchUsers() {
    try {
      // Fetch Following Users (for Share Modal)
      const responseFollowing = await fetch(userListURL);
      if (responseFollowing.ok) {
        this.shareUsers = await responseFollowing.json();
      } else {
        console.error("Failed to fetch following users");
      }

      // Fetch Follower Users (for Filter Dropdown)
      const responseFollower = await fetch(followerListURL);
      if (responseFollower.ok) {
        this.filterUsers = await responseFollower.json();
      } else {
        console.error("Failed to fetch follower users");
      }
    } catch (e) {
      console.error("Error fetching users:", e);
    }
  }

  initUserFilter() {
    const filterSelect = document.getElementById("userFilterSelect");
    if (!filterSelect) return;

    // Clear existing options except the first one (All Users)
    while (filterSelect.options.length > 1) {
      filterSelect.remove(1);
    }

    this.filterUsers.forEach((user) => {
      const option = document.createElement("option");
      option.value = user.id;
      const team = user.profile?.team || "";
      const teamSuffix = team.trim() ? ` [${team}]` : "";
      option.textContent = `${user.full_name} (${user.username})${teamSuffix}`;
      filterSelect.appendChild(option);
    });
  }

  initShareUserSelect() {
    const element = document.getElementById("shareUserSelect");
    if (!element) return;

    const choices = this.shareUsers.map((item) => {
      const team = item.profile?.team || "";
      const teamSuffix = team.trim() ? ` ${team}` : "";
      return {
        label: `${item.full_name}: ${item.username}(${item.email})${teamSuffix}`,
        value: item.id.toString(),
      };
    });

    new Choices(element, {
      allowHTML: true,
      shouldSort: false,
      removeItemButton: true,
      choices: choices,
    });
  }

  shareProfile(profileId) {
    this.currentProfileId = profileId;
    this.loadCurrentShares(profileId);
    new window.bootstrap.Modal(
      document.getElementById("shareProfileModal"),
    ).show();
  }

  async loadCurrentShares(profileId) {
    // This would typically load current shares from the API
    // For now, using mock data
    try {
      const response = await fetch(profileShare.replace("0", profileId), {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (response.ok) {
        const data = await response.json();
        this.currentShares = data.current;
        this.displayCurrentShares();
      } else {
        htmx.trigger(document.body, "toast-message", {
          message: "공유 유저 로딩에 실패하였습니다.",
          tag: "danger",
        });
      }
    } catch (error) {
      console.error("Error saving shares:", error);
      htmx.trigger(document.body, "toast-message", {
        message: "네트워크 오류가 발생했습니다.",
        tag: "danger",
      });
    }
  }

  addShareUser() {
    const userId = document.getElementById("shareUserSelect").value;
    const permission = document.querySelector(
      `input[name='permissionLevel']:checked`,
    ).value;

    if (!userId) {
      htmx.trigger(document.body, "toast-message", {
        message: "사용자를 선택해주세요.",
        tag: "warning",
      });
      return;
    }

    const user = this.shareUsers.find((u) => u.id == userId);
    const existingShare = this.currentShares.find(
      (s) => s.user === Number.parseInt(userId),
    );

    if (existingShare) {
      existingShare.permission_level = permission;
    } else {
      this.currentShares.push({
        user: Number.parseInt(userId),
        username: user.username,
        permission_level: permission,
        shared_at: new Date(),
      });
    }

    this.displayCurrentShares();
    document.getElementById("shareUserSelect").value = "";
  }

  displayCurrentShares() {
    const container = document.getElementById("currentShares");

    if (this.currentShares.length === 0) {
      container.innerHTML = `<p class='text-muted'>공유된 사용자가 없습니다.</p>`;
      return;
    }

    container.innerHTML = this.currentShares
      .map(
        (share, index) =>
          `<div class='d-flex justify-content-between align-items-center mb-2 p-2 bg-light rounded'>
                <div>
                    <strong>${share.username}</strong>
                    <span class='badge bg-${
                      share.permission_level === "edit"
                        ? "primary"
                        : "secondary"
                    } ms-2'>
                        ${share.permission_level === "edit" ? "편집" : "보기"}
                    </span>
                    <small class='text-muted ms-2'>
                      공유 일자: ${new Date(share.shared_at).toLocaleDateString(
                        "ko-KR",
                      )}
                    </small>
                </div>
                <button class='btn btn-sm btn-outline-danger' onclick='profileManager.removeShare(${index})'>
                    <i class='bi bi-x'></i>
                </button>
            </div>
        `,
      )
      .join("");
  }

  removeShare(index) {
    this.currentShares.splice(index, 1);
    this.displayCurrentShares();
  }

  async saveShares() {
    try {
      const response = await fetch(
        profileShare.replace("0", this.currentProfileId),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": getCookie("csrftoken"),
          },
          body: JSON.stringify(this.currentShares),
        },
      );

      if (response.ok) {
        window.bootstrap.Modal.getInstance(
          document.getElementById("shareProfileModal"),
        ).hide();
        this.loadProfiles();
        htmx.trigger(document.body, "toast-message", {
          message: "공유 설정이 저장되었습니다.",
          tag: "success",
        });
      } else {
        htmx.trigger(document.body, "toast-message", {
          message: "공유 설정 저장에 실패했습니다.",
          tag: "danger",
        });
      }
    } catch (error) {
      console.error("Error saving shares:", error);
      htmx.trigger(document.body, "toast-message", {
        message: "네트워크 오류가 발생했습니다.",
        tag: "danger",
      });
    }
  }

  confirmDelete(profileId) {
    this.currentProfileId = profileId;
    new window.bootstrap.Modal(
      document.getElementById("confirmDeleteModal"),
    ).show();
  }

  async deleteProfile() {
    try {
      const response = await fetch(
        profileDetailURL.replace("0", this.currentProfileId),
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "X-CSRFToken": getCookie("csrftoken"),
          },
        },
      );

      if (response.ok) {
        window.bootstrap.Modal.getInstance(
          document.getElementById("confirmDeleteModal"),
        ).hide();
        this.loadProfiles();
        htmx.trigger(document.body, "toast-message", {
          message: "프로필이 삭제되었습니다.",
          tag: "success",
        });
      } else {
        htmx.trigger(document.body, "toast-message", {
          message: "프로필 삭제에 실패했습니다.",
          tag: "danger",
        });
      }
    } catch (error) {
      console.error("Error deleting profile:", error);
      htmx.trigger(document.body, "toast-message", {
        message: "네트워크 오류가 발생했습니다.",
        tag: "danger",
      });
    }
  }
  startAnalysis(profileId) {
    // 1. 해당 프로필 찾기
    const targetProfile = this.profiles.find((p) => p.id === profileId);
    if (!targetProfile) {
      console.error(`프로필 ID ${profileId}가 존재하지 않습니다.`);
      return;
    }
    console.log("타겟 프로필 product_type:", targetProfile.product_type);

    const getDoeIds = (doeList = []) => [
      ...new Set(
        doeList.flatMap((item) =>
          typeof item === "number"
            ? [item]
            : item?.id !== undefined
            ? [item.id]
            : [],
        ),
      ),
    ];

    // 2. doe_id 리스트 추출 (중복 제거 및 빈 값 필터링)
    const doeIds = getDoeIds(targetProfile.doe_list);
    //console.log("추출된 DOE ID 목록:", doeIds);

    // 3. 새 URL 객체 생성
    const selectedURL =
      targetProfile.product_type === "TV" ? compareTVURL : comparePOURL;

    const baseUrl = new URL(
      selectedURL.replace("0", profileId),
      window.location.origin,
    );
    // 기존 파라미터 삭제
    baseUrl.searchParams.delete("ids");

    // 새 파라미터 추가 (doeIds가 비어 있지 않은 경우만)
    if (doeIds.length > 0) {
      baseUrl.searchParams.append("ids", doeIds.join(","));
    }

    //console.log("baseUrl", baseUrl);
    // 5. 리디렉트
    window.location.href = baseUrl.toString();
  }

  resetForm() {
    document.getElementById("profileForm").reset();
    document.getElementById("profileId").value = "";
    document.getElementById("modalTitle").textContent = "새 분석 프로필 생성";
  }

  // View Mode setting
  setViewMode(mode) {
    this.viewMode = mode;
    document
      .getElementById("cardViewBtn")
      .classList.toggle("active", mode === "card");
    document
      .getElementById("listViewBtn")
      .classList.toggle("active", mode === "list");

    this.loadProfiles();
  }

  showAlert(message, type) {
    // Create and show Bootstrap alert
    const alertDiv = document.createElement("div");
    alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
    alertDiv.style.cssText =
      "top: 20px; right: 20px; z-index: 9999; min-width: 300px;";
    alertDiv.innerHTML = `
           ${message}
           <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
       `;

    document.body.appendChild(alertDiv);

    // Auto remove after 5 seconds
    setTimeout(() => {
      if (alertDiv.parentNode) {
        alertDiv.remove();
      }
    }, 5000);
  }
}

// Initialize the profile manager when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  window.profileManager = new AnalysisProfileManager();
  window.bootstrap = window.bootstrap || {}; // Declare bootstrap variable
});
