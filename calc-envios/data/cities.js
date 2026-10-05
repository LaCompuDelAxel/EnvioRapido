/*
 * Ciudades de Venezuela agrupadas por zona logística.
 * La zona define el recargo de distancia que se aplica a cada agencia.
 * Para crecer: agregá el objeto { id, name, zone } y listo, el buscador lo toma solo.
 */
window.ZONES = {
  z1: { id: 'z1', name: 'Área metropolitana de Caracas', short: 'Zona 1' },
  z2: { id: 'z2', name: 'Región central', short: 'Zona 2' },
  z3: { id: 'z3', name: 'Costa, occidente y Andes', short: 'Zona 3' },
  z4: { id: 'z4', name: 'Oriente y nororiente', short: 'Zona 4' },
  z5: { id: 'z5', name: 'Llanos, Guayana y sur', short: 'Zona 5' },
};

window.CITIES = [
  // Zona 1
  { id: 'caracas', name: 'Caracas', zone: 'z1' },
  { id: 'los-teques', name: 'Los Teques', zone: 'z1' },
  { id: 'guarenas', name: 'Guarenas', zone: 'z1' },
  { id: 'guatire', name: 'Guatire', zone: 'z1' },
  { id: 'cua', name: 'Cúa', zone: 'z1' },
  { id: 'charallave', name: 'Charallave', zone: 'z1' },
  { id: 'ocumare', name: 'Ocumare del Tuy', zone: 'z1' },
  { id: 'santa-teresa', name: 'Santa Teresa del Tuy', zone: 'z1' },
  { id: 'carayaca', name: 'Carayaca', zone: 'z1' },
  // Zona 2
  { id: 'valencia', name: 'Valencia', zone: 'z2' },
  { id: 'maracay', name: 'Maracay', zone: 'z2' },
  { id: 'barquisimeto', name: 'Barquisimeto', zone: 'z2' },
  { id: 'puerto-cabello', name: 'Puerto Cabello', zone: 'z2' },
  { id: 'moron', name: 'Morón', zone: 'z2' },
  { id: 'turmero', name: 'Turmero', zone: 'z2' },
  { id: 'san-joaquin', name: 'San Joaquín', zone: 'z2' },
  // Zona 3
  { id: 'maracaibo', name: 'Maracaibo', zone: 'z3' },
  { id: 'coro', name: 'Coro', zone: 'z3' },
  { id: 'punto-fijo', name: 'Punto Fijo', zone: 'z3' },
  { id: 'valera', name: 'Valera', zone: 'z3' },
  { id: 'medellin-libertador', name: 'Mérida (Libertador)', zone: 'z3' },
  { id: 'san-cristobal', name: 'San Cristóbal', zone: 'z3' },
  { id: 'barinas', name: 'Barinas', zone: 'z3' },
  { id: 'trujillo', name: 'Trujillo', zone: 'z3' },
  { id: 'la-grita', name: 'La Grieta', zone: 'z3' },
  { id: 'tovar', name: 'Tovar', zone: 'z3' },
  // Zona 4
  { id: 'barcelona', name: 'Barcelona', zone: 'z4' },
  { id: 'puerto-la-cruz', name: 'Puerto La Cruz', zone: 'z4' },
  { id: 'cumana', name: 'Cumaná', zone: 'z4' },
  { id: 'maturin', name: 'Maturín', zone: 'z4' },
  { id: 'moca', name: 'Moca', zone: 'z4' },
  { id: 'carupano', name: 'Carúpano', zone: 'z4' },
  { id: 'porlamar', name: 'Porlamar', zone: 'z4' },
  { id: 'pampatar', name: 'Pampatar', zone: 'z4' },
  { id: 'anaco', name: 'Anaco', zone: 'z4' },
  { id: 'el-tigre', name: 'El Tigre', zone: 'z4' },
  { id: 'tucupita', name: 'Tucupita', zone: 'z4' },
  // Zona 5
  { id: 'ciudad-bolivar', name: 'Ciudad Bolívar', zone: 'z5' },
  { id: 'ciudad-guayana', name: 'Ciudad Guayana', zone: 'z5' },
  { id: 'upata', name: 'Upata', zone: 'z5' },
  { id: 'san-fernando-apure', name: 'San Fernando de Apure', zone: 'z5' },
  { id: 'gumaru', name: 'Guarare / Guárico', zone: 'z5' },
  { id: 'guanare', name: 'Guanare', zone: 'z5' },
  { id: 'san-juan-llanos', name: 'San Juan de los Llanos', zone: 'z5' },
  { id: 'calabozo', name: 'Calabozo', zone: 'z5' },
  { id: 'caripito', name: 'Caripito', zone: 'z5' },
  { id: 'san-antonio-barinas', name: 'San Antonio (Barinas)', zone: 'z5' },
];