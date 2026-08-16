#!/usr/bin/env python3
"""Проверка wiki: сироты, битые ссылки, имена не из INDEX."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(r"C:\Cursor\buro1-insight-hub\brain\wiki")
INDEX = ROOT / "INDEX.md"
SKIP_DIRS = {"decisions"}
SKIP_FILES = {"INDEX.md", "declined.md", "focus.md", "bureau.md"}
LINK_RE = re.compile(r"\[[^\]]+\]\(([^)]+)\)")
MD_LINK_RE = re.compile(r"`([^`]+\.md)`")
TABLE_LINK_RE = re.compile(r"`((?:clients|people)/[^`]+\.md)`")


def rel(p: Path) -> str:
    return p.relative_to(ROOT).as_posix()


def index_pages() -> set[str]:
    text = INDEX.read_text(encoding="utf-8") if INDEX.is_file() else ""
    pages = set(TABLE_LINK_RE.findall(text))
    pages.update(MD_LINK_RE.findall(text))
    pages = {p.replace("\\", "/") for p in pages if p.endswith(".md")}
    return pages


def wiki_files() -> list[Path]:
    out = []
    for p in ROOT.rglob("*.md"):
        if any(part in SKIP_DIRS for part in p.relative_to(ROOT).parts[:-1]):
            continue
        if p.name in SKIP_FILES:
            continue
        out.append(p)
    return out


def resolve_link(src: Path, href: str) -> Path | None:
    href = href.split("#", 1)[0].strip()
    if not href or href.startswith(("http://", "https://", "mailto:")):
        return None
    if href.startswith("`"):
        href = href.strip("`")
    base = ROOT if "/" in href or href.startswith("clients/") or href.startswith("people/") else src.parent
    return (base / href).resolve()


def main() -> int:
    pages = index_pages()
    files = wiki_files()
    existing = {rel(p) for p in files}
    missing = sorted(p for p in pages if not (ROOT / p).is_file())
    orphans = sorted(p for p in existing if p not in pages)
    broken: list[str] = []
    for p in files + ([INDEX] if INDEX.is_file() else []):
        text = p.read_text(encoding="utf-8", errors="replace")
        for href in LINK_RE.findall(text):
            dest = resolve_link(p, href)
            if dest is None:
                continue
            try:
                dest.relative_to(ROOT.resolve())
            except ValueError:
                continue
            if dest.suffix == ".md" and not dest.is_file():
                broken.append(f"{rel(p) if p != INDEX else 'INDEX.md'} -> {href}")
    report = {
        "ok": not missing and not orphans and not broken,
        "index_pages": len(pages),
        "wiki_files": len(files),
        "missing": missing,
        "orphans": orphans,
        "broken_links": broken,
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
