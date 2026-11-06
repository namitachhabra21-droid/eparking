#!/usr/bin/env python3
"""Reproduce Experiment 3: pinned cloc measurement and explicit estimation inputs.

Run: python3 scripts/estimate.py [--cloc /path/to/cloc-2.06.pl] [--check]
Without --cloc, downloads the hash-verified tool into a temporary directory.
Only index.html and assets/ are measured; this script never counts itself.
"""
import argparse
from collections import Counter
import hashlib
import json
import math
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import urllib.request
import urllib.error

ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT / "docs/lab/estimation-inputs.json"
OUTPUT = ROOT / "docs/lab/results/estimation.json"
REPORT = ROOT / "docs/lab/03-estimation.md"
TEMPLATE = ROOT / "docs/lab/estimation-template.md"
CLOC_URL = "https://raw.githubusercontent.com/AlDanial/cloc/v2.06/cloc"
CLOC_SHA256 = "ed9fbdd081a2ceb933ea490b3c1cfacc87d3898ae2650d0d6756439695a836c8"
WEIGHTS = {"EI": [3, 4, 6], "EO": [4, 5, 7], "EQ": [3, 4, 6],
           "ILF": [7, 10, 15], "EIF": [5, 7, 10]}
MODES = {"Organic": (2.4, 3.2, 1.05, 2.5, 0.38),
         "Semi-detached": (3.0, 3.0, 1.12, 2.5, 0.35),
         "Embedded": (3.6, 2.8, 1.20, 2.5, 0.32)}


def complexity(row):
    """Return matrix index: 0 low, 1 average, 2 high."""
    kind, det = row["type"], row["det"]
    if kind in ("ILF", "EIF"):
        r, d = row["ret"], det
        return [[0, 0, 1], [0, 1, 2], [1, 2, 2]][
            0 if r == 1 else 1 if r <= 5 else 2][0 if d <= 19 else 1 if d <= 50 else 2]
    f = len(row["ftr"])
    if kind == "EI":
        return [[0, 0, 1], [0, 1, 2], [1, 2, 2]][
            0 if f <= 1 else 1 if f == 2 else 2][0 if det <= 4 else 1 if det <= 15 else 2]
    return [[0, 0, 1], [0, 1, 2], [1, 2, 2]][
        0 if f <= 1 else 1 if f <= 3 else 2][0 if det <= 5 else 1 if det <= 19 else 2]


def cocomo(kloc, model, mode="Organic", eaf=1.0):
    basic_a, intermediate_a, b, c, d = MODES[mode]
    effort = (basic_a if model == "Basic" else intermediate_a) * kloc ** b
    if model == "Intermediate":
        effort *= eaf
    duration = c * effort ** d
    return {"kloc": kloc, "model": model, "mode": mode, "eaf": eaf,
            "effort_pm": effort, "duration_months": duration,
            "average_staff": effort / duration,
            "productivity_loc_per_pm": kloc * 1000 / effort}


def table(headers, rows):
    return "\n".join(["| " + " | ".join(headers) + " |",
                      "| " + " | ".join(["---"] * len(headers)) + " |"] +
                     ["| " + " | ".join(map(str, row)) + " |" for row in rows])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cloc", type=Path)
    parser.add_argument("--check", action="store_true", help="Fail if generated artifacts are stale")
    args = parser.parse_args()
    inputs = json.loads(INPUT.read_text())
    with tempfile.TemporaryDirectory(prefix="parkflow-estimation-") as temp:
        tool = args.cloc or Path(temp) / "cloc.pl"
        if not args.cloc:
            try:
                with urllib.request.urlopen(CLOC_URL, timeout=30) as response:
                    tool.write_bytes(response.read())
            except urllib.error.URLError as error:
                # Some macOS Python installs lack a CA bundle. curl uses the
                # system trust store; TLS verification remains enabled.
                if not shutil.which("curl"):
                    raise SystemExit("Download failed; use --cloc with a local pinned copy") from error
                subprocess.run(["curl", "--proto", "=https", "--proto-redir", "=https",
                                "-fsSL", "--max-time", "30", CLOC_URL, "-o", str(tool)], check=True)
        if hashlib.sha256(tool.read_bytes()).hexdigest() != CLOC_SHA256:
            raise ValueError("cloc tool hash mismatch; use the pinned v2.06 script")
        raw = json.loads(subprocess.check_output(
            ["perl", str(tool.resolve()), "--by-file", "--json", "index.html", "assets"],
            cwd=ROOT, env={**os.environ, "LC_ALL": "C", "LANG": "C"}, text=True))

    paths = sorted(k for k in raw if k not in ("header", "SUM"))
    expected = {"index.html"} | {p.relative_to(ROOT).as_posix()
                               for p in (ROOT / "assets").rglob("*") if p.is_file()}
    if set(paths) != expected:
        raise ValueError("cloc did not account for every file in the declared source boundary")
    files = [{"path": p, **raw[p], "physical": sum(raw[p][k] for k in ("code", "comment", "blank")),
              "sha256": hashlib.sha256((ROOT / p).read_bytes()).hexdigest()} for p in paths]
    languages = {}
    for item in files:
        group = languages.setdefault(item["language"], Counter())
        group.update({k: item[k] for k in ("code", "comment", "blank", "physical")})
        group["files"] += 1
    js = languages["JavaScript"]["code"]
    total = raw["SUM"]["code"]
    data_names = {row["name"] for row in inputs["data_functions"]}
    inventory = []
    for row in inputs["data_functions"] + inputs["transactions"]:
        if len(row["fields"].split(", ")) != row["det"]:
            raise ValueError(f"DET worksheet mismatch: {row['name']}")
        if not set(row.get("ftr", [])).issubset(data_names):
            raise ValueError(f"Unknown FTR in {row['name']}")
        index = complexity(row)
        inventory.append({**row, "complexity": ["Low", "Average", "High"][index],
                          "fp": WEIGHTS[row["type"]][index]})
    ufp = sum(row["fp"] for row in inventory)
    if len(inputs["gsc"]) != 14 or any(not 0 <= r["score"] <= 5 for r in inputs["gsc"]):
        raise ValueError("Exactly 14 GSC scores in [0,5] required")
    tdi = sum(row["score"] for row in inputs["gsc"])
    vaf = 0.65 + 0.01 * tdi
    if len(inputs["cost_drivers"]) != 15:
        raise ValueError("Exactly 15 COCOMO 81 cost drivers required")
    eaf = math.prod(row["multiplier"] for row in inputs["cost_drivers"])
    scenarios = []
    for label, size in [("Measured JavaScript", js / 1000), ("All website source (proxy)", total / 1000)]:
        for model in ("Basic", "Intermediate"):
            scenarios.append({"scope": label, **cocomo(size, model, eaf=eaf)})
    fp_scenarios = [{"assumed_loc_per_ufp": ratio,
                     **cocomo(ufp * ratio / 1000, "Intermediate", eaf=eaf)}
                    for ratio in inputs["assumed_js_loc_per_ufp"]]
    baseline = scenarios[1]
    rate = inputs["hourly_cost_inr"] * inputs["hours_per_person_month"]
    labour = baseline["effort_pm"] * rate
    costs = {"rate_inr_per_pm": rate, "labour_inr": labour,
             "contingency_inr": labour * inputs["contingency_fraction"],
             "budget_inr": labour * (1 + inputs["contingency_fraction"]),
             "cost_per_ufp_inr": labour / ufp,
             "person_hours": baseline["effort_pm"] * inputs["hours_per_person_month"]}
    result = {"schema_version": 1, "scope": inputs["scope"],
              "measurement": {"tool": "cloc 2.06", "tool_url": CLOC_URL,
                              "tool_sha256": CLOC_SHA256, "files": files,
                              "languages": languages, "totals": raw["SUM"]},
              "inputs_sha256": hashlib.sha256(INPUT.read_bytes()).hexdigest(),
              "function_points": {"inventory": inventory, "ufp_proxy": ufp,
                                  "tdi": tdi, "legacy_vaf": vaf, "legacy_adjusted_fp": ufp * vaf},
              "eaf": eaf, "scenarios": scenarios, "fp_sensitivity": fp_scenarios,
              "mode_sensitivity": [cocomo(js / 1000, "Basic", mode) for mode in MODES],
              "size_sensitivity": [{"factor": factor, **cocomo(js / 1000 * factor, "Intermediate", eaf=eaf)}
                                   for factor in (0.8, 1.0, 1.2)], "costs": costs}
    sums = []
    for kind in WEIGHTS:
        rows = [r for r in inventory if r["type"] == kind]
        sums.append([kind, *(sum(r["complexity"] == level for r in rows)
                             for level in ("Low", "Average", "High")), sum(r["fp"] for r in rows)])
    replacements = {
        "language_table": table(["Language", "Files", "Physical", "Blank", "Comment-only", "Code"],
                                [[k, *(v[x] for x in ("files", "physical", "blank", "comment", "code"))]
                                 for k, v in sorted(languages.items())] +
                                [["TOTAL", len(files), sum(f["physical"] for f in files),
                                  raw["SUM"]["blank"], raw["SUM"]["comment"], total]]),
        "file_table": table(["File", "Physical", "Blank", "Comment-only", "Code"],
                            [[f'`{f["path"]}`', *(f[k] for k in ("physical", "blank", "comment", "code"))] for f in files]),
        "data_table": table(["Working data group", "RETs", "DETs", "Complexity", "Proxy FP"],
                            [[r["name"], r["ret"], r["det"], r["complexity"], r["fp"]] for r in inventory if "ret" in r]),
        "transaction_table": table(["Implemented process", "Type", "FTRs", "DETs", "Complexity", "FP"],
                                   [[r["name"], r["type"], ", ".join(r["ftr"]), r["det"], r["complexity"], r["fp"]]
                                    for r in inventory if "ftr" in r]),
        "fp_summary": table(["Type", "Low count", "Average count", "High count", "Weighted FP"], sums),
        "gsc_table": table(["Characteristic", "Score", "Project assumption"],
                           [[r["name"], r["score"], r["reason"]] for r in inputs["gsc"]]),
        "driver_table": table(["Driver", "Meaning", "Baseline rating", "Multiplier"],
                              [[r["code"], r["name"], r["rating"], f'{r["multiplier"]:.2f}'] for r in inputs["cost_drivers"]]),
        "results_table": table(["Size basis", "KLOC", "Model", "Effort PM", "Schedule months", "Average staff"],
                               [[r["scope"], f'{r["kloc"]:.3f}', r["model"], f'{r["effort_pm"]:.4f}',
                                 f'{r["duration_months"]:.4f}', f'{r["average_staff"]:.4f}'] for r in scenarios]),
        "fp_sensitivity": table(["Assumed JS LOC/UFP", "UFP × ratio", "KLOC", "Intermediate PM", "Months", "Avg staff"],
                                [[r["assumed_loc_per_ufp"], ufp * r["assumed_loc_per_ufp"], f'{r["kloc"]:.3f}',
                                  f'{r["effort_pm"]:.4f}', f'{r["duration_months"]:.4f}', f'{r["average_staff"]:.4f}'] for r in fp_scenarios]),
        "size_sensitivity": table(["Size factor", "KLOC", "Intermediate PM", "Months"],
                                  [[f'{r["factor"]:.0%}', f'{r["kloc"]:.4f}', f'{r["effort_pm"]:.4f}',
                                    f'{r["duration_months"]:.4f}'] for r in result["size_sensitivity"]]),
        "mode_sensitivity": table(["Mode", "Basic PM", "Months", "Avg staff"],
                                  [[r["mode"], f'{r["effort_pm"]:.4f}', f'{r["duration_months"]:.4f}',
                                    f'{r["average_staff"]:.4f}'] for r in result["mode_sensitivity"]]),
        "cost_comparison": table(["Size basis", "Model", "Labour INR", "With 10% reserve INR"],
                                 [[r["scope"], r["model"], f'{r["effort_pm"]*rate:,.2f}',
                                   f'{r["effort_pm"]*rate*(1+inputs["contingency_fraction"]):,.2f}']
                                  for r in scenarios]),
        "ufp": str(ufp), "tdi": str(tdi), "vaf": f"{vaf:.2f}", "afp": f"{ufp*vaf:.2f}",
        "js_loc": str(js), "total_loc": str(total), "js_kloc": f"{js/1000:.3f}",
        "power": f"{(js/1000)**1.05:.8f}", "basic_effort": f'{scenarios[0]["effort_pm"]:.8f}',
        "basic_duration": f'{scenarios[0]["duration_months"]:.8f}',
        "basic_staff": f'{scenarios[0]["average_staff"]:.8f}',
        "inter_effort": f'{baseline["effort_pm"]:.8f}',
        "inter_duration": f'{baseline["duration_months"]:.8f}',
        "inter_staff": f'{baseline["average_staff"]:.8f}',
        "eaf": f"{eaf:.4f}", "labour": f"{labour:,.2f}",
        "contingency": f'{costs["contingency_inr"]:,.2f}', "budget": f'{costs["budget_inr"]:,.2f}',
        "hours": f'{costs["person_hours"]:,.2f}',
        "productivity": f'{baseline["productivity_loc_per_pm"]:.4f}',
        "cost_fp": f'{costs["cost_per_ufp_inr"]:,.2f}', "loc_fp": f"{js/ufp:.4f}",
    }
    report = TEMPLATE.read_text()
    for key, value in replacements.items():
        report = report.replace("{{" + key + "}}", value)
    if "{{" in report:
        raise ValueError("Unresolved report placeholder")
    artifacts = [(OUTPUT, json.dumps(result, indent=2, ensure_ascii=False) + "\n"), (REPORT, report)]
    for path, content in artifacts:
        if args.check:
            if not path.exists() or path.read_text() != content:
                raise SystemExit(f"Stale artifact: {path.relative_to(ROOT)}; run scripts/estimate.py")
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content)
    print(f"{'Verified' if args.check else 'Generated'}: {total} website LOC; {js} JS LOC; "
          f"{ufp} indicative UFP; {baseline['effort_pm']:.4f} nominal intermediate PM")


if __name__ == "__main__":
    main()
