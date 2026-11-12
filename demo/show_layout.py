#!/usr/bin/env python3
"""Print the Forge layout that the offline recording opens on.

The text is read from manifest.yml, src/core, and the sample fixture.
It is a local view of this repository, not a live Atlassian site.
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def paint(text: str, color: str) -> str:
    return f"\033[{color}m{text}\033[0m"


def block_lines(text: str, header: str) -> list[str]:
    lines = text.splitlines()
    for index, line in enumerate(lines):
        if line.strip() == header:
            return lines[index + 1 :]
    return []


def first_value(lines: list[str], key: str) -> str | None:
    prefix = f"{key}:"
    for line in lines:
        stripped = line.strip()
        if stripped.startswith(prefix):
            return stripped.split(":", 1)[1].strip()
        if line and not line.startswith(" "):
            break
    return None


def list_items(lines: list[str], key: str) -> list[str]:
    items: list[str] = []
    collecting = False
    for line in lines:
        stripped = line.strip()
        if not collecting and stripped == f"{key}:":
            collecting = True
            continue
        if not collecting:
            continue
        if stripped.startswith("- "):
            items.append(stripped[2:].strip())
            continue
        if stripped:
            break
    return items


def action_entries(text: str) -> list[tuple[str, str]]:
    entries: list[tuple[str, str]] = []
    in_actions = False
    current_key: str | None = None
    for line in text.splitlines():
        if line.startswith("  action:"):
            in_actions = True
            continue
        if not in_actions:
            continue
        if line and not line.startswith(" "):
            break
        stripped = line.strip()
        if stripped.startswith("- key:"):
            current_key = stripped.split(":", 1)[1].strip()
        elif current_key and stripped.startswith("name:"):
            entries.append((current_key, stripped.split(":", 1)[1].strip()))
            current_key = None
    return entries


def main() -> None:
    manifest = (ROOT / "manifest.yml").read_text(encoding="utf-8")
    fixture = json.loads((ROOT / "demo" / "fixtures" / "atlas-board.json").read_text(encoding="utf-8"))
    runtime_lines = block_lines(manifest, "runtime:")
    runtime = first_value(runtime_lines, "name") or "nodejs24.x"
    architecture = first_value(runtime_lines, "architecture") or "arm64"
    page = first_value(block_lines(manifest, "jira:projectPage:"), "title") or "Release Scribe"
    agent = first_value(block_lines(manifest, "rovo:agent:"), "name") or "Release Scribe"
    actions = action_entries(manifest)
    scopes = list_items(block_lines(manifest, "permissions:"), "scopes")
    if not actions or not scopes:
        raise SystemExit("Could not read actions or scopes from manifest.yml.")
    core = sorted(
        path.name
        for path in (ROOT / "src" / "core").glob("*.ts")
        if not path.name.endswith(".test.ts")
    )
    project = fixture["project"]
    version = fixture["release"]["versionName"]
    since = fixture["since"]["versionName"]
    key = project["key"]
    external = "none" if "external:" not in manifest else "see manifest.yml"

    rows = [
        paint("Release Scribe — code layout", "1;38;2;137;180;250"),
        paint("Sample fixtures only. Not installed on an Atlassian site.", "38;2;249;226;175"),
        "",
        paint("manifest.yml", "1"),
        f"  {'runtime':<18} {runtime} ({architecture})",
        f"  {'jira:projectPage':<18} {page}",
        f"  {'rovo:agent':<18} {agent}",
    ]
    for index, (action_key, action_name) in enumerate(actions):
        label = "actions" if index == 0 else ""
        rows.append(f"  {label:<18} {action_key}  ({action_name})")
    for index, scope in enumerate(scopes):
        label = "scopes" if index == 0 else ""
        rows.append(f"  {label:<18} {scope}")
    rows.append(f"  {'app.id':<18} placeholder, not a registered app")
    rows.append(f"  {'external fetch':<18} {external}")
    rows.append("")
    rows.append(paint("src/core", "1") + "  plain TypeScript, no Forge credentials")
    for index in range(0, len(core), 3):
        chunk = core[index : index + 3]
        rows.append("  " + "  ".join(f"{name:<16}" for name in chunk))
    rows.extend(
        [
            "",
            paint("Sample input", "1") + f"  {project['name']} ({key}), fix version {version}",
            f"  {'fixture':<18} demo/fixtures/atlas-board.json",
            f"  {'writes':<18} demo/output/{key}-{version}.md",
            f"  {'':<18} demo/output/{key}-since-{since}-executive.md",
            "",
            paint("Next: npm run demo", "1;38;2;166;227;161"),
        ]
    )
    print("\n".join(rows))


if __name__ == "__main__":
    main()
