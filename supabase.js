/**
 * ALVIYA DAIRY - Supabase Cloud Database Client
 * Production normalized persistence with Row Level Security and offline resilience.
 */

import { CONFIG } from './config.js';
import { state, session, saveCachedState } from './state.js';

let supabaseClient = null;

export function getSupabase() {
  if (!supabaseClient && window.supabase) {
    supabaseClient = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
  }
  return supabaseClient;
}

/**
 * Load cloud data into in-memory state.
 * Uses normalized relational queries with RLS.
 */
export async function loadCloudState() {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase client library not loaded.');

  // 1. Verify authenticated user profile
  const { data: { user }, error: authUserError } = await sb.auth.getUser();
  if (authUserError || !user) {
    throw new Error('Not authenticated.');
  }

  session.userId = user.id;
  session.email = user.email;

  // 2. Fetch user profile for role & center scoping
  const { data: profile, error: profileError } = await sb
    .from('profiles')
    .select('role, center_id, login_id')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError && profileError.code !== 'PGRST116') {
    console.warn('Profile fetch warning:', profileError);
  }

  // Determine role
  if (user.email === CONFIG.OWNER_EMAIL || profile?.role === 'owner') {
    session.role = 'main';
    session.loginId = CONFIG.OWNER_LOGIN_ID;
    session.centerId = null;
  } else if (profile?.role === 'center') {
    session.role = 'center';
    session.loginId = profile.login_id || 'CENTER-OWNER';
    session.centerId = profile.center_id || null;
  } else {
    // Default fallback based on email pattern
    if (user.email === CONFIG.OWNER_EMAIL) {
      session.role = 'main';
    } else {
      session.role = 'center';
    }
  }

  try {
    // 3. Fetch normalized tables concurrently
    const [settingsRes, centersRes, farmersRes, collectionsRes, advancesRes] = await Promise.all([
      sb.from('company_settings').select('ts').eq('id', 1).maybeSingle(),
      sb.from('centers').select('*').order('created_at', { ascending: true }),
      sb.from('farmers').select('*').order('name', { ascending: true }),
      sb.from('milk_collections').select('*').order('date', { ascending: false }),
      sb.from('advances').select('*').order('date', { ascending: false })
    ]);

    if (settingsRes.data?.ts) {
      state.ts = Number(settingsRes.data.ts);
    }

    if (centersRes.data) {
      state.centers = centersRes.data.map(c => ({
        id: c.id,
        name: c.name,
        code: c.code,
        recoveryCode: c.recovery_code,
        createdAt: c.created_at
      }));
    }

    if (farmersRes.data) {
      state.farmers = farmersRes.data.map(f => ({
        id: f.id,
        centerId: f.center_id,
        milkNo: f.milk_no,
        name: f.name,
        bankHolder: f.bank_holder || '',
        bankName: f.bank_name || '',
        bankAccount: f.bank_account || '',
        bankIfsc: f.bank_ifsc || '',
        bankBranch: f.bank_branch || ''
      }));
    }

    if (collectionsRes.data) {
      state.collections = collectionsRes.data.map(x => ({
        id: x.id,
        centerId: x.center_id,
        farmerId: x.farmer_id,
        date: x.date,
        session: x.session,
        liters: Number(x.liters),
        fat: Number(x.fat),
        snf: Number(x.snf),
        ts: Number(x.ts),
        rate: Number(x.rate),
        amount: Number(x.amount)
      }));
    }

    if (advancesRes.data) {
      state.advances = advancesRes.data.map(a => ({
        id: a.id,
        centerId: a.center_id,
        farmerId: a.farmer_id,
        date: a.date,
        amount: Number(a.amount),
        note: a.note || '',
        createdBy: a.created_by || 'Main Owner',
        createdAt: a.created_at
      }));
    }

    saveCachedState();
  } catch (cloudErr) {
    console.warn('Normalized cloud tables not accessible yet, using local cache:', cloudErr);
  }
}

/**
 * Update global TS rate multiplier in Supabase
 */
export async function syncTS(newTS) {
  const sb = getSupabase();
  if (!sb || session.role !== 'main') return;
  try {
    const { error } = await sb
      .from('company_settings')
      .upsert({ id: 1, ts: Number(newTS), updated_at: new Date().toISOString() });
    if (error) console.warn('Supabase TS update warning:', error);
  } catch (err) {
    console.warn('TS sync skipped:', err);
  }
}

/**
 * Save or update a farmer in Supabase
 */
export async function syncFarmer(farmer) {
  const sb = getSupabase();
  if (!sb) return;
  try {
    const payload = {
      id: farmer.id,
      center_id: farmer.centerId,
      milk_no: farmer.milkNo,
      name: farmer.name,
      bank_holder: farmer.bankHolder || '',
      bank_name: farmer.bankName || '',
      bank_account: farmer.bankAccount || '',
      bank_ifsc: farmer.bankIfsc || '',
      bank_branch: farmer.bankBranch || ''
    };
    const { error } = await sb.from('farmers').upsert(payload);
    if (error) console.warn('Farmer sync warning:', error);
  } catch (err) {
    console.warn('Farmer sync skipped:', err);
  }
}

/**
 * Delete a farmer from Supabase
 */
export async function deleteFarmerCloud(farmerId) {
  const sb = getSupabase();
  if (!sb) return;
  try {
    const { error } = await sb.from('farmers').delete().eq('id', farmerId);
    if (error) console.warn('Farmer delete warning:', error);
  } catch (err) {
    console.warn('Farmer delete skipped:', err);
  }
}

/**
 * Save milk collection in Supabase
 */
export async function syncCollection(col) {
  const sb = getSupabase();
  if (!sb) return;
  try {
    const payload = {
      id: col.id,
      center_id: col.centerId,
      farmer_id: col.farmerId,
      date: col.date,
      session: col.session,
      liters: col.liters,
      fat: col.fat,
      snf: col.snf,
      ts: col.ts,
      rate: col.rate,
      amount: col.amount
    };
    const { error } = await sb.from('milk_collections').upsert(payload);
    if (error) console.warn('Collection sync warning:', error);
  } catch (err) {
    console.warn('Collection sync skipped:', err);
  }
}

/**
 * Save advance in Supabase
 */
export async function syncAdvance(adv) {
  const sb = getSupabase();
  if (!sb || session.role !== 'main') return;
  try {
    const payload = {
      id: adv.id,
      center_id: adv.centerId,
      farmer_id: adv.farmerId,
      date: adv.date,
      amount: adv.amount,
      note: adv.note || '',
      created_by: adv.createdBy || 'Main Owner'
    };
    const { error } = await sb.from('advances').upsert(payload);
    if (error) console.warn('Advance sync warning:', error);
  } catch (err) {
    console.warn('Advance sync skipped:', err);
  }
}

/**
 * Delete advance from Supabase
 */
export async function deleteAdvanceCloud(advanceId) {
  const sb = getSupabase();
  if (!sb || session.role !== 'main') return;
  try {
    const { error } = await sb.from('advances').delete().eq('id', advanceId);
    if (error) console.warn('Advance delete warning:', error);
  } catch (err) {
    console.warn('Advance delete skipped:', err);
  }
}

/**
 * Call secure Center Admin RPC functions running on PostgreSQL
 */
export async function rpcCreateCenter(name, code, password, recoveryCode) {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase client unavailable.');

  // Try secure PostgreSQL RPC first
  const { data, error } = await sb.rpc('create_center_account', {
    p_name: name,
    p_code: code,
    p_password: password,
    p_recovery_code: recoveryCode
  });

  if (!error && data?.success) {
    return data;
  }

  // Fallback: If RPC not yet installed, insert into centers table directly
  const { data: inserted, error: insertError } = await sb
    .from('centers')
    .insert({
      name,
      code,
      recovery_code: recoveryCode
    })
    .select()
    .single();

  if (insertError) throw insertError;
  return { success: true, center: inserted };
}

export async function rpcUpdateCenter(centerId, name, code, password, recoveryCode) {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase client unavailable.');

  const { data, error } = await sb.rpc('update_center_account', {
    p_center_id: centerId,
    p_name: name,
    p_code: code,
    p_password: password || null,
    p_recovery_code: recoveryCode || null
  });

  if (!error && data?.success) {
    return data;
  }

  // Fallback table update
  const payload = { name, code };
  if (recoveryCode) payload.recovery_code = recoveryCode;
  const { error: updateError } = await sb.from('centers').update(payload).eq('id', centerId);
  if (updateError) throw updateError;
  return { success: true };
}

export async function rpcDeleteCenter(centerId) {
  const sb = getSupabase();
  if (!sb) throw new Error('Supabase client unavailable.');

  const { data, error } = await sb.rpc('delete_center_account', {
    p_center_id: centerId
  });

  if (!error && data?.success) {
    return data;
  }

  // Fallback direct delete
  const { error: delError } = await sb.from('centers').delete().eq('id', centerId);
  if (delError) throw delError;
  return { success: true };
}
