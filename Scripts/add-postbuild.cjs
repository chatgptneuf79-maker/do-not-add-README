const fs = require('fs');

const pkgPath = 'package.json';
const p = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

p.scripts = p.scripts || {};
p.scripts.postbuild = 'cp public/_redirects dist/_redirects';

fs.writeFileSync(pkgPath, JSON.stringify(p, null, 2) + '\n');
console.log('UPDATED SCRIPTS:\n' + JSON.stringify(p.scripts, null, 2));
