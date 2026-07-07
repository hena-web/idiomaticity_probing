import { SpanText } from "@/components/SpanText";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FullPageSpinner } from "@/components/ui/spinner";
import { useDomainLabels } from "@/i18n/hooks";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";

export type ItalianDatasetId = "NCIMP" | "AdMIRe";

type ItalianContext = {
  id: string;
  slot: string;
  family: "naturalistic" | "neutral";
  sentence: string;
  targetSurface: string;
  span: [number, number] | null;
  sourceColumn: string;
};

type ItalianItem = {
  id: string;
  dataset: ItalianDatasetId;
  language: "IT";
  canonicalForm: string;
  goldScore: number | null;
  goldClass: "I" | "PC" | "C" | null;
  scoreStatus: string;
  judgments?: { A: number | null; B: number | null };
  components: { word1: string; wordX: string; word2: string };
  probes: { P_Syn: string[]; P_WordsSyn: string[] };
  contexts: ItalianContext[];
};

type ItalianDataset = {
  id: ItalianDatasetId;
  label: string;
  summary: {
    mweCount: number;
    scoredMweCount: number;
    contextCount: number;
    classCounts: Record<string, number>;
  };
  items: ItalianItem[];
};

type ItalianArtifact = {
  schemaVersion: number;
  generatedAt: string;
  readOnly: true;
  language: "IT";
  source: {
    title: string;
    fileName: string;
    license: string;
    licenseReviewStatus: string;
  };
  datasets: Record<ItalianDatasetId, ItalianDataset>;
};

async function loadItalianDatasets(): Promise<ItalianArtifact> {
  const response = await fetch("/references/italian_mwe_datasets.json", {
    cache: "no-cache",
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

export function ItalianInventory({ dataset }: { dataset: ItalianDatasetId }) {
  const { t } = useTranslation();
  const { COMP_CLASS_VARIANT } = useDomainLabels();
  const query = useQuery({
    queryKey: ["italian-mwe-datasets"],
    queryFn: loadItalianDatasets,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedDataset = query.data?.datasets[dataset] ?? null;
  const items = useMemo(() => selectedDataset?.items ?? [], [selectedDataset]);
  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    return items.filter((item) => {
      if (classFilter !== "all" && item.goldClass !== classFilter) return false;
      return (
        !needle ||
        `${item.id} ${item.canonicalForm} ${item.components.word1} ${item.components.wordX} ${item.components.word2}`
          .toLocaleLowerCase()
          .includes(needle)
      );
    });
  }, [items, search, classFilter]);
  const selected = items.find((item) => item.id === selectedId) ?? null;

  if (query.isLoading) {
    return <FullPageSpinner label={t("italian.loading")} />;
  }
  if (query.isError || !query.data || !selectedDataset) {
    return (
      <p className="text-sm text-[hsl(var(--destructive))]">
        {t("italian.loadFailed", {
          message:
            query.error instanceof Error
              ? query.error.message
              : t("common.unknownError"),
        })}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-blue-500/30 bg-blue-500/5">
        <CardContent className="flex flex-wrap items-center gap-x-5 gap-y-2 p-4 text-sm">
          <Badge variant="primary">
            {t("italian.readOnlyBadge", { dataset })}
          </Badge>
          <span>
            {t("italian.summary.mwes")}{" "}
            <strong>{selectedDataset.summary.mweCount}</strong>
          </span>
          <span>
            {t("italian.summary.scored")}{" "}
            <strong>{selectedDataset.summary.scoredMweCount}</strong>
          </span>
          <span>
            {t("italian.summary.contexts")}{" "}
            <strong>{selectedDataset.summary.contextCount}</strong>
          </span>
          <span className="ml-auto text-xs text-[hsl(var(--muted-foreground))]">
            {query.data.source.title} · {query.data.source.licenseReviewStatus}
          </span>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          <Input
            className="pl-9"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("reference.searchPlaceholder")}
          />
        </div>
        <Select
          value={classFilter}
          onChange={(event) => setClassFilter(event.target.value)}
        >
          <option value="all">{t("reference.allClasses")}</option>
          <option value="I">{t("reference.classOptions.I")}</option>
          <option value="PC">{t("reference.classOptions.PC")}</option>
          <option value="C">{t("reference.classOptions.C")}</option>
        </Select>
        <span className="ml-auto text-sm text-[hsl(var(--muted-foreground))]">
          {filtered.length} {t("common.results")}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(360px,520px)]">
        <Card className="overflow-hidden">
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[hsl(var(--card))]">
                <tr className="border-b">
                  <th className="p-3 text-left">
                    {t("reference.columns.expression")}
                  </th>
                  <th className="p-3 text-left">
                    {t("reference.columns.class")}
                  </th>
                  <th className="p-3 text-left">
                    {t("reference.columns.humanScore")}
                  </th>
                  <th className="p-3 text-left">
                    {t("reference.columns.context")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    className={`cursor-pointer border-b hover:bg-[hsl(var(--accent))] ${
                      selectedId === item.id ? "bg-[hsl(var(--accent))]" : ""
                    }`}
                  >
                    <td className="p-3">
                      <p className="font-medium">{item.canonicalForm}</p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">
                        {[item.components.word1, item.components.wordX, item.components.word2]
                          .filter(Boolean)
                          .join(" + ") || "-"}
                      </p>
                    </td>
                    <td className="p-3">
                      {item.goldClass ? (
                        <Badge variant={COMP_CLASS_VARIANT[item.goldClass]}>
                          {item.goldClass}
                        </Badge>
                      ) : (
                        <Badge variant="warning">
                          {t("reference.unscored")}
                        </Badge>
                      )}
                    </td>
                    <td className="p-3 tabular-nums">
                      {item.goldScore?.toFixed(2) ?? "-"}
                    </td>
                    <td className="p-3">{item.contexts.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <div className="lg:sticky lg:top-6 lg:self-start">
          {selected ? (
            <ItalianDetail item={selected} />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>{t("reference.detail.title")}</CardTitle>
                <CardDescription>{t("reference.detail.hint")}</CardDescription>
              </CardHeader>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function ItalianDetail({ item }: { item: ItalianItem }) {
  const { t } = useTranslation();
  const { compClassLabel, COMP_CLASS_VARIANT } = useDomainLabels();
  return (
    <Card className="max-h-[78vh] overflow-auto">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          {item.canonicalForm}
          {item.goldClass ? (
            <Badge variant={COMP_CLASS_VARIANT[item.goldClass]}>
              {item.goldClass}
            </Badge>
          ) : null}
        </CardTitle>
        <CardDescription>
          {item.id} ·{" "}
          {item.goldClass
            ? compClassLabel(item.goldClass)
            : t("reference.detail.noHumanScore")}{" "}
          · {t("reference.detail.score", { value: item.goldScore?.toFixed(2) ?? "-" })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {item.judgments ? (
          <div className="flex flex-wrap gap-2 text-xs text-[hsl(var(--muted-foreground))]">
            <Badge variant="outline">A {item.judgments.A ?? "-"}</Badge>
            <Badge variant="outline">B {item.judgments.B ?? "-"}</Badge>
          </div>
        ) : null}

        <div className="rounded-md border border-[hsl(var(--border))] p-3">
          <p className="mb-2 text-xs font-medium text-[hsl(var(--muted-foreground))]">
            {t("italian.probes")}
          </p>
          <div className="space-y-2 text-sm">
            <ProbeValues label="P_Syn" values={item.probes.P_Syn} />
            <ProbeValues label="P_WordsSyn" values={item.probes.P_WordsSyn} />
          </div>
        </div>

        {item.contexts.map((context) => (
          <div
            key={context.id}
            className="space-y-2 rounded-md border border-[hsl(var(--border))] p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <Badge
                variant={
                  context.family === "naturalistic" ? "success" : "outline"
                }
              >
                {context.slot}
              </Badge>
              <span className="text-xs text-[hsl(var(--muted-foreground))]">
                {context.sourceColumn}
              </span>
            </div>
            <p className="text-sm leading-6">
              <SpanText
                sentence={context.sentence}
                surface={context.targetSurface}
                span={context.span}
              />
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ProbeValues({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="outline">{label}</Badge>
      {values.length > 0 ? (
        values.map((value) => (
          <span
            key={value}
            className="rounded bg-[hsl(var(--muted))] px-2 py-1 text-xs"
          >
            {value}
          </span>
        ))
      ) : (
        <span className="text-xs text-[hsl(var(--muted-foreground))]">-</span>
      )}
    </div>
  );
}
