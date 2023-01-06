function getParams(query) {
  if (!query) {
    return {};
  }

  return (/^[?#]/.test(query) ? query.slice(1) : query)
    .split('&')
    .reduce((params, param) => {
      let [ key, value ] = param.split('=');
      params[key] = value ? decodeURIComponent(value.replace(/\+/g, ' ')) : '';
      return params;
    }, {});
}
const params = getParams(window.location.search);

let graph;
let eventNamesVisible = params.names;
let eventParamVisible = params.params;
let ev_messages = {};


const cboxShowParams = document.querySelector('#cbox-showparams');
cboxShowParams.checked = eventParamVisible;
cboxShowParams.addEventListener('change', (event) => {
  eventParamVisible = event.target.checked;
  graph.refresh();
  graph.renderAndKeepSelection();
})

const cboxShowNames = document.querySelector('#cbox-shownames');
cboxShowNames.checked = eventNamesVisible;
cboxShowNames.addEventListener('change', (event) => {
  eventNamesVisible = event.target.checked;
  graph.refresh();
  graph.renderAndKeepSelection();
})

function getNodeLabel(node) {
  const prefix = eventNamesVisible ? `${node.data.name}\n` : '';
  let label = node.id;

  if (node.node_type === 'entry') {
    label = `${node.data.name}`;
  }
  else if (node.node_type === 'action') {
    label = `${prefix}${node.data.actor}\n${node.data.action}`;
  }
  else if (node.node_type === 'switch') {
    label = `${prefix}${node.data.actor}\n${node.data.query}`;
  }
  else if (node.node_type === 'fork') {
    label = `${prefix}Fork`;
  }
  else if (node.node_type === 'join') {
    label = `${prefix}Join`;
  }
  else if (node.node_type === 'sub_flow') {
    label = `${prefix}${node.data.res_flowchart_name}\n<${node.data.entry_point_name}>`;
  }

  if (eventParamVisible && node.data.params) {
    let i = 0;
    let hasMore = false;
    for (const [key, value] of Object.entries(node.data.params)) {
      if (key === 'IsWaitFinish') {
        continue;
      }
      const valueStr = typeof value === 'number' ? value.toFixed(6).replace(/\.?0*$/, '') : value;
        label += `\n${key}: ${valueStr}`;
        if(key == "MessageId") {
            const dash = "\n" + "-".repeat(40) + "\n";
            const msg = ev_messages[valueStr];
            if(msg) {
                let text = msg.contents.filter(item => item.text).map(item => item.text).join("");
                label += `${dash}${text}${dash}`;
            }
        }
      i++;
    }
  }
  return label;
}

class Renderer {
  constructor() {
    this.svg = d3.select('svg');
    this.svgGroup = d3.select('svg g');

    this.nodeWhitelist = null;

    this.zoom = d3.behavior.zoom();
    this.lastZoomEventStart = null;
    this.svg.call(this.zoom.on('zoom', () => this.updateTransform()));
    this.svg.call(this.zoom.on('zoomstart', () => this.lastZoomEventStart = new Date()));

    // Reset selection on click.
    // Unfortunately we need to do some extra work to determine whether the click event is caused
    // by zooming or is a simple click.
    this.svg.on('click', () => {
      // The zoom lasted more than 100 ms, so it's likely a zoom.
      if ((new Date() - this.lastZoomEventStart) >= 100) {
        return;
      }
      this.clearSelection();
    });
  }

  getSelection() {
    const selected = d3.select('.selected');
    return selected.empty() ? -1 : parseInt(selected.attr('id').slice(1), 10);
  }

  clearSelection() {
    const selected = this.getSelection();
    if (selected !== -1) {
      const node = graph.g.node(selected);
      node.class = node.class.replace(/\bselected\b/, '');
    }
    for (const cl of ['selected', 'selected-in-edge', 'selected-out-edge', 'selected-in-edge-label', 'selected-out-edge-label']) {
      d3.selectAll('.' + cl).classed(cl, false);
    }
  }

  select(id, g) {
    this.clearSelection();
    d3.select(`#n${id}`).classed('selected', true);
    g.node(id).class += ' selected';
    g.inEdges(id).forEach((e) => {
      d3.selectAll(`.edge-${e.v}-${e.w}`).classed('selected-in-edge', true);
      d3.select(`#label-${e.name}`).classed('selected-in-edge-label', true);
    });
    g.outEdges(id).forEach((e) => {
      d3.selectAll(`.edge-${e.v}-${e.w}`).classed('selected-out-edge', true);
      d3.select(`#label-${e.name}`).classed('selected-out-edge-label', true);
    });
  }

  getElement(id) {
    const element = d3.select(`#n${id}`);
    return element.empty() ? null : element;
  }

  scrollTo(id, center=false, duration=1000) {
    const element = this.getElement(id);
    if (!element) {
      return false;
    }
    const t = d3.transform(element.attr('transform'));
    const [x, y] = t.translate;
    const scale = this.zoom.scale();
    const newY = y*-scale + (center ? (window.innerHeight/2) : 60);
    const newTranslate = [x*-scale + window.innerWidth/2, newY];
    if (duration > 0) {
      this.svg.transition().duration(duration)
        .call(this.zoom.translate(newTranslate).event);
    } else {
      this.setTranslate(newTranslate);
    }
    return true;
  }

  render(g) {
    const visibleGraph = new graphlib.Graph({ multigraph: true });
    visibleGraph.setGraph({});
    visibleGraph.graph().transition = (selection) => {
      return selection.transition().duration(500);
    };

    for (const v of g.nodes()) {
      if (!this.nodeWhitelist || this.nodeWhitelist.has(v)) {
        visibleGraph.setNode(v, g.node(v));
      }
    }
    for (const e of g.edges()) {
      if (!this.nodeWhitelist || this.nodeWhitelist.has(e.v)) {
        visibleGraph.setEdge(e, g.edge(e));
      }
    }

    const render = dagreD3.render();
    this.svgGroup.call(render, visibleGraph);
    this.svgGroup.selectAll('.node')
      .on('click', (id) => {
        this.select(id, g);
        d3.event.stopPropagation();
      });
  }

  setScale(scale) { this.zoom.scale(scale); this.updateTransform(); }
  setTranslate(translate) { this.zoom.translate(translate); this.updateTransform(); }

  updateTransform() {
    this.svgGroup.attr('transform', `translate(${this.zoom.translate()})scale(${this.zoom.scale()})`);
  }
}

class Graph {
  constructor() {
    this.g = null;
    this.data = null;
    this.renderer = new Renderer();
    this.persistentWhitelist = null;
  }

  update(data) {
    this.data = data;
    this.g = new graphlib.Graph({ multigraph: true });
    this.g.setGraph({});

    for (const entry of data) {
      if (entry.type === 'node') {
        this.g.setNode(entry.id, {
          label: getNodeLabel(entry),
          'class': entry.node_type,
          id: `n${entry.id}`,
          idx: entry.id,
          name: entry.data.name,
        });
      } else if (entry.type === 'edge') {
        this.g.setEdge(entry.source, entry.target, {
          labelType: 'html',
          label: `<span id="label-edge-${entry.source}-${entry.target}-${entry.data.value}">${entry.data.value == null ? '' : entry.data.value}</span>`,
          'class': `edge-${entry.source}-${entry.target}`,
          virtual: !!entry.data.virtual,
        }, `edge-${entry.source}-${entry.target}-${entry.data.value}`);
      }
    }
  }

  refresh() {
    if (this.data && Object.keys(this.data).length > 0) {
      this.update(this.data);
    }
  }

  render() {
    if (this.persistentWhitelist) {
      this.renderer.nodeWhitelist = new Set(this.g.nodes()
        .map(idx => this.g.node(idx))
        .filter(node => this.persistentWhitelist.has(node.name))
        .map(node => node.idx.toString())
      );
    } else {
      this.renderer.nodeWhitelist = null;
    }

    this.renderer.render(this.g);
  }

  renderAndKeepSelection() {
    const selection = this.renderer.getSelection();
    this.render();
    this.renderer.select(selection);
  }

  renderOnlyConnected(v, scroll=true) {
    const selected = this.renderer.getSelection();
    this.persistentWhitelist = this.findNodeComponent(v);
    this.render();
    if (!scroll)
      return;
    if (v != null) {
      setTimeout(() => this.renderer.scrollTo(v), 500);
    } else if (selected !== -1) {
      setTimeout(() => this.renderer.scrollTo(selected), 500);
    }
  }

  /// Returns a set of connected events: {"Event123", "Event125", "EntryPoint", ...}
  findNodeComponent(v) {
    const components = graphlib.alg.components(this.g);
    const c = components.find((component) => component.includes(v));
    if (!c) {
      return null;
    }
    return new Set(c.map(idx => this.g.node(idx).name));
  }
}

graph = new Graph();

document.body.addEventListener('keydown', (event) => {
  const key = event.key; // "ArrowRight", "ArrowLeft", "ArrowUp", or "ArrowDown"

  if (key === 'Escape') {
    graph.renderer.clearSelection();
    return;
  }

  // Handle zoom
  if (event.ctrlKey) {
    let scaleMultiplier = 1;
    if (key === 'ArrowUp')
      scaleMultiplier = 1.1;
    else if (key === 'ArrowDown')
      scaleMultiplier = 0.9;
    graph.renderer.setScale(graph.renderer.zoom.scale() * scaleMultiplier);
    if (scaleMultiplier !== 1)
      return;
  }

  // Handle translate / navigation
  const selected = graph.renderer.getSelection();
  if (selected === -1) {
    let vDirection = 0;
    let hDirection = 0;
    switch (key) {
      case 'ArrowUp':
        vDirection = 1;
        break;
      case 'ArrowDown':
        vDirection = -1;
        break;
      case 'ArrowLeft':
        hDirection = 1;
        break;
      case 'ArrowRight':
        hDirection = -1;
        break;
    }
    const [x, y] = graph.renderer.zoom.translate();
    graph.renderer.setTranslate([x + 100 * hDirection, y + 100 * vDirection]);
    return;
  }
  if (key === 'ArrowUp' || key === 'ArrowDown') {
    const nodes = key === 'ArrowUp' ? graph.g.predecessors(selected) : graph.g.successors(selected);
    if (nodes.length > 0) {
      graph.renderer.scrollTo(nodes[0], true, 500);
      graph.renderer.select(nodes[0], graph.g);
    }
  }
});


function select(id) {
  if (graph.persistentWhitelist) {
    graph.renderOnlyConnected(id.toString());
    graph.renderer.select(id, graph.g);
  } else {
    graph.renderer.setScale(1);
    graph.renderer.select(id, graph.g);
    graph.renderer.scrollTo(id);
  }
}

function unique(value, index, self) {
  return self.indexOf(value) === index;
}

async function get_messages(data) {
    // Get unique list of message files
    const files = data.filter(entry => entry.type == 'node')
          .filter(node => node.data)
          .filter(node => node.data.params)
          .filter(node => node.data.params.MessageId)
          .map(node => node.data.params.MessageId)
          .map(msgid => msgid.split(":")[0])
          .filter(unique);
    // Fetch all message files and add into 
    await Promise.all(files.map(file => fetch(`msg/${file}.json`).then(res => res.json())))
        .then(values =>
            values.forEach(value => { ev_messages = Object.assign(ev_messages, value); })
        );
}

function load(cb) {

    fetch(params.data).then((res) => res.json()).then(async (data) => {
    if (!data) {
      return;
    }

    await get_messages(data);

    graph.update(data);
    graph.render();
    const selected = graph.renderer.getSelection();
    if (selected !== -1 && !isDeleting) {
      graph.renderer.scrollTo(selected);
    }
    if (cb) {
      cb(data);
    }
    if (params.entry) {
      const entry = data.find(e => e.node_type === 'entry' && e.data.name === params.entry);
      if (entry) {
        graph.renderOnlyConnected(entry.id.toString(), !params.node);
      }
    }
    if (params.node) {
      const node = data.find(e => e.type === 'node' && e.data.name === params.node);
      if (node) {
        graph.renderer.select(node.id.toString(), graph.g);
        setTimeout(() => graph.renderer.scrollTo(node.id.toString(), true), 501);
      }
    } else if (!params.entry) {
      graph.renderer.select('-1000', graph.g);
      graph.renderer.scrollTo('-1000');
    }
  });
}

load();
