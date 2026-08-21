const fs = require('fs');
const path = require('path');

// This utility modifies only the explicitly supplied gateway file. The Docker
// build points it at the ATON checkout cloned inside the image. It is never
// invoked by native `npm start`; a host ATON checkout can therefore only be
// changed by an operator running this command manually.
const gatewayPath = process.argv[2];
if (!gatewayPath) throw new Error('Usage: node install-gateway.cjs <ATON.service.main.js>');

const markerPattern = /app\.use\(express\.json\(\{\s*limit:\s*['"]50mb['"]\s*\}\)\);/;

const source = fs.readFileSync(gatewayPath, 'utf8');
if (source.includes("'gateway-extension.js'")) process.exit(0);
const marker = source.match(markerPattern)?.[0];
if (!marker) {
    throw new Error(`Cannot install THOTH gateway extension: marker not found in ${gatewayPath}`);
}

const installLine = [
    marker,
    '',
    '// THOTH deployment extension (installed by the THOTH Docker image).',
    "require(path.join(Core.DIR_WAPPS, 'thoth', 'server', 'deployment', 'gateway-extension.js'))(app);"
].join('\n');
fs.writeFileSync(gatewayPath, source.replace(markerPattern, installLine));
console.log(`Installed THOTH gateway extension into ${path.basename(gatewayPath)}`);
