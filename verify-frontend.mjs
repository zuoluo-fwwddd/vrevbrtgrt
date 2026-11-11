import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

for(const file of ['store.html','admin.html']){
 const html=await readFile(new URL(file,import.meta.url),'utf8');
 const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(s=>s.trim());
 for(let i=0;i<scripts.length;i++)new vm.Script(scripts[i],{filename:`${file}#inline-${i+1}`});
 console.log(`${file}: parsed ${scripts.length} inline scripts`);
}

