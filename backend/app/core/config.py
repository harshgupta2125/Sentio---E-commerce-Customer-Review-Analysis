from pydantic import BaseSettings

class Settings(BaseSettings):
    API_KEY: str
    DATABASE_URL: str
    SCRAPER_USER_AGENT: str = "SentioScraper/1.0"

    class Config:
        env_file = ".env"

settings = Settings()