# Handoff Codex

## Leitura rápida

Este arquivo existe para permitir continuidade do projeto em outro computador ou por outro agente sem depender do histórico do chat.

## Onde estamos

Estado atual em `2026-03-23`:

- o site está publicado em [tarikdsm.github.io/mapa_Allcanci_MG](https://tarikdsm.github.io/mapa_Allcanci_MG/)
- a branch de produção é `main`
- o último commit conhecido de referência é `3544d4f` com a camada oficial de densidade populacional do IBGE
- o projeto está operacional e não há mudanças locais pendentes no momento desta documentação

## Entregas já concluídas

- mapa responsivo de Minas Gerais em GitHub Pages
- sidebar com chaves ON/OFF para categorias comerciais
- marcadores com ícone de escola e cores por categoria
- clusterização para legibilidade em vários níveis de zoom
- leitura da base `clientes_por_etapa_comercial.json`
- camada especial de densidade populacional com dados oficiais do IBGE
- legenda da densidade
- popup com densidade, população e área por município
- pipeline de preparação de dados em Python
- versionamento do snapshot local de clientes dentro do repositório

## Decisões já tomadas

- manter o projeto como site estático
- publicar direto pelo GitHub Pages na branch `main`
- usar `Leaflet` no frontend
- usar `pyshp` no pipeline de dados
- usar `Nominatim` para geocodificação aproximada dos clientes
- usar IBGE oficial para a camada de densidade

## O que o próximo Codex precisa saber

- o repositório já é suficiente para rodar localmente
- não é obrigatório ter o diretório externo `../Planilhas_Clientes/`
- se esse diretório externo existir, ele será usado como fonte preferencial no rebuild
- os arquivos brutos do shapefile do IBGE não precisam ser versionados e já estão no `.gitignore`

## Estado atual dos dados

Build atual:

- data de geração: `2026-03-23T23:57:15Z`
- total de clientes no mapa: `651`
- clientes: `420`
- assinatura de contrato: `10`
- licitação - publicação: `12`
- fechamento: `209`
- municípios na camada de densidade: `853`
- registros ignorados por falta de geocodificação: `0`

## Arquivos mais importantes

- `README.md`
- `docs/ARQUITETURA.md`
- `docs/FONTES_E_DADOS.md`
- `docs/OPERACAO_E_DEPLOY.md`
- `docs/HISTORICO_DO_PROJETO.md`
- `index.html`
- `app.js`
- `styles.css`
- `scripts/prepare_map_data.py`
- `data/clients.geojson`
- `data/municipal-density-ibge.geojson`

## Como continuar em outro computador

1. Clonar o repositório.
2. Instalar `pyshp`.
3. Subir um servidor local com `python -m http.server 8123`.
4. Validar a página.
5. Se precisar atualizar a base, rodar `python scripts\prepare_map_data.py`.

## Próximas evoluções mais prováveis

- busca por cliente
- filtro por cidade ou município
- refinamento de precisão geográfica
- atualização automatizada da base a partir do Bitrix24
- redução adicional do peso da camada de densidade

## Cuidados para não perder contexto

- não remover o snapshot `data/source/clientes_por_etapa_comercial.json` sem ter uma nova estratégia de distribuição
- não trocar a estrutura das chaves das categorias sem atualizar também o frontend
- não substituir a camada oficial do IBGE por dados não oficiais sem registrar essa decisão
