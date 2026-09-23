/**
 * ALVIYA DAIRY - Center Management Controller
 * Main Owner center creation, editing, deletion, and cross-center bank management.
 */

import { state, session, centerById, farmerById, saveCachedState } from './state.js';
import { uid, maskAccount, escapeHtml } from './calculations.js';
import { rpcCreateCenter, rpcUpdateCenter, rpcDeleteCenter, loadCloudState } from './supabase.js';

export function setupCenters({ showToast, renderAll, showPage, enterCenter, openFarmerForm }) {
  const addCenterBtn = document.getElementById('addCenterBtn');
  const closeCenterFormBtn = document.getElementById('closeCenterForm');
  const generateCodeBtn = document.getElementById('generateCenterCodeBtn');
  const centerForm = document.getElementById('centerForm');

  addCenterBtn.addEventListener('click', () => openCenterForm());
  closeCenterFormBtn.addEventListener('click', closeCenterForm);

  generateCodeBtn.addEventListener('click', () => {
    const name = document.getElementById('newCenterName').value.trim();
    const base = (name || 'CENTER')
      .replace(/\bcenter\b/ig, '')
      .replace(/[^a-z0-9]/gi, '')
      .toUpperCase()
      .slice(0, 10) || 'CENTER';

    let code = '';
    do {
      code = base + String(Math.floor(10 + Math.random() * 90));
    } while (state.centers.some(c => c.code === code));

    document.getElementById('newCenterCode').value = code;
    const randomHex = crypto.getRandomValues(new Uint32Array(1))[0].toString(36).toUpperCase();
    document.getElementById('newCenterRecovery').value = `${code}-RESET-${randomHex}`;

    if (!document.getElementById('newCenterPassword').value) {
      document.getElementById('newCenterPassword').value = base.slice(0, 1) + base.slice(1).toLowerCase() + '@123';
    }
  });

  centerForm.addEventListener('submit', async e => {
    e.preventDefault();
    if (session.role !== 'main') return showToast('Only Main Owner can manage centers.');

    const editId = document.getElementById('editCenterId').value;
    const name = document.getElementById('newCenterName').value.trim();
    const code = document.getElementById('newCenterCode').value.trim().toUpperCase().replace(/\s+/g, '');
    const password = document.getElementById('newCenterPassword').value;
    const recoveryCode = document.getElementById('newCenterRecovery').value.trim().toUpperCase().replace(/\s+/g, '');

    if (!name) return showToast('Enter the center name.');
    if (code.length < 4) return showToast('Center ID must contain at least 4 characters.');
    if (!/^[A-Z0-9_-]+$/.test(code)) return showToast('Center ID can use letters, numbers, - and _ only.');
    if (!editId && password.length < 6) return showToast('Center password must contain at least 6 characters.');
    if (!editId && recoveryCode.length < 6) return showToast('Recovery code must contain at least 6 characters.');
    if (editId && password && password.length < 6) return showToast('New center password must contain at least 6 characters.');
    if (editId && recoveryCode && recoveryCode.length < 6) return showToast('New recovery code must contain at least 6 characters.');

    try {
      showToast(editId ? 'Updating center...' : 'Creating center...');

      if (editId) {
        await rpcUpdateCenter(editId, name, code, password, recoveryCode);
        const c = centerById(editId);
        if (c) {
          c.name = name;
          c.code = code;
          if (recoveryCode) c.recoveryCode = recoveryCode;
        }
        showToast('Center updated securely.');
      } else {
        const res = await rpcCreateCenter(name, code, password, recoveryCode);
        const newId = res?.center?.id || uid('center');
        state.centers.push({
          id: newId,
          name,
          code,
          recoveryCode,
          createdAt: new Date().toISOString()
        });
        showToast('Center created successfully.');
      }

      saveCachedState();
      closeCenterForm();

      try {
        await loadCloudState();
      } catch (err) {
        console.warn('Post-center-save reload note:', err);
      }

      renderAll();
    } catch (err) {
      showToast(err.message || 'Unable to save center.');
    }
  });

  // Cross-center bank search & filter listeners
  document.getElementById('mainBankCenterFilter').addEventListener('change', renderMainDashboardBankDetails);
  document.getElementById('mainBankSearch').addEventListener('input', renderMainDashboardBankDetails);
  document.getElementById('mainBankStatusFilter').addEventListener('change', renderMainDashboardBankDetails);

  function openCenterForm(center = null) {
    if (session.role !== 'main') return;
    document.getElementById('centerFormCard').classList.remove('hidden');
    document.getElementById('editCenterId').value = center?.id || '';
    document.getElementById('newCenterName').value = center?.name || '';
    document.getElementById('newCenterCode').value = center?.code || '';
    document.getElementById('newCenterPassword').value = '';
    document.getElementById('newCenterRecovery').value = '';
    document.getElementById('centerFormTitle').textContent = center ? 'Edit Center' : 'Create Center';
    document.getElementById('centerSubmitText').textContent = center ? 'Save Changes' : 'Create Center';
    setTimeout(() => document.getElementById('newCenterName').focus(), 50);
  }

  function closeCenterForm() {
    centerForm.reset();
    document.getElementById('editCenterId').value = '';
    document.getElementById('centerFormCard').classList.add('hidden');
    document.getElementById('centerFormTitle').textContent = 'Create Center';
    document.getElementById('centerSubmitText').textContent = 'Create Center';
  }

  return { openCenterForm, closeCenterForm };
}

export function renderCenters({ enterCenter, openCenterForm, deleteCenter }) {
  const wrap = document.getElementById('centerList');
  if (!state.centers.length) {
    wrap.innerHTML = `
      <div class="empty-center">
        <div class="big">🏬</div>
        <b>No centers created yet.</b>
        <div style="margin-top:6px">Click <b>+ Create Center</b> to add the first ALVIYA DAIRY center.</div>
      </div>`;
    renderMainDashboardBankDetails();
    return;
  }

  wrap.innerHTML = state.centers.map(c => `
    <div class="center-card" data-center-card="${c.id}">
      <div class="center-icon">🥛</div>
      <div class="city">${escapeHtml(c.name)}</div>
      <div class="code">
        Center ID: <b>${escapeHtml(c.code)}</b><br/>
        Password: <b>••••••••</b><br/>
        Account: <b>Cloud secured</b>
      </div>
      <div class="open"><span>Center dashboard</span><span>→</span></div>
      <div class="center-actions no-print">
        <button class="btn btn-primary btn-sm" data-open-center="${c.id}">Open</button>
        <button class="btn btn-soft btn-sm" data-edit-center="${c.id}">Edit</button>
        <button class="btn btn-danger btn-sm" data-delete-center="${c.id}">Delete</button>
      </div>
    </div>`).join('');

  wrap.querySelectorAll('[data-open-center]').forEach(b =>
    b.addEventListener('click', () => enterCenter(b.dataset.openCenter))
  );
  wrap.querySelectorAll('[data-edit-center]').forEach(b =>
    b.addEventListener('click', () => openCenterForm(centerById(b.dataset.editCenter)))
  );
  wrap.querySelectorAll('[data-delete-center]').forEach(b =>
    b.addEventListener('click', () => deleteCenter(b.dataset.deleteCenter))
  );

  renderMainDashboardBankDetails();
}

export function renderMainDashboardBankDetails() {
  const card = document.getElementById('mainDashboardBankCard');
  const body = document.getElementById('mainDashboardBankTbody');
  const centerFilter = document.getElementById('mainBankCenterFilter');
  const searchInput = document.getElementById('mainBankSearch');
  const statusFilter = document.getElementById('mainBankStatusFilter');
  if (!card || !body || !centerFilter || !searchInput || !statusFilter) return;

  const allowed = (session.role === 'main' && !session.centerId);
  card.classList.toggle('hidden', !allowed);
  if (!allowed) return;

  const oldCenter = centerFilter.value;
  centerFilter.innerHTML = '<option value="">All Centers</option>' +
    state.centers.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  if (state.centers.some(c => c.id === oldCenter)) centerFilter.value = oldCenter;

  const q = (searchInput.value || '').trim().toLowerCase();
  const status = statusFilter.value;
  let rows = state.farmers.slice();

  if (centerFilter.value) rows = rows.filter(f => f.centerId === centerFilter.value);
  if (q) rows = rows.filter(f => (f.name || '').toLowerCase().includes(q) || (f.milkNo || '').toLowerCase().includes(q));
  if (status === 'added') rows = rows.filter(f => !!(f.bankAccount && f.bankIfsc));
  if (status === 'pending') rows = rows.filter(f => !(f.bankAccount && f.bankIfsc));

  rows.sort((a, b) => {
    const ca = centerById(a.centerId)?.name || '';
    const cb = centerById(b.centerId)?.name || '';
    return ca.localeCompare(cb) || (a.milkNo || '').localeCompare(b.milkNo || '', undefined, { numeric: true });
  });

  body.innerHTML = rows.length ? rows.map(f => {
    const c = centerById(f.centerId);
    const hasBank = !!(f.bankAccount && f.bankIfsc);
    return `<tr>
      <td><b>${escapeHtml(c?.name || '-')}</b></td>
      <td>${escapeHtml(f.milkNo || '-')}</td>
      <td>${escapeHtml(f.name || '-')}</td>
      <td>${escapeHtml(f.bankHolder || '-')}</td>
      <td>${escapeHtml(f.bankName || '-')}</td>
      <td>${escapeHtml(maskAccount(f.bankAccount))}</td>
      <td>${escapeHtml(f.bankIfsc || '-')}</td>
      <td>${escapeHtml(f.bankBranch || '-')}</td>
      <td><span class="bank-chip ${hasBank ? '' : 'bank-missing'}">${hasBank ? 'Bank added' : 'Bank pending'}</span></td>
      <td><button class="btn btn-soft btn-sm" data-main-bank-edit="${f.id}">Edit Bank</button></td>
    </tr>`;
  }).join('') : `<tr><td colspan="10" class="empty">${state.farmers.length ? 'No farmers match this filter.' : 'No farmers added yet. Open a center and add a farmer to enter bank details.'}</td></tr>`;

  body.querySelectorAll('[data-main-bank-edit]').forEach(btn => btn.addEventListener('click', () => {
    const f = farmerById(btn.dataset.mainBankEdit);
    if (!f) return;
    window.dispatchEvent(new CustomEvent('alviya:editFarmerBank', { detail: { farmer: f } }));
  }));
}

export async function deleteCenterAction(centerId, { showToast, renderAll }) {
  if (session.role !== 'main') return showToast('Only Main Owner can delete centers.');
  const c = centerById(centerId);
  if (!c) return;

  const farmerCount = state.farmers.filter(f => f.centerId === centerId).length;
  const collectionCount = state.collections.filter(x => x.centerId === centerId).length;
  const detail = (farmerCount || collectionCount)
    ? `\n\nThis also removes ${farmerCount} farmer(s) and ${collectionCount} collection record(s).`
    : '';

  if (!confirm(`Delete ${c.name}?${detail}`)) return;

  try {
    showToast('Deleting center...');
    await rpcDeleteCenter(centerId);

    state.centers = state.centers.filter(x => x.id !== centerId);
    state.farmers = state.farmers.filter(x => x.centerId !== centerId);
    state.collections = state.collections.filter(x => x.centerId !== centerId);
    state.advances = state.advances.filter(x => x.centerId !== centerId);

    saveCachedState();
    renderAll();
    showToast('Center deleted.');
  } catch (err) {
    showToast(err.message || 'Unable to delete center.');
  }
}
