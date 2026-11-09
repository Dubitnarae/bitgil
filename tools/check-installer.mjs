// 설치 파일 무결성 검사: NSIS 가 끝 4바이트에 적어 둔 CRC 와 실제 내용(512바이트 뒤부터)을 비교한다.
// 이 컴퓨터에서 가끔 설치 파일 1비트가 뒤집혀(하드웨어 의심) 설치가 exit 2 로 멈춘 일이 있어, 빌드 직후 막는다.
// 사용: node tools/check-installer.mjs [설치 파일] (없으면 dist/bitgil-setup-<버전>.exe)
import { readFileSync } from 'node:fs'
import { crc32 } from 'node:zlib'

const file = process.argv[2] ?? `dist/bitgil-setup-${JSON.parse(readFileSync('package.json', 'utf-8')).version}.exe`
const buf = readFileSync(file)
if (buf.indexOf(Buffer.from('efbeadde4e756c6c736f6674496e7374', 'hex')) < 0) {
  console.error(`NSIS 설치 파일이 아닙니다: ${file}`)
  process.exit(1)
}
if ((crc32(buf.subarray(512, buf.length - 4)) >>> 0) === buf.readUInt32LE(buf.length - 4)) {
  console.log(`설치 파일 검사 통과: ${file}`)
} else {
  console.error(`\x1b[31m설치 파일이 깨졌습니다(CRC 불일치): ${file} — npm run dist 를 다시 하세요\x1b[0m`)
  process.exit(1)
}
