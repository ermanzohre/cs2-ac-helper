"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseDemo = parseDemo;
exports.validateDemoExtension = validateDemoExtension;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const parser_demofile_1 = require("./parser-demofile");
const parser_demoparser2_1 = require("./parser-demoparser2");
async function parseDemo(demoPath, parserPreference, verbose) {
    if (!fs_1.default.existsSync(demoPath)) {
        throw new Error(`Demo path not found: ${demoPath}`);
    }
    const selected = resolveParser(parserPreference, detectDemoMagic(demoPath));
    if (selected === "demofile") {
        return (0, parser_demofile_1.parseDemoWithDemofile)(demoPath, verbose);
    }
    if (selected === "demoparser2") {
        return (0, parser_demoparser2_1.parseDemoWithDemoparser2)(demoPath, verbose);
    }
    throw new Error(`Unsupported parser: ${selected}`);
}
function resolveParser(value, demoMagic) {
    const normalized = value.trim().toLowerCase();
    if (normalized === "auto") {
        if (demoMagic === "PBDEMS2") {
            return "demoparser2";
        }
        return "demofile";
    }
    if (normalized === "demofile") {
        if (demoMagic === "PBDEMS2") {
            throw new Error("Parser 'demofile' does not support CS2 demo header PBDEMS2. Use --parser demoparser2 or --parser auto.");
        }
        return "demofile";
    }
    if (normalized === "demoparser2") {
        return "demoparser2";
    }
    throw new Error(`Unknown parser preference: ${value}`);
}
function validateDemoExtension(demoPath) {
    const extension = path_1.default.extname(demoPath).toLowerCase();
    if (extension !== ".dem") {
        throw new Error(`Expected a .dem file, received: ${extension || "<none>"}`);
    }
}
function detectDemoMagic(demoPath) {
    const fd = fs_1.default.openSync(demoPath, "r");
    try {
        const header = Buffer.alloc(8);
        const bytesRead = fs_1.default.readSync(fd, header, 0, 8, 0);
        return header.toString("ascii", 0, bytesRead).replace(/\0+$/, "");
    }
    finally {
        fs_1.default.closeSync(fd);
    }
}
