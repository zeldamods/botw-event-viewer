fetch('d/__INDEX__.json').then((data) => data.json()).then((data) => {
  let list = [];
  for (const entry of data) {
    const {name, entry_points, description} = entry;
    list.push(`<li><a target="_blank" href="viewer.html?data=/d/${name}.json&params=1">${name}</a> ${description ? '(' + description + ')' : ''}<ul>`);
    for (const entry_point of entry.entry_points) {
      list.push(`<li>entry point: <a target="_blank" href="viewer.html?data=/d/${name}.json&params=1&entry=${entry_point}">${entry_point}</a></li>`);
    }
    list.push('</ul></li>');
  }
  document.querySelector('#list').innerHTML = list.join('');
});
