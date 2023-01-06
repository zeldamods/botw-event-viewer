#!/usr/bin/env python

import yaml
import glob
import json
import os
import sys

if len(sys.argv) < 2:
    print("Usage: gen_messages.py path-to-messages")
    sys.exit(1)

datafiles = sys.argv[1]


def u_constrt(loader, node):
    return node.value
def io_constrt(loader, node):
    value = loader.construct_mapping(node)
    return value
def list_constrt(loader, node):
    value = loader.construct_mapping(node)
    return value
def obj_constrt(loader, node):
    value = loader.construct_mapping(node)
    return value
def str_constrt(loader, node):
    return node.value
def vec3_constrt(loader, node):
    return node.value
def color_constrt(loader, node):
    return node.value
yaml.add_constructor('!u', u_constrt)
yaml.add_constructor('!io', io_constrt)
yaml.add_constructor('!color', color_constrt)
yaml.add_constructor('!list', list_constrt)
yaml.add_constructor('!obj', obj_constrt)
yaml.add_constructor('!str64', str_constrt)
yaml.add_constructor('!str32', str_constrt)
yaml.add_constructor('!str256', str_constrt)
yaml.add_constructor('!vec3', vec3_constrt)

dirs = ['EventFlowMsg', 'DemoMsg']

for dir in ['EventFlowMsg', 'DemoMsg']:
    if not os.path.exists(f"msg/{dir}"):
        os.makedirs(f"msg/{dir}", mode=0o755)
    for file in glob.glob(f'{datafiles}/Message/Msg_USen.product.sarc/{dir}/*.msyt'):
        print(file)
        data = {}
        with open(file,'r') as f:
            bdata = yaml.load(f, Loader=yaml.FullLoader)
            base = file.replace(f'{datafiles}/Message/Msg_USen.product.sarc/','').replace('.msyt','')
            for key, entry in bdata['entries'].items():
                msgid = f"{base}:{key}"
                data[msgid] = entry
        json.dump(data, open(f"msg/{base}.json","w"))
