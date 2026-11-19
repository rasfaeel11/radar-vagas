const ENTIDADES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodificarEntidades(texto: string): string {
  return texto.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, codigo: string) => {
    if (codigo.startsWith("#x") || codigo.startsWith("#X")) {
      const n = Number.parseInt(codigo.slice(2), 16);
      return Number.isNaN(n) ? match : String.fromCodePoint(n);
    }
    if (codigo.startsWith("#")) {
      const n = Number.parseInt(codigo.slice(1), 10);
      return Number.isNaN(n) ? match : String.fromCodePoint(n);
    }
    return ENTIDADES[codigo.toLowerCase()] ?? match;
  });
}

/**
 * Converte HTML (inclusive escapado, como vem do Greenhouse: `&lt;p&gt;...&lt;/p&gt;`)
 * em texto puro legível, preservando quebras de linha entre blocos.
 */
export function limparHtml(html: string): string {
  if (!html) return "";

  // 1. Desescapa entidades (ex.: `&lt;p&gt;` -> `<p>`)
  const desescapado = decodificarEntidades(html);

  // 2. Quebra de linha em tags de bloco e <br> para não colar palavras
  const comQuebras = desescapado
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, "\n");

  // 3. Remove as demais tags HTML
  const semTags = comQuebras.replace(/<[^>]+>/g, " ");

  // 4. Decodifica entidades que estavam dentro do conteúdo (ex.: &amp;amp; -> &amp; -> &)
  const limpo = decodificarEntidades(semTags);

  // 5. Normaliza espaços por linha e colapsa linhas em branco excessivas
  return limpo
    .split(/\r?\n/)
    .map((linha) => linha.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
