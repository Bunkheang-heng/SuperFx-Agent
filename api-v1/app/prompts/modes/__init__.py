from app.prompts.modes.aggressive import MODE_PROMPT as AGGRESSIVE_MODE_PROMPT
from app.prompts.modes.auto import MODE_PROMPT as AUTO_MODE_PROMPT
from app.prompts.modes.breakout import MODE_PROMPT as BREAKOUT_MODE_PROMPT
from app.prompts.modes.day_trader import MODE_PROMPT as DAY_TRADER_MODE_PROMPT
from app.prompts.modes.mean_reversion import MODE_PROMPT as MEAN_REVERSION_MODE_PROMPT
from app.prompts.modes.scalper import MODE_PROMPT as SCALPER_MODE_PROMPT
from app.prompts.modes.swing_trader import MODE_PROMPT as SWING_TRADER_MODE_PROMPT

MODE_PROMPTS: dict[str, dict[str, str]] = {
    "auto": AUTO_MODE_PROMPT,
    "aggressive": AGGRESSIVE_MODE_PROMPT,
    "scalper": SCALPER_MODE_PROMPT,
    "day_trader": DAY_TRADER_MODE_PROMPT,
    "swing_trader": SWING_TRADER_MODE_PROMPT,
    "breakout": BREAKOUT_MODE_PROMPT,
    "mean_reversion": MEAN_REVERSION_MODE_PROMPT,
}

__all__ = ["MODE_PROMPTS"]
