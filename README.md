# DialogoGemini
# Base de Conhecimento: DialogaGemini (Fonte de Dados Técnicos)

## 2\. Visão Geral do Projeto

* **O que é:** O DialogaGemini é um aplicativo de chat com IA, projetado para ser fluido, controlável e personalizável.
* **Objetivo Principal:** Dar ao usuário controle total sobre:

  * O contexto da conversa.
  * A personalidade do assistente.
  * O gerenciamento dos históricos de chat.

* **Foco:** Usabilidade em dispositivos móveis.
* **Tecnologia:** Utiliza a API do Google Gemini.
* **Requisito:** É necessária uma chave de API, que pode ser obtida no portal `https://aistudio.google.com/app/apikey`.

## 3\. Detalhamento das Funcionalidades

### 3.1. Área Principal (Cabeçalho e Rodapé)

* **Busca Inteligente (ícone 🔍):**

  * **Localização:** À esquerda do campo de prompt.
  * **Ação:** Ativa o "Modo Busca". O campo de texto passa a ser usado para localizar termos na conversa.
  * **Interface:** Os botões "1, 2, 3" são temporariamente substituídos pelos botões "Buscar" e "Limpar". Os resultados encontrados são destacados em amarelo.
  * **Desativação:** Clicar novamente no ícone da lupa `🔍` retorna ao modo de chat.

* **Níveis de Resposta (Botões 1, 2, 3):**

  * **Função:** Permitem ao usuário escolher o tamanho da resposta da IA antes de enviar o prompt.
  * **Nível 1:** Resposta mais resumida (aprox. 400-600 caracteres).
  * **Nível 2:** Resposta de tamanho médio (aprox. 1000-1400 caracteres).
  * **Nível 3:** Resposta livre, sem limite de tamanho.

* **Campo de Prompt Dinâmico:**

  * **Descrição:** A área para digitar as mensagens é um campo de texto que cresce verticalmente conforme o usuário digita.
  * **Limpar Prompt (ícone 🧹):** Um ícone de "vassoura" aparece durante a digitação para limpar o campo de texto instantaneamente.

* **Guia Inicial:**

  * **Localização:** Link no rodapé.
  * **Função:** Inicia um tour guiado pelas funcionalidades do aplicativo.

* **Slider de Velocidade:**

  * **Localização:** No rodapé.
  * **Função:** Permite ajustar a velocidade com que o texto da IA é exibido palavra por palavra na tela.

* **Assistente de Projeto (ícone ❓):**

  * **Função:** É você. Abre este chat de ajuda para tirar dúvidas sobre o projeto.

* **Nova Conversa:**

  * **Função:** Limpa a janela do chat e inicia uma nova conversa do zero.

* **Medidor de Contexto:**

  * **Localização:** Canto inferior direito.
  * **Função:** Exibe o tamanho aproximado da conversa atual em "tokens". Ajuda a monitorar o "reboque" de dados enviados à API, que pode afetar a velocidade da conversa.

### 3.2. Sidebar de Ferramentas (ícone ⚙️)

* **Instrução do Assistente (Persona):**

  * **Função:** Campo de texto para definir o comportamento base do assistente para a conversa (ex: agir como um especialista).
  * **Regra:** Instruções dadas nos primeiros prompts da conversa têm prioridade sobre esta instrução base.

* **Gravação de Acesso Rápido:**

  * **Função:** Salva a conversa atual no navegador do usuário com um nome personalizado.
  * **Uso Ideal:** Para continuar conversas rapidamente (duração de poucos dias) sem gerenciar arquivos.

* **Backup / Transferência (Arquivos):**

  * **Importar de Arquivo (.json):** Carrega um histórico de conversa a partir de um arquivo `.json` do dispositivo do usuário.
  * **Exportar para Backup (.json):** Salva a conversa atual em um arquivo `.json` na pasta de Downloads. Serve como backup completo e é portável para outros usuários ou dispositivos.
  * **Exportar para Leitura (.md):** Salva a conversa em um arquivo de texto formatado (Markdown), ideal para leitura, documentação ou conversão para PDF.

* **Configurações:**

  * **Função:** Permite ao usuário inserir ou alterar sua chave da API do Google Gemini.

* **Analisador da Conversa:**

  * **Função:** Permite ao usuário solicitar à IA que gere diferentes tipos de resumos da conversa atual. O resultado é adicionado ao final do chat.
  * **Nível 1 (Título):** Cria um título curto.
  * **Nível 2 (Tópicos):** Lista os pontos-chave.
  * **Nível 3 (Resumo Simples):** Lista os pontos-chave com uma breve descrição.
  * **Nível 4 (Resumo Detalhado):** Cria um resumo organizado em parágrafos.

## 4\. Exemplos de Perguntas e Respostas

* **P: Como eu procuro uma palavra?**

  * R: Clique no ícone de lupa `🔍`, digite o termo e clique em "Buscar".

* **P: Como apago um prompt longo que escrevi errado?**

  * R: Clique no ícone de vassoura `🧹` que aparece ao lado do campo de texto enquanto você digita.

* **P: Como salvo minha conversa?**

  * R: Use o "Acesso Rápido" na sidebar para salvar no navegador, ou "Exportar para Backup (.json)" para criar um arquivo permanente na sua pasta de Downloads. Para compartilhar como um documento, use "Exportar para Leitura (.md)".

* **P: O que significa "Medidor de Contexto"?**

  * R: Ele mede o tamanho do histórico da conversa ("reboque") enviado à IA. Um contexto grande pode deixar as respostas mais lentas. Use a lixeira `🗑️` nas mensagens para remover informações desnecessárias e manter o contexto leve.

## 5\. Principais Diferenciais do DialogaGemini

* **Controle de Resposta:** O usuário pode escolher o nível de resumo da resposta (botões 1, 2, 3) a cada prompt.
* **Gestão de Conhecimento:** Facilita salvar e nomear conversas, criando um acervo pessoal de conhecimento que pode ser consultado e continuado no futuro.
* **Otimização de Contexto:** Permite a remoção de mensagens com a lixeira `🗑️` para manter a conversa ágil e focada.
* **Análise por IA:** O "Analisador de Conversa" na sidebar pode gerar resumos automáticos em vários níveis, facilitando a revisão de conversas longas.
