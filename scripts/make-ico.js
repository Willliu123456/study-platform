/* 临时脚本：由 PWA 图标生成 Windows 应用图标 app.ico（多尺寸） */
'use strict';
const fs = require('fs');
const path = require('path');
const pngToIco = require('png-to-ico').default;

const src = path.join(__dirname, '..', 'assets', 'icon-512.png');
const out = path.join(__dirname, '..', 'assets', 'app.ico');

pngToIco([src])
  .then((buf) => {
    fs.writeFileSync(out, buf);
    console.log('OK: ' + out + ' (' + buf.length + ' bytes)');
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
