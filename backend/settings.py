import os
try:
    from dotenv import load_dotenv
    load_dotenv()  # garante leitura local
except Exception:
    pass

def _norm(s: str) -> str:
    return (s or "").strip()

# Dono do sistema (default "Lucas")
OWNER = _norm(os.getenv("USUARIO") or "Lucas")
