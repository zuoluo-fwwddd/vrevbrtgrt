import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import net from 'node:net';

const folder=await mkdtemp(path.join(os.tmpdir(),'site-api-'));
const probe=net.createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
process.env.PORT=String(port);process.env.HOST='127.0.0.1';process.env.DB_PATH=path.join(folder,'test.db');process.env.ADMIN_ACCOUNT='api-test-admin';process.env.ADMIN_PASSWORD='temporary-api-test-password-123';
const request=(route,method='GET',data,token)=>new Promise((resolve,reject)=>{const body=data===undefined?null:JSON.stringify(data),req=http.request({host:'127.0.0.1',port,path:route,method,headers:{...(body?{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}:{}),...(token?{Authorization:`Bearer ${token}`}:{})}},res=>{let s='';res.setEncoding('utf8');res.on('data',c=>s+=c);res.on('end',()=>resolve({status:res.statusCode,data:s?JSON.parse(s):null}))});req.on('error',reject);if(body)req.write(body);req.end()});
const check=(ok,message)=>{if(!ok)throw Error(message)};
try{
 await import('./server.mjs');
 let adminLogin;for(let i=0;i<30;i++){try{adminLogin=await request('/api/login','POST',{account:'api-test-admin',password:'temporary-api-test-password-123'});break}catch{await new Promise(r=>setTimeout(r,100))}}
 check(adminLogin?.status===200,'Admin login failed');const admin=adminLogin.data.token;
 const userReg=await request('/api/register','POST',{account:'api-test-user',password:'strong-pass-123',role:'user'});
 const merchantReg=await request('/api/register','POST',{account:'api-test-merchant',password:'strong-pass-123',role:'merchant'});
 check(userReg.status===201&&merchantReg.status===201,'User and merchant registration failed');
 const userLogin=await request('/api/login','POST',{account:'api-test-user',password:'strong-pass-123'}),merchantLogin=await request('/api/login','POST',{account:'api-test-merchant',password:'strong-pass-123'});
 check(userLogin.status===200&&merchantLogin.status===200,'User or merchant login failed');const user=userLogin.data.token,merchant=merchantLogin.data.token;
 const forbidden=await request('/api/admin/overview','GET',undefined,user);check(forbidden.status===403,'Non-admin accessed admin API');
 const locked=await request('/api/admin/settings','POST',{register_user:'0'},admin);check(locked.status===200,'Admin could not close user registration');
 const disabled=await request('/api/register','POST',{account:'api-disabled-user',password:'strong-pass-123',role:'user'});check(disabled.status===403,'Closed registration type still accepted new accounts');
 const existingLogin=await request('/api/login','POST',{account:'api-test-user',password:'strong-pass-123'});check(existingLogin.status===200,'Existing account could not login after registration was closed');
 await request('/api/admin/settings','POST',{register_user:'1'},admin);
 const forbiddenMerchant=await request('/api/merchant/products','GET',undefined,user);check(forbiddenMerchant.status===403,'Non-merchant accessed merchant API');
 const submitted=await request('/api/merchant/products','POST',{name:'审核测试商品',description:'仅用于自动化验收',price:10},merchant);check(submitted.status===201&&submitted.data.status==='pending','Merchant product was not submitted for review');
 const before=await request('/api/products');check(!before.data.some(p=>p.id===submitted.data.id),'Pending product appeared in public catalog');
 const approved=await request('/api/admin/review','POST',{id:submitted.data.id,status:'approved'},admin);check(approved.status===200,'Admin approval failed');
 const after=await request('/api/products');check(after.data.some(p=>p.id===submitted.data.id),'Approved product missing from public catalog');
 const topup=await request('/api/topups','POST',{points:50,requestKey:'a1b2c3d4-1111-4222-8333-aabbccddeeff'},user);check(topup.status===201&&topup.data.status==='pending','Top-up was credited before confirmation or not created');
 const pendingMe=await request('/api/me','GET',undefined,user);check(pendingMe.data.balance===0,'Pending top-up changed balance');
 const confirm=await request('/api/admin/topups/confirm','POST',{id:topup.data.id},admin);check(confirm.status===200,'Admin top-up confirmation failed');
 const duplicateConfirm=await request('/api/admin/topups/confirm','POST',{id:topup.data.id},admin);check(duplicateConfirm.status===404,'Duplicate top-up confirmation credited twice');
 const purchase=await request('/api/orders','POST',{productId:submitted.data.id,requestKey:'b1b2c3d4-1111-4222-8333-aabbccddeeff'},user);check(purchase.status===201&&purchase.data.amount===10,'Point purchase failed');
 const replay=await request('/api/orders','POST',{productId:submitted.data.id,requestKey:'b1b2c3d4-1111-4222-8333-aabbccddeeff'},user);check(replay.status===200&&replay.data.replayed,'Duplicate purchase was not idempotent');
 const finalMe=await request('/api/me','GET',undefined,user);check(finalMe.data.balance===40,'Balance does not match confirmed top-up minus purchase');
 for(let i=0;i<4;i++){const failed=await request('/api/login','POST',{account:'api-test-admin',password:'incorrect-password'});check(failed.status===401,'Unexpected login response before rate limit threshold')}
 const otherAccountLogin=await request('/api/login','POST',{account:'api-test-user',password:'strong-pass-123'});check(otherAccountLogin.status===200,'Valid login failed before IP lock threshold');
 const fifthFailure=await request('/api/login','POST',{account:'api-test-admin',password:'incorrect-password'});check(fifthFailure.status===401,'Fifth failed login did not record the rate limit');const lockedLogin=await request('/api/login','POST',{account:'api-test-user',password:'strong-pass-123'});check(lockedLogin.status===429,'Successful login reset the IP brute-force counter');
 const logout=await request('/api/logout','POST',{},user),revoked=await request('/api/me','GET',undefined,user);check(logout.status===200&&revoked.status===401,'Logout did not revoke the server-side session');
 console.log('PASS API acceptance: role registration and access, review gating, confirmed top-up, idempotent point purchase, balance, ledger, brute-force counter and session revocation');
}catch(e){console.error(e);process.exitCode=1}finally{setTimeout(()=>process.exit(process.exitCode||0),50)}

