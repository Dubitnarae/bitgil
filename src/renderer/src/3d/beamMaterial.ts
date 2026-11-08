import { AdditiveBlending, Color, DoubleSide, ShaderMaterial } from 'three'

/** 빛줄기 원뿔: 가산 혼합, 조명 쪽은 진하고 끝으로 갈수록 옅게 (그림자 없음, 가벼움) */
export function beamMaterial() {
  return new ShaderMaterial({
    uniforms: { color: { value: new Color(1, 1, 1) }, opacity: { value: 0.3 } },
    vertexShader: `varying float vT;
      void main() { vT = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 color; uniform float opacity; varying float vT;
      void main() { gl_FragColor = vec4(color, opacity * vT * vT); }`,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide
  })
}
