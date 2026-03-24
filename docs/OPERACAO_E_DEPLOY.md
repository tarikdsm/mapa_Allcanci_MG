# Operação e Deploy

## Pré-requisitos

- `git`
- `Python 3.11+`
- `pyshp`
- autenticação no GitHub, caso vá publicar

Instalação da dependência:

```powershell
pip install pyshp
```

## Execução local

Na raiz do repositório:

```powershell
python -m http.server 8123
```

Abrir:

```text
http://127.0.0.1:8123/
```

## Rebuild dos dados

Comando:

```powershell
python scripts\prepare_map_data.py
```

Esse comando:

- atualiza ou reaproveita o snapshot de clientes
- baixa a malha oficial do Brasil e dos municípios (IBGE) se necessário
- baixa os indicadores SIDRA do IBGE
- usa o cache de geocodificação já salvo
- gera os arquivos finais do site

## Validações recomendadas

Depois de alterar código ou dados:

```powershell
python -m py_compile scripts\prepare_map_data.py
node --check app.js
python -m http.server 8123
```

Checklist de revisão:

- página abre sem erro
- toggles ligam e desligam corretamente
- legenda da densidade aparece apenas quando a camada está ativa
- clusters continuam visíveis e legíveis
- popups de clientes e densidade abrem corretamente

## Deploy para produção

Fluxo atual:

1. Validar alterações localmente.
2. Fazer commit.
3. Fazer push para `main`.
4. Aguardar publicação do GitHub Pages.

Exemplo:

```powershell
git add .
git commit -m "Sua mensagem"
git push origin main
```

## GitHub Pages

Configuração atual:

- branch de publicação: `main`
- path de publicação: `/`
- tipo: `legacy`
- URL pública: [tarikdsm.github.io/mapa_Allcanci_MG](https://tarikdsm.github.io/mapa_Allcanci_MG/)

## Problemas comuns

### A página abre, mas não aparece nada no mapa

Verificar:

- se os arquivos em `data/` existem
- se o navegador está carregando via servidor HTTP, não por arquivo local
- se há erro de JavaScript no console

### O rebuild tenta usar um arquivo externo que não existe

Isso não deve bloquear o projeto. O script já tem fallback para `data/source/clientes_por_etapa_comercial.json`.

### O arquivo de densidade ficou pesado

O pipeline já simplifica as geometrias, mas a camada ainda é grande. Se necessário no futuro, avaliar:

- simplificação mais agressiva
- tiles vetoriais
- carregamento por zoom ou recorte
