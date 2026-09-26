import urllib.request, json

def post(url, payload):
    req = urllib.request.Request(url, data=json.dumps(payload).encode(), headers={'Content-Type':'application/json'}, method='POST')
    resp = urllib.request.urlopen(req)
    return resp.getcode(), resp.read().decode()

def get(url):
    resp = urllib.request.urlopen(url)
    return resp.getcode(), resp.read().decode()

base = 'http://localhost:3000'

# Health
print('health:', get(base+'/health')[0])

# Create project
code, body = post(base+'/api/projects', {'title':'Test','county':'Orange','startTime':'2026-10-01T08:00:00Z','endTime':'2026-10-05T17:00:00Z','company':'TestCo'})
print('create:', code, body[:200])

# County
code, body = get(base+'/api/projects/county/Orange')
print('county:', code, 'len=', len(body))

# AI extract
code, body = post(base+'/api/ai/extract', {'text':'Repair road in Volusia from Jan 5 to Jan 10'})
print('ai extract:', code, body[:200])

# AI check-conflicts
code, body = post(base+'/api/ai/check-conflicts', {'text':'Repair road in Volusia from Jan 5 to Jan 10'})
print('ai conflicts:', code, body[:200])
