import { afterEach, describe, expect, it, vi } from 'vitest';
import changelog from '../../CHANGELOG.md?raw';
import pacote from '../../package.json';
import { compararVersoes } from './versao';
import { lerChangelog, notasEntre } from './notas';
import { situacaoVersao } from './compartilhada';
import { baixarPublicacao, consultarPublicacao, haVersaoNova, PublicacaoSchema, sha256Hex, type Publicacao } from './online';
import { RepositorioMemoria } from '../armazenamento/memoria';
import { criarLoja } from '../estado/loja';
import { novaEmpresa } from '../dominio/fabrica';

describe('RF22 versões', () => {
  it('compara versões como números', () => {
    expect(compararVersoes('1.10.0', '1.9.3')).toBeGreaterThan(0);
    expect(compararVersoes('v1.5.0', '1.5.0')).toBe(0);
    expect(compararVersoes('1.4.9', '1.5.0')).toBeLessThan(0);
  });

  it('lê o CHANGELOG do repositório, mais nova primeiro, com seções e itens', () => {
    const notas = lerChangelog(changelog);
    expect(notas[0].versao).toBe(pacote.version);
    expect(notas.map((n) => n.versao)).toContain('1.0.0');
    expect(notas[0].secoes[0].itens.length).toBeGreaterThan(0);
    expect(notasEntre(notas, '1.3.0', '1.5.0').map((n) => n.versao)).toEqual(['1.5.0', '1.4.0']);
  });

  it('CHANGELOG tem a seção da versão do package.json (exigido para publicar)', () => {
    const versao = pacote.version;
    expect(lerChangelog(changelog).some((n) => n.versao === versao)).toBe(true);
  });

  it('item em mais de uma linha e item sem seção', () => {
    const n = lerChangelog('## [2.0.0] - 2027-01-01\n- primeira\n  continua\n## 1.0.0\n### Corrigido\n- x');
    expect(n[0].secoes[0]).toEqual({ titulo: 'Alterações', itens: ['primeira continua'] });
    expect(n[1]).toMatchObject({ versao: '1.0.0', data: '', secoes: [{ titulo: 'Corrigido', itens: ['x'] }] });
  });
});

describe('CA22.6 versão compartilhada na pasta de dados', () => {
  it('marcador antigo, sem versão: registra a atual', () => {
    expect(situacaoVersao({ sistema: 'Vigências', formato: 1 }, '1.5.0')).toEqual({ tipo: 'registrar', marcador: { versaoApp: '1.5.0', versaoMinima: '1.5.0' } });
  });
  it('mesma versão: ok; versão mais nova na pasta: esta janela está desatualizada', () => {
    expect(situacaoVersao({ versaoApp: '1.5.0', versaoMinima: '1.5.0' }, '1.5.0')).toEqual({ tipo: 'ok' });
    expect(situacaoVersao({ versaoApp: '1.6.0', versaoMinima: '1.6.0' }, '1.5.0')).toEqual({ tipo: 'desatualizada', versaoNaPasta: '1.6.0' });
  });
  it('arquivo mais novo copiado à mão: registra', () => {
    expect(situacaoVersao({ versaoApp: '1.5.0', versaoMinima: '1.5.0' }, '1.6.0').tipo).toBe('registrar');
  });

  it('loja com versão antiga não grava nem exclui', async () => {
    const repo = new RepositorioMemoria();
    const loja = criarLoja();
    await loja.getState().conectar(repo);
    const e = novaEmpresa({ id: 'e1', nome: 'Alfa' });
    expect((await loja.getState().salvar(e)).ok).toBe(true);
    loja.getState().definirBloqueioVersao('Recarregue a página.');
    const r = await loja.getState().salvar({ ...loja.getState().empresas.get('e1')!, nome: 'Beta' });
    expect(r).toEqual({ ok: false, erros: ['Recarregue a página.'] });
    expect((await loja.getState().excluir(e)).ok).toBe(false);
    expect((await repo.ler('empresas', 'e1'))?.dados).toMatchObject({ nome: 'Alfa' });
  });

  it('marcador do repositório em memória mantém os outros campos', async () => {
    const repo = new RepositorioMemoria();
    await repo.atualizarMarcador({ versaoApp: '1.5.0' });
    expect(await repo.lerMarcador()).toMatchObject({ sistema: 'Vigências', formato: 1, versaoApp: '1.5.0' });
  });
});

describe('CA22.2 a CA22.4 consulta e download', () => {
  const html = new TextEncoder().encode('<!DOCTYPE html><html><body>nova</body></html>');
  async function publicacao(p: Partial<Publicacao> = {}): Promise<Publicacao> {
    return {
      versao: '9.0.0', data: '2027-01-01', arquivo: 'versoes/Vigencias-9.0.0.html',
      sha256: await sha256Hex(html.buffer as ArrayBuffer), tamanho: html.byteLength, notas: [], ...p,
    };
  }
  const resposta = (corpo: BodyInit, ok = true) => Promise.resolve(new Response(corpo, { status: ok ? 200 : 404 }));
  afterEach(() => vi.unstubAllGlobals());

  it('consulta válida, versão nova é oferecida', async () => {
    const p = await publicacao();
    vi.stubGlobal('fetch', vi.fn(() => resposta(JSON.stringify(p))));
    const r = await consultarPublicacao();
    expect(r?.versao).toBe('9.0.0');
    expect(haVersaoNova(r, '1.5.0')).toBe(true);
    expect(haVersaoNova(r, '9.0.0')).toBe(false);
  });

  it('sem internet ou resposta estranha: null, sem erro', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));
    expect(await consultarPublicacao()).toBeNull();
    vi.stubGlobal('fetch', vi.fn(() => resposta('{"versao":"x"}')));
    expect(await consultarPublicacao()).toBeNull();
    vi.stubGlobal('fetch', vi.fn(() => resposta('', false)));
    expect(await consultarPublicacao()).toBeNull();
  });

  it('caminho do arquivo só dentro de versoes/', async () => {
    expect(PublicacaoSchema.safeParse(await publicacao({ arquivo: 'https://outro.site/x.html' })).success).toBe(false);
    expect(PublicacaoSchema.safeParse(await publicacao({ arquivo: 'versoes/../x.html' })).success).toBe(false);
  });

  it('download conferido pelo SHA-256; arquivo diferente é recusado', async () => {
    const p = await publicacao();
    vi.stubGlobal('fetch', vi.fn(() => resposta(html)));
    expect((await baixarPublicacao(p)).byteLength).toBe(html.byteLength);
    vi.stubGlobal('fetch', vi.fn(() => resposta(new TextEncoder().encode('<!DOCTYPE html><html><body>NOVA</body></html>'))));
    await expect(baixarPublicacao(p)).rejects.toThrow(/não confere/);
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));
    await expect(baixarPublicacao(p)).rejects.toThrow(/Nada foi alterado/);
  });
});

describe('CHANGELOG com seção [Não publicado]', () => {
  it('a seção não publicada não vira versão nem entra nas notas', () => {
    const n = lerChangelog('# Changelog\n\n## [Não publicado]\n\n### Adicionado\n- ainda não saiu\n\n## [1.5.0] - 2026-11-19\n### Adicionado\n- publicado');
    expect(n.map((x) => x.versao)).toEqual(['1.5.0']);
    expect(n[0].secoes[0].itens).toEqual(['publicado']);
    const m = lerChangelog('## [1.5.0]\n- a\n## [Não publicado]\n- b');
    expect(m[0].secoes[0].itens).toEqual(['a']);
  });
});
