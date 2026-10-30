// js/funcionalidades/area-paciente.js
import {
  obterEstadoRepositorio,
  persistirEstadoRepositorio,
  listarUnidadesCompletas,
  listarEspecialidades,
  listarBairrosDistintos,
  listarOpcoesFiltros,
  obterAvisoArmazenamento
} from '../repositorios/repositorio-local.js';

export const GATILHOS_APROVADOS = {
  SURGIMENTO_AGENDAMENTO: 'Surgimento de agendamento disponível (DISP-01)',
  RETOMADA_SERVICO: 'Retoma de serviço temporariamente suspenso',
  MUDANCA_REQUISITOS: 'Mudança nos requisitos ou documentos de atendimento'
};

export function inicializarAreaPaciente() {
  const aviso = obterAvisoArmazenamento();
  const avisoEl = document.getElementById('aviso-armazenamento');
  if (aviso && avisoEl) {
    avisoEl.hidden = false;
    avisoEl.textContent = aviso;
  }

  popularSeletorPersonas();
  popularSeletoresFormularios();
  configurarEventosAreaPaciente();
  renderizarTudoAreaPaciente();
}

function popularSeletorPersonas() {
  const estado = obterEstadoRepositorio();
  const select = document.getElementById('select-persona-ativa');
  if (!select) return;

  select.innerHTML = '';
  estado.personas.forEach((p) => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = `${p.nome} — Perfil: ${p.tipo} (${p.papel})`;
    if (p.id === estado.personaAtivaId) opt.selected = true;
    select.appendChild(opt);
  });
}

function popularSeletoresFormularios() {
  const unidades = listarUnidadesCompletas();
  const especialidades = listarEspecialidades();
  const bairros = listarBairrosDistintos();
  const opcoes = listarOpcoesFiltros();

  // Select de adicionar favorito rápido
  const selFavUnidade = document.getElementById('fav-select-unidade');
  if (selFavUnidade) {
    selFavUnidade.innerHTML = '<option value="">Selecione uma unidade fictícia...</option>';
    unidades.forEach((u) => {
      const opt = document.createElement('option');
      opt.value = u.id;
      opt.textContent = `${u.nome} (${u.bairro} — ${u.modalidades.join('/')})`;
      selFavUnidade.appendChild(opt);
    });
  }

  // Selects de Preferências (RF-022)
  const selPrefBairro = document.getElementById('pref-bairro-referencia');
  if (selPrefBairro) {
    selPrefBairro.innerHTML = '<option value="">Sem bairro de referência fixo</option>';
    bairros.forEach((b) => {
      const opt = document.createElement('option');
      opt.value = b;
      opt.textContent = b;
      selPrefBairro.appendChild(opt);
    });
  }

  const contPrefAcess = document.getElementById('pref-acessibilidade-opcoes');
  if (contPrefAcess) {
    contPrefAcess.innerHTML = '';
    opcoes.acessibilidades.forEach((acess, idx) => {
      const label = document.createElement('label');
      label.className = 'filter-check-label';
      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.name = 'pref-acess';
      chk.value = acess;
      chk.id = `pref-acess-${idx}`;
      const span = document.createElement('span');
      span.textContent = acess;
      label.appendChild(chk);
      label.appendChild(span);
      contPrefAcess.appendChild(label);
    });
  }

  // Selects de Alerta (RF-026)
  atualizarOpcoesAlvoAlerta();

  // Select de Simulação de Gatilho de Alerta (RF-027)
  const selSimServico = document.getElementById('sim-select-servico');
  if (selSimServico) {
    selSimServico.innerHTML = '';
    unidades.forEach((u) => {
      u.servicos.forEach((s) => {
        const opt = document.createElement('option');
        opt.value = `${u.id}|${s.id}`;
        opt.textContent = `[${u.id}] ${u.nome} — ${s.nome} (${s.modalidades.join('/')})`;
        selSimServico.appendChild(opt);
      });
    });
  }
}

function atualizarOpcoesAlvoAlerta() {
  const tipoAlvo = document.getElementById('alerta-tipo-alvo')?.value || 'SERVICO_UNIDADE';
  const grupoUnidade = document.getElementById('grupo-alerta-unidade');
  const grupoRegiao = document.getElementById('grupo-alerta-regiao');
  const selUnidadeServico = document.getElementById('alerta-unidade-servico');
  const selEspRegiao = document.getElementById('alerta-especialidade');
  const selBairroRegiao = document.getElementById('alerta-bairro');

  const unidades = listarUnidadesCompletas();
  const especialidades = listarEspecialidades();
  const bairros = listarBairrosDistintos();

  if (tipoAlvo === 'SERVICO_UNIDADE') {
    if (grupoUnidade) grupoUnidade.hidden = false;
    if (grupoRegiao) grupoRegiao.hidden = true;

    if (selUnidadeServico && selUnidadeServico.options.length === 0) {
      unidades.forEach((u) => {
        u.servicos.forEach((s) => {
          const opt = document.createElement('option');
          opt.value = `${u.id}:${s.id}`;
          opt.textContent = `${u.nome} (${u.bairro}) — ${s.nome}`;
          selUnidadeServico.appendChild(opt);
        });
      });
    }
  } else {
    if (grupoUnidade) grupoUnidade.hidden = true;
    if (grupoRegiao) grupoRegiao.hidden = false;

    if (selEspRegiao && selEspRegiao.options.length === 0) {
      especialidades.forEach((e) => {
        const opt = document.createElement('option');
        opt.value = e.id;
        opt.textContent = e.nome;
        selEspRegiao.appendChild(opt);
      });
    }
    if (selBairroRegiao && selBairroRegiao.options.length === 0) {
      const optTodos = document.createElement('option');
      optTodos.value = 'TODOS_BAIRROS';
      optTodos.textContent = 'Qualquer bairro de Belém';
      selBairroRegiao.appendChild(optTodos);
      bairros.forEach((b) => {
        const opt = document.createElement('option');
        opt.value = b;
        opt.textContent = `Bairro: ${b}`;
        selBairroRegiao.appendChild(opt);
      });
    }
  }
}

function configurarEventosAreaPaciente() {
  // 1. Troca de Persona Demonstrativa (RF-019 / Cap. 13.8)
  document.getElementById('select-persona-ativa')?.addEventListener('change', (e) => {
    const estado = obterEstadoRepositorio();
    estado.personaAtivaId = e.target.value;
    persistirEstadoRepositorio(estado);
    renderizarTudoAreaPaciente();
  });

  // 2. Adicionar Favorito (RF-020)
  document.getElementById('form-adicionar-favorito')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const sel = document.getElementById('fav-select-unidade');
    const unidadeId = sel?.value;
    if (!unidadeId) return;

    const estado = obterEstadoRepositorio();
    const jaExiste = estado.favoritos.some(
      (f) => f.unidadeId === unidadeId && f.personaId === estado.personaAtivaId
    );
    if (jaExiste) {
      exibirFeedbackPaciente('Esta unidade já está na sua lista de favoritos.', 'warning');
      return;
    }

    estado.favoritos.push({
      personaId: estado.personaAtivaId,
      unidadeId,
      criadoEm: new Date().toISOString()
    });
    persistirEstadoRepositorio(estado);
    sel.value = '';
    renderizarTudoAreaPaciente();
    exibirFeedbackPaciente('Unidade adicionada aos favoritos locais!', 'available');
  });

  // 3. Guardar Nova Pesquisa (RF-021)
  document.getElementById('form-salvar-pesquisa')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const nome = document.getElementById('pesq-nome')?.value.trim();
    const termo = document.getElementById('pesq-termo')?.value.trim() || '';
    const tipo = document.getElementById('pesq-modo')?.value || 'todos';
    const rede = document.getElementById('pesq-rede')?.value || 'TODAS';
    const ordenacao = document.getElementById('pesq-ordenacao')?.value || 'relevancia';

    if (!nome) {
      exibirFeedbackPaciente('Informe um nome identificador para guardar a pesquisa.', 'danger');
      return;
    }

    const estado = obterEstadoRepositorio();
    estado.pesquisasSalvas.push({
      id: `psq-${Date.now()}`,
      personaId: estado.personaAtivaId,
      nome,
      termo,
      tipo,
      filtros: { rede },
      ordenacao,
      criadoEm: new Date().toISOString()
    });
    persistirEstadoRepositorio(estado);
    e.target.reset();
    renderizarTudoAreaPaciente();
    exibirFeedbackPaciente('Pesquisa guardada localmente com sucesso!', 'available');
  });

  // 4. Guardar Preferências do Paciente (RF-022)
  document.getElementById('form-preferencias-paciente')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const redePreferida = document.getElementById('pref-rede')?.value || 'TODAS';
    const bairroReferencia = document.getElementById('pref-bairro-referencia')?.value || '';
    const acessibilidadeRequerida = Array.from(
      document.querySelectorAll('input[name="pref-acess"]:checked')
    ).map((el) => el.value);

    const estado = obterEstadoRepositorio();
    estado.preferenciasPaciente = {
      redePreferida,
      bairroReferencia,
      acessibilidadeRequerida
    };
    persistirEstadoRepositorio(estado);
    renderizarTudoAreaPaciente();
    exibirFeedbackPaciente('Preferências recorrentes guardadas no navegador.', 'available');
  });

  document.getElementById('btn-limpar-preferencias')?.addEventListener('click', () => {
    const estado = obterEstadoRepositorio();
    estado.preferenciasPaciente = {
      redePreferida: 'TODAS',
      bairroReferencia: '',
      acessibilidadeRequerida: []
    };
    persistirEstadoRepositorio(estado);
    renderizarTudoAreaPaciente();
    exibirFeedbackPaciente('Preferências recorrentes removidas.', 'info');
  });

  // 5. Tipo de Alvo de Alerta e Criação de Alerta (RF-023 / RF-026)
  document.getElementById('alerta-tipo-alvo')?.addEventListener('change', atualizarOpcoesAlvoAlerta);

  document.getElementById('form-criar-alerta')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const tipoAlvo = document.getElementById('alerta-tipo-alvo')?.value || 'SERVICO_UNIDADE';
    const modalidade = document.getElementById('alerta-modalidade')?.value || 'SUS';
    const gatilho = document.getElementById('alerta-gatilho')?.value || 'SURGIMENTO_AGENDAMENTO';
    const canal = document.getElementById('alerta-canal')?.value || 'ambos';
    const frequencia = document.getElementById('alerta-frequencia')?.value || 'imediata';

    let alvo = '';
    let descricaoAlvo = '';
    const unidades = listarUnidadesCompletas();
    const especialidades = listarEspecialidades();

    if (tipoAlvo === 'SERVICO_UNIDADE') {
      alvo = document.getElementById('alerta-unidade-servico')?.value || '';
      const [uId, sId] = alvo.split(':');
      const u = unidades.find((x) => x.id === uId);
      const s = u?.servicos.find((x) => x.id === sId);
      descricaoAlvo = u && s ? `${s.nome} em ${u.nome} (${u.bairro})` : alvo;
    } else {
      const espId = document.getElementById('alerta-especialidade')?.value || '';
      const bairro = document.getElementById('alerta-bairro')?.value || 'TODOS_BAIRROS';
      alvo = `${espId}@${bairro}`;
      const esp = especialidades.find((x) => x.id === espId);
      descricaoAlvo = `${esp ? esp.nome : espId} na região: ${bairro === 'TODOS_BAIRROS' ? 'Belém (Qualquer bairro)' : bairro}`;
    }

    const canais = canal === 'ambos' ? ['email', 'whatsapp'] : [canal];

    const estado = obterEstadoRepositorio();
    estado.alertas.push({
      id: `alt-${Date.now()}`,
      personaId: estado.personaAtivaId,
      tipoAlvo,
      alvo,
      descricaoAlvo,
      modalidade,
      gatilho,
      canais,
      frequencia,
      ativo: true,
      ultimoEvento: null,
      criadoEm: new Date().toISOString()
    });
    persistirEstadoRepositorio(estado);
    renderizarTudoAreaPaciente();
    exibirFeedbackPaciente(
      'Alerta demonstrativo registado localmente (nenhum envio externo de e-mail/WhatsApp será efetuado).',
      'available'
    );
  });

  // 6. Simulador de Eventos de Alerta com Antirrepetição (RF-027 / CA-701 a CA-704 / T-12 / T-13)
  document.getElementById('form-simular-evento-alerta')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const valorUnidadeServico = document.getElementById('sim-select-servico')?.value || '';
    const modalidadeEvento = document.getElementById('sim-select-modalidade')?.value || 'SUS';
    const gatilhoEvento = document.getElementById('sim-select-gatilho')?.value || 'SURGIMENTO_AGENDAMENTO';
    const versaoAlteracao = document.getElementById('sim-input-versao')?.value.trim() || 'v1';

    if (!valorUnidadeServico) return;
    const [unidadeId, servicoId] = valorUnidadeServico.split('|');

    dispararSimulacaoDeEventoLocal({
      unidadeId,
      servicoId,
      modalidadeEvento,
      gatilhoEvento,
      versaoAlteracao
    });
  });

  // 7. Perfil Demonstrativo e Fluxo Simulado de Palavra-passe (RF-024 / CA-604)
  document.getElementById('form-perfil-demo')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const novoNome = document.getElementById('perfil-nome-demo')?.value.trim();
    if (!novoNome) return;

    const estado = obterEstadoRepositorio();
    const persona = estado.personas.find((p) => p.id === estado.personaAtivaId);
    if (persona) {
      persona.nome = novoNome;
      persistirEstadoRepositorio(estado);
      popularSeletorPersonas();
      renderizarTudoAreaPaciente();
      exibirFeedbackPaciente('Dados demonstrativos do perfil atualizados localmente.', 'available');
    }
  });

  document.getElementById('btn-simular-troca-senha')?.addEventListener('click', () => {
    exibirFeedbackPaciente(
      'Fluxo meramente ilustrativo (RF-024): este protótipo não recolhe, não valida nem armazena palavras-passe reais.',
      'info'
    );
  });

  // 8. Controlos de Privacidade e Limpeza de Dados Locais (RF-025 / CA-603)
  document.getElementById('btn-priv-limpar-favoritos')?.addEventListener('click', () => {
    if (!confirm('Eliminar todos os favoritos locais desta conta demonstrativa?')) return;
    const estado = obterEstadoRepositorio();
    estado.favoritos = [];
    persistirEstadoRepositorio(estado);
    renderizarTudoAreaPaciente();
    exibirFeedbackPaciente('Favoritos locais eliminados.', 'info');
  });

  document.getElementById('btn-priv-limpar-pesquisas')?.addEventListener('click', () => {
    if (!confirm('Eliminar todas as pesquisas guardadas localmente?')) return;
    const estado = obterEstadoRepositorio();
    estado.pesquisasSalvas = [];
    persistirEstadoRepositorio(estado);
    renderizarTudoAreaPaciente();
    exibirFeedbackPaciente('Pesquisas guardadas eliminadas.', 'info');
  });

  document.getElementById('btn-priv-desativar-alertas')?.addEventListener('click', () => {
    const estado = obterEstadoRepositorio();
    (estado.alertas || []).forEach((a) => {
      a.ativo = false;
    });
    persistirEstadoRepositorio(estado);
    renderizarTudoAreaPaciente();
    exibirFeedbackPaciente('Todas as notificações/alertas locais foram desativados.', 'warning');
  });

  document.getElementById('btn-priv-limpar-alertas')?.addEventListener('click', () => {
    if (!confirm('Eliminar todos os alertas e eventos demonstrativos locais?')) return;
    const estado = obterEstadoRepositorio();
    estado.alertas = [];
    estado.eventosAlertaDemo = [];
    persistirEstadoRepositorio(estado);
    renderizarTudoAreaPaciente();
    exibirFeedbackPaciente('Alertas e histórico de eventos locais eliminados.', 'info');
  });

  document.getElementById('btn-priv-excluir-conta-demo')?.addEventListener('click', () => {
    const confirmar = confirm(
      '[Fluxo Demonstrativo de Exclusão de Conta — RF-025]\n\nApenas os dados locais guardados neste navegador (favoritos, pesquisas guardadas, preferências e alertas) serão apagados. Nenhum pedido externo é enviado.\n\nDeseja prosseguir?'
    );
    if (!confirmar) return;

    const estado = obterEstadoRepositorio();
    estado.favoritos = [];
    estado.pesquisasSalvas = [];
    estado.alertas = [];
    estado.eventosAlertaDemo = [];
    estado.preferenciasPaciente = {
      redePreferida: 'TODAS',
      bairroReferencia: '',
      acessibilidadeRequerida: []
    };
    persistirEstadoRepositorio(estado);
    renderizarTudoAreaPaciente();
    exibirFeedbackPaciente(
      'Todos os dados pessoais demonstrativos (favoritos, pesquisas, alertas e preferências) foram removidos do navegador.',
      'available'
    );
  });
}

/**
 * Motor de avaliação de alertas locais com deduplicação e validação estrita de modalidade (Cap. 7.7 / 7.8 / CA-701 a CA-704)
 */
export function dispararSimulacaoDeEventoLocal({
  unidadeId,
  servicoId,
  modalidadeEvento,
  gatilhoEvento,
  versaoAlteracao
}) {
  const estado = obterEstadoRepositorio();
  const unidades = listarUnidadesCompletas();
  const unidade = unidades.find((u) => u.id === unidadeId);
  const servico = unidade?.servicos.find((s) => s.id === servicoId);

  if (!unidade || !servico) return;

  if (!Array.isArray(estado.eventosAlertaDemo)) {
    estado.eventosAlertaDemo = [];
  }

  let gerados = 0;
  let ignoradosDuplicados = 0;
  let ignoradosModalidade = 0;

  (estado.alertas || []).forEach((alerta) => {
    if (!alerta.ativo) return;

    // Verifica se o alvo do alerta corresponde à unidade/serviço ou especialidade/região
    let correspondeAlvo = false;
    if (alerta.tipoAlvo === 'SERVICO_UNIDADE') {
      correspondeAlvo = alerta.alvo === `${unidade.id}:${servico.id}`;
    } else if (alerta.tipoAlvo === 'ESPECIALIDADE_REGIAO') {
      const [espId, bairroAlvo] = (alerta.alvo || '').split('@');
      const bateEsp = servico.especialidadeId === espId;
      const bateBairro = bairroAlvo === 'TODOS_BAIRROS' || bairroAlvo === unidade.bairro;
      correspondeAlvo = bateEsp && bateBairro;
    } else if (alerta.tipoAlvo === 'UNIDADE') {
      // Compatibilidade com alertas criados na página de detalhes (Etapa 4)
      correspondeAlvo = alerta.alvo === unidade.id;
    }

    if (!correspondeAlvo) return;

    // Verifica gatilho (se o alerta especificou gatilho diferente de TODOS)
    if (alerta.gatilho && alerta.gatilho !== 'TODOS' && alerta.gatilho !== gatilhoEvento) {
      return;
    }

    // CA-704: Modalidade divergente NÃO aciona alerta
    if (alerta.modalidade && alerta.modalidade !== modalidadeEvento) {
      ignoradosModalidade++;
      return;
    }

    // Cap. 7.8 e CA-702: Chave de deduplicação (alerta + serviço + modalidade + versão da alteração)
    const chaveDeduplicacao = `${alerta.id}|${servico.id}|${modalidadeEvento}|${gatilhoEvento}|${versaoAlteracao}`;
    const jaExiste = estado.eventosAlertaDemo.some((ev) => ev.chaveDeduplicacao === chaveDeduplicacao);

    if (jaExiste) {
      ignoradosDuplicados++;
      return;
    }

    const novoEvento = {
      id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      alertaId: alerta.id,
      chaveDeduplicacao,
      unidadeNome: unidade.nome,
      bairro: unidade.bairro,
      servicoNome: servico.nome,
      modalidade: modalidadeEvento,
      gatilho: GATILHOS_APROVADOS[gatilhoEvento] || gatilhoEvento,
      canaisPlanejados: (alerta.canais || ['email']).join(' + '),
      frequencia: alerta.frequencia || 'imediata',
      versaoAlteracao,
      instante: new Date().toISOString()
    };

    estado.eventosAlertaDemo.unshift(novoEvento);
    alerta.ultimoEvento = novoEvento.instante;
    gerados++;
  });

  persistirEstadoRepositorio(estado);
  renderizarTudoAreaPaciente();

  if (gerados > 0) {
    exibirFeedbackPaciente(
      `Simulação concluída: ${gerados} aviso(s) demonstrativo(s) gerado(s) localmente (sem envio real — CA-701 / CA-703).`,
      'available'
    );
  } else if (ignoradosDuplicados > 0) {
    exibirFeedbackPaciente(
      `Evento repetido bloqueado pela regra de antirrepetição (Chave: alerta + serviço + modalidade + versão "${versaoAlteracao}" — CA-702 / T-13).`,
      'warning'
    );
  } else if (ignoradosModalidade > 0) {
    exibirFeedbackPaciente(
      `Nenhum alerta acionado: existe alerta para este serviço, mas numa modalidade diferente de "${modalidadeEvento}" (CA-704).`,
      'info'
    );
  } else {
    exibirFeedbackPaciente(
      'Nenhum alerta ativo corresponde a este serviço, gatilho e modalidade. Crie um alerta compatível acima para testar.',
      'neutral'
    );
  }
}

function exibirFeedbackPaciente(mensagem, classe = 'info') {
  const box = document.getElementById('feedback-area-paciente');
  if (!box) return;
  box.hidden = false;
  box.className = `status-pill status-pill--${classe}`;
  box.style.display = 'block';
  box.style.padding = 'var(--space-3)';
  box.style.marginBottom = 'var(--space-4)';
  box.textContent = mensagem;
}

function renderizarTudoAreaPaciente() {
  const estado = obterEstadoRepositorio();
  const unidades = listarUnidadesCompletas();
  const personaAtiva = estado.personas.find((p) => p.id === estado.personaAtivaId) || estado.personas[0];

  // Atualiza cabeçalho de persona e bloqueio institucional (CA-604)
  const badgePersona = document.getElementById('resumo-persona-ativa');
  if (badgePersona) {
    badgePersona.textContent = `Sessão Simulada: ${personaAtiva.nome} • Papel: ${personaAtiva.papel.toUpperCase()}`;
  }

  const inputNomePerfil = document.getElementById('perfil-nome-demo');
  if (inputNomePerfil) inputNomePerfil.value = personaAtiva.nome;

  // Dashboard Contadores (Cap. 6.2)
  const meusFavoritos = (estado.favoritos || []).filter((f) => f.personaId === estado.personaAtivaId);
  const minhasPesquisas = (estado.pesquisasSalvas || []).filter((p) => p.personaId === estado.personaAtivaId);
  const meusAlertas = (estado.alertas || []).filter((a) => a.personaId === estado.personaAtivaId);
  const alertasAtivos = meusAlertas.filter((a) => a.ativo).length;

  setTexto('dash-count-favoritos', String(meusFavoritos.length));
  setTexto('dash-count-pesquisas', String(minhasPesquisas.length));
  setTexto('dash-count-alertas', `${alertasAtivos} ativo(s) / ${meusAlertas.length}`);
  setTexto('dash-count-eventos', String((estado.eventosAlertaDemo || []).length));

  renderizarListaFavoritos(meusFavoritos, unidades);
  renderizarListaPesquisasSalvas(minhasPesquisas);
  renderizarFormularioPreferencias(estado.preferenciasPaciente);
  renderizarListaAlertas(meusAlertas);
  renderizarListaEventosSimulados(estado.eventosAlertaDemo || []);
}

function setTexto(id, texto) {
  const el = document.getElementById(id);
  if (el) el.textContent = texto;
}

function renderizarListaFavoritos(favoritos, unidades) {
  const container = document.getElementById('lista-favoritos-paciente');
  if (!container) return;
  container.innerHTML = '';

  if (favoritos.length === 0) {
    container.innerHTML = '<p class="form-hint">Nenhuma unidade fictícia favoritada ainda. Adicione acima ou clique em "Favoritar" na página de detalhes.</p>';
    return;
  }

  favoritos.forEach((fav) => {
    const u = unidades.find((item) => item.id === fav.unidadeId);
    if (!u) return;

    const item = document.createElement('div');
    item.className = 'service-list__item';
    item.style.display = 'flex';
    item.style.flexWrap = 'wrap';
    item.style.justifyContent = 'space-between';
    item.style.alignItems = 'center';
    item.style.gap = 'var(--space-2)';

    const info = document.createElement('div');
    const strong = document.createElement('strong');
    strong.textContent = `${u.nome} (${u.tipo}) `;
    const span = document.createElement('span');
    span.className = 'form-hint';
    span.textContent = `• Bairro: ${u.bairro} • Modalidades: ${u.modalidades.join(', ')}`;
    info.appendChild(strong);
    info.appendChild(span);

    const acoes = document.createElement('div');
    acoes.style.display = 'flex';
    acoes.style.gap = 'var(--space-2)';

    const link = document.createElement('a');
    link.href = `unidade.html?id=${encodeURIComponent(u.id)}`;
    link.className = 'btn-a11y';
    link.textContent = 'Abrir detalhes';

    const btnRem = document.createElement('button');
    btnRem.type = 'button';
    btnRem.className = 'btn-a11y';
    btnRem.textContent = '✕ Remover';
    btnRem.addEventListener('click', () => {
      const estado = obterEstadoRepositorio();
      estado.favoritos = estado.favoritos.filter(
        (f) => !(f.unidadeId === u.id && f.personaId === estado.personaAtivaId)
      );
      persistirEstadoRepositorio(estado);
      renderizarTudoAreaPaciente();
    });

    acoes.appendChild(link);
    acoes.appendChild(btnRem);
    item.appendChild(info);
    item.appendChild(acoes);
    container.appendChild(item);
  });
}

function renderizarListaPesquisasSalvas(pesquisas) {
  const container = document.getElementById('lista-pesquisas-salvas');
  if (!container) return;
  container.innerHTML = '';

  if (pesquisas.length === 0) {
    container.innerHTML = '<p class="form-hint">Nenhuma pesquisa guardada. Utilize o formulário acima para guardar combinações de busca frequentes.</p>';
    return;
  }

  pesquisas.forEach((psq) => {
    const item = document.createElement('div');
    item.className = 'service-list__item';
    item.style.display = 'flex';
    item.style.flexWrap = 'wrap';
    item.style.justifyContent = 'space-between';
    item.style.alignItems = 'center';
    item.style.gap = 'var(--space-2)';

    const info = document.createElement('div');
    const strong = document.createElement('strong');
    strong.textContent = `${psq.nome} `;
    const span = document.createElement('span');
    span.className = 'form-hint';
    const redeTxt = psq.filtros?.rede || 'TODAS';
    span.textContent = `• Termo: "${psq.termo || 'Qualquer'}" (Modo: ${psq.tipo}) • Rede: ${redeTxt} • Ordem: ${psq.ordenacao}`;
    info.appendChild(strong);
    info.appendChild(span);

    const acoes = document.createElement('div');
    acoes.style.display = 'flex';
    acoes.style.gap = 'var(--space-2)';

    const params = new URLSearchParams();
    if (psq.termo) params.set('q', psq.termo);
    if (psq.tipo && psq.tipo !== 'todos') params.set('modo', psq.tipo);
    if (psq.filtros?.rede && psq.filtros.rede !== 'TODAS') params.set('redes', psq.filtros.rede);
    if (psq.ordenacao && psq.ordenacao !== 'relevancia') params.set('ord', psq.ordenacao);

    const linkExec = document.createElement('a');
    linkExec.href = `busca.html?${params.toString()}`;
    linkExec.className = 'btn-a11y';
    linkExec.textContent = '▶ Reexecutar pesquisa';

    const btnDel = document.createElement('button');
    btnDel.type = 'button';
    btnDel.className = 'btn-a11y';
    btnDel.textContent = '✕ Excluir';
    btnDel.addEventListener('click', () => {
      const estado = obterEstadoRepositorio();
      estado.pesquisasSalvas = estado.pesquisasSalvas.filter((p) => p.id !== psq.id);
      persistirEstadoRepositorio(estado);
      renderizarTudoAreaPaciente();
    });

    acoes.appendChild(linkExec);
    acoes.appendChild(btnDel);
    item.appendChild(info);
    item.appendChild(acoes);
    container.appendChild(item);
  });
}

function renderizarFormularioPreferencias(prefs = {}) {
  const selRede = document.getElementById('pref-rede');
  const selBairro = document.getElementById('pref-bairro-referencia');
  if (selRede) selRede.value = prefs.redePreferida || 'TODAS';
  if (selBairro) selBairro.value = prefs.bairroReferencia || '';

  const acessAtivas = prefs.acessibilidadeRequerida || [];
  document.querySelectorAll('input[name="pref-acess"]').forEach((chk) => {
    chk.checked = acessAtivas.includes(chk.value);
  });

  const btnAplicarBusca = document.getElementById('btn-aplicar-preferencias-busca');
  if (btnAplicarBusca) {
    const params = new URLSearchParams();
    if (prefs.redePreferida && prefs.redePreferida !== 'TODAS') params.set('redes', prefs.redePreferida);
    if (prefs.bairroReferencia) params.set('bairros', prefs.bairroReferencia);
    if (acessAtivas.length > 0) params.set('acess', acessAtivas.join(','));
    btnAplicarBusca.href = `busca.html?${params.toString()}`;
  }
}

function renderizarListaAlertas(alertas) {
  const container = document.getElementById('lista-alertas-paciente');
  if (!container) return;
  container.innerHTML = '';

  if (alertas.length === 0) {
    container.innerHTML = '<p class="form-hint">Nenhum alerta demonstrativo configurado.</p>';
    return;
  }

  alertas.forEach((alerta) => {
    const item = document.createElement('div');
    item.className = 'service-list__item';
    item.style.display = 'flex';
    item.style.flexWrap = 'wrap';
    item.style.justifyContent = 'space-between';
    item.style.alignItems = 'center';
    item.style.gap = 'var(--space-2)';

    const info = document.createElement('div');
    const pillStatus = document.createElement('span');
    pillStatus.className = `status-pill status-pill--${alerta.ativo ? 'available' : 'neutral'}`;
    pillStatus.textContent = alerta.ativo ? '● Ativo' : '○ Desativado';
    pillStatus.style.marginRight = 'var(--space-2)';

    const strong = document.createElement('strong');
    strong.textContent = alerta.descricaoAlvo || `Alvo: ${alerta.alvo}`;

    const meta = document.createElement('div');
    meta.className = 'form-hint';
    const nomeGatilho = GATILHOS_APROVADOS[alerta.gatilho] || 'Qualquer gatilho aprovado';
    meta.textContent = `Modalidade: ${alerta.modalidade} • Gatilho: ${nomeGatilho} • Canais planeados (simulados): ${(alerta.canais || []).join(' + ')} • Frequência: ${alerta.frequencia}`;

    info.appendChild(pillStatus);
    info.appendChild(strong);
    info.appendChild(meta);

    const acoes = document.createElement('div');
    acoes.style.display = 'flex';
    acoes.style.gap = 'var(--space-2)';

    const btnToggle = document.createElement('button');
    btnToggle.type = 'button';
    btnToggle.className = 'btn-a11y';
    btnToggle.textContent = alerta.ativo ? 'Desativar' : 'Ativar';
    btnToggle.addEventListener('click', () => {
      const estado = obterEstadoRepositorio();
      const alvoObj = estado.alertas.find((a) => a.id === alerta.id);
      if (alvoObj) {
        alvoObj.ativo = !alvoObj.ativo;
        persistirEstadoRepositorio(estado);
        renderizarTudoAreaPaciente();
      }
    });

    const btnExcluir = document.createElement('button');
    btnExcluir.type = 'button';
    btnExcluir.className = 'btn-a11y';
    btnExcluir.textContent = '✕ Excluir';
    btnExcluir.addEventListener('click', () => {
      const estado = obterEstadoRepositorio();
      estado.alertas = estado.alertas.filter((a) => a.id !== alerta.id);
      persistirEstadoRepositorio(estado);
      renderizarTudoAreaPaciente();
    });

    acoes.appendChild(btnToggle);
    acoes.appendChild(btnExcluir);
    item.appendChild(info);
    item.appendChild(acoes);
    container.appendChild(item);
  });
}

function renderizarListaEventosSimulados(eventos) {
  const container = document.getElementById('lista-eventos-alerta-demo');
  if (!container) return;
  container.innerHTML = '';

  if (eventos.length === 0) {
    container.innerHTML = '<p class="form-hint">Nenhum evento elegível disparado ainda. Crie um alerta acima e utilize o simulador ao lado para testar o acionamento e a regra de antirrepetição (RF-027).</p>';
    return;
  }

  eventos.forEach((ev) => {
    const div = document.createElement('div');
    div.className = 'service-list__item';
    const dataFmt = new Date(ev.instante).toLocaleString('pt-BR');
    div.innerHTML = `
      <div style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:var(--space-2);">
        <strong>🔔 [AVISO DEMONSTRATIVO LOCAL] ${ev.servicoNome} — ${ev.unidadeNome} (${ev.bairro})</strong>
        <span class="demo-badge">NÃO ENVIADO EXTERNAMENTE</span>
      </div>
      <p class="form-hint" style="margin:4px 0 0;">
        Modalidade: <strong>${ev.modalidade}</strong> • Gatilho: ${ev.gatilho} • Canal preferido: ${ev.canaisPlanejados} (${ev.frequencia}) • Versão: ${ev.versaoAlteracao} • Gerado em: ${dataFmt}
      </p>
    `;
    container.appendChild(div);
  });
}