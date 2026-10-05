/*
 * Tarifas embebidas: son el respaldo cuando la app se abre con doble clic
 * y el navegador no deja leer data/tarifas.json.
 *
 * Para producción, editá data/tarifas.json y no este archivo.
 *
 * IMPORTANTE: estos valores son estimaciones de referencia, no precios
 * oficiales. Confirmá cada número con la agencia antes de cobrarle a
 * un cliente.
 */
window.TARIFFS_DATE = '2026-10-05';

window.CARRIERS = [
  {
    id: 'zoom',
    name: 'Zoom',
    tagline: 'Aéreo express, entrega en oficina o a domicilio',
    accent: '#7C3AED',
    volumetric: 5000, // cm³ por cada kg
    maxKg: 30,
    minCharge: 2.0,
    eta: { z1: '1 día hábil', z2: '1-2 días', z3: '2-3 días', z4: '2-3 días', z5: '3-4 días' },
    zones: {
      z1: { base: 2.0, perKg: 0.8 },
      z2: { base: 3.0, perKg: 1.1 },
      z3: { base: 4.5, perKg: 1.6 },
      z4: { base: 4.0, perKg: 1.5 },
      z5: { base: 5.0, perKg: 1.8 },
    },
  },
  {
    id: 'group-cargo',
    name: 'Group Cargo',
    tagline: 'Terrestre por总线 de comisión, la opción más económica',
    accent: '#0E7490',
    volumetric: 6000,
    maxKg: 30,
    minCharge: 1.8,
    eta: { z1: '2-3 días', z2: '2-4 días', z3: '3-5 días', z4: '3-5 días', z5: '4-6 días' },
    zones: {
      z1: { base: 1.8, perKg: 0.65 },
      z2: { base: 2.6, perKg: 0.95 },
      z3: { base: 4.0, perKg: 1.45 },
      z4: { base: 3.6, perKg: 1.35 },
      z5: { base: 4.6, perKg: 1.7 },
    },
  },
  {
    id: 'mrw',
    name: 'MRW',
    tagline: 'El más rápido, ideal para paquetes urgentes',
    accent: '#B91C1C',
    volumetric: 4000, // área, el volúmetro pesa más
    maxKg: 25,
    minCharge: 4.0,
    eta: { z1: '24 horas', z2: '24-48 horas', z3: '48-72 horas', z4: '48-72 horas', z5: '3-4 días' },
    zones: {
      z1: { base: 4.0, perKg: 1.6 },
      z2: { base: 5.0, perKg: 2.0 },
      z3: { base: 6.5, perKg: 2.6 },
      z4: { base: 6.0, perKg: 2.5 },
      z5: { base: 7.0, perKg: 2.8 },
    },
  },
  {
    id: 'packnet',
    name: 'Packnet',
    tagline: 'Aéreo nacional, buen equilibrio precio/tiempo',
    accent: '#15803D',
    volumetric: 4500,
    maxKg: 25,
    minCharge: 3.2,
    eta: { z1: '1-2 días', z2: '2 días', z3: '2-3 días', z4: '2-3 días', z5: '3-4 días' },
    zones: {
      z1: { base: 3.2, perKg: 1.3 },
      z2: { base: 4.2, perKg: 1.7 },
      z3: { base: 5.5, perKg: 2.2 },
      z4: { base: 5.2, perKg: 2.1 },
      z5: { base: 6.0, perKg: 2.4 },
    },
  },
];

/* Seguro de transporte (mismo para todas las agencias del MVP). */
window.INSURANCE = {
  rate: 0.03,      // 3% del valor declarado
  min: 0.5,        // mínimo cobrar
  freeUpTo: 50,    // monto declarado sin costo
};