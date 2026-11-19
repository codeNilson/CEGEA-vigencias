import { useEffect, useMemo, useState } from 'react';
import { contadores, linhasDocumentos, ordensEmAlerta, vencimentosPorMes } from '../../estado/seletores';
import { formatarData, hojeISO } from '../../dominio/datas';
import { formatarQuantidade } from '../../dominio/numeros';
import { ROTULO_SITUACAO_ORDEM } from '../../dominio/tipos';
import { cls } from '../componentes/base';
import { hrefDe, loja, useLoja } from '../contexto';
import { ORGAO } from '../orgao';
import { MODOS, usePreferencia, type ModoVencimentos } from '../preferencias';

const RECARGA_MS = 5 * 60 * 1000;
const PAGINA_MS = 15 * 1000;
const CARTOES_POR_MES = 3;
const ORDENS_POR_PAGINA = 3;
const LINHAS_POR_PAGINA = 9;

/** RF17: visor para TV. Sem interação, atualiza sozinho, alterna páginas quando não cabe. */
export function Visor() {
  const atas = useLoja((e) => e.atas);
  const contratos = useLoja((e) => e.contratos);
  const empresas = useLoja((e) => e.empresas);
  const hoje = useLoja((e) => e.hoje);
  const ultima = useLoja((e) => e.ultimaLeitura);
  const [agora, setAgora] = useState(new Date());
  const [tique, setTique] = useState(0);
  const [mostrarControles, setMostrarControles] = useState(false);
  const [modo, setModo] = usePreferencia<ModoVencimentos>('visor.modo', 'mes', MODOS);

  useEffect(() => {
    document.documentElement.classList.add('modo-visor');
    const relogio = setInterval(() => {
      const d = new Date();
      setAgora(d);
      if (hojeISO(d) !== loja.getState().hoje) loja.getState().carregar(); // virada do dia
    }, 1000);
    const recarga = setInterval(() => loja.getState().carregar(), RECARGA_MS);
    const pagina = setInterval(() => setTique((t) => t + 1), PAGINA_MS);
    return () => {
      document.documentElement.classList.remove('modo-visor');
      clearInterval(relogio);
      clearInterval(recarga);
      clearInterval(pagina);
    };
  }, []);

  useEffect(() => {
    if (!mostrarControles) return;
    const t = setTimeout(() => setMostrarControles(false), 3000);
    return () => clearTimeout(t);
  }, [mostrarControles]);

  const linhas = useMemo(() => linhasDocumentos({ atas, contratos, empresas, hoje }), [atas, contratos, empresas, hoje]);
  const ordens = useMemo(() => ordensEmAlerta({ contratos, empresas, hoje }), [contratos, empresas, hoje]);
  const grupos = useMemo(() => vencimentosPorMes(linhas, hoje), [linhas, hoje]);
  const k = contadores(linhas, ordens);

  const vencendo = grupos.flatMap((g) => g.itens);
  const paginasMeses =
    modo === 'lista'
      ? Math.max(1, Math.ceil(vencendo.length / LINHAS_POR_PAGINA))
      : Math.max(1, ...grupos.map((g) => Math.ceil(g.itens.length / CARTOES_POR_MES)));
  const pMes = tique % paginasMeses;
  const paginasOrdens = Math.max(1, Math.ceil(ordens.length / ORDENS_POR_PAGINA));
  const pOrd = tique % paginasOrdens;

  const hora = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const dataBruta = agora.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  const data = dataBruta.charAt(0).toUpperCase() + dataBruta.slice(1);

  return (
    <div className="visor" onMouseMove={() => setMostrarControles(true)}>
      <header className="v-topo">
        <div className="v-marca">
          <span className="v-blocos" aria-hidden />
          <div>
            <div className="v-orgao">PREFEITURA DE FORTALEZA · {ORGAO.sigla}</div>
            <div className="v-setor">{ORGAO.setor}</div>
          </div>
        </div>
        <h1 className="v-titulo">Vigência de ARPs e contratos</h1>
        <div className="v-relogio">
          <strong className="num">{hora}</strong>
          <span>{data}</span>
        </div>
      </header>

      <section className="v-indicadores">
        <Indicador rotulo="ARPs vencendo em até 90 dias" valor={k.atasVencendo} sub={k.atasCriticas ? `${k.atasCriticas} em até 30 dias` : ''} />
        <Indicador rotulo="Contratos vencendo em até 90 dias" valor={k.contratosVencendo} sub={k.contratosCriticos ? `${k.contratosCriticos} em até 30 dias` : ''} />
        <Indicador rotulo="Entregas de OF/OS em até 3 dias" valor={k.ordensProximas} />
        <Indicador rotulo="OF/OS atrasadas" valor={k.ordensAtrasadas} alarme={k.ordensAtrasadas > 0} />
      </section>

      <main className="v-principal">
        <section className="v-bloco">
          <div className="v-bloco-cab">
            <h2>Vencimentos nos próximos 90 dias</h2>
            {paginasMeses > 1 && <Paginas atual={pMes} total={paginasMeses} />}
          </div>
          {modo === 'lista' ? (
            <div className="v-lista">
              {vencendo.length === 0 ? (
                <div className="v-vazio grande">Nenhum vencimento nos próximos 90 dias</div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Tipo</th>
                      <th>Número</th>
                      <th>Empresa / objeto</th>
                      <th>Vencimento</th>
                      <th className="direita">Prazo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vencendo.slice(pMes * LINHAS_POR_PAGINA, pMes * LINHAS_POR_PAGINA + LINHAS_POR_PAGINA).map((l) => (
                      <tr key={l.id} className={l.faixa}>
                        <td><span className={cls('v-tag', l.tipo)}>{l.tipo === 'ata' ? 'ARP' : 'Contrato'}</span></td>
                        <td className="v-lista-numero num">{l.numero}</td>
                        <td className="v-lista-texto">{l.tipo === 'contrato' ? l.empresa : l.objeto}</td>
                        <td className="num">{formatarData(l.vencimento)}</td>
                        <td className="direita"><span className="v-doc-dias">{l.dias === 0 ? 'vence hoje' : l.dias === 1 ? 'amanhã' : `${l.dias} dias`}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ) : (
          <div className="v-meses" style={{ ['--n' as string]: grupos.length }}>
            {grupos.map((g) => {
              const visiveis = g.itens.slice(pMes * CARTOES_POR_MES, pMes * CARTOES_POR_MES + CARTOES_POR_MES);
              return (
                <div className="v-mes" key={g.chave}>
                  <div className="v-mes-cab">
                    <strong>{g.mes}</strong>
                    <span className="num">{g.itens.length}</span>
                  </div>
                  {g.itens.length === 0 && <div className="v-vazio">Nenhum vencimento</div>}
                  {visiveis.map((l) => (
                    <div key={l.id} className={cls('v-doc', l.faixa)}>
                      <div className="v-doc-topo">
                        <span className={cls('v-tag', l.tipo)}>{l.tipo === 'ata' ? 'ARP' : 'Contrato'}</span>
                        <span className="v-doc-dias">{l.dias === 0 ? 'vence hoje' : l.dias === 1 ? 'amanhã' : `${l.dias} dias`}</span>
                      </div>
                      <div className="v-doc-numero num">{l.numero}</div>
                      <div className="v-doc-objeto">{l.tipo === 'contrato' ? l.empresa : l.objeto}</div>
                      <div className="v-doc-data num">vence {formatarData(l.vencimento)}</div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
          )}
        </section>

        <section className="v-bloco v-entregas">
          <div className="v-bloco-cab">
            <h2>Entregas de OF/OS</h2>
            {paginasOrdens > 1 && <Paginas atual={pOrd} total={paginasOrdens} />}
          </div>
          {ordens.length === 0 && <div className="v-vazio grande">Nenhuma entrega próxima ou atrasada</div>}
          {ordens.slice(pOrd * ORDENS_POR_PAGINA, pOrd * ORDENS_POR_PAGINA + ORDENS_POR_PAGINA).map((o) => (
            <div key={o.ordem.id} className={cls('v-ordem', o.situacao)}>
              <div className="v-ordem-topo">
                <span className="v-doc-numero num">{o.ordem.numero}</span>
                <span className="v-ordem-sit">{ROTULO_SITUACAO_ORDEM[o.situacao]}</span>
              </div>
              <div className="v-ordem-empresa">{o.empresa}</div>
              <ul className="v-ordem-itens">
                {o.itens.slice(0, 2).map((it, i) => (
                  <li key={i}>
                    <b className="num">{formatarQuantidade(it.quantidade)}</b> {it.descricao}
                  </li>
                ))}
                {o.itens.length > 2 && <li>e mais {o.itens.length - 2} itens</li>}
              </ul>
              <div className="v-ordem-limite">
                Entrega até <b className="num">{formatarData(o.limite)}</b>
                <span>{o.dias < 0 ? `${-o.dias} ${o.dias === -1 ? 'dia' : 'dias'} de atraso` : o.dias === 0 ? 'hoje' : o.dias === 1 ? 'amanhã' : `em ${o.dias} dias`}</span>
              </div>
            </div>
          ))}
        </section>
      </main>

      <footer className="v-rodape">
        <span>
          Atualizado às {ultima ? new Date(ultima).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-'} · atualiza sozinho a cada 5 minutos
        </span>
        {k.aguardandoEncerramento > 0 && (
          <span>
            {k.aguardandoEncerramento} {k.aguardandoEncerramento === 1 ? 'contrato vencido aguarda' : 'contratos vencidos aguardam'} termo de encerramento
          </span>
        )}
      </footer>

      <div className={cls('v-controles', mostrarControles && 'visivel')}>
        <button className="btn" onClick={() => setModo(modo === 'mes' ? 'lista' : 'mes')}>{modo === 'mes' ? 'Ver em lista' : 'Ver por mês'}</button>
        <button className="btn btn-escuro" onClick={() => document.documentElement.requestFullscreen?.()}>Tela cheia</button>
        <a className="btn" href={hrefDe({ tela: 'inicio' })} onClick={() => document.fullscreenElement && document.exitFullscreen()}>Sair do visor</a>
      </div>
    </div>
  );
}

function Indicador({ rotulo, valor, sub, alarme }: { rotulo: string; valor: number; sub?: string; alarme?: boolean }) {
  return (
    <div className={cls('v-indicador', alarme && 'alarme', valor === 0 && 'zero')}>
      <div className="v-indicador-valor num">{valor}</div>
      <div>
        <div className="v-indicador-rotulo">{rotulo}</div>
        {sub && <div className="v-indicador-sub">{sub}</div>}
      </div>
    </div>
  );
}

function Paginas({ atual, total }: { atual: number; total: number }) {
  return (
    <span className="v-paginas" aria-label={`Página ${atual + 1} de ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <i key={i} className={i === atual ? 'ativa' : ''} />
      ))}
      <span className="num">
        {atual + 1}/{total}
      </span>
    </span>
  );
}
