// js/app.js
import { inicializarLayoutBase } from './componentes/layout-base.js';
import { inicializarIntegracaoTransversal } from './componentes/integracao-global.js';
import { inicializarHomePesquisa } from './funcionalidades/home-pesquisa.js';
import { inicializarPaginaBuscaCompleta } from './funcionalidades/busca-filtros.js';
import { inicializarPaginaDetalhesUnidade } from './funcionalidades/detalhes-unidade.js';
import { inicializarAreaPaciente } from './funcionalidades/area-paciente.js';
import { inicializarPainelInstitucional } from './funcionalidades/painel-institucional.js';
import { inicializarPainelAdministrativo } from './funcionalidades/painel-administrativo.js';

document.addEventListener('DOMContentLoaded', () => {
  const paginaAtiva = document.body.getAttribute('data-page') || 'inicio';
  inicializarLayoutBase(paginaAtiva);

  const inicializarModuloDaPagina = () => {
    if (paginaAtiva === 'inicio') {
      inicializarHomePesquisa();
    } else if (paginaAtiva === 'busca') {
      inicializarPaginaBuscaCompleta();
    } else if (paginaAtiva === 'unidade') {
      inicializarPaginaDetalhesUnidade();
    } else if (paginaAtiva === 'paciente') {
      inicializarAreaPaciente();
    } else if (paginaAtiva === 'instituicao') {
      inicializarPainelInstitucional();
    } else if (paginaAtiva === 'administracao') {
      inicializarPainelAdministrativo();
    }
  };

  inicializarModuloDaPagina();
  inicializarIntegracaoTransversal(inicializarModuloDaPagina);
});