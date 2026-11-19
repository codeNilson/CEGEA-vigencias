import { ORGAO } from '../orgao';

/** Assinatura institucional: Prefeitura / SEINF / setor (texto, sem reproduzir o brasão). */
export function Assinatura({ comApp = true }: { comApp?: boolean }) {
  return (
    <div className="assinatura">
      <div className="assinatura-orgao">
        <small>PREFEITURA DE</small>
        <strong>FORTALEZA</strong>
      </div>
      <div className="assinatura-setor">
        <strong>{ORGAO.nome} ({ORGAO.sigla})</strong>
        <span>{ORGAO.setor}</span>
      </div>
      {comApp && (
        <div className="assinatura-app">
          <strong>{ORGAO.sistema}</strong>
          <span>{ORGAO.descricao}</span>
        </div>
      )}
    </div>
  );
}
