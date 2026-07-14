export const COMP_CLASS_VARIANT: Record<string, "destructive" | "warning" | "success" | "default"> = {
  I: "destructive",
  PC: "warning",
  C: "success",
};

export const WORKFLOW_ORDER = [
  "draft",
  "examples_ready",
  "annotation_ready",
  "annotated",
  "probes_ready",
  "variants_reviewed",
  "release_ready",
  "released",
] as const;
