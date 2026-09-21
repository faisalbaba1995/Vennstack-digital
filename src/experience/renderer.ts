import { AdditiveBlending, AmbientLight, BufferGeometry, Color, DirectionalLight, Float32BufferAttribute, FogExp2, Group, Mesh, MeshPhongMaterial, PerspectiveCamera, PlaneGeometry, Points, PointsMaterial, Scene, ShaderMaterial, SRGBColorSpace, NoToneMapping, TorusGeometry, WebGLRenderer } from 'three';
import type { OceanScene, QualityTier, SceneOptions, SceneStatus, Viewport } from './scene-contract';
import { createQualityController, initialQuality, pixelRatio, QUALITY } from './quality';
import { createBloom } from './bloom';

/** Owns GPU resources, never a clock or semantic interaction. */
export function createOceanScene(canvas: HTMLCanvasElement, options: SceneOptions): OceanScene {
  const context = canvas.getContext('webgl2', { alpha: true, antialias: false, powerPreference: 'low-power' });
  if (!context) throw new Error('WebGL2 unavailable');
  const loss = context.getExtension('WEBGL_lose_context');
  let renderer: WebGLRenderer | undefined;
  try {
    renderer = new WebGLRenderer({ canvas, context, alpha: true, antialias: false, powerPreference: 'low-power' });
    return buildScene(renderer, canvas, options);
  } catch (error) {
    renderer?.dispose(); loss?.loseContext();
    if (canvas.isConnected) canvas.replaceWith(canvas.cloneNode(false));
    throw error;
  }
}

function buildScene(renderer: WebGLRenderer, canvas: HTMLCanvasElement, options: SceneOptions): OceanScene {
  // Cache while healthy: getExtension() can return null after a context is lost.
  renderer.extensions.get('WEBGL_lose_context');
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NoToneMapping;
  renderer.setClearColor(0x000000, 0);
  renderer.info.autoReset = false;
  renderer.debug.onShaderError = () => { throw new Error('Ocean shader compilation failed'); };
  const scene = new Scene();
  scene.fog = new FogExp2(0x07364d, .055);
  const camera = new PerspectiveCamera(45, 1, .1, 60);
  camera.position.z = 10;
  const currents = new Group();
  const ringGeometry = new TorusGeometry(2.15, .025, 8, 160);
  const ringMaterial = new MeshPhongMaterial({ color: 0x8ce9ff, emissive: 0x48cadf, emissiveIntensity: .7, shininess: 80, transparent: true, opacity: .32, blending: AdditiveBlending, depthWrite: false });
  for (const direction of [-1, 1]) {
    const ring = new Mesh(ringGeometry, ringMaterial);
    ring.position.x = direction * 1.05;
    ring.rotation.set(.45, direction * .45, direction * .35);
    ring.layers.enable(1);
    currents.add(ring);
  }
  scene.add(currents);
  const light = new DirectionalLight(0xb5faff, 2);
  light.position.set(-3, 6, 5);
  const ambient = new AmbientLight(0x406677, .5);
  light.layers.enable(1); ambient.layers.enable(1);
  scene.add(light, ambient);
  const causticsGeometry = new PlaneGeometry(45, 30);
  const causticsMaterial = new ShaderMaterial({
    transparent: true, depthWrite: false, blending: AdditiveBlending,
    uniforms: { time: { value: 0 }, strength: { value: .045 }, tint: { value: new Color(0x8ce9ff) } },
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `varying vec2 vUv; uniform float time; uniform float strength; uniform vec3 tint;
      void main(){
        vec2 p=vUv*18.; float t=time*.12;
        float a=sin(p.x+sin(p.y*1.3+t))*sin(p.y-t+sin(p.x*.7));
        float b=sin(p.x*1.2-p.y*.6+t)*sin(p.y*.9+p.x*.4-t);
        float filaments=pow(max(0.,1.-abs(a+b)),12.);
        float edge=smoothstep(0.,.3,vUv.y)*(1.-smoothstep(.65,1.,vUv.y));
        gl_FragColor=vec4(tint,strength*filaments*edge);
        #include <colorspace_fragment>
      }`,
  });
  const caustics = new Mesh(causticsGeometry, causticsMaterial);
  caustics.position.z = -9;
  scene.add(caustics);
  const positions = new Float32Array(240 * 3);
  for (let i = 0; i < positions.length; i++) positions[i] = (Math.sin(i * 127.1 + 311.7) * 43758.5453 % 1) * 9;
  const particlesGeometry = new BufferGeometry();
  particlesGeometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  const particlesMaterial = new PointsMaterial({ color: 0x9defff, size: .025, transparent: true, opacity: .4, depthWrite: false });
  const particles = new Points(particlesGeometry, particlesMaterial);
  scene.add(particles);
  let status: SceneStatus = 'ready', disposed = false, frames = 0, losses = 0, recoveries = 0, frameMs = 0;
  let viewport: Viewport = { width: 1, height: 1, dpr: 1 };
  const policy = createQualityController(initialQuality(navigator.hardwareConcurrency || 4,
    (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4,
    renderer.capabilities.maxTextureSize, innerWidth));
  let bloom: ReturnType<typeof createBloom> | null = null, bloomSupported = true, bloomPressure = 0, bloomMs = 0;
  let lastDepth = 0, interactionAge = 0, frameIntervalMs = 0;
  function resize(next: Viewport, quality?: QualityTier) {
    if (disposed) return;
    viewport = next;
    if (quality) policy.reset(quality);
    const ratio = pixelRatio(next, policy.tier);
    renderer.setPixelRatio(ratio); renderer.setSize(next.width, next.height, false);
    camera.aspect = next.width / Math.max(1, next.height); camera.updateProjectionMatrix();
    particlesGeometry.setDrawRange(0, QUALITY[policy.tier].particles);
    if (QUALITY[policy.tier].bloom && bloomSupported) {
      try { bloom ??= createBloom(renderer); bloom.resize(canvas.width, canvas.height); }
      catch { bloom?.dispose(); bloom = null; bloomSupported = false; }
    } else { bloom?.dispose(); bloom = null; }
  }
  let restoreTimer: ReturnType<typeof setTimeout> | undefined;
  const abort = new AbortController();
  const accent = new Color(), nextAccent = new Color(), nextFog = new Color();
  let elapsed = 0;
  const report = (next: SceneStatus, reason?: string) => { status = next; options.onStatus(next, reason); };
  function scheduleRestore() {
    clearTimeout(restoreTimer);
    if (disposed || document.hidden || status !== 'lost') return;
    restoreTimer = setTimeout(() => {
      if (disposed || document.hidden || status !== 'lost') return;
      try { renderer.forceContextRestore(); } catch { /* Timeout below preserves the static page. */ }
      restoreTimer = setTimeout(() => { if (!disposed && status === 'lost') report('failed', 'Graphics could not recover.'); }, 4000);
    }, 500);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearTimeout(restoreTimer);
    else if (status === 'lost') scheduleRestore();
  }, { signal: abort.signal });
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    losses++; report('lost'); scheduleRestore();
  }, { signal: abort.signal });
  canvas.addEventListener('webglcontextrestored', () => {
    if (disposed) return;
    clearTimeout(restoreTimer);
    if (++recoveries > 2) { report('failed', 'Graphics recovery limit reached.'); return; }
    renderer.resetState(); report('ready');
  }, { signal: abort.signal });
  return {
    update(_time, delta, depth) {
      if (disposed || status !== 'ready') return;
      const start = performance.now();
      frameIntervalMs = delta * 1000;
      interactionAge = Math.abs(depth.progress - lastDepth) > .0001 ? 0 : interactionAge + delta;
      lastDepth = depth.progress;
      const previousTier = policy.tier;
      policy.sample(frameIntervalMs, frameMs, delta, interactionAge < 3);
      if (previousTier !== policy.tier) resize(viewport);
      elapsed += Math.min(delta, .05);
      currents.rotation.z = Math.sin(elapsed * .09) * .12;
      currents.rotation.y = Math.sin(elapsed * .07) * .08;
      particles.rotation.y = elapsed * .012;
      particles.position.y = Math.sin(elapsed * .05) * .6;
      camera.position.y = -depth.progress * .7;
      camera.position.z = (camera.aspect < 1 ? 18 : 10) + depth.progress * 2;
      accent.set(depth.zone.accent).lerp(nextAccent.set(depth.next.accent), depth.mix);
      ringMaterial.color.copy(accent); ringMaterial.emissive.copy(accent);
      ringMaterial.opacity = (bloom ? .14 : .32) * (1 - depth.progress * .44);
      particlesMaterial.opacity = bloom ? .12 : .4;
      light.color.copy(accent); light.intensity = 2 - depth.progress * 1.5;
      scene.fog!.color.set(depth.zone.top).lerp(nextFog.set(depth.next.top), depth.mix);
      (scene.fog as FogExp2).density = .055 + depth.progress * .035;
      causticsMaterial.uniforms.time.value = elapsed;
      causticsMaterial.uniforms.strength.value = (bloom ? .002 : .02) * (1 - depth.progress * .8);
      causticsMaterial.uniforms.tint.value.copy(accent);
      try {
        renderer.info.reset();
        if (bloom) {
          try { bloom.render(scene, camera); bloomMs = bloom.diagnostics().bloomMs; }
          catch { bloom.dispose(); bloom = null; bloomSupported = false; renderer.render(scene, camera); }
        } else renderer.render(scene, camera);
        frames++;
        bloomPressure = frames > 60 && bloomMs > 5 ? bloomPressure + delta : Math.max(0, bloomPressure - delta * 2);
        if (bloom && bloomPressure > 2) { bloom.dispose(); bloom = null; bloomSupported = false; }
      }
      catch { report('failed', 'Graphics unavailable.'); }
      frameMs = performance.now() - start;
    },
    resize,
    pause() { if (status === 'ready') report('paused'); },
    resume() { if (status === 'paused') report('ready'); },
    diagnostics() {
      return { status, quality: policy.tier, frames, particles: disposed ? 0 : QUALITY[policy.tier].particles, drawCalls: renderer.info.render.calls,
        geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures,
        programs: renderer.info.programs?.length ?? 0, pixelCount: disposed ? 0 : canvas.width * canvas.height,
        renderTargets: bloom ? 2 : 0, contextLosses: losses, recoveries, frameMs, frameIntervalMs, viewport,
        bloomEnabled: !!bloom, bloomMs, bloomSupported, ...bloom?.diagnostics() };
    },
    dispose() {
      if (disposed) return;
      disposed = true; abort.abort(); clearTimeout(restoreTimer);
      ringGeometry.dispose(); ringMaterial.dispose(); particlesGeometry.dispose(); particlesMaterial.dispose();
      causticsGeometry.dispose(); causticsMaterial.dispose();
      bloom?.dispose(); bloom = null;
      scene.clear(); renderer.dispose(); renderer.forceContextLoss();
      // A discarded context cannot be reused by a subsequent mount on this node.
      if (canvas.isConnected) canvas.replaceWith(canvas.cloneNode(false));
      report('disposed');
    },
  };
}
