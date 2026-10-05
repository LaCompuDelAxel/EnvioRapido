# Calculadora de Costos de Envío

Aplicación web para que vendedores respondan "¿cuánto cuesta el envío a mi ciudad?" en segundos, con tarifas de encomienda de Venezuela.

## Cómo usarla

Abrí `index.html` en el navegador. No necesita instalación ni servidor.

Para probarla como sitio web:

```
python -m http.server 8000
```

y entrar a `http://localhost:8000`.

## Estructura

```
index.html            Formulario y contenedores
styles.css            Estilos, diseño responsive
data/cities.js        47 ciudades con su zona logística
data/tarifas.json     Precios editables sin tocar código
data/carriers.js      Respaldo de tarifas (solo para abrir el archivo con doble clic)
js/rates.js           Carga de tarifas y tasa de cambio
js/pricing.js         Motor de cálculo
js/ui.js              Formulario, resultados, texto de WhatsApp
```

## Publicar en GitHub Pages

El proyecto es un sitio estático, así que GitHub Pages lo publica tal cual.

1. Creá el repositorio. **Subí solo la carpeta `calc-envios/`**, no la raíz del
   proyecto: en la raíz hay `build/`, `dist/` y un `.spec` de otro programa que
   no tienen nada que ver con esto.

   Desde la carpeta `calc-envios`:

   ```
   git init
   git add .
   git commit -m "Calculadora de envíos"
   git branch -M main
   git remote add origin https://github.com/TU-USUARIO/calc-envios.git
   git push -u origin main
   ```

2. En GitHub: **Settings → Pages → Source: Deploy from a branch**, rama `main`
   y carpeta `/ (root)`. Guardar.

3. En un par de minutos queda en `https://TU-USUARIO.github.io/calc-envios/`.

Cada vez que hagas `git push`, la página se actualiza sola. No hay build ni
dependencias que instalar.

## Cómo está calculado el precio

```
peso a cobrar = max(peso real, peso volumétrico)
peso volumétrico = (largo × ancho × alto en cm) / divisor de la agencia

envío = base de zona + peso a cobrar × $/kg de la zona
seguro = máx(0.50 USD, 3% del valor declarado por encima de 50 USD)
total = envío + seguro
```

El divisor volumétrico cambia según la agencia: MRW usa 4000 (el área es lo más
caro), Group Cargo usa 6000 (es terrestre y tolera más volumen). Por eso una caja
grande y liviana puede salir más cara que un paquete pesado y compacto.

## El problema de los precios que cambian todos los días

Hay que separar dos cosas que se confunden:

**El precio del envío está en dólares.** Las agencias no lo recalculan cada vez
que se mueve el bolívar. Cambian sus tarifas cuando cambian sus costos, que suele
ser cada pocas semanas. Ese número es el que hay que mantener al día, y depende
solo de la agencia.

**El equivalente en bolívares cambia todos los días.** Eso no lo controlás vos:
la app consulta la tasa del paralelo al momento de cotizar y la muestra como
referencia, nunca como precio final.

Por eso el diseño hace tres cosas:

1. **Los precios viven en `data/tarifas.json`**, aparte del código. Actualizás
   números sin tocar una línea de JavaScript, sin romper nada y sin pedirle a
   nadie que reinstale nada.

2. **La app puede leer las tarifas desde una URL remota.** Apuntás
   `tarifas.json` a cualquier hosting (GitHub Pages, Netlify, un repo aparte) y
   la app toma los precios de ahí:

   ```js
   localStorage.setItem('calcenvios.tarifasUrl', 'https://TU-USUARIO.github.io/calc-envios/data/tarifas.json')
   ```

   Con eso, cambiar precios es editar el JSON y hacer push. Se actualiza para
   todos tus clientes sin publicar nada nuevo.

3. **Avisa cuando las tarifas están viejas.** Si pasaron más de 30 días desde la
   fecha de `actualizado`, sale una banda amarilla arriba. Es el riesgo real del
   modelo, y es mejor que el vendedor lo vea a que lo descubra un cliente.

**La app nunca promete el precio final.** El texto de WhatsApp lo dice: "Estimado,
confirmá con la agencia antes de pagar". Esa frase evita la mayoría de los
problemas con clientes.

### Límite que ninguna app resuelto

Aunque tengas la tarifa exacta, la agencia aplica reglas que no están en la
tarifa: redondeos hacia arriba al siguiente kilo, seguros mínimos, recargos por
zona rural, costo de recoger en oficina vs. domicilio. Un cálculo exacto no es
posible sin una API de cada agencia.

La salida real es la del plan Premium: que el vendedor cargue **sus propias
tarifas fijas por ciudad** (o las de su delivery propio). Esos números sí son
exactos, porque salen de lo que él cobra de verdad. La función de cálculo ya
acepta `ownRate`; falta la interfaz.

## Monetización

El plan Premium ya está implementado y funcionando. Corre con el backend.

```
python backend/server.py
```

Abrís `http://localhost:8900` y la app sola se da cuenta de que hay servidor.

### Crear una licencia

```
python backend/admin.py nueva --email cliente@correo.com --dias 30 --tienda "Boutique Ana"
```

Devuelve algo así:

```
Llave:  CALC-5KFZ-LY8S-EBJN
Vence:  2026-11-04
```

Cobrale por transferencia o Zelle, pasale la llave, y el cliente la pega en el
botón Premium de la página.

Otros comandos:

```
python backend/admin.py lista              # ver todas las licencias
python backend/admin.py probar CALC-...    # verificar una llave
python backend/admin.py revocar CALC-...   # cancelar una llave
```

### Qué incluye el Premium

| | Gratis | Premium |
|---|---|---|
| Consultas por día | 10 | Ilimitadas |
| Agencias de encomienda | 4 | 4 |
| Texto para WhatsApp | Sí | Sí |
| Enlace compartible | Sí | Sí |
| Tarifas propias por ciudad | No | Sí |
| Nombre de la tienda en el resumen | No | Sí |
| Publicidad | Sí | No |

Lo mejor de que exista el backend es que **el límite no se puede falsear desde
el navegador**. Probado: el undécimo cálculo del día al plan gratis devuelve
error 429 y la página muestra el aviso para vender Premium. Antes de este
cambio, todo pasaba por el cliente y cualquiera lo salvaba con un `localStorage.clear()`.

### Dónde queda el límite real

```
js/ui.js      pide permiso y llama a la API
js/account.js guarda la llave y el estado del plan
backend/server.py  valida la llave contra la base de datos
backend/db.py      cuenta los usos del día
```

La llave se guarda en `localStorage` del navegador, pero eso solo identifica al
usuario: si alguien la borra, el servidor lo trata como plan gratis de nuevo y
empieza a contar de cero. El límite de 10 por día es por navegador anónimo, no
por persona. Para un MVP alcanza; para cobrar en serio, lo que hay que olhar es
que el cliente vuelva al día siguiente.

### Cómo se cobra, por ahora

Por transferencia manual: vos creás la llave, cobrás por tu medio, se la pasás.
Es lo más rápido para arrancar y no necesita ninguna cuenta de pagos.

Cuando tengas volumen y necesites suscripción automática, la parte a conectar es
una sola: reemplazar `admin.py nueva` por un webhook del proveedor de pagos que
llame a `db.issue_license()`. El resto de la app no cambia, porque ya valida
contra la base de datos.

## Cómo hacer que el Premium funcione con la página en GitHub Pages

El problema: GitHub Pages solo sirve archivos estáticos. No ejecuta Python, así que
el backend de las licencias tiene que vivir en otro lado.

La solución es que no importa dónde estén: la calculadora busca al servidor en la
dirección que le indiques.

**Paso 1: subir el backend a un hosting con Python**

Render tiene plan gratuito. Creá un Web Service y poné:

- Build command: `pip install -r backend/requirements.txt`
- Start command: `python backend/server.py`

El servidor ya lee el puerto de la variable `PORT`, que es lo que Render entrega.

Fly.io y Railway también sirven. Cualquier hosting que corra Python alcanza: el
código usa solo la biblioteca estándar.

**Paso 2: en la web, decirle dónde está el servidor**

Abrí la página publicada, entrá a **Premium**, y desplegá el bloque *"Configuración
del sitio (solo para el dueño)"*. Escribí la dirección del backend:

```
https://tu-backend.onrender.com
```

Guardalo. La dirección queda en el navegador y a partir de ahí el botón de
activar llaves aparece solo.

Prueba manual: si al guardar dice "Conectado", está funcionando. Si dice que no
pudo conectar, la dirección está mal.

### Sobre la base de datos

`backend/envios.db` guarda las licencias. En Render y Railway los contenedores
son temporales: **cada reinicio del servicio borra la base y perdés las licencias**.

Para resolverlo, montá un disco persistente apuntando a la carpeta `backend/`, o
pasá la base a un Postgres. Mientras estés probando no importa: creás una licencia,
probás, y si se pierde la volvés a crear.

### La alternativa simple

Si todavía no querés meterte con hostings, corré todo desde tu propia máquina
mientras tanto:

```
python backend/server.py
```

y usás `http://localhost:8900`. Todo el Premium funciona: licencias, límites,
tarifas propias. El único límite es que solo la ven tus visitantes si estás en la
misma red WiFi.

## Pendiente

- **Las tarifas de las agencias siguen siendo estimaciones inventadas.** Es lo
  único que bloquea vender. Hay que llamar a cada agencia y cargar los números
  reales en `data/tarifas.json`.
- HTTPS obligatorio antes de publicar: hoy el servidor corre en `127.0.0.1` sin
  cifrar.
- `backend/envios.db` está en `.gitignore` porque tiene datos de clientes. En un
  hosting temporal la base se pierde: hay que usar disco persistente y backup.
- Historia de cambios de tarifas, para saber qué pasó con un precio de hace un mes.
- La cuenta de AdSense necesita una página de privacidad, que todavía no existe.