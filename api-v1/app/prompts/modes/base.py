COMMON_OUTPUT_RULES = """Return two sections in this exact order:
1) ANALYSIS: short plain-text reasoning (no markdown tables)
2) FINAL_DECISION_JSON: one valid JSON object only with keys:
   action, confidence, lot_size, entry_price, stop_loss, take_profit, time_in_force,
   cancel_if_not_filled_minutes, reason"""


def build_mode_prompt(system_description: str, user_description: str, decision_rules: list[str]) -> dict[str, str]:
    rules_block = "\n".join(f"- {rule}" for rule in decision_rules)
    system = (
        f"{system_description}\n"
        "Keep reason concise but specific.\n"
        f"{COMMON_OUTPUT_RULES}"
    )
    user = (
        f"{user_description}\n"
        "Current execution environment:\n"
        "- provider is {provider}\n"
        "- model is {model}\n"
        "- symbol is {symbol}\n"
        "- timestamp is {timestamp}\n"
        "- reference price is {price}\n"
        "Decision rules:\n"
        f"{rules_block}\n\n"
        "Snapshot:\n"
        "{snapshot_json}"
    )
    return {"system": system, "user": user}
