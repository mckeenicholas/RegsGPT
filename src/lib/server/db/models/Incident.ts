import mongoose, { Schema, Document, Model } from "mongoose";

export interface IIncidentTag {
  name: string;
  class: string;
  id: string;
  content_html: string;
  url: string;
}

export interface IIncidentCompetition {
  id: string;
  name: string;
  comments: string;
}

export interface IIncident {
  incidentId: number; // WCA incident ID
  title: string;
  public_summary: string;
  created_at: Date;
  updated_at: Date;
  resolved_at: Date | null;
  url: string;
  tags: IIncidentTag[];
  competitions: IIncidentCompetition[];
}

export interface IIncidentDocument extends IIncident, Document {}

const IncidentTagSchema = new Schema<IIncidentTag>(
  {
    name: { type: String, required: true },
    class: { type: String, required: true },
    id: { type: String, required: true },
    content_html: { type: String, default: "" },
    url: { type: String, default: "" },
  },
  { _id: false },
);

const IncidentCompetitionSchema = new Schema<IIncidentCompetition>(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    comments: { type: String, default: "" },
  },
  { _id: false },
);

const IncidentSchema = new Schema<IIncidentDocument>(
  {
    incidentId: { type: Number, required: true, unique: true, index: true },
    title: { type: String, required: true },
    public_summary: { type: String, required: true },
    created_at: { type: Date, required: true },
    updated_at: { type: Date, required: true },
    resolved_at: { type: Date, default: null },
    url: { type: String, required: true },
    tags: { type: [IncidentTagSchema], default: [] },
    competitions: { type: [IncidentCompetitionSchema], default: [] },
  },
  {
    timestamps: false,
  },
);

export const Incident: Model<IIncidentDocument> =
  mongoose.models.Incident ||
  mongoose.model<IIncidentDocument>("Incident", IncidentSchema);
