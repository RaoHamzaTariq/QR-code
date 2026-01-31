import express from 'express';
import fetch from 'node-fetch';

const app  = express();
const PORT = process.env.PORT || 3000;
const EVO  = process.env.EVO_URL;   
const KEY  = process.env.EVO_KEY;  

app.get('/', async (req,res)=>{
  const inst = req.query.i;
  try{
    const rs = await fetch(`${EVO}/instance/connect/${inst}`,{
      headers:{ apikey: KEY }
    });
    const j  = await rs.json();

    if(j.state === 'open'){
      return res.send('<h2 style="color:green">✓ Already connected</h2>');
    }
    const b64 = j.qrcode || j.base64;
    if(!b64) throw new Error('No QR returned');

    res.send(`
<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>WhatsApp QR – ${inst}</title>
  <style>
    body{font-family:Arial;display:flex;flex-direction:column;align-items:center}
    img{width:260px;margin-top:20px}
  </style>
</head>
<body>
  <h2>Scan with WhatsApp<br>Settings → Linked Devices → Link a Device</h2>
  <img src="data:image/png;base64,${b64}"/>
  <p>Instance: <b>${inst}</b></p>
</body>
</html>`);
  }catch(e){
    res.status(500).send('<h3>QR unavailable</h3><pre>'+e.message+'</pre>');
  }
});

app.listen(PORT, ()=> console.log(`QR service on :${PORT}`));
