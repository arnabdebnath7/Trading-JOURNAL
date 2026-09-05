#!/usr/bin/env python3
"""Copy TradeVault icons into a Capacitor Android project. Usage: copy_icons.py <android-dir>"""
import os, shutil, sys

android = sys.argv[1] if len(sys.argv) > 1 else 'android'
here = os.path.dirname(os.path.abspath(__file__))
res = os.path.join(android, 'app', 'src', 'main', 'res')

for folder in os.listdir(here):
    src_dir = os.path.join(here, folder)
    if not os.path.isdir(src_dir):
        continue
    dst_dir = os.path.join(res, folder)
    os.makedirs(dst_dir, exist_ok=True)
    for f in os.listdir(src_dir):
        shutil.copy2(os.path.join(src_dir, f), os.path.join(dst_dir, f))
        print('copied', os.path.join(dst_dir, f))
