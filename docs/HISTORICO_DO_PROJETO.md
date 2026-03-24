# Histórico do Projeto

## Objetivo deste documento

Registrar o que já foi feito no projeto, inclusive etapas anteriores ao repositório do mapa, para preservar contexto técnico e de negócio.

## Linha do tempo consolidada

### 2026-03-23 - Preparação da base Bitrix24 fora deste repositório

No workspace principal do projeto, foram produzidos artefatos de apoio ao CRM/Bitrix24:

- consolidação local da documentação de API do Bitrix24
- diagnóstico estrutural do CRM
- validação das entidades e das etapas comerciais
- geração da planilha e do JSON de clientes por etapa comercial

Esses artefatos ficaram fora deste repositório, em diretórios do projeto principal, principalmente:

- `C:\Projetos\API Bitrix\API_Bitrix\`
- `C:\Projetos\API Bitrix\Planilhas_Clientes\`

Resultado prático para este repositório:

- passou a existir uma base tratada de clientes com os campos mínimos necessários para mapear nome, rua+número, bairro e cidade

### 2026-03-23 - Criação do mapa interativo

Foi criado o site estático para GitHub Pages com:

- mapa de Minas Gerais
- sidebar lateral
- toggles independentes por camada comercial
- marcadores com ícone de escola
- clusterização para preservar legibilidade
- ingestão do JSON `clientes_por_etapa_comercial.json`

Categorias publicadas:

- `Clientes`
- `Assinatura de Contrato`
- `Licitação - Publicação`
- `Fechamento`

### 2026-03-23 - Publicação inicial no GitHub Pages

O repositório foi configurado para publicar a branch `main` diretamente no GitHub Pages.

Commits relevantes:

- `b909f50` - criação do mapa interativo
- `f68d84c` - configuração inicial de workflow de Pages
- `56bac85` - remoção do workflow não utilizado, mantendo publicação direta pela branch

### 2026-03-23 - Correções de consistência e qualidade dos dados

Foi validado que:

- a base publicada contém apenas clientes com nome, rua+número, bairro e cidade válidos
- a geocodificação aproximada passou a usar cache local
- o mapa ficou consistente com o snapshot tratado de clientes

### 2026-03-23 - Inclusão da camada oficial de densidade populacional

Foi adicionada uma camada especial com comportamento diferente das camadas de clientes:

- toggle próprio
- carregamento sob demanda
- legenda de escala
- popup com dados demográficos
- colorização do estado por município

Fontes utilizadas:

- malha municipal oficial do IBGE para Minas Gerais
- SIDRA/IBGE, tabela `4714`, Censo `2022`

Commit principal dessa entrega:

- `3544d4f` - inclusão da camada de densidade populacional oficial do IBGE

### 2026-03-23 - Consolidação da documentação do projeto

Foi criada uma base documental para continuidade em outro computador, incluindo:

- README principal revisado
- arquitetura
- fontes e dados
- operação e deploy
- handoff para Codex
- histórico do projeto

## Estado funcional consolidado após essa fase

- projeto publicado e operacional
- base de clientes publicada no mapa
- camada oficial de densidade publicada
- documentação suficiente para continuidade sem depender do histórico do chat

## Próxima fronteira natural do projeto

- busca e filtros avançados
- atualização automatizada da base a partir do Bitrix24
- melhoria da precisão geográfica dos clientes
- otimização do peso da camada de densidade
