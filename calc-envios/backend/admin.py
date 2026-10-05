"""
Administración de licencias premium.

Uso:
    python backend/admin.py nueva --email cliente@correo.com --dias 30
    python backend/admin.py nueva --email cliente@correo.com --dias 30 --tienda "Boutique Ana"
    python backend/admin.py lista
    python backend/admin.py revocar CALC-XXXX-XXXX-XXXX
    python backend/admin.py probar CALC-XXXX-XXXX-XXXX
"""
import sys

import db


def cmd_nueva(args):
    email = None
    dias = 30
    tienda = None

    resto = args[:]
    while resto:
        flag = resto.pop(0)
        if not resto:
            print("Falta el valor de", flag)
            return 1
        value = resto.pop(0)
        if flag in ("--email", "-e"):
            email = value
        elif flag in ("--dias", "-d"):
            dias = int(value)
        elif flag == "--tienda":
            tienda = value
        else:
            print("Opción desconocida:", flag)
            return 1

    licencia = db.issue_license(email=email, days=dias, store_name=tienda)

    print("Licencia creada")
    print("  Llave:  " + licencia["key"])
    if email:
        print("  Email:  " + email)
    if tienda:
        print("  Tienda: " + tienda)
    if licencia["expires_at"]:
        print("  Vence:  " + licencia["expires_at"])
    else:
        print("  Vence:  nunca")
    print()
    print("Cobrale por transferencia y pasale esta llave al cliente.")
    return 0


def cmd_lista(args):
    licencias = db.list_licenses()

    if not licencias:
        print("No hay licencias todavía.")
        return 0

    print("%-24s %-26s %-12s %s" % ("LLAVE", "EMAIL", "VENCE", "ESTADO"))
    for item in licencias:
        if not item["active"]:
            estado = "cancelada"
        elif item["expires_at"] and item["expires_at"] < db.today():
            estado = "vencida"
        elif item["expires_at"]:
            estado = "activa"
        else:
            estado = "activa"

        print("%-24s %-26s %-12s %s" % (
            item["key"],
            (item["email"] or "-")[:25],
            item["expires_at"] or "nunca",
            estado,
        ))
    return 0


def cmd_revocar(args):
    if not args:
        print("Falta la llave. Ejemplo: revocar CALC-XXXX-XXXX-XXXX")
        return 1

    if db.revoke_license(args[0]):
        print("Licencia cancelada: " + args[0].upper())
        return 0

    print("No se encontró esa licencia.")
    return 1


def cmd_probar(args):
    if not args:
        print("Falta la llave.")
        return 1

    item = db.find_license(args[0])
    if not item:
        print("No existe.")
        return 1

    if not db.license_is_valid(item):
        print("No es válida (inactiva o vencida).")
        return 1

    print("Llave válida")
    print("  Plan:    " + item["plan"])
    print("  Vence:   " + (item["expires_at"] or "nunca"))
    if item["store_name"]:
        print("  Tienda:  " + item["store_name"])
    print("  Consultas hoy: " + str(db.get_usage("license:" + item["key"])))
    return 0


COMANDOS = {
    "nueva": cmd_nueva,
    "nuevo": cmd_nueva,
    "lista": cmd_lista,
    "listar": cmd_lista,
    "revocar": cmd_revocar,
    "probar": cmd_probar,
}


def main():
    if len(sys.argv) < 2 or sys.argv[1] in ("-h", "--help", "ayuda"):
        print(__doc__)
        return 0

    comando = COMANDOS.get(sys.argv[1])
    if not comando:
        print("Comando desconocido:", sys.argv[1])
        print("Usá: nueva, lista, revocar, probar")
        return 1

    return comando(sys.argv[2:])


if __name__ == "__main__":
    sys.exit(main())