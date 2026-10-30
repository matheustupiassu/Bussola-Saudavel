// js/repositorios/repositorio-local.js
import {
  VERSAO_ESQUEMA,
  ESTADOS_DISPONIBILIDADE,
  NIVEIS_CONFIABILIDADE,
  criarDadosSeed
} from '../dados/demonstracao.js';
import { normalizarTexto, validarEsquemaDados } from './contrato-repositorio.js';

let cacheMemoria = null;
let avisoArmazenamento = null;

/**
 * Inicializa ou recupera a base local versionada (Cap. 13.7)
 */
export function obterEstadoRepositorio(forcarRecarga = false) {
  if (cacheMemoria && !forcarRecarga) return cacheMemoria;

  try {
    const bruto = localStorage.getItem(VERSAO_ESQUEMA);
    if (bruto) {
      const parsed = JSON.parse(bruto);
      if (validarEsquemaDados(parsed, VERSAO_ESQUEMA)) {
        cacheMemoria = parsed;
        return cacheMemoria;
      } else {
        avisoArmazenamento =
          'Dados locais de versão anterior ou inválidos foram reinicializados para o padrão de demonstração.';
      }
    }
  } catch (erro) {
    console.warn('Falha ao ler localStorage (T-20): operando em memória.', erro);
    avisoArmazenamento =
      'O armazenamento local do navegador está indisponível ou bloqueado. O protótipo continuará a funcionar em memória temporária.';
  }

  cacheMemoria = criarDadosSeed();
  persistirEstadoRepositorio(cacheMemoria, 'INICIALIZACAO_SEED');
  return cacheMemoria;
}

/**
 * Grava o estado em localStorage e emite evento global para propagação imediata (Cap. 16 - Etapa 8)
 */
export function persistirEstadoRepositorio(estado, origemEvento = 'ATUALIZACAO_LOCAL') {
  cacheMemoria = estado;
  let gravouNoStorage = false;

  try {
    localStorage.setItem(VERSAO_ESQUEMA, JSON.stringify(estado));
    gravouNoStorage = true;
  } catch (erro) {
    console.warn('Não foi possível gravar no localStorage (quota ou bloqueio):', erro);
    avisoArmazenamento =
      'Não foi possível guardar alterações permanentes no navegador, mas a sessão atual permanece ativa.';
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('bussola:estado-atualizado', {
        detail: {
          origem: origemEvento,
          instante: new Date().toISOString(),
          persistido: gravouNoStorage
        }
      })
    );
  }

  return gravouNoStorage;
}

/**
 * Escuta alterações vindas de outras abas abertas do navegador (evento nativo 'storage')
 */
export function registrarSincronizacaoEntreAbas(callbackAoAtualizar) {
  if (typeof window === 'undefined') return;

  window.addEventListener('storage', (evento) => {
    if (evento.key === VERSAO_ESQUEMA) {
      cacheMemoria = null;
      const novoEstado = obterEstadoRepositorio(true);
      if (typeof callbackAoAtualizar === 'function') {
        callbackAoAtualizar(novoEstado, 'SINCRONIZACAO_OUTRA_ABA');
      }
    }
  });
}

export function obterAvisoArmazenamento() {
  return avisoArmazenamento;
}

/**
 * Restaura os dados originais de fábrica apenas para a chave do protótipo (Cap. 13.7 / T-19)
 */
export function restaurarDemonstracao() {
  const novoSeed = criarDadosSeed();
  try {
    sessionStorage.removeItem('bussola_nav_busca_state_v1');
    sessionStorage.removeItem('bussola_form_drafts_v1');
  } catch {
    // Ignora se sessionStorage bloqueado
  }
  persistirEstadoRepositorio(novoSeed, 'RESTAURACAO_SEED');
  return novoSeed;
}

/**
 * Verifica conformidade de privacidade do armazenamento local (T-26)
 */
export function auditarPrivacidadeArmazenamento() {
  const estado = obterEstadoRepositorio();
  const serializado = JSON.stringify(estado);
  const camposProibidos = ['senha', 'password', 'cpf', 'prontuario', 'diagnosticoClinico', 'tokenSecreto'];
  const violacoes = camposProibidos.filter((termo) =>
    serializado.toLowerCase().includes(`"${termo.toLowerCase()}"`)
  );

  return {
    chave: VERSAO_ESQUEMA,
    tamanhoBytes: new Blob([serializado]).size,
    totalUnidades: estado.unidades.length,
    totalServicos: estado.servicos.length,
    totalAuditoria: (estado.historicoAuditoria || []).length,
    semDadosSensiveisReais: violacoes.length === 0,
    violacoesEncontradas: violacoes
  };
}

export function listarEspecialidades() {
  const estado = obterEstadoRepositorio();
  return [...estado.especialidades];
}

export function listarBairrosDistintos() {
  const estado = obterEstadoRepositorio();
  const bairros = new Set(estado.unidades.map((u) => u.bairro));
  return Array.from(bairros).sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

export function listarOpcoesFiltros() {
  const estado = obterEstadoRepositorio();
  const tiposUnidade = new Set();
  const convenios = new Set();
  const acessibilidades = new Set();

  estado.unidades.forEach((u) => {
    if (u.tipo) tiposUnidade.add(u.tipo);
    (u.conveniosAceitos || []).forEach((c) => convenios.add(c));
    (u.acessibilidade || []).forEach((a) => acessibilidades.add(a));
  });

  return {
    redes: ['SUS', 'Convênio', 'Particular'],
    bairros: listarBairrosDistintos(),
    especialidades: listarEspecialidades(),
    estadosDisponibilidade: Object.values(ESTADOS_DISPONIBILIDADE),
    tiposUnidade: Array.from(tiposUnidade).sort(),
    diasTurnos: ['Manhã', 'Tarde', 'Noite', '24 horas', 'Sábado', 'Domingo'],
    convenios: Array.from(convenios).sort(),
    acessibilidades: Array.from(acessibilidades).sort(),
    confiabilidades: Object.values(NIVEIS_CONFIABILIDADE)
  };
}

export function calcularDistanciaKm(lat1, lon1, lat2, lon2) {
  if ([lat1, lon1, lat2, lon2].some((v) => typeof v !== 'number' || Number.isNaN(v))) {
    return null;
  }
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export function listarUnidadesCompletas(coordReferencia = null) {
  const estado = obterEstadoRepositorio();

  return estado.unidades.map((unidade) => {
    const servicosDaUnidade = estado.servicos
      .filter((s) => s.unidadeId === unidade.id)
      .map((servico) => {
        const especialidade = estado.especialidades.find((e) => e.id === servico.especialidadeId) || null;
        const disponibilidades = estado.disponibilidades
          .filter((d) => d.servicoId === servico.id)
          .map((d) => ({
            ...d,
            metaEstado: ESTADOS_DISPONIBILIDADE[d.estado] || ESTADOS_DISPONIBILIDADE['DISP-05'],
            metaConfiabilidade:
              NIVEIS_CONFIABILIDADE[d.confiabilidade] || NIVEIS_CONFIABILIDADE['DEMONSTRATIVO']
          }));

        return {
          ...servico,
          especialidadeNome: especialidade ? especialidade.nome : 'Geral',
          especialidade,
          disponibilidades
        };
      });

    const especialidadesUnicas = [];
    const idsVistos = new Set();
    servicosDaUnidade.forEach((s) => {
      if (s.especialidade && !idsVistos.has(s.especialidade.id)) {
        idsVistos.add(s.especialidade.id);
        especialidadesUnicas.push(s.especialidade);
      }
    });

    const distanciaKm =
      coordReferencia && typeof unidade.latitude === 'number' && typeof unidade.longitude === 'number'
        ? calcularDistanciaKm(coordReferencia.lat, coordReferencia.lng, unidade.latitude, unidade.longitude)
        : null;

    return {
      ...unidade,
      distanciaKm,
      metaConfiabilidadeUnidade:
        NIVEIS_CONFIABILIDADE[unidade.confiabilidadeUnidade] || NIVEIS_CONFIABILIDADE['DEMONSTRATIVO'],
      servicos: servicosDaUnidade,
      especialidades: especialidadesUnicas
    };
  });
}

export function pesquisarUnidades(criterios = {}) {
  const {
    termo = '',
    modo = 'todos',
    rede = 'TODAS',
    redes = [],
    bairros = [],
    distanciaMaxKm = null,
    coordReferencia = null,
    especialidadesIds = [],
    disponibilidades = [],
    tiposUnidade = [],
    diasTurnos = [],
    convenios = [],
    acessibilidades = [],
    confiabilidades = [],
    limitesMapa = null,
    ordenacao = 'relevancia'
  } = criterios;

  const termoNorm = normalizarTexto(termo);
  const todas = listarUnidadesCompletas(coordReferencia);
  const listaEsp = listarEspecialidades();

  const especialidadesOrientadasPorCondicao = [];
  if (termoNorm.length > 0 && (modo === 'condicao' || modo === 'todos')) {
    listaEsp.forEach((esp) => {
      const bateCondicao = esp.condicoesOrientativas.some(
        (c) => normalizarTexto(c).includes(termoNorm) || termoNorm.includes(normalizarTexto(c))
      );
      const bateNomeOuSinonimo =
        normalizarTexto(esp.nome).includes(termoNorm) ||
        esp.sinonimos.some((s) => normalizarTexto(s).includes(termoNorm));
      if (bateCondicao || (modo === 'condicao' && bateNomeOuSinonimo)) {
        especialidadesOrientadasPorCondicao.push(esp);
      }
    });
  }

  const redesAtivas = redes.length > 0 ? redes : rede && rede !== 'TODAS' ? [rede] : [];

  const filtradas = todas.filter((unidade) => {
    if (termoNorm) {
      const matchNome =
        normalizarTexto(unidade.nome).includes(termoNorm) || normalizarTexto(unidade.tipo).includes(termoNorm);
      const matchBairro =
        normalizarTexto(unidade.bairro).includes(termoNorm) || normalizarTexto(unidade.regiao).includes(termoNorm);
      const matchEspecialidade = unidade.especialidades.some(
        (esp) =>
          normalizarTexto(esp.nome).includes(termoNorm) ||
          esp.sinonimos.some((sin) => normalizarTexto(sin).includes(termoNorm))
      );
      const matchCondicao = unidade.especialidades.some((esp) =>
        especialidadesOrientadasPorCondicao.some((orientada) => orientada.id === esp.id)
      );
      const matchServico = unidade.servicos.some(
        (srv) =>
          normalizarTexto(srv.nome).includes(termoNorm) || normalizarTexto(srv.especialidadeNome).includes(termoNorm)
      );

      let bateTermo = false;
      switch (modo) {
        case 'especialidade':
          bateTermo = matchEspecialidade;
          break;
        case 'condicao':
          bateTermo = matchCondicao || matchEspecialidade;
          break;
        case 'servico':
          bateTermo = matchServico;
          break;
        case 'nome':
          bateTermo = matchNome;
          break;
        case 'bairro':
          bateTermo = matchBairro;
          break;
        case 'todos':
        default:
          bateTermo = matchNome || matchBairro || matchEspecialidade || matchCondicao || matchServico;
          break;
      }
      if (!bateTermo) return false;
    }

    if (redesAtivas.length > 0) {
      const bateRede = redesAtivas.some((r) =>
        unidade.modalidades.some((m) => normalizarTexto(m) === normalizarTexto(r))
      );
      if (!bateRede) return false;
    }

    if (bairros.length > 0) {
      const bateBairro = bairros.some((b) => normalizarTexto(unidade.bairro) === normalizarTexto(b));
      if (!bateBairro) return false;
    }

    if (distanciaMaxKm && coordReferencia) {
      if (typeof unidade.distanciaKm !== 'number' || unidade.distanciaKm > Number(distanciaMaxKm)) {
        return false;
      }
    }

    if (especialidadesIds.length > 0) {
      const bateEsp = unidade.servicos.some((s) => especialidadesIds.includes(s.especialidadeId));
      if (!bateEsp) return false;
    }

    if (disponibilidades.length > 0) {
      const bateDisp = unidade.servicos.some((s) => {
        if (especialidadesIds.length > 0 && !especialidadesIds.includes(s.especialidadeId)) return false;
        return s.disponibilidades.some((d) => {
          if (
            redesAtivas.length > 0 &&
            !redesAtivas.some((r) => normalizarTexto(r) === normalizarTexto(d.modalidade))
          ) {
            return false;
          }
          return disponibilidades.includes(d.estado);
        });
      });
      if (!bateDisp) return false;
    }

    if (tiposUnidade.length > 0) {
      const bateTipo = tiposUnidade.some((t) => normalizarTexto(unidade.tipo) === normalizarTexto(t));
      if (!bateTipo) return false;
    }

    if (diasTurnos.length > 0) {
      const bateDiaTurno = diasTurnos.some(
        (dt) =>
          (unidade.turnos || []).some((t) => normalizarTexto(t) === normalizarTexto(dt)) ||
          (unidade.diasFuncionamento || []).some((d) => normalizarTexto(d) === normalizarTexto(dt))
      );
      if (!bateDiaTurno) return false;
    }

    if (convenios.length > 0) {
      const bateConv = convenios.some((c) =>
        (unidade.conveniosAceitos || []).some((uc) => normalizarTexto(uc) === normalizarTexto(c))
      );
      if (!bateConv) return false;
    }

    if (acessibilidades.length > 0) {
      const bateAcess = acessibilidades.some((a) =>
        (unidade.acessibilidade || []).some((ua) => normalizarTexto(ua) === normalizarTexto(a))
      );
      if (!bateAcess) return false;
    }

    if (confiabilidades.length > 0) {
      const bateConfUnidade = confiabilidades.includes(unidade.confiabilidadeUnidade);
      const bateConfServico = unidade.servicos.some((s) =>
        s.disponibilidades.some((d) => confiabilidades.includes(d.confiabilidade))
      );
      if (!bateConfUnidade && !bateConfServico) return false;
    }

    if (limitesMapa) {
      if (typeof unidade.latitude !== 'number' || typeof unidade.longitude !== 'number') return false;
      const dentroLat = unidade.latitude <= limitesMapa.norte && unidade.latitude >= limitesMapa.sul;
      const dentroLng = unidade.longitude <= limitesMapa.leste && unidade.longitude >= limitesMapa.oeste;
      if (!dentroLat || !dentroLng) return false;
    }

    return true;
  });

  const ordenadas = [...filtradas].sort((a, b) => {
    switch (ordenacao) {
      case 'distancia': {
        const da = typeof a.distanciaKm === 'number' ? a.distanciaKm : Number.POSITIVE_INFINITY;
        const db = typeof b.distanciaKm === 'number' ? b.distanciaKm : Number.POSITIVE_INFINITY;
        if (da !== db) return da - db;
        return a.nome.localeCompare(b.nome, 'pt-BR');
      }
      case 'disponibilidade': {
        const scoreDisp = (u) => {
          const estados = u.servicos.flatMap((s) => s.disponibilidades.map((d) => d.estado));
          if (estados.includes('DISP-01') || estados.includes('DISP-02')) return 1;
          if (estados.includes('DISP-05') || estados.includes('DISP-06')) return 2;
          return 3;
        };
        const sa = scoreDisp(a);
        const sb = scoreDisp(b);
        if (sa !== sb) return sa - sb;
        return a.nome.localeCompare(b.nome, 'pt-BR');
      }
      case 'verificacao': {
        const ta = a.ultimaVerificacao ? Date.parse(a.ultimaVerificacao) : 0;
        const tb = b.ultimaVerificacao ? Date.parse(b.ultimaVerificacao) : 0;
        if (tb !== ta) return tb - ta;
        return a.nome.localeCompare(b.nome, 'pt-BR');
      }
      case 'alfabetica':
        return a.nome.localeCompare(b.nome, 'pt-BR');
      case 'relevancia':
      default: {
        if (!termoNorm) return a.id.localeCompare(b.id, 'pt-BR');
        const nomeA = normalizarTexto(a.nome).includes(termoNorm) ? 0 : 1;
        const nomeB = normalizarTexto(b.nome).includes(termoNorm) ? 0 : 1;
        if (nomeA !== nomeB) return nomeA - nomeB;
        return a.id.localeCompare(b.id, 'pt-BR');
      }
    }
  });

  return {
    termoOriginal: termo.trim(),
    modoAplicado: modo,
    especialidadesOrientadas: especialidadesOrientadasPorCondicao,
    total: ordenadas.length,
    unidades: ordenadas
  };
}