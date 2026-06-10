from app import create_app
from app.config import Config

app = create_app()

if __name__ == "__main__":
    print("\n╔══════════════════════════════════════╗")
    print("║       NEXUS AI — PRODUCTION OS        ║")
    print("╚══════════════════════════════════════╝")

    if not Config.GEMINI_API_KEY:
        print("⚠️  WARNING: GEMINI_API_KEY not found. AI services will be unavailable.\n")
    else:
        print("✅  AI Neural Link established.\n")

    app.run(debug=Config.DEBUG, host="0.0.0.0", port=5000)
