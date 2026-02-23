"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeVerdict = computeVerdict;
function computeVerdict(input, language) {
    const code = resolveVerdictCode(input);
    return {
        code,
        label: localizeVerdict(code, language),
    };
}
function resolveVerdictCode(input) {
    if (input.scoreFinal >= 78 ||
        (input.scoreFinal >= 66 &&
            input.wallhack.value >= 0.28 &&
            input.confidence >= 0.9)) {
        return "high_suspicion";
    }
    if (input.scoreFinal >= 58 ||
        (input.scoreFinal >= 46 &&
            input.wallhack.value >= 0.24 &&
            input.confidence >= 0.85)) {
        return "suspicious";
    }
    if (input.scoreFinal >= 38 ||
        (input.scoreFinal >= 28 &&
            input.wallhack.value >= 0.18 &&
            input.confidence >= 0.8)) {
        return "watch";
    }
    return "clean";
}
function localizeVerdict(code, language) {
    if (language === "tr") {
        switch (code) {
            case "high_suspicion":
                return "Yüksek şüphe";
            case "suspicious":
                return "Şüpheli";
            case "watch":
                return "İzlenmeli";
            case "clean":
            default:
                return "Temiz";
        }
    }
    switch (code) {
        case "high_suspicion":
            return "High Suspicion";
        case "suspicious":
            return "Suspicious";
        case "watch":
            return "Watch";
        case "clean":
        default:
            return "Clean";
    }
}
