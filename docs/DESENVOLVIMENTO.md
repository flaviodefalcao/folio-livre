# Compilar o Folio Livre

Use Node.js 22 ou mais recente e Python 3. Em macOS ou Linux:

```sh
npm ci
bash scripts/bootstrap-android.sh
npm run android:build
```

O APK fica em `release/Folio-Livre-v1.0.0.apk`. O primeiro build cria uma chave de assinatura local em `.toolchain`, ignorada pelo Git. Guarde essa pasta em um backup privado para assinar suas próprias atualizações. Uma chave recém-criada não atualiza o APK oficial.

Para abrir a prévia web e rodar os testes:

```sh
npm run dev
npm run build
npx playwright install chromium
npm test
```

Para os testes nativos, após preparar o Android:

```sh
source scripts/android-env.sh
cd android
./gradlew testDebugUnitTest
```

O app usa o identificador `org.folio.livre`. Leitura, anotações, estatísticas e narração foram preservadas do Folio. As integrações de IA, o conteúdo do Entrelinhas, a fila de curadoria e o protocolo premium do catálogo foram removidos do código desta edição.

As páginas externas abrem em uma janela isolada. A busca gratuita respeita as verificações do site e não garante a disponibilidade de cada livro. Os downloads continuam limitados a HTTPS, com validação de destino e do arquivo EPUB.

O código original é MIT. O APK combina componentes de narração com termos GPL-3.0; consulte `NEURAL-NOTICES.md`. As bibliotecas e receitas de compilação correspondentes estão nos links desse arquivo.
