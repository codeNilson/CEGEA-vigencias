import { useMemo, useState } from 'react';
import { contadores, limitar, linhasDocumentos, ordensEmAlerta, vencimentosPorMes } from '../../estado/seletores';
import { formatarData, somarDias } from '../../dominio/datas';
import { Prazo, Segmentado, cls, useImprimindo } from '../componentes/base';

/** Revisão 7: cartões de entrega antes do "Mostrar todas". */
const ENTREGAS_INICIO = 12;
import { MODOS, usePreferencia, type ModoVencimentos } from '../preferencias';
import { CartaoOrdem, ListaVencimentos, VencimentosPorMes } from '../componentes/Vencimentos';
import { irPara, useLoja } from '../contexto';

export function Inicio({ aoNovaAta, aoNovoContrato }: { aoNovaAta: () => void; aoNovoContrato: () => void }) {
  const atas = useLoja((e) => e.atas);
  const contratos = useLoja((e) => e.contratos);
  const empresas = useLoja((e) => e.empresas);
  const hoje = useLoja((e) => e.hoje);
  const problemas = useLoja((e) => e.problemas);
  const [modo, setModo] = usePreferencia<ModoVencimentos>('inicio.modo', 'mes', MODOS);
  const [todasEntregas, setTodasEntregas] = useState(false);
  const imprimindo = useImprimindo();

  const linhas = useMemo(() => linhasDocumentos({ atas, contratos, empresas, hoje }), [atas, contratos, empresas, hoje]);
  const ordens = useMemo(() => ordensEmAlerta({ contratos, empresas, hoje }), [contratos, empresas, hoje]);
  const grupos = useMemo(() => vencimentosPorMes(linhas, hoje), [linhas, hoje]);
  const k = contadores(linhas, ordens);
  const aguardando = linhas.filter((l) => l.aguardandoEncerramento);
  const entregas = limitar(ordens, ENTREGAS_INICIO, todasEntregas || imprimindo);

  if (atas.size === 0 && contratos.size === 0)
    return (
      <div className="tabela-caixa" style={{ marginTop: 20 }}>
        <div className="vazio">
          <p style={{ fontSize: 17, color: 'var(--petroleo)', fontWeight: 800 }}>Nenhuma ARP ou contrato cadastrado ainda.</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button className="btn btn-primario" onClick={aoNovaAta}>Cadastrar ARP</button>
            <button className="btn" onClick={aoNovoContrato}>Cadastrar contrato</button>
          </div>
        </div>
      </div>
    );

  const sub = (n: number) => (n > 0 ? `${n} em até 30 dias` : 'nenhum em até 30 dias');

  return (
    <>
      <div className="indicadores">
        <button className={cls('indicador', k.atasVencendo > 0 && 'ativo', k.atasVencendo === 0 && 'zero')} onClick={() => irPara({ tela: 'atas' })}>
          <div className="indicador-rotulo">ARPs vencendo em até 90 dias</div>
          <div className="indicador-valor">{k.atasVencendo}</div>
          <div className="indicador-sub">{sub(k.atasCriticas)}</div>
        </button>
        <button className={cls('indicador', k.contratosVencendo > 0 && 'ativo', k.contratosVencendo === 0 && 'zero')} onClick={() => irPara({ tela: 'contratos' })}>
          <div className="indicador-rotulo">Contratos vencendo em até 90 dias</div>
          <div className="indicador-valor">{k.contratosVencendo}</div>
          <div className="indicador-sub">{sub(k.contratosCriticos)}</div>
        </button>
        <button className={cls('indicador', k.ordensProximas > 0 && 'ativo', k.ordensProximas === 0 && 'zero')} onClick={() => document.getElementById('entregas')?.scrollIntoView({ behavior: 'smooth' })}>
          <div className="indicador-rotulo">Entregas de OF/OS em até 3 dias</div>
          <div className="indicador-valor">{k.ordensProximas}</div>
          <div className="indicador-sub">ordens pendentes</div>
        </button>
        <button className={cls('indicador', k.ordensAtrasadas > 0 && 'alarme', k.ordensAtrasadas === 0 && 'zero')} onClick={() => irPara({ tela: 'ordens' })}>
          <div className="indicador-rotulo">OF/OS atrasadas</div>
          <div className="indicador-valor">{k.ordensAtrasadas}</div>
          <div className="indicador-sub">{k.ordensAtrasadas > 0 ? 'cobrar fornecedor' : 'nenhuma em atraso'}</div>
        </button>
      </div>

      <div className="secao">
        <h2>Vencimentos nos próximos 90 dias</h2>
        <span className="linha" />
        <span className="sub">de hoje até {formatarData(somarDias(hoje, 90))}</span>
        <Segmentado<ModoVencimentos> valor={modo} muda={setModo} opcoes={[['mes', 'Por mês'], ['lista', 'Lista']]} />
      </div>
      {modo === 'mes' ? <VencimentosPorMes grupos={grupos} /> : <ListaVencimentos linhas={grupos.flatMap((g) => g.itens)} />}

      <div className="secao" id="entregas">
        <h2>Entregas de OF/OS</h2>
        <span className="linha" />
        <span className="sub">atrasadas e com entrega em até 3 dias</span>
      </div>
      {ordens.length === 0 ? (
        <div className="tabela-caixa">
          <div className="vazio">Nenhuma entrega próxima ou atrasada.</div>
        </div>
      ) : (
        <>
          <div className="entregas">
            {entregas.visiveis.map((o) => (
              <CartaoOrdem key={o.ordem.id} o={o} />
            ))}
          </div>
          {(entregas.ocultos > 0 || (todasEntregas && ordens.length > ENTREGAS_INICIO + 1)) && (
            <div className="mais-entregas nao-imprimir">
              <button className="btn btn-mini" onClick={() => setTodasEntregas(!todasEntregas)}>
                {todasEntregas ? 'Mostrar menos' : `Mostrar todas as ${ordens.length} entregas`}
              </button>
            </div>
          )}
        </>
      )}

      {aguardando.length > 0 && (
        <details className="recolhivel">
          <summary>
            Contratos vencidos aguardando termo de encerramento <span className="contagem">{aguardando.length}</span>
          </summary>
          <div className="corpo">
            <table className="tabela">
              <tbody>
                {aguardando.map((l) => (
                  <tr key={l.id} className="clicavel" onClick={() => irPara({ tela: 'contrato', id: l.id })}>
                    <td className="doc-numero">{l.numero}</td>
                    <td>{l.objeto}</td>
                    <td>{l.empresa}</td>
                    <td className="direita">
                      <Prazo dias={l.dias} s={l.situacao} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {problemas.length > 0 && (
        <div className="problemas">
          <strong>{problemas.length} arquivo(s) da pasta de dados não puderam ser lidos</strong> e foram ignorados.
          <ul>
            {problemas.map((p) => (
              <li key={p.colecao + p.id}>
                {p.colecao}/{p.id}.json: {p.erro}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
