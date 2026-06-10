import google.generativeai as genai
from app.config import Config

class AIService:
    """Service to handle interactions with the Gemini AI model."""
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(AIService, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return

        if not Config.GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY is not configured in environment variables.")

        try:
            genai.configure(api_key=Config.GEMINI_API_KEY)
            self.model = genai.GenerativeModel(
                model_name=Config.MODEL_NAME,
                system_instruction=Config.SYSTEM_PROMPT
            )
            self._initialized = True
        except Exception as e:
            raise RuntimeError(f"Failed to initialize Gemini AI: {str(e)}")

    def get_response(self, message: str, history: list):
        """Generates a response from the AI given a message and conversation history."""
        # Convert history to Gemini format
        chat_history = []
        for msg in history[-10:]:  # Reduced context window to 10 messages to avoid TPM rate limits
            role = "user" if msg.get("role") == "user" else "model"
            chat_history.append({
                "role": role,
                "parts": [msg.get("content", "")]
            })

        try:
            chat_session = self.model.start_chat(history=chat_history)
            response = chat_session.send_message(message)

            if not response.text:
                raise ValueError("NEXUS returned an empty response.")

            return response.text
        except Exception as e:
            raise e

# Global singleton instance
nexus_ai = AIService()
