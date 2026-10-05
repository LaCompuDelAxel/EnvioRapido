/*
 * Capa de interfaz.
 *
 * Las tarifas llegan de forma asíncrona ( Rates.loadTariffs ), así que la
 * app arranca mostrando el formulario y activa el botón cuando ya hay datos.
 */
(function (global) {
  'use strict';

  var Pricing = global.Pricing;
  var Rates = global.Rates;
  var Account = global.Account;

  /* Estado de la sesión */
  var state = {
    exchange: null,  // { tasa, fuente, fecha } o null
    tariffsDate: null,
    ready: false,
    ownRates: {},    // { cityId: precioUsd }
  };

  /* ---------- utilidades ---------- */

  function $(id) {
    return document.getElementById(id);
  }

  function money(value) {
    return '$' + value.toFixed(2);
  }

  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /*
   * Convierte un monto en USD a bolívares.
   * El precio real del envío es el de dólares: el bolívar es solo la
   * equivalencia del momento, por eso se muestra como referencia.
   */
  function toVes(usd) {
    if (!state.exchange || !state.exchange.tasa) return null;
    return 'Bs ' + Math.round(usd * state.exchange.tasa).toLocaleString('es-VE');
  }

  /* ---------- lectura del formulario ---------- */

  function readForm() {
    var weightValue = parseFloat($('weight').value);
    var unit = $('unit').value;

    if (!isFinite(weightValue) || weightValue <= 0) return null;

    /* El motor de cálculo solo trabaja en kg. */
    var weightKg = unit === 'g' ? weightValue / 1000 : weightValue;

    var dims = null;
    if ($('useDims').checked) {
      var l = parseFloat($('dimL').value);
      var w = parseFloat($('dimW').value);
      var h = parseFloat($('dimH').value);
      if (isFinite(l) && isFinite(w) && isFinite(h) && l > 0 && w > 0 && h > 0) {
        dims = { length: l, width: w, height: h };
      }
    }

    var declaredValue = null;
    if ($('declaredValue').value) {
      declaredValue = parseFloat($('declaredValue').value);
      if (!isFinite(declaredValue)) declaredValue = null;
    }

    return {
      cityId: $('city').value,
      zoneId: $('zone').value,
      weightKg: weightKg,
      weightLabel: weightValue + (unit === 'g' ? ' g' : ' kg'),
      dims: dims,
      declaredValue: declaredValue,
    };
  }

  /* ---------- render de resultados ---------- */

  function renderCarrierCard(quote, isWinner) {
    var tags = [];
    if (quote.billedByVolume) {
      tags.push('<span class="tag tag-vol">cobra ' + quote.billableKg.toFixed(1) + ' kg por volumen</span>');
    }
    if (quote.breakdown.insurance > 0) {
      tags.push('<span class="tag">incluye seguro</span>');
    }

    return (
      '<article class="carrier' + (isWinner ? ' carrier--best' : '') + '">' +
      '  <div class="carrier__head">' +
      '    <span class="carrier__dot" style="background:' + quote.accent + '"></span>' +
      '    <h3>' + escapeHtml(quote.carrierName) + '</h3>' +
      (isWinner ? '<span class="badge">Mejor precio</span>' : '') +
      '  </div>' +
      '  <p class="carrier__tagline">' + escapeHtml(quote.tagline) + '</p>' +
      '  <div class="carrier__body">' +
      '    <div>' +
      '      <div class="carrier__price">' + money(quote.breakdown.total) + '</div>' +
      (quote.vesAmount ? '<div class="carrier__ves">' + quote.vesAmount + '</div>' : '') +
      '    </div>' +
      '    <div class="carrier__eta">' + escapeHtml(quote.eta) + '</div>' +
      '  </div>' +
      '  <details class="carrier__detail">' +
      '    <summary>Ver desglose</summary>' +
      '    <ul>' +
      '      <li><span>Base de zona ' + escapeHtml(quote.zoneName) + '</span><b>' + money(quote.breakdown.base) + '</b></li>' +
      '      <li><span>' + quote.billableKg.toFixed(2) + ' kg × ' + money(quote.breakdown.perKg) + '/kg</span><b>' +
        money(quote.breakdown.shipping - quote.breakdown.base) + '</b></li>' +
      (quote.breakdown.insurance > 0
        ? '<li><span>Seguro</span><b>' + money(quote.breakdown.insurance) + '</b></li>'
        : '') +
      (quote.breakdown.minApplied
        ? '<li><span>Mínimo de la agencia aplicado</span><b>' + money(quote.breakdown.total) + '</b></li>'
        : '') +
      '    </ul>' +
      (tags.length ? '<div class="carrier__tags">' + tags.join('') + '</div>' : '') +
      '  </details>' +
      '</article>'
    );
  }

  function calculate(input) {
    var quotes = Pricing.compare(input);
    quotes.forEach(function (q) {
      q.vesAmount = toVes(q.breakdown.total);
    });

    /* El Premium puede tener una tarifa fija para la ciudad: si la tiene,
       esa gana porque es el número real que cobra el vendedor. */
    var own = state.ownRates[input.cityId];
    if (own) {
      var city = global.CITIES.filter(function (c) {
        return c.id === input.cityId;
      })[0];
      quotes.unshift({
        carrierId: 'propia',
        carrierName: 'Tu tarifa',
        accent: '#0F766E',
        tagline: city ? 'Tarifa fija para ' + city.name : 'Tu tarifa personal',
        eta: 'La que definiste vos',
        zoneName: 'Personalizada',
        realKg: input.weightKg,
        billableKg: input.weightKg,
        billedByVolume: false,
        vesAmount: toVes(own),
        breakdown: {
          base: own,
          perKg: 0,
          shipping: own,
          minApplied: false,
          insurance: 0,
          total: own,
        },
        overMaxKg: false,
        unavailable: false,
        isOwn: true,
      });
    }

    return quotes;
  }

  function render(input, quotes) {
    var city = global.CITIES.filter(function (c) {
      return c.id === input.cityId;
    })[0];

    var cheapest = quotes[0];

    $('share').hidden = false;

    var rateNote = state.exchange
      ? '<div class="summary__rate">1 USD = Bs ' +
        state.exchange.tasa.toLocaleString('es-VE', { maximumFractionDigits: 2 }) +
        ' (' + escapeHtml(state.exchange.fuente) + ')</div>'
      : '';

    $('results').innerHTML =
      '<div class="summary">' +
      '  <div class="summary__line"><span>Destino</span><b>' + escapeHtml(city ? city.name : '—') + '</b></div>' +
      '  <div class="summary__line"><span>Peso</span><b>' + escapeHtml(input.weightLabel) + '</b></div>' +
      '  <div class="summary__line summary__line--total"><span>Desde</span><b>' +
        money(cheapest.breakdown.total) + '</b></div>' +
      rateNote +
      '</div>' +
      quotes.map(function (q, i) {
        return renderCarrierCard(q, i === 0);
      }).join('');

    $('results').hidden = false;

    $('message').value = buildMessage(input, cheapest, city);
    updateShareLink(input);
  }

  /* ---------- mensaje para WhatsApp ---------- */

  function buildMessage(input, cheapest, city) {
    var lines = [];
    lines.push('📦 Envío a ' + (city ? city.name : '') + ' (' + cheapest.eta + ')');
    lines.push('Peso: ' + input.weightLabel);
    lines.push('');
    lines.push('💰 ' + cheapest.carrierName + ': ' + money(cheapest.breakdown.total));

    /* El equivalente en bolívares solo si pudimos traer la tasa del día. */
    if (cheapest.vesAmount) {
      lines.push('≈ ' + cheapest.vesAmount + ' al cambio de hoy');
    }
    var negocio = storeName();
    if (negocio) {
      lines.push('');
      lines.push(negocio);
    }

    lines.push('');
    lines.push('_Estimado, confirmar con la agencia antes de pagar._');

    return lines.join('\n');
  }

  function copyMessage() {
    var field = $('message');
    field.select();

    var ok = false;
    try {
      ok = document.execCommand('copy');
    } catch (e) {
      ok = false;
    }

    /* execCommand está obsoleto: si falla, usamos la API moderna. */
    if (ok) return Promise.resolve(true);

    if (navigator.clipboard) {
      return navigator.clipboard.writeText(field.value).then(
        function () {
          return true;
        },
        function () {
          return false;
        }
      );
    }
    return Promise.resolve(false);
  }

  /* ---------- enlace compartible ---------- */

  function updateShareLink(input) {
    var params = new URLSearchParams();
    params.set('c', input.cityId);
    /* El peso viaja en gramos: un paquete de 500 g redondeado a kilos
       se volvía 0.00 en el enlace y el cliente veía el formulario vacío. */
    params.set('g', Math.round(input.weightKg * 1000));

    if (input.dims) {
      params.set('d', [input.dims.length, input.dims.width, input.dims.height].join('x'));
    }
    if (input.declaredValue) {
      params.set('v', input.declaredValue);
    }
    $('shareLink').value = global.location.href.split('#')[0] + '#' + params.toString();
  }

  function loadFromHash() {
    var hash = global.location.hash.replace(/^#/, '');
    if (!hash) return false;

    var params = new URLSearchParams(hash);
    var cityId = params.get('c');
    var city = global.CITIES.filter(function (c) {
      return c.id === cityId;
    })[0];

    if (!city) return false;

    $('city').value = city.id;
    $('zone').value = city.zone;

    var grams = parseFloat(params.get('g'));
    if (isFinite(grams) && grams > 0) {
      /* Por debajo de 1 kg tiene más sentido mostrar gramos. */
      if (grams < 1000) {
        $('weight').value = grams;
        $('unit').value = 'g';
      } else {
        $('weight').value = (grams / 1000).toFixed(2);
        $('unit').value = 'kg';
      }
    }

    var dims = params.get('d');
    if (dims) {
      var parts = dims.split('x');
      if (parts.length === 3) {
        $('useDims').checked = true;
        $('dims').hidden = false;
        $('dimL').value = parts[0];
        $('dimW').value = parts[1];
        $('dimH').value = parts[2];
      }
    }

    var declared = params.get('v');
    if (declared) $('declaredValue').value = declared;

    return true;
  }

  /* ---------- avisos de estado ---------- */

  function checkWeightLimit() {
    var input = readForm();
    var warning = $('weightWarning');
    if (!input) {
      warning.hidden = true;
      return;
    }
    var tooHeavy = global.CARRIERS.every(function (c) {
      return input.weightKg > c.maxKg;
    });
    warning.hidden = !tooHeavy;
  }

  /*
   * Si las tarifas tienen más de 30 días, el vendedor está cobrando con
   * números viejos. Es el riesgo real del modelo: no el tipo de cambio.
   */
  function showTariffAge(updatedAt) {
    var days = Rates.ageInDays(updatedAt);
    var banner = $('staleWarning');
    if (days === null || days <= 30) {
      banner.hidden = true;
      return;
    }
    $('staleText').textContent =
      'La última actualización fue hace ' + days + ' días (' + updatedAt + ').';
    banner.hidden = false;
  }

  function showOffline() {
    $('offlineWarning').hidden = false;
  }

  /* ---------- plan y cuota ---------- */

  function updateQuota(ticket) {
    var box = $('quota');
    if (!Account.hasBackend() || !Account.state.backendOnline) {
      box.textContent = '';
      return;
    }

    if (Account.state.plan !== 'free') {
      box.textContent = 'Plan Premium · consultas ilimitadas';
      box.className = 'quota quota--premium';
      return;
    }

    var limit = Account.state.limit || 10;
    box.textContent = 'Consultas de hoy: ' + Account.state.used + ' de ' + limit;
    box.className = 'quota';

    if (ticket && ticket.remaining === 0) {
      $('quotaWarningText').textContent =
        'Se renueva mañana. Con Premium son ilimitadas.';
      $('quotaWarning').hidden = false;
    }
  }

  function showQuotaBlocked(ticket) {
    var limit = ticket.limit || 10;
    $('quotaWarningText').textContent =
      'Usaste las ' + limit + ' consultas gratuitas de hoy. Se renuevan mañana, o activá Premium.';
    $('quotaWarning').hidden = false;
    updateQuota();
    openPlans();
  }

  function openPlans() {
    $('plansPanel').hidden = false;
    $('plansPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* Muestra u oculta lo que depende del plan. */
  function renderAccount() {
    var isPremium = Account.has('unlimited_queries');

    $('premiumPanel').hidden = !isPremium;
    $('currentPlanBtn').hidden = !Account.state.backendOnline || isPremium;
    $('activateBtn').hidden = isPremium;
    $('activateBox').hidden = isPremium || !Account.state.backendOnline;

    /* Sin Premium queda la publicidad, que es una de las razones de pago. */
    $('adSlot').hidden = isPremium;

    $('planToggle').textContent = isPremium ? 'Premium ✓' : 'Premium';

    if (isPremium) {
      var vence = Account.state.expiresAt
        ? ' · vence el ' + Account.state.expiresAt
        : '';
      $('premiumHeadline').textContent = 'Tu plan está activo' + vence;
    }

    updateQuota();
  }

  function loadOwnRates() {
    return Account.loadOwnRates().then(function (rates) {
      state.ownRates = {};
      rates.forEach(function (r) {
        state.ownRates[r.cityId] = r.price;
      });
      renderOwnRateList();
    });
  }

  function renderOwnRateList() {
    var keys = Object.keys(state.ownRates);
    if (!keys.length) {
      $('ownRateList').innerHTML = '<li class="ownrate__empty">Todavía no cargaste ninguna tarifa.</li>';
      return;
    }

    $('ownRateList').innerHTML = keys.map(function (cityId) {
      var city = global.CITIES.filter(function (c) {
        return c.id === cityId;
      })[0];
      var name = city ? city.name : cityId;
      return (
        '<li><span>' + escapeHtml(name) + '</span>' +
        '<b>' + money(state.ownRates[cityId]) + '</b>' +
        '<button type="button" class="link" data-remove="' + escapeHtml(cityId) + '">Quitar</button>' +
        '</li>'
      );
    }).join('');

    /* Un solo manejador para todos los botones de quitar. */
    var buttons = $('ownRateList').querySelectorAll('[data-remove]');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener('click', function (event) {
        var cityId = event.target.getAttribute('data-remove');
        Account.deleteOwnRate(cityId).then(function (ok) {
          if (ok) {
            delete state.ownRates[cityId];
            renderOwnRateList();
          }
        });
      });
    }
  }

  /* El nombre de la tienda se guarda en este navegador. */
  function loadStoreName() {
    var saved = global.localStorage.getItem('calcenvios.tienda');
    if (saved) $('storeName').value = saved;
  }

  function storeName() {
    if (!Account.has('custom_logo')) return null;
    var value = $('storeName').value.trim();
    return value || null;
  }

  function updateFooter() {
    var parts = [];
    if (state.tariffsDate) {
      parts.push('Tarifas al ' + state.tariffsDate);
    }
    if (state.exchange) {
      parts.push('Dólar ' + state.exchange.fuente + ': Bs ' +
        state.exchange.tasa.toLocaleString('es-VE', { maximumFractionDigits: 2 }));
    }
    $('footerMeta').textContent = parts.join(' · ');
  }

  /* ---------- arranque ---------- */

  function populateSelects() {
    var cityOptions = global.CITIES.map(function (c) {
      return '<option value="' + c.id + '">' + escapeHtml(c.name) + '</option>';
    }).join('');
    $('city').insertAdjacentHTML('beforeend', cityOptions);

    var zoneOptions = Object.keys(global.ZONES).map(function (key) {
      var z = global.ZONES[key];
      return '<option value="' + z.id + '">' + escapeHtml(z.name) + '</option>';
    }).join('');
    $('zone').insertAdjacentHTML('beforeend', zoneOptions);
  }

  function bindEvents() {
    $('useDims').addEventListener('change', function () {
      $('dims').hidden = !$('useDims').checked;
    });

    /* El cambio de ciudad rellena la zona automáticamente. */
    $('city').addEventListener('change', function () {
      var city = global.CITIES.filter(function (c) {
        return c.id === $('city').value;
      })[0];
      if (city) $('zone').value = city.zone;
    });

    $('weight').addEventListener('input', checkWeightLimit);

    $('form').addEventListener('submit', function (event) {
      event.preventDefault();

      if (!state.ready) {
        alert('Todavía se están cargando las tarifas. Probá en un segundo.');
        return;
      }

      var input = readForm();
      if (!input) {
        alert('Ingresá el peso del paquete para calcular.');
        return;
      }

      /* El servidor decide si esta consulta está permitida. Si no hay
         servidor, consume() deja pasar: la app no se traba. */
      Account.consume().then(function (ticket) {
        if (!ticket.allowed) {
          showQuotaBlocked(ticket);
          return;
        }
        updateQuota(ticket);
        render(input, calculate(input));
        $('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    $('copyBtn').addEventListener('click', function () {
      copyMessage().then(function (ok) {
        var btn = $('copyBtn');
        btn.textContent = ok ? '✓ Copiado' : 'No se pudo copiar';
        setTimeout(function () {
          btn.textContent = 'Copiar texto';
        }, 2000);
      });
    });

    $('waBtn').addEventListener('click', function () {
      var url = 'https://wa.me/?text=' + encodeURIComponent($('message').value);
      global.open(url, '_blank');
    });

    $('copyLinkBtn').addEventListener('click', function () {
      var field = $('shareLink');
      field.select();
      try {
        document.execCommand('copy');
        $('copyLinkBtn').textContent = '✓ Copiado';
        setTimeout(function () {
          $('copyLinkBtn').textContent = 'Copiar enlace';
        }, 2000);
      } catch (e) {
        /* Sin portapapeles: el enlace queda seleccionado para copiar a mano. */
      }
    });

    /* ---------- planes ---------- */

    $('planToggle').addEventListener('click', openPlans);
    $('upgradeFromQuota').addEventListener('click', openPlans);

    $('activateBtn').addEventListener('click', function () {
      $('activateBox').hidden = false;
      $('licenseInput').focus();
    });

    $('licenseSubmit').addEventListener('click', function () {
      var key = $('licenseInput').value.trim();
      var status = $('activateStatus');

      if (!key) {
        status.textContent = 'Escribí la llave que te dio el vendedor.';
        status.className = 'activate__status activate__status--error';
        return;
      }

      Account.activate(key).then(function (ok) {
        if (!ok) {
          status.textContent = 'Esa llave no es válida o ya venció.';
          status.className = 'activate__status activate__status--error';
          return;
        }
        status.textContent = 'Listo, tu plan Premium está activo.';
        status.className = 'activate__status activate__status--ok';
        $('licenseInput').value = '';
        renderAccount();
        loadOwnRates();
      }).catch(function () {
        status.textContent = 'No se pudo conectar con el servidor.';
        status.className = 'activate__status activate__status--error';
      });
    });

    $('logoutBtn').addEventListener('click', function () {
      Account.deactivate().then(function () {
        state.ownRates = {};
        renderOwnRateList();
        renderAccount();
      });
    });

    $('ownRateSave').addEventListener('click', function () {
      var cityId = $('ownCity').value;
      var price = parseFloat($('ownPrice').value);

      if (!cityId || !isFinite(price) || price <= 0) {
        alert('Elegí una ciudad y escribí un precio válido.');
        return;
      }

      Account.setOwnRate(cityId, price).then(function (ok) {
        if (!ok) {
          alert('No se pudo guardar. Revisá la conexión.');
          return;
        }
        state.ownRates[cityId] = price;
        $('ownPrice').value = '';
        renderOwnRateList();
      });
    });

    $('storeName').addEventListener('input', function () {
      global.localStorage.setItem('calcenvios.tienda', $('storeName').value.trim());
    });

    /* ---------- configuración del servidor ---------- */

    $('apiUrlInput').value = Account.apiUrl();

    $('apiUrlSave').addEventListener('click', function () {
      var url = Account.setApiUrl($('apiUrlInput').value);
      var status = $('apiUrlStatus');

      status.textContent = 'Guardando…';
      status.className = 'activate__status';

      /* Probamos la conexión para no dejar una dirección rota guardada. */
      Account.refresh().then(function () {
        if (Account.state.backendOnline) {
          status.textContent = 'Conectado: ' + (url || 'mismo dominio');
          status.className = 'activate__status activate__status--ok';
        } else {
          status.textContent = 'No se pudo conectar. Revisá la dirección.';
          status.className = 'activate__status activate__status--error';
        }
        renderAccount();
      });
    });

    $('exampleBtn').addEventListener('click', function () {
      $('city').value = 'valencia';
      $('zone').value = 'z2';
      $('weight').value = '1.5';
      $('unit').value = 'kg';
      $('declaredValue').value = '45';
      checkWeightLimit();
    });
  }

  function populateOwnCitySelect() {
    var options = global.CITIES.map(function (c) {
      return '<option value="' + c.id + '">' + escapeHtml(c.name) + '</option>';
    }).join('');
    $('ownCity').insertAdjacentHTML('beforeend', options);
  }

  function init() {
    populateSelects();
    populateOwnCitySelect();
    bindEvents();
    loadStoreName();

    /* Las tarifas y el dólar llegan juntos: la app arranca igual si fallan. */
    Promise.all([
      Rates.loadTariffs().then(function (tariffs) {
        global.CARRIERS = tariffs.carriers;
        global.INSURANCE = tariffs.insurance;
        state.tariffsDate = tariffs.updatedAt;
        showTariffAge(tariffs.updatedAt);
      }),
      Rates.fetchExchangeRate().then(function (rate) {
        if (rate) {
          state.exchange = rate;
        } else {
          showOffline();
        }
      }),
    ]).then(function () {
      state.ready = true;
      updateFooter();

      return Account.refresh();
    }).then(function () {
      renderAccount();

      if (Account.has('own_rates')) return loadOwnRates();
    }).then(function () {
      /* Venimos por un enlace compartido: calculamos de una vez. */
      if (loadFromHash()) {
        var fromLink = readForm();
        if (fromLink) render(fromLink, calculate(fromLink));
      }
    }).catch(function (error) {
      $('submitBtn').disabled = true;
      $('submitBtn').textContent = 'No se pudieron cargar las tarifas';
      console.error('Error cargando tarifas:', error);
    });
  }

  global.UI = {
    init: init,
    money: money,
    escapeHtml: escapeHtml,
  };

  document.addEventListener('DOMContentLoaded', init);
})(window);