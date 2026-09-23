/**
 * ALVIYA DAIRY - Business Logic & Calculation Engine
 * Exact formulas and automatic 10-day billing cycle computations.
 */

export function money(v) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2
  }).format(Number(v || 0));
}

export function fmt(v, n = 2) {
  return Number(v || 0).toFixed(n);
}

export function maskAccount(v = '') {
  const a = String(v || '').replace(/\s+/g, '');
  if (!a) return '-';
  return a.length <= 4 ? a : '•••• •••• ' + a.slice(-4);
}

export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function todayISO() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function escapeHtml(s = '') {
  return String(s).replace(/[&<>'"]/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[c]));
}

/**
 * EXACT MILK RATE FORMULA:
 * Rate per Liter = (FAT + SNF) × TS
 */
export function calculateRate(fat, snf, ts) {
  const f = Number(fat || 0);
  const s = Number(snf || 0);
  const t = Number(ts || 0);
  return (f + s) * t;
}

/**
 * EXACT MILK AMOUNT FORMULA:
 * Amount = Rate × Liters
 */
export function calculateAmount(rate, liters) {
  const r = Number(rate || 0);
  const l = Number(liters || 0);
  return r * l;
}

/**
 * AUTOMATIC 10-DAY BILLING CYCLE
 * Cycle 1: 1st to 10th
 * Cycle 2: 11th to 20th
 * Cycle 3: 21st to end of month (dynamically 28, 29, 30, or 31)
 */
export function getCycle(dateStr = todayISO()) {
  const d = new Date(dateStr + 'T12:00:00');
  const y = d.getFullYear();
  const m = d.getMonth();
  const day = d.getDate();
  const last = new Date(y, m + 1, 0).getDate();

  const start = day <= 10 ? 1 : day <= 20 ? 11 : 21;
  const end = day <= 10 ? 10 : day <= 20 ? 20 : last;
  const pad = n => String(n).padStart(2, '0');

  return {
    start,
    end,
    month: m + 1,
    year: y,
    label: `${pad(start)}-${pad(end)} ${d.toLocaleString('en', { month: 'short' })} ${y}`,
    startDate: `${y}-${pad(m + 1)}-${pad(start)}`,
    endDate: `${y}-${pad(m + 1)}-${pad(end)}`
  };
}

/**
 * Generate a list of recent consecutive billing cycles
 */
export function previousCycles(count = 8) {
  const arr = [];
  let cursor = new Date();
  for (let i = 0; i < count; i++) {
    const c = getCycle(new Date(cursor.getTime() - cursor.getTimezoneOffset() * 60000).toISOString().slice(0, 10));
    if (!arr.some(x => x.startDate === c.startDate)) {
      arr.push(c);
    }
    cursor = new Date(c.startDate + 'T12:00:00');
    cursor.setDate(cursor.getDate() - 1);
  }
  return arr;
}
