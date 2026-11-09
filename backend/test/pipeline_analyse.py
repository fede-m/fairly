import asyncio
import argparse
from collections import Counter
import json
import logging
import re
import time
import uuid
from datetime import datetime
from pathlib import Path

import httpx
import matplotlib.pyplot as plt
import pandas as pd
import seaborn as sns

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
)
logger = logging.getLogger("benchmark_analyse")

BASE_URL = "http://127.0.0.1:8000"
DATASET = Path(__file__).parent / "emails.json"
RESULTS_ROOT = Path(__file__).parent / "performance_result"
DEFAULT_CONCURRENCY = 10
DEFAULT_STRATEGY = "CV-1"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Benchmark and stress test the /analyse endpoint."
    )
    parser.add_argument("--base-url", default=BASE_URL)
    parser.add_argument("--dataset", type=Path, default=DATASET)
    parser.add_argument("--results-root", type=Path, default=RESULTS_ROOT)
    parser.add_argument("--concurrency", type=int, default=DEFAULT_CONCURRENCY)
    parser.add_argument("--strategy", default=DEFAULT_STRATEGY)
    parser.add_argument("--user-id", default="benchmark@example.com")
    parser.add_argument(
        "--suffix",
        default="",
        help="Optional suffix appended to the timestamped result folder.",
    )
    args = parser.parse_args()

    if args.concurrency < 1:
        parser.error("--concurrency must be at least 1")
    if args.suffix and not re.fullmatch(r"[A-Za-z0-9_-]+", args.suffix):
        parser.error("--suffix may contain only letters, numbers, underscores, and hyphens")

    return args


def create_result_folder(results_root: Path, strategy: str, suffix: str) -> Path:
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    folder_name = f"{timestamp}_{strategy}_{suffix}" if suffix else f"{timestamp}_{strategy}"
    folder = results_root / folder_name
    folder.mkdir(parents=True, exist_ok=False)
    return folder


def load_dataset(dataset: Path) -> list[dict]:
    with dataset.open(encoding="utf-8") as file:
        emails = json.load(file)

    for email in emails:
        email["char_length"] = len(email["text"])
        email["word_count"] = len(email["text"].split())

    return emails

def metric_value(value):
    if isinstance(value, (list, tuple)):
        return value[-1]
    return value

async def call_endpoint(
    client: httpx.AsyncClient,
    email: dict,
    mode: str,
    endpoint: str,
    strategy: str,
    user_id: str
) -> dict:
    logger.info(
        "Starting %s request for email=%s (%d characters)",
        mode,
        email["id"],
        len(email["text"]),
    )
    payload = {
        "data": [email],
        "strategy": strategy,
        "session_id": f"benchmark-{uuid.uuid4()}",
        "user_id": user_id,
    }

    started = time.perf_counter()

    try:
        response = await client.post(endpoint, json=payload)
        elapsed = time.perf_counter() - started

        body = response.json()
        profiling = body.get("profiling_results") or {}
        application_error = body.get("error") is True
        error_message = (
            body.get("message") or body.get("details") or body.get("code")
            if application_error or not response.is_success
            else None
        )
        logger.info(
            "Finished %s request for email=%s: status=%s, application_error=%s, elapsed=%.3fs",
            mode,
            email["id"],
            response.status_code,
            application_error,
            elapsed,
        )

        return {
            "mode": mode,
            "email_id": email["id"],
            "char_length": len(email["text"]),
            "word_count": len(email["text"].split()),
            "client_total": elapsed,
            "server_total": metric_value(profiling.get("total")),
            "presidio": metric_value(profiling.get("presidio")),
            "detection": metric_value(profiling.get("detection")),
            "generation": metric_value(profiling.get("generation")),
            "mongo_db": metric_value(profiling.get("mongo_db")),
            "num_spans": profiling.get("num_spans"),
            "status_code": response.status_code,
            "application_success": not application_error and response.is_success,
            "error_stage": profiling.get("error_stage"),
            "error_code": body.get("code"),
            "error_message": error_message,
            "error": None if not application_error and response.is_success else body,
        }

    except Exception as exc:
        elapsed = time.perf_counter() - started
        logger.error(
            "Failed %s request for email=%s after %.3fs: %s",
            mode,
            email["id"],
            elapsed,
            exc,
        )
        return {
            "mode": mode,
            "email_id": email["id"],
            "char_length": len(email["text"]),
            "word_count": len(email["text"].split()),
            "client_total": elapsed,
            "status_code": None,
            "application_success": False,
            "error_stage": "transport",
            "error_code": "TRANSPORT_ERROR",
            "error_message": str(exc),
            "error": repr(exc),
        }

async def run_sequential(
    client: httpx.AsyncClient,
    emails: list[dict],
    endpoint: str,
    strategy: str,
    user_id: str,
) -> list[dict]:
    logger.info("Sequential benchmark started: %d emails", len(emails))
    results = []

    for index, email in enumerate(emails, start=1):
        results.append(
            await call_endpoint(client, email, "sequential", endpoint, strategy, user_id)
        )
        if index % 10 == 0 or index == len(emails):
            logger.info("Sequential benchmark progress: %d/%d", index, len(emails))

    logger.info("Sequential benchmark completed")
    return results

async def run_concurrent(
    client: httpx.AsyncClient,
    emails: list[dict],
    endpoint: str,
    concurrency: int,
    strategy: str,
    user_id: str,
) -> list[dict]:
    logger.info(
        "Concurrent stress test started: %d emails, concurrency=%d",
        len(emails),
        concurrency,
    )
    semaphore = asyncio.Semaphore(concurrency)
    completed = 0
    progress_lock = asyncio.Lock()

    async def limited_call(email):
        nonlocal completed
        async with semaphore:
            result = await call_endpoint(
                client, email, "concurrent", endpoint, strategy, user_id
            )
            async with progress_lock:
                completed += 1
                if completed % 10 == 0 or completed == len(emails):
                    logger.info(
                        "Concurrent stress test progress: %d/%d",
                        completed,
                        len(emails),
                    )
            return result

    results = await asyncio.gather(*(limited_call(email) for email in emails))
    logger.info("Concurrent stress test completed")
    return results

def create_plots(data: pd.DataFrame, output_folder: Path) -> None:
    logger.info("Creating plots in %s", output_folder)
    sns.set_theme(style="whitegrid")

    metrics = [
        "client_total",
        "server_total",
        "presidio",
        "detection",
        "generation",
        "mongo_db",
    ]

    for metric in metrics:
        if metric not in data or data[metric].dropna().empty:
            continue

        plot_data = data.dropna(subset=[metric])

        plt.figure(figsize=(10, 6))
        sns.regplot(
            data=plot_data,
            x="char_length",
            y=metric,
            scatter_kws={"alpha": 0.6},
            line_kws={"color": "red"},
        )
        plt.title(f"{metric} versus email character length")
        plt.xlabel("Character length")
        plt.ylabel("Time (seconds)")
        plt.tight_layout()
        plt.savefig(output_folder / f"{metric}_by_character_length.png")
        plt.close()

    plt.figure(figsize=(10, 6))
    sns.boxplot(data=data, x="mode", y="client_total")
    plt.title("Sequential versus concurrent request latency")
    plt.ylabel("Client-observed time (seconds)")
    plt.tight_layout()
    plt.savefig(output_folder / "sequential_vs_concurrent.png")
    plt.close()
    logger.info("Plots completed")

def calculate_slos(data: pd.DataFrame) -> dict:
    metrics = [
        "client_total",
        "server_total",
        "presidio",
        "detection",
        "generation",
        "mongo_db",
    ]

    report = {}

    for metric in metrics:
        if metric not in data or data[metric].dropna().empty:
            continue

        values = data[metric].dropna()

        report[metric] = {
            "count": int(values.count()),
            "mean": float(values.mean()),
            "p50": float(values.quantile(0.50)),
            "p95": float(values.quantile(0.95)),
            "p99": float(values.quantile(0.99)),
            "max": float(values.max()),
        }

    return report

def write_reports(data: pd.DataFrame, output_folder: Path) -> None:
    logger.info("Writing row metrics and reports in %s", output_folder)
    data.to_csv(output_folder / "row_metrics.csv", index=False)

    successful = data[data["application_success"]]
    errors = data[~data["application_success"]]
    slo_report = {
        "successful": calculate_slos(successful),
        "errors": calculate_slos(errors),
        "by_mode": {
            mode: {
                "successful": calculate_slos(group[group["application_success"]]),
                "errors": calculate_slos(group[~group["application_success"]]),
            }
            for mode, group in data.groupby("mode")
        },
    }

    with (output_folder / "slo_report.json").open("w", encoding="utf-8") as file:
        json.dump(slo_report, file, indent=2)

    correlations = {}

    for metric in [
        "client_total",
        "server_total",
        "presidio",
        "detection",
        "generation",
        "mongo_db",
    ]:
        if metric in data:
            subset = data[["char_length", metric]].dropna()

            if len(subset) >= 2:
                correlations[metric] = {
                    "pearson": float(
                        subset["char_length"].corr(subset[metric], method="pearson")
                    ),
                    "spearman": float(
                        subset["char_length"].corr(subset[metric], method="spearman")
                    ),
                }

    with (output_folder / "length_correlations.json").open(
        "w", encoding="utf-8"
    ) as file:
        json.dump(correlations, file, indent=2)
    logger.info("Reports completed")


def calculate_run_metrics(data: pd.DataFrame, concurrency: int) -> dict:
    report = {}
    for mode, group in data.groupby("mode"):
        successful = group["application_success"].sum()
        failed = (~group["application_success"]).sum()
        transport_errors = group["status_code"].isna().sum()
        successful_wall_time = float(
            group.loc[group["application_success"], "client_total"].sum()
        )
        errors = group[~group["application_success"]]

        def counts(column: str) -> dict[str, int]:
            return {
                str(value): int(count)
                for value, count in Counter(errors[column].dropna()).items()
            }

        report[mode] = {
            "requests": int(len(group)),
            "successful_requests": int(successful),
            "failed_requests": int(failed),
            "application_errors": int(failed - transport_errors),
            "transport_errors": int(transport_errors),
            "error_rate": float(failed / len(group)),
            "wall_time_seconds": successful_wall_time,
            "throughput_requests_per_second": (
                float(successful / successful_wall_time)
                if successful_wall_time > 0
                else 0.0
            ),
            "application_errors_by_code": counts("error_code"),
            "errors_by_stage": counts("error_stage"),
            "error_messages": counts("error_message"),
            "configured_concurrency": (
                1 if mode == "sequential" else concurrency
            ),
        }
    return report


async def main(args: argparse.Namespace) -> None:
    logger.info("Analysis started")
    logger.info(
        "Configuration: base_url=%s, dataset=%s, strategy=%s, concurrency=%d",
        args.base_url,
        args.dataset,
        args.strategy,
        args.concurrency,
    )
    output_folder = create_result_folder(args.results_root, args.suffix, args.strategy)
    logger.info("Results will be stored in %s", output_folder)
    emails = load_dataset(args.dataset)
    logger.info("Loaded dataset: %d emails from %s", len(emails), args.dataset)
    endpoint = f"{args.base_url.rstrip('/')}/analyse"

    limits = httpx.Limits(
        max_connections=args.concurrency,
        max_keepalive_connections=args.concurrency,
    )

    async with httpx.AsyncClient(
        timeout=120.0,
        limits=limits,
    ) as client:
        sequential_start = time.perf_counter()
        sequential_results = await run_sequential(
            client, emails, endpoint, args.strategy, args.user_id
        )
        sequential_wall_time = time.perf_counter() - sequential_start
        logger.info(
            "Sequential benchmark wall time: %.3fs",
            sequential_wall_time,
        )

        concurrent_start = time.perf_counter()
        concurrent_results = await run_concurrent(
            client,
            emails,
            endpoint,
            args.concurrency,
            args.strategy,
            args.user_id,
        )
        concurrent_wall_time = time.perf_counter() - concurrent_start
        logger.info(
            "Concurrent stress test wall time: %.3fs",
            concurrent_wall_time,
        )

    data = pd.DataFrame(sequential_results + concurrent_results)

    write_reports(data, output_folder)
    create_plots(data, output_folder)
    run_metrics = calculate_run_metrics(
        data,
        args.concurrency,
    )
    with (output_folder / "run_metrics.json").open("w", encoding="utf-8") as file:
        json.dump(run_metrics, file, indent=2)

    logger.info("Analysis completed successfully")
    logger.info("Results written to %s", output_folder)




if __name__ == "__main__":
    asyncio.run(main(parse_args()))