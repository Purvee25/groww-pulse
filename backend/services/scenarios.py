"""Black-Swan scenario replay: feeds the real scoring pipeline synthetic
but historically-shaped inputs (return, VIX, elapsed time) instead of
live checkpoint data, so a demo has a guaranteed dramatic moment that
doesn't depend on the actual market moving during the room's 3 minutes.

This is explicitly labeled a replay everywhere it surfaces — the API
response, the frontend banner — never presented as live. The point isn't
to fake resilience the way a client-side fault-injector would; it's to
run the exact same compute_z_score / compute_attention_score / narrate /
thesis_watchdog functions used on real data, on numbers shaped like real
historical events, so the demo proves the math works under stress without
needing the live market to cooperate on cue.

Figures are illustrative magnitudes for the event, not a backtest against
actual tick data for any specific listed symbol — stated here rather than
implied by a false precision in the numbers.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Scenario:
    key: str
    label: str
    description: str
    stock_return_pct: float
    vix: float
    elapsed_hours: float


SCENARIOS: dict[str, Scenario] = {
    "flash_crash": Scenario(
        key="flash_crash",
        label="Flash Crash",
        description="Sharp gap-down across high-beta equities within a single session.",
        stock_return_pct=-8.5,
        vix=32.0,
        elapsed_hours=0.5,
    ),
    "budget_rally": Scenario(
        key="budget_rally",
        label="Budget Day Rally",
        description="Broad index surge on policy news, volatility elevated but risk-on.",
        stock_return_pct=6.2,
        vix=19.0,
        elapsed_hours=2.0,
    ),
    "covid_liquidity_squeeze": Scenario(
        key="covid_liquidity_squeeze",
        label="COVID-19 Liquidity Squeeze (Mar 2020)",
        description="Multi-day extreme drawdown with a VIX-equivalent spike far outside normal regime bounds.",
        stock_return_pct=-23.0,
        vix=71.0,
        elapsed_hours=96.0,
    ),
}
