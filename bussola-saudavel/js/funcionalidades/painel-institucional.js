// js/funcionalidades/painel-institucional.js
import {
  obterEstadoRepositorio,
  persistirEstadoRepositorio,
  listarUnidadesCompletas,
  listarEspecialidades,
  obterAvisoArmazenamento
} from '../repositorios/repositorio-local.js';
import { ESTADOS_DISPONIBILIDADE } from '../dados/demonstracao.js';
import { dispararSimulacaoDeEventoLocal } from './area-paciente.js';

let unidadeSelecionadaId = 'U01';

export function inicializarPainelInstitucional() {
  const aviso = obterAvisoArmazenamento();
  const avisoEl = document.getElementById('aviso-armazenamento');
  if (aviso && avisoEl) {
    avisoEl.hidden = false;
    avisoEl.textContent = aviso;
  }

  garantirPersonaInstitucionalInicial();
  popularSeletoresTopoInstitucional();
  configurarEventosPainelInstitucional();
  renderizarPainelInstitucionalCompleto();
}

function garantirPersonaInstitucionalInicial() {
  const estado = obterEstadoRepositorio();
  const personaAtual = estado.personas.find((p) => p.id === estado.personaAtivaId);
  if (!personaAtual || personaAtual.tipo !== 'INSTITUICAO') {
    const primeiraInst = estado.personas.find((p) => p.tipo === 'INSTITUICAO');
    if (primeiraInst) {
      estado.personaAtivaId = primeiraInst.id;
      unidadeSelecionadaId = primeiraInst.unidadesVinculadas[0] || 'U01';
      persistirEstadoRepositorio(estado);
    }
  } else {
    unidadeSelecionadaId = personaAtual.unidadesVinculadas[0] || 'U01';
  }
}

function obterPersonaAtiva() {
  const estado = obterEstadoRepositorio();
  return estado.personas.find((p) => p.id === estado.personaAtivaId) || estado.personas[0];
}

function verificarVinculoUnidade(unidadeId) {
  const persona = obterPersonaAtiva();
  if (persona.papel === 'admin_geral') return true;
  return Array.isArray(persona.unidadesVinculadas) && persona.unidadesVinculadas.includes(unidadeId);
}

function popularSeletoresTopoInstitucional() {
  const estado = obterEstadoRepositorio();
  const selectPersona = document.getElementById('inst-select-persona');
  const selectUnidade = document.getElementById('inst-select-unidade');
  const personaAtiva = obterPersonaAtiva();

  if (selectPersona) {
    selectPersona.innerHTML = '';
    estado.personas.forEach((p) => {
      const opt = document.createElement('option');
      opt.value = p.id;
      const vinculos = p.unidadesVinculadas?.length ? ` [Vínculos: ${p.unidadesVinculadas.join(', ')}]` : ' [Sem vínculo institucional]';
      opt.textContent = `${p.nome} (${p.tipo})${vinculos}`;
      if (p.id === personaAtiva.id) opt.selected = true;
      selectPersona.appendChild(opt);
    });
  }

  if (selectUnidade) {
    selectUnidade.innerHTML = '';
    estado.unidades.forEach((u) => {
      const vinculada = Array.isArray(personaAtiva.unidadesVinculadas) && personaAtiva.unidadesVinculadas.includes(u.id);
      const opt = document.createElement('option');
      opt.value = u.id;
      opt.textContent = `${vinculada ? '✔ [VINCULADA]' : '🔒 [NÃO VINCULADA — Teste T-15]'} ${u.id} — ${u.nome} (${u.bairro})`;
      if (u.id === unidadeSelecionadaId) opt.selected = true;
      selectUnidade.appendChild(opt);
    });
  }

  // Popular especialidades no formulário de novo serviço
  const selEsp = document.getElementById('form-srv-especialidade');
  if (selEsp && selEsp.options.length === 0) {
    listarEspecialidades().forEach((esp) => {
      const opt = document.createElement('option');
      opt.value = esp.id;
      opt.textContent = esp.nome;
      selEsp.appendChild(opt);
    });
  }

  // Popular estados de disponibilidade no formulário de atualização (DISP-01 a DISP-07)
  const selEstadoDisp = document.getElementById('form-disp-estado');
  if (selEstadoDisp && selEstadoDisp.options.length === 0) {
    Object.values(ESTADOS_DISPONIBILIDADE).forEach((st) => {
      const opt = document.createElement('option');
      opt.value = st.codigo;
      opt.textContent = `${st.codigo} — ${st.icone} ${st.rotulo}`;
      selEstadoDisp.appendChild(opt);
    });
  }
}

function configurarEventosPainelInstitucional() {
  // Alternar persona demonstrativa
  document.getElementById('inst-select-persona')?.addEventListener('change', (e) => {
    const estado = obterEstadoRepositorio();
    estado.personaAtivaId = e.target.value;
    const novaPersona = estado.personas.find((p) => p.id === estado.personaAtivaId);
    if (novaPersona?.unidadesVinculadas?.length) {
      unidadeSelecionadaId = novaPersona.unidadesVinculadas[0];
    }
    persistirEstadoRepositorio(estado);
    popularSeletoresTopoInstitucional();
    renderizarPainelInstitucionalCompleto();
  });

  // Alternar unidade inspecionada (Vinculada ou Não Vinculada para T-15)
  document.getElementById('inst-select-unidade')?.addEventListener('change', (e) => {
    unidadeSelecionadaId = e.target.value;
    renderizarPainelInstitucionalCompleto();
  });

  // Prévia em tempo real dos dados gerais (RF-029)
  const camposPrevia = ['edit-unidade-horario', 'edit-unidade-contato', 'edit-unidade-agendamento', 'edit-unidade-endereco'];
  camposPrevia.forEach((id) => {
    document.getElementById(id)?.addEventListener('input', atualizarPreviaDadosGerais);
  });

  // 1. Salvar Edição de Dados Gerais da Unidade (RF-029 / RF-030)
  document.getElementById('form-editar-unidade')?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!validarPermissaoDemonstrativa()) return;

    const estado = obterEstadoRepositorio();
    const u = estado.unidades.find((item) => item.id === unidadeSelecionadaId);
    if (!u) return;

    const novoHorario = sanitizarTexto(document.getElementById('edit-unidade-horario')?.value);
    const novoContato = sanitizarTexto(document.getElementById('edit-unidade-contato')?.value);
    const novoAgendamento = sanitizarTexto(document.getElementById('edit-unidade-agendamento')?.value);
    const novoEndereco = sanitizarTexto(document.getElementById('edit-unidade-endereco')?.value);
    const novaAcessibilidade = sanitizarTexto(document.getElementById('edit-unidade-acessibilidade')?.value)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (!novoHorario || !novoEndereco) {
      exibirFeedbackInstitucional('Preencha os campos obrigatórios (Horário geral e Endereço demonstrativo).', 'danger');
      return;
    }

    if (u.horarioGeral !== novoHorario) {
      registrarAuditoriaLocal(estado, 'Unidade', u.id, 'horarioGeral', u.horarioGeral, novoHorario);
      u.horarioGeral = novoHorario;
    }
    if (u.contatoDemonstrativo !== novoContato) {
      registrarAuditoriaLocal(estado, 'Unidade', u.id, 'contatoDemonstrativo', u.contatoDemonstrativo, novoContato);
      u.contatoDemonstrativo = novoContato || 'Não informado';
    }
    if (u.canalAgendamentoDemo !== novoAgendamento) {
      registrarAuditoriaLocal(estado, 'Unidade', u.id, 'canalAgendamentoDemo', u.canalAgendamentoDemo, novoAgendamento);
      u.canalAgendamentoDemo = novoAgendamento || 'Não informado';
    }
    if (u.enderecoDemonstrativo !== novoEndereco) {
      registrarAuditoriaLocal(estado, 'Unidade', u.id, 'enderecoDemonstrativo', u.enderecoDemonstrativo, novoEndereco);
      u.enderecoDemonstrativo = novoEndereco;
    }

    const acessAntiga = (u.acessibilidade || []).join(', ');
    const acessNova = novaAcessibilidade.join(', ');
    if (acessAntiga !== acessNova) {
      registrarAuditoriaLocal(estado, 'Unidade', u.id, 'acessibilidade', acessAntiga, acessNova);
      u.acessibilidade = novaAcessibilidade;
    }

    // CA-803: Edição institucional define confiabilidade como FORNECIDO_INSTITUICAO, nunca VERIFICADO diretamente
    u.ultimaAtualizacao = new Date().toISOString();
    if (u.confiabilidadeUnidade === 'DESATUALIZADO' || u.confiabilidadeUnidade === 'NAO_CONFIRMADO') {
      registrarAuditoriaLocal(estado, 'Unidade', u.id, 'confiabilidadeUnidade', u.confiabilidadeUnidade, 'FORNECIDO_INSTITUICAO');
      u.confiabilidadeUnidade = 'FORNECIDO_INSTITUICAO';
    }

    persistirEstadoRepositorio(estado);
    renderizarPainelInstitucionalCompleto();
    exibirFeedbackInstitucional('Dados institucionais atualizados e refletidos na busca e nos detalhes (CA-801 / CA-802).', 'available');
  });

  // 2. Atualizar Disponibilidade por Serviço e Modalidade (RF-029 / CA-801 / T-14)
  document.getElementById('form-atualizar-disponibilidade')?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!validarPermissaoDemonstrativa()) return;

    const servicoId = document.getElementById('form-disp-servico')?.value;
    const modalidade = document.getElementById('form-disp-modalidade')?.value;
    const novoEstado = document.getElementById('form-disp-estado')?.value;
    const fonteDecl = sanitizarTexto(document.getElementById('form-disp-fonte')?.value) || 'Painel Institucional (Demo)';

    if (!servicoId || !modalidade || !novoEstado) return;

    const estado = obterEstadoRepositorio();
    const agora = new Date();
    const amanha = new Date(agora.getTime() + 24 * 60 * 60 * 1000); // Revisão diária de disponibilidade (Cap. 8.11)

    let disp = estado.disponibilidades.find(
      (d) => d.servicoId === servicoId && d.modalidade === modalidade
    );

    const estadoAnterior = disp ? disp.estado : 'INEXISTENTE';

    if (disp) {
      registrarAuditoriaLocal(
        estado,
        'Disponibilidade',
        unidadeSelecionadaId,
        `Disponibilidade (${servicoId} - ${modalidade})`,
        disp.estado,
        novoEstado
      );
      disp.estado = novoEstado;
      disp.informadoEm = agora.toISOString();
      disp.revisarAte = amanha.toISOString();
      disp.fonte = fonteDecl;
      // CA-803: Instituição nunca atribui VERIFICADO por conta própria
      disp.confiabilidade = 'FORNECIDO_INSTITUICAO';
    } else {
      disp = {
        id: `D-${Date.now()}`,
        servicoId,
        modalidade,
        estado: novoEstado,
        informadoEm: agora.toISOString(),
        revisarAte: amanha.toISOString(),
        fonte: fonteDecl,
        confiabilidade: 'FORNECIDO_INSTITUICAO'
      };
      estado.disponibilidades.push(disp);
      registrarAuditoriaLocal(
        estado,
        'Disponibilidade',
        unidadeSelecionadaId,
        `Nova Disponibilidade (${servicoId} - ${modalidade})`,
        'N/A',
        novoEstado
      );
    }

    const unidadeObj = estado.unidades.find((u) => u.id === unidadeSelecionadaId);
    if (unidadeObj) unidadeObj.ultimaAtualizacao = agora.toISOString();

    persistirEstadoRepositorio(estado);

    // Integração com Sistema de Alertas (RF-027 / T-12): verifica se a mudança aciona algum dos 3 gatilhos aprovados
    let gatilhoAcionado = null;
    if (estadoAnterior === 'DISP-04' && (novoEstado === 'DISP-01' || novoEstado === 'DISP-02')) {
      gatilhoAcionado = 'RETOMADA_SERVICO';
    } else if (novoEstado === 'DISP-01' && estadoAnterior !== 'DISP-01') {
      gatilhoAcionado = 'SURGIMENTO_AGENDAMENTO';
    }

    if (gatilhoAcionado) {
      dispararSimulacaoDeEventoLocal({
        unidadeId: unidadeSelecionadaId,
        servicoId,
        modalidadeEvento: modalidade,
        gatilhoEvento: gatilhoAcionado,
        versaoAlteracao: `inst-${agora.toISOString().slice(0, 16)}`
      });
    }

    renderizarPainelInstitucionalCompleto();
    exibirFeedbackInstitucional(
      `Disponibilidade do serviço [${servicoId}] na modalidade ${modalidade} atualizada para ${novoEstado}.`,
      'available'
    );
  });

  // 3. Cadastrar ou Editar Serviço e Requisitos da Unidade (RF-029)
  document.getElementById('form-salvar-servico')?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!validarPermissaoDemonstrativa()) return;

    const servicoExistenteId = document.getElementById('form-srv-id-edicao')?.value || '';
    const especialidadeId = document.getElementById('form-srv-especialidade')?.value;
    const nome = sanitizarTexto(document.getElementById('form-srv-nome')?.value);
    const horarios = sanitizarTexto(document.getElementById('form-srv-horarios')?.value);
    const requisitos = sanitizarTexto(document.getElementById('form-srv-requisitos')?.value);
    const modalidades = Array.from(document.querySelectorAll('input[name="srv-mod"]:checked')).map((el) => el.value);

    if (!nome || !horarios || !requisitos || modalidades.length === 0) {
      exibirFeedbackInstitucional('Preencha nome, horários, requisitos e selecione pelo menos uma modalidade.', 'danger');
      return;
    }

    const estado = obterEstadoRepositorio();

    if (servicoExistenteId) {
      const srv = estado.servicos.find((s) => s.id === servicoExistenteId && s.unidadeId === unidadeSelecionadaId);
      if (srv) {
        const mudouRequisitos = srv.requisitos !== requisitos;
        registrarAuditoriaLocal(
          estado,
          'Servico',
          unidadeSelecionadaId,
          `Serviço ${srv.id} (${srv.nome})`,
          `Req: ${srv.requisitos} | Hor: ${srv.horarios}`,
          `Req: ${requisitos} | Hor: ${horarios}`
        );
        srv.especialidadeId = especialidadeId;
        srv.nome = nome;
        srv.horarios = horarios;
        srv.requisitos = requisitos;
        srv.modalidades = modalidades;

        persistirEstadoRepositorio(estado);

        // Se mudou requisitos, aciona gatilho aprovado 3 (MUDANCA_REQUISITOS — Cap. 7.4)
        if (mudouRequisitos) {
          modalidades.forEach((mod) => {
            dispararSimulacaoDeEventoLocal({
              unidadeId: unidadeSelecionadaId,
              servicoId: srv.id,
              modalidadeEvento: mod,
              gatilhoEvento: 'MUDANCA_REQUISITOS',
              versaoAlteracao: `req-${new Date().toISOString().slice(0, 16)}`
            });
          });
        }
      }
      document.getElementById('form-srv-id-edicao').value = '';
    } else {
      const novoId = `S-${Date.now().toString().slice(-4)}`;
      estado.servicos.push({
        id: novoId,
        unidadeId: unidadeSelecionadaId,
        especialidadeId,
        nome,
        modalidades,
        requisitos,
        horarios,
        ativo: true
      });

      const agora = new Date().toISOString();
      modalidades.forEach((mod) => {
        estado.disponibilidades.push({
          id: `D-${Date.now()}-${mod}`,
          servicoId: novoId,
          modalidade: mod,
          estado: 'DISP-01',
          informadoEm: agora,
          revisarAte: new Date(Date.now() + 86400000).toISOString(),
          fonte: 'Cadastro Institucional (Demo)',
          confiabilidade: 'FORNECIDO_INSTITUICAO'
        });
      });

      registrarAuditoriaLocal(estado, 'Servico', unidadeSelecionadaId, 'Novo Serviço Cadastrado', 'Inexistente', `${nome} (${modalidades.join('/')})`);
      persistirEstadoRepositorio(estado);
    }

    e.target.reset();
    renderizarPainelInstitucionalCompleto();
    exibirFeedbackInstitucional('Serviço e requisitos gravados com sucesso e propagados para o catálogo local!', 'available');
  });

  // 4. Solicitar Verificação Independente (RF-031 / CA-803 / T-17)
  document.getElementById('form-solicitar-verificacao')?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!validarPermissaoDemonstrativa()) return;

    const justificativa = sanitizarTexto(document.getElementById('verif-justificativa')?.value);
    const docMetadado = sanitizarTexto(document.getElementById('verif-doc-meta')?.value) || 'alvara_cnes_demonstrativo.pdf';

    if (!justificativa) return;

    const estado = obterEstadoRepositorio();
    const persona = obterPersonaAtiva();

    if (!Array.isArray(estado.verificacoes)) estado.verificacoes = [];
    if (!Array.isArray(estado.solicitacoesInstitucionais)) estado.solicitacoesInstitucionais = [];

    const novaVerif = {
      id: `VER-${Date.now().toString().slice(-5)}`,
      unidadeId: unidadeSelecionadaId,
      solicitanteDemo: persona.nome,
      documentoMetadadoDemo: docMetadado,
      observacaoDemo: justificativa,
      estado: 'PENDENTE',
      instante: new Date().toISOString(),
      responsavelDemo: 'Aguardando Verificador Administrativo'
    };

    estado.verificacoes.unshift(novaVerif);
    estado.solicitacoesInstitucionais.unshift({
      id: `SOL-${Date.now().toString().slice(-5)}`,
      tipo: 'SOLICITACAO_SELO_VERIFICACAO',
      unidadeId: unidadeSelecionadaId,
      estado: 'PENDENTE',
      criadaEm: new Date().toISOString(),
      observacaoDemo: `${justificativa} [Anexo simulado: ${docMetadado}]`
    });

    registrarAuditoriaLocal(
      estado,
      'Verificacao',
      unidadeSelecionadaId,
      'Pedido de Verificação Institucional',
      'N/A',
      `Estado: PENDENTE (Doc: ${docMetadado})`
    );

    persistirEstadoRepositorio(estado);
    e.target.reset();
    renderizarPainelInstitucionalCompleto();
    exibirFeedbackInstitucional(
      'Solicitação de verificação registada como PENDENTE! Conforme CA-803 e T-17, o selo VERIFICADO não é concedido automaticamente pela instituição — depende de aprovação no Painel Administrativo.',
      'info'
    );
  });

  // 5. Simular Solicitação de Novo Cadastro/Vínculo Institucional (Cap. 8.12)
  document.getElementById('form-solicitar-vinculo')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const tipoPedido = document.getElementById('vinc-tipo-pedido')?.value || 'ATUALIZACAO_REPRESENTANTE';
    const cnesDemo = sanitizarTexto(document.getElementById('vinc-cnes-demo')?.value) || 'CNES-DEMO-000000';
    const obs = sanitizarTexto(document.getElementById('vinc-observacao')?.value);

    if (!obs) return;

    const estado = obterEstadoRepositorio();
    if (!Array.isArray(estado.solicitacoesInstitucionais)) estado.solicitacoesInstitucionais = [];

    estado.solicitacoesInstitucionais.unshift({
      id: `SOL-${Date.now().toString().slice(-5)}`,
      tipo: tipoPedido,
      unidadeId: unidadeSelecionadaId,
      estado: 'EM_ANALISE',
      criadaEm: new Date().toISOString(),
      observacaoDemo: `[${cnesDemo}] ${obs}`
    });

    registrarAuditoriaLocal(estado, 'SolicitacaoInstitucional', unidadeSelecionadaId, tipoPedido, 'Novo', 'EM_ANALISE');
    persistirEstadoRepositorio(estado);
    e.target.reset();
    renderizarPainelInstitucionalCompleto();
    exibirFeedbackInstitucional('Solicitação institucional encaminhada para a fila simulada da Administração.', 'available');
  });
}

function sanitizarTexto(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>]/g, '').trim();
}

function validarPermissaoDemonstrativa() {
  if (!verificarVinculoUnidade(unidadeSelecionadaId)) {
    exibirFeedbackInstitucional(
      'Operação bloqueada na interface demonstrativa (T-15 / RN-020): esta unidade não está vinculada ao seu perfil institucional atual. Nota: em produção, este controlo exige validação no servidor.',
      'danger'
    );
    return false;
  }
  return true;
}

function registrarAuditoriaLocal(estado, entidade, entidadeId, campo, antes, depois) {
  if (!Array.isArray(estado.historicoAuditoria)) estado.historicoAuditoria = [];
  const persona = obterPersonaAtiva();
  estado.historicoAuditoria.unshift({
    id: `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    entidade,
    entidadeId,
    campo,
    antes: String(antes ?? ''),
    depois: String(depois ?? ''),
    atorDemo: `${persona.nome} (${persona.papel})`,
    instante: new Date().toISOString()
  });
}

function exibirFeedbackInstitucional(mensagem, classe = 'info') {
  const box = document.getElementById('feedback-painel-institucional');
  if (!box) return;
  box.hidden = false;
  box.className = `status-pill status-pill--${classe}`;
  box.style.display = 'block';
  box.style.padding = 'var(--space-3)';
  box.style.marginBottom = 'var(--space-4)';
  box.textContent = mensagem;
}

function renderizarPainelInstitucionalCompleto() {
  const estado = obterEstadoRepositorio();
  const unidades = listarUnidadesCompletas();
  const unidade = unidades.find((u) => u.id === unidadeSelecionadaId) || unidades[0];
  const persona = obterPersonaAtiva();
  const temPermissao = verificarVinculoUnidade(unidade.id);

  // Banner de estado de vínculo (CA-804 e T-15)
  const badgeVinculo = document.getElementById('inst-status-vinculo');
  const avisoBloqueio = document.getElementById('inst-aviso-bloqueio-t15');
  if (badgeVinculo) {
    badgeVinculo.className = `status-pill status-pill--${temPermissao ? 'available' : 'danger'}`;
    badgeVinculo.textContent = temPermissao
      ? `✔ Unidade Vinculada a ${persona.nome}`
      : `🔒 Unidade NÃO Vinculada a ${persona.nome} (Modo Somente Leitura — T-15)`;
  }
  if (avisoBloqueio) {
    avisoBloqueio.hidden = temPermissao;
  }

  // Bloqueia/desbloqueia fieldsets de edição conforme vínculo (T-15)
  document.querySelectorAll('.fieldset-edicao-institucional').forEach((fs) => {
    fs.disabled = !temPermissao;
  });

  renderizarNoveItensVisaoGeral(unidade, estado);
  preencherFormulariosUnidade(unidade);
  renderizarListaServicosInstituicao(unidade, temPermissao);
  renderizarSolicitacoesEVerificacoes(unidade, estado);
  renderizarHistoricoAuditoriaUnidade(unidade, estado);
}

/**
 * Renderiza os 9 itens obrigatórios da Visão Geral Institucional (Cap. 8.2)
 */
function renderizarNoveItensVisaoGeral(u, estado) {
  const totalServicos = u.servicos.length;
  const todasDisp = u.servicos.flatMap((s) => s.disponibilidades);
  const dispAtivas = todasDisp.filter((d) => d.estado === 'DISP-01' || d.estado === 'DISP-02').length;
  const dispVencidasOuDesatualizadas = todasDisp.filter(
    (d) => d.estado === 'DISP-06' || d.confiabilidade === 'DESATUALIZADO' || new Date(d.revisarAte) < new Date('2026-10-29T12:00:00-03:00')
  ).length;

  const logsUnidade = (estado.historicoAuditoria || []).filter((h) => h.entidadeId === u.id);
  const verifsUnidade = (estado.verificacoes || []).filter((v) => v.unidadeId === u.id);
  const relatosUnidade = (estado.relatos || []).filter((r) => r.unidadeId === u.id && r.estado === 'PENDENTE');

  // 1. Resumo institucional
  setTexto('ov-1-resumo', `${u.nome} (${u.tipo}) • Bairro: ${u.bairro} • Rede: ${u.modalidades.join(', ')}`);
  // 2. Serviços cadastrados
  setTexto('ov-2-servicos', `${totalServicos} serviço(s) ativo(s) em ${u.especialidades.length} especialidade(s)`);
  // 3. Disponibilidade
  setTexto('ov-3-disponibilidade', `${dispAtivas} de ${todasDisp.length} modalidade(s) com vaga/demanda informada`);
  // 4. Dados desatualizados
  setTexto(
    'ov-4-desatualizados',
    dispVencidasOuDesatualizadas > 0 || u.confiabilidadeUnidade === 'DESATUALIZADO'
      ? `⚠ ${dispVencidasOuDesatualizadas} registo(s) fora do prazo de revisão`
      : '✔ Todos os registos dentro do prazo simulado'
  );
  // 5. Próximas revisões (Cap. 8.11: diária, semanal, mensal)
  setTexto('ov-5-revisoes', 'Disponibilidade: Diária (24h) • Horários/Requisitos: Semanal (7d) • Dados gerais: Mensal (30d)');
  // 6. Alterações recentes
  setTexto('ov-6-alteracoes', `${logsUnidade.length} alteração(ões) registada(s) no histórico local`);
  // 7. Pedidos de verificação
  const pendentesVerif = verifsUnidade.filter((v) => v.estado === 'PENDENTE').length;
  setTexto(
    'ov-7-verificacao',
    `Selo atual: ${u.metaConfiabilidadeUnidade.rotulo} (${pendentesVerif} pedido(s) pendente(s))`
  );
  // 8. Avisos administrativos e relatos
  setTexto(
    'ov-8-avisos',
    relatosUnidade.length > 0
      ? `⚠ ${relatosUnidade.length} relato(s) de erro enviado(s) por utilizadores para revisão`
      : 'Sem avisos ou irregularidades pendentes'
  );
}

function preencherFormulariosUnidade(u) {
  setValor('edit-unidade-nome', u.nome);
  setValor('edit-unidade-tipo', u.tipo);
  setValor('edit-unidade-horario', u.horarioGeral);
  setValor('edit-unidade-contato', u.contatoDemonstrativo);
  setValor('edit-unidade-agendamento', u.canalAgendamentoDemo);
  setValor('edit-unidade-endereco', u.enderecoDemonstrativo);
  setValor('edit-unidade-acessibilidade', (u.acessibilidade || []).join(', '));
  atualizarPreviaDadosGerais();

  // Popular select de serviços da unidade no form de disponibilidade
  const selSrvDisp = document.getElementById('form-disp-servico');
  if (selSrvDisp) {
    selSrvDisp.innerHTML = '';
    u.servicos.forEach((s) => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = `[${s.id}] ${s.nome} (${s.modalidades.join('/')})`;
      selSrvDisp.appendChild(opt);
    });
  }
}

function atualizarPreviaDadosGerais() {
  const boxPrevia = document.getElementById('previa-cartao-institucional');
  if (!boxPrevia) return;

  const nome = document.getElementById('edit-unidade-nome')?.value || '';
  const horario = document.getElementById('edit-unidade-horario')?.value || '';
  const contato = document.getElementById('edit-unidade-contato')?.value || '';
  const agendamento = document.getElementById('edit-unidade-agendamento')?.value || '';
  const endereco = document.getElementById('edit-unidade-endereco')?.value || '';

  boxPrevia.innerHTML = '';
  const strong = document.createElement('strong');
  strong.textContent = `Prévia Pública Segura: ${nome}`;
  const p1 = document.createElement('p');
  p1.className = 'form-hint';
  p1.style.margin = '4px 0 0';
  p1.textContent = `📍 ${endereco} | 🕒 ${horario}`;
  const p2 = document.createElement('p');
  p2.className = 'form-hint';
  p2.style.margin = '2px 0 0';
  p2.textContent = `📞 Contato demo: ${contato} | 🔗 Agendamento: ${agendamento}`;

  boxPrevia.appendChild(strong);
  boxPrevia.appendChild(p1);
  boxPrevia.appendChild(p2);
}

function renderizarListaServicosInstituicao(u, temPermissao) {
  const container = document.getElementById('inst-lista-servicos');
  if (!container) return;
  container.innerHTML = '';

  u.servicos.forEach((srv) => {
    const card = document.createElement('div');
    card.className = 'service-list__item';

    const topo = document.createElement('div');
    topo.style.display = 'flex';
    topo.style.justifyContent = 'space-between';
    topo.style.alignItems = 'center';
    topo.style.flexWrap = 'wrap';
    topo.style.gap = 'var(--space-2)';

    const titulo = document.createElement('strong');
    titulo.textContent = `[${srv.id}] ${srv.nome} (${srv.especialidadeNome})`;
    topo.appendChild(titulo);

    if (temPermissao) {
      const btnEditar = document.createElement('button');
      btnEditar.type = 'button';
      btnEditar.className = 'btn-a11y';
      btnEditar.textContent = '✎ Carregar para edição';
      btnEditar.addEventListener('click', () => {
        setValor('form-srv-id-edicao', srv.id);
        setValor('form-srv-especialidade', srv.especialidadeId);
        setValor('form-srv-nome', srv.nome);
        setValor('form-srv-horarios', srv.horarios);
        setValor('form-srv-requisitos', srv.requisitos);
        document.querySelectorAll('input[name="srv-mod"]').forEach((chk) => {
          chk.checked = srv.modalidades.includes(chk.value);
        });
        document.getElementById('form-srv-nome')?.focus();
      });
      topo.appendChild(btnEditar);
    }

    card.appendChild(topo);

    const pReq = document.createElement('p');
    pReq.className = 'form-hint';
    pReq.style.margin = '4px 0';
    pReq.textContent = `Horário: ${srv.horarios} • Requisitos: ${srv.requisitos}`;
    card.appendChild(pReq);

    const badges = document.createElement('div');
    badges.className = 'service-list__badges';
    srv.disponibilidades.forEach((d) => {
      const pill = document.createElement('span');
      pill.className = `status-pill status-pill--${d.metaEstado.classe}`;
      pill.textContent = `${d.metaEstado.icone} [${d.modalidade}] ${d.estado}: ${d.metaEstado.rotulo} (${d.metaConfiabilidade.rotulo})`;
      badges.appendChild(pill);
    });
    card.appendChild(badges);

    container.appendChild(card);
  });
}

function renderizarSolicitacoesEVerificacoes(u, estado) {
  const container = document.getElementById('inst-lista-verificacoes');
  if (!container) return;
  container.innerHTML = '';

  const lista = (estado.solicitacoesInstitucionais || []).filter((s) => s.unidadeId === u.id);
  if (lista.length === 0) {
    container.innerHTML = '<p class="form-hint">Nenhuma solicitação de verificação ou cadastro enviada para esta unidade.</p>';
    return;
  }

  lista.forEach((sol) => {
    const div = document.createElement('div');
    div.className = 'service-list__item';
    const dataFmt = new Date(sol.criadaEm).toLocaleString('pt-BR');
    div.innerHTML = `
      <div style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:var(--space-2);">
        <strong>[${sol.id}] ${sol.tipo}</strong>
        <span class="status-pill status-pill--warning">Estado: ${sol.estado}</span>
      </div>
      <p class="form-hint" style="margin:4px 0 0;">${sol.observacaoDemo} • Enviada em: ${dataFmt}</p>
    `;
    container.appendChild(div);
  });
}

function renderizarHistoricoAuditoriaUnidade(u, estado) {
  const container = document.getElementById('inst-lista-historico');
  if (!container) return;
  container.innerHTML = '';

  const logs = (estado.historicoAuditoria || []).filter((h) => h.entidadeId === u.id);
  if (logs.length === 0) {
    container.innerHTML = '<p class="form-hint">Nenhuma modificação manual registada nesta sessão para esta unidade.</p>';
    return;
  }

  logs.forEach((log) => {
    const div = document.createElement('div');
    div.className = 'service-list__item';
    const dataFmt = new Date(log.instante).toLocaleString('pt-BR');

    const strong = document.createElement('strong');
    strong.textContent = `[${log.id}] Campo: ${log.campo} (${log.entidade})`;
    const p = document.createElement('p');
    p.className = 'form-hint';
    p.style.margin = '4px 0 0';
    p.textContent = `Antes: "${log.antes}" → Depois: "${log.depois}" • Ator: ${log.atorDemo} • Data/Hora: ${dataFmt}`;

    div.appendChild(strong);
    div.appendChild(p);
    container.appendChild(div);
  });
}

function setTexto(id, texto) {
  const el = document.getElementById(id);
  if (el) el.textContent = texto;
}

function setValor(id, valor) {
  const el = document.getElementById(id);
  if (el) el.value = valor ?? '';
}