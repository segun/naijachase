"""Stable public gameplay interface for non-terminal clients.

Web, mobile, test, and automation clients should import from this module rather
than depending on terminal rendering. The compatibility exports keep existing
content scripts working while the implementation evolves behind this boundary.
"""

from game import (
    CASE_BASE,
    DIFFICULTY_NAMES,
    DIFFICULTY_RULES,
    FIELDS,
    RANKS,
    SAVE_VERSION,
    Career,
    CommandResult,
    EngineEvent,
    GameData,
    GameEngine,
    Session,
    rank_for,
    state_of,
)

__all__ = [
    "CASE_BASE",
    "DIFFICULTY_NAMES",
    "DIFFICULTY_RULES",
    "FIELDS",
    "RANKS",
    "SAVE_VERSION",
    "Career",
    "CommandResult",
    "EngineEvent",
    "GameData",
    "GameEngine",
    "Session",
    "rank_for",
    "state_of",
]
