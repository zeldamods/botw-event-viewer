#!/usr/bin/env python3
import argparse
import csv
import evfl
import evfl.repr_util
import json
from pathlib import Path
import sys
import typing

def die(s: str) -> None:
    sys.stderr.write(s+'\n')
    sys.exit(1)

def get_bfevfl_paths(resource_csv_path: Path) -> list:
    paths = []
    resources = csv.DictReader(resource_csv_path.open('r'))
    for x in resources:
        h, name, full_path = x['Hash'], x['Name'], x['Full path']
        if not name.endswith('.bfevfl'):
            continue
        paths.append(full_path.replace('.beventpack', '.sbeventpack'))
    return paths

def get_demo_descriptions(demo_listp: Path) -> typing.Dict[str, str]:
    d = dict()
    with demo_listp.open('r') as f:
        for line in f:
            if not line.startswith('| Demo'):
                continue
            columns = [x.strip() for x in line[2:].split('||')]
            name, desc, desc_jp, group, group_jp = columns
            d[name] = f'{group} - {desc} ({group_jp} - {desc_jp})'
    return d

def get_actor_names(actor_namesp: Path) -> typing.Dict[str, str]:
    with actor_namesp.open('r') as f:
        return json.load(f)

class IndexEntry(typing.NamedTuple):
    name: str
    entry_points: typing.List[str]
    description: str = ''

def main(content_dir: Path, resource_csv_path: Path, dest_dir: Path, demo_listp: typing.Optional[Path], actor_namesp: typing.Optional[Path]) -> None:
    if not content_dir.is_dir() or not dest_dir.is_dir():
        die('content_dir and dest_dir must be a directory')
    if not resource_csv_path.is_file():
        die('resource_csv must be a file')

    bfevfl_paths = get_bfevfl_paths(resource_csv_path)
    demo_descriptions = get_demo_descriptions(demo_listp) if demo_listp else dict()
    actor_names = get_actor_names(actor_namesp) if actor_namesp else dict()
    index: typing.List[IndexEntry] = []

    for bfevfl_p in bfevfl_paths:
        flow = evfl.EventFlow()
        flow.read((content_dir / bfevfl_p).open('rb').read())
        data = evfl.repr_util.generate_flowchart_graph(flow)

        event_flow_name = bfevfl_p.split('EventFlow/')[1].replace('.bfevfl', '')
        json_file_name = event_flow_name + '.json'
        with (dest_dir/json_file_name).open('w') as f:
            json.dump(data, f, default=lambda x: str(x))
            description = demo_descriptions.get(event_flow_name, '')
            if not description:
                description = actor_names.get(event_flow_name, '')
            entry_points = [ep.name for ep in flow.flowchart.entry_points]
            index.append(
                IndexEntry(name=event_flow_name, description=description, entry_points=entry_points))

    with (dest_dir/'__INDEX__.json').open('w') as f:
        json.dump(sorted([x._asdict() for x in index], key=lambda x: x['name']), f)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--content-dir', type=Path, required=True)
    parser.add_argument('--resource-csv', type=Path, required=True)
    parser.add_argument('--demo-list', type=Path, required=False)
    parser.add_argument('--dest-dir', type=Path, required=True)
    parser.add_argument('--actor-names', type=Path, required=False)
    args = parser.parse_args()
    main(args.content_dir, args.resource_csv, args.dest_dir, args.demo_list, args.actor_names)
