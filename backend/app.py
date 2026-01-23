from flask import Flask
from flask_cors import CORS
from flask_smorest import Api

from .api.transactions import blp as transactions_blp
from .api.balance import blp as balance_blp
from .api.auth import blp as auth_blp

import os

from .extensions import jwt, bcrypt
from .db import Base, engine

def create_app():
    app = Flask(__name__)
    app.config["API_TITLE"] = "Gastos API"
    app.config["API_VERSION"] = "v1"
    app.config["OPENAPI_VERSION"] = "3.0.3"
    app.config["OPENAPI_URL_PREFIX"] = "/docs"
    app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "@super-secretKEY123")
    

    CORS(app)

    # extensions
    jwt.init_app(app)
    bcrypt.init_app(app)

    Base.metadata.create_all(bind=engine)

    api = Api(app)
    api.register_blueprint(transactions_blp)
    api.register_blueprint(balance_blp)
    api.register_blueprint(auth_blp)

    @app.get("/health")
    def health():
        return {"status": "ok"}

    return app

app = create_app()