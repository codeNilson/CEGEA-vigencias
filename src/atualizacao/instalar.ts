import { gravarLocal, lerLocal } from '../armazenamento/idb';
import type { Repositorio } from '../armazenamento/repositorio';
import { baixarPublicacao, type Publicacao } from './online';
import { VERSAO_APP } from './versao';

const CHAVE_PASTA_SISTEMA = 'pasta-sistema';
export const PASTA_VERSOES_ANTERIORES = 'versoes-anteriores';

/** Nome deste arquivo na pasta de rede (normalmente Vigencias.html). */
export function nomeArquivoAtual(): string {
  const ultimo = decodeURIComponent(location.pathname.split('/').pop() ?? '');
  return ultimo.toLowerCase().endsWith('.html') ? ultimo : 'Vigencias.html';
}

/** Só instala quando aberto como arquivo (pasta de rede). Em desenvolvimento ou demonstração, não. */
export function podeInstalar(repo: Repositorio | null): boolean {
  return typeof location !== 'undefined' && location.protocol === 'file:' && !!repo && !repo.nome.startsWith('Demonstração');
}

async function temArquivo(p: FileSystemDirectoryHandle, nome: string) {
  try {
    await p.getFileHandle(nome);
    return true;
  } catch {
    return false;
  }
}

/**
 * Pasta onde está o Vigencias.html (a "pasta do sistema", acima de dados/). Guardada no IndexedDB
 * depois da primeira escolha. Precisa ser chamada a partir do clique do usuário.
 */
async function obterPastaSistema(repo: Repositorio): Promise<FileSystemDirectoryHandle> {
  const nome = nomeArquivoAtual();
  const salva = await lerLocal<FileSystemDirectoryHandle>('config', CHAVE_PASTA_SISTEMA);
  if (salva) {
    let p = await salva.queryPermission({ mode: 'readwrite' });
    if (p !== 'granted') p = await salva.requestPermission({ mode: 'readwrite' });
    if (p === 'granted' && (await temArquivo(salva, nome))) return salva;
  }
  const inicio = (repo as { pastaDados?: FileSystemDirectoryHandle }).pastaDados;
  let escolhida: FileSystemDirectoryHandle;
  try {
    escolhida = await window.showDirectoryPicker({ id: 'vigencias-sistema', mode: 'readwrite', ...(inicio ? { startIn: inicio } : {}) });
  } catch {
    throw new Error('Atualização cancelada. Nada foi alterado.');
  }
  if (!(await temArquivo(escolhida, nome)))
    throw new Error(`A pasta "${escolhida.name}" não tem o arquivo ${nome}. Escolha a pasta onde fica o ${nome} (a pasta acima de "dados").`);
  await gravarLocal('config', CHAVE_PASTA_SISTEMA, escolhida);
  return escolhida;
}

export type EtapaInstalacao = 'pasta' | 'baixando' | 'copia' | 'gravando' | 'pronto';

/**
 * Instala a versão publicada por cima do próprio arquivo:
 * 1. pasta do sistema (permissão); 2. baixa e confere SHA-256; 3. guarda cópia da versão atual em
 * versoes-anteriores/; 4. grava o arquivo novo (createWritable só troca o original no close);
 * 5. registra a versão no marcador da pasta de dados, para as outras janelas recarregarem.
 * Qualquer falha antes do passo 4 não altera nada.
 */
export async function instalarPublicacao(p: Publicacao, repo: Repositorio, etapa: (e: EtapaInstalacao) => void = () => {}): Promise<void> {
  etapa('pasta');
  const pasta = await obterPastaSistema(repo);
  const nome = nomeArquivoAtual();

  etapa('baixando');
  const novo = await baixarPublicacao(p);

  etapa('copia');
  try {
    const atual = await (await pasta.getFileHandle(nome)).getFile();
    const anteriores = await pasta.getDirectoryHandle(PASTA_VERSOES_ANTERIORES, { create: true });
    const base = nome.replace(/\.html$/i, '');
    const w = await (await anteriores.getFileHandle(`${base}-${VERSAO_APP}.html`, { create: true })).createWritable();
    await w.write(await atual.arrayBuffer());
    await w.close();
  } catch {
    throw new Error('Não foi possível guardar a cópia da versão atual na pasta de rede. Nada foi alterado.');
  }

  etapa('gravando');
  try {
    const w = await (await pasta.getFileHandle(nome)).createWritable();
    await w.write(novo);
    await w.close();
  } catch {
    throw new Error('Não foi possível gravar a versão nova na pasta de rede. O arquivo atual continua como estava.');
  }

  // Se falhar, a versão nova registra a si mesma ao abrir (situacaoVersao: 'registrar').
  await repo.atualizarMarcador({ versaoApp: p.versao, versaoMinima: p.versao, atualizadoEm: new Date().toISOString() }).catch(() => {});
  etapa('pronto');
}
