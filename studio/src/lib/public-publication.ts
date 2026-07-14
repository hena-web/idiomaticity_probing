import { collection, doc, getDocs, serverTimestamp, writeBatch } from "firebase/firestore";
import type { MweRecord, OrdinaryControlItem, ReferenceMweRecord } from "@/data/schema";
import { db } from "@/lib/firebase";

export type PublicLanguage = "EN" | "PT" | "TR" | "CTRL";
export type PublicItem = MweRecord | ReferenceMweRecord | OrdinaryControlItem;

export interface PublicDataset {
  language: PublicLanguage;
  items: PublicItem[];
  generatedAt: string;
  source: "bundled" | "firestore-publication";
}

export async function loadPublicDataset(language: PublicLanguage): Promise<PublicDataset> {
  if (language === "TR") {
    const response = await fetch("/artifacts/datasets/tr-draft-current/TR.json", { cache: "no-cache" });
    if (response.ok) {
      return { language, items: await response.json(), generatedAt: new Date().toISOString(), source: "bundled" };
    }
    const seedResponse = await fetch("/seed/tr_project.json", { cache: "no-cache" });
    const snapshot = await seedResponse.json();
    return { language, items: snapshot.mwes, generatedAt: snapshot.generatedAt, source: "bundled" };
  }
  if (language === "CTRL") {
    const response = await fetch("/controls/turkish_ordinary_control.json", { cache: "no-cache" });
    const artifact = await response.json();
    return { language, items: artifact.items, generatedAt: artifact.generatedAt, source: "bundled" };
  }
  const response = await fetch(`/references/ncimp_${language.toLowerCase()}_reference.json`, { cache: "no-cache" });
  const dataset = await response.json();
  return { language, items: dataset.items, generatedAt: dataset.generatedAt, source: "bundled" };
}

export async function publishPublicResearchDataset(actorUid: string) {
  const [tr, en, pt, ctrl] = await Promise.all([
    loadPublicDataset("TR"),
    loadPublicDataset("EN"),
    loadPublicDataset("PT"),
    loadPublicDataset("CTRL"),
  ]);
  const publicationRef = doc(db, "publications", "current");
  const batch = writeBatch(db);
  batch.set(publicationRef, {
    id: "current",
    status: "draft",
    publishedBy: actorUid,
    publishedAt: serverTimestamp(),
    schemaVersion: 1,
  }, { merge: true });
  for (const dataset of [tr, en, pt, ctrl]) {
    batch.set(doc(collection(publicationRef, "datasets"), dataset.language), {
      ...dataset,
      publishedBy: actorUid,
      publishedAt: serverTimestamp(),
      schemaVersion: 1,
    });
  }
  await batch.commit();
  return { TR: tr.items.length, EN: en.items.length, PT: pt.items.length, CTRL: ctrl.items.length };
}

export async function readPublishedDatasetCount() {
  const snapshot = await getDocs(collection(db, "publications/current/datasets"));
  return snapshot.size;
}
