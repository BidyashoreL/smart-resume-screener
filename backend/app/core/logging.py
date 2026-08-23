"""
Centralized logging configuration.

Kept deliberately simple (stdlib logging, JSON-ish formatting) so it works
the same in local development and in a container without extra dependencies.
"""

import logging
import sys


def configure_logging(level: str = "INFO") -> None:
    root = logging.getLogger()
    if root.handlers:
        # Already configured (e.g. re-imported under pytest) - avoid duplicate handlers.
        return

    root.setLevel(level)
    handler = logging.StreamHandler(sys.stdout)
    formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    handler.setFormatter(formatter)
    root.addHandler(handler)

    # Quiet down noisy third-party loggers unless we're debugging.
    for noisy in ("httpx", "httpcore", "urllib3"):
        logging.getLogger(noisy).setLevel("WARNING")


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
