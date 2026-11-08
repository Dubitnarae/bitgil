# 쇼 파일 형식 (`*.bitgil.json`, format_version 1)

쇼 파일 하나에 예배당의 모든 조명 설정이 들어간다. 시작 데이터는 `data/starter-show.bitgil.json`이다.

## 맨 위 항목

| 키 | 내용 |
| --- | --- |
| `format`, `format_version` | `"bitgil-show"`, `1` |
| `name` | 쇼 이름 (예: 예배당) |
| `source` | 어디서 만든 데이터인지 (콘솔 5555.XHD 해독) |
| `venue` | 공간 치수 |
| `fixture_types` | 조명 종류 6가지 |
| `fixtures` | 조명 36대 (패치 + 위치) |
| `groups` | 조명 묶음 |
| `scenes` | 씬 목록 |
| `cuelist` | 순서 재생 목록 `[{"scene": "P1-01", "fade": 2}]` — 씬 id와 페이드 초 (처음에는 비어 있음) |

## venue (단위 m, 추정값)

- 기준점: 통로 바닥(FL -1,200) 높이, 왼쪽 벽(글씨 벽)과 정면 벽(무대 뒤)의 모서리. x = 오른쪽, y = 위, z = 좌석 쪽.
- `room`: 길이 16.8 × 폭 12.2, 처마 6.0, 지붕 꼭대기 9.0 (용마루는 x 방향)
- `stage`: z 0~2.09, 높이 0.4
- `seating_tiers`: z 6.24부터 3단(0.4 / 0.8 / 1.2)
- `battens`: RD1 z 2.46, RD2 z 5.56, RD3 z 8.60, x 3.19~13.26(10 m), 높이 5.5
- `floor_pockets`: RD4 바닥 콘센트 3곳
- `props`: 강대상, 피아노, 밴드 자리
- `text_panels`: 1-10, 1-11이 글씨를 비추는 왼쪽 벽 위치

## fixture_types[]

```json
{
  "id": "11ch", "label": "RGBW 조명 11ch", "kind": "par", "channel_count": 11,
  "channels": [{"offset": 1, "attr": "red", "label": "Red", "mix": "LTP", "fade": true, "locate": 255}, ...],
  "beam_deg": [25, 25], "beam_estimated": true, "mount": "ceiling", "model": null
}
```

- `offset`: 조명의 시작 주소에서 몇 번째 채널인지 (1부터)
- `attr`: 표준 이름 (`dimmer`, `dimmer_fine`, `red`, `green`, `blue`, `white`, `pan`, `pan_fine`, `tilt`, `tilt_fine`, `zoom`, `shutter`, `color_macro`, `cto`, `auto`, `auto_speed`, `dimmer_mode`, `id`, `pt_speed`, `cct`, `macro`, `effect`, `effect_rotation`, `reset`, `speed`)
- `mix`: `HTP`(여러 씬 중 큰 값) 또는 `LTP`(마지막 값)
- `fade`: `false`면 페이드 없이 바로 바뀌는 채널
- `locate`: 콘솔 라이브러리의 Locate 기본값. 셔터 값의 의미(열림/스트로브)는 기구마다 달라 실물 확인이 필요하다.
- `beam_deg`: [가장 좁을 때, 가장 넓을 때] 빛 퍼짐 각도 (임시값)
- 무빙 워시는 `pan_deg` 540, `tilt_deg` 270 (임시값)

## fixtures[]

```json
{
  "id": "2-1", "fixture_page": 2, "fixture_button": 1, "address": 151, "universe": 1, "type": "11ch",
  "position": {"x": 3.58, "y": 5.2, "z": 5.56}, "mount": "ceiling", "direction": "down", "aim": null,
  "batten": "RD2", "verified": false, "evidence": "사진·스케치로 추정, 조명 찾기로 확인 필요"
}
```

- `direction`: `down`(천장, 아래로), `up`(바닥, 위로), `aimed`(`aim` 지점을 향함), `pan_tilt`(무빙 워시)
- `verified`: 실물과 위치가 확인됐는지. 지금은 바닥 조명 1-1~1-5만 확인됨.
- DMX 채널 번호 = `address` + `offset` − 1

## scenes[]

```json
{"id": "P1-01", "name": "P1-01", "source": "콘솔 Replay Page 1 페이더 1", "fade_seconds": 2.0,
 "values": {"1-1": {"tilt": 142, "tilt_fine": 98, "dimmer": 255, "shutter": 255, "red": 255, ...}, ...}}
```

- 값은 0~255. 씬에 없는 조명·채널은 "건드리지 않음"(직전 값 유지)으로 해석한다.
- 콘솔에서 효과(Shape)만 있던 장면 4개(P1-05, P1-06, P1-07, P2-05)는 제외했다. 효과는 2차 기능.
- 씬 이름은 사용자가 프로그램에서 바꾼다(테이프 메모: 설교, 찬양1, 찬양2, 기도 등).
