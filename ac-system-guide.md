# AC 시스템 구축 가이드

> AI가 역할별로 나뉘어 동시에 일하는 개인 AI 회사 시스템.
> 핸드폰 하나로 어디서든 여러 프로젝트를 지시하고, Claude들이 병렬로 작업한다.

---

## 개념 이해

### 이게 뭔가요?

일반적인 Claude 사용법: **나 → Claude → 답변** (1:1 대화)

AC 시스템: **나 → general(비서) → 여러 Claude 세션 동시 지시** (1:N 오케스트레이션)

예를 들어:
- `general` 세션이 총괄 비서 역할
- 코드 작업은 `nagalsigan`, `torin` 등 프로젝트별 세션에 위임
- 조사가 필요하면 `research` 세션에 위임
- 기획서 작성은 `marketing` 세션에 위임
- 검수는 `review` 세션에 위임

모두 **동시에** 돌아간다.

### 전체 구조

```
핸드폰 / 노트북 / 어디서든
    ↓ (브라우저 접속)
내 PC 웹 UI (ai.내도메인.com)
    ↓
Next.js 대시보드 + xterm.js 터미널
    ↓
tmux 세션들 → Claude Code (각 세션마다 1개)
```

---

## 필요한 것

### 하드웨어
- **메인 PC** (항상 켜둘 수 있는 것) — Windows + WSL2 또는 Linux
- 최소 RAM 16GB 이상 권장 (세션 여러 개 동시 실행)

### 소프트웨어
- WSL2 Ubuntu (Windows 사용자)
- tmux
- Node.js / Bun
- Claude Code CLI (`npm install -g @anthropic/claude-code`)
- PM2 (`npm install -g pm2`)

### 서비스 (선택)
- Cloudflare 계정 (외부 접근용 터널)
- 도메인 (없으면 로컬에서만 사용 가능)

---

## 핵심 구성 요소

### 1. tmux — 세션 관리자

tmux는 터미널 세션을 유지시켜 주는 도구.
Claude Code를 각 세션에서 실행하면, PC를 꺼도 세션이 유지된다.

```bash
# 세션 생성
tmux new-session -d -s general
tmux new-session -d -s research
tmux new-session -d -s marketing
tmux new-session -d -s myproject

# 세션에 명령 보내기 (이게 핵심!)
tmux send-keys -t general "안녕, 오늘 할 일 정리해줘" Enter

# 세션 목록 확인
tmux ls

# 세션 접속
tmux attach -t general
```

### 2. Claude Code — AI 엔진

각 tmux 세션에서 Claude Code를 실행한다.

```bash
# 세션에 접속해서 Claude Code 실행
tmux attach -t general
claude
```

Claude Code는 파일 읽기/쓰기, 코드 실행, 외부 API 호출까지 전부 가능한 AI 에이전트.

### 3. CLAUDE.md — 역할 지침서

프로젝트 루트 또는 홈 디렉토리에 `CLAUDE.md` 파일을 두면,
Claude Code가 대화 시작 시 자동으로 읽어서 역할을 인식한다.

```
~/.claude/CLAUDE.md          ← 전역 지침 (모든 세션 공통)
~/myproject/CLAUDE.md        ← 프로젝트별 지침
```

---

## 단계별 구축

### Step 1. tmux 세션 구성

목적에 맞는 세션을 만든다. 예시:

| 세션명 | 역할 |
|--------|------|
| general | 총괄 비서, 오케스트레이터 |
| research | 조사/분석 |
| marketing | 기획서/콘텐츠 작성 |
| review | 코드 검수 |
| myproject | 프로젝트 개발 |

```bash
# 세션 일괄 생성 스크립트
tmux new-session -d -s general
tmux new-session -d -s research
tmux new-session -d -s marketing
tmux new-session -d -s myproject
```

각 세션에 Claude Code 실행:
```bash
tmux send-keys -t general "cd ~ && claude" Enter
tmux send-keys -t research "cd ~ && claude" Enter
tmux send-keys -t myproject "cd ~/myproject && claude" Enter
```

### Step 2. CLAUDE.md 작성

**전역 지침** (`~/.claude/CLAUDE.md`):
```markdown
# 전역 지침

## 핵심 원칙
1. 최종 판단은 항상 나(사용자)가 한다
2. 파일 수정 전 반드시 확인
3. 불확실하면 추측 말고 질문

## 세션 역할
- general: 총괄 비서. 다른 세션에 위임하고 결과 취합
- research: 조사 전담. 웹 검색 후 정리
- myproject: 개발 전담

## 작업 완료 시
1. git commit + push
2. 작업 내용 간략 보고
```

**프로젝트별 지침** (`~/myproject/CLAUDE.md`):
```markdown
# myproject

## 프로젝트 정보
- 서비스명: 내 프로젝트
- 스택: Next.js / Tailwind / Supabase
- 배포: Vercel

## API 키
- NEXT_PUBLIC_XXX_KEY
- XXX_SECRET_KEY

## 작업 원칙
- 기능 추가 전 반드시 질문
- 코드 수정 시 관련 파일 먼저 읽기
```

### Step 3. 오케스트레이터 패턴 설정

general 세션이 다른 세션들에게 일을 시키는 패턴:

```bash
# general이 research 세션에 조사 위임
tmux send-keys -t research "Next.js 14 App Router 최신 변경사항 조사해서 ~/research-result.md에 저장해줘" Enter

# 결과 확인 후 general이 취합
tmux send-keys -t general "~/research-result.md 읽고 핵심만 요약해줘" Enter
```

### Step 4. PC 시작 시 자동 실행 (선택)

매번 수동으로 세션 만들기 번거로우면 자동 시작 스크립트를 만든다.

`~/.profile` 또는 `~/.bashrc`에 추가:
```bash
# AC 세션 자동 시작
if ! tmux has-session -t general 2>/dev/null; then
  tmux new-session -d -s general
  tmux new-session -d -s research
  tmux new-session -d -s myproject
  tmux send-keys -t general "cd ~ && claude" Enter
  tmux send-keys -t myproject "cd ~/myproject && claude" Enter
fi
```

### Step 5. 외부 접근 설정 (선택 — Cloudflare Tunnel)

집 밖에서도 접근하려면 Cloudflare Tunnel을 사용한다.

```bash
# cloudflared 설치
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared
chmod +x cloudflared
sudo mv cloudflared /usr/local/bin/

# 터널 생성 (Cloudflare 계정 필요)
cloudflared tunnel login
cloudflared tunnel create my-tunnel
cloudflared tunnel route dns my-tunnel ai.내도메인.com

# PM2로 백그라운드 실행
pm2 start "cloudflared tunnel run my-tunnel" --name cloudflared
pm2 save
```

---

## MCP 서버 연결 (선택 — 강력 추천)

MCP(Model Context Protocol)는 Claude Code에 외부 도구를 연결하는 방식.
연결하면 Claude가 직접 DB 쿼리, GitHub PR 생성, 브라우저 자동화 등을 할 수 있다.

`~/.claude/mcp.json` 또는 프로젝트별 `.mcp.json`:
```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_xxx"
      }
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/home/user/"]
    },
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp"]
    }
  }
}
```

주요 MCP 서버:

| MCP | 용도 | 설치 |
|-----|------|------|
| `@modelcontextprotocol/server-github` | GitHub PR/이슈 관리 | npx |
| `@modelcontextprotocol/server-filesystem` | 로컬 파일 접근 | npx |
| `@playwright/mcp` | 브라우저 자동화 | npx |
| `@supabase/mcp-server-supabase` | DB 관리 | npx |

---

## 운영 방법

### 기본 사용 패턴

```
나: "myproject에 로그인 기능 추가해줘"
        ↓
general: "어떤 방식으로 할지 먼저 물어볼게요" → 질문
        ↓
나: "이메일/비밀번호 방식으로"
        ↓
general: myproject 세션에 위임
        ↓
myproject: 코드 읽기 → 수정 → 완료 보고
        ↓
general: 결과 취합 후 나에게 보고
```

### 세션 상태 확인

```bash
# 모든 세션 확인
tmux ls

# 특정 세션 최근 출력 확인
tmux capture-pane -t general -p | tail -20

# 세션 직접 접속
tmux attach -t general

# 세션 빠져나오기 (세션은 유지됨)
Ctrl+B, D
```

### Obsidian으로 기록 관리 (선택)

작업 로그와 기획서를 Obsidian에 저장하면 나중에 찾기 편하다.

```
AC/
├── 01-sessions/     # 세션별 상태
├── 02-projects/     # 프로젝트 문서
├── 03-logs/         # 월별 작업 로그
│   └── 2026-04/
├── 04-memory/       # 결정 사항, 컨텍스트
└── 05-specs/        # 기획서
```

Claude Code에 Filesystem MCP를 연결하면 Obsidian vault에 직접 파일을 쓰게 할 수 있다.

---

## 자주 하는 실수

### Claude가 확인 없이 파일을 수정했다
→ CLAUDE.md에 "파일 수정 전 반드시 확인 요청" 명시

### 세션이 뭘 하고 있는지 모르겠다
→ `tmux capture-pane -t 세션명 -p | tail -30` 으로 확인

### 작업 완료됐는데 어디에 저장됐는지 모른다
→ CLAUDE.md에 "완료 시 git commit + 결과 보고" 명시

### 컨텍스트가 너무 길어져서 Claude가 지침을 잊는다
→ CLAUDE.md에 핵심 원칙을 짧고 명확하게 작성. 세션 재시작으로 컨텍스트 초기화

### 여러 세션이 같은 파일을 동시에 수정한다
→ 세션별로 담당 디렉토리/파일을 명확히 분리

---

## 최소 구성으로 시작하기

처음부터 복잡하게 만들 필요 없다.

**1단계 (오늘 바로 가능)**
```bash
# tmux 2개 세션만
tmux new-session -d -s main
tmux new-session -d -s dev

# 각 세션에 Claude Code 실행
tmux send-keys -t main "claude" Enter
tmux send-keys -t dev "cd ~/myproject && claude" Enter
```

**2단계 (익숙해지면)**
- CLAUDE.md로 역할 명확히 정의
- Obsidian 연동으로 기록 관리
- MCP 서버 1~2개 추가

**3단계 (고급)**
- Cloudflare Tunnel로 외부 접근
- PM2로 자동 시작 설정
- 세션 특화 (research, marketing 등 분리)

---

## 참고

- Claude Code 공식 문서: https://docs.anthropic.com/claude-code
- MCP 서버 목록: https://github.com/modelcontextprotocol/servers
- tmux 사용법: `man tmux` 또는 `tmux --help`
