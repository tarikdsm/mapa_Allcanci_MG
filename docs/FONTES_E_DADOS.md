# Fontes e Dados

## Resumo

O projeto combina duas famílias de dados:

- dados comerciais de clientes, originados do fluxo Bitrix24 do projeto principal
- dados geográficos e demográficos oficiais do IBGE

## Snapshot de clientes

Arquivo principal consumido:

- `data/source/clientes_por_etapa_comercial.json`

Origem preferencial de atualização:

- `../Planilhas_Clientes/clientes_por_etapa_comercial.json`

Regra do script:

- se o arquivo externo existir, ele é copiado para `data/source/`
- se não existir, o projeto continua funcionando com o snapshot versionado no próprio repositório

## Estrutura do JSON de clientes

Estrutura de alto nível:

```json
{
  "generated_at": "2026-03-23T22:47:10.138629+00:00",
  "criteria": "Somente clientes com nome, rua+número, bairro e cidade preenchidos.",
  "sheets": {
    "Concluído": [],
    "Assinatura de Contrato": [],
    "Licitação/Publicação": [],
    "Fechamento": [],
    "Negociação": []
  }
}
```

Estrutura de cada linha:

```json
{
  "name": "Nome do cliente",
  "street_number": "Rua e número",
  "neighborhood": "Bairro",
  "city": "Cidade",
  "company_id": 123,
  "deal_ids": [456, 789]
}
```

## Snapshot atualmente publicado

Última geração identificada:

- `2026-03-23T23:57:15Z`

Totais atuais publicados no mapa:

- `Clientes`: `420`
- `Assinatura de Contrato`: `10`
- `Licitação - Publicação`: `12`
- `Fechamento`: `209`
- `Total`: `651`

Registros ignorados no build atual:

- `0`

## Geocodificação

Fonte:

- `Nominatim / OpenStreetMap`

Cache local:

- `data/source/neighborhood_geocode_cache.json`

Chave lógica do cache:

- `bairro|cidade|uf` (UF opcional no snapshot)

Objetivo:

- evitar chamadas repetidas
- manter builds reprodutíveis e mais rápidos

## Dados oficiais do IBGE

### Contorno nacional

Arquivo gerado:

- `data/brasil.geojson`

Fonte:

- malha de país (Brasil) via serviço público do IBGE

### Densidade demográfica municipal

Arquivo gerado:

- `data/municipal-density-ibge.geojson`

Fontes oficiais:

- malha municipal Brasil 2022 do IBGE
- SIDRA/IBGE, tabela `4714`, Censo Demográfico `2022`

Indicadores usados:

- população residente
- área territorial
- densidade demográfica

Metadados atuais da camada:

- municípios: `853`
- densidade mínima: `1.21`
- densidade máxima: `6988.18`
- maior população municipal no snapshot: `2315560`
- maior área municipal no snapshot: `10727.097 km²`

## Arquivos gerados pelo pipeline

- `data/clients.geojson`
- `data/brasil.geojson`
- `data/municipal-density-ibge.geojson`
- `data/build-report.json`

## O que é versionado e o que é apenas cache

Versionado:

- snapshot de clientes em `data/source/clientes_por_etapa_comercial.json`
- cache de geocodificação
- GeoJSONs públicos consumidos pelo site

Não versionado:

- `data/source/BR_Municipios_2022.zip`
- `data/source/BR_Municipios_2022/`

Esses arquivos brutos do shapefile do IBGE são baixados automaticamente e ignorados no Git.
