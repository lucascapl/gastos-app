from flask_jwt_extended import get_jwt
from .extensions import jwt
from .db import SessionLocal
from .models import User


@jwt.user_lookup_loader
def user_lookup_callback(_jwt_header, jwt_data):
    user_id = int(jwt_data["sub"])  # sub vem como string
    db = SessionLocal()
    try:
        return db.get(User, user_id)
    finally:
        db.close()



@jwt.additional_claims_loader
def add_claims_to_access_token(identity):
    # opcional: informações extras no token
    return {"user_id": identity}
