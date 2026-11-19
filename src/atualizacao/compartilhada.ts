import { compararVersoes, versaoValida } from './versao';

/**
 * Versão registrada no marcador da pasta de dados (_vigencias.json), compartilhado por todos (revisão 6).
 * - versaoApp: última versão do sistema que abriu a pasta.
 * - versaoMinima: versões abaixo dela não podem gravar, porque descartariam campos que não conhecem.
 */
export interface VersaoNaPasta {
  versaoApp?: string;
  versaoMinima?: string;
}

export type SituacaoVersao =
  | { tipo: 'ok' }
  /** Este arquivo é mais novo que o registrado: registrar (instalação manual ou primeira abertura). */
  | { tipo: 'registrar'; marcador: Required<VersaoNaPasta> }
  /** Outra pessoa atualizou o sistema; esta janela está com a versão antiga. */
  | { tipo: 'desatualizada'; versaoNaPasta: string };

export function situacaoVersao(marcador: unknown, versaoApp: string): SituacaoVersao {
  const m = (marcador && typeof marcador === 'object' ? marcador : {}) as VersaoNaPasta;
  const minima = versaoValida(m.versaoMinima) ? m.versaoMinima : '0.0.0';
  const registrada = versaoValida(m.versaoApp) ? m.versaoApp : '0.0.0';
  if (compararVersoes(versaoApp, minima) < 0) return { tipo: 'desatualizada', versaoNaPasta: compararVersoes(registrada, minima) > 0 ? registrada : minima };
  if (compararVersoes(versaoApp, registrada) > 0) return { tipo: 'registrar', marcador: { versaoApp, versaoMinima: versaoApp } };
  return { tipo: 'ok' };
}
