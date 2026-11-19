import { Fragment, useState, type ReactNode } from 'react';
import { filtrarLancamento } from '../../estado/seletores';
import { useImprimindo } from './base';

/** A partir deste número de linhas aparecem busca, "só os preenchidos" e rolagem interna. */
export const LIMITE_FILTRO_LANCAMENTO = 8;

/**
 * Tabela de lançamento dentro de modal (OF/OS, aditivos): uma linha por item, com campos para
 * preencher. Com muitas linhas, ganha busca, opção de ver só as preenchidas e rolagem com
 * cabeçalho fixo. O filtro só esconde linhas: o que já foi digitado continua valendo (revisão 7).
 */
export function TabelaLancamento<T>({
  linhas,
  chave,
  textoBusca,
  preenchida,
  cabecalho,
  linha,
  grupo,
  colunas,
  filtroExtra,
  controlesExtras,
  placeholderBusca = 'Buscar item',
}: {
  linhas: T[];
  chave: (l: T) => string;
  textoBusca: (l: T) => string;
  preenchida: (l: T) => boolean;
  /** Conteúdo do <tr> do cabeçalho. */
  cabecalho: ReactNode;
  /** Conteúdo do <tr> da linha (as células). */
  linha: (l: T) => ReactNode;
  /** Título de grupo; linhas do mesmo grupo devem vir juntas. */
  grupo?: (l: T) => string;
  /** Número de colunas, para a linha de grupo e a de "nada encontrado". */
  colunas: number;
  /** Filtro adicional (ex.: fornecedor), aplicado junto com a busca. */
  filtroExtra?: (l: T) => boolean;
  /** Controles ao lado da busca (ex.: escolha do fornecedor). */
  controlesExtras?: ReactNode;
  placeholderBusca?: string;
}) {
  const [busca, setBusca] = useState('');
  const [soPreenchidas, setSoPreenchidas] = useState(false);
  const imprimindo = useImprimindo();
  const muitas = linhas.length > LIMITE_FILTRO_LANCAMENTO;
  const nPreenchidas = linhas.filter(preenchida).length;
  const visiveis = muitas && !imprimindo ? filtrarLancamento(linhas, { busca, soPreenchidas, textoBusca, preenchida, filtroExtra }) : linhas;
  const ocultas = nPreenchidas - visiveis.filter(preenchida).length;
  let grupoAnterior: string | undefined;

  return (
    <div className="lancamento">
      {muitas && (
        <div className="lancamento-filtros">
          <input
            className="entrada busca"
            placeholder={placeholderBusca}
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && e.preventDefault() /* não envia o formulário */}
            aria-label={placeholderBusca}
          />
          {controlesExtras}
          <label className="marcar">
            <input type="checkbox" checked={soPreenchidas} onChange={(e) => setSoPreenchidas(e.target.checked)} /> Só os preenchidos
          </label>
          <span className="lancamento-contagem num">
            {visiveis.length === linhas.length ? `${linhas.length} linhas` : `${visiveis.length} de ${linhas.length}`} · {nPreenchidas}{' '}
            {nPreenchidas === 1 ? 'preenchida' : 'preenchidas'}
          </span>
        </div>
      )}
      <div className={muitas ? 'lancamento-rolagem' : undefined}>
        <table className="sub-tabela">
          <thead>
            <tr>{cabecalho}</tr>
          </thead>
          <tbody>
            {visiveis.map((l) => {
              const g = grupo?.(l);
              const titulo = g !== undefined && g !== grupoAnterior ? g : null;
              grupoAnterior = g;
              return (
                <Fragment key={chave(l)}>
                  {titulo !== null && (
                    <tr className="grupo">
                      <td colSpan={colunas}>{titulo}</td>
                    </tr>
                  )}
                  <tr>{linha(l)}</tr>
                </Fragment>
              );
            })}
            {visiveis.length === 0 && (
              <tr>
                <td colSpan={colunas} className="fraco">
                  {soPreenchidas && !busca.trim() ? 'Nenhuma linha preenchida ainda.' : 'Nada encontrado com esse filtro.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {ocultas > 0 && (
        <p className="pequeno lancamento-oculto">
          {ocultas === 1 ? '1 linha preenchida está fora do filtro e também será salva.' : `${ocultas} linhas preenchidas estão fora do filtro e também serão salvas.`}
        </p>
      )}
    </div>
  );
}
