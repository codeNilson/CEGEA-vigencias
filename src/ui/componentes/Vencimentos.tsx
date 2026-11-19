import { formatarData } from '../../dominio/datas';
import type { GrupoMes, LinhaDoc, LinhaOrdem } from '../../estado/seletores';
import { formatarQuantidade } from '../../dominio/numeros';
import { Prazo, SituacaoOrdemTag, TagTipo, cls } from './base';
import { irPara, useOrdemAberta } from '../contexto';

/** Vencimentos dos próximos 90 dias em colunas por mês, cada cartão identificado sem clique (RF13.1). */
export function VencimentosPorMes({ grupos }: { grupos: GrupoMes[] }) {
  return (
    <div className="meses" style={{ ['--n' as string]: grupos.length }}>
      {grupos.map((g) => (
        <section className="mes" key={g.chave}>
          <div className="mes-cab">
            <strong>{g.mes}</strong>
            <span>{g.ano}</span>
            <em>{g.itens.length}</em>
          </div>
          <div className="mes-corpo">
            {g.itens.length === 0 ? <div className="mes-vazio">Nenhum vencimento</div> : g.itens.map((l) => <CartaoDoc key={l.id} l={l} />)}
          </div>
        </section>
      ))}
    </div>
  );
}

export function CartaoDoc({ l }: { l: LinhaDoc }) {
  return (
    <button className={cls('cartao-doc', l.faixa)} onClick={() => irPara({ tela: l.tipo, id: l.id })}>
      <div className="cartao-doc-topo">
        <TagTipo tipo={l.tipo} />
        <span className="cartao-doc-numero">{l.numero}</span>
      </div>
      <div className="cartao-doc-objeto">{l.objeto || 'Sem objeto informado'}</div>
      {l.empresa && <div className="cartao-doc-empresa">{l.empresa}</div>}
      <div className="cartao-doc-rodape">
        <span className="num forte">{formatarData(l.vencimento)}</span>
        <Prazo dias={l.dias} s={l.situacao} />
      </div>
    </button>
  );
}

/** Cartão de OF/OS com itens e quantidades à vista. Abre o detalhe da própria ordem (RF10.9). */
export function CartaoOrdem({ o }: { o: LinhaOrdem }) {
  const abrir = useOrdemAberta((s) => s.abrir);
  const sigla = o.contrato.tipo === 'material' ? 'OF' : 'OS';
  return (
    <button className={cls('cartao-ordem', o.situacao)} onClick={() => abrir(o.contrato.id, o.ordem.id)}>
      <div className="cartao-ordem-topo">
        <span className="cartao-ordem-numero">{o.ordem.numero.startsWith(sigla) ? o.ordem.numero : `${sigla} ${o.ordem.numero}`}</span>
        <SituacaoOrdemTag s={o.situacao} />
      </div>
      <div className="cartao-ordem-meta">
        Contrato {o.contrato.numero} · {o.empresa}
      </div>
      <ul className="itens-ordem">
        {o.itens.slice(0, 3).map((it, i) => (
          <li key={i}>
            <span className="q num">{formatarQuantidade(it.quantidade)}</span>
            <span>
              {it.unidade && <span className="fraco">{it.unidade} · </span>}
              {it.descricao}
            </span>
          </li>
        ))}
        {o.itens.length > 3 && <li className="fraco">e mais {o.itens.length - 3} itens</li>}
      </ul>
      <div className="cartao-ordem-limite">
        Entrega até <span className="num">{formatarData(o.limite)}</span>
        {' · '}
        {o.dias < 0 ? `${-o.dias} ${o.dias === -1 ? 'dia' : 'dias'} de atraso` : o.dias === 0 ? 'hoje' : o.dias === 1 ? 'amanhã' : `em ${o.dias} dias`}
      </div>
    </button>
  );
}

/** Modo lista: os mesmos vencimentos em uma tabela ordenada por data. */
export function ListaVencimentos({ linhas }: { linhas: LinhaDoc[] }) {
  if (!linhas.length)
    return (
      <div className="tabela-caixa">
        <div className="vazio">Nenhum vencimento nos próximos 90 dias.</div>
      </div>
    );
  return (
    <div className="tabela-caixa">
      <table className="tabela">
        <thead>
          <tr>
            <th>Tipo</th>
            <th>Número</th>
            <th>Objeto</th>
            <th>Empresa</th>
            <th>Vencimento</th>
            <th>Prazo</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.id} className="clicavel" onClick={() => irPara({ tela: l.tipo, id: l.id })}>
              <td><TagTipo tipo={l.tipo} /></td>
              <td className="doc-numero">{l.numero}</td>
              <td style={{ maxWidth: 380 }}>{l.objeto || <span className="fraco">-</span>}</td>
              <td>{l.empresa || <span className="fraco">-</span>}</td>
              <td className="num">{formatarData(l.vencimento)}</td>
              <td><Prazo dias={l.dias} s={l.situacao} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
