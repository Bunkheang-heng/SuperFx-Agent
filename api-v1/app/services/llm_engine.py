import json
from typing import Any

import requests

from app.core.config import get_settings
from app.prompts.templates import get_combined_system_prompt, get_combined_user_prompt_template
from app.prompts.prop_firm import format_user_context_block
from app.schemas.api_models import TradingMode, TradingStrategy
from app.schemas.prop_firm import PropFirmRules
from app.schemas.decision import TradeDecision


class LLMEngine:
    SUPPORTED_PROVIDERS = ("openai", "gemini", "sealion")

    def __init__(self) -> None:
        self.settings = get_settings()

    def provider_catalog(self) -> list[dict]:
        s = self.settings
        return [
            {
                "provider": "openai",
                "default_model": s.openai_model,
                "configured": bool(s.openai_api_key),
            },
            {
                "provider": "gemini",
                "default_model": s.gemini_model,
                "configured": bool(s.gemini_api_key),
            },
            {
                "provider": "sealion",
                "default_model": s.sealion_model,
                "configured": bool(s.sealion_api_key),
            },
        ]

    def resolve_provider(self, requested_provider: str | None) -> str:
        if not requested_provider:
            raise ValueError("Provider is required. Choose one of: openai, gemini, sealion.")
        provider = requested_provider.strip().lower()
        if provider not in self.SUPPORTED_PROVIDERS:
            raise ValueError(
                f"Unsupported provider: {provider}. "
                f"Supported: {', '.join(self.SUPPORTED_PROVIDERS)}"
            )
        return provider

    def resolve_model(self, provider: str, requested_model: str | None) -> str:
        if requested_model:
            return requested_model
        s = self.settings
        defaults = {
            "openai": s.openai_model,
            "gemini": s.gemini_model,
            "sealion": s.sealion_model,
        }
        return defaults[provider]

    def build_prompt(
        self,
        snapshot: dict[str, Any],
        provider: str,
        model: str,
        trading_mode: TradingMode,
        trading_strategy: TradingStrategy,
        user_prompt: str | None = None,
        prop_firm_rules: PropFirmRules | None = None,
    ) -> str:
        def _json_default(value: Any) -> Any:
            if hasattr(value, "item"):
                try:
                    return value.item()
                except Exception:
                    pass
            return str(value)

        values = {
            "provider": provider,
            "model": model,
            "strategy": trading_strategy,
            "symbol": snapshot.get("symbol", "UNKNOWN"),
            "price": snapshot.get("price")
            or snapshot.get("tick", {}).get("ask")
            or snapshot.get("tick", {}).get("bid")
            or "UNKNOWN",
            "timestamp": snapshot.get("timestamp", "UNKNOWN"),
            "snapshot_json": json.dumps(snapshot, separators=(",", ":"), default=_json_default),
        }
        template = get_combined_user_prompt_template(trading_mode, trading_strategy)
        try:
            prompt = template.format(**values)
        except KeyError as exc:
            missing = str(exc).strip("'")
            raise ValueError(
                f"Invalid trading prompt placeholder '{missing}'. "
                "Allowed placeholders: {provider}, {model}, {strategy}, {symbol}, {price}, {timestamp}, {snapshot_json}."
            ) from exc
        extra_context = format_user_context_block(user_prompt, prop_firm_rules)
        if extra_context:
            prompt = f"{prompt}\n\n{extra_context}"
        return prompt

    def decide(
        self,
        snapshot: dict[str, Any],
        provider: str,
        model: str | None = None,
        trading_mode: TradingMode = "auto",
        trading_strategy: TradingStrategy = "none",
        user_prompt: str | None = None,
        prop_firm_rules: PropFirmRules | None = None,
        stream_handler: Any | None = None,
        force_stream: bool = False,
    ) -> tuple[TradeDecision, str, str]:
        selected_provider = self.resolve_provider(provider)
        selected_model = self.resolve_model(selected_provider, model)
        prompt = self.build_prompt(
            snapshot,
            selected_provider,
            selected_model,
            trading_mode,
            trading_strategy,
            user_prompt=user_prompt,
            prop_firm_rules=prop_firm_rules,
        )
        should_stream = force_stream or stream_handler is not None

        if selected_provider in {"openai", "sealion"}:
            headers, url = self._openai_compatible_transport(selected_provider)
            payload = self._openai_compatible_payload(
                prompt,
                selected_model,
                system_prompt=get_combined_system_prompt(trading_mode, trading_strategy),
            )
            if should_stream:
                raw_response = self._request_with_streaming(
                    url=url,
                    headers=headers,
                    payload=payload,
                    stream_handler=stream_handler,
                )
                if not raw_response.strip():
                    raw_response = self._request_once(url=url, headers=headers, payload=payload)
            else:
                raw_response = self._request_once(url=url, headers=headers, payload=payload)
        elif selected_provider == "gemini":
            raw_response = self._complete_gemini(
                prompt,
                selected_model,
                system_prompt=get_combined_system_prompt(trading_mode, trading_strategy),
                stream_handler=stream_handler,
            )
        else:
            raise ValueError(f"Unsupported provider: {selected_provider}")

        parsed = json.loads(self._extract_json_object(raw_response))
        decision = self._validate_decision_payload(
            parsed,
            symbol=str(snapshot.get("symbol", "UNKNOWN")),
            trading_mode=trading_mode,
        )
        return decision, prompt, raw_response

    def ask_position_insight(
        self,
        context: dict[str, Any],
        question: str,
        provider: str,
        model: str | None = None,
        stream_handler: Any | None = None,
    ) -> tuple[str, str, str]:
        selected_provider = self.resolve_provider(provider)
        selected_model = self.resolve_model(selected_provider, model)

        def _json_default(value: Any) -> Any:
            if hasattr(value, "item"):
                try:
                    return value.item()
                except Exception:
                    pass
            return str(value)

        system_prompt = (
            "You are a professional trading assistant reviewing currently open MT5 positions and their live market context. "
            "Answer the user's question using only the supplied live position and market context. "
            "Be concise, practical, and risk-aware. "
            "Do not invent prices or positions that are not present in the context. "
            "Do not place trades or pretend an order has been executed. "
            "Focus on explaining exposure, risk, position quality, P/L structure, market backdrop, and what the user should watch."
        )
        prompt = (
            "Review the following live MT5 position and market context and answer the user's question.\n\n"
            f"User question:\n{question.strip()}\n\n"
            "Live position and market context JSON:\n"
            f"{json.dumps(context, indent=2, default=_json_default)}\n\n"
            "Write a direct helpful answer with short paragraphs or bullet points if useful."
        )

        answer = self.complete_text(
            provider=selected_provider,
            prompt=prompt,
            model=selected_model,
            system_prompt=system_prompt,
            stream_handler=stream_handler,
        )
        return answer, prompt, selected_model

    def complete_text(
        self,
        provider: str,
        prompt: str,
        model: str | None = None,
        system_prompt: str = "You are a helpful trading assistant.",
        stream_handler: Any | None = None,
    ) -> str:
        selected_provider = self.resolve_provider(provider)
        selected_model = self.resolve_model(selected_provider, model)

        if selected_provider in {"openai", "sealion"}:
            headers, url = self._openai_compatible_transport(selected_provider)
            payload = self._openai_compatible_payload(prompt, selected_model, system_prompt=system_prompt)
            if stream_handler is not None:
                streamed = self._request_with_streaming(
                    url=url,
                    headers=headers,
                    payload=payload,
                    stream_handler=stream_handler,
                )
                if streamed.strip():
                    return streamed
            return self._request_once(url=url, headers=headers, payload=payload)
        if selected_provider == "gemini":
            return self._complete_gemini(
                prompt,
                selected_model,
                system_prompt=system_prompt,
                stream_handler=stream_handler,
            )
        raise ValueError(f"Unsupported provider: {selected_provider}")

    def _openai_compatible_transport(self, provider: str) -> tuple[dict[str, str], str]:
        if provider == "openai":
            api_key = self.settings.openai_api_key
            url = self.settings.openai_url_base
        elif provider == "sealion":
            api_key = self.settings.sealion_api_key
            url = self.settings.sealion_url_base
        else:
            raise ValueError(f"Unsupported provider settings lookup: {provider}")

        if not api_key:
            raise ValueError(f"{provider} API key is not configured.")

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        }
        return headers, url

    OPENAI_COMPATIBLE_DEFAULT_URLS = {
        "openai": "https://api.openai.com/v1/chat/completions",
        "sealion": "https://api.sea-lion.ai/v1/chat/completions",
    }

    def complete_with_credentials(
        self,
        provider: str,
        api_key: str,
        model: str,
        prompt: str,
        system_prompt: str = "You are a helpful trading assistant.",
        base_url: str | None = None,
        stream_handler: Any | None = None,
        temperature: float = 0.1,
        max_tokens: int = 2200,
    ) -> str:
        provider_key = (provider or "").strip().lower()
        if not api_key:
            raise ValueError(f"API key is required for provider '{provider_key}'.")
        if not model:
            raise ValueError(f"Model id is required for provider '{provider_key}'.")

        if provider_key in {"openai", "sealion", "openai_compatible"}:
            url = (
                base_url.strip()
                if isinstance(base_url, str) and base_url.strip()
                else self.OPENAI_COMPATIBLE_DEFAULT_URLS.get(provider_key)
            )
            if not url:
                raise ValueError(
                    f"Provider '{provider_key}' requires base_url (OpenAI-compatible chat-completions endpoint)."
                )
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Accept": "application/json",
                "Content-Type": "application/json",
            }
            payload = {
                "model": model,
                "temperature": temperature,
                "max_completion_tokens": max_tokens,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt},
                ],
            }
            if stream_handler is not None:
                streamed = self._request_with_streaming(
                    url=url,
                    headers=headers,
                    payload=payload,
                    stream_handler=stream_handler,
                )
                if streamed.strip():
                    return streamed
            return self._request_once(url=url, headers=headers, payload=payload)

        if provider_key == "gemini":
            url = (
                base_url.strip()
                if isinstance(base_url, str) and base_url.strip()
                else f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
            )
            url = url + ("&" if "?" in url else "?") + f"key={api_key}"
            payload = {
                "contents": [{"parts": [{"text": f"{system_prompt}\n\n{prompt}"}]}],
                "generationConfig": {"temperature": temperature},
            }
            response = requests.post(
                url,
                headers={"Content-Type": "application/json"},
                json=payload,
                timeout=120,
            )
            if response.status_code >= 400:
                raise RuntimeError(f"Provider API error [{response.status_code}]: {response.text}")
            data = response.json()
            text = data["candidates"][0]["content"]["parts"][0]["text"]
            if stream_handler is not None:
                for token in text.split():
                    stream_handler(token + " ")
            return text

        raise ValueError(f"Unsupported provider: {provider_key}")

    def _openai_compatible_payload(self, prompt: str, model: str, system_prompt: str) -> dict[str, Any]:
        return {
            "model": model,
            "temperature": 0.1,
            "max_completion_tokens": 2200,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt},
            ],
        }

    def _request_once(self, url: str, headers: dict[str, str], payload: dict[str, Any]) -> str:
        response = requests.post(url, headers=headers, json=payload, timeout=60)
        if response.status_code >= 400:
            raise RuntimeError(f"Provider API error [{response.status_code}]: {response.text}")
        completion = response.json()
        content = completion.get("choices", [{}])[0].get("message", {}).get("content", "{}")
        if isinstance(content, str):
            return content
        return json.dumps(content)

    def _request_with_streaming(
        self,
        url: str,
        headers: dict[str, str],
        payload: dict[str, Any],
        stream_handler: Any | None = None,
    ) -> str:
        streamed_text_parts: list[str] = []
        with requests.post(
            url,
            headers=headers,
            json={**payload, "stream": True},
            timeout=120,
            stream=True,
        ) as response:
            if response.status_code >= 400:
                raise RuntimeError(f"Provider API error [{response.status_code}]: {response.text}")
            for raw_line in response.iter_lines(decode_unicode=True):
                if not raw_line:
                    continue
                line = raw_line.strip()
                if not line.startswith("data:"):
                    continue
                data = line[5:].strip()
                if data == "[DONE]":
                    break
                try:
                    chunk = json.loads(data)
                except json.JSONDecodeError:
                    continue
                delta = chunk.get("choices", [{}])[0].get("delta", {}).get("content")
                if isinstance(delta, str) and delta:
                    streamed_text_parts.append(delta)
                    if stream_handler is not None:
                        stream_handler(delta)
        return "".join(streamed_text_parts)

    def _complete_gemini(
        self,
        prompt: str,
        model: str,
        system_prompt: str,
        stream_handler: Any | None = None,
    ) -> str:
        if not self.settings.gemini_api_key:
            raise ValueError("gemini API key is not configured.")
        url = (
            self.settings.gemini_url_base
            + ("&" if "?" in self.settings.gemini_url_base else "?")
            + f"key={self.settings.gemini_api_key}"
        )
        payload = {
            "contents": [{"parts": [{"text": f"{system_prompt}\n\n{prompt}"}]}],
            "generationConfig": {"temperature": 0.1},
        }
        response = requests.post(
            url,
            headers={"Content-Type": "application/json"},
            json=payload,
            timeout=60,
        )
        response.raise_for_status()
        data = response.json()
        text = data["candidates"][0]["content"]["parts"][0]["text"]
        if stream_handler is not None:
            for token in text.split():
                stream_handler(token + " ")
        return text

    def _extract_json_object(self, content: str, marker: str = "FINAL_DECISION_JSON") -> str:
        content = content.strip()
        marker_index = content.rfind(marker)
        if marker_index >= 0:
            segment = content[marker_index + len(marker) :].lstrip("\n\r \t")
            if segment.startswith("```"):
                nl = segment.find("\n")
                segment = segment[nl + 1 :] if nl != -1 else ""
        else:
            segment = content

        start = segment.find("{")
        if start != -1:
            depth = 0
            in_string = False
            escaped = False
            for idx in range(start, len(segment)):
                ch = segment[idx]
                if in_string:
                    if escaped:
                        escaped = False
                    elif ch == "\\":
                        escaped = True
                    elif ch == '"':
                        in_string = False
                    continue

                if ch == '"':
                    in_string = True
                elif ch == "{":
                    depth += 1
                elif ch == "}":
                    depth -= 1
                    if depth == 0:
                        candidate = segment[start : idx + 1].rstrip()
                        json.loads(candidate)
                        return candidate

        decoder = json.JSONDecoder()
        for idx in range(len(segment) - 1, -1, -1):
            if segment[idx] != "{":
                continue
            try:
                obj, end = decoder.raw_decode(segment[idx:])
            except json.JSONDecodeError:
                continue
            if isinstance(obj, dict):
                return segment[idx : idx + end].strip()

        raise ValueError("Model output does not contain a valid JSON decision object.")

    def _validate_decision_payload(self, payload: dict[str, Any], symbol: str, trading_mode: TradingMode) -> TradeDecision:
        required = {
            "action",
            "confidence",
            "lot_size",
            "entry_price",
            "stop_loss",
            "take_profit",
            "time_in_force",
            "cancel_if_not_filled_minutes",
            "reason",
        }
        missing = required - set(payload)
        if missing:
            raise ValueError(f"Missing decision fields: {sorted(missing)}")

        action = str(payload["action"]).strip().upper()
        allowed_actions = {"HOLD", "BUY", "SELL", "BUY_LIMIT", "SELL_LIMIT", "BUY_STOP", "SELL_STOP"}
        if action not in allowed_actions:
            raise ValueError(f"action must be one of {sorted(allowed_actions)}")
        if trading_mode == "aggressive" and action not in {"BUY", "SELL"}:
            raise ValueError("aggressive mode requires action BUY or SELL")

        confidence = float(payload["confidence"])
        if not 0.0 <= confidence <= 1.0:
            raise ValueError("confidence must be between 0 and 1")

        lot_size = float(payload["lot_size"])
        if action == "HOLD":
            if lot_size != 0:
                lot_size = 0.0
        elif lot_size <= 0:
            raise ValueError("lot_size must be > 0 for trade actions")

        entry_price = self._optional_float(payload["entry_price"], "entry_price")
        stop_loss = self._optional_float(payload["stop_loss"], "stop_loss")
        take_profit = self._optional_float(payload["take_profit"], "take_profit")
        time_in_force = str(payload["time_in_force"]).strip().lower()
        if time_in_force not in {"gtc", "day"}:
            raise ValueError("time_in_force must be 'gtc' or 'day'")
        cancel_if_not_filled_minutes = self._optional_int(
            payload["cancel_if_not_filled_minutes"], "cancel_if_not_filled_minutes"
        )
        reason = str(payload["reason"]).strip()
        if not reason:
            raise ValueError("reason must be non-empty")

        pending_actions = {"BUY_LIMIT", "SELL_LIMIT", "BUY_STOP", "SELL_STOP"}
        market_actions = {"BUY", "SELL"}
        if action in pending_actions and entry_price is None:
            raise ValueError("entry_price is required for pending orders")
        if action in market_actions and entry_price is not None:
            raise ValueError("entry_price must be null for market orders")
        if trading_mode == "aggressive" and action not in market_actions:
            raise ValueError("aggressive mode only allows immediate market orders")
        if action == "HOLD":
            entry_price = None
            stop_loss = None
            take_profit = None
            cancel_if_not_filled_minutes = None
        elif action in market_actions:
            cancel_if_not_filled_minutes = None

        return TradeDecision(
            symbol=symbol,
            action=action.lower(),
            confidence=confidence,
            lot_size=lot_size,
            entry_price=entry_price,
            stop_loss=stop_loss,
            take_profit=take_profit,
            time_in_force=time_in_force,
            cancel_if_not_filled_minutes=cancel_if_not_filled_minutes,
            reason=reason[:2000],
        )

    def _optional_float(self, value: Any, field_name: str) -> float | None:
        if value is None:
            return None
        try:
            return float(value)
        except (TypeError, ValueError) as exc:
            raise ValueError(f"{field_name} must be a number or null") from exc

    def _optional_int(self, value: Any, field_name: str) -> int | None:
        if value is None:
            return None
        try:
            return int(value)
        except (TypeError, ValueError) as exc:
            raise ValueError(f"{field_name} must be an integer or null") from exc
