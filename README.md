# Folio Livre

Leitor de EPUB para Android. Importe livros, leia, ouça a narração e guarde suas anotações. A busca no Anna’s Archive mostra apenas links gratuitos. Não precisa configurar chaves nem assinatura.

## Baixar e instalar

**[Baixar Folio Livre para Android (.apk)](https://github.com/flaviodefalcao/folio-livre/releases/download/v1.0.1/Folio-Livre-v1.0.1.apk)**

1. Abra o link acima no celular e baixe o APK.
2. Toque no arquivo baixado. Se o Android pedir, permita a instalação pelo navegador que você usou.
3. Abra **Folio Livre** e toque em **Adicionar EPUB** para importar um livro, ou em **Buscar** para procurar no catálogo.

Android 7 ou mais recente, em aparelho ARM de 32 ou 64 bits. Mantenha o Android System WebView atualizado. Não precisa estar na mesma rede Wi-Fi do computador.

![QR code para baixar o APK](docs/baixar-android.png)

## Como usar

- **Biblioteca:** seus EPUBs, favoritos, coleções e progresso de leitura.
- **Leitor:** tamanho de texto, tema claro ou escuro, marcações, notas, dicionário e leitura em voz alta.
- **Buscar:** pesquise título ou autor, abra **Ver links gratuitos** e escolha um link. O site pode pedir verificação ou impor uma espera. Ao concluir o download no app, o EPUB é importado para a biblioteca.
- **Estatísticas:** acompanhe seu tempo e suas metas de leitura.

Os livros importados ficam no aparelho e podem ser lidos offline. A busca e os downloads precisam de internet e dependem da disponibilidade do site. Você também pode importar um EPUB já baixado pelo navegador. Algumas vozes precisam de internet ou de um download inicial.

## Ouvir os livros e baixar vozes

1. Abra um livro e toque no **ícone de alto-falante**, ao lado do título do capítulo. Em tela cheia, toque no centro da página para mostrar os controles.
2. No player, toque em **Voz e idioma**.
3. Role até **Vozes neurais offline · gratuitas**. Para português, toque em **Instalar voz** ao lado de **Faber · português do Brasil**. Ela já vem no APK e pode ser instalada sem internet. Para inglês, toque em **Baixar voz** na **Lessac · inglês americano**.
4. Aguarde a instalação e a verificação. O app seleciona a voz ao terminar. Se ela já estiver instalada, toque em **Usar voz**.
5. Feche as opções no **X** e toque no botão **▶ Ouvir**.

A Faber já vem incluída no app a partir da versão **1.0.1**. A Lessac precisa de um download de cerca de **68 MB**. Deixe pelo menos **300 MB livres** no celular durante a instalação. As duas vozes funcionam offline depois de instaladas, sem chave de API.

Comece com velocidade **1×** e ajuste ao seu gosto. [Veja o guia de voz](docs/VOZES.md) para configurar outras vozes, ouvir um trecho e resolver problemas.

## Se a busca não abrir

Na janela do catálogo, use **Outro endereço** para tentar um domínio alternativo ou **Navegador** para abrir a busca no navegador do celular. A versão 1.0.1 também tenta outros endereços quando a conexão falha. Conclua as verificações que o próprio site apresentar.

Se você baixou um EPUB pelo navegador, volte à biblioteca e use **Adicionar EPUB** para importá-lo. Atualize pelo link acima se essas opções ainda não aparecem no seu app.

Esta edição tem instalação própria: pode coexistir com o Folio original. Ela não importa automaticamente a biblioteca do outro app. Para atualizar o Folio Livre, instale o novo APK sem desinstalar o anterior.

O código e o APK não incluem chaves de serviços, credenciais pessoais ou material privado de assinatura. Entrelinhas, conversa com IA e downloads premium foram removidos.

[Código do Folio original](https://github.com/flaviodefalcao/folio) · [Compilar e verificar](docs/DESENVOLVIMENTO.md) · [Licenças da narração](NEURAL-NOTICES.md)
