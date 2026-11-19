import { useEffect, useRef, useState, type ReactNode } from 'react';
import changelog from '../../../CHANGELOG.md?raw';
import { formatarData } from '../../dominio/datas';
import { atualizacao, ofereceAtualizacao, useAtualizacao } from '../../atualizacao/estado';
import { instalarPublicacao, nomeArquivoAtual, podeInstalar, PASTA_VERSOES_ANTERIORES, type EtapaInstalacao } from '../../atualizacao/instalar';
import { lerChangelog, notasEntre, type NotaVersao } from '../../atualizacao/notas';
import { PAGINA_VERSOES } from '../../atualizacao/online';
import { compararVersoes, VERSAO_APP, versaoValida } from '../../atualizacao/versao';
import { Erros, Modal } from './base';
import { loja, useLoja } from '../contexto';

const NOTAS_EMBUTIDAS = lerChangelog(changelog);
const CONSULTA_MS = 6 * 60 * 60 * 1000;
const PASTA_MS = 2 * 60 * 1000;
const CHAVE_VISTA = 'vigencias.versaoVista';
const CHAVE_RECARGA = 'vigencias.recargaVisor';

/** Texto de item do CHANGELOG com `código` e **negrito**. */
function TextoNota({ t }: { t: string }) {
  const partes = t.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).filter(Boolean);
  return (
    <>
      {partes.map((p, i) =>
        p.startsWith('`') ? <code key={i}>{p.slice(1, -1)}</code> : p.startsWith('**') ? <b key={i}>{p.slice(2, -2)}</b> : <span key={i}>{p}</span>,
      )}
    </>
  );
}

export function ListaNotas({ notas }: { notas: NotaVersao[] }) {
  if (!notas.length) return <p className="fraco">Sem notas para esta versão.</p>;
  return (
    <div className="notas-versao">
      {notas.map((n) => (
        <section key={n.versao}>
          <h4>
            Versão {n.versao}
            {n.data && <span className="fraco num"> · {formatarData(n.data)}</span>}
          </h4>
          {n.secoes.map((s) => (
            <div key={s.titulo}>
              <h5>{s.titulo}</h5>
              <ul>
                {s.itens.map((it, i) => (
                  <li key={i}>
                    <TextoNota t={it} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

/**
 * Liga as verificações de versão (revisão 6): marcador da pasta a cada 2 min (todas as telas, inclusive o visor)
 * e versão publicada no GitHub ao abrir, a cada 6 h e quando a internet volta.
 */
export function useVerificacaoDeVersao(noVisor: boolean) {
  const repo = useLoja((e) => e.repo);
  const versaoNaPasta = useAtualizacao((e) => e.versaoNaPasta);

  useEffect(() => {
    if (!repo) return;
    const conferir = () => atualizacao.getState().conferirPasta(repo, (m) => loja.getState().definirBloqueioVersao(m));
    conferir();
    const t = setInterval(conferir, PASTA_MS);
    return () => clearInterval(t);
  }, [repo]);

  useEffect(() => {
    if (noVisor) return;
    const consultar = () => atualizacao.getState().consultar();
    const t0 = setTimeout(consultar, 3000);
    const t = setInterval(consultar, CONSULTA_MS);
    window.addEventListener('online', consultar);
    return () => {
      clearTimeout(t0);
      clearInterval(t);
      window.removeEventListener('online', consultar);
    };
  }, [noVisor]);

  // O visor fica sem ninguém por perto: recarrega sozinho quando outra pessoa atualiza o sistema.
  // Proteção contra laço: no máximo uma recarga a cada 10 minutos.
  useEffect(() => {
    if (!noVisor || !versaoNaPasta) return;
    let ultima = 0;
    try {
      ultima = Number(sessionStorage.getItem(CHAVE_RECARGA) ?? 0);
      if (Date.now() - ultima < 10 * 60 * 1000) return;
      sessionStorage.setItem(CHAVE_RECARGA, String(Date.now()));
    } catch {
      /* sem sessionStorage: recarrega mesmo assim */
    }
    location.reload();
  }, [noVisor, versaoNaPasta]);
}

/** Faixa no topo: versão nova disponível, ou esta janela ficou para trás. */
export function FaixaAtualizacao() {
  const versaoNaPasta = useAtualizacao((e) => e.versaoNaPasta);
  const publicacao = useAtualizacao((e) => e.publicacao);
  if (versaoNaPasta)
    return (
      <div className="banner-alteracoes banner-versao nao-imprimir">
        O sistema foi atualizado para a versão {versaoNaPasta}. Recarregue para usar a versão nova e voltar a salvar.
        <button className="btn btn-mini btn-primario" onClick={() => location.reload()}>Recarregar</button>
      </div>
    );
  if (ofereceAtualizacao({ publicacao, versaoNaPasta }))
    return (
      <div className="banner-alteracoes banner-versao nao-imprimir">
        Nova versão {publicacao!.versao} do sistema disponível.
        <button className="btn btn-mini btn-primario" onClick={() => atualizacao.getState().abrirModal(true)}>Ver novidades e atualizar</button>
      </div>
    );
  return null;
}

const ROTULO_ETAPA: Record<EtapaInstalacao, string> = {
  pasta: 'Conferindo a pasta do sistema…',
  baixando: 'Baixando a versão nova…',
  copia: 'Guardando cópia da versão atual…',
  gravando: 'Gravando a versão nova…',
  pronto: 'Pronto. Recarregando…',
};

/** Modal de versões: versão atual, consulta, notas da nova e botão de instalar. */
export function ModalAtualizacao() {
  const aberto = useAtualizacao((e) => e.modalAberto);
  const publicacao = useAtualizacao((e) => e.publicacao);
  const consultando = useAtualizacao((e) => e.consultando);
  const falhou = useAtualizacao((e) => e.falhou);
  const ultima = useAtualizacao((e) => e.ultimaConsulta);
  const versaoNaPasta = useAtualizacao((e) => e.versaoNaPasta);
  const repo = useLoja((e) => e.repo);
  const [etapa, setEtapa] = useState<EtapaInstalacao | null>(null);
  const [erros, setErros] = useState<string[]>([]);

  if (!aberto) return null;
  const fechar = () => {
    if (etapa && etapa !== 'pronto') return;
    setErros([]);
    atualizacao.getState().abrirModal(false);
  };
  const nova = ofereceAtualizacao({ publicacao, versaoNaPasta }) ? publicacao! : null;
  const instalavel = podeInstalar(repo);

  async function instalar() {
    if (!nova || !repo) return;
    setErros([]);
    try {
      await instalarPublicacao(nova, repo, setEtapa);
      setTimeout(() => location.reload(), 1200);
    } catch (e) {
      setEtapa(null);
      setErros([e instanceof Error ? e.message : String(e)]);
    }
  }

  let status: ReactNode;
  if (versaoNaPasta) status = <p>Outra pessoa já instalou a versão {versaoNaPasta}. Recarregue a página para usá-la.</p>;
  else if (nova) status = null;
  else if (consultando) status = <p className="fraco">Consultando…</p>;
  else if (falhou && !ultima) status = <p>Não foi possível consultar agora (sem internet ou GitHub fora do ar). O sistema funciona normalmente; a consulta é repetida mais tarde.</p>;
  else if (publicacao) status = <p>Você está na versão mais recente.</p>;
  else status = <p className="fraco">Ainda não consultado.</p>;

  return (
    <Modal
      titulo={nova ? `Nova versão ${nova.versao} disponível` : 'Versão do sistema'}
      aoFechar={fechar}
      largo={!!nova}
      rodape={
        <>
          <a className="btn btn-leve btn-mini" href={PAGINA_VERSOES} target="_blank" rel="noreferrer">Todas as versões</a>
          <span style={{ flex: 1 }} />
          {versaoNaPasta ? (
            <button className="btn btn-primario" onClick={() => location.reload()}>Recarregar</button>
          ) : nova ? (
            <>
              <button className="btn" onClick={fechar} disabled={!!etapa && etapa !== 'pronto'}>Depois</button>
              <button className="btn btn-primario" onClick={instalar} disabled={!instalavel || !!etapa}>
                {etapa ? ROTULO_ETAPA[etapa] : 'Atualizar agora'}
              </button>
            </>
          ) : (
            <>
              <button className="btn" onClick={() => atualizacao.getState().consultar()} disabled={consultando}>Verificar agora</button>
              <button className="btn btn-primario" onClick={fechar}>Fechar</button>
            </>
          )}
        </>
      }
    >
      <Erros erros={erros} />
      <p>
        Versão em uso: <b className="num">{VERSAO_APP}</b>
        {ultima && <span className="fraco"> · consultado às {new Date(ultima).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>}
      </p>
      {status}
      {nova && (
        <>
          <p className="nota">
            A atualização troca o arquivo {nomeArquivoAtual()} na pasta de rede, para todos. Quem estiver com o sistema aberto recebe um aviso para recarregar, e a
            TV recarrega sozinha. Os dados não são alterados. Uma cópia da versão atual fica em {PASTA_VERSOES_ANTERIORES}.
            {instalavel && ' Na primeira vez, escolha a pasta onde fica o arquivo (a pasta acima de "dados").'}
          </p>
          {!instalavel && (
            <p className="nota">
              Daqui não dá para instalar: a atualização só funciona com o sistema aberto a partir da pasta de rede (não na demonstração).
            </p>
          )}
          <ListaNotas notas={notasEntre(nova.notas, VERSAO_APP, nova.versao)} />
        </>
      )}
      {!nova && (
        <details className="recolhivel">
          <summary>Novidades da versão {VERSAO_APP}</summary>
          <ListaNotas notas={NOTAS_EMBUTIDAS.filter((n) => n.versao === VERSAO_APP)} />
        </details>
      )}
    </Modal>
  );
}

/** "O que há de novo": na primeira abertura de cada computador depois de uma atualização. */
export function ModalNovidades() {
  const [notas, setNotas] = useState<NotaVersao[]>([]);
  const feito = useRef(false);
  useEffect(() => {
    if (feito.current) return;
    feito.current = true;
    let vista: string | null = null;
    try {
      vista = localStorage.getItem(CHAVE_VISTA);
      localStorage.setItem(CHAVE_VISTA, VERSAO_APP);
    } catch {
      return;
    }
    if (vista && versaoValida(vista) && compararVersoes(vista, VERSAO_APP) >= 0) return;
    // Primeira vez neste computador: mostra só a versão atual.
    setNotas(vista && versaoValida(vista) ? notasEntre(NOTAS_EMBUTIDAS, vista, VERSAO_APP) : NOTAS_EMBUTIDAS.filter((n) => n.versao === VERSAO_APP));
  }, []);
  if (!notas.length) return null;
  return (
    <Modal
      titulo={`O que há de novo na versão ${VERSAO_APP}`}
      aoFechar={() => setNotas([])}
      largo
      rodape={
        <>
          <span style={{ flex: 1 }} />
          <button className="btn btn-primario" onClick={() => setNotas([])}>Entendi</button>
        </>
      }
    >
      <ListaNotas notas={notas} />
    </Modal>
  );
}

/** Botão discreto com a versão, na faixa de status. */
export function BotaoVersao() {
  const publicacao = useAtualizacao((e) => e.publicacao);
  const versaoNaPasta = useAtualizacao((e) => e.versaoNaPasta);
  const alerta = !!versaoNaPasta || ofereceAtualizacao({ publicacao, versaoNaPasta });
  return (
    <button className="btn btn-leve btn-mini" title="Versão do sistema e atualizações" onClick={() => atualizacao.getState().abrirModal(true)}>
      Versão {VERSAO_APP}
      {alerta && <span className="ponto-alerta" aria-label="atualização disponível" />}
    </button>
  );
}
