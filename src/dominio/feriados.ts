import { dataISO, diaDaSemana, somarDias } from './datas';

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher, calendário gregoriano). */
export function pascoa(ano: number): string {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return dataISO(ano, mes, dia);
}

/** Lista fixa do RF11 (requisitos.md). Ajustar aqui após validação do setor (P05). */
const FIXOS: Array<[mes: number, dia: number, nome: string]> = [
  [1, 1, 'Confraternização Universal'],
  [3, 19, 'São José (CE)'],
  [3, 25, 'Data Magna do Ceará'],
  [4, 21, 'Tiradentes'],
  [5, 1, 'Dia do Trabalho'],
  [8, 15, 'Nossa Senhora da Assunção (Fortaleza)'],
  [9, 7, 'Independência'],
  [10, 12, 'Nossa Senhora Aparecida'],
  [11, 2, 'Finados'],
  [11, 15, 'Proclamação da República'],
  [11, 20, 'Consciência Negra'],
  [12, 25, 'Natal'],
];

const cache = new Map<number, Map<string, string>>();

/** Mapa data -> nome do feriado, para o ano informado. */
export function feriados(ano: number): Map<string, string> {
  const pronto = cache.get(ano);
  if (pronto) return pronto;
  const mapa = new Map<string, string>();
  for (const [m, d, nome] of FIXOS) mapa.set(dataISO(ano, m, d), nome);
  const p = pascoa(ano);
  mapa.set(somarDias(p, -48), 'Carnaval (segunda)');
  mapa.set(somarDias(p, -47), 'Carnaval (terça)');
  mapa.set(somarDias(p, -2), 'Sexta-feira Santa');
  mapa.set(somarDias(p, 60), 'Corpus Christi');
  cache.set(ano, mapa);
  return mapa;
}

export function ehFeriado(iso: string): boolean {
  return feriados(Number(iso.slice(0, 4))).has(iso);
}

export function ehDiaUtil(iso: string): boolean {
  const s = diaDaSemana(iso);
  return s !== 0 && s !== 6 && !ehFeriado(iso);
}
