const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
let authenticatedUserData = null;
const impactState = { SPECIFICATION: null, DOCUMENT: null };
const commaValues = (value) => String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
const durationValues = (value) => commaValues(value).map(Number).filter((item) => Number.isInteger(item) && item > 0);
const scopeValues = (form) => ({
  academicLevels: commaValues(form.elements.academicLevels?.value),
  modalities: commaValues(form.elements.modalities?.value),
  durations: durationValues(form.elements.durations?.value),
  subjectTypes: commaValues(form.elements.subjectTypes?.value),
  priority: Number(form.elements.priority?.value || 100),
});
function setScopeValues(form, item) {
  form.elements.academicLevels.value = (item.academicLevels || []).join(", ");
  form.elements.modalities.value = (item.modalities || []).join(", ");
  form.elements.durations.value = (item.durations || []).join(", ");
  form.elements.subjectTypes.value = (item.subjectTypes || []).join(", ");
  form.elements.priority.value = item.priority ?? 100;
}
function resetImpact(kind) {
  impactState[kind] = null;
  const form = kind === "SPECIFICATION" ? $("#instruction-form") : $("#knowledge-form");
  form.querySelector('button[type="submit"]').disabled = true;
  $(`[data-impact-result="${kind}"]`).classList.add("hidden");
}
function impactHtml(analysis) {
  const conflicts = analysis.contradictions?.length
    ? `<h4>Aspectos que requieren revisión</h4><ul>${analysis.contradictions.map((item) =>
      `<li><strong>${escapeHtml(item.topic)}:</strong> ${escapeHtml(item.recommendation)}</li>`).join("")}</ul>
      <label>Decisión adoptada antes de activar<textarea data-impact-resolution required minlength="10" placeholder="Indique qué regla prevalece o cómo se resolvió la posible contradicción."></textarea></label>`
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
  if (!response.ok) throw new Error(payload.error || "No fue posible completar la solicitud.");
  return payload;
}
function showAuthenticatedUser(user) {
  authenticatedUserData = user;
  $("#auth-layer").classList.add("hidden");
  $("#profile-name").textContent = user.displayName;
  $("#profile-role").textContent = user.roles.includes("ADMIN") ? "Administrador" : "Profesor";
  $("#profile-initials").textContent = `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase() || "U";
  $("#nav-admin").classList.toggle("hidden", !user.roles.includes("ADMIN"));
  loadProjects();
}
$$("[data-auth-tab]").forEach((button) => {
  button.onclick = () => {
    $$("[data-auth-tab]").forEach((item) => item.classList.toggle("active", item === button));
    $("#login-form").classList.toggle("hidden", button.dataset.authTab !== "login");
    $("#register-form").classList.toggle("hidden", button.dataset.authTab !== "register");
    $("#auth-message").classList.add("hidden");
  };
});
$("#login-form").onsubmit = async (event) => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(event.currentTarget));
  try {
    await authRequest("/api/auth/login", { method: "POST", body: JSON.stringify(values) });
    const { user } = await authRequest("/api/auth/me");
    showAuthenticatedUser(user);
  } catch (error) {
    $("#auth-message").textContent = error.message;
    $("#auth-message").classList.remove("hidden");
  }
};
$("#register-form").onsubmit = async (event) => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(event.currentTarget));
  try {
    await authRequest("/api/auth/register", { method: "POST", body: JSON.stringify(values) });
    $("[data-auth-tab=login]").click();
    $("#login-form [name=email]").value = values.email;
    $("#auth-message").textContent = "Cuenta creada con rol Profesor. Ya puede iniciar sesión.";
    $("#auth-message").classList.remove("hidden");
  } catch (error) {
    $("#auth-message").textContent = error.message;
    $("#auth-message").classList.remove("hidden");
  }
};
$("#logout").onclick = async () => {
  await authRequest("/api/auth/logout", { method: "POST", body: "{}" });
  localStorage.removeItem("ggd-project-v2");
  location.reload();
};
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
const offer = window.ACADEMIC_OFFER || {};
const level = $("#level");
const modality = $("#modality");
const faculty = $("#faculty");
const career = $("#career");

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
  }));
  scheduleDatabaseSync();
}
function applySavedProject(saved) {
  if (!saved) return false;
  projectId = saved.projectId || "";
  matrixFileName = saved.matrixFileName || "";
  const savedForm = saved.formData || {};
  if (savedForm.level) {
    level.value = savedForm.level;
    fillSelect(modality, Object.keys(offer[savedForm.level] || {}), "Seleccione una modalidad");
  }
  if (savedForm.modality) {
    modality.value = savedForm.modality;
    fillSelect(faculty, Object.keys(offer[savedForm.level]?.[savedForm.modality] || {}), "Seleccione una facultad o unidad");
  }
  if (savedForm.faculty) {
    faculty.value = savedForm.faculty;
    fillSelect(career, offer[savedForm.level]?.[savedForm.modality]?.[savedForm.faculty] || [], "Seleccione una carrera o programa");
  }
  Object.entries(savedForm).forEach(([name, value]) => {
    const field = form.elements[name];
    if (field && typeof field.value !== "undefined") field.value = value;
  });
  matrixRows = Array.isArray(saved.matrixRows) ? saved.matrixRows : [];
  currentWeek = Number(saved.currentWeek) || 1;
  weekStates = saved.weekStates || {};
  if (matrixRows.length && Object.keys(weekStates).length) step = 5;
  if (matrixFileName) $("#file-name").textContent = matrixFileName;
  return true;
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
      modality: project.modality,
      academicPeriod: project.academicPeriod,
      weeks: Number(project.weeks),
    },
    bibliography: {
      basic: project.basic,
      complementary: project.complementary,
      rea: project.rea || "",
    },
    matrixFileName: matrixFile?.name || matrixFileName,
    matrixRows,
    weekStates,
  };
}
function canSyncDatabase() {
  const payload = databasePayload();
  return payload.matrixRows.length > 0 &&
    payload.project.weeks > 0 &&
    Object.values(payload.project).every((value) => String(value || "").trim()) &&
    payload.bibliography.basic?.trim() &&
    payload.bibliography.complementary?.trim();
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
function projectCard(project) {
  const completed = project.status === "COMPLETED";
  return `<article class="saved-project">
    <div class="saved-project-main">
      <div class="saved-project-title">
        <span class="status-badge status-${project.status.toLowerCase()}">${statusLabels[project.status] || project.status}</span>
        <h3>${escapeHtml(project.subjectName)}</h3>
      </div>
      <p class="project-code">${escapeHtml(project.subjectCode || "Sin código")} · ${escapeHtml(project.projectName)}</p>
      <dl>
        <div><dt>Profesor</dt><dd>${escapeHtml(project.professorName || "No registrado")}</dd></div>
        <div><dt>Carrera</dt><dd>${escapeHtml(project.career)}</dd></div>
        <div><dt>Progreso</dt><dd>${project.approvedWeeks} de ${project.totalWeeks} semanas</dd></div>
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
      : `<div class="projects-empty"><strong>No se encontraron proyectos.</strong><span>${search ? "Pruebe con otro profesor, asignatura o código." : "Cree el primero con «Nuevo proyecto»."}</span></div>`;
  } catch (error) {
    list.innerHTML = `<p class="projects-empty error">${escapeHtml(error.message)}</p>`;
  }
}
async function openSavedProject(id) {
  const response = await fetch(`/api/projects/${encodeURIComponent(id)}`, { cache: "no-store" });
  const payload = await response.json();
  if (!response.ok || !payload.project) throw new Error(payload.error || "No fue posible abrir el proyecto.");
  form.reset();
  if (authenticatedUserData?.roles?.includes("TEACHER") && form.elements.professorName) {
    form.elements.professorName.value = authenticatedUserData.displayName || "";
  }
  if (!applySavedProject(payload.project)) return;
  localStorage.setItem(storageKey, JSON.stringify(payload.project));
  step = 5;
  openWizard();
  updateWeekInterface();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}
function inlineMarkdownToHtml(value) {
  return escapeHtml(value)
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
    const image = line.match(/^!\[([^\]]*)\]\((\/api\/generated-images\/[0-9a-f-]{36}|data:image\/[^)]+|https?:\/\/[^)]+)\)$/i);
    if (image) {
      closeList();
      html.push(`<figure class="generated-figure"><img src="${escapeHtml(image[2])}" alt="${escapeHtml(image[1])}" loading="lazy"><figcaption>${escapeHtml(image[1])}</figcaption></figure>`);
      continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      closeList();
      const level = heading[1].length === 1 ? 2 : 3;
      html.push(`<h${level}>${inlineMarkdownToHtml(heading[2])}</h${level}>`);
      continue;
    }
    const nextLine = String(lines[index + 1] || "").trim();
    if (line.includes("|") && isTableSeparator(nextLine)) {
      closeList();
      tableNumber += 1;
      let previousIndex = index - 1;
      while (previousIndex >= 0 && !String(lines[previousIndex] || "").trim()) previousIndex -= 1;
      const previousLine = String(lines[previousIndex] || "").trim();
      if (!/^(?:\*\*)?tabla\s+\d+/i.test(previousLine)) {
        html.push(`<p class="table-caption"><strong>Tabla ${tableNumber}</strong></p>`);
      }
      const headers = tableCells(line);
      index += 2;
      const rows = [];
      while (index < lines.length && String(lines[index] || "").includes("|")) {
        rows.push(tableCells(lines[index]));
        index += 1;
      }
      index -= 1;
      html.push('<div class="generated-table-wrapper"><table class="generated-table"><thead><tr>');
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
    if (tag === "figure") {
      const image = node.querySelector("img");
      if (image) blocks.push(`![${image.getAttribute("alt") || "Imagen educativa"}](${image.getAttribute("src") || ""})`);
    }
    else if (tag === "div" && node.classList.contains("generated-table-wrapper")) {
      const table = node.querySelector("table");
      if (table) {
        const rows = [...table.rows].map((row) => [...row.cells].map((cell) => inlineHtmlToMarkdown(cell).trim()));
        if (rows.length) {
          blocks.push(`| ${rows[0].join(" | ")} |\n| ${rows[0].map(() => "---").join(" | ")} |${rows.slice(1).map((row) => `\n| ${row.join(" | ")} |`).join("")}`);
        }
      }
    }
    else if (tag === "h1" || tag === "h2") blocks.push(`## ${inlineHtmlToMarkdown(node)}`);
    else if (tag === "h3") blocks.push(`### ${inlineHtmlToMarkdown(node)}`);
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
function renderStep() {
  $$(".panel").forEach((panel) => panel.classList.toggle("active", Number(panel.dataset.step) === step));
  $$("#steps span").forEach((item, index) => item.classList.toggle("active", index < step));
  back.classList.toggle("hidden", step === 1);
  next.classList.toggle("hidden", step === 5);
  showMessage();
}
function openWizard() {
  layer.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  renderStep();
}
function startNewProject() {
  clearTimeout(syncTimer);
  syncTimer = null;
  projectId = "";
  step = 1;
  matrixFile = null;
  matrixRows = [];
  currentWeek = 1;
  weekStates = {};
  selectedAdjustmentFiles = [];
  matrixFileName = "";
  form.reset();
  fillSelect(level, Object.keys(offer), "Seleccione un nivel");
  resetAcademicFields("level");
  const fileName = $("#file-name");
  const matrixResult = $("#matrix-result");
  const confirmData = $("#confirm-data");
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
  localStorage.removeItem(storageKey);
  openWizard();
}
function closeWizard() {
  layer.classList.add("hidden");
  document.body.style.overflow = "";
}
$("#new-project").onclick = startNewProject;
$("#close-wizard").onclick = closeWizard;
$("#projects-list").addEventListener("click", (event) => {
  const button = event.target.closest("[data-open-project]");
  if (!button) return;
  button.disabled = true;
  openSavedProject(button.dataset.openProject).catch((error) => {
    button.disabled = false;
    alert(error.message);
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
  $("#projects-list").innerHTML = '<div class="projects-empty"><strong>Ayuda</strong><span>Para crear una guía, seleccione «Nuevo proyecto». Para retomar una guía, búsquela y pulse «Continuar».</span></div>';
};
back.onclick = () => {
  if (step > 1) {
    step -= 1;
    renderStep();
  }
};
const data = () => Object.fromEntries(new FormData(form).entries());
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
    ["Código", project.subjectCode], ["Asignatura", project.subjectName], ["Tipo", project.subjectType],
    ["Periodo", project.academicPeriod], ["Duración", `${project.weeks} semanas`],
    ["Matriz", matrixFile?.name || matrixFileName], ["Registros", matrixRows.length],
  ].map(([key, value]) => `<div><small>${key}</small><strong>${escapeHtml(value || "—")}</strong></div>`).join("");
}
next.onclick = async () => {
  if (step === 1) {
    if (invalidFields(["projectName", "level", "modality", "faculty", "career", "professorName", "subjectCode", "subjectName", "subjectType", "academicPeriod", "weeks"]).length) {
      return showMessage("Complete todos los campos obligatorios para continuar.");
    }
    if (!Number.isInteger(totalWeeks()) || totalWeeks() < 1) return showMessage("Ingrese un número entero de semanas mayor que cero.");
    step = 2;
  } else if (step === 2) {
    if (!matrixRows.length) return showMessage("Cargue y valide una matriz antes de continuar.");
    const matrixError = validateMatrixWeeks(matrixRows, totalWeeks());
    if (matrixError) return showMessage(matrixError);
    step = 3;
  } else if (step === 3) {
    const project = data();
    if (!project.basic?.trim() || !project.complementary?.trim()) return showMessage("Registre la bibliografía básica y complementaria.");
    const bibliography = `${project.basic} ${project.complementary} ${project.rea}`.toLowerCase();
    if (bibliography.includes("guía didáctica") || bibliography.includes("guia didactica")) return showMessage("Retire la guía didáctica de las fuentes bibliográficas.");
    summarize();
    step = 4;
  } else if (step === 4) {
    if (!$("#confirm-data").checked) return showMessage("Confirme la correspondencia de los datos antes de crear el proyecto.");
    step = 5;
    persistProject();
    updateWeekInterface();
  }
  renderStep();
};

const fileInput = $("#matrix-file");
const drop = $("#dropzone");
fileInput.onchange = () => validateFile(fileInput.files[0]);
["dragenter", "dragover"].forEach((eventName) => drop.addEventListener(eventName, (event) => {
  event.preventDefault();
  drop.classList.add("drag");
}));
["dragleave", "drop"].forEach((eventName) => drop.addEventListener(eventName, (event) => {
  event.preventDefault();
  drop.classList.remove("drag");
}));
drop.addEventListener("drop", (event) => {
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
      academicPeriod: project.academicPeriod, weeks: Number(project.weeks),
    },
    matrixRows,
    bibliography: {
      basic: project.basic, complementary: project.complementary, rea: project.rea || "",
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
  status.textContent = approved ? `Semana ${currentWeek} aprobada (versión ${state.version})`
    : state.status === "review" ? `Semana ${currentWeek} requiere nueva revisión`
      : displayContent ? `Semana ${currentWeek} pendiente de aprobación` : "Semana pendiente de generación";
  status.classList.toggle("approved", approved);
  $("#generation-output").contentEditable = String(!approved);
  $("#modify-week").classList.toggle("hidden", !approved);
  $("#regenerate-with-instructions").classList.toggle("hidden", approved);
  $("#approve-week").classList.toggle("hidden", approved);
  $("#generate-week").classList.toggle("hidden", Boolean(displayContent));
  renderWeekTabs();
  const approvedCount = consecutiveApprovedWeeks();
  $("#download-word").disabled = approvedCount === 0;
  $("#download-word").textContent = approvedCount === totalWeeks() ? "Descargar guía completa" : `Descargar avance (semanas 1–${approvedCount})`;
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
  setText("#visual-type", editableProposal.type);
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
        assembled += `\n\n### ${resource.title}\n\n${resource.content}\n`;
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
    $("#review-status").textContent = `Semana ${currentWeek} pendiente de aprobación`;
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
    $("#generation-error").textContent = "No se puede aprobar una semana sin contenido.";
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
    $("#review-status").textContent = "Guía completada y guardada: todas las semanas fueron aprobadas";
    try {
      clearTimeout(syncTimer);
      await syncDatabase();
      const downloadNow = window.confirm(
        "La guía didáctica se ha completado y guardado correctamente.\n\n¿Desea descargar la guía completa ahora?",
      );
      if (downloadNow) $("#download-word").click();
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

$("#download-word").onclick = async () => {
  const count = consecutiveApprovedWeeks();
  if (!count) return;
  const button = $("#download-word");
  button.disabled = true;
  try {
    const project = data();
    const response = await fetch("/api/download-word", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project: {
          projectName: project.projectName, subjectName: project.subjectName,
          career: project.career, modality: project.modality,
          academicPeriod: project.academicPeriod, totalWeeks: totalWeeks(),
        },
        weeks: Array.from({ length: count }, (_, index) => ({
          week: index + 1, content: weekState(index + 1).approvedContent,
        })),
      }),
    });
    if (!response.ok) {
      const payload = await response.json();
      throw new Error(payload.error || "No fue posible generar el documento.");
    }
    const blob = await response.blob();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${project.subjectName || "guia-didactica"}-${count === totalWeeks() ? "completa" : `avance-semana-${count}`}.docx`;
    link.click();
    URL.revokeObjectURL(link.href);
  } catch (error) {
    $("#generation-error").textContent = error.message;
    $("#generation-error").classList.remove("hidden");
  } finally {
    button.disabled = false;
  }
};

form.addEventListener("input", () => {
  if (step === 5) persistProject();
});
restoreProject().finally(() => {
  if (matrixRows.length && totalWeeks()) updateWeekInterface();
});
authRequest("/api/auth/me").then(({ user }) => {
  if (user) showAuthenticatedUser(user);
}).catch(console.error);

let adminData = null;
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
function selectedValues(select) {
  return [...select.selectedOptions].map((option) => option.value);
}
function roleNames(user) {
  return user.roles.map((entry) => entry.role.name).join(", ");
}
function renderAdminUsers() {
  if (!adminData) return;
  const query = ($("#admin-user-search").value || "").toLowerCase();
  const users = adminData.users.filter((user) =>
    `${user.firstName} ${user.lastName} ${user.nationalId || ""} ${user.email}`.toLowerCase().includes(query));
  $("#admin-users-body").innerHTML = users.map((user) => `
    <tr>
      <td><strong>${escapeHtml(`${user.firstName} ${user.lastName}`)}</strong>${user.mustChangePassword ? "<small>Debe cambiar la contraseña</small>" : ""}</td>
      <td>${escapeHtml(user.nationalId || "—")}</td><td>${escapeHtml(user.email)}</td>
      <td><select class="table-role" multiple data-user-roles="${user.id}">${adminData.roles.map((role) =>
        `<option value="${role.code}" ${user.roles.some((item) => item.role.code === role.code) ? "selected" : ""}>${escapeHtml(role.name)}</option>`).join("")}</select></td>
      <td><span class="status-badge ${user.active ? "status-completed" : "status-draft"}">${user.active ? "Activa" : "Inactiva"}</span></td>
      <td class="table-actions"><button type="button" data-edit-user="${user.id}">Editar datos</button><button type="button" data-save-user="${user.id}">Guardar roles</button><button type="button" data-password-user="${user.id}">Contraseña temporal</button><button type="button" data-toggle-user="${user.id}" data-active="${user.active}">${user.active ? "Desactivar" : "Activar"}</button></td>
    </tr>`).join("") || `<tr><td colspan="6">No se encontraron usuarios.</td></tr>`;
}
function renderAssignments() {
  if (!adminData) return;
  const teachers = adminData.users.filter((user) => user.active && user.roles.some((entry) => entry.role.code === "TEACHER"));
  $("#assignment-teacher").innerHTML = `<option value="">Seleccione un profesor</option>${teachers.map((user) =>
    `<option value="${user.id}">${escapeHtml(`${user.firstName} ${user.lastName} — ${user.email}`)}</option>`).join("")}`;
  $("#assignment-source").innerHTML = `<option value="">Crear guía nueva</option>${adminData.projects.filter((project) => project.status === "COMPLETED").map((project) =>
    `<option value="${project.id}">${escapeHtml(`${project.subjectCode} — ${project.subjectName} (${project.academicPeriod})`)}</option>`).join("")}`;
  const careers = new Set(adminData.courses.map((course) => course.career));
  Object.values(window.ACADEMIC_OFFER || {}).forEach((modalities) => Object.values(modalities).forEach((faculties) =>
    Object.values(faculties).forEach((items) => items.forEach((career) => careers.add(career)))));
  $("#assignment-career").innerHTML = `<option value="">Seleccione una carrera</option>${[...careers].sort().map((career) => `<option>${escapeHtml(career)}</option>`).join("")}`;
  $("#assignment-period").innerHTML = `<option value="">Seleccione un periodo</option>${adminData.periods.map((period) => `<option value="${period.id}">${escapeHtml(period.name)}</option>`).join("")}`;
  renderAssignmentCourses();
  $("#assignment-list").innerHTML = adminData.assignments.map((item) => `
    <article><strong>${escapeHtml(item.course.code)} — ${escapeHtml(item.course.name)}</strong><span>${escapeHtml(item.teacher.displayName)} · ${escapeHtml(item.period.name)}</span><span class="status-badge ${item.active ? "status-completed" : "status-draft"}">${item.active ? "Vigente" : "Inactiva"}</span></article>`).join("") || "<p>No existen asignaciones.</p>";
}
function renderAssignmentCourses() {
  if (!adminData) return;
  const career = $("#assignment-career").value;
  const courses = adminData.courses.filter((course) => course.career === career && course.active);
  $("#assignment-course").innerHTML = career
    ? `<option value="">Seleccione una asignatura</option>${courses.map((course) => `<option value="${course.id}">${escapeHtml(`${course.code} — ${course.name}`)}</option>`).join("")}<option value="NEW">Registrar asignatura nueva</option>`
    : `<option value="">Seleccione primero una carrera</option>`;
  toggleNewCourseFields();
}
function toggleNewCourseFields() {
  const isNew = $("#assignment-course").value === "NEW";
  ["#new-course-code-wrap", "#new-course-name-wrap"].forEach((selector) => $(selector).classList.toggle("hidden", !isNew));
  $("#assignment-code").required = isNew;
  $("#assignment-name").required = isNew;
}
function renderAiVersions() {
  if (!adminData) return;
  const rows = [
    ...adminData.instructions.map((item) => ({ type: "Instrucción", ...item })),
    ...adminData.documents.map((item) => ({ type: "Conocimiento", ...item })),
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  $("#ai-version-list").innerHTML = rows.map((item) => `
    <article><strong>${escapeHtml(item.title)}</strong><span>${item.type} · clave ${escapeHtml(item.key)} · versión ${item.version}${item.type === "Conocimiento" ? ` · prioridad ${item.priority ?? 100}` : ""}</span><span class="status-badge ${item.status === "ACTIVE" ? "status-completed" : "status-draft"}">${item.status}</span></article>`).join("") || "<p>No existen versiones registradas.</p>";
  $("#instruction-selector").innerHTML = `<option value="">Nueva instrucción</option>${adminData.instructions.map((item) => `<option value="${item.id}">${escapeHtml(`${item.title} · v${item.version} · ${item.status}`)}</option>`).join("")}`;
  $("#knowledge-selector").innerHTML = `<option value="">Nuevo archivo</option>${adminData.documents.map((item) => `<option value="${item.id}">${escapeHtml(`${item.title} · v${item.version} · ${item.status}`)}</option>`).join("")}`;
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
    <td><div class="table-actions"><button type="button" data-indicator-action="edit">Actualizar</button><button type="button" data-indicator-action="toggle">${item.active ? "Deshabilitar" : "Habilitar"}</button><button type="button" data-indicator-action="delete">Eliminar</button></div></td></tr>`).join("")
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
async function loadAdminDashboard() {
  adminData = await authRequest("/api/admin/dashboard");
  $("#admin-user-roles").innerHTML = adminData.roles.map((role) => `<option value="${role.code}">${escapeHtml(role.name)}</option>`).join("");
  renderAdminUsers(); renderAssignments(); renderAiVersions(); renderGuideReport();
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
$("#guide-report-search").oninput = renderGuideReport;
$("#admin-user-form").onsubmit = async (event) => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(event.currentTarget));
  values.roleCodes = selectedValues($("#admin-user-roles"));
  if (!values.temporaryPassword) delete values.temporaryPassword;
  try {
    if (values.userId) {
      const userId = values.userId; delete values.userId; delete values.temporaryPassword;
      await authRequest(`/api/admin/users/${userId}`, { method: "PATCH", body: JSON.stringify(values) });
      showAdminMessage("Datos del usuario actualizados.");
    } else {
      delete values.userId;
      const result = await authRequest("/api/admin/users", { method: "POST", body: JSON.stringify(values) });
      showAdminMessage(`Usuario creado. Contraseña temporal: ${result.temporaryPassword}`);
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
      [...$("#admin-user-roles").options].forEach((option) => option.selected = user.roles.some((item) => item.role.code === option.value));
      $("#admin-user-form-title").textContent = "Editar usuario"; $("#admin-user-submit").textContent = "Guardar cambios";
      $("#admin-user-cancel").classList.remove("hidden"); form.scrollIntoView({ behavior: "smooth" }); return;
    } else if (button.dataset.saveUser) {
      const select = $(`[data-user-roles="${button.dataset.saveUser}"]`);
      await authRequest(`/api/admin/users/${button.dataset.saveUser}`, { method: "PATCH", body: JSON.stringify({ roleCodes: selectedValues(select) }) });
      showAdminMessage("Roles actualizados.");
    } else if (button.dataset.passwordUser) {
      const result = await authRequest(`/api/admin/users/${button.dataset.passwordUser}/temporary-password`, { method: "POST", body: "{}" });
      showAdminMessage(`Contraseña temporal asignada: ${result.temporaryPassword}`);
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
    showAdminMessage(`${result.created} usuarios procesados. Contraseñas temporales:\n${passwords}`);
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
$("#assignment-career").onchange = renderAssignmentCourses;
$("#assignment-course").onchange = toggleNewCourseFields;
$("#instruction-selector").onchange = () => {
  const item = adminData.instructions.find((entry) => entry.id === $("#instruction-selector").value);
  if (!item) return;
  const form = $("#instruction-form"); form.elements.key.value = item.key; form.elements.title.value = item.title; form.elements.content.value = item.content;
  setScopeValues(form, item); resetImpact("SPECIFICATION");
};
$("#knowledge-selector").onchange = async () => {
  const item = adminData.documents.find((entry) => entry.id === $("#knowledge-selector").value);
  const form = $("#knowledge-form");
  if (!item) {
    form.reset();
    $("#knowledge-content").value = "";
    $("#activate-knowledge-version").classList.add("hidden");
    $("#download-knowledge-original").classList.add("hidden");
    return;
  }
  try {
    const data = await authRequest(`/api/admin/knowledge/${item.id}`);
    form.elements.key.value = data.document.key;
    form.elements.title.value = data.document.title;
    form.elements.priority.value = data.document.priority ?? 100;
    setScopeValues(form, data.document);
    form.elements.appliesToAll.checked = data.document.appliesToAll !== false;
    form.elements.contentMarkdown.value = data.document.contentMarkdown || "";
    form.elements.activate.checked = data.document.status === "ACTIVE";
    $("#activate-knowledge-version").classList.toggle("hidden", data.document.status === "ACTIVE");
    $("#download-knowledge-original").href = `/api/admin/knowledge/${item.id}/download`;
    $("#download-knowledge-original").classList.remove("hidden");
  } catch (error) { showAdminMessage(error.message, true); }
};
$("#knowledge-form").elements.appliesToAll.onchange = (event) => {
  $("[data-document-scope]").classList.toggle("hidden", event.target.checked);
  resetImpact("DOCUMENT");
};
["#instruction-form", "#knowledge-form"].forEach((selector) => {
  $(selector).addEventListener("input", (event) => {
    if (event.target.matches("[data-impact-resolution]")) return;
    const kind = selector === "#instruction-form" ? "SPECIFICATION" : "DOCUMENT";
    if (impactState[kind]) resetImpact(kind);
  });
});
$$("[data-impact-kind]").forEach((button) => {
  button.onclick = async () => {
    const kind = button.dataset.impactKind;
    const form = kind === "SPECIFICATION" ? $("#instruction-form") : $("#knowledge-form");
    const content = kind === "SPECIFICATION" ? form.elements.content.value : form.elements.contentMarkdown.value;
    const payload = {
      kind, key: form.elements.key.value, title: form.elements.title.value, content,
      ...scopeValues(form),
      ...(kind === "DOCUMENT" ? { appliesToAll: form.elements.appliesToAll.checked } : {}),
    };
    try {
      const result = await authRequest("/api/admin/ai-impact-analysis", { method: "POST", body: JSON.stringify(payload) });
      impactState[kind] = result;
      const target = $(`[data-impact-result="${kind}"]`);
      target.innerHTML = impactHtml(result.analysis); target.classList.remove("hidden");
      form.querySelector('button[type="submit"]').disabled = false;
    } catch (error) { showAdminMessage(error.message, true); }
  };
});
$("#knowledge-form").elements.file.onchange = async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  if (!/\.(txt|md)$/i.test(file.name)) {
    event.target.value = "";
    showAdminMessage("Para edición directa seleccione un archivo .txt o .md.", true);
    return;
  }
  $("#knowledge-content").value = await file.text();
};
$("#activate-knowledge-version").onclick = async () => {
  const id = $("#knowledge-selector").value;
  if (!id) return;
  try {
    await authRequest(`/api/admin/knowledge/${id}/activate`, { method: "POST", body: "{}" });
    showAdminMessage("La versión seleccionada quedó activa."); await loadAdminDashboard();
  } catch (error) { showAdminMessage(error.message, true); }
};
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
$("#instruction-form").onsubmit = async (event) => {
  event.preventDefault();
  const submittedForm = event.currentTarget;
  const values = Object.fromEntries(new FormData(submittedForm));
  values.activate = submittedForm.elements.activate.checked;
  Object.assign(values, scopeValues(submittedForm));
  if (!impactState.SPECIFICATION) return showAdminMessage("Analice el impacto antes de guardar.", true);
  values.impactChecksum = impactState.SPECIFICATION.impactChecksum;
  values.conflictResolution = submittedForm.querySelector("[data-impact-resolution]")?.value || "";
  try {
    await authRequest("/api/admin/instructions", { method: "POST", body: JSON.stringify(values) });
    showAdminMessage("Nueva versión de la especificación guardada."); submittedForm.reset(); resetImpact("SPECIFICATION"); await loadAdminDashboard();
  } catch (error) { showAdminMessage(error.message, true); }
};
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = reject; reader.readAsDataURL(file);
  });
}
$("#knowledge-form").onsubmit = async (event) => {
  event.preventDefault();
  const submittedForm = event.currentTarget;
  try {
    const formData = new FormData(submittedForm);
    const file = formData.get("file");
    const hasFile = file && file.size > 0;
    const values = {
      key: formData.get("key"), title: formData.get("title"),
      contentMarkdown: formData.get("contentMarkdown"),
      priority: Number(formData.get("priority")),
      activate: submittedForm.elements.activate.checked,
      appliesToAll: submittedForm.elements.appliesToAll.checked,
      ...scopeValues(submittedForm),
    };
    if (!impactState.DOCUMENT) return showAdminMessage("Analice el impacto antes de guardar.", true);
    values.impactChecksum = impactState.DOCUMENT.impactChecksum;
    values.conflictResolution = submittedForm.querySelector("[data-impact-resolution]")?.value || "";
    if (hasFile) {
      values.fileName = file.name;
      values.mimeType = file.type || (file.name.toLowerCase().endsWith(".md") ? "text/markdown" : "text/plain");
      values.contentBase64 = await fileToBase64(file);
    }
    await authRequest("/api/admin/knowledge", { method: "POST", body: JSON.stringify(values) });
    showAdminMessage("Nueva versión del documento guardada."); submittedForm.reset(); resetImpact("DOCUMENT"); await loadAdminDashboard();
  } catch (error) { showAdminMessage(error.message, true); }
};
