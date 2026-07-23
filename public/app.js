/* ==================== API 客户端 ==================== */
const API = {
  async request(path, options = {}) {
    const res = await fetch(path, {
      headers: { "Content-Type": "application/json", ...options.headers },
      ...options,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "请求失败" }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  },
  get(path) { return this.request(path); },
  post(path, body) { return this.request(path, { method: "POST", body: JSON.stringify(body) }); },
  put(path, body) { return this.request(path, { method: "PUT", body: JSON.stringify(body) }); },
  delete(path) { return this.request(path, { method: "DELETE" }); },
};

/* ==================== 工具函数 ==================== */
const ICON_COLORS = [
  "#FF7F8C", "#007aff", "#af52de", "#34c759", "#ff9500",
  "#5ac8fa", "#ff2d55", "#5856d6", "#ff9f0a", "#30d158",
];

/** 根据 ID 生成稳定的颜色 */
function getColor(id) {
  let hash = 0;
  const str = String(id);
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return ICON_COLORS[Math.abs(hash) % ICON_COLORS.length];
}

/** 格式化日期 */
function formatDate(dateStr) {
  if (!dateStr) return "无期限";
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 计算剩余天数 */
function daysUntil(dateStr) {
  if (!dateStr) return Infinity;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/** 获取显示用的剩余天数 */
function getDisplayDays(sub) {
  // 如果距离可续费日期小于剩余到期天数，则显示可续费日期的天数
  const expiryDays = sub.expiry_date ? daysUntil(sub.expiry_date) : Infinity;
  const renewableDays = sub.renewable_date ? daysUntil(sub.renewable_date) : Infinity;

  if (renewableDays < expiryDays) {
    return { days: renewableDays, type: "renewable" };
  }
  return { days: expiryDays, type: "expiry" };
}

/** 天数对应的 CSS 类名 */
function getDaysClass(days) {
  if (days < 0) return "urgent";
  if (days <= 7) return "urgent";
  if (days <= 30) return "warning";
  return "normal";
}

/** HTML 转义 */
function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* ==================== Toast 通知 ==================== */
function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer") || createToastContainer();
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(20px)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

function createToastContainer() {
  const container = document.createElement("div");
  container.id = "toastContainer";
  container.className = "toast-container";
  document.body.appendChild(container);
  return container;
}

/* ==================== 模态框 ==================== */
function showModal(title, text, onConfirm, confirmText = "确认", danger = false) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-title">${escapeHTML(title)}</div>
      <div class="modal-text">${escapeHTML(text)}</div>
      <div class="modal-actions">
        <button class="btn btn-cancel" id="modalCancel">取消</button>
        <button class="btn ${danger ? "btn-danger" : "btn-primary"}" id="modalConfirm">${escapeHTML(confirmText)}</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector("#modalCancel").addEventListener("click", () => overlay.remove());
  overlay.querySelector("#modalConfirm").addEventListener("click", () => {
    overlay.remove();
    onConfirm();
  });
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
}

/* ==================== 主题切换 ==================== */
function initTheme() {
  const saved = localStorage.getItem("theme") || "light";
  document.documentElement.setAttribute("data-theme", saved);
  document.getElementById("themeToggle").addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  });
}

/* ==================== 路由 ==================== */
const routes = {
  home: renderDashboard,
  subscriptions: renderSubscriptions,
  settings: renderSettings,
  add: renderAddPage,
  edit: renderEditPage,
};

function getRoute() {
  const hash = location.hash.slice(1) || "/";
  if (hash === "/" || hash === "") return "home";
  if (hash === "/subscriptions") return "subscriptions";
  if (hash === "/settings") return "settings";
  if (hash === "/add") return "add";
  if (hash.startsWith("/edit/")) return "edit";
  return "home";
}

function getEditId() {
  const hash = location.hash.slice(1);
  if (hash.startsWith("/edit/")) {
    return parseInt(hash.split("/")[2]);
  }
  return null;
}

function navigate(route) {
  location.hash = route === "home" ? "/" : `/${route}`;
}

/** 更新导航胶囊指示器位置 */
function updateNavIndicator() {
  const capsule = document.querySelector(".nav-capsule");
  const indicator = capsule?.querySelector(".nav-indicator");
  const activeItem = capsule?.querySelector(".nav-item.active");
  if (!capsule || !indicator || !activeItem) return;

  const capsuleRect = capsule.getBoundingClientRect();
  const itemRect = activeItem.getBoundingClientRect();

  indicator.style.left = `${itemRect.left - capsuleRect.left}px`;
  indicator.style.width = `${itemRect.width}px`;
}

async function handleRoute() {
  const route = getRoute();
  const main = document.getElementById("mainContent");

  // 更新导航高亮
  document.querySelectorAll(".nav-item").forEach((el) => {
    const nav = el.dataset.nav;
    el.classList.toggle("active", nav === route || (route === "add" && nav === "subscriptions") || (route === "edit" && nav === "subscriptions"));
  });

  // 更新指示器位置
  updateNavIndicator();

  main.innerHTML = '<div class="loading"><div class="spinner"></div>加载中...</div>';

  try {
    if (routes[route]) {
      await routes[route](main);
    } else {
      navigate("home");
    }
  } catch (err) {
    main.innerHTML = `<div class="empty-state"><div class="empty-state-text">加载失败: ${escapeHTML(err.message)}</div></div>`;
  }
}

/* ==================== 页脚更新 ==================== */
async function updateFooter() {
  try {
    const data = await API.get("/api/version");
    document.getElementById("footerVersion").textContent = `v${data.version} - ${data.commit}`;
  } catch {
    // 使用默认值
  }
  document.getElementById("footerYear").textContent = new Date().getFullYear();
}

/* ==================== 仪表盘 ==================== */
async function renderDashboard(main) {
  const stats = await API.get("/api/stats");
  const subs = stats.subscriptions || [];

  // 按剩余天数排序
  const sorted = [...subs].sort((a, b) => {
    const aDays = getDisplayDays(a).days;
    const bDays = getDisplayDays(b).days;
    if (aDays === Infinity && bDays === Infinity) return 0;
    if (aDays === Infinity) return 1;
    if (bDays === Infinity) return -1;
    return aDays - bDays;
  });

  main.innerHTML = `
    <div class="dashboard-layout">
      <div class="dashboard-left">
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">${stats.total}</div>
            <div class="stat-label">总订阅数</div>
          </div>
          <div class="stat-card">
            <div class="stat-value" style="color: var(--text-primary)">${stats.upcoming}</div>
            <div class="stat-label">即将到期</div>
          </div>
        </div>
        <div class="card">
          <div class="card-header">
            <span class="card-title">订阅</span>
          </div>
          <div class="upcoming-list" id="upcomingList">
            ${sorted.length === 0 ? '<div class="empty-state"><div class="empty-state-text">暂无订阅</div></div>' : sorted.map((sub) => {
    const { days, type } = getDisplayDays(sub);
    const daysClass = getDaysClass(days);
    const label = type === "renewable" ? "可续费" : "到期";
    const daysText = days === Infinity ? "无期限" : `${days} 天后${label}`;
    return `
                <div class="upcoming-item" data-id="${sub.id}">
                  <div class="upcoming-item-left">
                    <div class="upcoming-icon" style="background:var(--text-primary);color:${getColor(sub.id)}">${sub.name.charAt(0).toUpperCase()}</div>
                    <div class="upcoming-info">
                      <span class="upcoming-name">${escapeHTML(sub.name.toUpperCase())}</span>
                      <span class="upcoming-category">${escapeHTML(sub.category)}</span>
                    </div>
                  </div>
                  <div class="upcoming-item-right">
                    <span class="upcoming-days ${daysClass}">${daysText}</span>
                    <span class="upcoming-price">¥${sub.price.toFixed(2)}</span>
                  </div>
                </div>
              `;
  }).join("")}
          </div>
        </div>
      </div>
      <div class="calendar-card card">
        ${renderCalendarHTML(subs)}
      </div>
    </div>
  `;

  // 初始化日历
  initCalendar(main, subs);
}

/* ==================== 日历组件 ==================== */
let calendarYear, calendarMonth;

function renderCalendarHTML(subs) {
  const now = new Date();
  if (calendarYear == null) calendarYear = now.getFullYear();
  if (calendarMonth == null) calendarMonth = now.getMonth();

  const monthNames = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];

  const firstDay = new Date(calendarYear, calendarMonth, 1).getDay();
  const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(calendarYear, calendarMonth, 0).getDate();

  // 构建事件日期映射
  const eventMap = {};
  subs.forEach((sub) => {
    if (sub.expiry_date) {
      const d = new Date(sub.expiry_date);
      if (d.getFullYear() === calendarYear && d.getMonth() === calendarMonth) {
        const day = d.getDate();
        if (!eventMap[day]) eventMap[day] = [];
        eventMap[day].push({ name: sub.name.toUpperCase(), color: getColor(sub.id) });
      }
    }
  });

  // 今天
  const today = new Date();
  const isToday = today.getFullYear() === calendarYear && today.getMonth() === calendarMonth;
  const todayDate = today.getDate();

  let daysHTML = "";

  // 上月填充
  for (let i = firstDay - 1; i >= 0; i--) {
    daysHTML += `<div class="calendar-day other-month">${daysInPrevMonth - i}</div>`;
  }

  // 本月
  for (let day = 1; day <= daysInMonth; day++) {
    let cls = "calendar-day";
    let style = "";
    if (isToday && day === todayDate) cls += " today";
    if (eventMap[day]) {
      cls += " has-event";
      style = `style="background:${eventMap[day][0].color};color:var(--bg)"`;
    }
    daysHTML += `<div class="${cls}" ${style}>${day}</div>`;
  }

  // 下月填充
  const totalCells = firstDay + daysInMonth;
  const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let i = 1; i <= remaining; i++) {
    daysHTML += `<div class="calendar-day other-month">${i}</div>`;
  }

  return `
    <div class="calendar-header">
      <button class="calendar-nav" id="calPrev">&lt;</button>
      <span class="calendar-month">${calendarYear}年 ${monthNames[calendarMonth]}</span>
      <button class="calendar-nav" id="calNext">&gt;</button>
    </div>
    <div class="calendar-weekdays">
      ${weekdays.map((w) => `<div class="calendar-weekday">${w}</div>`).join("")}
    </div>
    <div class="calendar-grid">
      ${daysHTML}
    </div>
  `;
}

function initCalendar(main, subs) {
  const prevBtn = main.querySelector("#calPrev");
  const nextBtn = main.querySelector("#calNext");

  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      calendarMonth--;
      if (calendarMonth < 0) { calendarMonth = 11; calendarYear--; }
      refreshCalendar(main, subs);
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      calendarMonth++;
      if (calendarMonth > 11) { calendarMonth = 0; calendarYear++; }
      refreshCalendar(main, subs);
    });
  }
}

function refreshCalendar(main, subs) {
  const card = main.querySelector(".calendar-card");
  if (card) {
    card.innerHTML = renderCalendarHTML(subs);
    initCalendar(main, subs);
  }
}

/* ==================== 订阅页 ==================== */
async function renderSubscriptions(main) {
  const [subs, categories] = await Promise.all([
    API.get("/api/subscriptions"),
    API.get("/api/categories"),
  ]);

  main.innerHTML = `
    <div class="search-box">
      <div class="search-wrapper">
        <svg class="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" class="search-input" id="searchInput" placeholder="搜索订阅名称..." />
      </div>
    </div>
    <div class="category-filter" id="categoryFilter">
      <button class="cat-pill-add" id="btnAddSub" title="添加订阅">＋</button>
      <button class="cat-pill active" data-cat="全部">全部</button>
      ${categories.map((cat) => `<button class="cat-pill" data-cat="${escapeHTML(cat)}">${escapeHTML(cat)}</button>`).join("")}
    </div>
    <div id="subscriptionList"></div>
  `;

  // 当前选中的分类和搜索词
  let currentCat = "全部";
  let currentSearch = "";

  function renderSubList(list) {
    const container = document.getElementById("subscriptionList");
    if (!container) return;

    if (list.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-text">暂无订阅</div></div>';
      return;
    }

    if (currentCat === "全部" && !currentSearch) {
      // 按分类分组
      const grouped = {};
      list.forEach((sub) => {
        if (!grouped[sub.category]) grouped[sub.category] = [];
        grouped[sub.category].push(sub);
      });

      container.innerHTML = Object.entries(grouped).map(([cat, catSubs]) => `
        <div class="category-group">
          <div class="category-group-title">${escapeHTML(cat)}</div>
          <div class="subscription-grid">
            ${catSubs.map((sub) => renderSubCard(sub)).join("")}
          </div>
        </div>
      `).join("");
    } else {
      container.innerHTML = `
        <div class="subscription-grid">
          ${list.map((sub) => renderSubCard(sub)).join("")}
        </div>
      `;
    }

    // 绑定卡片事件
    bindSubCardEvents();
  }

  function filterSubs() {
    let filtered = subs;
    if (currentCat !== "全部") {
      filtered = filtered.filter((s) => s.category === currentCat);
    }
    if (currentSearch) {
      filtered = filtered.filter((s) => s.name.toLowerCase().includes(currentSearch.toLowerCase()));
    }
    renderSubList(filtered);
  }

  // 分类筛选
  document.getElementById("categoryFilter").addEventListener("click", (e) => {
    const pill = e.target.closest(".cat-pill");
    if (!pill) return;
    currentCat = pill.dataset.cat;
    document.querySelectorAll(".cat-pill").forEach((p) => p.classList.remove("active"));
    pill.classList.add("active");
    filterSubs();
  });

  // 添加按钮
  document.getElementById("btnAddSub").addEventListener("click", () => navigate("add"));

  // 搜索
  document.getElementById("searchInput").addEventListener("input", (e) => {
    currentSearch = e.target.value.trim();
    filterSubs();
  });

  // 初始渲染
  renderSubList(subs);
}

function renderSubCard(sub) {
  const { days, type } = getDisplayDays(sub);
  const expiryText = sub.expiry_date
    ? (days <= 7 && days >= 0 ? `<span class="sub-expiry urgent">${days} 天后${type === "renewable" ? "可续费" : "到期"}</span>` : `<span class="sub-expiry">${formatDate(sub.expiry_date)}</span>`)
    : '<span class="sub-expiry">不限</span>';

  return `
    <div class="sub-card" data-id="${sub.id}">
      <div class="sub-card-left">
        <div class="sub-icon" style="background:var(--text-primary);color:${getColor(sub.id)}">${sub.name.charAt(0).toUpperCase()}</div>
        <div class="sub-card-info">
          <div class="sub-name">${escapeHTML(sub.name.toUpperCase())}</div>
          <span class="sub-category-tag">${escapeHTML(sub.category)}</span>
        </div>
      </div>
      <div class="sub-card-right">
        ${expiryText}
        <span class="sub-price">¥${sub.price.toFixed(2)}</span>
      </div>
    </div>
  `;
}

function bindSubCardEvents() {
  document.querySelectorAll(".sub-card").forEach((card) => {
    card.addEventListener("click", () => {
      navigate(`edit/${card.dataset.id}`);
    });
  });
}

/* ==================== 添加 / 编辑页 ==================== */
async function renderAddPage(main) {
  const categories = await API.get("/api/categories");

  main.innerHTML = `
    <div class="form-page">
      <div class="form-card">
        <div class="form-title">添加订阅</div>
        ${renderFormHTML({}, categories, false)}
      </div>
    </div>
  `;

  bindFormEvents(main, null);
}

async function renderEditPage(main) {
  const id = getEditId();
  if (!id) { navigate("home"); return; }

  try {
    const [sub, categories] = await Promise.all([
      API.get(`/api/subscriptions/${id}`),
      API.get("/api/categories"),
    ]);

    main.innerHTML = `
      <div class="form-page">
        <div class="form-card">
          <div class="form-title">编辑订阅</div>
          ${renderFormHTML(sub, categories, true)}
          <div class="form-actions">
            <button class="btn btn-danger btn-full" id="btnDelete">删除订阅</button>
          </div>
        </div>
      </div>
    `;

    bindFormEvents(main, id);
  } catch (err) {
    showToast(err.message, "error");
    navigate("subscriptions");
  }
}

function renderFormHTML(sub, categories, isEdit) {
  return `
    <div class="form-group">
      <label class="form-label">名称 *</label>
      <input type="text" class="form-input" id="fName" value="${escapeHTML(sub.name || "")}" placeholder="例如：Netflix" />
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">价格</label>
        <input type="number" step="0.01" min="0" class="form-input" id="fPrice" value="${sub.price ?? 0}" placeholder="0.00" />
      </div>
      <div class="form-group">
        <label class="form-label">分类 *</label>
        <input type="text" class="form-input" id="fCategory" value="${escapeHTML(sub.category || "")}" list="catList" placeholder="例如：影音娱乐" />
        <datalist id="catList">
          ${categories.map((c) => `<option value="${escapeHTML(c)}">`).join("")}
        </datalist>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group date-picker-group" data-target="fExpiryDate">
        <label class="form-label">到期日期</label>
        <div class="form-date-display">${sub.expiry_date ? formatDate(sub.expiry_date) : "选择日期"}</div>
        <input type="date" class="form-input form-date-hidden" id="fExpiryDate" value="${sub.expiry_date || ""}" />
      </div>
      <div class="form-group date-picker-group" data-target="fRenewableDate">
        <label class="form-label">可续费日期</label>
        <div class="form-date-display">${sub.renewable_date ? formatDate(sub.renewable_date) : "选择日期"}</div>
        <input type="date" class="form-input form-date-hidden" id="fRenewableDate" value="${sub.renewable_date || ""}" />
      </div>
    </div>
    <div class="form-toggle">
      <span class="form-toggle-label">到期邮件提醒</span>
      <div class="toggle-switch ${sub.email_reminder_expiry ? "active" : ""}" id="toggleExpiry" data-value="${sub.email_reminder_expiry || 0}"></div>
    </div>
    <div class="form-toggle">
      <span class="form-toggle-label">续费邮件提醒</span>
      <div class="toggle-switch ${sub.email_reminder_renewal ? "active" : ""}" id="toggleRenewal" data-value="${sub.email_reminder_renewal || 0}"></div>
    </div>
    <div class="form-actions">
      <button class="btn btn-cancel" id="btnCancel">取消</button>
      <button class="btn btn-primary" id="btnSave">${isEdit ? "保存修改" : "添加订阅"}</button>
    </div>
  `;
}

function bindFormEvents(main, editId) {
  // 自定义日期选择器
  main.querySelectorAll(".date-picker-group").forEach((group) => {
    const targetId = group.dataset.target;
    const input = document.getElementById(targetId);
    const display = group.querySelector(".form-date-display");
    if (!input || !display) return;

    let pickerPanel = null;
    let pickerYear, pickerMonth;

    const monthNames = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];

    function closePicker() {
      if (pickerPanel) {
        pickerPanel.remove();
        pickerPanel = null;
      }
      document.removeEventListener("click", onOutsideClick, true);
    }

    function onOutsideClick(e) {
      if (pickerPanel && !pickerPanel.contains(e.target) && e.target !== display) {
        closePicker();
      }
    }

    function selectDate(dateStr) {
      input.value = dateStr;
      display.textContent = dateStr ? formatDate(dateStr) : "选择日期";
      input.dispatchEvent(new Event("change", { bubbles: true }));
      closePicker();
    }

    /** 更新面板内的月份标题和日期网格（不重建面板，避免闪烁） */
    function updatePickerGrid() {
      if (!pickerPanel) return;

      const monthEl = pickerPanel.querySelector(".pkr-month");
      const gridEl = pickerPanel.querySelector(".pkr-grid");
      if (!monthEl || !gridEl) return;

      monthEl.textContent = `${pickerYear}年 ${monthNames[pickerMonth]}`;

      const firstDay = new Date(pickerYear, pickerMonth, 1).getDay();
      const daysInMonth = new Date(pickerYear, pickerMonth + 1, 0).getDate();
      const daysInPrevMonth = new Date(pickerYear, pickerMonth, 0).getDate();

      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      const selectedStr = input.value;

      let html = "";
      for (let i = firstDay - 1; i >= 0; i--) {
        html += `<div class="pkr-day pkr-other">${daysInPrevMonth - i}</div>`;
      }
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${pickerYear}-${String(pickerMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        let cls = "pkr-day";
        if (dateStr === todayStr) cls += " pkr-today";
        if (dateStr === selectedStr) cls += " pkr-selected";
        html += `<div class="${cls}" data-date="${dateStr}">${day}</div>`;
      }
      const totalCells = firstDay + daysInMonth;
      const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
      for (let i = 1; i <= remaining; i++) {
        html += `<div class="pkr-day pkr-other">${i}</div>`;
      }

      gridEl.innerHTML = html;

      // 重新绑定日期点击事件
      gridEl.querySelectorAll(".pkr-day:not(.pkr-other)").forEach(day => {
        day.addEventListener("click", (e) => {
          e.stopPropagation();
          selectDate(day.dataset.date);
        });
      });
    }

    function openPicker() {
      if (pickerPanel) { closePicker(); return; }

      const initDate = input.value ? new Date(input.value) : new Date();
      pickerYear = initDate.getFullYear();
      pickerMonth = initDate.getMonth();

      const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
      const wrapper = document.createElement("div");
      wrapper.innerHTML = `
        <div class="date-picker-panel">
          <div class="pkr-header">
            <button class="pkr-nav pkr-prev">&lt;</button>
            <span class="pkr-month"></span>
            <button class="pkr-nav pkr-next">&gt;</button>
          </div>
          <div class="pkr-weekdays">
            ${weekdays.map(w => `<div class="pkr-weekday">${w}</div>`).join("")}
          </div>
          <div class="pkr-grid"></div>
        </div>
      `;
      pickerPanel = wrapper.firstElementChild;
      group.appendChild(pickerPanel);

      // 更新网格
      updatePickerGrid();

      // 导航按钮
      pickerPanel.querySelector(".pkr-prev").addEventListener("click", (e) => {
        e.stopPropagation();
        pickerMonth--;
        if (pickerMonth < 0) { pickerMonth = 11; pickerYear--; }
        updatePickerGrid();
      });
      pickerPanel.querySelector(".pkr-next").addEventListener("click", (e) => {
        e.stopPropagation();
        pickerMonth++;
        if (pickerMonth > 11) { pickerMonth = 0; pickerYear++; }
        updatePickerGrid();
      });

      setTimeout(() => {
        document.addEventListener("click", onOutsideClick, true);
      }, 0);
    }

    group.addEventListener("click", (e) => {
      e.stopPropagation();
      openPicker();
    });

    input.addEventListener("change", () => {
      display.textContent = input.value ? formatDate(input.value) : "选择日期";
    });
  });

  // Toggle 开关
  ["toggleExpiry", "toggleRenewal"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("click", () => {
      const val = el.dataset.value === "1" ? "0" : "1";
      el.dataset.value = val;
      el.classList.toggle("active", val === "1");
    });
  });

  // 取消
  document.getElementById("btnCancel").addEventListener("click", () => navigate("subscriptions"));

  // 保存
  document.getElementById("btnSave").addEventListener("click", async () => {
    const name = document.getElementById("fName").value.trim();
    const category = document.getElementById("fCategory").value.trim();
    const price = parseFloat(document.getElementById("fPrice").value) || 0;
    const expiryDate = document.getElementById("fExpiryDate").value || null;
    const renewableDate = document.getElementById("fRenewableDate").value || null;
    const emailReminderExpiry = parseInt(document.getElementById("toggleExpiry").dataset.value);
    const emailReminderRenewal = parseInt(document.getElementById("toggleRenewal").dataset.value);

    if (!name) { showToast("请输入名称", "error"); return; }
    if (!category) { showToast("请输入分类", "error"); return; }

    const body = { name, category, price, expiry_date: expiryDate, renewable_date: renewableDate, email_reminder_expiry: emailReminderExpiry, email_reminder_renewal: emailReminderRenewal };

    try {
      if (editId) {
        await API.put(`/api/subscriptions/${editId}`, body);
        showToast("保存成功", "success");
      } else {
        await API.post("/api/subscriptions", body);
        showToast("添加成功", "success");
      }
      navigate("subscriptions");
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  // 删除（仅编辑页）
  const btnDelete = document.getElementById("btnDelete");
  if (btnDelete && editId) {
    btnDelete.addEventListener("click", () => {
      showModal(
        "删除订阅",
        "确定要删除这个订阅吗？此操作不可撤销。",
        async () => {
          try {
            await API.delete(`/api/subscriptions/${editId}`);
            showToast("删除成功", "success");
            navigate("subscriptions");
          } catch (err) {
            showToast(err.message, "error");
          }
        },
        "删除",
        true,
      );
    });
  }
}

/* ==================== 设置页 ==================== */
async function renderSettings(main) {
  const [user, settings] = await Promise.all([
    API.get("/api/user"),
    API.get("/api/settings"),
  ]);

  main.innerHTML = `
    <div class="settings-page">
      <div class="card">
        <div class="card-title" style="margin-bottom:16px">用户信息</div>
        <div class="settings-user-info">
          <div class="settings-avatar">${user.email.charAt(0).toUpperCase()}</div>
          <div>
            <div class="settings-user-name">${escapeHTML(user.email.split("@")[0])}</div>
            <div class="settings-user-email">${escapeHTML(user.email)}</div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-title" style="margin-bottom:16px">通知邮箱</div>
        <p style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:12px">设置接收订阅提醒邮件的邮箱地址</p>
        <div class="settings-save-row">
          <input type="email" class="form-input" id="notificationEmail" value="${escapeHTML(settings.notification_email || "")}" placeholder="your@email.com" />
          <button class="btn btn-primary" id="btnSaveEmail">保存</button>
        </div>
      </div>

      <div class="logout-section">
        <button class="btn btn-danger btn-full" id="btnLogout">退出登录</button>
      </div>
    </div>
  `;

  // 更新版本信息
  try {
    const v = await API.get("/api/version");
    document.getElementById("aboutVersion").textContent = `v${v.version} - ${v.commit}`;
  } catch { }

  // 保存邮箱
  document.getElementById("btnSaveEmail").addEventListener("click", async () => {
    const email = document.getElementById("notificationEmail").value.trim();
    if (!email) { showToast("请输入邮箱地址", "error"); return; }
    try {
      await API.put("/api/settings", { notification_email: email });
      showToast("保存成功", "success");
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  // 退出登录
  document.getElementById("btnLogout").addEventListener("click", () => {
    showModal("退出登录", "确定要退出登录吗？", () => {
      // Cloudflare Access 退出 URL
      window.location.href = "/cdn-cgi/access/logout";
    }, "退出", true);
  });
}

/* ==================== 初始化 ==================== */
function init() {
  initTheme();
  updateFooter();

  window.addEventListener("hashchange", handleRoute);
  window.addEventListener("resize", updateNavIndicator);
  handleRoute();
}

document.addEventListener("DOMContentLoaded", init);