from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://postgres:postgres@db:5432/conflict_monitor"
    telegram_api_id: int = 0
    telegram_api_hash: str = ""
    telegram_phone: str = ""
    anthropic_api_key: str = ""
    telegram_channels: str = ""  # comma-separated channel usernames

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
