from app.prompts.strategies.base import build_strategy_prompt


STRATEGY_PROMPT = build_strategy_prompt(
    title="Supply and Demand",
    system_focus=(
        "Focus on fresh supply and demand zones, reaction quality, imbalance, and whether price is revisiting "
        "a meaningful area with enough room to react. "
        "Prefer better-location entries over chasing away from zones."
    ),
    user_focus=[
        "Identify whether price is approaching a likely demand or supply zone from the recent candles",
        "Prefer zones that look fresher and less mitigated over noisy repeatedly-tested areas",
        "Check if the zone aligns with momentum slowdown, rejection, or imbalance behavior",
        "Favor limit-style or patient entries when a better location is available near the zone",
        "Avoid entering directly into nearby opposing zones with poor reward-to-risk",
    ],
)
