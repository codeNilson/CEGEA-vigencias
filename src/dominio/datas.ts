/** Datas sempre como 'AAAA-MM-DD'. Cálculos em UTC para não sofrer com fuso ou horário de verão. */

const DIA_MS = 86_400_000;

function paraUTC(iso: string): number {
  const [a, m, d] = iso.split('-').map(Number);
  return Date.UTC(a, m - 1, d);
}

function deUTC(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Data de hoje no relógio local do computador. */
export function hojeISO(agora: Date = new Date()): string {
  const a = agora.getFullYear();
  const m = String(agora.getMonth() + 1).padStart(2, '0');
  const d = String(agora.getDate()).padStart(2, '0');
  return `${a}-${m}-${d}`;
}

export function somarDias(iso: string, dias: number): string {
  return deUTC(paraUTC(iso) + dias * DIA_MS);
}

/** b - a, em dias de calendário. */
export function diferencaDias(a: string, b: string): number {
  return Math.round((paraUTC(b) - paraUTC(a)) / DIA_MS);
}

/** 0 = domingo ... 6 = sábado. */
export function diaDaSemana(iso: string): number {
  return new Date(paraUTC(iso)).getUTCDay();
}

export function dataISO(ano: number, mes: number, dia: number): string {
  return deUTC(Date.UTC(ano, mes - 1, dia));
}

export function formatarData(iso: string | null | undefined): string {
  if (!iso) return '';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

export function ehDataValida(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  return deUTC(paraUTC(iso)) === iso;
}
