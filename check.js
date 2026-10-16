// Cross-platform verification; no dependencies or generated source files.
const fs=require('fs'), vm=require('vm'), cp=require('child_process');
const html=fs.readFileSync('index.html','utf8');
new vm.Script(html.match(/<script>\s*([\s\S]*?)<\/script>/)[1]);
new vm.Script(fs.readFileSync('sw.js','utf8'));
for(const file of ['manifest.webmanifest','vercel.json']) JSON.parse(fs.readFileSync(file,'utf8'));
for(const file of ['check-i18n.js',...fs.readdirSync('tests').filter(f=>f.endsWith('.test.js')).map(f=>'tests/'+f)]){
  const result=cp.spawnSync(process.execPath,[file],{stdio:'inherit'});if(result.status!==0)process.exit(result.status||1);
}
console.log('All checks passed');
