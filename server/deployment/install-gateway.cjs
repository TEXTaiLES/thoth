const fs = require('fs');
const path = require('path');

// This utility modifies only the explicitly supplied gateway file. The Docker
// build points it at the ATON checkout cloned inside the image. It is never
// invoked by native `npm start`; a host ATON checkout can therefore only be
// changed by an operator running this command manually.
const gatewayPath = process.argv[2];
if (!gatewayPath) throw new Error('Usage: node install-gateway.cjs <ATON.service.main.js>');

// Install before ATON registers its data/static routes. This boundary is stable
// across the old 50 MB and current multiline 100 MB body-parser layouts.
const routingBoundaryPattern = /^\/\/ Data routing \(advanced\)\r?$/m;

const source = fs.readFileSync(gatewayPath, 'utf8');
if (source.includes("'gateway-extension.js'")) process.exit(0);
const routingBoundary = source.match(routingBoundaryPattern)?.[0];
if (!routingBoundary) {
    throw new Error(`Cannot install THOTH gateway extension: routing boundary not found in ${gatewayPath}`);
}

const installLine = [
    '// THOTH deployment extension (installed by the THOTH Docker image).',
    "require(path.join(Core.DIR_WAPPS, 'thoth', 'server', 'deployment', 'gateway-extension.js'))(app);",
    '',
    routingBoundary
].join('\n');
fs.writeFileSync(gatewayPath, source.replace(routingBoundaryPattern, installLine));
console.log(`Installed THOTH gateway extension into ${path.basename(gatewayPath)}`);
