'use strict';
/*
 * Helpers for figure files. A figure file exports (C, h) => ({ 'entry id': [figure, ...] }),
 * C being the game's constants and h what this file returns.
 */
module.exports = C => {
    const n = v => (typeof v === 'number' && Math.abs(v) >= 10000 ? v.toLocaleString('en-US') : String(v));
    const seq = (a, b, step = 1) => { const out = []; for (let i = a; i <= b + 1e-9; i += step) out.push(Math.round(i * 1e6) / 1e6); return out; };
    const levels = fn => seq(1, 8).map(fn);
    const width = (lines, size = 11) => Math.max(...lines.map(t => t.length * size * 0.56));

    /*
     * The standard drawing of one creep action: who stands where, the range, and what moves.
     *   action({ title, caption, body, actor, target, targetLabel, targetOpts, range, verb, tone,
     *            flow: 'in' (the thing comes to the creep), effect: ['line', 'line'] })
     * Range is measured the way the game does it: the larger of the x and y distance, so the area is a square.
     */
    function action(o) {
        const r = o.range === undefined ? 1 : o.range;
        const T = r >= 3 ? 32 : 40;
        const side = 2 * r + 1;
        const actor = [r, r];
        const target = r === 1 ? [2, 0] : r === 2 ? [4, 1] : [2 * r, 1];
        const effect = o.effect || [];
        const cols = effect.length ? Math.ceil((width(effect) + 14) / T) : 0;
        const tLabel = o.targetLabel || o.target;
        const extra = Math.max(cols, Math.ceil((width([tLabel]) + 10) / T));
        const fig = {
            type: 'scene', title: o.title, caption: o.caption, tile: T, size: [side + extra, side],
            ranges: [{ at: actor, r, label: 'range ' + r, labelAt: 'bl' }],
            things: [
                Object.assign({ is: 'creep', at: actor, body: o.body || 'WCM', label: o.actor || 'creep', labelAt: r === 1 ? 'left' : 'bottom' }, o.actorOpts || {}),
                Object.assign({ is: o.target, at: target, label: tLabel, labelAt: 'right' }, o.targetOpts || {}),
            ].concat(o.things || []),
            arrows: [Object.assign({ from: o.flow === 'in' ? target : actor, to: o.flow === 'in' ? actor : target, tone: o.tone || 'ink' }, o.verb ? { label: o.verb, side: 'below' } : {})],
            notes: effect.length ? [{ at: [side - 0.35, r - (effect.length - 1) * 0.5 * 13.2 / T + (r === 1 ? 0.55 : 0.2)], text: effect, anchor: 'start' }] : [],
        };
        if (r === 1) { fig.size = [side + extra, side]; fig.things[0].at = [1, 1]; fig.things[0].labelAt = 'bottom'; }
        return fig;
    }

    return { n, seq, levels, action, C };
};
