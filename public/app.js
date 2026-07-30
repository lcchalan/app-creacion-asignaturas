const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
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
let visualFlowRunning = false;
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
  const lines = String(markdown || "").replace(/\r\n?/g, "\n").split("\n");
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
    const image = line.match(/^!\[([^\]]*)\]\((data:image\/[^)]+|https?:\/\/[^)]+|\/api\/images\/[0-9a-f-]{36})\)$/i);
    if (image) {
      closeList();
      html.push(`<figure class="generated-figure"><img src="${image[2]}" alt="${escapeHtml(image[1])}"><figcaption>${escapeHtml(image[1])}</figcaption></figure>`);
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
      const previousLine = String(lines[index - 1] || "").trim();
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

function visualOpportunities(markdown) {
  const expression = /\[OPORTUNIDAD_VISUAL\]\s*([\s\S]*?)\s*\[\/OPORTUNIDAD_VISUAL\]/gi;
  const parts = [];
  let position = 0;
  let match;
  while ((match = expression.exec(markdown)) !== null && parts.length < 7) {
    parts.push({ type: "content", value: markdown.slice(position, match.index) });
    const fields = {};
    for (const line of match[1].split("\n")) {
      const field = line.match(/^([A-Z_ÁÉÍÓÚ]+):\s*(.*)$/i);
      if (field) fields[field[1].toUpperCase()] = field[2].trim();
    }
    const options = String(fields.OPCIONES || "")
      .split("|").map((item) => item.trim()).filter(Boolean).slice(0, 3);
    if (fields.TEMA && fields.FINALIDAD && fields.PROMPT_BASE && options.length === 3) {
      parts.push({
        type: "visual",
        value: {
          topic: fields.TEMA,
          purpose: fields.FINALIDAD,
          options,
          orientation: ["horizontal", "vertical", "cuadrada"].includes(
            String(fields.ORIENTACION || "").toLowerCase(),
          ) ? String(fields.ORIENTACION).toLowerCase() : "horizontal",
          title: fields.TITULO || fields.TEMA,
          prompt: fields.PROMPT_BASE,
          altText: fields.TEXTO_ALTERNATIVO || `Representación visual de ${fields.TEMA}.`,
        },
      });
    }
    position = expression.lastIndex;
  }
  parts.push({ type: "content", value: markdown.slice(position) });
  return parts;
}

function setVisualEditable(editable) {
  $("#visual-title").readOnly = !editable;
  $("#visual-prompt").readOnly = !editable;
  $("#visual-alt").readOnly = !editable;
}

function requestVisualDecision(proposal) {
  const modalLayer = $("#visual-modal-layer");
  const styles = $("#visual-styles");
  const error = $("#visual-error");
  const progress = $("#visual-progress");
  $("#visual-topic").textContent = proposal.topic;
  $("#visual-purpose").textContent = proposal.purpose;
  $("#visual-orientation").value = proposal.orientation;
  $("#visual-title").value = proposal.title;
  $("#visual-prompt").value = proposal.prompt;
  $("#visual-alt").value = proposal.altText;
  styles.innerHTML = proposal.options.map((style, index) => `
    <label class="visual-style-card">
      <input type="radio" name="visual-style" value="${escapeHtml(style)}" ${index === 0 ? "checked" : ""}>
      <span>${escapeHtml(style)}</span>
    </label>`).join("");
  error.textContent = "";
  error.classList.add("hidden");
  progress.classList.add("hidden");
  setVisualEditable(false);
  modalLayer.classList.remove("hidden");

  return new Promise((resolve) => {
    const close = (decision) => {
      modalLayer.classList.add("hidden");
      $("#omit-visual").onclick = null;
      $("#modify-visual").onclick = null;
      $("#generate-visual").onclick = null;
      resolve(decision);
    };
    $("#omit-visual").onclick = () => close({ action: "omit" });
    $("#modify-visual").onclick = () => {
      setVisualEditable(true);
      $("#visual-prompt").focus();
    };
    $("#generate-visual").onclick = async () => {
      const selectedStyle = $('input[name="visual-style"]:checked');
      if (!selectedStyle) {
        error.textContent = "Seleccione uno de los tres estilos.";
        error.classList.remove("hidden");
        return;
      }
      const body = {
        projectId,
        week: currentWeek,
        topic: proposal.topic,
        purpose: proposal.purpose,
        style: selectedStyle.value,
        orientation: $("#visual-orientation").value,
        title: $("#visual-title").value.trim(),
        prompt: $("#visual-prompt").value.trim(),
        altText: $("#visual-alt").value.trim(),
      };
      if (!body.title || !body.prompt || !body.altText) {
        error.textContent = "Complete el título, las indicaciones y el texto alternativo.";
        error.classList.remove("hidden");
        return;
      }
      $("#generate-visual").disabled = true;
      $("#omit-visual").disabled = true;
      progress.classList.remove("hidden");
      error.classList.add("hidden");
      try {
        const response = await fetch("/api/generate-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "No fue posible generar el recurso.");
        close({ action: "generated", ...payload });
      } catch (generationError) {
        error.textContent = `No se pudo generar la imagen: ${generationError.message}`;
        error.classList.remove("hidden");
      } finally {
        $("#generate-visual").disabled = false;
        $("#omit-visual").disabled = false;
        progress.classList.add("hidden");
      }
    };
  });
}

async function runVisualFlow(markdown) {
  const output = $("#generation-output");
  const parts = visualOpportunities(markdown);
  let assembled = "";
  let figureNumber = (markdown.match(/^!\[/gm) || []).length;
  visualFlowRunning = true;
  $("#approve-week").disabled = true;
  $("#regenerate-with-instructions").disabled = true;
  try {
    for (const part of parts) {
      if (part.type === "content") {
        assembled += part.value;
        output.innerHTML = markdownToHtml(assembled);
        weekStates[currentWeek] = {
          ...weekState(currentWeek),
          status: "draft",
          draftContent: assembled,
        };
        persistProject();
        continue;
      }
      const decision = await requestVisualDecision(part.value);
      if (decision.action === "generated") {
        figureNumber += 1;
        assembled += `\n\n**Figura ${figureNumber}. ${decision.title}**\n\n` +
          `![${decision.altText}](${decision.imageUrl})\n\n` +
          `*Fuente: ${decision.source}*\n\n`;
        output.innerHTML = markdownToHtml(assembled);
        weekStates[currentWeek] = {
          ...weekState(currentWeek),
          status: "draft",
          draftContent: assembled,
        };
        persistProject();
      }
    }
    return assembled.trim();
  } finally {
    visualFlowRunning = false;
    $("#approve-week").disabled = false;
    $("#regenerate-with-instructions").disabled = false;
  }
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
    ["Código", project.subjectCode], ["Asignatura", project.subjectName],
    ["Periodo", project.academicPeriod], ["Duración", `${project.weeks} semanas`],
    ["Matriz", matrixFile?.name || matrixFileName], ["Registros", matrixRows.length],
  ].map(([key, value]) => `<div><small>${key}</small><strong>${escapeHtml(value || "—")}</strong></div>`).join("");
}
next.onclick = async () => {
  if (step === 1) {
    if (invalidFields(["projectName", "level", "modality", "faculty", "career", "professorName", "subjectCode", "subjectName", "academicPeriod", "weeks"]).length) {
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
    week: currentWeek,
    project: {
      projectName: project.projectName, level: project.level,
      modality: project.modality, faculty: project.faculty,
      career: project.career, professorName: project.professorName,
      subjectCode: project.subjectCode, subjectName: project.subjectName,
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
    progressText.textContent = selectedAdjustmentFiles.length
      ? "Analizando las instrucciones y los archivos adjuntos…"
      : "Aplicando las instrucciones y regenerando el contenido…";
    progress.classList.remove("hidden");
  } else {
    generateButton.textContent = `Generando semana ${currentWeek}…`;
  }
  errorBox.classList.add("hidden");
  try {
    await syncDatabase();
    const response = await fetch("/api/generate-week", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(await generationPayload(adjustmentInstructions)),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "No fue posible generar la semana.");
    const completedContent = await runVisualFlow(payload.content);
    output.innerHTML = markdownToHtml(completedContent);
    weekStates[currentWeek] = {
      ...weekState(currentWeek),
      status: "draft",
      draftContent: completedContent,
    };
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
    progress.classList.add("hidden");
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
loadProjects();
