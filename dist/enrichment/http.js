"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchJson = fetchJson;
async function fetchJson(url, init, timeoutMs = 8000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const headers = new Headers(init.headers);
        headers.set("Accept", "application/json");
        const response = await fetch(url, {
            ...init,
            headers,
            signal: controller.signal,
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        return response.json();
    }
    finally {
        clearTimeout(timer);
    }
}
