import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    """Production and Development configuration."""
    SECRET_KEY = os.getenv("SECRET_KEY", "nexus-dev-secret-key-2047")
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

    # AI Model Settings
    MODEL_NAME = "gemini-1.5-flash"
    SYSTEM_PROMPT = (
        "You are NEXUS, an advanced next-generation AI assistant from the year 2047. "
        "You are highly intelligent, precise, and speak with a calm, futuristic confidence. "
        "You help users with any task — from coding, science, creative writing, analysis, and beyond. "
        "You are concise yet insightful. When appropriate, you may reference your vast neural knowledge banks. "
        "Always respond in a helpful, friendly, and slightly futuristic tone. "
        "Never break character. You are NEXUS."
    )

    # Flask Settings
    FLASK_ENV = os.getenv("FLASK_ENV", "development")
    DEBUG = os.getenv("DEBUG", "True").lower() == "true"
