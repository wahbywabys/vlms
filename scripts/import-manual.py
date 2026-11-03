#!/usr/bin/env python3
"""Read the WABYS curriculum manual (HTML edition) into db/curricula/wabys-2026.json.

    python3 scripts/import-manual.py [db/curricula/source/wabys-manual-rev1.1.html]

The HTML manual (Rev 1.1, October 2026) has 15 programmes, the shared
Electro-technology Foundation (ETF) and Cross-Program Modules (CPM), two
study systems (A 60 % / B 80 %) and a System B training-unit plan per new
programme. Everything the manual states in Arabic is taken from it. The
manual gives knowledge content and skill criteria in English only; their
Arabic comes from db/curricula/criteria-ar.json (reviewed translations, keyed
by the English text), and anything still missing is listed so it can be added.

Then run scripts/build-curricula.py to regenerate the migration and templates.
"""
import json
import re
import sys
from pathlib import Path

from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent.parent
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'db' / 'curricula' / 'source' / 'wabys-manual-rev1.1.html'
OUT = ROOT / 'db' / 'curricula' / 'wabys-2026.json'
AR_FILE = ROOT / 'db' / 'curricula' / 'criteria-ar.json'

# Programme code → LMS trade, list order and accent colour.
TRADES = {
    'ELI': ('elec', 30, '#e8a70a'), 'AUT': ('auto', 20, '#d9480f'), 'CNC': ('cnc', 10, '#1c7ed6'),
    'RMG': ('rmg', 40, '#c2255c'), 'EIM': ('eim', 50, '#2f9e44'), 'PRT': ('prt', 60, '#7048e8'),
    'AIT': ('ait', 70, '#0ca678'), 'CWS': ('cws', 80, '#868e96'),
    'IEL': ('iel', 90, '#f08c00'), 'CSN': ('csn', 100, '#1098ad'), 'RAC': ('rac', 110, '#4dabf7'),
    'HAM': ('ham', 120, '#e64980'), 'OEQ': ('oeq', 130, '#5c7cfa'), 'AVE': ('ave', 140, '#ae3ec9'),
    'IEM': ('iem', 150, '#fab005'),
}

ORIGINAL = {'ELI', 'AUT', 'CNC', 'RMG', 'EIM', 'PRT', 'AIT', 'CWS'}

ws = lambda t: re.sub(r'\s+', ' ', t or '').strip()


def txt(el):
    return ws(el.get_text(' ')) if el is not None else ''


def split_list(t):
    """Topics and criteria are written as one sentence joined by ';'."""
    parts = [ws(p) for p in re.split(r';\s*', t) if ws(p)]
    return parts


def bi(el):
    """{en, ar} from an element holding <span class=en> and <span class=ar>."""
    return {'en': txt(el.find(class_='en')), 'ar': txt(el.find(class_='ar'))}


def attr_table(blk):
    """The overview attribute table: English label → {en, ar} value."""
    out = {}
    for tr in blk.select('table tbody tr'):
        tds = tr.find_all('td')
        if len(tds) >= 4:
            out[txt(tds[0])] = {'en': txt(tds[1]), 'ar': txt(tds[3])}
    return out


def rows(table):
    for tr in table.select('tbody tr'):
        tds = tr.find_all('td')
        mc = tds[0].find(class_='mc') if tds else None
        if mc:
            yield txt(mc), tds


def domain_of(blk):
    for d in 'KSA':
        if f'dom{d}' in blk.get('class', []):
            return d
    return None


def parse_items(year, blk, d, items, refs, common=False):
    table = blk.find('table')
    if not table:
        return
    for code, tds in rows(table):
        cell0 = txt(tds[0])
        if not re.match(r'^[A-Z]{3}-Y\d-[KSA]-\d+', code) or (code.startswith('ETF') and not common):
            # A shared unit listed inside the programme (ETF-Y1-K-01…06, CPM-02 …)
            refs.append({'year': year, 'ksa': d, 'code': cell0, 'title': {'en': txt(tds[1]), 'ar': txt(tds[2])},
                         'hours': int(txt(tds[-1])) if d == 'K' and txt(tds[-1]).isdigit() else None})
            continue
        it = {'code': code, 'year': year, 'ksa': d, 'title': {'en': txt(tds[1]), 'ar': txt(tds[2])}}
        if d == 'K':
            it['hours'] = int(txt(tds[4])) if txt(tds[4]).isdigit() else None
            it['criteria'] = [{'en': c} for c in split_list(txt(tds[3]))]
        elif d == 'S':
            it['level'] = txt(tds[4])
            it['criteria'] = [{'en': c} for c in split_list(txt(tds[3]))]
        else:
            m = re.search(r'\((A\d)\)', cell0)
            it['core'] = m.group(1) if m else None
            en, ar = split_list(txt(tds[3])), split_list(txt(tds[4]))
            it['criteria'] = [{'en': e, 'ar': ar[i] if len(ar) == len(en) else ''} for i, e in enumerate(en)]
            if len(ar) != len(en) and ar:
                it['criteria_ar_joined'] = '؛ '.join(ar)
        items.append(it)


def parse_sysb(blk):
    """System B training-unit plan: unit no., name, hours, codes per year."""
    units, year = [], None
    for tr in blk.select('table tr'):
        cells = [txt(td) for td in tr.find_all(['td', 'th'])]
        if not cells:
            continue
        m = re.match(r'^Year (\d)', cells[0])
        if m and len(cells) <= 3:
            year = int(m.group(1))
            continue
        units.append(cells)
    return units


def parse_program(sec):
    code = txt(sec.find(class_='pc'))
    head = sec.find('header')
    p = {'code': code}
    trade, sort, accent = TRADES[code]
    p.update(trade=trade, sort=sort, accent=accent)
    p['name'] = {'en': txt(head.find('h2')), 'ar': txt(head.find(class_='h2ar'))}
    pv = head.find(class_='pvtd')
    p['pvtd'] = txt(pv.find(class_='ar')) if pv else None
    p['new'] = 'New in Rev' in txt(head.find(class_='eyebrow'))
    blocks = sec.find_all('div', class_='blk', recursive=False) or sec.select('div.blk.l3')
    items, refs, sysb, tracks = [], [], None, []
    for blk in sec.select('div.blk.l3'):
        h3 = blk.find('h3')
        title = bi(h3)
        if title['en'].startswith('Program Overview'):
            paras = [x for x in blk.find_all('p', recursive=False)]
            en = [txt(x) for x in paras if 'ar' not in (x.get('class') or [])]
            ar = [txt(x) for x in paras if 'ar' in (x.get('class') or [])]
            p['overview'] = {'en': ' '.join(en), 'ar': ' '.join(ar)}
            attrs = attr_table(blk)
            p['attrs'] = attrs
            continue
        m = re.match(r'Year (\d)', title['en'])
        if not m:
            continue
        year = int(m.group(1))
        p.setdefault('year_titles', {})[str(year)] = title
        for b4 in blk.select('div.blk.l4'):
            d = domain_of(b4)
            h4 = bi(b4.find('h4'))
            if d:
                parse_items(year, b4, d, items, refs)
            elif h4['en'].startswith('Capstone'):
                bq = b4.find('blockquote')
                ps = bq.find_all('p')
                ar_ps = [x for x in ps if 'ar' in (x.get('class') or [])]
                p['capstone'] = {
                    'title': {'en': txt(ps[0]), 'ar': txt(ar_ps[0]) if ar_ps else ''},
                    'en': ' '.join(txt(x) for x in ps[1:] if 'ar' not in (x.get('class') or [])),
                    # The manual gives only the Arabic title; the body comes from criteria-ar.json.
                    'ar': ' '.join(txt(x) for x in ar_ps[1:]),
                }
            elif 'sysB' in b4.get('class', []):
                sysb = parse_sysb(b4)
        for para in blk.find_all('p'):
            t = txt(para)
            if t.startswith('Specialization tracks'):
                tracks = [{'en': ws(re.sub(r'^\([a-z]\)\s*', '', x.split('·')[0])), 'ar': ws(x.split('·')[1]) if '·' in x else ''}
                          for x in re.split(r';\s*', t.split(':', 1)[1].rstrip('.'))]
    p['tracks'] = tracks
    p['items'] = items
    p['shared'] = refs
    p['sysb'] = sysb
    return p


def parse_common(sec):
    """2.0: the Electro-technology Foundation items, its training requirements, and the CPM modules."""
    tables = sec.find_all('table')
    etf, req, cpm = [], [], {}
    for t in tables:
        heads = [txt(th) for th in t.select('thead th')]
        if heads[:2] == ['Item', 'Specification']:
            req = [{'item': {'en': txt(r.find_all('td')[0]), 'ar': txt(r.find_all('td')[2])},
                    'spec': {'en': txt(r.find_all('td')[1]), 'ar': txt(r.find_all('td')[3])}} for r in t.select('tbody tr')]
        elif 'Year' in heads and 'System A hours' in heads:
            for code, tds in rows(t):
                cpm[code] = {'code': code, 'title': {'en': txt(tds[1]), 'ar': txt(tds[2])}, 'year': int(txt(tds[3])[1]),
                             'content': [{'en': c} for c in split_list(txt(tds[4]))], 'hours_a': txt(tds[5]), 'system_b': txt(tds[6])}
        elif heads[:2] == ['Code', 'Competency'] and any(c.startswith('CPM') for c, _ in rows(t)):
            for code, tds in rows(t):
                cpm[code.split()[0]]['skill'] = {'title': {'en': txt(tds[1]), 'ar': txt(tds[2])},
                                                 'criteria': [{'en': c} for c in split_list(txt(tds[3]))], 'level': txt(tds[4])}
        elif heads[:1] == ['Code']:
            d = {'Module': 'K', 'Competency': 'S', 'Attitude': 'A'}[heads[1]]
            parse_items(1, _Blk(t), d, etf, [], common=True)
    return etf, req, list(cpm.values())


class _Blk:
    def __init__(self, t): self.t = t
    def find(self, name): return self.t


def occupation(p):
    m = re.search(r'prepares\s+(.+?)\s*\(([^)]+)\)', p['overview']['en'])
    return {'en': re.sub(r's$', '', m.group(1)) if m else '', 'ar': m.group(2) if m else ''}


def main():
    soup = BeautifulSoup(SRC.read_text(encoding='utf-8'), 'lxml')
    old = json.loads(OUT.read_text(encoding='utf-8'))
    # The first eight programmes keep the tree published in migration 006.
    oldp = {p['code']: p for p in old['programs'] if p['code'] in ORIGINAL}
    ar = json.loads(AR_FILE.read_text(encoding='utf-8')) if AR_FILE.exists() else {}
    # Arabic already reviewed for the first eight programmes is kept and reused.
    for p in old['programs']:
        for i in p['items']:
            for c in i['criteria']:
                if c.get('ar'):
                    ar.setdefault(c['en'], c['ar'])
    etf, req, cpm = parse_common(soup.find(id='v-s-2-0'))
    etf_by = {i['code']: i for i in etf}
    programs, missing = [], []

    def fill(crit):
        for c in crit:
            if not c.get('ar'):
                c['ar'] = ar.get(c['en'], '')
                if not c['ar']:
                    missing.append(c['en'])

    for n in range(1, 16):
        p = parse_program(soup.find(id=f'v-s-2-{n}'))
        a = p.pop('attrs')
        extra = {
            'pvtd': p['pvtd'], 'new': p['new'],
            'duration': a.get('Duration'), 'adopts': a.get('Common units adopted'),
            'shared': p.pop('shared'), 'system_b': p.pop('sysb'),
        }
        p.pop('year_titles', None)
        if p['code'] in oldp:
            # Keep the published tree of the first eight programmes (migration 006); refresh the profile.
            o = dict(oldp[p['code']])
            o.update(extra)
            o['equipment'] = a.get('Core equipment', o['equipment'])
            o['revised'] = [i for i in p['items'] if i['title']['en'] != next(
                (x['title']['en'] for x in o['items'] if x['code'] == i['code']), i['title']['en'])]
            programs.append(o)
            continue
        cap = p.pop('capstone')
        q = {
            'code': p['code'], 'trade': p['trade'], 'sort': p['sort'], 'accent': p['accent'], 'name': p['name'],
            'occupation': occupation(p), 'overview': p['overview'],
            'eqf': re.search(r'EQF \d', a['Qualification level']['en']).group(0), 'hours': 4800,
            'occupations': a['Target occupations'], 'standards': next(v for k, v in a.items() if 'standard' in k.lower())['en'],
            'equipment': a['Core equipment'], 'tracks': [{'en': ws(re.sub(r'^\([a-z]\)', '', t['en'])), 'ar': t['ar']} for t in p['tracks']],
            'capstone': {'en': f"{cap['title']['en']}. {cap['en']}",
                         'ar': '. '.join(x for x in (cap['title']['ar'], cap['ar'] or ar.get(cap['en'], '')) if x)},
        }
        q.update(extra)
        items = []
        # Adopting a shared unit brings in all of it: the whole ETF (K, S and A), and each CPM module with its skill.
        for ref in q['shared']:
            if ref['code'].startswith('ETF'):
                items += [dict(i) for i in etf]
            for c in re.findall(r'CPM-0\d', ref['code']):
                m = next(x for x in cpm if x['code'] == c)
                items.append({'code': c, 'year': m['year'], 'ksa': 'K', 'title': m['title'],
                              'hours': ref['hours'] if ref['ksa'] == 'K' and '/' not in ref['code'] else None,
                              'criteria': [dict(x) for x in m['content']], 'shared': True})
                if 'skill' in m:
                    items.append({'code': f'{c}-S', 'year': m['year'], 'ksa': 'S', 'title': m['skill']['title'],
                                  'level': m['skill']['level'], 'criteria': [dict(x) for x in m['skill']['criteria']], 'shared': True})
        items += p['items']
        # Shared units sit first in their year, as in the manual; de-duplicate by code.
        seen, q['items'] = set(), []
        for i in sorted(items, key=lambda i: (i['year'], 'KSA'.index(i['ksa']))):
            if i['code'] in seen:
                continue
            ref = re.match(r'(CPM-0\d) ?-S criteria$', i['criteria'][0]['en']) if len(i['criteria']) == 1 else None
            if ref:  # "same criteria as CPM-01-S"
                i['criteria'] = [dict(x) for x in next(x for x in cpm if x['code'] == ref.group(1))['skill']['criteria']]
            seen.add(i['code'])
            fill(i['criteria'])
            q['items'].append(i)
        programs.append(q)
    for x in cpm:
        fill(x['content'])
        if 'skill' in x:
            fill(x['skill']['criteria'])
    for i in etf:
        fill(i['criteria'])
    old.update(
        edition='First Edition, 2026 · Revision 1.1 (October 2026)',
        source='WABYS Manual for Vocational Education & Applied Technology Curriculums, First Edition 2026, Revision 1.1 (October 2026)',
        source_ar='دليل وابيز لأطر مناهج التدريب المهني والتعليم التكنولوجي، الطبعة الأولى 2026، المراجعة 1.1 (أكتوبر 2026)',
        common={'etf': etf, 'etf_requirements': req, 'cpm': cpm},
        programs=programs,
    )
    OUT.write_text(json.dumps(old, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    missing = sorted(set(missing))
    gap = ROOT / 'db' / 'curricula' / 'criteria-ar.missing.json'
    if missing:  # fill these in, move them to criteria-ar.json and run again
        gap.write_text(json.dumps({m: '' for m in missing}, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    elif gap.exists():
        gap.unlink()
    print(f"{len(programs)} programmes, {sum(len(p['items']) for p in programs)} items; {len(missing)} criteria still need Arabic")


if __name__ == '__main__':
    main()
