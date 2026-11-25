export type RolUsuario =
  | "provincial"
  | "recinto"
  | "veedor";

export type RolCreable = "recinto" | "veedor";

export function puedeCrearCuenta(
  creador: RolUsuario,
  rolSolicitado: RolCreable,
): boolean {
  return (
    (creador === "provincial" && rolSolicitado === "recinto") ||
    (creador === "recinto" && rolSolicitado === "veedor")
  );
}