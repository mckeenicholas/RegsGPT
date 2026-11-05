import { readFileSync } from "fs";
import { join } from "path";
import { listAll as listIncidents } from "../db/models/Incident";

let cachedSystemPrompt: string | null = null;

function loadFile(filename: string): string {
  const dataDir = join(process.cwd(), "src", "lib", "server", "data");
  return readFileSync(join(dataDir, filename), "utf8");
}

/**
 * Format incidents into a compact text representation for the LLM context.
 */
function formatIncidents(
  incidents: {
    incidentId: number;
    title: string;
    public_summary: string;
    tags: { name: string; id: string }[];
    competitions: { name: string }[];
  }[],
): string {
  if (incidents.length === 0) {
    return "No incidents available.";
  }

  return incidents
    .map((inc) => {
      const tags = inc.tags.map((t) => t.id || t.name).join(", ");
      const comps = inc.competitions.map((c) => c.name).join(", ");
      return [
        `## Incident ${inc.incidentId}: ${inc.title}`,
        tags ? `Related regulations: ${tags}` : "",
        comps ? `Competition(s): ${comps}` : "",
        "",
        inc.public_summary,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n---\n\n");
}

/**
 * Returns the full system prompt including WCA regulations and incident log.
 * Loads prompt template from prompt.txt, regulations from regs.md,
 * and incidents from the database.
 */
export async function getSystemPrompt(): Promise<string> {
  if (cachedSystemPrompt) {
    return cachedSystemPrompt;
  }

  // Load static files
  const promptTemplate = loadFile("prompt.txt");
  const regulations = loadFile("regs.md");

  // Load incidents from DB
  let incidentText: string;
  try {
    const incidents = listIncidents();
    incidentText = formatIncidents(incidents);
  } catch (error) {
    console.warn("[Documents] Failed to load incidents from DB, using empty:", error);
    incidentText = "Incident log is not available.";
  }

  // Substitute placeholders
  cachedSystemPrompt = promptTemplate
    .replace("{{regulations}}", regulations)
    .replace("{{incident_log}}", incidentText);

  return cachedSystemPrompt;
}

/**
 * Clear the cached prompt (e.g., after syncing incidents).
 */
export function clearPromptCache(): void {
  cachedSystemPrompt = null;
}
