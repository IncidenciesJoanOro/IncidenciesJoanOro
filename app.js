const API_URL =
  "https://script.google.com/macros/s/AKfycbxIIODZkN9VQwntRzRIB_cXWcSDdi4DYRajxss3VBes5JacLEEvChRctJgMlIIfGOTi/exec";
const SESSION_KEY = "joan-oro-session-v3";
const DRAFT_KEY = "joan-oro-drafts-v3";
const DEMO_STORE_KEY = "joan-oro-demo-v3";
const AUTO_SAVE_IDLE_MS = 4 * 60 * 1000;
const DEMO_MODE =
  ["localhost", "127.0.0.1"].includes(window.location.hostname) ||
  new URLSearchParams(window.location.search).has("demo");
const STORED_DRAFTS = loadJson_(DRAFT_KEY, { ownerId: "", drafts: {} });

const state = {
  token: localStorage.getItem(SESSION_KEY) || "",
  user: null,
  views: [],
  dashboard: null,
  admin: null,
  drafts:
    STORED_DRAFTS.drafts && typeof STORED_DRAFTS.drafts === "object"
      ? STORED_DRAFTS.drafts
      : STORED_DRAFTS,
  draftOwnerId: STORED_DRAFTS.ownerId || "",
  quickFilter: "pending",
  search: "",
  typeFilter: "",
  openHistoryId: null,
  editingUserId: null,
  editingProfileId: null,
  workflowActions: [],
  autoSaveTimer: null,
};

const el = {
  loginView: document.querySelector("#login-view"),
  appView: document.querySelector("#app-view"),
  loginForm: document.querySelector("#login-form"),
  loginUser: document.querySelector("#login-user"),
  loginPassword: document.querySelector("#login-password"),
  loginError: document.querySelector("#login-error"),
  togglePassword: document.querySelector("#toggle-password"),
  currentUserName: document.querySelector("#current-user-name"),
  currentUserRole: document.querySelector("#current-user-role"),
  userInitials: document.querySelector("#user-initials"),
  workspaceSubtitle: document.querySelector("#workspace-subtitle"),
  profilePreview: document.querySelector("#profile-preview"),
  incidentList: document.querySelector("#incident-list"),
  emptyState: document.querySelector("#empty-state"),
  resultCount: document.querySelector("#result-count"),
  searchInput: document.querySelector("#search-input"),
  typeFilter: document.querySelector("#type-filter"),
  typeFilterLabel: document.querySelector("#type-filter-label"),
  urgentCount: document.querySelector("#urgent-count"),
  pendingCount: document.querySelector("#pending-count"),
  assignedCount: document.querySelector("#assigned-count"),
  solvedCount: document.querySelector("#solved-count"),
  saveBar: document.querySelector("#save-bar"),
  saveSummary: document.querySelector("#save-summary"),
  saveButton: document.querySelector("#save-button"),
  discardButton: document.querySelector("#discard-button"),
  logoutButton: document.querySelector("#logout-button"),
  adminButton: document.querySelector("#admin-button"),
  printButton: document.querySelector("#print-button"),
  adminDialog: document.querySelector("#admin-dialog"),
  userList: document.querySelector("#user-list"),
  userForm: document.querySelector("#user-form"),
  userFormTitle: document.querySelector("#user-form-title"),
  userFormError: document.querySelector("#user-form-error"),
  userProfilePicker: document.querySelector("#user-profile-picker"),
  saveUserButton: document.querySelector("#save-user-button"),
  newUserButton: document.querySelector("#new-user-button"),
  cancelUserButton: document.querySelector("#cancel-user-button"),
  adminUsersPanel: document.querySelector("#admin-users-panel"),
  adminProfilesPanel: document.querySelector("#admin-profiles-panel"),
  profileSettingsList: document.querySelector("#profile-settings-list"),
  restoreProfilesButton: document.querySelector("#restore-profiles-button"),
  newProfileButton: document.querySelector("#new-profile-button"),
  profileForm: document.querySelector("#profile-form"),
  profileFormTitle: document.querySelector("#profile-form-title"),
  profileFormError: document.querySelector("#profile-form-error"),
  cancelProfileButton: document.querySelector("#cancel-profile-button"),
  profileUserPicker: document.querySelector("#profile-user-picker"),
  workflowActionList: document.querySelector("#workflow-action-list"),
  addWorkflowAction: document.querySelector("#add-workflow-action"),
  printStatusField: document.querySelector("#print-status-field"),
  autosaveStatus: document.querySelector("#autosave-status"),
  connectionStatus: document.querySelector("#connection-status"),
  loadingOverlay: document.querySelector("#loading-overlay"),
  toastRegion: document.querySelector("#toast-region"),
  resetDemoButton: document.querySelector("#reset-demo-button"),
};

initialise_();

function initialise_() {
  bindEvents_();
  if (DEMO_MODE) {
    el.connectionStatus.textContent = "Mode de prova local: cap dada arriba a Sheets.";
    el.loginUser.value = "Albert";
    el.loginPassword.value = "demo";
    const note = document.querySelector(".demo-note");
    if (note) note.innerHTML = "<strong>Accés de prova</strong><span>Albert · contrasenya: demo</span>";
    el.resetDemoButton.hidden = false;
  }
  if (state.token) {
    refreshBootstrap_().catch(() => showLogin_());
  } else {
    showLogin_();
  }
}

function bindEvents_() {
  el.loginForm.addEventListener("submit", login_);
  el.togglePassword.addEventListener("click", () => {
    const reveal = el.loginPassword.type === "password";
    el.loginPassword.type = reveal ? "text" : "password";
    el.togglePassword.textContent = reveal ? "Ocultar" : "Mostrar";
  });
  el.logoutButton.addEventListener("click", logout_);
  el.adminButton.addEventListener("click", openAdmin_);
  el.profilePreview.addEventListener("change", changeView_);
  el.searchInput.addEventListener("input", () => {
    state.search = el.searchInput.value.trim().toLocaleLowerCase("ca");
    renderIncidents_();
  });
  el.typeFilter.addEventListener("change", () => {
    state.typeFilter = el.typeFilter.value;
    renderIncidents_();
  });
  el.saveButton.addEventListener("click", () => saveChanges_(false));
  el.discardButton.addEventListener("click", discardDrafts_);
  el.printButton.addEventListener("click", printCurrentBatch_);
  el.resetDemoButton.addEventListener("click", () => {
    if (!window.confirm("Vols restaurar totes les dades simulades de la prova?")) return;
    localStorage.removeItem(DEMO_STORE_KEY);
    localStorage.removeItem(DRAFT_KEY);
    localStorage.removeItem(SESSION_KEY);
    window.location.reload();
  });
  el.incidentList.addEventListener("input", incidentFieldChanged_);
  el.incidentList.addEventListener("change", incidentFieldChanged_);
  el.incidentList.addEventListener("click", incidentListClicked_);

  document.querySelectorAll(".filter-chip").forEach((button) => {
    button.addEventListener("click", () => {
      state.quickFilter = button.dataset.quickFilter;
      document.querySelectorAll(".filter-chip").forEach((item) => {
        item.classList.toggle("active", item === button);
      });
      renderIncidents_();
    });
  });
  document.querySelectorAll("[data-close-dialog]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelector(`#${button.dataset.closeDialog}`).close();
    });
  });
  document.querySelectorAll(".admin-tab").forEach((button) => {
    button.addEventListener("click", () => selectAdminTab_(button.dataset.adminTab));
  });

  el.newUserButton.addEventListener("click", () => openUserForm_());
  el.cancelUserButton.addEventListener("click", closeUserForm_);
  el.userForm.addEventListener("submit", saveUser_);
  el.userList.addEventListener("click", userListClicked_);
  el.userForm.elements.viewMode.addEventListener("change", updateUserProfilePickerVisibility_);

  el.newProfileButton.addEventListener("click", () => openProfileForm_());
  el.cancelProfileButton.addEventListener("click", closeProfileForm_);
  el.profileForm.addEventListener("submit", saveProfile_);
  el.profileSettingsList.addEventListener("click", profileListClicked_);
  el.addWorkflowAction.addEventListener("click", () => {
    state.workflowActions.push({
      id: "",
      label: "",
      kind: "stay",
      targetProfileId: "",
      state: "",
    });
    renderWorkflowActions_();
  });
  el.workflowActionList.addEventListener("input", workflowActionChanged_);
  el.workflowActionList.addEventListener("change", workflowActionChanged_);
  el.workflowActionList.addEventListener("click", workflowActionClicked_);
  el.profileForm.elements.canPrint.addEventListener("change", () => {
    el.printStatusField.hidden = !el.profileForm.elements.canPrint.checked;
  });
  el.restoreProfilesButton.hidden = true;

  document.addEventListener("mousemove", noteActivity_, { passive: true });
  document.addEventListener("keydown", noteActivity_);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && hasDrafts_()) {
      saveChanges_(true, true).catch(() => {});
    }
  });
}

async function login_(event) {
  event.preventDefault();
  el.loginError.textContent = "";
  setLoading_(true);
  try {
    const response = await api_("login", {
      username: el.loginUser.value.trim(),
      password: el.loginPassword.value,
    });
    state.token = response.token;
    localStorage.setItem(SESSION_KEY, state.token);
    applyBootstrap_(response);
    showWorkspace_();
  } catch (error) {
    el.loginError.textContent = error.message;
  } finally {
    setLoading_(false);
  }
}

async function refreshBootstrap_(viewKey) {
  setLoading_(true);
  try {
    const response = await api_("bootstrap", { viewKey });
    applyBootstrap_(response);
    showWorkspace_();
  } catch (error) {
    state.token = "";
    localStorage.removeItem(SESSION_KEY);
    throw error;
  } finally {
    setLoading_(false);
  }
}

function applyBootstrap_(response) {
  if (hasDrafts_() && state.draftOwnerId !== response.user.id) {
    state.drafts = {};
  }
  state.user = response.user;
  state.draftOwnerId = response.user.id;
  state.views = response.views || [];
  state.dashboard = response.dashboard;
  removeDraftsNotInDashboard_();
  persistDrafts_();
}

function showLogin_() {
  el.appView.hidden = true;
  el.loginView.hidden = false;
  el.loginUser.focus();
}

function showWorkspace_() {
  if (!state.user || !state.dashboard) return showLogin_();
  el.loginView.hidden = true;
  el.appView.hidden = false;
  el.currentUserName.textContent = state.user.fullName || state.user.username;
  el.currentUserRole.textContent =
    state.user.permission === "SUPER"
      ? `SUPER · ${state.user.team}`
      : `${state.user.team} · ${viewModeLabel_(state.user.viewMode)}`;
  el.userInitials.textContent = initials_(state.user.fullName || state.user.username);
  el.adminButton.hidden = !state.user.canAdmin;
  el.profilePreview.innerHTML = state.views
    .map(
      (view) =>
        `<option value="${escapeAttribute_(view.key)}">${escapeHtml_(view.label)}</option>`,
    )
    .join("");
  el.profilePreview.value = state.dashboard.viewKey;
  el.profilePreview.closest("label").hidden = state.views.length <= 1;
  renderDashboard_();
  if (hasDrafts_()) scheduleAutoSave_();
}

async function changeView_() {
  if (hasDrafts_()) {
    const save = window.confirm(
      "Hi ha canvis pendents. Vols guardar-los abans de canviar de perfil?",
    );
    if (save) await saveChanges_(false);
    else discardDrafts_();
  }
  setLoading_(true);
  try {
    const response = await api_("dashboard", { viewKey: el.profilePreview.value });
    applyBootstrap_(response);
    state.search = "";
    state.typeFilter = "";
    el.searchInput.value = "";
    el.typeFilter.value = "";
    renderDashboard_();
  } catch (error) {
    toast_(error.message, true);
  } finally {
    setLoading_(false);
  }
}

function renderDashboard_() {
  const dashboard = state.dashboard;
  el.workspaceSubtitle.textContent = `Vista: ${dashboard.viewLabel}.`;
  el.urgentCount.textContent = dashboard.summary.urgent;
  el.pendingCount.textContent = dashboard.summary.pending;
  el.assignedCount.textContent = dashboard.summary.assigned;
  el.solvedCount.textContent = dashboard.summary.closed;
  el.typeFilterLabel.hidden = !dashboard.canEditType;
  el.printButton.hidden = !dashboard.printConfig.enabled;
  if (dashboard.printConfig.enabled) {
    el.printButton.textContent = dashboard.printConfig.label;
  }
  renderIncidents_();
  updateSaveBar_();
}

function filteredIncidents_() {
  const incidents = state.dashboard.incidents || [];
  return incidents.filter((incident) => {
    const matchesSearch =
      !state.search ||
      [incident.space, incident.group, incident.description, incident.comment, incident.status]
        .join(" ")
        .toLocaleLowerCase("ca")
        .includes(state.search);
    const matchesType = !state.typeFilter || incident.type === state.typeFilter;
    const matchesQuick =
      state.quickFilter === "all" ||
      (state.quickFilter === "urgent" && incident.priority === "Urgent") ||
      (state.quickFilter === "pending" &&
        !["Solucionat", "Descartar", "Descartat", "Pagat"].includes(incident.status));
    return matchesSearch && matchesType && matchesQuick;
  });
}

function renderIncidents_() {
  if (!state.dashboard) return;
  const incidents = filteredIncidents_();
  el.resultCount.textContent =
    incidents.length === 1 ? "1 incidència" : `${incidents.length} incidències`;
  el.emptyState.hidden = incidents.length > 0;
  if (!incidents.length) {
    el.incidentList.innerHTML = "";
    return;
  }
  const sections = [];
  incidents.forEach((incident) => {
    let section = sections.find((item) => item.name === incident.section);
    if (!section) {
      section = { name: incident.section || "Incidències", incidents: [] };
      sections.push(section);
    }
    section.incidents.push(incident);
  });
  el.incidentList.innerHTML = sections
    .map(
      (section) => `
        <section class="incident-section">
          <div class="section-heading">
            <h3>${escapeHtml_(section.name)}</h3>
            <span>${section.incidents.length}</span>
          </div>
          ${section.incidents.map(renderIncidentCard_).join("")}
        </section>
      `,
    )
    .join("");
}

function renderIncidentCard_(incident) {
  const draft = { ...incident, ...(state.drafts[incident.id] || {}) };
  const changed = Boolean(state.drafts[incident.id]);
  const currentAction = state.drafts[incident.id]?.actionId || "";
  const historyOpen = state.openHistoryId === incident.id;
  return `
    <article class="incident-card ${changed ? "changed" : ""}" data-incident-id="${escapeAttribute_(
      incident.id,
    )}">
      <div class="incident-main">
        <div class="incident-badges">
          <span class="badge priority-${escapeClass_(draft.priority)}">${escapeHtml_(
            draft.priority || "Normal",
          )}</span>
          <span class="badge">${escapeHtml_(draft.type || "Sense tipus")}</span>
          <span class="badge">${escapeHtml_(incident.status || "Pendent")}</span>
        </div>
        <h3 class="incident-location">${escapeHtml_(incident.space || "Sense espai")}</h3>
        <p class="incident-group">${escapeHtml_(incident.group || "Sense grup")}</p>
        <p class="incident-description">${safeDescription_(incident.description)}</p>
        <div class="incident-meta">
          <span>ID ${escapeHtml_(incident.id)}</span>
          <span>Equip: ${escapeHtml_(incident.team)}</span>
          ${
            incident.derivedAt
              ? `<span>Enviada: ${escapeHtml_(formatDateTime_(incident.derivedAt))}</span>`
              : ""
          }
          <button class="history-button" type="button" data-history-id="${escapeAttribute_(
            incident.id,
          )}">
            ${historyOpen ? "Ocultar historial" : "Veure historial"}
          </button>
        </div>
      </div>
      <div class="incident-controls">
        <label>
          Prioritat
          <select data-field="priority">
            ${selectOptions_(["Baixa", "Normal", "Urgent"], draft.priority)}
          </select>
        </label>
        ${
          state.dashboard.canEditType
            ? `<label>
                Tipus
                <input data-field="type" value="${escapeAttribute_(draft.type)}" />
              </label>`
            : ""
        }
        ${
          state.dashboard.actions.length
            ? `<label>
                Acció / assignació
                <select data-field="actionId">
                  <option value="">Sense canvis</option>
                  ${state.dashboard.actions
                    .map(
                      (action) =>
                        `<option value="${escapeAttribute_(action.id)}" ${
                          action.id === currentAction ? "selected" : ""
                        }>${escapeHtml_(action.label)}</option>`,
                    )
                    .join("")}
                </select>
              </label>`
            : ""
        }
        <label class="comment-field">
          Comentari
          <textarea data-field="comment" placeholder="Què s’ha fet o per què es reassigna?">${escapeHtml_(
            draft.comment || "",
          )}</textarea>
        </label>
        ${currentAction ? `<div class="route-preview">${escapeHtml_(actionPreview_(currentAction))}</div>` : ""}
      </div>
      ${historyOpen ? renderHistory_(incident.history || []) : ""}
    </article>
  `;
}

function renderHistory_(history) {
  if (!history.length) {
    return `<div class="history-panel"><p class="muted">Encara no hi ha moviments registrats.</p></div>`;
  }
  return `
    <div class="history-panel">
      <h4>Traçabilitat de la incidència</h4>
      <ol class="timeline">
        ${[...history]
          .reverse()
          .map(
            (entry) => `
              <li>
                <time>${escapeHtml_(formatDateTime_(entry.date))}</time>
                <strong>${escapeHtml_(entry.user || "Sistema")}</strong>
                <span>${escapeHtml_(
                  [entry.action, entry.comment].filter(Boolean).join(" · ") || "Modificació",
                )}</span>
              </li>
            `,
          )
          .join("")}
      </ol>
    </div>
  `;
}

function incidentFieldChanged_(event) {
  const field = event.target.dataset.field;
  if (!field) return;
  const card = event.target.closest("[data-incident-id]");
  const incident = state.dashboard.incidents.find(
    (item) => item.id === card.dataset.incidentId,
  );
  if (!incident) return;
  const next = { ...(state.drafts[incident.id] || {}), [field]: event.target.value };
  const comparable = {
    priority: incident.priority,
    type: incident.type,
    comment: incident.comment || "",
    actionId: "",
  };
  Object.keys(next).forEach((key) => {
    if (String(next[key] ?? "") === String(comparable[key] ?? "")) delete next[key];
  });
  if (Object.keys(next).length) state.drafts[incident.id] = next;
  else delete state.drafts[incident.id];
  persistDrafts_();
  if (hasDrafts_()) scheduleAutoSave_();
  else clearAutoSave_();
  if (field === "comment" || field === "type") {
    card.classList.toggle("changed", Boolean(state.drafts[incident.id]));
  } else {
    renderIncidents_();
  }
  updateSaveBar_();
}

function incidentListClicked_(event) {
  const historyButton = event.target.closest("[data-history-id]");
  if (!historyButton) return;
  state.openHistoryId =
    state.openHistoryId === historyButton.dataset.historyId
      ? null
      : historyButton.dataset.historyId;
  renderIncidents_();
}

function actionPreview_(actionId) {
  const action = state.dashboard.actions.find((item) => item.id === actionId);
  if (!action) return "";
  if (action.kind === "close") {
    return "Desapareixerà de les cues i quedarà guardada en l’històric.";
  }
  if (action.kind === "route") return "Passarà automàticament al perfil de destinació.";
  if (action.kind === "assign") return "Quedarà assignada al responsable seleccionat.";
  return "Continuarà visible en aquest perfil.";
}

async function saveChanges_(automatic = false, keepalive = false) {
  const changes = Object.entries(state.drafts).map(([id, draft]) => ({ id, ...draft }));
  if (!changes.length) return;
  if (!keepalive) setLoading_(true);
  try {
    const response = await api_(
      "saveIncidents",
      { viewKey: state.dashboard.viewKey, changes },
      { keepalive },
    );
    state.dashboard = response.dashboard;
    state.views = response.views || state.views;
    state.drafts = {};
    persistDrafts_();
    clearAutoSave_();
    renderDashboard_();
    toast_(
      `${automatic ? "Desament automàtic: " : ""}${response.saved} incidència${
        response.saved === 1 ? "" : "s"
      } actualitzada${response.saved === 1 ? "" : "es"}.`,
    );
  } catch (error) {
    el.connectionStatus.textContent =
      "Sense connexió: els canvis continuen protegits en aquest ordinador.";
    if (!keepalive) toast_(error.message, true);
    throw error;
  } finally {
    if (!keepalive) setLoading_(false);
  }
}

function discardDrafts_() {
  state.drafts = {};
  persistDrafts_();
  clearAutoSave_();
  renderIncidents_();
  updateSaveBar_();
  toast_("S’han descartat els canvis pendents.");
}

function updateSaveBar_() {
  const count = Object.keys(state.drafts).length;
  el.saveBar.hidden = count === 0;
  el.saveSummary.textContent = `${count} incidència${count === 1 ? "" : "s"} amb canvis`;
  el.saveButton.textContent = `Desar ${count} canvi${count === 1 ? "" : "s"}`;
}

function noteActivity_() {
  if (hasDrafts_()) scheduleAutoSave_();
}

function scheduleAutoSave_() {
  window.clearTimeout(state.autoSaveTimer);
  state.autoSaveTimer = window.setTimeout(() => {
    saveChanges_(true).catch(() => {});
  }, AUTO_SAVE_IDLE_MS);
  el.autosaveStatus.textContent =
    "Canvis protegits localment · desament al sistema després de 4 minuts d’inactivitat.";
}

function clearAutoSave_() {
  window.clearTimeout(state.autoSaveTimer);
  state.autoSaveTimer = null;
  el.autosaveStatus.textContent = "Desament automàtic activat · només guarda canvis reals.";
  if (!DEMO_MODE) el.connectionStatus.textContent = "Connectat amb el full del centre.";
}

async function logout_() {
  if (hasDrafts_()) {
    try {
      await saveChanges_(true);
    } catch (error) {
      if (!window.confirm("No s’han pogut enviar els canvis. Vols tancar la sessió igualment?")) {
        return;
      }
    }
  }
  state.token = "";
  state.user = null;
  state.dashboard = null;
  localStorage.removeItem(SESSION_KEY);
  showLogin_();
}

async function openAdmin_() {
  setLoading_(true);
  try {
    state.admin = await api_("adminGet");
    closeUserForm_();
    closeProfileForm_();
    selectAdminTab_("users");
    renderUsers_();
    renderProfiles_();
    el.adminDialog.showModal();
  } catch (error) {
    toast_(error.message, true);
  } finally {
    setLoading_(false);
  }
}

function selectAdminTab_(tab) {
  document.querySelectorAll(".admin-tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.adminTab === tab);
  });
  el.adminUsersPanel.hidden = tab !== "users";
  el.adminProfilesPanel.hidden = tab !== "profiles";
}

function renderUsers_() {
  el.userList.innerHTML = state.admin.users
    .map(
      (user) => `
        <article class="user-row" data-user-id="${escapeAttribute_(user.id)}">
          <div class="user-identity">
            <span class="small-avatar">${escapeHtml_(initials_(user.fullName || user.username))}</span>
            <span>
              <strong>${escapeHtml_(user.fullName || user.username)}</strong>
              <span>${escapeHtml_(user.username)}${
                user.email ? ` · ${escapeHtml_(user.email)}` : ""
              }</span>
            </span>
          </div>
          <div class="user-detail">
            <strong>${escapeHtml_(user.permission)}</strong>
            <span>${escapeHtml_(user.team)} · ${escapeHtml_(viewModeLabel_(user.viewMode))}</span>
          </div>
          <div class="password-admin">
            <span data-password-value="${escapeAttribute_(user.id)}">••••••••</span>
            <button class="text-button compact" data-show-password="${escapeAttribute_(
              user.id,
            )}" type="button">Mostrar</button>
          </div>
          <span class="status-pill ${user.active ? "active" : "inactive"}">${
            user.active ? "Actiu" : "Inactiu"
          }</span>
          <button class="ghost-button compact" data-edit-user="${escapeAttribute_(
            user.id,
          )}" type="button">Editar</button>
        </article>
      `,
    )
    .join("");
}

function userListClicked_(event) {
  const show = event.target.closest("[data-show-password]");
  if (show) {
    const user = state.admin.users.find((item) => item.id === show.dataset.showPassword);
    const value = el.userList.querySelector(
      `[data-password-value="${cssEscape_(show.dataset.showPassword)}"]`,
    );
    const visible = show.textContent.trim() === "Ocultar";
    value.textContent = visible ? "••••••••" : user.password;
    show.textContent = visible ? "Mostrar" : "Ocultar";
    return;
  }
  const edit = event.target.closest("[data-edit-user]");
  if (edit) openUserForm_(edit.dataset.editUser);
}

function openUserForm_(userId = null) {
  const user = state.admin.users.find((item) => item.id === userId);
  state.editingUserId = user?.id || null;
  el.userForm.reset();
  el.userFormTitle.textContent = user ? `Modificar ${user.fullName || user.username}` : "Afegir accés";
  el.saveUserButton.textContent = user ? "Guardar modificacions" : "Crear usuari";
  el.userForm.elements.username.value = user?.username || "";
  el.userForm.elements.password.value = "";
  el.userForm.elements.fullName.value = user?.fullName || "";
  el.userForm.elements.email.value = user?.email || "";
  el.userForm.elements.permission.value = user?.permission || "NORMAL";
  el.userForm.elements.team.value = user?.team || "Coordinació";
  el.userForm.elements.viewMode.value = user?.viewMode || "Compartida";
  el.userForm.elements.assignment.value = user?.assignment || "";
  el.userForm.elements.active.checked = user ? user.active : true;
  el.userForm.elements.permission.disabled = !state.admin.canManageProfiles;
  el.userProfilePicker.querySelector("div").innerHTML = state.admin.profiles
    .filter((profile) => profile.active)
    .map(
      (profile) => `
        <label>
          <input type="checkbox" name="profileId" value="${escapeAttribute_(profile.id)}" ${
            user?.profileIds.includes(profile.id) ? "checked" : ""
          } />
          ${escapeHtml_(profile.name)}
        </label>
      `,
    )
    .join("");
  updateUserProfilePickerVisibility_();
  el.userFormError.textContent = "";
  el.userForm.hidden = false;
  el.newUserButton.hidden = true;
  el.userForm.elements.username.focus();
}

function closeUserForm_() {
  state.editingUserId = null;
  el.userForm.reset();
  el.userForm.hidden = true;
  el.newUserButton.hidden = false;
  el.userFormError.textContent = "";
}

function updateUserProfilePickerVisibility_() {
  el.userProfilePicker.hidden = el.userForm.elements.viewMode.value !== "Perfils";
}

async function saveUser_(event) {
  event.preventDefault();
  const form = new FormData(el.userForm);
  const current = state.admin.users.find((item) => item.id === state.editingUserId);
  const user = {
    id: state.editingUserId || "",
    username: String(form.get("username") || "").trim(),
    password: String(form.get("password") || ""),
    fullName: String(form.get("fullName") || "").trim(),
    email: String(form.get("email") || "").trim(),
    permission: String(form.get("permission") || current?.permission || "NORMAL"),
    team: String(form.get("team") || "Coordinació"),
    viewMode: String(form.get("viewMode") || "Compartida"),
    assignment: String(form.get("assignment") || "").trim(),
    profileIds: form.getAll("profileId").map(String),
    active: el.userForm.elements.active.checked,
  };
  if (!user.username || !user.assignment) {
    el.userFormError.textContent = "L’usuari i el nom d’assignació són obligatoris.";
    return;
  }
  if (!current && !user.password) {
    el.userFormError.textContent = "La contrasenya és obligatòria per a un usuari nou.";
    return;
  }
  setLoading_(true);
  try {
    state.admin = await api_("saveUser", { user });
    closeUserForm_();
    renderUsers_();
    renderProfiles_();
    toast_("Usuari guardat correctament.");
  } catch (error) {
    if (/Tria un substitut/i.test(error.message)) {
      const replacement = window.prompt(
        `${error.message}\n\nEscriu el nom d’assignació del substitut:`,
      );
      if (replacement) {
        try {
          state.admin = await api_("saveUser", {
            user: { ...user, replacementAssignment: replacement.trim() },
          });
          closeUserForm_();
          renderUsers_();
          renderProfiles_();
          toast_("Usuari desactivat i tasques reassignades.");
          return;
        } catch (retryError) {
          el.userFormError.textContent = retryError.message;
        }
      }
    } else {
      el.userFormError.textContent = error.message;
    }
  } finally {
    setLoading_(false);
  }
}

function renderProfiles_() {
  el.newProfileButton.hidden = !state.admin.canManageProfiles;
  el.profileSettingsList.innerHTML = state.admin.profiles
    .filter((profile) => profile.active)
    .map((profile) => {
      const users = state.admin.users.filter((user) => {
        if (profile.id === "coordinacio") {
          return user.active && user.team === "Coordinació" && user.viewMode === "Compartida";
        }
        return user.active && user.profileIds.includes(profile.id);
      });
      const actions = state.admin.actions
        .filter((action) => action.profileId === profile.id && action.active !== false)
        .sort((a, b) => a.order - b.order);
      return `
        <article class="profile-setting workflow-card" data-profile-id="${escapeAttribute_(
          profile.id,
        )}">
          <div class="profile-setting-header">
            <div>
              <div class="workflow-title-line">
                <h4>${escapeHtml_(profile.name)}</h4>
                <span class="team-badge">${escapeHtml_(profile.team)}</span>
              </div>
              <p><strong>Rep:</strong> ${escapeHtml_(profile.entry || "Incidències sense assignar")}</p>
            </div>
            ${
              state.admin.canManageProfiles
                ? `<button class="ghost-button compact" data-edit-profile="${escapeAttribute_(
                    profile.id,
                  )}" type="button">Modificar</button>`
                : ""
            }
          </div>
          <div class="workflow-meta">
            <span><strong>Membres:</strong> ${
              users.length
                ? escapeHtml_(
                    users
                      .map((user) =>
                        user.username === "Quim"
                          ? `${user.fullName || "Joaquim"} (usuari Quim)`
                          : user.fullName || user.username,
                      )
                      .join(", "),
                  )
                : "Cap usuari assignat"
            }</span>
            <span><strong>Continua visible:</strong> ${escapeHtml_(
              profile.visibleStates.map((value) => value || "Pendent").join(", "),
            )}</span>
          </div>
          <div class="option-chips">
            ${actions
              .map((action) => {
                const target = state.admin.profiles.find(
                  (item) => item.id === action.targetProfileId,
                );
                const suffix =
                  action.kind === "route"
                    ? ` → ${target?.name || "perfil"}`
                    : action.kind === "close"
                      ? " · tanca"
                      : " · continua";
                return `<span class="option-chip action-${escapeClass_(
                  action.kind,
                )}">${escapeHtml_(action.label + suffix)}</span>`;
              })
              .join("")}
          </div>
        </article>
      `;
    })
    .join("");
}

function profileListClicked_(event) {
  const button = event.target.closest("[data-edit-profile]");
  if (button) openProfileForm_(button.dataset.editProfile);
}

function openProfileForm_(profileId = null) {
  const profile = state.admin.profiles.find((item) => item.id === profileId);
  state.editingProfileId = profile?.id || null;
  state.workflowActions = clone_(
    profile
      ? state.admin.actions.filter((action) => action.profileId === profile.id)
      : [
          { id: "", label: "Procés", kind: "stay", targetProfileId: "", state: "Procés" },
          {
            id: "",
            label: "Solucionat",
            kind: "close",
            targetProfileId: "",
            state: "Solucionat",
          },
          {
            id: "",
            label: "Descartat",
            kind: "close",
            targetProfileId: "",
            state: "Descartat",
          },
        ],
  );
  el.profileForm.reset();
  el.profileFormTitle.textContent = profile ? `Modificar ${profile.name}` : "Crear perfil";
  el.profileForm.elements.name.value = profile?.name || "";
  el.profileForm.elements.team.value = profile?.team || "Coordinació";
  el.profileForm.elements.entry.value = profile?.entry || "";
  el.profileForm.elements.canPrint.checked = Boolean(profile?.canPrint);
  el.profileForm.elements.printStatus.value = profile?.printStatus || "";
  el.printStatusField.hidden = !profile?.canPrint;
  el.profileUserPicker.innerHTML = state.admin.users
    .filter((user) => user.active)
    .map(
      (user) => `
        <label>
          <input type="checkbox" name="viewer" value="${escapeAttribute_(user.id)}" ${
            user.profileIds.includes(profile?.id) ? "checked" : ""
          } />
          ${escapeHtml_(user.fullName || user.username)}
        </label>
      `,
    )
    .join("");
  renderWorkflowActions_();
  el.profileFormError.textContent = "";
  el.profileForm.hidden = false;
  el.profileSettingsList.hidden = true;
  el.newProfileButton.hidden = true;
  el.profileForm.elements.name.focus();
}

function closeProfileForm_() {
  state.editingProfileId = null;
  state.workflowActions = [];
  el.profileForm.hidden = true;
  el.profileSettingsList.hidden = false;
  el.newProfileButton.hidden = !state.admin?.canManageProfiles;
  el.profileFormError.textContent = "";
}

function renderWorkflowActions_() {
  const destinations = state.admin.profiles
    .filter((profile) => profile.active && profile.id !== state.editingProfileId)
    .map(
      (profile) =>
        `<option value="${escapeAttribute_(profile.id)}">${escapeHtml_(
          `${profile.name} · ${profile.team}`,
        )}</option>`,
    )
    .join("");
  el.workflowActionList.innerHTML = state.workflowActions
    .map(
      (action, index) => `
        <div class="workflow-action-row" data-action-index="${index}">
          <input data-action-field="label" aria-label="Nom de l’acció" placeholder="Nom de l’acció"
            value="${escapeAttribute_(action.label || "")}" />
          <select data-action-field="kind" aria-label="Resultat de l’acció">
            <option value="stay" ${action.kind === "stay" ? "selected" : ""}>Continua en aquest perfil</option>
            <option value="route" ${action.kind === "route" ? "selected" : ""}>Envia a un altre perfil</option>
            <option value="close" ${action.kind === "close" ? "selected" : ""}>Tanca i passa a l’històric</option>
          </select>
          <select data-action-field="targetProfileId" aria-label="Perfil de destinació" ${
            action.kind === "route" ? "" : "hidden"
          }>
            <option value="">Tria el perfil de destinació</option>
            ${destinations}
          </select>
          <button class="icon-button small" data-remove-action="${index}" type="button" aria-label="Llevar acció">×</button>
        </div>
      `,
    )
    .join("");
  state.workflowActions.forEach((action, index) => {
    const select = el.workflowActionList.querySelector(
      `[data-action-index="${index}"] [data-action-field="targetProfileId"]`,
    );
    if (select && action.targetProfileId) select.value = action.targetProfileId;
  });
}

function workflowActionChanged_(event) {
  const field = event.target.dataset.actionField;
  if (!field) return;
  const row = event.target.closest("[data-action-index]");
  const action = state.workflowActions[Number(row.dataset.actionIndex)];
  action[field] = event.target.value;
  if (field === "label" && (!action.state || action.state === action.previousLabel)) {
    action.state = event.target.value;
  }
  if (field === "kind" && action.kind !== "route") action.targetProfileId = "";
  action.previousLabel = action.label;
  if (field === "kind") renderWorkflowActions_();
}

function workflowActionClicked_(event) {
  const button = event.target.closest("[data-remove-action]");
  if (!button) return;
  state.workflowActions.splice(Number(button.dataset.removeAction), 1);
  renderWorkflowActions_();
}

async function saveProfile_(event) {
  event.preventDefault();
  const form = new FormData(el.profileForm);
  const profile = {
    id: state.editingProfileId || "",
    name: String(form.get("name") || "").trim(),
    team: String(form.get("team") || ""),
    entry: String(form.get("entry") || "").trim(),
    canPrint: el.profileForm.elements.canPrint.checked,
    printStatus: String(form.get("printStatus") || "").trim(),
    active: true,
  };
  const userIds = form.getAll("viewer").map(String);
  const actions = state.workflowActions
    .map((action, index) => ({
      id: action.id || "",
      label: String(action.label || "").trim(),
      kind: action.kind,
      targetProfileId: action.kind === "route" ? action.targetProfileId : "",
      state: String(action.state || action.label || "").trim(),
      typeValue: "__KEEP__",
      teamValue: "",
      order: index + 1,
      active: true,
    }))
    .filter((action) => action.label);
  if (!profile.name || !profile.team || (!profile.entry && !profile.id)) {
    el.profileFormError.textContent = "Completa el nom, l’equip i què rep.";
    return;
  }
  if (!userIds.length) {
    el.profileFormError.textContent = "Assigna almenys un usuari.";
    return;
  }
  if (actions.some((action) => action.kind === "route" && !action.targetProfileId)) {
    el.profileFormError.textContent =
      "Cada acció d’enviament necessita un perfil de destinació existent.";
    return;
  }
  if (
    state.editingProfileId &&
    !window.confirm(
      "Modificar el recorregut pot canviar qui veu les incidències actuals. Vols continuar?",
    )
  ) {
    return;
  }
  setLoading_(true);
  try {
    state.admin = await api_("saveProfile", { profile, actions, userIds });
    closeProfileForm_();
    renderUsers_();
    renderProfiles_();
    const refreshed = await api_("bootstrap", { viewKey: state.dashboard.viewKey });
    applyBootstrap_(refreshed);
    renderDashboard_();
    toast_(`${profile.name} s’ha guardat i està vinculat a ${profile.team}.`);
  } catch (error) {
    el.profileFormError.textContent = error.message;
  } finally {
    setLoading_(false);
  }
}

async function printCurrentBatch_() {
  const config = state.dashboard.printConfig;
  const incidents = state.dashboard.incidents.filter(
    (incident) => incident.status === config.sourceStatus,
  );
  if (!incidents.length) {
    toast_("No hi ha incidències aprovades pendents d’imprimir.", true);
    return;
  }
  const popup = window.open("", "_blank");
  if (!popup) {
    toast_("El navegador ha bloquejat la finestra d’impressió.", true);
    return;
  }
  popup.opener = null;
  popup.document.write(printDocument_(incidents, state.dashboard.viewLabel));
  popup.document.close();
  await waitForPrintImages_(popup.document);
  popup.focus();
  popup.print();
  const confirmed = window.confirm(
    `S’ha preparat el document amb ${incidents.length} incidència${
      incidents.length === 1 ? "" : "s"
    }. Vols marcar-les com a impreses i passar-les a ${config.targetStatus}?`,
  );
  if (!confirmed) return;
  setLoading_(true);
  try {
    const response = await api_("printBatch", {
      viewKey: state.dashboard.viewKey,
      ids: incidents.map((incident) => incident.id),
    });
    applyBootstrap_(response);
    renderDashboard_();
    toast_(`${response.saved} incidència${response.saved === 1 ? "" : "s"} passada a procés.`);
  } catch (error) {
    toast_(error.message, true);
  } finally {
    setLoading_(false);
  }
}

function printDocument_(incidents, title) {
  return `<!doctype html>
    <html lang="ca"><head><meta charset="utf-8"><title>${escapeHtml_(
      title,
    )}</title><style>
      body{font-family:Arial,sans-serif;color:#1e2327;margin:24px}
      header{border-bottom:4px solid #c4140f;margin-bottom:20px;padding-bottom:12px}
      h1{font-size:22px;margin:0} small{color:#62686d}
      article{break-inside:avoid;border:1px solid #cfd3d6;border-radius:8px;margin:0 0 14px;padding:14px}
      .top{display:flex;justify-content:space-between;gap:12px}
      .priority{font-weight:700;color:#c4140f}
      h2{font-size:17px;margin:8px 0 3px}
      p{margin:5px 0;line-height:1.4}.comment{background:#f2f3f4;padding:9px;border-radius:6px}
      .incident-image-link{display:block;margin-top:10px}
      .incident-image{display:block;max-width:100%;max-height:95mm;object-fit:contain;border:1px solid #d7dadd;border-radius:6px}
      @page{size:A4;margin:14mm}
    </style></head><body>
      <header><h1>${escapeHtml_(title)} · Institut Joan Oró</h1>
      <small>Document generat el ${escapeHtml_(formatDateTime_(new Date()))}</small></header>
      ${incidents
        .map(
          (incident) => `<article>
            <div class="top"><strong>ID ${escapeHtml_(incident.id)}</strong>
              <span class="priority">${escapeHtml_(incident.priority)}</span></div>
            <h2>${escapeHtml_(incident.space || "Sense espai")}</h2>
            <p><strong>Grup:</strong> ${escapeHtml_(incident.group || "Sense grup")}</p>
            <p>${safeDescription_(incident.description)}</p>
            <p class="comment"><strong>Observacions:</strong> ${escapeHtml_(
              incident.comment || "—",
            )}</p>
          </article>`,
        )
        .join("")}
    </body></html>`;
}

function waitForPrintImages_(document, timeoutMs = 6000) {
  const images = [...document.images].filter((image) => !image.complete);
  if (!images.length) return Promise.resolve();
  const loaded = Promise.all(
    images.map(
      (image) =>
        new Promise((resolve) => {
          image.addEventListener("load", resolve, { once: true });
          image.addEventListener("error", resolve, { once: true });
        }),
    ),
  );
  const timeout = new Promise((resolve) => window.setTimeout(resolve, timeoutMs));
  return Promise.race([loaded, timeout]);
}

async function api_(action, payload = {}, options = {}) {
  if (DEMO_MODE) return demoApi_(action, payload);
  const response = await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({ action, token: state.token, ...payload }),
    keepalive: Boolean(options.keepalive),
  });
  if (!response.ok) throw new Error("No s’ha pogut contactar amb Apps Script.");
  const data = await response.json();
  if (!data.ok) throw new Error(data.error || "S’ha produït un error.");
  return data;
}

function setLoading_(loading) {
  el.loadingOverlay.hidden = !loading;
}

function toast_(message, error = false) {
  const node = document.createElement("div");
  node.className = `toast ${error ? "error" : ""}`;
  node.textContent = message;
  el.toastRegion.appendChild(node);
  window.setTimeout(() => node.remove(), 4200);
}

function hasDrafts_() {
  return Object.keys(state.drafts).length > 0;
}

function persistDrafts_() {
  if (hasDrafts_()) {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      ownerId: state.user?.id || state.draftOwnerId || "",
      drafts: state.drafts,
    }));
  }
  else localStorage.removeItem(DRAFT_KEY);
}

function removeDraftsNotInDashboard_() {
  const ids = new Set((state.dashboard?.incidents || []).map((item) => item.id));
  Object.keys(state.drafts).forEach((id) => {
    if (!ids.has(id)) delete state.drafts[id];
  });
  persistDrafts_();
}

function selectOptions_(values, selected) {
  return values
    .map(
      (value) =>
        `<option value="${escapeAttribute_(value)}" ${
          value === selected ? "selected" : ""
        }>${escapeHtml_(value)}</option>`,
    )
    .join("");
}

function safeDescription_(value) {
  const source = String(value || "");
  const imagePattern = /<img\b[^>]*>/gi;
  const fragments = [];
  let cursor = 0;
  let match;

  while ((match = imagePattern.exec(source))) {
    fragments.push(formatDescriptionText_(source.slice(cursor, match.index)));
    const imageUrl = safeLegacyImageUrl_(match[0]);
    fragments.push(
      imageUrl
        ? `<a class="incident-image-link" href="${escapeAttribute_(
            imageUrl,
          )}" target="_blank" rel="noopener noreferrer" aria-label="Obrir la imatge adjunta">
             <img class="incident-image" src="${escapeAttribute_(
               imageUrl,
             )}" alt="Imatge adjunta a la incidència">
           </a>`
        : formatDescriptionText_(match[0]),
    );
    cursor = imagePattern.lastIndex;
  }

  fragments.push(formatDescriptionText_(source.slice(cursor)));
  return fragments.join("");
}

function formatDescriptionText_(value) {
  return escapeHtml_(value)
    .replace(/&lt;\/?br\s*\/?&gt;/gi, "<br>")
    .replace(/\r?\n/g, "<br>");
}

function safeLegacyImageUrl_(imageTag) {
  const sourceMatch = String(imageTag).match(
    /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>`]+))/i,
  );
  const rawUrl = (sourceMatch?.[1] || sourceMatch?.[2] || sourceMatch?.[3] || "")
    .replace(/&amp;/gi, "&")
    .trim();
  if (!rawUrl) return "";

  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:" || url.hostname !== "drive.google.com") return "";
    if (!["/thumbnail", "/uc"].includes(url.pathname)) return "";
    if (!url.searchParams.get("id")) return "";
    return url.href;
  } catch {
    return "";
  }
}

function formatDateTime_(value) {
  if (!value) return "Data no disponible";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("ca-ES", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function viewModeLabel_(value) {
  return {
    Compartida: "tauler compartit",
    Pròpies: "tasques pròpies",
    Perfils: "perfils assignats",
  }[value] || value;
}

function initials_(name) {
  return String(name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase("ca"))
    .join("");
}

function escapeHtml_(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute_(value) {
  return escapeHtml_(value).replaceAll("`", "&#096;");
}

function escapeClass_(value) {
  return String(value || "").replace(/[^\p{L}\p{N}-]/gu, "-");
}

function cssEscape_(value) {
  return window.CSS?.escape ? window.CSS.escape(value) : String(value).replace(/"/g, '\\"');
}

function loadJson_(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") || fallback;
  } catch {
    return fallback;
  }
}

function clone_(value) {
  return JSON.parse(JSON.stringify(value));
}

/* Mode de prova local: reprodueix els recorreguts sense tocar Google Sheets. */
function demoApi_(action, payload) {
  const store = loadDemoStore_();
  if (action === "login") {
    const user = store.users.find(
      (item) =>
        item.username.toLocaleLowerCase("ca") ===
        String(payload.username || "").toLocaleLowerCase("ca"),
    );
    if (!user || payload.password !== user.password) {
      return Promise.reject(new Error("En la prova usa Albert / demo."));
    }
    if (!user.active) return Promise.reject(new Error("Aquest usuari està desactivat."));
    state.token = `demo:${user.id}`;
    return Promise.resolve({ ok: true, token: state.token, ...demoBootstrap_(store, user, "coord") });
  }
  const user = store.users.find((item) => `demo:${item.id}` === state.token);
  if (!user) return Promise.reject(new Error("La sessió de prova ha caducat."));
  if (action === "bootstrap" || action === "dashboard") {
    return Promise.resolve({ ok: true, ...demoBootstrap_(store, user, payload.viewKey) });
  }
  if (action === "saveIncidents") {
    const dashboard = demoDashboard_(store, user, payload.viewKey);
    const actionMap = Object.fromEntries(dashboard.actions.map((item) => [item.id, item]));
    let saved = 0;
    payload.changes.forEach((change) => {
      const incident = store.incidents.find((item) => item.id === change.id);
      if (!incident) return;
      const before = JSON.stringify(incident);
      if ("priority" in change) incident.priority = change.priority;
      if ("type" in change) incident.type = change.type;
      if ("comment" in change) incident.comment = change.comment;
      if (change.actionId && actionMap[change.actionId]) {
        demoApplyAction_(store, incident, actionMap[change.actionId]);
      }
      if (before !== JSON.stringify(incident)) {
        incident.history.push({
          user: user.fullName,
          date: new Date().toISOString(),
          action: actionMap[change.actionId]?.label || "Modificació",
          comment: incident.comment,
        });
        saved += 1;
      }
    });
    saveDemoStore_(store);
    return Promise.resolve({
      ok: true,
      saved,
      ...demoBootstrap_(store, user, payload.viewKey),
    });
  }
  if (action === "printBatch") {
    const profileId = String(payload.viewKey || "").replace("profile:", "");
    const profile = store.profiles.find((item) => item.id === profileId);
    let saved = 0;
    store.incidents.forEach((incident) => {
      if (payload.ids.includes(incident.id) && incident.status === profile.entry) {
        incident.status = profile.printStatus;
        incident.printedAt = new Date().toISOString();
        saved += 1;
      }
    });
    saveDemoStore_(store);
    return Promise.resolve({ ok: true, saved, ...demoBootstrap_(store, user, payload.viewKey) });
  }
  if (action === "adminGet") {
    return Promise.resolve({ ok: true, ...demoAdmin_(store, user) });
  }
  if (action === "saveUser") {
    const data = payload.user;
    const existing = store.users.find((item) => item.id === data.id);
    if (existing) Object.assign(existing, data, { password: data.password || existing.password });
    else store.users.push({ ...data, id: `u-${Date.now().toString(36)}`, password: data.password });
    saveDemoStore_(store);
    return Promise.resolve({ ok: true, ...demoAdmin_(store, user) });
  }
  if (action === "saveProfile") {
    const data = payload.profile;
    let profile = store.profiles.find((item) => item.id === data.id);
    if (!profile) {
      profile = {
        ...data,
        id: `perfil-${Date.now().toString(36)}`,
        visibleStates: [],
        system: false,
        order: store.profiles.length * 10,
      };
      store.profiles.push(profile);
    } else Object.assign(profile, data);
    profile.visibleStates = [
      profile.entry,
      ...payload.actions.filter((item) => item.kind === "stay").map((item) => item.state),
    ];
    store.actions = store.actions
      .filter((item) => item.profileId !== profile.id)
      .concat(
        payload.actions.map((item, index) => ({
          ...item,
          id: item.id || `${profile.id}-${index}`,
          profileId: profile.id,
        })),
      );
    store.users.forEach((member) => {
      const set = new Set(member.profileIds || []);
      if (payload.userIds.includes(member.id)) set.add(profile.id);
      else set.delete(profile.id);
      member.profileIds = [...set];
    });
    saveDemoStore_(store);
    return Promise.resolve({ ok: true, ...demoAdmin_(store, user) });
  }
  return Promise.reject(new Error("Acció de prova no implementada."));
}

function demoBootstrap_(store, user, requestedView) {
  const views =
    user.permission === "SUPER"
      ? [
          { key: "coord", label: "Coordinació" },
          { key: "all", label: "Vista global i arxiu" },
          ...store.profiles
            .filter((profile) => profile.id !== "coordinacio")
            .map((profile) => ({ key: `profile:${profile.id}`, label: profile.name })),
        ]
      : user.viewMode === "Compartida"
        ? [{ key: "coord", label: "Coordinació" }]
        : user.viewMode === "Pròpies"
          ? [{ key: "own", label: `Tasques de ${user.assignment}` }]
          : user.profileIds.map((id) => ({
              key: `profile:${id}`,
              label: store.profiles.find((profile) => profile.id === id)?.name || id,
            }));
  const viewKey = views.some((view) => view.key === requestedView)
    ? requestedView
    : views[0].key;
  return {
    user: {
      ...user,
      canAdmin: ["SUPER", "ADMIN"].includes(user.permission),
      canSuper: user.permission === "SUPER",
    },
    views,
    dashboard: demoDashboard_(store, user, viewKey),
  };
}

function demoDashboard_(store, user, viewKey) {
  const terminal = ["Solucionat", "Descartar", "Descartat", "Pagat"];
  const profileId = String(viewKey).replace("profile:", "");
  const profile = store.profiles.find((item) => item.id === profileId);
  const incidents = store.incidents
    .filter((incident) => {
      if (viewKey === "all") return user.permission === "SUPER";
      if (viewKey === "coord") {
        return incident.team === "Coordinació" && !terminal.includes(incident.status);
      }
      if (viewKey === "own") return incident.status === user.assignment;
      return (
        profile &&
        incident.team === profile.team &&
        profile.visibleStates.includes(incident.status)
      );
    })
    .map((incident) => ({
      ...incident,
      section:
        viewKey === "coord"
          ? incident.status || "Sense assignar"
          : viewKey === "all"
            ? terminal.includes(incident.status)
              ? "Arxiu"
              : "Actives"
            : incident.status === profile?.entry
              ? "Pendents"
              : "En procés",
    }));
  const actions =
    viewKey === "coord"
      ? store.users
          .filter(
            (member) =>
              member.active &&
              member.team === "Coordinació" &&
              ["Compartida", "Pròpies"].includes(member.viewMode),
          )
          .map((member) => ({
            id: `assign:${member.id}`,
            label: `Assignar a ${member.assignment}`,
            kind: "assign",
            state: member.assignment,
          }))
          .concat(
            store.profiles
              .filter(
                (item) =>
                  item.team === "Coordinació" &&
                  !["coordinacio", "jordi"].includes(item.id),
              )
              .map((item) => ({
                id: `route:${item.id}`,
                label: `Enviar a ${item.name}`,
                kind: "route",
                targetProfileId: item.id,
                state: item.entry,
              })),
            [
              {
                id: "coord-maintenance",
                label: "Enviar a Laura (manteniment)",
                kind: "route",
                targetProfileId: "laura",
                state: "",
                typeValue: "Manteniment",
              },
              { id: "coord-solved", label: "Solucionat", kind: "close", state: "Solucionat" },
              { id: "coord-discard", label: "Descartar", kind: "close", state: "Descartar" },
            ],
          )
      : viewKey === "own"
        ? [
            { id: "own-solved", label: "Solucionat", kind: "close", state: "Solucionat" },
            { id: "own-discard", label: "Descartar", kind: "close", state: "Descartar" },
          ]
        : store.actions.filter((item) => item.profileId === profileId);
  return {
    viewKey,
    viewLabel:
      viewKey === "coord"
        ? "Coordinació"
        : viewKey === "all"
          ? "Vista global i arxiu"
          : viewKey === "own"
            ? `Tasques de ${user.assignment}`
            : profile?.name || "Incidències",
    incidents,
    actions,
    canEditType: user.permission === "SUPER" && viewKey === "all",
    printConfig:
      profile?.canPrint
        ? {
            enabled: true,
            sourceStatus: profile.entry,
            targetStatus: profile.printStatus,
            label: "Imprimir incidències aprovades",
          }
        : { enabled: false },
    summary: {
      urgent: incidents.filter((item) => item.priority === "Urgent").length,
      pending: incidents.filter((item) => !item.status).length,
      assigned: incidents.filter((item) => item.status && !terminal.includes(item.status)).length,
      closed: incidents.filter((item) => terminal.includes(item.status)).length,
    },
  };
}

function demoApplyAction_(store, incident, action) {
  if (action.kind === "assign") {
    incident.status = action.state;
    incident.team = "Coordinació";
  } else if (action.kind === "route") {
    const target = store.profiles.find((item) => item.id === action.targetProfileId);
    incident.team = action.teamValue || target?.team || incident.team;
    incident.status = action.state ?? target?.entry ?? "";
    incident.type = action.typeValue || (target && !target.system ? target.name : incident.type);
    incident.derivedAt = new Date().toISOString();
  } else {
    incident.status = action.state;
  }
}

function demoAdmin_(store, user) {
  return {
    users: clone_(store.users),
    profiles: clone_(store.profiles),
    actions: clone_(store.actions),
    canManageProfiles: user.permission === "SUPER",
  };
}

function loadDemoStore_() {
  const stored = loadJson_(DEMO_STORE_KEY, null);
  if (stored) return stored;
  const now = new Date().toISOString();
  const store = {
    users: [
      {
        id: "u-albert",
        username: "Albert",
        password: "demo",
        fullName: "Albert",
        email: "",
        permission: "SUPER",
        team: "Coordinació",
        viewMode: "Compartida",
        assignment: "Albert",
        profileIds: [],
        active: true,
      },
      {
        id: "u-quim",
        username: "Quim",
        password: "demo",
        fullName: "Joaquim",
        email: "",
        permission: "NORMAL",
        team: "Coordinació",
        viewMode: "Compartida",
        assignment: "Joaquim",
        profileIds: [],
        active: true,
      },
      {
        id: "u-santi",
        username: "Santi",
        password: "demo",
        fullName: "Santi",
        email: "",
        permission: "NORMAL",
        team: "Coordinació",
        viewMode: "Compartida",
        assignment: "Santi",
        profileIds: [],
        active: true,
      },
      {
        id: "u-laura",
        username: "Laura",
        password: "demo",
        fullName: "Laura",
        email: "",
        permission: "NORMAL",
        team: "Laura",
        viewMode: "Perfils",
        assignment: "Laura",
        profileIds: ["laura"],
        active: true,
      },
      {
        id: "u-jose",
        username: "Jose",
        password: "demo",
        fullName: "Jose",
        email: "",
        permission: "NORMAL",
        team: "Laura",
        viewMode: "Perfils",
        assignment: "Jose",
        profileIds: ["manteniment"],
        active: true,
      },
      {
        id: "u-electricitat",
        username: "Electricitat",
        password: "demo",
        fullName: "Electricitat",
        email: "",
        permission: "NORMAL",
        team: "Laura",
        viewMode: "Perfils",
        assignment: "Electricitat",
        profileIds: ["electricitat"],
        active: true,
      },
      {
        id: "u-encarna",
        username: "Encarna",
        password: "demo",
        fullName: "Encarna",
        email: "",
        permission: "NORMAL",
        team: "Laura",
        viewMode: "Perfils",
        assignment: "Encarna",
        profileIds: ["facturacio"],
        active: true,
      },
      {
        id: "u-jordi",
        username: "Jordi",
        password: "demo",
        fullName: "Jordi",
        email: "",
        permission: "NORMAL",
        team: "Coordinació",
        viewMode: "Pròpies",
        assignment: "Jordi",
        profileIds: ["jordi"],
        active: true,
      },
      {
        id: "u-anna",
        username: "Anna",
        password: "demo",
        fullName: "Anna",
        email: "",
        permission: "NORMAL",
        team: "Coordinació",
        viewMode: "Compartida",
        assignment: "Anna",
        profileIds: [],
        active: false,
      },
    ],
    profiles: [
      {
        id: "coordinacio",
        name: "Coordinació",
        team: "Coordinació",
        entry: "",
        visibleStates: [""],
        active: true,
        system: true,
        order: 10,
        canPrint: false,
        printStatus: "",
      },
      {
        id: "laura",
        name: "Laura",
        team: "Laura",
        entry: "",
        visibleStates: [""],
        active: true,
        system: true,
        order: 20,
        canPrint: false,
        printStatus: "",
      },
      {
        id: "manteniment",
        name: "Manteniment",
        team: "Laura",
        entry: "Aprovar-manteniment",
        visibleStates: ["Aprovar-manteniment", "Procés-manteniment"],
        active: true,
        system: true,
        order: 30,
        canPrint: true,
        printStatus: "Procés-manteniment",
      },
      {
        id: "electricitat",
        name: "Electricitat",
        team: "Laura",
        entry: "Aprovar-electricitat",
        visibleStates: ["Aprovar-electricitat", "Procés-electricitat"],
        active: true,
        system: true,
        order: 40,
        canPrint: true,
        printStatus: "Procés-electricitat",
      },
      {
        id: "facturacio",
        name: "Facturació",
        team: "Laura",
        entry: "Facturar",
        visibleStates: ["Facturar", "Procés-facturació"],
        active: true,
        system: true,
        order: 50,
        canPrint: true,
        printStatus: "Procés-facturació",
      },
      {
        id: "jordi",
        name: "Jordi",
        team: "Coordinació",
        entry: "Jordi",
        visibleStates: ["Jordi"],
        active: true,
        system: true,
        order: 60,
        canPrint: false,
        printStatus: "",
      },
      {
        id: "preventiu",
        name: "Preventiu",
        team: "Coordinació",
        entry: "Preventiu",
        visibleStates: ["Preventiu"],
        active: true,
        system: true,
        order: 70,
        canPrint: false,
        printStatus: "",
      },
    ],
    actions: [
      {
        id: "laura-mant",
        profileId: "laura",
        label: "Enviar a manteniment",
        kind: "route",
        targetProfileId: "manteniment",
        state: "Aprovar-manteniment",
        typeValue: "Manteniment",
      },
      {
        id: "laura-elec",
        profileId: "laura",
        label: "Enviar a electricitat",
        kind: "route",
        targetProfileId: "electricitat",
        state: "Aprovar-electricitat",
        typeValue: "Manteniment",
      },
      {
        id: "laura-info",
        profileId: "laura",
        label: "Enviar a informàtica",
        kind: "route",
        targetProfileId: "coordinacio",
        state: "",
        typeValue: "Informàtica",
      },
      {
        id: "laura-discard",
        profileId: "laura",
        label: "Descartar",
        kind: "close",
        state: "Descartar",
      },
      {
        id: "mant-process",
        profileId: "manteniment",
        label: "Passar a procés",
        kind: "stay",
        state: "Procés-manteniment",
      },
      {
        id: "mant-bill",
        profileId: "manteniment",
        label: "Enviar a facturació",
        kind: "route",
        targetProfileId: "facturacio",
        state: "Facturar",
      },
      {
        id: "mant-discard",
        profileId: "manteniment",
        label: "Descartar",
        kind: "close",
        state: "Descartar",
      },
      {
        id: "elec-process",
        profileId: "electricitat",
        label: "Passar a procés",
        kind: "stay",
        state: "Procés-electricitat",
      },
      {
        id: "elec-bill",
        profileId: "electricitat",
        label: "Enviar a facturació",
        kind: "route",
        targetProfileId: "facturacio",
        state: "Facturar",
      },
      {
        id: "bill-process",
        profileId: "facturacio",
        label: "Passar a procés",
        kind: "stay",
        state: "Procés-facturació",
      },
      {
        id: "bill-paid",
        profileId: "facturacio",
        label: "Pagat",
        kind: "close",
        state: "Pagat",
      },
      {
        id: "jordi-solved",
        profileId: "jordi",
        label: "Solucionat",
        kind: "close",
        state: "Solucionat",
      },
      {
        id: "prevent-solved",
        profileId: "preventiu",
        label: "Solucionat",
        kind: "close",
        state: "Solucionat",
      },
    ],
    incidents: [
      {
        id: "1jw001",
        space: "S16",
        group: "ESO 3 Virginia Woolf",
        type: "Informàtica",
        description:
          "[29/07/2026] (Alex) No es connecta a la xarxa Wi-Fi i no reconeix cap opció de connexió.",
        priority: "Normal",
        team: "Coordinació",
        status: "",
        comment: "",
        enteredAt: now,
        derivedAt: "",
        printedAt: "",
        history: [{ user: "Sistema", date: now, action: "Rebuda del formulari", comment: "" }],
      },
      {
        id: "1jw002",
        space: "Passadís de comerç",
        group: "CFPM CM10 A",
        type: "Manteniment",
        description:
          "[29/07/2026] (Clarissa) Hi ha cinc o sis tubs de neó junts que estan fosos.",
        priority: "Urgent",
        team: "Laura",
        status: "",
        comment: "",
        enteredAt: now,
        derivedAt: "",
        printedAt: "",
        history: [{ user: "Sistema", date: now, action: "Rebuda del formulari", comment: "" }],
      },
      {
        id: "1jw006",
        space: "Vestidor 4 del gimnàs",
        group: "No pertany a cap grup",
        type: "Manteniment",
        description: "[19/09/2025] (Mayte) El primer banc està despenjat.",
        priority: "Normal",
        team: "Laura",
        status: "Aprovar-manteniment",
        comment: "",
        enteredAt: now,
        derivedAt: now,
        printedAt: "",
        history: [{ user: "Laura", date: now, action: "Enviada a manteniment", comment: "" }],
      },
      {
        id: "1jw005",
        space: "Coordinació FP",
        group: "No pertany a cap grup",
        type: "Informàtica",
        description: "[25/06/2026] (Carlos Lara) Necessitem un tercer ordinador amb doble pantalla.",
        priority: "Normal",
        team: "Coordinació",
        status: "Jordi",
        comment: "",
        enteredAt: now,
        derivedAt: now,
        printedAt: "",
        history: [{ user: "Albert", date: now, action: "Assignada a Jordi", comment: "" }],
      },
      {
        id: "1jw008",
        space: "P5",
        group: "CFPM CM10 C",
        type: "Manteniment",
        description: "Hi ha un fluorescent que parpelleja.",
        priority: "Urgent",
        team: "Laura",
        status: "Facturar",
        comment: "Pendent de factura del material.",
        enteredAt: now,
        derivedAt: now,
        printedAt: "",
        history: [{ user: "Jose", date: now, action: "Enviada a facturació", comment: "" }],
      },
    ],
  };
  saveDemoStore_(store);
  return store;
}

function saveDemoStore_(store) {
  localStorage.setItem(DEMO_STORE_KEY, JSON.stringify(store));
}
