# HTML renderers for the requirement diagrams (screenshotted to PNG by shot.mjs).
from html import escape as e

CSS = """
*{box-sizing:border-box}
body{margin:0;background:#fff;font-family:'DejaVu Sans',Helvetica,Arial,sans-serif;color:#2b322b;font-size:14px;line-height:1.35}
.page{width:1000px;padding:26px 28px 30px}
.id{font:600 12px/1 'DejaVu Sans Mono',monospace;letter-spacing:.06em;color:#686e64;text-transform:uppercase}
h1{font-size:21px;margin:6px 0 4px;color:#244b3c}
.sub{color:#686e64;margin:0 0 18px;font-size:13.5px}
.block{margin-top:18px}
.btitle{font-weight:700;font-size:15px;margin:0 0 10px;color:#2b322b}
.box{border:1.5px solid #9aa294;border-radius:9px;padding:9px 12px;background:#fcfaf5}
.box b{display:block;font-size:14px}
.box small{display:block;color:#5d6459;font-size:12.5px;margin-top:3px}
.box.acc{border-color:#244b3c;background:#e3ece5;border-width:2px}
.box.warn{border-color:#9a5b12;background:#fbf1e2}
.box.bad{border-color:#a3362b;background:#f9e7e4}
.box.dec{border-color:#8a9462;background:#f3f4e8;border-style:dashed}
.box.start{border-radius:22px;background:#244b3c;border-color:#244b3c;color:#fff;text-align:center}
.box.start small{color:#dfe7e1}
.arrow{text-align:center;color:#8a9462;font-size:18px;line-height:18px;margin:4px 0}
.alab{font-size:12px;color:#686e64}
.row{display:flex;gap:14px;align-items:stretch}
.row>*{flex:1}
.brlab{font:600 12px 'DejaVu Sans Mono',monospace;color:#8a9462;margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em}
.hflow{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.hflow .box{flex:1;min-width:120px}
.harr{color:#8a9462;font-size:20px;flex:0 0 auto}
table{border-collapse:collapse;width:100%;font-size:13px}
th{background:#244b3c;color:#fff;text-align:left;padding:7px 9px;font-weight:600;border:1px solid #244b3c}
td{border:1px solid #d9d2c0;padding:6px 9px;vertical-align:top}
tr:nth-child(even) td{background:#faf8f2}
td.c{text-align:center;font-size:15px}
.y{color:#2e7d32;font-weight:700}.n{color:#a3362b;font-weight:700}.p{color:#9a5b12;font-weight:700}
.seq{position:relative;border:1px solid #e2dccb;border-radius:10px;padding:12px 8px 14px;background:#fff}
.seqh{display:grid;gap:8px;margin-bottom:6px}
.actor{text-align:center;background:#244b3c;color:#fff;border-radius:8px;padding:7px 6px;font-weight:600;font-size:13px}
.msg{position:relative;height:44px}
.life{position:absolute;top:0;bottom:0;border-left:1.5px dashed #c9c2ae}
.line{position:absolute;top:28px;height:0;border-top:2px solid #244b3c}
.line.reply{border-top:2px dashed #8a9462}
.line .hd{position:absolute;top:-7px;width:0;height:0;border-top:6px solid transparent;border-bottom:6px solid transparent}
.line .hd.r{right:-2px;border-left:10px solid #244b3c}
.line .hd.l{left:-2px;border-right:10px solid #244b3c}
.line.reply .hd.r{border-left-color:#8a9462}.line.reply .hd.l{border-right-color:#8a9462}
.mlab{position:absolute;top:6px;font-size:12.5px;white-space:nowrap;background:#fff;padding:0 4px}
.self{position:absolute;top:8px;border:2px solid #244b3c;border-left:none;height:22px;width:26px;border-radius:0 6px 6px 0}
.seqnote{margin:8px 6% ;background:#fbf1e2;border:1px dashed #9a5b12;border-radius:6px;padding:6px 10px;font-size:12.5px;position:relative;z-index:1}
.seqsep{margin:10px 0 4px;border-top:1.5px solid #8a9462;font:600 12px 'DejaVu Sans Mono',monospace;color:#8a9462;padding-top:4px;position:relative;z-index:1;background:#fff}
.screens{display:flex;gap:22px;align-items:flex-start;flex-wrap:wrap}
.scr{border:2px solid #2b322b;border-radius:18px;padding:10px;background:#f7f4ec;width:300px}
.scr.wide{width:100%;border-radius:10px}
.scr.mid{width:440px;border-radius:10px}
.scrt{font:600 12px 'DejaVu Sans Mono',monospace;color:#686e64;text-align:center;margin:-2px 0 8px;text-transform:uppercase;letter-spacing:.05em}
.el{margin:6px 0}
.top{background:#244b3c;color:#fff;border-radius:8px;padding:8px 10px;font-size:13px;display:flex;justify-content:space-between;gap:6px;align-items:center}
.top span{opacity:.9}
.h{font-weight:700;font-size:15px}
.btn{border:1.5px solid #244b3c;border-radius:8px;padding:7px 10px;text-align:center;font-size:13px;background:#fff}
.btn.pri{background:#244b3c;color:#fff}
.card{border:1px solid #d9d2c0;border-radius:8px;padding:8px 10px;background:#fff}
.card b{display:block;font-size:13.5px}.card small{color:#686e64;font-size:12px}
.inp{border:1px solid #9aa294;border-radius:6px;padding:6px 8px;background:#fff;font-size:12.5px}
.inp i{display:block;color:#686e64;font-style:normal;font-size:11.5px}
.chips{display:flex;flex-wrap:wrap;gap:5px}.chip{border:1px solid #8a9462;border-radius:12px;padding:3px 9px;font-size:12px;background:#fff}
.chip.on{background:#244b3c;color:#fff;border-color:#244b3c}
.note{background:#fff6c9;border-left:4px solid #e0b400;padding:6px 9px;font-size:12.5px;border-radius:4px}
.lock{border:1.5px dashed #9a5b12;border-radius:8px;padding:7px 10px;font-size:12.5px;color:#7a4a10;background:#fbf1e2}
.ph{white-space:pre-line;border:1.5px dashed #9aa294;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#686e64;font-size:12.5px;background:#fff;text-align:center;padding:6px}
.erow{display:flex;gap:6px}.erow>*{flex:1}
.layer{border:1.5px solid #d9d2c0;border-radius:10px;padding:10px 12px;background:#faf8f2}
.lname{font:600 12px 'DejaVu Sans Mono',monospace;color:#686e64;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px}
.lboxes{display:flex;gap:10px;flex-wrap:wrap}.lboxes .box{flex:1;min-width:150px}
.ents{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.ent{border:1.5px solid #244b3c;border-radius:8px;background:#fff;overflow:hidden}
.ent .en{background:#244b3c;color:#fff;font-weight:600;padding:6px 10px;font-size:13.5px}
.ent ul{margin:0;padding:6px 10px 8px 24px;font-size:12.5px}
.ent.new{border-color:#9a5b12}.ent.new .en{background:#9a5b12}
.rels{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.rel{border:1px solid #8a9462;border-radius:14px;padding:4px 11px;font-size:12.5px;background:#f3f4e8}
.legend{margin-top:12px;font-size:12.5px;color:#686e64}
.two{display:grid;grid-template-columns:1fr 1fr;gap:18px}
.panel{border:1px solid #e2dccb;border-radius:10px;padding:12px;background:#fff}
.panel .pt{font:600 12px 'DejaVu Sans Mono',monospace;color:#686e64;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px}
.sw{display:inline-block;width:18px;height:18px;border-radius:4px;vertical-align:middle;border:1px solid #0002;margin-right:6px}
.pic{display:flex;gap:16px;flex-wrap:wrap}
.foot{margin-top:18px;font-size:12px;color:#686e64;border-top:1px solid #e2dccb;padding-top:8px}
"""

def page(rid, title, sub, blocks, foot=''):
    body = ''.join(f'<div class="block">{b}</div>' for b in blocks)
    f = f'<div class="foot">{e(foot)}</div>' if foot else ''
    return f'<!doctype html><html lang="hu"><head><meta charset="utf-8"><style>{CSS}</style></head><body><div class="page" id="pg"><div class="id">{e(rid)}</div><h1>{e(title)}</h1><p class="sub">{e(sub)}</p>{body}{f}</div></body></html>'

def T(s):  # block title
    return f'<div class="btitle">{e(s)}</div>'

def box(t, d='', k=''):
    return f'<div class="box {k}"><b>{e(t)}</b>' + (f'<small>{e(d)}</small>' if d else '') + '</div>'

def _node(n):
    if isinstance(n, str): return box(n)
    return box(n[0], n[1] if len(n) > 1 else '', n[2] if len(n) > 2 else '')

def arrow(lab=''):
    return f'<div class="arrow">▼' + (f' <span class="alab">{e(lab)}</span>' if lab else '') + '</div>'

def flow(steps, title=''):
    """steps: node | ('->', label) | ('branch', [(label, [nodes...]), ...])"""
    out = [T(title)] if title else []
    first = True
    for s in steps:
        if isinstance(s, tuple) and s and s[0] == '->':
            out.append(arrow(s[1])); first = True; continue
        if not first: out.append(arrow())
        if isinstance(s, tuple) and s and s[0] == 'branch':
            cols = []
            for lab, ns in s[1]:
                inner = f'<div class="brlab">{e(lab)}</div>' + arrow().join(_node(n) for n in ns)
                cols.append(f'<div>{inner}</div>')
            out.append(f'<div class="row">{"".join(cols)}</div>')
        else:
            out.append(_node(s))
        first = False
    return ''.join(out)

def hflow(nodes, title=''):
    parts = []
    for i, n in enumerate(nodes):
        if i: parts.append('<div class="harr">➜</div>')
        parts.append(_node(n))
    return (T(title) if title else '') + f'<div class="hflow">{"".join(parts)}</div>'

def mark(v):
    m = {'✓': 'y', '✗': 'n', '◐': 'p'}
    return f'<td class="c"><span class="{m[v]}">{v}</span></td>' if v in m else f'<td>{e(v)}</td>'

def table(head, rows, title='', note=''):
    h = ''.join(f'<th>{e(x)}</th>' for x in head)
    b = ''.join('<tr>' + ''.join(mark(c) if isinstance(c, str) else f'<td>{c[0]}</td>' for c in r) + '</tr>' for r in rows)
    n = f'<div class="legend">{e(note)}</div>' if note else ''
    return (T(title) if title else '') + f'<table><thead><tr>{h}</tr></thead><tbody>{b}</tbody></table>{n}'

def seq(actors, msgs, title=''):
    n = len(actors)
    cols = f'grid-template-columns:repeat({n},1fr)'
    head = f'<div class="seqh" style="{cols}">' + ''.join(f'<div class="actor">{e(a)}</div>' for a in actors) + '</div>'
    cx = lambda i: (i + 0.5) * 100 / n
    lifes = ''.join(f'<div class="life" style="left:{cx(i)}%"></div>' for i in range(n))
    rows = []
    for m in msgs:
        if m[0] == 'note':
            rows.append(f'<div class="seqnote">{e(m[1])}</div>'); continue
        if m[0] == 'sep':
            rows.append(f'<div class="seqsep">{e(m[1])}</div>'); continue
        a, b, lab = m[0], m[1], m[2]
        kind = m[3] if len(m) > 3 else ''
        if a == b:
            x = cx(a)
            rows.append(f'<div class="msg">{lifes}<div class="self" style="left:{x}%"></div><div class="mlab" style="left:calc({x}% + 32px)">{e(lab)}</div></div>')
            continue
        l, r = min(cx(a), cx(b)), max(cx(a), cx(b))
        hd = '<div class="hd r"></div>' if b > a else '<div class="hd l"></div>'
        rows.append(f'<div class="msg">{lifes}<div class="line {kind}" style="left:{l}%;width:{r-l}%">{hd}</div><div class="mlab" style="left:{(l+r)/2}%;transform:translateX(-50%)">{e(lab)}</div></div>')
    return (T(title) if title else '') + f'<div class="seq">{head}{"".join(rows)}</div>'

def el(x):
    k = x[0]
    if k == 'top': return f'<div class="el top"><b>{e(x[1])}</b><span>{e(x[2]) if len(x)>2 else ""}</span></div>'
    if k == 'h': return f'<div class="el h">{e(x[1])}</div>'
    if k == 'btn': return f'<div class="el btn{" pri" if len(x)>2 and x[2] else ""}">{e(x[1])}</div>'
    if k == 'card': return f'<div class="el card"><b>{e(x[1])}</b><small>{e(x[2]) if len(x)>2 else ""}</small></div>'
    if k == 'inp': return f'<div class="el inp"><i>{e(x[1])}</i>{e(x[2]) if len(x)>2 else ""}</div>'
    if k == 'chips': return '<div class="el chips">' + ''.join(f'<span class="chip{" on" if c.startswith("*") else ""}">{e(c.lstrip("*"))}</span>' for c in x[1]) + '</div>'
    if k == 'note': return f'<div class="el note">{e(x[1])}</div>'
    if k == 'lock': return f'<div class="el lock">🔒 {e(x[1])}</div>'
    if k == 'ph': return f'<div class="el ph" style="height:{x[2] if len(x)>2 else 80}px">{e(x[1])}</div>'
    if k == 'row': return '<div class="el erow">' + ''.join(el(y) for y in x[1]) + '</div>'
    if k == 'txt': return f'<div class="el" style="font-size:12.5px">{e(x[1])}</div>'
    raise ValueError(k)

def screens(scrs, title=''):
    out = []
    for s in scrs:
        cls = 'scr ' + s.get('w', '')
        out.append(f'<div class="{cls}"><div class="scrt">{e(s["t"])}</div>' + ''.join(el(x) for x in s['els']) + '</div>')
    return (T(title) if title else '') + f'<div class="screens">{"".join(out)}</div>'

def layers(ls, title=''):
    out = []
    for i, l in enumerate(ls):
        if i: out.append(arrow(ls[i][2] if len(ls[i]) > 2 else ''))
        out.append(f'<div class="layer"><div class="lname">{e(l[0])}</div><div class="lboxes">' + ''.join(_node(b) for b in l[1]) + '</div></div>')
    return (T(title) if title else '') + ''.join(out)

def er(ents, rels, title='', cols=3):
    es = ''.join(f'<div class="ent{" new" if en[0].startswith("*") else ""}"><div class="en">{e(en[0].lstrip("*"))}</div><ul>' + ''.join(f'<li>{e(f)}</li>' for f in en[1]) + '</ul></div>' for en in ents)
    rs = ''.join(f'<span class="rel">{e(r)}</span>' for r in rels)
    return (T(title) if title else '') + f'<div class="ents" style="grid-template-columns:repeat({cols},1fr)">{es}</div><div class="rels">{rs}</div>'

def two(a, b, ta='', tb=''):
    return f'<div class="two"><div class="panel"><div class="pt">{e(ta)}</div>{a}</div><div class="panel"><div class="pt">{e(tb)}</div>{b}</div></div>'

def raw(h):
    return h
