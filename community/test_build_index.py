"""Tests for the community look checker: run `python -m unittest community/test_build_index.py`."""

import json
import tempfile
import unittest
from pathlib import Path

import build_index

GOOD_LOOK = {
    "community": {"name": "Calm", "author": "Mia", "description": "Blue."},
    "theme": {"skin": "modern", "backdrop": {"url": ""}},
    "stages": {"home": []},
}


class CheckLookTests(unittest.TestCase):
    def check(self, text: str, name: str = "calm") -> list[str]:
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / f"{name}.json"
            path.write_text(text, encoding="utf-8")
            return build_index.check_look(path)

    def test_accepts_a_named_look_without_links(self):
        self.assertEqual(self.check(json.dumps(GOOD_LOOK)), [])

    def test_finds_links_hidden_behind_json_escapes(self):
        for link in [r"https:\/\/evil.example", r"https://evil.example", "//evil.example/a.gif"]:
            text = json.dumps(GOOD_LOOK).replace('"url": ""', f'"url": "{link}"')
            self.assertIn("web links", " ".join(self.check(text)), link)

    def test_refuses_nan_which_the_app_cannot_read(self):
        text = json.dumps(GOOD_LOOK).replace('"stages"', '"zoom": NaN, "stages"')
        self.assertIn("not valid UTF-8 JSON", self.check(text)[0])

    def test_refuses_file_names_that_are_not_url_safe(self):
        self.assertIn("file name", self.check(json.dumps(GOOD_LOOK), name="Bad_Name")[0])

    def test_needs_a_name(self):
        look = {**GOOD_LOOK, "community": {"name": " "}}
        self.assertIn('"community.name" is empty', self.check(json.dumps(look)))


class IndexEntryTests(unittest.TestCase):
    def test_marks_looks_that_have_a_screenshot(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / "thumbs").mkdir()
            for name in ("shot", "plain"):
                (root / f"{name}.json").write_text(json.dumps(GOOD_LOOK), encoding="utf-8")
            (root / "thumbs" / "shot.webp").write_bytes(b"RIFF")
            entries = [build_index.index_entry(root / f"{name}.json", root / "thumbs") for name in ("shot", "plain")]
        self.assertEqual([entry["thumb"] for entry in entries], [True, False])


if __name__ == "__main__":
    unittest.main()
