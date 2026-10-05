"""Named beds that stay as recorded.

A filter that puts these files inside the caps deletes the sound.
Every other file still has to pass. A name is justified only while
that gate's measurement is outside the cap. check_loudness.py,
check_spectrum.py, and scripts/qaSoundDesignManifesto.mjs read the
same kept-beds.json.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

KEPT_PATH = Path(__file__).with_name("kept-beds.json")


@dataclass(frozen=True)
class KeptBed:
    id: str
    path: str
    reason: str
    loudness: bool
    spectrum: bool


def load_kept(path: Path = KEPT_PATH) -> dict[str, KeptBed]:
    """Map a catalog-relative posix path to its named-bed record.

    A missing file means there are no names. A malformed file raises
    ValueError so a broken list cannot be read as "pass everything".
    """
    if not path.exists():
        return {}

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"kept beds file could not be read: {exc}") from exc

    if not isinstance(data, dict) or not isinstance(data.get("beds"), list):
        raise ValueError("kept beds file needs an object with a beds array")

    beds: dict[str, KeptBed] = {}
    seen_ids: set[str] = set()
    for item in data["beds"]:
        if not isinstance(item, dict):
            raise ValueError("each kept bed must be an object")
        bed_id = item.get("id")
        rel = item.get("path")
        reason = item.get("reason")
        loudness = item.get("loudness")
        spectrum = item.get("spectrum")
        if not isinstance(bed_id, str) or not bed_id or "/" in bed_id or "\\" in bed_id:
            raise ValueError(f"kept bed id is not a plain track id: {bed_id!r}")
        if (
            not isinstance(rel, str)
            or not rel
            or rel.startswith("/")
            or "\\" in rel
            or ".." in rel.split("/")
        ):
            raise ValueError(f"kept bed path is not a relative catalog path: {rel!r}")
        if Path(rel).stem != bed_id:
            raise ValueError(f"kept bed path does not match its id: {bed_id}")
        if not isinstance(reason, str) or not reason.strip():
            raise ValueError(f"kept bed {bed_id} needs a reason")
        if not isinstance(loudness, bool) or not isinstance(spectrum, bool):
            raise ValueError(f"kept bed {bed_id} needs loudness and spectrum as true or false")
        if not loudness and not spectrum:
            raise ValueError(f"kept bed {bed_id} names neither gate")
        if bed_id in seen_ids:
            raise ValueError(f"duplicate kept bed id: {bed_id}")
        if rel in beds:
            raise ValueError(f"duplicate kept bed path: {rel}")
        seen_ids.add(bed_id)
        beds[rel] = KeptBed(bed_id, rel, reason.strip(), loudness, spectrum)
    return beds
