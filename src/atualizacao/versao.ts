/** Versão deste arquivo HTML, vinda do package.json no build (vite.config.ts, `define`). */
declare const __VERSAO_APP__: string;
export const VERSAO_APP: string = typeof __VERSAO_APP__ === 'string' ? __VERSAO_APP__ : '0.0.0';

/** Compara versões "1.2.3". Negativo se a < b, zero se iguais, positivo se a > b. Texto inválido conta como 0.0.0. */
export function compararVersoes(a: string, b: string): number {
  const p = (v: string) => {
    const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec(v.trim());
    return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [0, 0, 0];
  };
  const [x, y] = [p(a), p(b)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}

export const versaoValida = (v: unknown): v is string => typeof v === 'string' && /^\d+\.\d+\.\d+$/.test(v);
