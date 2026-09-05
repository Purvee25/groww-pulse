"""
Unit tests for the attention-score engine.

Run with:
    cd backend && pytest tests/ -v
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import pytest
from services.attention_score import (
    compute_z_score,
    classify_priority,
    compute_attention_score,
    narrate,
    regime_multiplier,
)


# ── regime_multiplier ─────────────────────────────────────────────────────────

class TestRegimeMultiplier:
    def test_none_vix_returns_normal(self):
        mult, label = regime_multiplier(None)
        assert mult == 1.0
        assert label == "NORMAL"

    def test_low_vix_returns_normal(self):
        mult, label = regime_multiplier(12.0)
        assert mult == 1.0
        assert label == "NORMAL"

    def test_high_vix_amplifies(self):
        mult, label = regime_multiplier(20.0)
        assert mult > 1.0
        assert label == "HIGH_VOLATILITY_EXPANSION"

    def test_higher_vix_amplifies_more(self):
        mult_low, _ = regime_multiplier(18.0)
        mult_high, _ = regime_multiplier(25.0)
        assert mult_high > mult_low


# ── compute_z_score ────────────────────────────────────────────────────────────

class TestComputeZScore:
    def test_zero_return_is_zero(self):
        z, _ = compute_z_score(0.0, 1.0, None)
        assert z == 0.0

    def test_positive_return_is_positive(self):
        z, _ = compute_z_score(2.0, 1.0, None)
        assert z > 0

    def test_negative_return_is_negative(self):
        z, _ = compute_z_score(-2.0, 1.0, None)
        assert z < 0

    def test_zero_volatility_returns_zero(self):
        z, _ = compute_z_score(5.0, 0.0, None)
        assert z == 0.0

    def test_large_move_in_quiet_stock_scores_higher(self):
        """3% move in a stock with 0.1% volatility should score higher than
        3% in a stock with 3% volatility."""
        z_quiet, _ = compute_z_score(3.0, 0.1, None)
        z_volatile, _ = compute_z_score(3.0, 3.0, None)
        assert z_quiet > z_volatile

    def test_elapsed_seconds_none_treated_as_n1(self):
        z_none, _ = compute_z_score(1.0, 1.0, None)
        z_zero, _ = compute_z_score(1.0, 1.0, 0)
        assert abs(z_none - z_zero) < 1e-9

    def test_longer_elapsed_increases_expected_vol(self):
        """With more elapsed time, expected volatility grows, so z-score shrinks."""
        z_short, _ = compute_z_score(1.0, 0.5, 60)
        z_long, _ = compute_z_score(1.0, 0.5, 3600)
        assert abs(z_long) < abs(z_short)

    def test_returns_regime_label(self):
        _, regime = compute_z_score(1.0, 1.0, None)
        assert regime in ("NORMAL", "HIGH_VOLATILITY_EXPANSION")

    def test_high_vix_reduces_z_score(self):
        """High VIX expands expected volatility, reducing z-score magnitude."""
        z_calm, _ = compute_z_score(1.0, 0.5, 3600, vix=10.0)
        z_jumpy, _ = compute_z_score(1.0, 0.5, 3600, vix=25.0)
        assert abs(z_jumpy) < abs(z_calm)


# ── classify_priority ──────────────────────────────────────────────────────────

class TestClassifyPriority:
    def test_high_at_two_sigma(self):
        assert classify_priority(2.1) == "HIGH"

    def test_medium_at_one_sigma(self):
        assert classify_priority(1.5) == "MEDIUM"

    def test_low_below_one_sigma(self):
        assert classify_priority(0.5) == "LOW"

    def test_boundary_exactly_two(self):
        assert classify_priority(2.0) == "HIGH"

    def test_boundary_exactly_one(self):
        assert classify_priority(1.0) == "MEDIUM"

    def test_negative_score_is_low(self):
        assert classify_priority(-1.0) == "LOW"

    def test_zero_is_low(self):
        assert classify_priority(0.0) == "LOW"


# ── sensitivity multiplier (documented constants) ────────────────────────────

SENSITIVITY_MULTIPLIER = {"quiet": 1.75, "normal": 1.0, "loud": 0.6}

class TestSensitivityMultiplier:
    def test_quiet_stock_escalates_at_lower_raw_score(self):
        raw_score = 1.3  # × 1.75 = 2.275 → HIGH; × 1.0 = 1.3 → MEDIUM
        quiet_effective = raw_score * SENSITIVITY_MULTIPLIER["quiet"]
        normal_effective = raw_score * SENSITIVITY_MULTIPLIER["normal"]
        assert classify_priority(quiet_effective) == "HIGH"
        assert classify_priority(normal_effective) == "MEDIUM"

    def test_loud_stock_suppresses_signal(self):
        raw_score = 2.5   # HIGH on normal; × 0.6 = 1.5 → MEDIUM
        loud_effective = raw_score * SENSITIVITY_MULTIPLIER["loud"]
        assert classify_priority(loud_effective) == "MEDIUM"

    def test_multipliers_ordered_correctly(self):
        assert SENSITIVITY_MULTIPLIER["quiet"] > SENSITIVITY_MULTIPLIER["normal"] > SENSITIVITY_MULTIPLIER["loud"]


# ── narrate ────────────────────────────────────────────────────────────────────

class TestNarrate:
    def test_returns_string(self):
        result = narrate(stock_return_pct=2.5, z_score=2.2, volume_ratio=1.0)
        assert isinstance(result, str)
        assert len(result) > 0

    def test_contains_return_and_sigma(self):
        result = narrate(stock_return_pct=1.8, z_score=1.9, volume_ratio=1.0)
        assert "σ" in result
        assert "%" in result

    def test_high_volume_ratio_mentioned(self):
        result = narrate(stock_return_pct=1.0, z_score=1.1, volume_ratio=2.0)
        assert "volume" in result.lower() or "×" in result

    def test_sector_adjusted_note(self):
        result = narrate(stock_return_pct=1.5, z_score=1.6, volume_ratio=1.0, sector_adjusted=True)
        assert "sector" in result.lower()

    def test_52w_high_break_mentioned(self):
        result = narrate(stock_return_pct=1.0, z_score=1.1, volume_ratio=1.0,
                         current_price=100.0, week_52_high=100.0)
        assert "52w" in result.lower() or "high" in result.lower()

    def test_52w_low_break_mentioned(self):
        result = narrate(stock_return_pct=-1.0, z_score=1.1, volume_ratio=1.0,
                         current_price=50.0, week_52_low=50.0)
        assert "52w" in result.lower() or "low" in result.lower()


# ── compute_attention_score ───────────────────────────────────────────────────

class TestComputeAttentionScore:
    def test_higher_excess_return_scores_higher(self):
        small = compute_attention_score(0.5, 0.5, 1.0, 1.0)
        big = compute_attention_score(3.0, 0.5, 1.0, 1.0)
        assert big > small

    def test_higher_volume_ratio_boosts_score(self):
        normal_vol = compute_attention_score(1.0, 0.5, 1.0, 1.0)
        high_vol = compute_attention_score(1.0, 0.5, 3.0, 1.0)
        assert high_vol > normal_vol

    def test_returns_non_negative(self):
        score = compute_attention_score(1.0, 0.5, 1.0, 1.0)
        assert score >= 0

    def test_zero_volatility_returns_zero(self):
        score = compute_attention_score(5.0, 0.0, 1.0, 1.0)
        assert score == 0.0


# ── invariants ────────────────────────────────────────────────────────────────

class TestInvariants:
    @pytest.mark.parametrize("ret,vol", [
        (0.0, 1.0),
        (5.0, 0.5),
        (-3.0, 2.0),
        (1.5, 0.01),
    ])
    def test_z_score_is_finite(self, ret, vol):
        z, _ = compute_z_score(ret, vol, None)
        assert z == z          # not NaN
        assert abs(z) < 1e9   # not ±infinity

    def test_higher_return_same_context_scores_higher(self):
        z_small, _ = compute_z_score(0.5, 1.0, None)
        z_big, _ = compute_z_score(3.0, 1.0, None)
        assert abs(z_big) > abs(z_small)

    def test_same_return_quieter_stock_ranks_higher(self):
        z_quiet, _ = compute_z_score(1.0, 0.1, None)
        z_noisy, _ = compute_z_score(1.0, 2.0, None)
        assert abs(z_quiet) > abs(z_noisy)

    def test_priority_ordering_matches_score_ordering(self):
        scores = [0.3, 1.0, 1.5, 2.0, 3.0]
        priorities = [classify_priority(s) for s in scores]
        priority_rank = {"LOW": 0, "MEDIUM": 1, "HIGH": 2}
        ranks = [priority_rank[p] for p in priorities]
        assert ranks == sorted(ranks)
