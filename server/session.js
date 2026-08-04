const crypto = require('crypto');

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const HESTIA_SESSION_TTL_MS = 5 * 60 * 1000;

const encode = (value) => Buffer.from(value).toString('base64url');

const sign = (payload, secret) => {
    const encoded = encode(JSON.stringify(payload));
    const signature = crypto
        .createHmac('sha256', secret)
        .update(encoded)
        .digest('base64url');
    return `${encoded}.${signature}`;
};

const verify = (token, secret) => {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [payload, signature] = parts;
    const expected = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('base64url');
    const actualBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (
        actualBuffer.length !== expectedBuffer.length ||
        !crypto.timingSafeEqual(actualBuffer, expectedBuffer)
    ) return null;

    try {
        const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
        if (!data.exp || Date.now() > Number(data.exp)) return null;
        return data;
    }
    catch {
        return null;
    }
};

const createSession = (identity, secret, ttl = SESSION_TTL_MS) => sign({
    ...identity,
    exp: Date.now() + ttl
}, secret);

module.exports = {
    SESSION_TTL_MS,
    HESTIA_SESSION_TTL_MS,
    createSession,
    verifySession: verify
};
