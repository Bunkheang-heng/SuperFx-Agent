from app.prompts.strategies.base import build_strategy_prompt


STRATEGY_PROMPT = build_strategy_prompt(
    title="Breakout and Retest",
    system_focus=(
        "Look for clear breakout conditions, follow-through, and retest validation before committing. "
        "Avoid weak breakouts, late chases, and false expansion without acceptance."
    ),
    user_focus=[
        "Check whether price is breaking a meaningful range or structure level with convincing expansion",
        "Prefer continuation after breakout confirmation or a cleaner retest entry when available",
        "Be cautious if the breakout lacks momentum, closes back into the range, or shows immediate rejection",
        "Use stop entries for strong continuation and limit entries for orderly retests when appropriate",
        "Avoid forcing breakout trades when the market still looks trapped or indecisive",
    ],
)
