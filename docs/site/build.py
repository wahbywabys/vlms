"""Assemble the published blueprint page from the template and the real source files."""
import html, shutil, glob, os, pathlib
root = pathlib.Path(__file__).resolve().parents[2]
here = pathlib.Path(__file__).resolve().parent
t = (here / 'template.html').read_text()
subs = {
    '{{SCHEMA}}': root / 'db/schema.sql',
    '{{COMPONENT}}': root / 'web/src/components/MachineExplorer.tsx',
    '{{ENGINE}}': root / 'api/src/services/rubricEngine.ts',
    '{{ROUTE}}': root / 'api/src/routes/vlabSessions.ts',
}
for k, p in subs.items():
    t = t.replace(k, html.escape(p.read_text()))
out = here / 'out'
shutil.rmtree(out, ignore_errors=True)
(out / 'explorer').mkdir(parents=True)
(out / 'index.html').write_text(t)
shutil.copy(glob.glob(str(root / 'web/dist/assets/*.js'))[0], out / 'explorer/app.js')
shutil.copy(glob.glob(str(root / 'web/dist/assets/*.css'))[0], out / 'explorer/app.css')
print('built', out)
