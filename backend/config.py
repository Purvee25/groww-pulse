from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql://localhost/groww_pulse"
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 10080  # 7 days
    frontend_origin: str = "http://localhost:5173"


settings = Settings()
