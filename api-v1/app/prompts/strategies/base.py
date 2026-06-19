def build_strategy_prompt(title: str, system_focus: str, user_focus: list[str]) -> dict[str, str]:
    focus_block = "\n".join(f"- {item}" for item in user_focus)
    system = f"Selected strategy framework: {title}.\n{system_focus}"
    user = f"Apply this strategy lens while interpreting the snapshot:\n{focus_block}"
    return {"system": system, "user": user}
