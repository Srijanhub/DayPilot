"""
Unit tests for DayPilot Context Classifier and Hysteresis Debounce Engine
"""

import time
import pytest
from classifier import ContextClassifier


def test_initial_state():
    classifier = ContextClassifier()
    assert classifier.committed_mode == "WORK"
    assert classifier.manual_override == "AUTO"


def test_instantaneous_classification():
    classifier = ContextClassifier()
    # Work targets
    assert classifier.classify_target("com.microsoft.VSCode", "github.com") == "WORK"
    assert classifier.classify_target("Terminal", "") == "WORK"
    assert classifier.classify_target("Chrome", "leetcode.com/problems") == "WORK"

    # Study targets
    assert classifier.classify_target("Chrome", "school.bosscoderacademy.com/home") == "STUDY"
    assert classifier.classify_target("Chrome", "youtube.com", "BossCoder Dynamic Programming Lecture") == "STUDY"

    # Relax targets
    assert classifier.classify_target("Chrome", "netflix.com/watch/1234") == "RELAX"
    assert classifier.classify_target("Chrome", "asuracomic.net", "Solo Leveling Chapter 140") == "RELAX"


def test_hysteresis_debounce():
    classifier = ContextClassifier(hysteresis_threshold_seconds=2)
    # Starts in WORK
    mode, changed = classifier.process_heartbeat("VSCode", "github.com")
    assert mode == "WORK"
    assert not changed

    # Switch to Netflix (RELAX candidate)
    mode, changed = classifier.process_heartbeat("Chrome", "netflix.com")
    assert mode == "WORK"  # Should NOT change immediately!
    assert not changed
    assert classifier.pending_mode == "RELAX"

    # Quick momentary blip back to VS Code resets pending
    mode, changed = classifier.process_heartbeat("VSCode", "github.com")
    assert mode == "WORK"
    assert classifier.pending_mode is None

    # Sustained Relax
    classifier.process_heartbeat("Chrome", "netflix.com")
    assert classifier.pending_mode == "RELAX"
    time.sleep(2.1)

    # After threshold, mode commits!
    mode, changed = classifier.process_heartbeat("Chrome", "netflix.com")
    assert mode == "RELAX"
    assert changed
    assert classifier.committed_mode == "RELAX"


def test_manual_override():
    classifier = ContextClassifier()
    classifier.set_manual_override("FORCE_STUDY")
    mode, changed = classifier.process_heartbeat("Chrome", "netflix.com")
    assert mode == "STUDY"

    classifier.set_manual_override("AUTO")
    mode, changed = classifier.process_heartbeat("VSCode", "github.com")
    assert mode in ["STUDY", "WORK"]
