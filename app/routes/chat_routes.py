from flask import Blueprint, request, jsonify
from app.services.ai_service import nexus_ai
import time

chat_bp = Blueprint('chat', __name__)

@chat_bp.route("/api/chat", methods=["POST"])
def chat():
    """Handles chat requests and returns AI responses."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Invalid request body."}), 400

        user_message = data.get("message", "").strip()
        history = data.get("history", [])

        if not user_message:
            return jsonify({"error": "Message cannot be empty."}), 400

        if len(user_message) > 10000:
            return jsonify({"error": "Message too long. Max 10,000 characters."}), 400

        # Get AI response via service
        reply = nexus_ai.get_response(user_message, history)

        return jsonify({
            "reply": reply,
            "timestamp": int(time.time() * 1000)
        })

    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        # In production, we would log the actual error 'e' to a file/monitoring service
        error_msg = str(e)
        if "API_KEY_INVALID" in error_msg or "invalid" in error_msg.lower():
            return jsonify({"error": "Invalid API key configuration."}), 401
        if "quota" in error_msg.lower() or "rate" in error_msg.lower():
            return jsonify({"error": "API rate limit reached. Please wait a moment."}), 429

        return jsonify({"error": f"Neural network error: {error_msg}"}), 500
