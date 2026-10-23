import crypto from "node:crypto";

/**
 * Classificações permitidas para as evidências.
 *
 * Cada classificação deve ser usada de acordo com o conteúdo
 * e a documentação disponível. Uma hipótese não é um fato provado.
 */
export const EVIDENCE_STATUSES = Object.freeze([
  "fato_documentado",
  "documentado",
  "alegacao",
  "hipotese",
  "nao_verificado"
]);

/**
 * Compara dois tokens de forma segura.
 *
 * Retorna false se os valores não forem strings, estiverem vazios
 * ou tiverem comprimentos diferentes.
 */
export function tokensMatch(received, expected) {
  if (
    typeof received !== "string" ||
    typeof expected !== "string" ||
    received.length === 0 ||
    expected.length === 0
  ) {
    return false;
  }

  const receivedBuffer = Buffer.from(received, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");

  if (receivedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    receivedBuffer,
    expectedBuffer
  );
}

/**
 * Valida e limpa textos recebidos pela API.
 *
 * Opções:
 * - min: tamanho mínimo permitido;
 * - max: tamanho máximo permitido;
 * - required: indica se o campo é obrigatório.
 *
 * Retorna a string limpa ou null quando o valor é inválido.
 */
export function cleanString(value, options = {}) {
  if (typeof value !== "string") {
    return null;
  }

  const min = Number.isInteger(options.min)
    ? Math.max(0, options.min)
    : 0;

  const max = Number.isInteger(options.max)
    ? Math.max(0, options.max)
    : 5000;

  const required = options.required === true;

  if (min > max) {
    return null;
  }

  const cleaned = value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .normalize("NFC")
    .trim();

  if (cleaned.length > max) {
    return null;
  }

  if (required && cleaned.length === 0) {
    return null;
  }

  if (cleaned.length < min) {
    return null;
  }

  return cleaned;
}

/**
 * Verifica uma data no formato AAAA-MM-DD.
 *
 * Aceita uma string vazia para campos opcionais.
 * Rejeita datas impossíveis, como 2026-02-31.
 */
export function isIsoDate(value) {
  if (value === "") {
    return true;
  }

  if (typeof value !== "string") {
    return false;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (
    year < 1 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return false;
  }

  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * Verifica se o conteúdo recebido começa com a assinatura %PDF-.
 *
 * A função exige um Buffer. A assinatura inicial não garante
 * que o documento inteiro seja válido ou esteja livre de malware.
 */
export function isPdf(value) {
  if (!Buffer.isBuffer(value) || value.length < 5) {
    return false;
  }

  return value.subarray(0, 5).equals(
    Buffer.from("%PDF-", "ascii")
  );
}

/**
 * Aceita somente URLs HTTP e HTTPS.
 *
 * Retorno:
 * - URL normalizada, se válida;
 * - string vazia, quando o campo é opcional e está vazio;
 * - null, quando o valor é inválido.
 */
export function normalizeHttpUrl(value) {
  if (typeof value !== "string") {
    return null;
  }

  const input = value.trim();

  if (input === "") {
    return "";
  }

  if (input.length > 2048) {
    return null;
  }

  try {
    const url = new URL(input);

    if (
      url.protocol !== "http:" &&
      url.protocol !== "https:"
    ) {
      return null;
    }

    if (
      !url.hostname ||
      url.username ||
      url.password
    ) {
      return null;
    }

    return url.href;
  } catch {
    return null;
  }
}

/**
 * Sanitiza o nome original de um arquivo para exibição e download.
 *
 * Remove separadores de diretório e caracteres de controle.
 * Não deve ser usado como nome interno de armazenamento.
 *
 * O servidor usa um UUID para o nome real do PDF armazenado.
 */
export function sanitizeOriginalFilename(value) {
  if (typeof value !== "string") {
    return "documento.pdf";
  }

  let filename = value
    .replace(/[\\/]/g, "_")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/[<>:"|?*]/g, "_")
    .trim();

  filename = filename.slice(0, 180);

  if (
    filename === "" ||
    filename === "." ||
    filename === ".."
  ) {
    return "documento.pdf";
  }

  return filename;
}