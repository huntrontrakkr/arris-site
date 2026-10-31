"""Who came to arristype.com, from Cloudflare's analytics: requests and
visitors by hour, and for page loads the pages, where they came from (the
referring site), countries and devices; then the posts on Reddit that link
to the site, with their scores. Run by .github/workflows/traffic.yml.

    CLOUDFLARE_API_TOKEN=... python3 tools/traffic.py [hours]

The token needs Zone > Analytics > Read for arristype.com (and Zone >
Zone > Read to find it). Writes Markdown to stdout, and to the file
GITHUB_STEP_SUMMARY names, if any.
"""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from datetime import UTC, datetime, timedelta

API = 'https://api.cloudflare.com/client/v4'
ZONE = 'arristype.com'
out: list[str] = []


def say(line: str = '') -> None:
    out.append(line)
    print(line, flush=True)


def call(url: str, body: dict | None = None, token: str | None = None, ua: str | None = None) -> tuple[int, dict]:
    req = urllib.request.Request(url, data=json.dumps(body).encode() if body is not None else None)
    if token:
        req.add_header('Authorization', f'Bearer {token}')
    if body is not None:
        req.add_header('Content-Type', 'application/json')
    req.add_header('User-Agent', ua or 'arristype-traffic/1.0')
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.load(r)
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.load(e)
        except Exception:  # noqa: BLE001
            return e.code, {}
    except Exception as e:  # noqa: BLE001
        return 0, {'error': str(e)}


def gql(token: str, query: str, variables: dict) -> tuple[dict | None, str | None]:
    status, r = call(f'{API}/graphql', {'query': query, 'variables': variables}, token)
    if r.get('errors'):
        return None, '; '.join(e.get('message', str(e)) for e in r['errors'])
    if status != 200 or not r.get('data'):
        return None, f'HTTP {status} {json.dumps(r)[:300]}'
    return r['data'], None


def table(rows: list[tuple], head: tuple) -> None:
    say('| ' + ' | '.join(head) + ' |')
    say('|' + '---|' * len(head))
    for r in rows:
        say('| ' + ' | '.join(str(x) for x in r) + ' |')
    say()


def cloudflare(hours: int) -> None:
    token = os.environ.get('CLOUDFLARE_API_TOKEN', '')
    if not token:
        say('No CLOUDFLARE_API_TOKEN: no Cloudflare numbers.')
        return
    status, r = call(f'{API}/zones?name={ZONE}', token=token)
    if not r.get('result'):
        say(f'Could not find the zone {ZONE} (HTTP {status}): {json.dumps(r.get("errors", r))[:300]}')
        return
    zone = r['result'][0]['id']
    now = datetime.now(UTC).replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)
    since = now - timedelta(hours=hours)
    iso = lambda t: t.strftime('%Y-%m-%dT%H:%M:%SZ')  # noqa: E731
    say(f'## arristype.com, the last {hours} hours (to {iso(now)}, UTC)')
    say()
    q = """query($zone: String!, $since: Time!, $until: Time!) { viewer { zones(filter: {zoneTag: $zone}) {
      httpRequests1hGroups(limit: 200, orderBy: [datetime_ASC], filter: {datetime_geq: $since, datetime_lt: $until}) {
        dimensions { datetime } sum { requests pageViews bytes } uniq { uniques } } } } }"""
    data, err = gql(token, q, {'zone': zone, 'since': iso(since), 'until': iso(now)})
    if err:
        say(f'Hourly totals: not available: {err}')
        if 'auth' in err.lower() or 'permission' in err.lower() or 'access' in err.lower():
            say('The token needs **Zone > Analytics > Read** for arristype.com.')
            return
    else:
        rows = data['viewer']['zones'][0]['httpRequests1hGroups']
        tot = {k: sum(x['sum'][k] for x in rows) for k in ('requests', 'pageViews', 'bytes')}
        say(f'**{tot["pageViews"]:,} page views**, {tot["requests"]:,} requests, {tot["bytes"] / 1e9:.2f} GB; '
            f'unique visitors per hour summed: {sum(x["uniq"]["uniques"] for x in rows):,}')
        say()
        table([(x['dimensions']['datetime'][5:16].replace('T', ' '), x['sum']['pageViews'], x['uniq']['uniques'],
                x['sum']['requests']) for x in rows if x['sum']['requests']],
              ('hour (UTC)', 'page views', 'visitors', 'requests'))
    # page loads in detail (the adaptive dataset: a shorter reach on the free plan)
    for span in (24, 6):
        s2 = now - timedelta(hours=min(span, hours))
        filt = '{datetime_geq: $since, datetime_lt: $until, edgeResponseContentTypeName: "html", edgeResponseStatus: 200}'
        parts = {
            'Where page loads came from (referring site)': 'clientRefererHost',
            'Pages': 'clientRequestPath',
            'Countries': 'clientCountryName',
            'Devices': 'clientDeviceType',
            'Browsers': 'userAgentBrowser',
        }
        ok = False
        for title, dim in parts.items():
            q = f"""query($zone: String!, $since: Time!, $until: Time!) {{ viewer {{ zones(filter: {{zoneTag: $zone}}) {{
              g: httpRequestsAdaptiveGroups(limit: 25, orderBy: [count_DESC], filter: {filt}) {{
                count dimensions {{ {dim} }} }} }} }} }}"""
            data, err = gql(token, q, {'zone': zone, 'since': iso(s2), 'until': iso(now)})
            if err:
                say(f'{title}: not available over {span} hours: {err}')
                continue
            ok = True
            rows = data['viewer']['zones'][0]['g']
            say(f'### {title}, the last {min(span, hours)} hours')
            table([(x['dimensions'][dim] or '(none: typed, bookmarked, or an app)', x['count']) for x in rows],
                  (dim, 'page loads'))
        if ok:
            # the full font loads when someone opens the character set or reads past the first screens
            q = """query($zone: String!, $since: Time!, $until: Time!) { viewer { zones(filter: {zoneTag: $zone}) {
              g: httpRequestsAdaptiveGroups(limit: 25, orderBy: [count_DESC], filter: {datetime_geq: $since, datetime_lt: $until, clientRequestPath_like: "/fonts/%"}) {
                count dimensions { clientRequestPath } } } } }"""
            data, err = gql(token, q, {'zone': zone, 'since': iso(s2), 'until': iso(now)})
            if not err:
                say(f'### Font files fetched, the last {min(span, hours)} hours')
                table([(x['dimensions']['clientRequestPath'], x['count']) for x in data['viewer']['zones'][0]['g']],
                      ('file', 'requests'))
            break


def reddit() -> None:
    say('## Reddit: posts linking to arristype.com')
    say()
    for host in ('www.reddit.com', 'old.reddit.com'):
        status, r = call(f'https://{host}/domain/arristype.com/new.json?limit=25', ua='linux:arristype-traffic:1.0 (by the site owner)')
        if status == 200 and 'data' in r:
            posts = [c['data'] for c in r['data']['children']]
            if not posts:
                say('No posts listed. A post removed by a moderator or the spam filter is not listed here.')
            else:
                table([(p['subreddit_name_prefixed'], p['title'][:70], p['score'], f"{int(p.get('upvote_ratio', 0) * 100)}%",
                        p['num_comments'], datetime.fromtimestamp(p['created_utc'], UTC).strftime('%m-%d %H:%M'))
                       for p in posts], ('sub', 'title', 'score', 'upvoted', 'comments', 'posted (UTC)'))
            return
        say(f'{host}: HTTP {status} (Reddit often refuses requests from cloud servers)')
    say()


def main() -> int:
    hours = int(sys.argv[1]) if len(sys.argv) > 1 else 48
    cloudflare(hours)
    reddit()
    summary = os.environ.get('GITHUB_STEP_SUMMARY')
    if summary:
        with open(summary, 'a') as f:
            f.write('\n'.join(out) + '\n')
    return 0


if __name__ == '__main__':
    sys.exit(main())
