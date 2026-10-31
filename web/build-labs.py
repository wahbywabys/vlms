import base64, re, sys, urllib.request, pathlib
dist, out = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
UA = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36'}
def get(u): return urllib.request.urlopen(urllib.request.Request(u, headers=UA)).read()
src = (dist / 'labs.html').read_text()
fonts_url = re.search(r'href="(https://fonts\.googleapis\.com[^"]+)"', src).group(1).replace('&amp;', '&')
css = get(fonts_url).decode()
keep = {'latin', 'latin-ext', 'arabic'}
blocks = re.findall(r'/\* ([\w-]+) \*/\s*(@font-face \{.*?\})', css, re.S)
faces, cache = [], {}
for subset, face in blocks:
    if subset not in keep: continue
    u = re.search(r'url\((https://[^)]+)\)', face).group(1)
    if u not in cache: cache[u] = 'data:font/woff2;base64,' + base64.b64encode(get(u)).decode()
    faces.append(face.replace(u, cache[u]))
fontcss = '\n'.join(faces)
appcss = (dist / 'assets/app.css').read_text()
appjs = (dist / 'assets/app.js').read_text().replace('</script', '<\\/script')
html = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>WABYS 3D &amp; VR Labs</title>
<style>{fontcss}</style>
<style>{appcss}</style>
</head>
<body>
<div id="root"></div>
<script type="module">{appjs}</script>
</body>
</html>
'''
out.write_text(html)
print(len(cache), 'font files,', round(len(html) / 1e6, 2), 'MB')
