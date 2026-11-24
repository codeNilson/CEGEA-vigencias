import { Fragment, useMemo, useState } from 'react';
import { buscarItensAtas, MINIMO_BUSCA_ITENS, type FiltroDocs, type ItemEncontrado } from '../../estado/seletores';
import { exportarItensEncontrados } from '../../exportacao/planilha';
import { formatarData } from '../../dominio/datas';
import { formatarQuantidade, formatarValorUnitario } from '../../dominio/numeros';
import { CabecalhoImpressao, cls, Paginacao, Prazo, Segmentado, Situacao, usePaginacao } from '../componentes/base';
import { FiltroEmpresa } from '../componentes/EscolhaEmpresa';
import { irPara, useLoja } from '../contexto';

/** O que muda entre "ARPs" e "Itens" na aba ARPs. */
export type ModoListaAtas = 'arps' | 'itens';

/**
 * Lembra a busca enquanto o sistema está aberto: abrir uma ARP e voltar mantém o que foi digitado.
 * Não vai para o localStorage: ao reabrir o sistema, começa limpa.
 */
export const memoriaBuscaItens = {
  modo: 'arps' as ModoListaAtas,
  busca: '',
  empresaId: '',
  filtro: 'vigentes' as FiltroDocs,
  soComSaldo: true,
};

function useLembrado<K extends keyof typeof memoriaBuscaItens>(k: K): [(typeof memoriaBuscaItens)[K], (v: (typeof memoriaBuscaItens)[K]) => void] {
  const [v, setV] = useState(memoriaBuscaItens[k]);
  return [
    v,
    (novo) => {
      memoriaBuscaItens[k] = novo;
      setV(novo);
    },
  ];
}

export function useModoListaAtas() {
  return useLembrado('modo');
}

export function EscolhaModo({ modo, muda }: { modo: ModoListaAtas; muda: (m: ModoListaAtas) => void }) {
  return (
    <div className="modo-lista nao-imprimir">
      <span>Procurar</span>
      <Segmentado<ModoListaAtas> valor={modo} muda={muda} opcoes={[['arps', 'ARPs'], ['itens', 'Itens em todas as ARPs']]} />
    </div>
  );
}

const POR_PAGINA = 20;

/** Revisão 9: procura um item em todas as ARPs, com fornecedor, valor e saldo, sem abrir uma por uma. */
export function BuscaItensAtas({ ordem, cabecalho }: { ordem: 'vencimento' | 'numero'; cabecalho: (acoes: { planilha: () => void; vazio: boolean }) => React.ReactNode }) {
  const atas = useLoja((e) => e.atas);
  const contratos = useLoja((e) => e.contratos);
  const empresas = useLoja((e) => e.empresas);
  const hoje = useLoja((e) => e.hoje);
  const [busca, setBusca] = useLembrado('busca');
  const [empresaId, setEmpresaId] = useLembrado('empresaId');
  const [filtro, setFiltro] = useLembrado('filtro');
  const [soComSaldo, setSoComSaldo] = useLembrado('soComSaldo');

  const curta = busca.trim().length < MINIMO_BUSCA_ITENS && !empresaId;
  const base = { atas, contratos, empresas, hoje };
  const consulta = { busca: curta ? '' : busca, empresaId, soComSaldo, ordem };
  const itens = useMemo(() => buscarItensAtas(base, { ...consulta, filtro }), [atas, contratos, empresas, hoje, busca, empresaId, soComSaldo, ordem, filtro, curta]);
  const contagens = useMemo(() => {
    const n = (f: FiltroDocs) => (curta ? undefined : buscarItensAtas(base, { ...consulta, filtro: f }).length);
    return { vigentes: n('vigentes'), vencendo: n('vencendo'), vencidos: n('vencidos'), todos: n('todos') };
  }, [atas, contratos, empresas, hoje, busca, empresaId, soComSaldo, curta]);
  const { itens: pagina, paginacao } = usePaginacao(itens, POR_PAGINA, [busca, empresaId, filtro, soComSaldo, ordem].join('|'));

  const fornecedores = useMemo(() => [...atas.values()].flatMap((a) => a.itens.flatMap((it) => it.parcelas.map((p) => p.empresaId))), [atas]);
  const opcao = (f: FiltroDocs, rotulo: string): [FiltroDocs, string] | [FiltroDocs, string, number] => {
    const q = contagens[f as keyof typeof contagens];
    return q === undefined ? [f, rotulo] : [f, rotulo, q];
  };
  const totalFornecedores = itens.reduce((s, it) => s + it.parcelas.length, 0);

  return (
    <>
      <CabecalhoImpressao titulo={`Itens das ARPs${busca.trim() ? `: "${busca.trim()}"` : ''}`} hoje={hoje} />
      {cabecalho({ planilha: () => exportarItensEncontrados(itens, hoje), vazio: itens.length === 0 })}
      <div className="filtros">
        <input
          className="entrada busca"
          autoFocus
          placeholder="Descrição do item ou fornecedor"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <FiltroEmpresa valor={empresaId} muda={setEmpresaId} empresas={empresas} ids={fornecedores} />
        <Segmentado<FiltroDocs>
          valor={filtro}
          muda={setFiltro}
          opcoes={[opcao('vigentes', 'ARPs vigentes'), opcao('vencendo', 'Vencendo em 90 dias'), opcao('vencidos', 'Vencidas'), opcao('todos', 'Todas')]}
        />
        <label className="marcar">
          <input type="checkbox" checked={soComSaldo} onChange={(e) => setSoComSaldo(e.target.checked)} /> Só com saldo
        </label>
      </div>

      <div className="tabela-caixa">
        {curta ? (
          <div className="vazio">Digite pelo menos {MINIMO_BUSCA_ITENS} letras da descrição do item, ou escolha um fornecedor.</div>
        ) : itens.length === 0 ? (
          <div className="vazio">
            Nenhum item encontrado.
            {(soComSaldo || filtro !== 'todos') && <> Tente {soComSaldo ? 'desmarcar "Só com saldo"' : ''}{soComSaldo && filtro !== 'todos' ? ' ou ' : ''}{filtro !== 'todos' ? 'escolher "Todas"' : ''}.</>}
          </div>
        ) : (
          <>
            <table className="tabela tabela-itens-arps">
              <thead>
                <tr>
                  <th>Fornecedor</th>
                  <th>Cota</th>
                  <th className="direita">Valor unitário</th>
                  <th className="direita">Quantidade registrada</th>
                  <th className="direita">Já contratada</th>
                  <th className="direita">Saldo disponível</th>
                </tr>
              </thead>
              <tbody>{pagina.map((it) => <ItemLinhas key={`${it.ataId}:${it.item.id}`} it={it} busca={busca.trim()} />)}</tbody>
            </table>
            <div className="nota-tabela">
              {itens.length} {itens.length === 1 ? 'item' : 'itens'} em {new Set(itens.map((i) => i.ataId)).size} ARP(s), {totalFornecedores}{' '}
              {totalFornecedores === 1 ? 'fornecedor' : 'fornecedores'}. Valor unitário em vigor hoje. Clique no item para abrir a ARP.
            </div>
          </>
        )}
      </div>
      <Paginacao {...paginacao} />
    </>
  );
}

function ItemLinhas({ it, busca }: { it: ItemEncontrado; busca: string }) {
  const abrir = () => irPara({ tela: 'ata', id: it.ataId, buscaItens: busca || it.item.descricao });
  return (
    <Fragment>
      <tr className="grupo clicavel" onClick={abrir}>
        <td colSpan={6}>
          <div className="item-arp">
            <span className="item-arp-desc">
              {it.item.descricao} {it.item.unidade && <span className="fraco pequeno">({it.item.unidade})</span>}
            </span>
            <span className="item-arp-doc">
              <span className="doc-numero">ARP {it.ataNumero}</span>
              <span className="num pequeno">vence {formatarData(it.vencimento)}</span>
              <Prazo dias={it.dias} s={it.situacao} />
              <Situacao s={it.situacao} tipo="ata" />
            </span>
          </div>
          {it.ataObjeto && <span className="sub">{it.ataObjeto}</span>}
        </td>
      </tr>
      {it.parcelas.map((p) => (
        <tr key={p.parcela.id} className="clicavel" onClick={abrir}>
          <td style={{ paddingLeft: 26 }}>{p.empresa}</td>
          <td>{p.parcela.tipoCota === 'ampla' ? 'Ampla' : <span className="tag">Cota ME/EPP</span>}</td>
          <td className="direita num">{formatarValorUnitario(p.valor)}</td>
          <td className="direita num">{formatarQuantidade(p.registrada)}</td>
          <td className="direita num">{formatarQuantidade(p.contratada)}</td>
          <td className={cls('direita num forte', p.saldo <= 0 && 'negativo')}>{formatarQuantidade(p.saldo)}</td>
        </tr>
      ))}
    </Fragment>
  );
}
