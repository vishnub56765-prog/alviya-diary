/**
 * ALVIYA DAIRY - Reports Controller
 * Multi-criteria collection search and Excel / CSV data export.
 */

import { state, session, scopedCollections, farmerById, centerById } from './state.js';
import { money, fmt, escapeHtml } from './calculations.js';

let filteredReportRows = [];

export function setupReports({ showToast }) {
  const searchBtn = document.getElementById('searchReportBtn');
  const exportBtn = document.getElementById('exportReportBtn');

  searchBtn.addEventListener('click', renderReports);

  exportBtn.addEventListener('click', () => {
    const rowsToExport = filteredReportRows.length ? filteredReportRows : scopedCollections();
    exportDetailedRows(rowsToExport, 'ALVIYA_Report', showToast);
  });
}

export function renderReports() {
  const centerSel = document.getElementById('reportCenter');
  const previousCenter = centerSel.value;

  centerSel.innerHTML = '<option value="">All Centers</option>' +
    state.centers.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');

  if (session.centerId) {
    centerSel.value = session.centerId;
    centerSel.disabled = true;
  } else {
    centerSel.disabled = false;
    if (state.centers.some(c => c.id === previousCenter)) centerSel.value = previousCenter;
  }

  const milk = (document.getElementById('reportMilkNo').value || '').trim().toLowerCase();
  const name = (document.getElementById('reportFarmer').value || '').trim().toLowerCase();
  const cid = centerSel.value;
  const date = document.getElementById('reportDate').value;

  filteredReportRows = state.collections.filter(x => {
    const f = farmerById(x.farmerId);
    const matchMilk = !milk || (f?.milkNo || '').toLowerCase().includes(milk);
    const matchName = !name || (f?.name || '').toLowerCase().includes(name);
    const matchCenter = !cid || x.centerId === cid;
    const matchDate = !date || x.date === date;
    return matchMilk && matchName && matchCenter && matchDate;
  }).sort((a, b) => b.date.localeCompare(a.date));

  const body = document.getElementById('reportsTbody');
  body.innerHTML = filteredReportRows.length ? filteredReportRows.map(x => {
    const f = farmerById(x.farmerId);
    const c = centerById(x.centerId);
    return `<tr>
      <td>${x.date}</td>
      <td>${escapeHtml(c?.name || '')}</td>
      <td>${escapeHtml(f?.milkNo || '')}</td>
      <td>${escapeHtml(f?.name || '')}</td>
      <td>${x.session}</td>
      <td class="num">${fmt(x.liters)}</td>
      <td class="num">${fmt(x.fat, 1)}</td>
      <td class="num">${fmt(x.snf, 1)}</td>
      <td class="num">${money(x.rate)}</td>
      <td class="num"><b>${money(x.amount)}</b></td>
    </tr>`;
  }).join('') : `<tr><td colspan="10" class="empty">No matching records found.</td></tr>`;
}

export function exportDetailedRows(collections, fileName, showToast) {
  const rows = collections.map(x => {
    const f = farmerById(x.farmerId);
    const c = centerById(x.centerId);
    return {
      Date: x.date,
      Center: c?.name || '',
      Milk_Number: f?.milkNo || '',
      Farmer: f?.name || '',
      Session: x.session,
      Liters: Number(fmt(x.liters)),
      FAT: Number(fmt(x.fat, 1)),
      SNF: Number(fmt(x.snf, 1)),
      Rate: Number(fmt(x.rate)),
      Amount: Number(fmt(x.amount))
    };
  });

  if (!rows.length) {
    if (showToast) showToast('No report data to export.');
    return;
  }

  if (window.XLSX) {
    const ws = window.XLSX.utils.json_to_sheet(rows);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, 'Report');
    window.XLSX.writeFile(wb, `${fileName}.xlsx`);
    if (showToast) showToast('Excel report downloaded.');
  } else {
    downloadCSV(rows, `${fileName}.csv`, showToast);
  }
}

export function downloadCSV(rows, name, showToast) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(','),
    ...rows.map(r => headers.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), name);
  if (showToast) showToast('CSV exported. Open it in Excel.');
}

export function downloadBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 300);
}
