/*
 * Carga de tarifas y tasa de cambio.
 *
 * Existe un archivo local (data/tarifas.json) que funciona sin conexión,
 * pero se puede apuntar a una URL remota para actualizar precios sin
 * tocar el código ni volver a publicar.
 *
 * También trae la tasa del dólar del día para mostrar el precio también
 * en bolívares. Si la API falla, la app sigue funcionando en USD.
 */
(function (global) {
  'use strict';

  var LOCAL_TARIFFS = 'data/tarifas.json';
  var CACHE_KEY = 'calcenvios.tarifas';
  var CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 horas

  var FX_SOURCES = [
    'https://ve.dolarapi.com/v1/dolares',
    'https://pydolarve.com/api/v1/dollar?page=home',
  ];

  /* URL remota opcional. Configurala desde la consola del navegador:
     localStorage.setItem('calcenvios.tarifasUrl', 'https://tu-host/tarifas.json') */
  var REMOTE_KEY = 'calcenvios.tarifasUrl';

  function remoteUrl() {
    try {
      return global.localStorage.getItem(REMOTE_KEY) || '';
    } catch (e) {
      return '';
    }
  }

  /* ---------- tasa de cambio ---------- */

  /*
   * Devuelve { tasa, fuente, fecha } o null si no se pudo consultar.
   * Intentamos varias fuentes porque ninguna es oficial ni estable.
   */
  function fetchExchangeRate() {
    var sources = FX_SOURCES.slice();

    function tryNext(index) {
      if (index >= sources.length) return Promise.resolve(null);

      var controller = new AbortController();
      var timer = setTimeout(function () {
        controller.abort();
      }, 6000);

      return fetch(sources[index], { signal: controller.signal })
        .then(function (response) {
          if (!response.ok) throw new Error('HTTP ' + response.status);
          return response.json();
        })
        .then(function (data) {
          var parsed = parseRate(data);
          clearTimeout(timer);
          return parsed;
        })
        .catch(function () {
          clearTimeout(timer);
          return tryNext(index + 1);
        });
    }

    return tryNext(0);
  }

  /* Cada API devuelve el dato con una forma distinta: normalizamos acá. */
  function parseRate(data) {
    if (!data) return null;

    if (Array.isArray(data)) {
      /* dolarapi: lista de monedas, buscamos la de fuente "paralelo"
         porque es la que realmente usa el mercado para cambiar. */
      for (var i = 0; i < data.length; i++) {
        var row = data[i];
        if (row.fuente === 'paralelo' && row.promedio) {
          return {
            tasa: row.promedio,
            fuente: 'Paralelo',
            fecha: row.fechaActualizacion || null,
          };
        }
      }
      return null;
    }

    /* pydolarve: { moniker: 'dolar', price: 123 } */
    if (data.price) {
      return { tasa: data.price, fuente: 'Paralelo', fecha: data.timestamp || null };
    }

    /* otras formas comunes */
    if (data.buy) {
      return { tasa: data.sell || data.buy, fuente: 'Mercado', fecha: null };
    }

    return null;
  }

  /* ---------- tarifas ---------- */

  /*
   * Traduce el formato de tarifas.json al formato que usa el motor de
   * cálculo (mismo que el antiguo carriers.js).
   */
  function normalize(raw) {
    var carriers = raw.agencias.map(function (a) {
      return {
        id: a.id,
        name: a.nombre,
        tagline: a.descripcion || '',
        accent: a.color || '#0F766E',
        volumetric: a.volumetrico,
        maxKg: a.maxKg,
        minCharge: a.minimoCobro || 0,
        eta: a.tiempo || {},
        zones: a.zonas,
      };
    });

    return {
      carriers: carriers,
      insurance: {
        rate: raw.seguro.tasa,
        min: raw.seguro.minimo,
        freeUpTo: raw.seguro.cubiertoHasta,
      },
      updatedAt: raw.actualizado || null,
    };
  }

  /* Revisa que el JSON tenga lo mínimo para no romper el cálculo. */
  function isValid(raw) {
    return !!(
      raw &&
      Array.isArray(raw.agencias) &&
      raw.agencias.length &&
      raw.seguro &&
      raw.seguro.tasa != null
    );
  }

  function readCache() {
    try {
      var entry = JSON.parse(global.localStorage.getItem(CACHE_KEY));
      if (!entry || !entry.data) return null;
      var age = Date.now() - entry.savedAt;
      if (age > CACHE_TTL_MS) return null;
      return entry.data;
    } catch (e) {
      return null;
    }
  }

  function writeCache(data) {
    try {
      global.localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data: data }));
    } catch (e) {
      /* Modo privado o cuota llena: la app sigue, solo pierde el cache. */
    }
  }

  /*
   * Devuelve las tarifas ya normalizadas.
   * Orden de preferencia:
   *   1. URL remota configurada por el dueño
   *   2. cache reciente en el navegador
   *   3. data/tarifas.json local
   *   4. tarifas embebidas en carriers.js
   *
   * El paso 4 existe porque al abrir index.html con doble clic el
   * navegador bloquea la lectura de archivos locales y los fetch fallan.
   */
  function embedded() {
    return {
      carriers: global.CARRIERS || [],
      insurance: global.INSURANCE || { rate: 0.03, min: 0.5, freeUpTo: 50 },
      updatedAt: global.TARIFFS_DATE || null,
    };
  }

  function loadTariffs() {
    var url = remoteUrl();

    function fromLocalFile() {
      return fetch(LOCAL_TARIFFS)
        .then(function (r) {
          return r.json();
        })
        .then(function (raw) {
          if (!isValid(raw)) throw new Error('Formato inválido');
          var clean = normalize(raw);
          writeCache(clean);
          return clean;
        })
        .catch(function () {
          return embedded();
        });
    }

    if (url) {
      return fetch(url, { cache: 'no-store' })
        .then(function (r) {
          return r.json();
        })
        .then(function (raw) {
          if (!isValid(raw)) throw new Error('Formato inválido');
          var clean = normalize(raw);
          writeCache(clean);
          return clean;
        })
        .catch(function () {
          /* Si la URL remota falla, no dejamos la app sin precios. */
          var cached = readCache();
          if (cached) return cached;
          return fromLocalFile();
        });
    }

    var cached = readCache();
    if (cached) return Promise.resolve(cached);

    return fromLocalFile();
  }

  /*
   * Qué tan viejas están las tarifas. Si el dueño no las actualiza en un
   * mes, el vendedor está cobrando con números obsoletos.
   */
  function ageInDays(updatedAt) {
    if (!updatedAt) return null;
    var then = new Date(updatedAt);
    if (isNaN(then.getTime())) return null;
    var days = Math.floor((Date.now() - then.getTime()) / 86400000);
    return days < 0 ? 0 : days;
  }

  global.Rates = {
    loadTariffs: loadTariffs,
    fetchExchangeRate: fetchExchangeRate,
    ageInDays: ageInDays,
    remoteUrl: remoteUrl,
    REMOTE_KEY: REMOTE_KEY,
  };
})(window);