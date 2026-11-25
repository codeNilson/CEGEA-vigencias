import { ORGAO } from '../orgao';
import { hrefDe } from '../contexto';

/** Assinatura institucional: Prefeitura / SEINF / setor (texto, sem reproduzir o brasão). */
export function Assinatura({ comApp = true, linkInicio = false }: { comApp?: boolean; linkInicio?: boolean }) {
  const identificacao = (
    <>
      <div className="assinatura-orgao">
        <small>PREFEITURA DE</small>
        <strong>FORTALEZA</strong>
      </div>
      <div className="assinatura-setor">
        <strong>{ORGAO.nome} ({ORGAO.sigla})</strong>
        <span>{ORGAO.setor}</span>
      </div>
    </>
  );
  return (
    <div className="assinatura">
      {linkInicio ? (
        <a className="assinatura-link" href={hrefDe({ tela: 'inicio' })} title="Ir para o Início">
          {identificacao}
        </a>
      ) : (
        identificacao
      )}
      {comApp && (
        <div className="assinatura-app">
          <strong>{ORGAO.sistema}</strong>
          <span>{ORGAO.descricao}</span>
        </div>
      )}
    </div>
  );
}
