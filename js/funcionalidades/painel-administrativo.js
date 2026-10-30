// js/funcionalidades/painel-administrativo.js
import {
  obterEstadoRepositorio,
  persistirEstadoRepositorio,
  listarUnidadesCompletas,
  restaurarDemonstracao,
  obterAvisoArmazenamento
} from '../repositorios/repositorio-local.js';
import { ESTADOS_DISPONIBILIDADE, NIVEIS_CONFIABILIDADE } from '../dados/demonstracao.js';

/**
 * Matriz de permissões demonstrativas na interface por papel administrativo (Cap. 9.2–9.4, RN-020 e Apêndice B)
 */
const MATRIZ_PAPEIS_ADMIN = {
  admin_geral: {
    titulo: 'Administrador Geral (Acesso Integral)',
    descricao: 'Acesso a todos os módulos: instituições, representantes, verificações, disponibilidades, relatos, contas de pacientes e restauração.',
    modulosVisiveis: [
      'mod-verificacoes',
      'mod-revisao-disp',
      'mod-cadastros-rep',
      'mod-relatos',
      'mod-estatisticas',
      'mod-pacientes',
      'mod-auditoria'
    ]
  },
  admin_institucional: {
    titulo: 'Administrador Institucional (Foco em Entidades e Vínculos)',
    descricao: 'Gere instituições, solicitações de cadastro, vínculo de representantes e irregularidades institucionais (Cap. 9.3).',
    modulosVisiveis: [
      'mod-cadastros-rep',
      'mod-relatos',
      'mod-estatisticas',
      'mod-auditoria'
    ]
  },
  verificador: {
    titulo: 'Verificador (Foco em Qualidade Informacional e Prazos)',
    descricao: 'Analisa pedidos de selo Verificado, revê disponibilidades publicadas, sinaliza prazos vencidos e trata relatos de informação incorreta (Cap. 9.4 / CA-903).',
    modulosVisiveis: [
      'mod-verificacoes',
      'mod-revisao-disp',
      'mod-relatos',
      'mod-estatisticas',
      'mod-auditoria'
    ]
  }
};

export function inicializarPainelAdministrativo() {
  const aviso = obterAvisoArmazenamento();
  const avisoEl = document.getElementById('aviso-armazenamento');
  if (aviso && avisoEl) {
    avisoEl.hidden = false;
    avisoEl.textContent = aviso;
  }

  garantirPersonaAdminInicial();
  popularSeletoresIniciaisAdmin();
  configurarEventosPainelAdmin();
  renderizarPainelAdministrativoCompleto();
}

function garantirPersonaAdminInicial() {
  const estado = obterEstadoRepositorio();
  const personaAtual = estado.personas.find((p) => p.id === estado.personaAtivaId);
  if (!personaAtual || personaAtual.tipo !== 'ADMIN') {
    const adminPadrao = estado.personas.find((p) => p.papel === 'admin_geral') || estado.personas[3];
    if (adminPadrao) {
      estado.personaAtivaId = adminPadrao.id;
      persistirEstadoRepositorio(estado);
    }
  }
}

function obterPersonaAdminAtiva() {
  const estado = obterEstadoRepositorio();
  return (
    estado.personas.find((p) => p.id === estado.personaAtivaId && p.tipo === 'ADMIN') ||
    estado.personas.find((p) => p.papel === 'admin_geral')
  );
}

function popularSeletoresIniciaisAdmin() {
  const estado = obterEstadoRepositorio();
  const selectPapel = document.getElementById('admin-select-papel');
  const personaAtiva = obterPersonaAdminAtiva();

  if (selectPapel) {
    selectPapel.innerHTML = '';
    estado.personas
      .filter((p) => p.tipo === 'ADMIN')
      .forEach((p) => {
        const opt = document.createElement('option');
        opt.value = p.id;
        const meta = MATRIZ_PAPEIS_ADMIN[p.papel];
        opt.textContent = `${p.nome} — ${meta ? meta.titulo : p.papel}`;
        if (p.id === personaAtiva.id) opt.selected = true;
        selectPapel.appendChild(opt);
      });
  }

  // Popular selects de correção administrativa de disponibilidade e prazos
  const selUnidadeRev = document.getElementById('admin-rev-unidade');
  if (selUnidadeRev) {
    selUnidadeRev.innerHTML = '';
    estado.unidades.forEach((u) => {
      const opt = document.createElement('option');
      opt.value = u.id;
      opt.textContent = `[${u.id}] ${u.nome} (${u.bairro})`;
      selUnidadeRev.appendChild(opt);
    });
  }

  const selConfUnidade = document.getElementById('admin-rev-confiabilidade');
  if (selConfUnidade && selConfUnidade.options.length === 0) {
    Object.values(NIVEIS_CONFIABILIDADE).forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c.codigo;
      opt.textContent = `${c.icone} ${c.rotulo} (${c.codigo})`;
      selConfUnidade.appendChild(opt);
    });
  }

  const selEstadoDisp = document.getElementById('admin-rev-estado-disp');
  if (selEstadoDisp && selEstadoDisp.options.length === 0) {
    Object.values(ESTADOS_DISPONIBILIDADE).forEach((st) => {
      const opt = document.createElement('option');
      opt.value = st.codigo;
      opt.textContent = `${st.codigo} — ${st.icone} ${st.rotulo}`;
      selEstadoDisp.appendChild(opt);
    });
  }

  // Popular selects de gestão de representantes institucionais
  const selRepPersona = document.getElementById('admin-rep-persona');
  if (selRepPersona) {
    selRepPersona.innerHTML = '';
    estado.personas
      .filter((p) => p.tipo === 'INSTITUICAO')
      .forEach((p) => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = `${p.nome} (Vínculos atuais: ${p.unidadesVinculadas.join(', ') || 'Nenhum'})`;
        selRepPersona.appendChild(opt);
      });
  }

  const selRepUnidade = document.getElementById('admin-rep-unidade');
  if (selRepUnidade) {
    selRepUnidade.innerHTML = '';
    estado.unidades.forEach((u) => {
      const opt = document.createElement('option');
      opt.value = u.id;
      opt.textContent = `[${u.id}] ${u.nome}`;
      selRepUnidade.appendChild(opt);
    });
  }

  atualizarSelectServicosRevisaoAdmin();
}

function atualizarSelectServicosRevisaoAdmin() {
  const unidadeId = document.getElementById('admin-rev-unidade')?.value || 'U01';
  const selDisp = document.getElementById('admin-rev-disp-id');
  const selConf = document.getElementById('admin-rev-confiabilidade');
  const unidades = listarUnidadesCompletas();
  const unidade = unidades.find((u) => u.id === unidadeId);

  if (!unidade) return;
  if (selConf) selConf.value = unidade.confiabilidadeUnidade;

  if (selDisp) {
    selDisp.innerHTML = '';
    unidade.servicos.forEach((srv) => {
      srv.disponibilidades.forEach((d) => {
        const opt = document.createElement('option');
        opt.value = d.id;
        opt.textContent = `[${srv.nome} — ${d.modalidade}] Atual: ${d.estado} (${d.confiabilidade})`;
        selDisp.appendChild(opt);
      });
    });
  }
}

function configurarEventosPainelAdmin() {
  // 1. Troca de Papel Administrativo (CA-901 / CA-903 / T-16)
  document.getElementById('admin-select-papel')?.addEventListener('change', (e) => {
    const estado = obterEstadoRepositorio();
    estado.personaAtivaId = e.target.value;
    persistirEstadoRepositorio(estado);
    renderizarPainelAdministrativoCompleto();
    exibirFeedbackAdmin('Papel administrativo alterado. Menus e módulos ajustados conforme matriz RN-020 (CA-901 / T-16).', 'info');
  });

  document.getElementById('admin-rev-unidade')?.addEventListener('change', atualizarSelectServicosRevisaoAdmin);

  // 2. Revisão de Confiabilidade, Correção de Disponibilidade e Sinalização de Vencimento (RF-033)
  document.getElementById('form-admin-revisao-disp')?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!validarPapelPermitido(['admin_geral', 'verificador'])) return;

    const unidadeId = document.getElementById('admin-rev-unidade')?.value;
    const novaConfiabilidadeUnidade = document.getElementById('admin-rev-confiabilidade')?.value;
    const dispId = document.getElementById('admin-rev-disp-id')?.value;
    const novoEstadoDisp = document.getElementById('admin-rev-estado-disp')?.value;

    const estado = obterEstadoRepositorio();
    const unidade = estado.unidades.find((u) => u.id === unidadeId);
    const agora = new Date().toISOString();

    if (unidade && novaConfiabilidadeUnidade && unidade.confiabilidadeUnidade !== novaConfiabilidadeUnidade) {
      registrarAuditoriaAdmin(
        estado,
        'Unidade',
        unidade.id,
        'confiabilidadeUnidade',
        unidade.confiabilidadeUnidade,
        novaConfiabilidadeUnidade
      );
      unidade.confiabilidadeUnidade = novaConfiabilidadeUnidade;
      if (novaConfiabilidadeUnidade === 'VERIFICADO') {
        unidade.ultimaVerificacao = agora;
      }
      unidade.ultimaAtualizacao = agora;
    }

    if (dispId && novoEstadoDisp) {
      const disp = estado.disponibilidades.find((d) => d.id === dispId);
      if (disp) {
        registrarAuditoriaAdmin(
          estado,
          'Disponibilidade',
          unidadeId,
          `Revisão Admin (${disp.id} - ${disp.modalidade})`,
          `${disp.estado} [${disp.confiabilidade}]`,
          `${novoEstadoDisp} [${novaConfiabilidadeUnidade}]`
        );
        disp.estado = novoEstadoDisp;
        disp.confiabilidade = novaConfiabilidadeUnidade || disp.confiabilidade;
        disp.informadoEm = agora;
        disp.fonte = 'Revisão Administrativa / Verificador (Demo)';
      }
    }

    persistirEstadoRepositorio(estado);
    popularSeletoresIniciaisAdmin();
    renderizarPainelAdministrativoCompleto();
    exibirFeedbackAdmin(`Unidade ${unidadeId} e disponibilidade revisadas com sucesso (CA-902 / CA-904).`, 'available');
  });

  // Botão rápido para sinalizar informação vencida (RF-033 / CA-1003)
  document.getElementById('btn-admin-sinalizar-vencido')?.addEventListener('click', () => {
    if (!validarPapelPermitido(['admin_geral', 'verificador'])) return;
    const unidadeId = document.getElementById('admin-rev-unidade')?.value;
    const dispId = document.getElementById('admin-rev-disp-id')?.value;

    const estado = obterEstadoRepositorio();
    const unidade = estado.unidades.find((u) => u.id === unidadeId);
    if (unidade) {
      registrarAuditoriaAdmin(estado, 'Unidade', unidade.id, 'Sinalização de Prazo Vencido', unidade.confiabilidadeUnidade, 'DESATUALIZADO');
      unidade.confiabilidadeUnidade = 'DESATUALIZADO';
    }
    if (dispId) {
      const disp = estado.disponibilidades.find((d) => d.id === dispId);
      if (disp) {
        disp.estado = 'DISP-06';
        disp.confiabilidade = 'DESATUALIZADO';
      }
    }
    persistirEstadoRepositorio(estado);
    popularSeletoresIniciaisAdmin();
    renderizarPainelAdministrativoCompleto();
    exibirFeedbackAdmin(`Unidade ${unidadeId} sinalizada como DESATUALIZADA / VENCIDA (DISP-06).`, 'warning');
  });

  // 3. Vincular / Desvincular Representante Institucional (RF-033)
  document.getElementById('form-admin-vincular-rep')?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!validarPapelPermitido(['admin_geral', 'admin_institucional'])) return;

    const personaId = document.getElementById('admin-rep-persona')?.value;
    const unidadeId = document.getElementById('admin-rep-unidade')?.value;
    const acao = document.getElementById('admin-rep-acao')?.value || 'VINCULAR';

    const estado = obterEstadoRepositorio();
    const persona = estado.personas.find((p) => p.id === personaId);
    if (!persona) return;

    const antes = [...(persona.unidadesVinculadas || [])].join(', ');
    if (acao === 'VINCULAR') {
      if (!persona.unidadesVinculadas.includes(unidadeId)) {
        persona.unidadesVinculadas.push(unidadeId);
      }
    } else {
      persona.unidadesVinculadas = persona.unidadesVinculadas.filter((id) => id !== unidadeId);
    }
    const depois = persona.unidadesVinculadas.join(', ');

    registrarAuditoriaAdmin(
      estado,
      'PersonaInstitucional',
      unidadeId,
      `Vínculo de Representante (${persona.nome})`,
      antes || 'Nenhum',
      depois || 'Nenhum'
    );

    persistirEstadoRepositorio(estado);
    popularSeletoresIniciaisAdmin();
    renderizarPainelAdministrativoCompleto();
    exibirFeedbackAdmin(`Vínculo de ${persona.nome} com a unidade ${unidadeId} atualizado (${acao}).`, 'available');
  });

  // 4. Gestão Demonstrativa de Contas de Pacientes e Restauração Global (Exclusivo Admin Geral — CA-903 / T-19)
  document.getElementById('btn-admin-limpar-dados-pacientes')?.addEventListener('click', () => {
    if (!validarPapelPermitido(['admin_geral'])) return;
    if (!confirm('Limpar todos os favoritos, pesquisas guardadas e alertas demonstrativos dos pacientes?')) return;

    const estado = obterEstadoRepositorio();
    registrarAuditoriaAdmin(
      estado,
      'ContasPacientes',
      'GLOBAL',
      'Limpeza Administrativa de Dados de Pacientes',
      `Fav:${estado.favoritos.length}, Pesq:${estado.pesquisasSalvas.length}, Alt:${estado.alertas.length}`,
      'Zero registos'
    );
    estado.favoritos = [];
    estado.pesquisasSalvas = [];
    estado.alertas = [];
    estado.eventosAlertaDemo = [];
    persistirEstadoRepositorio(estado);
    renderizarPainelAdministrativoCompleto();
    exibirFeedbackAdmin('Registos demonstrativos das contas de pacientes reinicializados.', 'info');
  });

  document.getElementById('btn-admin-restaurar-seed')?.addEventListener('click', () => {
    if (!validarPapelPermitido(['admin_geral'])) return;
    if (!confirm('Confirmar restauração integral do catálogo inicial (10 unidades seed — T-19)? Todas as edições locais serão revertidas.')) {
      return;
    }
    restaurarDemonstracao();
    garantirPersonaAdminInicial();
    popularSeletoresIniciaisAdmin();
    renderizarPainelAdministrativoCompleto();
    exibirFeedbackAdmin('Catálogo demonstrativo restaurado para o seed original de fábrica (T-19).', 'available');
  });
}

function validarPapelPermitido(papeisAutorizados) {
  const persona = obterPersonaAdminAtiva();
  if (!papeisAutorizados.includes(persona.papel)) {
    exibirFeedbackAdmin(
      `Ação bloqueada na interface (CA-903 / RN-020): o papel atual (${persona.papel}) não possui permissão para esta operação.`,
      'danger'
    );
    return false;
  }
  return true;
}

function registrarAuditoriaAdmin(estado, entidade, entidadeId, campo, antes, depois) {
  if (!Array.isArray(estado.historicoAuditoria)) estado.historicoAuditoria = [];
  const persona = obterPersonaAdminAtiva();
  estado.historicoAuditoria.unshift({
    id: `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    entidade,
    entidadeId,
    campo,
    antes: String(antes ?? ''),
    depois: String(depois ?? ''),
    atorDemo: `${persona.nome} [${persona.papel.toUpperCase()}]`,
    instante: new Date().toISOString()
  });
}

function exibirFeedbackAdmin(mensagem, classe = 'info') {
  const box = document.getElementById('feedback-painel-admin');
  if (!box) return;
  box.hidden = false;
  box.className = `status-pill status-pill--${classe}`;
  box.style.display = 'block';
  box.style.padding = 'var(--space-3)';
  box.style.marginBottom = 'var(--space-4)';
  box.textContent = mensagem;
}

function renderizarPainelAdministrativoCompleto() {
  const estado = obterEstadoRepositorio();
  const unidades = listarUnidadesCompletas();
  const persona = obterPersonaAdminAtiva();
  const configPapel = MATRIZ_PAPEIS_ADMIN[persona.papel] || MATRIZ_PAPEIS_ADMIN.admin_geral;

  // Atualiza cabeçalho de papel e visibilidade de módulos e links (CA-901 / CA-903 / T-16)
  setTexto('admin-badge-papel-ativo', `Papel Ativo: ${configPapel.titulo}`);
  setTexto('admin-descricao-papel-ativo', configPapel.descricao);

  const todosModulos = [
    'mod-verificacoes',
    'mod-revisao-disp',
    'mod-cadastros-rep',
    'mod-relatos',
    'mod-estatisticas',
    'mod-pacientes',
    'mod-auditoria'
  ];

  todosModulos.forEach((modId) => {
    const visivel = configPapel.modulosVisiveis.includes(modId);
    const secEl = document.getElementById(modId);
    const navLink = document.querySelector(`[data-nav-target="${modId}"]`);
    if (secEl) secEl.hidden = !visivel;
    if (navLink) navLink.hidden = !visivel;
  });

  renderizarDezIndicadoresDashboard(unidades, estado);
  renderizarFilaPedidosVerificacao(estado);
  renderizarFilaSolicitacoesInstitucionais(estado);
  renderizarFilaRelatosErro(estado);
  renderizarEstatisticasDemonstrativas(unidades, estado);
  renderizarResumoContasPacientes(estado);
  renderizarTrilhaAuditoriaGlobal(estado);
}

/**
 * Renderiza os 10 indicadores do Dashboard Administrativo (RF-032 / Cap. 9.1 / CA-904)
 */
function renderizarDezIndicadoresDashboard(unidades, estado) {
  const totalInstituicoes = unidades.length;
  const solicitacoesPendentes = (estado.solicitacoesInstitucionais || []).filter(
    (s) => s.estado === 'PENDENTE' || s.estado === 'EM_ANALISE'
  ).length;
  const instituicoesVerificadas = unidades.filter((u) => u.confiabilidadeUnidade === 'VERIFICADO').length;

  const todasDisp = unidades.flatMap((u) => u.servicos.flatMap((s) => s.disponibilidades));
  const infoVencidas =
    unidades.filter((u) => u.confiabilidadeUnidade === 'DESATUALIZADO').length +
    todasDisp.filter((d) => d.estado === 'DISP-06' || d.confiabilidade === 'DESATUALIZADO').length;

  const servicosDispAtualizada = todasDisp.filter(
    (d) => (d.estado === 'DISP-01' || d.estado === 'DISP-02') && d.confiabilidade !== 'DESATUALIZADO'
  ).length;

  const irregularidades = unidades.filter(
    (u) => u.confiabilidadeUnidade === 'NAO_CONFIRMADO' || typeof u.latitude !== 'number'
  ).length;

  const pedidosVerifPendentes = (estado.verificacoes || []).filter((v) => v.estado === 'PENDENTE').length;
  const atividadesRecentes = (estado.historicoAuditoria || []).length;
  const relatosPendentes = (estado.relatos || []).filter((r) => r.estado === 'PENDENTE').length;
  const totalServicosRede = estado.servicos.length;

  setTexto('adm-ind-1-total', String(totalInstituicoes));
  setTexto('adm-ind-2-pendentes', String(solicitacoesPendentes));
  setTexto('adm-ind-3-verificadas', `${instituicoesVerificadas} de ${totalInstituicoes}`);
  setTexto('adm-ind-4-vencidas', String(infoVencidas));
  setTexto('adm-ind-5-atualizadas', `${servicosDispAtualizada} de ${todasDisp.length}`);
  setTexto('adm-ind-6-irregularidades', String(irregularidades));
  setTexto('adm-ind-7-verificacoes', String(pedidosVerifPendentes));
  setTexto('adm-ind-8-atividades', String(atividadesRecentes));
  setTexto('adm-ind-9-relatorios', `${totalServicosRede} serviços mapeados`);
  setTexto('adm-ind-10-avisos', `${relatosPendentes} relato(s) pendente(s)`);
}

function renderizarFilaPedidosVerificacao(estado) {
  const container = document.getElementById('admin-lista-verificacoes');
  if (!container) return;
  container.innerHTML = '';

  const verificacoes = estado.verificacoes || [];
  if (verificacoes.length === 0) {
    container.innerHTML = '<p class="form-hint">Nenhum pedido de selo de verificação enviado pelas instituições ainda. Envie um pedido no Painel Institucional para testar (T-17).</p>';
    return;
  }

  verificacoes.forEach((verif) => {
    const u = estado.unidades.find((item) => item.id === verif.unidadeId);
    const div = document.createElement('div');
    div.className = 'service-list__item';

    const topo = document.createElement('div');
    topo.style.display = 'flex';
    topo.style.justifyContent = 'space-between';
    topo.style.flexWrap = 'wrap';
    topo.style.gap = 'var(--space-2)';

    const strong = document.createElement('strong');
    strong.textContent = `[${verif.id}] Unidade: ${u ? u.nome : verif.unidadeId} • Solicitante: ${verif.solicitanteDemo}`;
    const pill = document.createElement('span');
    pill.className = `status-pill status-pill--${verif.estado === 'APROVADO' ? 'available' : verif.estado === 'RECUSADO' ? 'danger' : 'warning'}`;
    pill.textContent = `Estado: ${verif.estado}`;
    topo.appendChild(strong);
    topo.appendChild(pill);
    div.appendChild(topo);

    const p = document.createElement('p');
    p.className = 'form-hint';
    p.style.margin = '4px 0';
    p.textContent = `Justificativa: "${verif.observacaoDemo || 'Revisão solicitada'}" • Documento: ${verif.documentoMetadadoDemo || 'N/A'} • Responsável: ${verif.responsavelDemo}`;
    div.appendChild(p);

    if (verif.estado === 'PENDENTE') {
      const acoes = document.createElement('div');
      acoes.style.display = 'flex';
      acoes.style.gap = 'var(--space-2)';
      acoes.style.marginTop = 'var(--space-2)';

      const btnAprovar = document.createElement('button');
      btnAprovar.type = 'button';
      btnAprovar.className = 'btn-a11y';
      btnAprovar.textContent = '✔ Aprovar e Conceder Selo VERIFICADO';
      btnAprovar.addEventListener('click', () => decidirVerificacao(verif.id, 'APROVADO'));

      const btnRecusar = document.createElement('button');
      btnRecusar.type = 'button';
      btnRecusar.className = 'btn-a11y';
      btnRecusar.textContent = '✖ Recusar Pedido';
      btnRecusar.addEventListener('click', () => decidirVerificacao(verif.id, 'RECUSADO'));

      acoes.appendChild(btnAprovar);
      acoes.appendChild(btnRecusar);
      div.appendChild(acoes);
    }

    container.appendChild(div);
  });
}

function decidirVerificacao(verifId, novoEstado) {
  if (!validarPapelPermitido(['admin_geral', 'verificador'])) return;
  const estado = obterEstadoRepositorio();
  const persona = obterPersonaAdminAtiva();
  const verif = (estado.verificacoes || []).find((v) => v.id === verifId);
  if (!verif) return;

  verif.estado = novoEstado;
  verif.responsavelDemo = `${persona.nome} (${persona.papel})`;

  const u = estado.unidades.find((item) => item.id === verif.unidadeId);
  if (u && novoEstado === 'APROVADO') {
    const antes = u.confiabilidadeUnidade;
    u.confiabilidadeUnidade = 'VERIFICADO';
    u.ultimaVerificacao = new Date().toISOString();
    registrarAuditoriaAdmin(estado, 'Unidade', u.id, 'Concessão de Selo VERIFICADO', antes, 'VERIFICADO');
  } else {
    registrarAuditoriaAdmin(estado, 'Verificacao', verif.unidadeId, `Decisão de Verificação (${verif.id})`, 'PENDENTE', novoEstado);
  }

  persistirEstadoRepositorio(estado);
  popularSeletoresIniciaisAdmin();
  renderizarPainelAdministrativoCompleto();
  exibirFeedbackAdmin(`Pedido de verificação ${verifId} atualizado para ${novoEstado}.`, novoEstado === 'APROVADO' ? 'available' : 'warning');
}

function renderizarFilaSolicitacoesInstitucionais(estado) {
  const container = document.getElementById('admin-lista-solicitacoes');
  if (!container) return;
  container.innerHTML = '';

  const lista = estado.solicitacoesInstitucionais || [];
  if (lista.length === 0) {
    container.innerHTML = '<p class="form-hint">Nenhuma solicitação institucional na fila no momento.</p>';
    return;
  }

  lista.forEach((sol) => {
    const div = document.createElement('div');
    div.className = 'service-list__item';

    const topo = document.createElement('div');
    topo.style.display = 'flex';
    topo.style.justifyContent = 'space-between';
    topo.style.flexWrap = 'wrap';
    topo.style.gap = 'var(--space-2)';

    const strong = document.createElement('strong');
    strong.textContent = `[${sol.id}] Unidade ${sol.unidadeId} — Tipo: ${sol.tipo}`;
    const pill = document.createElement('span');
    pill.className = 'status-pill status-pill--info';
    pill.textContent = `Estado: ${sol.estado}`;
    topo.appendChild(strong);
    topo.appendChild(pill);
    div.appendChild(topo);

    const p = document.createElement('p');
    p.className = 'form-hint';
    p.style.margin = '4px 0';
    p.textContent = sol.observacaoDemo;
    div.appendChild(p);

    // Estados do fluxo Cap. 8.12: pendente, em análise, documentação adicional, aprovado, recusado
    const acoes = document.createElement('div');
    acoes.style.display = 'flex';
    acoes.style.flexWrap = 'wrap';
    acoes.style.gap = 'var(--space-2)';
    acoes.style.marginTop = 'var(--space-2)';

    ['EM_ANALISE', 'DOCUMENTACAO_ADICIONAL', 'APROVADO', 'RECUSADO'].forEach((st) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn-a11y';
      btn.textContent = `Definir: ${st}`;
      btn.addEventListener('click', () => {
        if (!validarPapelPermitido(['admin_geral', 'admin_institucional'])) return;
        const antes = sol.estado;
        sol.estado = st;
        registrarAuditoriaAdmin(estado, 'SolicitacaoInstitucional', sol.unidadeId, `Fluxo Cadastro (${sol.id})`, antes, st);
        persistirEstadoRepositorio(estado);
        renderizarPainelAdministrativoCompleto();
        exibirFeedbackAdmin(`Solicitação ${sol.id} alterada para ${st}.`, 'info');
      });
      acoes.appendChild(btn);
    });

    div.appendChild(acoes);
    container.appendChild(div);
  });
}

function renderizarFilaRelatosErro(estado) {
  const container = document.getElementById('admin-lista-relatos');
  if (!container) return;
  container.innerHTML = '';

  const relatos = estado.relatos || [];
  if (relatos.length === 0) {
    container.innerHTML = '<p class="form-hint">Nenhum relato de informação incorreta registado. Clique em "⚠ 9. Relatar Erro" na página de detalhes de uma unidade para testar (T-18).</p>';
    return;
  }

  relatos.forEach((rel) => {
    const u = estado.unidades.find((item) => item.id === rel.unidadeId);
    const div = document.createElement('div');
    div.className = 'service-list__item';

    const topo = document.createElement('div');
    topo.style.display = 'flex';
    topo.style.justifyContent = 'space-between';
    topo.style.flexWrap = 'wrap';
    topo.style.gap = 'var(--space-2)';

    const strong = document.createElement('strong');
    strong.textContent = `[${rel.id}] Unidade: ${u ? u.nome : rel.unidadeId} • Campo apontado: ${rel.campo}`;
    const pill = document.createElement('span');
    pill.className = `status-pill status-pill--${rel.estado === 'TRATADO' ? 'available' : 'warning'}`;
    pill.textContent = `Estado: ${rel.estado}`;
    topo.appendChild(strong);
    topo.appendChild(pill);
    div.appendChild(topo);

    const p = document.createElement('p');
    p.className = 'form-hint';
    p.style.margin = '4px 0';
    p.textContent = `Descrição do relato: "${rel.descricaoDemo}" • Criado em: ${new Date(rel.criadoEm).toLocaleString('pt-BR')}`;
    div.appendChild(p);

    if (rel.estado !== 'TRATADO') {
      const acoes = document.createElement('div');
      acoes.style.display = 'flex';
      acoes.style.gap = 'var(--space-2)';
      acoes.style.marginTop = 'var(--space-2)';

      const btnResolver = document.createElement('button');
      btnResolver.type = 'button';
      btnResolver.className = 'btn-a11y';
      btnResolver.textContent = '✔ Marcar como Tratado / Resolvido';
      btnResolver.addEventListener('click', () => {
        rel.estado = 'TRATADO';
        registrarAuditoriaAdmin(estado, 'Relato', rel.unidadeId, `Tratamento de Relato (${rel.id})`, 'PENDENTE', 'TRATADO');
        persistirEstadoRepositorio(estado);
        renderizarPainelAdministrativoCompleto();
        exibirFeedbackAdmin(`Relato ${rel.id} processado e concluído (T-18).`, 'available');
      });

      const btnSinalizarUnidade = document.createElement('button');
      btnSinalizarUnidade.type = 'button';
      btnSinalizarUnidade.className = 'btn-a11y';
      btnSinalizarUnidade.textContent = '⚠ Sinalizar Unidade como Desatualizada e Concluir';
      btnSinalizarUnidade.addEventListener('click', () => {
        rel.estado = 'TRATADO';
        if (u) {
          u.confiabilidadeUnidade = 'DESATUALIZADO';
        }
        registrarAuditoriaAdmin(
          estado,
          'Relato',
          rel.unidadeId,
          `Relato Procedente (${rel.id})`,
          'PENDENTE',
          'TRATADO + Unidade sinalizada DESATUALIZADA'
        );
        persistirEstadoRepositorio(estado);
        renderizarPainelAdministrativoCompleto();
        exibirFeedbackAdmin(`Relato ${rel.id} concluído e unidade ${rel.unidadeId} marcada para revisão.`, 'warning');
      });

      acoes.appendChild(btnResolver);
      acoes.appendChild(btnSinalizarUnidade);
      div.appendChild(acoes);
    }

    container.appendChild(div);
  });
}

function renderizarEstatisticasDemonstrativas(unidades, estado) {
  const container = document.getElementById('admin-estatisticas-conteudo');
  if (!container) return;

  const porTipo = {};
  unidades.forEach((u) => {
    porTipo[u.tipo] = (porTipo[u.tipo] || 0) + 1;
  });

  const porEstadoDisp = {};
  estado.disponibilidades.forEach((d) => {
    porEstadoDisp[d.estado] = (porEstadoDisp[d.estado] || 0) + 1;
  });

  const strTipos = Object.entries(porTipo)
    .map(([tipo, qtd]) => `${tipo}: ${qtd}`)
    .join(' • ');

  const strEstados = Object.entries(porEstadoDisp)
    .map(([cod, qtd]) => `${cod}: ${qtd}`)
    .join(' • ');

  container.innerHTML = `
    <div class="service-list__item">
      <strong>Distribuição por Tipo de Estabelecimento (Catálogo Belém/PA):</strong>
      <p class="form-hint" style="margin:4px 0 0;">${strTipos}</p>
    </div>
    <div class="service-list__item">
      <strong>Distribuição de Registos por Código de Disponibilidade (RN-002):</strong>
      <p class="form-hint" style="margin:4px 0 0;">${strEstados}</p>
    </div>
  `;
}

function renderizarResumoContasPacientes(estado) {
  const el = document.getElementById('admin-resumo-pacientes');
  if (!el) return;
  el.textContent = `Registos ativos no navegador: ${(estado.favoritos || []).length} favorito(s), ${(estado.pesquisasSalvas || []).length} pesquisa(s) guardada(s), ${(estado.alertas || []).length} alerta(s) configurado(s) e ${(estado.eventosAlertaDemo || []).length} evento(s) local(is). (Sem dados clínicos ou senhas — T-26).`;
}

function renderizarTrilhaAuditoriaGlobal(estado) {
  const container = document.getElementById('admin-lista-auditoria');
  if (!container) return;
  container.innerHTML = '';

  const logs = estado.historicoAuditoria || [];
  if (logs.length === 0) {
    container.innerHTML = '<p class="form-hint">Nenhuma operação registada na trilha de auditoria ainda.</p>';
    return;
  }

  logs.slice(0, 25).forEach((log) => {
    const div = document.createElement('div');
    div.className = 'service-list__item';
    const dataFmt = new Date(log.instante).toLocaleString('pt-BR');

    const strong = document.createElement('strong');
    strong.textContent = `[${log.id}] ${log.entidade} (${log.entidadeId}) — ${log.campo}`;
    const p = document.createElement('p');
    p.className = 'form-hint';
    p.style.margin = '4px 0 0';
    p.textContent = `Antes: "${log.antes}" → Depois: "${log.depois}" • Ator: ${log.atorDemo} • Em: ${dataFmt}`;

    div.appendChild(strong);
    div.appendChild(p);
    container.appendChild(div);
  });
}

function setTexto(id, texto) {
  const el = document.getElementById(id);
  if (el) el.textContent = texto;
}