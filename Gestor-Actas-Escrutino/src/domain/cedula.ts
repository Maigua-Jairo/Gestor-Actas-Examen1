export function validarCedulaEcuatoriana(cedula: string): boolean {
  if (!/^\d{10}$/.test(cedula)) {
    return false;
  }

  const provincia = Number(cedula.slice(0, 2));
  if (provincia < 1 || (provincia > 24 && provincia !== 30)) {
    return false;
  }

  const tercerDigito = Number(cedula[2]);
  if (tercerDigito > 5) {
    return false;
  }

  const digitos = cedula.split("").map(Number);
  let suma = 0;

  for (let i = 0; i < 9; i += 1) {
    if (i % 2 === 0) {
      const valor = digitos[i] * 2;
      suma += valor > 9 ? valor - 9 : valor;
    } else {
      suma += digitos[i];
    }
  }

  const digitoVerificador = (10 - (suma % 10)) % 10;
  return digitoVerificador === digitos[9];
}