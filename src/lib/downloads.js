import JSZip from 'jszip'
import { saveAs } from 'file-saver'

/**
 * Baixa um único arquivo a partir de uma URL pública.
 * Usa fetch + Blob para funcionar mesmo com URLs cross-origin (Supabase Storage).
 */
export async function downloadArquivo(url, nomeArquivo) {
  try {
    const resp = await fetch(url)
    if (!resp.ok) throw new Error('Falha ao baixar arquivo')
    const blob = await resp.blob()
    saveAs(blob, nomeArquivo)
  } catch (e) {
    alert(`Erro ao baixar arquivo: ${e.message}`)
  }
}

/**
 * Baixa múltiplos arquivos agrupados em um .zip.
 * @param {Array<{url: string, nome: string}>} arquivos
 * @param {string} nomeZip - nome do arquivo ZIP sem extensão
 */
export async function downloadZip(arquivos, nomeZip = 'anexos') {
  try {
    const zip = new JSZip()
    const pasta = zip.folder(nomeZip)

    await Promise.all(
      arquivos
        .filter(a => a.url)
        .map(async (a) => {
          const resp = await fetch(a.url)
          if (!resp.ok) return
          const blob = await resp.blob()
          pasta.file(a.nome, blob)
        })
    )

    const conteudo = await zip.generateAsync({ type: 'blob' })
    saveAs(conteudo, `${nomeZip}.zip`)
  } catch (e) {
    alert(`Erro ao gerar ZIP: ${e.message}`)
  }
}

/**
 * Extrai o nome do arquivo de uma URL do Supabase Storage.
 */
export function nomeDoArquivo(url, prefixo = 'arquivo') {
  if (!url) return prefixo
  try {
    const partes = new URL(url).pathname.split('/')
    return partes[partes.length - 1] || prefixo
  } catch {
    return prefixo
  }
}
