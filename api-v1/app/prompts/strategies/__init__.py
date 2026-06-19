from app.prompts.strategies.breakout_retest import STRATEGY_PROMPT as BREAKOUT_RETEST_STRATEGY_PROMPT
from app.prompts.strategies.ict import STRATEGY_PROMPT as ICT_STRATEGY_PROMPT
from app.prompts.strategies.none import STRATEGY_PROMPT as NONE_STRATEGY_PROMPT
from app.prompts.strategies.smc import STRATEGY_PROMPT as SMC_STRATEGY_PROMPT
from app.prompts.strategies.supply_demand import STRATEGY_PROMPT as SUPPLY_DEMAND_STRATEGY_PROMPT
from app.prompts.strategies.support_resistance import STRATEGY_PROMPT as SUPPORT_RESISTANCE_STRATEGY_PROMPT
from app.prompts.strategies.trend_following import STRATEGY_PROMPT as TREND_FOLLOWING_STRATEGY_PROMPT

STRATEGY_PROMPTS: dict[str, dict[str, str]] = {
    "none": NONE_STRATEGY_PROMPT,
    "smc": SMC_STRATEGY_PROMPT,
    "ict": ICT_STRATEGY_PROMPT,
    "supply_demand": SUPPLY_DEMAND_STRATEGY_PROMPT,
    "support_resistance": SUPPORT_RESISTANCE_STRATEGY_PROMPT,
    "trend_following": TREND_FOLLOWING_STRATEGY_PROMPT,
    "breakout_retest": BREAKOUT_RETEST_STRATEGY_PROMPT,
}

__all__ = ["STRATEGY_PROMPTS"]
