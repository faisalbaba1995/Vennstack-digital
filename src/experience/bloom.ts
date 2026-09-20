import { Mesh, NoBlending, OrthographicCamera, PlaneGeometry, Scene, ShaderMaterial, Vector2, WebGLRenderTarget } from 'three';
import type { Camera, WebGLRenderer } from 'three';

/** Selective current glow at quarter width/height; one final linear-to-sRGB conversion. */
export function createBloom(renderer: WebGLRenderer) {
  const base = new WebGLRenderTarget(1, 1, { depthBuffer: false, stencilBuffer: false });
  const glow = new WebGLRenderTarget(1, 1, { depthBuffer: false, stencilBuffer: false });
  const geometry = new PlaneGeometry(2, 2);
  const material = new ShaderMaterial({
    depthTest: false, depthWrite: false, blending: NoBlending,
    uniforms: { base: { value: base.texture }, glow: { value: glow.texture }, stepSize: { value: new Vector2() } },
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader: `varying vec2 vUv; uniform sampler2D base; uniform sampler2D glow; uniform vec2 stepSize;
      void main(){
        vec4 color=texture2D(base,vUv); vec3 halo=vec3(0.);
        for(int x=-1;x<=1;x++){for(int y=-1;y<=1;y++){
          halo+=texture2D(glow,vUv+vec2(float(x),float(y))*stepSize*2.).rgb/9.;
        }}
        gl_FragColor=vec4(color.rgb+halo*.18,clamp(color.a+max(halo.r,max(halo.g,halo.b))*.18,0.,1.));
        #include <colorspace_fragment>
      }`,
  });
  const screen = new Scene(); screen.add(new Mesh(geometry, material));
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  let disposed = false, milliseconds = 0;
  return {
    resize(width: number, height: number) {
      base.setSize(width, height); glow.setSize(Math.max(1, Math.floor(width / 4)), Math.max(1, Math.floor(height / 4)));
      material.uniforms.stepSize.value.set(1 / glow.width, 1 / glow.height);
      const gl = renderer.getContext();
      try {
        for (const target of [base, glow]) {
          renderer.setRenderTarget(target);
          if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Bloom target unsupported');
        }
      } finally { renderer.setRenderTarget(null); }
    },
    render(scene: Scene, sceneCamera: Camera) {
      const start = performance.now();
      try {
        sceneCamera.layers.set(1); renderer.setRenderTarget(glow); renderer.render(scene, sceneCamera);
        const glowTime = performance.now() - start;
        sceneCamera.layers.set(0); renderer.setRenderTarget(base); renderer.render(scene, sceneCamera);
        const compositeStart = performance.now();
        renderer.setRenderTarget(null); renderer.render(screen, camera);
        milliseconds = glowTime + performance.now() - compositeStart;
      } finally { sceneCamera.layers.set(0); renderer.setRenderTarget(null); }
    },
    diagnostics() { return { bloomMs: milliseconds, bloomPixels: disposed ? 0 : glow.width * glow.height, targetBytes: disposed ? 0 : 4 * (base.width * base.height + glow.width * glow.height) }; },
    dispose() {
      if (disposed) return; disposed = true;
      base.dispose(); glow.dispose(); geometry.dispose(); material.dispose(); screen.clear();
    },
  };
}
