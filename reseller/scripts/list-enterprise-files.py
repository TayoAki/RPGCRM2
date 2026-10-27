#!/usr/bin/env python3
"""Regenerate the file inventory in reseller/docs/ENTERPRISE_FILES.md.

Usage:
  python3 reseller/scripts/list-enterprise-files.py           # rewrite the generated section
  python3 reseller/scripts/list-enterprise-files.py --check   # fail if it is stale or a file is unclassified

Every file containing "/* @license Enterprise */" is assigned to the first
feature area whose pattern matches its path. A new file that matches no area fails
--check, so the narrative in the doc gets written for it.
"""

import re
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
DOC_PATH = REPO_ROOT / "reseller" / "docs" / "ENTERPRISE_FILES.md"
BEGIN_MARKER = "<!-- BEGIN GENERATED: list-enterprise-files.py -->"
END_MARKER = "<!-- END GENERATED -->"

# Ordered: the first matching area wins.
AREAS = [
    ("billing", "Subscription billing (Stripe)", [r"/core-modules/billing/", r"/core-modules/billing-webhook/", r"migrate-to-billing"]),
    ("usage", "Usage metering and limits", [r"/core-modules/usage/", r"/core-modules/usage-limit/"]),
    ("record-sharing", "Record sharing", [r"/core-modules/record-share/", r"/object-records-permissions/"]),
    ("row-level-permissions", "Row-level permissions", [
        r"row-level-permission", r"[Rr]owLevelPermission", r"RLS", r"(^|[-/])rls([-/.]|$)",
        r"[Rr]ecord-?[Ll]evel-?[Pp]ermission", r"is-row-access-expression", r"resolve-workspace-member-predicate-value",
        r"getComparableWorkspaceMemberRelationFields",
    ]),
    ("validation-rules", "Validation rules", [r"validation-rule", r"[Vv]alidationRule"]),
    ("sso", "Single sign-on (SAML / OIDC)", [
        r"/core-modules/sso/", r"(^|[-/.])sso([-/.A-Z]|$)", r"Sso", r"[Ss]aml", r"[Oo]idc", r"available-workspaces\.dto",
    ]),
    ("custom-ai-providers", "Custom AI providers", [r"ai-provider"]),
    ("enterprise-key", "Enterprise key validation", [r"/core-modules/enterprise/", r"enterprise-features-enabled"]),
    ("audit-logs", "Audit logs", [r"/core-modules/event-logs/"]),
    ("signing-key-rotation", "Signing-key rotation", [r"/core-modules/jwt/", r"jwt-key-rotation"]),
    ("domains", "Custom domains and email-sending domains", [
        r"/core-modules/cloudflare/", r"/core-modules/dns-manager/", r"/core-modules/emailing-domain/",
        r"/modules/emailing/", r"/settings/domains/", r"CustomDomain",
    ]),
]

TEST_PATTERN = re.compile(r"(__tests__|\.spec\.|\.test\.|/test/)")


def list_enterprise_files() -> list[str]:
    output = subprocess.run(
        ["git", "grep", "-lF", "/* @license Enterprise */", "--", "packages"],
        cwd=REPO_ROOT, capture_output=True, text=True, check=True,
    ).stdout
    return sorted(output.splitlines())


def classify(path: str) -> str:
    for area_id, _, patterns in AREAS:
        if any(re.search(pattern, path) for pattern in patterns):
            return area_id
    return "unclassified"


def render(files: list[str]) -> tuple[str, list[str]]:
    by_area: dict[str, list[str]] = {}
    for path in files:
        by_area.setdefault(classify(path), []).append(path)

    titles = {area_id: title for area_id, title, _ in AREAS} | {"unclassified": "Unclassified (add an area)"}
    ordered = [area_id for area_id, _, _ in AREAS if area_id in by_area]
    if "unclassified" in by_area:
        ordered.append("unclassified")

    test_count = sum(1 for path in files if TEST_PATTERN.search(path))
    lines = [
        BEGIN_MARKER,
        "",
        f"**{len(files)} files**: {len(files) - test_count} source files and {test_count} test files.",
        "",
        "| Area | Server | Frontend | Shared | Tests | Total |",
        "|---|---:|---:|---:|---:|---:|",
    ]
    for area_id in ordered:
        paths = by_area[area_id]
        count = lambda package: sum(1 for path in paths if path.startswith(f"packages/{package}/") and not TEST_PATTERN.search(path))
        tests = sum(1 for path in paths if TEST_PATTERN.search(path))
        lines.append(
            f"| [{titles[area_id]}](#{area_id}) | {count('twenty-server')} | {count('twenty-front')} "
            f"| {count('twenty-shared')} | {tests} | {len(paths)} |"
        )

    lines.append("")
    for area_id in ordered:
        paths = by_area[area_id]
        lines += [
            "<details>",
            f"<summary><b>{titles[area_id]}</b> ({len(paths)} files)</summary>",
            "",
            *[f"- `{path}`" for path in paths],
            "",
            "</details>",
            "",
        ]
    lines.append(END_MARKER)

    return "\n".join(lines), by_area.get("unclassified", [])


def main() -> None:
    check = "--check" in sys.argv[1:]
    generated, unclassified = render(list_enterprise_files())

    document = DOC_PATH.read_text()
    start = document.index(BEGIN_MARKER)
    end = document.index(END_MARKER) + len(END_MARKER)
    updated = document[:start] + generated + document[end:]

    if unclassified:
        print("Enterprise files matching no area in list-enterprise-files.py:", *unclassified, sep="\n  ")
        if check:
            sys.exit(1)

    if check:
        if updated != document:
            print(f"{DOC_PATH.relative_to(REPO_ROOT)} is stale: run python3 reseller/scripts/list-enterprise-files.py")
            sys.exit(1)
        print("OK: enterprise file inventory is current.")
        return

    DOC_PATH.write_text(updated)
    print(f"Updated {DOC_PATH.relative_to(REPO_ROOT)}.")


if __name__ == "__main__":
    main()
