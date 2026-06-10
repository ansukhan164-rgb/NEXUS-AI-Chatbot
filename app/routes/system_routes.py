from flask import Blueprint, jsonify
from app.config import Config

system_bp = Blueprint('system', __name__)

@system_bp.route("/api/health", methods=["GET"])
def health():
    """Checks system health and AI configuration status."""
    api_configured = bool(Config.GEMINI_API_KEY)
    return jsonify({
        "status": "online",
        "api_configured": api_configured,
        "model": Config.MODEL_NAME,
        "version": "NEXUS v3.0 (Production)"
    })
