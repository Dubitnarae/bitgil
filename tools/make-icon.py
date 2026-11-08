# 앱 아이콘 build/icon.png 를 그린다: 어두운 바탕 + 위에서 비추는 조명 빛줄기 + 바닥 빛 웅덩이.
# 실행: python tools/make-icon.py  (Pillow 필요)
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

S = 1024  # 크게 그리고 줄여서 가장자리를 부드럽게
img = Image.new('RGBA', (S, S), (0, 0, 0, 0))

# 둥근 사각형 바탕(앱 테마색 #111318 계열)
bg = Image.new('RGBA', (S, S), (0, 0, 0, 0))
ImageDraw.Draw(bg).rounded_rectangle([24, 24, S - 24, S - 24], radius=200, fill=(20, 24, 34, 255))
mask = bg.split()[3]

# 빛줄기: 위 조명에서 아래로 퍼지는 사다리꼴, 흐리게 해서 빛처럼
beam = Image.new('RGBA', (S, S), (0, 0, 0, 0))
ImageDraw.Draw(beam).polygon([(452, 250), (572, 250), (800, 800), (224, 800)], fill=(255, 205, 110, 120))
beam = beam.filter(ImageFilter.GaussianBlur(30))

# 바닥 빛 웅덩이(길)
pool = Image.new('RGBA', (S, S), (0, 0, 0, 0))
ImageDraw.Draw(pool).ellipse([200, 740, 824, 860], fill=(255, 220, 140, 230))
pool = pool.filter(ImageFilter.GaussianBlur(18))

# 조명 기구 몸체
lamp = Image.new('RGBA', (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(lamp)
d.rectangle([496, 120, 528, 180], fill=(150, 160, 180, 255))           # 매달린 막대
d.rounded_rectangle([420, 170, 604, 270], radius=30, fill=(200, 208, 222, 255))  # 몸통
d.ellipse([440, 236, 584, 290], fill=(255, 240, 200, 255))            # 렌즈

for layer in (beam, pool, lamp):
    bg = Image.alpha_composite(bg, layer)
bg.putalpha(mask)  # 바탕 밖으로 번진 빛 잘라내기

out = Path(__file__).resolve().parent.parent / 'build' / 'icon.png'
out.parent.mkdir(exist_ok=True)
bg.resize((512, 512), Image.LANCZOS).save(out)
print(out)
