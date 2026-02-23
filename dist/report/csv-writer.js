"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeTimelineCsv = writeTimelineCsv;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
function writeTimelineCsv(outDir, report) {
    const targetPath = path_1.default.join(outDir, "timeline.csv");
    const lines = ["round,tick_start,tick_end,time_sec,reason,tags"];
    for (const event of report.topEvents) {
        const reason = csvEscape(event.reason);
        const tags = csvEscape(event.tags.join("|"));
        lines.push(`${event.round},${event.tickStart},${event.tickEnd},${event.timeSec.toFixed(3)},${reason},${tags}`);
    }
    fs_1.default.writeFileSync(targetPath, `${lines.join("\n")}\n`, "utf8");
}
function csvEscape(value) {
    if (value.includes(",") || value.includes('"') || value.includes("\n")) {
        return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
}
