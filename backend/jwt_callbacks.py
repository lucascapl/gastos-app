from flask_jwt_extended import JWTManager
from .db import SessionLocal
from .models import User

def register_jwt_callbacks(jwt: JWTManager):
    @jwt.user_lookup_loader
    def user_lookup_callback(_jwt_header, jwt_data):
        username = jwt_data["sub"]  # identity=username
        s = SessionLocal()
        try:
            return s.query(User).filter_by(username=username).first()
        finally:
            s.close()
