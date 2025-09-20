type CalculatorState = {
  engineers: number;
  salary: number; // base salary in USD
  users: number; // user volume
  timeline: number; // years
  hasExistingAuth: boolean;
};

type CostBreakdown = {
  build: {
    total: number;
    initialDevelopment: number;
    ongoingMaintenance: number;
    securityAndCompliance: number;
    opportunityCost: number;
    oneTimeTransition: number;
  };
  saas: {
    total: number;
    userLicensing: number;
    integrationWork: number; // includes migration cost when applicable
    ongoingSupport: number;
    migrationCost: number;
  };
  fusionauth: {
    total: number;
    licensing: number;
    integration: number;
    maintenance: number;
  };
  savingsVsBuild: number;
};

const queryNumberInput = (selector: string, fallback: number): number => {
  const el = document.querySelector<HTMLInputElement>(selector);
  if (!el) return fallback;
  const value = Number(el.value);
  return Number.isFinite(value) ? value : fallback;
};

const queryBooleanInput = (selector: string, fallback: boolean): boolean => {
  const el = document.querySelector<HTMLInputElement>(selector);
  if (!el) return fallback;
  return Boolean(el.checked);
};

const formatCurrencyUSD = (value: number): string => {
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
};

const readState = (): CalculatorState => {
  const engineers = queryNumberInput('input[name="engineers"]', 3);
  const salary = queryNumberInput('input[name="salary"]', 150000);
  const users = queryNumberInput('input[name="volume"]', 10000);
  const timeline = queryNumberInput('input[name="timeline"]', 3);
  const hasExistingAuth = queryBooleanInput('input[name="auth"]', false);

  return { engineers, salary, users, timeline, hasExistingAuth };
};

const calculateCosts = (state: CalculatorState): CostBreakdown => {
  const overheadMultiplier = 1.5;
  const buildInitialDevelopment = Math.round(
    state.engineers * (state.salary * overheadMultiplier) * 0.5
  );
  const buildOngoingMaintenance = Math.round(
    (state.timeline * 78 * (state.salary * overheadMultiplier)) / 2080
  );
  const buildSecurityAndCompliance = Math.round(state.timeline * 80000);
  const buildOpportunityCost = Math.round(state.timeline * 6120);

  const buildTransitionOneTime = 50000;
  const buildMaintenanceExisting = 85000 * state.timeline;

  const buildTotal = state.hasExistingAuth
    ? buildTransitionOneTime + buildMaintenanceExisting
    : buildInitialDevelopment +
      buildOngoingMaintenance +
      buildSecurityAndCompliance +
      buildOpportunityCost;

  const saasMigrationCost = state.hasExistingAuth ? 100000 : 0;
  const saasUserLicensing = Math.round(state.users * 0.05 * 12 * state.timeline);
  const saasIntegrationWorkBase = Math.round(
    state.engineers * (state.salary * overheadMultiplier) * 0.25
  );
  const saasIntegrationWork = saasIntegrationWorkBase + saasMigrationCost;
  const saasOngoingSupport = Math.round(
    (state.timeline * 104 * (state.salary * overheadMultiplier)) / 2080
  );
  const saasTotal = saasUserLicensing + saasIntegrationWork + saasOngoingSupport;

  const fusLicensing = Math.round(state.users * 0.024 * 12 * state.timeline);
  const fusIntegration = Math.round(state.engineers * (state.salary * overheadMultiplier) * 0.04);
  const fusMaintenance = Math.round(
    (state.timeline * 26 * (state.salary * overheadMultiplier)) / 2080
  );
  const fusTotal = fusLicensing + fusIntegration + fusMaintenance;

  return {
    build: {
      total: buildTotal,
      initialDevelopment: state.hasExistingAuth ? buildTransitionOneTime : buildInitialDevelopment,
      ongoingMaintenance: state.hasExistingAuth
        ? buildMaintenanceExisting
        : buildOngoingMaintenance,
      securityAndCompliance: state.hasExistingAuth ? 0 : buildSecurityAndCompliance,
      opportunityCost: state.hasExistingAuth ? 0 : buildOpportunityCost,
      oneTimeTransition: state.hasExistingAuth ? buildTransitionOneTime : 0,
    },
    saas: {
      total: saasTotal,
      userLicensing: saasUserLicensing,
      integrationWork: saasIntegrationWork,
      ongoingSupport: saasOngoingSupport,
      migrationCost: saasMigrationCost,
    },
    fusionauth: {
      total: fusTotal,
      licensing: fusLicensing,
      integration: fusIntegration,
      maintenance: fusMaintenance,
    },
    savingsVsBuild: buildTotal - fusTotal,
  };
};

const setTextForAll = (selector: string, text: string): void => {
  const elements = document.querySelectorAll<HTMLElement>(selector);
  elements.forEach((el) => {
    el.textContent = text;
  });
};

const setVisibilityForRows = (selector: string, visible: boolean): void => {
  const elements = document.querySelectorAll<HTMLElement>(selector);
  elements.forEach((el) => {
    const row = el.closest<HTMLElement>('.bvb-calculator_card_row');
    if (!row) return;
    row.style.display = visible ? '' : 'none';
  });
};

const updateSliderValuePosition = (input: HTMLInputElement): void => {
  const wrapper = input.closest<HTMLElement>('.range-slider-wrapper');
  if (!wrapper) return;
  const valueEl = wrapper.querySelector<HTMLElement>('.ns-range-slider-value');
  if (!valueEl) return;

  const min = input.min !== '' ? Number(input.min) : 0;
  const max = input.max !== '' ? Number(input.max) : 100;
  const val = Number(input.value);
  const clamped = Math.min(Math.max(val, min), max);
  const ratio = max === min ? 0 : (clamped - min) / (max - min);

  const wrapperRect = wrapper.getBoundingClientRect();
  const inputRect = input.getBoundingClientRect();
  const inputOffsetLeft = inputRect.left - wrapperRect.left;
  const trackWidth = inputRect.width;
  const labelWidth = valueEl.offsetWidth || 0;

  let leftPx = inputOffsetLeft + ratio * trackWidth - labelWidth / 2;

  const padding = 0;
  const minLeft = padding;
  const maxLeft = Math.max(padding, wrapperRect.width - labelWidth - padding);
  leftPx = Math.min(Math.max(leftPx, minLeft), maxLeft);

  valueEl.style.left = `${Math.round(leftPx)}px`;
  valueEl.style.transform = 'translateX(0) translateY(5px)';
};

const updateAllSliderValuePositions = (): void => {
  const inputs = document.querySelectorAll<HTMLInputElement>(
    'input[name="engineers"], input[name="salary"], input[name="volume"], input[name="timeline"]'
  );
  inputs.forEach((input) => updateSliderValuePosition(input));
};

const updateRangeFill = (input: HTMLInputElement): void => {
  const min = input.min !== '' ? Number(input.min) : 0;
  const max = input.max !== '' ? Number(input.max) : 100;
  const val = Number(input.value);
  const clamped = Math.min(Math.max(val, min), max);
  const percent = max === min ? 0 : ((clamped - min) / (max - min)) * 100;

  const filled = '#A5B4FC';
  const track = '#E5E7EB';
  input.style.background = `linear-gradient(to right, ${filled} 0%, ${filled} ${percent}%, ${track} ${percent}%, ${track} 100%)`;
  input.style.backgroundRepeat = 'no-repeat';
};

const updateAllRangeFills = (): void => {
  const inputs = document.querySelectorAll<HTMLInputElement>(
    'input[name="engineers"], input[name="salary"], input[name="volume"], input[name="timeline"]'
  );
  inputs.forEach((input) => updateRangeFill(input));
};

// =====================
// Quick Assessment
// =====================

type AssessmentAnswer = 'yes' | 'no' | null;
type AssessmentAnswers = {
  question1: AssessmentAnswer;
  question2: AssessmentAnswer;
  question3: AssessmentAnswer;
  question4: AssessmentAnswer;
  question5: AssessmentAnswer;
};

const assessmentAnswers: AssessmentAnswers = {
  question1: null,
  question2: null,
  question3: null,
  question4: null,
  question5: null,
};

const setAssessmentAnswer = (index: number, value: Exclude<AssessmentAnswer, null>): void => {
  const key = `question${index}` as keyof AssessmentAnswers;
  if (!['question1', 'question2', 'question3', 'question4', 'question5'].includes(key)) return;
  assessmentAnswers[key] = value;
};

const computeAssessment = () => {
  const answers = Object.values(assessmentAnswers);
  const yesCount = answers.filter((a) => a === 'yes').length;
  const completed = answers.every((a) => a !== null);
  const recommendation = yesCount >= 4 ? 'fusionauth' : yesCount >= 2 ? 'saas' : 'build';
  return { yesCount, completed, recommendation } as const;
};

const updateStepSelection = (stepEl: HTMLElement, selected: 'yes' | 'no'): void => {
  const yesBtn = stepEl.querySelector<HTMLButtonElement>('[step-yes]');
  const noBtn = stepEl.querySelector<HTMLButtonElement>('[step-no]');
  if (!yesBtn || !noBtn) return;

  // Clear any previous state
  yesBtn.classList.remove('selected-yes', 'selected-no');
  noBtn.classList.remove('selected-yes', 'selected-no');

  if (selected === 'yes') {
    yesBtn.classList.add('selected-yes');
  } else {
    noBtn.classList.add('selected-no');
  }

  stepEl.setAttribute('data-selected', selected);
};

const dispatchAssessmentChange = (): void => {
  const detail = { ...computeAssessment(), answers: { ...assessmentAnswers } };
  document.dispatchEvent(new CustomEvent('bvb:assessment-change', { detail }));
};

const initializeAssessment = (): void => {
  const steps = document.querySelectorAll<HTMLElement>('.bvb-step[step]');
  steps.forEach((stepEl) => {
    const stepAttr = stepEl.getAttribute('step');
    const stepIndex = stepAttr ? Number(stepAttr) : NaN;
    if (!Number.isFinite(stepIndex) || stepIndex < 1 || stepIndex > 5) return;

    const yesBtn = stepEl.querySelector<HTMLButtonElement>('[step-yes]');
    const noBtn = stepEl.querySelector<HTMLButtonElement>('[step-no]');
    if (!yesBtn || !noBtn) return;

    // Remove any default selected classes until user selects
    yesBtn.classList.remove('selected-yes', 'selected-no');
    noBtn.classList.remove('selected-yes', 'selected-no');
    stepEl.removeAttribute('data-selected');

    yesBtn.addEventListener('click', (e) => {
      e.preventDefault();
      setAssessmentAnswer(stepIndex, 'yes');
      updateStepSelection(stepEl, 'yes');
      dispatchAssessmentChange();
      updateAssessmentUI();
    });

    noBtn.addEventListener('click', (e) => {
      e.preventDefault();
      setAssessmentAnswer(stepIndex, 'no');
      updateStepSelection(stepEl, 'no');
      dispatchAssessmentChange();
      updateAssessmentUI();
    });
  });
  // Render initial state (hidden until complete)
  updateAssessmentUI();
};

const getAssessmentMessage = (rec: 'fusionauth' | 'saas' | 'build'): string => {
  if (rec === 'fusionauth') {
    return 'FusionAuth - You need fast deployment with enterprise features. FusionAuth provides production-ready auth with compliance built-in.';
  }
  if (rec === 'saas') {
    return 'Traditional SaaS - A managed solution could work, but evaluate customization limitations and long-term costs carefully.';
  }
  return 'Consider Building - You may have the resources and unique requirements that justify building, but review the full analysis below.';
};

const updateAssessmentUI = (): void => {
  const { completed, recommendation } = computeAssessment();
  const containers = document.querySelectorAll<HTMLElement>('[assessment-info]');
  containers.forEach((container) => {
    const textEl = container.querySelector<HTMLElement>('[assessment-text]');
    if (!completed) {
      container.style.display = 'none';
    } else {
      container.style.display = '';
      if (textEl) textEl.textContent = getAssessmentMessage(recommendation);
    }
  });
};

const updateSliderValueDisplays = (state: CalculatorState): void => {
  const engineersEl = document.getElementById('engineers-value');
  const salaryEl = document.getElementById('salary-value');
  const volumeEl = document.getElementById('volume-value');
  const timelineEl = document.getElementById('timeline-value');

  if (engineersEl) engineersEl.textContent = String(state.engineers);
  if (salaryEl) salaryEl.textContent = `$${formatCurrencyUSD(state.salary)}`;
  if (volumeEl) volumeEl.textContent = state.users.toLocaleString();
  if (timelineEl) timelineEl.textContent = String(state.timeline);
};

const updateAttributes = (state: CalculatorState, costs: CostBreakdown): void => {
  // Build In-House
  setTextForAll('[inhouse-value="total"]', `$${formatCurrencyUSD(costs.build.total)}`);
  // Accept both the intended key and a common misspelling for robustness
  setTextForAll(
    '[inhouse-value="initial-development"]',
    `$${formatCurrencyUSD(costs.build.initialDevelopment)}`
  );
  setTextForAll(
    '[inhouse-value="one-time-transition"]',
    `$${formatCurrencyUSD(costs.build.oneTimeTransition)}`
  );
  setTextForAll(
    '[inhouse-value="ongoing-maintenance"]',
    `$${formatCurrencyUSD(costs.build.ongoingMaintenance)}`
  );
  setTextForAll(
    '[inhouse-value="security-and-compliance"]',
    `$${formatCurrencyUSD(costs.build.securityAndCompliance)}`
  );
  setTextForAll(
    '[inhouse-value="opportunity-cost"]',
    `$${formatCurrencyUSD(costs.build.opportunityCost)}`
  );

  // Toggle visibility of build rows based on existing auth
  if (state.hasExistingAuth) {
    setVisibilityForRows('[inhouse-value="one-time-transition"]', true);
    setVisibilityForRows('[inhouse-value="ongoing-maintenance"]', true);
    setVisibilityForRows('[inhouse-value="initial-development"]', false);
    setVisibilityForRows('[inhouse-value="security-and-compliance"]', false);
    setVisibilityForRows('[inhouse-value="opportunity-cost"]', false);
  } else {
    setVisibilityForRows('[inhouse-value="one-time-transition"]', false);
    setVisibilityForRows('[inhouse-value="ongoing-maintenance"]', true);
    setVisibilityForRows('[inhouse-value="initial-development"]', true);
    setVisibilityForRows('[inhouse-value="security-and-compliance"]', true);
    setVisibilityForRows('[inhouse-value="opportunity-cost"]', true);
  }

  // Traditional SaaS
  setTextForAll('[saas-value="total"]', `$${formatCurrencyUSD(costs.saas.total)}`);
  setTextForAll('[saas-value="user-licensing"]', `$${formatCurrencyUSD(costs.saas.userLicensing)}`);
  setTextForAll(
    '[saas-value="integration-work"]',
    `$${formatCurrencyUSD(costs.saas.integrationWork)}`
  );
  setTextForAll(
    '[saas-value="ongoing-support"]',
    `$${formatCurrencyUSD(costs.saas.ongoingSupport)}`
  );
  setTextForAll('[saas-value="migration-cost"]', `$${formatCurrencyUSD(costs.saas.migrationCost)}`);
  setVisibilityForRows('[saas-value="migration-cost"]', state.hasExistingAuth);

  // FusionAuth
  setTextForAll('[fus-value="total"]', `$${formatCurrencyUSD(costs.fusionauth.total)}`);
  setTextForAll('[fus-value="licensing"]', `$${formatCurrencyUSD(costs.fusionauth.licensing)}`);
  setTextForAll('[fus-value="integration"]', `$${formatCurrencyUSD(costs.fusionauth.integration)}`);
  setTextForAll('[fus-value="maintenance"]', `$${formatCurrencyUSD(costs.fusionauth.maintenance)}`);

  // General
  setTextForAll('[general-value="timeline"]', String(state.timeline));
  setTextForAll('[general-value="total-savings"]', `$${formatCurrencyUSD(costs.savingsVsBuild)}`);
};

const recalcAndRender = (): void => {
  const state = readState();
  const costs = calculateCosts(state);
  updateSliderValueDisplays(state);
  updateAttributes(state, costs);
  updateAllSliderValuePositions();
  updateAllRangeFills();
};

const attachListeners = (): void => {
  const engineerInput = document.querySelector<HTMLInputElement>('input[name="engineers"]');
  const salaryInput = document.querySelector<HTMLInputElement>('input[name="salary"]');
  const volumeInput = document.querySelector<HTMLInputElement>('input[name="volume"]');
  const timelineInput = document.querySelector<HTMLInputElement>('input[name="timeline"]');
  const authCheckbox = document.querySelector<HTMLInputElement>('input[name="auth"]');

  const onChange = () => recalcAndRender();

  engineerInput?.addEventListener('input', onChange);
  salaryInput?.addEventListener('input', onChange);
  volumeInput?.addEventListener('input', onChange);
  timelineInput?.addEventListener('input', onChange);
  authCheckbox?.addEventListener('change', onChange);

  // Initialize slider value labels on load and on resize (in case layout affects position)
  window.addEventListener('resize', updateAllSliderValuePositions);
  window.addEventListener('resize', updateAllRangeFills);
};

const ready = (fn: () => void): void => {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fn, { once: true });
  } else {
    fn();
  }
};

ready(() => {
  attachListeners();
  recalcAndRender();
  initializeAssessment();
});

export {};
