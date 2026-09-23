/**
 * ALVIYA DAIRY - Backup & Export Controller
 * Excel generation, PDF printing, JSON full backup, and backup restoration.
 */

import { state, scopedCollections, farmerById, centerById, saveCachedState } from './state.js';
import { fmt, todayISO } from './calculations.js';
import { downloadCSV, downloadBlob } from './reports.js';

export function setupBackup({ showToast, renderAll, showPage }) {
  const excelBtn = document.getElementById('excelBtn');
  const pdfBtn = document.getElementById('pdfBtn');
  const jsonBtn = document.getElementById('jsonBtn');
  const restoreBtn = document.getElementById('restoreBtn');
  const restoreInput = document.getElementById('restoreInput');

  // Excel Export
  excelBtn.addEventListener('click', () => {
    exportExcel(scopedCollections(), 'ALVIYA_Dairy_Collection', showToast);
  });

  // PDF Print
  pdfBtn.addEventListener('click', () => {
    showPage('billsPage');
    setTimeout(() => window.print(), 300);
  });

  // JSON Export
  jsonBtn.addEventListener('click', () => {
    const backupData = {
      ts: state.ts,
      centers: state.centers,
      farmers: state.farmers,
      collections: state.collections,
      advances: state.advances,
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `ALVIYA_Dairy_Backup_${todayISO()}.json`);
    showToast('JSON backup downloaded.');
  });

  // JSON Restore
  restoreBtn.addEventListener('click', () => {
    restoreInput.click();
  });

  restoreInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const d = JSON.parse(reader.result);
        if (!Array.isArray(d.centers) || !Array.isArray(d.farmers) || !Array.isArray(d.collections)) {
          throw new Error('Invalid backup schema');
        }

        state.ts = Number(d.ts ?? 2.80);
        state.centers = d.centers;
        state.farmers = d.farmers;
        state.collections = d.collections;
        state.advances = Array.isArray(d.advances) ? d.advances : [];

        saveCachedState();
        renderAll();
        showToast('Backup restored successfully.');
      } catch (err) {
        showToast('Invalid ALVIYA DAIRY backup file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });
}

export function dailyExcelRows(collections) {
  const map = {};
  collections.forEach(x => {
    const f = farmerById(x.farmerId);
    const c = centerById(x.centerId);
    const key = [x.centerId, x.farmerId, x.date].join('|');

    map[key] ??= {
      Date: x.date,
      Center: c?.name || '',
      Milk_Number: f?.milkNo || '',
      Farmer: f?.name || '',
      Morning: 0,
      Evening: 0,
      FAT_num: 0,
      SNF_num: 0,
      Rate_num: 0,
      Liters: 0,
      Amount: 0
    };

    const r = map[key];
    if (x.session === 'Morning') r.Morning += Number(x.liters);
    else r.Evening += Number(x.liters);

    r.FAT_num += Number(x.fat) * Number(x.liters);
    r.SNF_num += Number(x.snf) * Number(x.liters);
    r.Rate_num += Number(x.rate) * Number(x.liters);
    r.Liters += Number(x.liters);
    r.Amount += Number(x.amount);
  });

  return Object.values(map)
    .sort((a, b) => a.Date.localeCompare(b.Date))
    .map(r => ({
      Date: r.Date,
      Morning: Number(fmt(r.Morning)),
      Evening: Number(fmt(r.Evening)),
      FAT: Number(fmt(r.Liters ? r.FAT_num / r.Liters : 0, 1)),
      SNF: Number(fmt(r.Liters ? r.SNF_num / r.Liters : 0, 1)),
      Rate: Number(fmt(r.Liters ? r.Rate_num / r.Liters : 0)),
      Amount: Number(fmt(r.Amount)),
      Milk_Number: r.Milk_Number,
      Farmer: r.Farmer,
      Center: r.Center
    }));
}

export function exportExcel(collections, fileName, showToast) {
  const rows = dailyExcelRows(collections);
  if (!rows.length) {
    if (showToast) showToast('No data available to export.');
    return;
  }

  if (window.XLSX) {
    const ws = window.XLSX.utils.json_to_sheet(rows, {
      header: ['Date', 'Morning', 'Evening', 'FAT', 'SNF', 'Rate', 'Amount', 'Milk_Number', 'Farmer', 'Center']
    });
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, 'Milk Collection');
    window.XLSX.writeFile(wb, `${fileName}.xlsx`);
    if (showToast) showToast('Excel file exported.');
  } else {
    downloadCSV(rows, `${fileName}.csv`, showToast);
  }
}
