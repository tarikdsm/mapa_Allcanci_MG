# Mapa Allcanci MG

Mapa interativo em GitHub Pages para visualizar clientes da Allcanci em Minas Gerais por etapa comercial.

## Estrutura

- `index.html`: página principal
- `styles.css`: estilos da interface
- `app.js`: lógica do mapa e das camadas
- `data/clients.geojson`: clientes geocodificados
- `data/minas-gerais.geojson`: contorno do estado
- `scripts/prepare_map_data.py`: script para regenerar a base

## Regenerar os dados

No workspace atual, o script lê a origem em `../Planilhas_Clientes/clientes_por_etapa_comercial.json`, copia esse arquivo para `data/source/` e geocodifica bairro + cidade em Minas Gerais.

```bash
python scripts/prepare_map_data.py
```
