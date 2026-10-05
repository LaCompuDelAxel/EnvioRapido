/*
 * Motor de cálculo. Sin dependencias, sin framework.
 * Todas las funciones son puras: reciben datos, devuelven un resultado.
 */
(function (global) {
  'use strict';

  var carriers = global.CARRIERS;
  var insurance = global.INSURANCE;
  var zones = global.ZONES;

  function findCarrier(id) {
    for (var i = 0; i < carriers.length; i++) {
      if (carriers[i].id === id) return carriers[i];
    }
    return null;
  }

  /* Redondeo comercial: los precios se ajustan en pasos de 0,05 USD. */
  function round5(value) {
    return Math.round(value * 20) / 20;
  }

  /*
   * Peso volumétrico: las agencias cobran por volumen, no solo por peso real.
   * Ej: caja de 40x30x20 cm con divisor 5000 => 24000/5000 = 4,8 kg.
   */
  function volumetricWeight(lengthCm, widthCm, heightCm, divisor) {
    if (!lengthCm || !widthCm || !heightCm) return 0;
    return (lengthCm * widthCm * heightCm) / divisor;
  }

  /*
   * Calcula el precio de un envío en una agencia.
   *
   * input: {
   *   carrierId, zoneId, weightKg,
   *   dims: { length, width, height } | null,
   *   declaredValue: number | null,
   *   declaredCurrency: 'USD' | 'VES',
   *   isDeliveryOwn: boolean,
   *   ownRate: number | null,   // tarifa fija del delivery propio (Premium)
   * }
   */
  function quote(input) {
    var carrier = findCarrier(input.carrierId);
    if (!carrier) return null;

    var zone = zones[input.zoneId];
    var zoneRate = carrier.zones[input.zoneId];
    if (!zoneRate) return null;

    var realKg = Math.max(0, input.weightKg || 0);
    var volKg = input.dims
      ? volumetricWeight(input.dims.length, input.dims.width, input.dims.height, carrier.volumetric)
      : 0;

    var billableKg = Math.max(realKg, volKg);
    var byVolume = volKg > realKg;

    var shipping = round5(zoneRate.base + billableKg * zoneRate.perKg);

    /* Tarifa fija del delivery propio: ignora el tarifario de la agencia. */
    if (input.isDeliveryOwn && input.ownRate != null) {
      shipping = round5(input.ownRate);
    }

    var minApplied = false;
    if (!input.isDeliveryOwn && shipping < carrier.minCharge) {
      shipping = carrier.minCharge;
      minApplied = true;
    }

    /* Seguro: solo sobre lo que excede el monto cubierto gratis. */
    var insuranceCost = 0;
    var insuredBase = 0;
    if (input.declaredValue && input.declaredValue > 0) {
      insuredBase = Math.max(0, input.declaredValue - insurance.freeUpTo);
      insuranceCost = Math.max(insurance.min, round5(insuredBase * insurance.rate));
    }

    var overMaxKg = billableKg > carrier.maxKg;
    var total = round5(shipping + insuranceCost);

    return {
      carrierId: carrier.id,
      carrierName: carrier.name,
      accent: carrier.accent,
      tagline: carrier.tagline,
      eta: carrier.eta[input.zoneId] || 'Consultar',
      zoneName: zone ? zone.name : '',
      realKg: realKg,
      volumetricKg: volKg,
      billableKg: billableKg,
      billedByVolume: byVolume,
      breakdown: {
        base: zoneRate.base,
        perKg: zoneRate.perKg,
        shipping: shipping,
        minApplied: minApplied,
        insurance: insuranceCost,
        total: total,
      },
      overMaxKg: overMaxKg,
      unavailable: overMaxKg,
    };
  }

  /*
   * Compara todas las agencias y devuelve la lista ordenada por precio.
   * Así el vendedor ve de un vistazo cuál es la más barata.
   */
  function compare(input) {
    var results = [];
    for (var i = 0; i < carriers.length; i++) {
      var q = quote({
        carrierId: carriers[i].id,
        zoneId: input.zoneId,
        weightKg: input.weightKg,
        dims: input.dims,
        declaredValue: input.declaredValue,
        isDeliveryOwn: false,
      });
      if (q) results.push(q);
    }
    results.sort(function (a, b) {
      return a.breakdown.total - b.breakdown.total;
    });
    if (results.length) {
      results[0].isCheapest = true;
      results[results.length - 1].isMostExpensive = true;
    }
    return results;
  }

  global.Pricing = {
    quote: quote,
    compare: compare,
    volumetricWeight: volumetricWeight,
    findCarrier: findCarrier,
  };
})(window);