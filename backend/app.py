from flask import Flask
from flask_cors import CORS
from flask_smorest import Api
from .api.transactions import blp as transactions_blp

def create_app():
    app = Flask(__name__)
    app.config["API_TITLE"] = "Gastos API"
    app.config["API_VERSION"] = "v1"
    app.config["OPENAPI_VERSION"] = "3.0.3"
    app.config["OPENAPI_URL_PREFIX"] = "/docs"
    CORS(app)
    api = Api(app)
    api.register_blueprint(transactions_blp)

    @app.get("/health")
    def health():
        return {"status": "ok"}

    return app

app = create_app()
