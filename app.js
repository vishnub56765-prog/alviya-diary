/**
 * ALVIYA DAIRY - Main Application Entrypoint
 * Navigation, view lifecycle, dashboard widgets, and TS rate management.
 */

import { state, session, centerById, scopedFarmers, scopedCollections, scopedAdvances, loadCachedState, saveCachedState } from './state.js';
import { money, fmt, getCycle } from './calculations.js';
import { syncTS } from './supabase.js';

import { setupAuth } from './auth.js';
import { setupCenters, renderCenters, deleteCenterAction } from './centers.js';
import { setupFarmers, renderFarmers } from './farmers.js';
import { setupCollections, renderCollectionPage } from './collections.js';
import { setupAdvances, renderAdvances } from './advances.js';
import { setupBilling, renderBillSelectors, renderBillSheet } from './billing.js';
import { setupReports, renderReports } from './reports.js';
import { setupBackup } from './backup.js';

// Navigation Item Definitions
const mainNav = [
  ['centersPage', '🏬', 'Centers'],
  ['tsPage', '⚙️', 'TS Management'],
  ['reportsPage', '📊', 'Reports'],
  ['backupPage', '💾', 'Backup']
];

const centerNav = [
  ['overviewPage', '📈', 'Dashboard'],
  ['farmersPage', '👨‍🌾', 'Farmers'],
  ['collectionPage', '🥛', 'Milk Collection'],
  ['advancesPage', '💵', 'Advances'],
  ['billsPage', '🧾', 'Bills'],
  ['reportsPage', '📊', 'Reports'],
  ['backupPage', '💾', 'Backup'],
  ['tsPage', '⚙️', 'TS']
];

let centerControls = null;
let farmerControls = null;
let collectionControls = null;

export function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => t.classList.remove('show'), 2600);
}

export function buildNav() {
  const nav = document.getElementById('nav');
  const items = session.centerId ? centerNav : mainNav;

  nav.innerHTML = items.map(([id, ic, label]) =>
    `<button class="nav-btn" data-page="${id}"><span class="icon">${ic}</span>${label}</button>`
  ).join('');

  nav.querySelectorAll('.nav-btn').forEach(b =>
    b.addEventListener('click', () => showPage(b.dataset.page))
  );

  document.getElementById('roleChip').textContent = session.role === 'main' ? 'Main Owner' : 'Center Owner';
  document.getElementById('backCentersBtn').classList.toggle('hidden', !(session.role === 'main' && session.centerId));
  document.getElementById('centerChip').classList.toggle('hidden', !session.centerId);

  if (session.centerId) {
    document.getElementById('centerChip').textContent = centerById(session.centerId)?.name || '';
  }
}

export function showPage(id) {
  if (id === 'centersPage' && session.role !== 'main') return;

  document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === id));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.page === id));

  if (id === 'centersPage') {
    renderCenters({
      enterCenter,
      openCenterForm: centerControls.openCenterForm,
      deleteCenter: (cid) => deleteCenterAction(cid, { showToast, renderAll })
    });
  }
  if (id === 'farmersPage') {
    renderFarmers({
      openFarmerForm: farmerControls.openFarmerForm,
      showToast,
      renderAll
    });
  }
  if (id === 'collectionPage') {
    renderCollectionPage({ updateCalc: collectionControls.updateCalc });
  }
  if (id === 'advancesPage') {
    renderAdvances({ showToast, renderAll });
  }
  if (id === 'tsPage') {
    renderTS();
  }
  if (id === 'billsPage') {
    renderBillSelectors();
    renderBillSheet();
  }
  if (id === 'reportsPage') {
    renderReports();
  }
  if (id === 'overviewPage') {
    renderCenterOverview();
  }
}

export function enterCenter(centerId) {
  if (!centerById(centerId)) return showToast('Center not found.');
  session.centerId = centerId;
  buildNav();
  renderAll();
  showPage('overviewPage');
}

export function renderCenterOverview() {
  if (!session.centerId) return;

  const c = centerById(session.centerId);
  const farmers = scopedFarmers();
  const col = scopedCollections();
  const cycle = getCycle();

  const cycleRows = col.filter(x => x.date >= cycle.startDate && x.date <= cycle.endDate);
  const liters = cycleRows.reduce((s, x) => s + Number(x.liters), 0);
  const cycleAdvances = scopedAdvances()
    .filter(a => a.date >= cycle.startDate && a.date <= cycle.endDate)
    .reduce((s, a) => s + Number(a.amount), 0);

  document.getElementById('overviewTitle').textContent = c?.name || 'Center Dashboard';
  document.getElementById('cycleText').textContent = cycle.label;
  document.getElementById('overviewTS').textContent = fmt(state.ts);

  document.getElementById('centerStats').innerHTML = `
    <div class="stat"><div class="k">Farmers</div><div class="v">${farmers.length}</div><div class="s">Registered in this center</div></div>
    <div class="stat"><div class="k">Cycle Liters</div><div class="v">${fmt(liters)}</div><div class="s">${cycle.label}</div></div>
    <div class="stat"><div class="k">Entries</div><div class="v">${cycleRows.length}</div><div class="s">Morning + Evening</div></div>
    <div class="stat"><div class="k">Cycle Advances</div><div class="v" style="font-size:23px">${money(cycleAdvances)}</div><div class="s">Deducted from farmer bills</div></div>
  `;
}

export function renderTS() {
  document.getElementById('tsValueBig').textContent = fmt(state.ts);
  document.getElementById('overviewTS').textContent = fmt(state.ts);
  document.getElementById('calcTS').textContent = fmt(state.ts);

  const allowed = (session.role === 'main');
  const input = document.getElementById('newTS');
  const btn = document.getElementById('saveTSBtn');

  input.disabled = !allowed;
  btn.disabled = !allowed;
  btn.style.opacity = allowed ? '1' : '.5';
  document.getElementById('tsPermissionText').textContent = allowed
    ? 'You have permission to update TS.'
    : 'Read only. Contact Main Owner to change TS.';
}

export function setupTS() {
  const saveTSBtn = document.getElementById('saveTSBtn');
  saveTSBtn.addEventListener('click', async () => {
    if (session.role !== 'main') return showToast('TS can be changed only by Main Owner.');
    const v = Number(document.getElementById('newTS').value);
    if (!Number.isFinite(v) || v <= 0) return showToast('Enter a valid TS value.');

    state.ts = v;
    saveCachedState();
    document.getElementById('newTS').value = '';
    renderAll();
    showToast(`TS updated to ${fmt(v)}.`);

    try {
      await syncTS(v);
    } catch (err) {
      console.warn('TS cloud sync note:', err);
    }
  });
}

export function renderAll() {
  renderCenters({
    enterCenter,
    openCenterForm: centerControls?.openCenterForm,
    deleteCenter: (cid) => deleteCenterAction(cid, { showToast, renderAll })
  });
  renderTS();
  renderFarmers({
    openFarmerForm: farmerControls?.openFarmerForm,
    showToast,
    renderAll
  });
  renderCollectionPage({ updateCalc: collectionControls?.updateCalc });
  renderAdvances({ showToast, renderAll });
  renderCenterOverview();
  renderBillSelectors();
  renderBillSheet();
  renderReports();
}

// App Initialization
document.addEventListener('DOMContentLoaded', () => {
  // Set logo images to local high-res asset
  document.querySelectorAll('.logo-mark, .bill-logo-img').forEach(img => {
    img.src = 'assets/logo.png';
  });

  // Load cached state immediately
  const cached = loadCachedState();
  Object.assign(state, cached);

  // Initialize Subsystems
  centerControls = setupCenters({ showToast, renderAll, showPage, enterCenter, openFarmerForm: (f) => farmerControls.openFarmerForm(f) });
  farmerControls = setupFarmers({ showToast, renderAll });
  collectionControls = setupCollections({ showToast, renderAll });
  setupAdvances({ showToast, renderAll });
  setupBilling();
  setupReports({ showToast });
  setupBackup({ showToast, renderAll, showPage });
  setupTS();

  // Navigation "← Centers" button
  document.getElementById('backCentersBtn').addEventListener('click', () => {
    if (session.role !== 'main') return;
    session.centerId = null;
    buildNav();
    renderAll();
    showPage('centersPage');
  });

  // Cross-center edit bank event
  window.addEventListener('alviya:editFarmerBank', e => {
    const f = e.detail?.farmer;
    if (!f) return;
    session.centerId = f.centerId;
    buildNav();
    renderAll();
    showPage('farmersPage');
    farmerControls.openFarmerForm(f);
  });

  // Setup Auth
  setupAuth({
    onLoginSuccess: () => {},
    onLogout: () => {},
    showToast,
    buildNav,
    renderAll,
    showPage,
    enterCenter
  });
});
