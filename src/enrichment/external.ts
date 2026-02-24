import type { ExternalInsights, Locale } from "../domain/types";
import { fetchFaceitAccountInsight } from "./faceit";
import { fetchSteamAccountInsight } from "./steam";

interface FetchExternalInsightsInput {
  focusPlayer: string;
  focusSteamId?: string;
  language: Locale;
  steamApiKey?: string;
  faceitApiKey?: string;
  faceitPlayerId?: string;
  faceitNickname?: string;
}

export async function fetchExternalInsights(
  input: FetchExternalInsightsInput,
): Promise<{ insights?: ExternalInsights; warnings: string[] }> {
  const warnings: string[] = [];
  const steamPromise = input.steamApiKey
    ? fetchSteamAccountInsight({
        playerName: input.focusPlayer,
        steamId: input.focusSteamId,
        apiKey: input.steamApiKey,
        language: input.language,
      }).catch((error) => ({
        insight: undefined,
        warnings: [localizeError(input.language, "steam", error)],
      }))
    : Promise.resolve({ insight: undefined, warnings: [] as string[] });

  const faceitPromise = input.faceitApiKey
    ? fetchFaceitAccountInsight({
        playerName: input.focusPlayer,
        steamId: input.focusSteamId,
        playerId: input.faceitPlayerId,
        nickname: input.faceitNickname,
        apiKey: input.faceitApiKey,
        language: input.language,
      }).catch((error) => ({
        insight: undefined,
        warnings: [localizeError(input.language, "faceit", error)],
      }))
    : Promise.resolve({ insight: undefined, warnings: [] as string[] });

  const [steamResult, faceitResult] = await Promise.all([
    steamPromise,
    faceitPromise,
  ]);

  warnings.push(...steamResult.warnings);
  warnings.push(...faceitResult.warnings);

  const insights: ExternalInsights = {
    focusPlayer: input.focusPlayer,
    focusSteamId: input.focusSteamId,
    steam: steamResult.insight,
    faceit: faceitResult.insight,
  };

  if (!insights.steam && !insights.faceit) {
    return { warnings };
  }

  return { insights, warnings };
}

function localizeError(
  language: Locale,
  source: "steam" | "faceit",
  error: unknown,
): string {
  const reason = error instanceof Error ? error.message : String(error);
  if (language === "tr") {
    return source === "steam"
      ? `Steam API analizinde hata: ${reason}`
      : `FACEIT API analizinde hata: ${reason}`;
  }

  return source === "steam"
    ? `Steam API analysis failed: ${reason}`
    : `FACEIT API analysis failed: ${reason}`;
}
