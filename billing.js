/**
 * ALVIYA DAIRY - Professional A4 Farmer Billing Controller
 * 10-day automatic billing cycles, split morning/evening tables, advance deduction, and QR code verification.
 */

import { state, session, scopedFarmers, scopedCollections, scopedAdvances, farmerById, centerById } from './state.js';
import { money, fmt, todayISO, previousCycles, escapeHtml } from './calculations.js';

export function setupBilling() {
  const printBillBtn = document.getElementById('printBillBtn');
  const billFarmer = document.getElementById('billFarmer');
  const billCycle = document.getElementById('billCycle');

  printBillBtn.addEventListener('click', () => {
    window.print();
  });

  billFarmer.addEventListener('change', renderBillSheet);
  billCycle.addEventListener('change', renderBillSheet);
}

export function renderBillSelectors() {
  const farmers = scopedFarmers();
  const farmerSel = document.getElementById('billFarmer');
  const oldFarmer = farmerSel.value;

  farmerSel.innerHTML = '<option value="">Select farmer</option>' +
    farmers.map(f => `<option value="${f.id}">${escapeHtml(f.milkNo)} - ${escapeHtml(f.name)}</option>`).join('');

  if (farmers.some(f => f.id === oldFarmer)) {
    farmerSel.value = oldFarmer;
  } else if (farmers[0]) {
    farmerSel.value = farmers[0].id;
  }

  const cycles = previousCycles(8);
  const cycleSel = document.getElementById('billCycle');
  const oldCycle = cycleSel.value;

  cycleSel.innerHTML = cycles.map(c => `<option value="${c.startDate}|${c.endDate}">${c.label}</option>`).join('');
  if ([...cycleSel.options].some(o => o.value === oldCycle)) {
    cycleSel.value = oldCycle;
  }
}

export function renderBillSheet() {
  const farmerId = document.getElementById('billFarmer').value;
  const cycleVal = document.getElementById('billCycle').value;
  const farmer = farmerById(farmerId);
  const center = centerById(session.centerId);

  const [start, end] = (cycleVal || '|').split('|');
  const cycleText = document.getElementById('billCycle').selectedOptions[0]?.text || '-';

  // Header and Metadata
  document.getElementById('billCenterName').textContent = center?.name || 'ALVIYA DAIRY Center';
  document.getElementById('billPeriodText').textContent = cycleText;
  document.getElementById('billMilkNo').textContent = farmer?.milkNo || '-';
  document.getElementById('billFarmerName').textContent = farmer?.name || '-';
  document.getElementById('billGenerated').textContent = todayISO();

  // Bank Info
  document.getElementById('billBankHolder').textContent = farmer?.bankHolder || '-';
  document.getElementById('billBankName').textContent = farmer?.bankName || '-';
  document.getElementById('billBankAccount').textContent = farmer?.bankAccount || '-';
  document.getElementById('billBankIfsc').textContent = farmer?.bankIfsc || '-';
  document.getElementById('billBankBranch').textContent = farmer?.bankBranch || '-';

  // Filter collections for this farmer in this cycle
  const col = scopedCollections().filter(
    x => x.farmerId === farmerId && x.date >= start && x.date <= end
  );

  const morningRows = col.filter(x => x.session === 'Morning').sort((a, b) => a.date.localeCompare(b.date));
  const eveningRows = col.filter(x => x.session === 'Evening').sort((a, b) => a.date.localeCompare(b.date));

  const mBody = document.getElementById('morningBillTbody');
  const eBody = document.getElementById('eveningBillTbody');

  mBody.innerHTML = morningRows.length ? morningRows.map(r => `
    <tr>
      <td>${r.date.slice(5)}</td>
      <td class="num">${fmt(r.liters)}</td>
      <td class="num">${fmt(r.fat, 1)}</td>
      <td class="num">${fmt(r.snf, 1)}</td>
      <td class="num">${money(r.rate)}</td>
      <td class="num"><b>${money(r.amount)}</b></td>
    </tr>
  `).join('') : `<tr><td colspan="6" class="empty">No morning entries</td></tr>`;

  eBody.innerHTML = eveningRows.length ? eveningRows.map(r => `
    <tr>
      <td>${r.date.slice(5)}</td>
      <td class="num">${fmt(r.liters)}</td>
      <td class="num">${fmt(r.fat, 1)}</td>
      <td class="num">${fmt(r.snf, 1)}</td>
      <td class="num">${money(r.rate)}</td>
      <td class="num"><b>${money(r.amount)}</b></td>
    </tr>
  `).join('') : `<tr><td colspan="6" class="empty">No evening entries</td></tr>`;

  document.getElementById('morningCount').textContent = `${morningRows.length} entries`;
  document.getElementById('eveningCount').textContent = `${eveningRows.length} entries`;

  const mLiters = morningRows.reduce((s, x) => s + Number(x.liters), 0);
  const mAmount = morningRows.reduce((s, x) => s + Number(x.amount), 0);
  const eLiters = eveningRows.reduce((s, x) => s + Number(x.liters), 0);
  const eAmount = eveningRows.reduce((s, x) => s + Number(x.amount), 0);

  const totalLiters = mLiters + eLiters;
  const grossAmount = mAmount + eAmount;

  // Advances for this farmer within this billing cycle
  const advances = scopedAdvances().filter(
    a => a.farmerId === farmerId && a.date >= start && a.date <= end
  );
  const advanceAmount = advances.reduce((s, a) => s + Number(a.amount), 0);
  const advanceBalance = Math.max(0, advanceAmount - grossAmount);
  const netAmount = Math.max(0, grossAmount - advanceAmount);

  document.getElementById('morningBillLiters').textContent = `${fmt(mLiters)} L`;
  document.getElementById('morningBillAmount').textContent = money(mAmount);
  document.getElementById('eveningBillLiters').textContent = `${fmt(eLiters)} L`;
  document.getElementById('eveningBillAmount').textContent = money(eAmount);

  document.getElementById('billLiters').textContent = `${fmt(totalLiters)} L`;
  document.getElementById('billGrossAmount').textContent = money(grossAmount);
  document.getElementById('billAdvanceAmount').textContent = `− ${money(advanceAmount)}`;
  document.getElementById('billAmount').textContent = money(netAmount);

  const balanceRow = document.getElementById('billAdvanceBalanceRow');
  balanceRow.classList.toggle('hidden', advanceBalance <= 0);
  document.getElementById('billAdvanceBalance').textContent = money(advanceBalance);

  const noteEl = document.getElementById('billAdvanceNote');
  if (advances.length) {
    noteEl.innerHTML = `Advance(s): ${advances.map(a => `${a.date} — ${money(a.amount)}`).join(' &nbsp; • &nbsp; ')}`;
    noteEl.className = 'bill-advance-note advance-positive';
  } else {
    noteEl.textContent = 'No advance recorded for this billing cycle.';
    noteEl.className = 'bill-advance-note advance-zero';
  }

  // QR Verification Code
  renderQR(`ALVIYA|${farmer?.milkNo || '-'}|${start || '-'}|${end || '-'}|${fmt(totalLiters)}|${fmt(grossAmount)}|ADV:${fmt(advanceAmount)}|NET:${fmt(netAmount)}`);
}

function renderQR(text) {
  const el = document.getElementById('qrcode');
  if (!el) return;
  el.innerHTML = '';

  if (window.QRCode) {
    new window.QRCode(el, {
      text,
      width: 74,
      height: 74,
      correctLevel: window.QRCode.CorrectLevel.M
    });
  } else {
    // Elegant SVG fallback QR pattern
    el.innerHTML = `
      <svg viewBox="0 0 74 74" width="74" height="74">
        <rect width="74" height="74" fill="white"/>
        <g fill="#10233c">
          <rect x="4" y="4" width="22" height="22"/>
          <rect x="48" y="4" width="22" height="22"/>
          <rect x="4" y="48" width="22" height="22"/>
          <rect x="31" y="31" width="8" height="8"/>
          <rect x="43" y="33" width="7" height="7"/>
          <rect x="31" y="48" width="7" height="7"/>
          <rect x="55" y="45" width="8" height="8"/>
          <rect x="44" y="58" width="5" height="5"/>
        </g>
      </svg>`;
  }
}
