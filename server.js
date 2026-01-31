import express from 'express';
import fetch from 'node-fetch';

const app  = express();
const PORT = process.env.PORT || 3000;
const EVO  = process.env.EVO_URL;
const KEY  = process.env.EVO_KEY;
const HOOK = process.env.WEBHOOK_URL;

/* ---------- helpers ---------- */
const fetchState = inst =>
  fetch(`${EVO}/instance/connectionState/${inst}`,{headers:{apikey:KEY}})
    .then(r=>r.json())
    .then(j=> j.instance || j);

const fetchQR = inst =>
  fetch(`${EVO}/instance/connect/${inst}`,{headers:{apikey:KEY}}).then(r=>r.json());

const buildSrc = b64 =>
  b64.startsWith('data:image') ? b64 : `data:image/png;base64,${b64}`;

const notifyConnected = async (inst, phone) => {
  if (!HOOK) return;
  const body = { instance: inst, phone: phone || null, status: 'connected', ts: new Date().toISOString() };
  try{ await fetch(HOOK, { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(body)}); }
  catch(e){ console.log('Webhook failed', e.message); }
};

/* ---------- UI ---------- */
const page = (qr, state, inst, phone) => `
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>WhatsApp Link – ${inst}</title>
  <style>
    :root{--bg:#18191a;--card:#242526;--accent:#25d366;--text:#e4e6eb;--sub:#b0b3b8;--danger:#f85149;--radius:16px;--shadow:0 12px 40px rgba(0,0,0,.4)}
    *{box-sizing:border-box;margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
    body{display:flex;align-items:center;justify-content:center;min-height:100vh;background:var(--bg);color:var(--text);transition:background .3s}
    .container{width:100%;max-width:380px;padding:24px}
    .card{background:var(--card);border-radius:var(--radius);box-shadow:var(--shadow);padding:32px 28px;text-align:center;position:relative;overflow:hidden}
    .badge{display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border-radius:999px;font-size:.8rem;font-weight:600;margin-bottom:20px}
    .badge.ok{background:rgba(37,211,102,.15);color:var(--accent)}
    .badge.warn{background:rgba(255,184,0,.15);color:#ffb800}
    h2{font-size:1.5rem;margin-bottom:8px}
    .sub{font-size:.95rem;color:var(--sub);margin-bottom:24px}
    .qr-box{position:relative;margin:0 auto 24px;width:100%;max-width:280px;background:#fff;padding:16px;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,.2)}
    .qr-box img{width:100%;height:auto;display:block}
    .steps{text-align:left;font-size:.9rem;color:var(--sub);list-style:none;margin-bottom:24px}
    .steps li{margin:10px 0;display:flex;align-items:center;gap:10px}
    .steps li::before{content:attr(data-icon);font-size:1.2rem}
    .btn-primary{display:inline-flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:12px 16px;background:var(--accent);color:#fff;border:none;border-radius:8px;font-size:1rem;font-weight:600;cursor:pointer;transition:transform .2s,background .2s}
    .btn-primary:hover{transform:translateY(-2px)}
    .btn-secondary{margin-top:12px;background:transparent;color:var(--sub);border:1px solid var(--sub)}
    .pulse{animation:pulse 2s infinite}
    @keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.03)}}
    .hidden{display:none}
    @media (max-width:400px){.card{padding:24px 20px}h2{font-size:1.3rem}}
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      ${state==='open'
        ? '<div class="badge ok"><svg width="16" height="16" fill="currentColor"><path d="M12.7 5.3a1 1 0 0 0-1.4-1.4l-4.3 4.3-1.8-1.8a1 1 0 0 0-1.4 1.4l2.5 2.5a1 1 0 0 0 1.4 0l5-5z"/></svg>Connected</div>'
        : '<div class="badge warn pulse"><svg width="16" height="16" fill="currentColor"><path d="M12.4 3.9a1 1 0 0 0-1.8 0L6.5 10 4.2 6.3a1 1 0 0 0-1.8.8l3 5a1 1 0 0 0 .9.5h6a1 1 0 0 0 .9-.5l3-5a1 1 0 0 0-.8-1.8z"/></svg>Waiting for scan…</div>'
      }
      <h2>Link a Device</h2>
      <p class="sub">Open WhatsApp on your phone and scan the code below.</p>
      ${state==='open'
        ? ''
        : `<div class="qr-box pulse"><img src="${qr}" alt="QR code"/></div>
           <ol class="steps">
             <li data-icon="📱">Tap <b>⋮</b> (Android) or <b>Settings</b> (iPhone)</li>
             <li data-icon="🔗">Choose <b>Linked devices</b></li>
             <li data-icon="📷">Tap <b>Link a device</b> and point camera here</li>
           </ol>
           <button class="btn-primary" onclick="location.reload()">Refresh / Retry</button>`
      }
    </div>
  </div>
  ${state!=='open' ? '<meta http-equiv="refresh" content="5"/>' : ''}
  <!-- if we just landed on "open", fire webhook once -->
  ${state==='open' && phone ? `<script>
    fetch('${HOOK}',{method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({instance:'${inst}',phone:'${phone}',status:'connected',ts:new Date().toISOString()})});
  </script>` : ''}
</body>
</html>`;

/* ---------- routes ---------- */
app.get('/', async (req,res)=>{
  const inst  = req.query.i || '';
  const phone = req.query.num || '';

  try{
    const stateJ = await fetchState(inst);
    if (stateJ.state === 'open'){
      // notify only once per landing
      await notifyConnected(inst, phone);
      return res.send(page(null,'open',inst,phone));
    }

    const qrJ = await fetchQR(inst);
    const b64 = qrJ.qrcode || qrJ.base64;
    if (!b64) throw new Error('No QR returned');
    res.send(page(buildSrc(b64),'connecting',inst,phone));
  }catch(e){
    res.status(500).send(`
      <div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;text-align:center;background:#18191a;color:#e4e6eb">
        <div>
          <h2 style="color:#f85149">QR unavailable</h2>
          <p>${e.message}</p>
          <button class="btn-primary" onclick="location.reload()" style="margin-top:1rem">Try again</button>
        </div>
      </div>`);
  }
});

app.listen(PORT, ()=> console.log(`QR service on :${PORT}`));
