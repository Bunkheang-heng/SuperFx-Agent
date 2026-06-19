from app.prompts.strategies.base import build_strategy_prompt


STRATEGY_PROMPT = build_strategy_prompt(
    title="Support and Resistance",
    system_focus=(
        "Emphasize historically reactive price levels, rejection quality, breakout behavior, and retest logic. "
        "Be careful about entering directly into nearby opposing levels."
    ),
    user_focus=[
        "Identify the nearest meaningful support and resistance behavior from recent structure",
        "Check whether price is respecting, breaking, or retesting a level with confirmation",
        "Prefer trades with enough distance to the next opposing level for acceptable reward-to-risk",
        "Avoid low-quality signals where price is trapped between levels without clear resolution",
        "Use pending entries when a cleaner retest location is more logical than a market chase",
    ],
)
