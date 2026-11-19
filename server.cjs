'use strict';
// VoiceUp community backend. Node.js >=22.13, no third-party packages.
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {DatabaseSync}=require('node:sqlite');
const ROOT=__dirname;
const DATA_DIR=path.resolve(process.env.VOICEUP_DATA_DIR||path.join(ROOT,'server-data'));
const UPLOAD_DIR=path.join(DATA_DIR,'uploads');
fs.mkdirSync(UPLOAD_DIR,{recursive:true,mode:0o700});
const db=new DatabaseSync(path.join(DATA_DIR,'voiceup.sqlite'));
db.exec(`PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL, pass_hash TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS uploads(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), mime TEXT NOT NULL, original_name TEXT NOT NULL, size INTEGER NOT NULL, used INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS petitions(id TEXT PRIMARY KEY, author_id TEXT NOT NULL REFERENCES users(id), title TEXT NOT NULL, description TEXT NOT NULL, requested_action TEXT NOT NULL, level TEXT NOT NULL, state TEXT NOT NULL DEFAULT '', district TEXT NOT NULL DEFAULT '', affected_scope TEXT NOT NULL, category TEXT NOT NULL, category_group TEXT NOT NULL, estimated_population INTEGER, media_id TEXT NOT NULL UNIQUE REFERENCES uploads(id), status TEXT NOT NULL DEFAULT 'Open', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS support(petition_id TEXT NOT NULL REFERENCES petitions(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(petition_id,user_id));
CREATE INDEX IF NOT EXISTS support_by_user ON support(user_id);
CREATE INDEX IF NOT EXISTS petitions_created ON petitions(created_at);
-- National sample policy proposals use separate account endorsements, not fabricated sample supporters.
CREATE TABLE IF NOT EXISTS national_endorsements(proposal_id TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(proposal_id,user_id));
CREATE INDEX IF NOT EXISTS national_endorsements_by_user ON national_endorsements(user_id);
-- All bundled District, State, and National catalogue entries can receive account endorsements.
CREATE TABLE IF NOT EXISTS catalogue_endorsements(petition_id TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(petition_id,user_id));
CREATE INDEX IF NOT EXISTS catalogue_endorsements_by_user ON catalogue_endorsements(user_id);
CREATE TABLE IF NOT EXISTS migration_flags(name TEXT PRIMARY KEY);

`);
// Read the bundled, immutable allowlist. The backend refuses support for unknown catalogue IDs.
const catalogueSource=fs.readFileSync(path.join(ROOT,'assets','petitions-data.js'),'utf8');
const catalogueMatch=/window\.VOICE_DATA=(\[.*?\]);\s*window\.VOICE_COLLECTION_TARGETS=/s.exec(catalogueSource);
if(!catalogueMatch)throw new Error('Catalogue data is missing or could not be validated.');
const catalogueRecords=JSON.parse(catalogueMatch[1]);
const catalogueIds=new Set(catalogueRecords.filter(p=>p.data_origin==='generated_example'||p.data_origin==='public_petition').map(p=>p.petition_id));
if(catalogueIds.size!==835)throw new Error('Expected the exact 835-entry catalogue.');
// Preserve all existing National endorsements on upgrade. The migration runs once.
if(!db.prepare("SELECT name FROM migration_flags WHERE name='national-to-catalogue-2026'").get()){
 db.exec('BEGIN IMMEDIATE');
 try{
  db.prepare('INSERT OR IGNORE INTO catalogue_endorsements(petition_id,user_id,created_at) SELECT proposal_id,user_id,created_at FROM national_endorsements').run();
  db.prepare("INSERT INTO migration_flags(name) VALUES('national-to-catalogue-2026')").run();
  db.exec('COMMIT');
 }catch(e){db.exec('ROLLBACK');throw e;}
}
const HOST=process.env.HOST||'0.0.0.0';
const PORT=Number(process.env.PORT||3000);
const SESSION_MAX_MS=30*24*60*60*1000;
const FILE_MIME={
 'image/jpeg':{ext:'.jpg',max:15e6},'image/png':{ext:'.png',max:15e6},
 'image/webp':{ext:'.webp',max:15e6},'image/gif':{ext:'.gif',max:15e6},
 'image/avif':{ext:'.avif',max:15e6},'video/mp4':{ext:'.mp4',max:40e6},
 'video/webm':{ext:'.webm',max:40e6},'video/quicktime':{ext:'.mov',max:40e6}
};
const staticMimes={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.gif':'image/gif','.avif':'image/avif','.mp4':'video/mp4','.mov':'video/quicktime','.webm':'video/webm','.csv':'text/csv; charset=utf-8','.txt':'text/plain; charset=utf-8'};
function send(res,status,data,headers={}){
 const body=Buffer.from(JSON.stringify(data));res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Content-Length':body.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});res.end(body);
}
function err(res,status,msg){send(res,status,{error:msg});}
function getSession(req){
 const raw=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(s=>s.startsWith('voiceup_session='));
 if(!raw)return null;
 const token=raw.slice('voiceup_session='.length);
 if(!/^[a-f0-9]{64}$/.test(token))return null;
 return db.prepare('SELECT u.id,u.display_name,u.email FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').get(crypto.createHash('sha256').update(token).digest('hex'),Date.now())||null;
}
function publicUser(user){return user?{id:user.id,name:user.display_name,email:user.email}:null;}
function sessionCookie(token,clear=false,req){const secure=process.env.PUBLIC_HTTPS==='1'||!!req.socket.encrypted;return `voiceup_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${clear?0:Math.floor(SESSION_MAX_MS/1000)}${secure?'; Secure':''}`;}
function setSession(res,user,req){
 const token=crypto.randomBytes(32).toString('hex');
 db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(crypto.createHash('sha256').update(token).digest('hex'),user.id,Date.now()+SESSION_MAX_MS);
 return sessionCookie(token,false,req);
}
function hashPassword(password){const salt=crypto.randomBytes(16).toString('hex');return salt+':'+crypto.scryptSync(password,salt,64).toString('hex');}
function verifyPassword(password,stored){const [salt,digest]=stored.split(':');if(!salt||!digest)return false;const b=Buffer.from(digest,'hex');const c=crypto.scryptSync(password,salt,b.length);return crypto.timingSafeEqual(b,c);}
async function readBody(req,max){let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>max){const e=new Error('Request exceeds allowed size.');e.status=413;throw e;}chunks.push(chunk);}return Buffer.concat(chunks);}
async function jsonBody(req,max=20_000){let data;try{data=JSON.parse((await readBody(req,max)).toString('utf8'));}catch(e){if(e.status)throw e;const x=new Error('Invalid JSON request.');x.status=400;throw x;}if(!data||typeof data!=='object'||Array.isArray(data)){const x=new Error('Expected a JSON object.');x.status=400;throw x;}return data;}
function str(v,max=200){return typeof v==='string'?v.trim().slice(0,max):'';}
const rates=new Map();function rateLimit(req,action,limit,span=15*60_000){const ip=req.socket.remoteAddress||'local';const key=action+':'+ip;const now=Date.now();const current=rates.get(key)||[];const recent=current.filter(t=>t>now-span);recent.push(now);rates.set(key,recent);return recent.length<=limit;}
function validMagic(b,m){if(m==='image/jpeg')return b[0]===0xff&&b[1]===0xd8&&b[2]===0xff;if(m==='image/png')return b.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex'));if(m==='image/gif')return ['GIF87a','GIF89a'].includes(b.subarray(0,6).toString());if(m==='image/webp')return b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP';if(m==='image/avif')return b.toString('ascii',4,8)==='ftyp'&&b.toString('ascii',8,32).includes('avif');if(m==='video/webm')return b.subarray(0,4).equals(Buffer.from('1a45dfa3','hex'));if(m==='video/mp4'||m==='video/quicktime')return b.toString('ascii',4,8)==='ftyp';return false;}
function selectPetitionsFixed(user){const rows=db.prepare(`SELECT p.*,a.mime AS evidence_mime,u.display_name AS author, (SELECT COUNT(*) FROM support s WHERE s.petition_id=p.id) AS support_count, EXISTS(SELECT 1 FROM support s2 WHERE s2.petition_id=p.id AND s2.user_id=?) AS supported_by_me FROM petitions p JOIN users u ON u.id=p.author_id JOIN uploads a ON a.id=p.media_id ORDER BY p.created_at DESC,p.id DESC LIMIT 5000`).all(user?.id||'');return rows.map(p=>({petition_id:p.id,data_origin:'shared_petition',title:p.title,description:p.description,requested_action:p.requested_action,level:p.level,country:'India',state:p.state,district:p.district,affected_scope:p.affected_scope,category:p.category,category_group:p.category_group,issue_type:p.category,estimated_affected_population:p.estimated_population,created_date:p.created_at,status:p.status,cover_url:'/api/media/'+p.media_id,evidence_url:'/api/media/'+p.media_id,evidence_type:p.evidence_mime,evidence_attached:true,creator_name:p.author,support_count:p.support_count,supported_by_me:!!p.supported_by_me,created_by_me:!!user&&user.id===p.author_id}));}
const instance = crypto.randomUUID();
let revision = 0;
async function handleApi(req,res,url){
 const route=url.pathname,method=req.method,user=getSession(req);
 if(method==='GET'&&route==='/api/revision')return send(res,200,{instance,revision,user:user?.id||null});
 if(method==='GET'&&route==='/api/health')return send(res,200,{ok:true,mode:'shared',database:'SQLite'});
 if(method==='GET'&&route==='/api/me')return send(res,200,{user:publicUser(user)});
 if(method==='GET'&&route==='/api/petitions')return send(res,200,{petitions:selectPetitionsFixed(user)});
 // This includes District, State and National catalogue entries, not user-published petitions.
 if(method==='GET'&&(route==='/api/catalogue-support'||route==='/api/national-support')){
   const catalogueSupport={};
   for(const id of catalogueIds)catalogueSupport[id]={count:0,supported_by_me:false};
   for(const row of db.prepare('SELECT petition_id,COUNT(*) AS n FROM catalogue_endorsements GROUP BY petition_id').all()){
     if(catalogueSupport[row.petition_id])catalogueSupport[row.petition_id].count=row.n;
   }
   if(user)for(const row of db.prepare('SELECT petition_id FROM catalogue_endorsements WHERE user_id=?').all(user.id)){
     if(catalogueSupport[row.petition_id])catalogueSupport[row.petition_id].supported_by_me=true;
   }
   if(route==='/api/national-support'){
     const nationalSupport=Object.fromEntries(Object.entries(catalogueSupport).filter(([id])=>id.startsWith('VU-NATIONAL-INDIA-')));
     return send(res,200,{nationalSupport});
   }
   return send(res,200,{catalogueSupport});
 }

 if(method==='POST'&&route==='/api/register'){
  if(!rateLimit(req,'register',12))return err(res,429,'Too many registration attempts. Try later.');
  const f=await jsonBody(req),email=str(f.email,254).toLowerCase(),name=str(f.name,70),password=f.password;
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)||name.length<2||typeof password!=='string'||password.length<10||password.length>128)return err(res,400,'Enter a display name, valid email, and password of at least 10 characters.');
  const id=crypto.randomUUID();
  try{db.prepare('INSERT INTO users(id,email,display_name,pass_hash) VALUES(?,?,?,?)').run(id,email,name,hashPassword(password));}catch(e){if(e.code==='ERR_SQLITE_ERROR')return err(res,409,'That email is already registered.');throw e;}
  const cookie=setSession(res,{id},req);return send(res,201,{user:{id,name,email}},{'Set-Cookie':cookie});
 }
 if(method==='POST'&&route==='/api/login'){
  if(!rateLimit(req,'login',30))return err(res,429,'Too many sign-in attempts. Try later.');
  const f=await jsonBody(req),email=str(f.email,254).toLowerCase(),password=f.password;
  const found=db.prepare('SELECT * FROM users WHERE email=?').get(email);
  if(!found||typeof password!=='string'||password.length>128||!verifyPassword(password,found.pass_hash))return err(res,401,'Incorrect email or password.');
  const cookie=setSession(res,found,req);return send(res,200,{user:{id:found.id,name:found.display_name,email:found.email}},{'Set-Cookie':cookie});
 }
 if(method==='POST'&&route==='/api/logout'){
  const raw=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(s=>s.startsWith('voiceup_session='));
  if(raw){const token=raw.slice('voiceup_session='.length);if(/^[0-9a-f]{64}$/.test(token))db.prepare('DELETE FROM sessions WHERE token_hash=?').run(crypto.createHash('sha256').update(token).digest('hex'));}
  return send(res,200,{ok:true},{'Set-Cookie':sessionCookie('',true,req)});
 }
 const media=route.match(/^\/api\/media\/([0-9a-f-]{36})$/);
 if(method==='GET'&&media){
   const row=db.prepare('SELECT a.id,a.mime,a.size FROM uploads a JOIN petitions p ON p.media_id=a.id WHERE a.id=?').get(media[1]);
   if(!row)return err(res,404,'Evidence file not found.');
   const filename=path.join(UPLOAD_DIR,row.id+FILE_MIME[row.mime].ext);
   if(!fs.existsSync(filename))return err(res,404,'Evidence file missing on server.');
   const headers={'Content-Type':row.mime,'X-Content-Type-Options':'nosniff','Content-Disposition':'inline','Accept-Ranges':'bytes','Cache-Control':'private, max-age=3600'};
   const range=req.headers.range;
   if(range){const found=/^bytes=(\d*)-(\d*)$/.exec(range);if(!found)return res.writeHead(416).end();let start=found[1]?Number(found[1]):0,end=found[2]?Number(found[2]):row.size-1;if(!found[1]&&found[2]){start=Math.max(0,row.size-Number(found[2]));end=row.size-1;}if(start>=row.size||end<start||end>=row.size)return res.writeHead(416).end();res.writeHead(206,{...headers,'Content-Range':`bytes ${start}-${end}/${row.size}`,'Content-Length':end-start+1});return fs.createReadStream(filename,{start,end}).pipe(res);}
   res.writeHead(200,{...headers,'Content-Length':row.size});return fs.createReadStream(filename).pipe(res);
 }
 // POST/DELETE are idempotent: repeated support requests don't inflate the count.
 const catalogueVote=route.match(/^\/api\/(?:catalogue-support|national-support)\/(VU-[A-Z0-9-]+)$/);
 if(catalogueVote&&(method==='POST'||method==='DELETE')){
   if(!user)return err(res,401,'Please sign in to support this petition.');
   const id=catalogueVote[1];
   if(!catalogueIds.has(id))return err(res,404,'Catalogue petition not found.');
   if(route.startsWith('/api/national-support/')&&!id.startsWith('VU-NATIONAL-INDIA-'))return err(res,404,'National proposal not found.');
   if(!rateLimit(req,'catalogue-support-'+user.id,120,60*60_000))return err(res,429,'Too many support requests.');
   if(method==='POST')db.prepare('INSERT OR IGNORE INTO catalogue_endorsements(petition_id,user_id) VALUES(?,?)').run(id,user.id);
   else db.prepare('DELETE FROM catalogue_endorsements WHERE petition_id=? AND user_id=?').run(id,user.id);
   revision++;
   const count=db.prepare('SELECT COUNT(*) AS n FROM catalogue_endorsements WHERE petition_id=?').get(id).n;
   return send(res,200,{petition_id:id,proposal_id:id,count,supported_by_me:method==='POST'});
 }
 if(!user)return err(res,401,'Please sign in to create or support petitions.');
 if(method==='POST'&&route==='/api/uploads'){
   if(!rateLimit(req,'upload-'+user.id,80,60*60_000))return err(res,429,'Upload limit reached.');
   const mime=str(req.headers['content-type'],100).split(';')[0].toLowerCase(),conf=FILE_MIME[mime];if(!conf)return err(res,415,'Unsupported evidence format.');
   const bytes=await readBody(req,conf.max+1);if(!bytes.length||bytes.length>conf.max)return err(res,413,'Evidence exceeds the file size limit.');
   if(!validMagic(bytes,mime))return err(res,400,'The file contents do not match the selected file type.');
   const name=str(decodeURIComponent(String(req.headers['x-file-name']||'evidence').slice(0,260)),150);
   const id=crypto.randomUUID(),dest=path.join(UPLOAD_DIR,id+conf.ext);
   fs.writeFileSync(dest,bytes,{flag:'wx',mode:0o600});
   try{db.prepare('INSERT INTO uploads(id,user_id,mime,original_name,size) VALUES(?,?,?,?,?)').run(id,user.id,mime,name,bytes.length);}catch(e){fs.rmSync(dest,{force:true});throw e;}
   return send(res,201,{upload_id:id,name,mime,size:bytes.length});
 }
 if(method==='POST'&&route==='/api/petitions'){
   if(!rateLimit(req,'create-'+user.id,30,60*60_000))return err(res,429,'Too many new petitions.');
   const f=await jsonBody(req,20_000),title=str(f.title,160),description=str(f.description,3000),requested_action=str(f.requested_action,1500),level=str(f.level,20),state=str(f.state,100),district=str(f.district,100),affected_scope=str(f.affected_scope,200),category=str(f.category,90),category_group=str(f.category_group,90),upload_id=str(f.upload_id,45),population=Number(f.estimated_affected_population)||null;
   if(title.length<8||description.length<20||requested_action.length<10||affected_scope.length<4||!category||!category_group||!['District','State','National'].includes(level)||(level!=='National'&&!state)||(level==='District'&&!district)||(population!==null&&(!Number.isSafeInteger(population)||population<1||population>2e9)))return err(res,400,'Please complete all required fields correctly.');
   const file=db.prepare('SELECT * FROM uploads WHERE id=? AND user_id=? AND used=0').get(upload_id,user.id);
   if(!file)return err(res,400,'Upload your evidence first.');
   const id='VU-SHARED-'+crypto.randomUUID();
   db.exec('BEGIN IMMEDIATE');
   try{db.prepare('INSERT INTO petitions(id,author_id,title,description,requested_action,level,state,district,affected_scope,category,category_group,estimated_population,media_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,user.id,title,description,requested_action,level,level==='National'?'':state,level==='District'?district:'',affected_scope,category,category_group,population,upload_id);db.prepare('UPDATE uploads SET used=1 WHERE id=?').run(upload_id);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
   revision++;
   const p=selectPetitionsFixed(user).find(x=>x.petition_id===id);return send(res,201,{petition:p});
 }
 const vote=route.match(/^\/api\/petitions\/(VU-SHARED-[0-9a-f-]{36})\/support$/);
 if(vote&&(method==='POST'||method==='DELETE')){
   if(!rateLimit(req,'support-'+user.id,150,60*60_000))return err(res,429,'Too many support requests.');
   const petition=db.prepare('SELECT id,author_id,status FROM petitions WHERE id=?').get(vote[1]);if(!petition)return err(res,404,'Petition not found.');
   if(petition.author_id===user.id)return err(res,403,'You cannot support your own petition. Share it so other people can support it.');
   if(method==='POST'){db.prepare('INSERT OR IGNORE INTO support(petition_id,user_id) VALUES(?,?)').run(vote[1],user.id);}
   else db.prepare('DELETE FROM support WHERE petition_id=? AND user_id=?').run(vote[1],user.id);
   revision++;
   const count=db.prepare('SELECT COUNT(*) AS n FROM support WHERE petition_id=?').get(vote[1]).n;
   return send(res,200,{petition_id:vote[1],support_count:count,supported_by_me:method==='POST'});
 }
 return err(res,404,'Unknown API route.');
}
const STATIC_ROOTS=['assets','data','ml'];
function serveStatic(req,res,url){
 if(req.method!=='GET'&&req.method!=='HEAD')return res.writeHead(405).end();
 let name;try{name=decodeURIComponent(url.pathname);}catch{return res.writeHead(400).end();}
 if(name==='/'||!name)name='/index.html';
 const parts=name.split('/').filter(Boolean);
 if(parts.some(s=>s==='..'||s.startsWith('.')||s.includes('\\')||s.includes('\0')))return res.writeHead(403).end();
 const top=parts[0]||'';
 if(parts.length>1&&!STATIC_ROOTS.includes(top))return res.writeHead(403).end();
 const filename=path.resolve(ROOT,'.'+name);
 if(filename!==ROOT&&!filename.startsWith(ROOT+path.sep))return res.writeHead(403).end();
 const ext=path.extname(filename).toLowerCase();
 if(!staticMimes[ext])return res.writeHead(404).end();
 let st;try{st=fs.statSync(filename);}catch{return res.writeHead(404).end();}if(!st.isFile())return res.writeHead(404).end();
 res.writeHead(200,{'Content-Type':staticMimes[ext],'Content-Length':st.size,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'});
 if(req.method==='HEAD')return res.end();fs.createReadStream(filename).pipe(res);
}
const server=http.createServer(async(req,res)=>{
 try{
  const base='http://'+String(req.headers.host||'localhost');const url=new URL(req.url||'/',base);
  if(url.pathname.startsWith('/api/')){
    if(!['GET','POST','DELETE'].includes(req.method))return err(res,405,'Unsupported request method.');
    if(req.method!=='GET'){
      const origin=req.headers.origin;
      if(origin&&new URL(origin).host!==url.host)return err(res,403,'Request origin is not allowed.');
    }
    return await handleApi(req,res,url);
  }
  return serveStatic(req,res,url);
 }catch(e){console.error(e);if(!res.headersSent)err(res,e.status||500,e.status?e.message:'Server error.');else res.destroy();}
});
server.on('error',error=>{
 console.error(error.code==='EADDRINUSE'?'Port '+PORT+' is already in use. Close the server using that port, then run Voice Up again.':error.message);
 process.exitCode=1;
});
server.listen(PORT,HOST,()=>{
 const port=server.address().port;
 const browserHost=['0.0.0.0','::'].includes(HOST)?'localhost':HOST;
 const accountUrl=new URL('/account.html','http://'+(browserHost.includes(':')?'['+browserHost+']':browserHost)+':'+port);
 console.log('Account page: '+accountUrl.href);
 if(process.platform==='win32'&&process.argv.includes('--open-account')){
  const child=require('node:child_process').spawn('rundll32.exe',['url.dll,FileProtocolHandler',accountUrl.href],{stdio:'ignore',detached:true});
  child.on('error',()=>console.log('Open the account address printed above in your browser.'));
  child.unref();
 }
 console.log('VoiceUp is running. Keep this window open.');
 if(HOST==='0.0.0.0'){
  console.log('On this computer: http://localhost:'+port);
  let adapters={};
  try{adapters=require('node:os').networkInterfaces();}
  catch{console.log('On another device use this computer’s Wi-Fi IPv4 address on port '+port);}
  for(const entries of Object.values(adapters)){
   for(const entry of entries||[]){
    if(entry.family==='IPv4'&&!entry.internal)
     console.log('On the same Wi-Fi: http://'+entry.address+':'+port);
   }
  }
 }else console.log('Server address: http://'+HOST+':'+port);
});
