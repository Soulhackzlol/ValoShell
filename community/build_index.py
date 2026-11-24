"""Check community looks and rebuild community/index.json, which the app's gallery reads.

Run `python community/build_index.py --check` to only check (CI does on every pull request);
without `--check` it also writes the index (CI does after a merge to main). Standard library only.
"""

import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
LOOKS_DIR = HERE / "looks"
# Screenshots the workflow makes after a merge (ui/scripts/look-thumbs.mjs), one per look.
THUMBS_DIR = HERE / "thumbs"
INDEX_PATH = HERE / "index.json"

# Same rule as the app (crates/services/src/community.rs): the id becomes part of a URL.
ID_PATTERN = re.compile(r"^[a-z0-9][a-z0-9-]{0,63}$")
# A look is a few KB of settings; the app refuses anything over 4 MB, review wants far less.
MAX_LOOK_BYTES = 512 * 1024
MAX_NAME_CHARS = 48
MAX_AUTHOR_CHARS = 40
MAX_DESCRIPTION_CHARS = 200
# A shared look must not make the app contact other sites (web widgets, images, backdrops):
# a web scheme or a protocol-relative `//host`. Checked on decoded values, so JSON escapes
# like `https:\/\/` or a `h` for the h cannot hide one. Same rule as remoteHosts in the app.
LINK_PATTERN = re.compile(r"^\s*(?:(?:https?|wss?|ftp):)?//", re.IGNORECASE)


def check_meta(meta: object) -> list[str]:
    """Problems with the `community` block: who made it and what it is."""
    if not isinstance(meta, dict):
        return ['needs a "community" block with "name", "author" and "description"']
    problems = []
    limits = {"name": MAX_NAME_CHARS, "author": MAX_AUTHOR_CHARS, "description": MAX_DESCRIPTION_CHARS}
    for key, limit in limits.items():
        value = meta.get(key, "")
        if not isinstance(value, str):
            problems.append(f'"community.{key}" must be text')
        elif len(value) > limit:
            problems.append(f'"community.{key}" is longer than {limit} characters')
    if not str(meta.get("name", "")).strip():
        problems.append('"community.name" is empty')
    return problems


def links_in(value: object) -> list[str]:
    """Every text value in a decoded look that would make the app fetch from a server."""
    if isinstance(value, str):
        return [value] if LINK_PATTERN.match(value) else []
    children = value.values() if isinstance(value, dict) else value if isinstance(value, list) else []
    return [link for child in children for link in links_in(child)]


def reject_constant(name: str) -> None:
    """NaN and Infinity are not JSON; the app's reader refuses them, so the check does too."""
    raise ValueError(f"{name} is not valid JSON")


def check_look(path: Path) -> list[str]:
    """Every reason `path` cannot be listed; empty when it is fine."""
    if not ID_PATTERN.match(path.stem):
        return ["file name must be lowercase letters, digits and dashes, ending in .json"]
    if path.stat().st_size > MAX_LOOK_BYTES:
        return [f"larger than {MAX_LOOK_BYTES // 1024} KB"]
    try:
        look = json.loads(path.read_text(encoding="utf-8"), parse_constant=reject_constant)
    except (UnicodeDecodeError, ValueError) as error:
        return [f"not valid UTF-8 JSON ({error})"]
    if not isinstance(look, dict):
        return ["not a ValoShell look (the file must hold an object)"]
    problems = check_meta(look.get("community"))
    if not all(isinstance(look.get(key), dict) for key in ("theme", "stages")):
        problems.append('not a ValoShell look (needs "theme" and "stages")')
    links = links_in(look)
    if links:
        shown = ", ".join(links[:3])
        problems.append(f"contains web links ({shown}); shared looks may not load content from other sites")
    return problems


def index_entry(path: Path, thumbs_dir: Path = THUMBS_DIR) -> dict:
    """The index line for a look that passed `check_look`."""
    look = json.loads(path.read_text(encoding="utf-8"))
    meta = look["community"]
    return {
        "id": path.stem,
        "name": meta["name"].strip(),
        "author": meta.get("author", "").strip(),
        "description": meta.get("description", "").strip(),
        "skin": str(look["theme"].get("skin", "")),
        "thumb": (thumbs_dir / f"{path.stem}.webp").is_file(),
    }


def main() -> int:
    is_check_only = "--check" in sys.argv[1:]
    paths = sorted(LOOKS_DIR.glob("*.json"))
    failures = {path.name: check_look(path) for path in paths}
    failures = {name: problems for name, problems in failures.items() if problems}
    for name, problems in failures.items():
        for problem in problems:
            print(f"community/looks/{name}: {problem}")
    if failures:
        return 1
    print(f"{len(paths)} community looks are fine")
    if not is_check_only:
        looks = sorted((index_entry(path) for path in paths), key=lambda entry: entry["name"].lower())
        INDEX_PATH.write_text(json.dumps({"looks": looks}, indent=2) + "\n", encoding="utf-8")
        print(f"wrote {INDEX_PATH.name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
