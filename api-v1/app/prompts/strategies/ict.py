from app.prompts.strategies.base import build_strategy_prompt


STRATEGY_PROMPT = build_strategy_prompt(
    title="ICT",
    system_focus=(
        "Think in terms of liquidity pools, dealing ranges, market structure shifts, fair value gaps, "
        "optimal trade entry logic, and session timing. "
        "Respect timing and location rather than forcing entries in the middle of a range."
    ),
    user_focus=[
        "Assess whether price is moving toward or away from nearby liquidity pools",
        "Use market structure shift plus displacement as confirmation, not just a single candle reaction",
        "Favor entries near discount arrays for longs and premium arrays for shorts",
        "Treat fair value gaps as context and entry refinement, not a standalone signal",
        "Pay attention to session behavior from the market context before committing to aggressive entries",
    ],
)
