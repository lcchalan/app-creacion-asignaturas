const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
let authenticatedUserData = null;
const impactState = { SPECIFICATION: null, DOCUMENT: null };
let selectedKnowledgeRecord = null;
let pendingKnowledgeRetirement = null;
const expandedKnowledgeGroups = new Set();
function scopePickerValues(form, field) {
  return [...form.querySelectorAll(`[data-scope-picker="${field}"] input[type="checkbox"]:checked`)]
    .map((input) => input.value);
}
const scopeValues = (form) => ({
  academicLevels: scopePickerValues(form, "academicLevels"),
  modalities: scopePickerValues(form, "modalities"),
  durations: scopePickerValues(form, "durations").map(Number).filter((item) => Number.isInteger(item) && item > 0),
  subjectTypes: scopePickerValues(form, "subjectTypes"),
  priority: Number(form.elements.priority?.value || 100),
});
function setScopeValues(form, item) {
  const valuesByField = {
    academicLevels: item.academicLevels || [],
    modalities: item.modalities || [],
    durations: (item.durations || []).map(String),
    subjectTypes: item.subjectTypes || [],
  };
  Object.entries(valuesByField).forEach(([field, values]) => {
    form.querySelectorAll(`[data-scope-picker="${field}"] input[type="checkbox"]`).forEach((input) => {
      input.checked = values.includes(input.value);
    });
    updateScopePickerSummary(form.querySelector(`[data-scope-picker="${field}"]`));
  });
  form.elements.priority.value = item.priority ?? 100;
}
function updateScopePickerSummary(container) {
  if (!container) return;
  const selected = [...container.querySelectorAll('input[type="checkbox"]:checked')].map((input) => input.dataset.label || input.value);
  const summary = container.querySelector("summary");
  if (summary) summary.textContent = selected.length ? selected.join(", ") : "Cualquier valor";
}
function renderScopePicker(container, options) {
  if (!container) return;
  const items = [...new Map(options.map((item) => [String(item.value), item])).values()];
  container.innerHTML = `<details><summary>Cualquier valor</summary><div class="scope-picker-menu">${items.length
    ? items.map((item) => `<label><input type="checkbox" value="${escapeHtml(String(item.value))}" data-label="${escapeHtml(item.label)}"> <span>${escapeHtml(item.label)}</span></label>`).join("")
    : '<p class="field-help">No hay valores registrados.</p>'}</div></details>`;
  container.querySelectorAll('input[type="checkbox"]').forEach((input) => input.addEventListener("change", () => {
    updateScopePickerSummary(container);
    const form = container.closest("form");
    if (form) resetImpact(currentKnowledgeKind());
  }));
}
function currentKnowledgeKind() {
  return $("#knowledge-config-kind")?.value || "DOCUMENT";
}
function renderKnowledgeScopePickers() {
  if (!adminData) return;
  const form = $("#knowledge-config-form");
  if (!form) return;
  const durationOptions = [...new Set((adminData.academicOfferings || []).map((item) => Number(item.totalWeeks)).filter((item) => Number.isInteger(item) && item > 0))]
    .sort((a, b) => a - b).map((value) => ({ value: String(value), label: `${value} semanas` }));
  renderScopePicker(form.querySelector('[data-scope-picker="academicLevels"]'), (adminData.academicLevels || []).filter((item) => item.active).map((item) => ({ value: item.name, label: item.name })));
  renderScopePicker(form.querySelector('[data-scope-picker="modalities"]'), (adminData.modalities || []).filter((item) => item.active).map((item) => ({ value: item.name, label: item.name })));
  renderScopePicker(form.querySelector('[data-scope-picker="durations"]'), durationOptions);
  renderScopePicker(form.querySelector('[data-scope-picker="subjectTypes"]'), (adminData.subjectTypes || []).filter((item) => item.active).map((item) => ({ value: item.name, label: item.name })));
}
function resetImpact(kind = currentKnowledgeKind()) {
  impactState[kind] = null;
  const form = $("#knowledge-config-form");
  if (!form) return;
  const saveButton = $("#knowledge-save-button");
  const versionButton = $("#knowledge-create-version-button");
  if (saveButton) saveButton.disabled = true;
  if (versionButton) versionButton.disabled = true;
  $("#knowledge-impact-result")?.classList.add("hidden");
}
function impactHtml(analysis) {
  const conflicts = analysis.contradictions?.length
    ? `<h4>Aspectos que requieren revisión</h4>
      <div class="impact-conflict-list">${analysis.contradictions.map((item) => `
        <article class="impact-conflict">
          <h5>${escapeHtml(item.topic)}</h5>
          <p><strong>Regla del documento nuevo:</strong> ${escapeHtml(item.proposed)}</p>
          <p class="field-help"><strong>Fuente:</strong> ${escapeHtml(item.proposedSource)} · ${escapeHtml(item.proposedAuthority)}</p>
          <p><strong>Regla actualmente activa:</strong> ${escapeHtml(item.current)}</p>
          <p class="field-help"><strong>Fuente:</strong> ${escapeHtml(item.currentSource)} · ${escapeHtml(item.currentAuthority)}</p>
          <p><strong>Recomendación:</strong> ${escapeHtml(item.recommendation)}</p>
        </article>`).join("")}</div>
      <fieldset class="impact-decision" data-impact-decision-group>
        <legend>Seleccione qué desea hacer</legend>
        <label class="confirm"><input type="radio" name="impactDecision" value="USE_NEW" required> Usar la regla del documento nuevo</label>
        <label class="confirm"><input type="radio" name="impactDecision" value="KEEP_CURRENT" required> Mantener la regla actualmente activa</label>
        <label class="confirm"><input type="radio" name="impactDecision" value="DO_NOT_ACTIVATE" required> No activar todavía</label>
      </fieldset>
      <label>Observación de la decisión <span class="field-help">(opcional)</span><textarea data-impact-resolution placeholder="Puede registrar el motivo o una aclaración adicional."></textarea></label>`
    : "<p><strong>No se detectaron contradicciones textuales evidentes.</strong></p>";
  return `<h3>Análisis de impacto</h3><p>${escapeHtml(analysis.summary)}</p>
    <h4>Mejoras previstas</h4><ul>${analysis.improvements.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    ${conflicts}<p><strong>Recomendación:</strong> ${escapeHtml(analysis.recommendation.replaceAll("_", " "))}</p>
    <p class="field-help">Revise este análisis. Si está conforme, ya puede guardar la nueva versión.</p>`;
}

async function authRequest(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const payload = await response.json();
  if (!response.ok) {
    const error = new Error(payload.error || "No fue posible completar la solicitud.");
    error.code = payload.code;
    error.payload = payload;
    throw error;
  }
  return payload;
}
function showAuthenticatedUser(user) {
  authenticatedUserData = user;
  $("#auth-layer").classList.add("hidden");
  $("#profile-name").textContent = user.displayName;
  $("#profile-role").textContent = user.roles.includes("ADMIN") ? "Administrador" : "Profesor";
  $("#profile-initials").textContent = `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase() || "U";
  $("#nav-admin").classList.toggle("hidden", !user.roles.includes("ADMIN"));
  if (user.mustChangePassword) {
    openPasswordChange(true);
    return;
  }
  syncProfessorName();
  loadAcademicCatalog().then(() => loadProjects()).catch((error) => {
    console.error(error);
    loadProjects();
  });
}

function openPasswordChange(required = false) {
  const layer = $("#password-change-layer");
  const form = $("#password-change-form");
  form.reset();
  layer.dataset.required = String(required);
  $("#password-change-title").textContent = required ? "Cambie su contraseña temporal" : "Cambiar mi contraseña";
  $("#password-change-description").textContent = required
    ? "Por seguridad, debe establecer una contraseña personal antes de continuar."
    : "Ingrese su contraseña actual y establezca una nueva.";
  $("#password-change-cancel").classList.toggle("hidden", required);
  $("#password-change-message").classList.add("hidden");
  layer.classList.remove("hidden");
  form.elements.currentPassword.focus();
}

function closePasswordChange() {
  const layer = $("#password-change-layer");
  if (layer.dataset.required === "true") return;
  $("#password-change-form").reset();
  layer.classList.add("hidden");
}

function showTemporaryPassword(title, value, description = "Copie la credencial antes de cerrar esta ventana.") {
  $("#temporary-password-title").textContent = title;
  $("#temporary-password-description").textContent = description;
  $("#temporary-password-value").value = value;
  $("#temporary-password-copy-message").classList.add("hidden");
  $("#temporary-password-layer").classList.remove("hidden");
}

function closeTemporaryPassword() {
  $("#temporary-password-layer").classList.add("hidden");
  $("#temporary-password-value").value = "";
  $("#temporary-password-copy-message").classList.add("hidden");
}
const passwordResetTokenFromUrl = new URLSearchParams(window.location.search).get("reset_token") || "";

function setAuthMessage(text = "", success = false) {
  const message = $("#auth-message");
  message.textContent = text;
  message.classList.toggle("success", success);
  message.classList.toggle("hidden", !text);
}

function clearPasswordResetTokenFromUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete("reset_token");
  history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

function showAuthView(view) {
  const titles = {
    login: "Iniciar sesión",
    forgot: "Recuperar contraseña",
    reset: "Crear nueva contraseña",
  };
  $("#auth-view-title").textContent = titles[view] || titles.login;
  $("#login-form").classList.toggle("hidden", view !== "login");
  $("#forgot-password-form").classList.toggle("hidden", view !== "forgot");
  $("#reset-password-form").classList.toggle("hidden", view !== "reset");
  setAuthMessage();
}

$("#forgot-password-open").onclick = () => {
  const email = $("#login-form [name=email]").value;
  $("#forgot-password-form").reset();
  $("#forgot-password-form [name=email]").value = email;
  showAuthView("forgot");
};
$("#forgot-password-back").onclick = () => showAuthView("login");
$("#reset-password-cancel").onclick = () => {
  clearPasswordResetTokenFromUrl();
  $("#reset-password-form").reset();
  showAuthView("login");
};

$("#login-form").onsubmit = async (event) => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(event.currentTarget));
  try {
    await authRequest("/api/auth/login", { method: "POST", body: JSON.stringify(values) });
    const { user } = await authRequest("/api/auth/me");
    showAuthenticatedUser(user);
  } catch (error) {
    setAuthMessage(error.message);
  }
};

$("#forgot-password-form").onsubmit = async (event) => {
  event.preventDefault();
  const submittedForm = event.currentTarget;
  const values = Object.fromEntries(new FormData(submittedForm));
  const submitButton = submittedForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  try {
    const result = await authRequest("/api/auth/forgot-password", { method: "POST", body: JSON.stringify(values) });
    setAuthMessage(result.message || "Si el correo está registrado y activo, recibirá un enlace de restablecimiento.", true);
  } catch (error) {
    setAuthMessage(error.message);
  } finally {
    submitButton.disabled = false;
  }
};

$("#reset-password-form").onsubmit = async (event) => {
  event.preventDefault();
  const submittedForm = event.currentTarget;
  const values = Object.fromEntries(new FormData(submittedForm));
  if (values.newPassword !== values.confirmPassword) {
    setAuthMessage("La confirmación no coincide con la nueva contraseña.");
    return;
  }
  const submitButton = submittedForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  try {
    const result = await authRequest("/api/auth/reset-password", { method: "POST", body: JSON.stringify(values) });
    clearPasswordResetTokenFromUrl();
    submittedForm.reset();
    showAuthView("login");
    setAuthMessage(result.message || "Contraseña actualizada. Ya puede iniciar sesión.", true);
  } catch (error) {
    setAuthMessage(error.message);
  } finally {
    submitButton.disabled = false;
  }
};

if (passwordResetTokenFromUrl) {
  $("#reset-password-form [name=token]").value = passwordResetTokenFromUrl;
  showAuthView("reset");
}
$("#logout").onclick = async () => {
  if (projectId && step <= 3) {
    clearTimeout(progressSyncTimer);
    try {
      await syncDraftProgress();
    } catch (error) {
      console.error("No fue posible completar el guardado automático antes de cerrar sesión:", error);
    }
  }
  await authRequest("/api/auth/logout", { method: "POST", body: "{}" });
  localStorage.removeItem("ggd-project-v2");
  location.reload();
};
$("#change-own-password").onclick = () => openPasswordChange(false);
$("#password-change-cancel").onclick = closePasswordChange;
$("#password-change-form").onsubmit = async (event) => {
  event.preventDefault();
  const submittedForm = event.currentTarget;
  const values = Object.fromEntries(new FormData(submittedForm));
  const message = $("#password-change-message");
  if (values.newPassword !== values.confirmPassword) {
    message.textContent = "La confirmación no coincide con la nueva contraseña.";
    message.classList.remove("hidden");
    return;
  }
  const submitButton = submittedForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  try {
    await authRequest("/api/auth/change-password", { method: "POST", body: JSON.stringify(values) });
    authenticatedUserData.mustChangePassword = false;
    $("#password-change-layer").dataset.required = "false";
    closePasswordChange();
    showAdminMessage("Contraseña actualizada. Las demás sesiones fueron cerradas.");
    syncProfessorName();
    loadProjects();
  } catch (error) {
    message.textContent = error.message;
    message.classList.remove("hidden");
  } finally {
    submitButton.disabled = false;
  }
};
$("#copy-temporary-password").onclick = async () => {
  const field = $("#temporary-password-value");
  try {
    await navigator.clipboard.writeText(field.value);
  } catch {
    field.focus();
    field.select();
    document.execCommand("copy");
  }
  const message = $("#temporary-password-copy-message");
  message.textContent = "Copiado al portapapeles.";
  message.classList.remove("hidden");
};
$("#close-temporary-password").onclick = closeTemporaryPassword;
const layer = $("#wizard-layer");
const form = $("#project-form");
const message = $("#form-message");
const next = $("#next");
const back = $("#back");
let step = 1;
let matrixFile = null;
let matrixRows = [];
let currentWeek = 1;
let weekStates = {};
let selectedAdjustmentFiles = [];
let projectId = "";
let matrixFileName = "";
let syncTimer = null;
const storageKey = "ggd-project-v2";
let offer = {};
let academicCatalog = { subjectTypes: [], periods: [] };
let institutionalDataState = null;
let outcomeMappingsState = [];
let teacherProfileState = null;
let bibliographyEntriesState = [];
let guideReferenceImportanceState = "";
let teachingPlanState = null;
let workflowModeState = null;
let legacyDocumentsState = [];
let planAdaptationProposalState = null;
let guideAdaptationProposalState = null;
const level = $("#level");
const modality = $("#modality");
const faculty = $("#faculty");
const career = $("#career");
const fallbackUtplGenericCompetencyCatalog = [
  "Desarrollo personal integral",
  "Trabajo colaborativo",
  "Innovación y emprendimiento con visión de propósito",
  "Mentalidad sostenible",
  "Ciudadanía global",
];

function utplGenericCompetencyCatalog() {
  const databaseValues = (adminData?.utplGenericCompetencies || []).map((item) => item.name).filter(Boolean);
  return databaseValues.length ? databaseValues : fallbackUtplGenericCompetencyCatalog;
}
const catalogStructuredState = {
  learningOutcomes: [],
  professionalProfileCompetencies: [],
  graduateProfileResults: [],
  utplGenericCompetencies: [],
  units: [],
};

function normalizeStructuredText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function syncStructuredStorage() {
  const form = $("#catalog-form");
  if (!form) return;
  form.elements.learningOutcomes.value = catalogStructuredState.learningOutcomes.join("\n");
  form.elements.professionalProfileCompetencies.value = catalogStructuredState.professionalProfileCompetencies.join("\n");
  form.elements.graduateProfileResults.value = catalogStructuredState.graduateProfileResults.join("\n");
  form.elements.utplGenericCompetencies.value = catalogStructuredState.utplGenericCompetencies.join("\n");
  form.elements.unitContents.value = catalogStructuredState.units.flatMap((unit) => [
    `UNIDAD: ${unit.title}`,
    ...unit.contents.flatMap((content) => [
      `CONTENIDO: ${content.text}`,
      ...content.subcontents.map((subcontent) => `SUBCONTENIDO: ${subcontent}`),
    ]),
  ]).join("\n");
}

function structuredListConfig(kind) {
  return {
    learningOutcomes: { list: "#learning-outcomes-list", prefix: "RA" },
    professionalProfileCompetencies: { list: "#professional-competencies-list", prefix: "CP" },
    graduateProfileResults: { list: "#graduate-results-list", prefix: "RPE" },
  }[kind];
}

function renderStructuredList(kind) {
  const config = structuredListConfig(kind);
  if (!config) return;
  const target = $(config.list);
  const values = catalogStructuredState[kind];
  target.innerHTML = values.map((value, index) => `
    <div class="structured-item">
      <span class="structured-item-index">${config.prefix}${index + 1}</span>
      <span class="structured-item-text">${escapeHtml(value)}</span>
      <span class="structured-item-actions">
        <button type="button" data-structured-edit="${kind}" data-index="${index}">Editar</button>
        <button type="button" class="danger" data-structured-delete="${kind}" data-index="${index}">Eliminar</button>
      </span>
    </div>`).join("") || `<p class="field-help">Todavía no se han agregado registros.</p>`;
  syncStructuredStorage();
}

function addStructuredItem(kind, inputSelector) {
  const input = $(inputSelector);
  const value = normalizeStructuredText(input.value);
  if (!value) return;
  if (catalogStructuredState[kind].some((item) => item.toLocaleLowerCase("es") === value.toLocaleLowerCase("es"))) {
    showAdminMessage("Ese registro ya fue agregado.", true);
    return;
  }
  catalogStructuredState[kind].push(value);
  input.value = "";
  renderStructuredList(kind);
  input.focus();
}

function renderGenericCompetencies() {
  const selected = new Set(catalogStructuredState.utplGenericCompetencies);
  $("#generic-competency-options").innerHTML = utplGenericCompetencyCatalog().map((value) => `
    <label><input type="checkbox" value="${escapeHtml(value)}" ${selected.has(value) ? "checked" : ""}> <span>${escapeHtml(value)}</span></label>`).join("");
  $("#generic-competency-tags").innerHTML = catalogStructuredState.utplGenericCompetencies.map((value) => `
    <span class="selected-tag">${escapeHtml(value)}<button type="button" data-remove-generic="${escapeHtml(value)}" aria-label="Quitar ${escapeHtml(value)}">×</button></span>`).join("");
  syncStructuredStorage();
}

function parseUnitContents(values) {
  const units = [];
  let currentUnit = null;
  let currentContent = null;
  for (const raw of values || []) {
    const value = String(raw || "").trim();
    if (!value) continue;
    if (/^UNIDAD\s*:/i.test(value)) {
      currentUnit = { title: value.replace(/^UNIDAD\s*:/i, "").trim(), contents: [] };
      currentContent = null;
      if (currentUnit.title) units.push(currentUnit);
    } else if (/^CONTENIDO\s*:/i.test(value)) {
      const text = value.replace(/^CONTENIDO\s*:/i, "").trim();
      if (text) {
        if (!currentUnit) { currentUnit = { title: "Unidad sin título", contents: [] }; units.push(currentUnit); }
        currentContent = { text, subcontents: [] };
        currentUnit.contents.push(currentContent);
      }
    } else if (/^SUBCONTENIDO\s*:/i.test(value)) {
      const text = value.replace(/^SUBCONTENIDO\s*:/i, "").trim();
      if (text) {
        if (!currentUnit) { currentUnit = { title: "Unidad sin título", contents: [] }; units.push(currentUnit); }
        if (!currentContent) { currentContent = { text: "Contenido sin título", subcontents: [] }; currentUnit.contents.push(currentContent); }
        currentContent.subcontents.push(text);
      }
    } else {
      currentUnit = { title: value, contents: [] };
      currentContent = null;
      units.push(currentUnit);
    }
  }
  return units;
}

function renderUnits() {
  $("#unit-list").innerHTML = catalogStructuredState.units.map((unit, unitIndex) => `
    <article class="unit-card">
      <div class="unit-header">
        <strong>Unidad ${unitIndex + 1}: ${escapeHtml(unit.title)}</strong>
        <span class="unit-actions">
          <button type="button" data-edit-unit="${unitIndex}">Editar título</button>
          <button type="button" class="danger" data-delete-unit="${unitIndex}">Eliminar unidad</button>
        </span>
      </div>
      <div class="unit-content-list">${unit.contents.map((content, contentIndex) => `
        <div class="content-card">
          <div class="content-line">
            <span class="content-number">${unitIndex + 1}.${contentIndex + 1}.</span>
            <span class="content-text">${escapeHtml(content.text)}</span>
            <span class="unit-actions"><button type="button" data-edit-content="${unitIndex}:${contentIndex}">Editar</button><button type="button" class="danger" data-delete-content="${unitIndex}:${contentIndex}">Eliminar</button></span>
          </div>
          <div class="subcontent-list">${content.subcontents.map((subcontent, subcontentIndex) => `
            <div class="subcontent-line">
              <span class="content-number">${unitIndex + 1}.${contentIndex + 1}.${subcontentIndex + 1}.</span>
              <span class="content-text">${escapeHtml(subcontent)}</span>
              <span class="unit-actions"><button type="button" data-edit-subcontent="${unitIndex}:${contentIndex}:${subcontentIndex}">Editar</button><button type="button" class="danger" data-delete-subcontent="${unitIndex}:${contentIndex}:${subcontentIndex}">Eliminar</button></span>
            </div>`).join("") || '<p class="field-help subcontent-empty">Sin subcontenidos. Este tercer nivel es opcional.</p>'}</div>
          <div class="subcontent-add-row">
            <input type="text" maxlength="1000" data-subcontent-input="${unitIndex}:${contentIndex}" placeholder="Agregar subcontenido opcional (${unitIndex + 1}.${contentIndex + 1}.1)">
            <button class="button secondary compact" type="button" data-add-subcontent="${unitIndex}:${contentIndex}">Agregar subcontenido</button>
          </div>
        </div>`).join("") || '<p class="field-help">Sin contenidos todavía.</p>'}</div>
      <div class="unit-content-row">
        <input type="text" maxlength="1000" data-content-input="${unitIndex}" placeholder="Agregar contenido (${unitIndex + 1}.${unit.contents.length + 1})">
        <button class="button secondary compact" type="button" data-add-content="${unitIndex}">Agregar contenido</button>
      </div>
    </article>`).join("") || `<p class="field-help">Agregue la primera unidad y luego sus contenidos. Los subcontenidos de tercer nivel son opcionales.</p>`;
  syncStructuredStorage();
}

function resetStructuredOfferingFields() {
  catalogStructuredState.learningOutcomes = [];
  catalogStructuredState.professionalProfileCompetencies = [];
  catalogStructuredState.graduateProfileResults = [];
  catalogStructuredState.utplGenericCompetencies = [];
  catalogStructuredState.units = [];
  renderStructuredList("learningOutcomes");
  renderStructuredList("professionalProfileCompetencies");
  renderStructuredList("graduateProfileResults");
  renderGenericCompetencies();
  renderUnits();
}

function loadStructuredOfferingFields(item = {}) {
  catalogStructuredState.learningOutcomes = [...(item.learningOutcomes || [])];
  catalogStructuredState.professionalProfileCompetencies = [...(item.professionalProfileCompetencies || [])];
  catalogStructuredState.graduateProfileResults = [...(item.graduateProfileResults || [])];
  catalogStructuredState.utplGenericCompetencies = (item.utplGenericCompetencies || []).filter((value) => utplGenericCompetencyCatalog().includes(value));
  catalogStructuredState.units = parseUnitContents(item.unitContents || []);
  renderStructuredList("learningOutcomes");
  renderStructuredList("professionalProfileCompetencies");
  renderStructuredList("graduateProfileResults");
  renderGenericCompetencies();
  renderUnits();
}

let academicProfileState = {
  professionalProfileCompetencies: [],
  graduateProfileResults: [],
  utplGenericCompetencies: [],
};

async function loadAcademicCatalog() {
  academicCatalog = await authRequest("/api/academic-catalog");
  offer = academicCatalog.offer || {};
  fillSelect(level, Object.keys(offer), "Seleccione un nivel");
  $("#project-subject-type").innerHTML = academicCatalog.subjectTypes
    .map((item) => `<option value="${escapeHtml(item.code)}">${escapeHtml(item.name)}</option>`).join("");
  const departmentSelect = $("#teacher-department");
  if (departmentSelect) departmentSelect.innerHTML = `<option value="">Seleccione un departamento</option>${(academicCatalog.departments || []).map((item) => `<option value="${escapeHtml(item.id)}" data-name="${escapeHtml(item.name)}">${escapeHtml(item.name)}</option>`).join("")}`;
}

function lockInstitutionalFields() {
  [level, modality, faculty, career, form.elements.subjectType].forEach((field) => {
    if (field) {
      field.disabled = true;
      field.setAttribute("aria-readonly", "true");
    }
  });
}

function syncProfessorName() {
  const field = $("#professor-name");
  if (field && authenticatedUserData?.displayName) field.value = authenticatedUserData.displayName;
}

function setAcademicProfileState(source = {}) {
  academicProfileState = {
    professionalProfileCompetencies: Array.isArray(source.professionalProfileCompetencies)
      ? source.professionalProfileCompetencies.filter(Boolean)
      : [],
    graduateProfileResults: Array.isArray(source.graduateProfileResults)
      ? source.graduateProfileResults.filter(Boolean)
      : [],
    utplGenericCompetencies: Array.isArray(source.utplGenericCompetencies)
      ? source.utplGenericCompetencies.filter((value) => utplGenericCompetencyCatalog().includes(value))
      : [],
  };
  renderAcademicProfile();
}

function renderAcademicProfileList(key, selector) {
  const list = $(selector);
  if (!list) return;
  list.innerHTML = academicProfileState[key].map((value, index) => `
    <li><span>${escapeHtml(value)}</span><button type="button" data-profile-key="${key}" data-profile-index="${index}" aria-label="Eliminar elemento">× Eliminar</button></li>`).join("");
}

function renderAcademicProfile() {
  renderAcademicProfileList("professionalProfileCompetencies", "#professional-competencies-list");
  renderAcademicProfileList("graduateProfileResults", "#graduate-results-list");
  renderAcademicProfileList("utplGenericCompetencies", "#utpl-generic-competencies-list");
  const select = $("#utpl-generic-competency");
  if (select) {
    [...select.options].forEach((option) => {
      option.disabled = Boolean(option.value && academicProfileState.utplGenericCompetencies.includes(option.value));
    });
    select.value = "";
  }
}

function addAcademicProfileValue(key, value) {
  const normalized = String(value || "").trim().replace(/\s+/g, " ");
  if (!normalized) return false;
  if (academicProfileState[key].some((entry) => entry.toLocaleLowerCase("es") === normalized.toLocaleLowerCase("es"))) {
    return false;
  }
  academicProfileState[key].push(normalized);
  renderAcademicProfile();
  return true;
}

function bindAcademicProfileEntry(buttonSelector, inputSelector, key) {
  const input = $(inputSelector);
  const button = $(buttonSelector);
  if (!input || !button) return;
  const add = () => {
    if (!addAcademicProfileValue(key, input.value)) {
      showMessage(input.value.trim() ? "Ese elemento ya fue agregado." : "Escriba un elemento antes de agregarlo.");
      return;
    }
    input.value = "";
    showMessage();
    input.focus();
  };
  button.onclick = add;
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      add();
    }
  });
}

bindAcademicProfileEntry("#add-professional-competency", "#professional-competency-input", "professionalProfileCompetencies");
bindAcademicProfileEntry("#add-graduate-result", "#graduate-result-input", "graduateProfileResults");
if ($("#add-utpl-generic-competency")) $("#add-utpl-generic-competency").onclick = () => {
  const select = $("#utpl-generic-competency");
  if (!addAcademicProfileValue("utplGenericCompetencies", select.value)) {
    showMessage(select.value ? "Esa competencia ya fue agregada." : "Seleccione una competencia genérica de la UTPL.");
    return;
  }
  showMessage();
};
$$(["#professional-competencies-list", "#graduate-results-list", "#utpl-generic-competencies-list"].join(",")).forEach((list) => {
  list.onclick = (event) => {
    const button = event.target.closest("[data-profile-key]");
    if (!button) return;
    academicProfileState[button.dataset.profileKey].splice(Number(button.dataset.profileIndex), 1);
    renderAcademicProfile();
  };
});

function linesFrom(value) {
  return String(value || "").split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}

function selectOptions(values, selected = []) {
  const selectedSet = new Set(selected);
  return values.map((value) => `<option value="${escapeHtml(value)}" ${selectedSet.has(value) ? "selected" : ""}>${escapeHtml(value)}</option>`).join("");
}

function structuredInstitutionalUnits(values = []) {
  const units = [];
  let currentUnit = null;
  let currentContent = null;
  for (const rawValue of values) {
    const value = String(rawValue || "").trim();
    if (!value) continue;
    const unitMatch = value.match(/^UNIDAD\s*:\s*(.+)$/i);
    const contentMatch = value.match(/^CONTENIDO\s*:\s*(.+)$/i);
    const subcontentMatch = value.match(/^SUBCONTENIDO\s*:\s*(.+)$/i);
    if (unitMatch) {
      currentUnit = { title: unitMatch[1].trim(), contents: [] };
      units.push(currentUnit);
      currentContent = null;
      continue;
    }
    if (contentMatch && currentUnit) {
      currentContent = { text: contentMatch[1].trim(), subcontents: [] };
      currentUnit.contents.push(currentContent);
      continue;
    }
    if (subcontentMatch && currentContent) {
      currentContent.subcontents.push(subcontentMatch[1].trim());
      continue;
    }
    if (!currentUnit) {
      currentUnit = { title: value, contents: [] };
      units.push(currentUnit);
    } else {
      currentContent = { text: value, subcontents: [] };
      currentUnit.contents.push(currentContent);
    }
  }
  return units;
}

function renderInstitutionalUnits(values = []) {
  const units = structuredInstitutionalUnits(values);
  if (!units.length) return '<p class="muted">No se registraron unidades.</p>';
  return `<div class="institutional-units">${units.map((unit, unitIndex) => `
    <section class="institutional-unit">
      <h5>Unidad ${unitIndex + 1}: ${escapeHtml(unit.title)}</h5>
      ${unit.contents.length ? `<ol>${unit.contents.map((content, contentIndex) => `
        <li><span class="unit-number">${unitIndex + 1}.${contentIndex + 1}.</span> ${escapeHtml(content.text)}
          ${content.subcontents.length ? `<ol>${content.subcontents.map((subcontent, subcontentIndex) => `
            <li><span class="unit-number">${unitIndex + 1}.${contentIndex + 1}.${subcontentIndex + 1}.</span> ${escapeHtml(subcontent)}</li>`).join("")}</ol>` : ""}
        </li>`).join("")}</ol>` : '<p class="muted">Sin contenidos registrados.</p>'}
    </section>`).join("")}</div>`;
}

function adaptationNumberingIndex() {
  const units = structuredInstitutionalUnits(institutionalDataState?.unitContents || []);
  const unitByTitle = new Map();
  const contentByUnitAndText = new Map();
  const contentByText = new Map();
  const subcontentByContentAndText = new Map();
  const subcontentByText = new Map();

  const key = (value) => normalizeStructuredText(value).toLocaleLowerCase("es");
  const addCandidate = (map, candidateKey, number) => {
    if (!candidateKey) return;
    const current = map.get(candidateKey) || [];
    if (!current.includes(number)) current.push(number);
    map.set(candidateKey, current);
  };

  units.forEach((unit, unitIndex) => {
    const unitNumber = String(unitIndex + 1);
    unitByTitle.set(key(unit.title), unitNumber);
    unit.contents.forEach((content, contentIndex) => {
      const contentNumber = `${unitNumber}.${contentIndex + 1}`;
      contentByUnitAndText.set(`${unitNumber}|${key(content.text)}`, contentNumber);
      addCandidate(contentByText, key(content.text), contentNumber);
      content.subcontents.forEach((subcontent, subcontentIndex) => {
        const subcontentNumber = `${contentNumber}.${subcontentIndex + 1}`;
        subcontentByContentAndText.set(`${contentNumber}|${key(subcontent)}`, subcontentNumber);
        addCandidate(subcontentByText, key(subcontent), subcontentNumber);
      });
    });
  });

  return { key, unitByTitle, contentByUnitAndText, contentByText, subcontentByContentAndText, subcontentByText };
}

function adaptationStructuredTokens(value) {
  const source = (Array.isArray(value) ? value.join("\n") : String(value || ""))
    .replace(/\r/g, "")
    .replace(/;\s*(?=(?:UNIDAD|CONTENIDO|SUBCONTENIDO)\s*:)/gi, "\n")
    .replace(/\s+(?=(?:UNIDAD|CONTENIDO|SUBCONTENIDO)\s*:)/gi, "\n")
    .trim();
  if (!source) return [];
  return source.split(/\n+/).map((rawLine) => {
    const line = rawLine.trim().replace(/^;+|;+$/g, "").trim();
    const match = line.match(/^(UNIDAD|CONTENIDO|SUBCONTENIDO)\s*:\s*(.+)$/i);
    if (!match) return { type: "TEXT", text: line };
    return { type: match[1].toUpperCase(), text: match[2].trim().replace(/;+$/g, "").trim() };
  }).filter((item) => item.text);
}

function numberedAdaptationContent(value) {
  const tokens = adaptationStructuredTokens(value);
  if (!tokens.length) return [];
  const index = adaptationNumberingIndex();
  let currentUnitNumber = "";
  let currentContentNumber = "";
  let fallbackUnit = 0;
  let fallbackContent = 0;
  let fallbackSubcontent = 0;

  return tokens.map((token) => {
    const normalized = index.key(token.text);
    if (token.type === "UNIDAD") {
      const known = index.unitByTitle.get(normalized);
      currentUnitNumber = known || String(++fallbackUnit);
      fallbackContent = 0;
      fallbackSubcontent = 0;
      currentContentNumber = "";
      return { type: "UNIT", number: currentUnitNumber, text: token.text };
    }
    if (token.type === "CONTENIDO") {
      let known = currentUnitNumber ? index.contentByUnitAndText.get(`${currentUnitNumber}|${normalized}`) : "";
      if (!known) {
        const candidates = index.contentByText.get(normalized) || [];
        if (candidates.length === 1) known = candidates[0];
      }
      if (known) {
        currentContentNumber = known;
        currentUnitNumber = known.split(".")[0];
        fallbackContent = Number(known.split(".")[1]) || fallbackContent;
      } else {
        if (!currentUnitNumber) currentUnitNumber = String(fallbackUnit || 1);
        fallbackContent += 1;
        currentContentNumber = `${currentUnitNumber}.${fallbackContent}`;
      }
      fallbackSubcontent = 0;
      return { type: "CONTENT", number: currentContentNumber, text: token.text };
    }
    if (token.type === "SUBCONTENIDO") {
      let known = currentContentNumber ? index.subcontentByContentAndText.get(`${currentContentNumber}|${normalized}`) : "";
      if (!known) {
        const candidates = index.subcontentByText.get(normalized) || [];
        if (candidates.length === 1) known = candidates[0];
      }
      if (known) {
        currentContentNumber = known.split(".").slice(0, 2).join(".");
        currentUnitNumber = known.split(".")[0];
        fallbackSubcontent = Number(known.split(".")[2]) || fallbackSubcontent;
      } else {
        if (!currentUnitNumber) currentUnitNumber = String(fallbackUnit || 1);
        if (!currentContentNumber) currentContentNumber = `${currentUnitNumber}.${fallbackContent || 1}`;
        fallbackSubcontent += 1;
        known = `${currentContentNumber}.${fallbackSubcontent}`;
      }
      return { type: "SUBCONTENT", number: known, text: token.text };
    }
    return { type: "TEXT", number: "", text: token.text };
  });
}

function renderNumberedAdaptationContent(value, fallback = "") {
  const lines = numberedAdaptationContent(value);
  if (!lines.length) return `<div class="adaptation-structured-content"><div class="adaptation-structured-line text">${escapeHtml(fallback)}</div></div>`;
  return `<div class="adaptation-structured-content">${lines.map((line) => {
    if (line.type === "UNIT") {
      return `<div class="adaptation-structured-line unit"><span class="adaptation-structured-number">Unidad ${escapeHtml(line.number)}.</span><span>${escapeHtml(line.text)}</span></div>`;
    }
    if (line.type === "CONTENT") {
      return `<div class="adaptation-structured-line content-item"><span class="adaptation-structured-number">${escapeHtml(line.number)}.</span><span>${escapeHtml(line.text)}</span></div>`;
    }
    if (line.type === "SUBCONTENT") {
      return `<div class="adaptation-structured-line subcontent"><span class="adaptation-structured-number">${escapeHtml(line.number)}.</span><span>${escapeHtml(line.text)}</span></div>`;
    }
    return `<div class="adaptation-structured-line text"><span>${escapeHtml(line.text)}</span></div>`;
  }).join("")}</div>`;
}

function adaptationContentForEditor(value) {
  const lines = numberedAdaptationContent(value);
  if (!lines.length) return String(value || "").trim();
  return lines.map((line) => {
    if (line.type === "UNIT") return `Unidad ${line.number}. ${line.text}`;
    if (line.type === "CONTENT" || line.type === "SUBCONTENT") return `${line.number}. ${line.text}`;
    return line.text;
  }).join("\n");
}

function adaptationEditorCatalog() {
  const entries = [];
  let unit = 0;
  let content = 0;
  let subcontent = 0;
  const key = (value) => normalizeStructuredText(value).toLocaleLowerCase("es");
  for (const rawValue of institutionalDataState?.unitContents || []) {
    const raw = String(rawValue || "").trim();
    if (!raw) continue;
    let number = "";
    let type = "TEXT";
    let displayText = raw;
    const unitMatch = raw.match(/^UNIDAD\s*:\s*(.+)$/i);
    const contentMatch = raw.match(/^CONTENIDO\s*:\s*(.+)$/i);
    const subcontentMatch = raw.match(/^SUBCONTENIDO\s*:\s*(.+)$/i);
    if (unitMatch) {
      unit += 1;
      content = 0;
      subcontent = 0;
      number = String(unit);
      type = "UNIT";
      displayText = unitMatch[1].trim();
    } else if (contentMatch) {
      if (!unit) unit = 1;
      content += 1;
      subcontent = 0;
      number = `${unit}.${content}`;
      type = "CONTENT";
      displayText = contentMatch[1].trim();
    } else if (subcontentMatch) {
      if (!unit) unit = 1;
      if (!content) content = 1;
      subcontent += 1;
      number = `${unit}.${content}.${subcontent}`;
      type = "SUBCONTENT";
      displayText = subcontentMatch[1].trim();
    }
    entries.push({ raw, number, type, text: displayText, key: key(displayText) });
  }
  return { entries, key };
}

function canonicalizeAdaptationEditorContent(value) {
  const lines = String(value || "").split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  const { entries, key } = adaptationEditorCatalog();
  const canonical = [];
  const errors = [];
  for (const line of lines) {
    const technical = line.match(/^(UNIDAD|CONTENIDO|SUBCONTENIDO)\s*:\s*(.+)$/i);
    if (technical) {
      const type = technical[1].toUpperCase() === "UNIDAD" ? "UNIT" : technical[1].toUpperCase() === "CONTENIDO" ? "CONTENT" : "SUBCONTENT";
      const match = entries.find((entry) => entry.type === type && entry.key === key(technical[2]));
      if (match) canonical.push(match.raw);
      else errors.push(line);
      continue;
    }
    const unitMatch = line.match(/^Unidad\s+(\d+)\s*(?:[.:\-–—])?\s*(.+)$/i);
    const numberedMatch = line.match(/^(\d+(?:\.\d+){1,2})\s*(?:[.:\-–—])?\s*(.+)$/u);
    const number = unitMatch?.[1] || numberedMatch?.[1] || "";
    const contentText = unitMatch?.[2] || numberedMatch?.[2] || line;
    let candidates = entries.filter((entry) => entry.key === key(contentText));
    if (number) candidates = candidates.filter((entry) => entry.number === number);
    if (candidates.length === 1) canonical.push(candidates[0].raw);
    else errors.push(line);
  }
  return { canonical: canonical.join("; "), errors };
}

function renderAdaptationWeekBreakdown(breakdown, aggregateValue = "", fallback = "—") {
  const items = Array.isArray(breakdown)
    ? breakdown
        .filter((item) => item && Number.isInteger(Number(item.week)) && String(item.content || "").trim())
        .map((item) => ({ week: Number(item.week), content: String(item.content || "").trim() }))
        .sort((left, right) => left.week - right.week)
    : [];
  if (!items.length) {
    const rendered = renderNumberedAdaptationContent(aggregateValue || "", fallback);
    if (!String(aggregateValue || "").trim()) return rendered;
    return `${rendered}<p class="adaptation-breakdown-note">Esta propuesta no incluye todavía el desglose por semana. Para visualizarlo con detalle, regenere la propuesta con la versión actual del análisis.</p>`;
  }
  return `<div class="adaptation-week-breakdown">${items.map((item) => `
    <section class="adaptation-week-block">
      <header>Semana ${escapeHtml(String(item.week))}</header>
      ${renderNumberedAdaptationContent(item.content, fallback)}
    </section>`).join("")}</div>`;
}

function renderAdaptationList(values, fallback = "—") {
  const items = (Array.isArray(values) ? values : [values])
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  if (!items.length) return `<span class="adaptation-meta-empty">${escapeHtml(fallback)}</span>`;
  return `<ul class="adaptation-meta-list">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function compactWeekRanges(values) {
  const weeks = [...new Set((Array.isArray(values) ? values : [values])
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0))].sort((left, right) => left - right);
  if (!weeks.length) return "—";
  const ranges = [];
  let start = weeks[0];
  let previous = weeks[0];
  for (let index = 1; index < weeks.length; index += 1) {
    const current = weeks[index];
    if (current === previous + 1) {
      previous = current;
      continue;
    }
    ranges.push(start === previous ? `${start}` : `${start}–${previous}`);
    start = current;
    previous = current;
  }
  ranges.push(start === previous ? `${start}` : `${start}–${previous}`);
  return ranges.join(", ");
}

function adaptationWeeksLabel(values, { modular = false } = {}) {
  const formatted = compactWeekRanges(values);
  if (formatted === "—") return modular ? "sin semana modular de destino" : "sin semana de origen";
  const list = (Array.isArray(values) ? values : [values]).filter((value) => Number.isFinite(Number(value)));
  const plural = list.length !== 1;
  const noun = modular ? `semana${plural ? "s" : ""} modular${plural ? "es" : ""}` : `semana${plural ? "s" : ""}`;
  return `${noun} ${formatted}`;
}

function adaptationOperationSummary(change) {
  const sourceLabel = adaptationWeeksLabel(change.sourceWeeks || []);
  const targetLabel = adaptationWeeksLabel(change.proposedWeeks || [], { modular: true });
  const sameContent = String(change.sourceContent || "").trim() === String(change.proposedContent || "").trim();
  switch (change.action) {
    case "KEEP":
      return {
        title: "Operación propuesta",
        sourceLabel,
        targetLabel,
        message: sameContent
          ? `Se conserva el contenido institucional y su cobertura pedagógica. Revise principalmente el cambio de secuencia entre ${sourceLabel} y ${targetLabel}.`
          : `Se conserva la cobertura institucional del bloque, con ajustes menores de organización o redacción entre ${sourceLabel} y ${targetLabel}.`,
      };
    case "GROUP":
      return {
        title: "Operación propuesta",
        sourceLabel,
        targetLabel,
        message: `Se conservan los contenidos, pero se consolidan ${sourceLabel} del documento anterior en ${targetLabel}. El cambio principal es la concentración temporal del mismo bloque temático.`,
      };
    case "MERGE":
      return {
        title: "Operación propuesta",
        sourceLabel,
        targetLabel,
        message: `Se integran contenidos relacionados que antes estaban separados en ${sourceLabel}, para trabajarlos de forma articulada en ${targetLabel}. El cambio principal es la integración pedagógica del bloque.`,
      };
    case "SYNTHESIZE":
      return {
        title: "Operación propuesta",
        sourceLabel,
        targetLabel,
        message: `Se sintetiza el contenido de ${sourceLabel} para conservar los elementos esenciales en ${targetLabel}. El cambio principal es la focalización de ideas y actividades clave sin perder cobertura formativa.`,
      };
    case "MOVE":
      return {
        title: "Operación propuesta",
        sourceLabel,
        targetLabel,
        message: `El contenido se conserva, pero se traslada desde ${sourceLabel} hacia ${targetLabel} para alinearlo mejor con la progresión del resultado de aprendizaje. El cambio principal es la reubicación temporal del bloque.`,
      };
    case "REFORMULATE":
      return {
        title: "Operación propuesta",
        sourceLabel,
        targetLabel,
        message: `Se mantiene la intención formativa del bloque, pero se reorganiza o reformula pedagógicamente entre ${sourceLabel} y ${targetLabel}. El cambio principal es la manera de presentar o articular el contenido para mejorar su aprendizaje.`,
      };
    case "DELETE":
      return {
        title: "Operación propuesta",
        sourceLabel,
        targetLabel: change.proposedContent ? targetLabel : "sin cobertura conservada",
        message: change.proposedContent
          ? `Se propone omitir el contenido del documento anterior identificado en ${sourceLabel}, conservando su cobertura en ${targetLabel}. La omisión solo se aplicará si el profesor la aprueba.`
          : `Se propone omitir el contenido del documento anterior identificado en ${sourceLabel} porque no forma parte de la oferta vigente. La omisión solo se aplicará si el profesor la aprueba.`,
      };
    case "SPLIT":
      return {
        title: "Operación propuesta",
        sourceLabel,
        targetLabel,
        message: `Se conserva el bloque de contenidos del origen, pero se redistribuye pedagógicamente desde ${sourceLabel} hacia ${targetLabel}. El cambio principal es la secuencia temporal en varias semanas consecutivas.`,
      };
    case "UPDATE":
      return {
        title: "Operación propuesta",
        sourceLabel,
        targetLabel,
        message: `Se actualiza la formulación del contenido o su redacción pedagógica entre ${sourceLabel} y ${targetLabel}, manteniendo la cobertura institucional. El cambio principal es el ajuste de formulación para mayor claridad o coherencia.`,
      };
    default:
      return {
        title: "Operación propuesta",
        sourceLabel,
        targetLabel,
        message: `La propuesta reorganiza el contenido desde ${sourceLabel} hacia ${targetLabel}. Revise la justificación pedagógica para comprender el criterio de reorganización.`,
      };
  }
}

function adaptationColumnTitles(change) {
  const sourceLabel = adaptationWeeksLabel(change.sourceWeeks || []);
  const targetLabel = adaptationWeeksLabel(change.proposedWeeks || [], { modular: true });
  if (change.action === "DELETE") {
    return {
      sourceTitle: `Contenido propuesto para omitir · ${sourceLabel}`,
      destinationTitle: change.proposedContent
        ? `Cobertura que se conserva · ${targetLabel}`
        : "Omisión propuesta",
      destinationFallback: "Este material del documento anterior no forma parte de la oferta vigente y se propone retirarlo.",
      destinationHelp: "Revise la justificación pedagógica y, si corresponde, la cobertura conservada indicada por la propuesta.",
    };
  }
  if (change.action === "GROUP") {
    return {
      sourceTitle: `Bloque de origen · ${sourceLabel}`,
      destinationTitle: `Distribución propuesta · ${targetLabel}`,
      destinationFallback: "—",
      destinationHelp: "Los contenidos se conservan; lo que cambia es que las semanas de origen se consolidan en una sola semana modular.",
    };
  }
  if (change.action === "SPLIT") {
    return {
      sourceTitle: `Bloque de origen · ${sourceLabel}`,
      destinationTitle: `Distribución propuesta · ${targetLabel}`,
      destinationFallback: "—",
      destinationHelp: "Los contenidos se conservan; lo que cambia es su distribución pedagógica entre varias semanas modulares consecutivas.",
    };
  }
  if (change.action === "MOVE") {
    return {
      sourceTitle: `Bloque de origen · ${sourceLabel}`,
      destinationTitle: `Nueva ubicación propuesta · ${targetLabel}`,
      destinationFallback: "—",
      destinationHelp: "El contenido se conserva; lo que cambia es su ubicación temporal dentro de la secuencia modular.",
    };
  }
  if (change.action === "KEEP") {
    return {
      sourceTitle: `Bloque de origen · ${sourceLabel}`,
      destinationTitle: `Cobertura conservada · ${targetLabel}`,
      destinationFallback: "—",
      destinationHelp: "La cobertura institucional se mantiene. Revise si la secuencia o la redacción presenta ajustes menores.",
    };
  }
  if (change.action === "MERGE") {
    return {
      sourceTitle: `Bloques de origen · ${sourceLabel}`,
      destinationTitle: `Integración propuesta · ${targetLabel}`,
      destinationFallback: "—",
      destinationHelp: "La propuesta integra contenidos relacionados para trabajarlos como un bloque articulado en la semana modular indicada.",
    };
  }
  if (change.action === "SYNTHESIZE") {
    return {
      sourceTitle: `Bloque de origen · ${sourceLabel}`,
      destinationTitle: `Síntesis propuesta · ${targetLabel}`,
      destinationFallback: "—",
      destinationHelp: "La propuesta concentra los elementos esenciales del contenido para mantener la cobertura formativa con una versión más sintética.",
    };
  }
  if (change.action === "REFORMULATE") {
    return {
      sourceTitle: `Bloque de origen · ${sourceLabel}`,
      destinationTitle: `Reformulación propuesta · ${targetLabel}`,
      destinationFallback: "—",
      destinationHelp: "La propuesta conserva la intención formativa, pero reorganiza o reescribe pedagógicamente el bloque para mejorar su articulación.",
    };
  }
  if (change.action === "UPDATE") {
    return {
      sourceTitle: `Bloque de origen · ${sourceLabel}`,
      destinationTitle: `Versión actualizada · ${targetLabel}`,
      destinationFallback: "—",
      destinationHelp: "La propuesta ajusta la formulación o redacción del bloque sin alterar su cobertura institucional.",
    };
  }
  return {
    sourceTitle: `Contenido de origen · ${sourceLabel}`,
    destinationTitle: `Propuesta para ${targetLabel}`,
    destinationFallback: "—",
    destinationHelp: "Compare el contenido de origen con la propuesta y revise la justificación pedagógica del cambio.",
  };
}

function compactWeekRanges(values) {
  const weeks = [...new Set((Array.isArray(values) ? values : [values])
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0))].sort((left, right) => left - right);
  if (!weeks.length) return "—";
  const ranges = [];
  let start = weeks[0];
  let previous = weeks[0];
  for (let index = 1; index < weeks.length; index += 1) {
    const current = weeks[index];
    if (current === previous + 1) {
      previous = current;
      continue;
    }
    ranges.push(start === previous ? `${start}` : `${start}–${previous}`);
    start = current;
    previous = current;
  }
  ranges.push(start === previous ? `${start}` : `${start}–${previous}`);
  return ranges.join(", ");
}

function adaptationWeeksLabel(values, { modular = false } = {}) {
  const formatted = compactWeekRanges(values);
  if (formatted === "—") return modular ? "sin semana modular de destino" : "sin semana de origen";
  const list = (Array.isArray(values) ? values : [values]).filter((value) => Number.isFinite(Number(value)));
  const plural = list.length !== 1;
  const noun = modular ? `semana${plural ? "s" : ""} modular${plural ? "es" : ""}` : `semana${plural ? "s" : ""}`;
  return `${noun} ${formatted}`;
}

function adaptationOperationSummary(change) {
  const sourceLabel = adaptationWeeksLabel(change.sourceWeeks || []);
  const targetLabel = adaptationWeeksLabel(change.proposedWeeks || [], { modular: true });
  const sameContent = String(change.sourceContent || "").trim() === String(change.proposedContent || "").trim();
  switch (change.action) {
    case "KEEP":
      return {
        title: "Operación propuesta",
        sourceLabel,
        targetLabel,
        message: sameContent
          ? `Se conserva el contenido institucional y su cobertura pedagógica. Revise principalmente el cambio de secuencia entre ${sourceLabel} y ${targetLabel}.`
          : `Se conserva la cobertura institucional del bloque, con ajustes menores de organización o redacción entre ${sourceLabel} y ${targetLabel}.`,
      };
    case "GROUP":
      return {
        title: "Operación propuesta",
        sourceLabel,
        targetLabel,
        message: `Se conservan los contenidos, pero se consolidan ${sourceLabel} del documento anterior en ${targetLabel}. El cambio principal es la concentración temporal del mismo bloque temático.`,
      };
    case "MERGE":
      return {
        title: "Operación propuesta",
        sourceLabel,
        targetLabel,
        message: `Se integran contenidos relacionados que antes estaban separados en ${sourceLabel}, para trabajarlos de forma articulada en ${targetLabel}. El cambio principal es la integración pedagógica del bloque.`,
      };
    case "SYNTHESIZE":
      return {
        title: "Operación propuesta",
        sourceLabel,
        targetLabel,
        message: `Se sintetiza el contenido de ${sourceLabel} para conservar los elementos esenciales en ${targetLabel}. El cambio principal es la focalización de ideas y actividades clave sin perder cobertura formativa.`,
      };
    case "MOVE":
      return {
        title: "Operación propuesta",
        sourceLabel,
        targetLabel,
        message: `El contenido se conserva, pero se traslada desde ${sourceLabel} hacia ${targetLabel} para alinearlo mejor con la progresión del resultado de aprendizaje. El cambio principal es la reubicación temporal del bloque.`,
      };
    case "REFORMULATE":
      return {
        title: "Operación propuesta",
        sourceLabel,
        targetLabel,
        message: `Se mantiene la intención formativa del bloque, pero se reorganiza o reformula pedagógicamente entre ${sourceLabel} y ${targetLabel}. El cambio principal es la manera de presentar o articular el contenido para mejorar su aprendizaje.`,
      };
    case "DELETE":
      return {
        title: "Operación propuesta",
        sourceLabel,
        targetLabel: change.proposedContent ? targetLabel : "sin cobertura conservada",
        message: change.proposedContent
          ? `Se propone omitir el contenido del documento anterior identificado en ${sourceLabel}, conservando su cobertura en ${targetLabel}. La omisión solo se aplicará si el profesor la aprueba.`
          : `Se propone omitir el contenido del documento anterior identificado en ${sourceLabel} porque no forma parte de la oferta vigente. La omisión solo se aplicará si el profesor la aprueba.`,
      };
    case "SPLIT":
      return {
        title: "Operación propuesta",
        sourceLabel,
        targetLabel,
        message: `Se conserva el bloque de contenidos del origen, pero se redistribuye pedagógicamente desde ${sourceLabel} hacia ${targetLabel}. El cambio principal es la secuencia temporal en varias semanas consecutivas.`,
      };
    case "UPDATE":
      return {
        title: "Operación propuesta",
        sourceLabel,
        targetLabel,
        message: `Se actualiza la formulación del contenido o su redacción pedagógica entre ${sourceLabel} y ${targetLabel}, manteniendo la cobertura institucional. El cambio principal es el ajuste de formulación para mayor claridad o coherencia.`,
      };
    default:
      return {
        title: "Operación propuesta",
        sourceLabel,
        targetLabel,
        message: `La propuesta reorganiza el contenido desde ${sourceLabel} hacia ${targetLabel}. Revise la justificación pedagógica para comprender el criterio de reorganización.`,
      };
  }
}

function adaptationColumnTitles(change) {
  const sourceLabel = adaptationWeeksLabel(change.sourceWeeks || []);
  const targetLabel = adaptationWeeksLabel(change.proposedWeeks || [], { modular: true });
  if (change.action === "DELETE") {
    return {
      sourceTitle: `Contenido propuesto para omitir · ${sourceLabel}`,
      destinationTitle: change.proposedContent
        ? `Cobertura que se conserva · ${targetLabel}`
        : "Omisión propuesta",
      destinationFallback: "Este material del documento anterior no forma parte de la oferta vigente y se propone retirarlo.",
      destinationHelp: "Revise la justificación pedagógica y, si corresponde, la cobertura conservada indicada por la propuesta.",
    };
  }
  if (change.action === "GROUP") {
    return {
      sourceTitle: `Bloque de origen · ${sourceLabel}`,
      destinationTitle: `Distribución propuesta · ${targetLabel}`,
      destinationFallback: "—",
      destinationHelp: "Los contenidos se conservan; lo que cambia es que las semanas de origen se consolidan en una sola semana modular.",
    };
  }
  if (change.action === "SPLIT") {
    return {
      sourceTitle: `Bloque de origen · ${sourceLabel}`,
      destinationTitle: `Distribución propuesta · ${targetLabel}`,
      destinationFallback: "—",
      destinationHelp: "Los contenidos se conservan; lo que cambia es su distribución pedagógica entre varias semanas modulares consecutivas.",
    };
  }
  if (change.action === "MOVE") {
    return {
      sourceTitle: `Bloque de origen · ${sourceLabel}`,
      destinationTitle: `Nueva ubicación propuesta · ${targetLabel}`,
      destinationFallback: "—",
      destinationHelp: "El contenido se conserva; lo que cambia es su ubicación temporal dentro de la secuencia modular.",
    };
  }
  if (change.action === "KEEP") {
    return {
      sourceTitle: `Bloque de origen · ${sourceLabel}`,
      destinationTitle: `Cobertura conservada · ${targetLabel}`,
      destinationFallback: "—",
      destinationHelp: "La cobertura institucional se mantiene. Revise si la secuencia o la redacción presenta ajustes menores.",
    };
  }
  if (change.action === "MERGE") {
    return {
      sourceTitle: `Bloques de origen · ${sourceLabel}`,
      destinationTitle: `Integración propuesta · ${targetLabel}`,
      destinationFallback: "—",
      destinationHelp: "La propuesta integra contenidos relacionados para trabajarlos como un bloque articulado en la semana modular indicada.",
    };
  }
  if (change.action === "SYNTHESIZE") {
    return {
      sourceTitle: `Bloque de origen · ${sourceLabel}`,
      destinationTitle: `Síntesis propuesta · ${targetLabel}`,
      destinationFallback: "—",
      destinationHelp: "La propuesta concentra los elementos esenciales del contenido para mantener la cobertura formativa con una versión más sintética.",
    };
  }
  if (change.action === "REFORMULATE") {
    return {
      sourceTitle: `Bloque de origen · ${sourceLabel}`,
      destinationTitle: `Reformulación propuesta · ${targetLabel}`,
      destinationFallback: "—",
      destinationHelp: "La propuesta conserva la intención formativa, pero reorganiza o reescribe pedagógicamente el bloque para mejorar su articulación.",
    };
  }
  if (change.action === "UPDATE") {
    return {
      sourceTitle: `Bloque de origen · ${sourceLabel}`,
      destinationTitle: `Versión actualizada · ${targetLabel}`,
      destinationFallback: "—",
      destinationHelp: "La propuesta ajusta la formulación o redacción del bloque sin alterar su cobertura institucional.",
    };
  }
  return {
    sourceTitle: `Contenido de origen · ${sourceLabel}`,
    destinationTitle: `Propuesta para ${targetLabel}`,
    destinationFallback: "—",
    destinationHelp: "Compare el contenido de origen con la propuesta y revise la justificación pedagógica del cambio.",
  };
}

function renderInstitutionalData() {
  const target = $("#institutional-data-details");
  if (!target || !institutionalDataState) return;
  const item = institutionalDataState;
  target.innerHTML = `
    <div class="summary">
      <div><small>Oferta</small><strong>${escapeHtml(item.offeringCode || "—")}</strong></div>
      <div><small>Créditos</small><strong>${item.credits ?? "—"}</strong></div>
      <div><small>Horas ACD / APE / AA</small><strong>${item.acdHours} / ${item.apeHours} / ${item.aaHours}</strong></div>
      <div><small>Semestre</small><strong>${escapeHtml(item.semester || "—")}</strong></div>
      <div><small>Categoría del plan</small><strong>${escapeHtml(item.planCategory || "—")}</strong></div>
    </div>
    <h4>Descripción microcurricular</h4><p>${escapeHtml(item.description || "No registrada")}</p>
    <h4>Prerrequisitos</h4><ul>${(item.prerequisites || []).map((value) => `<li>${escapeHtml(value)}</li>`).join("") || "<li>No aplica</li>"}</ul>
    <h4>Resultados de aprendizaje</h4><ol>${(item.learningOutcomes || []).map((value) => `<li>${escapeHtml(value)}</li>`).join("")}</ol>
    <h4>Unidades y contenidos</h4>${renderInstitutionalUnits(item.unitContents || [])}`;
}

function mappingValueAt(values, index) {
  if (!Array.isArray(values) || !values.length) return "";
  return values[index % values.length];
}

function blankOutcomeMapping(index = 0) {
  const data = institutionalDataState || {};
  return {
    learningOutcome: mappingValueAt(data.learningOutcomes || [], index),
    contribution: "MIDDLE",
    professionalCompetencies: [mappingValueAt(data.professionalProfileCompetencies || [], index)].filter(Boolean),
    graduateProfileResults: [mappingValueAt(data.graduateProfileResults || [], index)].filter(Boolean),
    utplGenericCompetencies: [mappingValueAt(data.utplGenericCompetencies || [], index)].filter(Boolean),
  };
}

function defaultOutcomeMappings() {
  const data = institutionalDataState || {};
  const count = Math.max(
    (data.learningOutcomes || []).length,
    (data.professionalProfileCompetencies || []).length,
    (data.graduateProfileResults || []).length,
    (data.utplGenericCompetencies || []).length,
    1,
  );
  return Array.from({ length: count }, (_, index) => blankOutcomeMapping(index));
}

function readOutcomeMappingsFromDom() {
  return $$("#outcome-mapping-body tr").map((row) => {
    const value = (field) => row.querySelector(`[data-map-field="${field}"]`)?.value || "";
    const selectedValue = (field) => {
      const selected = value(field);
      return selected ? [selected] : [];
    };
    return {
      learningOutcome: value("learningOutcome"), contribution: value("contribution"),
      professionalCompetencies: selectedValue("professionalCompetencies"),
      graduateProfileResults: selectedValue("graduateProfileResults"),
      utplGenericCompetencies: selectedValue("utplGenericCompetencies"),
    };
  });
}

function renderOutcomeMappings() {
  const target = $("#outcome-mapping-body");
  if (!target || !institutionalDataState) return;
  if (!outcomeMappingsState.length) outcomeMappingsState = defaultOutcomeMappings();
  target.innerHTML = outcomeMappingsState.map((mapping, index) => `<tr>
    <td><select data-map-field="learningOutcome" data-map-index="${index}">${selectOptions(institutionalDataState.learningOutcomes || [], [mapping.learningOutcome])}</select></td>
    <td><select data-map-field="contribution" data-map-index="${index}">
      <option value="INITIAL" ${mapping.contribution === "INITIAL" ? "selected" : ""}>Inicial</option>
      <option value="MIDDLE" ${mapping.contribution === "MIDDLE" ? "selected" : ""}>Medio</option>
      <option value="FINAL" ${mapping.contribution === "FINAL" ? "selected" : ""}>Final</option>
    </select></td>
    <td><select data-map-field="professionalCompetencies" data-map-index="${index}"><option value="">Seleccione...</option>${selectOptions(institutionalDataState.professionalProfileCompetencies || [], mapping.professionalCompetencies?.slice(0, 1) || [])}</select></td>
    <td><select data-map-field="graduateProfileResults" data-map-index="${index}"><option value="">Seleccione...</option>${selectOptions(institutionalDataState.graduateProfileResults || [], mapping.graduateProfileResults?.slice(0, 1) || [])}</select></td>
    <td><select data-map-field="utplGenericCompetencies" data-map-index="${index}"><option value="">Seleccione...</option>${selectOptions(institutionalDataState.utplGenericCompetencies || [], mapping.utplGenericCompetencies?.slice(0, 1) || [])}</select></td>
    <td><button class="button ghost mapping-delete" type="button" data-delete-mapping="${index}" aria-label="Eliminar relación ${index + 1}">Eliminar</button></td>
  </tr>`).join("");
}

function normalizeContributionValue(value) {
  return String(value || "").trim().toLocaleLowerCase("es");
}

function relationCombinationKey(mapping) {
  const normalizeList = (values) => (values || []).map(normalizeContributionValue).sort();
  return JSON.stringify([
    normalizeContributionValue(mapping.learningOutcome),
    normalizeList(mapping.professionalCompetencies),
    normalizeList(mapping.graduateProfileResults),
    normalizeList(mapping.utplGenericCompetencies),
  ]);
}

function duplicateContributionRelation(mappings) {
  const seen = new Map();
  for (const [index, mapping] of mappings.entries()) {
    const key = relationCombinationKey(mapping);
    if (seen.has(key)) return { first: seen.get(key) + 1, second: index + 1 };
    seen.set(key, index);
  }
  return null;
}

function missingCoverageItems(mappings) {
  const data = institutionalDataState || {};
  const rules = [
    ["Resultado de aprendizaje", data.learningOutcomes || [], mappings.map((item) => item.learningOutcome)],
    ["Competencia profesional", data.professionalProfileCompetencies || [], mappings.flatMap((item) => item.professionalCompetencies)],
    ["Resultado del perfil de egreso", data.graduateProfileResults || [], mappings.flatMap((item) => item.graduateProfileResults)],
    ["Competencia genérica UTPL", data.utplGenericCompetencies || [], mappings.flatMap((item) => item.utplGenericCompetencies)],
  ];
  return rules.flatMap(([label, expected, received]) => {
    const receivedSet = new Set(received.map(normalizeContributionValue));
    return expected
      .filter((value) => !receivedSet.has(normalizeContributionValue(value)))
      .map((value) => `${label}: ${value}`);
  });
}

function collectOutcomeMappings() {
  const mappings = readOutcomeMappingsFromDom();
  if (mappings.some((item) => !item.learningOutcome || !item.professionalCompetencies.length || !item.graduateProfileResults.length || !item.utplGenericCompetencies.length)) {
    throw new Error("Complete todos los campos de cada relación de contribución.");
  }
  const duplicate = duplicateContributionRelation(mappings);
  if (duplicate) {
    throw new Error(`Las relaciones ${duplicate.first} y ${duplicate.second} tienen la misma combinación. Modifique o elimine una de ellas.`);
  }
  const missing = missingCoverageItems(mappings);
  if (missing.length) {
    throw new Error(`Faltan elementos por relacionar: ${missing.join("; ")}.`);
  }
  outcomeMappingsState = mappings;
  academicProfileState = {
    professionalProfileCompetencies: [...new Set(mappings.flatMap((item) => item.professionalCompetencies))],
    graduateProfileResults: [...new Set(mappings.flatMap((item) => item.graduateProfileResults))],
    utplGenericCompetencies: [...new Set(mappings.flatMap((item) => item.utplGenericCompetencies))],
  };
  return mappings;
}

function addOutcomeMapping() {
  outcomeMappingsState = readOutcomeMappingsFromDom();
  outcomeMappingsState.push(blankOutcomeMapping(outcomeMappingsState.length));
  renderOutcomeMappings();
  scheduleProgressSync();
}

function deleteOutcomeMapping(index) {
  outcomeMappingsState = readOutcomeMappingsFromDom();
  if (outcomeMappingsState.length <= 1) {
    showMessage("Debe conservar al menos una relación de contribución.");
    return;
  }
  outcomeMappingsState.splice(index, 1);
  renderOutcomeMappings();
  scheduleProgressSync();
}


function validateContributionDuplicateLive() {
  const mappings = readOutcomeMappingsFromDom();
  const completeMappings = mappings.filter((item) =>
    item.learningOutcome && item.professionalCompetencies.length &&
    item.graduateProfileResults.length && item.utplGenericCompetencies.length
  );
  const duplicate = duplicateContributionRelation(completeMappings);
  if (duplicate) {
    showMessage(`Combinación duplicada: las relaciones ${duplicate.first} y ${duplicate.second} contienen los mismos elementos. Modifique o elimine una de ellas.`);
  }
}

function setTeacherProfile(profile = null) {
  teacherProfileState = profile;
  $("#third-level-degrees").value = (profile?.thirdLevelDegrees || []).join("\n");
  $("#fourth-level-degrees").value = (profile?.fourthLevelDegrees || []).join("\n");
  $("#teacher-faculty").value = profile?.faculty || form.elements.faculty?.value || "";
  const departmentSelect = $("#teacher-department");
  const requestedDepartmentId = profile?.departmentId || "";
  if (requestedDepartmentId && [...departmentSelect.options].some((option) => option.value === requestedDepartmentId)) departmentSelect.value = requestedDepartmentId;
  else {
    const match = [...departmentSelect.options].find((option) => option.dataset.name === profile?.department);
    departmentSelect.value = match?.value || "";
  }
  $("#teacher-phone").value = profile?.phone || "";
  $("#teacher-short-cv").value = profile?.shortCv || "";
}

function collectTeacherProfile() {
  const profile = {
    thirdLevelDegrees: linesFrom($("#third-level-degrees").value),
    fourthLevelDegrees: linesFrom($("#fourth-level-degrees").value),
    faculty: $("#teacher-faculty").value.trim(),
    departmentId: $("#teacher-department").value || undefined,
    department: $("#teacher-department").selectedOptions[0]?.dataset.name || "",
    phone: $("#teacher-phone").value.trim(), shortCv: $("#teacher-short-cv").value.trim(),
  };
  const errors = [];
  if (!profile.thirdLevelDegrees.length) errors.push("Título(s) de tercer nivel: ingrese al menos un título.");
  if (!profile.faculty) errors.push("Facultad del docente: ingrese la facultad.");
  if (!profile.department) errors.push("Departamento del docente: seleccione un departamento.");
  if (!profile.phone) errors.push("Teléfono del docente: ingrese el teléfono.");
  if (profile.shortCv.length < 30) errors.push("Currículo resumido: debe tener al menos 30 caracteres.");
  if (errors.length) throw new Error(errors.join("; "));
  teacherProfileState = profile;
  return profile;
}

function totalWeeks() {
  return Number.parseInt(form.elements.weeks.value, 10) || 0;
}
function weekState(week) {
  return weekStates[week] || { status: "pending", draftContent: "", approvedContent: "", version: 0 };
}
function persistProject() {
  const formData = data();
  localStorage.setItem(storageKey, JSON.stringify({
    projectId, formData, matrixRows, currentWeek, weekStates,
    matrixFileName: matrixFile?.name || matrixFileName,
    institutionalData: institutionalDataState,
    setup: {
      reviewedAt: $("#institutional-data-reviewed")?.checked ? new Date().toISOString() : null,
      outcomeMappings: outcomeMappingsState,
      teacherProfile: teacherProfileState,
      bibliography: { guideReference: form.elements.guideReference?.value || "", guideReferenceImportance: guideReferenceImportanceState, entries: bibliographyEntriesState },
    },
    teachingPlan: teachingPlanState,
    workflow: {
      mode: workflowModeState,
      legacyDocuments: legacyDocumentsState,
      planProposal: planAdaptationProposalState,
      guideProposal: guideAdaptationProposalState,
    },
  }));
  scheduleDatabaseSync();
}
function applySavedProject(saved) {
  if (!saved) return false;
  projectId = saved.projectId || "";
  matrixFileName = saved.matrixFileName || "";
  institutionalDataState = saved.institutionalData || null;
  outcomeMappingsState = Array.isArray(saved.setup?.outcomeMappings) ? saved.setup.outcomeMappings : [];
  teacherProfileState = saved.setup?.teacherProfile || null;
  bibliographyEntriesState = Array.isArray(saved.setup?.bibliography?.entries) ? saved.setup.bibliography.entries : [];
  guideReferenceImportanceState = saved.setup?.bibliography?.guideReferenceImportance || saved.formData?.guideReferenceImportance || "";
  teachingPlanState = saved.teachingPlan || null;
  workflowModeState = saved.workflow?.mode || null;
  legacyDocumentsState = Array.isArray(saved.workflow?.legacyDocuments) ? saved.workflow.legacyDocuments : [];
  planAdaptationProposalState = saved.workflow?.planProposal || null;
  guideAdaptationProposalState = saved.workflow?.guideProposal || null;
  const savedForm = saved.formData || {};
  setAcademicProfileState(savedForm);
  if (savedForm.level) {
    ensureSelectValue(level, savedForm.level);
    level.value = savedForm.level;
    fillSelect(modality, Object.keys(offer[savedForm.level] || {}), "Seleccione una modalidad");
  }
  if (savedForm.modality) {
    fillSelect(faculty, Object.keys(offer[savedForm.level]?.[savedForm.modality] || {}), "Seleccione una facultad o unidad");
    ensureSelectValue(modality, savedForm.modality);
    modality.value = savedForm.modality;
  }
  if (savedForm.faculty) {
    fillSelect(career, offer[savedForm.level]?.[savedForm.modality]?.[savedForm.faculty] || [], "Seleccione una carrera o programa");
    ensureSelectValue(faculty, savedForm.faculty);
    faculty.value = savedForm.faculty;
  }
  ensureSelectValue(career, savedForm.career);
  ensureSelectValue(form.elements.subjectType, savedForm.subjectType, savedForm.subjectTypeName || savedForm.subjectType);
  Object.entries(savedForm).forEach(([name, value]) => {
    const field = form.elements[name];
    if (field && typeof field.value !== "undefined") field.value = value;
  });
  ensureGuideReference();
  lockInstitutionalFields();
  syncProfessorName();
  matrixRows = Array.isArray(saved.matrixRows) ? saved.matrixRows : [];
  currentWeek = Number(saved.currentWeek) || 1;
  weekStates = saved.weekStates || {};
  const persistedStep = Number(saved.currentStep);
  step = Number.isInteger(persistedStep) && persistedStep >= 1 && persistedStep <= 5
    ? persistedStep
    : (teachingPlanState ? (Object.keys(weekStates).length ? 5 : 4) : (saved.setup?.reviewedAt ? 4 : 1));
  if (teachingPlanState && !teachingPlanState.reviewedAt && step > 4) step = 4;
  const fileName = $("#file-name");
  if (matrixFileName && fileName) fileName.textContent = matrixFileName;
  const reviewed = $("#institutional-data-reviewed");
  if (reviewed) reviewed.checked = Boolean(saved.setup?.reviewedAt);
  renderInstitutionalData();
  renderOutcomeMappings();
  setTeacherProfile(teacherProfileState);
  renderBibliographyEntries();
  renderGuideReferenceImportance();
  renderTeachingPlan();
  renderWorkflowState();
  return true;
}
let progressSyncTimer;
let microcurricularPresentationGenerating = false;
async function generateMicrocurricularPresentation({ automatic = false } = {}) {
  if (!projectId || microcurricularPresentationGenerating) return;
  const field = $("#microcurricular-presentation");
  const button = $("#generate-microcurricular-presentation");
  const status = $("#microcurricular-presentation-status");
  if (!field) return;
  microcurricularPresentationGenerating = true;
  if (button) { button.disabled = true; button.textContent = "Generando…"; }
  if (status) status.textContent = "Preparando un borrador dirigido al estudiante…";
  try {
    const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/microcurricular-presentation/generate`, { method: "POST" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "No fue posible generar la presentación de la asignatura.");
    field.value = payload.presentation || "";
    if (status) status.textContent = "Borrador generado. Revíselo y edítelo si es necesario antes de continuar.";
    scheduleProgressSync();
  } catch (error) {
    if (status) status.textContent = automatic
      ? "No se pudo generar el borrador automáticamente. Puede escribirlo manualmente o intentar nuevamente."
      : "No fue posible generar el borrador.";
    if (!automatic) showValidationModal(error.message, "#microcurricular-presentation");
    throw error;
  } finally {
    microcurricularPresentationGenerating = false;
    if (button) { button.disabled = false; button.textContent = "Generar borrador con IA"; }
  }
}
function validateMicrocurricularPresentation() {
  const field = $("#microcurricular-presentation");
  const value = String(field?.value || "").trim();
  if (value.length < 80) throw new Error("Presentación y contextualización: revise el borrador y complete al menos 80 caracteres dirigidos al estudiante.");
  return value;
}
function draftTeacherProfilePayload() {
  return {
    thirdLevelDegrees: linesFrom($("#third-level-degrees")?.value || ""),
    fourthLevelDegrees: linesFrom($("#fourth-level-degrees")?.value || ""),
    faculty: $("#teacher-faculty")?.value.trim() || "",
    departmentId: $("#teacher-department")?.value || undefined,
    department: $("#teacher-department")?.selectedOptions[0]?.dataset.name || "",
    phone: $("#teacher-phone")?.value.trim() || "",
    shortCv: $("#teacher-short-cv")?.value.trim() || "",
  };
}
function draftProgressPayload() {
  return {
    currentStep: step,
    institutionalDataReviewed: Boolean($("#institutional-data-reviewed")?.checked),
    microcurricularPresentation: $("#microcurricular-presentation")?.value.trim() || "",
    outcomeMappings: $("#outcome-mapping-body")?.children.length ? readOutcomeMappingsFromDom() : outcomeMappingsState,
    teacherProfile: draftTeacherProfilePayload(),
    bibliography: {
      guideReference: form.elements.guideReference?.value || "",
      guideReferenceImportance: guideReferenceImportanceState,
      entries: bibliographyEntriesState,
      basic: bibliographyLegacyText("BASIC"),
      complementary: bibliographyLegacyText("COMPLEMENTARY"),
      rea: bibliographyLegacyText("REA"),
    },
  };
}
async function syncDraftProgress() {
  if (!projectId || step > 3) return;
  const draft = draftProgressPayload();
  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/progress`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(draft),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "No fue posible guardar el progreso.");
  if (workflowModeState === "ADAPTATION_16_TO_8" && draft.currentStep < 4 &&
      (planAdaptationProposalState || guideAdaptationProposalState)) {
    planAdaptationProposalState = null;
    guideAdaptationProposalState = null;
    renderAdaptationWorkspaces();
  }
}
function scheduleProgressSync() {
  if (!projectId || step > 3) return;
  clearTimeout(progressSyncTimer);
  progressSyncTimer = setTimeout(() => {
    syncDraftProgress().catch((error) => console.error("Guardado automático pendiente:", error));
  }, 450);
}

function databasePayload() {
  const project = data();
  return {
    projectId: projectId || undefined,
    currentWeek,
    project: {
      projectName: project.projectName,
      level: project.level,
      faculty: project.faculty,
      career: project.career,
      professorName: project.professorName,
      subjectCode: project.subjectCode,
      subjectName: project.subjectName,
      subjectType: project.subjectType,
      subjectTypeLabel: project.subjectTypeName || project.subjectType,
      modality: project.modality,
      academicPeriod: project.academicPeriod,
      weeks: Number(project.weeks),
      professionalProfileCompetencies: project.professionalProfileCompetencies,
      graduateProfileResults: project.graduateProfileResults,
      utplGenericCompetencies: project.utplGenericCompetencies,
    },
    bibliography: {
      guideReference: project.guideReference || "",
      guideReferenceImportance: guideReferenceImportanceState,
      basic: bibliographyLegacyText("BASIC"),
      complementary: bibliographyLegacyText("COMPLEMENTARY"),
      rea: bibliographyLegacyText("REA"),
    },
    matrixFileName: matrixFile?.name || matrixFileName,
    matrixRows,
    weekStates,
  };
}
function canSyncDatabase() {
  const payload = databasePayload();
  return Boolean(payload.projectId) && payload.matrixRows.length > 0 &&
    payload.project.weeks > 0 &&
    ["projectName", "level", "faculty", "career", "professorName", "subjectCode", "subjectName", "subjectType", "modality", "academicPeriod"]
      .every((key) => String(payload.project[key] || "").trim()) &&
    payload.project.professionalProfileCompetencies.length > 0 &&
    payload.project.graduateProfileResults.length > 0 &&
    payload.bibliography.guideReference?.trim() &&
    payload.bibliography.guideReferenceImportance?.trim();
}
async function syncDatabase() {
  if (!canSyncDatabase()) return;
  const response = await fetch("/api/projects/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(databasePayload()),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "No fue posible guardar el proyecto.");
  projectId = payload.projectId;
  const local = JSON.parse(localStorage.getItem(storageKey) || "{}");
  local.projectId = projectId;
  localStorage.setItem(storageKey, JSON.stringify(local));
  updateGuideDownloadButtons();
}
function scheduleDatabaseSync() {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncDatabase().catch((error) => {
      console.error("Respaldo local activo; guardado en base pendiente:", error);
    });
  }, 500);
}
async function restoreProject() {}

const statusLabels = { DRAFT: "Borrador", IN_PROGRESS: "En elaboración", COMPLETED: "Finalizado" };
function formatProjectDate(value) {
  return new Intl.DateTimeFormat("es-EC", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
function projectProgressLabel(project) {
  if (!project.workflowMode) return "Seleccione el tipo de elaboración";
  if (project.workflowMode === "ADAPTATION_16_TO_8") {
    if (!project.legacyPlanUploaded) return "Adaptación 16 → 8 · cargue el Plan anterior";
    if (project.currentStep < 4) {
      const label = ["", "Revisión", "Contribución y docente", "Bibliografía"][project.currentStep] || "Preparación";
      return `Adaptación 16 → 8 · ${label}`;
    }
    if (project.currentStep === 4) {
      if (project.adaptationPlanStatus === "READY_FOR_REVIEW") return "Adaptación del Plan · propuesta pendiente de revisión";
      if (project.adaptationPlanStatus === "APPROVED") return "Adaptación del Plan aprobada · genere el documento";
      return "Adaptación del Plan · análisis pendiente";
    }
    if (project.legacyGuideUploaded) {
      if (project.adaptationGuideStatus === "READY_FOR_REVIEW") return "Adaptación de la Guía · propuesta pendiente de revisión";
      if (project.adaptationGuideStatus === "APPROVED") return `${project.approvedWeeks} de ${project.totalWeeks} semanas de guía adaptada`;
      return "Adaptación de la Guía · análisis pendiente";
    }
    return `${project.approvedWeeks} de ${project.totalWeeks} semanas de guía nueva`;
  }
  return project.currentStep < 5
    ? `Paso ${project.currentStep} de 5 · ${["", "Revisión", "Contribución y docente", "Bibliografía", "Plan docente"][project.currentStep] || "Elaboración"}`
    : `${project.approvedWeeks} de ${project.totalWeeks} semanas de guía`;
}
function projectCard(project) {
  const completed = project.status === "COMPLETED";
  const workflowBadge = project.workflowMode === "ADAPTATION_16_TO_8"
    ? '<span class="workflow-badge adaptation">Adaptación 16 → 8</span>'
    : project.workflowMode === "NEW" ? '<span class="workflow-badge">Creación nueva</span>' : '';
  return `<article class="saved-project">
    <div class="saved-project-main">
      <div class="saved-project-title">
        <span class="status-badge status-${project.status.toLowerCase()}">${statusLabels[project.status] || project.status}</span>
        ${workflowBadge}
        <h3>${escapeHtml(project.subjectName)}</h3>
      </div>
      <p class="project-code">${escapeHtml(project.subjectCode || "Sin código")} · ${escapeHtml(project.projectName)}</p>
      <dl>
        <div><dt>Profesor</dt><dd>${escapeHtml(project.professorName || "No registrado")}</dd></div>
        <div><dt>Carrera</dt><dd>${escapeHtml(project.career)}</dd></div>
        <div><dt>Progreso</dt><dd>${escapeHtml(projectProgressLabel(project))}</dd></div>
        <div><dt>Actualizado</dt><dd>${formatProjectDate(project.updatedAt)}</dd></div>
      </dl>
    </div>
    <button class="button ${completed ? "secondary" : ""}" data-open-project="${project.projectId}">
      ${completed ? "Ver guía" : "Continuar"}
    </button>
  </article>`;
}
async function loadProjects(search = "") {
  const list = $("#projects-list");
  list.innerHTML = '<p class="projects-empty">Cargando proyectos…</p>';
  try {
    const response = await fetch(`/api/projects?search=${encodeURIComponent(search)}`, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "No fue posible consultar los proyectos.");
    list.innerHTML = payload.projects.length
      ? payload.projects.map(projectCard).join("")
      : `<div class="projects-empty"><strong>No se encontraron asignaturas.</strong><span>${search ? "Pruebe con otra asignatura o código." : "Solicite al administrador que le asigne una oferta académica."}</span></div>`;
  } catch (error) {
    list.innerHTML = `<p class="projects-empty error">${escapeHtml(error.message)}</p>`;
  }
}
async function openSavedProject(id) {
  const response = await fetch(`/api/projects/${encodeURIComponent(id)}`, { cache: "no-store" });
  const payload = await response.json();
  if (!response.ok || !payload.project) throw new Error(payload.error || "No fue posible abrir el proyecto.");
  form.reset();
  setAcademicProfileState();
  syncProfessorName();
  if (!applySavedProject(payload.project)) return;
  localStorage.setItem(storageKey, JSON.stringify(payload.project));
  openWizard();
  if (step === 5) updateWeekInterface();
}

function iconAction(symbol, label, extra = "") {
  return `<button class="icon-action ${extra}" type="button" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">${symbol}</button>`;
}
function linesListHtml(value) {
  const items = String(value || "").split(/\r?\n|[•·]\s*/u).map((item) => item.trim()).filter(Boolean);
  return items.length ? `<ul class="plan-strategy-list">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : "—";
}
function formatDateEc(value) {
  if (!value) return "";
  const date = new Date(value); if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-EC", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(date);
}
function planPeriodState() {
  if (institutionalDataState?.periodStartsAt || institutionalDataState?.bimestralEvaluationStartAt || institutionalDataState?.recoveryEvaluationStartAt) return {
    startsAt: institutionalDataState.periodStartsAt,
    endsAt: institutionalDataState.periodEndsAt,
    bimestralEvaluationStartAt: institutionalDataState.bimestralEvaluationStartAt,
    bimestralEvaluationEndAt: institutionalDataState.bimestralEvaluationEndAt,
    recoveryEvaluationStartAt: institutionalDataState.recoveryEvaluationStartAt,
    recoveryEvaluationEndAt: institutionalDataState.recoveryEvaluationEndAt,
  };
  const periodName = String(form?.elements?.academicPeriod?.value || "");
  return (academicCatalog?.periods || []).find((item) => item.name === periodName || item.code === periodName) || null;
}
function planEvaluationWindowLabel(start, end) {
  if (!start && !end) return "No configurado";
  if (start && end && formatDateEc(start) !== formatDateEc(end)) return `${formatDateEc(start)} al ${formatDateEc(end)}`;
  return formatDateEc(start || end);
}
function planWeekDateRange(weekNumber) {
  const period = planPeriodState(); if (!period?.startsAt) return "";
  const start = new Date(period.startsAt); const day = start.getUTCDay(); const offset = day === 0 ? -6 : 1 - day;
  start.setUTCDate(start.getUTCDate() + offset + ((Number(weekNumber) - 1) * 7)); const end = new Date(start); end.setUTCDate(end.getUTCDate() + 6);
  return `${formatDateEc(start)} al ${formatDateEc(end)}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}
function adminActionIcon(kind) {
  const paths = {
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    activate: '<path d="M20 6 9 17l-5-5"/>',
    deactivate: '<circle cx="12" cy="12" r="9"/><path d="M8 12h8"/>',
    delete: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/>',
  };
  return `<svg class="admin-action-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths[kind] || paths.edit}</svg>`;
}
function adminActionButton(kind, label, attributes, extraClass = "") {
  return `<button type="button" class="admin-icon-action ${extraClass}" ${attributes} aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">${adminActionIcon(kind)}</button>`;
}
function inlineMarkdownToHtml(value) {
  return escapeHtml(value)
    .replace(/&lt;br\s*\/?&gt;/gi, "<br>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "<em>$1</em>");
}
function markdownToHtml(markdown) {
  const originalLines = String(markdown || "").replace(/\r\n?/g, "\n").split("\n");
  const lines = originalLines.filter((line, index) => {
    if (index === 0) return true;
    const current = line.trim().replace(/\s+/g, " ").toLowerCase();
    const previous = originalLines[index - 1].trim().replace(/\s+/g, " ").toLowerCase();
    return !(current && current === previous && /^(?:\*\*)?tabla\s+\d+/i.test(current));
  });
  const html = [];
  let listType = "";
  let tableNumber = 0;
  let pendingResourceTableKind = "";
  const tableCells = (line) => line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
  const isTableSeparator = (line) => {
    const cells = tableCells(line);
    return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
  };
  const closeList = () => {
    if (listType) html.push(`</${listType}>`);
    listType = "";
  };
  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const line = rawLine.trim();
    if (!line) {
      closeList();
      continue;
    }
    const resourceTableMarker = line.match(/^<!--\s*GUIDE_RESOURCE_TABLE:(FICHA|GUION)\s*-->$/i);
    if (resourceTableMarker) {
      closeList();
      pendingResourceTableKind = resourceTableMarker[1].toLowerCase();
      continue;
    }
    const callout = line.match(/^>\s*\[!(IMPORTANT|NOTE|TIP|WARNING|QUESTION|EXAMPLE|DEFINITION|REFLECTION)\]\s*(.*)$/i);
    if (callout) {
      closeList();
      const variants = { IMPORTANT: "important", NOTE: "remember", TIP: "tip", WARNING: "warning", QUESTION: "question", EXAMPLE: "example", DEFINITION: "definition", REFLECTION: "reflection" };
      const labels = { important: "Importante", remember: "Recuerde", tip: "Sugerencia", warning: "Atención", question: "Pregunta", example: "Ejemplo", definition: "Definición", reflection: "Reflexione" };
      const variant = variants[callout[1].toUpperCase()] || "important";
      const body = [];
      let cursor = index + 1;
      while (cursor < lines.length) {
        const quoted = String(lines[cursor] || "").trim().match(/^>\s?(.*)$/);
        if (!quoted) break;
        if (quoted[1].trim()) body.push(quoted[1].trim());
        cursor += 1;
      }
      const title = callout[2].trim() || labels[variant];
      html.push(`<aside class="guide-callout guide-callout-${variant}" data-callout="${variant}"><strong class="guide-callout-title">${inlineMarkdownToHtml(title)}</strong>${body.length ? `<p>${inlineMarkdownToHtml(body.join(" "))}</p>` : ""}</aside>`);
      index = cursor - 1;
      continue;
    }
    const image = line.match(/^!\[([^\]]*)\]\((\/api\/generated-images\/[0-9a-f-]{36}|data:image\/[^)]+|https?:\/\/[^)]+)\)$/i);
    if (image) {
      closeList();
      html.push(`<figure class="generated-figure"><img src="${escapeHtml(image[2])}" alt="${escapeHtml(image[1])}" loading="lazy"><figcaption>${escapeHtml(image[1])}</figcaption></figure>`);
      continue;
    }
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      closeList();
      const level = Math.min(4, Math.max(2, heading[1].length));
      html.push(`<h${level}>${inlineMarkdownToHtml(heading[2])}</h${level}>`);
      continue;
    }
    const nextLine = String(lines[index + 1] || "").trim();
    if (line.includes("|") && isTableSeparator(nextLine)) {
      closeList();
      const resourceTableKind = pendingResourceTableKind;
      pendingResourceTableKind = "";
      if (!resourceTableKind) {
        tableNumber += 1;
        let previousIndex = index - 1;
        while (previousIndex >= 0 && !String(lines[previousIndex] || "").trim()) previousIndex -= 1;
        const previousLine = String(lines[previousIndex] || "").trim();
        if (!/^(?:\*\*)?tabla\s+\d+/i.test(previousLine)) {
          html.push(`<p class="table-caption"><strong>Tabla ${tableNumber}</strong></p>`);
        }
      }
      const headers = tableCells(line);
      index += 2;
      const rows = [];
      while (index < lines.length && String(lines[index] || "").includes("|")) {
        rows.push(tableCells(lines[index]));
        index += 1;
      }
      index -= 1;
      html.push(`<div class="generated-table-wrapper${resourceTableKind ? " resource-production-table" : ""}"${resourceTableKind ? ` data-resource-table="${resourceTableKind}"` : ""}><table class="generated-table"><thead><tr>`);
      headers.forEach((cell) => html.push(`<th scope="col">${inlineMarkdownToHtml(cell)}</th>`));
      html.push("</tr></thead><tbody>");
      rows.forEach((cells) => {
        html.push("<tr>");
        headers.forEach((_, cellIndex) => html.push(`<td>${inlineMarkdownToHtml(cells[cellIndex] || "")}</td>`));
        html.push("</tr>");
      });
      html.push("</tbody></table></div>");
      continue;
    }
    const unordered = line.match(/^[-*]\s+(.+)$/);
    const ordered = line.match(/^\d+[.)]\s+(.+)$/);
    if (unordered || ordered) {
      const nextType = ordered ? "ol" : "ul";
      if (listType !== nextType) {
        closeList();
        html.push(`<${nextType}>`);
        listType = nextType;
      }
      html.push(`<li>${inlineMarkdownToHtml((ordered || unordered)[1])}</li>`);
      continue;
    }
    closeList();
    html.push(`<p>${inlineMarkdownToHtml(line)}</p>`);
  }
  closeList();
  return html.join("");
}
function inlineHtmlToMarkdown(element) {
  let result = "";
  element.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      result += node.textContent;
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const tag = node.tagName.toLowerCase();
    if (tag === "img") {
      result += `![${node.getAttribute("alt") || "Imagen educativa"}](${node.getAttribute("src") || ""})`;
      return;
    }
    const content = inlineHtmlToMarkdown(node);
    if (tag === "strong" || tag === "b") result += `**${content}**`;
    else if (tag === "em" || tag === "i") result += `*${content}*`;
    else if (tag === "u") result += content;
    else if (tag === "a") result += `[${content}](${node.getAttribute("href") || ""})`;
    else if (tag === "br") result += "\n";
    else result += content;
  });
  return result;
}
function editorToMarkdown(editor) {
  const blocks = [];
  editor.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent.trim();
      if (text) blocks.push(text);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const tag = node.tagName.toLowerCase();
    if (tag === "aside" && node.classList.contains("guide-callout")) {
      const reverse = { important: "IMPORTANT", remember: "NOTE", tip: "TIP", warning: "WARNING", question: "QUESTION", example: "EXAMPLE", definition: "DEFINITION", reflection: "REFLECTION" };
      const variant = reverse[node.dataset.callout] || "IMPORTANT";
      const titleNode = node.querySelector(".guide-callout-title");
      const bodyNode = node.querySelector("p");
      const title = titleNode ? inlineHtmlToMarkdown(titleNode).trim() : "";
      const body = bodyNode ? inlineHtmlToMarkdown(bodyNode).trim() : "";
      blocks.push(`> [!${variant}]${title ? ` ${title}` : ""}${body ? `\n> ${body}` : ""}`);
    }
    else if (tag === "figure") {
      const image = node.querySelector("img");
      if (image) blocks.push(`![${image.getAttribute("alt") || "Imagen educativa"}](${image.getAttribute("src") || ""})`);
    }
    else if (tag === "div" && node.classList.contains("generated-table-wrapper")) {
      const table = node.querySelector("table");
      if (table) {
        const rows = [...table.rows].map((row) => [...row.cells].map((cell) => inlineHtmlToMarkdown(cell).trim().replace(/\n/g, "<br>")));
        if (rows.length) {
          const resourceTableKind = node.dataset.resourceTable;
          const marker = resourceTableKind ? `<!-- GUIDE_RESOURCE_TABLE:${resourceTableKind.toUpperCase()} -->\n` : "";
          blocks.push(`${marker}| ${rows[0].join(" | ")} |\n| ${rows[0].map(() => "---").join(" | ")} |${rows.slice(1).map((row) => `\n| ${row.join(" | ")} |`).join("")}`);
        }
      }
    }
    else if (tag === "h1" || tag === "h2") blocks.push(`## ${inlineHtmlToMarkdown(node)}`);
    else if (tag === "h3") blocks.push(`### ${inlineHtmlToMarkdown(node)}`);
    else if (tag === "h4") blocks.push(`#### ${inlineHtmlToMarkdown(node)}`);
    else if (tag === "ul" || tag === "ol") {
      [...node.children].forEach((item, index) => {
        blocks.push(`${tag === "ol" ? `${index + 1}.` : "-"} ${inlineHtmlToMarkdown(item)}`);
      });
    } else {
      const text = inlineHtmlToMarkdown(node).trim();
      if (text) blocks.push(text);
    }
  });
  return blocks.join("\n\n").trim();
}
function fillSelect(select, values, placeholder) {
  select.innerHTML = `<option value="">${escapeHtml(placeholder)}</option>${values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("")}`;
  select.disabled = !values.length;
}
function ensureSelectValue(select, value, label = value) {
  if (!select || !value) return;
  const existing = [...select.options].find((option) => option.value === value);
  if (existing) {
    if (label && existing.textContent !== label) existing.textContent = label;
    return;
  }
  select.add(new Option(label || value, value));
}
function resetAcademicFields(from) {
  if (from === "level") {
    fillSelect(modality, [], "Seleccione primero el nivel");
    fillSelect(faculty, [], "Seleccione primero la modalidad");
    fillSelect(career, [], "Seleccione primero la facultad");
  } else if (from === "modality") {
    fillSelect(faculty, [], "Seleccione primero la modalidad");
    fillSelect(career, [], "Seleccione primero la facultad");
  } else {
    fillSelect(career, [], "Seleccione primero la facultad");
  }
}
fillSelect(level, Object.keys(offer), "Seleccione un nivel");
level.addEventListener("change", () => {
  resetAcademicFields("level");
  fillSelect(modality, Object.keys(offer[level.value] || {}), "Seleccione una modalidad");
});
modality.addEventListener("change", () => {
  resetAcademicFields("modality");
  fillSelect(faculty, Object.keys(offer[level.value]?.[modality.value] || {}), "Seleccione una facultad o unidad");
});
faculty.addEventListener("change", () => {
  resetAcademicFields("faculty");
  fillSelect(career, offer[level.value]?.[modality.value]?.[faculty.value] || [], "Seleccione una carrera o programa");
});

const showMessage = (text = "") => {
  message.textContent = text;
  message.classList.toggle("hidden", !text);
};

function contributionValidationDetails(errorMessage = "") {
  const duplicateMatch = errorMessage.match(/Las relaciones (\d+) y (\d+) tienen la misma combinación/i);
  const missingPrefix = "Faltan elementos por relacionar:";
  const sections = [];
  if (duplicateMatch) sections.push({ title: "Relaciones duplicadas", items: [`Las relaciones ${duplicateMatch[1]} y ${duplicateMatch[2]} contienen exactamente la misma combinación. Modifique o elimine una de ellas.`] });
  if (errorMessage.startsWith(missingPrefix)) {
    const items = errorMessage.slice(missingPrefix.length).replace(/\.$/, "").split(";").map((item) => item.trim()).filter(Boolean);
    sections.push({ title: "Elementos sin relacionar", items });
  }
  if (!sections.length) {
    const items = errorMessage.split(";").map((item) => item.trim()).filter(Boolean);
    sections.push({ title: "Revise la información", items });
  }
  return sections;
}

function showContributionValidationModal(errorMessage) {
  const modal = $("#contribution-validation-modal");
  const eyebrow = $("#validation-modal-eyebrow");
  if (eyebrow) eyebrow.textContent = "Revisión de relaciones";
  if (modal) modal.dataset.validationTarget = /relaci|matriz|resultado de aprendizaje|competencia|perfil de egreso/i.test(errorMessage) ? "relations" : "general";
  const body = $("#contribution-validation-body");
  if (!modal || !body) return showMessage(errorMessage);
  body.innerHTML = contributionValidationDetails(errorMessage).map((section) => `
    <section class="validation-modal-section">
      <h3>${escapeHtml(section.title)}</h3>
      <ul>${section.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </section>`).join("");
  modal.classList.remove("hidden");
  $("#contribution-validation-close")?.focus();
}

function showValidationModal(errorMessage, focusSelector = "") {
  const modal = $("#contribution-validation-modal");
  const eyebrow = $("#validation-modal-eyebrow");
  if (eyebrow) eyebrow.textContent = /Conocimiento e IA|formato de plan docente|prompt de plan docente|documento institucional/i.test(errorMessage)
    ? "Configuración requerida"
    : "Validación del proceso";
  if (modal) {
    modal.dataset.validationTarget = "custom";
    modal.dataset.validationFocus = focusSelector;
  }
  const body = $("#contribution-validation-body");
  if (!modal || !body) return showAdminMessage(errorMessage, true);
  body.innerHTML = `<section class="validation-modal-section"><h3>Revise la información</h3><ul><li>${escapeHtml(errorMessage)}</li></ul></section>`;
  modal.classList.remove("hidden");
  $("#contribution-validation-close")?.focus();
}

function closeContributionValidationModal() {
  const modal = $("#contribution-validation-modal");
  modal?.classList.add("hidden");
  if (modal?.dataset.validationTarget === "custom") {
    const selector = modal.dataset.validationFocus;
    const target = selector ? $(selector) : null;
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
    target?.focus();
    modal.dataset.validationFocus = "";
  } else if (modal?.dataset.validationTarget === "relations") {
    $("#outcome-mapping-table")?.scrollIntoView({ behavior: "smooth", block: "start" });
  } else {
    const target = !$("#teacher-department")?.value ? $("#teacher-department")
      : !$("#third-level-degrees")?.value.trim() ? $("#third-level-degrees")
        : !$("#teacher-faculty")?.value.trim() ? $("#teacher-faculty")
          : !$("#teacher-phone")?.value.trim() ? $("#teacher-phone")
            : $("#teacher-short-cv");
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
    target?.focus();
  }
}

$("#contribution-validation-close")?.addEventListener("click", closeContributionValidationModal);
$("#contribution-validation-modal")?.addEventListener("click", (event) => {
  if (event.target.id === "contribution-validation-modal") closeContributionValidationModal();
});

const adaptationActionLabels = {
  KEEP: "Conservar con ajuste de secuencia",
  GROUP: "Consolidar semanas",
  MERGE: "Integrar contenidos",
  SYNTHESIZE: "Sintetizar contenidos",
  MOVE: "Trasladar a otras semanas",
  REFORMULATE: "Reformular pedagógicamente",
  DELETE: "Proponer omisión",
  SPLIT: "Dividir en semanas consecutivas",
  UPDATE: "Actualizar formulación",
};
const adaptationDecisionLabels = {
  PENDING: "Pendiente de revisión",
  ACCEPTED: "Aceptar propuesta",
  EDITED: "Aceptar con edición del profesor",
  REJECTED: "Rechazar esta propuesta",
  REGENERATE: "Solicitar otra propuesta",
};

function legacyDocument(type) {
  return legacyDocumentsState.find((document) => document.type === type && document.active !== false) || null;
}

function modularGuideHasContent() {
  return Object.values(weekStates).some((week) =>
    week.status !== "pending" || Boolean(week.draftContent) || Boolean(week.approvedContent));
}

function workflowModeCanChange() {
  return !teachingPlanState && !modularGuideHasContent() &&
    legacyDocumentsState.length === 0 &&
    !planAdaptationProposalState && !guideAdaptationProposalState;
}

function formatFileSize(bytes) {
  if (!Number.isFinite(Number(bytes))) return "";
  const value = Number(bytes);
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function renderLegacyDocumentSummaries() {
  const render = (type, selector, emptyText) => {
    const container = $(selector);
    if (!container) return;
    const document = legacyDocument(type);
    container.classList.toggle("complete", Boolean(document));
    container.innerHTML = document
      ? `<strong>${escapeHtml(document.originalName)}</strong><br><span>${escapeHtml(document.academicPeriod || "Periodo no indicado")}${document.versionLabel ? ` · ${escapeHtml(document.versionLabel)}` : ""} · ${escapeHtml(formatFileSize(document.sizeBytes))}</span><br><a href="/api/projects/${encodeURIComponent(projectId)}/adaptation/documents/${encodeURIComponent(document.id)}">Descargar archivo conservado</a>`
      : escapeHtml(emptyText);
  };
  render("PLAN_16_WEEKS", "#legacy-plan-summary", "Todavía no se ha cargado el Plan Docente anterior.");
  render("GUIDE_16_WEEKS", "#legacy-guide-summary", "La Guía Didáctica anterior puede cargarse ahora o antes de comenzar su adaptación.");
  const guideStarted = modularGuideHasContent();
  const planLocked = Boolean(teachingPlanState) || guideStarted;
  const planForm = $("#legacy-plan-form");
  const guideForm = $("#legacy-guide-form");
  const lockForm = (uploadForm, locked, message) => {
    if (!uploadForm) return;
    uploadForm.querySelector('input[type="file"]')?.toggleAttribute("disabled", locked);
    const submit = uploadForm.querySelector('button[type="submit"]');
    if (submit) {
      submit.disabled = locked;
      submit.title = locked ? message : "";
    }
  };
  lockForm(planForm, planLocked, "El Plan modular ya fue generado; el documento de origen queda bloqueado para esta versión.");
  lockForm(guideForm, guideStarted, "La Guía modular ya tiene contenido; el documento de origen queda bloqueado para esta versión.");
  const continueButton = $("#continue-after-legacy-upload");
  if (continueButton) {
    continueButton.disabled = !legacyDocument("PLAN_16_WEEKS");
    continueButton.textContent = step >= 5
      ? "Volver a la Guía Didáctica →"
      : step === 4 ? "Volver al Plan Docente →" : "Continuar con la revisión institucional →";
  }
  const changeButton = $("#change-workflow-mode");
  if (changeButton) {
    const locked = !workflowModeCanChange();
    changeButton.disabled = locked;
    changeButton.textContent = locked ? "Tipo de elaboración fijado" : "Cambiar tipo de elaboración";
  }
  const bannerText = $("#adaptation-source-banner-text");
  if (bannerText) {
    const guideText = legacyDocument("GUIDE_16_WEEKS") ? "Plan y Guía anteriores registrados." : "Plan anterior registrado; la Guía puede añadirse después.";
    bannerText.textContent = guideText;
  }
}

function renderWorkflowState(options = {}) {
  const gate = $("#workflow-mode-gate");
  const sourcePanel = $("#adaptation-source-panel");
  const main = $("#workflow-main");
  const banner = $("#adaptation-source-banner");
  const selectionSummary = $("#workflow-selection-summary");
  const selectionLabel = $("#workflow-selection-label");
  const changeMain = $("#change-workflow-mode-main");
  if (!gate || !sourcePanel || !main) return;
  const forceSources = Boolean(options.showSources);
  gate.classList.toggle("hidden", Boolean(workflowModeState));
  if (!workflowModeState) {
    sourcePanel.classList.add("hidden");
    main.classList.add("hidden");
    selectionSummary?.classList.add("hidden");
    return;
  }
  selectionSummary?.classList.remove("hidden");
  if (selectionLabel) {
    selectionLabel.textContent = workflowModeState === "ADAPTATION_16_TO_8"
      ? "Adaptación pedagógica de documentos existentes · 16 → 8 semanas"
      : "Creación de un Plan Docente nuevo";
  }
  if (changeMain) {
    const locked = !workflowModeCanChange();
    changeMain.disabled = locked;
    changeMain.textContent = locked ? "Tipo de elaboración fijado" : "Cambiar tipo de elaboración";
  }
  if (workflowModeState === "NEW") {
    sourcePanel.classList.add("hidden");
    main.classList.remove("hidden");
    banner?.classList.add("hidden");
  } else {
    const hasPlan = Boolean(legacyDocument("PLAN_16_WEEKS"));
    const showSources = forceSources || !hasPlan;
    sourcePanel.classList.toggle("hidden", !showSources);
    main.classList.toggle("hidden", showSources);
    banner?.classList.toggle("hidden", showSources);
    renderLegacyDocumentSummaries();
  }
  renderAdaptationWorkspaces();
}

async function selectWorkflowMode(mode) {
  if (!projectId) return;
  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/workflow-mode`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "No fue posible guardar el tipo de elaboración.");
  workflowModeState = payload.workflowMode;
  renderWorkflowState({ showSources: workflowModeState === "ADAPTATION_16_TO_8" });
  persistProject();
}

async function uploadLegacyDocument(formElement, type) {
  const file = formElement.elements.file.files[0];
  if (!file) throw new Error(type === "PLAN_16_WEEKS" ? "Seleccione el Plan Docente anterior." : "Seleccione la Guía Didáctica anterior.");
  if (!/\.(pdf|docx)$/i.test(file.name)) throw new Error("Use un archivo PDF o Word (.docx).");
  if (file.size > 25 * 1024 * 1024) throw new Error("El archivo supera el límite de 25 MB.");
  const content = await toBase64(file);
  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/adaptation/documents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type,
      originalName: file.name,
      mimeType: file.name.toLowerCase().endsWith(".pdf")
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      content,
      academicPeriod: formElement.elements.academicPeriod.value.trim(),
      versionLabel: formElement.elements.versionLabel.value.trim(),
    }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "No fue posible guardar el documento anterior.");
  legacyDocumentsState = legacyDocumentsState.filter((item) => item.type !== type);
  legacyDocumentsState.push(payload.document);
  if (type === "PLAN_16_WEEKS") planAdaptationProposalState = null;
  else guideAdaptationProposalState = null;
  formElement.elements.file.value = "";
  renderLegacyDocumentSummaries();
  renderAdaptationWorkspaces();
  persistProject();
}

function adaptationProposalState(target) {
  return target === "PLAN" ? planAdaptationProposalState : guideAdaptationProposalState;
}
function setAdaptationProposalState(target, proposal) {
  if (target === "PLAN") planAdaptationProposalState = proposal;
  else guideAdaptationProposalState = proposal;
}
function adaptationProposalApproved(proposal) {
  return proposal?.status === "APPROVED";
}

function adaptationProposalUsesCurrentPedagogicalStructure(proposal) {
  const weekly = proposal?.weeklyStructure;
  return Array.isArray(weekly) && weekly.length > 0 && weekly.every((week) =>
    Number.isInteger(Number(week?.week)) &&
    typeof week?.primaryLearningOutcome === "string" &&
    week.primaryLearningOutcome.trim().length > 0 &&
    Array.isArray(week?.learningOutcomes) && week.learningOutcomes.length > 0 &&
    typeof week?.integrative === "boolean");
}
function adaptationProposalReadyForApproval(proposal) {
  return Boolean(proposal?.changes?.length) && proposal.changes.every((change) =>
    change.decision === "ACCEPTED" ||
    (change.decision === "EDITED" &&
      String(change.teacherEditedContent || "").trim() &&
      String(change.teacherComment || "").trim().length >= 10));
}

function adaptationOutcomeNumber(outcome) {
  const outcomes = institutionalDataState?.learningOutcomes || [];
  const normalized = String(outcome || "").trim().toLocaleLowerCase("es");
  const index = outcomes.findIndex((item) => String(item || "").trim().toLocaleLowerCase("es") === normalized);
  return index >= 0 ? index + 1 : null;
}

function adaptationOutcomeBlocks(weekly) {
  const ordered = [...weekly].sort((left, right) => Number(left.week || 0) - Number(right.week || 0));
  const blocks = [];
  for (const week of ordered) {
    const outcome = week.primaryLearningOutcome || week.learningOutcomes?.[0] || "";
    if (!outcome) continue;
    const previous = blocks[blocks.length - 1];
    if (previous && String(previous.outcome).trim() === String(outcome).trim() &&
        Number(previous.endWeek) + 1 === Number(week.week)) {
      previous.endWeek = Number(week.week);
      previous.integrative = previous.integrative || Boolean(week.integrative);
      continue;
    }
    blocks.push({
      outcome,
      startWeek: Number(week.week),
      endWeek: Number(week.week),
      integrative: Boolean(week.integrative),
    });
  }
  return blocks;
}

function renderAdaptationProposal(target) {
  const proposal = adaptationProposalState(target);
  const container = $(`#${target.toLowerCase()}-adaptation-proposal`);
  const status = $(`#${target.toLowerCase()}-adaptation-status`);
  const actions = $(`#${target.toLowerCase()}-adaptation-actions`);
  const analyzeButton = $(`#analyze-${target.toLowerCase()}-adaptation`);
  if (!container || !status || !actions) return;
  const label = target === "PLAN" ? "Plan Docente" : "Guía Didáctica";
  const generationObject = target === "PLAN" ? "del Plan Docente" : "de la Guía Didáctica";
  analyzeButton?.classList.toggle("hidden", Boolean(proposal));
  if (!proposal) {
    container.innerHTML = "";
    actions.classList.add("hidden");
    status.className = "adaptation-status";
    status.textContent = `Pendiente: analice el ${label} anterior para obtener una propuesta justificable de 8 semanas.`;
    return;
  }
  if (!adaptationProposalUsesCurrentPedagogicalStructure(proposal)) {
    status.className = "adaptation-status review";
    status.textContent = "La propuesta vigente fue creada con una lógica anterior y debe regenerarse antes de continuar.";
    container.innerHTML = `<div class="adaptation-version-warning"><strong>Se requiere una nueva propuesta pedagógica</strong><span>La adaptación ahora usa una estructura pedagógica versionada por resultados, semanas y decisiones de contenido. Genere una nueva propuesta para aplicar las Especificaciones funcionales vigentes.</span></div>`;
    actions.classList.remove("hidden");
    const approveButton = $(`#approve-${target.toLowerCase()}-adaptation`);
    if (approveButton) approveButton.disabled = true;
    return;
  }
  const approved = adaptationProposalApproved(proposal);
  const weekly = (Array.isArray(proposal.weeklyStructure) ? [...proposal.weeklyStructure] : [])
    .sort((left, right) => Number(left.week || 0) - Number(right.week || 0));
  const changes = Array.isArray(proposal.changes) ? proposal.changes : [];
  const specificationSnapshots = Array.isArray(proposal.specificationSnapshots) ? proposal.specificationSnapshots : [];
  const reviewed = changes.filter((change) => ["ACCEPTED", "EDITED"].includes(change.decision)).length;
  const readyForApproval = adaptationProposalReadyForApproval(proposal);
  status.className = `adaptation-status ${approved ? "approved" : "review"}`;
  status.textContent = approved
    ? `Propuesta aprobada por el profesor · ${changes.length} cambios trazables.`
    : readyForApproval
      ? `Todos los cambios están revisados. Falta aprobar la propuesta de adaptación para habilitar la generación ${generationObject}.`
      : `Revisión pendiente: ${reviewed} de ${changes.length} cambios aceptados o editados.`;
  container.innerHTML = `
    <section class="adaptation-proposal-summary">
      <div class="adaptation-section-heading">
        <span class="adaptation-section-number">1</span>
        <div><h5>Vista global de la propuesta</h5><p>Resumen de la estructura pedagógica resultante. Esta sección es informativa; las decisiones del profesor se registran en la sección 2.</p></div>
        <span class="adaptation-readonly-badge">Solo lectura</span>
      </div>
      <div class="adaptation-proposal-identity">
        <strong>${escapeHtml(proposal.title || `Propuesta de adaptación del ${label}`)}</strong>
        <p>${escapeHtml(proposal.overview || "")}</p>
      </div>
      ${specificationSnapshots.length ? `<div class="adaptation-specification-snapshots">
        <strong>Criterios funcionales utilizados</strong>
        <div>${specificationSnapshots.map((item) => `<span>${escapeHtml(item.title)} · v${Number(item.version) || 1}</span>`).join("")}</div>
      </div>` : ""}
      ${target === "PLAN" ? `<section class="adaptation-progression-summary">
        <div class="adaptation-progression-heading"><strong>Progresión por resultados de aprendizaje</strong><span>Secuencia propuesta para revisión docente.</span></div>
        <div class="adaptation-progression-list">${adaptationOutcomeBlocks(weekly).map((block) => {
          const number = adaptationOutcomeNumber(block.outcome);
          const weeksLabel = block.startWeek === block.endWeek
            ? `Semana ${block.startWeek}`
            : `Semanas ${block.startWeek}–${block.endWeek}`;
          return `<div class="adaptation-progression-item">
            <span class="adaptation-progression-code">${number ? `RA ${number}` : "RA"}</span>
            <div><strong>${weeksLabel}</strong><small>${escapeHtml(block.outcome)}</small></div>
            ${block.integrative ? '<span class="adaptation-integrative-badge">Integración</span>' : ""}
          </div>`;
        }).join("")}</div>
      </section>` : ""}
      <details class="adaptation-weekly-overview">
        <summary>Ver distribución semanal completa (${weekly.length} semanas)</summary>
        <div class="adaptation-week-grid">${weekly.map((week) => {
          const primaryOutcome = week.primaryLearningOutcome || week.learningOutcomes?.[0] || "";
          const relatedOutcomes = (week.learningOutcomes || []).filter((outcome) =>
            String(outcome || "").trim() && String(outcome || "").trim() !== String(primaryOutcome || "").trim());
          return `
          <article class="adaptation-week-card ${week.integrative ? "integrative" : ""}">
            <div class="adaptation-week-heading">
              <strong>Semana ${week.week}</strong>
              ${week.integrative ? '<span class="adaptation-integrative-badge">Integración</span>' : ""}
            </div>
            <p><b>Origen:</b> semanas ${(week.sourceWeeks || []).join(", ") || "—"}</p>
            <div class="adaptation-week-field"><b>Resultado principal:</b>${renderAdaptationList(primaryOutcome ? [primaryOutcome] : [], "—")}</div>
            ${week.integrative && relatedOutcomes.length
              ? `<div class="adaptation-week-field"><b>Resultados integrados:</b>${renderAdaptationList(relatedOutcomes, "—")}</div>`
              : ""}
            <div class="adaptation-week-contents"><b>Contenidos:</b>${renderNumberedAdaptationContent(week.contents || [], "—")}</div>
            <div class="adaptation-week-purpose"><b>Propósito pedagógico:</b><span>${escapeHtml(week.pedagogicalPurpose || "—")}</span></div>
          </article>`;
        }).join("")}</div>
      </details>
    </section>
    <section class="adaptation-review-section">
      <div class="adaptation-section-heading">
        <span class="adaptation-section-number">2</span>
        <div><h5>Revisión y decisión del profesor</h5><p>Revise cada transformación comparando origen y destino. Aquí puede aceptar, editar, rechazar o solicitar una nueva propuesta.</p></div>
      </div>
      <div class="adaptation-change-list">${changes.map((change, index) => {
      const editable = change.decision === "EDITED";
      const needsComment = ["REJECTED", "REGENERATE"].includes(change.decision);
      const disabled = approved ? "disabled" : "";
      const deletion = change.action === "DELETE";
      const operation = adaptationOperationSummary(change);
      const columnTitles = adaptationColumnTitles(change);
      return `<article class="adaptation-change-card ${deletion ? "deletion" : ""}" data-adaptation-change="${escapeHtml(change.id)}" data-target="${target}">
        <div class="adaptation-change-header"><h5>Cambio ${index + 1} · ${escapeHtml(adaptationWeeksLabel(change.sourceWeeks || []))}</h5><span class="adaptation-action-badge">${escapeHtml(adaptationActionLabels[change.action] || change.action)}</span></div>
        <div class="adaptation-operation-summary">
          <strong>${escapeHtml(operation.title)}</strong>
          <div class="adaptation-operation-flow"><span><b>Origen:</b> ${escapeHtml(operation.sourceLabel)}</span><span><b>Destino:</b> ${escapeHtml(operation.targetLabel)}</span></div>
          <p>${escapeHtml(operation.message)}</p>
        </div>
        <div class="adaptation-change-comparison">
          <div class="adaptation-change-column"><strong>${escapeHtml(columnTitles.sourceTitle)}</strong>${renderNumberedAdaptationContent(change.sourceContent || "", "—")}</div>
          <div class="adaptation-change-column"><strong>${escapeHtml(columnTitles.destinationTitle)}</strong>${renderNumberedAdaptationContent(change.proposedContent || "", columnTitles.destinationFallback)}<p class="adaptation-change-help">${escapeHtml(columnTitles.destinationHelp)}</p></div>
        </div>
        ${deletion ? `<div class="adaptation-deletion-notice"><strong>Decisión curricular del profesor</strong><span>La omisión no se aplicará mientras usted no la acepte. Si considera que el contenido debe conservarse, rechace el cambio o solicite una nueva propuesta.</span></div>` : ""}
        <div class="adaptation-change-rationale"><strong>Justificación pedagógica</strong><span>${escapeHtml(change.rationale || "")}</span></div>
        <div class="adaptation-change-meta">
          <div class="adaptation-meta-block"><strong>Resultados relacionados</strong>${renderAdaptationList(change.learningOutcomes || [], "—")}</div>
          <div class="adaptation-meta-block"><strong>Fuentes institucionales</strong>${renderAdaptationList(change.institutionalSources || [], "—")}</div>
          <div class="adaptation-meta-block"><strong>Impacto en horas</strong><p>${escapeHtml(change.hoursImpact || "—")}</p></div>
          <div class="adaptation-meta-block"><strong>Impacto en evaluación</strong><p>${escapeHtml(change.evaluationImpact || "—")}</p></div>
        </div>
        <div class="adaptation-review-controls">
          <label>Decisión del profesor
            <select data-adaptation-decision ${disabled}>
              ${Object.entries(adaptationDecisionLabels).map(([value, text]) => `<option value="${value}" ${change.decision === value ? "selected" : ""}>${escapeHtml(text)}</option>`).join("")}
            </select>
          </label>
          <label class="adaptation-edit-content ${editable ? "" : "hidden"}">${deletion ? "Cobertura conservada editada por el profesor" : "Contenido final editado por el profesor"}
            <textarea data-adaptation-edited ${disabled}>${escapeHtml(adaptationContentForEditor(change.teacherEditedContent || change.proposedContent || ""))}</textarea>
            <small class="adaptation-editor-help">Edite utilizando la numeración visible de la oferta (por ejemplo: Unidad 1., 1.1., 1.1.1.). Los identificadores técnicos UNIDAD:, CONTENIDO: y SUBCONTENIDO: se mantienen internamente y no es necesario escribirlos.</small>
          </label>
          <label class="adaptation-comment ${needsComment ? "" : ""}">Comentario o fundamento de la decisión
            <textarea data-adaptation-comment ${disabled} placeholder="Obligatorio si rechaza o solicita otra propuesta; opcional en los demás casos.">${escapeHtml(change.teacherComment || "")}</textarea>
          </label>
          ${approved ? `<span class="adaptation-review-saved">Decisión incorporada en la propuesta aprobada.</span>` : `<button class="button secondary" type="button" data-save-adaptation-change>Guardar decisión</button>`}
        </div>
      </article>`;
    }).join("")}</div>
    </section>`;
  actions.classList.toggle("hidden", approved);
  const approveButton = $(`#approve-${target.toLowerCase()}-adaptation`);
  if (approveButton) approveButton.disabled = !adaptationProposalReadyForApproval(proposal);
}

function renderAdaptationWorkspaces() {
  const planWorkspace = $("#plan-adaptation-workspace");
  const guideWorkspace = $("#guide-adaptation-workspace");
  const generatePlan = $("#generate-teaching-plan");
  const generateWeek = $("#generate-week");
  const adaptationMode = workflowModeState === "ADAPTATION_16_TO_8";
  planWorkspace?.classList.toggle("hidden", !adaptationMode);
  const hasLegacyGuide = Boolean(legacyDocument("GUIDE_16_WEEKS"));
  guideWorkspace?.classList.toggle("hidden", !adaptationMode || !hasLegacyGuide);
  if (adaptationMode) {
    renderAdaptationProposal("PLAN");
    if (hasLegacyGuide) renderAdaptationProposal("GUIDE");
  }
  if (generatePlan) {
    const approved = !adaptationMode || (
      adaptationProposalApproved(planAdaptationProposalState) &&
      adaptationProposalUsesCurrentPedagogicalStructure(planAdaptationProposalState)
    );
    generatePlan.disabled = !approved;
    generatePlan.textContent = teachingPlanState
      ? (adaptationMode ? "Regenerar Plan Docente adaptado" : "Regenerar plan docente con IA")
      : (adaptationMode ? "Generar Plan Docente adaptado" : "Generar plan docente con IA");
  }
  if (generateWeek) {
    const guideBlocked = adaptationMode && hasLegacyGuide && !(
      adaptationProposalApproved(guideAdaptationProposalState) &&
      adaptationProposalUsesCurrentPedagogicalStructure(guideAdaptationProposalState)
    );
    generateWeek.disabled = guideBlocked;
    if (guideBlocked) generateWeek.title = "Apruebe primero la propuesta de adaptación de la Guía Didáctica.";
    else generateWeek.removeAttribute("title");
  }
}

const adaptationAnalysisInFlight = { PLAN: false, GUIDE: false };

async function analyzeAdaptation(target) {
  if (adaptationAnalysisInFlight[target]) return;
  const reopenConfirmedPlan = target === "PLAN" && Boolean(teachingPlanState?.reviewedAt);
  if (reopenConfirmedPlan) {
    if (modularGuideHasContent()) {
      return showValidationModal(
        "La Guía Didáctica ya tiene contenido. No es seguro reabrir y reemplazar el Plan Docente dentro de esta misma versión académica.",
        "#analyze-plan-adaptation",
      );
    }
    const confirmed = confirm(
      "El Plan Docente actual ya fue confirmado. Al continuar se reabrirá para generar una nueva propuesta de adaptación. " +
      "El contenido actual se conservará hasta que genere el nuevo Plan, pero deberá revisarlo y confirmarlo nuevamente antes de continuar con la Guía Didáctica. ¿Desea continuar?",
    );
    if (!confirmed) return;
  }
  adaptationAnalysisInFlight[target] = true;
  const analyzeButton = $(`#analyze-${target.toLowerCase()}-adaptation`);
  const regenerateButton = $(`#regenerate-${target.toLowerCase()}-adaptation`);
  const buttons = [analyzeButton, regenerateButton].filter(Boolean);
  const originalLabels = new Map(buttons.map((button) => [button, button.textContent]));
  buttons.forEach((button) => {
    button.disabled = true;
    button.textContent = "Analizando documento…";
  });
  try {
    const previousProposal = adaptationProposalState(target);
    const teacherFeedback = (previousProposal?.changes || [])
      .filter((change) => ["REJECTED", "REGENERATE"].includes(change.decision) && String(change.teacherComment || "").trim())
      .map((change, index) => `Cambio ${index + 1}: ${change.teacherComment.trim()}`)
      .join("\n");
    const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/adaptation/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target, teacherFeedback, reopenConfirmedPlan }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "No fue posible analizar el documento anterior.");
    setAdaptationProposalState(target, payload.proposal);
    if (payload.planReopened && teachingPlanState) {
      teachingPlanState = { ...teachingPlanState, reviewedAt: null, reviewNotes: "" };
      step = 4;
      renderTeachingPlan();
      renderStep();
    } else {
      renderAdaptationWorkspaces();
    }
    persistProject();
  } catch (error) {
    showValidationModal(error.message, target === "PLAN" ? "#analyze-plan-adaptation" : "#analyze-guide-adaptation");
  } finally {
    adaptationAnalysisInFlight[target] = false;
    buttons.forEach((button) => {
      button.disabled = false;
      button.textContent = originalLabels.get(button) || (target === "PLAN" ? "Analizar Plan anterior" : "Analizar Guía anterior");
    });
  }
}

async function saveAdaptationChange(target, card) {
  const proposal = adaptationProposalState(target);
  const changeId = card.dataset.adaptationChange;
  const change = proposal?.changes?.find((item) => item.id === changeId);
  if (!proposal || !change) return;
  const decision = card.querySelector("[data-adaptation-decision]").value;
  const teacherEditedDisplay = card.querySelector("[data-adaptation-edited]")?.value.trim() || "";
  const teacherComment = card.querySelector("[data-adaptation-comment]")?.value.trim() || "";
  if (decision === "PENDING") return showValidationModal("Seleccione una decisión para este cambio.", `[data-adaptation-change="${changeId}"] [data-adaptation-decision]`);
  if (decision === "EDITED" && !teacherEditedDisplay) return showValidationModal("Ingrese el contenido final editado por el profesor.", `[data-adaptation-change="${changeId}"] [data-adaptation-edited]`);
  let teacherEditedContent = teacherEditedDisplay;
  if (decision === "EDITED") {
    const normalizedEdit = canonicalizeAdaptationEditorContent(teacherEditedDisplay);
    if (normalizedEdit.errors.length) {
      return showValidationModal(
        `No se reconocen como contenidos vigentes de la oferta: ${normalizedEdit.errors.join(" | ")}. Use los nombres y numerales institucionales mostrados en la propuesta.`,
        `[data-adaptation-change="${changeId}"] [data-adaptation-edited]`,
      );
    }
    teacherEditedContent = normalizedEdit.canonical;
  }
  if (["EDITED", "REJECTED", "REGENERATE"].includes(decision) && teacherComment.length < 10) {
    const detail = decision === "EDITED"
      ? "Explique brevemente por qué modificó el contenido propuesto."
      : "Explique por qué rechaza el cambio o qué debe modificarse en una nueva propuesta.";
    return showValidationModal(detail, `[data-adaptation-change="${changeId}"] [data-adaptation-comment]`);
  }
  const button = card.querySelector("[data-save-adaptation-change]");
  if (button) { button.disabled = true; button.textContent = "Guardando…"; }
  try {
    const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/adaptation/proposals/${encodeURIComponent(proposal.id)}/changes/${encodeURIComponent(changeId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, teacherEditedContent, teacherComment }),
    });
    const payload = await response.json();
    if (!response.ok) {
      if (payload.code === "ADAPTATION_PROPOSAL_STALE") {
        setAdaptationProposalState(target, payload.proposal || null);
        renderAdaptationWorkspaces();
        throw new Error(payload.error || "La propuesta cambió y se actualizó la vista. Revise la versión vigente antes de continuar.");
      }
      throw new Error(payload.error || "No fue posible guardar la decisión.");
    }
    Object.assign(change, payload.change);
    renderAdaptationWorkspaces();
    persistProject();
  } catch (error) {
    showValidationModal(error.message, `[data-adaptation-change="${changeId}"]`);
  } finally {
    if (button?.isConnected) { button.disabled = false; button.textContent = "Guardar decisión"; }
  }
}

async function approveAdaptation(target) {
  const proposal = adaptationProposalState(target);
  if (!proposal) return;
  if (!adaptationProposalReadyForApproval(proposal)) {
    return showValidationModal("Todos los cambios deben quedar aceptados o editados. Las decisiones rechazadas, pendientes o solicitadas para regeneración bloquean la aprobación.", `#${target.toLowerCase()}-adaptation-proposal`);
  }
  const button = $(`#approve-${target.toLowerCase()}-adaptation`);
  if (button) { button.disabled = true; button.textContent = "Aprobando…"; }
  try {
    const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/adaptation/proposals/${encodeURIComponent(proposal.id)}/approve`, { method: "POST" });
    const payload = await response.json();
    if (!response.ok) {
      if (payload.code === "ADAPTATION_PROPOSAL_STALE") {
        setAdaptationProposalState(target, payload.proposal || null);
        renderAdaptationWorkspaces();
        throw new Error(payload.error || "La propuesta cambió y se actualizó la vista. Revise la versión vigente antes de aprobarla.");
      }
      throw new Error(payload.error || "No fue posible aprobar la propuesta.");
    }
    setAdaptationProposalState(target, payload.proposal);
    renderAdaptationWorkspaces();
    persistProject();
  } catch (error) {
    showValidationModal(error.message, `#approve-${target.toLowerCase()}-adaptation`);
  } finally {
    if (button?.isConnected) { button.disabled = false; button.textContent = "Aprobar propuesta de adaptación"; }
  }
}

function renderStep() {
  $$(".panel").forEach((panel) => panel.classList.toggle("active", Number(panel.dataset.step) === step));
  $$("#steps span").forEach((item, index) => item.classList.toggle("active", index < step));
  back.classList.toggle("hidden", step === 1);
  next.classList.toggle("hidden", step === 5);
  renderWorkflowState();
  renderAdaptationWorkspaces();
  const scrollContainer = $("#project-form");
  if (scrollContainer) scrollContainer.scrollTop = 0;
  if (step === 2 && projectId && !String($("#microcurricular-presentation")?.value || "").trim()) {
    generateMicrocurricularPresentation({ automatic: true }).catch((error) => console.error("No fue posible generar automáticamente la presentación:", error));
  }
  showMessage();
}
function openWizard() {
  layer.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  renderWorkflowState();
  renderStep();
}
function startNewProject() {
  clearTimeout(syncTimer);
  syncTimer = null;
  projectId = "";
  step = 1;
  matrixFile = null;
  matrixRows = [];
  institutionalDataState = null;
  outcomeMappingsState = [];
  teacherProfileState = null;
  bibliographyEntriesState = [];
  guideReferenceImportanceState = "";
  teachingPlanState = null;
  workflowModeState = null;
  legacyDocumentsState = [];
  planAdaptationProposalState = null;
  guideAdaptationProposalState = null;
  currentWeek = 1;
  weekStates = {};
  selectedAdjustmentFiles = [];
  matrixFileName = "";
  form.reset();
  setAcademicProfileState();
  syncProfessorName();
  fillSelect(level, Object.keys(offer), "Seleccione un nivel");
  resetAcademicFields("level");
  const fileName = $("#file-name");
  const matrixResult = $("#matrix-result");
  const confirmData = $("#confirm-data");
  const reviewedData = $("#institutional-data-reviewed");
  const projectSummary = $("#project-summary");
  const generationOutput = $("#generation-output");
  const generationError = $("#generation-error");
  const weeklyReview = $("#weekly-review");
  const adjustmentInstructions = $("#adjustment-instructions");
  const adjustmentFiles = $("#adjustment-files");
  const attachmentList = $("#attachment-list");
  if (fileName) fileName.textContent = "Excel (.xlsx) o CSV";
  if (matrixResult) {
    matrixResult.textContent = "";
    matrixResult.className = "validation hidden";
  }
  if (confirmData) confirmData.checked = false;
  if (reviewedData) reviewedData.checked = false;
  if (projectSummary) projectSummary.innerHTML = "";
  if (generationOutput) generationOutput.innerHTML = "";
  if (generationError) {
    generationError.textContent = "";
    generationError.classList.add("hidden");
  }
  if (weeklyReview) weeklyReview.classList.add("hidden");
  if (adjustmentInstructions) adjustmentInstructions.value = "";
  if (adjustmentFiles) adjustmentFiles.value = "";
  if (attachmentList) {
    attachmentList.innerHTML = "";
    attachmentList.classList.add("hidden");
  }
  setTeacherProfile();
  renderBibliographyEntries();
  renderGuideReferenceImportance();
  renderTeachingPlan();
  localStorage.removeItem(storageKey);
  openWizard();
}
function closeWizard() {
  layer.classList.add("hidden");
  document.body.style.overflow = "";
}
$("#refresh-projects").onclick = () => loadProjects($("#project-search").value.trim());
$("#close-wizard").onclick = closeWizard;
$("#projects-list").addEventListener("click", (event) => {
  const button = event.target.closest("[data-open-project]");
  if (!button) return;
  button.disabled = true;
  openSavedProject(button.dataset.openProject).catch((error) => {
    button.disabled = false;
    showValidationModal(error.message || "No fue posible abrir la asignatura.", "#projects-list");
  });
});
let projectSearchTimer;
$("#project-search").addEventListener("input", (event) => {
  clearTimeout(projectSearchTimer);
  projectSearchTimer = setTimeout(() => loadProjects(event.target.value.trim()), 250);
});
function activateNavigation(button) {
  $$(".nav").forEach((item) => item.classList.toggle("active", item === button));
}
$("#nav-home").onclick = () => {
  activateNavigation($("#nav-home"));
  $("#project-search").value = "";
  loadProjects();
};
$("#nav-projects").onclick = () => {
  activateNavigation($("#nav-projects"));
  $("#projects-title").scrollIntoView({ behavior: "smooth", block: "start" });
  $("#project-search").focus();
  loadProjects($("#project-search").value.trim());
};
$("#nav-templates").onclick = () => {
  activateNavigation($("#nav-templates"));
  $("#projects-list").innerHTML = '<div class="projects-empty"><strong>Plantillas</strong><span>Las plantillas institucionales se incorporarán en una siguiente etapa.</span></div>';
};
$("#nav-help").onclick = () => {
  activateNavigation($("#nav-help"));
  $("#projects-list").innerHTML = '<div class="projects-empty"><strong>Ayuda</strong><span>El administrador asigna las ofertas académicas. Para elaborar una guía, abra la asignatura correspondiente y pulse «Continuar».</span></div>';
};
let bibliographyApaSuggestionState = null;
function resetBibliographyApaSuggestion() {
  bibliographyApaSuggestionState = null;
  const panel = $("#bibliography-apa-suggestion");
  if (panel) { panel.classList.add("hidden"); panel.innerHTML = ""; }
  const button = $("#bibliography-apa-review");
  if (button) { button.disabled = false; button.textContent = "Revisar referencia con APA"; }
}
function safeExternalUrl(value) {
  try { const parsed = new URL(String(value || "")); return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : ""; } catch { return ""; }
}
async function reviewBibliographyApa() {
  const entryForm = $("#bibliography-entry-form");
  const citation = entryForm?.elements?.citation?.value.trim() || "";
  if (!citation) return showValidationModal("Referencia bibliográfica: ingrese primero la referencia que desea revisar.", '#bibliography-entry-form [name="citation"]');
  const button = $("#bibliography-apa-review");
  if (button) { button.disabled = true; button.textContent = "Buscando y revisando…"; }
  try {
    const response = await fetch("/api/bibliography/apa-review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ citation }) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "No fue posible revisar la referencia con APA.");
    bibliographyApaSuggestionState = payload;
    const panel = $("#bibliography-apa-suggestion");
    if (!panel) return;
    const sources = (payload.sources || []).map((source) => { const url = safeExternalUrl(source.url); return url ? `<li><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.title || url)}</a></li>` : ""; }).filter(Boolean).join("");
    if (!payload.found || !payload.suggestedCitation) {
      panel.innerHTML = `<h4>Revisión APA</h4><p>No se encontraron metadatos suficientes para proponer un cambio fiable.</p>${payload.reason ? `<p>${escapeHtml(payload.reason)}</p>` : ""}${sources ? `<p><strong>Fuentes consultadas</strong></p><ul>${sources}</ul>` : ""}<button type="button" class="button secondary" id="bibliography-apa-keep">Mantener referencia ingresada</button>`;
    } else {
      panel.innerHTML = `<h4>Sugerencia APA 7</h4><p><strong>Referencia ingresada</strong></p><p>${escapeHtml(citation)}</p><p><strong>Referencia propuesta</strong></p><p class="apa-suggested-citation">${escapeHtml(payload.suggestedCitation)}</p>${payload.reason ? `<p>${escapeHtml(payload.reason)}</p>` : ""}${sources ? `<p><strong>Fuentes consultadas</strong></p><ul>${sources}</ul>` : ""}<div class="apa-suggestion-actions"><button type="button" class="button secondary" id="bibliography-apa-keep">Mantener como ingresó</button><button type="button" class="button" id="bibliography-apa-accept">Usar sugerencia APA</button></div>`;
    }
    panel.classList.remove("hidden");
  } catch (error) {
    showValidationModal(error.message || "No fue posible revisar la referencia con APA.", '#bibliography-entry-form [name="citation"]');
  } finally {
    if (button) { button.disabled = false; button.textContent = "Revisar referencia con APA"; }
  }
}

$$('.bibliography-add').forEach((button) => button.addEventListener('click', () => openBibliographyEntryModal(button.dataset.type)));
$("#guide-reference-importance-edit")?.addEventListener("click", openGuideReferenceImportanceModal);
$("#bibliography-entry-close")?.addEventListener("click", closeBibliographyEntryModal);
$("#bibliography-entry-cancel")?.addEventListener("click", closeBibliographyEntryModal);
$("#bibliography-entry-modal")?.addEventListener("click", (event) => { if (event.target.id === "bibliography-entry-modal") closeBibliographyEntryModal(); });
$("#bibliography-apa-review")?.addEventListener("click", reviewBibliographyApa);
$("#bibliography-apa-suggestion")?.addEventListener("click", (event) => {
  if (event.target.closest?.("#bibliography-apa-accept")) {
    const citation = bibliographyApaSuggestionState?.suggestedCitation;
    if (citation) $("#bibliography-entry-form").elements.citation.value = citation;
    resetBibliographyApaSuggestion();
  } else if (event.target.closest?.("#bibliography-apa-keep")) {
    resetBibliographyApaSuggestion();
  }
});
$("#bibliography-entry-form")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const entryForm = event.currentTarget;
  const type = entryForm.elements.entryType.value;
  const citation = entryForm.elements.citation.value.trim();
  const title = entryForm.elements.title.value.trim();
  const url = entryForm.elements.url.value.trim();
  const notes = entryForm.elements.notes.value.trim();
  if (type === "GUIDE") {
    if (!notes) return showValidationModal("Importancia para el estudiante: explique por qué la guía didáctica es relevante para el aprendizaje.", '#bibliography-entry-form [name="notes"]');
    guideReferenceImportanceState = notes;
    renderGuideReferenceImportance();
    closeBibliographyEntryModal();
    persistProject();
    scheduleProgressSync();
    return;
  }
  if (type === "REA") {
    if (!title) return showValidationModal("Título del REA: ingrese un título.", '#bibliography-entry-form [name="title"]');
    if (!url) return showValidationModal("Enlace del REA: ingrese una URL.", '#bibliography-entry-form [name="url"]');
  } else {
    if (!citation) return showValidationModal("Referencia bibliográfica: ingrese la referencia.", '#bibliography-entry-form [name="citation"]');
    if (!notes) return showValidationModal("Importancia para el estudiante: explique por qué esta fuente es relevante para su aprendizaje.", '#bibliography-entry-form [name="notes"]');
  }
  const rawIndex = entryForm.elements.entryIndex.value;
  const index = rawIndex === "" ? -1 : Number(rawIndex);
  const existing = index >= 0 ? bibliographyEntriesState[index] : null;
  const entry = { id: existing?.id, type, citation: type === "REA" ? "" : citation, title: type === "REA" ? title : "", url: type === "REA" ? url : "", notes, sortOrder: existing?.sortOrder || ((bibliographyEntriesState.filter((item) => item.type === type).length + 1) * 10) };
  if (index >= 0) bibliographyEntriesState[index] = entry; else bibliographyEntriesState.push(entry);
  renderBibliographyEntries();
  closeBibliographyEntryModal();
  persistProject();
  scheduleProgressSync();
});
document.addEventListener("click", (event) => {
  const edit = event.target.closest?.(".bibliography-edit");
  if (edit) { const index = Number(edit.dataset.index); const entry = bibliographyEntriesState[index]; if (entry) openBibliographyEntryModal(entry.type, index); return; }
  const remove = event.target.closest?.(".bibliography-delete");
  if (remove) deleteBibliographyEntry(Number(remove.dataset.index));
});


$$('[data-workflow-mode]').forEach((button) => {
  button.addEventListener('click', async () => {
    const mode = button.dataset.workflowMode;
    if (!mode || button.disabled) return;
    const buttons = $$('[data-workflow-mode]');
    buttons.forEach((item) => { item.disabled = true; });
    try {
      await selectWorkflowMode(mode);
    } catch (error) {
      showValidationModal(error.message, `[data-workflow-mode="${mode}"]`);
    } finally {
      buttons.forEach((item) => { item.disabled = false; });
    }
  });
});

function bindLegacyDocumentForm(selector, type) {
  const uploadForm = $(selector);
  if (!uploadForm) return;
  uploadForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = uploadForm.querySelector('button[type="submit"]');
    const originalText = button?.textContent || '';
    if (button) { button.disabled = true; button.textContent = 'Guardando documento…'; }
    try {
      await uploadLegacyDocument(uploadForm, type);
    } catch (error) {
      showValidationModal(error.message, `${selector} input[type="file"]`);
    } finally {
      if (button) { button.disabled = false; button.textContent = originalText; }
    }
  });
}
bindLegacyDocumentForm('#legacy-plan-form', 'PLAN_16_WEEKS');
bindLegacyDocumentForm('#legacy-guide-form', 'GUIDE_16_WEEKS');

$('#continue-after-legacy-upload')?.addEventListener('click', () => {
  if (!legacyDocument('PLAN_16_WEEKS')) {
    showValidationModal('Plan Docente anterior: suba el archivo de 16 semanas antes de continuar.', '#legacy-plan-form input[type="file"]');
    return;
  }
  renderWorkflowState({ showSources: false });
  renderStep();
});

$('#manage-legacy-documents')?.addEventListener('click', () => {
  renderWorkflowState({ showSources: true });
});

function requestWorkflowModeChange(focusSelector) {
  if (!workflowModeCanChange()) {
    showValidationModal(
      'El tipo de elaboración ya tiene documentos, propuestas o documentos modulares asociados y no puede cambiarse en esta versión.',
      focusSelector,
    );
    return;
  }
  workflowModeState = null;
  renderWorkflowState();
}

$('#change-workflow-mode')?.addEventListener('click', () => requestWorkflowModeChange('#change-workflow-mode'));
$('#change-workflow-mode-main')?.addEventListener('click', () => requestWorkflowModeChange('#change-workflow-mode-main'));

$('#analyze-plan-adaptation')?.addEventListener('click', () => analyzeAdaptation('PLAN'));
$('#regenerate-plan-adaptation')?.addEventListener('click', () => analyzeAdaptation('PLAN'));
$('#approve-plan-adaptation')?.addEventListener('click', () => approveAdaptation('PLAN'));
$('#analyze-guide-adaptation')?.addEventListener('click', () => analyzeAdaptation('GUIDE'));
$('#regenerate-guide-adaptation')?.addEventListener('click', () => analyzeAdaptation('GUIDE'));
$('#approve-guide-adaptation')?.addEventListener('click', () => approveAdaptation('GUIDE'));

function bindAdaptationProposalEvents(target) {
  const container = $(`#${target.toLowerCase()}-adaptation-proposal`);
  if (!container) return;
  container.addEventListener('change', (event) => {
    const select = event.target.closest('[data-adaptation-decision]');
    if (!select) return;
    const card = select.closest('[data-adaptation-change]');
    if (!card) return;
    card.querySelector('.adaptation-edit-content')?.classList.toggle('hidden', select.value !== 'EDITED');
    const comment = card.querySelector('[data-adaptation-comment]');
    if (comment) {
      comment.placeholder = select.value === 'EDITED'
        ? 'Explique obligatoriamente la edición realizada por el profesor.'
        : ['REJECTED', 'REGENERATE'].includes(select.value)
          ? 'Explique obligatoriamente qué debe corregirse o por qué rechaza la propuesta.'
          : 'Observación opcional del profesor sobre esta decisión.';
    }
    const approveButton = $(`#approve-${target.toLowerCase()}-adaptation`);
    if (approveButton) approveButton.disabled = true;
  });
  container.addEventListener('click', (event) => {
    const button = event.target.closest('[data-save-adaptation-change]');
    if (!button) return;
    const card = button.closest('[data-adaptation-change]');
    if (card) saveAdaptationChange(target, card);
  });
}
bindAdaptationProposalEvents('PLAN');
bindAdaptationProposalEvents('GUIDE');

back.onclick = () => {
  if (step > 1) {
    step -= 1;
    renderStep();
  }
};
function data() {
  const values = Object.fromEntries(new FormData(form).entries());
  ["level", "modality", "faculty", "career", "subjectType"].forEach((name) => {
    values[name] = form.elements[name]?.value || "";
  });
  const subjectTypeOption = form.elements.subjectType?.selectedOptions?.[0];
  return {
    ...values,
    subjectTypeName: subjectTypeOption?.textContent?.trim() || values.subjectType || "",
    guideReferenceImportance: guideReferenceImportanceState,
    professionalProfileCompetencies: [...academicProfileState.professionalProfileCompetencies],
    graduateProfileResults: [...academicProfileState.graduateProfileResults],
    utplGenericCompetencies: [...academicProfileState.utplGenericCompetencies],
  };
}
function bibliographyLegacyText(type) {
  return bibliographyEntriesState
    .filter((entry) => entry.type === type)
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0))
    .map((entry) => {
      const importance = String(entry.notes || "").trim();
      if (type === "REA") return [entry.title, entry.url, importance ? `Importancia para el estudiante: ${importance}` : ""].filter(Boolean).join(" — ");
      return [entry.citation, importance ? `Importancia para el estudiante: ${importance}` : ""].filter(Boolean).join(" — ");
    })
    .filter(Boolean)
    .join("\n");
}
function bibliographyListId(type) {
  return type === "BASIC" ? "#bibliography-basic-list" : type === "COMPLEMENTARY" ? "#bibliography-complementary-list" : "#bibliography-rea-list";
}
function renderBibliographyEntries() {
  ["BASIC", "COMPLEMENTARY", "REA"].forEach((type) => {
    const container = $(bibliographyListId(type));
    if (!container) return;
    const entries = bibliographyEntriesState.map((entry, index) => ({ entry, index })).filter(({ entry }) => entry.type === type);
    if (!entries.length) {
      container.innerHTML = `<div class="bibliography-empty">${type === "REA" ? "No hay recursos educativos abiertos registrados." : "No hay referencias registradas en esta sección."}</div>`;
      return;
    }
    container.innerHTML = entries.map(({ entry, index }, visibleIndex) => {
      const main = type === "REA" ? escapeHtml(entry.title || "REA sin título") : escapeHtml(entry.citation || "Referencia sin contenido");
      const details = [];
      if (type === "REA" && entry.url) details.push(`<small>${escapeHtml(entry.url)}</small>`);
      if (entry.notes) details.push(`<small><strong>Importancia para el estudiante:</strong> ${escapeHtml(entry.notes)}</small>`);
      const detail = details.join("");
      return `<article class="bibliography-entry-card"><div><p><strong>${visibleIndex + 1}.</strong> ${main}</p>${detail}</div><div class="bibliography-entry-actions"><button type="button" class="button secondary bibliography-edit" data-index="${index}">Editar</button><button type="button" class="button secondary bibliography-delete" data-index="${index}">Eliminar</button></div></article>`;
    }).join("");
  });
}
function openBibliographyEntryModal(type, index = null) {
  const modal = $("#bibliography-entry-modal");
  const entryForm = $("#bibliography-entry-form");
  if (!modal || !entryForm) return;
  const editing = Number.isInteger(index) ? bibliographyEntriesState[index] : null;
  entryForm.elements.entryIndex.value = editing ? String(index) : "";
  entryForm.elements.entryType.value = type;
  entryForm.elements.citation.value = editing?.citation || "";
  entryForm.elements.title.value = editing?.title || "";
  entryForm.elements.url.value = editing?.url || "";
  entryForm.elements.notes.value = editing?.notes || "";
  $("#bibliography-entry-title").textContent = editing ? (type === "REA" ? "Editar REA" : "Editar referencia") : (type === "REA" ? "Agregar REA" : "Agregar referencia");
  $$(".bibliography-citation-field").forEach((field) => field.classList.toggle("hidden", type === "REA" || type === "GUIDE"));
  $$(".bibliography-rea-field").forEach((field) => field.classList.toggle("hidden", type !== "REA"));
  resetBibliographyApaSuggestion();
  const apaButton = $("#bibliography-apa-review");
  if (apaButton) apaButton.classList.toggle("hidden", type === "REA" || type === "GUIDE");
  const importanceLabel = $("#bibliography-importance-label");
  if (importanceLabel) importanceLabel.textContent = type === "REA" ? "Importancia para el estudiante (opcional)" : "Importancia para el estudiante *";
  entryForm.elements.notes.required = type !== "REA";
  entryForm.elements.notes.placeholder = type === "REA"
    ? "Opcional: explique por qué este recurso puede ser útil para el estudiante."
    : "Explique brevemente por qué esta fuente es relevante para el aprendizaje del estudiante.";
  modal.classList.remove("hidden");
  setTimeout(() => (type === "REA" ? entryForm.elements.title : entryForm.elements.citation).focus(), 0);
}
function renderGuideReferenceImportance() {
  const text = $("#guide-reference-importance-text");
  const button = $("#guide-reference-importance-edit");
  const importance = String(guideReferenceImportanceState || "").trim();
  if (text) {
    text.textContent = importance || "Pendiente de registrar.";
    text.classList.toggle("complete", Boolean(importance));
  }
  if (button) button.textContent = importance ? "Editar importancia" : "+ Agregar importancia";
}
function openGuideReferenceImportanceModal() {
  const modal = $("#bibliography-entry-modal");
  const entryForm = $("#bibliography-entry-form");
  if (!modal || !entryForm) return;
  entryForm.elements.entryIndex.value = "";
  entryForm.elements.entryType.value = "GUIDE";
  entryForm.elements.citation.value = "";
  entryForm.elements.title.value = "";
  entryForm.elements.url.value = "";
  entryForm.elements.notes.value = guideReferenceImportanceState || "";
  resetBibliographyApaSuggestion();
  const apaButton = $("#bibliography-apa-review"); if (apaButton) apaButton.classList.add("hidden");
  $("#bibliography-entry-title").textContent = guideReferenceImportanceState ? "Editar importancia de la guía didáctica" : "Agregar importancia de la guía didáctica";
  $$(".bibliography-citation-field").forEach((field) => field.classList.add("hidden"));
  $$(".bibliography-rea-field").forEach((field) => field.classList.add("hidden"));
  const importanceLabel = $("#bibliography-importance-label");
  if (importanceLabel) importanceLabel.textContent = "Importancia para el estudiante *";
  entryForm.elements.notes.required = true;
  entryForm.elements.notes.placeholder = "Explique por qué la guía didáctica es relevante para orientar el aprendizaje del estudiante.";
  modal.classList.remove("hidden");
  setTimeout(() => entryForm.elements.notes.focus(), 0);
}
function closeBibliographyEntryModal() { $("#bibliography-entry-modal")?.classList.add("hidden"); }
function deleteBibliographyEntry(index) {
  const entry = bibliographyEntriesState[index];
  if (!entry) return;
  bibliographyEntriesState.splice(index, 1);
  renderBibliographyEntries();
  persistProject();
  scheduleProgressSync();
}

function suggestedGuideReference(project = data()) {
  const year = String(project.academicPeriod || "").match(/\b(20\d{2})\b/)?.[1] || "s. f.";
  const code = String(project.subjectCode || "").trim();
  const careerName = String(project.career || "").trim();
  return `Universidad Técnica Particular de Loja. (${year}). Guía didáctica de ${String(project.subjectName || "").trim()}${code ? ` (${code})` : ""}.${careerName ? ` ${careerName}.` : ""}`;
}
function suggestedGuideReferenceImportance(project = data()) {
  const subjectName = String(project.subjectName || "").trim() || "la asignatura";
  return `Esta guía didáctica orienta al estudiante en el estudio de ${subjectName}, organiza los contenidos, actividades y evaluaciones del periodo académico, y favorece el aprendizaje autónomo y el logro de los resultados de aprendizaje previstos.`;
}
function ensureGuideReference() {
  const field = form.elements.guideReference;
  if (field && !String(field.value || "").trim() && form.elements.subjectName?.value) field.value = suggestedGuideReference();
  if (!String(guideReferenceImportanceState || "").trim() && form.elements.subjectName?.value) {
    guideReferenceImportanceState = suggestedGuideReferenceImportance();
  }
  renderGuideReferenceImportance();
}

function invalidFields(names) {
  return names.filter((name) => {
    const element = form.elements[name];
    return !element || !String(element.value || "").trim();
  });
}
function summarize() {
  const project = data();
  $("#project-summary").innerHTML = [
    ["Proyecto", project.projectName], ["Nivel", project.level],
    ["Modalidad", project.modality], ["Facultad o unidad", project.faculty],
    ["Carrera", project.career], ["Profesor", project.professorName],
    ["Código", project.subjectCode], ["Asignatura", project.subjectName], ["Tipo", project.subjectTypeName || project.subjectType],
    ["Periodo", project.academicPeriod], ["Duración", `${project.weeks} semanas`],
    ["Resultados de aprendizaje", `${institutionalDataState?.learningOutcomes?.length || 0}`],
    ["Unidades y contenidos", `${institutionalDataState?.unitContents?.length || 0}`],
    ["Programación", teachingPlanState ? `Plan docente v${teachingPlanState.version}` : "Pendiente de generación"],
  ].map(([key, value]) => `<div><small>${key}</small><strong>${escapeHtml(value || "—")}</strong></div>`).join("");
}

async function saveProjectSetup() {
  if (!projectId) throw new Error("La asignatura no tiene una asignación válida.");
  const project = data();
  if (!project.guideReference?.trim()) {
    throw new Error("Referencia de la guía didáctica: revise o complete la referencia obligatoria para el Plan Docente.");
  }
  if (!guideReferenceImportanceState.trim()) {
    throw new Error("Importancia para el estudiante: explique por qué la guía didáctica es relevante para el aprendizaje.");
  }
  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/setup`, {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      institutionalDataReviewed: true,
      microcurricularPresentation: validateMicrocurricularPresentation(),
      outcomeMappings: collectOutcomeMappings(),
      teacherProfile: collectTeacherProfile(),
      bibliography: {
        guideReference: project.guideReference, guideReferenceImportance: guideReferenceImportanceState, entries: bibliographyEntriesState,
        basic: bibliographyLegacyText("BASIC"), complementary: bibliographyLegacyText("COMPLEMENTARY"), rea: bibliographyLegacyText("REA"),
      },
    }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "No fue posible guardar la ficha del plan docente.");
  if (!payload.planPreserved) {
    teachingPlanState = null;
    matrixRows = [];
    matrixFileName = "";
    weekStates = {};
    planAdaptationProposalState = null;
    guideAdaptationProposalState = null;
    renderTeachingPlan();
    renderAdaptationWorkspaces();
  }
  return payload;
}


const contributionPreviewLabels = { INITIAL: "Inicial", MIDDLE: "Medio", FINAL: "Final" };
const planPreviewSections = [
  ["cover", "P", "Portada"], ["a", "A", "A. Identificación"], ["b", "B", "B. Descripción"],
  ["c", "C", "C. Contribución"], ["d", "D", "D. Programación"], ["e", "E", "E. Evaluación"],
  ["f", "F", "F. Docente"], ["g", "G", "G. Bibliografía"], ["h", "H", "H. Aprobación"],
];
const planEvaluationPreviewRules = {
  CONCEPTUAL: [
    ["AC1", "ACD", 2, 1, 10], ["AC2", "AA", 4, 1, 10], ["AC3", "ACD", 6, 3, 30],
    ["AC4", "APE", 7, 2, 20], ["AC5", "AA", 8, 3, 30],
  ],
  ACTIVE: [
    ["AC1", "ACD", 2, .5, 5], ["AC2", "APE", 4, 2, 20], ["AC3", "ACD", 6, 1.5, 15],
    ["AC4", "APE", 7, 3, 30], ["AC5", "AA", 8, 3, 30],
  ],
  INTEGRATING: [
    ["AC1", "ACD", 2, 1, 10], ["AC2", "APE", 4, 2, 20], ["AC3", "ACD", 6, 1, 10],
    ["AC4", "APE", 7, 4, 40], ["AC5", "AA", 8, 2, 20],
  ],
};
function normalizePlanPreviewValue(value) {
  return String(value || "").normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("es");
}
function planPreviewList(values, ordered = false) {
  const items = (Array.isArray(values) ? values : []).filter((value) => String(value || "").trim());
  if (!items.length) return '<span class="muted">No aplica</span>';
  const tag = ordered ? "ol" : "ul";
  return `<${tag} class="plan-preview-list">${items.map((value) => `<li>${escapeHtml(value)}</li>`).join("")}</${tag}>`;
}
function planPreviewMultiline(values) {
  const items = (Array.isArray(values) ? values : []).filter((value) => String(value || "").trim());
  return items.length ? items.map((value) => `<div>${escapeHtml(value)}</div>`).join("") : "—";
}
function localTeachingPlanReviewChecks() {
  if (!teachingPlanState?.content || !institutionalDataState) return [];
  const content = teachingPlanState.content;
  const expectedOutcomes = new Set((institutionalDataState.learningOutcomes || []).map(normalizePlanPreviewValue));
  const sequenceOutcomes = (content.sequences || []).map((sequence) => normalizePlanPreviewValue(sequence.learningOutcome));
  const outcomesOk = sequenceOutcomes.length === expectedOutcomes.size && new Set(sequenceOutcomes).size === sequenceOutcomes.length && sequenceOutcomes.every((item) => expectedOutcomes.has(item));
  const weeks = (content.sequences || []).flatMap((sequence) => sequence.weeks || []);
  const expectedWeeks = Array.from({ length: totalWeeks() }, (_, index) => index + 1);
  const weekNumbers = weeks.map((week) => Number(week.week));
  const weeksOk = weekNumbers.length === expectedWeeks.length && new Set(weekNumbers).size === weekNumbers.length && expectedWeeks.every((week) => weekNumbers.includes(week));
  const allowedContents = new Set((institutionalDataState.unitContents || []).map(normalizePlanPreviewValue));
  const unknownContents = weeks.flatMap((week) => (week.unitContents || []).filter((item) => !allowedContents.has(normalizePlanPreviewValue(item))));
  const hours = weeks.reduce((sum, week) => ({ acd: sum.acd + Number(week.acdHours || 0), ape: sum.ape + Number(week.apeHours || 0), aa: sum.aa + Number(week.aaHours || 0) }), { acd: 0, ape: 0, aa: 0 });
  const hoursOk = hours.acd === Number(institutionalDataState.acdHours || 0) && hours.ape === Number(institutionalDataState.apeHours || 0) && hours.aa === Number(institutionalDataState.aaHours || 0);
  const rules = planEvaluationPreviewRules[institutionalDataState.planCategory] || [];
  const activities = content.evaluatedActivities || [];
  const evaluationOk = rules.length === activities.length && rules.every(([code, component, week, grade, weight]) => activities.some((item) => item.code === code && item.component === component && Number(item.week) === week && Number(item.grade) === grade && Number(item.weight) === weight));
  const totalGrade = activities.reduce((sum, item) => sum + Number(item.grade || 0), 0);
  const totalWeight = activities.reduce((sum, item) => sum + Number(item.weight || 0), 0);
  const methodologyOk = (content.sequences || []).every((sequence) => String(sequence.methodology || "").trim().length >= 3 && Array.isArray(sequence.tac) && sequence.tac.some((item) => String(item || "").trim()));
  const instrumentsOk = activities.length === 5 && activities.every((activity) => {
    const config = activity.instrumentConfig;
    if (!config || Number(config.maximumScore) !== 10) return false;
    if (config.type === "QUESTIONNAIRE") return Boolean(config.questionnaire?.gradingMode) && Number(config.questionnaire?.questionCount) >= 1 && Number(config.questionnaire?.timeMinutes) >= 1;
    if (["RUBRIC", "CHECKLIST", "RATING_SCALE"].includes(config.type)) return Math.abs(instrumentMaximumScore(config) - 10) < .001;
    return true;
  });
  return [
    { code: "OUTCOMES", label: "Resultados de aprendizaje", ok: outcomesOk, detail: outcomesOk ? `${expectedOutcomes.size} de ${expectedOutcomes.size} resultados cubiertos, sin duplicados.` : "La secuencia no cubre exactamente todos los resultados institucionales." },
    { code: "WEEKS", label: "Organización semanal", ok: weeksOk, detail: weeksOk ? `Semanas 1 a ${totalWeeks()} completas, sin omisiones ni duplicados.` : `La planificación debe contener exactamente las semanas 1 a ${totalWeeks()}.` },
    { code: "CONTENTS", label: "Unidades y contenidos", ok: !unknownContents.length, detail: !unknownContents.length ? "Todos los contenidos corresponden literalmente a la oferta académica." : `Se encontraron contenidos ajenos a la oferta: ${unknownContents.join("; ")}.` },
    { code: "HOURS", label: "Distribución de horas", ok: hoursOk, detail: `ACD ${hours.acd}/${institutionalDataState.acdHours} · APE ${hours.ape}/${institutionalDataState.apeHours} · AA ${hours.aa}/${institutionalDataState.aaHours}.` },
    { code: "EVALUATION", label: "Actividades calificadas", ok: evaluationOk, detail: evaluationOk ? "Las cinco actividades respetan la distribución institucional." : "La evaluación no coincide con la distribución oficial del tipo de asignatura." },
    { code: "TOTALS", label: "Totales de evaluación", ok: Math.abs(totalGrade - 10) < .001 && totalWeight === 100, detail: `${totalGrade.toFixed(1)} puntos · ${totalWeight}% del total.` },
    { code: "METHODOLOGY", label: "Metodologías y TAC", ok: methodologyOk, detail: methodologyOk ? "Cada resultado cuenta con metodología activa y al menos una TAC." : "Complete la metodología y las TAC de todos los resultados." },
    { code: "INSTRUMENTS", label: "Instrumentos para EVA", ok: instrumentsOk, detail: instrumentsOk ? "Las actividades calificadas tienen instrumentos estructurados sobre 10 puntos." : "Configure sobre 10 puntos el instrumento de cada actividad calificada." },
  ];
}
function teachingPlanReviewChecksState() {
  const checks = Array.isArray(teachingPlanState?.reviewChecks) && teachingPlanState.reviewChecks.length
    ? [...teachingPlanState.reviewChecks]
    : localTeachingPlanReviewChecks();
  const formatCheck = teachingPlanState?.templateOutdated
    ? { code: "TEMPLATE", label: "Formato institucional", ok: false, detail: `El Plan Docente fue generado con ${teachingPlanState?.templateSnapshot?.title || "un formato anterior"} · v${teachingPlanState?.templateSnapshot?.version || "—"}. Regénere para aplicar ${teachingPlanState?.activeTemplate?.title || "el formato vigente"} · v${teachingPlanState?.activeTemplate?.version || "—"}.` }
    : { code: "TEMPLATE", label: "Formato institucional", ok: true, detail: teachingPlanState?.templateSnapshot ? `Se utiliza ${teachingPlanState.templateSnapshot.title} · v${teachingPlanState.templateSnapshot.version}.` : "El formato utilizado quedó registrado con la generación." };
  return checks.some((check) => check.code === "TEMPLATE") ? checks : [...checks, formatCheck];
}
function teachingPlanReviewDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-EC", { dateStyle: "long", timeStyle: "short" }).format(date);
}
function bibliographyPreviewEntries(type) {
  return bibliographyEntriesState
    .filter((entry) => entry.type === type)
    .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0));
}
function bibliographyPreviewItemHtml(entry, type) {
  const main = type === "REA"
    ? [entry.title, entry.url].filter(Boolean).map(escapeHtml).join(" — ")
    : escapeHtml(entry.citation || "Referencia sin contenido");
  const importance = String(entry.notes || "").trim();
  return `<li>${main}${importance ? `<div><strong>Importancia para el estudiante:</strong> ${escapeHtml(importance)}</div>` : ""}</li>`;
}
function bibliographyPreviewHtml(type) {
  const entries = bibliographyPreviewEntries(type);
  if (!entries.length) return '<p class="muted">No se registraron referencias adicionales.</p>';
  return `<ol class="plan-preview-list plan-preview-alpha-list">${entries.map((entry) => bibliographyPreviewItemHtml(entry, type)).join("")}</ol>`;
}
function bibliographyBasicPreviewHtml() {
  const entries = bibliographyPreviewEntries("BASIC");
  const guideReference = escapeHtml(form.elements.guideReference?.value || "—");
  const guideImportance = escapeHtml(guideReferenceImportanceState || "—");
  return `<ol class="plan-preview-list plan-preview-alpha-list"><li>${guideReference}<div><strong>Importancia para el estudiante:</strong> ${guideImportance}</div></li>${entries.map((entry) => bibliographyPreviewItemHtml(entry, "BASIC")).join("")}</ol>`;
}
const planInstrumentTypeLabels = {
  QUESTIONNAIRE: "Cuestionario",
  RUBRIC: "Rúbrica",
  CHECKLIST: "Lista de cotejo",
  RATING_SCALE: "Escala de valoración",
  OTHER: "Otro",
};
const planQuestionnaireModeLabels = {
  LAST_ATTEMPT: "Último intento",
  HIGHEST_GRADE: "Calificación más alta",
};
function institutionalContentText(value) {
  return String(value || "")
    .replace(/^\s*(?:UNIDAD|CONTENIDO|SUBCONTENIDO)\s*:\s*/i, "")
    .replace(/^\s*UNIDAD\s+\d+(?:\.\d+)*\s*(?:[.)]|[:\-–—])?\s*/i, "")
    .replace(/^\s*\d+(?:\.\d+){0,3}\s*(?:[.)]|[:\-–—])\s*/u, "")
    .trim();
}
function institutionalContentDepth(value) {
  const raw = String(value || "").trim();
  if (/^UNIDAD\s*:/i.test(raw) || /^UNIDAD\s+\d+/i.test(raw)) return 1;
  if (/^CONTENIDO\s*:/i.test(raw)) return 2;
  if (/^SUBCONTENIDO\s*:/i.test(raw)) return 3;
  const number = raw.match(/^\s*(\d+(?:\.\d+){0,2})\s*(?:[.)]|[:\-–—])/u)?.[1];
  return number ? number.split(".").length : 1;
}
function sentenceCaseInstitutionalUnit(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed || trimmed !== trimmed.toLocaleUpperCase("es")) return trimmed;
  const acronyms = new Map([["UTPL", "UTPL"], ["EVA", "EVA"], ["IA", "IA"], ["TIC", "TIC"], ["TICS", "TICs"], ["ACD", "ACD"], ["APE", "APE"], ["AA", "AA"], ["REA", "REA"], ["APA", "APA"], ["CACES", "CACES"]]);
  let lower = trimmed.toLocaleLowerCase("es");
  lower = lower.replace(/[a-záéíóúüñ]/u, (letter) => letter.toLocaleUpperCase("es"));
  return lower.split(/(\s+)/).map((token) => {
    const key = token.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, "").toLocaleUpperCase("es");
    const acronym = acronyms.get(key);
    return acronym ? token.replace(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+/u, acronym) : token;
  }).join("");
}

function planContentDisplayMap() {
  const map = new Map();
  let unit = 0, content = 0, subcontent = 0;
  for (const raw of institutionalDataState?.unitContents || []) {
    const depth = institutionalContentDepth(raw);
    const rawText = institutionalContentText(raw);
    const text = depth === 1 ? sentenceCaseInstitutionalUnit(rawText) : rawText;
    if (depth === 1) { unit += 1; content = 0; subcontent = 0; }
    else if (depth === 2) { if (!unit) unit = 1; content += 1; subcontent = 0; }
    else { if (!unit) unit = 1; if (!content) content = 1; subcontent += 1; }
    const label = depth === 1 ? `Unidad ${unit}: ${text}` : depth === 2 ? `${unit}.${content}. ${text}` : `${unit}.${content}.${subcontent}. ${text}`;
    map.set(normalizePlanPreviewValue(raw), label);
  }
  return map;
}
function planPreviewContentHtml(values) {
  const display = planContentDisplayMap();
  const items = (Array.isArray(values) ? values : []).filter((value) => String(value || "").trim());
  return items.length ? items.map((value) => `<span class="plan-preview-content-line">${escapeHtml(display.get(normalizePlanPreviewValue(value)) || value)}</span>`).join("") : "—";
}
function fallbackActivityComponent(week, description, evaluatedActivities = []) {
  const evaluated = evaluatedActivities.find((activity) => Number(activity.week) === Number(week.week) && normalizePlanPreviewValue(activity.activity) === normalizePlanPreviewValue(description));
  if (evaluated) return evaluated.component;
  const nonZero = [["ACD", Number(week.acdHours || 0)], ["APE", Number(week.apeHours || 0)], ["AA", Number(week.aaHours || 0)]].filter(([, hours]) => hours > 0);
  return nonZero.length === 1 ? nonZero[0][0] : "AA";
}
function planWeekActivityDetails(week, evaluatedActivities = []) {
  if (Array.isArray(week.activityDetails) && week.activityDetails.length) return week.activityDetails;
  const details = (week.activities || []).map((description) => ({
    component: fallbackActivityComponent(week, description, evaluatedActivities),
    description,
    resource: week.resources?.[0] || "",
    hours: 0,
    evaluationCode: evaluatedActivities.find((activity) => Number(activity.week) === Number(week.week) && normalizePlanPreviewValue(activity.activity) === normalizePlanPreviewValue(description))?.code || null,
  }));
  const evaluated = evaluatedActivities.find((activity) => Number(activity.week) === Number(week.week));
  if (evaluated && !details.some((detail) => detail.evaluationCode === evaluated.code)) {
    details.push({ component: evaluated.component, description: evaluated.activity, resource: week.resources?.[0] || "", hours: 0, evaluationCode: evaluated.code });
  }
  return details;
}
function planPreviewActivitiesHtml(week, evaluatedActivities = []) {
  return planWeekActivityDetails(week, evaluatedActivities).map((detail) => `<div class="plan-preview-activity"><span class="plan-preview-component">${escapeHtml(detail.component)}</span>${detail.evaluationCode ? `<span class="plan-preview-evaluation-code">${escapeHtml(detail.evaluationCode)}</span>` : ""}<span class="plan-preview-activity-text">${escapeHtml(detail.description)}${Number(detail.hours || 0) ? ` <small>(${Number(detail.hours)} h)</small>` : ""}</span></div>`).join("") || "—";
}
function planPreviewResourcesHtml(week, evaluatedActivities = []) {
  const details = planWeekActivityDetails(week, evaluatedActivities);
  return details.map((detail) => `<div class="plan-preview-resource-line">${escapeHtml(detail.resource || "—")}</div>`).join("") || planPreviewMultiline(week.resources);
}
function instrumentDefaultCriteria(type, activityLabel = "Criterio de la actividad") {
  const genericLabels = [
    "Pertinencia y cumplimiento de los criterios solicitados",
    "Ortografía y redacción",
    "Aplicación de lo aprendido y pensamiento crítico",
    "Uso adecuado de citas y referencias bibliográficas",
  ];
  const rubricLevels = [
    ["Excelente", "Demuestra un dominio completo y pertinente del criterio.", 2.5],
    ["Bueno", "Demuestra un dominio adecuado del criterio.", 1.75],
    ["Regular", "Demuestra un dominio limitado del criterio.", 1],
    ["Deficiente", "No demuestra suficientemente el criterio.", 0],
  ];
  const scaleLevels = [
    ["Muy bien", "Cumple plenamente el criterio.", 2.5],
    ["Bien", "Cumple el criterio en un nivel adecuado.", 1.75],
    ["Regular", "Cumple parcialmente el criterio.", 1],
    ["Deficiente", "No cumple el criterio.", 0],
  ];
  const checklistLevels = [["Sí", "Cumple el criterio.", 2.5], ["No", "No cumple completamente el criterio.", 1.75]];
  const levels = type === "RUBRIC" ? rubricLevels : type === "RATING_SCALE" ? scaleLevels : checklistLevels;
  return genericLabels.map((label, index) => ({
    label: index === 0 && activityLabel ? `${label}: ${activityLabel}` : label,
    levels: levels.map(([level, description, score]) => ({ label: level, description, score })),
  }));
}
function defaultInstrumentConfig(type, title = "") {
  const normalizedType = planInstrumentTypeLabels[type] ? type : "OTHER";
  return {
    type: normalizedType,
    title: title || planInstrumentTypeLabels[normalizedType],
    maximumScore: 10,
    questionnaire: normalizedType === "QUESTIONNAIRE" ? { gradingMode: "LAST_ATTEMPT", questionCount: 10, timeMinutes: 20 } : null,
    criteria: ["RUBRIC", "CHECKLIST", "RATING_SCALE"].includes(normalizedType) ? instrumentDefaultCriteria(normalizedType) : [],
  };
}
function instrumentConfigForActivity(activity) {
  if (activity?.instrumentConfig) return structuredClone(activity.instrumentConfig);
  const name = String(activity?.instrument || "").toLocaleLowerCase("es");
  const type = /cuestion/.test(name) ? "QUESTIONNAIRE" : /rúbrica|rubrica/.test(name) ? "RUBRIC" : /cotejo/.test(name) ? "CHECKLIST" : /escala/.test(name) ? "RATING_SCALE" : "OTHER";
  return defaultInstrumentConfig(type, activity?.instrument || "");
}
function instrumentMaximumScore(config) {
  if (!config || !["RUBRIC", "CHECKLIST", "RATING_SCALE"].includes(config.type)) return 10;
  return (config.criteria || []).reduce((sum, criterion) => sum + Math.max(0, ...(criterion.levels || []).map((level) => Number(level.score || 0))), 0);
}
function planInstrumentDetailHtml(activity) {
  const config = activity?.instrumentConfig;
  if (!config) return "";
  const formula = `Calificación real = (puntaje EVA / 10) × ${Number(activity.grade).toFixed(2)}`;
  if (config.type === "QUESTIONNAIRE") {
    const questionnaire = config.questionnaire || {};
    return `<div class="plan-instrument-detail"><h6>Configuración EVA · Cuestionario · 10 puntos</h6><div>Tipo de calificación: <strong>${escapeHtml(planQuestionnaireModeLabels[questionnaire.gradingMode] || questionnaire.gradingMode || "—")}</strong></div><div>Número de preguntas: <strong>${escapeHtml(questionnaire.questionCount || "—")}</strong></div><div>Tiempo: <strong>${escapeHtml(questionnaire.timeMinutes || "—")} minutos</strong></div><div class="plan-score-formula">${escapeHtml(formula)}</div></div>`;
  }
  if (["RUBRIC", "CHECKLIST", "RATING_SCALE"].includes(config.type)) {
    const levelLabels = [...new Set((config.criteria || []).flatMap((criterion) => (criterion.levels || []).map((level) => level.label)))];
    return `<div class="plan-instrument-detail"><h6>${escapeHtml(planInstrumentTypeLabels[config.type])} · escala EVA sobre 10 puntos</h6><div class="plan-preview-table-wrap"><table><thead><tr><th>Indicadores</th>${levelLabels.map((label) => `<th>${escapeHtml(label)}</th>`).join("")}</tr></thead><tbody>${(config.criteria || []).map((criterion) => `<tr><th>${escapeHtml(criterion.label)}</th>${levelLabels.map((label) => { const level = (criterion.levels || []).find((item) => item.label === label); return `<td>${level ? `${escapeHtml(level.description || "")}<br><strong>${Number(level.score || 0).toFixed(2)} pts</strong>` : "—"}</td>`; }).join("")}</tr>`).join("")}</tbody></table></div><div class="plan-score-formula">Puntaje máximo: ${instrumentMaximumScore(config).toFixed(2)} / 10 · ${escapeHtml(formula)}</div></div>`;
  }
  return `<div class="plan-instrument-detail"><h6>Instrumento EVA · 10 puntos</h6><div class="plan-score-formula">${escapeHtml(formula)}</div></div>`;
}

function teachingPlanPreviewHtml() {
  if (!teachingPlanState?.content) return '<div class="plan-preview-empty">Genere el Plan Docente para visualizarlo.</div>';
  const project = data();
  const content = teachingPlanState.content;
  const mappings = Array.isArray(outcomeMappingsState) ? outcomeMappingsState : [];
  const teacher = teacherProfileState || {};
  const prerequisites = institutionalDataState?.prerequisites || [];
  const sequences = Array.isArray(content.sequences) ? content.sequences : [];
  const evaluated = [...(content.evaluatedActivities || [])].sort((left, right) => Number(left.week) - Number(right.week));
  const category = institutionalDataState?.planCategory || "";
  const categoryMarks = `Conceptual ${category === "CONCEPTUAL" ? "☒" : "☐"} · Activa ${category === "ACTIVE" ? "☒" : "☐"} · Integradora ${category === "INTEGRATING" ? "☒" : "☐"}`;
  const currentTemplateFormat = teachingPlanState?.templateProfile?.profile === "CURRENT_MODULAR";
  const totalHours = Number(institutionalDataState?.acdHours || 0) + Number(institutionalDataState?.apeHours || 0) + Number(institutionalDataState?.aaHours || 0);
  return `
    <section class="plan-preview-cover plan-preview-section" id="plan-preview-cover">
      <div class="plan-preview-brand"><strong>UTPL</strong><span>Vicerrectorado Académico</span></div>
      <div class="plan-preview-cover-main">
        <h2>Universidad Técnica Particular de Loja</h2>
        <p><strong>Facultad:</strong><br>${escapeHtml(project.faculty || "—")}</p>
        <p><strong>Carrera:</strong><br>${escapeHtml(project.career || "—")}</p>
        <p><strong>Plan Docente de la asignatura:</strong><br>${escapeHtml(project.subjectName || "—")}</p>
        <p><strong>Docente responsable:</strong><br>${escapeHtml(project.professorName || "—")}</p>
      </div>
      <p><strong>Modalidad de estudio:</strong> ${escapeHtml(project.modality || "—")}</p>
    </section>
    <section class="plan-preview-section" id="plan-preview-a">
      <div class="plan-preview-band">A. Datos de identificación de la asignatura</div>
      <div class="plan-preview-table-wrap"><table class="plan-identification-table"><tbody>
        ${currentTemplateFormat ? `
          <tr><th>Facultad</th><td colspan="3">${escapeHtml(project.faculty || "—")}</td></tr>
          <tr><th>Carrera</th><td colspan="3">${escapeHtml(project.career || "—")}</td></tr>
          <tr><th>Asignatura</th><td colspan="3">${escapeHtml(project.subjectName || "—")}</td></tr>
          <tr><th>Código</th><td colspan="3">${escapeHtml(project.subjectCode || "—")}</td></tr>
          <tr><th>Número de créditos</th><td colspan="3">${escapeHtml(institutionalDataState?.credits ?? "—")}</td></tr>
          <tr><th rowspan="2">Total de horas por componente de aprendizaje</th><th>Aprendizaje en contacto con el docente (ACD)</th><th>Aprendizaje Práctico-Experimental (APE)</th><th>Aprendizaje Autónomo (AA)</th></tr>
          <tr><td>${escapeHtml(institutionalDataState?.acdHours ?? "0")}</td><td>${escapeHtml(institutionalDataState?.apeHours ?? "0")}</td><td>${escapeHtml(institutionalDataState?.aaHours ?? "0")}</td></tr>
          <tr><th>Tipo de asignatura</th><td colspan="3">${escapeHtml(categoryMarks)}</td></tr>
          <tr><th>Periodo académico/nivel</th><td colspan="3">${escapeHtml(project.academicPeriod || "—")} / ${escapeHtml(project.level || "—")}</td></tr>
          <tr><th>Período académico ordinario/semestre</th><td colspan="3">${escapeHtml(institutionalDataState?.semester || "—")}</td></tr>
        ` : `
          <tr><th colspan="4" class="plan-identification-period">PERÍODO ACADÉMICO ORDINARIO</th></tr>
          <tr><th>Facultad</th><td>${escapeHtml(project.faculty || "—")}</td><th>Carrera</th><td>${escapeHtml(project.career || "—")}</td></tr>
          <tr><th>Asignatura</th><td>${escapeHtml(project.subjectName || "—")}</td><th>Código</th><td>${escapeHtml(project.subjectCode || "—")}</td></tr>
          <tr><th>Número de créditos/horas</th><td colspan="3">Créditos: ${escapeHtml(institutionalDataState?.credits ?? "—")} · Horas totales: ${totalHours}</td></tr>
          <tr><th>Total de horas por componente de aprendizaje</th><td><strong>ACD</strong><br>${escapeHtml(institutionalDataState?.acdHours ?? "0")}</td><td><strong>APE</strong><br>${escapeHtml(institutionalDataState?.apeHours ?? "0")}</td><td><strong>AA</strong><br>${escapeHtml(institutionalDataState?.aaHours ?? "0")}</td></tr>
          <tr><th>Tipo de asignatura</th><td>${escapeHtml(categoryMarks)}</td><th>Duración</th><td>${escapeHtml(project.weeks || totalWeeks())} semanas lectivas</td></tr>
          <tr><th>Periodo académico/nivel</th><td>${escapeHtml(project.level || "—")}</td><th>Período académico ordinario/semestre</th><td>${escapeHtml(institutionalDataState?.semester || project.academicPeriod || "—")}</td></tr>
        `}
      </tbody></table></div>
    </section>
    <section class="plan-preview-section" id="plan-preview-b">
      <div class="plan-preview-band">B. Descripción de la asignatura</div>
      <h5 class="plan-preview-subtitle">Presentación y Contextualización en el marco de la descripción microcurricular</h5>
      <p class="plan-preview-paragraph">${escapeHtml(content.presentation || "—")}</p>
      <h5 class="plan-preview-subtitle">Prerrequisitos</h5>${planPreviewList(prerequisites)}
      <h5 class="plan-preview-subtitle">Adaptaciones curriculares</h5>
      <p class="plan-preview-paragraph">${escapeHtml(content.curricularAdaptations || "—")}</p>
    </section>
    <section class="plan-preview-section" id="plan-preview-c">
      <div class="plan-preview-band">C. Contribución al perfil de egreso y profesional y relación con las competencias genéricas de la UTPL</div>
      <div class="plan-preview-table-wrap"><table><thead><tr><th>Resultado de aprendizaje de la asignatura</th><th>Contribución</th><th>Competencia del perfil profesional</th><th>Resultado de aprendizaje del perfil de egreso</th><th>Competencia genérica UTPL</th></tr></thead><tbody>
        ${mappings.map((mapping) => `<tr><td>${escapeHtml(mapping.learningOutcome || "—")}</td><td>${escapeHtml(contributionPreviewLabels[mapping.contribution] || mapping.contribution || "—")}</td><td>${planPreviewMultiline(mapping.professionalCompetencies)}</td><td>${planPreviewMultiline(mapping.graduateProfileResults)}</td><td>${planPreviewMultiline(mapping.utplGenericCompetencies)}</td></tr>`).join("") || '<tr><td colspan="5">No existen relaciones registradas.</td></tr>'}
      </tbody></table></div>
    </section>
    <section class="plan-preview-section" id="plan-preview-d">
      <div class="plan-preview-band">D. Programación del proceso de aprendizaje de la asignatura</div>
      ${sequences.map((sequence, index) => `<section class="plan-preview-sequence">
        <div class="plan-preview-sequence-header">${index + 1}. Resultado de aprendizaje de la asignatura: ${escapeHtml(sequence.learningOutcome)}</div>
        <div class="plan-preview-method-grid"><div><strong>Metodología(s) activa(s)</strong><p>${escapeHtml(sequence.methodology)}</p></div><div><strong>Tecnologías del aprendizaje y conocimiento — TAC</strong>${planPreviewList(sequence.tac)}</div></div>
        <div class="plan-preview-table-wrap"><table><thead><tr><th>Semana</th><th>Contenidos</th><th>ACD</th><th>APE</th><th>AA</th><th>Actividades de aprendizaje</th><th>Recursos de aprendizaje</th>${currentTemplateFormat ? "" : "<th>Instrumento</th><th>Calificación</th>"}</tr></thead><tbody>
          ${(sequence.weeks || []).map((week) => { const evaluatedActivity = evaluated.find((activity) => Number(activity.week) === Number(week.week)); return `<tr><td>${week.week}<br><button class="icon-action plan-week-edit" type="button" data-edit-plan-week="${week.week}" data-sequence-index="${index}" aria-label="Editar semana ${week.week}" title="Editar semana ${week.week}">✎</button></td><td>${planPreviewContentHtml(week.unitContents)}</td><td>${week.acdHours}</td><td>${week.apeHours}</td><td>${week.aaHours}</td><td>${planPreviewActivitiesHtml(week, evaluated)}</td><td>${planPreviewResourcesHtml(week, evaluated)}</td>${currentTemplateFormat ? "" : `<td>${escapeHtml(week.assessmentInstrument || evaluatedActivity?.instrument || "—")}</td><td>${Number(week.grade || 0) ? escapeHtml(week.grade) : "—"}</td>`}</tr>`; }).join("")}
        </tbody></table></div>
      </section>`).join("")}
    </section>
    <section class="plan-preview-section" id="plan-preview-e">
      <div class="plan-preview-band">E. Evaluación de la asignatura</div>
      <h5 class="plan-preview-subtitle">Descripción de las actividades calificadas</h5>
      <div class="plan-preview-table-wrap"><table><thead><tr><th>Componente</th><th>Actividad</th><th>Estrategias de trabajo</th><th>Instrumento</th><th>Semana</th><th>Calificación</th><th>Peso</th></tr></thead><tbody>
        ${evaluated.map((activity) => `<tr><td>${escapeHtml(activity.component)}</td><td><strong>${escapeHtml(activity.code)}.</strong> ${escapeHtml(activity.activity)}</td><td>${linesListHtml(activity.workStrategies)}</td><td>${escapeHtml(activity.instrument)}</td><td>Semana ${activity.week}${planWeekDateRange(activity.week) ? `<br><small>${escapeHtml(planWeekDateRange(activity.week))}</small>` : ""}</td><td>${activity.grade}</td><td>${activity.weight}%</td></tr>`).join("")}
        <tr><th colspan="5">TOTAL</th><th>${evaluated.reduce((sum, item) => sum + Number(item.grade || 0), 0).toFixed(1)}</th><th>${evaluated.reduce((sum, item) => sum + Number(item.weight || 0), 0)}%</th></tr>
      </tbody></table></div>
      <h5 class="plan-preview-subtitle">Periodos institucionales de evaluación</h5>
      <ul class="plan-preview-list">
        <li><strong>Evaluación bimestral:</strong> ${escapeHtml(planEvaluationWindowLabel(planPeriodState()?.bimestralEvaluationStartAt, planPeriodState()?.bimestralEvaluationEndAt))}</li>
      </ul>
      <h5 class="plan-preview-subtitle">Evaluación de recuperación</h5>
      <p class="plan-preview-paragraph"><strong>Fecha:</strong> ${escapeHtml(planEvaluationWindowLabel(planPeriodState()?.recoveryEvaluationStartAt, planPeriodState()?.recoveryEvaluationEndAt))}</p>
      <p class="plan-preview-paragraph">Semana 10 · 70% de la evaluación de recuperación más 30% del acumulado del módulo.</p>
    </section>
    <section class="plan-preview-section" id="plan-preview-f">
      <div class="plan-preview-band">F. Datos del equipo docente</div>
      <div class="plan-preview-table-wrap"><table><tbody>
        <tr><th>Docente responsable</th><td>${escapeHtml(project.professorName || "—")}</td><th>Correo electrónico</th><td>${escapeHtml(authenticatedUserData?.email || "—")}</td></tr>
        <tr><th>Título(s) de tercer nivel</th><td>${planPreviewMultiline(teacher.thirdLevelDegrees)}</td><th>Título(s) de cuarto nivel</th><td>${planPreviewMultiline(teacher.fourthLevelDegrees)}</td></tr>
        <tr><th>Facultad</th><td>${escapeHtml(teacher.faculty || "—")}</td><th>Departamento</th><td>${escapeHtml(teacher.department || "—")}</td></tr>
        <tr><th>Teléfono</th><td>${escapeHtml(teacher.phone || "—")}</td><th>Currículo profesional resumido</th><td>${escapeHtml(teacher.shortCv || "—")}</td></tr>
      </tbody></table></div>
    </section>
    <section class="plan-preview-section" id="plan-preview-g">
      <div class="plan-preview-band">G. Bibliografía básica y complementaria</div>
      <h5 class="plan-preview-subtitle">Bibliografía básica</h5>
      ${bibliographyBasicPreviewHtml()}
      <h5 class="plan-preview-subtitle">Bibliografía complementaria</h5>${bibliographyPreviewHtml("COMPLEMENTARY")}
      <h5 class="plan-preview-subtitle">Recursos educativos abiertos (REA)</h5>${bibliographyPreviewHtml("REA")}
    </section>
    <section class="plan-preview-section" id="plan-preview-h">
      <div class="plan-preview-band">H. Aprobación</div>
      <p class="plan-preview-paragraph">Esta sección se completa y aprueba fuera del sistema. El documento Word incluirá el espacio correspondiente para la aprobación del director o directora de carrera.</p>
      <div class="plan-preview-table-wrap"><table><thead><tr><th>Actividad</th><th>Nombre</th><th>Función</th><th>Firma</th></tr></thead><tbody><tr><td>Aprobación</td><td>—</td><td>Director/a de carrera</td><td>—</td></tr></tbody></table></div>
    </section>`;
}
function renderTeachingPlanTemplateApplied() {
  const target = $("#teaching-plan-template-applied");
  if (!target) return;
  const snapshot = teachingPlanState?.templateSnapshot;
  const active = teachingPlanState?.activeTemplate;
  if (teachingPlanState?.templateOutdated && snapshot && active) {
    target.classList.add("warning");
    target.textContent = `Formato usado en este plan: ${snapshot.title} · v${snapshot.version}. Está activo ${active.title} · v${active.version}; regenere el Plan Docente para aplicar el formato vigente.`;
    return;
  }
  target.classList.remove("warning");
  target.textContent = snapshot
    ? `Formato institucional aplicado: ${snapshot.title} · v${snapshot.version}`
    : "Formato institucional aplicado: versión registrada en la generación del Plan Docente.";
}


let planPreviewObserver = null;
function observePlanPreviewSections() {
  planPreviewObserver?.disconnect();
  const nav = $("#teaching-plan-preview-nav");
  if (!nav || typeof IntersectionObserver === "undefined") return;
  planPreviewObserver = new IntersectionObserver((entries) => {
    const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    $$("button[data-plan-preview-target]", nav).forEach((button) => button.classList.toggle("active", button.dataset.planPreviewTarget === visible.target.id));
  }, { root: document.querySelector(".wizard-scroll"), rootMargin: "-15% 0px -70% 0px", threshold: [0.05, .25, .5] });
  planPreviewSections.forEach(([id]) => { const target = document.getElementById(`plan-preview-${id}`); if (target) planPreviewObserver.observe(target); });
}

function renderTeachingPlanReview() {
  const preview = $("#teaching-plan-preview");
  const nav = $("#teaching-plan-preview-nav");
  const checksContainer = $("#teaching-plan-review-checks");
  const notes = $("#teacher-plan-review-notes");
  const confirm = $("#teacher-plan-review-confirm");
  const button = $("#confirm-teaching-plan-review");
  const status = $("#teaching-plan-review-status");
  if (!preview || !nav || !checksContainer || !notes || !confirm || !button || !status) return;
  preview.innerHTML = teachingPlanPreviewHtml();
  nav.innerHTML = planPreviewSections.map(([id, code, label]) => `<button type="button" data-plan-preview-target="plan-preview-${id}" data-label="${escapeHtml(label)}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">${escapeHtml(code)}</button>`).join("");
  renderTeachingPlanTemplateApplied();
  requestAnimationFrame(observePlanPreviewSections);
  const checks = teachingPlanReviewChecksState();
  checksContainer.innerHTML = checks.map((check) => `<article class="teaching-plan-review-check ${check.ok ? "ok" : "error"}"><span class="icon">${check.ok ? "✓" : "!"}</span><div><strong>${escapeHtml(check.label)}</strong><small>${escapeHtml(check.detail)}</small></div></article>`).join("");
  const reviewed = Boolean(teachingPlanState?.reviewedAt);
  notes.value = teachingPlanState?.reviewNotes || "";
  confirm.checked = reviewed;
  const allOk = checks.length > 0 && checks.every((check) => check.ok);
  const summaryText = $("#teaching-plan-validation-summary-text");
  if (summaryText) summaryText.textContent = allOk
    ? `${checks.filter((check) => check.ok).length}/${checks.length} validaciones automáticas correctas`
    : `${checks.filter((check) => check.ok).length}/${checks.length} validaciones correctas · revise los pendientes`;
  button.disabled = !allOk || !confirm.checked;
  button.textContent = reviewed ? "Actualizar confirmación de revisión" : "Confirmar revisión del plan";
  status.className = `teaching-plan-review-status ${reviewed ? "reviewed" : "pending"}`;
  status.textContent = reviewed
    ? `Revisión confirmada el ${teachingPlanReviewDate(teachingPlanState.reviewedAt)}. Si modifica el Plan Docente, deberá revisarlo nuevamente.`
    : "Pendiente: confirme la revisión para habilitar las descargas configuradas y la generación de la Guía Didáctica.";
}

function renderTeachingPlan() {
  const panel = $("#teaching-plan-result");
  if (!panel) return;
  panel.classList.toggle("hidden", !teachingPlanState);
  updatePlanDownloadButtons();
  if (!teachingPlanState) {
    $("#plan-methodologies").innerHTML = "";
    const preview = $("#teaching-plan-preview");
    if (preview) preview.innerHTML = "";
    renderAdaptationWorkspaces();
    return;
  }
  const content = teachingPlanState.content;
  $("#plan-methodologies").innerHTML = content.sequences.map((sequence, index) => `
    <section class="academic-profile-card plan-methodology-card">
      <h5>${escapeHtml(sequence.learningOutcome)}</h5>
      <label>Metodología activa<textarea data-plan-methodology="${index}">${escapeHtml(sequence.methodology)}</textarea></label>
      <label>TAC — una por línea<textarea data-plan-tac="${index}">${escapeHtml(sequence.tac.join("\n"))}</textarea></label>
    </section>`).join("");
  renderTeachingPlanReview();
  summarize();
  renderAdaptationWorkspaces();
}

function setTeachingPlanValidationOpen(open) {
  const panel = $("#teaching-plan-review-panel");
  const button = $("#toggle-teaching-plan-validation");
  if (!panel || !button) return;
  panel.classList.toggle("hidden", !open);
  button.setAttribute("aria-expanded", String(open));
  button.textContent = open ? "Ocultar validación" : "Ver validación";
  if (open) panel.focus({ preventScroll: true });
}
$("#toggle-teaching-plan-validation")?.addEventListener("click", () => {
  const open = $("#teaching-plan-review-panel")?.classList.contains("hidden");
  setTeachingPlanValidationOpen(Boolean(open));
});
$("#close-teaching-plan-validation")?.addEventListener("click", () => setTeachingPlanValidationOpen(false));

let teachingPlanWeekEditorState = null;
function closeTeachingPlanWeekEditor() {
  $("#teaching-plan-week-modal")?.classList.add("hidden");
  teachingPlanWeekEditorState = null;
}
function blankInstrumentCriterion(type, label = "Nuevo criterio") {
  const template = type === "CHECKLIST"
    ? [["Sí", "Cumple el criterio.", 0], ["No", "No cumple el criterio.", 0]]
    : type === "RATING_SCALE"
      ? [["Muy bien", "", 0], ["Bien", "", 0], ["Regular", "", 0], ["Deficiente", "", 0]]
      : [["Excelente", "", 0], ["Bueno", "", 0], ["Regular", "", 0], ["Deficiente", "", 0]];
  return { label, levels: template.map(([level, description, score]) => ({ label: level, description, score })) };
}
function syncTeachingPlanWeekActivitiesFromDom() {
  if (!teachingPlanWeekEditorState) return;
  const rows = $$(".teaching-plan-activity-row", $("#teaching-plan-week-activities"));
  if (!rows.length) return;
  teachingPlanWeekEditorState.activityDetails = rows.map((row) => {
    const index = Number(row.dataset.activityIndex);
    const original = teachingPlanWeekEditorState.activityDetails[index] || {};
    return {
      component: row.dataset.evaluationCode ? original.component : (row.querySelector(".plan-activity-component")?.value || original.component || "AA"),
      description: row.querySelector(".plan-activity-description")?.value || original.description || "",
      resource: row.querySelector(".plan-activity-resource")?.value || original.resource || "",
      hours: Number(row.querySelector(".plan-activity-hours")?.value || 0),
      evaluationCode: row.dataset.evaluationCode || null,
    };
  });
}
function renderTeachingPlanWeekActivitiesEditor() {
  const container = $("#teaching-plan-week-activities");
  if (!container || !teachingPlanWeekEditorState) return;
  container.innerHTML = teachingPlanWeekEditorState.activityDetails.map((detail, index) => `<div class="teaching-plan-activity-row" data-activity-index="${index}" data-evaluation-code="${escapeHtml(detail.evaluationCode || "")}">
    <label>Componente<select class="plan-activity-component" ${detail.evaluationCode ? "disabled" : ""}><option value="ACD" ${detail.component === "ACD" ? "selected" : ""}>ACD</option><option value="APE" ${detail.component === "APE" ? "selected" : ""}>APE</option><option value="AA" ${detail.component === "AA" ? "selected" : ""}>AA</option></select></label>
    <label>Actividad<textarea class="plan-activity-description" maxlength="3000">${escapeHtml(detail.description || "")}</textarea></label>
    <label>Recurso de aprendizaje<textarea class="plan-activity-resource" maxlength="2000" rows="3">${escapeHtml(detail.resource || "")}</textarea></label>
    <label>Horas<input class="plan-activity-hours" type="number" min="0" max="1000" step="1" value="${Number(detail.hours || 0)}"></label>
    ${detail.evaluationCode ? `<span class="evaluation-badge">${escapeHtml(detail.evaluationCode)} · calificada</span>` : `<button class="icon-action plan-remove-activity" type="button" data-index="${index}" aria-label="Eliminar actividad" title="Eliminar actividad">🗑</button>`}
  </div>`).join("");
  refreshTeachingPlanActivityHoursSummary();
}
function refreshTeachingPlanActivityHoursSummary() {
  const target = $("#teaching-plan-activity-hours-summary"); if (!target || !teachingPlanWeekEditorState) return;
  const rows = $$(".teaching-plan-activity-row", $("#teaching-plan-week-activities"));
  const sums = { ACD: 0, APE: 0, AA: 0 };
  rows.forEach((row) => { const component = row.dataset.evaluationCode ? teachingPlanWeekEditorState.activityDetails[Number(row.dataset.activityIndex)]?.component : row.querySelector(".plan-activity-component")?.value; sums[component] = (sums[component] || 0) + Number(row.querySelector(".plan-activity-hours")?.value || 0); });
  const expected = { ACD: teachingPlanWeekEditorState.acdHours, APE: teachingPlanWeekEditorState.apeHours, AA: teachingPlanWeekEditorState.aaHours };
  target.innerHTML = ["ACD", "APE", "AA"].map((key) => `<span class="${sums[key] === expected[key] ? "ok" : "error"}">${key}: ${sums[key]}/${expected[key]} h</span>`).join("");
}
function readInstrumentCriteriaFromEditor() {
  return $$(".instrument-criterion-card", $("#teaching-plan-instrument-criteria")).map((card) => ({
    label: card.querySelector(".instrument-criterion-label")?.value.trim() || "",
    levels: $$(".instrument-level-row", card).map((row) => ({
      label: row.querySelector(".instrument-level-label")?.value.trim() || "",
      description: row.querySelector(".instrument-level-description")?.value.trim() || "",
      score: Number(row.querySelector(".instrument-level-score")?.value || 0),
    })),
  }));
}
function refreshInstrumentEditorTotal() {
  const total = $("#teaching-plan-instrument-total");
  if (!total) return;
  const criteria = readInstrumentCriteriaFromEditor();
  const maximum = criteria.reduce((sum, criterion) => sum + Math.max(0, ...criterion.levels.map((level) => Number(level.score || 0))), 0);
  total.textContent = `${maximum.toFixed(2)} / 10`;
  total.classList.toggle("error", Math.abs(maximum - 10) > .001);
}
function renderTeachingPlanInstrumentCriteria() {
  const container = $("#teaching-plan-instrument-criteria");
  if (!container || !teachingPlanWeekEditorState?.instrumentConfig) return;
  const config = teachingPlanWeekEditorState.instrumentConfig;
  container.innerHTML = (config.criteria || []).map((criterion, criterionIndex) => `<article class="instrument-criterion-card" data-criterion-index="${criterionIndex}">
    <div class="instrument-criterion-header"><label>Criterio / indicador<input class="instrument-criterion-label" maxlength="1000" value="${escapeHtml(criterion.label || "")}"></label><button class="icon-action instrument-remove-criterion" type="button" data-index="${criterionIndex}" aria-label="Eliminar criterio" title="Eliminar criterio">🗑</button></div>
    <div class="instrument-levels">${(criterion.levels || []).map((level, levelIndex) => `<div class="instrument-level-row" data-level-index="${levelIndex}"><input class="instrument-level-label" maxlength="120" aria-label="Nivel" value="${escapeHtml(level.label || "")}"><textarea class="instrument-level-description" maxlength="2000" rows="2" aria-label="Descriptor">${escapeHtml(level.description || "")}</textarea><input class="instrument-level-score" type="number" min="0" max="10" step="0.01" aria-label="Puntaje" value="${Number(level.score || 0)}">${config.type === "CHECKLIST" ? "" : `<button class="button secondary instrument-remove-level" type="button" data-criterion="${criterionIndex}" data-level="${levelIndex}">×</button>`}</div>`).join("")}</div>
    ${config.type === "CHECKLIST" ? "" : `<button class="icon-action instrument-add-level" type="button" data-criterion="${criterionIndex}" aria-label="Agregar nivel" title="Agregar nivel">＋</button>`}
  </article>`).join("");
  refreshInstrumentEditorTotal();
}
function renderTeachingPlanInstrumentEditor() {
  if (!teachingPlanWeekEditorState) return;
  const evaluatedPanel = $("#teaching-plan-evaluated-editor");
  const evaluated = teachingPlanWeekEditorState.evaluatedActivity;
  evaluatedPanel?.classList.toggle("hidden", !evaluated);
  if (!evaluated) return;
  const form = $("#teaching-plan-week-form");
  $("#teaching-plan-evaluation-code").textContent = `${evaluated.code} · ${evaluated.component} · ${evaluated.grade} pts reales`;
  form.elements.evaluatedActivity.value = evaluated.activity || "";
  form.elements.workStrategies.value = evaluated.workStrategies || "";
  form.elements.instrumentType.value = teachingPlanWeekEditorState.instrumentConfig.type;
  form.elements.instrumentTitle.value = teachingPlanWeekEditorState.instrumentConfig.title || "";
  const config = teachingPlanWeekEditorState.instrumentConfig;
  const questionnairePanel = $("#teaching-plan-questionnaire-config");
  const criteriaPanel = $("#teaching-plan-criteria-editor");
  questionnairePanel?.classList.toggle("hidden", config.type !== "QUESTIONNAIRE");
  criteriaPanel?.classList.toggle("hidden", !["RUBRIC", "CHECKLIST", "RATING_SCALE"].includes(config.type));
  if (config.type === "QUESTIONNAIRE") {
    const q = config.questionnaire || { gradingMode: "LAST_ATTEMPT", questionCount: 10, timeMinutes: 20 };
    form.elements.gradingMode.value = q.gradingMode;
    form.elements.questionCount.value = q.questionCount;
    form.elements.timeMinutes.value = q.timeMinutes;
  }
  renderTeachingPlanInstrumentCriteria();
}
function openTeachingPlanWeekEditor(sequenceIndex, weekNumber) {
  if (!teachingPlanState?.content) return;
  const sequence = teachingPlanState.content.sequences?.[sequenceIndex];
  const week = sequence?.weeks?.find((item) => Number(item.week) === Number(weekNumber));
  if (!sequence || !week) return;
  const evaluated = (teachingPlanState.content.evaluatedActivities || []).find((activity) => Number(activity.week) === Number(weekNumber));
  const activityDetails = planWeekActivityDetails(week, teachingPlanState.content.evaluatedActivities || []).map((detail) => ({ ...detail }));
  teachingPlanWeekEditorState = {
    sequenceIndex,
    learningOutcome: sequence.learningOutcome,
    week: weekNumber,
    unitContents: [...(week.unitContents || [])],
    acdHours: Number(week.acdHours || 0), apeHours: Number(week.apeHours || 0), aaHours: Number(week.aaHours || 0),
    grade: Number(week.grade || 0),
    resources: [...(week.resources || [])],
    activityDetails: activityDetails.map((detail, index) => ({ ...detail, resource: detail.resource || week.resources?.[index] || week.resources?.[0] || "", hours: Number(detail.hours || 0) })) ,
    evaluatedActivity: evaluated ? structuredClone(evaluated) : null,
    instrumentConfig: evaluated ? instrumentConfigForActivity(evaluated) : null,
  };
  const form = $("#teaching-plan-week-form");
  form.elements.learningOutcome.value = sequence.learningOutcome;
  form.elements.week.value = String(weekNumber);
  $("#teaching-plan-week-title").textContent = `Editar semana ${weekNumber}`;
  $("#teaching-plan-week-locked").innerHTML = `<strong>Resultado de aprendizaje:</strong> ${escapeHtml(sequence.learningOutcome)}<br><strong>Contenidos institucionales:</strong> ${planPreviewContentHtml(week.unitContents)}<br><strong>Horas protegidas:</strong> ACD ${week.acdHours} · APE ${week.apeHours} · AA ${week.aaHours}${evaluated ? `<br><strong>Calificación institucional:</strong> ${evaluated.code} · ${evaluated.grade} puntos · ${evaluated.weight}%` : ""}`;
  renderTeachingPlanWeekActivitiesEditor();
  renderTeachingPlanInstrumentEditor();
  $("#teaching-plan-week-modal")?.classList.remove("hidden");
  setTimeout(() => $("#teaching-plan-week-activities textarea")?.focus(), 0);
}
function instrumentConfigFromWeekEditor() {
  const form = $("#teaching-plan-week-form");
  const type = form.elements.instrumentType.value;
  const config = { type, title: form.elements.instrumentTitle.value.trim(), maximumScore: 10, questionnaire: null, criteria: [] };
  if (!config.title) throw new Error("Nombre del instrumento: ingrese un nombre.");
  if (type === "QUESTIONNAIRE") {
    config.questionnaire = {
      gradingMode: form.elements.gradingMode.value,
      questionCount: Number(form.elements.questionCount.value),
      timeMinutes: Number(form.elements.timeMinutes.value),
    };
    if (!Number.isInteger(config.questionnaire.questionCount) || config.questionnaire.questionCount < 1) throw new Error("Cuestionario: indique el número de preguntas.");
    if (!Number.isInteger(config.questionnaire.timeMinutes) || config.questionnaire.timeMinutes < 1) throw new Error("Cuestionario: indique el tiempo de resolución en minutos.");
  } else if (["RUBRIC", "CHECKLIST", "RATING_SCALE"].includes(type)) {
    config.criteria = readInstrumentCriteriaFromEditor();
    if (!config.criteria.length || config.criteria.some((criterion) => !criterion.label || criterion.levels.some((level) => !level.label))) throw new Error("Instrumento: complete todos los criterios y niveles de valoración.");
    if (type === "CHECKLIST" && config.criteria.some((criterion) => criterion.levels.length !== 2)) throw new Error("Lista de cotejo: cada criterio debe tener exactamente dos opciones.");
    const maximum = instrumentMaximumScore(config);
    if (Math.abs(maximum - 10) > .001) throw new Error(`Instrumento: el puntaje máximo debe sumar exactamente 10 puntos; actualmente suma ${maximum.toFixed(2)}.`);
  }
  return config;
}

$("#teaching-plan-preview-nav")?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-plan-preview-target]");
  if (!button) return;
  const target = document.getElementById(button.dataset.planPreviewTarget);
  target?.scrollIntoView({ behavior: "smooth", block: "start" });
});
$("#teaching-plan-preview")?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-edit-plan-week]");
  if (!button) return;
  openTeachingPlanWeekEditor(Number(button.dataset.sequenceIndex), Number(button.dataset.editPlanWeek));
});
$("#teaching-plan-week-close")?.addEventListener("click", closeTeachingPlanWeekEditor);
$("#teaching-plan-week-cancel")?.addEventListener("click", closeTeachingPlanWeekEditor);
$("#teaching-plan-week-modal")?.addEventListener("click", (event) => { if (event.target.id === "teaching-plan-week-modal") closeTeachingPlanWeekEditor(); });
$("#teaching-plan-add-activity")?.addEventListener("click", () => {
  if (!teachingPlanWeekEditorState) return;
  syncTeachingPlanWeekActivitiesFromDom();
  teachingPlanWeekEditorState.activityDetails.push({ component: "AA", description: "", resource: "", hours: 0, evaluationCode: null });
  renderTeachingPlanWeekActivitiesEditor();
});
$("#teaching-plan-week-activities")?.addEventListener("click", (event) => {
  const button = event.target.closest(".plan-remove-activity");
  if (!button || !teachingPlanWeekEditorState) return;
  syncTeachingPlanWeekActivitiesFromDom();
  teachingPlanWeekEditorState.activityDetails.splice(Number(button.dataset.index), 1);
  renderTeachingPlanWeekActivitiesEditor();
});
$("#teaching-plan-week-activities")?.addEventListener("input", refreshTeachingPlanActivityHoursSummary);
$("#teaching-plan-week-activities")?.addEventListener("change", refreshTeachingPlanActivityHoursSummary);
$("#teaching-plan-week-form")?.elements?.instrumentType?.addEventListener("change", (event) => {
  if (!teachingPlanWeekEditorState?.evaluatedActivity) return;
  teachingPlanWeekEditorState.instrumentConfig = defaultInstrumentConfig(event.target.value, planInstrumentTypeLabels[event.target.value]);
  renderTeachingPlanInstrumentEditor();
});
$("#teaching-plan-add-criterion")?.addEventListener("click", () => {
  if (!teachingPlanWeekEditorState?.instrumentConfig) return;
  const current = readInstrumentCriteriaFromEditor();
  current.push(blankInstrumentCriterion(teachingPlanWeekEditorState.instrumentConfig.type));
  teachingPlanWeekEditorState.instrumentConfig.criteria = current;
  renderTeachingPlanInstrumentCriteria();
});
$("#teaching-plan-instrument-criteria")?.addEventListener("click", (event) => {
  if (!teachingPlanWeekEditorState?.instrumentConfig) return;
  const removeCriterion = event.target.closest(".instrument-remove-criterion");
  const addLevel = event.target.closest(".instrument-add-level");
  const removeLevel = event.target.closest(".instrument-remove-level");
  const criteria = readInstrumentCriteriaFromEditor();
  if (removeCriterion) criteria.splice(Number(removeCriterion.dataset.index), 1);
  if (addLevel) criteria[Number(addLevel.dataset.criterion)]?.levels.push({ label: "Nuevo nivel", description: "", score: 0 });
  if (removeLevel) criteria[Number(removeLevel.dataset.criterion)]?.levels.splice(Number(removeLevel.dataset.level), 1);
  teachingPlanWeekEditorState.instrumentConfig.criteria = criteria;
  renderTeachingPlanInstrumentCriteria();
});
$("#teaching-plan-instrument-criteria")?.addEventListener("input", refreshInstrumentEditorTotal);
$("#teaching-plan-week-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!teachingPlanWeekEditorState || !teachingPlanState || !projectId) return;
  try {
    const activityDetails = $$(".teaching-plan-activity-row", $("#teaching-plan-week-activities")).map((row) => {
      const evaluationCode = row.dataset.evaluationCode || null;
      const component = evaluationCode
        ? teachingPlanWeekEditorState.activityDetails[Number(row.dataset.activityIndex)]?.component
        : row.querySelector(".plan-activity-component")?.value;
      return { component, description: row.querySelector(".plan-activity-description")?.value.trim() || "", resource: row.querySelector(".plan-activity-resource")?.value.trim() || "", hours: Number(row.querySelector(".plan-activity-hours")?.value || 0), evaluationCode };
    });
    if (!activityDetails.length || activityDetails.some((item) => !item.description)) throw new Error("Actividades de aprendizaje: complete todas las actividades antes de guardar.");
    if (activityDetails.some((item) => !item.resource)) throw new Error("Recursos de aprendizaje: cada actividad debe tener un recurso asociado.");
    if (activityDetails.some((item) => !Number.isInteger(item.hours) || item.hours < 0)) throw new Error("Horas: registre un número entero de horas para cada actividad.");
    const sums = { ACD: 0, APE: 0, AA: 0 }; activityDetails.forEach((item) => sums[item.component] += item.hours);
    if (sums.ACD !== teachingPlanWeekEditorState.acdHours || sums.APE !== teachingPlanWeekEditorState.apeHours || sums.AA !== teachingPlanWeekEditorState.aaHours) throw new Error(`Horas: la distribución debe coincidir con ACD ${teachingPlanWeekEditorState.acdHours}, APE ${teachingPlanWeekEditorState.apeHours} y AA ${teachingPlanWeekEditorState.aaHours} de la semana.`);
    const resources = activityDetails.map((item) => item.resource);
    const evaluatedActivity = teachingPlanWeekEditorState.evaluatedActivity ? {
      code: teachingPlanWeekEditorState.evaluatedActivity.code,
      activity: $("#teaching-plan-week-form").elements.evaluatedActivity.value.trim(),
      workStrategies: $("#teaching-plan-week-form").elements.workStrategies.value.trim(),
      instrumentConfig: instrumentConfigFromWeekEditor(),
    } : null;
    const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/teaching-plan/weeks/${teachingPlanWeekEditorState.week}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        version: teachingPlanState.version,
        learningOutcome: teachingPlanWeekEditorState.learningOutcome,
        week: teachingPlanWeekEditorState.week,
        activityDetails,
        resources,
        evaluatedActivity,
      }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "No fue posible guardar los ajustes de la semana.");
    const editedWeek = teachingPlanWeekEditorState.week;
    teachingPlanState = {
      ...payload.teachingPlan,
      templateProfile: payload.teachingPlan?.templateProfile || teachingPlanState?.templateProfile || null,
      templateSnapshot: payload.teachingPlan?.templateSnapshot || teachingPlanState?.templateSnapshot || null,
      activeTemplate: payload.teachingPlan?.activeTemplate || teachingPlanState?.activeTemplate || null,
      templateOutdated: payload.teachingPlan?.templateOutdated ?? teachingPlanState?.templateOutdated ?? false,
      downloadFormats: payload.downloadFormats || payload.teachingPlan?.downloadFormats || teachingPlanState?.downloadFormats || ["PDF"],
    };
    matrixRows = payload.matrixRows;
    matrixFileName = `Plan docente v${teachingPlanState.version}`;
    guideAdaptationProposalState = null;
    closeTeachingPlanWeekEditor();
    renderTeachingPlan();
    persistProject();
    showMessage(`Semana ${editedWeek} actualizada. La revisión del Plan Docente quedó pendiente nuevamente.`);
  } catch (error) {
    showValidationModal(error.message, "#teaching-plan-week-form");
  }
});

$("#teacher-plan-review-confirm")?.addEventListener("change", () => {
  const checks = teachingPlanReviewChecksState();
  const button = $("#confirm-teaching-plan-review");
  if (button) button.disabled = !$("#teacher-plan-review-confirm").checked || !checks.length || checks.some((check) => !check.ok);
});
$("#confirm-teaching-plan-review")?.addEventListener("click", async () => {
  if (!teachingPlanState || !projectId) return;
  const checks = teachingPlanReviewChecksState();
  const failed = checks.filter((check) => !check.ok);
  if (failed.length) {
    return showValidationModal(`Corrija las validaciones pendientes: ${failed.map((check) => check.label).join("; ")}.`, "#teaching-plan-review-checks");
  }
  if (!$("#teacher-plan-review-confirm")?.checked) {
    return showValidationModal("Confirme que revisó todas las secciones del Plan Docente.", "#teacher-plan-review-confirm");
  }
  const button = $("#confirm-teaching-plan-review");
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "Guardando revisión…";
  try {
    const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/teaching-plan/review`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        version: teachingPlanState.version,
        notes: $("#teacher-plan-review-notes")?.value.trim() || "",
      }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "No fue posible confirmar la revisión del Plan Docente.");
    teachingPlanState = {
      ...payload.teachingPlan,
      templateProfile: payload.teachingPlan?.templateProfile || teachingPlanState?.templateProfile || null,
      templateSnapshot: payload.teachingPlan?.templateSnapshot || teachingPlanState?.templateSnapshot || null,
      activeTemplate: payload.teachingPlan?.activeTemplate || teachingPlanState?.activeTemplate || null,
      templateOutdated: payload.teachingPlan?.templateOutdated ?? teachingPlanState?.templateOutdated ?? false,
      downloadFormats: payload.teachingPlan?.downloadFormats || teachingPlanState?.downloadFormats || ["PDF"],
    };
    renderTeachingPlan();
    persistProject();
    showMessage("Revisión del Plan Docente confirmada. Ya puede descargar el Word y continuar con la Guía Didáctica.");
  } catch (error) {
    showValidationModal(error.message, "#teaching-plan-review-checks");
    button.disabled = false;
    button.textContent = originalText;
  }
});

$("#generate-teaching-plan").onclick = async () => {
  const button = $("#generate-teaching-plan");
  button.disabled = true;
  button.classList.add("is-loading");
  button.innerHTML = '<span class="inline-spinner" aria-hidden="true"></span><span>Generando el plan docente…</span>';
  showMessage();
  try {
    const setupResult = await saveProjectSetup();
    if (workflowModeState === "ADAPTATION_16_TO_8" && setupResult.planPreserved === false) {
      throw new Error("La ficha base del Plan Docente cambió después de aprobar la adaptación. La propuesta anterior quedó invalidada; analice y apruebe una nueva propuesta antes de generar el Plan Docente modular.");
    }
    const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/teaching-plan/generate`, { method: "POST" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "No fue posible generar el plan docente.");
    teachingPlanState = {
      ...payload.teachingPlan,
      templateProfile: payload.teachingPlan?.templateProfile || teachingPlanState?.templateProfile || null,
      templateSnapshot: payload.teachingPlan?.templateSnapshot || teachingPlanState?.templateSnapshot || null,
      activeTemplate: payload.teachingPlan?.activeTemplate || teachingPlanState?.activeTemplate || null,
      templateOutdated: payload.teachingPlan?.templateOutdated ?? teachingPlanState?.templateOutdated ?? false,
      downloadFormats: payload.downloadFormats || payload.teachingPlan?.downloadFormats || teachingPlanState?.downloadFormats || ["PDF"],
    };
    matrixRows = payload.matrixRows;
    matrixFileName = `Plan docente v${teachingPlanState.version}`;
    guideAdaptationProposalState = null;
    renderTeachingPlan();
    persistProject();
  } catch (error) {
    const focusTarget = /Conocimiento e IA|formato de plan docente|prompt de plan docente|documento institucional/i.test(error.message)
      ? "#projects-list"
      : /propuesta.*adaptación|adaptación.*propuesta|ficha base.*cambió/i.test(error.message)
        ? "#plan-adaptation-workspace"
        : /Importancia para el estudiante/i.test(error.message)
          ? "#guide-reference-importance-edit"
          : /La IA propuso|semana .*conten|secuencia única|distribución de horas|actividades calificadas/i.test(error.message)
            ? "#generate-teaching-plan"
            : 'textarea[name="guideReference"]';
    showValidationModal(error.message, focusTarget);
  } finally {
    button.classList.remove("is-loading");
    renderAdaptationWorkspaces();
    if (workflowModeState !== "ADAPTATION_16_TO_8") {
      button.disabled = false;
      button.classList.remove("is-loading");
      button.innerHTML = `<span class="button-label">${teachingPlanState ? "Regenerar plan docente con IA" : "Generar plan docente con IA"}</span>`;
    }
  }
};

$("#save-plan-methodologies").onclick = async () => {
  if (!teachingPlanState) return;
  const methodologies = teachingPlanState.content.sequences.map((sequence, index) => ({
    learningOutcome: sequence.learningOutcome,
    methodology: $(`[data-plan-methodology="${index}"]`).value.trim(),
    tac: linesFrom($(`[data-plan-tac="${index}"]`).value),
  }));
  try {
    const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/teaching-plan`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ methodologies }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "No fue posible guardar las metodologías.");
    teachingPlanState = {
      ...payload.teachingPlan,
      templateProfile: payload.teachingPlan?.templateProfile || teachingPlanState?.templateProfile || null,
      templateSnapshot: payload.teachingPlan?.templateSnapshot || teachingPlanState?.templateSnapshot || null,
      activeTemplate: payload.teachingPlan?.activeTemplate || teachingPlanState?.activeTemplate || null,
      templateOutdated: payload.teachingPlan?.templateOutdated ?? teachingPlanState?.templateOutdated ?? false,
      downloadFormats: payload.teachingPlan?.downloadFormats || teachingPlanState?.downloadFormats || ["PDF"],
    };
    matrixRows = payload.matrixRows;
    matrixFileName = `Plan docente v${teachingPlanState.version}`;
    guideAdaptationProposalState = null;
    renderTeachingPlan();
    persistProject();
    showMessage("Metodologías y TAC guardadas.");
  } catch (error) {
    showMessage(error.message);
  }
};

$("#generate-microcurricular-presentation")?.addEventListener("click", () => {
  generateMicrocurricularPresentation().catch(() => {});
});
$("#microcurricular-presentation")?.addEventListener("input", scheduleProgressSync);
$("#institutional-plan-text-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const field = $("#institutional-curricular-adaptations");
  const curricularAdaptations = String(field?.value || "").trim();
  const downloadFormats = $$('input[name="downloadFormat"]', event.currentTarget).filter((input) => input.checked).map((input) => input.value);
  if (!downloadFormats.length) return showValidationModal("Formatos de descarga: habilite al menos un formato para el Plan Docente.", "#institutional-plan-text-form");
  if (!downloadFormats.includes("PDF")) return showValidationModal("PDF es el formato predeterminado y debe permanecer habilitado.", "#institutional-plan-text-form");
  if (curricularAdaptations.length < 80) return showValidationModal("Adaptaciones curriculares: ingrese el texto institucional completo antes de guardar.", "#institutional-curricular-adaptations");
  try {
    await authRequest("/api/admin/settings/teaching-plan", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ curricularAdaptations, downloadFormats }),
    });
    await loadAdminDashboard();
    showAdminMessage("Texto institucional del Plan Docente actualizado correctamente.");
  } catch (error) { showValidationModal(error.message, "#institutional-curricular-adaptations"); }
});
$("#guide-download-format-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const downloadFormats = $$('input[name="guideDownloadFormat"]', event.currentTarget).filter((input) => input.checked).map((input) => input.value);
  if (!downloadFormats.length) return showValidationModal("Formatos de descarga: habilite al menos un formato para la Guía Didáctica.", "#guide-download-format-form");
  if (!downloadFormats.includes("PDF")) return showValidationModal("PDF es el formato predeterminado de la Guía Didáctica y debe permanecer habilitado.", "#guide-download-format-form");
  try {
    const payload = await authRequest("/api/admin/settings/guide-downloads", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ downloadFormats }),
    });
    if (authenticatedUserData) authenticatedUserData.guideDownloadFormats = payload.downloadFormats || downloadFormats;
    await loadAdminDashboard();
    updateGuideDownloadButtons();
    updateWeekReviewDownloadButtons();
    showAdminMessage("Formatos de descarga de la Guía Didáctica actualizados correctamente.");
  } catch (error) { showValidationModal(error.message, "#guide-download-format-form"); }
});

$("#add-outcome-mapping")?.addEventListener("click", addOutcomeMapping);
$("#outcome-mapping-body")?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-delete-mapping]");
  if (!button) return;
  deleteOutcomeMapping(Number.parseInt(button.dataset.deleteMapping, 10));
});
$("#outcome-mapping-body")?.addEventListener("change", validateContributionDuplicateLive);

function configuredPlanDownloadFormats() {
  const raw = authenticatedUserData?.teachingPlanDownloadFormats || teachingPlanState?.downloadFormats || ["PDF"];
  return Array.isArray(raw) && raw.length ? raw : ["PDF"];
}
function updatePlanDownloadButtons() {
  const formats = configuredPlanDownloadFormats();
  const reviewed = Boolean(teachingPlanState?.reviewedAt) && !teachingPlanState?.templateOutdated;
  [["#download-teaching-plan-pdf", "PDF"], ["#download-teaching-plan", "WORD"], ["#download-teaching-plan-json", "JSON"]].forEach(([selector, format]) => {
    const button = $(selector); if (!button) return; const enabled = formats.includes(format); button.classList.toggle("hidden", !enabled); button.disabled = !reviewed;
  });
}
async function ensureGuideGenerationReady() {
  if (!projectId) throw new Error("No se encontró la asignatura activa.");
  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/guide/readiness`, { cache: "no-store" });
  let payload = {};
  try { payload = await response.json(); } catch {}
  if (!response.ok) throw new Error(payload.error || "La configuración institucional de la Guía Didáctica todavía no está lista.");
  if (authenticatedUserData && Array.isArray(payload.downloadFormats) && payload.downloadFormats.length) {
    authenticatedUserData.guideDownloadFormats = payload.downloadFormats;
    updateGuideDownloadButtons();
    updateWeekReviewDownloadButtons();
  }
  return payload;
}

async function downloadPlanFormat(format) {
  if (teachingPlanState?.templateOutdated) return showValidationModal("El Plan Docente fue generado con un formato anterior. Regénere el plan para aplicar el formato institucional vigente antes de descargarlo.", "#generate-teaching-plan");
  if (!teachingPlanState?.reviewedAt) return showValidationModal("Revise y confirme la vista previa del Plan Docente antes de descargarlo.", "#teaching-plan-review-panel");
  if (!projectId) return;
  const route = format === "PDF" ? "pdf" : format === "JSON" ? "json" : "word";
  const button = format === "PDF" ? $("#download-teaching-plan-pdf") : format === "JSON" ? $("#download-teaching-plan-json") : $("#download-teaching-plan");
  const originalText = button?.textContent || "";
  if (button) { button.disabled = true; button.textContent = "Preparando…"; }
  try {
    const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/teaching-plan/${route}`, { cache: "no-store" });
    if (!response.ok) {
      let message = `No fue posible descargar el Plan Docente en ${format}.`;
      try { const payload = await response.json(); message = payload.error || message; } catch {}
      throw new Error(message);
    }
    const blob = await response.blob();
    const disposition = response.headers.get("Content-Disposition") || "";
    const filename = disposition.match(/filename="([^"]+)"/)?.[1] || `plan-docente.${route === "word" ? "docx" : route}`;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = filename; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  } catch (error) {
    showValidationModal(error.message || `No fue posible descargar el Plan Docente en ${format}.`, "#plan-download-actions");
  } finally {
    if (button) { button.textContent = originalText; updatePlanDownloadButtons(); }
  }
}
$("#download-teaching-plan-pdf")?.addEventListener("click", () => downloadPlanFormat("PDF"));
$("#download-teaching-plan")?.addEventListener("click", () => downloadPlanFormat("WORD"));
$("#download-teaching-plan-json")?.addEventListener("click", () => downloadPlanFormat("JSON"));

next.onclick = async () => {
  if (step === 1) {
    if (invalidFields(["projectName", "level", "modality", "faculty", "career", "professorName", "subjectCode", "subjectName", "subjectType", "academicPeriod", "weeks"]).length) {
      return showMessage("Complete todos los campos obligatorios para continuar.");
    }
    if (!institutionalDataState) return showMessage("No se encontraron los datos curriculares de la oferta académica.");
    if (!$("#institutional-data-reviewed").checked) return showMessage("Confirme que revisó los datos institucionales.");
    if (!Number.isInteger(totalWeeks()) || totalWeeks() < 1) return showMessage("Ingrese un número entero de semanas mayor que cero.");
    step = 2;
    await syncDraftProgress().catch((error) => console.error("No fue posible guardar el paso de revisión:", error));
  } else if (step === 2) {
    try {
      validateMicrocurricularPresentation();
      collectOutcomeMappings();
      collectTeacherProfile();
      step = 3;
      await syncDraftProgress();
    } catch (error) {
      showContributionValidationModal(error.message);
      return;
    }
  } else if (step === 3) {
    next.disabled = true;
    try {
      await saveProjectSetup();
      summarize();
      step = 4;
    } catch (error) {
      return showValidationModal(error.message, /Importancia para el estudiante/i.test(error.message) ? "#guide-reference-importance-edit" : 'textarea[name="guideReference"]');
    } finally {
      next.disabled = false;
    }
  } else if (step === 4) {
    if (!teachingPlanState || !matrixRows.length) return showValidationModal("Genere el Plan Docente antes de continuar con la Guía Didáctica.", "#generate-teaching-plan");
    if (teachingPlanState.templateOutdated) return showValidationModal("El formato institucional del Plan Docente cambió. Regénere el plan con el formato vigente antes de continuar con la Guía Didáctica.", "#generate-teaching-plan");
    if (!teachingPlanState.reviewedAt) return showValidationModal("Revise y confirme la vista previa del Plan Docente antes de continuar con la Guía Didáctica.", "#teaching-plan-review-checks");
    next.disabled = true;
    try {
      await ensureGuideGenerationReady();
    } catch (error) {
      return showValidationModal(error.message || "La configuración institucional de la Guía Didáctica todavía no está lista.", "#teaching-plan-result");
    } finally {
      next.disabled = false;
    }
    step = 5;
    persistProject();
    updateWeekInterface();
  }
  renderStep();
};

const fileInput = $("#matrix-file");
const drop = $("#dropzone");
if (fileInput) fileInput.onchange = () => validateFile(fileInput.files[0]);
if (drop) ["dragenter", "dragover"].forEach((eventName) => drop.addEventListener(eventName, (event) => {
  event.preventDefault();
  drop.classList.add("drag");
}));
if (drop) ["dragleave", "drop"].forEach((eventName) => drop.addEventListener(eventName, (event) => {
  event.preventDefault();
  drop.classList.remove("drag");
}));
if (drop) drop.addEventListener("drop", (event) => {
  fileInput.files = event.dataTransfer.files;
  validateFile(event.dataTransfer.files[0]);
});
async function validateFile(file) {
  const result = $("#matrix-result");
  matrixRows = [];
  if (!file) return;
  if (!/\.(xlsx|csv)$/i.test(file.name) || file.size > 10 * 1024 * 1024) {
    result.className = "validation error";
    result.textContent = "El archivo debe ser .xlsx o .csv y no superar 10 MB.";
    result.classList.remove("hidden");
    return;
  }
  matrixFile = file;
  matrixFileName = file.name;
  $("#file-name").textContent = file.name;
  result.className = "validation";
  result.textContent = "Validando contenido…";
  result.classList.remove("hidden");
  try {
    const content = await toBase64(file);
    const response = await fetch("/api/validate-matrix", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: file.name, content }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "No fue posible validar la matriz.");
    matrixRows = payload.rows;
    const matrixError = validateMatrixWeeks(matrixRows, totalWeeks());
    if (matrixError) throw new Error(matrixError);
    $$("#column-list span").forEach((item) => item.classList.add("ok"));
    result.textContent = `Matriz válida: ${payload.rowCount} filas y ${payload.weekCount} semanas identificadas.`;
  } catch (error) {
    matrixRows = [];
    result.className = "validation error";
    result.textContent = error.message;
  }
}
function validateMatrixWeeks(rows, expected) {
  const parsed = rows.map((row) => Number(String(row.Semana).trim()));
  if (parsed.some((week) => !Number.isInteger(week) || week < 1)) {
    return "Todas las filas deben contener un número de semana entero y mayor que cero.";
  }
  const weeks = [...new Set(parsed)].sort((a, b) => a - b);
  if (weeks.length !== expected) {
    return `Se indicó que la guía tendrá ${expected} semanas, pero la matriz contiene ${weeks.length} semanas únicas.`;
  }
  const missing = Array.from({ length: expected }, (_, index) => index + 1).filter((week) => !weeks.includes(week));
  if (missing.length) return `La matriz no tiene una secuencia completa. Faltan las semanas: ${missing.join(", ")}.`;
  if (weeks.at(-1) > expected) return `La matriz contiene la semana ${weeks.at(-1)}, superior al total indicado (${expected}).`;
  return "";
}
function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function adjustmentAttachments() {
  const files = selectedAdjustmentFiles;
  if (files.length > 3) throw new Error("Puede adjuntar como máximo 3 archivos.");
  return Promise.all(files.map(async (file) => {
    if (!/\.(pdf|docx|txt)$/i.test(file.name)) throw new Error(`Formato no admitido: ${file.name}`);
    if (file.size > 10 * 1024 * 1024) throw new Error(`${file.name} supera los 10 MB.`);
    const mimeType = file.name.toLowerCase().endsWith(".pdf")
      ? "application/pdf"
      : file.name.toLowerCase().endsWith(".docx")
        ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        : "text/plain";
    return { fileName: file.name, mimeType, content: await toBase64(file) };
  }));
}

async function generationPayload(adjustmentInstructions = "") {
  const project = data();
  return {
    projectId: projectId || undefined,
    week: currentWeek,
    project: {
      projectName: project.projectName, level: project.level,
      modality: project.modality, faculty: project.faculty,
      career: project.career, professorName: project.professorName,
      subjectCode: project.subjectCode, subjectName: project.subjectName,
      subjectType: project.subjectType,
      subjectTypeLabel: project.subjectTypeName || project.subjectType,
      academicPeriod: project.academicPeriod, weeks: Number(project.weeks),
      professionalProfileCompetencies: project.professionalProfileCompetencies,
      graduateProfileResults: project.graduateProfileResults,
      utplGenericCompetencies: project.utplGenericCompetencies,
    },
    matrixRows,
    bibliography: {
      guideReference: project.guideReference || "",
      guideReferenceImportance: guideReferenceImportanceState,
      basic: bibliographyLegacyText("BASIC"),
      complementary: bibliographyLegacyText("COMPLEMENTARY"),
      rea: bibliographyLegacyText("REA"),
    },
    adjustmentInstructions,
    currentContent: adjustmentInstructions ? editorToMarkdown($("#generation-output")) : "",
    attachments: adjustmentInstructions ? await adjustmentAttachments() : [],
  };
}
function updateWeekInterface() {
  const state = weekState(currentWeek);
  const displayContent = state.draftContent || state.approvedContent;
  $("#week-title").textContent = `Preparación de la semana ${currentWeek}`;
  $("#steps span:last-child").innerHTML = `<b>5</b>Semana ${currentWeek}`;
  $("#generate-week").textContent = `Generar semana ${currentWeek} con IA`;
  $("#generation-output").innerHTML = markdownToHtml(displayContent);
  $("#adjustment-instructions").value = "";
  $("#weekly-review").classList.toggle("hidden", !displayContent);
  $("#generation-error").classList.add("hidden");
  const status = $("#review-status");
  const approved = state.status === "approved";
  status.textContent = approved ? `Semana ${currentWeek} confirmada (versión ${state.version})`
    : state.status === "review" ? `Semana ${currentWeek} requiere nueva revisión`
      : displayContent ? `Semana ${currentWeek} pendiente de confirmación` : "Semana pendiente de generación";
  status.classList.toggle("approved", approved);
  $("#generation-output").contentEditable = String(!approved);
  $("#modify-week").classList.toggle("hidden", !approved);
  $("#regenerate-with-instructions").classList.toggle("hidden", approved);
  $("#approve-week").classList.toggle("hidden", approved);
  $("#generate-week").classList.toggle("hidden", Boolean(displayContent));
  updateWeekReviewDownloadButtons(Boolean(displayContent));
  renderWeekTabs();
  updateGuideDownloadButtons();
  renderAdaptationWorkspaces();
}
function renderWeekTabs() {
  const highestStarted = Math.max(1, ...Object.keys(weekStates).map(Number));
  $("#week-tabs").innerHTML = Array.from({ length: totalWeeks() }, (_, index) => {
    const week = index + 1;
    const state = weekState(week);
    const unlocked = week <= highestStarted + 1;
    return `<button type="button" class="week-tab ${state.status} ${week === currentWeek ? "current" : ""}" data-week="${week}" ${unlocked ? "" : "disabled"} title="${escapeHtml(state.status)}">${week}</button>`;
  }).join("");
  $$(".week-tab").forEach((button) => button.onclick = () => {
    currentWeek = Number(button.dataset.week);
    updateWeekInterface();
    persistProject();
  });
}
function consecutiveApprovedWeeks() {
  let count = 0;
  while (count < totalWeeks() && weekState(count + 1).status === "approved") count += 1;
  return count;
}

function visualDecision(proposal, figureNumber) {
  const modal = $("#visual-modal");
  const error = $("#visual-error");
  const progress = $("#visual-progress");
  const modification = $("#visual-modification");
  const generateButton = $("#visual-generate");
  const modifyButton = $("#visual-modify");
  const skipButton = $("#visual-skip");
  const editableProposal = JSON.parse(JSON.stringify(proposal));
  editableProposal.kind = editableProposal.kind || "image";
  const resourceLabels = {
    image: {
      eyebrow: "Oportunidad visual identificada",
      legend: "Seleccione un estilo visual",
      progress: "Generando la imagen… El contenido continuará cuando esté lista.",
      alt: "Texto alternativo",
    },
    video_script: {
      eyebrow: "Oportunidad para un guion de video",
      legend: "Seleccione un enfoque de guion",
      progress: "Generando el guion de video… El contenido continuará cuando esté listo.",
      alt: "Descripción accesible del recurso",
    },
    genially: {
      eyebrow: "Oportunidad para un recurso Genially",
      legend: "Seleccione una estructura interactiva",
      progress: "Generando la propuesta para Genially… El contenido continuará cuando esté lista.",
      alt: "Descripción accesible del recurso",
    },
    storytelling: {
      eyebrow: "Oportunidad para storytelling",
      legend: "Seleccione un enfoque narrativo",
      progress: "Generando el storytelling… El contenido continuará cuando esté listo.",
      alt: "Descripción accesible del recurso",
    },
    podcast_script: {
      eyebrow: "Oportunidad para un guion de podcast",
      legend: "Seleccione un enfoque de guion",
      progress: "Generando el guion de podcast… El contenido continuará cuando esté listo.",
      alt: "Descripción accesible del recurso",
    },
  };
  const labels = resourceLabels[editableProposal.kind] || resourceLabels.image;
  const setText = (selector, value) => {
    const element = $(selector);
    if (element) element.textContent = value;
  };
  setText("#visual-eyebrow", labels.eyebrow);
  setText("#visual-options-legend", labels.legend);
  setText("#visual-progress-text", labels.progress);
  const altLabel = $("#visual-alt-label");
  if (altLabel?.firstChild?.nodeType === Node.TEXT_NODE) altLabel.firstChild.textContent = labels.alt;
  setText("#visual-modal-title", editableProposal.title);
  setText("#visual-topic", editableProposal.topic);
  setText("#visual-type", [editableProposal.type, editableProposal.bloomLevel ? `Bloom: ${editableProposal.bloomLevel}` : "", editableProposal.complexity ? `Complejidad: ${editableProposal.complexity}` : ""].filter(Boolean).join(" · "));
  setText("#visual-purpose", editableProposal.purpose);
  $("#visual-title-input").value = editableProposal.title;
  $("#visual-alt-input").value = editableProposal.altText;
  $("#visual-prompt-input").value = editableProposal.prompt;
  $("#visual-styles").innerHTML = `<legend>${escapeHtml(labels.legend)}</legend>${editableProposal.styles.map((style, index) => `
    <label class="visual-style-option">
      <input type="radio" name="visual-style" value="${escapeHtml(style.id)}" ${index === 0 ? "checked" : ""}>
      <span><strong>${escapeHtml(style.name)}</strong><small>${escapeHtml(style.description)}</small></span>
    </label>`).join("")}`;
  modification.classList.add("hidden");
  progress.classList.add("hidden");
  error.classList.add("hidden");
  modal.classList.remove("hidden");

  return new Promise((resolve) => {
    skipButton.onclick = () => {
      modal.classList.add("hidden");
      resolve({ action: "skip" });
    };
    modifyButton.onclick = () => {
      modification.classList.toggle("hidden");
      modifyButton.textContent = modification.classList.contains("hidden")
        ? "Modificar propuesta"
        : "Ocultar ajustes";
    };
    generateButton.onclick = async () => {
      const styleId = $('input[name="visual-style"]:checked', modal)?.value;
      if (!styleId) {
        error.textContent = "Seleccione una de las opciones.";
        error.classList.remove("hidden");
        return;
      }
      editableProposal.title = $("#visual-title-input").value.trim();
      editableProposal.altText = $("#visual-alt-input").value.trim();
      editableProposal.prompt = $("#visual-prompt-input").value.trim();
      if (!editableProposal.title || !editableProposal.altText || !editableProposal.prompt) {
        error.textContent = "Complete el título, el texto alternativo y los ajustes de la imagen.";
        error.classList.remove("hidden");
        return;
      }
      generateButton.disabled = true;
      modifyButton.disabled = true;
      skipButton.disabled = true;
      progress.classList.remove("hidden");
      error.classList.add("hidden");
      try {
        const endpoint = editableProposal.kind === "image"
          ? "/api/generate-visual"
          : "/api/generate-assisted-resource";
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: projectId || undefined,
            week: currentWeek,
            figureNumber,
            proposal: editableProposal,
            styleId,
          }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "No fue posible generar el recurso.");
        modal.classList.add("hidden");
        resolve({ action: "generated", image: payload });
      } catch (requestError) {
        error.textContent = requestError.message;
        error.classList.remove("hidden");
      } finally {
        generateButton.disabled = false;
        modifyButton.disabled = false;
        skipButton.disabled = false;
        progress.classList.add("hidden");
      }
    };
  });
}

async function presentGeneratedContent(content, proposals) {
  const output = $("#generation-output");
  const valid = (Array.isArray(proposals) ? proposals : [])
    .map((proposal) => ({ proposal, index: content.indexOf(proposal.insertionAfter) }))
    .filter((item) => item.index >= 0)
    .sort((a, b) => a.index - b.index)
    .slice(0, 3);
  let cursor = 0;
  let assembled = "";
  let figures = 0;
  for (const item of valid) {
    const insertionEnd = item.index + item.proposal.insertionAfter.length;
    if (insertionEnd < cursor) continue;
    assembled += content.slice(cursor, insertionEnd);
    output.innerHTML = markdownToHtml(assembled);
    $("#weekly-review").classList.remove("hidden");
    output.scrollIntoView({ behavior: "smooth", block: "end" });
    const decision = await visualDecision(item.proposal, figures + 1);
    if (decision.action === "generated") {
      const resource = decision.image;
      if ((item.proposal.kind || "image") === "image") {
        figures += 1;
        const alt = `Figura ${resource.figureNumber}. ${resource.title}. ${resource.altText}`;
        assembled += `\n\n![${alt}](${resource.url})\n\n*Fuente: ${resource.source}*\n`;
      } else {
        assembled += `\n\n${resource.content}\n`;
      }
      output.innerHTML = markdownToHtml(assembled);
    }
    cursor = insertionEnd;
  }
  assembled += content.slice(cursor);
  output.innerHTML = markdownToHtml(assembled);
  return assembled;
}

async function generateWeek(adjustmentInstructions = "") {
  const output = $("#generation-output");
  const generateButton = $("#generate-week");
  const regenerateButton = $("#regenerate-with-instructions");
  const errorBox = $("#generation-error");
  const progress = $("#regeneration-progress");
  const progressText = $("#regeneration-progress-text");
  const isRegeneration = Boolean(adjustmentInstructions);
  generateButton.disabled = true;
  regenerateButton.disabled = true;
  $("#approve-week").disabled = true;
  if (isRegeneration) {
    regenerateButton.textContent = "Regenerando…";
    regenerateButton.setAttribute("aria-busy", "true");
    if (progressText) {
      progressText.textContent = selectedAdjustmentFiles.length
        ? "Analizando las instrucciones y los archivos adjuntos…"
        : "Aplicando las instrucciones y regenerando el contenido…";
    }
    progress?.classList.remove("hidden");
  } else {
    generateButton.textContent = `Generando semana ${currentWeek}…`;
  }
  errorBox.classList.add("hidden");
  try {
    const response = await fetch("/api/generate-week", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(await generationPayload(adjustmentInstructions)),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "No fue posible generar la semana.");
    const completedContent = await presentGeneratedContent(
      payload.content,
      payload.assistedResourceProposals || payload.visualProposals,
    );
    weekStates[currentWeek] = { ...weekState(currentWeek), status: "draft", draftContent: completedContent };
    $("#weekly-review").classList.remove("hidden");
    $("#review-status").textContent = `Semana ${currentWeek} pendiente de confirmación`;
    $("#review-status").classList.remove("approved");
    $("#adjustment-instructions").value = "";
    $("#adjustment-files").value = "";
    selectedAdjustmentFiles = [];
    $("#attachment-list").classList.add("hidden");
    persistProject();
    renderWeekTabs();
  } catch (error) {
    errorBox.textContent = `No se pudo completar la generación: ${error.message}`;
    errorBox.classList.remove("hidden");
  } finally {
    generateButton.disabled = false;
    regenerateButton.disabled = false;
    $("#approve-week").disabled = false;
    regenerateButton.textContent = "Regenerar con instrucciones";
    regenerateButton.removeAttribute("aria-busy");
    progress?.classList.add("hidden");
    generateButton.textContent = `Regenerar semana ${currentWeek}`;
  }
}
$("#generate-week").onclick = () => generateWeek();
$("#regenerate-with-instructions").onclick = () => {
  const instructions = $("#adjustment-instructions").value.trim();
  if (!instructions) {
    $("#generation-error").textContent = "Escriba las instrucciones que debe aplicar la nueva versión.";
    $("#generation-error").classList.remove("hidden");
    return;
  }
  generateWeek(instructions);
};
$("#adjustment-files").addEventListener("change", (event) => {
  const incoming = [...event.target.files];
  for (const file of incoming) {
    if (selectedAdjustmentFiles.length >= 3) break;
    if (!selectedAdjustmentFiles.some((item) => item.name === file.name && item.size === file.size)) {
      selectedAdjustmentFiles.push(file);
    }
  }
  event.target.value = "";
  renderAdjustmentFiles();
});
function renderAdjustmentFiles() {
  const list = $("#attachment-list");
  list.innerHTML = selectedAdjustmentFiles.map((file, index) => `
    <div class="attachment-item">
      <span class="attachment-name">${escapeHtml(file.name)}</span>
      <button type="button" class="remove-attachment" data-index="${index}" aria-label="Eliminar ${escapeHtml(file.name)}">× Eliminar</button>
    </div>`).join("");
  list.classList.toggle("hidden", selectedAdjustmentFiles.length === 0);
  $$(".remove-attachment", list).forEach((button) => {
    button.onclick = () => {
      selectedAdjustmentFiles.splice(Number(button.dataset.index), 1);
      renderAdjustmentFiles();
    };
  });
}
$("#block-format").addEventListener("change", (event) => {
  $("#generation-output").focus();
  document.execCommand("formatBlock", false, event.target.value);
});
$$(".format-button").forEach((button) => {
  button.addEventListener("mousedown", (event) => event.preventDefault());
  button.addEventListener("click", () => {
    $("#generation-output").focus();
    document.execCommand(button.dataset.command, false);
  });
});
$("#approve-week").onclick = async () => {
  const approveButton = $("#approve-week");
  const content = editorToMarkdown($("#generation-output"));
  if (!content) {
    $("#generation-error").textContent = "No se puede confirmar una semana sin contenido.";
    $("#generation-error").classList.remove("hidden");
    return;
  }
  approveButton.disabled = true;
  $("#generation-error").classList.add("hidden");
  const previous = weekState(currentWeek);
  weekStates[currentWeek] = {
    ...previous, status: "approved", draftContent: content,
    approvedContent: content, approvedAt: new Date().toISOString(), version: (previous.version || 0) + 1,
  };
  Object.keys(weekStates).map(Number).filter((week) => week > currentWeek).forEach((week) => {
    const later = weekState(week);
    if (later.status === "approved") weekStates[week] = { ...later, status: "review", draftContent: later.approvedContent };
  });
  persistProject();
  if (currentWeek >= totalWeeks()) {
    updateWeekInterface();
    $("#review-status").textContent = "Guía completada y guardada: todas las semanas fueron confirmadas";
    try {
      clearTimeout(syncTimer);
      await syncDatabase();
      showMessage("Guía Didáctica completada. Los formatos habilitados por Administración están disponibles al final de esta pantalla.");
      updateGuideDownloadButtons();
    } catch (error) {
      console.error(error);
      $("#generation-error").textContent =
        "La última semana se aprobó y quedó respaldada en este navegador, pero no fue posible confirmar el guardado en PostgreSQL. Intente nuevamente cuando el servicio esté disponible.";
      $("#generation-error").classList.remove("hidden");
    }
    return;
  }
  currentWeek += 1;
  persistProject();
  updateWeekInterface();
};

$("#modify-week").onclick = () => {
  const state = weekState(currentWeek);
  weekStates[currentWeek] = { ...state, status: "review", draftContent: state.approvedContent };
  Object.keys(weekStates).map(Number).filter((week) => week > currentWeek).forEach((week) => {
    const later = weekState(week);
    if (later.status === "approved") weekStates[week] = { ...later, status: "review", draftContent: later.approvedContent };
  });
  persistProject();
  updateWeekInterface();
  $("#generation-output").focus();
};

function configuredGuideDownloadFormats() {
  const raw = authenticatedUserData?.guideDownloadFormats || ["PDF"];
  return Array.isArray(raw) && raw.length ? raw : ["PDF"];
}
function updateWeekReviewDownloadButtons(hasContent = Boolean(weekState(currentWeek).draftContent || weekState(currentWeek).approvedContent)) {
  const formats = configuredGuideDownloadFormats();
  [["#download-week-pdf", "PDF"], ["#download-week-word", "WORD"], ["#download-week-json", "JSON"]].forEach(([selector, format]) => {
    const button = $(selector);
    if (!button) return;
    const enabled = formats.includes(format);
    button.classList.toggle("hidden", !enabled);
    button.disabled = !enabled || !hasContent;
    const label = button.querySelector(".week-review-download-label");
    if (label) label.textContent = `· Semana ${currentWeek}`;
  });
}
function guideDownloadPayload() {
  const project = data();
  return {
    projectId,
    project: {
      projectName: project.projectName, subjectName: project.subjectName,
      career: project.career, modality: project.modality,
      academicPeriod: project.academicPeriod, totalWeeks: totalWeeks(),
    },
    weeks: Array.from({ length: totalWeeks() }, (_, index) => ({
      week: index + 1, content: weekState(index + 1).approvedContent,
    })),
  };
}
function updateGuideDownloadButtons() {
  const formats = configuredGuideDownloadFormats();
  const complete = totalWeeks() > 0 && consecutiveApprovedWeeks() === totalWeeks();
  const status = $("#guide-download-status");
  if (status) status.textContent = complete
    ? "Guía completa. Descargue únicamente los formatos habilitados por Administración."
    : `Confirme todas las semanas para habilitar las descargas finales (${consecutiveApprovedWeeks()} de ${totalWeeks() || 0}).`;
  [["#download-guide-pdf", "PDF"], ["#download-guide-word", "WORD"], ["#download-guide-json", "JSON"]].forEach(([selector, format]) => {
    const button = $(selector);
    if (!button) return;
    const enabled = formats.includes(format);
    button.classList.toggle("hidden", !enabled);
    button.disabled = !enabled || !complete;
  });
}
async function saveDownloadResponse(response, fallbackName) {
  if (!response.ok) {
    let payload = {};
    try { payload = await response.json(); } catch {}
    throw new Error(payload.error || "No fue posible descargar la Guía Didáctica.");
  }
  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") || "";
  const serverName = disposition.match(/filename="([^"]+)"/)?.[1];
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = serverName || fallbackName;
  link.click();
  URL.revokeObjectURL(link.href);
}

function weekReviewDownloadPayload() {
  const state = weekState(currentWeek);
  const content = editorToMarkdown($("#generation-output")).trim() || state.draftContent || state.approvedContent || "";
  const project = data();
  return {
    content,
    payload: {
      projectId,
      project: {
        projectName: project.projectName,
        subjectName: project.subjectName,
        subjectCode: project.subjectCode,
        career: project.career,
        modality: project.modality,
        academicPeriod: project.academicPeriod,
        professorName: project.professorName,
      },
      week: currentWeek,
      content,
      status: state.status === "approved" ? "CONFIRMED" : state.status === "review" ? "REVIEW" : "DRAFT",
    },
    project,
  };
}

async function downloadWeekReviewFormat(format) {
  const enabledFormats = configuredGuideDownloadFormats();
  if (!enabledFormats.includes(format)) {
    throw new Error(`La descarga ${format} de la Guía Didáctica no está habilitada por Administración.`);
  }
  const { content, payload, project } = weekReviewDownloadPayload();
  if (!content.trim()) throw new Error("Genere contenido para esta semana antes de descargarla para revisión.");
  if (!projectId) throw new Error("Guarde la asignatura antes de descargar la semana para revisión.");
  const route = format === "PDF" ? "pdf" : format === "JSON" ? "json" : "word";
  const button = format === "PDF" ? $("#download-week-pdf") : format === "JSON" ? $("#download-week-json") : $("#download-week-word");
  if (button) button.disabled = true;
  $("#generation-error").classList.add("hidden");
  try {
    const response = await fetch(`/api/download-week-${route}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const safeSubject = String(project.subjectName || "guia-didactica").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "-");
    const extension = format === "PDF" ? "pdf" : format === "JSON" ? "json" : "docx";
    await saveDownloadResponse(response, `${safeSubject}-semana-${currentWeek}-revision.${extension}`);
  } finally {
    updateWeekReviewDownloadButtons(true);
  }
}

[["#download-week-pdf", "PDF"], ["#download-week-word", "WORD"], ["#download-week-json", "JSON"]].forEach(([selector, format]) => {
  const button = $(selector);
  if (!button) return;
  button.onclick = async () => {
    try {
      await downloadWeekReviewFormat(format);
    } catch (error) {
      $("#generation-error").textContent = error.message;
      $("#generation-error").classList.remove("hidden");
    }
  };
});

async function downloadGuideDocument(format) {
  if (consecutiveApprovedWeeks() !== totalWeeks()) {
    throw new Error("Confirme todas las semanas de la Guía Didáctica antes de descargarla.");
  }
  clearTimeout(syncTimer);
  await syncDatabase();
  if (!projectId) throw new Error("Guarde la asignatura antes de descargar la Guía Didáctica.");
  const subject = data().subjectName || "guia-didactica";
  if (format === "JSON") {
    const response = await fetch(`/api/projects/${projectId}/canonical-json`, { cache: "no-store" });
    return saveDownloadResponse(response, `${subject}.canonical.v3.json`);
  }
  const response = await fetch(format === "PDF" ? "/api/download-pdf" : "/api/download-word", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(guideDownloadPayload()),
  });
  return saveDownloadResponse(response, `${subject}.${format === "PDF" ? "pdf" : "docx"}`);
}
[["#download-guide-pdf", "PDF"], ["#download-guide-word", "WORD"], ["#download-guide-json", "JSON"]].forEach(([selector, format]) => {
  const button = $(selector);
  if (!button) return;
  button.onclick = async () => {
    button.disabled = true;
    $("#generation-error")?.classList.add("hidden");
    try {
      await downloadGuideDocument(format);
    } catch (error) {
      $("#generation-error").textContent = error.message;
      $("#generation-error").classList.remove("hidden");
    } finally {
      updateGuideDownloadButtons();
    }
  };
});

form.addEventListener("input", () => {
  if (step === 5) persistProject();
  else if (step <= 3) scheduleProgressSync();
});
form.addEventListener("change", () => {
  if (step <= 3) scheduleProgressSync();
});
restoreProject().finally(() => {
  if (matrixRows.length && totalWeeks()) updateWeekInterface();
});
if (!passwordResetTokenFromUrl) {
  authRequest("/api/auth/me").then(({ user }) => {
    if (user) showAuthenticatedUser(user);
  }).catch(console.error);
}

let adminData = null;
let academicOfferImportState = null;
function showMainContent() {
  $("#main-content").classList.remove("hidden");
  $("#admin-content").classList.add("hidden");
}
function showAdminMessage(text, error = false) {
  const element = $("#admin-message");
  element.textContent = text;
  element.classList.remove("hidden", "error");
  element.classList.toggle("error", error);
  clearTimeout(showAdminMessage.timer);
  showAdminMessage.timer = setTimeout(() => element.classList.add("hidden"), 9000);
}
function roleName(user) {
  return user.roles[0]?.role.name || "Sin rol";
}
function renderAdminUsers() {
  if (!adminData) return;
  const query = ($("#admin-user-search").value || "").toLowerCase();
  const users = adminData.users.filter((user) =>
    `${user.firstName} ${user.lastName} ${user.nationalId || ""} ${user.email}`.toLowerCase().includes(query));
  $("#admin-users-body").innerHTML = users.map((user) => {
    const isCurrentUser = user.id === authenticatedUserData?.id;
    return `
    <tr>
      <td><strong>${escapeHtml(`${user.firstName} ${user.lastName}`)}</strong>${user.mustChangePassword ? "<small>Debe cambiar la contraseña</small>" : ""}</td>
      <td>${escapeHtml(user.nationalId || "—")}</td><td>${escapeHtml(user.email)}</td>
      <td><span class="assigned-role">${escapeHtml(roleName(user))}</span></td>
      <td><span class="status-badge ${user.active ? "status-completed" : "status-draft"}">${user.active ? "Activa" : "Inactiva"}</span></td>
      <td class="table-actions">${adminActionButton("edit", "Editar datos", `data-edit-user="${escapeHtml(user.id)}"`)}${isCurrentUser ? "" : `<button type="button" data-password-user="${user.id}">Contraseña temporal</button>`}${adminActionButton(user.active ? "deactivate" : "activate", user.active ? "Desactivar usuario" : "Activar usuario", `data-toggle-user="${escapeHtml(user.id)}" data-active="${user.active}"`)}</td>
    </tr>`;
  }).join("") || `<tr><td colspan="6">No se encontraron usuarios.</td></tr>`;
}
function renderAssignments() {
  if (!adminData) return;
  const teachers = adminData.users.filter((user) => user.active && user.roles.some((entry) => entry.role.code === "TEACHER"));
  $("#assignment-teacher").innerHTML = `<option value="">Seleccione un profesor</option>${teachers.map((user) =>
    `<option value="${user.id}">${escapeHtml(`${user.firstName} ${user.lastName} — ${user.email}`)}</option>`).join("")}`;
  $("#assignment-source").innerHTML = `<option value="">Crear guía nueva</option>${adminData.projects.filter((project) => project.status === "COMPLETED").map((project) =>
    `<option value="${project.id}">${escapeHtml(`${project.subjectCode} — ${project.subjectName} (${project.academicPeriod})`)}</option>`).join("")}`;
  $("#assignment-offering").innerHTML = `<option value="">Seleccione una oferta</option>${adminData.academicOfferings
    .filter((item) => item.active && item.course.active && item.program.active && item.program.academicLevel.active &&
      item.program.academicUnit.active && item.modality.active && item.subjectType.active && item.period.active)
    .map((item) => `<option value="${item.id}">${escapeHtml(offeringLabel(item))}</option>`).join("")}`;
  $("#assignment-list").innerHTML = adminData.assignments.map((item) => `
    <article><strong>${escapeHtml(offeringLabel(item.academicOffering))}</strong><span>${escapeHtml(item.teacher.displayName)} · desde ${new Date(item.assignedAt).toLocaleDateString("es-EC")}${item.endedAt ? ` hasta ${new Date(item.endedAt).toLocaleDateString("es-EC")}` : ""}</span><span class="status-badge ${item.active ? "status-completed" : "status-draft"}">${item.active ? "Vigente" : "Finalizada"}</span></article>`).join("") || "<p>No existen asignaciones.</p>";
}

function offeringLabel(item) {
  return `${item.course.code} — ${item.course.name} · ${item.program.name} · ${item.modality.name} · ${item.period.name}`;
}

const catalogLabels = {
  levels: "Niveles académicos", modalities: "Modalidades", units: "Unidades académicas",
  programs: "Carreras o programas", "subject-types": "Tipos de asignatura",
  periods: "Periodos académicos", courses: "Asignaturas", departments: "Departamentos docentes", offerings: "Ofertas académicas",
};
const catalogFields = {
  levels: ["code", "name", "sortOrder"],
  modalities: ["code", "name", "sortOrder"],
  units: ["code", "name", "sortOrder"],
  programs: ["code", "name", "academicLevelId", "academicUnitId"],
  "subject-types": ["code", "name", "sortOrder", "planCategory"],
  periods: ["code", "name", "startsAt", "endsAt", "bimestralEvaluationStartAt", "bimestralEvaluationEndAt", "recoveryEvaluationStartAt", "recoveryEvaluationEndAt"],
  courses: ["code", "name"],
  departments: ["code", "name", "sortOrder"],
  offerings: [
    "code", "courseId", "programId", "modalityId", "subjectTypeId", "periodId", "totalWeeks",
    "credits", "acdHours", "apeHours", "aaHours", "semester", "description", "prerequisites",
    "learningOutcomes", "professionalProfileCompetencies", "graduateProfileResults",
    "utplGenericCompetencies", "unitContents",
  ],
};

function catalogItems(kind = $("#catalog-kind").value) {
  if (!adminData) return [];
  return {
    levels: adminData.academicLevels,
    modalities: adminData.modalities,
    units: adminData.academicUnits,
    programs: adminData.academicPrograms,
    "subject-types": adminData.subjectTypes,
    periods: adminData.periods,
    courses: adminData.courses,
    departments: adminData.departments,
    offerings: adminData.academicOfferings,
  }[kind] || [];
}

function catalogOptions(items, label) {
  return `<option value="">Seleccione</option>${items.map((item) =>
    `<option value="${item.id}">${escapeHtml(label(item))}${item.active ? "" : " · Inactivo"}</option>`).join("")}`;
}

function populateCatalogReferences() {
  if (!adminData) return;
  const form = $("#catalog-form");
  form.elements.academicLevelId.innerHTML = catalogOptions(adminData.academicLevels, (item) => item.name);
  form.elements.academicUnitId.innerHTML = catalogOptions(adminData.academicUnits, (item) => item.name);
  form.elements.courseId.innerHTML = catalogOptions(adminData.courses, (item) => `${item.code} — ${item.name}`);
  form.elements.programId.innerHTML = catalogOptions(adminData.academicPrograms, (item) => item.name);
  form.elements.modalityId.innerHTML = catalogOptions(adminData.modalities, (item) => item.name);
  form.elements.subjectTypeId.innerHTML = catalogOptions(adminData.subjectTypes, (item) => item.name);
  form.elements.periodId.innerHTML = catalogOptions(adminData.periods, (item) => item.name);
}

function catalogContext(kind, item) {
  if (kind === "programs") return `${item.academicLevel.name} · ${item.academicUnit.name}`;
  if (kind === "periods") {
    const starts = item.startsAt ? new Date(item.startsAt).toLocaleDateString("es-EC") : "sin fecha inicial";
    const ends = item.endsAt ? new Date(item.endsAt).toLocaleDateString("es-EC") : "sin fecha final";
    const bimestral = item.bimestralEvaluationStartAt || item.bimestralEvaluationEndAt
      ? ` · Bimestral: ${formatDateEc(item.bimestralEvaluationStartAt)}${item.bimestralEvaluationEndAt ? ` al ${formatDateEc(item.bimestralEvaluationEndAt)}` : ""}`
      : "";
    const recovery = item.recoveryEvaluationStartAt || item.recoveryEvaluationEndAt
      ? ` · Recuperación: ${formatDateEc(item.recoveryEvaluationStartAt)}${item.recoveryEvaluationEndAt ? ` al ${formatDateEc(item.recoveryEvaluationEndAt)}` : ""}`
      : "";
    return `${starts} – ${ends}${bimestral}${recovery}`;
  }
  if (kind === "offerings") return `${item.code} · ${item.program.academicLevel.name} · ${item.program.academicUnit.name} · ${item.subjectType.name} · ${item.totalWeeks} semanas`;
  if (kind === "subject-types") return item.planCategory ? `Plan: ${item.planCategory}` : "Categoría del plan pendiente";
  return "";
}

function renderCatalogs() {
  if (!adminData) return;
  const kind = $("#catalog-kind").value;
  const visibleFields = new Set(catalogFields[kind]);
  $$("[data-catalog-field]").forEach((label) => {
    const visible = visibleFields.has(label.dataset.catalogField);
    label.classList.toggle("hidden", !visible);
    const field = label.querySelector("input,select,textarea");
    if (field) field.required = !label.classList.contains("structured-field") && visible && ![
      "sortOrder", "startsAt", "endsAt", "bimestralEvaluationStartAt", "bimestralEvaluationEndAt", "recoveryEvaluationStartAt", "recoveryEvaluationEndAt", "credits", "semester", "description", "prerequisites",
      "utplGenericCompetencies",
    ].includes(label.dataset.catalogField);
  });
  populateCatalogReferences();
  $("#catalog-table-title").textContent = catalogLabels[kind];
  const query = $("#catalog-search").value.trim().toLowerCase();
  const items = catalogItems(kind).filter((item) => {
    const text = kind === "offerings" ? offeringLabel(item) : `${item.code || ""} ${item.name || ""} ${catalogContext(kind, item)}`;
    return text.toLowerCase().includes(query);
  });
  $("#catalog-table-body").innerHTML = items.map((item) => {
    const code = kind === "offerings" ? `${item.code} · ${item.course.code} — ${item.course.name}` : item.code;
    const name = kind === "offerings" ? `${item.program.name} · ${item.modality.name} · ${item.period.name}` : item.name;
    return `<tr><td><strong>${escapeHtml(code)}</strong></td><td>${escapeHtml(name)}<small>${escapeHtml(catalogContext(kind, item))}</small></td>
      <td><span class="status-badge ${item.active ? "status-completed" : "status-draft"}">${item.active ? "Activo" : "Inactivo"}</span></td>
      <td><div class="table-actions">${adminActionButton("edit", "Editar", `data-catalog-edit="${escapeHtml(item.id)}"`)}${adminActionButton(item.active ? "deactivate" : "activate", item.active ? "Desactivar" : "Activar", `data-catalog-toggle="${escapeHtml(item.id)}"`)}${adminActionButton("delete", "Eliminar", `data-catalog-delete="${escapeHtml(item.id)}"`, "danger")}</div></td></tr>`;
  }).join("") || `<tr><td colspan="4">No existen registros en este catálogo.</td></tr>`;
}

function resetCatalogForm(keepKind = true) {
  const form = $("#catalog-form");
  const kind = form.elements.kind.value;
  form.reset();
  if (keepKind) form.elements.kind.value = kind;
  form.elements.catalogId.value = "";
  form.elements.sortOrder.value = 100;
  form.elements.totalWeeks.value = 8;
  form.elements.acdHours.value = 0;
  form.elements.apeHours.value = 0;
  form.elements.aaHours.value = 0;
  form.elements.active.checked = true;
  resetStructuredOfferingFields();
  $("#catalog-form-title").textContent = "Crear registro de catálogo";
  $("#catalog-cancel").classList.add("hidden");
  renderCatalogs();
}

function fillCatalogForm(kind, item) {
  const form = $("#catalog-form");
  form.elements.catalogId.value = item.id;
  for (const field of catalogFields[kind]) {
    let value = item[field];
    if (["startsAt", "endsAt", "bimestralEvaluationStartAt", "bimestralEvaluationEndAt", "recoveryEvaluationStartAt", "recoveryEvaluationEndAt"].includes(field)) value = value ? String(value).slice(0, 10) : "";
    if (Array.isArray(value)) value = value.join("\n");
    if (form.elements[field]) form.elements[field].value = value ?? "";
  }
  if (kind === "offerings") loadStructuredOfferingFields(item);
  form.elements.active.checked = item.active;
  $("#catalog-form-title").textContent = `Editar: ${catalogLabels[kind]}`;
  $("#catalog-cancel").classList.remove("hidden");
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}
const knowledgeResourceLabels = {
  INSTITUTIONAL_DOCUMENT: "Documento institucional",
  PLAN_TEMPLATE: "Formato del Plan Docente",
  PLAN_PROMPT: "Prompt del Plan Docente",
  GUIDE_PROMPT: "Prompt de la Guía Didáctica",
  GUIDE_RESOURCE_SPEC: "Especificación de recursos educativos para la Guía Didáctica",
};
const knowledgeStatusLabels = {
  ACTIVE: "Activo",
  DRAFT: "Borrador",
  INACTIVE: "Inactivo",
  ARCHIVED: "Dado de baja",
};
const knowledgeInstructionProcessLabels = {
  PLAN_GENERATION: "Generación del Plan Docente",
  PLAN_ADAPTATION: "Adaptación del Plan Docente 16 → 8",
  GUIDE_GENERATION: "Generación de la Guía Didáctica",
  GUIDE_ADAPTATION: "Adaptación de la Guía Didáctica 16 → 8",
};

function selectedInstructionProcesses(form = $("#knowledge-config-form")) {
  if (!form) return [];
  return [...form.querySelectorAll('[name="instructionProcess"]:checked')].map((input) => input.value);
}

function setInstructionProcesses(form, processes) {
  const selected = new Set(Array.isArray(processes) && processes.length
    ? processes
    : ["GUIDE_GENERATION", "GUIDE_ADAPTATION"]);
  form.querySelectorAll('[name="instructionProcess"]').forEach((input) => {
    input.checked = selected.has(input.value);
  });
}

function knowledgeItems(kind = currentKnowledgeKind()) {
  if (!adminData) return [];
  return kind === "SPECIFICATION" ? (adminData.instructions || []) : (adminData.documents || []);
}

function groupedKnowledgeItems(kind = currentKnowledgeKind()) {
  const groups = new Map();
  knowledgeItems(kind).forEach((item) => {
    const key = item.key || item.id;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  });
  return [...groups.entries()].map(([key, versions]) => ({
    key,
    versions: versions.sort((a, b) => Number(b.version) - Number(a.version)),
  }));
}

function knowledgeGroupHead(versions) {
  return versions.find((item) => item.status === "ACTIVE")
    || versions.find((item) => item.status !== "ARCHIVED")
    || versions[0];
}

function knowledgeVersionLabel(item) {
  return `${item.title} · v${item.version} · ${knowledgeStatusLabels[item.status] || item.status}`;
}

function renderKnowledgeConfigSelector(selectedId) {
  const selector = $("#knowledge-config-selector");
  if (!selector || !adminData) return;
  const kind = currentKnowledgeKind();
  const items = knowledgeItems(kind);
  const emptyLabel = kind === "SPECIFICATION" ? "Nueva especificación" : "Nuevo documento";
  const preservedId = selectedId === undefined ? selector.value : selectedId;
  const heads = groupedKnowledgeItems(kind)
    .map((group) => knowledgeGroupHead(group.versions))
    .filter(Boolean)
    .sort((a, b) => a.title.localeCompare(b.title, "es"));
  const selected = items.find((item) => item.id === preservedId);
  const visible = selected && !heads.some((item) => item.id === selected.id) ? [...heads, selected] : heads;
  selector.innerHTML = `<option value="">${emptyLabel}</option>${visible.map((item) =>
    `<option value="${escapeHtml(item.id)}">${escapeHtml(knowledgeVersionLabel(item))}</option>`).join("")}`;
  selector.value = visible.some((item) => item.id === preservedId) ? preservedId : "";
}

function knowledgeStatusBadge(item) {
  const className = item.status === "ACTIVE"
    ? "status-completed"
    : item.status === "ARCHIVED"
      ? "status-archived"
      : "status-draft";
  return `<span class="status-badge ${className}">${escapeHtml(knowledgeStatusLabels[item.status] || item.status)}</span>`;
}

function updateKnowledgeFormActions(item = selectedKnowledgeRecord) {
  const kind = currentKnowledgeKind();
  const isDocument = kind === "DOCUMENT";
  const existing = Boolean(item);
  const archived = item?.status === "ARCHIVED";
  const saveButton = $("#knowledge-save-button");
  const createVersionButton = $("#knowledge-create-version-button");
  const activateButton = $("#activate-knowledge-version");
  const archiveButton = $("#archive-knowledge-version");
  const originalLink = $("#download-knowledge-original");
  const textLink = $("#download-knowledge-text");
  const activateOption = $("#knowledge-activate-option");
  const selectedInfo = $("#knowledge-selected-version");

  if (saveButton) {
    saveButton.textContent = existing
      ? "Guardar cambios"
      : (isDocument ? "Guardar documento" : "Guardar especificación");
    saveButton.classList.toggle("hidden", archived);
  }
  if (createVersionButton) {
    createVersionButton.textContent = kind === "DOCUMENT" ? "Crear nueva versión" : "Crear nueva versión de la especificación";
    createVersionButton.classList.toggle("hidden", !existing);
  }
  activateOption?.classList.toggle("hidden", existing);
  activateButton?.classList.toggle("hidden", !existing || item.status === "ACTIVE" || archived);
  archiveButton?.classList.toggle("hidden", !existing || archived);

  if (isDocument && existing) {
    originalLink.href = `/api/admin/knowledge/${encodeURIComponent(item.id)}/download`;
    textLink.href = `/api/admin/knowledge/${encodeURIComponent(item.id)}/download-text`;
    originalLink.classList.remove("hidden");
    textLink.classList.remove("hidden");
  } else {
    originalLink?.classList.add("hidden");
    textLink?.classList.add("hidden");
  }

  if (selectedInfo) {
    if (!existing) {
      selectedInfo.classList.add("hidden");
      selectedInfo.innerHTML = "";
    } else {
      const type = kind === "DOCUMENT"
        ? (knowledgeResourceLabels[item.resourceKind] || item.resourceKind)
        : "Especificación funcional";
      const retired = item.status === "ARCHIVED" && item.retirementReason
        ? `<span><strong>Motivo de baja:</strong> ${escapeHtml(item.retirementReason)}</span>`
        : "";
      selectedInfo.innerHTML = `<div><strong>${escapeHtml(item.title)} · v${item.version}</strong><span>${escapeHtml(type)}</span>${retired}</div>${knowledgeStatusBadge(item)}`;
      selectedInfo.classList.remove("hidden");
    }
  }
}

function configureKnowledgeForm(kind, { reset = false } = {}) {
  const form = $("#knowledge-config-form");
  if (!form) return;
  const isDocument = kind === "DOCUMENT";
  $$('[data-document-only]', form).forEach((node) => node.classList.toggle("hidden", !isDocument));
  $$('[data-specification-only]', form).forEach((node) => node.classList.toggle("hidden", isDocument));
  $$('[data-config-copy]', form).forEach((node) => node.classList.toggle("hidden", node.dataset.configCopy !== kind));
  $$('[data-scope-help]', form).forEach((node) => node.classList.toggle("hidden", node.dataset.scopeHelp !== kind));
  $("#knowledge-content-label").textContent = isDocument ? "Texto extraído o síntesis controlada" : "Contenido de la especificación";
  form.elements.content.placeholder = isDocument
    ? "Pegue el texto extraído o una síntesis que facilite el análisis de impacto."
    : "Describa la regla o comportamiento funcional con al menos 20 caracteres.";
  if (reset) {
    form.reset();
    selectedKnowledgeRecord = null;
    $("#knowledge-config-kind").value = kind;
    if (isDocument) {
      form.elements.appliesToGuide.checked = true;
      form.elements.appliesToAll.checked = true;
    } else {
      setInstructionProcesses(form, ["GUIDE_GENERATION", "GUIDE_ADAPTATION"]);
    }
    form.elements.activate.checked = true;
    form.elements.priority.value = 100;
    renderKnowledgeScopePickers();
  }
  const hideScope = isDocument && form.elements.appliesToAll.checked;
  form.querySelector('[data-shared-scope]').classList.toggle("scope-disabled", hideScope);
  renderKnowledgeConfigSelector(reset ? "" : selectedKnowledgeRecord?.id);
  updateKnowledgeFormActions(selectedKnowledgeRecord);
  resetImpact(kind);
}

async function loadKnowledgeRecord(kind, id, { scroll = false } = {}) {
  const form = $("#knowledge-config-form");
  if (!form) return;
  if (!id) {
    configureKnowledgeForm(kind, { reset: true });
    return;
  }
  if ($("#knowledge-config-kind").value !== kind) {
    $("#knowledge-config-kind").value = kind;
    configureKnowledgeForm(kind, { reset: true });
  }
  if (kind === "SPECIFICATION") {
    const item = (adminData.instructions || []).find((entry) => entry.id === id);
    if (!item) return;
    selectedKnowledgeRecord = item;
    form.elements.key.value = item.key;
    form.elements.title.value = item.title;
    form.elements.content.value = item.content;
    form.elements.activate.checked = item.status === "ACTIVE";
    setInstructionProcesses(form, item.processes);
    setScopeValues(form, item);
  } else {
    const data = await authRequest(`/api/admin/knowledge/${encodeURIComponent(id)}`);
    selectedKnowledgeRecord = data.document;
    form.elements.key.value = data.document.key;
    form.elements.title.value = data.document.title;
    form.elements.priority.value = data.document.priority ?? 100;
    form.elements.resourceKind.value = data.document.resourceKind || "INSTITUTIONAL_DOCUMENT";
    form.elements.appliesToPlan.checked = Boolean(data.document.appliesToPlan);
    form.elements.appliesToGuide.checked = data.document.appliesToGuide !== false;
    form.elements.effectiveFrom.value = data.document.effectiveFrom ? String(data.document.effectiveFrom).slice(0, 10) : "";
    form.elements.provisional.checked = Boolean(data.document.provisional);
    setScopeValues(form, data.document);
    form.elements.appliesToAll.checked = data.document.appliesToAll !== false;
    form.elements.content.value = data.document.contentMarkdown || "";
    form.elements.activate.checked = data.document.status === "ACTIVE";
    form.elements.file.value = "";
  }
  form.querySelector('[data-shared-scope]').classList.toggle("scope-disabled", kind === "DOCUMENT" && form.elements.appliesToAll.checked);
  renderKnowledgeConfigSelector(id);
  updateKnowledgeFormActions(selectedKnowledgeRecord);
  resetImpact(kind);
  if (scroll) form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function knowledgeResourceCard(kind, group) {
  const head = knowledgeGroupHead(group.versions);
  if (!head) return "";
  const groupId = `${kind}:${group.key}`;
  const expanded = expandedKnowledgeGroups.has(groupId);
  const typeLabel = kind === "DOCUMENT"
    ? (knowledgeResourceLabels[head.resourceKind] || head.resourceKind)
    : "Especificación funcional";
  const applies = kind === "DOCUMENT"
    ? [head.appliesToPlan ? "Plan Docente" : "", head.appliesToGuide ? "Guía Didáctica" : ""].filter(Boolean).join(" y ") || "Sin destino configurado"
    : (Array.isArray(head.processes) && head.processes.length
        ? head.processes.map((process) => knowledgeInstructionProcessLabels[process] || process).join(" · ")
        : "Generación y adaptación de la Guía Didáctica");
  const history = group.versions.map((item) => {
    const retired = item.status === "ARCHIVED" && item.retirementReason
      ? `<small>Motivo de baja: ${escapeHtml(item.retirementReason)}</small>`
      : "";
    return `<div class="knowledge-version-row">
      <div><strong>v${item.version} · ${escapeHtml(knowledgeStatusLabels[item.status] || item.status)}</strong><span>${new Date(item.updatedAt || item.createdAt).toLocaleString("es-EC")}</span>${retired}</div>
      <div class="table-actions">
        ${item.status === "ARCHIVED" ? `<button type="button" data-knowledge-action="open" data-kind="${kind}" data-id="${escapeHtml(item.id)}">Consultar</button>` : adminActionButton("edit", "Editar", `data-knowledge-action="open" data-kind="${kind}" data-id="${escapeHtml(item.id)}"`)}
        <button type="button" data-knowledge-action="new-version" data-kind="${kind}" data-id="${escapeHtml(item.id)}">Crear nueva versión</button>
        ${kind === "DOCUMENT" ? `<a href="/api/admin/knowledge/${encodeURIComponent(item.id)}/download">Descargar original</a>` : ""}
      </div>
    </div>`;
  }).join("");
  return `<article class="knowledge-resource-card">
    <div class="knowledge-resource-summary">
      <div><strong>${escapeHtml(head.title)}</strong><span>${escapeHtml(typeLabel)} · ${escapeHtml(applies)} · clave ${escapeHtml(head.key)}</span></div>
      ${knowledgeStatusBadge(head)}
    </div>
    <div class="knowledge-resource-actions">
      ${head.status === "ARCHIVED" ? `<button type="button" data-knowledge-action="open" data-kind="${kind}" data-id="${escapeHtml(head.id)}">Consultar</button>` : adminActionButton("edit", "Editar configuración", `data-knowledge-action="open" data-kind="${kind}" data-id="${escapeHtml(head.id)}"`)}
      <button type="button" data-knowledge-action="new-version" data-kind="${kind}" data-id="${escapeHtml(head.id)}">Crear nueva versión</button>
      ${kind === "DOCUMENT" ? `<a href="/api/admin/knowledge/${encodeURIComponent(head.id)}/download">Descargar original</a>` : ""}
      ${group.versions.length > 1 ? `<button type="button" data-knowledge-action="versions" data-group="${escapeHtml(groupId)}">${expanded ? "Ocultar versiones" : `Ver versiones (${group.versions.length})`}</button>` : ""}
      ${head.status !== "ARCHIVED" ? `<button type="button" class="danger-link" data-knowledge-action="archive" data-kind="${kind}" data-id="${escapeHtml(head.id)}">Dar de baja</button>` : ""}
    </div>
    <div class="knowledge-version-history ${expanded ? "" : "hidden"}">${history}</div>
  </article>`;
}

function renderAiVersions() {
  if (!adminData) return;
  const groups = [
    ...groupedKnowledgeItems("DOCUMENT").map((group) => ({ kind: "DOCUMENT", ...group })),
    ...groupedKnowledgeItems("SPECIFICATION").map((group) => ({ kind: "SPECIFICATION", ...group })),
  ].sort((a, b) => {
    const aHead = knowledgeGroupHead(a.versions);
    const bHead = knowledgeGroupHead(b.versions);
    return String(aHead?.title || "").localeCompare(String(bHead?.title || ""), "es");
  });
  $("#ai-version-list").innerHTML = groups.map((group) => knowledgeResourceCard(group.kind, group)).join("")
    || "<p>No existen recursos registrados.</p>";
  renderKnowledgeConfigSelector(selectedKnowledgeRecord?.id);
  renderIndicators();
}

function activeIndicatorVersion() {
  return adminData?.indicatorVersions.find((item) => item.status === "ACTIVE") || adminData?.indicatorVersions[0];
}
function renderIndicators() {
  const version = activeIndicatorVersion();
  const stage = $("#indicator-stage-filter")?.value || "PEER";
  const labels = { PEER: "Par académico", QUALITY: "Equipo de calidad", DIITEP: "DIITEP" };
  const target = { PEER: 35, QUALITY: 30, DIITEP: 35 };
  const items = (version?.indicators || []).filter((item) => item.stage === stage);
  const activeTotal = items.filter((item) => item.active).reduce((sum, item) => sum + Number(item.score), 0);
  $("#indicator-weight-summary").textContent = `${labels[stage]} · ${items.filter((item) => item.active).length} indicadores activos · ${activeTotal.toFixed(2)} de ${target[stage]} puntos. Cada cambio crea una nueva versión y redistribuye el puntaje del rol.`;
  $("#indicator-table-body").innerHTML = items.map((item) => `<tr data-id="${item.id}">
    <td><strong>${escapeHtml(item.name || item.code)}</strong><small>${escapeHtml(item.code)}</small></td>
    <td>${escapeHtml(item.description)}</td><td>${Number(item.score).toFixed(2)}</td>
    <td><span class="status-badge ${item.active ? "status-completed" : "status-draft"}">${item.active ? "Activo" : "Deshabilitado"}</span></td>
    <td><div class="table-actions">${adminActionButton("edit", "Actualizar", 'data-indicator-action="edit"')}${adminActionButton(item.active ? "deactivate" : "activate", item.active ? "Deshabilitar" : "Habilitar", 'data-indicator-action="toggle"')}${adminActionButton("delete", "Eliminar", 'data-indicator-action="delete"', "danger")}</div></td></tr>`).join("")
    || `<tr><td colspan="5">No existen indicadores para este responsable.</td></tr>`;
}
function renderGuideReport() {
  if (!adminData) return;
  const query = ($("#guide-report-search").value || "").toLowerCase();
  const projects = adminData.projects.filter((project) =>
    `${project.name} ${project.subjectCode} ${project.subjectName} ${project.professorName} ${project.academicPeriod}`.toLowerCase().includes(query));
  const total = adminData.projects.length;
  const completed = adminData.projects.filter((item) => item.status === "COMPLETED").length;
  const inProgress = adminData.projects.filter((item) => item.status === "IN_PROGRESS").length;
  const draft = adminData.projects.filter((item) => item.status === "DRAFT").length;
  $("#guide-summary").innerHTML = [
    ["Total", total], ["Finalizadas", completed], ["En elaboración", inProgress], ["Borradores", draft],
  ].map(([label, value]) => `<article><strong>${value}</strong><span>${label}</span></article>`).join("");
  $("#guide-report-body").innerHTML = projects.map((project) => {
    const approved = project.weeks.filter((week) => week.status === "APPROVED").length;
    return `<tr><td><strong>${escapeHtml(project.subjectName)}</strong><small>${escapeHtml(project.subjectCode || "Sin código")}</small></td>
      <td>${escapeHtml(project.professorName || "No registrado")}</td><td>${escapeHtml(project.academicPeriod)}</td>
      <td>${approved} de ${project.totalWeeks} semanas</td><td><span class="status-badge status-${project.status.toLowerCase()}">${project.status}</span></td>
      <td>${new Date(project.updatedAt).toLocaleString("es-EC")}</td></tr>`;
  }).join("") || `<tr><td colspan="6">No se encontraron guías.</td></tr>`;
}
function institutionalSettingValue(key, fallback = "") {
  return (adminData?.institutionalSettings || []).find((item) => item.key === key)?.value || fallback;
}
function renderInstitutionalPlanText() {
  const field = $("#institutional-curricular-adaptations");
  if (!field) return;
  field.value = institutionalSettingValue("TEACHING_PLAN_CURRICULAR_ADAPTATIONS", field.value || "");
  const formats = institutionalSettingValue("TEACHING_PLAN_DOWNLOAD_FORMATS", "PDF").split(",").map((item) => item.trim().toUpperCase());
  $$('input[name="downloadFormat"]', $("#institutional-plan-text-form")).forEach((input) => input.checked = formats.includes(input.value));
}
function renderGuideDownloadSettings() {
  const form = $("#guide-download-format-form");
  if (!form) return;
  const formats = institutionalSettingValue("GUIDE_DOWNLOAD_FORMATS", "PDF").split(",").map((item) => item.trim().toUpperCase());
  $$('input[name="guideDownloadFormat"]', form).forEach((input) => input.checked = formats.includes(input.value));
}

async function loadAdminDashboard() {
  adminData = await authRequest("/api/admin/dashboard");
  renderKnowledgeScopePickers();
  const enabledRoles = adminData.roles.filter((role) => ["ADMIN", "TEACHER"].includes(role.code));
  $("#admin-user-role").innerHTML = `<option value="">Seleccione un rol</option>${enabledRoles.map((role) => `<option value="${role.code}">${escapeHtml(role.name)}</option>`).join("")}`;
  renderAdminUsers(); renderCatalogs(); renderAssignments(); renderAiVersions(); configureKnowledgeForm(currentKnowledgeKind()); renderInstitutionalPlanText(); renderGuideDownloadSettings(); renderGuideReport();
  $("#checklist-project").innerHTML = `<option value="">Seleccione una guía</option>${adminData.projects.map((project) => `<option value="${project.id}">${escapeHtml(`${project.subjectCode} — ${project.subjectName} · ${project.professorName}`)}</option>`).join("")}`;
}
$("#nav-admin").onclick = async () => {
  activateNavigation($("#nav-admin"));
  $("#main-content").classList.add("hidden");
  $("#admin-content").classList.remove("hidden");
  try { await loadAdminDashboard(); } catch (error) { showAdminMessage(error.message, true); }
};
$("#nav-home").addEventListener("click", showMainContent);
$("#nav-projects").addEventListener("click", showMainContent);
$("#refresh-admin").onclick = () => loadAdminDashboard().catch((error) => showAdminMessage(error.message, true));
$$("[data-admin-tab]").forEach((button) => {
  button.onclick = () => {
    $$("[data-admin-tab]").forEach((item) => item.classList.toggle("active", item === button));
    $$("[data-admin-panel]").forEach((panel) => panel.classList.toggle("active", panel.dataset.adminPanel === button.dataset.adminTab));
  };
});
$("#admin-user-search").oninput = renderAdminUsers;
$("#catalog-search").oninput = renderCatalogs;
$("#catalog-kind").onchange = () => resetCatalogForm(true);
$("#catalog-cancel").onclick = () => resetCatalogForm(true);
$("#guide-report-search").oninput = renderGuideReport;

$("#add-learning-outcome").onclick = () => addStructuredItem("learningOutcomes", "#learning-outcome-input");
$("#add-professional-competency").onclick = () => addStructuredItem("professionalProfileCompetencies", "#professional-competency-input");
$("#add-graduate-result").onclick = () => addStructuredItem("graduateProfileResults", "#graduate-result-input");
[["#learning-outcome-input", "learningOutcomes"], ["#professional-competency-input", "professionalProfileCompetencies"], ["#graduate-result-input", "graduateProfileResults"]].forEach(([selector, kind]) => {
  $(selector).addEventListener("keydown", (event) => {
    if (event.key === "Enter") { event.preventDefault(); addStructuredItem(kind, selector); }
  });
});
$("#catalog-form").addEventListener("click", (event) => {
  const edit = event.target.closest("[data-structured-edit]");
  if (edit) {
    const kind = edit.dataset.structuredEdit;
    const index = Number(edit.dataset.index);
    const value = window.prompt("Modifique el texto:", catalogStructuredState[kind][index]);
    if (value !== null && normalizeStructuredText(value)) { catalogStructuredState[kind][index] = normalizeStructuredText(value); renderStructuredList(kind); }
    return;
  }
  const remove = event.target.closest("[data-structured-delete]");
  if (remove) {
    const kind = remove.dataset.structuredDelete;
    catalogStructuredState[kind].splice(Number(remove.dataset.index), 1);
    renderStructuredList(kind);
    return;
  }
  const removeGeneric = event.target.closest("[data-remove-generic]");
  if (removeGeneric) {
    catalogStructuredState.utplGenericCompetencies = catalogStructuredState.utplGenericCompetencies.filter((value) => value !== removeGeneric.dataset.removeGeneric);
    renderGenericCompetencies();
    return;
  }
  const editUnit = event.target.closest("[data-edit-unit]");
  if (editUnit) {
    const index = Number(editUnit.dataset.editUnit);
    const value = window.prompt("Título de la unidad:", catalogStructuredState.units[index].title);
    if (value !== null && normalizeStructuredText(value)) { catalogStructuredState.units[index].title = normalizeStructuredText(value); renderUnits(); }
    return;
  }
  const deleteUnit = event.target.closest("[data-delete-unit]");
  if (deleteUnit) {
    catalogStructuredState.units.splice(Number(deleteUnit.dataset.deleteUnit), 1); renderUnits(); return;
  }
  const addContent = event.target.closest("[data-add-content]");
  if (addContent) {
    const unitIndex = Number(addContent.dataset.addContent);
    const input = $(`[data-content-input="${unitIndex}"]`);
    const value = normalizeStructuredText(input.value);
    if (value) { catalogStructuredState.units[unitIndex].contents.push({ text: value, subcontents: [] }); renderUnits(); }
    return;
  }
  const editContent = event.target.closest("[data-edit-content]");
  if (editContent) {
    const [unitIndex, contentIndex] = editContent.dataset.editContent.split(":").map(Number);
    const current = catalogStructuredState.units[unitIndex].contents[contentIndex];
    const value = window.prompt("Modifique el contenido:", current.text);
    if (value !== null && normalizeStructuredText(value)) { current.text = normalizeStructuredText(value); renderUnits(); }
    return;
  }
  const deleteContent = event.target.closest("[data-delete-content]");
  if (deleteContent) {
    const [unitIndex, contentIndex] = deleteContent.dataset.deleteContent.split(":").map(Number);
    catalogStructuredState.units[unitIndex].contents.splice(contentIndex, 1); renderUnits();
    return;
  }
  const addSubcontent = event.target.closest("[data-add-subcontent]");
  if (addSubcontent) {
    const [unitIndex, contentIndex] = addSubcontent.dataset.addSubcontent.split(":").map(Number);
    const input = $(`[data-subcontent-input="${unitIndex}:${contentIndex}"]`);
    const value = normalizeStructuredText(input.value);
    if (value) { catalogStructuredState.units[unitIndex].contents[contentIndex].subcontents.push(value); renderUnits(); }
    return;
  }
  const editSubcontent = event.target.closest("[data-edit-subcontent]");
  if (editSubcontent) {
    const [unitIndex, contentIndex, subcontentIndex] = editSubcontent.dataset.editSubcontent.split(":").map(Number);
    const current = catalogStructuredState.units[unitIndex].contents[contentIndex].subcontents[subcontentIndex];
    const value = window.prompt("Modifique el subcontenido:", current);
    if (value !== null && normalizeStructuredText(value)) {
      catalogStructuredState.units[unitIndex].contents[contentIndex].subcontents[subcontentIndex] = normalizeStructuredText(value);
      renderUnits();
    }
    return;
  }
  const deleteSubcontent = event.target.closest("[data-delete-subcontent]");
  if (deleteSubcontent) {
    const [unitIndex, contentIndex, subcontentIndex] = deleteSubcontent.dataset.deleteSubcontent.split(":").map(Number);
    catalogStructuredState.units[unitIndex].contents[contentIndex].subcontents.splice(subcontentIndex, 1);
    renderUnits();
  }
});
$("#generic-competency-options").addEventListener("change", (event) => {
  if (!event.target.matches('input[type="checkbox"]')) return;
  const value = event.target.value;
  if (event.target.checked) {
    if (!catalogStructuredState.utplGenericCompetencies.includes(value)) catalogStructuredState.utplGenericCompetencies.push(value);
  } else {
    catalogStructuredState.utplGenericCompetencies = catalogStructuredState.utplGenericCompetencies.filter((item) => item !== value);
  }
  renderGenericCompetencies();
});
$("#add-unit").onclick = () => {
  const input = $("#unit-title-input");
  const title = normalizeStructuredText(input.value);
  if (!title) return;
  catalogStructuredState.units.push({ title, contents: [] });
  input.value = ""; renderUnits();
};
$("#unit-title-input").addEventListener("keydown", (event) => {
  if (event.key === "Enter") { event.preventDefault(); $("#add-unit").click(); }
});
resetStructuredOfferingFields();

function catalogPayload(kind, source, active = source.active) {
  const payload = { active };
  for (const field of catalogFields[kind]) {
    let value = source[field];
    if (["sortOrder", "totalWeeks", "acdHours", "apeHours", "aaHours"].includes(field)) value = Number(value);
    if (field === "credits") value = value === "" || value === null || value === undefined ? null : Number(value);
    if (["prerequisites", "learningOutcomes", "professionalProfileCompetencies", "graduateProfileResults", "utplGenericCompetencies", "unitContents"].includes(field)) {
      value = Array.isArray(value) ? value : linesFrom(value);
    }
    if (field === "planCategory" && !value) value = null;
    if (["semester", "description"].includes(field) && !value) value = null;
    if (["startsAt", "endsAt", "bimestralEvaluationStartAt", "bimestralEvaluationEndAt", "recoveryEvaluationStartAt", "recoveryEvaluationEndAt"].includes(field) && value) value = String(value).slice(0, 10);
    if (["startsAt", "endsAt", "bimestralEvaluationStartAt", "bimestralEvaluationEndAt", "recoveryEvaluationStartAt", "recoveryEvaluationEndAt"].includes(field) && !value) value = null;
    payload[field] = value;
  }
  return payload;
}

$("#catalog-form").onsubmit = async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const values = Object.fromEntries(new FormData(form));
  const kind = values.kind;
  const id = values.catalogId;
  const payload = catalogPayload(kind, values, form.elements.active.checked);
  if (kind === "offerings") {
    if (!payload.learningOutcomes.length) return showAdminMessage("Agregue al menos un resultado de aprendizaje.", true);
    if (!payload.professionalProfileCompetencies.length) return showAdminMessage("Agregue al menos una competencia profesional.", true);
    if (!payload.graduateProfileResults.length) return showAdminMessage("Agregue al menos un resultado del perfil de egreso.", true);
    if (!catalogStructuredState.units.length) return showAdminMessage("Agregue al menos una unidad.", true);
    if (catalogStructuredState.units.some((unit) => !unit.contents.length)) return showAdminMessage("Cada unidad debe tener al menos un contenido o subtema.", true);
  }
  try {
    const result = await authRequest(id ? `/api/admin/catalogs/${kind}/${id}` : `/api/admin/catalogs/${kind}`, {
      method: id ? "PATCH" : "POST",
      body: JSON.stringify(payload),
    });
    let successMessage = id ? "Registro académico actualizado." : "Registro académico creado.";
    if (kind === "offerings" && result.projectSync?.status === "SYNCED") {
      successMessage = "Oferta académica actualizada. El borrador del profesor se sincronizó y deberá revisar nuevamente los datos institucionales.";
    } else if (kind === "offerings" && result.projectSync?.status === "REQUIRE_NEW_VERSION") {
      successMessage = "Oferta académica actualizada. El proyecto ya tiene un Plan Docente o una Guía iniciada; conserva su versión institucional anterior. Cree una nueva versión académica para aplicar el cambio.";
    }
    showAdminMessage(successMessage);
    resetCatalogForm(true);
    await Promise.all([loadAdminDashboard(), loadAcademicCatalog()]);
  } catch (error) { showAdminMessage(error.message, true); }
};

async function submitAcademicOffer(mode) {
  const file = $("#academic-offer-file").files[0];
  const resultBox = $("#academic-offer-result");
  if (!file || !/\.xlsx$/i.test(file.name)) throw new Error("Seleccione un archivo .xlsx basado en la plantilla.");
  const contentBase64 = academicOfferImportState?.file === file
    ? academicOfferImportState.contentBase64
    : await fileToBase64(file);
  const result = await authRequest("/api/admin/academic-offer/import", {
    method: "POST", body: JSON.stringify({ fileName: file.name, contentBase64, mode }),
  });
  academicOfferImportState = { file, contentBase64, validated: true };
  const preview = result.preview;
  resultBox.className = "validation";
  resultBox.innerHTML = `<strong>Archivo válido.</strong> ${preview.offerings} ofertas, ${preview.teachers} docentes, ${preview.assignments} asignaciones, ${preview.learningOutcomes} resultados y ${preview.unitContents} contenidos.${preview.warnings.length ? `<br>Advertencias: ${preview.warnings.map(escapeHtml).join(" · ")}` : ""}`;
  $("#import-academic-offer").disabled = false;
  return result;
}

$("#academic-offer-file").onchange = () => {
  academicOfferImportState = null;
  $("#import-academic-offer").disabled = true;
  $("#academic-offer-result").classList.add("hidden");
};
$("#validate-academic-offer").onclick = async () => {
  try {
    await submitAcademicOffer("VALIDATE");
  } catch (error) {
    const result = $("#academic-offer-result");
    result.className = "validation error";
    result.textContent = error.message;
  }
};
$("#academic-offer-import-form").onsubmit = async (event) => {
  event.preventDefault();
  try {
    if (!academicOfferImportState?.validated) throw new Error("Valide el archivo antes de importarlo.");
    const result = await submitAcademicOffer("IMPORT");
    const credentials = (result.temporaryPasswords || []).map((item) => `${item.email}: ${item.temporaryPassword}`).join("\n");
    if (credentials) showTemporaryPassword("Oferta importada y usuarios creados", credentials, "Entregue las credenciales temporales por un medio seguro.");
    else showAdminMessage("Oferta académica importada correctamente.");
    await Promise.all([loadAdminDashboard(), loadAcademicCatalog()]);
  } catch (error) {
    const result = $("#academic-offer-result");
    result.className = "validation error";
    result.textContent = error.message;
  }
};

$("#catalog-table-body").onclick = async (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  const kind = $("#catalog-kind").value;
  const id = button.dataset.catalogEdit || button.dataset.catalogToggle || button.dataset.catalogDelete;
  const item = catalogItems(kind).find((entry) => entry.id === id);
  if (!item) return;
  if (button.dataset.catalogEdit) {
    fillCatalogForm(kind, item);
    return;
  }
  try {
    if (button.dataset.catalogToggle) {
      await authRequest(`/api/admin/catalogs/${kind}/${id}`, {
        method: "PATCH",
        body: JSON.stringify(catalogPayload(kind, item, !item.active)),
      });
      showAdminMessage(item.active ? "Registro desactivado." : "Registro activado.");
    } else if (button.dataset.catalogDelete) {
      if (!confirm("¿Desea eliminar este registro? Si ya fue utilizado, se desactivará para conservar el historial.")) return;
      const result = await authRequest(`/api/admin/catalogs/${kind}/${id}`, { method: "DELETE" });
      showAdminMessage(result.deleted ? "Registro eliminado." : "El registro tenía historial y fue desactivado.");
    }
    resetCatalogForm(true);
    await Promise.all([loadAdminDashboard(), loadAcademicCatalog()]);
  } catch (error) { showAdminMessage(error.message, true); }
};
$("#admin-user-form").onsubmit = async (event) => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(event.currentTarget));
  if (!values.temporaryPassword) delete values.temporaryPassword;
  try {
    if (values.userId) {
      const userId = values.userId; delete values.userId; delete values.temporaryPassword;
      await authRequest(`/api/admin/users/${userId}`, { method: "PATCH", body: JSON.stringify(values) });
      showAdminMessage("Datos del usuario actualizados.");
    } else {
      delete values.userId;
      const result = await authRequest("/api/admin/users", { method: "POST", body: JSON.stringify(values) });
      showTemporaryPassword("Usuario creado", result.temporaryPassword, "Entregue esta contraseña temporal al nuevo usuario por un medio seguro.");
    }
    resetAdminUserForm(); await loadAdminDashboard();
  } catch (error) { showAdminMessage(error.message, true); }
};
function resetAdminUserForm() {
  $("#admin-user-form").reset(); $("#admin-user-id").value = "";
  $("#admin-user-form-title").textContent = "Crear usuario"; $("#admin-user-submit").textContent = "Crear usuario";
  $("#admin-user-cancel").classList.add("hidden");
}
$("#admin-user-cancel").onclick = resetAdminUserForm;
$("#admin-users-body").onclick = async (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  try {
    if (button.dataset.editUser) {
      const user = adminData.users.find((item) => item.id === button.dataset.editUser);
      const form = $("#admin-user-form");
      form.elements.userId.value = user.id; form.elements.firstName.value = user.firstName;
      form.elements.lastName.value = user.lastName; form.elements.nationalId.value = user.nationalId || "";
      form.elements.email.value = user.email;
      $("#admin-user-role").value = user.roles[0]?.role.code || "";
      $("#admin-user-form-title").textContent = "Editar usuario"; $("#admin-user-submit").textContent = "Guardar cambios";
      $("#admin-user-cancel").classList.remove("hidden"); form.scrollIntoView({ behavior: "smooth" }); return;
    } else if (button.dataset.passwordUser) {
      const result = await authRequest(`/api/admin/users/${button.dataset.passwordUser}/temporary-password`, { method: "POST", body: "{}" });
      showTemporaryPassword("Contraseña temporal asignada", result.temporaryPassword);
    } else if (button.dataset.toggleUser) {
      await authRequest(`/api/admin/users/${button.dataset.toggleUser}`, { method: "PATCH", body: JSON.stringify({ active: button.dataset.active !== "true" }) });
      showAdminMessage("Estado de la cuenta actualizado.");
    }
    await loadAdminDashboard();
  } catch (error) { showAdminMessage(error.message, true); }
};
function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) throw new Error("El CSV no contiene registros.");
  const delimiter = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(delimiter).map((value) => value.trim().toLowerCase());
  const column = (...names) => headers.findIndex((header) => names.includes(header));
  const indices = {
    firstName: column("nombre"), lastName: column("apellido"), nationalId: column("cédula", "cedula"),
    email: column("correo", "email"), role: column("rol", "role"),
  };
  if (Object.values(indices).some((index) => index < 0)) throw new Error("El CSV debe incluir Nombre, Apellido, Cédula, Correo y Rol.");
  return lines.slice(1).map((line) => {
    const cells = line.split(delimiter).map((value) => value.trim().replace(/^"|"$/g, ""));
    return Object.fromEntries(Object.entries(indices).map(([key, index]) => [key, cells[index]]));
  });
}
$("#bulk-user-form").onsubmit = async (event) => {
  event.preventDefault();
  const submittedForm = event.currentTarget;
  try {
    const file = $("#bulk-users-file").files[0];
    const result = await authRequest("/api/admin/users/bulk-file", {
      method: "POST",
      body: JSON.stringify({ fileName: file.name, contentBase64: await fileToBase64(file) }),
    });
    const passwords = result.temporaryPasswords.map((item) => `${item.email}: ${item.temporaryPassword}`).join("\n");
    showTemporaryPassword(`${result.created} usuarios procesados`, passwords, "Copie estas credenciales antes de cerrar la ventana y entréguelas por un medio seguro.");
    submittedForm.reset(); await loadAdminDashboard();
  } catch (error) { showAdminMessage(error.message, true); }
};
$("#assignment-form").onsubmit = async (event) => {
  event.preventDefault();
  const submittedForm = event.currentTarget;
  const values = Object.fromEntries(new FormData(submittedForm));
  if (!values.sourceProjectId) delete values.sourceProjectId;
  try {
    await authRequest("/api/admin/assignments", { method: "POST", body: JSON.stringify(values) });
    showAdminMessage("Asignación guardada correctamente."); submittedForm.reset(); await loadAdminDashboard();
  } catch (error) { showAdminMessage(error.message, true); }
};
$("#knowledge-config-kind").onchange = (event) => {
  configureKnowledgeForm(event.target.value, { reset: true });
};
$("#knowledge-config-selector").onchange = async () => {
  const kind = currentKnowledgeKind();
  const id = $("#knowledge-config-selector").value;
  try {
    await loadKnowledgeRecord(kind, id);
  } catch (error) {
    showValidationModal(error.message, "#knowledge-config-selector");
  }
};
$("#ai-version-list")?.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-knowledge-action]");
  if (!button) return;
  const action = button.dataset.knowledgeAction;
  if (action === "versions") {
    const group = button.dataset.group;
    if (expandedKnowledgeGroups.has(group)) expandedKnowledgeGroups.delete(group);
    else expandedKnowledgeGroups.add(group);
    renderAiVersions();
    return;
  }
  const kind = button.dataset.kind;
  const id = button.dataset.id;
  if (!kind || !id) return;
  try {
    if (action === "open" || action === "new-version") {
      await loadKnowledgeRecord(kind, id, { scroll: true });
      if (action === "new-version") {
        showAdminMessage("La versión seleccionada se usará como base. Revise los cambios, analice el impacto y pulse «Crear nueva versión».");
      }
      return;
    }
    if (action === "archive") {
      openKnowledgeRetireModal(kind, id);
    }
  } catch (error) {
    showValidationModal(error.message, "#ai-version-list");
  }
});
$("#knowledge-config-form").elements.appliesToAll.onchange = (event) => {
  $("#knowledge-config-form [data-shared-scope]").classList.toggle("scope-disabled", event.target.checked && currentKnowledgeKind() === "DOCUMENT");
  resetImpact(currentKnowledgeKind());
};
$("#knowledge-config-form").addEventListener("input", (event) => {
  if (event.target.matches('[data-impact-resolution], [name="impactDecision"], #knowledge-config-kind')) return;
  const kind = currentKnowledgeKind();
  if (impactState[kind]) resetImpact(kind);
});
function suggestedKnowledgeResourceKind(title) {
  const normalized = String(title || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
  if (/\bformato\b/.test(normalized) && /\bplan docente\b/.test(normalized)) return "PLAN_TEMPLATE";
  if (/\bprompt\b/.test(normalized) && /\bplan docente\b/.test(normalized)) return "PLAN_PROMPT";
  if (/\bprompt\b/.test(normalized) && (/\bguia didactica\b/.test(normalized) || /\bprompt de la guia\b/.test(normalized))) return "GUIDE_PROMPT";
  if (/\bespecificacion\b/.test(normalized) && /\brecursos? educativos?\b/.test(normalized) && /\bguia didactica\b/.test(normalized)) return "GUIDE_RESOURCE_SPEC";
  return null;
}

$("#knowledge-impact-button").onclick = async () => {
  const kind = currentKnowledgeKind();
  const form = $("#knowledge-config-form");
  const content = form.elements.content.value;
  if (!form.elements.key.value.trim()) return showValidationModal("Ingrese la clave antes de analizar el impacto.", '#knowledge-config-form [name="key"]');
  if (!form.elements.title.value.trim()) return showValidationModal("Ingrese el título antes de analizar el impacto.", '#knowledge-config-form [name="title"]');
  if (kind === "DOCUMENT") {
    const suggestedKind = suggestedKnowledgeResourceKind(form.elements.title.value);
    if (suggestedKind && suggestedKind !== form.elements.resourceKind.value) {
      return showValidationModal(
        `El título parece corresponder a «${knowledgeResourceLabels[suggestedKind]}», pero el tipo seleccionado es «${knowledgeResourceLabels[form.elements.resourceKind.value] || form.elements.resourceKind.value}». Corrija el tipo de recurso antes de continuar.`,
        '#knowledge-config-form [name="resourceKind"]',
      );
    }
  }
  if (kind === "SPECIFICATION" && !selectedInstructionProcesses(form).length) {
    return showValidationModal("Seleccione al menos un proceso donde aplicará la especificación.", '[data-specification-only]');
  }
  if (content.trim().length < 20) {
    return showValidationModal(
      kind === "DOCUMENT"
        ? "Complete «Texto extraído o síntesis controlada» con al menos 20 caracteres antes de analizar el impacto."
        : "El contenido de la especificación debe tener al menos 20 caracteres antes de analizar el impacto.",
      '#knowledge-config-form [name="content"]',
    );
  }
  const payload = {
    kind,
    key: form.elements.key.value,
    title: form.elements.title.value,
    content,
    ...scopeValues(form),
    ...(kind === "SPECIFICATION" ? { processes: selectedInstructionProcesses(form) } : {}),
    ...(kind === "DOCUMENT" ? {
      appliesToAll: form.elements.appliesToAll.checked,
      resourceKind: form.elements.resourceKind.value,
      appliesToPlan: form.elements.appliesToPlan.checked,
      appliesToGuide: form.elements.appliesToGuide.checked,
      effectiveFrom: form.elements.effectiveFrom.value || null,
      provisional: form.elements.provisional.checked,
    } : {}),
  };
  try {
    const result = await authRequest("/api/admin/ai-impact-analysis", { method: "POST", body: JSON.stringify(payload) });
    impactState[kind] = result;
    const target = $("#knowledge-impact-result");
    target.innerHTML = impactHtml(result.analysis);
    target.classList.remove("hidden");
    const saveButton = $("#knowledge-save-button");
    const versionButton = $("#knowledge-create-version-button");
    if (saveButton && !saveButton.classList.contains("hidden")) saveButton.disabled = false;
    if (versionButton && !versionButton.classList.contains("hidden")) versionButton.disabled = false;
  } catch (error) { showValidationModal(error.message, "#knowledge-impact-button"); }
};
$("#knowledge-config-form").elements.file.onchange = async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  if (/\.(txt|md)$/i.test(file.name)) $("#knowledge-config-content").value = await file.text();
  else if (!/\.(pdf|docx)$/i.test(file.name)) {
    event.target.value = "";
    showValidationModal("Seleccione un archivo PDF, Word, TXT o Markdown.", '#knowledge-config-form [name="file"]');
  }
};
$("#activate-knowledge-version").onclick = async () => {
  const kind = currentKnowledgeKind();
  const id = selectedKnowledgeRecord?.id || $("#knowledge-config-selector").value;
  if (!id) return;
  const endpoint = kind === "DOCUMENT"
    ? `/api/admin/knowledge/${encodeURIComponent(id)}/activate`
    : `/api/admin/instructions/${encodeURIComponent(id)}/activate`;
  try {
    await authRequest(endpoint, { method: "POST", body: "{}" });
    showAdminMessage("La versión seleccionada quedó activa.");
    await loadAdminDashboard();
    await loadKnowledgeRecord(kind, id);
  } catch (error) { showValidationModal(error.message, "#knowledge-config-selector"); }
};

function openKnowledgeRetireModal(kind, id) {
  const item = knowledgeItems(kind).find((entry) => entry.id === id);
  if (!item) return;
  pendingKnowledgeRetirement = { kind, id, confirmWithoutReplacement: false };
  const modal = $("#knowledge-retire-modal");
  const form = $("#knowledge-retire-form");
  $("#knowledge-retire-title").textContent = `Dar de baja: ${item.title} · v${item.version}`;
  $("#knowledge-retire-description").textContent = "El recurso dejará de utilizarse en nuevas generaciones. Los planes y guías históricos conservarán la referencia exacta de esta versión.";
  $("#knowledge-retire-warning").classList.add("hidden");
  $("#knowledge-retire-warning").textContent = "";
  form.reset();
  modal.classList.remove("hidden");
  setTimeout(() => form.elements.reason.focus(), 0);
}
function closeKnowledgeRetireModal() {
  $("#knowledge-retire-modal")?.classList.add("hidden");
  pendingKnowledgeRetirement = null;
}
$("#archive-knowledge-version")?.addEventListener("click", () => {
  if (selectedKnowledgeRecord) openKnowledgeRetireModal(currentKnowledgeKind(), selectedKnowledgeRecord.id);
});
$("#knowledge-retire-close")?.addEventListener("click", closeKnowledgeRetireModal);
$("#knowledge-retire-cancel")?.addEventListener("click", closeKnowledgeRetireModal);
$("#knowledge-retire-modal")?.addEventListener("click", (event) => {
  if (event.target.id === "knowledge-retire-modal") closeKnowledgeRetireModal();
});
$("#knowledge-retire-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!pendingKnowledgeRetirement) return;
  const reason = event.currentTarget.elements.reason.value.trim();
  if (reason.length < 10) {
    $("#knowledge-retire-warning").textContent = "Explique el motivo de la baja con al menos 10 caracteres.";
    $("#knowledge-retire-warning").classList.remove("hidden");
    event.currentTarget.elements.reason.focus();
    return;
  }
  const { kind, id, confirmWithoutReplacement } = pendingKnowledgeRetirement;
  const endpoint = kind === "DOCUMENT"
    ? `/api/admin/knowledge/${encodeURIComponent(id)}/archive`
    : `/api/admin/instructions/${encodeURIComponent(id)}/archive`;
  try {
    await authRequest(endpoint, {
      method: "POST",
      body: JSON.stringify({ reason, confirmWithoutReplacement }),
    });
    closeKnowledgeRetireModal();
    showAdminMessage("La versión fue dada de baja. Se conserva en el historial y ya no se usará en nuevas generaciones.");
    configureKnowledgeForm(kind, { reset: true });
    await loadAdminDashboard();
  } catch (error) {
    const warning = $("#knowledge-retire-warning");
    warning.textContent = error.message;
    warning.classList.remove("hidden");
    if (error.code === "CONFIRM_WITHOUT_REPLACEMENT") {
      pendingKnowledgeRetirement.confirmWithoutReplacement = true;
      event.currentTarget.querySelector('button[type="submit"]').textContent = "Confirmar baja de todas formas";
    }
  }
});
$("#indicator-stage-filter").onchange = renderIndicators;
$("#new-indicator").onclick = () => {
  $("#indicator-editor").reset();
  $("#indicator-editor").elements.id.value = "";
  $("#indicator-editor-title").textContent = "Crear nuevo indicador";
  $("#indicator-editor").classList.remove("hidden");
};
$("#cancel-indicator").onclick = () => $("#indicator-editor").classList.add("hidden");
$("#indicator-editor").onsubmit = async (event) => {
  event.preventDefault();
  const submittedForm = event.currentTarget;
  const values = Object.fromEntries(new FormData(submittedForm));
  const id = values.id; delete values.id;
  values.stage = $("#indicator-stage-filter").value;
  values.score = Number(values.score);
  try {
    await authRequest(id ? `/api/admin/indicators/${id}` : "/api/admin/indicators", { method: id ? "PATCH" : "POST", body: JSON.stringify(values) });
    showAdminMessage("Indicador guardado y puntuaciones redistribuidas."); submittedForm.classList.add("hidden"); await loadAdminDashboard();
  } catch (error) { showAdminMessage(error.message, true); }
};
$("#indicator-table-body").onclick = async (event) => {
  const button = event.target.closest("[data-indicator-action]");
  if (!button) return;
  const id = button.closest("tr").dataset.id;
  const item = activeIndicatorVersion().indicators.find((entry) => entry.id === id);
  if (!item) return;
  if (button.dataset.indicatorAction === "edit") {
    const form = $("#indicator-editor"); form.elements.id.value = item.id; form.elements.name.value = item.name || item.code;
    form.elements.description.value = item.description; form.elements.score.value = Number(item.score).toFixed(2);
    $("#indicator-editor-title").textContent = "Actualizar indicador"; form.classList.remove("hidden"); return;
  }
  try {
    if (button.dataset.indicatorAction === "delete") {
      if (!confirm("El indicador se retirará de la nueva versión. Las evaluaciones anteriores conservarán sus datos. ¿Desea continuar?")) return;
      await authRequest(`/api/admin/indicators/${id}`, { method: "DELETE" });
      showAdminMessage("Indicador eliminado de la nueva versión.");
    } else {
      await authRequest(`/api/admin/indicators/${id}`, { method: "PATCH", body: JSON.stringify({
        name: item.name || item.code, description: item.description, stage: item.stage,
        score: Number(item.score), active: !item.active,
      }) });
      showAdminMessage(item.active ? "Indicador deshabilitado." : "Indicador habilitado.");
    }
    await loadAdminDashboard();
  } catch (error) { showAdminMessage(error.message, true); }
};
$("#load-checklist").onclick = async () => {
  try {
    const projectId = $("#checklist-project").value; const stage = $("#checklist-stage").value;
    if (!projectId) throw new Error("Seleccione una guía.");
    const data = await authRequest(`/api/admin/projects/${projectId}/checklist?stage=${stage}`);
    $("#checklist-form").dataset.reviewId = data.review.id;
    $("#checklist-items").innerHTML = data.review.items.map((item) => `<div class="checklist-row" data-item-id="${item.id}" data-score="${Number(item.indicator.score)}"><div><strong>${escapeHtml(item.indicator.name || item.indicator.code)} · ${Number(item.indicator.score).toFixed(2)} puntos</strong><small>${escapeHtml(item.indicator.description)}</small></div><select name="result"><option value="PENDING" ${item.result === "PENDING" ? "selected" : ""}>Pendiente</option><option value="COMPLIES" ${item.result === "COMPLIES" ? "selected" : ""}>Cumple</option><option value="COMPLIES_PARTIALLY" ${item.result === "COMPLIES_PARTIALLY" ? "selected" : ""}>Cumple parcialmente</option><option value="DOES_NOT_COMPLY" ${item.result === "DOES_NOT_COMPLY" ? "selected" : ""}>No cumple</option><option value="NOT_APPLICABLE" ${item.result === "NOT_APPLICABLE" ? "selected" : ""}>No aplica</option></select><textarea name="observation" placeholder="Observación">${escapeHtml(item.observation || "")}</textarea></div>`).join("");
    updateChecklistScore();
    $("#checklist-form").elements.generalObservation.value = data.review.generalObservation || "";
    $("#checklist-form").classList.remove("hidden");
  } catch (error) { showAdminMessage(error.message, true); }
};
function updateChecklistScore() {
  const rows = [...$("#checklist-items").querySelectorAll(".checklist-row")];
  let earned = 0; let possible = 0;
  rows.forEach((row) => {
    const score = Number(row.dataset.score); const result = row.querySelector('[name="result"]').value;
    if (result !== "NOT_APPLICABLE") possible += score;
    if (result === "COMPLIES") earned += score;
    if (result === "COMPLIES_PARTIALLY") earned += score * 0.5;
  });
  const percentage = possible ? earned / possible * 100 : 0;
  const category = percentage >= 90 ? "Excelente" : percentage >= 80 ? "Satisfactoria" : percentage >= 70 ? "En proceso de mejora" : "Insuficiente";
  $("#checklist-score").innerHTML = `<strong>${percentage.toFixed(2)} % · ${category}</strong><span>${earned.toFixed(2)} de ${possible.toFixed(2)} puntos aplicables</span>`;
}
$("#checklist-items").onchange = (event) => { if (event.target.matches('[name="result"]')) updateChecklistScore(); };
$("#checklist-form").onsubmit = async (event) => {
  event.preventDefault();
  const decision = event.submitter?.value || "DRAFT";
  const items = [...$("#checklist-items").querySelectorAll(".checklist-row")].map((row) => ({ id: row.dataset.itemId, result: row.querySelector('[name="result"]').value, observation: row.querySelector('[name="observation"]').value }));
  try {
    const response = await authRequest(`/api/admin/checklists/${event.currentTarget.dataset.reviewId}`, { method: "PATCH", body: JSON.stringify({ decision, generalObservation: event.currentTarget.elements.generalObservation.value, items }) });
    showAdminMessage(`${decision === "APPROVED" ? "Lista de cotejo aprobada" : "Lista de cotejo guardada"}: ${response.scoring.percentage.toFixed(2)} % · ${response.scoring.category}.`);
  } catch (error) { showAdminMessage(error.message, true); }
};
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = reject; reader.readAsDataURL(file);
  });
}
$("#knowledge-config-form").onsubmit = async (event) => {
  event.preventDefault();
  const submittedForm = event.currentTarget;
  const kind = currentKnowledgeKind();
  const state = impactState[kind];
  if (!state) return showValidationModal("Analice el impacto antes de guardar.", "#knowledge-impact-button");
  const conflictDecision = submittedForm.querySelector('[name="impactDecision"]:checked')?.value;
  if (state.analysis?.contradictions?.length && !conflictDecision) {
    return showValidationModal("Seleccione una decisión para resolver el conflicto antes de guardar.", '#knowledge-impact-result [name="impactDecision"]');
  }

  const selected = selectedKnowledgeRecord;
  const requestedAction = event.submitter?.id === "knowledge-create-version-button" ? "NEW_VERSION" : "SAVE";
  const editExisting = Boolean(selected) && requestedAction === "SAVE";
  const createVersion = Boolean(selected) && requestedAction === "NEW_VERSION";
  const activate = editExisting
    ? selected.status === "ACTIVE"
    : conflictDecision === "KEEP_CURRENT" || conflictDecision === "DO_NOT_ACTIVATE"
      ? false
      : submittedForm.elements.activate.checked;
  const common = {
    key: submittedForm.elements.key.value,
    title: submittedForm.elements.title.value,
    priority: Number(submittedForm.elements.priority.value),
    activate,
    ...scopeValues(submittedForm),
    ...(kind === "SPECIFICATION" ? { processes: selectedInstructionProcesses(submittedForm) } : {}),
    impactChecksum: state.impactChecksum,
    conflictResolution: submittedForm.querySelector("[data-impact-resolution]")?.value || "",
    conflictDecision,
    ...(createVersion ? { sourceId: selected.id } : {}),
  };

  try {
    let result;
    if (kind === "SPECIFICATION") {
      const body = JSON.stringify({ ...common, content: submittedForm.elements.content.value });
      result = await authRequest(
        editExisting ? `/api/admin/instructions/${encodeURIComponent(selected.id)}` : "/api/admin/instructions",
        { method: editExisting ? "PATCH" : "POST", body },
      );
      showAdminMessage(editExisting
        ? "Configuración de la especificación actualizada sin crear otra versión."
        : createVersion
          ? "Nueva versión de la especificación creada."
          : "Especificación creada correctamente.");
    } else {
      const file = submittedForm.elements.file.files[0];
      const values = {
        ...common,
        contentMarkdown: submittedForm.elements.content.value,
        appliesToAll: submittedForm.elements.appliesToAll.checked,
        resourceKind: submittedForm.elements.resourceKind.value,
        appliesToPlan: submittedForm.elements.appliesToPlan.checked,
        appliesToGuide: submittedForm.elements.appliesToGuide.checked,
        effectiveFrom: submittedForm.elements.effectiveFrom.value || null,
        provisional: submittedForm.elements.provisional.checked,
      };
      if (file) {
        values.fileName = file.name;
        values.mimeType = file.type || (file.name.toLowerCase().endsWith(".md")
          ? "text/markdown"
          : file.name.toLowerCase().endsWith(".pdf")
            ? "application/pdf"
            : file.name.toLowerCase().endsWith(".docx")
              ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              : "text/plain");
        values.contentBase64 = await fileToBase64(file);
      }
      result = await authRequest(
        editExisting ? `/api/admin/knowledge/${encodeURIComponent(selected.id)}` : "/api/admin/knowledge",
        { method: editExisting ? "PATCH" : "POST", body: JSON.stringify(values) },
      );
      showAdminMessage(editExisting
        ? "Configuración del documento actualizada sin crear otra versión."
        : createVersion
          ? "Nueva versión del documento creada."
          : "Documento creado correctamente.");
    }

    await loadAdminDashboard();
    const saved = result?.document || result?.instruction;
    if (saved?.id) await loadKnowledgeRecord(kind, saved.id);
    else configureKnowledgeForm(kind, { reset: true });
  } catch (error) {
    showValidationModal(error.message, "#knowledge-config-form");
  }
};
