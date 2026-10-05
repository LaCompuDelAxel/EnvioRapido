"""
Servidor de la calculadora de envíos.

Hace dos cosas:
  1. Sirve la página web (mismos archivos del proyecto).
  2. Expone la API que maneja el plan gratis, las licencias premium y
     las tarifas propias del vendedor.

Solo biblioteca estándar. Se corre con:
    python backend/server.py

Nota sobre seguridad: este servidor sirve la API sin autenticación de por
sí. Las licencias se validan contra la base de datos, no contra el
navegador, así que un Premium no se puede falsear desde el cliente. Pero
para producción real hay que ponerlo detrás de HTTPS.
"""
import html
import json
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import db  # noqa: E402

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

CONTENT_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".webmanifest": "application/manifest+json",
}

# Funciones que puede (__PREMIUM__ = ..., etc). El front las lee para
# ocultar lo que el usuario no tiene, pero el cálculo real se valida acá.
PREMIUM_FEATURES = ["unlimited_queries", "own_rates", "custom_logo", "no_ads"]


class Handler(BaseHTTPRequestHandler):
    # ---------- utilidades ----------

    def send_json(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_cors()
        self.end_headers()
        self.wfile.write(body)

    def send_cors(self):
        """Permite que la página en GitHub Pages llame a esta API.

        Pages sirve el HTML y la API vive en otro dominio, así que sin esto
        el navegador bloquea la respuesta. El origins '*' es aceptable acá
        porque no usamos cookies: la llave viaja en el cuerpo del pedido.
        """
        origin = self.headers.get("Origin")
        if origin:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        else:
            self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        """Respuesta al sondeo que hace el navegador antes del POST."""
        self.send_response(204)
        self.send_cors()
        self.send_header("Content-Length", "0")
        self.end_headers()

    def read_json(self):
        length = int(self.headers.get("Content-Length") or 0)
        if not length:
            return {}
        try:
            return json.loads(self.rfile.read(length).decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            return {}

    def client_id(self, body):
        """Identificador del cliente para contar uso.

        El Premium manda su llave. El plan gratis usa un identificador
        anónimo que el navegador guarda en localStorage.
        """
        key = (body.get("key") or "").strip().upper()
        license_row = db.find_license(key)

        if db.license_is_valid(license_row):
            return ("license:" + license_row["key"], license_row)

        return ("anon:" + (body.get("clientId") or "desconocido"), None)

    def features_for(self, license_row):
        if db.license_is_valid(license_row):
            return PREMIUM_FEATURES
        return []

    # ---------- API ----------

    def handle_api(self, path, query):
        if path == "/api/plan":
            return self.api_plan()

        if path == "/api/consume":
            return self.api_consume()

        if path == "/api/activate":
            return self.api_activate()

        if path == "/api/rates":
            return self.api_rates(query)

        # Cualquier otra ruta de API no existe.
        return self.send_json({"error": "Ruta no encontrada"}, 404)

    def api_plan(self):
        """Consulta si una llave es válida y qué le corresponde."""
        body = self.read_json()
        key = (body.get("key") or "").strip().upper()
        license_row = db.find_license(key)

        if not db.license_is_valid(license_row):
            return self.send_json({
                "plan": "free",
                "features": [],
                "limit": db.FREE_DAILY_LIMIT,
            })

        client = "license:" + license_row["key"]
        return self.send_json({
            "plan": license_row["plan"],
            "features": PREMIUM_FEATURES,
            "used": db.get_usage(client),
            "limit": None,
            "expiresAt": license_row.get("expires_at"),
            "storeName": license_row.get("store_name"),
        })

    def api_consume(self):
        """Suma una consulta y devuelve si se puede seguir.

        Acá es donde se aplica el límite de verdad: si el plan gratis
        ya gastó sus 10 consultas del día, el cálculo se rechaza.
        """
        body = self.read_json()
        client, license_row = self.client_id(body)

        if license_row:
            used = db.bump_usage(client)
            return self.send_json({
                "allowed": True,
                "used": used,
                "limit": None,
                "plan": license_row["plan"],
                "features": PREMIUM_FEATURES,
            })

        used = db.get_usage(client)

        # Ya gastó el cupo: no sumamos más, solo avisamos.
        if used >= db.FREE_DAILY_LIMIT:
            return self.send_json({
                "allowed": False,
                "used": used,
                "limit": db.FREE_DAILY_LIMIT,
                "plan": "free",
                "features": [],
                "reason": "limite_diario",
            }, 429)

        used = db.bump_usage(client)
        return self.send_json({
            "allowed": True,
            "used": used,
            "limit": db.FREE_DAILY_LIMIT,
            "remaining": db.FREE_DAILY_LIMIT - used,
            "plan": "free",
            "features": [],
        })

    def api_activate(self):
        """Valida una llave. No la crea: eso lo hace admin.py."""
        body = self.read_json()
        license_row = db.find_license((body.get("key") or "").strip().upper())

        if not db.license_is_valid(license_row):
            return self.send_json({
                "ok": False,
                "error": "Llave inválida, vencida o cancelada.",
            }, 403)

        return self.send_json({
            "ok": True,
            "plan": license_row["plan"],
            "expiresAt": license_row.get("expires_at"),
            "features": PREMIUM_FEATURES,
        })

    def api_rates(self, query):
        """Tarifas propias del Premium: las del delivery de cada cliente."""
        # Los datos pueden venir en el cuerpo o en la query, según el cliente.
        body = self.read_json()
        key = (body.get("key") or query.get("key", [""])[0]).strip().upper()
        license_row = db.find_license(key)

        if not db.license_is_valid(license_row):
            return self.send_json({"error": "Se requiere plan Premium."}, 403)

        action = body.get("action", "list")

        if action == "list":
            return self.send_json({
                "rates": db.get_rates(license_row["key"]),
            })

        if action == "set":
            city_id = body.get("cityId")
            price = body.get("price")
            if not city_id or price is None or float(price) <= 0:
                return self.send_json({"error": "Falta ciudad o precio."}, 400)
            db.set_rate(license_row["key"], city_id, float(price))
            return self.send_json({
                "ok": True,
                "rates": db.get_rates(license_row["key"]),
            })

        if action == "delete":
            db.delete_rate(license_row["key"], body.get("cityId"))
            return self.send_json({
                "ok": True,
                "rates": db.get_rates(license_row["key"]),
            })

        return self.send_json({"error": "Acción desconocida."}, 400)

    def not_found(self, requested):
        """404 que explica qué hacer, en vez del texto genérico de Python."""
        body = NOT_FOUND_HTML.replace("__URL__", html.escape(requested)).encode("utf-8")
        self.send_response(404)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_cors()
        self.end_headers()
        self.wfile.write(body)

    # ---------- archivos estáticos ----------

    def serve_static(self, path):
        if path == "/":
            path = "/index.html"

        # No dejamos salir de la carpeta del proyecto.
        full = os.path.normpath(os.path.join(BASE_DIR, path.lstrip("/")))
        if not full.startswith(BASE_DIR):
            return self.send_error(403, "Prohibido")

        if not os.path.isfile(full):
            return self.not_found(path)

        with open(full, "rb") as handle:
            body = handle.read()

        ext = os.path.splitext(full)[1].lower()
        self.send_response(200)
        self.send_header("Content-Type", CONTENT_TYPES.get(ext, "application/octet-stream"))
        self.send_header("Content-Length", str(len(body)))
        # Sin cache para que el dueño vea los cambios al recargar.
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(body)

    # ---------- ruteo ----------

    def do_GET(self):
        path, _, raw_query = self.path.partition("?")
        if path.startswith("/api/"):
            from urllib.parse import parse_qs
            return self.handle_api(path, parse_qs(raw_query))
        return self.serve_static(path)

    def do_POST(self):
        path, _, _ = self.path.partition("?")
        if path.startswith("/api/"):
            from urllib.parse import parse_qs
            return self.handle_api(path, {})
        return self.not_found(path)

    def log_message(self, fmt, *args):
        """Log limpio, y a prueba de tipos raros.

        BaseHTTPRequestHandler.log_error llama a este método con el código
        numérico como primer argumento, no con la línea del pedido. Sin
        contemplarlo, el TypeError ocurre justo mientras se escribe la
        página de error y el cliente se queda sin respuesta.
        """
        texto = " ".join(str(a) for a in args if isinstance(a, (str, int)))
        if "/api/" not in texto:
            return
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))


NOT_FOUND_HTML = """<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pagina no encontrada</title>
<style>
body{font-family:system-ui,-apple-system,'Segoe UI',sans-serif;background:#f1f5f9;
color:#0f172a;display:flex;align-items:center;justify-content:center;
min-height:100vh;margin:0;padding:1.5rem}
.box{background:#fff;padding:2rem;border-radius:10px;max-width:520px;
box-shadow:0 1px 3px rgba(15,23,42,.1)}
h1{font-size:1.2rem;margin:0 0 .6rem}
p{color:#475569;font-size:.9rem;line-height:1.55}
code{background:#f1f5f9;padding:.15rem .4rem;border-radius:4px;font-size:.85rem}
a{display:inline-block;margin-top:1rem;background:#0f766e;color:#fff;
padding:.6rem 1.2rem;border-radius:8px;text-decoration:none;font-weight:600;font-size:.9rem}
.url{word-break:break-all;font-size:.8rem;color:#94a3b8}
</style></head><body><div class="box">
<h1>No encontramos esa pagina</h1>
<p>Pediste <span class="url">__URL__</span> y en el servidor no existe.</p>
<p>La calculadora esta en la raiz del servidor:</p>
<p><code>http://localhost:8900/</code></p>
<p>Si venis de GitHub Pages, acordate de que el nombre de la carpeta
(<code>calc-envios</code>) no forma parte de la direccion.</p>
<a href="/">Ir a la calculadora</a>
</div></body></html>"""


def main():
    db.init()
    port = int(os.environ.get("PORT", "8900"))
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print("Calculadora de envíos en http://localhost:%d" % port)
    print("Límite plan gratis: %d consultas por día" % db.FREE_DAILY_LIMIT)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor detenido.")
        server.server_close()


if __name__ == "__main__":
    main()