/**
 * ALVIYA DAIRY - Milk Collection Controller
 * Session switching, live rate & amount calculation, and historical TS preservation.
 */

import { state, session, uiState, scopedFarmers, scopedCollections, farmerById, saveCachedState } from './state.js';
import { uid, money, fmt, todayISO, calculateRate, calculateAmount, escapeHtml } from './calculations.js';
import { syncCollection } from './supabase.js';

export function setupCollections({ showToast, renderAll }) {
  const morningBtn = document.getElementById('morningBtn');
  const eveningBtn = document.getElementById('eveningBtn');
  const collectionForm = document.getElementById('collectionForm');

  const litersInput = document.getElementById('liters');
  const fatInput = document.getElementById('fat');
  const snfInput = document.getElementById('snf');

  // Session buttons
  morningBtn.addEventListener('click', () => {
    uiState.collectionSession = 'Morning';
    morningBtn.classList.add('active');
    eveningBtn.classList.remove('active');
  });

  eveningBtn.addEventListener('click', () => {
    uiState.collectionSession = 'Evening';
    eveningBtn.classList.add('active');
    morningBtn.classList.remove('active');
  });

  // Live calculation as user types
  [litersInput, fatInput, snfInput].forEach(inp => {
    inp.addEventListener('input', updateCalc);
  });

  collectionForm.addEventListener('submit', async e => {
    e.preventDefault();
    if (!session.centerId) return showToast('Select a center first.');

    const farmerId = document.getElementById('collectionFarmer').value;
    const date = document.getElementById('collectionDate').value;
    const liters = Number(litersInput.value);
    const fat = Number(fatInput.value);
    const snf = Number(snfInput.value);

    if (!farmerId || !date || liters <= 0) {
      return showToast('Complete all collection fields with valid values.');
    }

    const duplicate = state.collections.some(
      x => x.centerId === session.centerId &&
           x.farmerId === farmerId &&
           x.date === date &&
           x.session === uiState.collectionSession
    );

    if (duplicate) {
      return showToast(`${uiState.collectionSession} entry already exists for this farmer on this date.`);
    }

    // Rate = (FAT + SNF) × Current TS
    const currentTS = Number(state.ts);
    const rate = calculateRate(fat, snf, currentTS);
    const amount = calculateAmount(rate, liters);

    const newRecord = {
      id: uid('milk'),
      centerId: session.centerId,
      farmerId,
      date,
      session: uiState.collectionSession,
      liters,
      fat,
      snf,
      ts: currentTS, // Frozen TS at time of collection
      rate,
      amount
    };

    state.collections.push(newRecord);
    saveCachedState();

    litersInput.value = '';
    fatInput.value = '';
    snfInput.value = '';
    updateCalc();
    renderAll();
    showToast(`Milk collection saved for ${uiState.collectionSession}.`);

    try {
      await syncCollection(newRecord);
    } catch (err) {
      console.warn('Collection cloud sync note:', err);
    }
  });

  function updateCalc() {
    const l = Number(litersInput.value || 0);
    const f = Number(fatInput.value || 0);
    const s = Number(snfInput.value || 0);
    const currentTS = Number(state.ts || 2.80);
    const rate = calculateRate(f, s, currentTS);
    const amount = calculateAmount(rate, l);

    document.getElementById('calcTS').textContent = fmt(currentTS);
    document.getElementById('calcRate').textContent = money(rate);
    document.getElementById('calcAmount').textContent = money(amount);
  }

  return { updateCalc };
}

export function renderCollectionPage({ updateCalc }) {
  const select = document.getElementById('collectionFarmer');
  const farmers = scopedFarmers();
  const oldVal = select.value;

  select.innerHTML = '<option value="">Select farmer</option>' +
    farmers.map(f => `<option value="${f.id}">${escapeHtml(f.milkNo)} - ${escapeHtml(f.name)}</option>`).join('');
  if (farmers.some(f => f.id === oldVal)) select.value = oldVal;

  if (!document.getElementById('collectionDate').value) {
    document.getElementById('collectionDate').value = todayISO();
  }

  if (updateCalc) updateCalc();

  const rows = scopedCollections()
    .slice()
    .sort((a, b) => (b.date + b.id).localeCompare(a.date + a.id))
    .slice(0, 30);

  const body = document.getElementById('collectionTbody');
  body.innerHTML = rows.length ? rows.map(x => {
    const f = farmerById(x.farmerId);
    return `<tr>
      <td>${x.date}</td>
      <td>${escapeHtml(f?.milkNo || '')}</td>
      <td>${escapeHtml(f?.name || '')}</td>
      <td><span class="badge ${x.session === 'Morning' ? 'badge-blue' : 'badge-green'}">${x.session}</span></td>
      <td class="num">${fmt(x.liters)}</td>
      <td class="num">${fmt(x.fat, 1)}</td>
      <td class="num">${fmt(x.snf, 1)}</td>
      <td class="num">${money(x.rate)}</td>
      <td class="num"><b>${money(x.amount)}</b></td>
    </tr>`;
  }).join('') : `<tr><td colspan="9" class="empty">No collection records yet.</td></tr>`;
}
