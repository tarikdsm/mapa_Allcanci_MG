# Mapa Allcanci MG

Mapa web interativo publicado em GitHub Pages para visualizar clientes da Allcanci em Minas Gerais por etapa comercial, com uma camada adicional oficial de densidade populacional do IBGE.

## Links

- Repositório: [github.com/tarikdsm/mapa_Allcanci_MG](https://github.com/tarikdsm/mapa_Allcanci_MG)
- Produção: [tarikdsm.github.io/mapa_Allcanci_MG](https://tarikdsm.github.io/mapa_Allcanci_MG/)
- Hub de documentação: [`docs/README.md`](./docs/README.md)
- Handoff para continuidade: [`docs/HANDOFF_Codex.md`](./docs/HANDOFF_Codex.md)

## Escopo atual

- Mapa responsivo com Leaflet e GitHub Pages
- Camadas independentes com chave ON/OFF para:
  - `Clientes`
  - `Assinatura de Contrato`
  - `Licitação - Publicação`
  - `Fechamento`
  - `Densidade populacional`
- Marcadores com clusterização para preservar legibilidade em múltiplos níveis de zoom
- Dados de clientes preparados a partir de snapshot do CRM/Bitrix24
- Densidade demográfica municipal oficial do IBGE, com legenda e popup por município

## Status atual do build

- Última base gerada em `2026-03-23T23:57:15Z`
- `651` pontos de clientes publicados
- `853` municípios de Minas Gerais na camada de densidade
- `0` registros ignorados por falta de geocodificação neste snapshot

Distribuição atual dos clientes no mapa:

- `Clientes`: `420`
- `Assinatura de Contrato`: `10`
- `Licitação - Publicação`: `12`
- `Fechamento`: `209`

## Estrutura do repositório

- `index.html`: shell da aplicação
- `app.js`: lógica do mapa, toggles, popups, clusterização e camada IBGE
- `styles.css`: layout, responsividade e identidade visual
- `data/clients.geojson`: pontos dos clientes
- `data/minas-gerais.geojson`: contorno do estado
- `data/municipal-density-ibge.geojson`: densidade demográfica municipal oficial
- `data/source/clientes_por_etapa_comercial.json`: snapshot local da base consumida pelo mapa
- `scripts/prepare_map_data.py`: pipeline de preparação de dados
- `docs/`: documentação técnica e histórica do projeto

## Execução local

Pré-requisitos:

- Python 3.11+ recomendado
- Dependência Python: `pyshp`

Instalação da dependência:

```powershell
pip install pyshp
```

Subir um servidor local simples:

```powershell
python -m http.server 8123
```

Abrir no navegador:

```text
http://127.0.0.1:8123/
```

## Regenerar os dados

O script abaixo:

- lê `../Planilhas_Clientes/clientes_por_etapa_comercial.json` se esse arquivo existir
- caso contrário, usa o snapshot já versionado em `data/source/clientes_por_etapa_comercial.json`
- atualiza o contorno de Minas Gerais
- atualiza a camada oficial de densidade do IBGE
- reaproveita o cache local de geocodificação por bairro/cidade
- gera os GeoJSONs públicos usados pelo site

```powershell
python scripts\prepare_map_data.py
```

Arquivos de saída:

- `data/clients.geojson`
- `data/minas-gerais.geojson`
- `data/municipal-density-ibge.geojson`
- `data/build-report.json`

## Deploy

O deploy é estático e publicado diretamente pela branch `main` no GitHub Pages.

Fluxo:

1. Alterar código ou regenerar dados.
2. Validar localmente.
3. Fazer `git push origin main`.
4. Aguardar o GitHub Pages publicar a nova versão.

## Fontes de dados

- Snapshot de clientes oriundo do fluxo Bitrix24 do projeto principal
- Geocodificação aproximada por bairro/cidade via Nominatim/OpenStreetMap
- Contorno estadual oficial do IBGE
- Densidade demográfica municipal oficial do IBGE, Censo 2022, tabela SIDRA 4714

## Leitura recomendada

Para continuidade do projeto por outra pessoa ou por outro Codex:

1. [`docs/HANDOFF_Codex.md`](./docs/HANDOFF_Codex.md)
2. [`docs/ARQUITETURA.md`](./docs/ARQUITETURA.md)
3. [`docs/OPERACAO_E_DEPLOY.md`](./docs/OPERACAO_E_DEPLOY.md)
4. [`docs/HISTORICO_DO_PROJETO.md`](./docs/HISTORICO_DO_PROJETO.md)
