const {readFileSync,writeFileSync,readdirSync} = require('node:fs');
const {join} = require('node:path');
const version=require('../package.json').version,repo=process.env.GITHUB_REPOSITORY,token=process.env.GITHUB_TOKEN;
if(!token || repo!=='XAI-CyberSpark/OAKEdge-Downloads')throw Error('Expected the distribution repository token');
const directory=join(__dirname,'../out'),tag='macos-v'+version;
const headers={Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
async function api(path,method='GET',body){const r=await fetch('https://api.github.com/repos/'+repo+path,{method,headers:{...headers,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const d=await r.json();if(!r.ok)throw Error(`GitHub ${r.status}: ${d.message}`);return d;}
(async()=>{
  const files=['arm64','x64'].map(arch=>JSON.parse(readFileSync(join(directory,`macos-${arch}.json`))));
  for(const file of files)if(!readdirSync(directory).includes(file.filename))throw Error('Release file missing');
  const manifest={version,minimumMacOS:'13.0',publishedAt:new Date().toISOString(),notarized:false,signature:'ad-hoc',files};
  const manifestName='macos-release.json';writeFileSync(join(directory,manifestName),JSON.stringify(manifest,null,2)+'\n');
  const sums=files.map(file=>file.sha256+'  '+file.filename).join('\n')+'\n';writeFileSync(join(directory,'SHA256SUMS.txt'),sums);
  const prior=(await api('/releases?per_page=100')).find(release=>release.tag_name===tag);
  const release=prior ?? await api('/releases','POST',{tag_name:tag,target_commitish:process.env.GITHUB_SHA,name:`OAKEdge macOS ${version} · 测试版`,draft:true,prerelease:true,
    body:'macOS 13 及以上，提供 Apple 芯片与 Intel 两种 DMG。打开后将 OAKEdge 拖入 Applications，再登录同一 OAKEdge 账号。\n\n支持场景编排、API 共创、设备任务、浏览器 CV 检测、摄像头与麦克风。关闭窗口后继续后台运行，退出应用使用 ⌘Q。网页、APK 和中继位于独立服务器，无需电脑充当中继。\n\n这是 ad-hoc 签名、未经过 Apple 公证的测试版，首次打开可能需要在“系统设置 → 隐私与安全性”允许打开。两种架构均在 macOS 构建机器验证启动、网页加载和模拟摄像头／麦克风；真实硬件权限仍需在设备首次使用时授权。\n\n[下载页](https://oakedge-a800.tail34c76d.ts.net/download/macos)'});
  const assets=await api('/releases/'+release.id+'/assets');
  for(const name of [...files.map(file=>file.filename),manifestName,'SHA256SUMS.txt']){
    if(assets.some(asset=>asset.name===name))continue;
    const data=readFileSync(join(directory,name));
    const r=await fetch(release.upload_url.replace(/\{.*$/,'')+'?name='+encodeURIComponent(name),{method:'POST',headers:{...headers,'Content-Type':name.endsWith('.dmg')?'application/x-apple-diskimage':'application/octet-stream','Content-Length':String(data.length)},body:data,signal:AbortSignal.timeout(240000)});
    if(!r.ok)throw Error('Release upload '+r.status);
    const asset=await r.json(),expected=files.find(file=>file.filename===name);
    if(expected && (asset.size!==expected.bytes || asset.digest!=='sha256:'+expected.sha256))throw Error('Release checksum mismatch');
  }
  if(release.draft)await api('/releases/'+release.id,'PATCH',{draft:false});
  console.log(JSON.stringify({releaseURL:release.html_url,files}));
})().catch(error=>{console.error(error);process.exitCode=1;});
