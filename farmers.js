/**
 * ALVIYA DAIRY - Farmer Management Controller
 * Farmer registration, milk number validation, and bank detail management.
 */

import { state, session, scopedFarmers, farmerById, centerById, saveCachedState } from './state.js';
import { uid, maskAccount, escapeHtml } from './calculations.js';
import { syncFarmer, deleteFarmerCloud } from './supabase.js';

export function setupFarmers({ showToast, renderAll }) {
  const addFarmerBtn = document.getElementById('addFarmerBtn');
  const closeFarmerFormBtn = document.getElementById('closeFarmerForm');
  const farmerForm = document.getElementById('farmerForm');

  addFarmerBtn.addEventListener('click', () => openFarmerForm());
  closeFarmerFormBtn.addEventListener('click', closeFarmerForm);

  farmerForm.addEventListener('submit', async e => {
    e.preventDefault();
    if (!session.centerId) return showToast('Select a center first.');

    const editId = document.getElementById('editFarmerId').value;
    const milkNo = document.getElementById('farmerMilkNo').value.trim();
    const name = document.getElementById('farmerName').value.trim();

    if (state.farmers.some(f => f.centerId === session.centerId && f.milkNo === milkNo && f.id !== editId)) {
      return showToast('Milk number already exists in this center.');
    }

    let farmer = editId ? farmerById(editId) : null;
    if (editId && !farmer) return showToast('Farmer not found.');

    if (!farmer) {
      farmer = {
        id: uid('farmer'),
        centerId: session.centerId,
        milkNo,
        name,
        bankHolder: '',
        bankName: '',
        bankAccount: '',
        bankIfsc: '',
        bankBranch: ''
      };
      state.farmers.push(farmer);
    } else {
      farmer.milkNo = milkNo;
      farmer.name = name;
    }

    if (session.role === 'main') {
      farmer.bankHolder = document.getElementById('bankHolder').value.trim();
      farmer.bankName = document.getElementById('bankName').value.trim();
      farmer.bankAccount = document.getElementById('bankAccount').value.trim();
      farmer.bankIfsc = document.getElementById('bankIfsc').value.trim().toUpperCase();
      farmer.bankBranch = document.getElementById('bankBranch').value.trim();
    }

    saveCachedState();
    closeFarmerForm();
    renderAll();
    showToast(editId ? 'Farmer updated.' : 'Farmer added.');

    try {
      await syncFarmer(farmer);
    } catch (err) {
      console.warn('Farmer cloud sync note:', err);
    }
  });

  function openFarmerForm(farmer = null) {
    if (!session.centerId) return showToast('Select a center first.');
    document.getElementById('farmerFormCard').classList.remove('hidden');
    document.getElementById('editFarmerId').value = farmer?.id || '';
    document.getElementById('farmerMilkNo').value = farmer?.milkNo || '';
    document.getElementById('farmerName').value = farmer?.name || '';
    document.getElementById('bankHolder').value = farmer?.bankHolder || '';
    document.getElementById('bankName').value = farmer?.bankName || '';
    document.getElementById('bankAccount').value = farmer?.bankAccount || '';
    document.getElementById('bankIfsc').value = farmer?.bankIfsc || '';
    document.getElementById('bankBranch').value = farmer?.bankBranch || '';

    const isMain = (session.role === 'main');
    document.getElementById('farmerBankFields').classList.toggle('hidden', !isMain);
    document.getElementById('farmerFormTitle').textContent = farmer ? 'Edit Farmer' : 'Add Farmer';
    document.getElementById('farmerFormNote').textContent = isMain
      ? 'Manage farmer identification and bank details.'
      : 'Create farmer identification.';
    document.getElementById('farmerSubmitText').textContent = farmer ? 'Save Changes' : 'Save Farmer';
    setTimeout(() => document.getElementById('farmerMilkNo').focus(), 50);
  }

  function closeFarmerForm() {
    farmerForm.reset();
    document.getElementById('editFarmerId').value = '';
    document.getElementById('farmerFormCard').classList.add('hidden');
    document.getElementById('farmerFormTitle').textContent = 'Add Farmer';
    document.getElementById('farmerSubmitText').textContent = 'Save Farmer';
  }

  return { openFarmerForm, closeFarmerForm };
}

export function renderFarmers({ openFarmerForm, showToast, renderAll }) {
  const rows = scopedFarmers();
  const body = document.getElementById('farmersTbody');
  document.getElementById('farmerBankFields').classList.toggle('hidden', session.role !== 'main');

  body.innerHTML = rows.length ? rows.map(f => {
    const hasBank = !!(f.bankAccount && f.bankIfsc);
    const edit = `<button class="btn btn-soft btn-sm" data-edit-farmer="${f.id}">Edit</button>`;
    const del = `<button class="btn btn-danger btn-sm" data-delete-farmer="${f.id}">Delete</button>`;
    return `<tr>
      <td><b>${escapeHtml(f.milkNo)}</b></td>
      <td>${escapeHtml(f.name)}</td>
      <td>${escapeHtml(centerById(f.centerId)?.name || '')}</td>
      <td><span class="bank-chip ${hasBank ? '' : 'bank-missing'}">${hasBank ? 'Bank added' : 'Bank pending'}</span></td>
      <td><div style="display:flex;gap:6px">${edit}${del}</div></td>
    </tr>`;
  }).join('') : `<tr><td colspan="5" class="empty">No farmers added yet.</td></tr>`;

  body.querySelectorAll('[data-edit-farmer]').forEach(btn =>
    btn.addEventListener('click', () => openFarmerForm(farmerById(btn.dataset.editFarmer)))
  );

  body.querySelectorAll('[data-delete-farmer]').forEach(btn =>
    btn.addEventListener('click', async () => {
      const id = btn.dataset.deleteFarmer;
      if (state.collections.some(x => x.farmerId === id) || state.advances.some(a => a.farmerId === id)) {
        return showToast('Cannot delete: farmer has collection or advance records.');
      }
      if (!confirm('Are you sure you want to delete this farmer?')) return;

      state.farmers = state.farmers.filter(f => f.id !== id);
      saveCachedState();
      renderAll();
      showToast('Farmer deleted.');

      try {
        await deleteFarmerCloud(id);
      } catch (err) {
        console.warn('Farmer delete cloud note:', err);
      }
    })
  );

  renderBankDetailsDashboard({ openFarmerForm });
}

export function renderBankDetailsDashboard({ openFarmerForm }) {
  const card = document.getElementById('mainOwnerBankCard');
  if (!card) return;
  const allowed = (session.role === 'main' && !!session.centerId);
  card.classList.toggle('hidden', !allowed);
  if (!allowed) return;

  const rows = scopedFarmers();
  const body = document.getElementById('bankDetailsTbody');

  body.innerHTML = rows.length ? rows.map(f => `
    <tr>
      <td><b>${escapeHtml(f.milkNo)}</b></td>
      <td>${escapeHtml(f.name)}</td>
      <td>${escapeHtml(f.bankHolder || '-')}</td>
      <td>${escapeHtml(f.bankName || '-')}</td>
      <td>${escapeHtml(maskAccount(f.bankAccount))}</td>
      <td>${escapeHtml(f.bankIfsc || '-')}</td>
      <td>${escapeHtml(f.bankBranch || '-')}</td>
      <td><button class="btn btn-soft btn-sm" data-bank-edit="${f.id}">Edit Bank</button></td>
    </tr>
  `).join('') : `<tr><td colspan="8" class="empty">No farmers added in this center.</td></tr>`;

  body.querySelectorAll('[data-bank-edit]').forEach(btn =>
    btn.addEventListener('click', () => {
      openFarmerForm(farmerById(btn.dataset.bankEdit));
    })
  );
}
