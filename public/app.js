const form = document.querySelector("#subject-form");
const status = document.querySelector("#form-status");
const level = document.querySelector("#level");
const modality = document.querySelector("#modality");
const faculty = document.querySelector("#faculty");
const program = document.querySelector("#program");
const updateSelect = (select, placeholder, options = []) => {
    select.innerHTML = "";
    const placeholderOption = document.createElement("option");
    placeholderOption.value = "";
    placeholderOption.textContent = placeholder;
    select.appendChild(placeholderOption);
    options.forEach(({
        value,
        label
    }) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        select.appendChild(option);
    });
    select.disabled = options.length === 0;
};
const modalitiesByLevel = {
    tecnologia: [{
        value: "sin-registro",
        label: "Sin modalidad registrada"
    }, ],
    grado: [{
        value: "distancia",
        label: "A distancia"
    }, {
        value: "en-linea",
        label: "En línea"
    }, {
        value: "presencial",
        label: "Presencial"
    }, ],
    posgrado: [{
        value: "en-linea",
        label: "En línea"
    }, {
        value: "presencial",
        label: "Presencial"
    }, {
        value: "hibrida",
        label: "Híbrida"
    }, ],
    doctorado: [{
        value: "presencial",
        label: "Presencial"
    }, ],
};
const academicOffer = {
    tecnologia: {
        "sin-registro": [{
            value: "sin-facultad",
            label: "Sin facultad registrada",
            programs: [{
                value: "comunicacion-estrategica-marketing-digital",
                label: "Comunicación Estratégica y Marketing Digital",
            }, {
                value: "negociacion-ventas",
                label: "Negociación y Ventas",
            }, {
                value: "modelado-bim-industria-construccion",
                label: "Modelado BIM para la Industria de la Construcción",
            }, {
                value: "marketing-turistico-digital",
                label: "Marketing Turístico Digital",
            }, {
                value: "creacion-audiovisual-digital-online",
                label: "Creación Audiovisual Digital -online",
            }, {
                value: "contabilidad-asesoria-tributaria",
                label: "Contabilidad y Asesoría Tributaria",
            }, ],
        }, ],
    },
    grado: {
        distancia: [{
            value: "facultad-ciencias-comportamiento",
            label: "Facultad de Ciencias del Comportamiento",
            programs: [{
                value: "psicologia",
                label: "Psicología",
            }, {
                value: "psicopedagogia",
                label: "Psicopedagogía",
            }, ],
        }, ],
        "en-linea": [{
            value: "facultad-ciencias-economicas-empresariales",
            label: "Facultad de Ciencias Económicas y Empresariales",
            programs: [{
                value: "govtech-administracion-publica",
                label: "GovTech y Administración Pública",
            }, {
                value: "negocios-internacionales",
                label: "Negocios Internacionales",
            }, {
                value: "negocios-turisticos-gastronomicos",
                label: "Negocios Turísticos y Gastronómicos",
            }, {
                value: "administracion-empresas",
                label: "Administración de Empresas",
            }, {
                value: "contabilidad-auditoria",
                label: "Contabilidad y Auditoría",
            }, {
                value: "economia",
                label: "Economía",
            }, {
                value: "finanzas",
                label: "Finanzas",
            }, {
                value: "turismo",
                label: "Turismo",
            }, ],
        }, {
            value: "facultad-ciencias-exactas-naturales",
            label: "Facultad de Ciencias Exactas y Naturales",
            programs: [{
                value: "ingenieria-recursos-naturales-sostenibilidad",
                label: "Ingeniería en Recursos Naturales y Sostenibilidad",
            }, {
                value: "ingenieria-riesgos-cambio-climatico",
                label: "Ingeniería en Riesgos y Cambio Climático",
            }, {
                value: "agronegocios",
                label: "Agronegocios",
            }, {
                value: "gestion-ambiental",
                label: "Gestión Ambiental",
            }, {
                value: "seguridad-salud-ocupacional",
                label: "Seguridad y Salud Ocupacional",
            }, ],
        }, {
            value: "facultad-ciencias-comportamiento",
            label: "Facultad de Ciencias del Comportamiento",
            programs: [{
                value: "psicologia",
                label: "Psicología",
            }, {
                value: "psicopedagogia",
                label: "Psicopedagogía",
            }, ],
        }, {
            value: "facultad-ciencias-sociales-educacion-humanidades",
            label: "Facultad de Ciencias Sociales, Educación y Humanidades",
            programs: [{
                value: "comunicacion",
                label: "Comunicación",
            }, {
                value: "educacion-basica",
                label: "Educación Básica",
            }, {
                value: "educacion-inicial",
                label: "Educación Inicial",
            }, {
                value: "pedagogia-lengua-literatura",
                label: "Pedagogía de la Lengua y la Literatura",
            }, {
                value: "pedagogia-quimica-biologia",
                label: "Pedagogía de las Ciencias Experimentales (Pedagogía de la Química y Biología)",
            }, {
                value: "pedagogia-matematicas-fisica",
                label: "Pedagogía de las Ciencias Experimentales (Pedagogía de las Matemáticas y la Física)",
            }, {
                value: "pedagogia-idiomas-nacionales-extranjeros",
                label: "Pedagogía de los Idiomas Nacionales y Extranjeros",
            }, {
                value: "pedagogia-ciencias-sociales-humanidades",
                label: "Pedagogía en Ciencias Sociales y Humanidades",
            }, ],
        }, {
            value: "facultad-ciencias-juridicas-politicas",
            label: "Facultad de Ciencias Jurídicas y Políticas",
            programs: [{
                value: "ciencias-politicas-relaciones-internacionales",
                label: "Ciencias Políticas y Relaciones Internacionales",
            }, {
                value: "derecho",
                label: "Derecho",
            }, ],
        }, {
            value: "facultad-ingenierias-arquitectura",
            label: "Facultad de Ingenierías y Arquitectura",
            programs: [{
                value: "ingenieria-energia",
                label: "Ingeniería en Energía",
            }, {
                value: "logistica-transporte",
                label: "Logística y Transporte",
            }, {
                value: "redes-analitica-datos",
                label: "Redes y Analítica de Datos",
            }, {
                value: "tecnologias-informacion",
                label: "Tecnologías de la Información",
            }, ],
        }, ],
        presencial: [{
            value: "facultad-ciencias-economicas-empresariales",
            label: "Facultad de Ciencias Económicas y Empresariales",
            programs: [{
                value: "administracion-empresas",
                label: "Administración de Empresas",
            }, {
                value: "contabilidad-auditoria",
                label: "Contabilidad y Auditoría",
            }, {
                value: "economia",
                label: "Economía",
            }, {
                value: "finanzas",
                label: "Finanzas",
            }, {
                value: "gastronomia",
                label: "Gastronomía",
            }, ],
        }, {
            value: "facultad-ciencias-exactas-naturales",
            label: "Facultad de Ciencias Exactas y Naturales",
            programs: [{
                value: "agropecuaria",
                label: "Agropecuaria",
            }, {
                value: "alimentos",
                label: "Alimentos",
            }, {
                value: "biologia",
                label: "Biología",
            }, {
                value: "ingenieria-ambiental",
                label: "Ingeniería Ambiental",
            }, {
                value: "bioquimica-farmacia",
                label: "Bioquímica y Farmacia",
            }, {
                value: "ingenieria-industrial",
                label: "Ingeniería Industrial",
            }, {
                value: "ingenieria-quimica",
                label: "Ingeniería Química",
            }, ],
        }, {
            value: "facultad-ciencias-comportamiento",
            label: "Facultad de Ciencias del Comportamiento",
            programs: [{
                value: "psicologia",
                label: "Psicología",
            }, {
                value: "psicopedagogia",
                label: "Psicopedagogía",
            }, {
                value: "psicologia-clinica",
                label: "Psicología Clínica",
            }, ],
        }, {
            value: "facultad-ciencias-sociales-educacion-humanidades",
            label: "Facultad de Ciencias Sociales, Educación y Humanidades",
            programs: [{
                value: "artes-escenicas",
                label: "Artes Escénicas",
            }, {
                value: "artes-visuales",
                label: "Artes Visuales",
            }, {
                value: "pedagogia-idiomas-nacionales-extranjeros",
                label: "Pedagogía de los Idiomas Nacionales y Extranjeros",
            }, ],
        }, {
            value: "facultad-ciencias-juridicas-politicas",
            label: "Facultad de Ciencias Jurídicas y Políticas",
            programs: [{
                value: "derecho",
                label: "Derecho",
            }, ],
        }, {
            value: "facultad-ingenierias-arquitectura",
            label: "Facultad de Ingenierías y Arquitectura",
            programs: [{
                value: "arquitectura",
                label: "Arquitectura",
            }, {
                value: "geologia",
                label: "Geología",
            }, {
                value: "ingenieria-civil",
                label: "Ingeniería Civil",
            }, {
                value: "telecomunicaciones",
                label: "Telecomunicaciones",
            }, {
                value: "computacion",
                label: "Computación",
            }, ],
        }, {
            value: "facultad-ciencias-salud",
            label: "Facultad de Ciencias de la Salud",
            programs: [{
                value: "enfermeria",
                label: "Enfermería",
            }, {
                value: "fisioterapia",
                label: "Fisioterapia",
            }, {
                value: "medicina",
                label: "Medicina",
            }, {
                value: "nutricion-dietetica",
                label: "Nutrición y Dietética",
            }, ],
        }, ],
    },
    posgrado: {
        "en-linea": [{
            value: "facultad-ciencias-economicas-empresariales",
            label: "Facultad de Ciencias Económicas y Empresariales",
            programs: [{
                value: "especializacion-tributacion",
                label: "Especialización en Tributación",
            }, {
                value: "gestion-innovacion-alimentos-bebidas",
                label: "Gestión e Innovación de Alimentos y Bebidas",
            }, {
                value: "gestion-financiera-administracion-riesgos-financieros",
                label: "Gestión Financiera y Administración de Riesgos Financieros",
            }, {
                value: "auditoria-gestion-riesgo-fraude-financiero-auditoria-forense",
                label: "Auditoría con mención en Gestión del Riesgo de Fraude Financiero y Auditoría Forense",
            }, {
                value: "finanzas",
                label: "Finanzas",
            }, ],
        }, {
            value: "facultad-ciencias-exactas-naturales",
            label: "Facultad de Ciencias Exactas y Naturales",
            programs: [{
                value: "bioeconomia",
                label: "Bioeconomía",
            }, {
                value: "seguridad-industrial-prevencion-riesgos-laborales",
                label: "Seguridad Industrial mención Prevención de Riesgos Laborales",
            }, {
                value: "ciencias-ambientales-educacion-ambiental",
                label: "Ciencias Ambientales con mención en Educación Ambiental",
            }, {
                value: "produccion-operaciones-industriales",
                label: "Producción y Operaciones Industriales",
            }, {
                value: "recursos-naturales-renovables-manejo-preservacion",
                label: "Recursos Naturales Renovables con mención en Manejo y Preservación de los Recursos Naturales",
            }, ],
        }, {
            value: "facultad-ciencias-sociales-educacion-humanidades",
            label: "Facultad de Ciencias Sociales, Educación y Humanidades",
            programs: [{
                value: "comunicacion-estrategica-comunicacion-digital",
                label: "Comunicación Estratégica mención Comunicación Digital",
            }, {
                value: "educacion-literatura-infantil-juvenil",
                label: "Educación con mención en Literatura Infantil y Juvenil",
            }, {
                value: "educacion-ensenanza-matematica",
                label: "Educación, Mención en Enseñanza de la Matemática",
            }, {
                value: "investigacion-educacion",
                label: "Investigación en Educación",
            }, {
                value: "pedagogia-idiomas-ensenanza-ingles",
                label: "Pedagogía de los Idiomas Nacionales y Extranjeros, mención Enseñanza de Inglés",
            }, {
                value: "pedagogia-artes",
                label: "Pedagogía en las Artes",
            }, {
                value: "comunicacion-contenidos-inteligencia-artificial",
                label: "Comunicación, Ideación y Creación de Contenidos con Inteligencia Artificial",
            }, {
                value: "educacion-curriculo-evaluacion-educativa",
                label: "Educación con Mención en Currículo y Evaluación Educativa",
            }, {
                value: "educacion-orientacion-familiar-educativa",
                label: "Educación mención 1. Orientación Familiar, mención 2. Orientación Educativa",
            }, {
                value: "educacion-gestion-aprendizaje-tic",
                label: "Educación, Mención en Gestión del Aprendizaje mediado por TIC",
            }, {
                value: "educacion-innovacion-liderazgo-educativo",
                label: "Educación, Mención Innovación y Liderazgo Educativo",
            }, {
                value: "educacion-inclusion-atencion-diversidad",
                label: "Educación con mención en Inclusión Educativa y Atención a la Diversidad",
            }, ],
        }, {
            value: "facultad-ciencias-juridicas-politicas",
            label: "Facultad de Ciencias Jurídicas y Políticas",
            programs: [{
                value: "derecho-constitucional",
                label: "Derecho Constitucional",
            }, {
                value: "derecho-mencion-derecho-procesal",
                label: "Derecho mención Derecho Procesal",
            }, {
                value: "derecho-penal-derecho-procesal-penal",
                label: "Derecho Penal mención Derecho Procesal Penal",
            }, {
                value: "derecho-procesal-administrativo",
                label: "Derecho Procesal Administrativo",
            }, {
                value: "derecho-tributario",
                label: "Derecho Tributario",
            }, {
                value: "ciencias-politicas-politicas-publicas",
                label: "Ciencias Políticas con mención en Políticas Públicas",
            }, {
                value: "criminologia-politica-criminal",
                label: "Criminología y Política Criminal",
            }, ],
        }, {
            value: "facultad-ciencias-salud",
            label: "Facultad de Ciencias de la Salud",
            programs: [{
                value: "gerencia-instituciones-salud",
                label: "Gerencia de Instituciones de Salud",
            }, {
                value: "gestion-calidad-auditoria-salud",
                label: "Gestión de la Calidad y Auditoría en Salud",
            }, ],
        }, ],
        presencial: [{
            value: "facultad-ciencias-exactas-naturales",
            label: "Facultad de Ciencias Exactas y Naturales",
            programs: [{
                value: "ciencias-quimicas",
                label: "Ciencias Químicas",
            }, {
                value: "doctorado-quimica",
                label: "Doctorado en Química",
            }, ],
        }, {
            value: "facultad-ciencias-salud",
            label: "Facultad de Ciencias de la Salud",
            programs: [{
                value: "especializacion-medicina-familiar-comunitaria",
                label: "Especialización en Medicina Familiar y Comunitaria",
            }, {
                value: "analisis-biologico-diagnostico-laboratorio",
                label: "Análisis Biológico y Diagnóstico de Laboratorio",
            }, {
                value: "especializacion-anestesiologia-reanimacion-terapia-dolor",
                label: "Especialización en Anestesiología, Reanimación y Terapia del Dolor",
            }, {
                value: "especializacion-imagenologia",
                label: "Especialización en Imagenología",
            }, ],
        }, ],
        hibrida: [{
            value: "facultad-ciencias-exactas-naturales",
            label: "Facultad de Ciencias Exactas y Naturales",
            programs: [{
                value: "farmacia-asistencial-atencion",
                label: "Farmacia Asistencial y Atención",
            }, ],
        }, ],
    },
};
level.addEventListener("change", () => {
    const modalities = modalitiesByLevel[level.value] || [];
    updateSelect(modality, modalities.length? "Seleccione una modalidad" : "No existe oferta registrada", modalities);
    updateSelect(faculty, "Seleccione primero el nivel y la modalidad");
    updateSelect(program, "Seleccione primero una facultad");
});
modality.addEventListener("change", () => {
    const faculties = academicOffer[level.value]?.[modality.value] || [];
    updateSelect(faculty, faculties.length? "Seleccione una facultad" : "No existen facultades registradas", faculties);
    updateSelect(program, "Seleccione primero una facultad");
});
faculty.addEventListener("change", () => {
    const faculties = academicOffer[level.value]?.[modality.value] || [];
    const selectedFaculty = faculties.find(
        (item) => item.value === faculty.value);
    const programs = selectedFaculty?.programs || [];
    updateSelect(program, programs.length? "Seleccione una carrera o programa" : "No existen carreras o programas registrados", programs);
});
const reviewPanel = 
  document.querySelector("#review-panel");

const reviewSummary = 
  document.querySelector("#review-summary");

const editInformationButton =
  document.querySelector("#edit-information");

const confirmReviewButton =
  document.querySelector("#confirm-review");

const workflowSteps = 
  document.querySelectorAll(".workflow-step");

const generationPanel =
  document.querySelector("#generation-panel");

const returnToReviewButton =
  document.querySelector("#return-to-review");

const generateWeekButton =
  document.querySelector("#generate-week");

const selectedText = (select) => {
  if (!select.value) {
    return "No registrado";
  }

  return select.options[select.selectedIndex]?.text || "No registrado";
};

const fieldValue = (fieldId) => {
  const field = document.querySelector(`#${fieldId}`);
  return field?.value.trim() || "No registrado";
};

const summaryFields = () => [
  {
    label: "Nivel de formación",
    value: selectedText(level),
  },
  {
    label: "Modalidad",
    value: selectedText(modality),
  },
  {
    label: "Facultad",
    value: selectedText(faculty),
  },
  {
    label: "Carrera o programa",
    value: selectedText(program),
  },
  {
    label: "Código de la asignatura",
    value: fieldValue("subject-code"),
  },
  {
    label: "Periodo académico",
    value: fieldValue("academic-period"),
  },
  {
    label: "Nombre de la asignatura",
    value: fieldValue("subject-name"),
  },
  {
    label: "Número de semanas",
    value: fieldValue("weeks"),
  },
  {
    label: "Número de créditos",
    value: fieldValue("credits"),
  },
  {
    label: "Resultado de aprendizaje",
    value: fieldValue("learning-outcome"),
    full: true,
  },
  {
    label: "Unidades y contenidos",
    value: fieldValue("contents"),
    full: true,
  },
  {
    label: "Metodología de aprendizaje",
    value: fieldValue("methodology"),
    full: true,
  },
  {
    label: "Bibliografía disponible",
    value: fieldValue("bibliography"),
    full: true,
  },
];

const renderSummary = () => {
  reviewSummary.replaceChildren();

  summaryFields().forEach(({ label, value, full }) => {
    const item = document.createElement("div");
    item.className = "review-summary__item";

    if (full) {
      item.classList.add("review-summary__item--full");
    }

    const term = document.createElement("dt");
    term.textContent = label;

    const description = document.createElement("dd");
    description.textContent = value;

    item.append(term, description);
    reviewSummary.append(item);
  });
};

const saveDraft = () => {
  const draft = Object.fromEntries(new FormData(form).entries());

  localStorage.setItem(
    "subjectFormDraft",
    JSON.stringify(draft)
  );
};

const restoreDraft = () => {
  const savedDraft = localStorage.getItem("subjectFormDraft");

  if (!savedDraft) {
    return;
  }

  try {
    const draft = JSON.parse(savedDraft);

    level.value = draft.level || "";
    level.dispatchEvent(new Event("change"));

    modality.value = draft.modality || "";
    modality.dispatchEvent(new Event("change"));

    faculty.value = draft.faculty || "";
    faculty.dispatchEvent(new Event("change"));

    program.value = draft.program || "";

    [
      "subjectCode",
      "academicPeriod",
      "subjectName",
      "weeks",
      "credits",
      "learningOutcome",
      "contents",
      "methodology",
      "bibliography",
    ].forEach((name) => {
      if (form.elements[name] && draft[name] !== undefined) {
        form.elements[name].value = draft[name];
      }
    });
  } catch (error) {
    console.error("No se pudo recuperar el borrador.", error);
  }
};

const activatePeerReviewStage = () => {
  const firstStep = workflowSteps[0];
  const secondStep = workflowSteps[1];

  if (!firstStep || !secondStep) {
    return;
  }

  firstStep.classList.remove("workflow-step--active");

  const firstStatus =
    firstStep.querySelector(".workflow-step__status");

  firstStatus?.classList.remove(
    "workflow-step__status--active"
  );

  if (firstStatus) {
    firstStatus.textContent = "Completada";
  }

  secondStep.classList.add("workflow-step--active");

  const secondStatus =
    secondStep.querySelector(".workflow-step__status");

  secondStatus?.classList.add(
    "workflow-step__status--active"
  );

  if (secondStatus) {
    secondStatus.textContent = "Etapa actual";
  }
};



form.addEventListener("submit", (event) => {
  event.preventDefault();

  if (!form.reportValidity()) {
    return;
  }

  saveDraft();
  renderSummary();

  reviewPanel.hidden = false;
  reviewPanel.classList.remove("review-panel--sent");

  status.textContent =
    "Revise el resumen antes de confirmar el envío.";

  status.dataset.visible = "true";

  reviewPanel.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
});

editInformationButton.addEventListener("click", () => {
  reviewPanel.hidden = true;
  status.dataset.visible = "false";

  form.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });

  const firstField = form.querySelector(
    "input, select, textarea"
  );

  firstField?.focus({
    preventScroll: true,
  });
});

confirmReviewButton.addEventListener("click", () => {
  saveDraft();

  localStorage.setItem(
    "subjectWorkflowStage",
    "generation"
  );

  reviewPanel.hidden = true;
  generationPanel.hidden = false;

  status.textContent =
    "La información fue confirmada. Puede iniciar la generación de la primera semana.";

  status.dataset.visible = "true";

  generationPanel.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
});

returnToReviewButton.addEventListener("click", () => {
  generationPanel.hidden = true;
  reviewPanel.hidden = false;

  reviewPanel.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
});

generateWeekButton.addEventListener("click", () => {
  status.textContent =
    "La generación automática se habilitará al conectar el servidor con la API.";

  status.dataset.visible = "true";
});

form.addEventListener("input", () => {
  status.dataset.visible = "false";
});

restoreDraft();

if (
  localStorage.getItem("subjectWorkflowStage") ===
  "generation"
) {
  renderSummary();
  reviewPanel.hidden = true;
  generationPanel.hidden = false;

  status.textContent =
    "La asignatura se encuentra en elaboración docente.";

  status.dataset.visible = "true";
}