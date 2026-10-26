"""
Gera os dados estáticos da NFS-e Nacional usados pela tela de Notas Fiscais:

  src/lib/notas/dados/servicos-nacionais.ts   lista nacional de serviços (código de tributação nacional + descrição)
  src/lib/notas/dados/municipios.ts           municípios (código IBGE) + situação perante o Emissor Nacional

Só usa a biblioteca padrão do Python. Fontes (todas públicas):

  --anexo-i        Anexo I do Sistema Nacional NFS-e (aba MUN.INCID_INFO.SERV.), do portal
                   https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/documentacao-atual
  --aderentes      planilha "municípios aderentes" do mesmo portal (monitoramento de adesões)
  --ibge           https://servicodados.ibge.gov.br/api/v1/localidades/municipios  (JSON salvo em arquivo)
  --referencia     data da planilha de aderentes (AAAA-MM-DD), gravada nos dados para a tela avisar que é uma foto

Uso (a partir da raiz do repositório):

  python -I -X utf8 scripts/gerar-dados-nfse.py --anexo-i anexo-i.xlsx --aderentes aderentes.xlsx \
      --ibge municipios.json --referencia 2026-09-28

Os arquivos baixados são dado não confiável: o script só lê células, nunca executa nada deles.
"""

import argparse
import json
import re
import sys
import unicodedata
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"


def numero_da_coluna(referencia: str) -> int:
    n = 0
    for letra in (c for c in referencia if c.isalpha()):
        n = n * 26 + (ord(letra) - 64)
    return n - 1


def ler_aba(caminho: str, nome_aba: str | None = None) -> list[dict[int, str]]:
    """Linhas da aba (a primeira, se nenhuma for pedida) como {coluna: texto}, ignorando as vazias."""
    pacote = zipfile.ZipFile(caminho)
    compartilhadas = []
    if "xl/sharedStrings.xml" in pacote.namelist():
        for si in ET.fromstring(pacote.read("xl/sharedStrings.xml")).findall(f"{{{NS}}}si"):
            compartilhadas.append("".join(t.text or "" for t in si.iter(f"{{{NS}}}t")))
    livro = ET.fromstring(pacote.read("xl/workbook.xml"))
    destinos = {r.get("Id"): r.get("Target") for r in ET.fromstring(pacote.read("xl/_rels/workbook.xml.rels"))}
    abas = livro.find(f"{{{NS}}}sheets")
    escolhida = next((a for a in abas if nome_aba is None or a.get("name") == nome_aba), None)
    if escolhida is None:
        sys.exit(f"aba '{nome_aba}' não encontrada em {caminho}")
    alvo = destinos[escolhida.get(f"{{{REL}}}id")].lstrip("/")
    alvo = alvo if alvo.startswith("xl/") else f"xl/{alvo}"

    linhas = []
    for linha in ET.fromstring(pacote.read(alvo)).iter(f"{{{NS}}}row"):
        valores = {}
        for celula in linha.findall(f"{{{NS}}}c"):
            v = celula.find(f"{{{NS}}}v")
            tipo = celula.get("t")
            if tipo == "inlineStr":
                texto = "".join(t.text or "" for t in celula.iter(f"{{{NS}}}t"))
            elif v is None:
                continue
            else:
                texto = compartilhadas[int(v.text)] if tipo == "s" else v.text
            valores[numero_da_coluna(celula.get("r"))] = " ".join(texto.split())
        if valores:
            linhas.append(valores)
    return linhas


def sem_acento(texto: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", texto) if not unicodedata.combining(c))


def chave_do_municipio(uf: str, nome: str) -> str:
    base = re.sub(r"[^A-Z0-9]+", " ", sem_acento(nome).upper()).strip()
    return f"{uf.upper()}|{base}"


# Nomes que o IBGE e a planilha de aderentes grafam diferente (chave do IBGE -> chave da planilha).
ALIASES = {
    "SE|AMPARO DO SAO FRANCISCO": "SE|AMPARO DE SAO FRANCISCO",
    "GO|BOM JESUS DE GOIAS": "GO|BOM JESUS",
    "PR|MUNHOZ DE MELO": "PR|MUNHOZ DE MELLO",
    "MT|SANTO ANTONIO DE LEVERGER": "MT|SANTO ANTONIO DO LEVERGER",
    "MG|SAO TOME DAS LETRAS": "MG|SAO THOME DAS LETRAS",
    "TO|SAO VALERIO": "TO|SAO VALERIO DA NATIVIDADE",
    "TO|TABOCAO": "TO|FORTALEZA DO TABOCAO",
}


def gerar_servicos(anexo_i: str) -> list[tuple[str, str]]:
    """O Excel guarda o código como número: '010101' vira 10101, então completa com zeros à esquerda."""
    servicos = {}
    for colunas in ler_aba(anexo_i, "MUN.INCID_INFO.SERV."):
        codigo, descricao = colunas.get(0, ""), colunas.get(1, "")
        if re.fullmatch(r"\d{5,6}", codigo) and descricao:
            servicos[codigo.zfill(6)] = descricao
    if not 300 < len(servicos) < 400:
        sys.exit(f"quantidade de serviços inesperada ({len(servicos)}): o layout da planilha mudou?")
    return sorted(servicos.items())


def gerar_municipios(ibge: str, aderentes: str) -> list[tuple[str, str, str, int]]:
    """Situação: 2 = Emissor Nacional liberado; 1 = conveniado, mas emite no sistema da prefeitura; 0 = fora;
    3 = a planilha não traz o município (não dá para afirmar nada)."""
    situacao_por_chave = {}
    linhas = ler_aba(aderentes)
    cabecalho = {texto: coluna for coluna, texto in linhas[0].items()}
    for coluna in ("UF", "NomeMunicipio", "StatusConvenioSEFIN", "AderenteAmbienteNacional", "AderenteEmissorNacional"):
        if coluna not in cabecalho:
            sys.exit(f"coluna '{coluna}' ausente na planilha de aderentes")
    for colunas in linhas[1:]:
        uf = colunas.get(cabecalho["UF"], "")
        nome = colunas.get(cabecalho["NomeMunicipio"], "")
        if not uf or not nome:
            continue
        conveniado = colunas.get(cabecalho["StatusConvenioSEFIN"], "") == "Conveniado Ativo"
        ambiente = colunas.get(cabecalho["AderenteAmbienteNacional"], "") == "Sim"
        emissor = colunas.get(cabecalho["AderenteEmissorNacional"], "") == "Sim"
        situacao_por_chave[chave_do_municipio(uf, nome)] = 2 if conveniado and emissor else 1 if conveniado and ambiente else 0

    municipios = []
    sem_correspondencia = []
    for m in json.loads(Path(ibge).read_text(encoding="utf-8")):
        uf = ((m.get("microrregiao") or {}).get("mesorregiao") or {}).get("UF", {}).get("sigla") or (
            ((m.get("regiao-imediata") or {}).get("regiao-intermediaria") or {}).get("UF", {}).get("sigla")
        )
        chave = chave_do_municipio(uf, m["nome"])
        chave = ALIASES.get(chave, chave)
        if chave not in situacao_por_chave:
            sem_correspondencia.append(f"{m['nome']}/{uf}")
        municipios.append((str(m["id"]), m["nome"], uf, situacao_por_chave.get(chave, 3)))
    if len(sem_correspondencia) > 60:
        sys.exit(f"{len(sem_correspondencia)} municípios do IBGE sem par na planilha de aderentes: {sem_correspondencia[:10]}")
    if sem_correspondencia:
        print(f"aviso: {len(sem_correspondencia)} sem par na planilha (ficam como 3): {sem_correspondencia}", file=sys.stderr)
    return sorted(municipios, key=lambda m: (sem_acento(m[1]).lower(), m[2]))


def escrever_servicos(destino: Path, servicos: list[tuple[str, str]]) -> None:
    itens = ",\n".join(f"  [{json.dumps(c)}, {json.dumps(d, ensure_ascii=False)}]" for c, d in servicos)
    destino.write_text(
        "// GERADO por scripts/gerar-dados-nfse.py — não edite à mão.\n"
        "// Fonte: Anexo I do Sistema Nacional NFS-e, aba MUN.INCID_INFO.SERV. (lista nacional de serviços, LC 116/2003).\n"
        "\n"
        "/** [código de tributação nacional (6 dígitos: item, subitem, desdobro), descrição]. */\n"
        "export const SERVICOS_NACIONAIS: readonly (readonly [codigo: string, descricao: string])[] = [\n"
        f"{itens},\n"
        "];\n",
        encoding="utf-8",
    )


def escrever_municipios(destino: Path, municipios: list[tuple[str, str, str, int]], referencia: str) -> None:
    itens = ",\n".join(f"  [{json.dumps(i)}, {json.dumps(n, ensure_ascii=False)}, {json.dumps(u)}, {s}]" for i, n, u, s in municipios)
    destino.write_text(
        "// GERADO por scripts/gerar-dados-nfse.py — não edite à mão.\n"
        "// Fontes: municípios do IBGE + planilha de municípios aderentes ao Sistema Nacional NFS-e (gov.br).\n"
        "// É uma foto: a adesão muda com o tempo. A fonte da verdade é a consulta de parâmetros do município na API.\n"
        "\n"
        f"/** Data da planilha de aderentes usada (AAAA-MM-DD). */\n"
        f"export const MUNICIPIOS_REFERENCIA = {json.dumps(referencia)};\n"
        "\n"
        "/**\n"
        " * Situação do município perante o Sistema Nacional NFS-e:\n"
        " * 2 = convênio ativo e Emissor Nacional liberado para os contribuintes;\n"
        " * 1 = convênio ativo, mas os contribuintes emitem no sistema da prefeitura (o nacional só recebe os dados);\n"
        " * 0 = sem convênio ativo;\n"
        " * 3 = a planilha de adesões não traz o município (não dá para afirmar nada).\n"
        " */\n"
        "export type SituacaoNoSistemaNacional = 0 | 1 | 2 | 3;\n"
        "\n"
        "/** [código IBGE (7 dígitos), nome, UF, situação]. */\n"
        "export const MUNICIPIOS: readonly (readonly [ibge: string, nome: string, uf: string, situacao: SituacaoNoSistemaNacional])[] = [\n"
        f"{itens},\n"
        "];\n",
        encoding="utf-8",
    )


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--anexo-i", required=True)
    p.add_argument("--aderentes", required=True)
    p.add_argument("--ibge", required=True)
    p.add_argument("--referencia", required=True, help="data da planilha de aderentes, AAAA-MM-DD")
    p.add_argument("--saida", default="src/lib/notas/dados")
    args = p.parse_args()

    saida = Path(args.saida)
    saida.mkdir(parents=True, exist_ok=True)
    servicos = gerar_servicos(args.anexo_i)
    municipios = gerar_municipios(args.ibge, args.aderentes)
    escrever_servicos(saida / "servicos-nacionais.ts", servicos)
    escrever_municipios(saida / "municipios.ts", municipios, args.referencia)
    por_situacao = {s: sum(1 for m in municipios if m[3] == s) for s in (0, 1, 2, 3)}
    print(f"{len(servicos)} serviços; {len(municipios)} municípios (situação 0/1/2/3: {por_situacao})")


if __name__ == "__main__":
    main()
