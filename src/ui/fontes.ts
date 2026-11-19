// Raleway variável com algarismos alinhados (equivale à Rawline do manual PMF). Embutida, sem internet.
import raleway from '@fontsource-variable/raleway/files/raleway-latin-wght-normal.woff2?url';

export function instalarFontes() {
  const s = document.createElement('style');
  s.textContent = `@font-face{font-family:'Raleway PMF';src:url(${raleway}) format('woff2');font-weight:100 900;font-style:normal;font-display:swap}`;
  document.head.appendChild(s);
}
