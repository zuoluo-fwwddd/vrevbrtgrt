import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.dirname(fileURLToPath(import.meta.url));
const files=new Map([['/','store.html'],['/index.html','store.html'],['/admin','admin.html'],['/admin.html','admin.html'],['/api-config.js','api-config.js'],['/store-extra.js','store-extra.js'],['/admin-extra.js','admin-extra.js'],['/styles.css','styles.css']]);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
createServer(async(req,res)=>{const u=new URL(req.url,'http://localhost'),file=files.get(u.pathname);if(!file){res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});return res.end('Not found')}try{const data=await readFile(path.join(root,file));res.writeHead(200,{'Content-Type':types[path.extname(file)],'X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'});res.end(data)}catch{res.writeHead(500);res.end('Unable to load frontend')}}).listen(Number(process.env.FRONTEND_PORT||5173),process.env.FRONTEND_HOST||'127.0.0.1',()=>console.log(`Frontend listening on http://${process.env.FRONTEND_HOST||'127.0.0.1'}:${process.env.FRONTEND_PORT||5173}`));

