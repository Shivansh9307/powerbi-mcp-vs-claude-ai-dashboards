"""Documentation hygiene: every relative link and image resolves, and nothing private is published."""

from __future__ import annotations

import re
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[1]
#: The one social link the owner chose to publish, in the README "About the author" block.
AUTHOR_LINK = "[LinkedIn](https://www.linkedin.com/in/chauhan-shivansh)"
FENCE = re.compile(r"```.*?```", re.DOTALL)
INLINE_CODE = re.compile(r"`[^`\n]*`")
MD_LINK = re.compile(r"!?\[[^\]\n]*\]\(([^)\s]+)(?:\s+\"[^\"]*\")?\)")
HTML_SRC = re.compile(r"<img[^>]*\ssrc=\"([^\"]+)\"")
SKIP_PREFIXES = ("http://", "https://", "mailto:", "#")


def _markdown_files() -> list[Path]:
    roots = [REPO / "README.md", REPO / "NOTICE.md", REPO / "data" / "README.md", REPO / "tools" / "README.md"]
    roots += sorted((REPO / "docs").rglob("*.md"))
    return [p for p in roots if p.is_file()]


def _targets(path: Path) -> list[str]:
    text = INLINE_CODE.sub("", FENCE.sub("", path.read_text(encoding="utf-8")))
    found = MD_LINK.findall(text) + HTML_SRC.findall(text)
    return [t for t in found if not t.startswith(SKIP_PREFIXES) and "<" not in t]


@pytest.mark.parametrize("md", _markdown_files(), ids=lambda p: str(p.relative_to(REPO)))
def test_relative_links_and_images_exist(md: Path) -> None:
    missing = []
    for target in _targets(md):
        clean = target.split("#", 1)[0]
        if clean and not (md.parent / clean).resolve().exists():
            missing.append(target)
    assert not missing, f"{md.relative_to(REPO)} links to missing files: {missing}"


def test_there_are_docs_to_check() -> None:
    assert len(_markdown_files()) >= 15


def test_no_personal_paths_or_assistant_files_in_published_docs() -> None:
    for md in _markdown_files():
        text = md.read_text(encoding="utf-8")
        assert not re.search(r"[A-Za-z]:\\Users\\", text), f"personal path in {md.relative_to(REPO)}"
        assert "linkedin" not in text.replace(AUTHOR_LINK, "").lower(), (
            f"social-media mention in {md.relative_to(REPO)}"
        )


def test_assistant_notes_are_gitignored() -> None:
    ignore = (REPO / ".gitignore").read_text(encoding="utf-8").splitlines()
    assert "CLAUDE.md" in ignore
    assert "data/raw/" in ignore
