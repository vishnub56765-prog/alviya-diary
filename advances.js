/**
 * ALVIYA DAIRY - Advance Payments Controller
 * Main Owner advance entry, cycle mapping, and Center Owner read-only authorization.
 */

import { state, session, scopedFarmers, scopedAdvances, farmerById, saveCachedState } from './state.js';
import { uid, money, todayISO, getCycle, escapeHtml } from './calculations.js';
import { syncAdvance, deleteAdvanceCloud } from './supabase.js';

export function setupAdvances({ showToast, renderAll }) {
  const advanceForm = document.getElementById('advanceForm');

  advanceForm.addEventListener('submit', async e => {
    e.preventDefault();
    if (session.role !== 'main') {
      return showToast('Only Main Owner can record advance payments.');
    }
    if (!session.centerId) {
      return showToast('Select a center first.');
    }

    const farmerId = document.getElementById('advanceFarmer').value;
    const date = document.getElementById('advanceDate').value;
    const amount = Number(document.getElementById('advanceAmount').value);
    const note = document.getElementById('advanceNote').value.trim();

    const farmer = farmerById(farmerId);
    if (!farmer || farmer.centerId !== session.centerId) {
      return showToast('Select a valid farmer.');
    }
    if (!date || !Number.isFinite(amount) || amount <= 0) {
      return showToast('Enter a valid advance date and amount.');
    }

    const newAdvance = {
      id: uid('advance'),
      centerId: session.centerId,
      farmerId,
      date,
      amount,
      note,
      createdBy: 'Main Owner',
      createdAt: new Date().toISOString()
    };

    state.advances.push(newAdvance);
    saveCachedState();

    document.getElementById('advanceAmount').value = '';
    document.getElementById('advanceNote').value = '';
    renderAll();
    showToast(`Advance ${money(amount)} saved for ${farmer.name}.`);

    try {
      await syncAdvance(newAdvance);
    } catch (err) {
      console.warn('Advance cloud sync note:', err);
    }
  });
}

export function renderAdvances({ showToast, renderAll }) {
  if (!session.centerId) return;

  const farmers = scopedFarmers();
  const sel = document.getElementById('advanceFarmer');
  const old = sel.value;

  sel.innerHTML = '<option value="">Select farmer</option>' +
    farmers.map(f => `<option value="${f.id}">${escapeHtml(f.milkNo)} - ${escapeHtml(f.name)}</option>`).join('');
  if (farmers.some(f => f.id === old)) sel.value = old;

  if (!document.getElementById('advanceDate').value) {
    document.getElementById('advanceDate').value = todayISO();
  }

  const editable = (session.role === 'main');
  document.getElementById('advanceFormCard').classList.toggle('hidden', !editable);
  document.getElementById('advanceReadonlyBanner').classList.toggle('hidden', editable);

  const current = getCycle();
  const currentAdvance = scopedAdvances()
    .filter(a => a.date >= current.startDate && a.date <= current.endDate)
    .reduce((s, a) => s + Number(a.amount), 0);

  document.getElementById('advanceCycleTotal').textContent = money(currentAdvance);
  document.getElementById('advanceCycleLabel').textContent = current.label;

  const rows = scopedAdvances()
    .slice()
    .sort((a, b) => (b.date + (b.createdAt || '')).localeCompare(a.date + (a.createdAt || '')));

  const body = document.getElementById('advanceTbody');
  body.innerHTML = rows.length ? rows.map(a => {
    const f = farmerById(a.farmerId);
    const cy = getCycle(a.date);
    const del = editable
      ? `<button class="btn btn-danger btn-sm" data-delete-advance="${a.id}">Delete</button>`
      : '<span class="badge badge-gray">Read only</span>';

    return `<tr>
      <td>${a.date}</td>
      <td>${escapeHtml(cy.label)}</td>
      <td><b>${escapeHtml(f?.milkNo || '-')}</b></td>
      <td>${escapeHtml(f?.name || '-')}</td>
      <td class="num"><b>${money(a.amount)}</b></td>
      <td>${escapeHtml(a.note || '-')}</td>
      <td>${escapeHtml(a.createdBy || 'Main Owner')}</td>
      <td>${del}</td>
    </tr>`;
  }).join('') : `<tr><td colspan="8" class="empty">No advance payments recorded for this center.</td></tr>`;

  body.querySelectorAll('[data-delete-advance]').forEach(btn =>
    btn.addEventListener('click', async () => {
      if (session.role !== 'main') return showToast('Only Main Owner can delete advances.');
      const id = btn.dataset.deleteAdvance;
      const a = state.advances.find(x => x.id === id);
      if (!a) return;
      if (!confirm(`Delete advance ${money(a.amount)}?`)) return;

      state.advances = state.advances.filter(x => x.id !== id);
      saveCachedState();
      renderAll();
      showToast('Advance deleted.');

      try {
        await deleteAdvanceCloud(id);
      } catch (err) {
        console.warn('Advance delete cloud note:', err);
      }
    })
  );
}
