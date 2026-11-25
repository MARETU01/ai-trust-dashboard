#!/usr/bin/env python3
"""Build the dashboard's respondent-level CSV from the original survey export.

Blank cells represent missing responses. Multi-select columns keep their
semicolon-delimited survey options. Task columns use codes 1–5 in the order
defined by TASK_STATUS_FIELDS. A task with conflicting answers is left blank.
Country is available directly. The source survey export has no gender field.
"""

import argparse
import csv
from pathlib import Path
from tempfile import NamedTemporaryFile


DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DEFAULT_SOURCE = DATA_DIR / "开发者如何使用&信任ai_results.csv"
DEFAULT_OUTPUT = DATA_DIR / "data.csv"

PASSTHROUGH_FIELDS = {
    "response_id": "ResponseId",
    "country": "Country",
    "age_group": "Age",
    "developer_roles": "DevType",
    "work_experience_years": "WorkExp",
    "ai_trust": "AIAcc",
    "ai_sentiment": "AISent",
    "ai_job_threat": "AIThreat",
    "languages_used": "LanguageHaveWorkedWith",
    "databases_used": "DatabaseHaveWorkedWith",
    "community_platforms_used": "CommPlatformHaveWorkedWith",
    "ai_models_used": "AIModelsHaveWorkedWith",
    "ai_models_wanted": "AIModelsWantToWorkWith",
}

CODED_FIELDS = {
    "developer_status": (
        "MainBranch",
        {
            "I am a developer by profession": "professional_developer",
            "I am not primarily a developer, but I write code sometimes as part of my work/studies": "occasional_coder",
            "I am learning to code": "learning_to_code",
            "I code primarily as a hobby": "hobbyist",
            "I used to be a developer by profession, but no longer am": "former_developer",
            "I work with developers or my work supports developers but am not a developer by profession": "works_with_developers",
        },
    ),
    "code_learning_status": (
        "LearnCodeChoose",
        {
            "Yes, I am new to coding or currently a student": "beginner_or_student",
            "Yes, I am not new to coding but am learning new coding techniques or programming language": "experienced_and_learning",
            "No, I am not new to coding and did not learn new coding techniques or programming languages": "experienced_not_learning",
        },
    ),
    "ai_learning": (
        "LearnCodeAI",
        {
            "Yes, I learned how to use AI-enabled tools required for my job or to benefit my career": "yes_for_work",
            "Yes, I learned how to use AI-enabled tools for my personal curiosity and/or hobbies": "yes_for_personal_use",
            "No, I learned something that was not related to AI or AI enablement for my personal curiosity and/or hobbies": "no_other_personal_learning",
            "No, I didn't spend time learning in the past year": "no_learning",
            "No, I learned something that was not related to AI or AI enablement as required for my job or to benefit my career": "no_other_work_learning",
        },
    ),
    "ai_use_group": (
        "AISelect",
        {
            "Yes, I use AI tools daily": "daily",
            "Yes, I use AI tools weekly": "weekly",
            "Yes, I use AI tools monthly or infrequently": "monthly_or_infrequent",
            "No, but I plan to soon": "plan_to_use",
            "No, and I don't plan to": "no_plans_to_use",
        },
    ),
    "ai_complex_task_rating": (
        "AIComplex",
        {
            "Very well at handling complex tasks": "very_good",
            "Good, but not great at handling complex tasks": "good",
            "Neither good or bad at handling complex tasks": "neutral",
            "Bad at handling complex tasks": "bad",
            "Very poor at handling complex tasks": "very_poor",
            "I don't use AI tools for complex tasks / I don't know": "unused_or_unknown",
        },
    ),
}

TASK_STATUS_FIELDS = {
    "1": "AIToolCurrently partially AI",
    "2": "AIToolCurrently mostly AI",
    "3": "AIToolPlan to partially use AI",
    "4": "AIToolPlan to mostly use AI",
    "5": "AIToolDon't plan to use AI for this task",
}

TASK_FIELDS = {
    "task_writing_code": "Writing code",
    "task_searching_for_answers": "Search for answers",
    "task_learning_new_concepts": "Learning new concepts or technologies",
    "task_learning_a_codebase": "Learning about a codebase",
    "task_project_planning": "Project planning",
    "task_documenting_code": "Documenting code",
    "task_debugging_code": "Debugging or fixing code",
    "task_testing_code": "Testing code",
    "task_committing_and_reviewing_code": "Committing and reviewing code",
    "task_deployment_and_monitoring": "Deployment and monitoring",
    "task_predictive_analytics": "Predictive analytics",
    "task_generating_content_or_data": "Generating content or synthetic data",
    "task_maintaining_documentation": "Creating or maintaining documentation",
}


def clean_value(value):
    value = value.strip()
    return "" if value == "NA" else value


def project_row(row):
    data = {
        name: clean_value(row[source]) for name, source in PASSTHROUGH_FIELDS.items()
    }
    for name, (source, codes) in CODED_FIELDS.items():
        value = clean_value(row[source])
        if value and value not in codes:
            raise ValueError(f"Unexpected {source} value: {value!r}")
        data[name] = codes[value] if value else ""

    statuses = {}
    for code, source in TASK_STATUS_FIELDS.items():
        for task in {part.strip() for part in row[source].split(";")}:
            statuses[task] = "" if task in statuses else code
    for name, task in TASK_FIELDS.items():
        data[name] = statuses.get(task, "")
    return data


def prepare_data(source, output):
    if source.resolve() == output.resolve() or (
        output.exists() and source.exists() and output.samefile(source)
    ):
        raise ValueError("Input and output must be different files.")

    # Some unused columns contain long values that exceed the CSV parser default.
    csv.field_size_limit(max(csv.field_size_limit(), source.stat().st_size))
    required = set(PASSTHROUGH_FIELDS.values()) | set(TASK_STATUS_FIELDS.values())
    required.update(source_name for source_name, _ in CODED_FIELDS.values())
    output_fields = [*PASSTHROUGH_FIELDS, *CODED_FIELDS, *TASK_FIELDS]

    respondents = set()
    countries = set()
    country_count = 0
    temporary_path = None

    try:
        with source.open(encoding="utf-8-sig", newline="") as source_file:
            reader = csv.DictReader(source_file)
            headers = reader.fieldnames or []
            missing = required.difference(headers)
            if missing:
                raise ValueError("Missing survey fields: " + ", ".join(sorted(missing)))
            if len(headers) != len(set(headers)):
                raise ValueError("Source CSV contains duplicate column names.")

            output.parent.mkdir(parents=True, exist_ok=True)
            with NamedTemporaryFile(
                mode="w", encoding="utf-8", newline="", dir=output.parent,
                prefix=f".{output.name}.", suffix=".tmp", delete=False,
            ) as output_file:
                temporary_path = Path(output_file.name)
                writer = csv.DictWriter(output_file, fieldnames=output_fields, lineterminator="\n")
                writer.writeheader()
                for record_number, row in enumerate(reader, start=1):
                    if None in row or any(value is None for value in row.values()):
                        raise ValueError(f"Incorrect field count in respondent record {record_number}.")
                    data = project_row(row)
                    respondent = data["response_id"]
                    if not respondent.isdecimal() or respondent in respondents:
                        raise ValueError(f"Invalid or duplicate respondent ID in record {record_number}: {respondent!r}")
                    respondents.add(respondent)
                    if data["country"]:
                        countries.add(data["country"])
                        country_count += 1
                    writer.writerow(data)

            if not respondents:
                raise ValueError("Source CSV has no respondent records.")
        temporary_path.replace(output)
    finally:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)

    print(f"Wrote {len(respondents):,} respondents and {len(output_fields)} columns to {output}.")
    print(f"Country reported by {country_count:,} respondents across {len(countries)} survey options.")
    print(f"File size: {output.stat().st_size:,} bytes (source: {source.stat().st_size:,} bytes).")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=DEFAULT_SOURCE, help="Original survey CSV")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="Output dashboard CSV")
    args = parser.parse_args()
    try:
        prepare_data(args.input, args.output)
    except (OSError, ValueError, csv.Error) as error:
        parser.exit(1, f"Error: {error}\n")


if __name__ == "__main__":
    main()
