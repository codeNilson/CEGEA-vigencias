import { useMemo, useState } from 'react';
import {
  acharParcela,
  dataFimVigenteContrato,
  diasRestantes,
  emitidoNoPeriodo,
  historicoValores,
  periodoDaData,
  quantidadeItemEm,
  saldoItem,
  situacaoContrato,
  valorOrdem,
  valorTotalContrato,
  valorUnitarioEm,
  valorParcelaEm,
  reequilibriosPosterioresAoContrato,
  efeitoReequilibrioAta,
} from '../../dominio/calculos';
import { formatarData, hojeISO, somarDias } from '../../dominio/datas';
import { novoContrato, novoId } from '../../dominio/fabrica';
import {
  formatarCentavos,
  formatarQuantidade,
  formatarValorUnitario,
  lerQuantidade,
  lerValor,
  textoQuantidade,
  textoValor,
  totalCentavos,
} from '../../dominio/numeros';
import { dataLimite, dataLimiteOrdem, situacaoOrdem } from '../../dominio/prazos';
import type { AditivoContrato, Contrato, ItemContrato, Ordem, Parcela } from '../../dominio/tipos';
import { validarAditivoContrato, validarContrato, validarEncerramento, validarOrdem } from '../../dominio/validacoes';
import { aditivosDoItemContrato, dependentesDoContrato, dependentesDoItemContrato } from '../../dominio/dependencias';
import { exportarContrato } from '../../exportacao/planilha';
import {
  CabecalhoImpressao,
  Campo,
  Dado,
  Entrada,
  EntradaData,
  EntradaMoeda,
  EntradaNumero,
  EntradaQuantidade,
  ModalForm,
  Segmentado,
  Prazo,
  Situacao,
  SituacaoOrdemTag,
  TagTipo,
  cls,
  useConfirmacao,
} from '../componentes/base';
import { gravar, irPara, loja, useLoja, useOrdemAberta } from '../contexto';
import type { EstadoLoja } from '../../estado/loja';
import { FormEmpresa } from './Empresas';
import { EscolhaEmpresa } from '../componentes/EscolhaEmpresa';
import { EscolhaBusca, type OpcaoBusca } from '../componentes/EscolhaBusca';
import { TabelaLancamento } from '../componentes/TabelaLancamento';
import { objetoAta } from '../../dominio/texto';
import { atasParaContrato, parcelasParaItemContrato } from '../../estado/seletores';

const validar = (r: unknown, e: EstadoLoja) => {
  const c = r as Contrato;
  return validarContrato(c, e.contratos.values(), e.atas, e.contratos.get(c.id));
};
export const validarContratoSalvo = validar;
const atual = (c: Contrato) => loja.getState().contratos.get(c.id) ?? c;
const rotuloOrdem = (c: Contrato) => (c.tipo === 'material' ? 'OF' : 'OS');

// ---------- Formulário do contrato ----------

export function FormContrato({ contrato, aoFechar, ataInicial }: { contrato?: Contrato; aoFechar: () => void; ataInicial?: string }) {
  const empresas = useLoja((e) => e.empresas);
  const atas = useLoja((e) => e.atas);
  const hoje = useLoja((e) => e.hoje);
  const base = contrato ?? novoContrato({ ataId: ataInicial ?? null });
  const [f, setF] = useState({
    numero: base.numero,
    empresaId: base.empresaId,
    tipo: base.tipo,
    objeto: base.objeto,
    ataId: base.ataId ?? '',
    dataInicio: base.dataInicio,
    dataFim: base.dataFim,
    gestor: base.gestor,
    fiscal: base.fiscal,
    observacoes: base.observacoes,
  });
  const [novaEmpresa, setNovaEmpresa] = useState<string | null>(null);
  const m = <K extends keyof typeof f>(k: K) => (v: (typeof f)[K]) => setF({ ...f, [k]: v });
  const nomeEmpresa = f.empresaId ? empresas.get(f.empresaId)?.nome : undefined;
  const listaAtas = useMemo(() => atasParaContrato(atas.values(), f.empresaId, hoje), [atas, f.empresaId, hoje]);
  const opcoesAta = useMemo<OpcaoBusca[]>(() => {
    const titulo = { empresa: `Com itens de ${nomeEmpresa ?? 'esta empresa'}`, vigentes: nomeEmpresa ? 'Outras ARPs vigentes' : 'Vigentes', vencidas: 'Vencidas' };
    return listaAtas.map((o) => ({
      id: o.ata.id,
      rotulo: [o.ata.numero, objetoAta(o.ata)].filter(Boolean).join(' · '),
      sub: [
        `${o.situacao === 'vigente' ? 'vence em' : 'venceu em'} ${formatarData(o.vencimento)}`,
        o.itensDaEmpresa > 0 && `${o.itensDaEmpresa} ${o.itensDaEmpresa === 1 ? 'item' : 'itens'} desta empresa`,
      ].filter(Boolean).join(' · '),
      grupo: titulo[o.grupo],
    }));
  }, [listaAtas, nomeEmpresa]);
  const ataEscolhida = listaAtas.find((o) => o.ata.id === f.ataId);
  const avisoAta =
    ataEscolhida && f.empresaId && ataEscolhida.itensDaEmpresa === 0
      ? 'A empresa escolhida não é fornecedora de nenhum item desta ARP.'
      : ataEscolhida?.situacao === 'vencido'
        ? `ARP vencida em ${formatarData(ataEscolhida.vencimento)}.`
        : 'Deixe sem ARP para contratos por dispensa ou outra modalidade.';
  const travado = !!contrato && contrato.itens.length > 0;

  return (
    <>
      <ModalForm
        largo
        titulo={contrato ? `Editar contrato ${contrato.numero}` : 'Novo contrato'}
        aoFechar={aoFechar}
        aoSalvar={async () => {
          const reg: Contrato = { ...(contrato ? atual(contrato) : base), ...f, numero: f.numero.trim(), ataId: f.ataId || null };
          const erros = await gravar(reg, validar);
          if (!erros.length && !contrato) irPara({ tela: 'contrato', id: reg.id });
          return erros;
        }}
      >
        <div className="grade g4">
          <Campo rotulo="Número do contrato">
            <Entrada valor={f.numero} muda={m('numero')} autoFocus placeholder="000/2026" />
          </Campo>
          <Campo rotulo="Tipo">
            <Segmentado<Contrato['tipo']>
              valor={f.tipo}
              muda={m('tipo')}
              opcoes={[
                ['material', 'Material'],
                ['servico', 'Serviço'],
              ]}
            />
          </Campo>
          <Campo rotulo="Empresa" className="span2" dica={travado ? 'Para trocar a empresa, remova antes os itens vindos da ARP.' : undefined}>
            <EscolhaEmpresa valor={f.empresaId} muda={m('empresaId')} empresas={empresas} aoNova={(t) => setNovaEmpresa(t)} desabilitado={travado} />
          </Campo>
          <Campo rotulo="Objeto" className="span-todo">
            <Entrada valor={f.objeto} muda={m('objeto')} />
          </Campo>
          <Campo rotulo="ARP (Ata de Registro de Preços)" className="span2" dica={avisoAta}>
            <EscolhaBusca valor={f.ataId} muda={m('ataId')} opcoes={opcoesAta} semEscolha="Sem ARP" placeholder="Digite o número ou o objeto…" nomePlural="ARPs" duasLinhas />
          </Campo>
          <Campo rotulo="Início da vigência">
            <EntradaData valor={f.dataInicio} muda={m('dataInicio')} />
          </Campo>
          <Campo rotulo="Vencimento" dica={contrato?.aditivos.some((a) => a.tipo === 'prazo') ? 'Data original. Prorrogações ficam nos aditivos.' : undefined}>
            <EntradaData valor={f.dataFim} muda={m('dataFim')} />
          </Campo>
          <Campo rotulo="Gestor" className="span2">
            <Entrada valor={f.gestor} muda={m('gestor')} />
          </Campo>
          <Campo rotulo="Fiscal" className="span2">
            <Entrada valor={f.fiscal} muda={m('fiscal')} />
          </Campo>
          <Campo rotulo="Observações" className="span-todo">
            <textarea className="entrada" value={f.observacoes} onChange={(e) => m('observacoes')(e.target.value)} />
          </Campo>
        </div>
      </ModalForm>
      {novaEmpresa !== null && (
        <FormEmpresa
          nomeInicial={novaEmpresa}
          aoFechar={() => setNovaEmpresa(null)}
          aoSalvo={(e) => {
            m('empresaId')(e.id);
            setNovaEmpresa(null);
          }}
        />
      )}
    </>
  );
}

// ---------- Itens ----------

function FormItemContrato({ contrato, item, aoFechar }: { contrato: Contrato; item?: ItemContrato; aoFechar: () => void }) {
  const ata = useLoja((e) => (contrato.ataId ? e.atas.get(contrato.ataId) : undefined));
  const contratos = useLoja((e) => e.contratos);
  const [parcelaId, setParcelaId] = useState(item?.parcelaId ?? '');
  const [descricao, setDescricao] = useState(item?.descricao ?? '');
  const [unidade, setUnidade] = useState(item?.unidade ?? '');
  const [qtd, setQtd] = useState(item ? textoQuantidade(item.quantidade) : '');
  const [valor, setValor] = useState(item ? textoValor(item.valorUnitario) : '');

  const opcoes = useMemo(() => (ata ? parcelasParaItemContrato(ata, contrato, contratos.values(), item?.id) : []), [ata, contrato, contratos, item?.id]);
  const escolhida = opcoes.find((o) => o.parcela.id === parcelaId);
  const daAta = !!contrato.ataId;
  // Revisão 5: item novo pega o valor da ARP em vigor no início do contrato (considera reequilíbrios).
  const refValor = contrato.dataInicio || hojeISO();
  const valorDaAta = (p: Parcela) => (ata ? valorParcelaEm(ata, p, refValor) : p.valorUnitario);
  const opcoesBusca: OpcaoBusca[] = opcoes.map(({ item: it, parcela: p, saldo }) => ({
    id: p.id,
    rotulo: it.descricao,
    sub: [
      it.unidade,
      p.tipoCota === 'ampla' ? 'ampla' : 'cota ME/EPP',
      saldo > 0 ? `saldo ${formatarQuantidade(saldo)}` : 'sem saldo',
      formatarValorUnitario(valorDaAta(p)),
    ].filter(Boolean).join(' · '),
    busca: `${it.descricao} ${it.unidade}`,
    grupo: saldo > 0 ? 'Com saldo na ARP' : 'Sem saldo na ARP',
  }));

  return (
    <ModalForm
      titulo={item ? 'Editar item do contrato' : 'Novo item do contrato'}
      aoFechar={aoFechar}
      aoSalvar={async () => {
        const q = lerQuantidade(qtd);
        if (!q || q <= 0) return ['Quantidade inválida (até 3 casas decimais).'];
        let novo: ItemContrato;
        if (daAta) {
          if (!ata) return ['A ARP vinculada não foi encontrada.'];
          const achado = acharParcela(ata, parcelaId);
          if (!achado) return ['Escolha o item da ARP.'];
          novo = {
            id: item?.id ?? novoId(),
            parcelaId,
            descricao: item?.parcelaId === parcelaId ? item.descricao : achado.item.descricao,
            unidade: item?.parcelaId === parcelaId ? item.unidade : achado.item.unidade,
            quantidade: q,
            valorUnitario: item?.parcelaId === parcelaId ? item.valorUnitario : valorDaAta(achado.parcela),
          };
        } else {
          const v = lerValor(valor);
          if (!descricao.trim()) return ['Informe a descrição.'];
          if (!v || v <= 0) return ['Informe o valor unitário.'];
          novo = { id: item?.id ?? novoId(), parcelaId: null, descricao: descricao.trim(), unidade: unidade.trim(), quantidade: q, valorUnitario: v };
        }
        const c = atual(contrato);
        const itens = item ? c.itens.map((i) => (i.id === item.id ? novo : i)) : [...c.itens, novo];
        return gravar({ ...c, itens }, validar);
      }}
    >
      {daAta ? (
        <div className="grade g3">
          {opcoes.length === 0 && (
            <p className="nota span-todo">
              A ARP {ata?.numero} não tem itens com esta empresa como fornecedor. Cadastre o fornecedor no item da ARP primeiro.
            </p>
          )}
          <Campo rotulo={`Item da ARP ${ata?.numero ?? ''}`} className="span-todo">
            <EscolhaBusca
              valor={parcelaId}
              muda={setParcelaId}
              opcoes={opcoesBusca}
              placeholder="Digite parte da descrição do item…"
              nomePlural="itens"
              detalheEscolhida={opcoesBusca.find((o) => o.id === parcelaId)?.sub}
              desabilitado={!!item}
              autoFocus={!item}
              duasLinhas
            />
          </Campo>
          <Campo rotulo="Quantidade contratada" dica={escolhida ? `Saldo disponível na ARP: ${formatarQuantidade(escolhida.saldo)}` : undefined}>
            <EntradaQuantidade valor={qtd} muda={setQtd} />
          </Campo>
          <Campo rotulo="Valor unitário" dica="Vem da ARP. Alterações de preço entram por aditivo.">
            <div className="calculado">{escolhida ? formatarValorUnitario(item?.parcelaId === escolhida.parcela.id ? item.valorUnitario : valorDaAta(escolhida.parcela)) : '-'}</div>
          </Campo>
        </div>
      ) : (
        <div className="grade g4">
          <Campo rotulo="Descrição" className="span3">
            <Entrada valor={descricao} muda={setDescricao} autoFocus />
          </Campo>
          <Campo rotulo="Unidade">
            <Entrada valor={unidade} muda={setUnidade} />
          </Campo>
          <Campo rotulo="Quantidade" className="span2">
            <EntradaQuantidade valor={qtd} muda={setQtd} />
          </Campo>
          <Campo rotulo="Valor unitário" className="span2" dica={item ? 'Valor original. Alterações de preço entram por aditivo.' : undefined}>
            <EntradaMoeda valor={valor} muda={setValor} placeholder="0,00" />
          </Campo>
        </div>
      )}
    </ModalForm>
  );
}

// ---------- Aditivos ----------

function FormAditivoContrato({ contrato, aoFechar }: { contrato: Contrato; aoFechar: () => void }) {
  const fimAtual = dataFimVigenteContrato(contrato);
  const [tipo, setTipo] = useState<AditivoContrato['tipo']>('prazo');
  const [identificacao, setIdentificacao] = useState('');
  const [dataAssinatura, setDataAssinatura] = useState(hojeISO());
  const [inicioEfeitos, setInicioEfeitos] = useState(somarDias(fimAtual, 1));
  const [novaDataFim, setNovaDataFim] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [alt, setAlt] = useState<Record<string, { q: string; v: string }>>({});

  const mudarTipo = (t: AditivoContrato['tipo']) => {
    setTipo(t);
    setInicioEfeitos(t === 'prazo' ? somarDias(fimAtual, 1) : hojeISO());
  };
  const ref = inicioEfeitos || hojeISO();

  return (
    <ModalForm
      largo
      titulo={`Novo aditivo do contrato ${contrato.numero}`}
      aoFechar={aoFechar}
      aoSalvar={async () => {
        const erros: string[] = [];
        const alteracoes =
          tipo === 'prazo'
            ? []
            : Object.entries(alt)
                .map(([itemId, { q, v }]) => {
                  const nq = tipo === 'valor' && q.trim() ? lerQuantidade(q) : null;
                  const nv = v.trim() ? lerValor(v) : null;
                  if (q.trim() && tipo === 'valor' && !nq) erros.push('Quantidade inválida em um dos itens.');
                  if (v.trim() && !nv) erros.push('Valor unitário inválido em um dos itens.');
                  return { itemId, novaQuantidade: nq, novoValorUnitario: nv };
                })
                .filter((a) => a.novaQuantidade != null || a.novoValorUnitario != null);
        if (erros.length) return erros;
        const c = atual(contrato);
        const ad: AditivoContrato = {
          id: novoId(),
          identificacao: identificacao.trim(),
          tipo,
          dataAssinatura,
          inicioEfeitos,
          novaDataFim: tipo === 'prazo' ? novaDataFim : null,
          alteracoes,
          observacoes,
        };
        const e2 = validarAditivoContrato(ad, c);
        if (e2.length) return e2;
        return gravar({ ...c, aditivos: [...c.aditivos, ad] }, validar, 'Aditivo registrado.');
      }}
    >
      <div className="grade g4" style={{ marginBottom: 16 }}>
        <Campo rotulo="Tipo" className="span-todo">
          <Segmentado<AditivoContrato['tipo']>
            valor={tipo}
            muda={mudarTipo}
            opcoes={[
              ['prazo', 'Prazo'],
              ['valor', 'Valor'],
              ['reequilibrio', 'Reequilíbrio econômico-financeiro'],
            ]}
          />
        </Campo>
        <Campo rotulo="Identificação" className="span2">
          <Entrada valor={identificacao} muda={setIdentificacao} placeholder="1º Termo Aditivo" autoFocus />
        </Campo>
        <Campo rotulo="Assinatura">
          <EntradaData valor={dataAssinatura} muda={setDataAssinatura} />
        </Campo>
        <Campo rotulo="Início dos efeitos">
          <EntradaData valor={inicioEfeitos} muda={setInicioEfeitos} />
        </Campo>
        {tipo === 'prazo' && (
          <Campo rotulo="Novo vencimento" className="span2" dica={`Vencimento atual: ${formatarData(fimAtual)}`}>
            <EntradaData valor={novaDataFim} muda={setNovaDataFim} />
          </Campo>
        )}
      </div>
      {tipo === 'prazo' ? (
        <p className="nota">
          A prorrogação começa uma nova vigência a partir do início dos efeitos: o saldo de cada item volta à quantidade contratada. As OF/OS da vigência anterior
          continuam no histórico.
        </p>
      ) : (
        <>
          <p className="nota">
            {tipo === 'valor' ? 'Informe a nova quantidade e/ou o novo valor unitário' : 'Informe o novo valor unitário'} dos itens alterados, valendo a partir do
            início dos efeitos. Deixe em branco os demais.
          </p>
          <TabelaLancamento
            linhas={contrato.itens}
            chave={(it) => it.id}
            textoBusca={(it) => `${it.descricao} ${it.unidade}`}
            preenchida={(it) => !!(alt[it.id]?.v.trim() || (tipo === 'valor' && alt[it.id]?.q.trim()))}
            colunas={tipo === 'valor' ? 5 : 4}
            cabecalho={
              <>
                <th>Item</th>
                <th className="direita">Quantidade em {formatarData(ref)}</th>
                <th className="direita">Valor unitário em {formatarData(ref)}</th>
                {tipo === 'valor' && <th style={{ width: 150 }}>Nova quantidade</th>}
                <th style={{ width: 160 }}>Novo valor unitário</th>
              </>
            }
            linha={(it) => (
              <>
                <td>
                  {it.descricao} <span className="fraco pequeno">{it.unidade}</span>
                </td>
                <td className="direita num">{formatarQuantidade(quantidadeItemEm(contrato, it.id, ref))}</td>
                <td className="direita num">{formatarValorUnitario(valorUnitarioEm(contrato, it.id, ref))}</td>
                {tipo === 'valor' && (
                  <td>
                    <EntradaQuantidade valor={alt[it.id]?.q ?? ''} muda={(q) => setAlt({ ...alt, [it.id]: { v: alt[it.id]?.v ?? '', q } })} />
                  </td>
                )}
                <td>
                  <EntradaMoeda valor={alt[it.id]?.v ?? ''} muda={(v) => setAlt({ ...alt, [it.id]: { q: alt[it.id]?.q ?? '', v } })} />
                </td>
              </>
            )}
          />
        </>
      )}
      <Campo rotulo="Observações">
        <textarea className="entrada" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
      </Campo>
    </ModalForm>
  );
}

// ---------- Ordens de fornecimento / serviço ----------

export function FormOrdem({ contrato, ordem, aoFechar }: { contrato: Contrato; ordem?: Ordem; aoFechar: () => void }) {
  const sigla = rotuloOrdem(contrato);
  const [numero, setNumero] = useState(ordem?.numero ?? '');
  const [dataEmissao, setDataEmissao] = useState(ordem?.dataEmissao ?? hojeISO());
  const [prazoDias, setPrazoDias] = useState(ordem ? String(ordem.prazoDias) : '');
  const [tipoPrazo, setTipoPrazo] = useState<Ordem['tipoPrazo']>(ordem?.tipoPrazo ?? 'uteis');
  const [dataEntrega, setDataEntrega] = useState(ordem?.dataEntrega ?? '');
  const [observacoes, setObservacoes] = useState(ordem?.observacoes ?? '');
  const [qtds, setQtds] = useState<Record<string, string>>(
    Object.fromEntries(ordem?.itens.map((i) => [i.itemId, textoQuantidade(i.quantidade)]) ?? []),
  );
  const n = Number(prazoDias);
  const limite = /^\d{4}-\d{2}-\d{2}$/.test(dataEmissao) && Number.isInteger(n) && n > 0 && n < 3650 ? dataLimite(dataEmissao, n, tipoPrazo) : null;
  const emissaoOk = /^\d{4}-\d{2}-\d{2}$/.test(dataEmissao);

  return (
    <ModalForm
      largo
      titulo={ordem ? `Editar ${ordem.numero}` : `Nova ${sigla === 'OF' ? 'ordem de fornecimento' : 'ordem de serviço'}`}
      aoFechar={aoFechar}
      aoSalvar={async () => {
        const erros: string[] = [];
        const itens = Object.entries(qtds)
          .filter(([, t]) => t.trim())
          .map(([itemId, t]) => {
            const q = lerQuantidade(t);
            if (!q || q <= 0) erros.push('Quantidade inválida em um dos itens.');
            return { itemId, quantidade: q ?? 0 };
          });
        if (!Number.isInteger(n) || n <= 0) erros.push('Prazo de entrega deve ser um número inteiro de dias.');
        if (erros.length) return erros;
        const c = atual(contrato);
        const o: Ordem = {
          id: ordem?.id ?? novoId(),
          numero: numero.trim(),
          dataEmissao,
          prazoDias: n,
          tipoPrazo,
          dataEntrega: dataEntrega || null,
          itens,
          observacoes,
        };
        const e2 = validarOrdem(o, c);
        if (e2.length) return e2;
        const ordens = ordem ? c.ordens.map((x) => (x.id === o.id ? o : x)) : [...c.ordens, o];
        return gravar({ ...c, ordens }, validar, `${sigla} ${ordem ? 'atualizada' : 'registrada'}.`);
      }}
    >
      <div className="grade g4" style={{ marginBottom: 16 }}>
        <Campo rotulo="Número">
          <Entrada valor={numero} muda={setNumero} autoFocus placeholder={`${sigla} 000/2026`} />
        </Campo>
        <Campo rotulo="Emissão">
          <EntradaData valor={dataEmissao} muda={setDataEmissao} />
        </Campo>
        <Campo rotulo="Prazo de entrega">
          <div style={{ display: 'flex', gap: 6 }}>
            <EntradaNumero valor={prazoDias} muda={setPrazoDias} placeholder="dias" style={{ width: 70 }} />
            <Segmentado<Ordem['tipoPrazo']>
              valor={tipoPrazo}
              muda={setTipoPrazo}
              opcoes={[
                ['uteis', 'úteis'],
                ['corridos', 'corridos'],
              ]}
            />
          </div>
        </Campo>
        <Campo rotulo="Data limite (calculada)" dica={tipoPrazo === 'uteis' ? 'Desconta fins de semana e feriados.' : undefined}>
          <div className="calculado">{limite ? formatarData(limite) : '-'}</div>
        </Campo>
      </div>
      <TabelaLancamento
        linhas={contrato.itens}
        chave={(it) => it.id}
        textoBusca={(it) => `${it.descricao} ${it.unidade}`}
        preenchida={(it) => !!qtds[it.id]?.trim()}
        colunas={3}
        cabecalho={
          <>
            <th>Item</th>
            <th className="direita">Saldo disponível</th>
            <th style={{ width: 170 }}>Quantidade nesta {sigla}</th>
          </>
        }
        linha={(it) => (
          <>
            <td>
              {it.descricao} <span className="fraco pequeno">{it.unidade}</span>
            </td>
            <td className="direita num">{emissaoOk ? formatarQuantidade(saldoItem(contrato, it.id, dataEmissao, ordem?.id)) : '-'}</td>
            <td>
              <EntradaQuantidade valor={qtds[it.id] ?? ''} muda={(v) => setQtds({ ...qtds, [it.id]: v })} />
            </td>
          </>
        )}
      />
      <div className="grade g4">
        <Campo rotulo="Data de entrega" dica="Preencha quando for entregue.">
          <EntradaData valor={dataEntrega} muda={setDataEntrega} />
        </Campo>
        <Campo rotulo="Observações" className="span3">
          <Entrada valor={observacoes} muda={setObservacoes} />
        </Campo>
      </div>
    </ModalForm>
  );
}

export function FormEntrega({ contrato, ordem, aoFechar }: { contrato: Contrato; ordem: Ordem; aoFechar: () => void }) {
  const [data, setData] = useState(hojeISO());
  return (
    <ModalForm
      titulo={`Registrar entrega · ${ordem.numero}`}
      rotuloSalvar="Registrar entrega"
      aoFechar={aoFechar}
      aoSalvar={async () => {
        const c = atual(contrato);
        const o = c.ordens.find((x) => x.id === ordem.id);
        if (!o) return ['Esta ordem não existe mais. Pode ter sido excluída por outro usuário.'];
        const nova = { ...o, dataEntrega: data };
        if (data < o.dataEmissao) return ['A entrega não pode ser anterior à emissão.'];
        return gravar({ ...c, ordens: c.ordens.map((x) => (x.id === o.id ? nova : x)) }, validar, 'Entrega registrada.');
      }}
    >
      <p className="nota">
        Prazo: {ordem.prazoDias} {ordem.tipoPrazo === 'uteis' ? 'dias úteis' : 'dias corridos'} · limite {formatarData(dataLimiteOrdem(ordem))}
      </p>
      <Campo rotulo="Data da entrega">
        <EntradaData valor={data} muda={setData} autoFocus />
      </Campo>
    </ModalForm>
  );
}

function FormEncerramento({ contrato, aoFechar }: { contrato: Contrato; aoFechar: () => void }) {
  const [data, setData] = useState(hojeISO());
  const [termo, setTermo] = useState('');
  return (
    <ModalForm
      titulo={`Encerrar contrato ${contrato.numero}`}
      rotuloSalvar="Encerrar contrato"
      aoFechar={aoFechar}
      aoSalvar={async () => {
        const e = validarEncerramento(data);
        if (e.length) return e;
        const c = atual(contrato);
        return gravar({ ...c, encerramento: { data, termo: termo.trim() } }, validar, 'Contrato encerrado.');
      }}
    >
      <p className="nota">Registra o encerramento formal (termo de encerramento). O contrato sai dos alertas e não recebe mais OF/OS nem aditivos.</p>
      <div className="grade g3">
        <Campo rotulo="Data de encerramento">
          <EntradaData valor={data} muda={setData} />
        </Campo>
        <Campo rotulo="Termo de encerramento" className="span2">
          <Entrada valor={termo} muda={setTermo} placeholder="Termo de Encerramento 000/2026" autoFocus />
        </Campo>
      </div>
    </ModalForm>
  );
}

// ---------- Tela ----------

type ModalAberto =
  | null
  | { t: 'editar' }
  | { t: 'item'; item?: ItemContrato }
  | { t: 'aditivo' }
  | { t: 'ordem'; ordem?: Ordem }
  | { t: 'entrega'; ordem: Ordem }
  | { t: 'encerrar' };

export function ContratoTela({ id }: { id: string }) {
  const c = useLoja((e) => e.contratos.get(id));
  const empresas = useLoja((e) => e.empresas);
  const atas = useLoja((e) => e.atas);
  const hoje = useLoja((e) => e.hoje);
  const abrirOrdem = useOrdemAberta((s) => s.abrir);
  const [modal, setModal] = useState<ModalAberto>(null);
  const [historico, setHistorico] = useState<string | null>(null);
  const { pedir, elemento } = useConfirmacao();

  if (!c)
    return (
      <div className="tabela-caixa">
        <div className="vazio">
          Contrato não encontrado. Pode ter sido excluído por outro usuário.{' '}
          <button className="btn btn-mini" onClick={() => irPara({ tela: 'contratos' })}>Ver contratos</button>
        </div>
      </div>
    );

  const empresa = empresas.get(c.empresaId);
  const ata = c.ataId ? atas.get(c.ataId) : undefined;
  const s = situacaoContrato(c, hoje);
  const fim = dataFimVigenteContrato(c);
  const dias = diasRestantes(fim, hoje);
  const inicioVigencia = periodoDaData(c, hoje);
  const prorrogado = fim !== c.dataFim;
  const sigla = rotuloOrdem(c);
  const encerrado = !!c.encerramento;
  const aditivos = [...c.aditivos].sort((a, b) => a.inicioEfeitos.localeCompare(b.inicioEfeitos) || a.dataAssinatura.localeCompare(b.dataAssinatura));
  const ordens = [...c.ordens].sort((a, b) => b.dataEmissao.localeCompare(a.dataEmissao));
  const faixa = s === 'vigente' && dias <= 30 ? 'f-critico' : s === 'vigente' && dias <= 90 ? 'f-atencao' : '';

  const removerDe = (campo: 'aditivos' | 'ordens' | 'itens', alvoId: string, msg: string) => async () => {
    const a = atual(c);
    if (campo === 'itens') {
      const deps = [...dependentesDoItemContrato(a, alvoId), ...aditivosDoItemContrato(a, alvoId)];
      if (deps.length) return deps;
    }
    return gravar({ ...a, [campo]: (a[campo] as Array<{ id: string }>).filter((x) => x.id !== alvoId) } as Contrato, validar, msg);
  };

  const totalContrato = valorTotalContrato(c, hoje);

  return (
    <>
      <CabecalhoImpressao titulo={`Contrato ${c.numero}`} hoje={hoje} />
      <button className="voltar" onClick={() => (history.length > 1 ? history.back() : irPara({ tela: 'contratos' }))}>← Voltar</button>

      <section className="ficha">
        <div className={cls('ficha-cab', `s-${s}`, faixa)}>
          <div>
            <div className="ficha-tipo">
              <TagTipo tipo="contrato" />
              <span className="tag">{c.tipo === 'material' ? 'Material' : 'Serviço'}</span>
              <Situacao s={s} tipo="contrato" />
            </div>
            <h1 className="ficha-numero">{c.numero}</h1>
            <p className="ficha-objeto">{c.objeto || 'Sem objeto informado'}</p>
          </div>
          <div className="ficha-prazo">
            <span className="data-rotulo">{encerrado ? 'Encerrado em' : 'Vencimento'}</span>
            <span className="data num">{formatarData(encerrado ? c.encerramento!.data : fim)}</span>
            {!encerrado && <Prazo dias={dias} s={s} />}
            {prorrogado && !encerrado && <span className="pequeno fraco">prorrogado (original {formatarData(c.dataFim)})</span>}
          </div>
        </div>
        <dl className="ficha-dados">
          <Dado rotulo="Empresa">
            {empresa?.nome ?? '(não encontrada)'}
            {empresa?.cnpj && <span className="pequeno fraco num" style={{ display: 'block' }}>{empresa.cnpj}</span>}
          </Dado>
          <Dado rotulo="Contato da empresa">
            {empresa?.telefone && <span className="num" style={{ display: 'block' }}>{empresa.telefone}</span>}
            {empresa?.email && <a href={`mailto:${empresa.email}`}>{empresa.email}</a>}
          </Dado>
          <Dado rotulo="ARP">{ata ? <a href={`#/ata/${encodeURIComponent(ata.id)}`}>{ata.numero}</a> : c.ataId ? '(não encontrada)' : 'Sem ARP'}</Dado>
          <Dado rotulo="Início" num>{formatarData(c.dataInicio)}</Dado>
          <Dado rotulo="Valor do contrato" num>{formatarCentavos(totalContrato)}</Dado>
          <Dado rotulo="Gestor">{c.gestor}</Dado>
          <Dado rotulo="Fiscal">{c.fiscal}</Dado>
          {c.observacoes && <Dado rotulo="Observações">{c.observacoes}</Dado>}
        </dl>
        {ata && !encerrado && reequilibriosPosterioresAoContrato(ata, c).map((r) => (
          <div key={r.id} className="aviso-duplicada aviso-reeq">
            <strong>A ARP {ata.numero} teve reequilíbrio a partir de {formatarData(efeitoReequilibrioAta(r))}</strong>
            {r.identificacao && <span className="fraco"> ({r.identificacao})</span>}.{' '}
            O valor deste contrato não muda sozinho. Se o contrato também tiver reequilíbrio, registre um aditivo de reequilíbrio aqui.
          </div>
        ))}
        <div className="ficha-acoes">
          <button className="btn btn-primario" onClick={() => setModal({ t: 'ordem' })} disabled={encerrado || c.itens.length === 0}>+ {sigla}</button>
          <button className="btn" onClick={() => setModal({ t: 'aditivo' })} disabled={encerrado}>+ Aditivo</button>
          <button className="btn" onClick={() => setModal({ t: 'item' })}>+ Item</button>
          <button className="btn" onClick={() => setModal({ t: 'editar' })}>Editar dados</button>
          {!encerrado && <button className="btn" onClick={() => setModal({ t: 'encerrar' })}>Encerrar contrato</button>}
          <span className="separador" />
          <button className="btn btn-mini" onClick={() => exportarContrato(c, empresa, ata, hoje)}>Planilha</button>
          <button className="btn btn-mini" onClick={() => window.print()}>PDF</button>
          <button
            className="btn btn-mini btn-perigo"
            onClick={() =>
              pedir('Excluir contrato', <p>Excluir o contrato {c.numero} definitivamente? Itens, aditivos e encerramento serão apagados, e o saldo volta para a ARP.</p>, async () => {
                const r = await loja.getState().excluir(c, (e) => {
                  const a = e.contratos.get(c.id);
                  return a ? dependentesDoContrato(a) : [];
                });
                if (r.ok) {
                  loja.getState().avisar('ok', `Contrato ${c.numero} excluído.`);
                  irPara({ tela: 'contratos' });
                  return [];
                }
                return r.erros;
              })
            }
          >
            Excluir
          </button>
        </div>
      </section>

      {c.encerramento && (
        <div className="aviso-encerrado">
          <Situacao s="encerrado" tipo="contrato" />
          <span>
            em <span className="num">{formatarData(c.encerramento.data)}</span>
            {c.encerramento.termo && <> · {c.encerramento.termo}</>}
          </span>
          <span style={{ flex: 1 }} />
          <button
            className="btn btn-mini nao-imprimir"
            onClick={() =>
              pedir('Desfazer encerramento', <p>O contrato volta a ter situação calculada pelo vencimento.</p>, async () => gravar({ ...atual(c), encerramento: null }, validar, 'Encerramento desfeito.'), 'Desfazer encerramento')
            }
          >
            Desfazer encerramento
          </button>
        </div>
      )}

      <div className="secao">
        <h2>Itens e saldo</h2>
        <span className="linha" />
      </div>
      <div className="tabela-caixa">
        {c.itens.length === 0 ? (
          <div className="vazio">Nenhum item. Use “+ Item” para cadastrar{ata ? ` a partir da ARP ${ata.numero}` : ''}.</div>
        ) : (
          <>
            <table className="tabela">
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="direita">Quantidade contratada</th>
                  <th className="direita">Já solicitada em {sigla}</th>
                  <th className="direita">Saldo disponível</th>
                  <th className="direita">Valor unitário</th>
                  <th className="direita">Valor total</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {c.itens.map((it) => {
                  const q = quantidadeItemEm(c, it.id, hoje);
                  const v = valorUnitarioEm(c, it.id, hoje);
                  const saldo = saldoItem(c, it.id, hoje);
                  const hist = historicoValores(c, it.id);
                  return (
                    <tr key={it.id}>
                      <td>
                        <b>{it.descricao}</b> <span className="fraco pequeno">{it.unidade}</span>
                        {historico === it.id && (
                          <ul className="historico">
                            {hist.map((h, i) => (
                              <li key={i}>
                                <span className="num">desde {formatarData(h.desde)}</span>
                                <b className="num">{formatarValorUnitario(h.valor)}</b>
                                <span>{h.origem}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td className="direita num">
                        {formatarQuantidade(q)}
                        {q !== it.quantidade && <span className="sub">era {formatarQuantidade(it.quantidade)}</span>}
                      </td>
                      <td className="direita num">{formatarQuantidade(emitidoNoPeriodo(c, it.id, hoje))}</td>
                      <td className={cls('direita num forte', saldo < 0 && 'negativo')}>{formatarQuantidade(saldo)}</td>
                      <td className="direita num">
                        {formatarValorUnitario(v)}
                        {hist.length > 1 && (
                          <button className="btn btn-leve btn-mini nao-imprimir" style={{ display: 'block', marginLeft: 'auto' }} onClick={() => setHistorico(historico === it.id ? null : it.id)}>
                            {historico === it.id ? 'ocultar alterações' : `${hist.length - 1} ${hist.length === 2 ? 'alteração' : 'alterações'}`}
                          </button>
                        )}
                      </td>
                      <td className="direita num">{formatarCentavos(totalCentavos(q, v))}</td>
                      <td>
                        <div className="acoes-linha">
                          <button className="btn btn-leve btn-mini" onClick={() => setModal({ t: 'item', item: it })}>Editar</button>
                          <button className="btn btn-leve btn-mini" onClick={() => pedir('Excluir item', <p>Excluir o item "{it.descricao}"?</p>, removerDe('itens', it.id, 'Item excluído.'))}>Excluir</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5}>Valor do contrato</td>
                  <td className="direita num">{formatarCentavos(totalContrato)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
            <div className="nota-tabela">
              {prorrogado || inicioVigencia !== c.dataInicio
                ? `Saldo = quantidade contratada - ${sigla} emitidas desde a prorrogação em ${formatarData(inicioVigencia)}. ${sigla} anteriores ficam no histórico.`
                : `Saldo = quantidade contratada - ${sigla} emitidas.`}
            </div>
          </>
        )}
      </div>

      <div className="secao">
        <h2>{c.tipo === 'material' ? 'Ordens de fornecimento' : 'Ordens de serviço'}</h2>
        <span className="linha" />
        <span className="sub">clique numa ordem para ver o detalhe</span>
      </div>
      <div className="tabela-caixa">
        {ordens.length === 0 ? (
          <div className="vazio">Nenhuma {sigla} emitida{c.tipo === 'servico' ? ' (contratos de serviço podem não ter OS)' : ''}.</div>
        ) : (
          <table className="tabela">
            <thead>
              <tr>
                <th>Número</th>
                <th>Itens e quantidades</th>
                <th>Emissão</th>
                <th>Entrega até</th>
                <th>Situação</th>
                <th className="direita">Valor</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {ordens.map((o) => {
                const so = situacaoOrdem(o, hoje);
                const anterior = periodoDaData(c, o.dataEmissao) !== inicioVigencia;
                return (
                  <tr key={o.id} className="clicavel" onClick={() => abrirOrdem(c.id, o.id)}>
                    <td>
                      <span className="doc-numero">{o.numero}</span>
                      {anterior && <span className="sub">vigência anterior</span>}
                    </td>
                    <td className="itens-celula">
                      {o.itens.map((x) => {
                        const item = c.itens.find((i) => i.id === x.itemId);
                        return (
                          <div key={x.itemId}>
                            <b className="num">{formatarQuantidade(x.quantidade)}</b> {item?.unidade} · {item?.descricao ?? '(item removido)'}
                          </div>
                        );
                      })}
                    </td>
                    <td className="num">{formatarData(o.dataEmissao)}</td>
                    <td>
                      <span className="num">{formatarData(dataLimiteOrdem(o))}</span>
                      <span className="sub">{o.dataEntrega ? `entregue em ${formatarData(o.dataEntrega)}` : `${o.prazoDias} ${o.tipoPrazo === 'uteis' ? 'dias úteis' : 'dias corridos'}`}</span>
                    </td>
                    <td><SituacaoOrdemTag s={so} /></td>
                    <td className="direita num">{formatarCentavos(valorOrdem(c, o))}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="acoes-linha">
                        {!o.dataEntrega && !encerrado && <button className="btn btn-mini" onClick={() => setModal({ t: 'entrega', ordem: o })}>Registrar entrega</button>}
                        <button className="btn btn-leve btn-mini" onClick={() => pedir(`Excluir ${o.numero}`, <p>Excluir {o.numero}? A quantidade volta ao saldo do contrato.</p>, removerDe('ordens', o.id, `${sigla} excluída.`))}>Excluir</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="secao">
        <h2>Aditivos</h2>
        <span className="linha" />
        <span className="sub">{aditivos.length}</span>
      </div>
      {aditivos.length === 0 ? (
        <div className="tabela-caixa"><div className="vazio">Nenhum aditivo registrado.</div></div>
      ) : (
        <div className="linha-tempo">
          {aditivos.map((ad) => (
            <div key={ad.id} className={cls('evento', ad.tipo === 'prazo' && 'prazo-ev')}>
              <div className="evento-cab">
                <strong>{ad.identificacao || 'Aditivo'}</strong>
                <span className="tag">{{ prazo: 'Prazo', valor: 'Valor', reequilibrio: 'Reequilíbrio' }[ad.tipo]}</span>
                <span className="num pequeno fraco">assinado em {formatarData(ad.dataAssinatura)} · vale a partir de {formatarData(ad.inicioEfeitos)}</span>
                <button className="btn btn-leve btn-mini nao-imprimir" onClick={() => pedir('Excluir aditivo', <p>Excluir o aditivo {ad.identificacao || ''}? Vencimento, valores e saldo serão recalculados.</p>, removerDe('aditivos', ad.id, 'Aditivo excluído.'))}>Excluir</button>
              </div>
              <div className="evento-corpo">
                {ad.novaDataFim && <div>Novo vencimento: <b className="num">{formatarData(ad.novaDataFim)}</b>. Saldo renovado a partir de {formatarData(ad.inicioEfeitos)}.</div>}
                {ad.alteracoes.map((x) => {
                  const it = c.itens.find((i) => i.id === x.itemId);
                  return (
                    <div key={x.itemId}>
                      {it?.descricao ?? '(item removido)'}:
                      {x.novaQuantidade != null && <> quantidade passa a <b className="num">{formatarQuantidade(x.novaQuantidade)}</b></>}
                      {x.novaQuantidade != null && x.novoValorUnitario != null && ','}
                      {x.novoValorUnitario != null && <> valor unitário passa a <b className="num">{formatarValorUnitario(x.novoValorUnitario)}</b></>}
                    </div>
                  );
                })}
                {ad.observacoes && <div className="fraco">{ad.observacoes}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {modal?.t === 'editar' && <FormContrato contrato={c} aoFechar={() => setModal(null)} />}
      {modal?.t === 'item' && <FormItemContrato contrato={c} item={modal.item} aoFechar={() => setModal(null)} />}
      {modal?.t === 'aditivo' && <FormAditivoContrato contrato={c} aoFechar={() => setModal(null)} />}
      {modal?.t === 'ordem' && <FormOrdem contrato={c} ordem={modal.ordem} aoFechar={() => setModal(null)} />}
      {modal?.t === 'entrega' && <FormEntrega contrato={c} ordem={modal.ordem} aoFechar={() => setModal(null)} />}
      {modal?.t === 'encerrar' && <FormEncerramento contrato={c} aoFechar={() => setModal(null)} />}
      {elemento}
    </>
  );
}
