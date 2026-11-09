const {readdirSync,readFileSync,writeFileSync,renameSync,statSync} = require('node:fs');
const {join} = require('node:path');
const {createHash} = require('node:crypto');
const {execFileSync} = require('node:child_process');
const version=require('../package.json').version, arch=process.argv[2];
if(!['arm64','x64'].includes(arch))throw Error('Expected arm64 or x64');
const directory=join(__dirname,'../out');
const source=readdirSync(directory).find(name=>name.endsWith(`-${arch}.dmg`));
if(!source)throw Error('DMG missing');
const path=join(directory,source),sha256=createHash('sha256').update(readFileSync(path)).digest('hex');
const filename=`OAKEdge-${version}-macos-${arch}-${sha256.slice(0,16)}.dmg`;
renameSync(path,join(directory,filename));
const appDirectory=join(directory,arch==='arm64'?'mac-arm64':'mac','OAKEdge.app');
const installedBytes=Number(execFileSync('du',['-sk',appDirectory],{encoding:'utf8'}).split(/\s/)[0])*1024;
const artifact={arch,filename,sha256,bytes:statSync(join(directory,filename)).size,installedBytes,
  downloadURL:`https://github.com/XAI-CyberSpark/OAKEdge-Downloads/releases/download/macos-v${version}/${filename}`};
writeFileSync(join(directory,`macos-${arch}.json`),JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify(artifact));
