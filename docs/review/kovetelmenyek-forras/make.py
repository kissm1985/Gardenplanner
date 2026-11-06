import importlib.util, sys, os, math
from openpyxl.drawing.image import Image as XImage
from openpyxl.worksheet.hyperlink import Hyperlink
def link(cell, where):
    cell.hyperlink = Hyperlink(ref=cell.coordinate, location=where, display=str(cell.value))
from PIL import Image as PImage
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.formatting.rule import CellIsRule
s = importlib.util.spec_from_file_location('d', sys.argv[1]); d = importlib.util.module_from_spec(s); s.loader.exec_module(d)
R = d.REQ
SH = "'Követelmények'"
PR = ['Kritikus', 'Magas', 'Közepes', 'Alacsony']
CX = ['S', 'M', 'L', 'XL', 'XXL']
cats = list(dict.fromkeys(r[1] for r in R))
rows = sorted(R, key=lambda r: (PR.index(r[2]), cats.index(r[1]), r[0]))

wb = Workbook()
ws = wb.active; ws.title = 'Követelmények'
head = ['Követelmény azonosító', 'Kategória', 'Prioritás', 'Komplexitás', 'Érintett funkció', 'Rövid leírás', 'Bővebb kifejtés', 'Vizuális magyarázat (kérésre elérhető)', 'Állapot (0.7.0)', 'Megvalósítás és ami hátravan']
ws.append(head)
ST = getattr(d, 'STATUS', {})
for r in rows: ws.append(list(r) + list(ST.get(r[0], ('Nyitott', ''))))
hdr = PatternFill('solid', fgColor='244B3C'); thin = Side(style='thin', color='D9D2C0')
for c in ws[1]:
    c.font = Font(bold=True, color='F7F4EC'); c.fill = hdr; c.alignment = Alignment(wrap_text=True, vertical='center')
for row in ws.iter_rows(min_row=2):
    for c in row:
        c.alignment = Alignment(wrap_text=True, vertical='top'); c.border = Border(bottom=thin)
    row[0].font = Font(bold=True)
    for i in (2, 3, 8): row[i].alignment = Alignment(horizontal='center', vertical='top')
for col, w in zip('ABCDEFGHIJ', [16, 18, 11, 12, 24, 42, 80, 30, 14, 60]):
    ws.column_dimensions[col].width = w
ws.row_dimensions[1].height = 32
n = len(rows) + 1
ws.freeze_panes = 'B2'; ws.auto_filter.ref = f'A1:J{n}'
for v, col in [('Kész', 'B7E1A1'), ('Részben kész', 'FCE8B2'), ('Nyitott', 'FFFFFF')]:
    ws.conditional_formatting.add(f'I2:I{n}', CellIsRule(operator='equal', formula=[f'"{v}"'], fill=PatternFill('solid', fgColor=col)))
for v, col in [('Kritikus', 'F4C7C3'), ('Magas', 'FCE8B2'), ('Közepes', 'D9EAD3'), ('Alacsony', 'E8EAED')]:
    ws.conditional_formatting.add(f'C2:C{n}', CellIsRule(operator='equal', formula=[f'"{v}"'], fill=PatternFill('solid', fgColor=col)))
for rng, opts in [(f'C2:C{n}', PR), (f'D2:D{n}', CX)]:
    dv = DataValidation(type='list', formula1='"' + ','.join(opts) + '"'); ws.add_data_validation(dv); dv.add(rng)
ws.print_title_rows = '1:1'; ws.page_setup.orientation = 'landscape'; ws.page_setup.fitToWidth = 1; ws.page_setup.fitToHeight = 0
ws.sheet_properties.pageSetUpPr.fitToPage = True

# ---------- Diagrams sheet, with links both ways ----------
PNG = sys.argv[3]
os.makedirs(PNG + '_opt', exist_ok=True)
fig = wb.create_sheet('Ábrák', 1)
fig.column_dimensions['A'].width = 120
fig['A1'] = 'Vizuális magyarázatok'; fig['A1'].font = Font(bold=True, size=16, color='244B3C')
fig['A2'] = 'Kattints egy azonosítóra az ábrához ugráshoz; minden ábra fölött „← Vissza” link vezet a követelményhez.'
fig['A2'].font = Font(italic=True, color='686E64')
withfig = [r for r in rows if r[7] != 'Nem szükséges']
link_font = Font(color='1F5FA8', underline='single')
idx0 = 4
cur = idx0 + len(withfig) + 2
reqrow = {r[0]: i + 2 for i, r in enumerate(rows)}
for k, r in enumerate(withfig):
    rid = r[0]
    src = f'{PNG}/{rid}.png'; dst = f'{PNG}_opt/{rid}.png'
    im = PImage.open(src).convert('RGB')
    im.quantize(colors=128, method=PImage.Quantize.MEDIANCUT).save(dst, optimize=True)
    W, H = im.size
    w = 900; h = round(w * H / W)
    # index entry
    c = fig.cell(row=idx0 + k, column=1, value=f'{rid} – {r[7]}')
    link(c, f"'Ábrák'!A{cur}"); c.font = link_font
    # header
    hc = fig.cell(row=cur, column=1, value=f'{rid} · {r[5]}')
    hc.font = Font(bold=True, size=13, color='244B3C')
    bc = fig.cell(row=cur + 1, column=1, value=f'← Vissza a követelményhez ({rid})')
    link(bc, f"'Követelmények'!A{reqrow[rid]}"); bc.font = link_font
    img = XImage(dst); img.width = w; img.height = h
    fig.add_image(img, f'A{cur + 2}')
    nrows = math.ceil(h / 20) + 2
    for rr in range(cur + 2, cur + 2 + nrows):
        fig.row_dimensions[rr].height = 15
    # link from the requirement row to the diagram
    hcell = ws.cell(row=reqrow[rid], column=8)
    hcell.value = f'▶ {r[7]}'
    link(hcell, f"'Ábrák'!A{cur}")
    hcell.font = link_font
    cur += 2 + nrows + 2
fig['A3'] = f'Tartalom ({len(withfig)} ábra)'; fig['A3'].font = Font(bold=True)

# Summary
s2 = wb.create_sheet('Összesítő')
s2.append(['Kategória'] + PR + ['Összesen'])
for i, c in enumerate(cats, 2):
    s2.append([c] + [f'=COUNTIFS({SH}!$B:$B,$A{i},{SH}!$C:$C,"{p}")' for p in PR] + [f'=SUM(B{i}:E{i})'])
last = len(cats) + 1
s2.append(['Összesen'] + [f'=SUM({c}2:{c}{last})' for c in 'BCDEF'])
s2.append([])
s2.append(['Komplexitás'] + CX + ['Összesen'])
k = last + 3
s2.append(['Darab'] + [f'=COUNTIF({SH}!$D:$D,"{x}")' for x in CX] + [f'=SUM(B{k+1}:F{k+1})'])
s2.append([])
ST3 = ['Kész', 'Részben kész', 'Nyitott']
s2.append(['Állapot (0.7.0)'] + ST3 + ['Összesen'])
k2 = k + 3
s2.append(['Darab'] + [f'=COUNTIF({SH}!$I:$I,"{x}")' for x in ST3] + [f'=SUM(B{k2+1}:D{k2+1})'])
for r in (1, k, k2):
    for c in s2[r]: c.font = Font(bold=True, color='F7F4EC'); c.fill = hdr
for c in s2[last + 1]: c.font = Font(bold=True)
s2.column_dimensions['A'].width = 24
for col in 'BCDEFG': s2.column_dimensions[col].width = 12

# Legend
s3 = wb.create_sheet('Jelmagyarázat')
L = [
 ('Prioritás', ''),
 ('Kritikus', 'A piacra lépés feltétele: nélküle nem indulhat a nyilvános verzió, illetve a fizetős vagy Profi csomag.'),
 ('Magas', 'Az első szezonban (2027 tavasz) szükséges; kis késéssel még elfogadható, de üzleti vagy jogi kockázatot hordoz.'),
 ('Közepes', 'Jelentősen javítja a terméket; az indulás után néhány hónapon belül.'),
 ('Alacsony', 'Hasznos, de a piacra lépést nem befolyásolja.'),
 ('', ''),
 ('Komplexitás', 'Becsült ráfordítás egy fejlesztőre (tervezés, megvalósítás, teszt, dokumentáció).'),
 ('S', 'legfeljebb 2 munkanap'),
 ('M', '3–5 munkanap'),
 ('L', '2–3 hét'),
 ('XL', '1–2 hónap'),
 ('XXL', '2 hónapnál több'),
 ('', ''),
 ('Vizuális magyarázat', 'Az oszlop azt nevezi meg, milyen ábra készülhet kérésre a követelmény megértéséhez (folyamatábra, UI-vázlat, architektúra- vagy adatmodell-ábra stb.). „Nem szükséges”: a leírás önmagában érthető.'),
 ('', ''),
 ('Állapot (0.7.0)', 'Kész: a követelmény a 0.7.0-ban teljesül. Részben kész: a fő része megvan, a „Megvalósítás és ami hátravan” oszlop mondja meg, mi maradt. Nyitott: még nem kezdtük el. Frissítve: 2026-11-06.'),
 ('', ''),
 ('Alap', 'Az összeállítás a Planterra 0.6.2 állapotára, a 0.6.0 auditra (docs/review/Planterra-audit.xlsx), a perszónákra, a piacra lépési tervre és a három termékváltozatra (Alap, Haladó, Profi) épül. Összeállítva: 2026-11-05.'),
]
for a, b in L: s3.append([a, b])
for r in (1, 7, 14, 16): s3.cell(row=r, column=1).font = Font(bold=True)
s3.column_dimensions['A'].width = 22; s3.column_dimensions['B'].width = 110
for row in s3.iter_rows():
    for c in row: c.alignment = Alignment(wrap_text=True, vertical='top')

wb.properties.title = 'Planterra – követelménylista a piacra lépésig'
wb.properties.creator = 'Kiss-Mihály István'
wb.save(sys.argv[2])
print(n - 1, 'rows')
