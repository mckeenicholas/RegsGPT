/**
 * Script to fetch WCA incidents from the API and upsert them into SQLite.
 *
 * Usage: bun run scripts/fetch-incidents.ts
 *
 * Optionally set DATABASE_PATH in .env (loaded via dotenv); defaults to
 * ./data/regsgpt.db.
 */
import "dotenv/config";
import { closeDB, getDB } from "../src/lib/server/db/connection";
import { upsertMany, type IncidentInput } from "../src/lib/server/db/models/Incident";

const WCA_API_URL = "https://www.worldcubeassociation.org/api/v0/incidents";
const PER_PAGE = 1000;

interface WCAIncident {
  id: number;
  title: string;
  public_summary: string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  url: string;
  tags: {
    name: string;
    class: string;
    id: string;
    content_html: string;
    url: string;
  }[];
  competitions: {
    id: string;
    name: string;
    comments: string;
  }[];
  // We intentionally skip private_description, digest_worthy, digest_sent_at
}

async function fetchIncidents(): Promise<WCAIncident[]> {
  console.log(`[Fetch] Fetching incidents from ${WCA_API_URL}?per_page=${PER_PAGE}`);

  const response = await fetch(`${WCA_API_URL}?per_page=${PER_PAGE}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch incidents: ${response.status} ${response.statusText}`);
  }

  const data: WCAIncident[] = await response.json();
  console.log(`[Fetch] Retrieved ${data.length} incidents from WCA API`);
  return data;
}

function toIncidentInput(incident: WCAIncident): IncidentInput {
  return {
    incidentId: incident.id,
    title: incident.title,
    public_summary: incident.public_summary,
    createdAt: new Date(incident.created_at),
    updatedAt: new Date(incident.updated_at),
    resolvedAt: incident.resolved_at ? new Date(incident.resolved_at) : null,
    url: incident.url,
    tags: incident.tags.map((t) => ({
      name: t.name,
      class: t.class,
      id: t.id,
      content_html: t.content_html,
      url: t.url,
    })),
    competitions: incident.competitions.map((c) => ({
      id: c.id,
      name: c.name,
      comments: c.comments,
    })),
  };
}

async function main() {
  console.log("[DB] Opening SQLite database...");
  getDB();

  try {
    const incidents = await fetchIncidents();
    const result = upsertMany(incidents.map((incident) => toIncidentInput(incident)));
    console.log(
      `[DB] Upserted incidents: ${result.created} created, ${result.updated} updated, ${result.unchanged} unchanged`,
    );
    console.log("[Done] Incident sync complete");
  } finally {
    closeDB();
    console.log("[DB] Closed");
  }
}

try {
  await main();
} catch (error) {
  console.error("Fatal error:", error);
  process.exit(1);
}
