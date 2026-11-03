import zipfile, sys
from lxml import etree
W='{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
def accepted_text(p):
    out=[]
    for el in p.iter():
        if el.tag==W+'t':
            # skip text inside w:del (delText anyway) 
            out.append(el.text or '')
        elif el.tag==W+'br' : out.append('\n')
    return ''.join(out)
def is_deleted_para(p):
    ppr=p.find(W+'pPr'); return ppr is not None and ppr.find(f'{W}rPr/{W}del') is not None
def bold(p):
    for r in p.iter(W+'r'):
        if r.getparent().tag==W+'del': continue
        if ''.join(t.text or '' for t in r.iter(W+'t')).strip():
            rp=r.find(W+'rPr'); return rp is not None and rp.find(W+'b') is not None and rp.find(W+'b').get(W+'val','true') not in ('0','false')
    return False
def items(path):
    root=etree.fromstring(zipfile.ZipFile(path).read('word/document.xml'))
    body=root.find(W+'body')
    for el in body:
        if el.tag==W+'p':
            t=accepted_text(el)
            if is_deleted_para(el) and not t.strip(): continue
            ppr=el.find(W+'pPr'); num=ppr is not None and ppr.find(W+'numPr') is not None
            yield ('p', t, num, bold(el))
        elif el.tag==W+'tbl':
            rows=[[accepted_text(tc).strip() for tc in tr.findall(W+'tc')] for tr in el.findall(W+'tr')]
            yield ('tbl', rows, False, False)
if __name__=='__main__':
    for it in items(sys.argv[1]):
        k,t,num,b=it
        if k=='tbl': print('TBL',t)
        elif t.strip(): print(('L ' if num else 'B ' if b else '  ')+t.replace('\n',' / ')[:110])
