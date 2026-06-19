from app.prompts.modes import MODE_PROMPTS
from app.prompts.strategies import STRATEGY_PROMPTS


def get_mode_system_prompt(trading_mode: str) -> str:
    return MODE_PROMPTS.get(trading_mode, MODE_PROMPTS["auto"])["system"]


def get_mode_user_prompt_template(trading_mode: str) -> str:
    return MODE_PROMPTS.get(trading_mode, MODE_PROMPTS["auto"])["user"]


def get_strategy_system_prompt(trading_strategy: str) -> str:
    return STRATEGY_PROMPTS.get(trading_strategy, STRATEGY_PROMPTS["none"])["system"]


def get_strategy_user_overlay(trading_strategy: str) -> str:
    return STRATEGY_PROMPTS.get(trading_strategy, STRATEGY_PROMPTS["none"])["user"]


def get_combined_system_prompt(trading_mode: str, trading_strategy: str) -> str:
    mode_system = get_mode_system_prompt(trading_mode)
    strategy_system = get_strategy_system_prompt(trading_strategy).strip()
    if not strategy_system:
        return mode_system
    return f"{mode_system}\n\n{strategy_system}"


def get_combined_user_prompt_template(trading_mode: str, trading_strategy: str) -> str:
    mode_user = get_mode_user_prompt_template(trading_mode)
    strategy_user = get_strategy_user_overlay(trading_strategy).strip()
    if not strategy_user:
        return mode_user
    return f"{mode_user}\n\nSelected strategy framework:\n{strategy_user}"


__all__ = [
    "MODE_PROMPTS",
    "STRATEGY_PROMPTS",
    "get_mode_system_prompt",
    "get_mode_user_prompt_template",
    "get_strategy_system_prompt",
    "get_strategy_user_overlay",
    "get_combined_system_prompt",
    "get_combined_user_prompt_template",
]
