"""Configuration for video editor."""
from pydantic_settings import BaseSettings


class VideoEditorSettings(BaseSettings):
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    output_dir: str = "outputs/video"
    default_resolution: int = 1080
    default_format: str = "mp4"
    caption_font: str = "Arial"
    caption_font_size_pct: float = 0.05

    model_config = {"env_prefix": "", "env_file": ".env"}


settings = VideoEditorSettings()
