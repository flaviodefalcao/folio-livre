#!/usr/bin/env python3
"""Fetch the public, pinned Faber model for offline installation from the APK."""
from pathlib import Path
import hashlib
import urllib.request

root=Path(__file__).resolve().parent.parent
name='vits-piper-pt_BR-faber-medium.tar.bz2'
path=root/'android/app/src/main/assets/neural-models'/name
expected='7add3f923ad6bc25ca8a192805fd1a64d1b3893e4611c4a9719545a825039a83'
if not path.exists() or hashlib.sha256(path.read_bytes()).hexdigest()!=expected:
    path.parent.mkdir(parents=True,exist_ok=True)
    temporary=path.with_suffix('.download')
    urllib.request.urlretrieve('https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/'+name,temporary)
    if hashlib.sha256(temporary.read_bytes()).hexdigest()!=expected:
        temporary.unlink()
        raise SystemExit('Faber model checksum mismatch')
    temporary.replace(path)
print('Bundled Faber model verified')
