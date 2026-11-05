import { getDB } from "../connection";

export interface IncidentTag {
  name: string;
  class: string;
  id: string;
  content_html: string;
  url: string;
}

export interface IncidentCompetition {
  id: string;
  name: string;
  comments: string;
}

export interface Incident {
  incidentId: number;
  title: string;
  public_summary: string;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
  url: string;
  tags: IncidentTag[];
  competitions: IncidentCompetition[];
}

/** Shape accepted by upsertMany (matches the WCA API payload). */
export interface IncidentInput {
  incidentId: number;
  title: string;
  public_summary: string;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
  url: string;
  tags: IncidentTag[];
  competitions: IncidentCompetition[];
}

interface IncidentRow {
  incident_id: number;
  title: string;
  public_summary: string;
  created_at: number;
  updated_at: number;
  resolved_at: number | null;
  url: string;
  tags: string;
  competitions: string;
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function mapIncident(row: IncidentRow): Incident {
  return {
    incidentId: row.incident_id,
    title: row.title,
    public_summary: row.public_summary,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    resolvedAt: row.resolved_at === null ? null : new Date(row.resolved_at),
    url: row.url,
    tags: parseJson<IncidentTag[]>(row.tags, []),
    competitions: parseJson<IncidentCompetition[]>(row.competitions, []),
  };
}

export function listAll(): Incident[] {
  const db = getDB();
  const rows = db
    .prepare("SELECT * FROM incidents ORDER BY incident_id DESC")
    .all() as unknown as IncidentRow[];
  return rows.map((row) => mapIncident(row));
}

/**
 * Upserts incidents in a single transaction using `incident_id` as the key.
 */
export function upsertMany(incidents: IncidentInput[]): {
  created: number;
  updated: number;
  unchanged: number;
} {
  if (incidents.length === 0) {
    return { created: 0, updated: 0, unchanged: 0 };
  }

  const db = getDB();
  const existing = new Set(
    (
      db.prepare("SELECT incident_id FROM incidents").all() as unknown as {
        incident_id: number;
      }[]
    ).map((row) => row.incident_id),
  );

  const statement = db.prepare(
    `INSERT INTO incidents (
       incident_id, title, public_summary, created_at, updated_at,
       resolved_at, url, tags, competitions
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(incident_id) DO UPDATE SET
       title = excluded.title,
       public_summary = excluded.public_summary,
       created_at = excluded.created_at,
       updated_at = excluded.updated_at,
       resolved_at = excluded.resolved_at,
       url = excluded.url,
       tags = excluded.tags,
       competitions = excluded.competitions`,
  );

  let created = 0;
  let updated = 0;

  db.exec("BEGIN");
  try {
    for (const incident of incidents) {
      const result = statement.run(
        incident.incidentId,
        incident.title,
        incident.public_summary,
        incident.createdAt.getTime(),
        incident.updatedAt.getTime(),
        incident.resolvedAt ? incident.resolvedAt.getTime() : null,
        incident.url,
        JSON.stringify(incident.tags),
        JSON.stringify(incident.competitions),
      );

      if (!existing.has(incident.incidentId)) {
        created++;
      } else if (Number(result.changes) > 0) {
        updated++;
      }
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  return {
    created,
    updated,
    unchanged: incidents.length - created - updated,
  };
}
