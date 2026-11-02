# Verificação da versão 1.0.0

Verificado em 2 de novembro de 2026:

- 22 testes web aprovados: biblioteca, importação e validação de EPUB, narração, navegação, estatísticas e fluxo gratuito do catálogo.
- 5 testes nativos aprovados: filtro de links gratuitos, desafios de verificação do site, restrições de URL e remoção dos métodos de IA, premium e Entrelinhas.
- Build Android de produção concluído e assinatura APK v2 verificada.
- Pacote `org.folio.livre`, versão `1.0.0`, Android 7 ou mais recente, ARM de 32 ou 64 bits.
- APK inspecionado para confirmar a ausência do endpoint de IA, da configuração de chave premium e dos arquivos do Entrelinhas.

O teste do fluxo de download usa respostas controladas para o transporte nativo e um EPUB real. A importação, a validação, a persistência e a leitura executam o código do app. Os links gratuitos e as verificações do Anna’s Archive podem mudar. Esta versão não foi testada em um telefone físico nesta sessão.

O repositório começa com histórico novo. A revisão dos arquivos preparados para o commit usa `python3 scripts/check-public-source.py`; material de assinatura, configurações locais, bibliotecas pessoais e arquivos de ambiente ficam fora do Git.
