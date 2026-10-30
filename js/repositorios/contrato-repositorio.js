// js/repositorios/contrato-repositorio.js

/**
 * Normaliza texto removendo acentos, espaços extras e convertendo para minúsculas (CA-301)
 */
export function normalizarTexto(valor) {
  if (typeof valor !== 'string') return '';
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Valida se o objeto carregado do localStorage respeita a estrutura mínima esperada (Cap. 13.7 e 14.14)
 */
export function validarEsquemaDados(dados, versaoEsperada) {
  if (!dados || typeof dados !== 'object') return false;
  if (dados.versao !== versaoEsperada) return false;
  if (!Array.isArray(dados.unidades) || dados.unidades.length === 0) return false;
  if (!Array.isArray(dados.especialidades) || !Array.isArray(dados.servicos) || !Array.isArray(dados.disponibilidades)) {
    return false;
  }
  return true;
}