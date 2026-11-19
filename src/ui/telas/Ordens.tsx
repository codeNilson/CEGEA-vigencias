import { useEffect, useMemo, useRef, useState } from 'react';
import { todasOrdens } from '../../estado/seletores';
import { formatarData } from '../../dominio/datas';
import { formatarCentavos, formatarQuantidade, formatarValorUnitario, totalCentavos } from '../../dominio/numeros';
import { valorUnitarioEm } from '../../dominio/calculos';
import type { SituacaoOrdem } from '../../dominio/tipos';
import { CabecalhoImpressao, Segmentado, SituacaoOrdemTag, cls } from '../componentes/base';
import { irPara, loja, useLoja, useOrdemAberta, gravar } from '../contexto';
import { FormEntrega, FormOrdem, validarContratoSalvo } from './ContratoTela';

type Filtro = 'abertas' | SituacaoOrdem | 'todas';

/** RF10.10: todas as OF/OS, com itens e quantidades à vista. */
export function TelaOrdens() {
  const contratos = useLoja((e) => e.contratos);
  const empresas = useLoja((e) => e.empresas);
  const hoje = useLoja((e) => e.hoje);
  const abrir = useOrdemAberta((s) => s.abrir);
  const [filtro, setFiltro] = useState<Filtro>('abertas');
  const [busca, setBusca] = useState('');
  const todas = useMemo(() => todasOrdens({ contratos, empresas, hoje }), [contratos, empresas, hoje]);
  const passa = (s: SituacaoOrdem, f: Filtro) => f === 'todas' || (f === 'abertas' ? s !== 'entregue' : s === f);
  const n = (f: Filtro) => todas.filter((o) => passa(o.situacao, f)).length;
  const linhas = todas.filter((o) => {
    if (!passa(o.situacao, filtro)) return false;
    const t = busca.trim().toLowerCase();
    return !t || `${o.ordem.numero} ${o.contrato.numero} ${o.empresa} ${o.itens.map((i) => i.descricao).join(' ')}`.toLowerCase().includes(t);
  });

  return (
    <>
      <CabecalhoImpressao titulo="Ordens de fornecimento e de serviço" hoje={hoje} />
      <div className="pagina-titulo">
        <h1>OF/OS</h1>
        <p>Ordens de fornecimento (material) e de serviço</p>
        <div className="acoes">
          <button className="btn btn-mini" onClick={() => window.print()} disabled={!linhas.length}>PDF</button>
        </div>
      </div>
      <div className="filtros">
        <Segmentado<Filtro>
          valor={filtro}
          muda={setFiltro}
          opcoes={[
            ['abertas', 'Em aberto', n('abertas')],
            ['atrasada', 'Atrasadas', n('atrasada')],
            ['pendente', 'No prazo', n('pendente')],
            ['entregue', 'Entregues', n('entregue')],
            ['todas', 'Todas', todas.length],
          ]}
        />
        <input className="entrada busca" placeholder="Buscar número, contrato, empresa ou item" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>
      <div className="tabela-caixa">
        {linhas.length === 0 ? (
          <div className="vazio">Nenhuma OF/OS com esse filtro.</div>
        ) : (
          <table className="tabela">
            <thead>
              <tr>
                <th>Número</th>
                <th>Contrato</th>
                <th>Itens e quantidades</th>
                <th>Emissão</th>
                <th>Entrega até</th>
                <th>Situação</th>
                <th className="direita">Valor</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((o) => (
                <tr key={o.ordem.id} className="clicavel" onClick={() => abrir(o.contrato.id, o.ordem.id)}>
                  <td>
                    <span className="doc-numero">{o.ordem.numero}</span>
                    <span className="sub">{o.contrato.tipo === 'material' ? 'Fornecimento' : 'Serviço'}</span>
                  </td>
                  <td>
                    {o.contrato.numero}
                    <span className="sub">{o.empresa}</span>
                  </td>
                  <td className="itens-celula">
                    {o.itens.map((it, i) => (
                      <div key={i}>
                        <b className="num">{formatarQuantidade(it.quantidade)}</b> {it.unidade} · {it.descricao}
                      </div>
                    ))}
                  </td>
                  <td className="num">{formatarData(o.ordem.dataEmissao)}</td>
                  <td>
                    <span className="num">{formatarData(o.limite)}</span>
                    {o.ordem.dataEntrega && <span className="sub">entregue em {formatarData(o.ordem.dataEntrega)}</span>}
                  </td>
                  <td>
                    <SituacaoOrdemTag s={o.situacao} />
                  </td>
                  <td className="direita num">{formatarCentavos(o.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

/** RF10.9: detalhe da OF/OS num painel lateral, aberto de qualquer tela. */
export function GavetaOrdem() {
  const aberta = useOrdemAberta((s) => s.aberta);
  const fechar = useOrdemAberta((s) => s.fechar);
  const c = useLoja((e) => (aberta ? e.contratos.get(aberta.contratoId) : undefined));
  const empresas = useLoja((e) => e.empresas);
  const hoje = useLoja((e) => e.hoje);
  const [modal, setModal] = useState<null | 'editar' | 'entrega'>(null);
  const veu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || modal) return;
      const todos = document.querySelectorAll('.veu');
      if (todos[todos.length - 1] === veu.current) fechar();
    };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [fechar, modal]);

  if (!aberta) return null;
  const o = c?.ordens.find((x) => x.id === aberta.ordemId);
  if (!c || !o) {
    return (
      <div className="veu gaveta-veu" ref={veu} onMouseDown={(e) => e.target === e.currentTarget && fechar()}>
        <aside className="gaveta">
          <div className="gaveta-corpo vazio">Esta ordem não existe mais. Pode ter sido excluída por outro usuário.</div>
        </aside>
      </div>
    );
  }
  const linha = todasOrdens({ contratos: new Map([[c.id, c]]), empresas, hoje }).find((x) => x.ordem.id === o.id)!;
  const sigla = c.tipo === 'material' ? 'OF' : 'OS';

  return (
    <>
      <div className="veu gaveta-veu nao-imprimir" ref={veu} onMouseDown={(e) => e.target === e.currentTarget && fechar()}>
        <aside className="gaveta" role="dialog" aria-label={`Detalhe ${o.numero}`}>
          <div className="gaveta-cab">
            <div className="linha1">
              <span className="tag">{sigla === 'OF' ? 'Ordem de fornecimento' : 'Ordem de serviço'}</span>
              <SituacaoOrdemTag s={linha.situacao} />
              <button className="btn btn-leve" style={{ marginLeft: 'auto' }} onClick={fechar} aria-label="Fechar">✕</button>
            </div>
            <h3>{o.numero}</h3>
            <div>
              Contrato{' '}
              <a href={`#/contrato/${encodeURIComponent(c.id)}`} onClick={fechar}>{c.numero}</a> · {linha.empresa}
            </div>
          </div>
          <div className="gaveta-corpo">
            <dl className="prazo-caixa">
              <div><dt>Emissão</dt><dd className="num">{formatarData(o.dataEmissao)}</dd></div>
              <div><dt>Prazo</dt><dd>{o.prazoDias} {o.tipoPrazo === 'uteis' ? 'dias úteis' : 'dias corridos'}</dd></div>
              <div><dt>Entrega até</dt><dd className={cls('num', linha.situacao === 'atrasada' && 'negativo')}>{formatarData(linha.limite)}</dd></div>
              <div><dt>Entregue em</dt><dd className="num">{o.dataEntrega ? formatarData(o.dataEntrega) : <span className="fraco">-</span>}</dd></div>
            </dl>
            {linha.situacao === 'atrasada' && <p className="nota" style={{ borderLeftColor: 'var(--laranja)' }}>Atrasada há {-linha.dias} {linha.dias === -1 ? 'dia' : 'dias'}.</p>}
            {(() => {
              const emp = empresas.get(c.empresaId);
              if (!emp?.telefone && !emp?.email) return null;
              return (
                <p className="nota">
                  Contato de {emp.nome}: {emp.telefone && <b className="num">{emp.telefone}</b>}
                  {emp.telefone && emp.email && ' · '}
                  {emp.email && <a href={`mailto:${emp.email}`}>{emp.email}</a>}
                </p>
              );
            })()}
            <table className="sub-tabela">
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="direita">Quantidade</th>
                  <th className="direita">Valor unitário</th>
                  <th className="direita">Total</th>
                </tr>
              </thead>
              <tbody>
                {o.itens.map((it) => {
                  const item = c.itens.find((x) => x.id === it.itemId);
                  const v = valorUnitarioEm(c, it.itemId, o.dataEmissao);
                  return (
                    <tr key={it.itemId}>
                      <td>{item?.descricao ?? '(item removido)'}</td>
                      <td className="direita num"><b>{formatarQuantidade(it.quantidade)}</b> <span className="fraco">{item?.unidade}</span></td>
                      <td className="direita num">{formatarValorUnitario(v)}</td>
                      <td className="direita num">{formatarCentavos(totalCentavos(it.quantidade, v))}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} className="forte">Total da {sigla}</td>
                  <td className="direita num forte">{formatarCentavos(linha.valor)}</td>
                </tr>
              </tfoot>
            </table>
            <p className="pequeno fraco" style={{ marginTop: 8 }}>Valores unitários vigentes na data de emissão.</p>
            {o.observacoes && (
              <>
                <h4 style={{ margin: '18px 0 4px', color: 'var(--petroleo)' }}>Observações</h4>
                <p style={{ margin: 0 }}>{o.observacoes}</p>
              </>
            )}
          </div>
          <div className="gaveta-rodape">
            {!o.dataEntrega && !c.encerramento && <button className="btn btn-primario" onClick={() => setModal('entrega')}>Registrar entrega</button>}
            {o.dataEntrega && (
              <button
                className="btn"
                onClick={async () => {
                  const a = loja.getState().contratos.get(c.id) ?? c;
                  await gravar({ ...a, ordens: a.ordens.map((x) => (x.id === o.id ? { ...x, dataEntrega: null } : x)) }, validarContratoSalvo, 'Entrega desfeita.');
                }}
              >
                Desfazer entrega
              </button>
            )}
            <button className="btn" onClick={() => setModal('editar')} disabled={!!c.encerramento}>Editar</button>
            <span style={{ flex: 1 }} />
            <button className="btn btn-leve" onClick={() => { fechar(); irPara({ tela: 'contrato', id: c.id }); }}>Abrir contrato</button>
          </div>
        </aside>
      </div>
      {modal === 'editar' && <FormOrdem contrato={c} ordem={o} aoFechar={() => setModal(null)} />}
      {modal === 'entrega' && <FormEntrega contrato={c} ordem={o} aoFechar={() => setModal(null)} />}
    </>
  );
}
