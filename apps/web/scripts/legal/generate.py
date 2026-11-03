"""Genera lib/legal/aviso-legal.ts y encargo-tratamiento.ts desde los .docx
aprobados por el abogado (docs/legal/). Los cambios marcados se toman como
aceptados y se omiten las notas «[PENDIENTE…]».

    pip install lxml && python3 apps/web/scripts/legal/generate.py
"""
import json, sys
import os
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
sys.path.insert(0, HERE)
from docx_items import items

import re
def dpa_heading(t, b):
    if '\n' in t: return False
    if re.match(r'^\d+(\.\d+)*\.\s+\S', t) and len(t) < 80 and not t.endswith('.'): return True
    if t.upper() == t and any(c.isalpha() for c in t) and len(t) < 90: return True
    return t in ('Categorías especiales de datos',)
def aviso_heading(t, b):
    return b and (bool(re.match(r'^\d+\. ', t)) or t.startswith('ANEXO'))
def build(path, skip_from=None, drop=(), is_heading=aviso_heading, title_lines=2):
    arts, cur = [], None
    pending_head = []
    seen_title = 0
    for kind, t, num, b in items(path):
        if kind == 'p':
            t = t.replace('\xa0', ' ').strip()
            if not t: continue
            if any(d in t for d in drop): continue
            if skip_from and t.startswith(skip_from): break
            if seen_title < title_lines:       # document title + date/version line
                seen_title += 1; continue
            if is_heading(t, b):
                pending_head.append(t); continue
            if pending_head:
                cur = {'heading': ' — '.join(pending_head), 'blocks': []}; arts.append(cur); pending_head = []
            if cur is None:
                cur = {'heading': '', 'blocks': []}; arts.append(cur)
            if num:
                if cur['blocks'] and cur['blocks'][-1]['type'] == 'list':
                    cur['blocks'][-1]['items'].append(t)
                else:
                    cur['blocks'].append({'type': 'list', 'items': [t]})
            elif '\n' in t:
                cur['blocks'].append({'type': 'quote', 'lines': [l.strip() for l in t.split('\n') if l.strip()]})
            else:
                cur['blocks'].append({'type': 'p', 'text': t})
        else:
            rows = [r for r in t[1:] if any(c.strip() for c in r)]   # skip header row and empty rows
            if pending_head:
                cur = {'heading': ' — '.join(pending_head), 'blocks': []}; arts.append(cur); pending_head = []
            cur['blocks'].append({'type': 'list', 'items': [f'{a.strip()}: {c.strip()}' for a, c in rows]})
    return arts

def emit(name, arts, out, header):
    with open(out, 'w') as f:
        f.write(header)
        f.write("import type { LegalArticle } from '@/components/legal-document'\n\n")
        f.write(f"export const {name}: LegalArticle[] = ")
        f.write(json.dumps(arts, ensure_ascii=False, indent=2))
        f.write("\n")

NOTE = "[PENDIENTE"
aviso = build(os.path.join(ROOT, 'docs/legal/aviso-legal-condiciones.docx'), skip_from='ANEXO II', drop=(NOTE,))
dpa = build(os.path.join(ROOT, 'docs/legal/contrato-encargo-tratamiento.docx'), skip_from='FIRMA DE LAS PARTES', drop=(NOTE,), is_heading=dpa_heading)
H = lambda what: f"""// Generado desde el documento aprobado por el abogado (versión con los
// cambios del 2 de noviembre de 2026 aceptados). No editar a mano: si cambia
// el texto, se cambia el .docx y se vuelve a generar. {what}
"""
emit('AVISO_LEGAL', aviso, os.path.join(ROOT, 'apps/web/lib/legal/aviso-legal.ts'), H('Sin los anexos II y III, que son instrucciones internas (información previa al pago y textos de las casillas).'))
emit('ENCARGO_TRATAMIENTO', dpa, os.path.join(ROOT, 'apps/web/lib/legal/encargo-tratamiento.ts'), H('Sin el bloque de firmas: se acepta electrónicamente.'))
for n, a in (('aviso', aviso), ('dpa', dpa)):
    print(n, len(a), 'artículos'); print('  ', [x['heading'][:40] for x in a][:6], '...', [x['heading'][:40] for x in a][-4:])
