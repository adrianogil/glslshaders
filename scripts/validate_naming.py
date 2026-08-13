#!/usr/bin/env python3
"""Validate shader category, file, preview, and local-reference naming."""

from __future__ import annotations

import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CATEGORY_PATTERN = re.compile(
    r"^(?P<number>\d{2})_[a-z][a-z0-9]*(?:_[a-z0-9]+)*$"
)
SHADER_PATTERN = re.compile(
    r"^(?P<number>\d{2})_[a-z][a-z0-9]*(?:_[a-z0-9]+)*\.frag$"
)
PREVIEW_PATTERN = re.compile(
    r"^(?P<shader_stem>\d{2}_[a-z][a-z0-9]*(?:_[a-z0-9]+)*)_preview\.html$"
)
ASSET_PATTERN = re.compile(
    r"^[a-z][a-z0-9]*(?:_[a-z0-9]+)*\.(?:hdr|jpe?g|png|webp)$"
)
FETCH_PATTERN = re.compile(
    r"fetch\(\s*['\"](?P<target>[^'\"]+)['\"]", re.MULTILINE
)
ASSET_SUFFIXES = {".hdr", ".jpeg", ".jpg", ".png", ".webp"}


def relative(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def validate_contiguous(numbers: list[int], label: str, errors: list[str]) -> None:
    expected = list(range(1, len(numbers) + 1))
    if numbers != expected:
        errors.append(
            f"{label} numbers must be contiguous: expected {expected}, found {numbers}"
        )


def validate() -> list[str]:
    errors: list[str] = []
    shaders = sorted(ROOT.rglob("*.frag"))

    legacy_shaders = sorted(ROOT.rglob("*.glsl"))
    for shader in legacy_shaders:
        errors.append(
            f"{relative(shader)}: fragment shaders must use the .frag extension"
        )

    categories = sorted({shader.parent for shader in shaders})
    category_numbers: list[int] = []

    for category in categories:
        if category.parent != ROOT:
            errors.append(
                f"{relative(category)}: shader categories must be top-level directories"
            )
            continue

        category_match = CATEGORY_PATTERN.fullmatch(category.name)
        if not category_match:
            errors.append(f"{category.name}: category must match NN_lower_snake_case")
            continue

        category_numbers.append(int(category_match.group("number")))
        shader_numbers: list[int] = []

        for shader in sorted(category.glob("*.frag")):
            shader_match = SHADER_PATTERN.fullmatch(shader.name)
            if not shader_match:
                errors.append(
                    f"{relative(shader)}: shader must match NN_descriptive_lower_snake_case.frag"
                )
                continue
            shader_numbers.append(int(shader_match.group("number")))

        validate_contiguous(shader_numbers, category.name, errors)

        for asset in sorted(
            path
            for path in category.iterdir()
            if path.suffix.lower() in ASSET_SUFFIXES
        ):
            if not ASSET_PATTERN.fullmatch(asset.name):
                errors.append(f"{relative(asset)}: asset must use descriptive lower_snake_case")

    validate_contiguous(category_numbers, "category", errors)

    previews = sorted(html for category in categories for html in category.glob("*.html"))
    for preview in previews:
        preview_match = PREVIEW_PATTERN.fullmatch(preview.name)
        if not preview_match:
            errors.append(
                f"{relative(preview)}: preview must match <shader-stem>_preview.html"
            )
            continue

        shader = preview.with_name(f"{preview_match.group('shader_stem')}.frag")
        if not shader.is_file():
            errors.append(f"{relative(preview)}: missing paired shader {shader.name}")

        targets = FETCH_PATTERN.findall(preview.read_text(encoding="utf-8"))
        resolved_targets = {
            (preview.parent / target).resolve()
            for target in targets
            if not re.match(r"^(?:[a-z]+:)?//|^data:", target)
        }
        if shader.resolve() not in resolved_targets:
            errors.append(f"{relative(preview)}: preview must fetch ./{shader.name}")

    for html in sorted(ROOT.rglob("*.html")):
        for target in FETCH_PATTERN.findall(html.read_text(encoding="utf-8")):
            if re.match(r"^(?:[a-z]+:)?//|^data:", target):
                continue
            referenced_path = (html.parent / target).resolve()
            try:
                referenced_path.relative_to(ROOT)
            except ValueError:
                errors.append(f"{relative(html)}: local fetch escapes the repository: {target}")
                continue
            if not referenced_path.is_file():
                errors.append(f"{relative(html)}: missing local fetch target {target}")

    return errors


def main() -> int:
    errors = validate()
    if errors:
        print("Shader naming validation failed:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    category_paths = {shader.parent for shader in ROOT.rglob("*.frag")}
    category_count = len(category_paths)
    shader_count = len(list(ROOT.rglob("*.frag")))
    preview_count = sum(
        len(list(category.glob("*.html"))) for category in category_paths
    )
    print(
        f"Shader naming validation passed: {category_count} categories, "
        f"{shader_count} shaders, {preview_count} previews."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
