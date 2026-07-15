/*!
    @preserve

    ATON Main Service (gateway)

    @author Bruno Fanini
  VHLab, CNR ISPC

==================================================================================*/

const fs = require('fs');
const express = require('express');
const http = require('http');
const https = require('https');
const url = require('url');
//const compression = require('compression');
const path = require('path');
const cors = require('cors');
const chalk = require('chalk');

const { createProxyMiddleware, fixRequestBody } = require('http-proxy-middleware');

const Core = require('./Core');
const Auth = require('./Auth');
const Render = require('./Render');
const API = require("./API/v2"); // v2
const cookieParser = require('cookie-parser');


// Initialize & load config files
Core.init();

const CONF = Core.config;

// Standard PORTS
let PORT = 8080;
let PORT_SECURE = 8083;
let VRC_PORT = 8890;
let VRC_ADDR = "ws://localhost";
let PORT_WEBDAV = 8081;

if (CONF.services.main.PORT)
  PORT = CONF.services.main.PORT;

if (process.env.PORT)
  PORT = process.env.PORT;

if (CONF.services.main.PORT_S)
  PORT_SECURE = CONF.services.main.PORT_S;

if (CONF.services.photon) {
  if (CONF.services.photon.PORT) VRC_PORT = CONF.services.photon.PORT;
  if (CONF.services.photon.address) VRC_ADDR = CONF.services.photon.address;
}

// compatibility with previous configs
if (CONF.services.vroadcast) {
  if (CONF.services.vroadcast.PORT) VRC_PORT = CONF.services.vroadcast.PORT;
  if (CONF.services.vroadcast.address) VRC_ADDR = CONF.services.vroadcast.address;
}

if (CONF.services.webdav && CONF.services.webdav.PORT)
  PORT_WEBDAV = CONF.services.webdav.PORT;

const pathCert = Core.getCertPath();
const pathKey = Core.getKeyPath();

let bExamples = CONF.services.main.examples;
//let bAPIdoc   = CONF.services.main.apidoc;

// Debug on req received (client)
let logger = function(req, res, next) {
  console.log('Request from: ' + req.ip + ' For: ' + req.path);
  next(); // Run the next handler
};


let app = express();

//app.set('trust proxy', 1); 	// trust first proxy

//app.use(compression());

app.use(cors({
  credentials: true,
  origin: true
}));
/*
app.use((req, res, next)=>{
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});
*/
app.use(express.json({ limit: '50mb' }));

app.use(cookieParser());

const DIRECTUS_PROXY_PATH = '/directus';
const DIRECTUS_PROXY_TARGET = process.env.DIRECTUS_PROXY_TARGET || "https://textailes.athenarc.gr";
const HESTIA_PROXY_PATH = '/hestia';
const HESTIA_PROXY_TARGET = process.env.HESTIA_PROXY_TARGET || "https://api.textailes.athenarc.gr";
const THOTH_CONFIG_PATH = path.join(Core.DIR_WAPPS, "thoth", "config.json");

const ENDPOINT_PROXY_TARGETS = [
  {
    proxyPath: HESTIA_PROXY_PATH,
    target: HESTIA_PROXY_TARGET
  },
  {
    proxyPath: DIRECTUS_PROXY_PATH,
    target: DIRECTUS_PROXY_TARGET
  }
];

const getProxyEndpointUrl = (endpointUrl) => {
  if (typeof endpointUrl !== "string") return endpointUrl;

  try {
    const endpoint = new URL(endpointUrl);

    for (const proxyTarget of ENDPOINT_PROXY_TARGETS) {
      const target = new URL(proxyTarget.target);
      const targetPath = target.pathname.replace(/\/$/, "");

      if (endpoint.origin !== target.origin) continue;
      if (targetPath && !endpoint.pathname.startsWith(targetPath + "/")) continue;

      const endpointPath = targetPath
        ? endpoint.pathname.slice(targetPath.length)
        : endpoint.pathname;
      const proxyPath = endpointPath.startsWith("/")
        ? endpointPath
        : `/${endpointPath}`;

      return `${proxyTarget.proxyPath}${proxyPath}${endpoint.search}${endpoint.hash}`;
    }
  }
  catch (err) {
    return endpointUrl;
  }

  return endpointUrl;
};

const rewriteThothEndpointUrls = (value) => {
  if (Array.isArray(value)) return value.map(rewriteThothEndpointUrls);
  if (!value || typeof value !== "object") return value;

  const rewritten = {};
  for (const key of Object.keys(value)) {
    rewritten[key] = key === "endpoint_url"
      ? getProxyEndpointUrl(value[key])
      : rewriteThothEndpointUrls(value[key]);
  }

  return rewritten;
};

app.get('/a/thoth/config.json', (req, res, next) => {
  fs.readFile(THOTH_CONFIG_PATH, "utf8", (err, data) => {
    if (err) {
      next(err);
      return;
    }

    try {
      const config = JSON.parse(data);

      if (process.env.HESTIA_API_AUTH_KEY) config.authKey = process.env.HESTIA_API_AUTH_KEY;

      const rewrittenConfig = rewriteThothEndpointUrls(config);

      res.type("json").send(JSON.stringify(rewrittenConfig, null, 4));
    }
    catch (parseError) {
      next(parseError);
    }
  });
});

// THOTH EGI Check-In login routes (egi-login / egi-callback / whoami / egi-logout).
// Mounted here — before the '/a' static handler below — so the routes win over
// static file serving. The module lives in the thoth wapp, not ATON core.
require(path.join(Core.DIR_WAPPS, "thoth", "server", "egi-routes.js"))(app);

app.use('/directus', createProxyMiddleware({
  target: DIRECTUS_PROXY_TARGET,
  pathRewrite: { '^/directus': '' },
  changeOrigin: true,
  cookieDomainRewrite: { "*": ".textailes.athenarc.gr" },
  cookiePathRewrite: { "*": "/" },
  on: {
    proxyReq: (proxyReq, req, res) => {
      fixRequestBody(proxyReq, req, res);
      req._directusReqStart = Date.now();
    },
    proxyRes: (proxyRes, req, res) => {
      const elapsed = req._directusReqStart ? (Date.now() - req._directusReqStart) : -1;
      console.log('[Directus Proxy]', req.method, req.url, '->', proxyRes.statusCode, `${elapsed}ms`);
    },
    error: (err, req, res) => {
      const elapsed = req && req._directusReqStart ? (Date.now() - req._directusReqStart) : -1;
      console.error('[Directus Proxy]', req && req.method, req && req.url, '-> ERROR', err.code || 'PROXY_ERROR', `${elapsed}ms`);
      if (!res.headersSent) {
        res.status(504).json({ error: err.code || 'PROXY_TIMEOUT', message: err.message });
      }
    }
  }
}));

app.use('/hestia', createProxyMiddleware({
  target: HESTIA_PROXY_TARGET,
  pathRewrite: { '^/hestia': '' },
  changeOrigin: true,
  on: {
    proxyReq: (proxyReq, req, res) => {
      fixRequestBody(proxyReq, req, res);
      req._hestiaReqStart = Date.now();
    },
    proxyRes: (proxyRes, req, res) => {
      const elapsed = req._hestiaReqStart ? (Date.now() - req._hestiaReqStart) : -1;
      console.log('[Hestia Proxy]', req.method, req.url, '->', proxyRes.statusCode, `${elapsed}ms`);
    },
    error: (err, req, res) => {
      const elapsed = req && req._hestiaReqStart ? (Date.now() - req._hestiaReqStart) : -1;
      console.error('[Hestia Proxy]', req && req.method, req && req.url, '-> ERROR', err.code || 'PROXY_ERROR', `${elapsed}ms`);
      if (!res.headersSent) {
        res.status(504).json({ error: err.code || 'PROXY_TIMEOUT', message: err.message });
      }
    }
  }
}));

// Scenes redirect /s/<sid>
/*
app.get(/^\/s\/(.*)$/, function(req,res,next){
  let sid = req.params[0];

  //req.url     = "/fe";
  //req.query.s = sid;
	
  res.redirect(url.format({
    pathname:"/fe",
    query: { "s": sid }
  }));

  next();
});
*/

// Data routing (advanced)
//Core.setupDataRoute(app);

const CACHING_OPT = {
  maxage: "3h"
};

app.use('/', express.static(Core.DIR_PUBLIC, CACHING_OPT));

// Official front-end (Hathor)
//app.use('/fe', express.static(Core.DIR_FE));

// Common public resources (config/public/)
if (fs.existsSync(Core.DIR_CONFIGPUB)) app.use('/common', express.static(Core.DIR_CONFIGPUB));

// Web-apps
app.use('/a', express.static(Core.DIR_WAPPS));

// Data (static)
app.use('/', express.static(Core.DIR_DATA, CACHING_OPT));

// Setup authentication
Auth.init(app);


// REST API
Core.realizeBaseAPI(app); 	// v1 (for backward compatibility)
API.init(app);			// v2


// Rendering
Core.Render.setup(app);


// Micro-services proxies
//=================================================

// Photon (previously VRoadcast)
app.use('/vrc', createProxyMiddleware({
  target: VRC_ADDR + ":" + VRC_PORT,
  ws: true,
  pathRewrite: { '^/vrc': '' },
  changeOrigin: true
}));
app.use('/svrc', createProxyMiddleware({
  target: VRC_ADDR + ":" + VRC_PORT,
  ws: true,
  pathRewrite: { '^/svrc': '' },
  secure: true,
  changeOrigin: true
}));

// WebDav
/*
app.use('/dav', createProxyMiddleware({ 
  //target: CONF.services.webdav.address+":"+PORT_WEBDAV, 
  target: "http://localhost:"+PORT_WEBDAV,
  pathRewrite: { '^/dav': ''},
  changeOrigin: false, //true,
  //xfwd: true,
  //secure: true,

  //router: { "/dav" : "http://localhost:"+PORT_WEBDAV }
}));
*/

// 404
//==================================
/*
//TODO:
app.use((req, res, next) => {
  //res.status(404).send('<h1>Page not found</h1>');
});
*/

// Collect & setup flares (if found)
//==================================
Core.setupFlares(app);

for (let fid in Core.flares) {
  //let fid = Core.flares[f];
  app.use('/flares/' + fid, express.static(Core.DIR_FLARES + fid + "/public/"));
}

// START
//==================================
http.createServer(app).listen(PORT, () => {
  Core.printLogo();

  console.log("\nATON up and running!");
  console.log("- OFFLINE: http://localhost:" + PORT);
  for (let n in Core.nets) console.log("- NETWORK ('" + n + "'): http://" + Core.nets[n][0] + ":" + PORT);

  console.log("\n");
});

// HTTPS service
if (fs.existsSync(pathCert) && fs.existsSync(pathKey)) {
  let httpsOptions = {
    key: fs.readFileSync(pathKey, 'utf8'),
    cert: fs.readFileSync(pathCert, 'utf8')
  };

  https.createServer(httpsOptions, app).listen(PORT_SECURE, () => {
    console.log("\nHTTPS ATON up and running!");
    console.log("- OFFLINE: https://localhost:" + PORT_SECURE);
    for (let n in Core.nets) console.log("- NETWORK ('" + n + "'): https://" + Core.nets[n][0] + ":" + PORT_SECURE);

    console.log("\n");
  });
}
else {
  console.log("\nSSL certs not found:\n" + pathKey + "\n" + pathCert);
  console.log("\n");
}
