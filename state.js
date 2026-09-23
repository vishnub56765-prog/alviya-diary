/**
 * ALVIYA DAIRY - Central State Store
 * In-memory state with localStorage caching for offline resilience.
 */

import { CONFIG } from './config.js';

export const defaultState = {
  ts: CONFIG.DEFAULT_TS,
  centers: [],
  farmers: [],
  collections: [],
  advances: []
};

export const state = structuredClone(defaultState);

export const session = {
  role: null,         // 'main' or 'center'
  centerId: null,     // Active center UUID
  accessToken: null,
  userId: null,
  loginId: null,
  email: null
};

export const uiState = {
  collectionSession: 'Morning',
  filteredReportRows: [],
  passwordRecoveryMode: false
};

export function loadCachedState() {
  try {
    const raw = localStorage.getItem(CONFIG.STORE_KEY);
    if (!raw) return structuredClone(defaultState);
    const parsed = JSON.parse(raw);
    return {
      ts: Number(parsed.ts ?? CONFIG.DEFAULT_TS),
      centers: Array.isArray(parsed.centers) ? parsed.centers : [],
      farmers: Array.isArray(parsed.farmers) ? parsed.farmers : [],
      collections: Array.isArray(parsed.collections) ? parsed.collections : [],
      advances: Array.isArray(parsed.advances) ? parsed.advances : []
    };
  } catch (e) {
    console.warn('Failed to load local cache:', e);
    return structuredClone(defaultState);
  }
}

export function saveCachedState() {
  try {
    localStorage.setItem(CONFIG.STORE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Failed to write local cache:', e);
  }
}

export function resetState() {
  Object.assign(state, structuredClone(defaultState));
  session.role = null;
  session.centerId = null;
  session.accessToken = null;
  session.userId = null;
  session.loginId = null;
  session.email = null;
  saveCachedState();
}

export function centerById(id) {
  return state.centers.find(c => c.id === id);
}

export function farmerById(id) {
  return state.farmers.find(f => f.id === id);
}

export function scopedFarmers() {
  return session.centerId
    ? state.farmers.filter(f => f.centerId === session.centerId)
    : state.farmers;
}

export function scopedCollections() {
  return session.centerId
    ? state.collections.filter(x => x.centerId === session.centerId)
    : state.collections;
}

export function scopedAdvances() {
  return session.centerId
    ? state.advances.filter(a => a.centerId === session.centerId)
    : state.advances;
}
