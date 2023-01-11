#!/usr/bin/env python

import yaml
import glob
import json
import os
import sys
from pathlib import Path

if len(sys.argv) < 2:
    print("Usage: gen_messages.py path-to-messages")
    sys.exit(1)

datafiles = sys.argv[1]

dirs = ['EventFlowMsg', 'DemoMsg']

for dir in dirs:
    (Path("msg") / dir).mkdir(parents=True, exist_ok=True)
    for file in (Path(datafiles) / "Message" / "Msg_USen.product.sarc" / dir).glob("*.msyt"):
        print(file)
        data = {}
        with file.open('r') as f:
            bdata = yaml.load(f, Loader=yaml.FullLoader)
            base = Path(file.parent.name) / file.stem
            for key, entry in bdata["entries"].items():
                msgid = f"{base}:{key}"
                data[msgid] = entry
        json.dump(data, open(f"msg/{base}.json","w"))
