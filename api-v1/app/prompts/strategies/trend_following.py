from app.prompts.strategies.base import build_strategy_prompt


STRATEGY_PROMPT = build_strategy_prompt(
    title="Trend Following",
    system_focus=(
        "Prioritize the dominant directional bias and continuation setups. "
        "Favor pullbacks, consolidations, and clean continuation structure instead of fading the trend prematurely."
    ),
    user_focus=[
        "Determine whether the recent structure and indicators favor bullish continuation, bearish continuation, or no clear trend",
        "Prefer pullback or continuation entries aligned with the dominant direction",
        "Treat countertrend ideas with skepticism unless the snapshot clearly shows trend failure",
        "Avoid buying exhausted vertical rallies or selling extended dumps without a better location",
        "Use stop or limit entries when they improve continuation execution quality",
    ],
)
