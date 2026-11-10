// anaxi watch · the board (@stages): a column per lifecycle stage, derived from the marks, never set by hand. Cards
// carry the depth bar and the built mark, and call out what needs attention: ⚑ a decision waiting on a person,
// ◆ a complex item (risk 6+ or the top target), the drift. Read-only, like the rest of the reader.
window.anaxiBoard = (M, h) => {
  const MAIN = ['idea', 'designing', 'ready', 'building', 'built', 'drifting'], FOLDED = ['parked', 'superseded', 'retired'];
  const WORD = { idea: 'idea', designing: 'designing', ready: 'ready to build', building: 'building', built: 'built', drifting: 'drifting',
    parked: 'parked (later)', superseded: 'superseded', retired: 'retired' };
  const top = M.items.filter((it) => !it.parent), kids = (it) => M.items.filter((c) => c.parent === it.key);
  const inStage = (s) => [...top, ...M.inactive.filter((it) => !it.parent)].filter((it) => it.stage === s);
  const person = (it) => (it.open || []).filter((q) => q.decideBy === 'person').length;
  const card = (it) => {
    const p = person(it), hl = it.highlights || [];
    return `<div class="card ${it.status === 'blocked' ? 'blocked' : ''}" ${h.go(h.itemHash(it))} data-peek="${h.esc(it.key)}">
      <div class="ct">${h.icon(it)} <b>${h.esc(h.name(it))}</b> ${h.builtTag(it)}</div><div class="cs">${h.esc(it.title)}</div>
      <div class="cb">${h.bars(it)} <span class="cd">${h.esc(it.shown || '—')} → ${h.esc(it.target || '—')}</span></div>
      <div class="ch">${p ? `<span class="hl person" title="${p} open question${p > 1 ? 's' : ''} a person decides">⚑ ${p}</span>` : ''}${hl.includes('complex') ? '<span class="hl complex" title="risk 6+ or the top target: worth a closer look">◆ complex</span>' : ''}${hl.includes('drift') ? '<span class="hl drift" title="the design changed after the code (N23)">↯ drift</span>' : ''}${kids(it).length ? `<span class="hl">${kids(it).length} inside</span>` : ''}</div></div>`;
  };
  const S = M.stages || { counts: {}, runway: 0, person: 0, complex: 0 };
  const line = [...MAIN, ...FOLDED].filter((s) => S.counts[s]).map((s) => `${S.counts[s]} ${s}`).join(' · ');
  return `<div class="board"><div class="crumb">${h.crumbs([{ label: M.root, hash: '#/' }, { label: 'board' }])}</div><h1>Board</h1>
    <p class="legend">${h.esc(line)} · runway <b>${S.runway}</b> (ready, not built)${S.person ? ` · ⚑ ${S.person} for a person` : ''}${S.complex ? ` · ◆ ${S.complex} complex` : ''}. Stages come from the marks (depth, gate, built, focus); change the docs to move a card.${S.runway === 0 && S.counts.designing ? ' <b>Nothing is ready to build while items are designing: builders will wait.</b>' : ''}</p>
    <div class="cols">${MAIN.map((s) => `<section class="col"><h3>${WORD[s]} <span>${inStage(s).length}</span></h3>${inStage(s).map(card).join('') || '<p class="t">—</p>'}</section>`).join('')}</div>
    ${FOLDED.some((s) => inStage(s).length) ? `<details class="folded"><summary>${FOLDED.filter((s) => inStage(s).length).map((s) => `${inStage(s).length} ${WORD[s]}`).join(' · ')}</summary><div class="cols">${FOLDED.filter((s) => inStage(s).length).map((s) => `<section class="col"><h3>${WORD[s]}</h3>${inStage(s).map(card).join('')}</section>`).join('')}</div></details>` : ''}</div>`;
};
