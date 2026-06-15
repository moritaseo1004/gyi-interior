# Interior Tracker

반셀프 인테리어 공정, 업체 견적, 일정 관리를 위한 정적 웹앱입니다.

## 로컬 실행

```bash
python3 -m http.server 8010
```

브라우저에서 `http://localhost:8010/` 접속.

## Supabase 연동

1. Supabase 프로젝트를 생성합니다.
2. Supabase SQL Editor에서 `supabase-schema.sql` 내용을 실행합니다.
3. Authentication에서 이메일/비밀번호 계정 1개를 만듭니다.
4. `supabase-config.js`에 프로젝트 URL과 anon key를 입력합니다.

```js
window.INTERIOR_SUPABASE = {
  url: "https://YOUR_PROJECT.supabase.co",
  anonKey: "YOUR_SUPABASE_ANON_KEY",
};
```

설정값이 비어 있으면 기존처럼 브라우저 로컬 저장소를 사용합니다.
설정값이 있으면 로그인 후 Supabase에 저장합니다.

## GitHub Pages 배포

정적 파일만 필요합니다.

- `index.html`
- `styles.css`
- `app.js`
- `supabase-config.js`
- `supabase-schema.sql`

GitHub 저장소에 push한 뒤, repository Settings > Pages에서 branch를 선택하면 됩니다.

## 보안 메모

Supabase anon key는 브라우저에 공개되는 키입니다. 보안은 `supabase-schema.sql`의 RLS 정책과 Supabase Auth 로그인으로 제어합니다.
