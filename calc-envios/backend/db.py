"""
Base de datos del backend.

SQLite con tres tablas: licencias, uso diario y tarifas propias del
cliente Premium. Todo con la biblioteca estándar de Python.
"""
import os
import secrets
import sqlite3
import time

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "envios.db")

# Límite del plan gratis. El Premium no tiene tope.
FREE_DAILY_LIMIT = 10

SCHEMA = """
CREATE TABLE IF NOT EXISTS licenses (
    key        TEXT PRIMARY KEY,
    email      TEXT,
    plan       TEXT NOT NULL DEFAULT 'premium',
    store_name TEXT,
    created_at TEXT NOT NULL,
    expires_at TEXT,
    active     INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS usage (
    client_id TEXT NOT NULL,
    day       TEXT NOT NULL,
    count     INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (client_id, day)
);

CREATE TABLE IF NOT EXISTS rates (
    license_key TEXT NOT NULL,
    city_id     TEXT NOT NULL,
    price_usd   REAL NOT NULL,
    updated_at  TEXT NOT NULL,
    PRIMARY KEY (license_key, city_id)
);
"""


def connect():
    """Abre una conexión nueva. Una por petición evita problemas de hilos."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init():
    with connect() as conn:
        conn.executescript(SCHEMA)


def today():
    return time.strftime("%Y-%m-%d")


# ---------- licencias ----------

def generate_key():
    """Llave con formato CALC-XXXX-XXXX-XXXX. Legible para dictarla por teléfono."""
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # sin I, O, 0, 1
    groups = []
    for _ in range(3):
        groups.append("".join(secrets.choice(alphabet) for _ in range(4)))
    return "CALC-" + "-".join(groups)


def issue_license(email=None, days=30, plan="premium", store_name=None):
    init()
    key = generate_key()
    expires = None
    if days:
        expires = time.strftime(
            "%Y-%m-%d", time.localtime(time.time() + days * 86400)
        )

    with connect() as conn:
        conn.execute(
            "INSERT INTO licenses (key, email, plan, store_name, created_at, expires_at)"
            " VALUES (?, ?, ?, ?, ?, ?)",
            (key, email, plan, store_name, today(), expires),
        )
    return {"key": key, "plan": plan, "expires_at": expires}


def find_license(key):
    if not key:
        return None
    with connect() as conn:
        row = conn.execute(
            "SELECT * FROM licenses WHERE key = ?", (key.strip().upper(),)
        ).fetchone()
    return dict(row) if row else None


def license_is_valid(license_row):
    """Activa y sin vencer."""
    if not license_row or not license_row.get("active"):
        return False
    expires = license_row.get("expires_at")
    if expires and expires < today():
        return False
    return True


def revoke_license(key):
    with connect() as conn:
        cur = conn.execute(
            "UPDATE licenses SET active = 0 WHERE key = ?", (key.strip().upper(),)
        )
    return cur.rowcount > 0


def list_licenses():
    with connect() as conn:
        rows = conn.execute(
            "SELECT * FROM licenses ORDER BY created_at DESC"
        ).fetchall()
    return [dict(r) for r in rows]


# ---------- uso diario ----------

def get_usage(client_id):
    """Cuántas consultas lleva hoy ese cliente."""
    with connect() as conn:
        row = conn.execute(
            "SELECT count FROM usage WHERE client_id = ? AND day = ?",
            (client_id, today()),
        ).fetchone()
    return row["count"] if row else 0


def bump_usage(client_id):
    with connect() as conn:
        conn.execute(
            "INSERT INTO usage (client_id, day, count) VALUES (?, ?, 1)"
            " ON CONFLICT(client_id, day) DO UPDATE SET count = count + 1",
            (client_id, today()),
        )
    return get_usage(client_id)


# ---------- tarifas propias del Premium ----------

def get_rates(license_key):
    with connect() as conn:
        rows = conn.execute(
            "SELECT city_id, price_usd, updated_at FROM rates WHERE license_key = ?"
            " ORDER BY city_id",
            (license_key,),
        ).fetchall()
    return [dict(r) for r in rows]


def set_rate(license_key, city_id, price_usd):
    with connect() as conn:
        conn.execute(
            "INSERT INTO rates (license_key, city_id, price_usd, updated_at)"
            " VALUES (?, ?, ?, ?)"
            " ON CONFLICT(license_key, city_id) DO UPDATE SET"
            " price_usd = excluded.price_usd, updated_at = excluded.updated_at",
            (license_key, city_id, float(price_usd), today()),
        )


def delete_rate(license_key, city_id):
    with connect() as conn:
        conn.execute(
            "DELETE FROM rates WHERE license_key = ? AND city_id = ?",
            (license_key, city_id),
        )