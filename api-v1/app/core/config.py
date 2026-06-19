from functools import lru_cache
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "ThinkTrade API"
    app_env: str = "development"
    app_host: str = "127.0.0.1"
    app_port: int = 8000

    mt5_demo_only: bool = True
    mt5_login: str | None = None
    mt5_password: str | None = None
    mt5_server: str | None = None
    trade_timeframe: str = "M5"
    candle_count: int = Field(default=50, ge=20, le=500)
    fixed_lot_size: float = Field(default=0.01, gt=0.0, le=100.0)
    use_model_lot_size: bool = True
    max_spread_points: int = Field(default=100, ge=0)
    max_slippage_points: int = Field(default=20, ge=0)
    confidence_threshold: float = Field(default=0.0, ge=0.0, le=1.0)
    one_position_only: bool = True
    allow_reversal: bool = False
    poll_interval_seconds: int = Field(default=2, ge=1, le=60)

    sealion_api_key: str | None = None
    sealion_model: str = "aisingapore/Llama-SEA-LION-v3.5-70B-R"
    sealion_url_base: str = "https://api.sea-lion.ai/v1/chat/completions"
    openai_api_key: str | None = None
    openai_model: str = "gpt-4o-mini"
    openai_url_base: str = "https://api.openai.com/v1/chat/completions"
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-2.5-flash"
    gemini_url_base: str = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        "gemini-2.5-flash:generateContent"
    )
    log_dir: str = "logs"
    snapshot_limit: int = Field(default=100, ge=1, le=5000)
    database_url: str = "sqlite:///./data/thinktrade.db"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
