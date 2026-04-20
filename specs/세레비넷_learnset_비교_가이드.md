# 세레비넷 포켓몬챔피언스 learnset 비교 가이드

> 포챔스에 포켓몬이 추가될 때, 우리 learnsets.json에 누락된 기술이 없는지 세레비넷과 비교하는 절차.
> 최초 작성: 2026-04-20

---

## 1. 세레비넷 포켓몬챔피언스 URL 형식

```
https://www.serebii.net/pokedex-champions/{영어이름}/
```

- 영어이름은 소문자, 하이픈 사용 (예: `iron-hands`, `great-tusk`)
- 메가진화는 별도 URL 없음 → 기본형 페이지에 함께 수록됨
- 알트폼(알로라/가라르/히스이/팔데아)은 기본형 페이지에 함께 수록됨

예시:
```
https://www.serebii.net/pokedex-champions/487/  (기라티나)
https://www.serebii.net/pokedex-champions/006/  (리자몽)
```

숫자 URL도 동작하지만, 영어 이름 URL이 더 안정적임.

---

## 2. 세레비넷에서 기술 목록 파싱하는 Python 코드

```python
import urllib.request
import re

def fetch_serebii_moves(en: str) -> set[str]:
    """
    세레비넷 포켓몬챔피언스 페이지에서 배우는 기술 목록(영어)을 파싱해 set으로 반환.
    en: 포켓몬 영어 이름 (소문자, 하이픈 없이 — 자동 변환됨)
    """
    # 세레비넷 URL은 하이픈 형식 사용
    url_name = en.replace('_', '-')
    url = f"https://www.serebii.net/pokedex-champions/{url_name}/"
    
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            html = resp.read().decode('utf-8', errors='ignore')
    except Exception as e:
        print(f"  ❌ 요청 실패: {en} — {e}")
        return set()
    
    # 기술 링크 파싱: /attackdex-champions/기술이름/ 형태
    moves = re.findall(r'/attackdex-champions/([^/]+)/', html)
    
    # 언더바로 정규화
    normalized = set(m.replace('-', '_') for m in moves)
    return normalized
```

### 주의사항 (정규화 예외)
세레비넷 기술명과 우리 DB 기술명이 다른 경우:
| 세레비넷 | 우리 DB | 이유 |
|---|---|---|
| `forests_curse` | `forest_s_curse` | 아포스트로피 처리 방식 차이 |
| `kings_shield` | `king_s_shield` | 동일 |
| `lands_wrath` | `land_s_wrath` | 동일 |

이런 경우 실제로 missing이 아니므로 필터링 필요.

---

## 3. 우리 learnsets.json에서 포켓몬 기술 가져오기

```python
import json

DATA = '/home/soondoree07/pokenova_project/data'
learnsets = json.load(open(f'{DATA}/learnsets.json'))
moves_raw = json.load(open(f'{DATA}/quiz_moves.json'))

# in_champions=True인 기술만 추출 (챔피언스 관련 기술만 비교 대상)
champions_moves = {m['en'] for m in moves_raw if m.get('in_champions')}

def get_our_moves(en: str) -> set[str]:
    """learnsets.json에서 포켓몬이 배우는 기술 set 반환 (기본형 + 폼형 합산)"""
    entries = learnsets.get(en, [])
    if not entries:
        # 기본형이 비어있으면 폼 키(en_*) 합산
        for key, moves in learnsets.items():
            if key.startswith(en + '_'):
                entries.extend(moves)
    return {e['en'] for e in entries}
```

---

## 4. 비교 및 누락 기술 추가

```python
def compare(en: str):
    serebii = fetch_serebii_moves(en)
    ours = get_our_moves(en)
    
    # in_champions 기술 중 세레비넷에는 있는데 우리에 없는 것
    missing = (serebii & champions_moves) - ours
    return missing

# 누락 기술 learnsets.json에 추가
def add_missing(en: str, missing_moves: set[str]):
    if en not in learnsets:
        learnsets[en] = []
    existing = {e['en'] for e in learnsets[en]}
    added = 0
    for move in sorted(missing_moves):
        if move not in existing:
            learnsets[en].append({"en": move, "method": "machine", "level": 0})
            added += 1
    return added

# 저장
with open(f'{DATA}/learnsets.json', 'w', encoding='utf-8') as f:
    json.dump(learnsets, f, ensure_ascii=False, indent=2)
```

---

## 5. DB 반영 및 champions_learnsets.json 재생성

### 수정된 포켓몬들만 upsert (빠름, 1~2초/개)
```bash
cd /home/soondoree07/pochams_project
npm run upsert learnset <pokemon_en>
```

여러 마리 한꺼번에:
```bash
cd /home/soondoree07/pochams_project
for p in bulbasaur charmander squirtle; do
  npm run upsert learnset $p
done
```

전체 185마리 한꺼번에 (시간 많이 걸림):
```bash
cd /home/soondoree07/pochams_project
python3 -c "
import json
p = json.load(open('/home/soondoree07/pokenova_project/data/champions_learnsets.json'))
print(' '.join(x['en'] for x in p))
" | xargs -n1 sh -c 'npm run upsert learnset "$1"' _
```

### champions_learnsets.json 재생성
CLAUDE.md(pochams_project)의 "champions_learnsets.json 자동 갱신" 스크립트 실행.

---

## 6. 새 포켓몬이 추가될 때 체크리스트

1. `quiz_pokemon.json`에 포켓몬 추가
2. `pokemon_stats.json`에 스탯 추가
3. `learnsets.json`에 배우는기술 추가 → 세레비넷 비교 후 누락 없는지 확인
4. DB 반영: `npm run upsert pokemon <en>` + `npm run upsert learnset <en>`
5. `champions_learnsets.json` 재생성
6. `upsert.ts`의 `CHAMPIONS_POKEMON_IDS` Set에 새 포켓몬 ID 추가 (챔피언스 포켓몬인 경우)
7. `pochams_project/CLAUDE.md`의 Python 스크립트 내 `CHAMPIONS_IDS` Set에도 추가

---

## 7. 2026-04-20 실행 기록 (참고용)

- 대상: 185마리 챔피언스 포켓몬 전수 비교
- 세레비넷 fetch: 포켓몬당 1~2초, 약 20분 소요 (그룹별 병렬 처리)
- 결과: 683개 기술 누락 확인 → 전부 추가
- 최종: learnsets.json 총 67618행 → 재적재 후 champions_learnsets.json 11542개 항목
