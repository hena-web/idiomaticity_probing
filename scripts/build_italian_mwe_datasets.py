#!/usr/bin/env python3
"""Convert the Italian NCIMP/AdMIRe workbook into a browser JSON artifact."""

from __future__ import annotations

import ast
import json
import re
import sys
from pathlib import Path
from typing import Any
from zipfile import ZipFile
from xml.etree import ElementTree as ET


NS = {
    "a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}
REL_NS = {
    "rel": "http://schemas.openxmlformats.org/package/2006/relationships",
}
CELL_RE = re.compile(r"([A-Z]+)(\d+)")


def col_index(ref: str) -> int:
    letters = CELL_RE.match(ref).group(1)  # type: ignore[union-attr]
    index = 0
    for letter in letters:
        index = index * 26 + ord(letter) - 64
    return index - 1


def read_workbook(path: Path) -> dict[str, list[dict[str, str]]]:
    with ZipFile(path) as archive:
        shared: list[str] = []
        if "xl/sharedStrings.xml" in archive.namelist():
            root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            for item in root.findall("a:si", NS):
                shared.append("".join(node.text or "" for node in item.findall(".//a:t", NS)))

        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        relationships = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        relationship_map = {
            node.attrib["Id"]: node.attrib["Target"]
            for node in relationships.findall("rel:Relationship", REL_NS)
        }

        sheets: dict[str, list[dict[str, str]]] = {}
        for sheet in workbook.findall("a:sheets/a:sheet", NS):
            name = sheet.attrib["name"]
            rel_id = sheet.attrib[
                "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
            ]
            target = relationship_map[rel_id].lstrip("/")
            sheet_path = f"xl/{target}" if not target.startswith("xl/") else target
            root = ET.fromstring(archive.read(sheet_path))
            rows = root.findall(".//a:sheetData/a:row", NS)
            if not rows:
                sheets[name] = []
                continue
            header = read_row(rows[0], shared)
            records: list[dict[str, str]] = []
            for row in rows[1:]:
                values = read_row(row, shared)
                record = {
                    header[index]: values[index] if index < len(values) else ""
                    for index in range(len(header))
                    if header[index]
                }
                if record.get("mwe", "").strip():
                    records.append(record)
            sheets[name] = records
        return sheets


def read_row(row: ET.Element, shared: list[str]) -> list[str]:
    values: list[str] = []
    for cell in row.findall("a:c", NS):
        index = col_index(cell.attrib["r"])
        while len(values) <= index:
            values.append("")
        value_node = cell.find("a:v", NS)
        if value_node is None:
            continue
        raw = value_node.text or ""
        if cell.attrib.get("t") == "s" and raw:
            values[index] = shared[int(raw)]
        else:
            values[index] = raw
    return values


def to_float(value: str) -> float | None:
    value = value.strip()
    if not value:
        return None
    try:
        return float(value)
    except ValueError:
        return None


def score_to_class(score: float | None) -> str | None:
    if score is None:
        return None
    if score <= 1.5:
        return "I"
    if score >= 3.5:
        return "C"
    return "PC"


def parse_tagged_context(
    item_id: str,
    slot: str,
    family: str,
    sentence: str,
    tag_string: str,
    source_column: str,
) -> dict[str, Any] | None:
    sentence = sentence.strip()
    if not sentence:
        return None
    tokens = sentence.split()
    span: list[int] | None = None
    target_surface = ""
    try:
        tags = ast.literal_eval(tag_string)
    except (ValueError, SyntaxError):
        tags = []
    true_indices = [index for index, flag in enumerate(tags) if flag is True]
    if true_indices:
        start = min(true_indices)
        end = max(true_indices) + 1
        if end <= len(tokens):
            span = [start, end]
            target_surface = " ".join(tokens[start:end]).strip(" ,.;:!?\"'«»")
    return {
        "id": f"{item_id}-{slot}",
        "slot": slot,
        "family": family,
        "sentence": sentence,
        "targetSurface": target_surface,
        "span": span,
        "sourceColumn": source_column,
    }


def build_ncimp(records: list[dict[str, str]]) -> dict[str, Any]:
    items = []
    for index, record in enumerate(records, start=1):
        item_id = f"IT-NCIMP-{index:03d}"
        score = to_float(record.get("comp_score", ""))
        contexts = [
            parse_tagged_context(item_id, "S1", "naturalistic", record.get("sent_nat_1", ""), record.get("tag_sent_nat_1", ""), "sent_nat_1"),
            parse_tagged_context(item_id, "S2", "naturalistic", record.get("sent_nat_2", ""), record.get("tag_sent_nat_2", ""), "sent_nat_2"),
            parse_tagged_context(item_id, "S3", "naturalistic", record.get("sent_nat_3", ""), record.get("tag_sent_nat_3", ""), "sent_nat_3"),
            parse_tagged_context(item_id, "N1", "neutral", record.get("sent_neut", ""), record.get("tag_sent_neut", ""), "sent_neut"),
        ]
        items.append({
            "id": item_id,
            "dataset": "NCIMP",
            "language": "IT",
            "canonicalForm": record["mwe"].strip(),
            "goldScore": score,
            "goldClass": score_to_class(score),
            "scoreStatus": "composition_score_from_workbook",
            "components": {
                "word1": record.get("word_1", "").strip(),
                "wordX": record.get("word_x", "").strip(),
                "word2": record.get("word_2", "").strip(),
            },
            "probes": {
                "P_Syn": split_probe_values(record.get("psyn", "")),
                "P_WordsSyn": split_probe_values(record.get("pwordsyn", "")),
            },
            "contexts": [context for context in contexts if context],
        })
    return dataset_block("NCIMP", "Italian NCIMP", items)


def build_admire(records: list[dict[str, str]]) -> dict[str, Any]:
    items = []
    for index, record in enumerate(records, start=1):
        item_id = f"IT-ADMIRE-{index:03d}"
        score_a = to_float(record.get("judgments A", ""))
        score_b = to_float(record.get("judgments B", ""))
        scores = [score for score in [score_a, score_b] if score is not None]
        score = round(sum(scores) / len(scores), 3) if scores else None
        contexts = [
            parse_tagged_context(item_id, "A1", "naturalistic", record.get("sentence A1", ""), record.get("tag sentence A1", ""), "sentence A1"),
            parse_tagged_context(item_id, "A2", "naturalistic", record.get("sentence A2", ""), record.get("tag sentence A2", ""), "sentence A2"),
            parse_tagged_context(item_id, "N1", "neutral", record.get("neutral", ""), record.get("tag neutral", ""), "neutral"),
            parse_tagged_context(item_id, "B1", "naturalistic", record.get("sentence B1", ""), record.get("tag sentence B1", ""), "sentence B1"),
            parse_tagged_context(item_id, "B2", "naturalistic", record.get("sentence B2", ""), record.get("tag sentence B2", ""), "sentence B2"),
        ]
        items.append({
            "id": item_id,
            "dataset": "AdMIRe",
            "language": "IT",
            "canonicalForm": record["mwe"].strip(),
            "goldScore": score,
            "goldClass": score_to_class(score),
            "scoreStatus": "average_of_judgments_A_B",
            "judgments": {"A": score_a, "B": score_b},
            "components": {
                "word1": record.get("word 1", "").strip(),
                "wordX": record.get("word x", "").strip(),
                "word2": record.get("word 2", "").strip(),
            },
            "probes": {
                "P_Syn": split_probe_values(record.get("psyn", "")),
                "P_WordsSyn": split_probe_values(record.get("pwordsyn", "")),
            },
            "contexts": [context for context in contexts if context],
        })
    return dataset_block("AdMIRe", "Italian AdMIRe", items)


def split_probe_values(value: str) -> list[str]:
    value = value.strip()
    if not value:
        return []
    parts = re.split(r"\s*[;|]\s*", value)
    return [part for part in parts if part]


def dataset_block(dataset_id: str, label: str, items: list[dict[str, Any]]) -> dict[str, Any]:
    class_counts: dict[str, int] = {"I": 0, "PC": 0, "C": 0}
    for item in items:
        if item["goldClass"] in class_counts:
            class_counts[item["goldClass"]] += 1
    return {
        "id": dataset_id,
        "label": label,
        "summary": {
            "mweCount": len(items),
            "scoredMweCount": sum(1 for item in items if item["goldScore"] is not None),
            "contextCount": sum(len(item["contexts"]) for item in items),
            "classCounts": class_counts,
        },
        "items": items,
    }


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: build_italian_mwe_datasets.py INPUT.xlsx OUTPUT.json")
    input_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])
    sheets = read_workbook(input_path)
    artifact = {
        "schemaVersion": 1,
        "generatedAt": "2026-07-07T00:00:00.000Z",
        "readOnly": True,
        "language": "IT",
        "source": {
            "title": "MWE_IT_datasets.xlsx",
            "fileName": input_path.name,
            "license": "source workbook license not specified",
            "licenseReviewStatus": "review_required",
        },
        "datasets": {
            "NCIMP": build_ncimp(sheets.get("NCIMP_IT_dataset", [])),
            "AdMIRe": build_admire(sheets.get("AdMIRe_IT_dataset", [])),
        },
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(artifact, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
