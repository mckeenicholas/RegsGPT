/**
 * Script to fetch WCA incidents from the API and upsert them into MongoDB.
 *
 * Usage: bun run scripts/fetch-incidents.ts
 *
 * Requires MONGODB_URI in .env (loaded via dotenv).
 */
import "dotenv/config";
import mongoose from "mongoose";
import { Incident } from "../src/lib/server/db/models/Incident";

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
  tags: Array<{
    name: string;
    class: string;
    id: string;
    content_html: string;
    url: string;
  }>;
  competitions: Array<{
    id: string;
    name: string;
    comments: string;
  }>;
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

async function upsertIncidents(incidents: WCAIncident[]): Promise<void> {
  let created = 0;
  let updated = 0;

  for (const incident of incidents) {
    const result = await Incident.updateOne(
      { incidentId: incident.id },
      {
        $set: {
          incidentId: incident.id,
          title: incident.title,
          public_summary: incident.public_summary,
          created_at: new Date(incident.created_at),
          updated_at: new Date(incident.updated_at),
          resolved_at: incident.resolved_at ? new Date(incident.resolved_at) : null,
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
        },
      },
      { upsert: true },
    );

    if (result.upsertedCount > 0) {
      created++;
    } else if (result.modifiedCount > 0) {
      updated++;
    }
  }

  console.log(
    `[DB] Upserted incidents: ${created} created, ${updated} updated, ${incidents.length - created - updated} unchanged`,
  );
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("Error: MONGODB_URI environment variable is not set");
    process.exit(1);
  }

  console.log("[DB] Connecting to MongoDB...");
  await mongoose.connect(uri);
  console.log("[DB] Connected");

  try {
    const incidents = await fetchIncidents();
    await upsertIncidents(incidents);
    console.log("[Done] Incident sync complete");
  } finally {
    await mongoose.disconnect();
    console.log("[DB] Disconnected");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
