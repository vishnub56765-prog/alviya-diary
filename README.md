# ALVIYA DAIRY

> **Production Milk Collection, Farmer Billing and Dairy Center Management System**

ALVIYA DAIRY is a production web application engineered for dairy center operations, farmer milk recording, automatic TS rate multiplier calculations, 10-day automated billing cycles, and professional A4 farmer bill generation with verification QR codes.

---

## 🌟 Key Highlights & Design Integrity

- **Authoritative Visual Reference**: Faithfully preserves the complete brand design, logo, blue/white/green premium color palette, glassmorphism cards, floating background animations, typography, and responsive layouts from `index(9)(2).html`.
- **Unified Login System**: A single, clean login page for both **Main Owner** and **Center Owners**.
  - **Main Owner ID**: `ALVIYA-MAIN` (authenticated via registered email: `vishnub56765@gmail.com`).
  - **Center Owner ID**: Center ID (e.g. `KARUR01`, `CENTER01`) + assigned password.
- **Strict Data Isolation**: Built on **Supabase Row Level Security (RLS)**. Center Owners have access strictly to their own center's data, while the Main Owner has oversight across all centers.
- **Historic Rate Preservation**: Milk collections store the exact TS multiplier used at collection time. Subsequent TS updates never silently alter historical transactions.
- **Professional A4 Farmer Bill**: Optimized print layout split into Morning and Evening sessions, subtotals, gross milk amount, advance payment deductions, advance balance tracking, net payable, and verification QR code.

---

## 📁 Project Structure

```
alviya-dairy/
├── index.html              # Main application entrypoint with authoritative layout
├── assets/
│   └── logo.png            # Official ALVIYA DAIRY high-resolution brand logo
├── css/
│   └── styles.css          # Glassmorphism, animations, responsive design & A4 print CSS
├── js/
│   ├── config.js           # Supabase credentials, endpoints, and constants
│   ├── calculations.js     # Business logic, exact milk formulas & 10-day cycles
│   ├── state.js            # In-memory reactive state and local cache management
│   ├── supabase.js         # Normalized cloud queries, updates, and RPC calls
│   ├── auth.js             # Unified login, role authorization, and password reset
│   ├── centers.js          # Main Owner center creation, editing, and deletion
│   ├── farmers.js          # Farmer registration and private bank detail management
│   ├── collections.js      # Morning/evening collection entry with live calculations
│   ├── advances.js         # Farmer advance payments and billing cycle deductions
│   ├── billing.js          # A4 bill generation, QR rendering, and PDF printing
│   ├── reports.js          # Multi-filter search, detailed tables, and Excel export
│   ├── backup.js           # Excel, PDF, JSON full backup, and restoration
│   └── app.js              # Application coordinator and navigation router
├── supabase/
│   ├── schema.sql          # Normalized PostgreSQL tables, foreign keys, and indexes
│   ├── rls_policies.sql    # Row Level Security policies for complete center isolation
│   ├── rpc_functions.sql   # SECURITY DEFINER functions for secure center credentials
│   └── seed.sql            # Initial TS rate (2.80) and owner profile trigger
├── vercel.json             # Vercel deployment configuration with asset caching
├── package.json            # Project manifest
└── README.md               # Complete documentation
```

---

## 🚀 Running Locally

### Option 1: PowerShell Local Server (Instant, No Dependencies Required)
Run this single command from your terminal:
```powershell
powershell -ExecutionPolicy Bypass -Command "$listener = New-Object System.Net.HttpListener; $listener.Prefixes.Add('http://localhost:8080/'); $listener.Start(); Write-Host 'ALVIYA DAIRY running at http://localhost:8080/'; Start-Process 'http://localhost:8080/'; while ($listener.IsListening) { $ctx = $listener.GetContext(); $path = $ctx.Request.Url.LocalPath.TrimStart('/'); if (-not $path) { $path = 'index.html' }; $file = Join-Path 'C:\Users\DELL\.gemini\antigravity\scratch\alviya-dairy' $path; if (Test-Path $file) { $bytes = [IO.File]::ReadAllBytes($file); $ext = [IO.Path]::GetExtension($file); $mime = switch ($ext) { '.html' {'text/html'} '.css' {'text/css'} '.js' {'application/javascript'} '.png' {'image/png'} '.json' {'application/json'} default {'application/octet-stream'} }; $ctx.Response.ContentType = $mime; $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length) } else { $ctx.Response.StatusCode = 404 }; $ctx.Response.Close() }"
```

### Option 2: Using Node.js (If Installed)
```bash
cd alviya-dairy
npx serve .
```

### Option 3: VSCode Live Server
Right-click `index.html` and select **Open with Live Server**.

---

## 🌐 Deploying to GitHub & Vercel

### Step 1: Push to GitHub
```bash
cd C:\Users\DELL\.gemini\antigravity\scratch\alviya-dairy
git init
git add .
git commit -m "Initial commit: ALVIYA DAIRY Production System"
git branch -M main
git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/<YOUR_REPOSITORY_NAME>.git
git push -u origin main
```

### Step 2: Deploy to Vercel
1. Go to [vercel.com](https://vercel.com) and log in with your GitHub account.
2. Click **Add New Project** and select your `alviya-dairy` repository.
3. Configure the Project:
   - **Framework Preset**: `Other`
   - **Root Directory**: `./` (leave default)
   - **Build Command**: `None` (or leave default)
   - **Output Directory**: `.` (leave default)
4. Click **Deploy**. Your application will be live globally in seconds with custom domain and SSL support.

---

## 🗄️ Supabase Cloud Database Setup

To enable complete normalized cloud synchronization with Row Level Security:

1. Log in to your [Supabase Dashboard](https://supabase.com/dashboard/project/ibmjejholctojmuvvyip).
2. Open the **SQL Editor** from the left navigation.
3. Run the SQL migration scripts in this order:
   1. `supabase/schema.sql` (creates `company_settings`, `centers`, `profiles`, `farmers`, `milk_collections`, `advances`)
   2. `supabase/rls_policies.sql` (enforces strict cross-center isolation)
   3. `supabase/rpc_functions.sql` (enables secure center credential management)
   4. `supabase/seed.sql` (seeds default TS = 2.80 and owner profile)

---

## 📐 Formulas & Business Rules

### 1. Milk Rate & Amount Calculation
$$\text{Rate per Liter} = (\text{FAT} + \text{SNF}) \times \text{TS}$$
$$\text{Amount} = \text{Rate} \times \text{Liters}$$

*Example*:
- $\text{FAT} = 4.2$, $\text{SNF} = 8.5$, $\text{TS} = 2.80$
- $\text{Rate} = (4.2 + 8.5) \times 2.80 = 12.7 \times 2.80 = ₹35.56$
- If $\text{Liters} = 10.00$, $\text{Amount} = 35.56 \times 10 = ₹355.60$

### 2. Automatic 10-Day Billing Cycles
Billing cycles are calculated dynamically:
- **Cycle 1**: 1st to 10th of the month
- **Cycle 2**: 11th to 20th of the month
- **Cycle 3**: 21st to the final day of the month ($28, 29, 30, \text{ or } 31$)

### 3. Net Bill Settlement
$$\text{Gross Milk Amount} - \text{Cycle Advance Deduction} = \text{Net Payable}$$
- If $\text{Advances} > \text{Gross Amount}$, the difference is displayed as **Advance Balance**.

---

## 🛡️ Role Matrix

| Capability | Main Owner (`ALVIYA-MAIN`) | Center Owner (`<CENTER_CODE>`) |
| :--- | :---: | :---: |
| View All Centers | ✅ | ❌ |
| Create / Edit / Delete Center | ✅ | ❌ |
| Change Center Password | ✅ | ❌ |
| Update Global TS Multiplier | ✅ | ❌ (Read Only) |
| Manage Farmer Bank Details | ✅ | ❌ (Hidden) |
| Add / Delete Farmer Advances | ✅ | ❌ (Read Only) |
| Record Daily Milk Collection | ✅ | ✅ (Own Center Only) |
| View Bills & Generate A4 PDF | ✅ | ✅ (Own Center Only) |
| Export Excel Reports | ✅ | ✅ (Own Center Only) |
| Download & Restore JSON Backup | ✅ | ✅ |
