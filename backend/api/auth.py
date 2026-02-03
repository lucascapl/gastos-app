from flask_smorest import Blueprint
from flask import request, jsonify

from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity

from ..db import SessionLocal
from ..models import User


blp = Blueprint(
    "auth", 
    __name__, 
    description="Autenticacao e autorizacao",
    url_prefix="/auth"
)

@blp.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""

    if not username or not password:
        return jsonify({"message": "username e password são obrigatórios"}), 400

    db = SessionLocal()
    try:
        exists = db.query(User).filter(User.username == username).one_or_none()
        if exists:
            return jsonify({"message": "username já existe"}), 409

        user = User(username=username)
        user.set_password(password)

        db.add(user)
        db.commit()
        db.refresh(user)

        # já retorna token pra facilitar o fluxo do front
        token = create_access_token(identity=user.username)
        return jsonify({"id": user.id, "username": user.username, "access_token": token}), 201
    finally:
        db.close()

@blp.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == username).one_or_none()
        if not user or not user.check_password(password):
            return jsonify({"message": "Wrong username or password"}), 401

        access_token = create_access_token(identity=(user.username))
        return jsonify({"access_token": access_token, "user": {"id": user.id, "username": user.username}}), 200
    finally:
        db.close()

@blp.route("/me", methods=["GET"])
@jwt_required()
def me():
    username = get_jwt_identity()
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == username).one_or_none()
        if not user:
            return jsonify({"message": "Usuário não encontrado"}), 404
        return jsonify({"id": user.id, "username": user.username}), 200
    finally:
        db.close()
