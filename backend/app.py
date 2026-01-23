from flask import Flask
from flask_cors import CORS
from flask_smorest import Api
from .api.transactions import blp as transactions_blp
from .api.balance import blp as balance_blp
from .api.auth import blp as auth_blp
import os


from flask_jwt_extended import JWTManager

# Setup the Flask-JWT-Extended extension



def create_app():
    app = Flask(__name__)
    app.config["API_TITLE"] = "Gastos API"
    app.config["API_VERSION"] = "v1"
    app.config["OPENAPI_VERSION"] = "3.0.3"
    app.config["OPENAPI_URL_PREFIX"] = "/docs"

    app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "@super-secretKEY123")
    jwt = JWTManager(app)

    CORS(app)
    api = Api(app)
    api.register_blueprint(transactions_blp)
    api.register_blueprint(balance_blp)
    api.register_blueprint(auth_blp)

    @app.get("/health")
    def health():
        return {"status": "ok"}

    return app

app = create_app()
