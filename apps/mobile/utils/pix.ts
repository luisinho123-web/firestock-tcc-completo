/**
 * Pix "copia e cola" (BR Code estático), no padrão EMV do Banco Central (Manual de Padrões para Iniciação do Pix).
 * Funções puras, sem React Native, para poder testar.
 *
 * É um Pix ESTÁTICO: o banco lê a chave, o valor, o nome e a cidade direto do código. Quem paga transfere dinheiro
 * de verdade para a chave informada, e o app NÃO é avisado do pagamento (isso só existe com uma API de pagamento).
 */

/** Chave usada quando EXPO_PUBLIC_PIX_KEY não está definida: um UUID que não pertence a ninguém. O QR continua no formato
 * correto (o banco lê), mas nenhum dinheiro tem para onde ir. */
export const PLACEHOLDER_PIX_KEY = '00000000-0000-4000-8000-000000000000';

export type PixConfig = { key: string; name: string; city: string; isPlaceholder: boolean };

/** Lê a configuração do `.env.local` (EXPO_PUBLIC_PIX_KEY, EXPO_PUBLIC_PIX_NAME, EXPO_PUBLIC_PIX_CITY). */
export function getPixConfig(): PixConfig {
  const key = (process.env.EXPO_PUBLIC_PIX_KEY ?? '').trim();
  return {
    key: key || PLACEHOLDER_PIX_KEY,
    name: (process.env.EXPO_PUBLIC_PIX_NAME ?? '').trim() || 'FireStock',
    city: (process.env.EXPO_PUBLIC_PIX_CITY ?? '').trim() || 'Cascavel',
    isPlaceholder: !key,
  };
}

/** Um campo EMV: id (2 dígitos) + tamanho (2 dígitos) + valor. */
function field(id: string, value: string): string {
  return `${id}${String(value.length).padStart(2, '0')}${value}`;
}

/** CRC-16/CCITT-FALSE (polinômio 0x1021, valor inicial 0xFFFF), em 4 hexadecimais maiúsculos. */
export function crc16(text: string): string {
  let crc = 0xffff;
  for (let i = 0; i < text.length; i += 1) {
    crc ^= text.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/** Nome e cidade do recebedor: sem acento, só A–Z, 0–9 e espaço, em maiúsculas, com o tamanho máximo do padrão. */
export function sanitizePixText(value: string, max: number): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/** Identificador da cobrança (txid): só letras e números, até 25 caracteres; "***" quando não há. */
export function sanitizeTxid(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***';
}

export type PixPayloadInput = {
  key: string;
  name: string;
  city: string;
  /** Valor em reais (ex.: 12.9). Zero ou omitido gera um código em que o pagador digita o valor. */
  amount?: number;
  txid?: string;
};

export function buildPixPayload({ key, name, city, amount, txid }: PixPayloadInput): string {
  const cleanKey = key.trim();
  if (!cleanKey) throw new Error('A chave Pix é obrigatória.');

  const merchantAccount = field('00', 'br.gov.bcb.pix') + field('01', cleanKey);
  const cents = amount && amount > 0 ? Math.round(amount * 100) : 0;
  const value = cents > 0 ? `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}` : '';

  const body =
    field('00', '01') + // versão do formato
    field('26', merchantAccount) + // dados da conta Pix
    field('52', '0000') + // categoria do recebedor (não informada)
    field('53', '986') + // moeda: real
    (value ? field('54', value) : '') +
    field('58', 'BR') +
    field('59', sanitizePixText(name, 25) || 'FIRESTOCK') +
    field('60', sanitizePixText(city, 15) || 'BRASIL') +
    field('62', field('05', sanitizeTxid(txid ?? ''))) +
    '6304'; // o CRC cobre tudo, inclusive o próprio "6304"

  return body + crc16(body);
}
