import urllib.request, re
for url in [
    'http://localhost:3000/onboarding.html',
    'http://localhost:3000/intake.html',
    'http://localhost:3000/conflict.html',
]:
    html = urllib.request.urlopen(url).read().decode('utf-8')
    hrefs = re.findall(r'href=["\'](.*?)["\']', html)
    print(url)
    for h in hrefs[:6]:
        print('  href=', h)
