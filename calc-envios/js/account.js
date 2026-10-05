/*
 * Cuenta del usuario: plan, límite diario y tarifas propias.
 *
 * La llave se guarda en localStorage del navegador. Importante: eso solo
 * identifica al usuario, no protege nada. Lo que protege de verdad es el
 * servidor, que valida la llave contra la base de datos antes de conceder
 * los features premium.
 *
 * La página y el servidor pueden estar en lados distintos: la web en GitHub
 * Pages y la API en otro hosting. Por eso las llamadas van a una URL
 * configurable (API_URL) y no siempre a rutas relativas.
 *
 * Si no hay servidor, la app sigue funcionando sin límite. Eso es lo que
 * pasa si subís solo la carpeta a Pages sin configurar la API.
 */
(function (global) {
  'use strict';

  var KEY_STORAGE = 'calcenvios.licencia';
  var CLIENT_STORAGE = 'calcenvios.clientId';
  var API_URL_STORAGE = 'calcenvios.apiUrl';

  /*
   * Dirección del backend donde viven las licencias.
   *
   * Vacío = mismo dominio (cuando servís todo con server.py, que es el
   * caso de desarrollo). Para producción con la web en GitHub Pages, poné
   * acá la URL del backend, por ejemplo:
   *   https://calc-envios-api.onrender.com
   */
  var API_URL = '';

  /*
   * Configura la URL de la API y la guarda para el próximo arranque.
   * Devuelve la URL normalizada (sin barra final).
   */
  function setApiUrl(url) {
    API_URL = (url || '').trim().replace(/\/+$/, '');
    try {
      global.localStorage.setItem(API_URL_STORAGE, API_URL);
    } catch (e) {
      /* Modo privado: funciona igual, solo no persiste. */
    }
    return API_URL;
  }

  function apiUrl() {
    if (API_URL) return API_URL;
    try {
      API_URL = (global.localStorage.getItem(API_URL_STORAGE) || '').trim().replace(/\/+$/, '');
    } catch (e) {
      API_URL = '';
    }
    return API_URL;
  }

  /* Cualquier http(s) sirve: el archivo local no tiene a quién preguntar. */
  function hasBackend() {
    return global.location.protocol === 'http:' || global.location.protocol === 'https:';
  }

  /* Identificador anónimo para el plan gratis. */
  function clientId() {
    var id = global.localStorage.getItem(CLIENT_STORAGE);
    if (!id) {
      id = 'c' + Math.random().toString(36).slice(2, 11);
      global.localStorage.setItem(CLIENT_STORAGE, id);
    }
    return id;
  }

  function savedKey() {
    return global.localStorage.getItem(KEY_STORAGE) || '';
  }

  function saveKey(key) {
    global.localStorage.setItem(KEY_STORAGE, key.trim().toUpperCase());
  }

  function clearKey() {
    global.localStorage.removeItem(KEY_STORAGE);
  }

  function post(path, body) {
    return fetch(apiUrl() + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(function (response) {
      return response.json().then(function (data) {
        return { status: response.status, data: data };
      });
    });
  }

  /* Estado actual del plan. */
  var state = {
    plan: 'free',
    features: [],
    used: 0,
    limit: 10,
    remaining: 10,
    expiresAt: null,
    storeName: null,
    backendOnline: false,
  };

  function has(feature) {
    return state.features.indexOf(feature) !== -1;
  }

  /* ---------- activación ---------- */

  function activate(key) {
    if (!hasBackend()) return Promise.reject('Sin servidor');
    return post('/api/activate', { key: key }).then(function (res) {
      if (res.status === 200 && res.data.ok) {
        saveKey(key);
        return refresh().then(function () {
          return true;
        });
      }
      return false;
    });
  }

  function deactivate() {
    clearKey();
    return refresh();
  }

  function refresh() {
    if (!hasBackend()) {
      state.plan = 'free';
      return Promise.resolve(state);
    }
    return post('/api/plan', { key: savedKey(), clientId: clientId() })
      .then(function (res) {
        state.backendOnline = true;
        state.plan = res.data.plan;
        state.features = res.data.features || [];
        state.used = res.data.used || 0;
        state.limit = res.data.limit === undefined ? 10 : res.data.limit;
        state.remaining = res.data.limit === null ? Infinity : Math.max(0, res.data.limit - state.used);
        state.expiresAt = res.data.expiresAt || null;
        state.storeName = res.data.storeName || null;
        return state;
      })
      .catch(function () {
        /* Sin servidor no hay control de cuota: la app opera igual. */
        state.backendOnline = false;
        state.plan = 'free';
        state.features = [];
        return state;
      });
  }

  /*
   * Pide permiso para una consulta. Si el plan gratis ya agotó el día,
   * el servidor responde 429 y acá se avisa con upgradeRequired.
   */
  function consume() {
    if (!hasBackend()) return Promise.resolve({ allowed: true });

    return post('/api/consume', { key: savedKey(), clientId: clientId() })
      .then(function (res) {
        var data = res.data;
        state.used = data.used || 0;
        state.limit = data.limit === undefined ? state.limit : data.limit;
        state.remaining = data.remaining !== undefined ? data.remaining : state.remaining;
        return {
          allowed: !!data.allowed,
          remaining: state.remaining,
          limit: data.limit,
          reason: data.reason || null,
        };
      })
      .catch(function () {
        /* Si el servidor se cae, no bloquear al vendedor. */
        return { allowed: true };
      });
  }

  /* ---------- tarifas propias ---------- */

  function loadOwnRates() {
    if (!hasBackend() || !savedKey()) return Promise.resolve([]);
    return post('/api/rates', { key: savedKey(), action: 'list' })
      .then(function (res) {
        if (res.status !== 200) return [];
        return (res.data.rates || []).map(function (r) {
          return { cityId: r.city_id, price: r.price_usd };
        });
      })
      .catch(function () {
        return [];
      });
  }

  function setOwnRate(cityId, price) {
    return post('/api/rates', {
      key: savedKey(), action: 'set', cityId: cityId, price: price,
    }).then(function (res) {
      return res.status === 200;
    }).catch(function () {
      return false;
    });
  }

  function deleteOwnRate(cityId) {
    return post('/api/rates', { key: savedKey(), action: 'delete', cityId: cityId })
      .then(function (res) {
        return res.status === 200;
      })
      .catch(function () {
        return false;
      });
  }

  global.Account = {
    state: state,
    has: has,
    hasBackend: hasBackend,
    apiUrl: apiUrl,
    setApiUrl: setApiUrl,
    API_URL_STORAGE: API_URL_STORAGE,
    clientId: clientId,
    savedKey: savedKey,
    activate: activate,
    deactivate: deactivate,
    refresh: refresh,
    consume: consume,
    loadOwnRates: loadOwnRates,
    setOwnRate: setOwnRate,
    deleteOwnRate: deleteOwnRate,
  };
})(window);