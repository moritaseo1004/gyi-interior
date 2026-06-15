const STORAGE_KEY = "interior-tracker-v1";
const SUPABASE_SETTINGS = window.INTERIOR_SUPABASE || {};
const supabaseClient =
  window.supabase && SUPABASE_SETTINGS.url && SUPABASE_SETTINGS.anonKey
    ? window.supabase.createClient(SUPABASE_SETTINGS.url, SUPABASE_SETTINGS.anonKey)
    : null;

let remoteSaveTimer = null;

const PROCESS_STATUSES = [
  "알아보는 중",
  "견적 요청",
  "견적 받음",
  "협의 중",
  "선정 완료",
  "보류",
];

const VENDOR_STATUSES = [
  "후보",
  "연락 예정",
  "견적 요청",
  "견적 받음",
  "협의 중",
  "선정",
  "탈락",
];

const PURCHASE_STATUSES = ["구매 예정", "비교 중", "주문 완료", "배송 중", "구매 완료", "보류"];

const PROCESS_TEMPLATES = [
  {
    id: "demolition",
    name: "철거",
    focus: "철거 범위, 폐기물 처리, 관리사무소 신고",
    tasks: [
      { id: "t1", text: "철거 범위 사진으로 표시하기", done: false },
      { id: "t2", text: "폐기물 처리 비용 포함 여부 확인", done: false },
    ],
  },
  {
    id: "bathroom-demolition",
    name: "화장실 철거",
    focus: "방수층 손상, 폐기물, 설비 철거 범위",
    tasks: [{ id: "t3", text: "양변기/세면대/욕조 철거 범위 확인", done: false }],
  },
  {
    id: "ac-piping",
    name: "A/C배관",
    focus: "배관 경로, 배수, 실외기 위치, 타공 여부",
    tasks: [{ id: "t4", text: "실내기/실외기 위치 확정", done: false }],
  },
  {
    id: "electrical-wiring",
    name: "전기배선",
    focus: "콘센트 증설, 스위치 위치, 전용선 필요 여부",
    tasks: [{ id: "t5", text: "방별 콘센트/스위치 위치 표시", done: false }],
  },
  {
    id: "carpentry",
    name: "목공사",
    focus: "문선, 몰딩, 가벽, 천장 보강, 마감 범위",
    tasks: [{ id: "t6", text: "목공 상세 범위 도면/사진으로 정리", done: false }],
  },
  {
    id: "film",
    name: "필름공사",
    focus: "문/문틀, 샷시, 붙박이장, 하자 보수 기준",
    tasks: [{ id: "t7", text: "필름 색상과 시공 부위 확정", done: false }],
  },
  {
    id: "bathroom",
    name: "화장실 공사",
    focus: "방수, 타일, 도기/수전, 환풍기, 젠다이",
    tasks: [{ id: "t8", text: "타일/도기/수전 모델 정리", done: false }],
  },
  {
    id: "wallpaper",
    name: "도배공사",
    focus: "실크/합지, 천장 포함, 곰팡이 보수 여부",
    tasks: [
      { id: "t9", text: "벽지 종류와 브랜드 정하기", done: false },
      { id: "t10", text: "기존 벽 상태 보수 비용 확인", done: false },
    ],
  },
  {
    id: "furniture",
    name: "가구공사",
    focus: "싱크대, 붙박이장, 수납, 실측일과 설치일",
    tasks: [{ id: "t11", text: "가구 실측 일정 잡기", done: false }],
  },
  {
    id: "lighting",
    name: "조명",
    focus: "등기구 모델, 색온도, 스위치 연동, 매립등 수량",
    tasks: [{ id: "t12", text: "공간별 조명 모델과 수량 확정", done: false }],
  },
  {
    id: "ac-indoor-unit",
    name: "A/C 실내기 설치",
    focus: "실내기 위치, 배관 연결, 배수 테스트, 마감 커버",
    tasks: [{ id: "t13", text: "설치 후 냉방/배수 테스트", done: false }],
  },
  {
    id: "flooring",
    name: "장판 시공",
    focus: "장판 두께, 걸레받이, 문턱 처리, 바닥 보수",
    tasks: [{ id: "t14", text: "장판 샘플과 걸레받이 색상 비교", done: false }],
  },
  {
    id: "cleaning",
    name: "입주 청소",
    focus: "창틀, 욕실, 주방 후드, 피톤치드/새집증후군 옵션",
    tasks: [{ id: "t15", text: "청소 가능 날짜 확인", done: false }],
  },
];

function createProcess(template, overrides = {}) {
  return {
    id: template.id,
    name: template.name,
    status: "알아보는 중",
    startDate: "",
    endDate: "",
    focus: template.focus,
    notes: { mine: "", partner: "", decision: "" },
    tasks: structuredClone(template.tasks),
    vendors: [],
    ...overrides,
  };
}

const starterData = {
  activeProcessId: "demolition",
  purchases: [],
  processes: PROCESS_TEMPLATES.map((template) =>
    createProcess(
      template,
      template.id === "wallpaper"
        ? {
            status: "견적 요청",
            vendors: [
              {
                id: "v1",
                name: "동네 도배 사장님",
                contact: "카톡 견적 대기",
                quote: 0,
                status: "견적 요청",
                scope: "실측 후 확정",
                memo: "응답 빠름. 일정은 아직 미정.",
              },
            ],
          }
        : {},
    ),
  ),
};

let state = loadState();
let currentView = "dashboard";

const els = {
  appShell: document.querySelector(".app-shell"),
  loginScreen: document.querySelector("#loginScreen"),
  loginForm: document.querySelector("#loginForm"),
  loginEmail: document.querySelector("#loginEmail"),
  loginPassword: document.querySelector("#loginPassword"),
  loginError: document.querySelector("#loginError"),
  dashboardBtn: document.querySelector("#dashboardBtn"),
  scheduleBtn: document.querySelector("#scheduleBtn"),
  purchaseBtn: document.querySelector("#purchaseBtn"),
  dashboardView: document.querySelector("#dashboardView"),
  scheduleView: document.querySelector("#scheduleView"),
  purchaseView: document.querySelector("#purchaseView"),
  processView: document.querySelector("#processView"),
  processList: document.querySelector("#processList"),
  activeProcessTitle: document.querySelector("#activeProcessTitle"),
  processStatus: document.querySelector("#processStatus"),
  processStartDate: document.querySelector("#processStartDate"),
  processEndDate: document.querySelector("#processEndDate"),
  processFocus: document.querySelector("#processFocus"),
  summaryText: document.querySelector("#summaryText"),
  progressBar: document.querySelector("#progressBar"),
  totalEstimate: document.querySelector("#totalEstimate"),
  selectedCount: document.querySelector("#selectedCount"),
  unselectedCount: document.querySelector("#unselectedCount"),
  totalProcessCount: document.querySelector("#totalProcessCount"),
  purchaseTotal: document.querySelector("#purchaseTotal"),
  estimateTable: document.querySelector("#estimateTable"),
  scheduleSummary: document.querySelector("#scheduleSummary"),
  scheduleList: document.querySelector("#scheduleList"),
  purchaseViewTotal: document.querySelector("#purchaseViewTotal"),
  purchasePlannedCount: document.querySelector("#purchasePlannedCount"),
  purchaseDoneCount: document.querySelector("#purchaseDoneCount"),
  purchaseItemCount: document.querySelector("#purchaseItemCount"),
  purchaseList: document.querySelector("#purchaseList"),
  addPurchaseBtn: document.querySelector("#addPurchaseBtn"),
  vendorGrid: document.querySelector("#vendorGrid"),
  myNote: document.querySelector("#myNote"),
  partnerNote: document.querySelector("#partnerNote"),
  decisionNote: document.querySelector("#decisionNote"),
  taskList: document.querySelector("#taskList"),
  addProcessBtn: document.querySelector("#addProcessBtn"),
  addVendorBtn: document.querySelector("#addVendorBtn"),
  addTaskBtn: document.querySelector("#addTaskBtn"),
  vendorDialog: document.querySelector("#vendorDialog"),
  vendorForm: document.querySelector("#vendorForm"),
  vendorDialogTitle: document.querySelector("#vendorDialogTitle"),
  vendorId: document.querySelector("#vendorId"),
  vendorName: document.querySelector("#vendorName"),
  vendorContact: document.querySelector("#vendorContact"),
  vendorQuote: document.querySelector("#vendorQuote"),
  vendorStatus: document.querySelector("#vendorStatus"),
  vendorScope: document.querySelector("#vendorScope"),
  vendorMemo: document.querySelector("#vendorMemo"),
  deleteVendorBtn: document.querySelector("#deleteVendorBtn"),
  purchaseDialog: document.querySelector("#purchaseDialog"),
  purchaseForm: document.querySelector("#purchaseForm"),
  purchaseDialogTitle: document.querySelector("#purchaseDialogTitle"),
  purchaseId: document.querySelector("#purchaseId"),
  purchaseName: document.querySelector("#purchaseName"),
  purchaseCategory: document.querySelector("#purchaseCategory"),
  purchaseStatus: document.querySelector("#purchaseStatus"),
  purchasePrice: document.querySelector("#purchasePrice"),
  purchaseStore: document.querySelector("#purchaseStore"),
  purchaseMemo: document.querySelector("#purchaseMemo"),
  deletePurchaseBtn: document.querySelector("#deletePurchaseBtn"),
};

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return structuredClone(starterData);

  try {
    return normalizeState(JSON.parse(saved));
  } catch {
    return structuredClone(starterData);
  }
}

function normalizeState(savedState) {
  const legacyNameMap = {
    도배: "wallpaper",
    바닥: "flooring",
    "조명/전기": "lighting",
    입주청소: "cleaning",
  };

  const savedProcesses = Array.isArray(savedState?.processes) ? savedState.processes : [];
  const byId = new Map(savedProcesses.map((process) => [process.id, process]));

  savedProcesses.forEach((process) => {
    const mappedId = legacyNameMap[process.name];
    if (mappedId && !byId.has(mappedId)) byId.set(mappedId, process);
  });

  const orderedProcesses = PROCESS_TEMPLATES.map((template) => {
    const savedProcess = byId.get(template.id);
    if (!savedProcess) return createProcess(template);

    return createProcess(template, {
      ...savedProcess,
      id: template.id,
      name: template.name,
      startDate: savedProcess.startDate || "",
      endDate: savedProcess.endDate || savedProcess.dueDate || "",
      focus: savedProcess.focus || template.focus,
      notes: { mine: "", partner: "", decision: "", ...(savedProcess.notes || {}) },
      tasks: Array.isArray(savedProcess.tasks) ? savedProcess.tasks : structuredClone(template.tasks),
      vendors: Array.isArray(savedProcess.vendors) ? savedProcess.vendors : [],
    });
  });

  const knownIds = new Set(PROCESS_TEMPLATES.map((template) => template.id));
  const customProcesses = savedProcesses.filter((process) => !knownIds.has(process.id));
  const activeProcessId = orderedProcesses.some((process) => process.id === savedState.activeProcessId)
    ? savedState.activeProcessId
    : orderedProcesses[0].id;

  return {
    activeProcessId,
    purchases: Array.isArray(savedState?.purchases) ? savedState.purchases : [],
    processes: [...orderedProcesses, ...customProcesses],
  };
}

function saveState({ syncRemote = true } = {}) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (syncRemote) queueRemoteSave();
}

function isRemoteEnabled() {
  return Boolean(supabaseClient);
}

function queueRemoteSave() {
  if (!isRemoteEnabled()) return;
  window.clearTimeout(remoteSaveTimer);
  remoteSaveTimer = window.setTimeout(() => {
    persistRemoteState();
  }, 500);
}

async function persistRemoteState() {
  if (!isRemoteEnabled()) return;

  const { error } = await supabaseClient.from("app_states").upsert({
    id: "main",
    data: state,
    updated_at: new Date().toISOString(),
  });

  if (error) console.error("Supabase save failed:", error);
}

async function loadRemoteState() {
  if (!isRemoteEnabled()) return;

  const { data, error } = await supabaseClient
    .from("app_states")
    .select("data")
    .eq("id", "main")
    .maybeSingle();

  if (error) {
    console.error("Supabase load failed:", error);
    return;
  }

  if (data?.data) {
    state = normalizeState(data.data);
    saveState({ syncRemote: false });
    return;
  }

  await persistRemoteState();
}

function setAuthenticatedView(isAuthenticated) {
  if (!isRemoteEnabled()) {
    els.loginScreen.hidden = true;
    els.appShell.hidden = false;
    return;
  }

  els.loginScreen.hidden = isAuthenticated;
  els.appShell.hidden = !isAuthenticated;
}

async function boot() {
  fillSelect(els.processStatus, PROCESS_STATUSES);
  fillSelect(els.vendorStatus, VENDOR_STATUSES);
  fillSelect(els.purchaseStatus, PURCHASE_STATUSES);
  wireEvents();

  if (!isRemoteEnabled()) {
    setAuthenticatedView(true);
    render();
    return;
  }

  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

  if (!session) {
    setAuthenticatedView(false);
    return;
  }

  await loadRemoteState();
  setAuthenticatedView(true);
  render();
}

function id(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function activeProcess() {
  return (
    state.processes.find((process) => process.id === state.activeProcessId) ||
    state.processes[0]
  );
}

function money(value) {
  const number = Number(value || 0);
  if (!number) return "금액 미입력";
  return new Intl.NumberFormat("ko-KR").format(number) + "원";
}

function formatDate(value) {
  if (!value) return "";
  const [, month, day] = value.split("-");
  if (!month || !day) return value;
  return `${month}.${day}`;
}

function formatDateObject(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}.${day}`;
}

function dateRange(process) {
  const start = formatDate(process.startDate);
  const end = formatDate(process.endDate);
  if (start && end) return `${start} - ${end}`;
  if (start) return `${start} 시작`;
  if (end) return `${end} 종료`;
  return "일정 미정";
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysBetween(start, end) {
  const day = 24 * 60 * 60 * 1000;
  return Math.max(0, Math.round((end - start) / day));
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function isSameDay(first, second) {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(date) {
  return `${date.getFullYear()}년 ${String(date.getMonth() + 1).padStart(2, "0")}월`;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date, months) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function isDateInRange(date, start, end) {
  const time = date.getTime();
  return time >= start.getTime() && time <= end.getTime();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function fillSelect(select, options) {
  select.innerHTML = options.map((option) => `<option>${escapeHtml(option)}</option>`).join("");
}

function render() {
  const process = activeProcess();
  state.activeProcessId = process.id;

  renderSummary();
  renderDashboard();
  renderSchedule();
  renderPurchases();
  renderProcesses(process);
  renderProcessDetail(process);
  renderVendors(process);
  renderTasks(process);
  renderView();
}

function renderSummary() {
  const total = state.processes.length;
  const completed = state.processes.filter((process) => process.status === "선정 완료").length;
  const percent = total ? Math.round((completed / total) * 100) : 0;

  els.summaryText.textContent = `${completed}/${total} 공정 선정 완료`;
  els.progressBar.style.width = `${percent}%`;
}

function selectedVendorFor(process) {
  return process.vendors.find((vendor) => vendor.status === "선정") || null;
}

function renderDashboard() {
  const rows = state.processes.map((process, index) => {
    const vendor = selectedVendorFor(process);
    return { process, vendor, index };
  });
  const selectedRows = rows.filter((row) => row.vendor);
  const total = selectedRows.reduce((sum, row) => sum + Number(row.vendor.quote || 0), 0);

  els.totalEstimate.textContent = money(total);
  els.selectedCount.textContent = `${selectedRows.length}건`;
  els.unselectedCount.textContent = `${state.processes.length - selectedRows.length}건`;
  els.totalProcessCount.textContent = `${state.processes.length}건`;
  els.purchaseTotal.textContent = money(purchaseTotal());

  els.estimateTable.innerHTML = `
    <div class="estimate-header" aria-hidden="true">
      <span>공정</span>
      <span>선정 업체</span>
      <span>일정</span>
      <span>견적가</span>
    </div>
    ${rows
      .map(({ process, vendor, index }) => {
      const hasVendor = Boolean(vendor);
      return `
        <button class="estimate-row ${hasVendor ? "selected" : ""}" type="button" data-process-id="${process.id}">
          <span class="estimate-process">
            <small>${String(index + 1).padStart(2, "0")}</small>
            ${escapeHtml(process.name)}
          </span>
          <span class="estimate-vendor">${escapeHtml(vendor?.name || "업체 미선정")}</span>
          <span class="estimate-date">${escapeHtml(dateRange(process))}</span>
          <strong class="estimate-amount">${escapeHtml(hasVendor ? money(vendor.quote) : "-")}</strong>
        </button>
      `;
    })
    .join("")}
  `;
}

function purchaseTotal() {
  return (state.purchases || []).reduce((sum, item) => sum + Number(item.price || 0), 0);
}

function renderPurchases() {
  const purchases = state.purchases || [];
  const plannedCount = purchases.filter((item) => item.status !== "구매 완료").length;
  const doneCount = purchases.filter((item) => item.status === "구매 완료").length;

  els.purchaseViewTotal.textContent = money(purchaseTotal());
  els.purchasePlannedCount.textContent = `${plannedCount}건`;
  els.purchaseDoneCount.textContent = `${doneCount}건`;
  els.purchaseItemCount.textContent = `${purchases.length}건`;

  if (!purchases.length) {
    els.purchaseList.innerHTML = `
      <div class="empty-state">
        <div>
          <strong>아직 구매 품목이 없어요.</strong><br />
          <span>공정과 별개로 사야 할 항목을 추가해두세요.</span>
        </div>
      </div>
    `;
    return;
  }

  els.purchaseList.innerHTML = purchases
    .map(
      (item) => `
        <article class="purchase-card">
          <header>
            <div>
              <h4>${escapeHtml(item.name)}</h4>
              <p>${escapeHtml(item.category || "분류 미입력")}</p>
            </div>
            <span class="pill">${escapeHtml(item.status || "구매 예정")}</span>
          </header>
          <strong>${escapeHtml(money(item.price))}</strong>
          <p>${escapeHtml(item.store || "구매처 미입력")}</p>
          <p>${escapeHtml(item.memo || "메모가 비어 있어요.")}</p>
          <button class="secondary-button" type="button" data-edit-purchase="${item.id}">수정</button>
        </article>
      `,
    )
    .join("");
}

function renderSchedule() {
  const events = state.processes
    .map((process, index) => ({
      process,
      index,
      start: parseDate(process.startDate),
      end: parseDate(process.endDate || process.startDate),
    }))
    .filter((event) => event.start || event.end)
    .map((event) => ({
      ...event,
      start: event.start || event.end,
      end: event.end || event.start,
    }));

  const today = new Date();
  const defaultFirstMonth = startOfMonth(today);
  const defaultLastMonth = addMonths(defaultFirstMonth, 2);
  const minDate = events.length
    ? new Date(Math.min(...events.map((event) => event.start.getTime())))
    : today;
  const maxDate = events.length
    ? new Date(Math.max(...events.map((event) => event.end.getTime())))
    : addMonths(today, 2);
  const firstMonth = new Date(Math.min(defaultFirstMonth.getTime(), startOfMonth(minDate).getTime()));
  const lastMonth = new Date(Math.max(defaultLastMonth.getTime(), startOfMonth(maxDate).getTime()));
  const months = [];

  for (
    let cursor = new Date(firstMonth);
    cursor <= lastMonth;
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
  ) {
    months.push(new Date(cursor));
  }

  els.scheduleSummary.textContent = events.length
    ? `${formatDateObject(minDate)} - ${formatDateObject(maxDate)}`
    : "일정 미정";
  els.scheduleList.innerHTML = months
    .map((month) => {
      const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
      const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);
      const gridStart = addDays(monthStart, -monthStart.getDay());
      const totalCells = Math.ceil((monthStart.getDay() + monthEnd.getDate()) / 7) * 7;
      const cells = Array.from({ length: totalCells }, (_, dayOffset) => addDays(gridStart, dayOffset));

      return `
        <section class="calendar-month" aria-label="${escapeHtml(monthLabel(month))}">
          <header class="calendar-month-header">
            <h4>${escapeHtml(monthLabel(month))}</h4>
            <span>${escapeHtml(monthKey(month))}</span>
          </header>
          <div class="calendar-weekdays" aria-hidden="true">
            <span>일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span>토</span>
          </div>
          <div class="calendar-grid">
            ${cells
              .map((date) => {
                const dayEvents = events.filter((event) => isDateInRange(date, event.start, event.end));
                const isOutside = date.getMonth() !== month.getMonth();
                const isToday = isSameDay(date, new Date());

                return `
                  <div class="calendar-day ${isOutside ? "outside" : ""} ${isToday ? "today" : ""}">
                    <span class="calendar-date">${date.getDate()}</span>
                    <div class="calendar-events">
                      ${dayEvents
                        .slice(0, 3)
                        .map(
                          (event) => `
                            <button class="calendar-event" type="button" data-process-id="${event.process.id}" title="${escapeHtml(event.process.name)} · ${escapeHtml(dateRange(event.process))}">
                              ${String(event.index + 1).padStart(2, "0")} ${escapeHtml(event.process.name)}
                            </button>
                          `,
                        )
                        .join("")}
                      ${
                        dayEvents.length > 3
                          ? `<span class="calendar-more">+${dayEvents.length - 3}</span>`
                          : ""
                      }
                    </div>
                  </div>
                `;
              })
              .join("")}
          </div>
        </section>
      `;
    })
    .join("");
}

function renderView() {
  const process = activeProcess();
  const processIndex = state.processes.findIndex((item) => item.id === process.id);
  const isDashboard = currentView === "dashboard";
  const isSchedule = currentView === "schedule";
  const isPurchase = currentView === "purchase";

  els.dashboardView.hidden = !isDashboard;
  els.scheduleView.hidden = !isSchedule;
  els.purchaseView.hidden = !isPurchase;
  els.processView.hidden = isDashboard || isSchedule || isPurchase;
  els.dashboardBtn.classList.toggle("active", isDashboard);
  els.scheduleBtn.classList.toggle("active", isSchedule);
  els.purchaseBtn.classList.toggle("active", isPurchase);
  els.processList.classList.toggle("is-detail-active", currentView === "process");

  if (isDashboard) {
    els.activeProcessTitle.textContent = "대시보드";
    return;
  }

  if (isSchedule) {
    els.activeProcessTitle.textContent = "일정";
    return;
  }

  if (isPurchase) {
    els.activeProcessTitle.textContent = "구매";
    return;
  }

  els.activeProcessTitle.textContent = `${String(processIndex + 1).padStart(2, "0")}. ${process.name}`;
}

function renderProcesses(active) {
  els.processList.innerHTML = state.processes
    .map(
      (process, index) => `
        <button class="process-item ${process.id === active.id ? "active" : ""}" type="button" data-process-id="${process.id}">
          <strong><small>${String(index + 1).padStart(2, "0")}</small>${escapeHtml(process.name)}</strong>
          <span>${escapeHtml(process.status)}</span>
        </button>
      `,
    )
    .join("");
}

function renderProcessDetail(process) {
  els.processStatus.value = process.status;
  els.processStartDate.value = process.startDate || "";
  els.processEndDate.value = process.endDate || process.dueDate || "";
  els.processFocus.value = process.focus || "";
  els.myNote.value = process.notes.mine || "";
  els.partnerNote.value = process.notes.partner || "";
  els.decisionNote.value = process.notes.decision || "";
}

function renderVendors(process) {
  if (!process.vendors.length) {
    els.vendorGrid.innerHTML = `
      <div class="empty-state">
        <div>
          <strong>아직 업체 후보가 없어요.</strong><br />
          <span>견적 받은 업체부터 하나씩 넣으면 비교가 쉬워져요.</span>
        </div>
      </div>
    `;
    return;
  }

  const sorted = [...process.vendors].sort((a, b) => Number(a.quote || 0) - Number(b.quote || 0));
  els.vendorGrid.innerHTML = sorted
    .map(
      (vendor) => `
        <article class="vendor-card">
          <header>
            <div>
              <h4>${escapeHtml(vendor.name)}</h4>
              <p>${escapeHtml(vendor.contact || "연락처 미입력")}</p>
            </div>
            <span class="pill">${escapeHtml(vendor.status)}</span>
          </header>
          <div class="quote">${escapeHtml(money(vendor.quote))}</div>
          <p>${escapeHtml(vendor.scope || "포함/미포함 조건을 적어두세요.")}</p>
          <p>${escapeHtml(vendor.memo || "장단점 메모가 비어 있어요.")}</p>
          <div class="card-actions">
            <button class="secondary-button" type="button" data-edit-vendor="${vendor.id}">수정</button>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderTasks(process) {
  if (!process.tasks.length) {
    els.taskList.innerHTML = `<div class="empty-state">체크할 일을 추가해두세요.</div>`;
    return;
  }

  els.taskList.innerHTML = process.tasks
    .map(
      (task) => `
        <div class="task-item ${task.done ? "done" : ""}" data-task-id="${task.id}">
          <input type="checkbox" ${task.done ? "checked" : ""} aria-label="완료" />
          <input type="text" value="${escapeHtml(task.text)}" aria-label="체크 항목" />
          <button class="icon-button" type="button" title="삭제">×</button>
        </div>
      `,
    )
    .join("");
}

function updateActiveProcess(updates) {
  const process = activeProcess();
  Object.assign(process, updates);
  saveState();
  render();
}

function openVendorDialog(vendor = null) {
  els.vendorDialogTitle.textContent = vendor ? "업체 수정" : "업체 추가";
  els.vendorId.value = vendor?.id || "";
  els.vendorName.value = vendor?.name || "";
  els.vendorContact.value = vendor?.contact || "";
  els.vendorQuote.value = vendor?.quote || "";
  els.vendorStatus.value = vendor?.status || "후보";
  els.vendorScope.value = vendor?.scope || "";
  els.vendorMemo.value = vendor?.memo || "";
  els.deleteVendorBtn.style.display = vendor ? "inline-flex" : "none";
  els.vendorDialog.showModal();
}

function openPurchaseDialog(item = null) {
  els.purchaseDialogTitle.textContent = item ? "품목 수정" : "품목 추가";
  els.purchaseId.value = item?.id || "";
  els.purchaseName.value = item?.name || "";
  els.purchaseCategory.value = item?.category || "";
  els.purchaseStatus.value = item?.status || "구매 예정";
  els.purchasePrice.value = item?.price || "";
  els.purchaseStore.value = item?.store || "";
  els.purchaseMemo.value = item?.memo || "";
  els.deletePurchaseBtn.style.display = item ? "inline-flex" : "none";
  els.purchaseDialog.showModal();
}

function wireEvents() {
  els.loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    els.loginError.textContent = "";

    const { error } = await supabaseClient.auth.signInWithPassword({
      email: els.loginEmail.value.trim(),
      password: els.loginPassword.value,
    });

    if (error) {
      els.loginError.textContent = `로그인 실패: ${error.message}`;
      return;
    }

    await loadRemoteState();
    setAuthenticatedView(true);
    render();
  });

  els.dashboardBtn.addEventListener("click", () => {
    currentView = "dashboard";
    render();
  });

  els.scheduleBtn.addEventListener("click", () => {
    currentView = "schedule";
    render();
  });

  els.purchaseBtn.addEventListener("click", () => {
    currentView = "purchase";
    render();
  });

  els.processList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-process-id]");
    if (!button) return;
    state.activeProcessId = button.dataset.processId;
    currentView = "process";
    saveState();
    render();
  });

  els.estimateTable.addEventListener("click", (event) => {
    const button = event.target.closest("[data-process-id]");
    if (!button) return;
    state.activeProcessId = button.dataset.processId;
    currentView = "process";
    saveState();
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  els.scheduleList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-process-id]");
    if (!button) return;
    state.activeProcessId = button.dataset.processId;
    currentView = "process";
    saveState();
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  els.addPurchaseBtn.addEventListener("click", () => openPurchaseDialog());

  els.purchaseList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-edit-purchase]");
    if (!button) return;
    const item = (state.purchases || []).find((entry) => entry.id === button.dataset.editPurchase);
    openPurchaseDialog(item);
  });

  els.purchaseForm.addEventListener("submit", (event) => {
    if (event.submitter?.value === "cancel") return;
    event.preventDefault();

    const item = {
      id: els.purchaseId.value || id("purchase"),
      name: els.purchaseName.value.trim(),
      category: els.purchaseCategory.value.trim(),
      status: els.purchaseStatus.value,
      price: Number(els.purchasePrice.value || 0),
      store: els.purchaseStore.value.trim(),
      memo: els.purchaseMemo.value.trim(),
    };

    state.purchases = state.purchases || [];
    const existingIndex = state.purchases.findIndex((entry) => entry.id === item.id);
    if (existingIndex >= 0) {
      state.purchases[existingIndex] = item;
    } else {
      state.purchases.push(item);
    }

    saveState();
    els.purchaseDialog.close();
    render();
  });

  els.deletePurchaseBtn.addEventListener("click", () => {
    const purchaseId = els.purchaseId.value;
    if (!purchaseId || !confirm("이 구매 품목을 삭제할까요?")) return;
    state.purchases = (state.purchases || []).filter((item) => item.id !== purchaseId);
    saveState();
    els.purchaseDialog.close();
    render();
  });

  els.addProcessBtn.addEventListener("click", () => {
    const name = prompt("추가할 공정 이름을 입력하세요.");
    if (!name?.trim()) return;

    const process = {
      id: id("process"),
      name: name.trim(),
      status: "알아보는 중",
      startDate: "",
      endDate: "",
      focus: "",
      notes: { mine: "", partner: "", decision: "" },
      tasks: [],
      vendors: [],
    };

    state.processes.push(process);
    state.activeProcessId = process.id;
    saveState();
    render();
  });

  els.processStatus.addEventListener("change", () => {
    updateActiveProcess({ status: els.processStatus.value });
  });

  els.processStartDate.addEventListener("change", () => {
    updateActiveProcess({ startDate: els.processStartDate.value });
  });

  els.processEndDate.addEventListener("change", () => {
    updateActiveProcess({ endDate: els.processEndDate.value });
  });

  els.processFocus.addEventListener("input", () => {
    activeProcess().focus = els.processFocus.value;
    saveState();
  });

  [els.myNote, els.partnerNote, els.decisionNote].forEach((textarea) => {
    textarea.addEventListener("input", () => {
      const process = activeProcess();
      process.notes = {
        mine: els.myNote.value,
        partner: els.partnerNote.value,
        decision: els.decisionNote.value,
      };
      saveState();
    });
  });

  els.addVendorBtn.addEventListener("click", () => openVendorDialog());

  els.vendorGrid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-edit-vendor]");
    if (!button) return;
    const vendor = activeProcess().vendors.find((item) => item.id === button.dataset.editVendor);
    openVendorDialog(vendor);
  });

  els.vendorForm.addEventListener("submit", (event) => {
    if (event.submitter?.value === "cancel") return;
    event.preventDefault();

    const process = activeProcess();
    const vendor = {
      id: els.vendorId.value || id("vendor"),
      name: els.vendorName.value.trim(),
      contact: els.vendorContact.value.trim(),
      quote: Number(els.vendorQuote.value || 0),
      status: els.vendorStatus.value,
      scope: els.vendorScope.value.trim(),
      memo: els.vendorMemo.value.trim(),
    };

    const existingIndex = process.vendors.findIndex((item) => item.id === vendor.id);
    if (existingIndex >= 0) {
      process.vendors[existingIndex] = vendor;
    } else {
      process.vendors.push(vendor);
    }

    saveState();
    els.vendorDialog.close();
    render();
  });

  els.deleteVendorBtn.addEventListener("click", () => {
    const vendorId = els.vendorId.value;
    if (!vendorId || !confirm("이 업체를 삭제할까요?")) return;
    const process = activeProcess();
    process.vendors = process.vendors.filter((vendor) => vendor.id !== vendorId);
    saveState();
    els.vendorDialog.close();
    render();
  });

  els.addTaskBtn.addEventListener("click", () => {
    activeProcess().tasks.push({ id: id("task"), text: "새 체크 항목", done: false });
    saveState();
    render();
  });

  els.taskList.addEventListener("change", (event) => {
    const item = event.target.closest("[data-task-id]");
    if (!item) return;
    const task = activeProcess().tasks.find((entry) => entry.id === item.dataset.taskId);
    if (!task) return;

    if (event.target.type === "checkbox") task.done = event.target.checked;
    saveState();
    renderTasks(activeProcess());
  });

  els.taskList.addEventListener("input", (event) => {
    const item = event.target.closest("[data-task-id]");
    if (!item || event.target.type !== "text") return;
    const task = activeProcess().tasks.find((entry) => entry.id === item.dataset.taskId);
    if (!task) return;
    task.text = event.target.value;
    saveState();
  });

  els.taskList.addEventListener("click", (event) => {
    if (!event.target.matches("button")) return;
    const item = event.target.closest("[data-task-id]");
    if (!item) return;
    const process = activeProcess();
    process.tasks = process.tasks.filter((task) => task.id !== item.dataset.taskId);
    saveState();
    renderTasks(process);
  });

}

boot();
