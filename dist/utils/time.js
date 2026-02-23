"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.currentIsoTimestamp = currentIsoTimestamp;
function currentIsoTimestamp() {
    return new Date().toISOString();
}
