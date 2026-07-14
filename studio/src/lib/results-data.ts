import { useQuery } from "@tanstack/react-query";
import type { RunRecord } from "@/data/schema";

export const METRIC_KEYS = [
  "isc",
  "ig",
  "lod",
  "aid",
  "floor",
  "rho",
  "ics",
] as const;

export type MetricKey = (typeof METRIC_KEYS)[number];

export interface DiagnosticRow extends Record<MetricKey, number | null> {
  model: string;
  language: string;
  family: string;
  studyExperiment: number;
  anisotropyWarning: boolean;
}

export interface IndicatorRow extends Record<MetricKey, number | null> {
  model: string;
  language: string;
  lang: string;
  modelType: string;
  context: string;
  representation: string;
  studyExperiment: number;
  anisotropyWarning: boolean;
}

export interface CalibrationRow {
  model: string;
  idiomGap: number | null;
  compositionalGap: number | null;
  ordinaryGap: number | null;
  ocgIdiom: number | null;
  ocgCompositional: number | null;
  unstable: boolean;
  warning?: string | null;
}

function metricValue(run: RunRecord, key: MetricKey) {
  return run[key] ?? null;
}

async function loadRuns() {
  const response = await fetch("/seed/tr_project.json", { cache: "no-cache" });
  if (!response.ok) throw new Error("Failed to load result seed data.");
  const snapshot = await response.json();
  return (snapshot.runs ?? []) as RunRecord[];
}

export function useRunIndicators() {
  return useQuery({
    queryKey: ["run-indicators"],
    queryFn: async () => {
      const runs = await loadRuns();
      const completed = runs.filter((run) => run.status !== "failed");
      const diagnostics: DiagnosticRow[] = completed.map((run) => {
        const row = Object.fromEntries(METRIC_KEYS.map((key) => [key, metricValue(run, key)])) as Record<MetricKey, number | null>;
        return {
          ...row,
          model: run.model,
          language: run.language,
          family: run.family ?? run.cohort ?? "unknown",
          studyExperiment: run.studyExperiment ?? 1,
          anisotropyWarning: !!run.anisotropyWarning,
        };
      });
      const indicators: IndicatorRow[] = completed.map((run) => {
        const row = Object.fromEntries(METRIC_KEYS.map((key) => [key, metricValue(run, key)])) as Record<MetricKey, number | null>;
        return {
          ...row,
          model: run.model,
          language: run.language,
          lang: run.language,
          modelType: run.family ?? run.cohort ?? "unknown",
          context: run.context,
          representation: run.level,
          studyExperiment: run.studyExperiment ?? 1,
          anisotropyWarning: !!run.anisotropyWarning,
        };
      });
      const calibration: CalibrationRow[] = completed
        .filter((run) => run.idiomGap != null || run.ocgIdiom != null)
        .map((run) => ({
          model: run.model,
          idiomGap: run.idiomGap ?? null,
          compositionalGap: run.compositionalGap ?? null,
          ordinaryGap: run.ordinaryGap ?? null,
          ocgIdiom: run.ocgIdiom ?? null,
          ocgCompositional: run.ocgCompositional ?? null,
          unstable: !!run.anisotropyWarning,
          warning: run.anisotropyWarning ? "anisotropy warning" : null,
        }));
      return {
        indicators,
        diagnostics,
        calibration,
        thresholds: {
          icsPartial: 0.55,
          icsCapture: 0.7,
          floorWarning: 0.9,
          ocgBaseline: 1,
        },
        protocolVersion: "ncimp-paper-exact-v1",
        studyModelCount: new Set(completed.map((run) => run.model)).size,
        runCount: completed.length,
        methodNotes: [
          "Local preview data is loaded from the bundled seed artifact.",
        ],
      };
    },
    staleTime: Number.POSITIVE_INFINITY,
  });
}
