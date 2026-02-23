"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeJsonReport = writeJsonReport;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
function writeJsonReport(outDir, report, pretty) {
    const targetPath = path_1.default.join(outDir, "report.json");
    const spacing = pretty ? 2 : 0;
    fs_1.default.writeFileSync(targetPath, JSON.stringify(report, null, spacing), "utf8");
}
