/** "hace un momento", "hace 5 min", "hace 2 h", "hace 3 días". */
export function haceCuanto(iso: string, ahora: Date = new Date()): string {
  const minutos = Math.floor((ahora.getTime() - new Date(iso).getTime()) / 60_000);
  if (minutos < 1) return "hace un momento";
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  return `hace ${dias} ${dias === 1 ? "día" : "días"}`;
}

/** ["7", "8", "9"] → "7, 8 y 9". */
export function listaConY(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

/** Iniciales para el avatar: "María Pérez Vera" → "MP". */
export function iniciales(nombres: string, apellidos: string): string {
  return `${nombres.trim().charAt(0)}${apellidos.trim().charAt(0)}`.toUpperCase();
}

/** Muestra solo los últimos 4 dígitos de la cédula. */
export function cedulaOculta(cedula: string): string {
  return `•••••• ${cedula.slice(-4)}`;
}
