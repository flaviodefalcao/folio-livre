#!/usr/bin/env python3
"""Check the exact staged files without printing possible credential values."""
from pathlib import Path
import re
import subprocess
import sys

paths = subprocess.check_output(['git', 'diff', '--cached', '--name-only', '-z', '--diff-filter=ACMR']).decode().split('\0')
patterns = {
    'service credential': re.compile(rb'\b(?:sk-(?:proj-)?[A-Za-z0-9_-]{32,}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|AKIA[A-Z0-9]{16})\b'),
    'private key': re.compile(rb'-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----'),
}
failures = []
for name in filter(None, paths):
    p = Path(name)
    if p.is_symlink() or any(part in {'.toolchain', '.env', 'node_modules', 'research', 'release'} for part in p.parts) or p.suffix in {'.jks', '.keystore', '.p12', '.pfx', '.pem', '.key', '.tar', '.bz2', '.aar', '.apk'}:
        failures.append((name, 'private or local-only file'))
        continue
    data = subprocess.check_output(['git', 'show', ':' + name])
    failures.extend((name, label) for label, pattern in patterns.items() if pattern.search(data))
for name, label in failures:
    print(f'BLOCKED: {name}: {label}')
print(f'Checked {len(list(filter(None, paths)))} staged files; findings: {len(failures)}')
sys.exit(bool(failures))
