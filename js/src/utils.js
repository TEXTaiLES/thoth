/*===========================================================================

    THOTH
    Utility Functions

    Author: 
        Stelios Alvanos (steliosalvanos@gmail.com)

===========================================================================*/
let Utils = {};



Utils.rgb2hex = (r, g, b) => {
    const componentToHex = (c) => {
        var hex = c.toString(16);
        return hex.length === 1 ? "0" + hex : hex;
    }
    return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
};

Utils.hex2rgb = (hex) => {
    // Also normalize
    const r = parseInt(hex.slice(1, 3), 16)/255;
    const g = parseInt(hex.slice(3, 5), 16)/255;
    const b = parseInt(hex.slice(5, 7), 16)/255;
    return {r, g, b};
};

Utils.getHighlightColor = (id) => {
    // Create a rotating color for clarity
    const r = parseInt(255 * Math.sin(id * Math.PI/4)/2 + 128);
    const g = parseInt(255 * Math.sin(id * Math.PI/4 + 2* Math.PI/3)/2 + 128);
    const b = parseInt(255 * Math.sin(id * Math.PI/4 - 2* Math.PI/3)/2 + 128);

    const color = THOTH.Utils.rgb2hex(r, g, b);

    return color;
};

Utils.getFirstUnusedKey = (objOrMap) => {
    let keys;

    if (objOrMap instanceof Map) {
        // Extract map keys
        keys = Array.from(objOrMap.keys()).map(Number);
    } else {
        // Extract object keys
        keys = Object.keys(objOrMap).map(Number);
    }

    const keySet = new Set(keys);

    let id = 0;
    while (keySet.has(id)) {
        id++;
    }

    return id;
}; 

Utils.computeRadius = (r) => {
    return (0.25 * 1.2**r);
};

Utils.pointDistance = (pos1, pos2) => {
    const dist = Math.sqrt(
        Math.pow(pos1.x - pos2.x, 2) + 
        Math.pow(pos1.y - pos2.y, 2)
    );
    return dist;
};

Utils.isPointInPolygon = (point, polygon) => {
    let inside = false;
    const { x, y } = point;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x, yi = polygon[i].y;
        const xj = polygon[j].x, yj = polygon[j].y;

        const intersect = ((yi > y) !== (yj > y)) &&
            (x < (xj - xi) * (y - yi) / (yj - yi) + xi);

        if (intersect) inside = !inside;
    }
    return inside;
};

Utils.downloadImage = async (url, filenameFallback = "image.png") => {
    if (!url) return;

    const filenameFromUrl = (u, fallback) => {
        try {
            const name = u.split('/').pop().split('?')[0];
            return name || fallback;
        } catch (e) {
            return fallback;
        }
    };

    const filename = filenameFromUrl(url, filenameFallback);

    if (url.startsWith("data:")) {
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        return;
    }

    try {
        const resp = await fetch(url, { mode: "cors" });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const blob = await resp.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);
    } catch (err) {
        window.open(url, "_blank");
    }
};

Utils.bindInput = (value, min, max) => {
    let num = parseInt(value);
    if (isNaN(num) || num < min) return min;
    if (num > max) return max;
    return num;
};

Utils.uniformSamplingFromMap = (map, n) => {
    const step = Math.floor(map.size / n);
    const sampledMap = new Map();

    for (const [key, value] of map) {
        if (key % step !== 0) continue;
        sampledMap.set(key, value);
    }
    return sampledMap;
};


export default Utils;