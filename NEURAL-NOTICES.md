Offline neural speech runtime notices

Folio's original source remains MIT licensed. The Android binary incorporates GPL-3.0 eSpeak NG components used for phonemization and is distributed under GPL-3.0 terms for the combined binary. Retain these license notices when redistributing it.

Sherpa ONNX v1.13.8: Apache-2.0. Source and native build recipes: https://github.com/k2-fsa/sherpa-onnx/tree/v1.13.8
Includes ONNX Runtime (MIT) and eSpeak NG phonemization (GPL-3.0). eSpeak source: https://github.com/espeak-ng/espeak-ng ; pinned dependency configuration is in Sherpa's source build recipes.
Kotlin stdlib, Apache Commons Compress, Commons IO: Apache-2.0.
Folio source and Android build scripts: https://github.com/flaviodefalcao/folio-livre

The Faber model is bundled in the APK for offline installation; Lessac is downloaded on demand. Models come from https://github.com/k2-fsa/sherpa-onnx/releases/tag/tts-models with pinned SHA-256 digests. Faber’s upstream model card is included as `android/app/src/main/assets/neural-licenses/FABER-MODEL-CARD.md`. Model archives are extracted without removing their notices. Faber Portuguese dataset: CC0, https://github.com/OHF-Voice/voice-datasets . Lessac English uses LJSpeech public-domain recordings; retain its model card.
