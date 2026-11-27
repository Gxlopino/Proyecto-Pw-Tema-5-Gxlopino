// scripts/build.js
import {spawn} from 'node:child_process';
const child=spawn(process.execPath,['node_modules/vite/bin/vite.js','build',...process.argv.slice(2)],{stdio:'inherit',env:{...process.env,NODE_ENV:'production'},windowsHide:true});
child.on('exit',code=>{process.exitCode=code??1;});
child.on('error',()=>{console.error('No se pudo ejecutar Vite. Ejecuta npm ci.');process.exitCode=1;});
