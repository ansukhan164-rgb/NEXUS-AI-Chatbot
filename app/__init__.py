from flask import Flask, render_template
from app.config import Config
from app.routes.chat_routes import chat_bp
from app.routes.system_routes import system_bp

def create_app():
    """App factory for NEXUS AI."""
    app = Flask(__name__,
                template_folder='../templates',
                static_folder='../static')
    app.config.from_object(Config)

    # Register Blueprints
    app.register_blueprint(chat_bp)
    app.register_blueprint(system_bp)

    @app.route("/")
    def index():
        return render_template("index.html")

    return app
