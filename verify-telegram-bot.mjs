import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import net from 'node:net';

const folder=await mkdtemp(path.join(os.tmpdir(),'site-telegram-'));
const probe=net.createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
process.env.PORT=String(port);process.env.HOST='127.0.0.1';process.env.DB_PATH=path.join(folder,'test.db');process.env.ADMIN_ACCOUNT='bot-test-admin';process.env.ADMIN_PASSWORD='temporary-test-password-123';process.env.TELEGRAM_BOT_TOKEN='fake-token';process.env.TELEGRAM_CHAT_ID='-10012345';
let updateCalls=0;
globalThis.fetch=async(url)=>{if(!String(url).includes('api.telegram.org/botfake-token/getUpdates'))throw Error('Unexpected outbound request');updateCalls++;return new Response(JSON.stringify({ok:true,result:[{update_id:42,message:{message_id:8,date:1,chat:{id:-10012345,type:'supergroup',username:'mm138553'},text:'待审核商品消息'}}]}),{status:200,headers:{'Content-Type':'application/json'}})};
const request=(route,method='GET',data,token)=>new Promise((resolve,reject)=>{const body=data===undefined?null:JSON.stringify(data),req=http.request({host:'127.0.0.1',port,path:route,method,headers:{...(body?{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}:{}),...(token?{Authorization:`Bearer ${token}`}:{})}},res=>{let s='';res.setEncoding('utf8');res.on('data',c=>s+=c);res.on('end',()=>resolve({status:res.statusCode,data:s?JSON.parse(s):null}))});req.on('error',reject);if(body)req.write(body);req.end()});
try{
 await import('./server.mjs');
 let login;for(let i=0;i<30;i++){try{login=await request('/api/login','POST',{account:'bot-test-admin',password:'temporary-test-password-123'});break}catch{await new Promise(r=>setTimeout(r,100))}}
 if(login?.status!==200)throw Error('Admin login failed');
 const token=login.data.token;let overview;
 for(let i=0;i<30;i++){overview=await request('/api/admin/overview','GET',undefined,token);if(overview.data?.imports?.length)break;await new Promise(r=>setTimeout(r,100))}
 if(overview?.data?.imports?.length!==1)throw Error(`Expected one imported message, got ${overview?.data?.imports?.length}`);
 const item=overview.data.imports[0];if(item.content!=='待审核商品消息'||item.status!=='pending')throw Error('Imported item content or review state incorrect');
 const synced=await request('/api/admin/imports/bot-sync','POST',{},token),after=await request('/api/admin/overview','GET',undefined,token);
 if(synced.status!==200||after.data.imports.length!==1)throw Error('Duplicate update was not deduplicated');
 console.log(`PASS Telegram mock poll: imported once, pending review, duplicate ignored (poll calls ${updateCalls})`);
}catch(e){console.error(e);process.exitCode=1}finally{setTimeout(()=>process.exit(process.exitCode||0),50)}

