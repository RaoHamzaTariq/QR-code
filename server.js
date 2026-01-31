import express from 'express';
import fetch from 'node-fetch';

const app  = express();
const PORT = process.env.PORT || 3000;
const EVO  = process.env.EVO_URL;   // http://evo-xxx.sslip.io
const KEY  = process.env.EVO_KEY;   // 9YpbUzDF6lLvd2TAZtmK24Ru8yQt0s41

const html = (qr, state, inst) => `
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>WhatsApp QR – ${inst}</title>
  <style>
    :root{--green:#25d366;--grey:#f2f2f2;--font:#333}
    *{box-sizing:border-box;margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif}
    body{display:flex;align-items:center;justify-content:center;min-height:100vh;background:var(--grey);color:var(--font)}
    .card{background:#fff;border-radius:12px;box-shadow:0 8px 25px rgba(0,0,0,.15);padding:2rem 2.5rem;text-align:center;max-width:340px;width:90%}
    h2{margin-bottom:.5rem;font-size:1.4rem}
    p{margin-bottom:1.2rem;font-size:.95rem;line-height:1.4}
    .status{display:inline-block;padding:.35rem .8rem;border-radius:20px;font-size:.8rem;font-weight:600;margin-bottom:1.2rem}
    .status.ok{background:#e6f8ea;color:#128c3a}
    .status.wait{background:#fff8e1;color:#b28600}
    img{width:100%;max-width:260px;height:auto;border:1px solid #ddd;border-radius:8px;margin:0 auto 1.2rem}
    .steps{text-align:left;font-size:.85rem;margin-bottom:1.2rem}
    .steps li{margin:.4rem 0}
    .refresh{font-size:.75rem;color:#888}
    @media(max-width:360px){.card{padding:1.5rem 1.2rem}h2{font-size:1.2rem}}
  </style>
</head>
<body>
  <div class="card">
    ${state === 'open'
      ? '<span class="status ok">✓ Already connected</span>'
      : '<span class="status wait">Waiting for scan…</span>'
    }
    <h2>Link a device</h2>
    <p>Open WhatsApp on your phone and scan the code below.</p>
    ${state === 'open'
      ? ''
      : `<img src="${qr}" alt="QR code"/>
         <ol class="steps">
           <li>Tap <b>⋮</b> (Android) or <b>Settings</b> (iPhone)</li>
           <li>Choose <b>Linked devices</b></li>
           <li>Tap <b>Link a device</b> and point camera here</li>
         </ol>
         <div class="refresh">Page refreshes automatically every 5 seconds.</div>`
    }
  </div>
  ${state !== 'open' ? '<meta http-equiv="refresh" content="5"/>' : ''}
</body>
</html>`;

app.get('/', async (req,res)=>{
  const inst = req.query.i || 'instance1';
  try{
    const rs = await fetch(`${EVO}/instance/connectionState/${inst}`,{headers:{apikey:KEY}});
    const j  = await rs.json();
    if(j.state === 'open') return res.send(html(null,'open',inst));

    const qrRs = await fetch(`${EVO}/instance/connect/${inst}`,{headers:{apikey:KEY}});
    const qrJ  = await qrRs.json();
    const b64  = qrJ.qrcode || qrJ.base64;
    if(!b64) throw new Error('No QR returned');
    const src  = b64.startsWith('data:image') ? b64 : `data:image/png;base64,${b64}`;
    res.send(html(src,'connecting',inst));
  }catch(e){
    res.status(500).send(`
      <div style="font-family:Arial;text-align:center;padding:3rem">
        <h2>QR unavailable</h2>
        <p>${e.message}</p>
        <a href="?i=${encodeURIComponent(inst)}">Retry</a>
      </div>`);
  }
});

app.listen(PORT, ()=> console.log(`QR service on :${PORT}`));
