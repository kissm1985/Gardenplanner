import sys, importlib.util
sys.path.insert(0, sys.argv[1])
from render import page
import specs
s = importlib.util.spec_from_file_location('d', sys.argv[1] + '/data.py'); d = importlib.util.module_from_spec(s); s.loader.exec_module(d)
for r in d.REQ:
    if r[7] == 'Nem szükséges': continue
    sp = specs.S[r[0]]
    open(f'{sys.argv[1]}/html/{r[0]}.html', 'w').write(page(f'{r[0]} · {r[1]} · {r[4]}', sp[0], sp[1], sp[2], sp[3] if len(sp) > 3 else ''))
